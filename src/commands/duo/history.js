'use strict';

const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const duoService = require('../../services/duoService');
const { historyEmbed } = require('../../ui/embeds');
const { paginate } = require('../../ui/paginator');
const { loadOverviewOrReply } = require('./_shared');

const PAGE_SIZE = 8;

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('history')
    .setDescription('Tampilkan riwayat aktivitas Duo')
    .addIntegerOption((option) => option
      .setName('page')
      .setDescription('Halaman awal')
      .setMinValue(1)
      .setRequired(false)),

  async execute(interaction) {
    const overview = await loadOverviewOrReply(interaction, interaction.user.id, { ephemeral: true });
    if (!overview) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const startPage = Math.max(0, (interaction.options.getInteger('page') || 1) - 1);
    const first = await duoService.getHistory({
      duoId: overview.duo._id,
      page: 0,
      pageSize: PAGE_SIZE,
    });

    const render = async (page) => {
      const history = await duoService.getHistory({
        duoId: overview.duo._id,
        page,
        pageSize: PAGE_SIZE,
      });
      return historyEmbed({
        entries: history.entries,
        page: history.page,
        pageSize: history.pageSize,
        total: history.total,
        duo: overview.duo,
      });
    };

    await paginate(interaction, render, {
      pageCount: first.pageCount,
      page: Math.min(startPage, first.pageCount - 1),
      ephemeral: true,
    });
  },
};
