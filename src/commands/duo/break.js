'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { breakConfirmEmbed } = require('../../ui/embeds');
const { breakButtons, loadOverviewOrReply } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('break')
    .setDescription('Akhiri hubungan Duo (perlu konfirmasi via tombol)'),

  async execute(interaction) {
    const overview = await loadOverviewOrReply(interaction);
    if (!overview) return;

    const embed = breakConfirmEmbed({ duo: overview.duo });

    await interaction.reply({
      embeds: [embed],
      components: [breakButtons(String(overview.duo._id))],
      allowedMentions: { parse: [] },
    });
  },
};
