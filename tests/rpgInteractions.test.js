'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
const battleService = require('../src/rpg/services/battleService');
const tradeService = require('../src/rpg/services/tradeService');
const gameService = require('../src/rpg/services/minigameService');
const { handleRPGInteraction } = require('../src/rpg/interactions');
const GUILD = '666666666666666666';

function interaction(customId, userId) {
  const state = { deferred: false, updates: [] };
  return {
    state,
    customId,
    guildId: GUILD,
    user: { id: userId, username: `U${userId.slice(-3)}`, displayAvatarURL: () => null },
    deferUpdate: async () => { state.deferred = true; },
    editReply: async (payload) => { state.updates.push(payload); },
  };
}

test('battle accept button is routed to the RPG handler and resolves once', async () => {
  const challenger = '611111111111111111';
  const opponent = '622222222222222222';
  await models.RPGUser.create({ guildId: GUILD, userId: challenger, wallet: 500 });
  await models.RPGUser.create({ guildId: GUILD, userId: opponent, wallet: 500 });
  const battle = await battleService.challenge(GUILD, challenger, opponent, { username: 'A' }, { username: 'B' });
  const btn = interaction(`rpg:battle:accept:${battle._id}`, opponent);
  assert.equal(await handleRPGInteraction(btn), true);
  assert.equal(btn.state.deferred, true);
  assert.equal(btn.state.updates.length, 1);
  assert.ok(btn.state.updates[0].embeds.length);
  const stored = await models.Battle.findOne({ _id: battle._id });
  assert.equal(stored.status, 'completed');
});

test('trade confirm buttons require both parties and then execute', async () => {
  const a = '633333333333333333';
  const b = '644444444444444444';
  await models.RPGUser.create({ guildId: GUILD, userId: a, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: b, wallet: 1000 });
  const trade = await tradeService.create(GUILD, a, b, { coins: 50 }, null, 'itrade');
  const accept = interaction(`rpg:trade:accept:${trade._id}`, b);
  await handleRPGInteraction(accept);
  const confirmA = interaction(`rpg:trade:confirm:${trade._id}`, a);
  await handleRPGInteraction(confirmA);
  assert.match(confirmA.state.updates[0].embeds[0].data.description, /Menunggu/);
  const confirmB = interaction(`rpg:trade:confirm:${trade._id}`, b);
  await handleRPGInteraction(confirmB);
  assert.match(confirmB.state.updates[0].embeds[0].data.description, /selesai/i);
  const stored = await models.TradeSession.findOne({ _id: trade._id });
  assert.equal(stored.status, 'completed');
});

test('blackjack hit button updates the active session', async () => {
  const user = '655555555555555555';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 1000 });
  const game = await gameService.createBlackjack(GUILD, user, 100, null, 'bj-btn');
  const btn = interaction(`rpg:bj:hit:${game.session._id}`, user);
  await handleRPGInteraction(btn);
  assert.equal(btn.state.updates.length, 1);
  assert.ok(btn.state.updates[0].embeds.length);
});

test('trivia answer button settles the session', async () => {
  const user = '666666666666666661';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 1000 });
  const trivia = await gameService.createTrivia(GUILD, user, 100, null, 'trivia-btn');
  const answer = trivia.session.state.answer;
  const btn = interaction(`rpg:trivia:${trivia.session._id}:${answer}`, user);
  await handleRPGInteraction(btn);
  assert.equal(btn.state.updates.length, 1);
  const stored = await models.GameSession.findOne({ _id: trivia.session._id });
  assert.equal(stored.status, 'completed');
});

test('rps buttons let both players choose and settle once', async () => {
  const a = '677777777777777777';
  const b = '688888888888888888';
  await models.RPGUser.create({ guildId: GUILD, userId: a, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: b, wallet: 1000 });
  const challenge = await gameService.rpsChallenge(GUILD, a, b, 'rock', 100, null, 'rps-btn');
  const first = interaction(`rpg:rps:${challenge.session._id}:paper`, b);
  await handleRPGInteraction(first);
  assert.match(first.state.updates[0].embeds[0].data.description, /MENANG|Seri/);
  const stored = await models.GameSession.findOne({ _id: challenge.session._id });
  assert.equal(stored.status, 'completed');
});
