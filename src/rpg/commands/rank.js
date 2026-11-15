'use strict';

const questService = require('../services/questService');
const { rankEmbed } = require('../ui/embeds');
const { reply } = require('./_helpers');

module.exports = {
  names: ['6rank'],
  async execute(ctx) {
    const data = await questService.rank(ctx.guildId, ctx.userId);
    return reply(ctx.message, rankEmbed(data));
  },
  help: ['`6rank` — level, rank, EXP, posisi server'],
};
