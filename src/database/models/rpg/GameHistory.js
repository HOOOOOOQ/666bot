'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    opponentId: { type: String, default: null },
    game: { type: String, required: true },
    bet: { type: Number, default: 0, min: 0 },
    won: { type: Boolean, default: false },
    payout: { type: Number, default: 0 },
    details: { type: Schema.Types.Mixed, default: () => ({}) },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false, collection: 'game_history' },
);

schema.index({ guildId: 1, game: 1, won: 1, createdAt: -1 });
schema.index({ guildId: 1, userId: 1, createdAt: -1 });

module.exports = model('GameHistory', schema);
