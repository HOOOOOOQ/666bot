'use strict';

const { Events, MessageFlags } = require('discord.js');
const { createLogger } = require('../utils/logger');
const { UserError } = require('../utils/errors');
const { commandCooldown } = require('../utils/cooldown');
const duoService = require('../services/duoService');
const { getDuoOverview } = require('../services/profileService');
const {
  errorEmbed,
  infoEmbed,
  profileEmbed,
  breakResultEmbed,
} = require('../ui/embeds');

const log = createLogger('interaction');

async function respondError(interaction, error) {
  const isUserFacing = error instanceof UserError;
  const message = isUserFacing
    ? error.userMessage
    : 'Terjadi kesalahan internal. 666 SYSTEM sudah mencatat kejadian ini.';

  if (isUserFacing) log.debug(`User error: ${error.message}`);
  else log.error(`Interaction failed (${interaction.commandName || interaction.customId || interaction.type}).`, error);

  const payload = {
    embeds: [errorEmbed(message, isUserFacing ? 'Tidak Bisa Diproses' : 'Internal Error')],
    flags: MessageFlags.Ephemeral,
  };

  try {
    if (interaction.deferred) await interaction.editReply({ embeds: payload.embeds });
    else if (interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (replyError) {
    log.warn('Could not deliver error response.', replyError.message);
  }
}

async function handleChatInputCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    log.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('666 DUO STREAK hanya tersedia di dalam server Discord.', 'Server Only')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldownMs = Number(command.cooldownMs) || 2000;
  const { limited, remainingMs } = commandCooldown.check(
    `${interaction.user.id}:${interaction.commandName}`,
    cooldownMs,
  );

  if (limited) {
    await interaction.reply({
      embeds: [errorEmbed(`Tunggu ${(remainingMs / 1000).toFixed(1)} detik sebelum memakai command ini lagi.`, 'Cooldown')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await command.execute(interaction);
}

async function handleInvitationAccept(interaction, invitationId) {
  await interaction.deferUpdate();

  await duoService.acceptInvitation({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    invitationId,
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

  await interaction.editReply({
    content: '🔥 **DUO CONNECTION: ACTIVE** — streak kalian dimulai setelah kedua member menyelesaikan aktivitas pertama.',
    embeds: [embed],
    components: [],
    allowedMentions: { users: overview.duo.members.map((member) => member.userId), parse: [] },
  });
}

async function handleInvitationDecline(interaction, invitationId) {
  await interaction.deferUpdate();

  const invitation = await duoService.declineInvitation({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    invitationId,
  });

  await interaction.editReply({
    embeds: [infoEmbed('Undangan ditolak', `Undangan Duo dari <@${invitation.fromUserId}> telah ditolak.`)],
    components: [],
    allowedMentions: { users: [String(invitation.fromUserId)], parse: [] },
  });
}

async function handleBreakButton(interaction, action, duoId) {
  if (action === 'cancel') {
    await interaction.update({
      embeds: [infoEmbed('Dibatalkan', 'Duo kalian tetap aktif. Jangan lupa selesaikan aktivitas hari ini 🔥')],
      components: [],
    });
    return;
  }

  if (action !== 'confirm') return;

  await interaction.deferUpdate();

  const overview = await getDuoOverview({ guild: interaction.guild, userId: interaction.user.id });

  if (!overview.duo || String(overview.duo._id) !== String(duoId)) {
    throw new UserError('Duo ini sudah tidak aktif atau kamu bukan membernya.');
  }

  const { duo: updated, finalStreak } = await duoService.breakDuo({
    duo: overview.duo,
    userId: interaction.user.id,
    reason: 'manual',
  });

  await interaction.editReply({
    embeds: [breakResultEmbed({ duo: updated, streakLost: finalStreak })],
    components: [],
  });

  log.info(`Duo ${updated._id} ended by ${interaction.user.id}.`);
}

async function handleButton(interaction) {
  const [namespace, action, sub, id] = interaction.customId.split(':');
  if (namespace !== 'duo') return;

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'Tombol ini hanya bisa digunakan di dalam server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'accept') return handleInvitationAccept(interaction, sub);
  if (action === 'decline') return handleInvitationDecline(interaction, sub);
  if (action === 'break') return handleBreakButton(interaction, sub, id);
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await handleChatInputCommand(interaction);
        return;
      }
      if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      await respondError(interaction, error);
    }
  },
};
