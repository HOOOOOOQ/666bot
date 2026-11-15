'use strict';

process.env.DISCORD_TOKEN = 'x';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.MONGODB_URI = 'mongodb://x';
process.env.DASHBOARD_ADMIN_KEY = 'test-admin-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installFakeRPGModels } = require('./helpers/rpgFakeDb');

const models = installFakeRPGModels();
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
const GUILD = '999999999999999999';

function request(method, url, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: `10.8.0.${Math.floor(Math.random() * 200) + 1}` };
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

test('dashboard data endpoint serializes live Mongo-backed collections', async () => {
  await models.RPGUser.create({
    guildId: GUILD, userId: '811111111111111111', username: 'Dash Player',
    wallet: 123, bank: 45, level: 3, huntKills: 2, battleWins: 1,
  });
  const { res, done } = request('GET', `/api/dashboard/data?guildId=${GUILD}`, { 'x-admin-key': 'test-admin-key' });
  await done;
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.overview.players, 1);
  assert.equal(payload.data.overview.coinCirculation, 168);
  assert.ok(Array.isArray(payload.data.charts));
  assert.ok(Array.isArray(payload.data.topPlayers));
  assert.ok(payload.data.boss);
});

test('dashboard settings endpoint returns every editable section', async () => {
  const { res, done } = request('GET', `/api/dashboard/settings?guildId=${GUILD}`, { 'x-admin-key': 'test-admin-key' });
  await done;
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  for (const section of ['economy', 'hunting', 'pets', 'battle', 'minigames', 'market', 'guild', 'worldBoss']) {
    assert.ok(payload.data.schema[section], `missing ${section}`);
  }
  assert.ok(payload.data.dropRates.monster.common > 0);
});

test('dashboard transaction and player endpoints return arrays', async () => {
  const tx = request('GET', `/api/dashboard/transactions?guildId=${GUILD}`, { 'x-admin-key': 'test-admin-key' });
  await tx.done;
  assert.equal(tx.res.statusCode, 200);
  assert.ok(Array.isArray(JSON.parse(tx.res.body).data));
  const players = request('GET', `/api/dashboard/players?guildId=${GUILD}`, { 'x-admin-key': 'test-admin-key' });
  await players.done;
  assert.equal(players.res.statusCode, 200);
  assert.equal(JSON.parse(players.res.body).data.length, 1);
});
