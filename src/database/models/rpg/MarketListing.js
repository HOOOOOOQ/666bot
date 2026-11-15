'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true },
    sellerId: { type: String, required: true },
    itemType: { type: String, enum: ['monster', 'pet', 'item', 'egg'], required: true },
    itemId: { type: String, required: true },
    itemSnapshot: { type: Schema.Types.Mixed, default: () => ({}) },
    price: { type: Number, required: true, min: 1 },
    fee: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'sold', 'cancelled', 'expired'], default: 'active' },
    buyerId: { type: String, default: null },
    lockedBy: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'market_listings' },
);

schema.index({ guildId: 1, status: 1, createdAt: -1 });
schema.index({ guildId: 1, sellerId: 1, status: 1 });
schema.index({ guildId: 1, itemType: 1, itemId: 1 });

module.exports = model('MarketListing', schema);
