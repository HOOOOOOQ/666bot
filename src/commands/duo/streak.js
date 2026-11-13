'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { streakEmbed } = require('../../ui/embeds');
const { loadOverviewOrReply } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('streak')
    .setDescription('Tampilkan status streak Duo hari ini'),

  async execute(interaction) {
    const overview = await loadOverviewOrReply(interaction);
    if (!overview) return;

    await interaction.reply({
      embeds: [
        streakEmbed({
          duo: overview.duo,
          today: overview.today,
          nextMilestone: overview.nextMilestone,
          timezone: overview.timezone,
        }),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
