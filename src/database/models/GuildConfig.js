'use strict';

const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    timezone: { type: String, default: 'Asia/Jakarta' },

    notificationsEnabled: { type: Boolean, default: true },
    remindersEnabled: { type: Boolean, default: true },
    reminderHour: { type: Number, default: 21, min: 0, max: 23 },
    reminderMinute: { type: Number, default: 0, min: 0, max: 59 },
    notificationChannelId: { type: String, default: null },

    /** Channel for automatic 666 DUO STREAK LOGS (null = logs disabled). */
    logChannelId: { type: String, default: null },

    activityCooldownSeconds: { type: Number, default: 60, min: 0, max: 3600 },
    minMessageLength: { type: Number, default: 3, min: 1, max: 50 },
    ignoredChannelIds: { type: [String], default: [] },

    xpPerDay: { type: Number, default: 100, min: 1 },

    /** Guard so the daily reminder is only sent once per server day. */
    lastReminderDay: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    /** Last day the rollover job processed this guild (debug/audit). */
    lastRolloverDay: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true, versionKey: false },
);

module.exports = model('GuildConfig', guildConfigSchema);
