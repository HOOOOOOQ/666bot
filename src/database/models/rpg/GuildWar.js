'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    discordGuildId: { type: String, required: true },
    challengerGuildId: { type: Schema.Types.ObjectId, required: true },
    defenderGuildId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['pending', 'active', 'completed', 'declined', 'expired'], default: 'pending' },
    challengerPoints: { type: Number, default: 0, min: 0 },
    defenderPoints: { type: Number, default: 0, min: 0 },
    winnerGuildId: { type: Schema.Types.ObjectId, default: null },
    season: { type: String, required: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false, collection: 'guild_wars' },
);

schema.index({ discordGuildId: 1, status: 1, createdAt: -1 });
schema.index({ season: 1, status: 1 });

module.exports = model('GuildWar', schema);
