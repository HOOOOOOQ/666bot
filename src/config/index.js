'use strict';

require('dotenv').config({ quiet: true });

/**
 * Small, dependency-free env helpers.
 */
function envString(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : fallback;
}

function envInt(name, fallback) {
  const raw = envString(name, '');
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name, fallback = false) {
  const raw = envString(name, '').toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

const config = {
  nodeEnv: envString('NODE_ENV', 'production'),
  isProduction: envString('NODE_ENV', 'production') === 'production',

  discord: {
    token: envString('DISCORD_TOKEN'),
    clientId: envString('DISCORD_CLIENT_ID'),
    guildId: envString('GUILD_ID') || null,
    autoDeploy: envBool('AUTO_DEPLOY', true),
  },

  database: {
    uri: envString('MONGODB_URI'),
  },

  duo: {
    timezone: envString('DEFAULT_TIMEZONE', 'Asia/Jakarta'),
    activityCooldownSeconds: Math.max(0, envInt('ACTIVITY_COOLDOWN_SECONDS', 60)),
    minMessageLength: Math.max(1, envInt('MIN_MESSAGE_LENGTH', 3)),
    xpPerDay: Math.max(1, envInt('XP_PER_DAY', 100)),
    reminderHour: Math.min(23, Math.max(0, envInt('REMINDER_HOUR', 21))),
    reminderMinute: Math.min(59, Math.max(0, envInt('REMINDER_MINUTE', 0))),
    notificationsEnabled: envBool('NOTIFICATIONS_ENABLED', true),
    inviteTtlHours: Math.max(1, envInt('INVITE_TTL_HOURS', 24)),
    maxPendingInvites: Math.max(1, envInt('MAX_PENDING_INVITES', 3)),
  },

  api: {
    enabled: envBool('ENABLE_API', true),
    port: Math.min(65535, Math.max(1, envInt('API_PORT', 3000))),
    host: envString('API_HOST', '0.0.0.0'),
    key: envString('API_KEY'),
  },

  logging: {
    level: envString('LOG_LEVEL', 'info').toLowerCase(),
    toFile: envBool('LOG_TO_FILE', false),
  },
};

/**
 * Returns a list of human readable configuration problems.
 * The bot refuses to start when this list is not empty.
 */
function validateConfig() {
  const problems = [];

  if (!config.discord.token) problems.push('DISCORD_TOKEN is missing.');
  if (!config.discord.clientId) problems.push('DISCORD_CLIENT_ID is missing.');
  if (!config.database.uri) problems.push('MONGODB_URI is missing.');

  if (config.discord.token && config.discord.token.split('.').length !== 3) {
    problems.push('DISCORD_TOKEN does not look like a valid bot token.');
  }
  if (config.discord.clientId && !/^\d{17,20}$/.test(config.discord.clientId)) {
    problems.push('DISCORD_CLIENT_ID must be a numeric snowflake (17-20 digits).');
  }
  if (config.database.uri && !/^mongodb(\+srv)?:\/\//.test(config.database.uri)) {
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  if (config.discord.guildId && !/^\d{17,20}$/.test(config.discord.guildId)) {
    problems.push('GUILD_ID must be a numeric snowflake (17-20 digits).');
  }
  if (config.duo.reminderHour < 0 || config.duo.reminderHour > 23) {
    problems.push('REMINDER_HOUR must be between 0 and 23.');
  }

  return problems;
}

module.exports = { config, validateConfig };
