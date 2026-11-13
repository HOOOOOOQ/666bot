'use strict';

const mongoose = require('mongoose');
const models = require('./models');
const { createLogger } = require('../utils/logger');

const log = createLogger('database');

// Indexes are created explicitly at startup (deterministic & production safe)
// instead of relying on Mongoose autoIndex on every connection.
mongoose.set('autoIndex', false);
mongoose.set('strictQuery', true);

let listenersBound = false;

function bindConnectionListeners() {
  if (listenersBound) return;
  listenersBound = true;

  const connection = mongoose.connection;

  connection.on('connected', () => log.info('MongoDB connected.'));
  connection.on('disconnected', () => log.warn('MongoDB disconnected.'));
  connection.on('reconnected', () => log.info('MongoDB reconnected.'));
  connection.on('error', (error) => log.error('MongoDB connection error.', error));
}

/**
 * Ensures every schema index exists. Safe to call multiple times.
 */
async function ensureIndexes() {
  const results = await Promise.allSettled(
    Object.entries(models).map(async ([name, Model]) => {
      await Model.createIndexes();
      return name;
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      log.error('Failed to create indexes.', result.reason);
    }
  }

  const failed = results.filter((result) => result.status === 'rejected').length;
  if (!failed) log.info(`Indexes ready for ${results.length} collections.`);
  return failed === 0;
}

/**
 * Connects to MongoDB and prepares indexes.
 * @param {string} uri
 */
async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is required to connect to the database.');
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  bindConnectionListeners();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
    minPoolSize: 1,
    heartbeatFrequencyMS: 10000,
  });

  log.info('Database handshake complete.');
  await ensureIndexes();

  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  try {
    await mongoose.connection.close(false);
    log.info('MongoDB connection closed.');
  } catch (error) {
    log.error('Failed to close MongoDB connection.', error);
  }
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

function dbHealth() {
  const labels = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    state: labels[mongoose.connection.readyState] || 'unknown',
    ready: isDatabaseReady(),
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  ensureIndexes,
  isDatabaseReady,
  dbHealth,
};
