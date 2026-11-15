'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const bossService = require('../services/worldBossService');
const { bossEmbed, money } = require('../ui/embeds');
const { helpEmbed, reply } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`6boss` / `6boss status` — HP & damage leaderboard',
  '`6boss attack` — serang boss (cooldown 30 detik)',
  '`6boss leaderboard` — kontribusi damage',
  '`6boss rewards` — preview reward',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'status').toLowerCase();
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 WORLD BOSS', HELP));
  if (sub === 'attack' || sub === 'serang' || sub === 'hit') {
    const result = await bossService.attack(ctx.guildId, ctx.userId, ctx.profile, ctx.message.id);
    const embed = new EmbedBuilder()
      .setColor(result.defeated ? COLORS.success : COLORS.blood)
      .setTitle(result.defeated ? '🏆 WORLD BOSS DEFEATED!' : '👹 BOSS ATTACK')
      .setDescription(`Kamu menyerang **${result.boss.name}** sebesar **${formatCoins(result.damage)}** damage!\nHP tersisa: **${formatCoins(result.hpLeft)}**\nBoss membalas: ${formatCoins(result.counterDamage)} (flavor) • Skill: **${result.skill}**`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' });
    if (result.defeated) embed.addFields({ name: 'Reward', value: `Reward dibagikan otomatis berdasarkan kontribusi damage. Cek \`6boss leaderboard\`.` });
    return reply(ctx.message, embed);
  }
  if (sub === 'leaderboard' || sub === 'lb') {
    const data = await bossService.leaderboard(ctx.guildId);
    const lines = (data.entries || []).map((c, i) => `**#${i + 1}** <@${c.userId}> — ${formatCoins(c.damage)} damage (${c.attacks} attack)`);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🏆 WORLD BOSS CONTRIBUTION')
      .setDescription(lines.join('\n') || 'Belum ada serangan.').setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'rewards') {
    const data = await bossService.rewardsPreview(ctx.guildId);
    return reply(ctx.message, new EmbedBuilder().setColor(COLORS.warning).setTitle('🎁 BOSS REWARDS')
      .setDescription(`Koin: **${money(data.coinReward)}** • EXP: **${formatCoins(data.xpReward)}**\n${data.note}`)
      .setFooter({ text: '666 SYSTEM • ULTIMATE RPG' }));
  }
  if (sub === 'status' || sub === 'info') {
    const data = await bossService.getStatus(ctx.guildId);
    return reply(ctx.message, bossEmbed(data));
  }
  throw new UserError('Subcommand boss tidak dikenal. Lihat `6boss help`.');
}

module.exports = { names: ['6boss'], execute, help: HELP };
