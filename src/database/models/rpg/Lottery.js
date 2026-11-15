'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    roundKey: { type: String, required: true },
    status: { type: String, enum: ['open', 'drawing', 'drawn'], default: 'open', index: true },
    ticketPrice: { type: Number, default: 100, min: 1 },
    pot: { type: Number, default: 0, min: 0 },
    tickets: { type: [{ userId: String, count: Number }], default: [] },
    totalTickets: { type: Number, default: 0, min: 0 },
    winnerId: { type: String, default: null },
    winningTicket: { type: Number, default: null },
    endsAt: { type: Date, required: true, index: true },
    drawnAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'lottery_rounds' },
);

schema.index({ guildId: 1, roundKey: 1 }, { unique: true, name: 'uniq_lottery_round' });
schema.index({ status: 1, endsAt: 1 });

module.exports = model('Lottery', schema);
