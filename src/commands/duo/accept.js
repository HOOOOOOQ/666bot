'use strict';

const { SlashCommandSubcommandBuilder } = require('discord.js');
const duoService = require('../../services/duoService');
const { getDuoOverview } = require('../../services/profileService');
const { profileEmbed } = require('../../ui/embeds');

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName('accept')
    .setDescription('Terima undangan Duo yang menunggu'),

  async execute(interaction) {
    await duoService.acceptInvitation({
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });

    const overview = await getDuoOverview({ guild: interaction.guild, userId: interaction.user.id });
    const embed = profileEmbed({
      duo: overview.duo,
      members: overview.members,
      today: overview.today,
      rewardSummary: overview.rewardSummary,
      nextMilestone: overview.nextMilestone,
      timezone: overview.timezone,
    });
    embed.setTitle(`✅ Duo Connection Established — ${overview.duo.name}`);

    await interaction.reply({
      content: '🔥 **DUO CONNECTION: ACTIVE** — streak kalian dimulai setelah kedua member menyelesaikan aktivitas pertama.',
      embeds: [embed],
      allowedMentions: { users: overview.duo.members.map((member) => member.userId), parse: [] },
    });
  },
};
