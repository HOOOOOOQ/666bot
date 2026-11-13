'use strict';

const { GuildConfig } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { normalizeTimezone } = require('../utils/time');
const { UserError } = require('../utils/errors');

const log = createLogger('config');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function defaultConfig(guildId) {
  return {
    guildId,
    timezone: normalizeTimezone(config.duo.timezone),
    notificationsEnabled: config.duo.notificationsEnabled,
    remindersEnabled: true,
    reminderHour: config.duo.reminderHour,
    reminderMinute: config.duo.reminderMinute,
    notificationChannelId: null,
    activityCooldownSeconds: config.duo.activityCooldownSeconds,
    minMessageLength: config.duo.minMessageLength,
    ignoredChannelIds: [],
    xpPerDay: config.duo.xpPerDay,
    lastReminderDay: null,
    lastRolloverDay: null,
  };
}

function normalizeConfig(doc, guildId) {
  const base = defaultConfig(guildId);
  if (!doc) return base;
  return {
    ...base,
    ...doc,
    timezone: normalizeTimezone(doc.timezone || base.timezone),
    ignoredChannelIds: Array.isArray(doc.ignoredChannelIds) ? doc.ignoredChannelIds.map(String) : [],
  };
}

function cacheConfig(cfg) {
  cache.set(String(cfg.guildId), { value: cfg, expiresAt: Date.now() + CACHE_TTL_MS });
  return cfg;
}

/**
 * Guild configuration with a small memory cache (hot path: every message).
 * @param {string} guildId
 * @param {{fresh?: boolean}} [options]
 */
async function getGuildConfig(guildId, { fresh = false } = {}) {
  const id = String(guildId);
  if (!fresh) {
    const cached = cache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
  }

  let doc = null;
  try {
    doc = await GuildConfig.findOne({ guildId: id }).lean();
  } catch (error) {
    log.error(`Failed to load guild config for ${id}. Using defaults.`, error);
    return defaultConfig(id);
  }

  if (!doc) {
    // Create the document so server settings persist and can be tuned later.
    try {
      const created = await GuildConfig.create(defaultConfig(id));
      doc = created.toObject ? created.toObject() : created;
    } catch (error) {
      if (error?.code !== 11000) log.warn(`Could not create guild config for ${id}.`, error.message);
      doc = await GuildConfig.findOne({ guildId: id }).lean().catch(() => null);
    }
  }

  return cacheConfig(normalizeConfig(doc, id));
}

const EDITABLE_FIELDS = new Set([
  'timezone',
  'notificationsEnabled',
  'remindersEnabled',
  'reminderHour',
  'reminderMinute',
  'notificationChannelId',
  'activityCooldownSeconds',
  'minMessageLength',
  'ignoredChannelIds',
  'xpPerDay',
  'lastReminderDay',
  'lastRolloverDay',
]);

/**
 * Updates guild settings (used by the scheduler + future admin commands).
 */
async function updateGuildConfig(guildId, patch = {}) {
  const id = String(guildId);
  const update = {};

  for (const [key, value] of Object.entries(patch)) {
    if (!EDITABLE_FIELDS.has(key)) continue;
    if (key === 'timezone') update.timezone = normalizeTimezone(value);
    else if (typeof value === 'number') update[key] = Math.max(0, Math.trunc(value));
    else update[key] = value;
  }

  if (!Object.keys(update).length) return getGuildConfig(id);

  const doc = await GuildConfig.findOneAndUpdate(
    { guildId: id },
    { $set: update, $setOnInsert: { guildId: id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  cache.delete(id);
  return normalizeConfig(doc, id);
}

function invalidateGuildConfig(guildId) {
  cache.delete(String(guildId));
}

function clearConfigCache() {
  cache.clear();
}

function isChannelIgnored(guildConfig, channelId) {
  if (!guildConfig || !channelId) return false;
  return (guildConfig.ignoredChannelIds || []).includes(String(channelId));
}

/**
 * Validates settings coming from a user (future admin command / API).
 */
function assertValidTimezone(timezone) {
  if (!timezone || normalizeTimezone(timezone) !== timezone) {
    throw new UserError(`Timezone \`${timezone}\` tidak valid. Gunakan format IANA, contoh: Asia/Jakarta.`);
  }
  return timezone;
}

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  invalidateGuildConfig,
  clearConfigCache,
  isChannelIgnored,
  assertValidTimezone,
  defaultConfig,
  CACHE_TTL_MS,
};
