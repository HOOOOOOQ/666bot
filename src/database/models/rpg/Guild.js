'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    discordGuildId: { type: String, required: true },
    name: { type: String, required: true },
    leaderId: { type: String, required: true },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    memberCount: { type: Number, default: 1, min: 1 },
    maxMembers: { type: Number, default: 50, min: 2 },
    territory: { type: String, default: null },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    warPoints: { type: Number, default: 0, min: 0 },
    season: { type: String, default: null },
    missions: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false, collection: 'guilds' },
);

schema.index({ discordGuildId: 1, name: 1 }, { unique: true, name: 'uniq_guild_name' });
schema.index({ discordGuildId: 1, warPoints: -1 });
schema.index({ discordGuildId: 1, level: -1 });

module.exports = model('Guild', schema);
