'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const commands = require('../src/rpg/commands');
const defaults = require('../src/rpg/config/defaults');
const formulas = require('../src/rpg/utils/formulas');
const rng = require('../src/rpg/utils/rng');
const { simulateBattle } = require('../src/rpg/services/battleService');
const { handValue } = require('../src/rpg/services/minigameService');
const { parse } = require('../src/rpg/handler');

test('all required 6-prefix commands are registered', () => {
  const required = [
    '6cash', '6hunt', '6battle', '6pet', '6quest', '6trade', '6market', '6guild', '6boss',
    '6coinflip', '6dice', '6slots', '6blackjack', '6roulette', '6guess', '6trivia', '6rps',
    '6achievement', '6rank',
  ];
  for (const name of required) assert.ok(commands.get(name), `${name} harus terdaftar`);
});

test('prefix parser only reacts to registered 6 commands', () => {
  assert.equal(parse('6cash daily').token, '6cash');
  assert.equal(parse('6CASH daily').token, '6cash');
  assert.equal(parse('!cash daily'), null);
  assert.equal(parse('6unknown'), null);
  assert.deepEqual(parse('6cash balance now').args, ['balance', 'now']);
});

test('drop-rate tables are valid and can be validated / rejected', () => {
  assert.equal(defaults.validateDropRates(defaults.DEFAULT_DROP_RATES.monster), true);
  assert.equal(defaults.validateDropRates(defaults.DEFAULT_DROP_RATES.pet), true);
  const bad = { ...defaults.DEFAULT_DROP_RATES.monster, common: 80 };
  assert.throws(() => defaults.validateDropRates(bad), /Total drop rate/);
  assert.throws(() => defaults.validateDropRates({ common: 100 }), /belum diisi/);
  const normalized = defaults.normalizeDropRates({ common: 100 }, ['common', 'rare']);
  assert.deepEqual(normalized, { common: 100, rare: 0 });
});

test('settings coercion clamps values and rejects impossible ranges', () => {
  const out = defaults.coerceSection('economy', { dailyReward: -50, workMin: 500, workMax: 600 }, { economy: defaults.DEFAULT_ECONOMY });
  assert.equal(out.dailyReward, 0);
  assert.equal(out.workMin, 500);
  assert.throws(() => defaults.coerceSection('economy', { workMin: 500, workMax: 100 }, { economy: defaults.DEFAULT_ECONOMY }), /workMax/);
  assert.throws(() => defaults.coerceSection('minigames', { minBet: 100, maxBet: 10 }, { minigames: defaults.DEFAULT_GAME.minigames }), /maxBet/);
});

test('XP, ranks and taxes follow the published formulas', () => {
  assert.equal(formulas.xpForLevel(1), 100);
  const level = formulas.applyXp(1, 90, 20);
  assert.equal(level.level, 2);
  assert.equal(level.xp, 10);
  assert.equal(formulas.rankForLevel(1).name, 'Rookie');
  assert.equal(formulas.rankForLevel(50).name, 'Demon Lord');
  assert.deepEqual(formulas.applyTax(1000, 5), { tax: 50, net: 950 });
  assert.equal(formulas.formatCoins(1234567), '1.234.567');
});

test('crypto RNG stays in range and weighted picks respect zero weights', () => {
  for (let i = 0; i < 200; i += 1) {
    const value = rng.randomInt(1, 6);
    assert.ok(value >= 1 && value <= 6);
  }
  const picked = rng.weightedPick([{ value: 'a', weight: 0 }, { value: 'b', weight: 10 }]);
  assert.equal(picked, 'b');
});

test('battle simulator produces a deterministic shape and a winner', () => {
  const a = { userId: 'a', username: 'A', level: 5, rating: 1000, stats: { hp: 300, attack: 50, defense: 20, speed: 30 }, pet: { name: 'X', skill: 'inferno' } };
  const b = { userId: 'b', username: 'B', level: 5, rating: 1000, stats: { hp: 300, attack: 45, defense: 25, speed: 25 }, pet: null };
  const result = simulateBattle(a, b, { critChance: 15 });
  assert.ok(result.winnerId === 'a' || result.winnerId === 'b');
  assert.equal(result.loserId === 'a' ? 'b' : 'a', result.winnerId);
  assert.ok(result.log.length > 0);
  assert.ok(result.rounds > 0);
});

test('blackjack hand values handle soft aces', () => {
  assert.equal(handValue([{ rank: 'A' }, { rank: 'K' }]), 21);
  assert.equal(handValue([{ rank: 'A' }, { rank: 'A' }, { rank: '9' }]), 21);
  assert.equal(handValue([{ rank: 'K' }, { rank: 'Q' }, { rank: '2' }]), 22);
});
