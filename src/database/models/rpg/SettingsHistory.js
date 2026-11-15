'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    section: { type: String, required: true },
    actor: { type: String, default: 'dashboard' },
    before: { type: Schema.Types.Mixed, default: () => ({}) },
    after: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false, collection: 'settings_history' },
);

schema.index({ guildId: 1, createdAt: -1 });

module.exports = model('SettingsHistory', schema);
