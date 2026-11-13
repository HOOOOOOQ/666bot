'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const duoService = require('../../services/duoService');
const { successEmbed, errorEmbed } = require('../../ui/embeds');
const { loadOverviewOrReply } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('rename')
    .setDescription('Ubah nama Duo kalian')
    .addStringOption((option) => option
      .setName('nama')
      .setDescription('Nama Duo baru (2-32 karakter)')
      .setMinLength(2)
      .setMaxLength(32)
      .setRequired(true)),

  async execute(interaction) {
    const overview = await loadOverviewOrReply(interaction);
    if (!overview) return;

    const newName = interaction.options.getString('nama', true);

    try {
      const updated = await duoService.renameDuo({
        duo: overview.duo,
        userId: interaction.user.id,
        newName,
      });

      const embed = successEmbed(
        'Nama Duo diperbarui',
        `Nama Duo berhasil diubah dari **${overview.duo.name}** menjadi **${updated.name}**.`,
      );

      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      if (error?.userMessage) {
        await interaction.reply({ embeds: [errorEmbed(error.userMessage)], ephemeral: true });
        return;
      }
      throw error;
    }
  },
};
