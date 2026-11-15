'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS, divider } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { reply } = require('./_helpers');

const COMMANDS = {
  'Economy': ['`6cash` balance/daily/weekly/monthly/work/beg/deposit/withdraw/transfer/leaderboard/inventory/shop/buy/sell/history/profile'],
  'Hunting': ['`6hunt` start/inventory/collection/sell/stats/leaderboard'],
  'Battle': ['`6battle @user` • accept/decline/stats/leaderboard'],
  'Pet': ['`6pet` hatch/feed/equip/inventory/stats/upgrade/evolve/collection'],
  'Games': ['`6coinflip` `6dice` `6slots` `6blackjack` `6roulette` `6guess` `6trivia` `6rps`'],
  'Quest': ['`6quest` daily/weekly/claim', '`6achievement` • `6rank`'],
  'Trade': ['`6trade @user` • offer/accept/decline/confirm/cancel/status'],
  'Market': ['`6market` list/sell/buy/cancel/mine/history'],
  'Guild': ['`6guild` create/join/leave/info/members/invite/deposit/upgrade/leaderboard/war'],
  'World Boss': ['`6boss` status/attack/leaderboard/rewards'],
  'Profile': ['`6profile [@user]`'],
};

module.exports = {
  names: ['6help', '6commands'],
  async execute(ctx) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.flame)
      .setTitle('🔥 666 ULTIMATE RPG • COMMAND LIST')
      .setDescription(`Prefix \`6\` • semua sistem terintegrasi dengan 666 DUO.\n${divider()}`)
      .setFooter({ text: BRAND });
    for (const [name, lines] of Object.entries(COMMANDS)) {
      embed.addFields({ name: `▸ ${name}`, value: lines.join('\n').slice(0, 1024), inline: false });
    }
    return reply(ctx.message, embed);
  },
  help: ['`6help` — daftar semua command'],
};
