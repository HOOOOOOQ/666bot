'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, default: null },
    userId: { type: String, required: true },
    opponentId: { type: String, default: null },
    game: { type: String, required: true },
    bet: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['pending', 'active', 'completed', 'declined', 'expired'], default: 'active' },
    state: { type: Schema.Types.Mixed, default: () => ({}) },
    choices: { type: Schema.Types.Mixed, default: () => ({}) },
    winnerId: { type: String, default: null },
    payout: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false, collection: 'game_sessions' },
);

schema.index({ guildId: 1, status: 1, createdAt: -1 });
schema.index({ guildId: 1, userId: 1, game: 1, createdAt: -1 });

module.exports = model('GameSession', schema);
