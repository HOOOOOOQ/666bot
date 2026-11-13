'use strict';

const { Schema, model } = require('mongoose');

const userStatSchema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    duoId: { type: Schema.Types.ObjectId, default: null },
    username: { type: String, default: null },
    totalActiveDays: { type: Number, default: 0, min: 0 },
    totalMessages: { type: Number, default: 0, min: 0 },
    completedDays: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    duosCount: { type: Number, default: 0, min: 0 },
    lastActiveDay: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

userStatSchema.index({ guildId: 1, userId: 1 }, { unique: true, name: 'uniq_user_stat' });
userStatSchema.index({ guildId: 1, duoId: 1 });

module.exports = model('UserStat', userStatSchema);
