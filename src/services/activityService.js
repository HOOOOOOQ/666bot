'use strict';

const { DailyActivity, UserStat } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { isDuplicateKeyError } = require('../utils/errors');
const { getDayKey } = require('../utils/time');
const { hasMeaningfulContent, isLowEffortSpam, isUrlOnly } = require('../utils/validators');
const { getGuildConfig, isChannelIgnored } = require('./configService');
const duoService = require('./duoService');
const streakService = require('./streakService');

const log = createLogger('activity');

/** Hot-path caches: zero database queries once a member completed the day. */
const countedDays = new Map(); // `${guildId}:${userId}:${dayKey}` -> expiresAt
const lastMessageByUser = new Map(); // `${guildId}:${userId}` -> { content, at }
const cooldownByUser = new Map(); // `${guildId}:${userId}` -> timestamp

const REPEAT_WINDOW_MS = 30 * 1000;
const MESSAGE_GUARD_TTL_MS = 30 * 60 * 1000;
const IGNORED_PREFIXES = ['!', '/', '.'];

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of countedDays) {
    if (expiresAt <= now) countedDays.delete(key);
  }
  for (const [key, entry] of lastMessageByUser) {
    if (now - entry.at > MESSAGE_GUARD_TTL_MS) lastMessageByUser.delete(key);
  }
  for (const [key, at] of cooldownByUser) {
    if (now - at > 60 * 60 * 1000) cooldownByUser.delete(key);
  }
}, 5 * 60 * 1000);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

function countedKey(guildId, userId, duoId, dayKey) {
  return `${guildId}:${userId}:${duoId}:${dayKey}`;
}

function clearActivityCache() {
  countedDays.clear();
  lastMessageByUser.clear();
  cooldownByUser.clear();
}

/**
 * Validates whether a Discord message can count as daily Duo activity.
 * @returns {{valid: boolean, reason?: string}}
 */
function validateActivityMessage(message, guildConfig) {
  if (!message || !message.author) return { valid: false, reason: 'no_author' };
  if (message.author.bot) return { valid: false, reason: 'bot' };
  if (message.system) return { valid: false, reason: 'system' };
  if (typeof message.inGuild === 'function' && !message.inGuild()) return { valid: false, reason: 'dm' };
  if (!message.guildId) return { valid: false, reason: 'dm' };

  const content = typeof message.content === 'string' ? message.content.trim() : '';
  if (!content) return { valid: false, reason: 'empty' };

  if (IGNORED_PREFIXES.some((prefix) => content.startsWith(prefix))) {
    return { valid: false, reason: 'command_like' };
  }

  if (guildConfig) {
    if (isChannelIgnored(guildConfig, message.channelId)) {
      return { valid: false, reason: 'ignored_channel' };
    }
    if (message.channel?.parentId && isChannelIgnored(guildConfig, message.channel.parentId)) {
      return { valid: false, reason: 'ignored_channel' };
    }
    if (isUrlOnly(content)) return { valid: false, reason: 'url_only' };
    if (!hasMeaningfulContent(content, guildConfig.minMessageLength)) {
      return { valid: false, reason: 'too_short' };
    }
  } else {
    if (isUrlOnly(content)) return { valid: false, reason: 'url_only' };
    if (!hasMeaningfulContent(content, config.duo.minMessageLength)) {
      return { valid: false, reason: 'too_short' };
    }
  }

  if (isLowEffortSpam(content)) return { valid: false, reason: 'spam' };

  return { valid: true };
}

function isRepeatedMessage(guildId, userId, content) {
  const key = `${guildId}:${userId}`;
  const normalized = content.trim().toLowerCase();
  const previous = lastMessageByUser.get(key);
  const now = Date.now();
  lastMessageByUser.set(key, { content: normalized, at: now });
  if (!previous) return false;
  return previous.content === normalized && now - previous.at < REPEAT_WINDOW_MS;
}

/**
 * Records a valid message as daily activity (once per member per day) and
 * triggers the streak check. Never throws to the Discord event loop.
 */
