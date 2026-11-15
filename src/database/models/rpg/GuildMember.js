'use strict';

const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    guildRef: { type: Schema.Types.ObjectId, required: true },
    discordGuildId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['leader', 'officer', 'member'], default: 'member' },
    contribution: { type: Number, default: 0, min: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false, collection: 'guild_members' },
);

schema.index({ guildRef: 1, userId: 1 }, { unique: true, name: 'uniq_guild_member' });
schema.index({ discordGuildId: 1, userId: 1 }, { unique: true, name: 'uniq_guild_member_guild' });

module.exports = model('GuildMember', schema);
