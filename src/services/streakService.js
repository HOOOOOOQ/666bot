'use strict';

const { Duo, DailyActivity, StreakHistory, UserStat } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { isDuplicateKeyError } = require('../utils/errors');
const { getDayKey, previousDayKey } = require('../utils/time');
const duoService = require('./duoService');
const rewardService = require('./rewardService');
const notificationService = require('./notificationService');

const log = createLogger('streak');

const ROLLOVER_BATCH_SIZE = 200;

async function recordHistory(entry) {
  try {
    await StreakHistory.create(entry);
  } catch (error) {
    if (!isDuplicateKeyError(error)) log.warn('Failed to write streak history.', error.message);
  }
}

/**
 * Called after an activity has been stored. When BOTH members have a valid
 * activity for the day, the streak is incremented exactly once.
 *
 * The `lastCompletedDay != dayKey` filter together with the unique activity
 * index makes this race-condition safe: two simultaneous messages can never
 * add two streak days.
 */
async function onActivityRecorded({ duo, guildConfig = null, dayKey }) {
  if (!duo || duo.status !== 'active') return { completed: false, reason: 'duo_inactive' };

  const activityCount = await DailyActivity.countDocuments({ duoId: duo._id, dayKey });
  if (activityCount < 2) return { completed: false, reason: 'waiting_partner' };

  const now = new Date();
  const xpPerDay = Math.max(1, Number(guildConfig?.xpPerDay) || config.duo.xpPerDay);

  const updated = await Duo.findOneAndUpdate(
    {
      _id: duo._id,
      status: 'active',
      lastCompletedDay: { $ne: dayKey },
    },
    {
      $inc: { currentStreak: 1, totalDays: 1, xp: xpPerDay },
      $set: { lastCompletedDay: dayKey },
    },
    { new: true },
  ).lean();

  if (!updated) {
    return { completed: false, reason: 'already_completed' };
  }

  let finalDuo = updated;

  if (Number(updated.bestStreak) < Number(updated.currentStreak)) {
    finalDuo = await Duo.findOneAndUpdate(
      { _id: updated._id },
      { $set: { bestStreak: updated.currentStreak } },
      { new: true },
    ).lean() || updated;
  }

  if (Number(finalDuo.currentStreak) === 1) {
    finalDuo = await Duo.findOneAndUpdate(
      { _id: finalDuo._id },
      { $set: { streakStartedAt: now } },
      { new: true },
    ).lean() || finalDuo;
  }

  await recordHistory({
    guildId: finalDuo.guildId,
    duoId: finalDuo._id,
    dayKey,
    type: 'completed',
    streak: Number(finalDuo.currentStreak) || 0,
    xp: xpPerDay,
    note: `Day ${finalDuo.currentStreak} completed by both members`,
  });

  await Promise.all((finalDuo.members || []).map((member) => UserStat.updateOne(
    { guildId: finalDuo.guildId, userId: member.userId },
    {
      $set: { currentStreak: Number(finalDuo.currentStreak) || 0, duoId: finalDuo._id },
      $max: { bestStreak: Number(finalDuo.currentStreak) || 0 },
      $inc: { completedDays: 1 },
    },
  ).catch((error) => log.warn('Failed to update user streak stats.', error.message))));

  const rewards = await rewardService.checkAndGrant({ duo: finalDuo, guildConfig });

  notificationService.notifyStreakCompleted({
    duo: finalDuo,
    streak: finalDuo.currentStreak,
    rewards,
    guildConfig,
  });

  duoService.invalidateDuo(finalDuo);
  log.info(`Duo ${finalDuo._id} streak -> ${finalDuo.currentStreak} days (${finalDuo.guildId}).`);

  return {
    completed: true,
    duo: finalDuo,
    streak: Number(finalDuo.currentStreak) || 0,
    xpAwarded: xpPerDay,
    rewards,
  };
}

/**
 * Resets a streak after a missed day. Returns null when there was nothing to
 * break (idempotent, safe to retry).
 */
async function breakStreak({ duo, dayKey, reason = 'inactivity', guildConfig = null }) {
  if (!duo) return null;

  const lostStreak = Number(duo.currentStreak) || 0;
  if (lostStreak <= 0) return null;

  const updated = await Duo.findOneAndUpdate(
    { _id: duo._id, status: 'active', currentStreak: { $gt: 0 } },
    { $set: { currentStreak: 0 } },
    { new: true },
  ).lean();

  if (!updated) return null;

  await recordHistory({
    guildId: updated.guildId,
    duoId: updated._id,
    dayKey,
    type: 'broken',
    streak: lostStreak,
    note: reason === 'partner_left'
      ? 'Partner left the server'
      : `Missed daily activity after ${lostStreak} days`,
  });

  await UserStat.updateMany(
    { guildId: updated.guildId, duoId: updated._id },
    { $set: { currentStreak: 0 } },
  ).catch((error) => log.warn('Failed to reset member streak stats.', error.message));

  notificationService.notifyStreakBroken({
    duo: updated,
    lostStreak,
    guildConfig,
    reason,
  });

  duoService.invalidateDuo(updated);
  log.info(`Duo ${updated._id} streak broken after ${lostStreak} days (${updated.guildId}).`);

  return { duo: updated, lostStreak };
}

/**
 * Daily rollover: break every active streak whose last completed day is older
 * than the day that just ended. Runs once per guild per day and is safe to
 * call on startup (catches up after downtime).
 */
async function evaluateGuildRollover({ guildId, guildConfig, now = new Date() }) {
  const gid = String(guildId);
  const timezone = guildConfig?.timezone || config.duo.timezone;
  const todayKey = getDayKey(now, timezone);
  const lastDayKey = previousDayKey(todayKey);

  let evaluated = 0;
  let broken = 0;

  // Process in batches so a large server is fully caught up in one run while
  // keeping memory and query size bounded.
  for (let batch = 0; batch < 20; batch += 1) {
    const candidates = await Duo.find({
      guildId: gid,
      status: 'active',
      currentStreak: { $gt: 0 },
      lastCompletedDay: { $lt: lastDayKey },
    })
      .sort({ lastCompletedDay: 1 })
      .limit(ROLLOVER_BATCH_SIZE)
      .lean();

    if (!candidates.length) break;
    evaluated += candidates.length;

    let batchBroken = 0;
    for (const duo of candidates) {
      const result = await breakStreak({
        duo,
        dayKey: lastDayKey,
        reason: 'inactivity',
        guildConfig,
      }).catch((error) => {
        log.error(`Failed to break streak for duo ${duo._id}.`, error);
        return null;
      });
      if (result) batchBroken += 1;
    }

    broken += batchBroken;
    if (candidates.length < ROLLOVER_BATCH_SIZE) break;
    // Safety: stop when nothing could be processed to avoid an endless loop.
    if (batchBroken === 0) break;
  }

  return { evaluated, broken, todayKey, lastDayKey };
}

module.exports = {
  onActivityRecorded,
  breakStreak,
  evaluateGuildRollover,
  ROLLOVER_BATCH_SIZE,
};
