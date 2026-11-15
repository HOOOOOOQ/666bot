'use strict';

const questService = require('../services/questService');
const { rankEmbed } = require('../ui/embeds');
const { reply } = require('./_helpers');

module.exports = {
  names: ['trank'],
  async execute(ctx) {
    const data = await questService.rank(ctx.guildId, ctx.userId);
    return reply(ctx.message, rankEmbed(data));
  },
  help: ['`trank` — level, rank, EXP, posisi server'],
};
