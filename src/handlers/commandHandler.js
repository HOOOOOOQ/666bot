'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const { createLogger } = require('../utils/logger');

const log = createLogger('commands');

function registerCommand(commands, filePath) {
  // Bust the cache so hot reloading during development works.
  delete require.cache[require.resolve(filePath)];
  const command = require(filePath);

  if (!command?.data?.name) {
    log.warn(`Skipping ${filePath}: missing data.name`);
    return;
  }
  if (typeof command.execute !== 'function') {
    log.warn(`Skipping ${filePath}: missing execute()`);
    return;
  }
  if (commands.has(command.data.name)) {
    throw new Error(`Duplicate command name "${command.data.name}" (${filePath}).`);
  }

  commands.set(command.data.name, command);
}

/**
 * Loads every command from `src/commands`. A folder is treated as a single
 * command with an `index.js` entry (used by `/duo` and its subcommands).
 */
function loadCommands(commandsDir = path.join(__dirname, '..', 'commands')) {
  const commands = new Collection();
  if (!fs.existsSync(commandsDir)) return commands;

  for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const fullPath = path.join(commandsDir, entry.name);

    if (entry.isDirectory()) {
      const indexPath = path.join(fullPath, 'index.js');
      if (fs.existsSync(indexPath)) registerCommand(commands, indexPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'index.js') {
      registerCommand(commands, fullPath);
    }
  }

  log.info(`Loaded ${commands.size} slash command(s): ${[...commands.keys()].join(', ')}`);
  return commands;
}

/** JSON payload for the Discord REST API. */
function serializeCommands(commands) {
  return [...commands.values()].map((command) => command.data.toJSON());
}

module.exports = { loadCommands, serializeCommands };
