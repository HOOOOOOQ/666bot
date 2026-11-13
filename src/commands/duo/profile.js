'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { getDuoOverview } = require('../../services/profileService');
const { buildProfilePayload } = require('../../ui/cards/payloads');
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

    // Rendering + uploading a 1280x1280 PNG can take longer than Discord's
    // initial 3s response window, so acknowledge first and edit afterwards.
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();

    const payload = await buildProfilePayload(overview);
    const response = {
      embeds: [payload.embed],
      files: payload.files,
      allowedMentions: { users: overview.duo.members.map((member) => member.userId), parse: [] },
    };

    if (interaction.deferred) await interaction.editReply(response);
    else await interaction.reply(response);
  },
};
