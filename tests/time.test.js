'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../src/utils/time');

test('day keys follow Asia/Jakarta midnight exactly', () => {
  assert.equal(time.getDayKey(new Date('2026-11-13T16:59:59.000Z'), 'Asia/Jakarta'), '2026-11-13');
  assert.equal(time.getDayKey(new Date('2026-11-13T17:00:00.000Z'), 'Asia/Jakarta'), '2026-11-14');
  assert.equal(time.getDayKey(new Date('2026-11-13T00:00:00.000Z'), 'Asia/Jakarta'), '2026-11-13');
});

test('startOfDay returns the local midnight in UTC', () => {
  const start = time.startOfDay(new Date('2026-11-13T16:59:00.000Z'), 'Asia/Jakarta');
  assert.equal(start.toISOString(), '2026-11-12T17:00:00.000Z');
});

test('msUntilNextDay counts down to local midnight', () => {
  const now = new Date('2026-11-13T16:59:00.000Z'); // 23:59 Jakarta
  assert.equal(time.msUntilNextDay(now, 'Asia/Jakarta'), 60_000);

  const noon = new Date('2026-11-13T05:00:00.000Z'); // 12:00 Jakarta
  assert.equal(time.msUntilNextDay(noon, 'Asia/Jakarta'), 12 * 60 * 60 * 1000);
});

test('day key arithmetic survives month, year and leap boundaries', () => {
  assert.equal(time.addDaysToKey('2026-11-13', 1), '2026-11-14');
  assert.equal(time.addDaysToKey('2026-12-31', 1), '2027-01-01');
  assert.equal(time.addDaysToKey('2026-03-01', -1), '2026-02-28');
  assert.equal(time.addDaysToKey('2028-03-01', -1), '2028-02-29');
  assert.equal(time.previousDayKey('2026-01-01'), '2025-12-31');
  assert.equal(time.daysBetweenKeys('2026-11-01', '2026-11-08'), 7);
});

test('day key validation', () => {
  assert.equal(time.isValidDayKey('2026-11-13'), true);
  assert.equal(time.isValidDayKey('2026-02-30'), false);
  assert.equal(time.isValidDayKey('13-11-2026'), false);
});

test('timezone helpers fall back safely', () => {
  assert.equal(time.normalizeTimezone('Not/AZone'), 'Asia/Jakarta');
  assert.equal(time.normalizeTimezone('Asia/Jakarta'), 'Asia/Jakarta');
  assert.equal(time.timezoneOffsetLabel(new Date('2026-11-13T00:00:00.000Z'), 'Asia/Jakarta'), 'UTC+07:00');
});

test('formatDayKey renders a readable date', () => {
  assert.match(time.formatDayKey('2026-11-13'), /2026/);
});

test('other timezones are supported (UTC + New York)', () => {
  assert.equal(time.getDayKey(new Date('2026-11-13T23:30:00.000Z'), 'UTC'), '2026-11-13');
  assert.equal(time.getDayKey(new Date('2026-11-14T02:00:00.000Z'), 'America/New_York'), '2026-11-13');
});
