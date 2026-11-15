'use strict';

const { helpView } = require('../ui/help');

const HELP = [
  '`thelp` — buka pusat bantuan interaktif',
  '`thelp <command>` — detail satu command (contoh: `thelp cash`)',
  '`thelp <kategori>` — daftar command per kategori (contoh: `thelp economy`)',
  '`thelp <keyword>` — cari command berdasarkan kata kunci',
  '`/help [command]` — versi slash command',
];

module.exports = {
  names: ['thelp', 'tcommands', 'th', 't?'],
  async execute(ctx) {
    const query = ctx.args.join(' ').trim();
    await ctx.message.reply({
      ...helpView(query || null, ctx.message.client),
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
  help: HELP,
};
