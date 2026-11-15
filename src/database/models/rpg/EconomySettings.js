'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    currencyName: { type: String, default: '666 Coins' },
    startingBalance: { type: Number, default: 500, min: 0 },
    dailyReward: { type: Number, default: 250, min: 0 },
    weeklyReward: { type: Number, default: 1500, min: 0 },
    monthlyReward: { type: Number, default: 6000, min: 0 },
    workMin: { type: Number, default: 50, min: 0 },
    workMax: { type: Number, default: 150, min: 1 },
    workCooldownSec: { type: Number, default: 3600, min: 10 },
    begMin: { type: Number, default: 5, min: 0 },
    begMax: { type: Number, default: 30, min: 1 },
    begCooldownSec: { type: Number, default: 600, min: 10 },
    transferTaxPct: { type: Number, default: 2, min: 0, max: 50 },
    depositLimit: { type: Number, default: 1000000, min: 1 },
    withdrawLimit: { type: Number, default: 1000000, min: 1 },
    maxWallet: { type: Number, default: 100000000, min: 1 },
    taxPct: { type: Number, default: 2, min: 0, max: 50 },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'economy_settings' },
);

module.exports = model('EconomySettings', schema);
