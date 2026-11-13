'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createLogger } = require('../utils/logger');

const log = createLogger('events');

/**
 * Binds every event module in `src/events` to the Discord client. Handler
 * errors are logged instead of crashing the process.
 */
function loadEvents(client, eventsDir = path.join(__dirname, '..', 'events')) {
  if (!fs.existsSync(eventsDir)) return [];

  const loaded = [];
  for (const entry of fs.readdirSync(eventsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const filePath = path.join(eventsDir, entry.name);
    delete require.cache[require.resolve(filePath)];
    const event = require(filePath);

    if (!event?.name || typeof event.execute !== 'function') {
      log.warn(`Skipping event ${entry.name}: missing name/execute.`);
      continue;
    }

    const wrapped = (...args) => {
      Promise.resolve()
        .then(() => event.execute(...args))
        .catch((error) => log.error(`Event "${event.name}" failed.`, error));
    };

    if (event.once) client.once(event.name, wrapped);
    else client.on(event.name, wrapped);

    loaded.push(event.name);
  }

  log.info(`Loaded ${loaded.length} event listener(s).`);
  return loaded;
}

module.exports = { loadEvents };
