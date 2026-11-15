'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: String, required: true, index: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false, collection: 'lottery_tickets' },
);

schema.index({ roundId: 1, userId: 1 }, { unique: true, name: 'uniq_lottery_ticket' });

module.exports = model('LotteryTicket', schema);
