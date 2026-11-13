'use strict';

/**
 * 666 DUO STREAK LOGS — durable, automatic, exactly-once-per-day delivery.
 *
 * Flow:
 *   streakService increments a streak
 *     -> recordStreakIncrement() writes one StreakLog row (unique duoId+dayKey)
 *     -> the row is claimed atomically (status pending/failed -> sending)
 *     -> the rendered banner + embed is sent to the configured channel
 *     -> status becomes sent, or failed with exponential backoff
 *
 * A restart can never lose a log: rows are durable, `sending` rows are recovered
 * on boot, and the unique index makes a duplicate row impossible.
 */

const { StreakLog, DailyActivity } = require('../database/models');
const { isDuplicateKeyError } = require('../utils/errors');
const { resolveManyMembers } = require('../utils/members');
const { createLogger } = require('../utils/logger');
const configService = require('./configService');
const { buildStreakLogPayload } = require('../ui/cards/payloads');

const log = createLogger('streaklogs');

const MAX_ATTEMPTS = 6;
const RETRY_BASE_MS = 60 * 1000;
const RETRY_MAX_MS = 30 * 60 * 1000;
const STALE_SENDING_MS = 2 * 60 * 1000;
const RETRY_BATCH = 10;

let client = null;
let startupTimer = null;
let stopped = false;

const queue = [];
const queued = new Set();
const inFlight = new Set();
const delivered = new Map();
let drainPromise = null;

function init(discordClient) {
  client = discordClient || null;
  stopped = false;
}

function enqueue(logId) {
  const id = String(logId);
  if (queued.has(id) || inFlight.has(id)) return;
  queued.add(id);
  queue.push(id);
}

function drain() {
  if (drainPromise) return drainPromise;

  drainPromise = (async () => {
    while (queue.length) {
      const id = queue.shift();
      queued.delete(id);
      inFlight.add(id);
      try {
        await processLog(id);
      } catch (error) {
        log.error(`Unexpected log delivery failure for ${id}.`, error);
      } finally {
        inFlight.delete(id);
      }
    }
  })().finally(() => {
    drainPromise = null;
  });

  return drainPromise;
}

/** Waits for in-flight deliveries; used by graceful shutdown and tests. */
async function flush(timeoutMs = 10000) {
  const deadline = Date.now() + Math.max(100, Number(timeoutMs) || 10000);

  while (Date.now() < deadline) {
    if (drainPromise) await drainPromise.catch(() => {});
    if (!queue.length && !inFlight.size) return true;
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }

  return false;
}

async function markSkipped(logEntry, reason) {
  await StreakLog.updateOne(
    { _id: logEntry._id, status: 'sending' },
    { $set: { status: 'skipped', lastError: reason } },
  ).catch((error) => log.warn(`Could not mark log ${logEntry._id} skipped.`, error.message));
}

