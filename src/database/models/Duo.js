'use strict';

const { Schema, model } = require('mongoose');

const duoMemberSchema = new Schema(
  {
    userId: { type: String, required: true, match: /^\d{17,20}$/ },
    username: { type: String, required: true, trim: true, maxlength: 64 },
    displayName: { type: String, default: null, trim: true, maxlength: 64 },
    avatar: { type: String, default: null },
  },
  { _id: false },
);

const duoSchema = new Schema(
  {
    guildId: { type: String, required: true, match: /^\d{17,20}$/ },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 32 },

    members: {
      type: [duoMemberSchema],
      validate: {
        validator: (members) => Array.isArray(members) && members.length === 2,
        message: 'A Duo must contain exactly two members.',
      },
    },

    status: { type: String, enum: ['active', 'broken'], default: 'active' },

    currentStreak: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    totalDays: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0, min: 0 },

    /** Last day (`YYYY-MM-DD` in server timezone) both members completed activity. */
    lastCompletedDay: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    /** Last day a reminder notification was sent for this Duo. */
    lastReminderDay: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },

    streakStartedAt: { type: Date, default: null },
    brokenAt: { type: Date, default: null },
    brokenBy: { type: String, default: null },
    breakReason: { type: String, default: null, enum: [null, 'manual', 'partner_left', 'inactivity', 'admin'] },

    notificationsEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
  },
);

// --- Performance indexes used by leaderboards / lookups -------------------
duoSchema.index({ guildId: 1, status: 1, currentStreak: -1 });
duoSchema.index({ guildId: 1, status: 1, bestStreak: -1 });
duoSchema.index({ guildId: 1, status: 1, xp: -1 });
duoSchema.index({ guildId: 1, status: 1, totalDays: -1 });
duoSchema.index({ status: 1, currentStreak: 1, lastCompletedDay: 1 });

// --- Anti duplicate protection -------------------------------------------
// A Discord user can only be part of ONE active Duo per server. Broken duos
// are excluded so members are free to build a new connection later. Scoping by
// guildId keeps the bot correct when it lives in multiple servers.
duoSchema.index(
  { guildId: 1, 'members.userId': 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'uniq_active_duo_member',
  },
);

duoSchema.methods.hasMember = function hasMember(userId) {
  return this.members.some((member) => member.userId === String(userId));
};

duoSchema.methods.getPartner = function getPartner(userId) {
  const id = String(userId);
  return this.members.find((member) => member.userId !== id) || null;
};

duoSchema.statics.findActiveByUser = function findActiveByUser(guildId, userId) {
  return this.findOne({ guildId, status: 'active', 'members.userId': String(userId) });
};

module.exports = model('Duo', duoSchema);
