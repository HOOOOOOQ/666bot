'use strict';

const { progressBar } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const huntingService = require('../services/huntingService');
const userService = require('../services/userService');
const { monsterListEmbed, collectionEmbed, money } = require('../ui/embeds');
const { huntView } = require('../ui/responseViews');
const { richText, paginationButtons, embed } = require('../ui/response');
const { helpEmbed, reply, resolveMonsterId, requireArgs } = require('./_helpers');
const { formatCoins, xpForLevel } = require('../utils/formulas');

const HELP = [
  '`thunt` — cari monster (cooldown)',
  '`thunt inventory [halaman]` — kandang monster',
  '`thunt collection` — koleksi spesies',
  '`thunt sell <id|all>` — jual monster/duplikat',
  '`thunt stats` — statistik hunting',
  '`thunt leaderboard` — pemburu terbaik',
];

async function stats(ctx) {
  const data = await huntingService.stats(ctx.guildId, ctx.userId);
  const next = xpForLevel(data.user.huntLevel || 1);
  return reply(ctx.message, richText([
    '🗡️ **HUNTING STATS**',
    `${progressBar(data.user.huntXp, next, 12)} **Hunt Level ${data.user.huntLevel}**`,
    `${formatCoins(data.user.huntXp)} / ${formatCoins(next)} XP`,
    '',
    `☠️ Kills: **${formatCoins(data.user.huntKills)}** • 🐾 Kandang: **${data.total}**`,
    `✨ Shiny: **${data.user.shinyCount}** • 🟡 Legendary: **${data.user.legendaryCount}**`,
    `🔴 Mythical: **${data.user.mythicalCount}** • ☠️ Secret: **${data.user.secretCount}**`,
    `📚 Koleksi: **${data.unique}/${data.catalogSize}** unik`,
  ].join('\n')));
}

async function execute(ctx) {
  const sub = (ctx.args[0] || 'start').toLowerCase();
  switch (sub) {
    case 'start':
    case 'hunt':
    case '': {
      const result = await huntingService.hunt(ctx.guildId, ctx.userId, ctx.profile, ctx.message.id);
      return reply(ctx.message, huntView(result, { userId: ctx.userId }));
    }
    case 'inventory':
    case 'inv':
    case 'monsters': {
      const page = Math.max(1, Number(ctx.args[1]) || 1);
      const data = await huntingService.inventory(ctx.guildId, ctx.userId, page, 8);
      return reply(ctx.message, embed(monsterListEmbed(data), data.pages > 1 ? [paginationButtons({ prefix: 'huntinv', ownerId: ctx.userId, page: data.page, pages: data.pages })] : []));
    }
    case 'collection':
    case 'col':
      return reply(ctx.message, collectionEmbed(await huntingService.collection(ctx.guildId, ctx.userId), 'MONSTER'));
    case 'sell': {
      const input = ctx.args[1];
      if (!input) throw new UserError('Format: `thunt sell <id|all>`.');
      if (input === 'all' || input === 'duplicates') {
        const result = await huntingService.sellAllDuplicates(ctx.guildId, ctx.userId);
        return reply(ctx.message, richText(`💱 | Terjual **${result.count}** monster duplikat.\nDiterima: **${money(result.raw)}**`));
      }
      const id = await resolveMonsterId(ctx.guildId, ctx.userId, input);
      const result = await huntingService.sell(ctx.guildId, ctx.userId, id);
      return reply(ctx.message, richText(`💱 | **${result.monster.name}** terjual.\nHarga: ${money(result.gross)} • Pajak: ${money(result.tax)} • Diterima: **${money(result.net)}**`));
    }
    case 'stats':
      return stats(ctx);
    case 'leaderboard':
    case 'lb': {
      const docs = await huntingService.leaderboard(ctx.guildId, 10);
      const lines = docs.map((u, i) => `**#${i + 1}** <@${u.userId}> — ${formatCoins(u.huntKills)} kills • Lv.${u.huntLevel}`);
      return reply(ctx.message, richText(`🏆 **HUNTER LEADERBOARD**\n${lines.join('\n') || 'Belum ada data.'}`));
    }
    case 'help':
      return reply(ctx.message, helpEmbed('666 HUNTING', HELP));
    default:
      throw new UserError(`Subcommand \`${sub}\` tidak dikenal. Lihat \`thunt help\`.`);
  }
}

module.exports = { names: ['thunt'], execute, help: HELP };
