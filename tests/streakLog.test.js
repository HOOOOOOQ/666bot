'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { installFakeDatabase } = require('./helpers/fakeDb');

const models = installFakeDatabase();

const configService = require('../src/services/configService');
const duoService = require('../src/services/duoService');
const activityService = require('../src/services/activityService');
const logService = require('../src/services/logService');
const cardService = require('../src/services/cardService');
const setlogCommand = require('../src/commands/duo/setlog');
const logstatusCommand = require('../src/commands/duo/logstatus');
const { getDayKey } = require('../src/utils/time');

const GUILD = '900000000000000001';
const CHANNEL = '800000000000000001';
const A = '100000000000000001';
const B = '100000000000000002';

function discordMember(id, name) {
  return {
    id,
    user: { id, username: name.toLowerCase(), bot: false },
    displayName: name,
    displayAvatarURL: () => null,
  };
}

function message(authorId, content) {
  return {
    guildId: GUILD,
    channelId: CHANNEL,
    content,
    system: false,
    author: { id: authorId, bot: false, username: `user${authorId.slice(-2)}` },
    channel: { id: CHANNEL, parentId: null },
    inGuild: () => true,
  };
}

function createChannel({ failures = 0, permissions = true } = {}) {
  const channel = {
    id: CHANNEL,
    messages: [],
    failures,
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => permissions }),
    async send(payload) {
      if (this.failures > 0) {
        this.failures -= 1;
        throw new Error('Simulated channel send failure');
      }
      this.messages.push(payload);
      return { id: `message-${this.messages.length}` };
    },
  };
  return channel;
}

function installClient(channel) {
  const guild = {
    id: GUILD,
    name: '666 Server',
    members: { me: { id: '666000000000000000' } },
  };
  channel.guild = guild;

  const client = {
    channels: {
      cache: new Map([[CHANNEL, channel]]),
      fetch: async (id) => (String(id) === CHANNEL ? channel : null),
    },
    guilds: { cache: new Map([[GUILD, guild]]) },
  };
  logService.init(client);
  return { client, guild, channel };
}

async function createActiveDuo() {
  await duoService.invite({
    guildId: GUILD,
    from: discordMember(A, 'Tama'),
    to: discordMember(B, 'Zen'),
  });
  return duoService.acceptInvitation({ guildId: GUILD, userId: B });
}

function commandInteraction({ permissions = true, channel, values = {} } = {}) {
  const interaction = {
    guildId: GUILD,
    guild: {
      id: GUILD,
      name: '666 Server',
      members: { me: { id: '666000000000000000' } },
      channels: { cache: new Map(channel ? [[CHANNEL, channel]] : []) },
    },
    memberPermissions: { has: () => permissions },
    options: {
      getChannel: () => channel || null,
      getBoolean: (name) => (name in values ? values[name] : null),
    },
    replies: [],
    async reply(payload) {
      this.replies.push(payload);
      return payload;
    },
  };
  return interaction;
}

beforeEach(async () => {
  await logService.flush(5000);
  logService.init(null);
  models.__reset();
  configService.clearConfigCache();
  duoService.clearDuoCache();
  activityService.clearActivityCache();
  cardService.setAvatarFetcher(async () => null);
});

test('no log is created when the server has no log channel', async () => {
  await createActiveDuo();
  await activityService.handleMessage(message(A, 'halo semuanya selamat pagi'));
  const result = await activityService.handleMessage(message(B, 'pagi juga kawan siap hari ini'));
  assert.equal(result.streak.completed, true);
  assert.equal(await models.StreakLog.countDocuments({}), 0);
});

