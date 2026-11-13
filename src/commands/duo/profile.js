'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { getDuoOverview } = require('../../services/profileService');
const { profileEmbed } = require('../../ui/embeds');
const { loadOverviewOrReply } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('profile')
    .setDescription('Tampilkan profil lengkap Duo')
    .addUserOption((option) => option
      .setName('user')
      .setDescription('Lihat profil Duo milik member lain')
      .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    if (target.bot) {
      await interaction.reply({ content: '🤖 Bot tidak bisa memiliki Duo.', ephemeral: true });
      return;
    }

    const overview = target.id === interaction.user.id
      ? await loadOverviewOrReply(interaction)
      : await getDuoOverview({ guild: interaction.guild, userId: target.id });

    if (!overview) return;

    if (!overview.duo) {
      await interaction.reply({
        content: `💤 <@${target.id}> belum terhubung dengan Duo partner.`,
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    await interaction.reply({
      embeds: [
        profileEmbed({
          duo: overview.duo,
          members: overview.members,
          today: overview.today,
          rewardSummary: overview.rewardSummary,
          nextMilestone: overview.nextMilestone,
          timezone: overview.timezone,
        }),
      ],
      allowedMentions: { users: overview.duo.members.map((member) => member.userId), parse: [] },
    });
  },
};
