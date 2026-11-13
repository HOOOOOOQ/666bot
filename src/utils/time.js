'use strict';

/**
 * Timezone aware helpers.
 *
 * The whole streak system is built on "day keys": a `YYYY-MM-DD` string that
 * represents a calendar day inside a given IANA timezone. Day keys are stored
 * in MongoDB so the scheduler, activity tracking and history all agree on
 * which day a streak belongs to — even across restarts.
 */

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatterCache = new Map();

function getFormatter(timezone) {
  const tz = timezone || DEFAULT_TIMEZONE;
  let formatter = formatterCache.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(tz, formatter);
  }
  return formatter;
}

function assertValidTimezone(timezone) {
  try {
    getFormatter(timezone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns calendar fields for a Date in the given timezone.
 * @param {Date} [date]
 * @param {string} [timezone]
 */
function getZonedParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = getFormatter(timezone).formatToParts(date);
  const out = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday,
  };
}

/**
 * Converts a wall-clock time in `timezone` to a real UTC Date.
 */
function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timezone = DEFAULT_TIMEZONE) {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = 0;

  // Resolve the timezone offset iteratively (handles DST transitions).
  for (let i = 0; i < 3; i += 1) {
    const candidate = wallTime - offset;
    const parts = getZonedParts(new Date(candidate), timezone);
    const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const nextOffset = asIfUtc - candidate;
    if (nextOffset === offset) break;
    offset = nextOffset;
  }

  return new Date(wallTime - offset);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * `YYYY-MM-DD` for a date inside a timezone.
 */
function getDayKey(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const { year, month, day } = getZonedParts(date, timezone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * UTC instant at which the given local day starts.
 */
function startOfDay(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const { year, month, day } = getZonedParts(date, timezone);
  return zonedTimeToUtc({ year, month, day }, timezone);
}

/**
 * Milliseconds until the next local midnight. Used by the scheduler and tests.
 */
function msUntilNextDay(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const dayKey = getDayKey(date, timezone);
  const nextDayKey = addDaysToKey(dayKey, 1);
  const nextStart = startOfDayKey(nextDayKey, timezone);
  return Math.max(0, nextStart.getTime() - date.getTime());
}

/**
 * UTC instant at which a `YYYY-MM-DD` key starts in a timezone.
 */
function startOfDayKey(dayKey, timezone = DEFAULT_TIMEZONE) {
  const [year, month, day] = String(dayKey).split('-').map(Number);
  return zonedTimeToUtc({ year, month, day }, timezone);
}

/**
 * Inclusive/exclusive UTC range for a day key.
 */
function dayKeyRange(dayKey, timezone = DEFAULT_TIMEZONE) {
  const start = startOfDayKey(dayKey, timezone);
  const next = startOfDayKey(addDaysToKey(dayKey, 1), timezone);
  return { start, end: next };
}

function parseDayKey(dayKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isValidDayKey(dayKey) {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return false;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return date.getUTCFullYear() === parsed.year
    && date.getUTCMonth() === parsed.month - 1
    && date.getUTCDate() === parsed.day;
}

/**
 * Adds (or subtracts) days to a date-only key. Timezone/DST safe.
 */
function addDaysToKey(dayKey, days) {
  const parsed = parseDayKey(dayKey);
  if (!parsed) throw new Error(`Invalid day key: ${dayKey}`);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function previousDayKey(dayKey) {
  return addDaysToKey(dayKey, -1);
}

function compareDayKeys(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return String(a).localeCompare(String(b));
}

function daysBetweenKeys(fromKey, toKey) {
  const from = parseDayKey(fromKey);
  const to = parseDayKey(toKey);
  if (!from || !to) return 0;
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/**
 * Example: `13 Nov 2026`.
 */
function formatDayKey(dayKey, locale = 'id-ID') {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return String(dayKey || '-');
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Discord relative timestamp, e.g. `<t:1730000000:R>`.
 */
function toDiscordTimestamp(date, style = 'R') {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(ms)) return '-';
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

/**
 * Human readable local time, e.g. `13 Nov 2026 21:00`.
 */
function formatLocalDateTime(date, timezone = DEFAULT_TIMEZONE, locale = 'id-ID') {
  const target = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(target);
}

function timezoneOffsetLabel(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(date, timezone);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMinutes = Math.round((asIfUtc - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Safely returns the configured timezone or the default when invalid. */
function normalizeTimezone(timezone) {
  if (!timezone) return DEFAULT_TIMEZONE;
  return assertValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

module.exports = {
  DEFAULT_TIMEZONE,
  MS_PER_DAY,
  getZonedParts,
  zonedTimeToUtc,
  getDayKey,
  startOfDay,
  startOfDayKey,
  msUntilNextDay,
  dayKeyRange,
  parseDayKey,
  isValidDayKey,
  addDaysToKey,
  previousDayKey,
  compareDayKeys,
  daysBetweenKeys,
  formatDayKey,
  formatLocalDateTime,
  toDiscordTimestamp,
  timezoneOffsetLabel,
  normalizeTimezone,
  assertValidTimezone,
};