async function handleMessage(message) {
  if (!message?.author || message.author.bot || message.system) {
    return { counted: false, reason: 'ignored_author' };
  }
  if (typeof message.inGuild === 'function' && !message.inGuild()) {
    return { counted: false, reason: 'dm' };
  }

  const guildId = String(message.guildId || message.guild?.id || '');
  const userId = String(message.author.id);
  if (!guildId || !userId) return { counted: false, reason: 'missing_ids' };

  let guildConfig;
  try {
    guildConfig = await getGuildConfig(guildId);
  } catch (error) {
    log.error(`Cannot load config for guild ${guildId}.`, error);
    return { counted: false, reason: 'config_error' };
  }

  const validation = validateActivityMessage(message, guildConfig);
  if (!validation.valid) {
    log.debug(`Message ignored (${validation.reason}) for ${userId}.`);
    return { counted: false, reason: validation.reason };
  }

  const content = message.content.trim();

  // Duo lookup first: users without an active Duo are cheap to skip.
  const duo = await duoService.getActiveDuoForUser(guildId, userId);
  if (!duo) return { counted: false, reason: 'no_duo' };

  const dayKey = getDayKey(new Date(), guildConfig.timezone);
  const cacheKey = countedKey(guildId, userId, duo._id, dayKey);
  if (countedDays.has(cacheKey)) {
    return { counted: false, reason: 'already_counted_today', duo, dayKey };
  }

  if (isRepeatedMessage(guildId, userId, content)) {
    return { counted: false, reason: 'repeated_message', duo, dayKey };
  }

  const cooldownMs = Math.max(0, Number(guildConfig.activityCooldownSeconds) || 0) * 1000;
  const cooldownKey = `${guildId}:${userId}`;
  const lastCountedAt = cooldownByUser.get(cooldownKey) || 0;
  if (cooldownMs > 0 && Date.now() - lastCountedAt < cooldownMs) {
    return { counted: false, reason: 'cooldown', duo, dayKey };
  }

  const now = new Date();

  try {
    await DailyActivity.create({
      guildId,
      duoId: duo._id,
      userId,
      dayKey,
      timezone: guildConfig.timezone,
      channelId: message.channelId || null,
      firstMessageAt: now,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      countedDays.set(cacheKey, Date.now() + 24 * 60 * 60 * 1000);
      return { counted: false, reason: 'already_counted_today', duo, dayKey };
    }
    log.error('Failed to store daily activity.', error);
    return { counted: false, reason: 'database_error' };
  }

  countedDays.set(cacheKey, Date.now() + 24 * 60 * 60 * 1000);
  cooldownByUser.set(cooldownKey, Date.now());

  await UserStat.updateOne(
    { guildId, userId },
    {
      $set: {
        duoId: duo._id,
        username: message.author.username,
        lastActiveDay: dayKey,
        lastActiveAt: now,
      },
      $setOnInsert: { guildId, userId },
      $inc: { totalActiveDays: 1, totalMessages: 1 },
    },
    { upsert: true },
  ).catch((error) => log.warn('Failed to update user activity stats.', error.message));

  const streakResult = await streakService.onActivityRecorded({ duo, guildConfig, dayKey })
    .catch((error) => {
      log.error('Streak evaluation failed.', error);
      return { completed: false, reason: 'error' };
    });

  log.debug(`Activity recorded for ${userId} (${duo.name}) on ${dayKey}.`);

  return { counted: true, duo, dayKey, streak: streakResult };
}

/**
 * Today's activity status for both Duo members (used by profile/streak views).
 */
async function getTodayStatus(duo, timezone, now = new Date()) {
  const dayKey = getDayKey(now, timezone);
  const activities = await DailyActivity.find({ duoId: duo._id, dayKey }).lean();
  const byUser = new Map(activities.map((activity) => [String(activity.userId), activity]));

  const members = (duo.members || []).map((member) => {
    const activity = byUser.get(String(member.userId));
    return {
      member,
      userId: String(member.userId),
      completed: Boolean(activity),
      completedAt: activity?.firstMessageAt || null,
    };
  });

  const completedCount = members.filter((member) => member.completed).length;

  return {
    dayKey,
    members,
    completedCount,
    bothCompleted: completedCount === 2,
    anyCompleted: completedCount > 0,
    missing: members.filter((member) => !member.completed).map((member) => member.member),
  };
}

module.exports = {
  validateActivityMessage,
  handleMessage,
  getTodayStatus,
  clearActivityCache,
  isRepeatedMessage,
  _internal: { countedDays, lastMessageByUser, cooldownByUser },
};
