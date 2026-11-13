'use strict';

const { PermissionFlagsBits, SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig, updateGuildConfig, assertValidTimezone } = require('../../services/configService');
const { configEmbed } = require('../../ui/embeds');
const { UserError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('config')
    .setDescription('Pengaturan 666 DUO STREAK untuk server ini (butuh Manage Server)')
    .addStringOption((option) => option
      .setName('timezone')
      .setDescription('Timezone IANA untuk pergantian hari (contoh: Asia/Jakarta)')
      .setRequired(false))
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel untuk notifikasi Duo')
      .setRequired(false))
    .addBooleanOption((option) => option
      .setName('notifications')
      .setDescription('Aktifkan/nonaktifkan seluruh notifikasi Duo')
      .setRequired(false))
    .addBooleanOption((option) => option
      .setName('reminders')
      .setDescription('Aktifkan/nonaktifkan reminder harian')
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName('reminder_hour')
      .setDescription('Jam reminder harian (0-23) di timezone server')
      .setMinValue(0)
      .setMaxValue(23)
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName('cooldown_seconds')
      .setDescription('Cooldown aktivitas per member (0-3600 detik)')
      .setMinValue(0)
      .setMaxValue(3600)
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName('min_message_length')
      .setDescription('Panjang minimum pesan valid (1-50 karakter)')
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(false))
    .addBooleanOption((option) => option
      .setName('clear_channel')
      .setDescription('Hapus channel notifikasi (kembali ke DM member)')
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new UserError('Kamu membutuhkan permission **Manage Server** untuk mengubah konfigurasi Duo.');
    }

    const timezone = interaction.options.getString('timezone');
    const channel = interaction.options.getChannel('channel');
    const notifications = interaction.options.getBoolean('notifications');
    const reminders = interaction.options.getBoolean('reminders');
    const reminderHour = interaction.options.getInteger('reminder_hour');
    const cooldown = interaction.options.getInteger('cooldown_seconds');
    const minLength = interaction.options.getInteger('min_message_length');
    const clearChannel = interaction.options.getBoolean('clear_channel');

    const patch = {};

    if (timezone) {
      assertValidTimezone(timezone);
      patch.timezone = timezone;
    }
    if (channel) patch.notificationChannelId = channel.id;
    if (clearChannel) patch.notificationChannelId = null;
    if (notifications !== null) patch.notificationsEnabled = notifications;
    if (reminders !== null) patch.remindersEnabled = reminders;
    if (reminderHour !== null) patch.reminderHour = reminderHour;
    if (cooldown !== null) patch.activityCooldownSeconds = cooldown;
    if (minLength !== null) patch.minMessageLength = minLength;

    const current = await getGuildConfig(interaction.guildId);
    const updated = Object.keys(patch).length
      ? await updateGuildConfig(interaction.guildId, patch)
      : current;

    await interaction.reply({
      embeds: [configEmbed({ guildConfig: updated, guildName: interaction.guild.name })],
      flags: MessageFlags.Ephemeral,
    });
  },
};
