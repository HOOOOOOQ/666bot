'use strict';

const { UserError } = require('../../utils/errors');
const userService = require('../services/userService');
const settingsService = require('../services/settingsService');
const shopService = require('../services/shopService');
const profileService = require('../services/profileService');
const {
  shopEmbed, money, profileEmbed, inventoryEmbed,
} = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, profileOf, requireArgs } = require('./_helpers');
const {
  balanceView, rewardView, workView, begView, amount: formatAmount,
} = require('../ui/responseViews');
const { richText, leaderboard: leaderboardResponse, paginationButtons, profileCard, embed } = require('../ui/response');
const { rankForLevel, formatCoins } = require('../utils/formulas');

const HELP = [
  '`tcash` — lihat saldo',
  '`tcash daily|weekly|monthly` — klaim reward',
  '`tcash work|beg` — cari koin',
  '`tcash deposit|withdraw <jumlah|all>`',
  '`tcash transfer @user <jumlah>`',
  '`tcash leaderboard [wealth|level|hunt|battle|boss]`',
  '`tcash inventory` — isi tas',
  '`tcash shop` / `tcash buy <id> [qty]` / `tcash sell <id> [qty]`',
  '`tcash history` — riwayat transaksi',
  '`tcash profile [@user]` — kartu profil lengkap',
];

async function showBalance(ctx) {
  const [user, economy] = await Promise.all([
    userService.ensureUser(ctx.guildId, ctx.userId, ctx.profile),
    settingsService.getEconomy(ctx.guildId),
  ]);
  const position = await userService.getPosition(ctx.guildId, ctx.userId, 'wallet', user.wallet || 0);
  return reply(ctx.message, balanceView({ user, economy, rank: rankForLevel(user.level || 1), position }));
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
  const lines = docs.map((doc, index) => `**#${index + 1}** <@${doc.userId}> — ${(labels[category] || labels.wealth)(doc)}`).join('\n') || 'Belum ada data.';
  return reply(ctx.message, leaderboardResponse(`🏆 **LEADERBOARD • ${category.toUpperCase()}**\n${lines}`));
}

async function shop(ctx) {
  return reply(ctx.message, shopEmbed(shopService.list()));
}

async function inventory(ctx) {
  const all = await shopService.inventory(ctx.guildId, ctx.userId);
  const perPage = 8;
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(ctx.args[1]) || 1)));
  const items = all.slice((page - 1) * perPage, page * perPage);
  return reply(ctx.message, embed(inventoryEmbed({ items, page, pages, total: all.length }), pages > 1 ? [paginationButtons({ ownerId: ctx.userId, page, pages })] : []));
}

async function profile(ctx, target) {
  const data = await profileService.profile(ctx.guildId, target.id, profileOf(target));
  return reply(ctx.message, profileCard(profileEmbed(data, profileOf(target).avatar)));
}

