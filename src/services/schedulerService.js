'use strict';

const { GuildConfig, Duo } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { getDayKey, getZonedParts } = require('../utils/time');
const configService = require('./configService');
const streakService = require('./streakService');
const activityService = require('./activityService');
const notificationService = require('./notificationService');
const logService = require('./logService');

const log = createLogger('scheduler');

const TICK_INTERVAL_MS = 30 * 1000;
const GUILD_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REMINDERS_PER_RUN = 20;

let client = null;
let timer = null;
let startupTimer = null;
let running = false;
let guildCache = { ids: [], expiresAt: 0 };
const dayState = new Map();

async function resolveGuildIds() {
  if (guildCache.expiresAt > Date.now()) return guildCache.ids;

  const ids = new Set(client?.guilds?.cache ? client.guilds.cache.keys() : []);

  try {
    const [configGuilds, duoGuilds] = await Promise.all([
      GuildConfig.find({}).select('guildId').lean(),
      Duo.distinct('guildId'),
    ]);
    for (const entry of configGuilds) ids.add(String(entry.guildId));
    for (const guildId of duoGuilds) ids.add(String(guildId));
  } catch (error) {
    log.error('Failed to resolve guild list for scheduler.', error);
  }

  guildCache = { ids: [...ids], expiresAt: Date.now() + GUILD_CACHE_TTL_MS };
  return guildCache.ids;
}

async function sendDailyReminders(guildId, guildConfig, dayKey, now) {
  const candidates = await Duo.find({
    guildId,
    status: 'active',
    currentStreak: { $gt: 0 },
    lastCompletedDay: { $ne: dayKey },
    notificationsEnabled: { $ne: false },
  })
    .sort({ currentStreak: -1 })
    .limit(MAX_REMINDERS_PER_RUN)
    .lean();

  let sent = 0;
  for (const duo of candidates) {
    try {
      const today = await activityService.getTodayStatus(duo, guildConfig.timezone, now);
      if (today.bothCompleted) continue;
      const delivered = await notificationService.notifyReminder({
        duo,
        guildConfig,
        missingMembers: today.missing,
        dayKey,
      });
      if (delivered) sent += 1;
    } catch (error) {
      log.warn(`Reminder failed for duo ${duo._id}.`, error.message);
    }
  }

  if (sent) log.info(`Sent ${sent} daily reminder(s) in guild ${guildId}.`);
  return sent;
}

function isReminderDue(guildConfig, now) {
  const { hour, minute } = getZonedParts(now, guildConfig.timezone);
  const targetHour = Number(guildConfig.reminderHour ?? config.duo.reminderHour);
  const targetMinute = Number(guildConfig.reminderMinute ?? config.duo.reminderMinute);
  return hour > targetHour || (hour === targetHour && minute >= targetMinute);
}

async function processGuild(guildId, { startup = false } = {}) {
  const guildConfig = await configService.getGuildConfig(guildId);
  if (!guildConfig) return;

  const now = new Date();
  const dayKey = getDayKey(now, guildConfig.timezone);
  const state = dayState.get(guildId);
  const dayChanged = !state || state.dayKey !== dayKey;

  if (dayChanged || startup) {
    const result = await streakService.evaluateGuildRollover({ guildId, guildConfig, now });
    dayState.set(guildId, { dayKey, checkedAt: now });
    if (result.broken) {
      log.info(`Rollover ${guildId}: ${result.broken} streak(s) broke on ${result.lastDayKey}.`);
    }
    await configService.updateGuildConfig(guildId, { lastRolloverDay: dayKey }).catch(() => {});
  }

  if (!guildConfig.notificationsEnabled || guildConfig.remindersEnabled === false) return;

  if (isReminderDue(guildConfig, now) && guildConfig.lastReminderDay !== dayKey) {
    const sent = await sendDailyReminders(guildId, guildConfig, dayKey, now);
    if (sent >= 0) {
      await configService.updateGuildConfig(guildId, { lastReminderDay: dayKey }).catch(() => {});
    }
  }
}

async function tick({ startup = false } = {}) {
  if (!client || running) return;
  running = true;

  try {
    const guildIds = await resolveGuildIds();
    for (const guildId of guildIds) {
      try {
        await processGuild(guildId, { startup });
      } catch (error) {
        log.error(`Scheduler failed for guild ${guildId}.`, error);
      }
    }

    // Durable automatic streak-log queue (also recovers failed sends).
    await logService.retryPending({ limit: 3 }).catch((error) => {
      log.warn('Streak log retry failed.', error.message);
    });
  } catch (error) {
    log.error('Scheduler tick failed.', error);
  } finally {
    running = false;
  }
}

function start(discordClient) {
  client = discordClient;
  if (timer) return;

  // Catch up after downtime (missed rollover / reminders), then tick.
  startupTimer = setTimeout(() => {
    startupTimer = null;
    tick({ startup: true }).catch((error) => log.error('Startup tick failed.', error));
  }, 3000);
  if (typeof startupTimer.unref === 'function') startupTimer.unref();

  timer = setInterval(() => tick().catch((error) => log.error('Scheduler tick failed.', error)), TICK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  log.info(`Daily scheduler started (tick ${TICK_INTERVAL_MS / 1000}s, default TZ ${config.duo.timezone}).`);
}

function stop() {
  if (timer) clearInterval(timer);
  if (startupTimer) clearTimeout(startupTimer);
  timer = null;
  startupTimer = null;
  running = false;
  dayState.clear();
  guildCache = { ids: [], expiresAt: 0 };
  log.info('Daily scheduler stopped.');
}

function invalidateGuildCache() {
  guildCache = { ids: [], expiresAt: 0 };
}

module.exports = {
  start,
  stop,
  tick,
  invalidateGuildCache,
  _internal: { processGuild, sendDailyReminders, isReminderDue, resolveGuildIds },
};
