'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const marketService = require('../services/marketService');
const tradeService = require('../services/tradeService');
const { marketEmbed, tradeEmbed, money, tradeButtons } = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, resolveMonsterId, resolvePetId, resolveListingId, requireArgs } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const TRADE_HELP = [
  '`6trade @user [koin]` — mulai trade',
  '`6trade offer <id> coins <n> monster <id> pet <id> item <id> <qty>`',
  '`6trade accept <id>` / `6trade decline <id>`',
  '`6trade confirm <id>` — kedua pihak wajib confirm',
  '`6trade cancel <id>` / `6trade status <id>`',
];
const MARKET_HELP = [
  '`6market` / `6market list [halaman]` — listing aktif',
  '`6market sell <monster|pet|item|egg> <id> <harga>`',
  '`6market buy <listingId>`',
  '`6market cancel <listingId>`',
  '`6market mine` / `6market history`',
];

async function parseOffer(guildId, userId, args) {
  const offer = { coins: 0, monsters: [], pets: [], items: [] };
  for (let i = 0; i < args.length; i += 1) {
    const key = String(args[i] || '').toLowerCase();
    if (key === 'coins' || key === 'coin') {
      offer.coins = Math.max(0, Math.floor(Number(args[i + 1]) || 0));
      i += 1;
    } else if (key === 'monster' || key === 'monsters') {
      offer.monsters.push(await resolveMonsterId(guildId, userId, args[i + 1]));
      i += 1;
    } else if (key === 'pet' || key === 'pets') {
      offer.pets.push(await resolvePetId(guildId, userId, args[i + 1]));
      i += 1;
    } else if (key === 'item') {
      offer.items.push({ id: args[i + 1], qty: Math.max(1, Number(args[i + 2]) || 1) });
      i += 2;
    }
  }
  return offer;
}

async function tradeCommand(ctx) {
  const sub = (ctx.args[0] || '').toLowerCase();
  if (!sub || sub === 'help') return reply(ctx.message, helpEmbed('666 TRADE', TRADE_HELP));
  if (sub === 'accept' || sub === 'decline') {
    if (!ctx.args[1]) throw new UserError(`Format: \`6trade ${sub} <tradeId>\`.`);
    const trade = await tradeService.respond(ctx.guildId, ctx.userId, ctx.args[1], sub === 'accept');
    return reply(ctx.message, tradeEmbed(trade, `<@${trade.initiatorId}>`, `<@${trade.targetId}>`), trade.status === 'active' ? [tradeButtons(String(trade._id), false)] : []);
  }
  if (sub === 'confirm') {
    if (!ctx.args[1]) throw new UserError('Format: `6trade confirm <tradeId>`.');
    const result = await tradeService.confirm(ctx.guildId, ctx.userId, ctx.args[1]);
    const embed = new EmbedBuilder().setColor(result.waiting ? COLORS.warning : COLORS.success).setTitle(result.waiting ? '🤝 MENUNGGU CONFIRM' : '✅ TRADE SELESAI')
      .setDescription(result.waiting ? 'Konfirmasi kamu tercatat. Menunggu pihak lain confirm.' : 'Trade berhasil. Item dan koin sudah dipindahkan dengan aman.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' });
    return reply(ctx.message, embed);
  }
  if (sub === 'cancel') {
    if (!ctx.args[1]) throw new UserError('Format: `6trade cancel <tradeId>`.');
    await tradeService.cancel(ctx.guildId, ctx.userId, ctx.args[1]);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ash).setTitle('✖️ TRADE DIBATALKAN').setDescription('Semua item dikembalikan ke pemilik.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'offer') {
    if (!ctx.args[1]) throw new UserError('Format: `6trade offer <id> coins <n> monster <id>`');
    const offer = await parseOffer(ctx.guildId, ctx.userId, ctx.args.slice(2));
    const trade = await tradeService.setOffer(ctx.guildId, ctx.userId, ctx.args[1], offer);
    return reply(ctx.message, tradeEmbed(trade, `<@${trade.initiatorId}>`, `<@${trade.targetId}>`), [tradeButtons(String(trade._id), false)]);
  }
  if (sub === 'status') {
    if (!ctx.args[1]) throw new UserError('Format: `6trade status <tradeId>`.');
    const trade = await tradeService.get(ctx.guildId, ctx.args[1]);
    if (!trade) throw new UserError('Trade tidak ditemukan.');
    return reply(ctx.message, tradeEmbed(trade, `<@${trade.initiatorId}>`, `<@${trade.targetId}>`));
  }
  const target = await resolveTarget(ctx.message, ctx.args[0]);
  if (!target) throw new UserError('Format: `6trade @user [koin]` atau `6trade help`.');
  const coins = Math.max(0, Math.floor(Number(ctx.args[1]) || 0));
  const trade = await tradeService.create(ctx.guildId, ctx.userId, target.id, { coins }, ctx.message.channelId, ctx.message.id);
  return reply(ctx.message, tradeEmbed(trade, `<@${trade.initiatorId}>`, `<@${trade.targetId}>`), [tradeButtons(String(trade._id))]);
}

