'use strict';

const { Schema, model } = require('mongoose');

/**
 * One document = one member was active on one day (inside a Duo).
 * The unique index is the core anti double-count protection: even if the bot
 * receives 500 messages or restarts mid-day, a day is only ever recorded once.
 */
const dailyActivitySchema = new Schema(
  {
    guildId: { type: String, required: true },
    duoId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timezone: { type: String, required: true },
    channelId: { type: String, default: null },
    firstMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

dailyActivitySchema.index(
  { duoId: 1, userId: 1, dayKey: 1 },
  { unique: true, name: 'uniq_daily_activity' },
);
dailyActivitySchema.index({ duoId: 1, dayKey: 1 });
dailyActivitySchema.index({ userId: 1, dayKey: 1 });
dailyActivitySchema.index({ guildId: 1, dayKey: 1 });

module.exports = model('DailyActivity', dailyActivitySchema);
