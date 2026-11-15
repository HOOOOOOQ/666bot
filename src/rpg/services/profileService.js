'use strict';

const models = require('../../database/models');
const userService = require('./userService');
const { rankForLevel, xpForLevel, formatCoins } = require('../utils/formulas');
const { ACHIEVEMENTS } = require('../data/catalog');

async function profile(guildId, userId, profile = {}) {
  const user = await userService.ensureUser(guildId, userId, profile);
  const [monsterCount, petCount, uniqueMonsters, uniquePets, achievements, guildMember, bossContribution] = await Promise.all([
    models.Monster.countDocuments({ guildId, userId }),
    models.Pet.countDocuments({ guildId, userId }),
    models.MonsterCollection.countDocuments({ guildId, userId }),
    models.PetCollection.countDocuments({ guildId, userId }),
    models.Achievement.countDocuments({ guildId, userId }),
    models.GuildMember.findOne({ discordGuildId: guildId, userId }).lean(),
    models.WorldBossContribution.findOne({ guildId, userId }).sort({ damage: -1 }).lean(),
  ]);
  let guild = null;
  if (guildMember) guild = await models.Guild.findOne({ _id: guildMember.guildRef }).lean();
  const questService = require('./questService');
  const questList = await questService.list(guildId, userId).catch(() => []);
  const rank = rankForLevel(user.level || 1);
  const nextXp = xpForLevel(user.level || 1);
  return {
    user,
    rank,
    level: user.level || 1,
    xp: user.xp || 0,
    nextXp,
    xpPct: Math.min(100, Math.round(((user.xp || 0) / nextXp) * 100)),
    wealth: (user.wallet || 0) + (user.bank || 0),
    wallet: user.wallet || 0,
    bank: user.bank || 0,
    monsterCount,
    petCount,
    uniqueMonsters,
    uniquePets,
    achievements,
    achievementTotal: ACHIEVEMENTS.length,
    guild,
    guildMember,
    bossContribution: bossContribution?.damage || 0,
    battle: {
      wins: user.battleWins || 0,
      losses: user.battleLosses || 0,
      rating: user.battleRating || 1000,
      winRate: user.battleWins + user.battleLosses > 0 ? Math.round((user.battleWins / (user.battleWins + user.battleLosses)) * 100) : 0,
    },
    hunt: {
      kills: user.huntKills || 0,
      level: user.huntLevel || 1,
      shiny: user.shinyCount || 0,
      legendary: user.legendaryCount || 0,
      mythical: user.mythicalCount || 0,
      secret: user.secretCount || 0,
    },
    trading: {
      trades: user.totalTrades || 0,
      market: user.totalMarketTrades || 0,
    },
    games: { wins: user.gameWins || 0, losses: user.gameLosses || 0 },
    quests: {
      total: questList.length,
      completed: questList.filter((quest) => quest.completed).length,
      claimed: questList.filter((quest) => quest.claimed).length,
    },
    labels: {
      wallet: formatCoins(user.wallet || 0),
      bank: formatCoins(user.bank || 0),
      wealth: formatCoins((user.wallet || 0) + (user.bank || 0)),
    },
  };
}

module.exports = { profile };
