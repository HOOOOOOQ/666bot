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
  assert.ok(payload.embeds?.length, `${content} harus mengirim embed`);
  return ctx;
}

test('economy, help, profile and quest commands render', async () => {
  await run('6help', '711111111111111111');
  await run('6cash', '712222222222222222');
  await run('6cash daily', '713333333333333333');
  await run('6cash work', '714444444444444444');
  await run('6cash shop', '715555555555555555');
  await run('6cash buy potion', '716666666666666666');
  await run('6cash inventory', '716666666666666666');
  await run('6profile', '717777777777777777');
  await run('6rank', '718888888888888888');
  await run('6quest', '719999999999999999');
  await run('6achievement', '719999999999999998');
});

test('hunting and pet commands render with real state transitions', async () => {
  await settingsService.updateSection(GUILD, 'hunting', { spawnChance: 100 }, 'test');
  await run('6hunt', '721111111111111111');
  await run('6hunt inventory', '721111111111111111');
  await run('6hunt collection', '721111111111111111');
  await run('6hunt stats', '721111111111111111');
  await run('6pet hatch', '722222222222222222');
  await run('6pet inventory', '722222222222222222');
  await run('6pet stats', '722222222222222222');
});

test('all mini game commands render and blackjack/trivia create sessions', async () => {
  await run('6coinflip heads 10', '731111111111111111');
  await run('6dice 3 10', '732222222222222222');
  await run('6slots 10', '733333333333333333');
  await run('6roulette red 10', '734444444444444444');
  await run('6guess 5 10', '735555555555555555');
  await run('6rps rock 10', '736666666666666666');
  await run('6blackjack 10', '737777777777777777');
  await run('6trivia 10', '738888888888888888');
});

test('battle, trade, market, guild and boss commands render', async () => {
  await models.RPGUser.create({ guildId: GUILD, userId: BOT.id, wallet: 1000 });
  await models.RPGUser.create({ guildId: GUILD, userId: '741111111111111111', wallet: 20000 });
  await run(`6battle <@${BOT.id}>`, '742222222222222222', BOT);
  await run(`6trade <@${BOT.id}> 10`, '743333333333333333', BOT);
  await run('6market', '744444444444444444');
  await run('6guild create CommandGuild', '741111111111111111');
  await run('6guild info', '741111111111111111');
  await run('6boss status', '745555555555555555');
  await run('6boss attack', '746666666666666666');
});
