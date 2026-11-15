'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    challengerId: { type: String, required: true },
    opponentId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'active', 'completed', 'declined', 'expired'], default: 'pending' },
    challengerSnapshot: { type: Schema.Types.Mixed, default: null },
    opponentSnapshot: { type: Schema.Types.Mixed, default: null },
    log: { type: [String], default: [] },
    winnerId: { type: String, default: null },
    loserId: { type: String, default: null },
    reward: { type: Number, default: 0 },
    xpReward: { type: Number, default: 0 },
    idempotencyKey: { type: String, required: true, unique: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'battles' },
);

schema.index({ guildId: 1, status: 1, createdAt: -1 });
schema.index({ guildId: 1, challengerId: 1, opponentId: 1, createdAt: -1 });

module.exports = model('Battle', schema);
