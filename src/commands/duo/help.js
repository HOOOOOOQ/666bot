'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const { helpEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('help')
    .setDescription('Panduan lengkap 666 DUO STREAK'),

  async execute(interaction) {
    await interaction.reply({
      embeds: [helpEmbed()],
      ephemeral: true,
    });
  },
};
