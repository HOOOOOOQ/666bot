'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    walletAfter: { type: Number, default: null },
    bankAfter: { type: Number, default: null },
    counterpartyId: { type: String, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'reversed'], default: 'completed' },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false, collection: 'economy_transactions' },
);

schema.index({ guildId: 1, userId: 1, createdAt: -1 });
schema.index({ guildId: 1, type: 1, createdAt: -1 });

module.exports = model('EconomyTransaction', schema);
