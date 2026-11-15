'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    achievementId: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false, collection: 'achievements' },
);

schema.index({ guildId: 1, userId: 1, achievementId: 1 }, { unique: true, name: 'uniq_achievement' });

module.exports = model('Achievement', schema);
