'use strict';

/**
 * Error that is safe to show to Discord users (ephemeral response).
 */
class UserError extends Error {
  constructor(userMessage, options = {}) {
    super(userMessage);
    this.name = 'UserError';
    this.userMessage = userMessage;
    this.code = options.code || 'USER_ERROR';
    this.ephemeral = options.ephemeral !== false;
    this.meta = options.meta;
  }
}

/**
 * Internal error where only a generic message is shown to the user.
 */
class BotError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'BotError';
    this.code = options.code || 'BOT_ERROR';
    this.userMessage = options.userMessage || 'Terjadi kesalahan internal. Coba lagi nanti.';
    this.ephemeral = options.ephemeral !== false;
    this.meta = options.meta;
    this.cause = options.cause;
  }
}

function isUserError(error) {
  return error instanceof UserError;
}

function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001));
}

module.exports = { UserError, BotError, isUserError, isDuplicateKeyError };
