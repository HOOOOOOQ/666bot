'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    scope: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'game_cooldowns' },
);

schema.index({ guildId: 1, userId: 1, scope: 1 }, { unique: true, name: 'uniq_game_cooldown' });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_game_cooldown' });

module.exports = model('GameCooldown', schema);
