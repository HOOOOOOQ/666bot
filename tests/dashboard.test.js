'use strict';

process.env.DISCORD_TOKEN = 'x';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.MONGODB_URI = 'mongodb://x';
process.env.DASHBOARD_ADMIN_KEY = 'test-admin-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const apiService = require('../src/services/apiService');

function request(method, url, headers = {}, body = '') {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: `10.0.0.${Math.floor(Math.random() * 200) + 1}` };
  req[Symbol.asyncIterator] = async function* chunks() { if (body) yield Buffer.from(body); };
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headersOut) { this.statusCode = code; this.headers = headersOut || {}; },
    end(chunk = '') { this.body += chunk; },
  };
  return { req, res, done: apiService._internal.handleRequest(req, res) };
}

test('dashboard HTML is served at /dashboard and nested routes', async () => {
  for (const path of ['/dashboard', '/dashboard/economy', '/dashboard/drop-rates']) {
    const { res, done } = request('GET', path);
    await done;
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'], /text\/html/);
    assert.match(res.body, /666 SYSTEM/);
  }
});

test('dashboard assets are served with correct content types', async () => {
  const css = request('GET', '/dashboard/assets/styles.css');
  await css.done;
  assert.equal(css.res.statusCode, 200);
  assert.match(css.res.headers['Content-Type'], /text\/css/);
  const js = request('GET', '/dashboard/assets/app.js');
  await js.done;
  assert.equal(js.res.statusCode, 200);
  assert.match(js.res.headers['Content-Type'], /javascript/);
});

test('dashboard API requires the admin key', async () => {
  const config = request('GET', '/api/dashboard/config');
  await config.done;
  assert.equal(config.res.statusCode, 200);
  const unauthorized = request('GET', '/api/dashboard/data?guildId=123456789012345678');
  await unauthorized.done;
  assert.equal(unauthorized.res.statusCode, 401);
});

test('dashboard API rejects invalid settings sections and guild ids', async () => {
  const badGuild = request('GET', '/api/dashboard/settings?guildId=abc', { 'x-admin-key': 'test-admin-key' });
  await badGuild.done;
  assert.equal(badGuild.res.statusCode, 400);
  const noKey = request('PATCH', '/api/dashboard/settings/economy?guildId=123456789012345678', {});
  await noKey.done;
  assert.equal(noKey.res.statusCode, 401);
});

test('admin key can be exchanged for a short-lived session token', async () => {
  const wrong = request('POST', '/api/dashboard/session', { 'content-type': 'application/json' }, JSON.stringify({ adminKey: 'nope' }));
  await wrong.done;
  assert.equal(wrong.res.statusCode, 401);
  const login = request('POST', '/api/dashboard/session', { 'content-type': 'application/json' }, JSON.stringify({ adminKey: 'test-admin-key' }));
  await login.done;
  assert.equal(login.res.statusCode, 200);
  const payload = JSON.parse(login.res.body);
  assert.match(payload.data.token, /^\d+\.[A-Za-z0-9_-]+$/);
  const authed = request('GET', '/api/dashboard/data?guildId=123456789012345678', { authorization: `Bearer ${payload.data.token}` });
  await authed.done;
  assert.notEqual(authed.res.statusCode, 401);
  const tampered = request('GET', '/api/dashboard/data?guildId=123456789012345678', { authorization: `Bearer ${payload.data.token}x` });
  await tampered.done;
  assert.equal(tampered.res.statusCode, 401);
});

test('old public API root still works and remains GET-only', async () => {
  const root = request('GET', '/');
  await root.done;
  assert.equal(root.res.statusCode, 200);
  assert.match(root.res.body, /666/);
  const post = request('POST', '/api/stats');
  await post.done;
  assert.equal(post.res.statusCode, 405);
});
