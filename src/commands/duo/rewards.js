'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { rewardsEmbed } = require('../../ui/embeds');
const { loadOverviewOrReply } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('rewards')
    .setDescription('Tampilkan badge dan hadiah berdasarkan pencapaian streak'),

  async execute(interaction) {
    const overview = await loadOverviewOrReply(interaction);
    if (!overview) return;

    await interaction.reply({
      embeds: [
        rewardsEmbed({
          duo: overview.duo,
          rewards: overview.rewardSummary.list,
          highest: overview.rewardSummary.highest,
          nextMilestone: overview.nextMilestone,
          timezone: overview.timezone,
        }),
      ],
      allowedMentions: { parse: [] },
    });
  },
};
