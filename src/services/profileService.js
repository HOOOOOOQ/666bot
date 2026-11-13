'use strict';

const { getGuildConfig } = require('./configService');
const duoService = require('./duoService');
const activityService = require('./activityService');
const rewardService = require('./rewardService');
const { resolveDuoMembers } = require('../utils/members');

/**
 * Builds everything the `/duo profile` and `/duo streak` cards need.
 * Returns `{ duo: null }` when the user has no active Duo.
 */
async function getDuoOverview({ guild, userId }) {
  const guildConfig = await getGuildConfig(guild.id);
  const duo = await duoService.getActiveDuoForUser(guild.id, userId);
  if (!duo) return { duo: null, guildConfig };

  const [members, todayRaw, rewardSummary] = await Promise.all([
    resolveDuoMembers(guild, duo),
    activityService.getTodayStatus(duo, guildConfig.timezone),
    rewardService.getRewardSummary(duo),
  ]);

  // Use live Discord profiles inside the status list as well.
  const today = {
    ...todayRaw,
    members: todayRaw.members.map((entry, index) => ({
      ...entry,
      member: members[index] || entry.member,
    })),
  };

  return {
    duo,
    guildConfig,
    timezone: guildConfig.timezone,
    members,
    today,
    rewardSummary,
    nextMilestone: rewardService.getNextMilestone(duo.currentStreak),
    highestReward: rewardService.getHighestReward(duo.currentStreak),
  };
}

module.exports = { getDuoOverview };
