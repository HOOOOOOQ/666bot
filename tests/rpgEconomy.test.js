'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createFakeModels, FakeModel } = require('./helpers/fakeDb');

function install() {
  const models = createFakeModels();
  const simple = ['EconomySettings', 'GameSettings', 'SettingsHistory', 'Quest', 'Achievement', 'GameHistory', 'GameSession', 'Battle', 'Monster', 'Pet', 'PetCollection', 'MonsterCollection', 'MarketListing', 'MarketTransaction', 'TradeSession', 'Guild', 'GuildMember', 'GuildWar', 'WorldBoss', 'WorldBossSession', 'WorldBossContribution'];
  for (const name of simple) models[name] = new FakeModel(name, { timestamps: true });
  models.RPGUser = new FakeModel('RPGUser', {
    timestamps: true,
    unique: [{ keys: (doc) => `${doc.guildId}:${doc.userId}` }],
    defaults: () => ({
      wallet: 0, bank: 0, totalEarned: 0, totalSpent: 0, level: 1, xp: 0,
      huntLevel: 1, huntXp: 0, huntKills: 0, shinyCount: 0, legendaryCount: 0, mythicalCount: 0, secretCount: 0,
      battleWins: 0, battleLosses: 0, battleRating: 1000, battleStreak: 0, gameWins: 0, gameLosses: 0,
      totalHunts: 0, totalBattles: 0, totalTrades: 0, totalMarketTrades: 0, totalBossDamage: 0,
      dailyStreak: 0, inventory: {},
    }),
  });
  models.EconomyTransaction = new FakeModel('EconomyTransaction', {
    timestamps: true,
    unique: [{ keys: (doc) => doc.idempotencyKey }],
    defaults: () => ({ status: 'completed', metadata: {} }),
  });
  models.GameCooldown = new FakeModel('GameCooldown', {
    timestamps: true,
    unique: [{ keys: (doc) => `${doc.guildId}:${doc.userId}:${doc.scope}` }],
  });
  const modelsPath = require.resolve('../src/database/models/index.js');
  require.cache[modelsPath] = {
    id: modelsPath, filename: modelsPath, loaded: true, exports: models, children: [], paths: [],
  };
  return models;
}

const models = install();
const userService = require('../src/rpg/services/userService');
const cooldownService = require('../src/rpg/services/cooldownService');
const settingsService = require('../src/rpg/services/settingsService');

test('daily reward can only be claimed once per day, even concurrently', async () => {
  const guildId = '900000000000000001';
  const userId = '911111111111111111';
  const results = await Promise.allSettled([
    userService.claimDaily(guildId, userId, { username: 'Tester' }),
    userService.claimDaily(guildId, userId, { username: 'Tester' }),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const user = await models.RPGUser.findOne({ guildId, userId });
  assert.equal(user.wallet, 500 + 250);
  assert.equal(user.dailyStreak, 1);
  const transactions = await models.EconomyTransaction.find({ guildId, userId, type: 'daily' });
  assert.equal(transactions.length, 1);
});

test('idempotency key prevents double coin credit across retries', async () => {
  const guildId = '900000000000000002';
  const userId = '922222222222222222';
  const key = 'test:reward:001';
  const first = await userService.addCoins(guildId, userId, 1000, 'test', key);
  const second = await userService.addCoins(guildId, userId, 1000, 'test', key);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  const user = await models.RPGUser.findOne({ guildId, userId });
  assert.equal(user.wallet, 500 + 1000);
});

test('spending more than the wallet never produces a negative balance', async () => {
  const guildId = '900000000000000003';
  const userId = '933333333333333333';
  await assert.rejects(() => userService.spendCoins(guildId, userId, 999999, 'test', 'test:spend:001'), /Saldo tidak cukup/);
  const user = await models.RPGUser.findOne({ guildId, userId });
  assert.equal(user.wallet, 500);
});

test('deposit and withdraw move coins atomically between wallet and bank', async () => {
  const guildId = '900000000000000004';
  const userId = '944444444444444444';
  const deposit = await userService.deposit(guildId, userId, 200, 'test:deposit:001');
  assert.equal(deposit.user.wallet, 300);
  assert.equal(deposit.user.bank, 200);
  const withdraw = await userService.withdraw(guildId, userId, 50, 'test:withdraw:001');
  assert.equal(withdraw.user.wallet, 350);
  assert.equal(withdraw.user.bank, 150);
  await assert.rejects(() => userService.withdraw(guildId, userId, 9999, 'test:withdraw:002'), /Saldo bank tidak cukup/);
});

test('distributed cooldown only allows one claim until it expires', async () => {
  const guildId = '900000000000000005';
  const userId = '955555555555555555';
  const first = await cooldownService.claim(guildId, userId, 'hunt', 60000);
  const second = await cooldownService.claim(guildId, userId, 'hunt', 60000);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.ok(second.remainingMs > 0);
});

test('drop rate update rejects a table that does not sum to 100 and accepts a valid one', async () => {
  const guildId = '900000000000000006';
  await assert.rejects(
    () => settingsService.updateDropRates(guildId, { monster: { common: 100 } }, 'test'),
    /belum diisi/,
  );
  const rates = {
    common: 40, uncommon: 25, rare: 15, epic: 10, legendary: 6, mythical: 3, secret: 1,
  };
  const updated = await settingsService.updateDropRates(guildId, { monster: rates }, 'test');
  assert.deepEqual(updated.monster, rates);
  const stored = await settingsService.getDropRates(guildId);
  assert.equal(stored.monster.common, 40);
});
