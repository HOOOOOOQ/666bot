'use strict';

const { ActivityType, Events, REST, Routes } = require('discord.js');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { serializeCommands } = require('../handlers/commandHandler');
const schedulerService = require('../services/schedulerService');
const apiService = require('../services/apiService');

const log = createLogger('ready');

async function deployCommands(client) {
  const body = serializeCommands(client.commands);
  if (!body.length) return;

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const applicationId = client.application?.id || config.discord.clientId;
  const startedAt = Date.now();

  try {
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(applicationId, config.discord.guildId),
        { body },
      );
      log.info(`Registered ${body.length} guild slash command(s) in ${Date.now() - startedAt}ms.`);
    } else {
      await rest.put(
        Routes.applicationCommands(applicationId),
        { body },
      );
      log.info(`Registered ${body.length} global slash command(s) in ${Date.now() - startedAt}ms (may take up to 1h to propagate).`);
    }
  } catch (error) {
    log.error('Failed to register slash commands. Run `npm run deploy` manually.', error);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log.info(`Logged in as ${client.user.tag} (${client.user.id}).`);
    log.info(`Serving ${client.guilds.cache.size} guild(s) with ${client.commands.size} command(s).`);

    client.user.setPresence({
      status: 'online',
      activities: [{
        name: '🔥 666 DUO STREAK • /duo help',
        type: ActivityType.Watching,
      }],
    });

    if (config.discord.autoDeploy) {
      await deployCommands(client);
    }

    schedulerService.start(client);
    apiService.start(client);

    log.info('666 BOT is fully operational.');
  },
};
