'use strict';

const { Schema, model } = require('mongoose');

const logMemberSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: 'Unknown' },
    displayName: { type: String, default: null },
    avatar: { type: String, default: null },
  },
  { _id: false },
);

const logActivitySchema = new Schema(
  {
    userId: { type: String, required: true },
    completed: { type: Boolean, default: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * One row per (duo, dayKey) where the streak actually increased.
 *
 * The unique index is the hard guarantee that a day can never be logged twice —
 * even if two gateway events race, the bot restarts, or a delivery is retried.
 */
const streakLogSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    duoId: { type: Schema.Types.ObjectId, ref: 'Duo', required: true },
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    channelId: { type: String, default: null },

    duoName: { type: String, default: null },
    members: { type: [logMemberSchema], default: [] },
    activity: { type: [logActivitySchema], default: [] },

    previousStreak: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0, min: 0 },
    totalDays: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, default: null },
    messageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Exactly one log per duo per completed day.
streakLogSchema.index({ duoId: 1, dayKey: 1 }, { unique: true, name: 'uniq_duo_day_log' });

// Retry queue + status views.
streakLogSchema.index({ status: 1, nextAttemptAt: 1 });
streakLogSchema.index({ guildId: 1, createdAt: -1 });
streakLogSchema.index({ duoId: 1, createdAt: -1 });

module.exports = model('StreakLog', streakLogSchema);
