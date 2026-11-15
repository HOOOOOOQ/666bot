'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { helpView } = require('../rpg/ui/help');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Pusat bantuan 666 Ultimate RPG: command, kategori, dan contoh')
    .addStringOption((option) => option
      .setName('command')
      .setDescription('Nama command atau kategori, misalnya cash, pet, economy')
      .setRequired(false)
      .setMaxLength(40)),

  cooldownMs: 1500,

  async execute(interaction) {
    const query = interaction.options.getString('command');
    await interaction.reply({
      ...helpView(query || null),
      ephemeral: true,
    });
  },
};
