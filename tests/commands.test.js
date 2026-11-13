'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { installFakeDatabase } = require('./helpers/fakeDb');

const models = installFakeDatabase();

const configService = require('../src/services/configService');
const duoService = require('../src/services/duoService');
const activityService = require('../src/services/activityService');
const cardService = require('../src/services/cardService');
const duoCommand = require('../src/commands/duo');
const interactionCreate = require('../src/events/interactionCreate');
const { loadEvents } = require('../src/handlers/eventHandler');

const GUILD = '900000000000000001';
const CHANNEL = '800000000000000001';
const A = '100000000000000001';
const B = '100000000000000002';

function discordMember(id, name, { bot = false } = {}) {
  return {
    id,
    user: { id, username: name.toLowerCase(), bot },
    displayName: name,
    displayAvatarURL: () => `https://cdn.discordapp.com/avatars/${id}/hash.png`,
  };
}

const memberA = discordMember(A, 'Tama');
const memberB = discordMember(B, 'Zen');

function createGuild() {
  const members = new Map([[A, memberA], [B, memberB]]);
  return {
    id: GUILD,
    name: '666 Server',
    members: {
      cache: members,
      fetch: async (id) => members.get(id) || null,
    },
    channels: { cache: new Map() },
  };
}

function optionsApi(subcommand, values = {}) {
  return {
    getSubcommand: () => subcommand,
    getString: (name) => values[name] ?? null,
    getUser: (name) => values[name] ?? null,
    getChannel: (name) => values[name] ?? null,
    getBoolean: (name) => (name in values ? values[name] : null),
    getInteger: (name) => (name in values ? values[name] : null),
  };
}

function createInteraction({ guild, subcommand, values = {}, user = memberA, customId = null, label = 'command' } = {}) {
  const interaction = {
    commandName: label === 'command' ? 'duo' : null,
    guild,
    guildId: guild.id,
    user: user.user,
    member: user,
    memberPermissions: { has: () => true },
    options: optionsApi(subcommand, values),
    deferred: false,
    replied: false,
    repliedPayloads: [],
    customId,
    client: { commands: new Map([['duo', duoCommand]]) },
    async reply(payload) {
      this.replied = true;
      this.repliedPayloads.push(payload);
      return payload;
    },
    async editReply(payload) {
      this.replied = true;
      this.repliedPayloads.push(payload);
      return payload;
    },
    async followUp(payload) {
      this.repliedPayloads.push(payload);
      return payload;
    },
    async deferReply() {
      this.deferred = true;
    },
    async deferUpdate() {
      this.deferred = true;
    },
    async update(payload) {
      this.replied = true;
      this.repliedPayloads.push(payload);
      return payload;
    },
    async fetchReply() {
      return {
        createMessageComponentCollector: () => ({ on() {} }),
      };
    },
    isChatInputCommand: () => label === 'command',
    isButton: () => label === 'button',
    inGuild: () => true,
  };
  return interaction;
}

async function runSubcommand(subcommand, { values = {}, user = memberA, guild = createGuild() } = {}) {
  const interaction = createInteraction({ guild, subcommand, values, user });
  await duoCommand.execute(interaction);
  return interaction;
}

function lastPayload(interaction) {
  const payload = interaction.repliedPayloads.at(-1);
  assert.ok(payload, 'command should reply with a payload');
  assert.ok(Array.isArray(payload.embeds) && payload.embeds.length, 'payload should contain an embed');
  return payload;
}

beforeEach(() => {
  models.__reset();
  cardService.setAvatarFetcher(async () => null);
  configService.clearConfigCache();
  duoService.clearDuoCache();
  activityService.clearActivityCache();
});

test('/duo exposes every documented subcommand', () => {
  const names = duoCommand.data.toJSON().options.map((option) => option.name);
  assert.deepEqual(names, [
    'help', 'invite', 'accept', 'decline', 'profile', 'streak',
    'leaderboard', 'rewards', 'history', 'rename', 'break', 'config',
    'setlog', 'logstatus',
  ]);
});

