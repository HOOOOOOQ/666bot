'use strict';

const { helpView } = require('../ui/help');

const HELP = [
  '`6help` — buka pusat bantuan interaktif',
  '`6help <command>` — detail satu command (contoh: `6help cash`)',
  '`6help <kategori>` — daftar command per kategori (contoh: `6help economy`)',
  '`6help <keyword>` — cari command berdasarkan kata kunci',
  '`/help [command]` — versi slash command',
];

module.exports = {
  names: ['6help', '6commands', '6h', '6?'],
  async execute(ctx) {
    const query = ctx.args.join(' ').trim();
    await ctx.message.reply({
      ...helpView(query || null, ctx.message.client),
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
  help: HELP,
};
