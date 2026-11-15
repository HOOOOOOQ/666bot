'use strict';

const { define, info, ok } = require('./_factory');
const { reply } = require('./_helpers');
const extraService = require('../services/extraService');
const { money } = require('../ui/embeds');
const { UserError } = require('../../utils/errors');

module.exports = [define({
  name: 'lottery', category: 'gambling', aliases: [], description: 'Lottery server: beli tiket, kumpulkan pot, dan menangkan hadiah.',
  usage: '`6lottery [status|buy <tiket>]`', examples: ['6lottery', '6lottery buy 3'], cooldown: '3 detik',
  async execute(ctx) {
    const action = (ctx.args[0] || 'status').toLowerCase();
    if (action === 'buy') {
      const count = Math.max(1, Math.floor(Number(ctx.args[1]) || 1));
      const result = await extraService.buyLottery(ctx.guildId, ctx.userId, count);
      return reply(ctx.message, ok('🎟️ LOTTERY TICKET', `Kamu membeli **${result.tickets} tiket**.\nTotal bayar: ${money(result.total)}\nPot sekarang: **${money(result.round.pot)}**\nEnds: <t:${Math.floor(new Date(result.round.endsAt).getTime() / 1000)}:R>`));
    }
    if (action !== 'status') throw new UserError('Gunakan `6lottery` atau `6lottery buy <tiket>`.');
    const round = await extraService.lotteryStatus(ctx.guildId);
    const mine = await require('../../database/models').LotteryTicket.findOne({ roundId: round._id, userId: ctx.userId }).lean();
    return reply(ctx.message, info('🎟️ 666 LOTTERY',
      `Pot: **${money(round.pot)}**\nTiket terjual: **${round.totalTickets}**\nHarga/tiket: ${money(round.ticketPrice)}\nTiket kamu: **${mine?.count || 0}**\nBerakhir: <t:${Math.floor(new Date(round.endsAt).getTime() / 1000)}:R>\n\nBeli: \`6lottery buy 3\``));
  },
})];