test('streak log fires once when both members complete, never for a single member', async () => {
  const channel = createChannel();
  installClient(channel);
  await configService.updateGuildConfig(GUILD, { logChannelId: CHANNEL });
  await createActiveDuo();

  await activityService.handleMessage(message(A, 'halo semuanya selamat pagi'));
  assert.equal(await models.StreakLog.countDocuments({}), 0, 'one active member must not create a log');
  assert.equal(channel.messages.length, 0);

  const streak = await activityService.handleMessage(message(B, 'pagi juga kawan siap hari ini'));
  assert.equal(streak.streak.completed, true);

  assert.equal(await logService.flush(15000), true);
  assert.equal(await models.StreakLog.countDocuments({}), 1);
  assert.equal(channel.messages.length, 1);

  const entry = await models.StreakLog.findOne({}).lean();
  assert.equal(entry.status, 'sent');
  assert.equal(entry.previousStreak, 0);
  assert.equal(entry.currentStreak, 1);
  assert.equal(entry.attempts, 1);
  assert.ok(entry.sentAt);
  assert.ok(entry.messageId);

  const payload = channel.messages[0];
  assert.equal(payload.files?.length, 1, 'streak log banner must be attached');
  assert.ok(payload.files[0].attachment.length > 10000, 'banner PNG must not be empty');
  assert.equal(payload.allowedMentions.parse.length, 0);
  assert.deepEqual(payload.allowedMentions.users.sort(), [A, B].sort());

  const embed = payload.embeds[0].toJSON();
  assert.match(embed.title, /666 DUO STREAK UPDATED/);
  assert.match(embed.description, /STREAK INCREASED/);
  assert.match(embed.description, /0 DAYS → 1 DAYS/);
  assert.equal(embed.image.url, 'attachment://duo-streak-log.png');
  assert.match(embed.footer.text, /AUTOMATIC LOGS/);
  const activityField = embed.fields.find((field) => field.name === 'ACTIVITY STATUS');
  assert.match(activityField.value, /BOTH MEMBERS ACTIVE/);
});

test('the unique duo/day index prevents duplicate logs even when record is raced', async () => {
  const channel = createChannel();
  installClient(channel);
  await configService.updateGuildConfig(GUILD, { logChannelId: CHANNEL });
  await createActiveDuo();
  await activityService.handleMessage(message(A, 'halo semuanya selamat pagi'));
  await activityService.handleMessage(message(B, 'pagi juga kawan siap hari ini'));
  await logService.flush(15000);

  const config = await configService.getGuildConfig(GUILD, { fresh: true });
  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  const existing = await models.StreakLog.findOne({ duoId: duo._id }).lean();

  const [first, second] = await Promise.all([
    logService.recordStreakIncrement({ duo, previousStreak: 0, dayKey: existing.dayKey, guildConfig: config }),
    logService.recordStreakIncrement({ duo, previousStreak: 0, dayKey: existing.dayKey, guildConfig: config }),
  ]);

  assert.equal(String(first._id), String(second._id));
  assert.equal(await models.StreakLog.countDocuments({ duoId: duo._id }), 1);
  await logService.flush(15000);
  assert.equal(channel.messages.length, 1, 'duplicate record must never send twice');
});

test('failed deliveries retry with backoff and never double-post', async () => {
  const channel = createChannel({ failures: 1 });
  installClient(channel);
  await configService.updateGuildConfig(GUILD, { logChannelId: CHANNEL });
  await createActiveDuo();

  await activityService.handleMessage(message(A, 'halo semuanya selamat pagi'));
  await activityService.handleMessage(message(B, 'pagi juga kawan siap hari ini'));
  await logService.flush(15000);

  let entry = await models.StreakLog.findOne({}).lean();
  assert.equal(entry.status, 'failed');
  assert.equal(entry.attempts, 1);
  assert.match(entry.lastError, /Simulated channel send failure/);
  assert.equal(channel.messages.length, 0);

  // Make the retry immediately due instead of waiting for the backoff window.
  await models.StreakLog.updateOne(
    { _id: entry._id },
    { $set: { nextAttemptAt: new Date(Date.now() - 1000) } },
  );

  const retried = await logService.processLog(entry._id);
  assert.equal(retried.sent, true);
  assert.equal(channel.messages.length, 1);

  entry = await models.StreakLog.findOne({ _id: entry._id }).lean();
  assert.equal(entry.status, 'sent');
  assert.equal(entry.attempts, 2);

  const again = await logService.processLog(entry._id);
  assert.equal(again.sent, false);
  assert.equal(again.reason, 'already_sent');
  assert.equal(channel.messages.length, 1);
});

