'use strict';

const { Events, PermissionFlagsBits } = require('discord.js');
const activityService = require('../services/activityService');
const rpgHandler = require('../rpg/handler');
const serverConfigService = require('../rpg/services/serverConfigService');
const { createLogger } = require('../utils/logger');

const log = createLogger('message');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message || message.author?.system || message.author?.bot) return;
    const content = String(message.content || '').trim();
    const customPrefix = message.guildId ? await serverConfigService.getCustomPrefix(message.guildId).catch(() => null) : null;
    const isCommand = Boolean(rpgHandler.parse(content) || (customPrefix && rpgHandler.parse(content, customPrefix)));
    if (message.guildId && !isCommand) {
      const censored = await serverConfigService.findCensored(message.guildId, message.content).catch(() => null);
      if (censored) {
        if (message.guild?.members?.me?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
          await message.delete().catch(() => {});
          await message.channel.send({ content: `🛡️ <@${message.author.id}>, kata itu difilter di server ini.`, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
        }
        return;
      }
    }

    try {
      const rpgHandled = await rpgHandler.handleMessage(message).catch((error) => {
        log.error('RPG prefix handler failed.', error);
        return false;
      });
      if (rpgHandled) {
        // Command prefix bukan aktivitas chat: jangan biarkan tcash/thunt menambah streak Duo.
        log.debug(`RPG command handled for ${message.author.id}.`);
        return;
      }

      const result = await activityService.handleMessage(message);

      if (result.counted) {
        log.debug(`Activity counted for ${message.author.id} in ${message.guildId}.`);
        if (result.streak?.completed) {
          log.info(`Streak completed for duo ${result.streak.duo?._id} (${result.streak.streak} days).`);
        }
      } else if (result.reason === 'database_error') {
        log.warn(`Activity could not be stored for ${message.author.id}.`);
      }
    } catch (error) {
      log.error('Unexpected error while processing message activity.', error);
    }
  },
};
