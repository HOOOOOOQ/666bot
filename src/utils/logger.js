'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
  error: '\u001b[31m',
  warn: '\u001b[33m',
  info: '\u001b[36m',
  debug: '\u001b[90m',
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  magenta: '\u001b[35m',
};

const activeLevel = LEVELS[config.logging.level] ?? LEVELS.info;
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

let fileStream = null;
if (config.logging.toFile) {
  try {
    const dir = path.join(process.cwd(), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fileStream = fs.createWriteStream(path.join(dir, '666bot.log'), { flags: 'a' });
    fileStream.on('error', () => {
      fileStream = null;
    });
  } catch {
    fileStream = null;
  }
}

function paint(level, text) {
  if (!useColor) return text;
  return `${COLORS[level] ?? ''}${text}${COLORS.reset}`;
}

function formatMeta(meta) {
  if (meta === undefined) return '';
  if (meta instanceof Error) {
    return ` ${meta.stack || meta.message}`;
  }
  if (typeof meta === 'string') return ` ${meta}`;
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${String(meta)}`;
  }
}

function write(level, scope, message, meta) {
  if ((LEVELS[level] ?? 99) > activeLevel) return;

  const time = new Date().toISOString();
  const scopeLabel = scope ? `${paint('magenta', `[${scope}]`)} ` : '';
  const plain = `[${time}] [${level.toUpperCase()}] ${scope ? `[${scope}] ` : ''}${message}`;
  const colored = `${paint('dim', `[${time}]`)} ${paint(level, `[${level.toUpperCase()}]`)} ${scopeLabel}${message}`;
  const suffix = formatMeta(meta);

  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(`${colored}${suffix}\n`);

  if (fileStream) {
    fileStream.write(`${plain}${suffix}\n`);
  }
}

/**
 * Creates a scoped logger. Scopes make Pterodactyl console logs readable.
 * @param {string} [scope]
 */
function createLogger(scope) {
  return {
    error: (message, meta) => write('error', scope, message, meta),
    warn: (message, meta) => write('warn', scope, message, meta),
    info: (message, meta) => write('info', scope, message, meta),
    debug: (message, meta) => write('debug', scope, message, meta),
    child: (childScope) => createLogger(scope ? `${scope}:${childScope}` : childScope),
  };
}

function closeLogger() {
  if (fileStream) {
    try {
      fileStream.end();
    } catch {
      /* ignore */
    }
    fileStream = null;
  }
}

module.exports = { createLogger, closeLogger, logger: createLogger('666') };
