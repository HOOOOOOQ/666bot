'use strict';

require('dotenv').config({ quiet: true });

const { REST, Routes } = require('discord.js');
const { config } = require('./config');
const { createLogger } = require('./utils/logger');
const { loadCommands, serializeCommands } = require('./handlers/commandHandler');

const log = createLogger('deploy');

async function main() {
  const forceGlobal = process.argv.includes('--global');
  const guildId = forceGlobal ? null : config.discord.guildId;

  if (!config.discord.token) throw new Error('DISCORD_TOKEN is missing in .env');
  if (!config.discord.clientId) throw new Error('DISCORD_CLIENT_ID is missing in .env');

  const commands = loadCommands();
  const body = serializeCommands(commands);

  if (!body.length) throw new Error('No commands found to deploy.');

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const startedAt = Date.now();

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guildId), { body });
    log.info(`Deployed ${body.length} command(s) to guild ${guildId} in ${Date.now() - startedAt}ms.`);
  } else {
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
    log.info(`Deployed ${body.length} global command(s) in ${Date.now() - startedAt}ms (propagation can take up to 1 hour).`);
  }

  log.info(`Commands: ${body.map((command) => `/${command.name}`).join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Command deployment failed.', error);
    process.exit(1);
  });
