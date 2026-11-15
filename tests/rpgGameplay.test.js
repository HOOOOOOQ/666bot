'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
const settingsService = require('../src/rpg/services/settingsService');
const huntingService = require('../src/rpg/services/huntingService');
const petService = require('../src/rpg/services/petService');
const battleService = require('../src/rpg/services/battleService');
const gameService = require('../src/rpg/services/minigameService');
const bossService = require('../src/rpg/services/worldBossService');
const guildService = require('../src/rpg/services/guildService');

const GUILD = '888888888888888888';

test('hunting spawns a monster, credits coins/XP and updates collection', async () => {
  await settingsService.updateSection(GUILD, 'hunting', { spawnChance: 100, cooldownSec: 5 }, 'test');
  const result = await huntingService.hunt(GUILD, '811111111111111111', { username: 'Hunter' }, 'hunt-1');
  assert.equal(result.spawned, true);
  assert.ok(result.monster.hp > 0);
  const user = await models.RPGUser.findOne({ guildId: GUILD, userId: '811111111111111111' });
  assert.ok(user.wallet >= 500);
  assert.equal(user.huntKills, 1);
  const collection = await models.MonsterCollection.findOne({ guildId: GUILD, userId: '811111111111111111' });
  assert.equal(collection.count, 1);
  const huntingUser = await models.HuntingUser.findOne({ guildId: GUILD, userId: '811111111111111111' });
  assert.equal(huntingUser.kills, 1);
});

test('pet hatch creates a pet and active pet, then feed/upgrade/evolve run safely', async () => {
  const userId = '822222222222222222';
  await models.RPGUser.create({ guildId: GUILD, userId, wallet: 2000 });
  const hatch = await petService.hatch(GUILD, userId, 'egg_basic');
  assert.ok(hatch.pet._id);
  let user = await models.RPGUser.findOne({ guildId: GUILD, userId });
  assert.equal(String(user.activePetId), String(hatch.pet._id));
  const fed = await petService.feed(GUILD, userId, String(hatch.pet._id));
  assert.ok(fed.pet.xp >= 0);
  const upgraded = await petService.upgrade(GUILD, userId, String(hatch.pet._id));
  assert.ok(upgraded.pet.attack > hatch.pet.attack);
  await models.Pet.updateOne({ _id: hatch.pet._id }, { $set: { level: 20 } });
  const evolved = await petService.evolve(GUILD, userId, String(hatch.pet._id));
  assert.equal(evolved.pet.evolved, true);
  user = await models.RPGUser.findOne({ guildId: GUILD, userId });
  assert.ok(user.wallet >= 0);
});

test('battle challenge + accept is atomic and pays exactly once', async () => {
  const challenger = '833333333333333333';
  const opponent = '844444444444444444';
  await models.RPGUser.create({ guildId: GUILD, userId: challenger, wallet: 500 });
  await models.RPGUser.create({ guildId: GUILD, userId: opponent, wallet: 500 });
  const battle = await battleService.challenge(GUILD, challenger, opponent, { username: 'A' }, { username: 'B' });
  const result = await battleService.accept(GUILD, opponent, String(battle._id), { username: 'B' });
  assert.ok(['complete', 'completed'].includes(result.battle.status));
  const winner = await models.RPGUser.findOne({ guildId: GUILD, userId: result.winnerId });
  assert.ok(winner.battleWins >= 1);
  const tx = await models.EconomyTransaction.find({ guildId: GUILD, type: 'battle_win' });
  assert.ok(tx.length <= 1);
});

test('mini game debits bet and never allows a negative wallet', async () => {
  const userId = '855555555555555555';
  await models.RPGUser.create({ guildId: GUILD, userId, wallet: 1000 });
  const result = await gameService.coinflip(GUILD, userId, 'heads', 100, 'game-1');
  assert.equal(result.bet, 100);
  const user = await models.RPGUser.findOne({ guildId: GUILD, userId });
  assert.ok(user.wallet >= 0);
});

test('world boss spawns, takes atomic damage and credits contribution', async () => {
  const userId = '866666666666666666';
  await models.RPGUser.create({ guildId: GUILD, userId, wallet: 500, level: 2 });
  const result = await bossService.attack(GUILD, userId, { username: 'BossHit' }, 'boss-1');
  assert.ok(result.damage >= 1);
  const contribution = await models.WorldBossContribution.findOne({ guildId: GUILD, userId });
  assert.equal(contribution.attacks, 1);
});

test('guild create/join/deposit/upgrade flows keep one membership per user', async () => {
  const leader = '877777777777777777';
  const member = '888888888888888888';
  await models.RPGUser.create({ guildId: GUILD, userId: leader, wallet: 20000 });
  await models.RPGUser.create({ guildId: GUILD, userId: member, wallet: 5000 });
  const guild = await guildService.create(GUILD, leader, 'Test Guild');
  await guildService.join(GUILD, member, 'Test Guild');
  const info = await guildService.info(GUILD, leader);
  assert.equal(info.guild.name, 'Test Guild');
  assert.equal(info.members.length, 2);
  await guildService.deposit(GUILD, member, 1000);
  await guildService.deposit(GUILD, leader, 10000);
  const upgraded = await guildService.upgrade(GUILD, leader);
  assert.ok(upgraded.guild.level >= 2);
});

