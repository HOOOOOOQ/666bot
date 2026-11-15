'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const { QUESTS, QUEST_MAP, ACHIEVEMENTS } = require('../data/catalog');
const { dayKey, weekKey } = require('../utils/periods');
const { addCoins, addXp, ensureUser } = require('./userService');
const { rankForLevel, xpForLevel, formatCoins } = require('../utils/formulas');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-quest');

function periodFor(quest, now = new Date()) {
  if (quest.type === 'daily') return dayKey(now);
  if (quest.type === 'weekly') return weekKey(now);
  return 'all';
}

/**
 * Progress is stored per (user, quest, period) with an atomic upsert. Progress
 * is clamped when displayed, and claims use a conditional atomic update so two
 * bot instances cannot grant the same quest reward twice.
 */
async function track(guildId, userId, event, amount = 1, user = null) {
  const relevant = QUESTS.filter((quest) => quest.event === event);
  if (relevant.length === 0) return [];
  const now = new Date();
  const results = [];
  for (const quest of relevant) {
    const periodKey = periodFor(quest, now);
    try {
      const doc = await models.Quest.findOneAndUpdate(
        { guildId, userId, questId: quest.id, periodKey },
        {
          $inc: { progress: Math.max(1, Math.floor(amount)) },
          $setOnInsert: { type: quest.type, target: quest.target, claimed: false },
        },
        { upsert: true, new: true },
      );
      if (doc && doc.progress >= doc.target && !doc.completedAt) {
        await models.Quest.updateOne({ _id: doc._id, completedAt: null }, { $set: { completedAt: new Date() } });
      }
      results.push(doc);
    } catch (error) {
      if (error.code !== 11000) log.warn(`Quest track failed (${quest.id}): ${error.message}`);
    }
  }
  if (event === 'hunt' || event === 'battleWin' || event === 'gameWin' || event === 'bossAttack') {
    if (user) await checkAchievements(guildId, userId, user);
  }
  return results;
}

async function list(guildId, userId) {
  const now = new Date();
  const docs = await models.Quest.find({ guildId, userId }).lean();
  return QUESTS.map((quest) => {
    const periodKey = periodFor(quest, now);
    const doc = docs.find((d) => d.questId === quest.id && d.periodKey === periodKey);
    return {
      ...quest,
      periodKey,
      progress: Math.min(doc?.progress || 0, quest.target),
      rawProgress: doc?.progress || 0,
      claimed: Boolean(doc?.claimed),
      completed: Boolean(doc && doc.progress >= quest.target),
    };
  });
}

async function claim(guildId, userId, questId) {
  const quest = QUEST_MAP[questId] || QUESTS.find((q) => q.id === questId || q.title.toLowerCase() === String(questId || '').toLowerCase());
  if (!quest) throw new UserError('Quest tidak ditemukan.');
  const periodKey = periodFor(quest);
  const doc = await models.Quest.findOne({ guildId, userId, questId: quest.id, periodKey });
  if (!doc) throw new UserError('Progress quest belum ada. Selesaikan dulu misinya!');
  if (doc.claimed) throw new UserError('Reward quest ini sudah diklaim.');
  if (doc.progress < doc.target) throw new UserError(`Quest belum selesai (${doc.progress}/${doc.target}).`);

  const claimed = await models.Quest.findOneAndUpdate(
    { guildId, userId, questId: quest.id, periodKey, claimed: false, progress: { $gte: doc.target } },
    { $set: { claimed: true, claimedAt: new Date() } },
    { new: true },
  );
  if (!claimed) throw new UserError('Quest sudah diklaim atau belum selesai.');

  try {
    await addCoins(guildId, userId, quest.coins, `quest_${quest.type}`, `quest:${guildId}:${userId}:${quest.id}:${periodKey}`, { questId: quest.id });
    await addXp(guildId, userId, quest.xp, 'xp');
    return { quest, coins: quest.coins, xp: quest.xp };
  } catch (error) {
    await models.Quest.updateOne({ _id: claimed._id }, { $set: { claimed: false, claimedAt: null } }).catch(() => {});
    throw error;
  }
}

async function checkAchievements(guildId, userId, user = null) {
  const current = user || (await ensureUser(guildId, userId));
  let petCount = 0;
  try {
    petCount = await models.Pet.countDocuments({ guildId, userId });
  } catch { /* ignore */ }
  const metrics = {
    battleWins: current.battleWins || 0,
    huntKills: current.huntKills || 0,
    shinyCount: current.shinyCount || 0,
    legendaryCount: current.legendaryCount || 0,
    mythicalCount: current.mythicalCount || 0,
    secretCount: current.secretCount || 0,
    totalWealth: (current.wallet || 0) + (current.bank || 0),
    petCount,
    totalBossDamage: current.totalBossDamage || 0,
    gameWins: current.gameWins || 0,
    totalMarketTrades: current.totalMarketTrades || 0,
    level: current.level || 1,
  };
  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if ((metrics[achievement.metric] || 0) < achievement.threshold) continue;
    try {
      await models.Achievement.create({ guildId, userId, achievementId: achievement.id });
      await addCoins(guildId, userId, achievement.coins, 'achievement', `achievement:${guildId}:${userId}:${achievement.id}`, { achievementId: achievement.id }).catch(() => {});
      if (achievement.xp > 0) await addXp(guildId, userId, achievement.xp, 'xp').catch(() => {});
      unlocked.push(achievement);
    } catch (error) {
      if (error.code !== 11000) log.warn(`Achievement check failed (${achievement.id}): ${error.message}`);
    }
  }
  return unlocked;
}

async function achievements(guildId, userId) {
  const docs = await models.Achievement.find({ guildId, userId }).lean();
  const set = new Set((docs || []).map((doc) => doc.achievementId));
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: set.has(a.id) }));
}

async function rank(guildId, userId) {
  const user = await ensureUser(guildId, userId);
  const rankData = rankForLevel(user.level || 1);
  const position = (await models.RPGUser.countDocuments({ guildId, level: { $gt: user.level || 1 } })) + 1;
  return {
    user,
    rank: rankData,
    position,
    nextLevelXp: xpForLevel(user.level || 1),
    xpNeeded: Math.max(0, xpForLevel(user.level || 1) - (user.xp || 0)),
    progressLabel: `${formatCoins(user.xp || 0)} / ${formatCoins(xpForLevel(user.level || 1))} XP`,
  };
}

module.exports = { track, list, claim, checkAchievements, achievements, rank, periodFor };
