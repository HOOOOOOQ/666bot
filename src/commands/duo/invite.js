'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const duoService = require('../../services/duoService');
const { getGuildConfig } = require('../../services/configService');
const { invitationEmbed } = require('../../ui/embeds');
const { invitationButtons } = require('./_shared');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('invite')
    .setDescription('Undang member untuk menjadi partner Duo (666 DUO STREAK)')
    .addUserOption((option) => option
      .setName('member')
      .setDescription('Member yang ingin kamu undang')
      .setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('member', true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null)
      || targetUser;

    const [{ invitation, existing }, guildConfig] = await Promise.all([
      duoService.invite({
        guildId: interaction.guildId,
        from: interaction.member,
        to: targetMember,
      }),
      getGuildConfig(interaction.guildId),
    ]);

    const fromMember = duoService.memberFromDiscord(interaction.member);
    const toMember = duoService.memberFromDiscord(targetMember);

    const embed = invitationEmbed({
      fromMember,
      toMember,
      duoName: invitation.duoName,
      expiresAt: invitation.expiresAt,
      timezone: guildConfig.timezone,
    });

    if (existing) {
      embed.setFooter({ text: '666 SYSTEM • undangan ini sudah aktif sebelumnya' });
    }

    await interaction.reply({
      content: `<@${targetUser.id}> — kamu menerima undangan Duo dari <@${interaction.user.id}>.`,
      embeds: [embed],
      components: [invitationButtons(String(invitation._id))],
      allowedMentions: { users: [targetUser.id, interaction.user.id], parse: [] },
    });
  },
};
