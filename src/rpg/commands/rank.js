'use strict';

const questService = require('../services/questService');
const { progressBar } = require('../../ui/theme');
const { reply } = require('./_helpers');
const { richText } = require('../ui/response');

module.exports = {
  names: ['trank'],
  async execute(ctx) {
    const data = await questService.rank(ctx.guildId, ctx.userId);
    return reply(ctx.message, richText([
      `🏅 **666 RANK** — ${data.rank.emoji} **${data.rank.name}**`,
      `⭐ Level **${data.user.level}** • 📊 Posisi server **#${data.position}**`,
      `✨ EXP **${data.progressLabel}**`,
      progressBar(data.user.xp, data.nextLevelXp, 12),
    ].join('\n')));
  },
  help: ['`trank` — level, rank, EXP, posisi server'],
};
