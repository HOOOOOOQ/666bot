'use strict';

const { Schema, model } = require('mongoose');

/** Dedicated hunting profile collection (kept in sync with economy_users). */
const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    huntLevel: { type: Number, default: 1, min: 1 },
    huntXp: { type: Number, default: 0, min: 0 },
    kills: { type: Number, default: 0, min: 0 },
    shiny: { type: Number, default: 0, min: 0 },
    legendary: { type: Number, default: 0, min: 0 },
    mythical: { type: Number, default: 0, min: 0 },
    secret: { type: Number, default: 0, min: 0 },
    lastHuntAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'hunting_users' },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true, name: 'uniq_hunting_user' });
schema.index({ guildId: 1, kills: -1 });

module.exports = model('HuntingUser', schema);
