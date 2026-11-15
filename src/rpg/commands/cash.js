'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS, progressBar } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const userService = require('../services/userService');
const settingsService = require('../services/settingsService');
const shopService = require('../services/shopService');
const profileService = require('../services/profileService');
const {
  cashEmbed, dailyEmbed, shopEmbed, leaderboardEmbed, transactionHistoryEmbed, money, profileEmbed,
} = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, profileOf, requireArgs } = require('./_helpers');
const { rankForLevel } = require('../utils/formulas');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`6cash` — lihat saldo',
  '`6cash daily|weekly|monthly` — klaim reward',
  '`6cash work|beg` — cari koin',
  '`6cash deposit|withdraw <jumlah|all>`',
  '`6cash transfer @user <jumlah>`',
  '`6cash leaderboard [wealth|level|hunt|battle|boss]`',
  '`6cash inventory` — isi tas',
  '`6cash shop` / `6cash buy <id> [qty]` / `6cash sell <id> [qty]`',
  '`6cash history` — riwayat transaksi',
  '`6cash profile [@user]` — kartu profil lengkap',
];

async function showBalance(ctx) {
  const [user, economy] = await Promise.all([
    userService.ensureUser(ctx.guildId, ctx.userId, ctx.profile),
    settingsService.getEconomy(ctx.guildId),
  ]);
  const position = await userService.getPosition(ctx.guildId, ctx.userId, 'wallet', user.wallet || 0);
  return reply(ctx.message, cashEmbed({ user, economy, rank: rankForLevel(user.level || 1), position }));
}

async function leaderboard(ctx, category = 'wealth') {
  const docs = await userService.leaderboard(ctx.guildId, category, 10);
  const labels = {
    wealth: (u) => money((u.wallet || 0) + (u.bank || 0)),
    wallet: (u) => money(u.wallet),
    bank: (u) => money(u.bank),
    level: (u) => `Lv.${u.level} (${formatCoins(u.xp)} XP)`,
    hunt: (u) => `${formatCoins(u.huntKills)} kills`,
    battle: (u) => `${u.battleRating} ELO • ${u.battleWins}W`,
    boss: (u) => `${formatCoins(u.totalBossDamage)} dmg`,
    games: (u) => `${formatCoins(u.gameWins)} wins`,
  };
  return reply(ctx.message, leaderboardEmbed(`🏆 LEADERBOARD • ${category.toUpperCase()}`, docs, labels[category] || labels.wealth));
}

async function shop(ctx) {
  return reply(ctx.message, shopEmbed(shopService.list()));
}

async function inventory(ctx) {
  const items = await shopService.inventory(ctx.guildId, ctx.userId);
  const lines = items.map((i) => `${i.item?.emoji || '📦'} **${i.item?.name || i.itemId}** ×${i.qty} • jual ${formatCoins(i.sellPrice)}`);
  const embed = new EmbedBuilder()
    .setColor(COLORS.ember)
    .setTitle('🎒 666 INVENTORY')
    .setDescription(lines.join('\n') || 'Tas kosong. Beli item dengan `6cash shop`.')
    .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' });
  return reply(ctx.message, embed);
}

async function profile(ctx, target) {
  const data = await profileService.profile(ctx.guildId, target.id, profileOf(target));
  return reply(ctx.message, profileEmbed(data, profileOf(target).avatar));
}