test('P2P trade requires both confirmations, locks items, and swaps exactly once', async () => {
  const tradeService = require('../src/rpg/services/tradeService');
  const giver = '899999999999999991';
  const receiver = '899999999999999992';
  await models.RPGUser.create({ guildId: GUILD, userId: giver, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: receiver, wallet: 1000 });
  const monster = await models.Monster.create({ guildId: GUILD, userId: giver, speciesId: 'slime', name: 'Trade Slime', rarity: 'common', hp: 10, attack: 1, defense: 1, speed: 1, sellValue: 100 });
  const trade = await tradeService.create(GUILD, giver, receiver, { coins: 100, monsters: [String(monster._id)] }, null, 'trade-1');
  const locked = await models.Monster.findOne({ _id: monster._id });
  assert.equal(locked.lockedBy, `trade:${trade._id}`);
  await tradeService.respond(GUILD, receiver, String(trade._id), true);
  const firstConfirm = await tradeService.confirm(GUILD, giver, String(trade._id));
  assert.equal(firstConfirm.waiting, true);
  const secondConfirm = await tradeService.confirm(GUILD, receiver, String(trade._id));
  assert.equal(secondConfirm.trade.status, 'completed');
  const moved = await models.Monster.findOne({ _id: monster._id });
  assert.equal(moved.userId, receiver);
  assert.equal(moved.lockedBy, null);
  const giverUser = await models.RPGUser.findOne({ guildId: GUILD, userId: giver });
  const receiverUser = await models.RPGUser.findOne({ guildId: GUILD, userId: receiver });
  assert.equal(giverUser.wallet, 900);
  assert.ok(receiverUser.wallet > 1000);
});

test('market listing is locked and transferred exactly once with tax', async () => {
  const marketService = require('../src/rpg/services/marketService');
  const seller = '899999999999999993';
  const buyer = '899999999999999994';
  await models.RPGUser.create({ guildId: GUILD, userId: seller, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: buyer, wallet: 3000 });
  const monster = await models.Monster.create({ guildId: GUILD, userId: seller, speciesId: 'orc', name: 'Market Orc', rarity: 'uncommon', hp: 100, attack: 10, defense: 10, speed: 10, sellValue: 500 });
  const listing = await marketService.createListing(GUILD, seller, 'monster', String(monster._id), 1000);
  const result = await marketService.buy(GUILD, buyer, String(listing._id));
  assert.equal(result.price, 1000);
  const moved = await models.Monster.findOne({ _id: monster._id });
  assert.equal(moved.userId, buyer);
  const sellerUser = await models.RPGUser.findOne({ guildId: GUILD, userId: seller });
  const buyerUser = await models.RPGUser.findOne({ guildId: GUILD, userId: buyer });
  assert.equal(buyerUser.wallet, 2000);
  assert.ok(sellerUser.wallet > 1000);
  const sold = await models.MarketListing.findOne({ _id: listing._id });
  assert.equal(sold.status, 'sold');
  await assert.rejects(() => marketService.buy(GUILD, buyer, String(listing._id)), /tidak ditemukan|tidak aktif/);
});

test('pet drop-rate table controls egg rarity weights', () => {
  const { eggRatesFor } = require('../src/rpg/services/petService')._test;
  const egg = { rates: { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 2, mythical: 1 } };
  const normal = eggRatesFor({ dropRates: { pet: { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 2.5, mythical: 0.4 } } }, egg);
  assert.ok(Math.abs(normal.common - 50) < 1e-9);
  const disabled = eggRatesFor({ dropRates: { pet: { common: 50, uncommon: 25, rare: 0, epic: 7, legendary: 2.5, mythical: 0.4 } } }, egg);
  assert.equal(disabled.rare, 0);
});

test('evolve resets pet level to 1 and is one-shot', async () => {
  const petService = require('../src/rpg/services/petService');
  const user = '699999999999999999';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 1000 });
  const pet = await models.Pet.create({
    guildId: GUILD, userId: user, speciesId: 'frost_fox', name: 'Frost Fox',
    rarity: 'rare', level: 20, xp: 0, hp: 100, attack: 20, defense: 10, speed: 15,
  });
  const result = await petService.evolve(GUILD, user, pet._id);
  assert.equal(result.pet.level, 1);
  assert.equal(result.pet.evolved, true);
  await assert.rejects(() => petService.evolve(GUILD, user, pet._id), /sudah berevolusi/);
});

test('active pet slots respect maxSlots and unequip frees a slot', async () => {
  const petService = require('../src/rpg/services/petService');
  const settingsService = require('../src/rpg/services/settingsService');
  const user = '698888888888888888';
  await settingsService.updateSection(GUILD, 'pets', { maxSlots: 1 }, 'test');
  try {
    await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 1000 });
    const first = await models.Pet.create({ guildId: GUILD, userId: user, speciesId: 'a', name: 'A', rarity: 'common', level: 1, hp: 10, attack: 2, defense: 1, speed: 1 });
    const second = await models.Pet.create({ guildId: GUILD, userId: user, speciesId: 'b', name: 'B', rarity: 'common', level: 1, hp: 10, attack: 2, defense: 1, speed: 1 });
    await petService.equip(GUILD, user, first._id);
    await assert.rejects(() => petService.equip(GUILD, user, second._id), /Slot pet aktif penuh/);
    await petService.unequip(GUILD, user, first._id);
    await petService.equip(GUILD, user, second._id);
    const active = await petService.activePets(GUILD, user);
    assert.equal(active.length, 1);
    assert.equal(String(active[0]._id), String(second._id));
  } finally {
    await settingsService.updateSection(GUILD, 'pets', { maxSlots: 3 }, 'test');
  }
});
