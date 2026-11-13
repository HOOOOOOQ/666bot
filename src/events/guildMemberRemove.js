'use strict';

const { Events } = require('discord.js');
const duoService = require('../services/duoService');
const notificationService = require('../services/notificationService');
const { getGuildConfig } = require('../services/configService');
const { createLogger } = require('../utils/logger');

const log = createLogger('member');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    if (!member?.guild || member.user?.bot) return;

    try {
      const duo = await duoService.getActiveDuoForUser(member.guild.id, member.id, { fresh: true });
      if (!duo) return;

      const { duo: updated, finalStreak } = await duoService.breakDuo({
        duo,
        userId: member.id,
        reason: 'partner_left',
        actorId: member.id,
      });

      const guildConfig = await getGuildConfig(member.guild.id);

      notificationService.notifyPartnerLeft({
        duo: { ...updated, currentStreak: finalStreak },
        leftMember: {
          userId: member.id,
          username: member.user.username,
          displayName: member.displayName || member.user.username,
          avatar: member.displayAvatarURL?.({ size: 256, extension: 'png' }) || null,
        },
        guildConfig,
      });

      const partner = duoService.getPartner(duo, member.id);
      log.info(`Duo ${duo._id} ended: ${member.user.username} left. Partner ${partner?.userId || '-'} notified.`);
    } catch (error) {
      log.error('Failed to handle member leave for Duo.', error);
    }
  },
};