async function execute(ctx) {
  const { args } = ctx;
  const sub = (args[0] || '').toLowerCase();
  const profile = ctx.profile;
  const target = await resolveTarget(ctx.message, args[1]);

  switch (sub) {
    case '':
    case 'balance':
    case 'bal':
    case 'wallet':
      return showBalance(ctx);
    case 'daily': {
      const result = await userService.claimDaily(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, dailyEmbed({ ...result, type: 'Daily' }));
    }
    case 'weekly': {
      const result = await userService.claimWeekly(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, dailyEmbed({ ...result, type: 'Weekly' }));
    }
    case 'monthly': {
      const result = await userService.claimMonthly(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, dailyEmbed({ ...result, type: 'Monthly' }));
    }
    case 'work': {
      const result = await userService.work(ctx.guildId, ctx.userId, profile);
      const embed = new EmbedBuilder().setColor(COLORS.success).setTitle('💼 KERJA')
        .setDescription(`Kamu bekerja dan mendapat **${money(result.reward)}**.\nWallet: ${money(result.user.wallet)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' });
      return reply(ctx.message, embed);
    }
    case 'beg': {
      const result = await userService.beg(ctx.guildId, ctx.userId, profile);
      const embed = new EmbedBuilder().setColor(COLORS.warning).setTitle('🙏 MENGEMIS')
        .setDescription(`Seseorang memberimu **${money(result.reward)}**.\nWallet: ${money(result.user.wallet)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' });
      return reply(ctx.message, embed);
    }
    case 'deposit': {
      const input = args[1];
      const user = await userService.ensureUser(ctx.guildId, ctx.userId, profile);
      const amount = input === 'all' ? user.wallet : Number(input);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Format: `6cash deposit <jumlah|all>`.');
      const result = await userService.deposit(ctx.guildId, ctx.userId, amount, `deposit:${ctx.message.id}`);
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🏦 DEPOSIT')
        .setDescription(`Deposit **${money(result.amount)}** berhasil.\n🏦 Bank: ${money(result.user.bank)} • 👛 Wallet: ${money(result.user.wallet)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    case 'withdraw': {
      const input = args[1];
      const user = await userService.ensureUser(ctx.guildId, ctx.userId, profile);
      const amount = input === 'all' ? user.bank : Number(input);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Format: `6cash withdraw <jumlah|all>`.');
      const result = await userService.withdraw(ctx.guildId, ctx.userId, amount, `withdraw:${ctx.message.id}`);
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('👛 WITHDRAW')
        .setDescription(`Withdraw **${money(result.amount)}** berhasil.\n👛 Wallet: ${money(result.user.wallet)} • 🏦 Bank: ${money(result.user.bank)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    case 'transfer':
    case 'give': {
      if (!target) throw new UserError('Tag penerima: `6cash transfer @user <jumlah>`.');
      const amount = Number(args[2]);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Jumlah transfer tidak valid.');
      const result = await userService.transfer(ctx.guildId, ctx.userId, target.id, amount, `transfer:${ctx.message.id}`, undefined, { messageId: ctx.message.id });
      return reply(ctx.message, new EmbedBuilder().setColor(result.duplicate ? COLORS.warning : COLORS.success).setTitle('💸 TRANSFER')
        .setDescription(result.duplicate ? 'Transfer ini sudah diproses sebelumnya (anti double).' : `Kirim **${money(amount)}** ke <@${target.id}>.\nPajak: ${money(result.tax)} • Diterima: **${money(result.net)}**\nWallet kamu: ${money(result.user.wallet)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    case 'leaderboard':
    case 'lb':
      return leaderboard(ctx, (args[1] || 'wealth').toLowerCase());
    case 'inventory':
    case 'inv':
      return inventory(ctx);
    case 'shop':
      return shop(ctx);
    case 'buy': {
      requireArgs(args, 2, '6cash buy <itemId> [qty]');
      const result = await shopService.buy(ctx.guildId, ctx.userId, args[1], Number(args[2] || 1));
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🛒 PEMBELIAN')
        .setDescription(`${result.item.emoji} **${result.item.name}** ×${result.qty}\nTotal: **${money(result.total)}**\nWallet: ${money(result.user.wallet)}`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    case 'sell': {
      requireArgs(args, 2, '6cash sell <itemId> [qty]');
      const result = await shopService.sell(ctx.guildId, ctx.userId, args[1], Number(args[2] || 1));
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('💱 JUAL ITEM')
        .setDescription(`${result.item.emoji} **${result.item.name}** ×${result.qty}\nDapat: **${money(result.total)}**`)
        .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    case 'history': {
      const docs = await userService.history(ctx.guildId, ctx.userId, 15);
      return reply(ctx.message, transactionHistoryEmbed(docs));
    }
    case 'profile': {
      if (target) return profile(ctx, target);
      return profile(ctx, { id: ctx.userId, username: ctx.message.author.username, displayAvatarURL: () => ctx.message.author.displayAvatarURL({ extension: 'png', size: 256 }) });
    }
    case 'help':
      return reply(ctx.message, helpEmbed('666 CASH', HELP));
    default:
      throw new UserError(`Subcommand \`${sub}\` tidak dikenal. Lihat \`6cash help\`.`);
  }
}

module.exports = { names: ['6cash', '6economy'], execute, help: HELP };
