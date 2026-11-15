'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    speciesId: { type: String, required: true },
    name: { type: String, required: true },
    rarity: { type: String, required: true },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },
    hp: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    speed: { type: Number, required: true },
    skill: { type: String, default: null },
    evolved: { type: Boolean, default: false },
    image: { type: String, default: null },
    lockedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'pets' },
);

schema.index({ guildId: 1, userId: 1, createdAt: -1 });
schema.index({ guildId: 1, userId: 1, lockedBy: 1 });

module.exports = model('Pet', schema);
