'use strict';

const { Schema, model } = require('mongoose');

const streakHistorySchema = new Schema(
  {
    guildId: { type: String, required: true },
    duoId: { type: Schema.Types.ObjectId, required: true },
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: {
      type: String,
      required: true,
      enum: ['joined', 'completed', 'broken', 'reward', 'ended', 'milestone'],
    },
    streak: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0 },
    note: { type: String, default: null, maxlength: 200 },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Idempotency: the same event can never be stored twice for the same day.
streakHistorySchema.index(
  { duoId: 1, dayKey: 1, type: 1 },
  { unique: true, name: 'uniq_streak_history_event' },
);
streakHistorySchema.index({ duoId: 1, createdAt: -1 });
streakHistorySchema.index({ guildId: 1, createdAt: -1 });

module.exports = model('StreakHistory', streakHistorySchema);
