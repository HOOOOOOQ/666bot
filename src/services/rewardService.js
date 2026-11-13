'use strict';

const { DuoReward, StreakHistory } = require('../database/models');
const { createLogger } = require('../utils/logger');
const { isDuplicateKeyError } = require('../utils/errors');
const { getDayKey } = require('../utils/time');
const { getGuildConfig } = require('./configService');
const notificationService = require('./notificationService');

const log = createLogger('rewards');

/**
 * Milestone ladder. Badges are granted automatically the moment a Duo reaches
 * the required streak — the unique index prevents double rewards.
 */
const REWARDS = Object.freeze([
  {
    days: 7,
    key: 'rookie',
    name: 'Rookie Duo Badge',
    emoji: '🥉',
    description: 'Tujuh hari bersama. Awal dari sebuah koneksi.',
  },
  {
    days: 14,
    key: 'connected',
    name: 'Connected Duo Badge',
    emoji: '🔗',
    description: 'Dua minggu konsisten. Koneksi kalian mulai terbentuk.',
  },
  {
    days: 30,
    key: 'elite',
    name: 'Elite Duo Badge',
    emoji: '⚔️',
    description: 'Tiga puluh hari tanpa putus. Elite.',
  },
  {
    days: 50,
    key: 'flame',
    name: 'Flame Duo Badge',
    emoji: '🔥',
    description: 'Lima puluh hari membara bersama.',
  },
  {
    days: 100,
    key: 'legendary',
    name: 'Legendary Duo Badge',
    emoji: '👑',
    description: 'Seratus hari. Kalian adalah legenda server ini.',
  },
  {
    days: 365,
    key: 'eternal',
    name: 'Eternal Duo Badge',
    emoji: '♾️',
    description: 'Satu tahun penuh. Eternal connection.',
  },
]);

function getRewardDefinitions() {
  return REWARDS.map((reward) => ({ ...reward }));
}

function getRewardByKey(key) {
  return REWARDS.find((reward) => reward.key === key) || null;
}

/** Next locked milestone for a streak, or null when everything is unlocked. */
function getNextMilestone(currentStreak) {
  const streak = Number(currentStreak) || 0;
  const next = REWARDS.find((reward) => reward.days > streak);
  return next ? { ...next } : null;
}

function getHighestReward(currentStreak) {
  const streak = Number(currentStreak) || 0;
  const unlocked = REWARDS.filter((reward) => reward.days <= streak);
  return unlocked.length ? { ...unlocked[unlocked.length - 1] } : null;
}

async function getGrantedRewards(duoId) {
  return DuoReward.find({ duoId }).sort({ milestone: 1 }).lean();
}

/**
 * Combines static definitions with the Duo's granted documents.
 */
async function getRewardSummary(duo) {
  const granted = await getGrantedRewards(duo._id);
  const grantedByMilestone = new Map(granted.map((reward) => [Number(reward.milestone), reward]));

  const list = REWARDS.map((definition) => {
    const record = grantedByMilestone.get(definition.days);
    return {
      ...definition,
      unlocked: Boolean(record),
      grantedAt: record?.grantedAt || null,
    };
  });

  const unlockedList = list.filter((reward) => reward.unlocked);
  return {
    list,
    granted,
    unlocked: unlockedList.length,
    total: REWARDS.length,
    highest: unlockedList.length ? unlockedList[unlockedList.length - 1] : null,
  };
}

/**
 * Grants every milestone the Duo has earned but not yet received.
 * @returns {Promise<Array>} newly granted reward definitions
 */
async function checkAndGrant({ duo, guildConfig = null }) {
  if (!duo) return [];

  const eligible = REWARDS.filter((reward) => reward.days <= (Number(duo.currentStreak) || 0));
  if (!eligible.length) return [];

  const granted = [];
  const configForGuild = guildConfig || await getGuildConfig(duo.guildId).catch(() => null);
  const dayKey = getDayKey(new Date(), configForGuild?.timezone);

  for (const reward of eligible) {
    try {
      await DuoReward.create({
        guildId: duo.guildId,
        duoId: duo._id,
        milestone: reward.days,
        key: reward.key,
        name: reward.name,
        description: reward.description,
        members: (duo.members || []).map((member) => member.userId),
        grantedAt: new Date(),
      });
      granted.push(reward);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        log.error(`Failed to grant reward ${reward.key} for duo ${duo._id}.`, error);
      }
      continue;
    }

    await StreakHistory.create({
      guildId: duo.guildId,
      duoId: duo._id,
      dayKey,
      type: 'reward',
      streak: Number(duo.currentStreak) || 0,
      note: `Unlocked ${reward.name}`,
      metadata: { milestone: reward.days, key: reward.key },
    }).catch((error) => {
      if (!isDuplicateKeyError(error)) log.warn('Failed to record reward history.', error.message);
    });
  }

  if (granted.length) {
    log.info(`Duo ${duo._id} unlocked: ${granted.map((reward) => reward.name).join(', ')}`);
    for (const reward of granted) {
      notificationService.notifyReward({ duo: { ...duo, currentStreak: duo.currentStreak }, reward, guildConfig: configForGuild });
    }
  }

  return granted;
}

module.exports = {
  REWARDS,
  getRewardDefinitions,
  getRewardByKey,
  getNextMilestone,
  getHighestReward,
  getGrantedRewards,
  getRewardSummary,
  checkAndGrant,
};
