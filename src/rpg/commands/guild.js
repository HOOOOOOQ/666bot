'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const guildService = require('../services/guildService');
const { guildEmbed, warEmbed, money } = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, requireArgs } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`tguild create <nama>` — buat guild (biaya koin)',
  '`tguild join <nama|id>` — masuk guild',
  '`tguild leave` — keluar guild',
  '`tguild info` / `tguild members` — profil & anggota',
  '`tguild invite @user` — cara invite',
  '`tguild deposit <koin>` — isi bank guild',
  '`tguild upgrade` — leader upgrade level',
  '`tguild leaderboard` — ranking guild',
  '`tguild war [challenge <guild>|accept <id>|status|leaderboard]`',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'info').toLowerCase();
  if (sub === 'create') {
    requireArgs(ctx.args, 2, 'tguild create <nama>');
    const guild = await guildService.create(ctx.guildId, ctx.userId, ctx.args.slice(1).join(' '));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.success).setTitle('🛡️ GUILD DIBUAT')
      .setDescription(`**${guild.name}** berhasil dibuat.\nLeader: <@${ctx.userId}>\nAjak anggota dengan \`tguild join ${guild.name}\`.`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'join') {
    requireArgs(ctx.args, 2, 'tguild join <nama|id>');
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
    if (!target) throw new UserError('Format: `tguild invite @user`.');
    const data = await guildService.info(ctx.guildId, ctx.userId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('📨 GUILD INVITE')
      .setDescription(`${target} — gabung ke **${data.guild.name}** dengan:\n\`tguild join ${data.guild.name}\``)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'deposit') {
    requireArgs(ctx.args, 2, 'tguild deposit <koin>');
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
      requireArgs(ctx.args, 3, 'tguild war challenge <guild>');
      const result = await guildService.warChallenge(ctx.guildId, ctx.userId, ctx.args.slice(2).join(' '), ctx.message.id);
      return reply(ctx.message, warEmbed(result));
    }
    if (action === 'accept') {
      requireArgs(ctx.args, 3, 'tguild war accept <id>');
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
  throw new UserError('Subcommand guild tidak dikenal. Lihat `tguild help`.');
}

module.exports = { names: ['tguild'], execute, help: HELP };
