'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    speciesId: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
    shinyCount: { type: Number, default: 0, min: 0 },
    firstCaughtAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false, collection: 'monster_collection' },
);

schema.index({ guildId: 1, userId: 1, speciesId: 1 }, { unique: true, name: 'uniq_monster_collection' });
schema.index({ guildId: 1, userId: 1, count: -1 });

module.exports = model('MonsterCollection', schema);
