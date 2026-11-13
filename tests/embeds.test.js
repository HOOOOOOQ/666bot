'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  profileEmbed,
  streakEmbed,
  leaderboardEmbed,
  historyEmbed,
  rewardsEmbed,
  invitationEmbed,
  breakConfirmEmbed,
  breakResultEmbed,
  streakCompletedNotification,
  streakBrokenNotification,
  reminderNotification,
  rewardNotification,
  partnerLeftNotification,
  helpEmbed,
  errorEmbed,
  successEmbed,
  noDuoEmbed,
} = require('../src/ui/embeds');
const { getRewardDefinitions } = require('../src/services/rewardService');

const GUILD = '900000000000000001';
const A = '100000000000000001';
const B = '100000000000000002';

const memberA = {
  userId: A,
  username: 'tama',
  displayName: 'Tama',
  avatar: 'https://cdn.discordapp.com/avatars/100000000000000001/a.png',
};
const memberB = {
  userId: B,
  username: 'zen',
  displayName: 'Zen',
  avatar: 'https://cdn.discordapp.com/avatars/100000000000000002/b.png',
};

const duo = {
  _id: 'a'.repeat(24),
  guildId: GUILD,
  name: 'Tama × Zen',
  status: 'active',
  currentStreak: 28,
  bestStreak: 45,
  totalDays: 28,
  xp: 2800,
  lastCompletedDay: '2026-11-13',
  streakStartedAt: new Date('2026-10-17T02:00:00.000Z'),
  members: [memberA, memberB],
};

const today = {
  dayKey: '2026-11-13',
  members: [
    { member: memberA, userId: A, completed: true, completedAt: new Date() },
    { member: memberB, userId: B, completed: true, completedAt: new Date() },
  ],
  completedCount: 2,
  bothCompleted: true,
  anyCompleted: true,
  missing: [],
};

const rewardDefinitions = getRewardDefinitions().map((reward, index) => ({
  ...reward,
  unlocked: index < 2,
  grantedAt: index < 2 ? new Date() : null,
}));

const rewardSummary = {
  list: rewardDefinitions,
  unlocked: 2,
  total: rewardDefinitions.length,
  highest: rewardDefinitions[1],
};

const nextMilestone = { days: 30, name: 'Elite Duo Badge', emoji: '⚔️' };

function expectClean(embed) {
  const json = embed.toJSON();
  const serialized = JSON.stringify(json);
  assert.equal(serialized.includes('undefined'), false, `embed contains "undefined": ${serialized}`);
  assert.equal(serialized.includes('NaN'), false, `embed contains "NaN": ${serialized}`);
  return json;
}

test('profile card renders all required sections', () => {
  const json = expectClean(profileEmbed({
    duo,
    members: [memberA, memberB],
    today,
    rewardSummary,
    nextMilestone,
    timezone: 'Asia/Jakarta',
  }));

  assert.match(json.author.name, /666 DUO STREAK/);
  assert.equal(json.title, 'Tama × Zen');
  assert.match(json.description, /DUO CONNECTION/);
  assert.match(json.description, /28 DAYS STREAK/);
  assert.match(json.description, /Both members completed today's activity/);
  assert.match(json.description, /BEST STREAK : 45 DAYS/);
  assert.match(json.description, /DUO XP      : 2,800 XP/);
  assert.match(json.footer.text, /666 SYSTEM/);
  assert.ok(json.thumbnail.url.includes('100000000000000002'));
  assert.ok(json.author.icon_url.includes('100000000000000001'));
});

test('streak, rewards and leaderboard cards render', () => {
  expectClean(streakEmbed({ duo, today, nextMilestone, timezone: 'Asia/Jakarta' }));
  expectClean(rewardsEmbed({
    duo,
    rewards: rewardDefinitions,
    highest: rewardSummary.highest,
    nextMilestone,
    timezone: 'Asia/Jakarta',
  }));
  expectClean(leaderboardEmbed({
    entries: [duo],
    page: 0,
    pageSize: 5,
    total: 1,
    categoryLabel: '🔥 Current Streak',
    guildName: '666 Server',
  }));
  expectClean(historyEmbed({
    entries: [
      { type: 'joined', dayKey: '2026-10-01', note: 'Duo created' },
      { type: 'completed', dayKey: '2026-10-02', note: 'Day 1 completed' },
      { type: 'reward', dayKey: '2026-10-08', note: 'Unlocked Rookie Duo Badge' },
      { type: 'broken', dayKey: '2026-10-20', note: 'Missed activity' },
    ],
    page: 0,
    pageSize: 8,
    total: 4,
    duo,
  }));
});

test('invitation, break and help embeds render', () => {
  expectClean(invitationEmbed({
    fromMember: memberA,
    toMember: memberB,
    duoName: 'Tama × Zen',
    expiresAt: new Date(Date.now() + 86_400_000),
    timezone: 'Asia/Jakarta',
  }));
  expectClean(breakConfirmEmbed({ duo, confirmationCode: 'A1B2' }));
  expectClean(breakResultEmbed({ duo: { ...duo, status: 'broken', currentStreak: 0 }, streakLost: 28 }));
  expectClean(helpEmbed());
  expectClean(noDuoEmbed());
  expectClean(errorEmbed('Contoh error'));
  expectClean(successEmbed('Berhasil', 'Contoh sukses'));
});

test('notification embeds render', () => {
  expectClean(streakCompletedNotification({
    duo,
    streak: 28,
    rewards: [rewardDefinitions[0]],
    timezone: 'Asia/Jakarta',
  }));
  expectClean(streakBrokenNotification({ duo, lostStreak: 28, timezone: 'Asia/Jakarta' }));
  expectClean(reminderNotification({
    duo,
    timezone: 'Asia/Jakarta',
    missingMembers: [memberB],
  }));
  expectClean(rewardNotification({ duo, reward: rewardDefinitions[2], timezone: 'Asia/Jakarta' }));
  expectClean(partnerLeftNotification({
    duo,
    leftMember: memberB,
    timezone: 'Asia/Jakarta',
  }));
});

test('progress bars reflect percentages', () => {
  const { progressBar } = require('../src/ui/theme');
  assert.equal(progressBar(0, 10, 10), '▱▱▱▱▱▱▱▱▱▱');
  assert.equal(progressBar(5, 10, 10), '▰▰▰▰▰▱▱▱▱▱');
  assert.equal(progressBar(20, 10, 10), '▰▰▰▰▰▰▰▰▰▰');
});
