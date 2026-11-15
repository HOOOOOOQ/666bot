'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    bossKey: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: null },
    hpMax: { type: Number, required: true, min: 1 },
    hp: { type: Number, required: true, min: 0 },
    attack: { type: Number, default: 0, min: 0 },
    defense: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: ['active', 'defeated', 'expired'], default: 'active' },
    spawnedAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    defeatedAt: { type: Date, default: null },
    rewardsGranted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, collection: 'world_boss_sessions' },
);

schema.index({ guildId: 1, status: 1 });
schema.index(
  { guildId: 1, status: 1 },
  { unique: true, name: 'uniq_active_world_boss', partialFilterExpression: { status: 'active' } },
);

module.exports = model('WorldBossSession', schema);
