'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: null },
    message: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ['open', 'accepted', 'rejected', 'implemented'], default: 'open' },
    response: { type: String, default: null },
    messageId: { type: String, default: null },
    channelId: { type: String, default: null },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'suggestions' },
);

schema.index({ guildId: 1, createdAt: -1 });

module.exports = model('Suggestion', schema);
