'use strict';

process.env.DISCORD_TOKEN = 'x';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.MONGODB_URI = 'mongodb://x';
process.env.API_KEY = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installFakeDatabase } = require('./helpers/fakeDb');

installFakeDatabase();

const connectionPath = require.resolve('../src/database/connection');
const realConnection = require('../src/database/connection');
require.cache[connectionPath] = {
  id: connectionPath,
  filename: connectionPath,
  loaded: true,
  exports: { ...realConnection, dbHealth: () => ({ ready: true }), isDatabaseReady: () => true },
  children: [],
  paths: [],
};

const apiService = require('../src/services/apiService');

function request(method, url, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: `10.9.0.${Math.floor(Math.random() * 200) + 1}` };
  req[Symbol.asyncIterator] = async function* empty() {};
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, outgoing) { this.statusCode = code; this.headers = outgoing || {}; },
    end(chunk = '') { this.body += chunk; },
  };
  return { res, done: apiService._internal.handleRequest(req, res) };
}

test('streak API root exposes only streak endpoints', async () => {
  const { res, done } = request('GET', '/');
  await done;
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.match(payload.name, /DUO STREAK/);
  assert.ok(payload.endpoints.includes('/api/leaderboard'));
  assert.equal(payload.dashboard, undefined);
});

test('dashboard and public website routes are removed', async () => {
  for (const path of ['/dashboard', '/dashboard/economy', '/site/', '/site/help/']) {
    const { res, done } = request('GET', path);
    await done;
    assert.equal(res.statusCode, 404, path);
  }
});

test('streak API validates commands and guild parameters', async () => {
  const post = request('POST', '/api/stats');
  await post.done;
  assert.equal(post.res.statusCode, 405);

  const leaderboard = request('GET', '/api/leaderboard');
  await leaderboard.done;
  assert.equal(leaderboard.res.statusCode, 400);
  assert.equal(JSON.parse(leaderboard.res.body).error, 'guildId_required');
});

test('health endpoint reports the bot and database state', async () => {
  const { res, done } = request('GET', '/health');
  await done;
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'online');
});