/**
 * Claims and delivers one persisted log.
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
async function processLog(logId, { force = false } = {}) {
  if (!client) return { sent: false, reason: 'no_client' };
  if (delivered.has(String(logId))) return { sent: false, reason: 'already_sent' };

  const now = new Date();
  const filter = { _id: logId, status: { $in: ['pending', 'failed'] } };
  if (!force) {
    filter.attempts = { $lt: MAX_ATTEMPTS };
    filter.nextAttemptAt = { $lte: now };
  }

  let claimed;
  try {
    claimed = await StreakLog.findOneAndUpdate(
      filter,
      { $set: { status: 'sending' }, $inc: { attempts: 1 } },
      { new: true },
    ).lean();
  } catch (error) {
    log.error(`Could not claim streak log ${logId}.`, error);
    return { sent: false, reason: 'claim_failed' };
  }

  if (!claimed) {
    const existing = await StreakLog.findById(logId).lean().catch(() => null);
    if (existing?.status === 'sent') return { sent: false, reason: 'already_sent' };
    return { sent: false, reason: 'not_claimable' };
  }

  try {
    const guildConfig = await configService.getGuildConfig(claimed.guildId, { fresh: true });
    const channelId = guildConfig?.logChannelId;

    if (!channelId) {
      await markSkipped(claimed, 'Log channel is not configured.');
      return { sent: false, reason: 'no_channel' };
    }

    const channel = client.channels?.cache?.get(channelId)
      || await client.channels?.fetch(channelId).catch(() => null)
      || null;

    if (!channel) {
      await markSkipped(claimed, 'Log channel no longer exists or is not visible to the bot.');
      return { sent: false, reason: 'channel_missing' };
    }

    if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) {
      await markSkipped(claimed, 'Configured log channel is not text based.');
      return { sent: false, reason: 'channel_not_text' };
    }

    const guild = channel.guild || client.guilds?.cache?.get(claimed.guildId) || null;

    // Prefer live Discord names/avatars at delivery time; fall back to the
    // durable snapshot if a member is no longer reachable.
    let renderEntry = claimed;
    if (guild && Array.isArray(claimed.members) && claimed.members.length) {
      try {
        const live = await resolveManyMembers(guild, claimed.members.map((member) => member.userId));
        if (live.size) {
          renderEntry = {
            ...claimed,
            members: claimed.members.map((member) => {
              const resolved = live.get(String(member.userId));
              return resolved
                ? {
                  ...member,
                  username: resolved.username || member.username,
                  displayName: resolved.displayName || member.displayName,
                  avatar: resolved.avatar || member.avatar,
                }
                : member;
            }),
          };
        }
      } catch (error) {
        log.debug(`Using stored streak-log member data: ${error.message}`);
      }
    }

    const payload = await buildStreakLogPayload(renderEntry, {
      guildName: guild?.name,
      timezone: guildConfig?.timezone,
    });

    const sendPayload = {
      embeds: [payload.embed],
      allowedMentions: {
        users: (claimed.members || []).map((member) => String(member.userId)),
        parse: [],
      },
    };
    if (Array.isArray(payload.files) && payload.files.length) sendPayload.files = payload.files;

    const message = await channel.send(sendPayload);

    try {
      await StreakLog.updateOne(
        { _id: claimed._id, status: 'sending' },
        {
          $set: {
            status: 'sent',
            channelId,
            messageId: message?.id || null,
            sentAt: new Date(),
            lastError: null,
          },
        },
      );
    } catch (error) {
      // The message is already in Discord. Keep the in-memory dedupe and log
      // loudly; a restart may re-deliver this single log, but it can never be
      // duplicated within the running process.
      log.error(`Log ${claimed._id} sent but status could not be persisted.`, error);
    }

    delivered.set(String(claimed._id), Date.now());
    if (delivered.size > 2000) {
      const oldest = delivered.keys().next().value;
      delivered.delete(oldest);
    }
    log.info(`Streak log sent for duo ${claimed.duoId} (${claimed.dayKey}) in ${claimed.guildId}.`);
    return { sent: true };
  } catch (error) {
    const attempts = Number(claimed.attempts) || 1;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1)));
    const exhausted = attempts >= MAX_ATTEMPTS;

    await StreakLog.updateOne(
      { _id: claimed._id, status: 'sending' },
      {
        $set: {
          status: 'failed',
          lastError: String(error?.message || error).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + delay),
        },
      },
    ).catch((updateError) => log.warn(`Could not persist retry state for ${claimed._id}.`, updateError.message));

    log.warn(
      `Streak log ${claimed._id} failed (attempt ${attempts}/${MAX_ATTEMPTS})${exhausted ? ' — giving up' : `, retry in ${Math.round(delay / 1000)}s`}. ${error?.message || error}`,
    );
    return { sent: false, reason: exhausted ? 'exhausted' : 'retry_scheduled' };
  }
}

/**
 * Recovers rows stuck in `sending` after a crash/restart, then queues anything
 * due. Safe to call repeatedly.
 */
