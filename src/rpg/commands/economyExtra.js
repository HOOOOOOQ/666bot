'use strict';

const { COLORS } = require('../../ui/theme');
const { define, info, ok, fail } = require('./_factory');
const { reply, resolveTarget } = require('./_helpers');
const userService = require('../services/userService');
const extraService = require('../services/extraService');
const settingsService = require('../services/settingsService');
const { formatCoins } = require('../utils/formulas');
const { money } = require('../ui/embeds');
const { UserError } = require('../../utils/errors');

const top = define({
  name: 'top', category: 'rankings', aliases: [], description: 'Leaderboard server untuk wealth, level, hunt, battle, boss, games, atau shards.',
  usage: '`ttop [wealth|level|hunt|battle|boss|games|shards] [limit]`', examples: ['ttop', 'ttop battle 10'],
  cooldown: '3 detik', permissions: 'Everyone',
  async execute(ctx) {
    const category = (ctx.args[0] || 'wealth').toLowerCase();
    const limit = Math.min(25, Math.max(3, Number(ctx.args[1]) || 10));
    const docs = await extraService.top(ctx.guildId, category, limit);
    const lines = docs.map((u, i) => {
      const value = category === 'wealth' || category === 'wallet' ? formatCoins((u.wallet || 0) + (u.bank || 0))
        : category === 'level' ? `Lv ${u.level || 1}` : category === 'battle' ? `${u.battleRating || 1000} ELO`
          : category === 'hunt' ? `${u.huntKills || 0} kill` : category === 'boss' ? `${formatCoins(u.totalBossDamage || 0)} dmg`
            : category === 'games' ? `${u.gameWins || 0} win` : `${u.shards || 0} shard`;
      return `**#${i + 1}** <@${u.userId}> — ${value}`;
    });
    return reply(ctx.message, info(`🏅 TOP ${category.toUpperCase()}`, lines.join('\n') || 'Belum ada data.'));
  },
});

const my = define({
  name: 'my', category: 'rankings', aliases: [], description: 'Ringkasan profil, posisi server, saldo, dan progress level kamu.',
  usage: '`tmy [@user]`', examples: ['tmy', 'tmy @friend'], permissions: 'Everyone',
  async execute(ctx) {
    const target = (await resolveTarget(ctx.message, ctx.args[0]))?.id || ctx.userId;
    const data = await extraService.profileSummary(ctx.guildId, target);
    const user = data.user;
    return reply(ctx.message, info('🏅 MY 666 PROFILE',
      `<@${target}> • ${user.username || 'Player'}\n` +
      `**Level ${user.level || 1}** • Rank #${data.position}\n` +
      `💰 Wallet ${money(user.wallet)} • 🏦 Bank ${money(user.bank)}\n` +
      `🏹 Hunt Lv ${user.huntLevel || 1} • ⚔️ ${user.battleWins || 0}W/${user.battleLosses || 0}L\n` +
      `🎮 ${user.gameWins || 0} game wins • 💎 ${user.shards || 0} shards`));
  },
});

const give = define({
  name: 'give', category: 'economy', aliases: ['transfer'], description: 'Transfer 666 Coins ke member lain dengan tax server dan idempotency.',
  usage: '`tgive @user <jumlah>`', examples: ['tgive @friend 500'], required: ['user', 'amount'], cooldown: '5 detik',
  async execute(ctx) {
    const target = await resolveTarget(ctx.message, ctx.args[0]);
    if (!target) throw new UserError('Tag penerima: `tgive @user <jumlah>`.');
    if (target.bot) throw new UserError('Tidak bisa transfer ke bot.');
    const amount = extraService.assertPositive(ctx.args[1], 'Jumlah');
    const economy = await settingsService.getEconomy(ctx.guildId);
    const result = await userService.transfer(ctx.guildId, ctx.userId, target.id, amount, `give:${ctx.guildId}:${ctx.userId}:${target.id}:${Date.now()}`, economy.transferTaxPct, { command: 'give' });
    return reply(ctx.message, ok('💸 TRANSFER BERHASIL',
      `**${money(amount)}** dikirim ke <@${target.id}>\nTax: ${money(result.tax)} • Diterima: **${money(result.net)}**`));
  },
});

const vote = define({
  name: 'vote', category: 'economy', aliases: [], description: 'Klaim hadiah vote 666 Coins setiap 12 jam.',
  usage: '`tvote`', examples: ['tvote'], cooldown: '12 jam', permissions: 'Everyone',
  async execute(ctx) {
    const result = await extraService.vote(ctx.guildId, ctx.userId);
    return reply(ctx.message, ok('🗳️ VOTE REWARD', `Terima kasih sudah vote! Reward **${money(result.reward)}** masuk ke wallet.\nVote lagi dalam 12 jam.`));
  },
});

const checklist = define({
  name: 'checklist', category: 'economy', aliases: [], description: 'Checklist quest harian dan mingguan beserta progress kamu.',
  usage: '`tchecklist`', examples: ['tchecklist'], cooldown: '3 detik',
  async execute(ctx) {
    const items = await extraService.checklist(ctx.guildId, ctx.userId);
    if (!items.length) return reply(ctx.message, info('✅ CHECKLIST', 'Belum ada quest. Jalankan `tquest` untuk refresh.'));
    const lines = items.map((q) => `${q.claimed ? '✅' : q.completed ? '🎁' : '⬜'} ${q.emoji} **${q.title}** — ${q.progress}/${q.target}${q.completed && !q.claimed ? ' • siap claim!' : ''}`);
    return reply(ctx.message, info('✅ DAILY / WEEKLY CHECKLIST', lines.join('\n')));
  },
});

module.exports = [top, my, give, vote, checklist];
