'use strict';

const questService = require('../services/questService');
const { achievementEmbed } = require('../ui/embeds');
const { reply } = require('./_helpers');

module.exports = {
  names: ['tachievement', 'tachievements'],
  async execute(ctx) {
    const items = await questService.achievements(ctx.guildId, ctx.userId);
    return reply(ctx.message, achievementEmbed(items));
  },
  help: ['`tachievement` — daftar badge & progres'],
};
