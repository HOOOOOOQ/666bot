'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
const commands = require('../src/rpg/commands');
const settingsService = require('../src/rpg/services/settingsService');
const GUILD = '777777777777777777';
const BOT = { id: '766666666666666666', username: 'Target', bot: false, displayAvatarURL: () => null };

function makeCtx(content, userId, mention = null) {
  const [token, ...args] = content.split(/\s+/);
  const command = commands.get(token);
  assert.ok(command, `command ${token} missing`);
  const replies = [];
  const message = {
    id: `${userId}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    guildId: GUILD,
    channelId: '755555555555555555',
    author: { id: userId, username: `User${userId.slice(-3)}`, bot: false, displayAvatarURL: () => null },
    channel: { sendTyping: async () => {} },
    mentions: { users: { size: mention ? 1 : 0, first: () => mention } },
    client: { users: { fetch: async () => null } },
    reply: async (payload) => { replies.push(payload); return { id: 'reply-id' }; },
  };
  return { message, args, token, command, guildId: GUILD, userId, profile: { username: message.author.username, avatar: null }, replies };
}

async function run(content, userId, mention = null) {
  const ctx = makeCtx(content, userId, mention);
  await ctx.command.execute(ctx);
  assert.ok(ctx.replies.length >= 1, `${content} harus membalas`);
  const payload = ctx.replies[0];
  assert.ok(payload.embeds?.length || payload.content, `${content} harus mengirim respons`);
  return ctx;
}

test('economy, help, profile and quest commands render', async () => {
  await run('thelp', '711111111111111111');
  await run('tcash', '712222222222222222');
  await run('tcash daily', '713333333333333333');
  await run('tcash work', '714444444444444444');
  await run('tcash shop', '715555555555555555');
  await run('tcash buy potion', '716666666666666666');
  await run('tcash inventory', '716666666666666666');
  await run('tprofile', '717777777777777777');
  await run('trank', '718888888888888888');
  await run('tquest', '719999999999999999');
  await run('tachievement', '719999999999999998');
});

test('hunting and pet commands render with real state transitions', async () => {
  await settingsService.updateSection(GUILD, 'hunting', { spawnChance: 100 }, 'test');
  await run('thunt', '721111111111111111');
  await run('thunt inventory', '721111111111111111');
  await run('thunt collection', '721111111111111111');
  await run('thunt stats', '721111111111111111');
  await run('tpet hatch', '722222222222222222');
  await run('tpet inventory', '722222222222222222');
  await run('tpet stats', '722222222222222222');
});

test('all mini game commands render and blackjack/trivia create sessions', async () => {
  await run('tcoinflip heads 10', '731111111111111111');
  await run('tdice 3 10', '732222222222222222');
  await run('tslots 10', '733333333333333333');
  await run('troulette red 10', '734444444444444444');
  await run('tguess 5 10', '735555555555555555');
  await run('trps rock 10', '736666666666666666');
  const blackjack = await run('tblackjack 10', '737777777777777777');
  assert.ok(blackjack.replies[0].components?.length, 'blackjack harus mengirim tombol Hit/Stand');
  const trivia = await run('ttrivia 10', '738888888888888888');
  assert.ok(trivia.replies[0].components?.length, 'trivia harus mengirim tombol jawaban');
});

test('battle, trade, market, guild and boss commands render', async () => {
  await models.RPGUser.create({ guildId: GUILD, userId: BOT.id, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: '741111111111111111', wallet: 20000 });
  await run(`tbattle <@${BOT.id}>`, '742222222222222222', BOT);
  await run(`ttrade <@${BOT.id}> 10`, '743333333333333333', BOT);
  await run('tmarket', '744444444444444444');
  await run('tguild create CommandGuild', '741111111111111111');
  await run('tguild info', '741111111111111111');
  await run('tboss status', '745555555555555555');
  await run('tboss attack', '746666666666666666');
});

test('daily, weekly, monthly, work, slots, and coinflip use plain OwO-style responses', async () => {
  const daily = await run('tcash daily', '751111111111111111');
  assert.equal(daily.replies[0].embeds, undefined);
  assert.match(daily.replies[0].content, /Here is your daily/);
  assert.match(daily.replies[0].content, /\*\*[\d.]+\*\* 666 Coins/);
  assert.match(daily.replies[0].content, /daily streak/);
  assert.match(daily.replies[0].content, /Your next daily is in/);

  const weekly = await run('tcash weekly', '751111111111111112');
  assert.equal(weekly.replies[0].embeds, undefined);
  assert.match(weekly.replies[0].content, /Here is your weekly/);

  const monthly = await run('tcash monthly', '751111111111111113');
  assert.equal(monthly.replies[0].embeds, undefined);
  assert.match(monthly.replies[0].content, /Here is your monthly/);

  const work = await run('tcash work', '751111111111111114');
  assert.equal(work.replies[0].embeds, undefined);
  assert.match(work.replies[0].content, /worked and earned/);

  const slots = await run('tslots 10', '751111111111111115');
  assert.equal(slots.replies[0].embeds, undefined);
  assert.match(slots.replies[0].content, /666 SLOTS/);

  const coinflip = await run('tcoinflip heads 10', '751111111111111116');
  assert.equal(coinflip.replies[0].embeds, undefined);
  assert.match(coinflip.replies[0].content, /coin spins/);
});

test('mines starts a safe 3x3 virtual-point session without touching wallet balance', async () => {
  const ctx = makeCtx('tmine 3000', '752222222222222222');
  const before = await models.RPGUser.findOne({ guildId: GUILD, userId: ctx.userId });
  await ctx.command.execute(ctx);
  const payload = ctx.replies[0];
  assert.match(payload.content, /666 MINES/);
  assert.ok(payload.components.length >= 4);
  const session = await models.GameSession.findOne({ guildId: GUILD, userId: ctx.userId, game: 'mines' });
  assert.ok(session);
  assert.equal(session.bet, 3000);
  assert.equal(session.state.revealed.length, 0);
  const after = await models.RPGUser.findOne({ guildId: GUILD, userId: ctx.userId });
  assert.equal((after?.wallet || 0) - (before?.wallet || 0), 0);
});
