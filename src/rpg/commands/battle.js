'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const battleService = require('../services/battleService');
const { battleChallengeEmbed, battleResultEmbed, battleButtons } = require('../ui/embeds');
const { helpEmbed, reply, resolveTarget, profileOf } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`tbattle @user` — tantang battle turn-based',
  '`tbattle accept [id]` — terima tantangan',
  '`tbattle decline [id]` — tolak tantangan',
  '`tbattle stats` — W/L, rating, streak',
  '`tbattle leaderboard` — ranking arena',
];

async function latestFor(ctx, status = 'pending') {
  const models = require('../../database/models');
  return models.Battle.findOne({ guildId: ctx.guildId, opponentId: ctx.userId, status }).sort({ createdAt: -1 }).lean();
}

async function execute(ctx) {
  const sub = (ctx.args[0] || '').toLowerCase();
  if (sub === 'accept') {
    const battle = ctx.args[1] ? { _id: ctx.args[1] } : await latestFor(ctx);
    if (!battle) throw new UserError('Tidak ada tantangan pending untukmu.');
    const result = await battleService.accept(ctx.guildId, ctx.userId, String(battle._id), ctx.profile);
    return reply(ctx.message, battleResultEmbed(result));
  }
  if (sub === 'decline') {
    const battle = ctx.args[1] ? { _id: ctx.args[1] } : await latestFor(ctx);
    if (!battle) throw new UserError('Tidak ada tantangan pending untukmu.');
    await battleService.decline(ctx.guildId, ctx.userId, String(battle._id));
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ash).setTitle('❌ TANTANGAN DITOLAK').setDescription('Tantangan battle ditolak.')
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'stats') {
    const data = await battleService.stats(ctx.guildId, ctx.userId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.blood).setTitle('⚔️ BATTLE STATS')
      .addFields(
        { name: '📈 Rating', value: `${data.rating}`, inline: true },
        { name: '🏆 Menang', value: `${data.wins}`, inline: true },
        { name: '💀 Kalah', value: `${data.losses}`, inline: true },
        { name: '🔥 Streak', value: `${data.streak}`, inline: true },
        { name: '📊 Win Rate', value: `${data.winRate}%`, inline: true },
      ).setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'leaderboard' || sub === 'lb') {
    const docs = await battleService.leaderboard(ctx.guildId, 10);
    const lines = docs.map((u, i) => `**#${i + 1}** <@${u.userId}> — ${u.battleRating} ELO • ${u.battleWins}W/${u.battleLosses}L`);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🏆 ARENA LEADERBOARD')
      .setDescription(lines.join('\n') || 'Belum ada data.').setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 BATTLE', HELP));
  if (sub) {
    const target = await resolveTarget(ctx.message, ctx.args[0]);
    if (!target) throw new UserError('Tag lawan: `tbattle @user`.');
    if (target.bot) throw new UserError('Tidak bisa menantang bot.');
    const battle = await battleService.challenge(ctx.guildId, ctx.userId, target.id, ctx.profile, profileOf(target));
    return reply(ctx.message, battleChallengeEmbed(battle), [battleButtons(String(battle._id))]);
  }
  throw new UserError('Format: `tbattle @user` atau `tbattle help`.');
}

module.exports = { names: ['tbattle'], execute, help: HELP };
