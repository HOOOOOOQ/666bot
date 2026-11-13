'use strict';

const { Schema, model } = require('mongoose');

const duoRewardSchema = new Schema(
  {
    guildId: { type: String, required: true },
    duoId: { type: Schema.Types.ObjectId, required: true },
    milestone: { type: Number, required: true, min: 1 },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    members: { type: [String], default: [] },
    grantedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

// One badge per milestone per Duo — rewards can never be granted twice.
duoRewardSchema.index({ duoId: 1, milestone: 1 }, { unique: true, name: 'uniq_duo_reward' });
duoRewardSchema.index({ guildId: 1, milestone: 1 });

module.exports = model('DuoReward', duoRewardSchema);
