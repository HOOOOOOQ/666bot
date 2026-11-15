'use strict';

const { createFakeModels, FakeModel } = require('./fakeDb');

function defaultUser() {
  return {
    wallet: 0, bank: 0, totalEarned: 0, totalSpent: 0, level: 1, xp: 0,
    huntLevel: 1, huntXp: 0, huntKills: 0, shinyCount: 0, legendaryCount: 0, mythicalCount: 0, secretCount: 0,
    battleWins: 0, battleLosses: 0, battleRating: 1000, battleStreak: 0, gameWins: 0, gameLosses: 0,
    totalHunts: 0, totalBattles: 0, totalTrades: 0, totalMarketTrades: 0, totalBossDamage: 0,
    dailyStreak: 0, inventory: {}, activePetId: null, activePetIds: [], rpgGuildId: null,
  };
}

function installFakeRPGModels() {
  const models = createFakeModels();
  const simple = ['EconomySettings', 'GameSettings', 'SettingsHistory', 'Quest', 'Achievement', 'GameHistory', 'GameSession', 'Battle', 'MarketListing', 'MarketTransaction', 'TradeSession', 'GuildMember', 'GuildWar', 'WorldBoss', 'WorldBossSession'];
  for (const name of simple) models[name] = new FakeModel(name, { timestamps: true });
  models.Guild = new FakeModel('Guild', { timestamps: true, defaults: () => ({ level: 1, xp: 0, bank: 0, memberCount: 1, maxMembers: 50, wins: 0, losses: 0, warPoints: 0 }) });
  models.WorldBossContribution = new FakeModel('WorldBossContribution', { timestamps: true, defaults: () => ({ damage: 0, attacks: 0, rewarded: false }) });
  models.RPGUser = new FakeModel('RPGUser', {
    timestamps: true,
    unique: [{ keys: (doc) => [`user:${doc.guildId}:${doc.userId}`] }],
    defaults: defaultUser,
  });
  models.HuntingUser = new FakeModel('HuntingUser', {
    timestamps: true,
    unique: [{ keys: (doc) => [`hunt:${doc.guildId}:${doc.userId}`] }],
    defaults: () => ({ huntLevel: 1, huntXp: 0, kills: 0, shiny: 0, legendary: 0, mythical: 0, secret: 0 }),
  });
  models.Monster = new FakeModel('Monster', {
    timestamps: true,
    defaults: () => ({ shiny: false, level: 1, lockedBy: null }),
  });
  models.MonsterCollection = new FakeModel('MonsterCollection', {
    timestamps: true,
    unique: [{ keys: (doc) => [`monster:${doc.guildId}:${doc.userId}:${doc.speciesId}`] }],
    defaults: () => ({ count: 0, shinyCount: 0 }),
  });
  models.Pet = new FakeModel('Pet', {
    timestamps: true,
    defaults: () => ({ level: 1, xp: 0, evolved: false, lockedBy: null }),
  });
  models.PetCollection = new FakeModel('PetCollection', {
    timestamps: true,
    unique: [{ keys: (doc) => [`pet:${doc.guildId}:${doc.userId}:${doc.speciesId}`] }],
    defaults: () => ({ count: 0 }),
  });
  models.EconomyTransaction = new FakeModel('EconomyTransaction', {
    timestamps: true,
    unique: [{ keys: (doc) => [`tx:${doc.idempotencyKey}`] }],
    defaults: () => ({ status: 'completed', metadata: {} }),
  });
  models.GameCooldown = new FakeModel('GameCooldown', {
    timestamps: true,
    unique: [{ keys: (doc) => [`cd:${doc.guildId}:${doc.userId}:${doc.scope}`] }],
  });
  const modelsPath = require.resolve('../../src/database/models/index.js');
  require.cache[modelsPath] = {
    id: modelsPath, filename: modelsPath, loaded: true, exports: models, children: [], paths: [],
  };
  return models;
}

module.exports = { installFakeRPGModels, defaultUser };
