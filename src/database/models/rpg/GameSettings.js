'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    hunting: { type: Schema.Types.Mixed, default: () => ({}) },
    pets: { type: Schema.Types.Mixed, default: () => ({}) },
    battle: { type: Schema.Types.Mixed, default: () => ({}) },
    minigames: { type: Schema.Types.Mixed, default: () => ({}) },
    market: { type: Schema.Types.Mixed, default: () => ({}) },
    guild: { type: Schema.Types.Mixed, default: () => ({}) },
    worldBoss: { type: Schema.Types.Mixed, default: () => ({}) },
    dropRates: { type: Schema.Types.Mixed, default: () => ({}) },
    version: { type: Number, default: 1 },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'game_settings' },
);

module.exports = model('GameSettings', schema);
