'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const duoService = require('../../services/duoService');
const { leaderboardEmbed } = require('../../ui/embeds');
const { paginate } = require('../../ui/paginator');

const PAGE_SIZE = 5;

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('leaderboard')
    .setDescription('Peringkat Duo berdasarkan streak, best streak, XP, atau total hari')
    .addStringOption((option) => option
      .setName('category')
      .setDescription('Kategori peringkat')
      .addChoices(
        { name: '🔥 Current Streak', value: 'current' },
        { name: '🏆 Best Streak', value: 'best' },
        { name: '💎 Total Duo XP', value: 'xp' },
        { name: '📅 Total Days Together', value: 'days' },
      )
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName('page')
      .setDescription('Halaman awal')
      .setMinValue(1)
      .setRequired(false)),

  async execute(interaction) {
    const category = interaction.options.getString('category') || 'current';
    const startPage = Math.max(0, (interaction.options.getInteger('page') || 1) - 1);

    await interaction.deferReply();

    const first = await duoService.getLeaderboard({
      guildId: interaction.guildId,
      category,
      page: 0,
      pageSize: PAGE_SIZE,
    });

    const render = async (page) => {
      const board = await duoService.getLeaderboard({
        guildId: interaction.guildId,
        category,
        page,
        pageSize: PAGE_SIZE,
      });
      return leaderboardEmbed({
        entries: board.entries,
        page: board.page,
        pageSize: board.pageSize,
        total: board.total,
        categoryLabel: board.label,
        guildName: interaction.guild.name,
      });
    };

    await paginate(interaction, render, {
      pageCount: first.pageCount,
      page: Math.min(startPage, first.pageCount - 1),
    });
  },
};
