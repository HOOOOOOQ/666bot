'use strict';

const questService = require('../services/questService');
const { achievementEmbed } = require('../ui/embeds');
const { reply } = require('./_helpers');

module.exports = {
  names: ['6achievement', '6achievements'],
  async execute(ctx) {
    const items = await questService.achievements(ctx.guildId, ctx.userId);
    return reply(ctx.message, achievementEmbed(items));
  },
  help: ['`6achievement` — daftar badge & progres'],
};