async function marketCommand(ctx) {
  const sub = (ctx.args[0] || 'list').toLowerCase();
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 MARKET', MARKET_HELP));
  if (sub === 'sell') {
    requireArgs(ctx.args, 4, '6market sell <monster|pet|item|egg> <id> <harga>');
    const [type, rawId, price] = ctx.args.slice(1);
    let id = rawId;
    if (type === 'monster') id = await resolveMonsterId(ctx.guildId, ctx.userId, rawId);
    if (type === 'pet') id = await resolvePetId(ctx.guildId, ctx.userId, rawId);
    const listing = await marketService.createListing(ctx.guildId, ctx.userId, type, id, Number(price));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🏪 LISTING DIBUAT')
      .setDescription(`\`${String(listing._id).slice(-6)}\` **${listing.itemSnapshot.name || listing.itemId}**\nHarga: **${money(listing.price)}** • Fee: ${money(listing.fee)}\nBerakhir: <t:${Math.floor(new Date(listing.expiresAt).getTime() / 1000)}:R>`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'buy') {
    if (!ctx.args[1]) throw new UserError('Format: `6market buy <listingId>`.');
    const listingId = await resolveListingId(ctx.guildId, ctx.userId, ctx.args[1]);
    const result = await marketService.buy(ctx.guildId, ctx.userId, listingId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('✅ PEMBELIAN MARKET')
      .setDescription(`**${result.listing.itemSnapshot?.name || result.listing.itemId}** berhasil dibeli.\nHarga: ${money(result.price)} • Pajak: ${money(result.tax)}`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'cancel') {
    if (!ctx.args[1]) throw new UserError('Format: `6market cancel <listingId>`.');
    const listingId = await resolveListingId(ctx.guildId, ctx.userId, ctx.args[1]);
    await marketService.cancel(ctx.guildId, ctx.userId, listingId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ash).setTitle('✖️ LISTING DIBATALKAN').setDescription('Item dikembalikan ke inventory.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'mine') {
    const docs = await marketService.myListings(ctx.guildId, ctx.userId);
    const lines = docs.map((l) => `\`${String(l._id).slice(-6)}\` ${l.itemSnapshot?.name || l.itemId} — ${money(l.price)} • ${l.status}`);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🏪 LISTING KAMU').setDescription(lines.join('\n') || 'Belum ada listing.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'history') {
    const docs = await marketService.history(ctx.guildId, ctx.userId);
    const lines = docs.map((t) => `${t.buyerId === ctx.userId ? '🛒 beli' : '💱 jual'} ${t.itemType} • ${money(t.amount)}`);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('📜 MARKET HISTORY').setDescription(lines.join('\n') || 'Belum ada transaksi.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  const page = Math.max(1, Number(ctx.args[1]) || 1);
  return reply(ctx.message, marketEmbed(await marketService.list(ctx.guildId, 10, page)));
}

module.exports = [
  { names: ['6trade'], execute: tradeCommand, help: TRADE_HELP },
  { names: ['6market', '6shopmarket'], execute: marketCommand, help: MARKET_HELP },
];
