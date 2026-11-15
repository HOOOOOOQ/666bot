'use strict';

const { Schema, model } = require('mongoose');

const rpgUserSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: null },
    avatar: { type: String, default: null },

    wallet: { type: Number, default: 0, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },

    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },

    huntLevel: { type: Number, default: 1, min: 1 },
    huntXp: { type: Number, default: 0, min: 0 },
    huntKills: { type: Number, default: 0, min: 0 },
    shinyCount: { type: Number, default: 0, min: 0 },
    legendaryCount: { type: Number, default: 0, min: 0 },
    mythicalCount: { type: Number, default: 0, min: 0 },
    secretCount: { type: Number, default: 0, min: 0 },

    battleWins: { type: Number, default: 0, min: 0 },
    battleLosses: { type: Number, default: 0, min: 0 },
    battleRating: { type: Number, default: 1000, min: 0 },
    battleStreak: { type: Number, default: 0 },

    gameWins: { type: Number, default: 0, min: 0 },
    gameLosses: { type: Number, default: 0, min: 0 },
    totalHunts: { type: Number, default: 0, min: 0 },
    totalBattles: { type: Number, default: 0, min: 0 },
    totalTrades: { type: Number, default: 0, min: 0 },
    totalMarketTrades: { type: Number, default: 0, min: 0 },
    totalBossDamage: { type: Number, default: 0, min: 0 },

    activePetId: { type: Schema.Types.ObjectId, default: null },
    activePetIds: { type: [{ type: Schema.Types.ObjectId }], default: [] },
    rpgGuildId: { type: Schema.Types.ObjectId, default: null, index: true },
    inventory: { type: Schema.Types.Mixed, default: () => ({}) },

    lastDailyDay: { type: String, default: null },
    dailyStreak: { type: Number, default: 0, min: 0 },
    lastWeeklyWeek: { type: String, default: null },
    lastMonthlyMonth: { type: String, default: null },
    lastWorkAt: { type: Date, default: null },
    lastBegAt: { type: Date, default: null },
    lastTransferAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'economy_users' },
);

rpgUserSchema.index({ guildId: 1, userId: 1 }, { unique: true, name: 'uniq_rpg_user' });
rpgUserSchema.index({ guildId: 1, wallet: -1 });
rpgUserSchema.index({ guildId: 1, battleRating: -1 });
rpgUserSchema.index({ guildId: 1, huntLevel: -1 });

module.exports = model('RPGUser', rpgUserSchema);
