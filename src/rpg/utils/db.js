'use strict';

const mongoose = require('mongoose');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-db');

function isTransactionUnsupported(error) {
  const message = String(error && error.message ? error.message : '');
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set') ||
    message.includes('mongos') ||
    message.includes('not supported') ||
    message.includes('MongoServerError: Transaction')
  );
}

/**
 * Runs `fn(session)` inside a MongoDB transaction when the deployment supports
 * it. On standalone MongoDB (no replica set) the callback is retried once
 * without a session. Idempotency keys in every mutating flow make the fallback
 * safe if the process dies between writes.
 */
async function withTransaction(fn) {
  if (mongoose.connection.readyState !== 1) return fn(null);
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error;
    log.warn('MongoDB transactions unavailable; using atomic fallback.');
    return fn(null);
  } finally {
    if (session) {
      try { await session.endSession(); } catch { /* ignore */ }
    }
  }
}

function sessionOptions(session) {
  return session ? { session } : {};
}

module.exports = { withTransaction, sessionOptions, isTransactionUnsupported };
