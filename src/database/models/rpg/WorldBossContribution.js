'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, required: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    damage: { type: Number, default: 0, min: 0 },
    attacks: { type: Number, default: 0, min: 0 },
    rewarded: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false, collection: 'world_boss_contributions' },
);

schema.index({ sessionId: 1, userId: 1 }, { unique: true, name: 'uniq_boss_contribution' });
schema.index({ sessionId: 1, damage: -1 });

module.exports = model('WorldBossContribution', schema);
