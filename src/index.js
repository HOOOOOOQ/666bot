'use strict';

require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config, validateConfig } = require('./config');
const { createLogger, closeLogger } = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./database/connection');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const notificationService = require('./services/notificationService');
const schedulerService = require('./services/schedulerService');
const apiService = require('./services/apiService');
const logService = require('./services/logService');
const cardService = require('./services/cardService');

const log = createLogger('boot');

function printBanner() {
  const lines = [
    '',
    '  ██████╗  ██████╗  ██████╗     ██████╗  ██████╗ ████████╗',
    '  ██╔══██╗██╔════╝ ██╔════╝     ██╔══██╗██╔═══██╗╚══██╔══╝',
    '  ██████╔╝██████╗  ███████╗     ██████╔╝██║   ██║   ██║   ',
    '  ██╔══██╗██╔═══╝  ██╔═══██╗    ██╔══██╗██║   ██║   ██║   ',
    '  ██║  ██║╚██████╗ ╚██████╔╝    ██████╔╝╚██████╔╝   ██║   ',
    '  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝     ╚═════╝  ╚═════╝    ╚═╝   ',
    '',
    '  TWO MEMBERS. ONE CONNECTION. ONE STREAK.',
    '  666 DUO STREAK SYSTEM',
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

const problems = validateConfig();
if (problems.length) {
  for (const problem of problems) log.error(`Configuration: ${problem}`);
  log.error('Bot cannot start. Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  allowedMentions: { parse: [], repliedUser: false },
});

client.commands = loadCommands();
loadEvents(client);
notificationService.init(client);
logService.init(client);
cardService.warmup().catch(() => {});

let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info(`Received ${signal}. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    log.warn('Graceful shutdown timed out. Forcing exit.');
    process.exit(exitCode || 1);
  }, 15000);
  forceExit.unref?.();

  try {
    schedulerService.stop();
  } catch (error) {
    log.warn('Failed to stop scheduler.', error.message);
  }

  try {
    await apiService.stop();
  } catch (error) {
    log.warn('Failed to stop API server.', error.message);
  }

  try {
    await logService.stop();
  } catch (error) {
    log.warn('Failed to flush streak logs.', error.message);
  }

  try {
    await notificationService.flush(5000);
  } catch {
    /* ignore */
  }

  notificationService.stop();

  try {
    if (client.isReady()) await client.destroy();
  } catch (error) {
    log.warn('Failed to destroy Discord client.', error.message);
  }

  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }

  closeLogger();
  log.info('666 BOT stopped. Goodbye.');
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection.', reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception — shutting down to avoid a corrupted state.', error);
  shutdown('uncaughtException', 1);
});

async function main() {
  printBanner();

  log.info(`Environment: ${config.nodeEnv} • Node ${process.version}`);
  log.info(`Timezone default: ${config.duo.timezone} • XP/day: ${config.duo.xpPerDay}`);

  await connectDatabase(config.database.uri);
  log.info('Connecting to Discord gateway...');
  await client.login(config.discord.token);
}

main().catch(async (error) => {
  log.error('Fatal startup error.', error);
  await shutdown('startup-error', 1);
});