async function execute(ctx) {
  const { args } = ctx;
  const sub = (args[0] || '').toLowerCase();
  const economy = sub === 'help' ? null : await settingsService.getEconomy(ctx.guildId);
  if (economy && !economy.enabled) throw new UserError('Economy sedang dinonaktifkan admin.');
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
      return reply(ctx.message, rewardView({ ...result, type: 'Daily', userId: ctx.userId, currency: economy.currencyName }));
    }
    case 'weekly': {
      const result = await userService.claimWeekly(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, rewardView({ ...result, type: 'Weekly', userId: ctx.userId, currency: economy.currencyName }));
    }
    case 'monthly': {
      const result = await userService.claimMonthly(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, rewardView({ ...result, type: 'Monthly', userId: ctx.userId, currency: economy.currencyName }));
    }
    case 'work': {
      const result = await userService.work(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, workView({ ...result, userId: ctx.userId, cooldownSec: economy.workCooldownSec, currency: economy.currencyName }));
    }
    case 'beg': {
      const result = await userService.beg(ctx.guildId, ctx.userId, profile);
      return reply(ctx.message, begView({ ...result, userId: ctx.userId, cooldownSec: economy.begCooldownSec, currency: economy.currencyName }));
    }
    case 'deposit': {
      const input = args[1];
      const user = await userService.ensureUser(ctx.guildId, ctx.userId, profile);
      const amount = input === 'all' ? user.wallet : Number(input);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Format: `tcash deposit <jumlah|all>`.');
      const result = await userService.deposit(ctx.guildId, ctx.userId, amount, `deposit:${ctx.message.id}`);
      return reply(ctx.message, richText(`🏦 | Deposit ${formatAmount(result.amount, economy.currencyName)} berhasil.\n🏦 Bank: ${formatAmount(result.user.bank, economy.currencyName)} • 👛 Wallet: ${formatAmount(result.user.wallet, economy.currencyName)}`));
    }
    case 'withdraw': {
      const input = args[1];
      const user = await userService.ensureUser(ctx.guildId, ctx.userId, profile);
      const amount = input === 'all' ? user.bank : Number(input);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Format: `tcash withdraw <jumlah|all>`.');
      const result = await userService.withdraw(ctx.guildId, ctx.userId, amount, `withdraw:${ctx.message.id}`);
      return reply(ctx.message, richText(`👛 | Withdraw ${formatAmount(result.amount, economy.currencyName)} berhasil.\n👛 Wallet: ${formatAmount(result.user.wallet, economy.currencyName)} • 🏦 Bank: ${formatAmount(result.user.bank, economy.currencyName)}`));
    }
    case 'transfer':
    case 'give': {
      if (!target) throw new UserError('Tag penerima: `tcash transfer @user <jumlah>`.');
      const amount = Number(args[2]);
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Jumlah transfer tidak valid.');
      const result = await userService.transfer(ctx.guildId, ctx.userId, target.id, amount, `transfer:${ctx.message.id}`, undefined, { messageId: ctx.message.id });
      return reply(ctx.message, richText(result.duplicate ? '💸 | Transfer ini sudah diproses sebelumnya (anti double).' : `💸 | Kirim ${formatAmount(amount, economy.currencyName)} ke <@${target.id}>.\nPajak: ${formatAmount(result.tax, economy.currencyName)} • Diterima: ${formatAmount(result.net, economy.currencyName)}\n👛 Wallet kamu: ${formatAmount(result.user.wallet, economy.currencyName)}`));
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
      requireArgs(args, 2, 'tcash buy <itemId> [qty]');
      const result = await shopService.buy(ctx.guildId, ctx.userId, args[1], Number(args[2] || 1));
      return reply(ctx.message, richText(`🛒 | ${result.item.emoji} **${result.item.name}** ×${result.qty}\nTotal: ${formatAmount(result.total, economy.currencyName)}\n👛 Wallet: ${formatAmount(result.user.wallet, economy.currencyName)}`));
    }
    case 'sell': {
      requireArgs(args, 2, 'tcash sell <itemId> [qty]');
      const result = await shopService.sell(ctx.guildId, ctx.userId, args[1], Number(args[2] || 1));
      return reply(ctx.message, richText(`💱 | ${result.item.emoji} **${result.item.name}** ×${result.qty}\nDapat: ${formatAmount(result.total, economy.currencyName)}`));
    }
    case 'history': {
      const docs = await userService.history(ctx.guildId, ctx.userId, 15);
      const lines = docs.map((t) => `\`${new Date(t.createdAt).toISOString().slice(5, 10)}\` ${t.type} • **${t.amount > 0 ? '+' : ''}${formatCoins(t.amount)}** ${t.status === 'completed' ? '✅' : '⏳'}`);
      return reply(ctx.message, richText(`📜 **TRANSACTION HISTORY**\n${lines.join('\n') || 'Belum ada transaksi.'}`));
    }
    case 'profile': {
      if (target) return profile(ctx, target);
      return profile(ctx, { id: ctx.userId, username: ctx.message.author.username, displayAvatarURL: () => ctx.message.author.displayAvatarURL({ extension: 'png', size: 256 }) });
    }
    case 'help':
      return reply(ctx.message, helpEmbed('666 CASH', HELP));
    default:
      throw new UserError(`Subcommand \`${sub}\` tidak dikenal. Lihat \`tcash help\`.`);
  }
}

module.exports = { names: ['tcash', 'teconomy'], execute, help: HELP };
