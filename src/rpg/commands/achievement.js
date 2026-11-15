'use strict';

const questService = require('../services/questService');
const { progressBar } = require('../../ui/theme');
const { reply } = require('./_helpers');
const { richText } = require('../ui/response');

module.exports = {
  names: ['tachievement', 'tachievements'],
  async execute(ctx) {
    const items = await questService.achievements(ctx.guildId, ctx.userId);
    const unlocked = items.filter((a) => a.unlocked);
    const rows = items.map((a) => `${a.unlocked ? '✅' : '🔒'} ${a.emoji} **${a.name}** — ${a.description}`);
    return reply(ctx.message, richText(`🎖️ **ACHIEVEMENTS** ${progressBar(unlocked.length, items.length)} **${unlocked.length}/${items.length}**\n${rows.join('\n')}`.slice(0, 1900)));
  },
  help: ['`tachievement` — daftar badge & progres'],
};
