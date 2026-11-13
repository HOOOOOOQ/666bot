'use strict';

const { MessageFlags, PermissionFlagsBits, SlashCommandSubcommandBuilder } = require('discord.js');
const { getLogStatus } = require('../../services/logService');
const { logStatusEmbed } = require('../../ui/embeds');
const { UserError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('logstatus')
    .setDescription('Status sistem 666 DUO STREAK LOGS: channel, antrean, retry, log terakhir')
    .addBooleanOption((option) => option
      .setName('detail')
      .setDescription('Tampilkan detail log terbaru')
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserError('Kamu membutuhkan permission **Manage Server** untuk melihat status log.');
    }

    const detailed = interaction.options.getBoolean('detail');
    const status = await getLogStatus(interaction.guildId);

    await interaction.reply({
      embeds: [
        logStatusEmbed({
          guildConfig: status.guildConfig,
          counts: status.counts,
          last: status.last,
          recent: detailed === false ? [] : status.recent,
          channel: status.channel,
          timezone: status.timezone,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
