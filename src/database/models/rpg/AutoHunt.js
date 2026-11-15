'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    lastRunAt: { type: Date, default: null },
    totalRuns: { type: Number, default: 0, min: 0 },
    lastResult: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'auto_hunts' },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true, name: 'uniq_auto_hunt' });
schema.index({ enabled: 1, lastRunAt: 1 });

module.exports = model('AutoHunt', schema);