test('pending logs survive a restart and are recovered exactly once', async () => {
  await configService.updateGuildConfig(GUILD, { logChannelId: CHANNEL });
  await createActiveDuo();

  // No gateway client yet: the log is persisted but cannot be sent.
  logService.init(null);
  await activityService.handleMessage(message(A, 'halo semuanya selamat pagi'));
  await activityService.handleMessage(message(B, 'pagi juga kawan siap hari ini'));
  await logService.flush(2000);

  let entry = await models.StreakLog.findOne({}).lean();
  assert.equal(entry.status, 'pending');
  assert.equal(entry.attempts, 0);

  // Simulate a process that died mid-send.
  await models.StreakLog.updateOne({ _id: entry._id }, { $set: { status: 'sending', attempts: 1 } });

  const channel = createChannel();
  const { client } = installClient(channel);

  await logService.start(client);
  const recovered = await logService.retryPending({ limit: 5 });
  assert.equal(recovered, 1);

  entry = await models.StreakLog.findOne({ _id: entry._id }).lean();
  assert.equal(entry.status, 'sent');
  assert.equal(channel.messages.length, 1);

  await logService.stop();
});

test('setlog validates Manage Server + channel permissions and persists the channel', async () => {
  const channel = createChannel();
  const denied = commandInteraction({ permissions: false, channel });
  await assert.rejects(() => setlogCommand.execute(denied), /Manage Server/);

  const noAccessChannel = { ...channel, permissionsFor: () => ({ has: () => false }) };
  const noAccess = commandInteraction({ permissions: true, channel: noAccessChannel });
  await assert.rejects(() => setlogCommand.execute(noAccess), /izin lengkap/);

  const allowed = commandInteraction({ permissions: true, channel });
  await setlogCommand.execute(allowed);
  assert.equal(allowed.replies.length, 1);

  const config = await configService.getGuildConfig(GUILD, { fresh: true });
  assert.equal(config.logChannelId, CHANNEL);
  const embed = allowed.replies[0].embeds[0].toJSON();
  assert.match(embed.title, /Log channel aktif/);
  assert.match(embed.description, new RegExp(CHANNEL));

  const status = commandInteraction({ permissions: true, channel });
  await logstatusCommand.execute(status);
  const statusEmbed = status.replies[0].embeds[0].toJSON();
  assert.match(statusEmbed.title, /Log System Status/);
  assert.ok(statusEmbed.fields.find((field) => field.name === 'SENT'));
});

test('logstatus counts sent, pending, failed and skipped rows', async () => {
  const channel = createChannel();
  installClient(channel);
  await configService.updateGuildConfig(GUILD, { logChannelId: CHANNEL });
  await createActiveDuo();
  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });

  await models.StreakLog.create({
    guildId: GUILD, duoId: duo._id, dayKey: '2026-11-10', status: 'sent', sentAt: new Date(),
    previousStreak: 1, currentStreak: 2, bestStreak: 2, duoName: duo.name, attempts: 1,
  });
  await models.StreakLog.create({
    guildId: GUILD, duoId: duo._id, dayKey: '2026-11-11', status: 'failed', attempts: 2,
    lastError: 'boom', previousStreak: 2, currentStreak: 3, bestStreak: 3, duoName: duo.name,
  });
  await models.StreakLog.create({
    guildId: GUILD, duoId: duo._id, dayKey: '2026-11-12', status: 'skipped',
    previousStreak: 3, currentStreak: 4, duoName: duo.name,
  });

  const status = await logService.getLogStatus(GUILD);
  assert.equal(status.counts.sent, 1);
  assert.equal(status.counts.failed, 1);
  assert.equal(status.counts.skipped, 1);
  assert.equal(status.counts.pending, 0);
  assert.equal(status.channel.id, CHANNEL);

  const interaction = commandInteraction({ permissions: true, channel });
  await logstatusCommand.execute(interaction);
  const embed = interaction.replies[0].embeds[0].toJSON();
  assert.match(embed.description, /exponential backoff/);
  assert.match(embed.fields.find((field) => field.name === 'RECENT LOGS').value, /2026-11-10/);
});

test('day key used by the log matches the guild timezone', async () => {
  const config = await configService.getGuildConfig(GUILD);
  assert.equal(getDayKey(new Date(), config.timezone).length, 10);
});
