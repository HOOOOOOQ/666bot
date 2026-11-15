'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, default: null },
    initiatorId: { type: String, required: true },
    targetId: { type: String, required: true },
    offerA: { type: Schema.Types.Mixed, default: () => ({ coins: 0, items: [] }) },
    offerB: { type: Schema.Types.Mixed, default: () => ({ coins: 0, items: [] }) },
    status: { type: String, enum: ['pending', 'active', 'processing', 'completed', 'declined', 'cancelled', 'expired'], default: 'pending' },
    confirmations: { type: Schema.Types.Mixed, default: () => ({ initiator: false, target: false }) },
    idempotencyKey: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'trade_sessions' },
);

schema.index({ guildId: 1, status: 1, createdAt: -1 });
schema.index({ guildId: 1, initiatorId: 1, targetId: 1, status: 1 });

module.exports = model('TradeSession', schema);
