'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { renderProfileCard } = require('../src/ui/cards/profileCard');
const { renderLeaderboardCard } = require('../src/ui/cards/leaderboardCard');
const { renderStreakLogCard } = require('../src/ui/cards/streakLogCard');
const {
  profileCardEmbed,
  leaderboardCardEmbed,
  streakLogEmbed,
  logStatusEmbed,
  logChannelConfiguredEmbed,
} = require('../src/ui/embeds');

const A = '100000000000000001';
const B = '100000000000000002';

const memberA = {
  userId: A, username: 'tama', displayName: 'Tama', avatar: null,
};
const memberB = {
  userId: B, username: 'zen', displayName: 'Zen', avatar: null,
};

const duo = {
  name: 'Tama × Zen',
  status: 'active',
  currentStreak: 28,
  bestStreak: 45,
  totalDays: 28,
  xp: 2800,
  members: [memberA, memberB],
};

const today = {
  bothCompleted: true,
  anyCompleted: true,
  missing: [],
  members: [
    { userId: A, completed: true, completedAt: new Date(), member: memberA },
    { userId: B, completed: true, completedAt: new Date(), member: memberB },
  ],
};

const streakLog = {
  duoId: 'a'.repeat(24),
  duoName: duo.name,
  dayKey: '2026-11-13',
  previousStreak: 27,
  currentStreak: 28,
  bestStreak: 45,
  xp: 2800,
  totalDays: 28,
  members: [memberA, memberB],
  activity: [
    { userId: A, completed: true },
    { userId: B, completed: true },
  ],
  createdAt: new Date('2026-11-13T17:00:00.000Z'),
};

function expectClean(embed) {
  const json = embed.toJSON();
  const serialized = JSON.stringify(json);
  assert.equal(serialized.includes('undefined'), false, `embed contains "undefined": ${serialized}`);
  assert.equal(serialized.includes('NaN'), false, `embed contains "NaN": ${serialized}`);
  return json;
}

function expectPng(buffer) {
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 10000, 'rendered PNG should contain real artwork');
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
}

test('streak log embed follows the required 666 log format', () => {
  const json = expectClean(streakLogEmbed({ log: streakLog, timezone: 'Asia/Jakarta' }));

  assert.match(json.author.name, /666 DUO STREAK LOGS/);
  assert.match(json.title, /666 DUO STREAK UPDATED/);
  assert.match(json.description, /STREAK INCREASED!/);
  assert.match(json.description, /27 DAYS → 28 DAYS/);
  assert.match(json.description, /Tama completed/);
  assert.match(json.description, /Zen completed/);
  assert.match(json.description, new RegExp(A));
  assert.match(json.description, new RegExp(B));
  assert.match(json.footer.text, /666 SYSTEM/);
  assert.match(json.footer.text, /AUTOMATIC LOGS/);
  assert.ok(json.timestamp);

  const fields = Object.fromEntries(json.fields.map((field) => [field.name, field.value]));
  assert.match(fields['CURRENT STREAK'], /28 DAYS/);
  assert.match(fields['PREVIOUS STREAK'], /27 DAYS/);
  assert.match(fields['BEST STREAK'], /45 DAYS/);
  assert.match(fields['DUO XP'], /2,800 XP/);
  assert.match(fields['ACTIVITY STATUS'], /BOTH MEMBERS ACTIVE/);
});

test('card companion embeds and admin log embeds render cleanly', () => {
  expectClean(profileCardEmbed({
    duo, members: [memberA, memberB], today, timezone: 'Asia/Jakarta',
  }));
  expectClean(leaderboardCardEmbed({
    page: 0, pageCount: 3, total: 23, categoryLabel: 'Current Streak', guildName: '666 Server',
  }));
  expectClean(logStatusEmbed({
    guildConfig: { timezone: 'Asia/Jakarta', logChannelId: '800000000000000001' },
    counts: { sent: 5, pending: 1, failed: 2, skipped: 0 },
    last: { duoName: duo.name, previousStreak: 27, currentStreak: 28, sentAt: new Date() },
    recent: [{ ...streakLog, status: 'sent' }],
    channel: { id: '800000000000000001' },
    timezone: 'Asia/Jakarta',
  }));
  expectClean(logChannelConfiguredEmbed({
    channel: { id: '800000000000000001' },
    guildConfig: { timezone: 'Asia/Jakarta' },
  }));
});

test('all three PNG renderers produce valid artwork without avatars', async () => {
  const profile = await renderProfileCard({
    duo,
    members: [memberA, memberB],
    today,
    nextMilestone: { days: 30, name: 'Elite Duo Badge' },
    timezone: 'Asia/Jakarta',
    avatars: new Map(),
  });
  expectPng(profile);

  const entries = Array.from({ length: 10 }, (_, index) => ({
    duo: {
      ...duo,
      name: `Duo ${index + 1}`,
      currentStreak: 100 - index * 5,
      bestStreak: 120 - index * 4,
      totalDays: 98 - index * 5,
      xp: (100 - index * 5) * 100,
    },
    members: [memberA, memberB],
  }));

  const board = await renderLeaderboardCard({
    entries,
    page: 0,
    pageCount: 3,
    total: 23,
    avatars: new Map(),
  });
  expectPng(board);

  const log = await renderStreakLogCard({
    log: streakLog,
    timezone: 'Asia/Jakarta',
    guildName: '666 Server',
    avatars: new Map(),
  });
  expectPng(log);
});
