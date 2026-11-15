'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
const battleService = require('../src/rpg/services/battleService');
const tradeService = require('../src/rpg/services/tradeService');
const gameService = require('../src/rpg/services/minigameService');
const userService = require('../src/rpg/services/userService');
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
  assert.ok(btn.state.updates[0].content || btn.state.updates[0].embeds?.length);
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
  assert.ok(btn.state.updates[0].content || btn.state.updates[0].embeds?.length);
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
  assert.match(first.state.updates[0].content, /MENANG|Seri/);
  const stored = await models.GameSession.findOne({ _id: challenge.session._id });
  assert.equal(stored.status, 'completed');
});

test('mines buttons reveal safely, cash out once, and never debit wallet balance', async () => {
  const user = '699999999999999991';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 2500 });
  const game = await gameService.createMines(GUILD, user, 3000, null, 'mine-btn');
  const mines = game.state.mines;
  const safe = Array.from({ length: 9 }, (_, index) => index).find((index) => !mines.includes(index));
  const reveal = interaction(`rpg:mine:reveal:${game.session._id}:${safe}`, user);
  await handleRPGInteraction(reveal);
  assert.match(reveal.state.updates[0].content, /666 MINES/);
  assert.match(reveal.state.updates[0].content, /Safe: \*\*1\*\*/);
  assert.ok(reveal.state.updates[0].components.length >= 4);
  const active = await models.GameSession.findOne({ _id: game.session._id });
  assert.equal(active.status, 'active');

  const cash = interaction(`rpg:mine:cash:${game.session._id}`, user);
  await handleRPGInteraction(cash);
  assert.match(cash.state.updates[0].content, /CASH OUT/);
  const completed = await models.GameSession.findOne({ _id: game.session._id });
  assert.equal(completed.status, 'completed');
  assert.ok(completed.payout > 0);
  const after = await models.RPGUser.findOne({ guildId: GUILD, userId: user });
  assert.equal(after.wallet, 2500);
  assert.ok(after.xp > 0);
});

test('expired mines sessions cannot award a reward', async () => {
  const user = '699999999999999992';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 100 });
  const game = await gameService.createMines(GUILD, user, 1000, null, 'mine-expire');
  await models.GameSession.updateOne({ _id: game.session._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const safe = Array.from({ length: 9 }, (_, index) => index).find((index) => !game.state.mines.includes(index));
  const reveal = interaction(`rpg:mine:reveal:${game.session._id}:${safe}`, user);
  await handleRPGInteraction(reveal);
  assert.match(reveal.state.updates[0].embeds[0].data.description, /kedaluwarsa/i);
  const stored = await models.GameSession.findOne({ _id: game.session._id });
  assert.equal(stored.status, 'expired');
});

test('concurrent cash out settles a mines session only once', async () => {
  const user = '699999999999999993';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 100 });
  const game = await gameService.createMines(GUILD, user, 2000, null, 'mine-race');
  const safe = Array.from({ length: 9 }, (_, index) => index).find((index) => !game.state.mines.includes(index));
  await gameService.revealMine(GUILD, user, String(game.session._id), safe);
  const results = await Promise.allSettled([
    gameService.cashOutMines(GUILD, user, String(game.session._id)),
    gameService.cashOutMines(GUILD, user, String(game.session._id)),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const history = await models.GameHistory.find({ guildId: GUILD, userId: user, game: 'mines' });
  assert.equal(history.length, 1);
});


test('inventory pagination is owner-only and edits the original message', async () => {
  const user = '699999999999999994';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 100 });
  for (const itemId of ['potion', 'bait', 'charm', 'pet_food', 'egg_basic', 'egg_rare', 'repair_kit', 'rusty_blade', 'iron_sword']) {
    await userService.addItem(GUILD, user, itemId, 1);
  }
  const commands = require('../src/rpg/commands');
  const replies = [];
  const message = {
    id: 'inv-page-1', guildId: GUILD, channelId: '755555555555555555',
    author: { id: user, username: 'InventoryUser', bot: false, displayAvatarURL: () => null },
    channel: { sendTyping: async () => {} }, mentions: { users: { size: 0, first: () => null } },
    client: { users: { fetch: async () => null } }, reply: async (payload) => { replies.push(payload); return { id: 'reply-id' }; },
  };
  const command = commands.get('tcash');
  await command.execute({ message, args: ['inventory'], token: 'tcash', command, guildId: GUILD, userId: user, profile: { username: 'InventoryUser' }, replies });
  assert.match(replies[0].embeds[0].data.footer.text, /1\/2/);
  assert.ok(replies[0].components?.length);

  const next = interaction(`rpg:inv:${user}:2`, user);
  await handleRPGInteraction(next);
  assert.match(next.state.updates[0].embeds[0].data.footer.text, /2\/2/);

  const other = interaction(`rpg:inv:${user}:1`, '699999999999999995');
  await handleRPGInteraction(other);
  assert.match(other.state.updates[0].embeds[0].data.description, /bukan milikmu/i);
});

test('clicking a mine ends the session with no reward and disabled buttons', async () => {
  const user = '699999999999999996';
  await models.RPGUser.create({ guildId: GUILD, userId: user, wallet: 4000 });
  const game = await gameService.createMines(GUILD, user, 5000, null, 'mine-hit');
  const mine = game.state.mines[0];
  const hit = interaction(`rpg:mine:reveal:${game.session._id}:${mine}`, user);
  await handleRPGInteraction(hit);
  assert.match(hit.state.updates[0].content, /BOOM/);
  const rows = hit.state.updates[0].components;
  assert.ok(rows.every((row) => row.components.every((button) => button.data.disabled)));
  const stored = await models.GameSession.findOne({ _id: game.session._id });
  assert.equal(stored.status, 'completed');
  assert.equal(stored.payout, 0);
  const after = await models.RPGUser.findOne({ guildId: GUILD, userId: user });
  assert.equal(after.wallet, 4000);
});
