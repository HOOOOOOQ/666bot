'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const guildService = require('../services/guildService');
const { guildEmbed, warEmbed, money } = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, requireArgs } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`6guild create <nama>` — buat guild (biaya koin)',
  '`6guild join <nama|id>` — masuk guild',
  '`6guild leave` — keluar guild',
  '`6guild info` / `6guild members` — profil & anggota',
  '`6guild invite @user` — cara invite',
  '`6guild deposit <koin>` — isi bank guild',
  '`6guild upgrade` — leader upgrade level',
  '`6guild leaderboard` — ranking guild',
  '`6guild war [challenge <guild>|accept <id>|status|leaderboard]`',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'info').toLowerCase();
  if (sub === 'create') {
    requireArgs(ctx.args, 2, '6guild create <nama>');
    const guild = await guildService.create(ctx.guildId, ctx.userId, ctx.args.slice(1).join(' '));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🛡️ GUILD DIBUAT')
      .setDescription(`**${guild.name}** berhasil dibuat.\nLeader: <@${ctx.userId}>\nAjak anggota dengan \`6guild join ${guild.name}\`.`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'join') {
    requireArgs(ctx.args, 2, '6guild join <nama|id>');
    const guild = await guildService.join(ctx.guildId, ctx.userId, ctx.args.slice(1).join(' '));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🛡️ JOIN GUILD')
      .setDescription(`Kamu bergabung dengan **${guild.name}**.`).setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'leave') {
    const guild = await guildService.leave(ctx.guildId, ctx.userId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ash).setTitle('🛡️ LEAVE GUILD')
      .setDescription(`Kamu keluar dari **${guild?.name || 'guild'}**.`).setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'info' || sub === 'members') {
    const data = await guildService.info(ctx.guildId, ctx.userId);
    return reply(ctx.message, guildEmbed(data));
  }
  if (sub === 'invite') {
    const target = await resolveTarget(ctx.message, ctx.args[1]);
    if (!target) throw new UserError('Format: `6guild invite @user`.');
    const data = await guildService.info(ctx.guildId, ctx.userId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('📨 GUILD INVITE')
      .setDescription(`${target} — gabung ke **${data.guild.name}** dengan:\n\`6guild join ${data.guild.name}\``)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'deposit') {
    requireArgs(ctx.args, 2, '6guild deposit <koin>');
    const result = await guildService.deposit(ctx.guildId, ctx.userId, Number(ctx.args[1]));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🏦 GUILD DEPOSIT')
      .setDescription(`Deposit **${money(result.amount)}** ke bank guild berhasil.`).setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'upgrade') {
    const result = await guildService.upgrade(ctx.guildId, ctx.userId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🛡️ GUILD UPGRADE')
      .setDescription(`Guild naik ke **level ${result.guild.level}**!\nBiaya: ${money(result.cost)} • Max member +5`).setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'leaderboard' || sub === 'lb') {
    const docs = await guildService.leaderboard(ctx.guildId, 10);
    const lines = docs.map((g, i) => `**#${i + 1}** **${g.name}** — Lv.${g.level} • ${g.warPoints} war pts • bank ${formatCoins(g.bank)}`);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🏆 GUILD LEADERBOARD')
      .setDescription(lines.join('\n') || 'Belum ada guild.').setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'war') {
    const action = (ctx.args[1] || 'status').toLowerCase();
    if (action === 'challenge') {
      requireArgs(ctx.args, 3, '6guild war challenge <guild>');
      const result = await guildService.warChallenge(ctx.guildId, ctx.userId, ctx.args.slice(2).join(' '), ctx.message.id);
      return reply(ctx.message, warEmbed(result));
    }
    if (action === 'accept') {
      requireArgs(ctx.args, 3, '6guild war accept <id>');
      const war = await guildService.warAccept(ctx.guildId, ctx.userId, ctx.args[2]);
      return reply(ctx.message, warEmbed({ war }));
    }
    if (action === 'leaderboard' || action === 'lb') {
      const docs = await guildService.warLeaderboard(ctx.guildId, 10);
      const lines = docs.map((g, i) => `**#${i + 1}** **${g.name}** — ${g.warPoints} pts • ${g.wins}W/${g.losses}L`);
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.blood).setTitle('⚔️ GUILD WAR LEADERBOARD')
        .setDescription(lines.join('\n') || 'Belum ada data.').setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
    }
    const data = await guildService.warStatus(ctx.guildId, ctx.userId);
    return reply(ctx.message, warEmbed(data));
  }
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 GUILD', HELP));
  throw new UserError('Subcommand guild tidak dikenal. Lihat `6guild help`.');
}

module.exports = { names: ['6guild'], execute, help: HELP };
