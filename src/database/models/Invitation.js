'use strict';

const { Schema, model } = require('mongoose');

const invitationSchema = new Schema(
  {
    guildId: { type: String, required: true },
    fromUserId: { type: String, required: true },
    toUserId: { type: String, required: true },
    fromUsername: { type: String, default: null },
    toUsername: { type: String, default: null },
    fromDisplayName: { type: String, default: null },
    toDisplayName: { type: String, default: null },
    duoName: { type: String, required: true, maxlength: 32 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Only ONE pending invitation per (guild, from, to) pair.
invitationSchema.index(
  { guildId: 1, fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'uniq_pending_invitation' },
);

// Fast lookup for `/duo accept` + `/duo decline`.
invitationSchema.index({ guildId: 1, toUserId: 1, status: 1, createdAt: -1 });
// Rate limit helper.
invitationSchema.index({ guildId: 1, fromUserId: 1, createdAt: -1 });
// Automatic cleanup of expired pending invitations (partial TTL index).
invitationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' }, name: 'ttl_pending_invitation' },
);

module.exports = model('Invitation', invitationSchema);
