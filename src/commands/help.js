'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Panduan lengkap 666 DUO STREAK'),

  cooldownMs: 1500,

  async execute(interaction) {
    await interaction.reply({
      embeds: [helpEmbed()],
      ephemeral: true,
    });
  },
};
