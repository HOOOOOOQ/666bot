'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { installFakeDatabase } = require('./helpers/fakeDb');

// Swap the Mongo layer for the in-memory implementation BEFORE services load.
const models = installFakeDatabase();

const configService = require('../src/services/configService');
const { UserError } = require('../src/utils/errors');
const duoService = require('../src/services/duoService');
const activityService = require('../src/services/activityService');
const streakService = require('../src/services/streakService');
const rewardService = require('../src/services/rewardService');
const notificationService = require('../src/services/notificationService');
const profileService = require('../src/services/profileService');

const GUILD = '900000000000000001';
const CHANNEL = '800000000000000001';
const A = '100000000000000001';
const B = '100000000000000002';
const C = '100000000000000003';
const D = '100000000000000004';
const E = '100000000000000005';

const BASE = Date.parse('2026-11-01T09:00:00+07:00');
const DAY = 24 * 60 * 60 * 1000;

function discordMember(id, name, { bot = false } = {}) {
  return {
    id,
    user: { id, username: name.toLowerCase(), bot },
    displayName: name,
    displayAvatarURL: () => `https://cdn.discordapp.com/avatars/${id}/hash.png`,
  };
}

function message(authorId, content, { bot = false } = {}) {
  return {
    guildId: GUILD,
    channelId: CHANNEL,
    content,
    system: false,
    author: { id: authorId, bot, username: `user${String(authorId).slice(-2)}` },
    channel: { id: CHANNEL, parentId: null },
    inGuild: () => true,
  };
}

async function createDuo(fromId = A, toId = B, fromName = 'Tama', toName = 'Zen') {
  await duoService.invite({
    guildId: GUILD,
    from: discordMember(fromId, fromName),
    to: discordMember(toId, toName),
  });
  return duoService.acceptInvitation({ guildId: GUILD, userId: toId });
}

beforeEach(() => {
  models.__reset();
  configService.clearConfigCache();
  duoService.clearDuoCache();
  activityService.clearActivityCache();
});

test('invitation guards: self invite, bots, duplicates and double-duo', async () => {
  await assert.rejects(
    duoService.invite({ guildId: GUILD, from: discordMember(A, 'Tama'), to: discordMember(A, 'Tama') }),
    /dirimu sendiri/,
  );

  await assert.rejects(
    duoService.invite({
      guildId: GUILD,
      from: discordMember(A, 'Tama'),
      to: discordMember(B, 'BotB', { bot: true }),
    }),
    /bot/i,
  );

  const first = await duoService.invite({
    guildId: GUILD,
    from: discordMember(A, 'Tama'),
    to: discordMember(B, 'Zen'),
  });
  assert.equal(first.existing, false);

  const duplicate = await duoService.invite({
    guildId: GUILD,
    from: discordMember(A, 'Tama'),
    to: discordMember(B, 'Zen'),
  });
  assert.equal(duplicate.existing, true);
  assert.equal(String(duplicate.invitation._id), String(first.invitation._id));
  assert.equal(await models.Invitation.countDocuments({ status: 'pending' }), 1);

  await duoService.acceptInvitation({ guildId: GUILD, userId: B });

  await assert.rejects(
    duoService.invite({ guildId: GUILD, from: discordMember(A, 'Tama'), to: discordMember(C, 'Kai') }),
    /sudah terhubung/,
  );

  await assert.rejects(
    duoService.acceptInvitation({ guildId: GUILD, userId: C }),
    /Tidak ada undangan/,
  );
});

test('pending invitation limit prevents invite spam', async () => {
  for (const [id, name] of [[B, 'B'], [C, 'C'], [D, 'D']]) {
    await duoService.invite({
      guildId: GUILD,
      from: discordMember(A, 'Tama'),
      to: discordMember(id, name),
    });
  }

  await assert.rejects(
    duoService.invite({ guildId: GUILD, from: discordMember(A, 'Tama'), to: discordMember(E, 'E') }),
    /pending/,
  );
});

test('accepting creates an active Duo with zero streak (streak starts after first activity)', async () => {
  const { duo } = await createDuo();

  assert.equal(duo.status, 'active');
  assert.equal(duo.members.length, 2);
  assert.equal(duo.currentStreak, 0);
  assert.equal(duo.bestStreak, 0);
  assert.equal(duo.lastCompletedDay, null);

  // Same member cannot be in two active duos (unique partial index).
  await assert.rejects(
    models.Duo.create({
      guildId: GUILD,
      name: 'Illegal Duo',
      status: 'active',
      members: [
        { userId: A, username: 'tama' },
        { userId: C, username: 'kai' },
      ],
    }),
    (error) => error.code === 11000,
  );
});