async function retryPending({ limit = RETRY_BATCH } = {}) {
  if (!client) return 0;

  try {
    await StreakLog.updateMany(
      {
        status: 'sending',
        updatedAt: { $lt: new Date(Date.now() - STALE_SENDING_MS) },
      },
      {
        $set: {
          status: 'failed',
          lastError: 'Recovered a stale send after restart.',
          nextAttemptAt: new Date(),
        },
      },
    );
  } catch (error) {
    log.warn('Could not recover stale log sends.', error.message);
  }

  let pending = [];
  try {
    pending = await StreakLog.find({
      status: { $in: ['pending', 'failed'] },
      attempts: { $lt: MAX_ATTEMPTS },
      nextAttemptAt: { $lte: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(Math.max(1, Number(limit) || RETRY_BATCH))
      .lean();
  } catch (error) {
    log.error('Could not query pending streak logs.', error);
    return 0;
  }

  for (const entry of pending) enqueue(entry._id);
  if (pending.length) await drain().catch(() => {});
  return pending.length;
}

/**
 * Called exactly once after a real streak increment.
 *
 * @param {object} data
 * @param {object} data.duo updated Duo document
 * @param {number} data.previousStreak
 * @param {string} data.dayKey
 * @param {object|null} [data.guildConfig]
 * @returns {Promise<object|null>} the persisted log row
 */
async function recordStreakIncrement({
  duo, previousStreak, dayKey, guildConfig = null,
}) {
  if (!duo || !dayKey) return null;

  let cfg = guildConfig;
  if (!cfg) {
    cfg = await configService.getGuildConfig(duo.guildId).catch(() => null);
  }
  if (!cfg?.logChannelId) return null;

  const activityDocs = await DailyActivity.find({ duoId: duo._id, dayKey })
    .lean()
    .catch((error) => {
      log.warn('Could not load activity snapshot for streak log.', error.message);
      return [];
    });

  const activityByUser = new Map(activityDocs.map((entry) => [String(entry.userId), entry]));
  const members = (duo.members || []).map((member) => ({
    userId: String(member.userId),
    username: member.username || 'Unknown',
    displayName: member.displayName || member.username || 'Unknown',
    avatar: member.avatar || null,
  }));
  // A streak log only exists after the increment guard confirmed that BOTH
  // members completed the day, so the snapshot is authoritative here. The
  // timestamp is enriched from DailyActivity when available.
  const activity = members.map((member) => ({
    userId: member.userId,
    completed: true,
    completedAt: activityByUser.get(member.userId)?.firstMessageAt || null,
  }));

  let entry = null;
  try {
    entry = await StreakLog.create({
      guildId: String(duo.guildId),
      duoId: duo._id,
      dayKey,
      channelId: cfg.logChannelId,
      duoName: duo.name,
      members,
      activity,
      previousStreak: Number(previousStreak) || 0,
      currentStreak: Number(duo.currentStreak) || 0,
      bestStreak: Number(duo.bestStreak) || 0,
      xp: Number(duo.xp) || 0,
      totalDays: Number(duo.totalDays) || 0,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      entry = await StreakLog.findOne({ duoId: duo._id, dayKey }).lean().catch(() => null);
      if (entry && ['pending', 'failed'].includes(entry.status)) {
        enqueue(entry._id);
        drain().catch((drainError) => log.error('Log queue drain failed.', drainError));
      }
      return entry;
    }
    log.error('Could not persist streak log.', error);
    return null;
  }

  enqueue(entry._id);
  drain().catch((error) => log.error('Log queue drain failed.', error));
  return entry;
}

/**
 * Admin status view: channel, counters, last delivery and recent rows.
 */
async function getLogStatus(guildId) {
  const guildConfig = await configService.getGuildConfig(guildId, { fresh: true });
  let channel = null;

  if (guildConfig?.logChannelId && client) {
    channel = client.channels?.cache?.get(guildConfig.logChannelId)
      || await client.channels?.fetch(guildConfig.logChannelId).catch(() => null)
      || null;
  }

  const [sent, pending, failed, skipped, last, recent] = await Promise.all([
    StreakLog.countDocuments({ guildId: String(guildId), status: 'sent' }),
    StreakLog.countDocuments({ guildId: String(guildId), status: { $in: ['pending', 'sending'] } }),
    StreakLog.countDocuments({ guildId: String(guildId), status: 'failed' }),
    StreakLog.countDocuments({ guildId: String(guildId), status: 'skipped' }),
    StreakLog.findOne({ guildId: String(guildId), status: 'sent' }).sort({ sentAt: -1 }).lean(),
    StreakLog.find({ guildId: String(guildId) }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  return {
    guildConfig,
    channel,
    counts: { sent, pending, failed, skipped },
    last,
    recent,
    timezone: guildConfig?.timezone,
  };
}

/**
 * Startup entry point. `sending` rows from a previous process are recovered
 * immediately (the new process cannot have a send in flight yet), then the
 * retry queue is kicked after Discord is ready.
 */
async function start(discordClient) {
  init(discordClient);

  try {
    await StreakLog.updateMany(
      { status: 'sending' },
      {
        $set: {
          status: 'failed',
          lastError: 'Recovered after process restart.',
          nextAttemptAt: new Date(),
        },
      },
    );
  } catch (error) {
    log.warn('Could not recover in-flight log sends on startup.', error.message);
  }

  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = setTimeout(() => {
    startupTimer = null;
    if (!stopped) retryPending({ limit: 20 }).catch((error) => log.error('Startup log retry failed.', error));
  }, 5000);
  if (typeof startupTimer.unref === 'function') startupTimer.unref();

  log.info('666 DUO STREAK LOGS service ready.');
}

async function stop() {
  stopped = true;
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = null;
  await flush(5000);
}

module.exports = {
  start,
  stop,
  init,
  flush,
  retryPending,
  recordStreakIncrement,
  getLogStatus,
  processLog,
  MAX_ATTEMPTS,
  _internal: { drain, enqueue, processLog, markSkipped },
};
