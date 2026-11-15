'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    sellerId: { type: String, required: true },
    buyerId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    itemType: { type: String, required: true },
    itemId: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false, collection: 'market_transactions' },
);

schema.index({ guildId: 1, createdAt: -1 });

module.exports = model('MarketTransaction', schema);
