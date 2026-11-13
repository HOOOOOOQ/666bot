'use strict';

const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandSubcommandBuilder,
} = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../../services/configService');
const { logChannelConfiguredEmbed } = require('../../ui/embeds');
const { UserError } = require('../../utils/errors');

const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
];

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('setlog')
    .setDescription('Atur channel untuk 666 DUO STREAK LOGS otomatis (butuh Manage Server)')
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel tujuan log streak otomatis')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserError('Kamu membutuhkan permission **Manage Server** untuk mengatur log channel.');
    }

    const channel = interaction.options.getChannel('channel', true);

    if (!channel || !channel.isTextBased()) {
      throw new UserError('Channel log harus berupa channel teks.');
    }

    const me = interaction.guild?.members?.me;
    const permissions = me ? channel.permissionsFor(me) : null;

    if (permissions && !permissions.has(REQUIRED_PERMISSIONS)) {
      throw new UserError(
        `Aku tidak punya izin lengkap di <#${channel.id}>. Butuhkan: **View Channel, Send Messages, Embed Links, Attach Files**.`,
      );
    }

    const updated = await updateGuildConfig(interaction.guildId, { logChannelId: channel.id });
    const guildConfig = updated || await getGuildConfig(interaction.guildId, { fresh: true });

    await interaction.reply({
      embeds: [logChannelConfiguredEmbed({ channel, guildConfig })],
      flags: MessageFlags.Ephemeral,
    });
  },
};
