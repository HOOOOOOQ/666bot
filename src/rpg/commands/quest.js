'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const questService = require('../services/questService');
const { questEmbed, rankEmbed, money } = require('../ui/embeds');
const { helpEmbed, reply } = require('./_helpers');

const HELP = [
  '`6quest` / `6quest list` — quest harian & mingguan',
  '`6quest daily|weekly` — filter',
  '`6quest claim <questId>` — klaim reward',
  '`6achievement` — badge & progres',
  '`6rank` — level, rank, posisi server',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'list').toLowerCase();
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 QUEST', HELP));
  if (sub === 'claim' || sub === 'klaim') {
    if (!ctx.args[1]) throw new UserError('Format: `6quest claim <questId>`.');
    const result = await questService.claim(ctx.guildId, ctx.userId, ctx.args[1]);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🎁 QUEST CLAIMED')
      .setDescription(`${result.quest.emoji} **${result.quest.title}**\nReward: ${money(result.coins)} • ${result.xp} XP`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  const all = await questService.list(ctx.guildId, ctx.userId);
  if (sub === 'daily') return reply(ctx.message, questEmbed(all.filter((q) => q.type === 'daily')));
  if (sub === 'weekly') return reply(ctx.message, questEmbed(all.filter((q) => q.type === 'weekly')));
  return reply(ctx.message, questEmbed(all));
}

module.exports = { names: ['6quest'], execute, help: HELP };
