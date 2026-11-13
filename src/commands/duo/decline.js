'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const duoService = require('../../services/duoService');
const { infoEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('decline')
    .setDescription('Tolak undangan Duo yang menunggu'),

  async execute(interaction) {
    const invitation = await duoService.declineInvitation({
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });

    await interaction.reply({
      embeds: [
        infoEmbed(
          'Undangan ditolak',
          `Undangan Duo dari <@${invitation.fromUserId}> telah ditolak.\nMereka masih bisa mengirim undangan baru nanti.`,
        ),
      ],
      allowedMentions: { users: [String(invitation.fromUserId)], parse: [] },
    });
  },
};
