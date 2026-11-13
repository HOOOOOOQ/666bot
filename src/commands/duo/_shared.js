'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getDuoOverview } = require('../../services/profileService');
const { noDuoEmbed, infoEmbed } = require('../../ui/embeds');

/**
 * Loads the overview for a user or replies with a friendly "no duo" message.
 * @returns {Promise<object|null>} null when the reply was already sent
 */
async function loadOverviewOrReply(interaction, userId = interaction.user.id, { ephemeral = false } = {}) {
  const overview = await getDuoOverview({ guild: interaction.guild, userId });
  const isSelf = String(userId) === String(interaction.user.id);

  if (overview.duo) return overview;

  const embed = isSelf
    ? noDuoEmbed()
    : infoEmbed('Belum ada Duo', `<@${userId}> belum terhubung dengan Duo partner mana pun.`);

  await interaction.reply({
    embeds: [embed],
    flags: ephemeral || !isSelf ? MessageFlags.Ephemeral : undefined,
  });
  return null;
}

function invitationButtons(invitationId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duo:accept:${invitationId}`)
      .setLabel('Accept Duo')
      .setEmoji('🔥')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`duo:decline:${invitationId}`)
      .setLabel('Decline')
      .setStyle(ButtonStyle.Secondary),
  );
}

function breakButtons(duoId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duo:break:confirm:${duoId}`)
      .setLabel('Konfirmasi Putuskan Duo')
      .setEmoji('⛓️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`duo:break:cancel:${duoId}`)
      .setLabel('Batal')
      .setStyle(ButtonStyle.Secondary),
  );
}

module.exports = { loadOverviewOrReply, invitationButtons, breakButtons };