test('streak increments only when BOTH members are active, exactly once per day', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();

  const first = await activityService.handleMessage(message(A, 'Selamat pagi semuanya'));
  assert.equal(first.counted, true);
  assert.equal(first.streak.completed, false);

  let duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  assert.equal(duo.currentStreak, 0, 'one member alone must not increase the streak');

  const second = await activityService.handleMessage(message(B, 'Pagi juga, siap hari ini'));
  assert.equal(second.counted, true);
  assert.equal(second.streak.completed, true);
  assert.equal(second.streak.streak, 1);

  duo = await duoService.getActiveDuoForUser(GUILD, B, { fresh: true });
  assert.equal(duo.currentStreak, 1);
  assert.equal(duo.bestStreak, 1);
  assert.equal(duo.totalDays, 1);
  assert.equal(duo.xp, 100);
  assert.equal(duo.lastCompletedDay, '2026-11-01');

  // More messages that day must not add another streak day.
  const repeat = await activityService.handleMessage(message(B, 'Pesan tambahan di hari yang sama'));
  assert.equal(repeat.counted, false);
  duo = await duoService.getActiveDuoForUser(GUILD, B, { fresh: true });
  assert.equal(duo.currentStreak, 1);
});

test('concurrent activity from both members never double increments the streak', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();

  await Promise.all([
    activityService.handleMessage(message(A, 'pesan bersamaan dari tama')),
    activityService.handleMessage(message(B, 'pesan bersamaan dari zen')),
  ]);

  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  assert.equal(duo.currentStreak, 1);
  assert.equal(await models.StreakHistory.countDocuments({ type: 'completed' }), 1);
});

test('invalid messages never count as activity', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();
  const cfg = await configService.getGuildConfig(GUILD);

  const cases = [
    ['!!!', 'command_like'],
    ['aaaaaaaaaaaa', 'spam'],
    ['aaaaa', 'spam'],
    ['hi', 'too_short'],
    ['https://example.com', 'url_only'],
    ['<@100000000000000002>', 'too_short'],
    ['/duo profile', 'command_like'],
  ];

  for (const [content, expected] of cases) {
    const validation = activityService.validateActivityMessage(message(A, content), cfg);
    assert.equal(validation.valid, false, `"${content}" should not be valid activity`);
    assert.equal(validation.reason, expected, `"${content}" reason`);
  }

  assert.equal(activityService.validateActivityMessage(message(A, 'halo semuanya'), cfg).valid, true);
  assert.equal(
    activityService.validateActivityMessage(message(A, 'halo', { bot: true }), cfg).valid,
    false,
  );
});

test('seven consecutive active days unlock the Rookie Duo Badge', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();

  for (let day = 0; day < 7; day += 1) {
    t.mock.timers.setTime(BASE + day * DAY);

    const a = await activityService.handleMessage(message(A, `day ${day} halo dari tama`));
    const b = await activityService.handleMessage(message(B, `day ${day} halo dari zen`));

    assert.equal(a.counted, true, `A activity day ${day}`);
    assert.equal(b.streak.completed, true, `streak completion day ${day}`);
    assert.equal(b.streak.streak, day + 1);
  }

  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  assert.equal(duo.currentStreak, 7);
  assert.equal(duo.bestStreak, 7);
  assert.equal(duo.xp, 700);
  assert.equal(duo.totalDays, 7);

  const rewards = await rewardService.getRewardSummary(duo);
  assert.equal(rewards.unlocked, 1);
  assert.equal(rewards.list[0].name, 'Rookie Duo Badge');
  assert.equal(rewards.list[0].unlocked, true);
  assert.equal(await models.DuoReward.countDocuments({}), 1);

  // Reward must never be granted twice.
  const again = await rewardService.checkAndGrant({ duo });
  assert.deepEqual(again, []);
  assert.equal(await models.DuoReward.countDocuments({}), 1);

  // Now miss two days -> rollover breaks the streak but keeps the best streak.
  const rolloverAt = BASE + 9 * DAY;
  const cfg = await configService.getGuildConfig(GUILD);
  const rollover = await streakService.evaluateGuildRollover({
    guildId: GUILD,
    guildConfig: cfg,
    now: new Date(rolloverAt),
  });

  assert.equal(rollover.broken, 1);
  const broken = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  assert.equal(broken.currentStreak, 0);
  assert.equal(broken.bestStreak, 7);

  const history = await models.StreakHistory.find({ duoId: duo._id, type: 'broken' }).lean();
  assert.equal(history.length, 1);
  assert.equal(history[0].streak, 7);

  // Rollover is idempotent.
  const secondRollover = await streakService.evaluateGuildRollover({
    guildId: GUILD,
    guildConfig: cfg,
    now: new Date(rolloverAt),
  });
  assert.equal(secondRollover.broken, 0);

  // A fresh streak can start again.
  t.mock.timers.setTime(rolloverAt);
  await activityService.handleMessage(message(A, 'mulai lagi dari awal tama'));
  const restart = await activityService.handleMessage(message(B, 'mulai lagi dari awal zen'));
  assert.equal(restart.streak.completed, true);
  assert.equal(restart.streak.streak, 1);

  const rewardsAfter = await rewardService.getRewardSummary(
    await duoService.getActiveDuoForUser(GUILD, B, { fresh: true }),
  );
  assert.equal(rewardsAfter.unlocked, 1, 'badges stay unlocked after a broken streak');
});

