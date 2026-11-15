'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    questId: { type: String, required: true },
    type: { type: String, enum: ['daily', 'weekly', 'special', 'hidden'], default: 'daily' },
    periodKey: { type: String, required: true },
    progress: { type: Number, default: 0, min: 0 },
    target: { type: Number, required: true, min: 1 },
    claimed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'quests' },
);

schema.index({ guildId: 1, userId: 1, questId: 1, periodKey: 1 }, { unique: true, name: 'uniq_quest_progress' });
schema.index({ guildId: 1, userId: 1, periodKey: 1 });

module.exports = model('Quest', schema);
