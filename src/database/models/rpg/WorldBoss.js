'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    rarity: { type: String, default: 'legendary' },
    hp: { type: Number, required: true, min: 1 },
    attack: { type: Number, required: true, min: 0 },
    defense: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
    skills: { type: [String], default: [] },
    rewards: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false, collection: 'world_bosses' },
);

module.exports = model('WorldBoss', schema);