test('full command flow: help, invite, decline, invite, accept, profile, streak, rewards, rename, history, leaderboard, config, break', async () => {
  const guild = createGuild();

  // help
  const help = await runSubcommand('help', { guild });
  const helpJson = lastPayload(help).embeds[0].toJSON();
  assert.match(helpJson.description, /CARA KERJA/);

  // invite
  const invite = await runSubcommand('invite', { guild, values: { member: memberB.user } });
  const invitePayload = lastPayload(invite);
  assert.ok(invitePayload.components.length, 'invitation should have accept/decline buttons');
  const pending = await models.Invitation.findOne({ status: 'pending' }).lean();
  assert.ok(pending);

  // decline
  const decline = await runSubcommand('decline', { guild, user: memberB });
  assert.match(lastPayload(decline).embeds[0].toJSON().description, /ditolak/);

  // invite again + accept
  await runSubcommand('invite', { guild, values: { member: memberB.user } });
  const accept = await runSubcommand('accept', { guild, user: memberB });
  const acceptJson = lastPayload(accept).embeds[0].toJSON();
  assert.match(acceptJson.title, /Duo Connection Established/);

  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  assert.ok(duo);
  assert.equal(duo.status, 'active');

  // record today's activity for both members
  const fakeMessage = (authorId, content) => ({
    guildId: GUILD,
    channelId: CHANNEL,
    content,
    system: false,
    author: { id: authorId, bot: false, username: 'tester' },
    channel: { id: CHANNEL, parentId: null },
    inGuild: () => true,
  });
  await activityService.handleMessage(fakeMessage(A, 'halo dari tama hari ini'));
  await activityService.handleMessage(fakeMessage(B, 'halo dari zen hari ini'));

  // profile
  const profile = await runSubcommand('profile', { guild });
  const profilePayload = lastPayload(profile);
  const profileJson = profilePayload.embeds[0].toJSON();
  assert.equal(profileJson.title, duo.name);
  assert.match(profileJson.description, /1 DAY STREAK/);
  assert.equal(profileJson.image?.url, 'attachment://duo-profile.png');
  assert.equal(profilePayload.files?.length, 1, 'profile card PNG should be attached');
  assert.ok(profilePayload.files[0].attachment.length > 10000, 'rendered profile PNG should not be empty');
  const bestField = profileJson.fields.find((field) => field.name === 'BEST STREAK');
  assert.match(bestField.value, /1 day/);

  // streak
  const streak = await runSubcommand('streak', { guild });
  assert.match(lastPayload(streak).embeds[0].toJSON().title, /streak/i);

  // rewards
  const rewards = await runSubcommand('rewards', { guild });
  const rewardsJson = lastPayload(rewards).embeds[0].toJSON();
  assert.match(rewardsJson.description, /Rookie Duo Badge/);

  // rename
  const rename = await runSubcommand('rename', { guild, values: { nama: 'Eternal Flame' } });
  assert.match(lastPayload(rename).embeds[0].toJSON().description, /Eternal Flame/);

  // history (deferred + paginated)
  const history = await runSubcommand('history', { guild });
  assert.equal(history.deferred, true);
  const historyJson = lastPayload(history).embeds[0].toJSON();
  assert.match(historyJson.title, /Riwayat/);

  // leaderboard (deferred + paginated)
  const leaderboard = await runSubcommand('leaderboard', { guild, values: { category: 'current' } });
  assert.equal(leaderboard.deferred, true);
  const boardPayload = lastPayload(leaderboard);
  const boardJson = boardPayload.embeds[0].toJSON();
  assert.match(boardJson.author.name, /LEADERBOARD/);
  assert.equal(boardJson.image?.url, 'attachment://duo-leaderboard.png');
  assert.equal(boardPayload.files?.length, 1, 'leaderboard card PNG should be attached');

  // config
  const config = await runSubcommand('config', { guild, values: { timezone: 'Asia/Tokyo', min_message_length: 5 } });
  const configJson = lastPayload(config).embeds[0].toJSON();
  assert.match(configJson.description, /Asia\/Tokyo/);
  const updatedConfig = await configService.getGuildConfig(GUILD, { fresh: true });
  assert.equal(updatedConfig.timezone, 'Asia/Tokyo');
  assert.equal(updatedConfig.minMessageLength, 5);

  // break via confirmation button through the real interaction handler
  const breakCommand = await runSubcommand('break', { guild });
  assert.ok(lastPayload(breakCommand).components.length);

  const buttonInteraction = createInteraction({
    guild,
    user: memberA,
    customId: `duo:break:confirm:${duo._id}`,
    label: 'button',
  });
  await interactionCreate.execute(buttonInteraction);

  const breakJson = lastPayload(buttonInteraction).embeds[0].toJSON();
  assert.match(breakJson.title, /Duo telah diakhiri/);

  const ended = await duoService.getDuoById(duo._id, { fresh: true });
  assert.equal(ended.status, 'broken');
  assert.equal(ended.bestStreak, 1);

  // After breaking, profile informs the user that there is no Duo.
  const noDuoProfile = await runSubcommand('profile', { guild });
  assert.match(lastPayload(noDuoProfile).embeds[0].toJSON().title, /Belum terhubung/);
});

test('accept/decline buttons work through the interaction handler', async () => {
  const guild = createGuild();

  await runSubcommand('invite', { guild, values: { member: memberB.user } });
  const invitation = await models.Invitation.findOne({ status: 'pending' }).lean();

  // Wrong user cannot accept someone else's invitation.
  const wrongUser = discordMember('100000000000000009', 'Intruder');
  const wrongInteraction = createInteraction({
    guild,
    user: wrongUser,
    customId: `duo:accept:${invitation._id}`,
    label: 'button',
  });

  await interactionCreate.execute(wrongInteraction);
  const errorJson = lastPayload(wrongInteraction).embeds[0].toJSON();
  assert.match(errorJson.title, /Tidak Bisa Diproses/);

  // Invited user can accept.
  const acceptInteraction = createInteraction({
    guild,
    user: memberB,
    customId: `duo:accept:${invitation._id}`,
    label: 'button',
  });
  await interactionCreate.execute(acceptInteraction);

  const payload = lastPayload(acceptInteraction);
  assert.match(payload.embeds[0].toJSON().title, /Duo Connection Established/);
  const duo = await duoService.getActiveDuoForUser(GUILD, B, { fresh: true });
  assert.ok(duo);
});

test('config command rejects users without Manage Server', async () => {
  const guild = createGuild();
  const regularUser = discordMember('100000000000000010', 'Regular');
  const interaction = createInteraction({ guild, subcommand: 'config', user: regularUser });
  interaction.memberPermissions = { has: () => false };

  // The real interaction handler converts the thrown UserError into an embed.
  await interactionCreate.execute(interaction);

  const json = lastPayload(interaction).embeds[0].toJSON();
  assert.match(json.description, /Manage Server/);
});

test('every event module loads and binds to the client', () => {
  const events = [];
  const client = {
    on: (name) => events.push(name),
    once: (name) => events.push(name),
  };

  const loaded = loadEvents(client);
  assert.deepEqual([...loaded].sort(), [
    'clientReady',
    'guildMemberRemove',
    'interactionCreate',
    'messageCreate',
  ]);
  assert.equal(events.length, 4);
});