test('breaking a duo frees both members to create a new Duo', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  const { duo } = await createDuo();

  await activityService.handleMessage(message(A, 'halo dari tama hari ini'));
  await activityService.handleMessage(message(B, 'halo dari zen hari ini'));

  const fresh = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  const result = await duoService.breakDuo({ duo: fresh, userId: A, reason: 'manual' });
  assert.equal(result.duo.status, 'broken');
  assert.equal(result.finalStreak, 1);
  assert.equal(await models.UserStat.countDocuments({ duoId: duo._id }), 0);

  const newInvite = await duoService.invite({
    guildId: GUILD,
    from: discordMember(A, 'Tama'),
    to: discordMember(C, 'Kai'),
  });
  const { duo: newDuo } = await duoService.acceptInvitation({ guildId: GUILD, userId: C });
  assert.equal(String(newDuo._id) !== String(duo._id), true);
  assert.equal(newInvite.existing, false);
  assert.equal(await models.Duo.countDocuments({ status: 'active' }), 1);
});

test('renaming validates and persists the Duo name', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  const { duo } = await createDuo();

  const renamed = await duoService.renameDuo({ duo, userId: B, newName: '🔥 Eternal Flame' });
  assert.equal(renamed.name, '🔥 Eternal Flame');

  await assert.rejects(
    duoService.renameDuo({ duo: renamed, userId: '100000000000000099', newName: 'Hacked' }),
    /bukan member/,
  );
});

test('reminder notifications are sent at most once per day per duo', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();
  await activityService.handleMessage(message(A, 'aktivitas tama'));
  await activityService.handleMessage(message(B, 'aktivitas zen'));

  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  const cfg = await configService.getGuildConfig(GUILD);

  const first = await notificationService.notifyReminder({
    duo,
    guildConfig: cfg,
    missingMembers: duo.members,
    dayKey: '2026-11-02',
  });
  const second = await notificationService.notifyReminder({
    duo: await duoService.getActiveDuoForUser(GUILD, A, { fresh: true }),
    guildConfig: cfg,
    missingMembers: duo.members,
    dayKey: '2026-11-02',
  });

  assert.equal(first, true);
  assert.equal(second, false, 'the same reminder must not be sent twice');
});

test('today status and profile overview reflect real activity', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo();

  const cfg = await configService.getGuildConfig(GUILD);
  let duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  let status = await activityService.getTodayStatus(duo, cfg.timezone);

  assert.equal(status.bothCompleted, false);
  assert.equal(status.anyCompleted, false);

  await activityService.handleMessage(message(A, 'pagi semuanya'));

  duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  status = await activityService.getTodayStatus(duo, cfg.timezone);
  assert.equal(status.anyCompleted, true);
  assert.equal(status.bothCompleted, false);
  assert.equal(status.missing.length, 1);

  const guild = { id: GUILD, members: { cache: new Map(), fetch: async () => null } };
  const overview = await profileService.getDuoOverview({ guild, userId: A });
  assert.ok(overview.duo);
  assert.equal(overview.today.members.length, 2);
  assert.equal(overview.rewardSummary.unlocked, 0);
  assert.equal(overview.nextMilestone.days, 7);
});

test('guild configuration persists, validates timezones and is cached safely', async () => {
  const initial = await configService.getGuildConfig(GUILD);
  assert.equal(initial.timezone, 'Asia/Jakarta');
  assert.equal(initial.activityCooldownSeconds, 60);

  const updated = await configService.updateGuildConfig(GUILD, {
    timezone: 'Asia/Tokyo',
    reminderHour: 20,
    minMessageLength: 5,
    notificationsEnabled: false,
  });

  assert.equal(updated.timezone, 'Asia/Tokyo');
  assert.equal(updated.reminderHour, 20);
  assert.equal(updated.minMessageLength, 5);
  assert.equal(updated.notificationsEnabled, false);

  const reloaded = await configService.getGuildConfig(GUILD, { fresh: true });
  assert.equal(reloaded.timezone, 'Asia/Tokyo');

  assert.throws(() => configService.assertValidTimezone('Mars/Olympus'), UserError);
});

test('leaderboard and history return consistent pages', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: BASE });
  await createDuo(A, B, 'Tama', 'Zen');
  await activityService.handleMessage(message(A, 'halo semuanya'));
  await activityService.handleMessage(message(B, 'halo juga'));

  const duo = await duoService.getActiveDuoForUser(GUILD, A, { fresh: true });
  const board = await duoService.getLeaderboard({ guildId: GUILD, category: 'current', page: 0, pageSize: 5 });

  assert.equal(board.total, 1);
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].currentStreak, 1);
  assert.match(board.label, /Current Streak/);

  const history = await duoService.getHistory({ duoId: duo._id, page: 0, pageSize: 8 });
  assert.ok(history.total >= 2, 'joined + completed history entries');

  const types = history.entries.map((entry) => entry.type);
  assert.ok(types.includes('joined'));
  assert.ok(types.includes('completed'));
});
