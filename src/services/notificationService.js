'use strict';

const { Duo } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const {
  streakCompletedNotification,
  streakBrokenNotification,
  reminderNotification,
  rewardNotification,
  partnerLeftNotification,
} = require('../ui/embeds');

const log = createLogger('notify');

const MAX_QUEUE_SIZE = 500;
const SEND_DELAY_MS = 1200;

let client = null;
let draining = false;
let stopped = false;
const queue = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function init(discordClient) {
  client = discordClient;
  stopped = false;
}

function stop() {
  stopped = true;
}

function getQueueSize() {
  return queue.length;
}

function mentionsFor(duo) {
  const ids = (duo.members || []).map((member) => String(member.userId)).filter(Boolean);
  return { parse: [], users: ids, roles: [] };
}

async function resolveChannel(channelId) {
  if (!client || !channelId) return null;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return null;
    if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) return null;
    return channel;
  } catch {
    return null;
  }
}

async function sendToDuo({ duo, guildConfig, embed, ping = true }) {
  if (!client) return false;
  if (duo?.notificationsEnabled === false) return false;
  if (guildConfig && guildConfig.notificationsEnabled === false) return false;

  const channel = await resolveChannel(guildConfig?.notificationChannelId);
  if (channel) {
    try {
      await channel.send({
        embeds: [embed],
        allowedMentions: ping ? mentionsFor(duo) : { parse: [] },
      });
      return true;
    } catch (error) {
      log.warn(`Failed to send notification to channel ${channel.id}.`, error.message);
    }
  }

  // Fallback: DM both members (only one embed per member, never spam the guild).
  let delivered = false;
  for (const member of duo.members || []) {
    try {
      const user = await client.users.fetch(String(member.userId));
      if (!user) continue;
      await user.send({ embeds: [embed] });
      delivered = true;
    } catch {
      // DMs disabled by the user — ignore silently.
    }
  }
  return delivered;
}

async function drain() {
  if (draining) return;
  draining = true;

  while (queue.length && !stopped) {
    const job = queue.shift();
    try {
      await job();
    } catch (error) {
      log.warn('Notification job failed.', error.message);
    }
    await delay(SEND_DELAY_MS);
  }

  draining = false;
}

function enqueue(job, { force = false } = {}) {
  if (!client) return;
  if (stopped) return;
  if (!force && !config.duo.notificationsEnabled) return;

  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
    log.warn('Notification queue is full, dropping the oldest job.');
  }

  queue.push(job);
  drain().catch((error) => log.error('Notification queue crashed.', error));
}

/**
 * Streak completed notification (both members active).
 */
function notifyStreakCompleted({ duo, streak, rewards = [], guildConfig }) {
  const timezone = guildConfig?.timezone || config.duo.timezone;
  const embed = streakCompletedNotification({ duo, streak, rewards, timezone });
  enqueue(() => sendToDuo({ duo, guildConfig, embed }));
}

function notifyStreakBroken({ duo, lostStreak, guildConfig, reason = 'inactivity' }) {
  const timezone = guildConfig?.timezone || config.duo.timezone;
  const embed = streakBrokenNotification({ duo, lostStreak, timezone, reason });
  enqueue(() => sendToDuo({ duo, guildConfig, embed }));
}

function notifyReward({ duo, reward, guildConfig }) {
  const timezone = guildConfig?.timezone || config.duo.timezone;
  const embed = rewardNotification({ duo, reward, timezone });
  enqueue(() => sendToDuo({ duo, guildConfig, embed }));
}

function notifyPartnerLeft({ duo, leftMember, guildConfig }) {
  const timezone = guildConfig?.timezone || config.duo.timezone;
  const embed = partnerLeftNotification({ duo, leftMember, timezone });
  enqueue(() => sendToDuo({ duo, guildConfig, embed }));
}

/**
 * Daily reminder. The `lastReminderDay` guard is written atomically so a
 * restart or overlapping scheduler tick can never double-send.
 */
async function notifyReminder({ duo, guildConfig, missingMembers, dayKey }) {
  if (!duo) return false;
  if (duo.notificationsEnabled === false) return false;
  if (guildConfig && guildConfig.notificationsEnabled === false) return false;
  if (guildConfig && guildConfig.remindersEnabled === false) return false;

  const claim = await Duo.updateOne(
    { _id: duo._id, status: 'active', lastReminderDay: { $ne: dayKey } },
    { $set: { lastReminderDay: dayKey } },
  ).catch((error) => {
    log.warn('Failed to claim reminder slot.', error.message);
    return null;
  });

  if (!claim) return false;
  const modified = claim.modifiedCount ?? claim.nModified ?? 0;
  if (!modified) return false;

  const timezone = guildConfig?.timezone || config.duo.timezone;
  const embed = reminderNotification({ duo, timezone, missingMembers });
  enqueue(() => sendToDuo({ duo, guildConfig, embed, ping: true }));
  return true;
}

/**
 * Waits until queued notifications are flushed (used on shutdown).
 */
async function flush(timeoutMs = 8000) {
  const startedAt = Date.now();
  while ((queue.length || draining) && Date.now() - startedAt < timeoutMs) {
    await delay(200);
  }
  return queue.length === 0 && !draining;
}

module.exports = {
  init,
  stop,
  flush,
  getQueueSize,
  notifyStreakCompleted,
  notifyStreakBroken,
  notifyReward,
  notifyPartnerLeft,
  notifyReminder,
  _internal: { sendToDuo, drain },
};
