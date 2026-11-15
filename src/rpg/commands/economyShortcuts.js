'use strict';

const cash = require('./cash');
const { define } = require('./_factory');
const shopService = require('../services/shopService');

function shortcut(name, sub, description, usage, aliases = [], cooldown = '2 detik') {
  return define({
    name, category: 'economy', aliases, description, usage: `\`${usage}\``, examples: [`${usage.replace(/<[^>]+>/g, '').trim()}`], cooldown,
    async execute(ctx) {
      return cash.execute({ ...ctx, args: [sub, ...ctx.args] });
    },
  });
}

const commands = [
  shortcut('daily', 'daily', 'Klaim reward harian 666 Coins.', 'tdaily', [], '24 jam'),
  shortcut('weekly', 'weekly', 'Klaim reward mingguan.', 'tweekly', [], '7 hari'),
  shortcut('monthly', 'monthly', 'Klaim reward bulanan.', 'tmonthly', [], '30 hari'),
  shortcut('work', 'work', 'Bekerja untuk mendapatkan 666 Coins.', 'twork', [], '1 jam'),
  shortcut('shop', 'shop', 'Tampilkan shop item 666.', 'tshop', ['store']),
  define({
    name: 'buy', category: 'economy', aliases: [], description: 'Beli item dari shop 666.',
    usage: '`tbuy <itemId> [qty]`', examples: ['tbuy bait 3'], cooldown: '2 detik',
    async execute(ctx) {
      if (!ctx.args[0]) return cash.execute({ ...ctx, args: ['shop'] });
      return cash.execute({ ...ctx, args: ['buy', ...ctx.args] });
    },
  }),
];

module.exports = commands;
