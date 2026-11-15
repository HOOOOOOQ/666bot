'use strict';

const { progressBar } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const questService = require('../services/questService');
const { money } = require('../ui/embeds');
const { helpEmbed, reply } = require('./_helpers');
const { richText } = require('../ui/response');

const HELP = [
  '`tquest` / `tquest list` — quest harian & mingguan',
  '`tquest daily|weekly` — filter',
  '`tquest claim <questId>` — klaim reward',
  '`tachievement` — badge & progres',
  '`trank` — level, rank, posisi server',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'list').toLowerCase();
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 QUEST', HELP));
  if (sub === 'claim' || sub === 'klaim') {
    if (!ctx.args[1]) throw new UserError('Format: `tquest claim <questId>`.');
    const result = await questService.claim(ctx.guildId, ctx.userId, ctx.args[1]);
    return reply(ctx.message, richText(`🎁 **QUEST CLAIMED**\n${result.quest.emoji} **${result.quest.title}**\nReward: ${money(result.coins)} • ${result.xp} XP`));
  }
  const all = await questService.list(ctx.guildId, ctx.userId);
  const selected = sub === 'daily' ? all.filter((q) => q.type === 'daily') : sub === 'weekly' ? all.filter((q) => q.type === 'weekly') : all;
  const render = (q) => `${q.claimed ? '✅' : q.completed ? '🎁' : q.emoji} **${q.title}** — ${progressBar(q.progress, q.target, 8)} ${q.progress}/${q.target}${q.claimed ? ' • claimed' : q.completed ? ' • siap claim' : ''}`;
  return reply(ctx.message, richText(`📜 **666 QUEST** — klaim dengan \`tquest claim <id>\`\n${selected.map(render).join('\n') || 'Belum ada quest.'}`.slice(0, 1900)));
}

module.exports = { names: ['tquest'], execute, help: HELP };
