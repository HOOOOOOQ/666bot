'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { dbHealth } = require('../database/connection');
const duoService = require('./duoService');
const rewardService = require('./rewardService');
const activityService = require('./activityService');
const configService = require('./configService');
const notificationService = require('./notificationService');
const settingsService = require('../rpg/services/settingsService');
const statsService = require('../rpg/services/statsService');
const bossService = require('../rpg/services/worldBossService');
const marketService = require('../rpg/services/marketService');
const guildService = require('../rpg/services/guildService');
const models = require('../database/models');

const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');
const WEB_DIR = path.join(__dirname, '..', '..', 'web');
const WEB_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
};
const STATIC_FILES = {
  '/dashboard/assets/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/dashboard/assets/app.js': ['app.js', 'application/javascript; charset=utf-8'],
};

const log = createLogger('api');

let server = null;
let startedAt = null;
let client = null;

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 90;

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.windowStart > RATE_WINDOW_MS) rateBuckets.delete(ip);
  }
}, 5 * 60 * 1000);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-api-key, x-admin-key, authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function isAuthorized(req, url) {
  if (!config.api.key) return true;
  const header = req.headers['x-api-key'];
  const key = Array.isArray(header) ? header[0] : header;
  return key === config.api.key || url.searchParams.get('key') === config.api.key;
}

function isRateLimited(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function serializeDuo(duo) {
  if (!duo) return null;
  return {
    id: String(duo._id),
    guildId: duo.guildId,
    name: duo.name,
    status: duo.status,
    members: (duo.members || []).map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      avatar: member.avatar,
    })),
    currentStreak: duo.currentStreak,
    bestStreak: duo.bestStreak,
    totalDays: duo.totalDays,
    xp: duo.xp,
    lastCompletedDay: duo.lastCompletedDay,
    streakStartedAt: duo.streakStartedAt,
    createdAt: duo.createdAt,
    brokenAt: duo.brokenAt,
  };
}

async function readBody(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error('Payload terlalu besar.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try { return text ? JSON.parse(text) : {}; } catch {
    const error = new Error('JSON tidak valid.');
    error.statusCode = 400;
    throw error;
  }
}

function createSessionToken() {
  if (!config.web.adminKey) return null;
  const expiresAt = Date.now() + config.web.sessionHours * 3600 * 1000;
  const payload = String(expiresAt);
  const sig = crypto.createHmac('sha256', config.web.adminKey).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt: new Date(expiresAt).toISOString() };
}

function verifySessionToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !config.web.adminKey) return false;
  const expected = crypto.createHmac('sha256', config.web.adminKey).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(payload) > Date.now();
}

function dashboardAuthorized(req) {
  if (!config.web.adminKey) return false;
  const header = req.headers['x-admin-key'] || req.headers.authorization || '';
  const key = Array.isArray(header) ? header[0] : String(header);
  if (key === config.web.adminKey) return true;
  const bearer = key.startsWith('Bearer ') ? key.slice(7) : '';
  return Boolean(bearer) && (bearer === config.web.adminKey || verifySessionToken(bearer));
}

async function dashboardData(guildId) {
  const [overview, charts, topPlayers, guilds, listings, boss, transactions, recentBattles, recentGames, quests] = await Promise.all([
    statsService.overview(guildId || null),
    statsService.charts(guildId || null, 7),
    statsService.topPlayers(guildId || null, 10),
    guildService.leaderboard(guildId, 10).catch(() => []),
    marketService.list(guildId, 15, 1).catch(() => ({ listings: [] })),
    guildId ? bossService.getStatus(guildId, false).catch(() => ({ boss: null, contributors: [] })) : Promise.resolve({ boss: null, contributors: [] }),
    models.EconomyTransaction.find(guildId ? { guildId } : {}).sort({ createdAt: -1 }).limit(20).lean().catch(() => []),
    models.Battle.find(guildId ? { guildId } : {}).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    models.GameHistory.find(guildId ? { guildId } : {}).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    models.Quest.find(guildId ? { guildId } : {}).sort({ updatedAt: -1 }).limit(10).lean().catch(() => []),
  ]);
  const topHunters = await models.RPGUser.find(guildId ? { guildId } : {}).sort({ huntKills: -1 }).limit(10).lean().catch(() => []);
  const topBattlers = await models.RPGUser.find(guildId ? { guildId } : {}).sort({ battleRating: -1 }).limit(10).lean().catch(() => []);
  const topBoss = await models.WorldBossContribution.find(guildId ? { guildId } : {}).sort({ damage: -1 }).limit(10).lean().catch(() => []);
  return { overview, charts, topPlayers, topHunters, topBattlers, topBoss, guilds, listings: listings.listings || [], boss, transactions, recentBattles, recentGames, quests };
}

async function serveWebAsset(res, relativePath, cacheControl = 'public, max-age=300') {
  const base = path.resolve(WEB_DIR);
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    sendJson(res, 403, { ok: false, error: 'forbidden' });
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const type = WEB_TYPES[ext];
  if (!type) {
    sendJson(res, 404, { ok: false, error: 'asset_not_found' });
    return;
  }
  try {
    const content = await fs.readFile(target);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    res.end(content);
  } catch {
    sendJson(res, 404, { ok: false, error: 'asset_not_found' });
  }
}

async function handleWebRequest(req, res, pathName, rawPath = pathName) {
  if (!config.web.enabled) return false;
  if (pathName !== '/site' && !pathName.startsWith('/site/')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return true;
  }
  if (rawPath === '/site') {
    res.writeHead(301, { Location: '/site/' });
    res.end();
    return true;
  }
  if (rawPath === '/site/' || pathName === '/site/' || pathName === '/site/index.html') {
    await serveWebAsset(res, 'index.html', 'no-cache');
    return true;
  }
  if (rawPath === '/site/help/') {
    await serveWebAsset(res, path.join('help', 'index.html'), 'no-cache');
    return true;
  }
  if (rawPath === '/site/help' || pathName === '/site/help') {
    res.writeHead(301, { Location: '/site/help/' });
    res.end();
    return true;
  }
  if (pathName === '/site/commands.json') {
    await serveWebAsset(res, 'commands.json', 'no-cache');
    return true;
  }
  if (pathName === '/site/robots.txt') {
    await serveWebAsset(res, 'robots.txt', 'public, max-age=3600');
    return true;
  }
  if (pathName.startsWith('/site/assets/')) {
    await serveWebAsset(res, path.join('assets', pathName.slice('/site/assets/'.length)));
    return true;
  }
  sendJson(res, 404, { ok: false, error: 'not_found' });
  return true;
}

async function handleDashboardRequest(req, res, url, pathName) {
  if (!config.web.enabled) return false;

  if (pathName === '/dashboard' || pathName === '/dashboard/' || pathName.startsWith('/dashboard/')) {
    const staticFile = STATIC_FILES[pathName];
    if (staticFile) {
      try {
        const content = await fs.readFile(path.join(DASHBOARD_DIR, staticFile[0]));
        res.writeHead(200, { 'Content-Type': staticFile[1], 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
        res.end(content);
      } catch {
        sendJson(res, 404, { ok: false, error: 'asset_not_found' });
      }
      return true;
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return true;
    }
    try {
      const html = await fs.readFile(path.join(DASHBOARD_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
    } catch (error) {
      log.error('Dashboard HTML missing.', error);
      sendJson(res, 500, { ok: false, error: 'dashboard_unavailable' });
    }
    return true;
  }

  if (!pathName.startsWith('/api/dashboard')) return false;

  if (pathName === '/api/dashboard/config') {
    sendJson(res, 200, {
      ok: true,
      data: {
        guildId: config.web.defaultGuildId,
        adminRequired: true,
        adminKeyConfigured: Boolean(config.web.adminKey),
        adminKeyDefaultWarning: config.web.adminKey === '666-admin',
        sections: Object.keys(settingsService.SETTING_SCHEMA),
      },
    });
    return true;
  }

  if (pathName === '/api/dashboard/session' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.adminKey !== config.web.adminKey) {
        sendJson(res, 401, { ok: false, error: 'admin_unauthorized' });
        return true;
      }
      const session = createSessionToken();
      sendJson(res, 200, { ok: true, data: session });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'invalid_body', message: error.message });
    }
    return true;
  }

  if (!dashboardAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: 'admin_unauthorized', hint: 'Kirim header x-admin-key (DASHBOARD_ADMIN_KEY) atau Bearer session token.' });
    return true;
  }

  const guildId = url.searchParams.get('guildId') || config.web.defaultGuildId || null;
  if (guildId && !/^\d{17,20}$/.test(guildId)) {
    sendJson(res, 400, { ok: false, error: 'invalid_guild_id' });
    return true;
  }

  if (!dbHealth().ready) {
    sendJson(res, 503, { ok: false, error: 'database_unavailable', message: 'MongoDB belum terhubung.' });
    return true;
  }

  try {
    if (pathName === '/api/dashboard/data' && req.method === 'GET') {
      const data = await dashboardData(guildId);
      sendJson(res, 200, { ok: true, guildId, data, timestamp: new Date().toISOString() });
      return true;
    }
    if (pathName === '/api/dashboard/settings' && req.method === 'GET') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      const data = await settingsService.getAll(guildId);
      const history = await settingsService.getHistory(guildId, 20);
      const dropRates = data.game.dropRates;
      sendJson(res, 200, { ok: true, data: { ...data, history, dropRates }, dropRates });
      return true;
    }
    if (pathName === '/api/dashboard/drop-rates' && req.method === 'GET') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      sendJson(res, 200, { ok: true, data: await settingsService.getDropRates(guildId) });
      return true;
    }
    if (pathName === '/api/dashboard/drop-rates' && req.method === 'PATCH') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      const body = await readBody(req);
      const data = await settingsService.updateDropRates(guildId, body, 'dashboard');
      sendJson(res, 200, { ok: true, data });
      return true;
    }
    if (pathName === '/api/dashboard/drop-rates/reset' && req.method === 'POST') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      const data = await settingsService.resetSection(guildId, 'dropRates', 'dashboard');
      sendJson(res, 200, { ok: true, data });
      return true;
    }
    if (pathName === '/api/dashboard/history' && req.method === 'GET') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      sendJson(res, 200, { ok: true, data: await settingsService.getHistory(guildId, 50) });
      return true;
    }
    if (pathName === '/api/dashboard/transactions' && req.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
      const filter = guildId ? { guildId } : {};
      if (url.searchParams.get('userId')) filter.userId = url.searchParams.get('userId');
      if (url.searchParams.get('type')) filter.type = url.searchParams.get('type');
      const docs = await models.EconomyTransaction.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      sendJson(res, 200, { ok: true, data: docs });
      return true;
    }
    if (pathName === '/api/dashboard/players' && req.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
      const docs = await models.RPGUser.find(guildId ? { guildId } : {}).sort({ wallet: -1 }).limit(limit).lean();
      sendJson(res, 200, { ok: true, data: docs });
      return true;
    }
    const settingsMatch = /^\/api\/dashboard\/settings\/([A-Za-z]+)$/.exec(pathName);
    if (settingsMatch) {
      const section = settingsMatch[1];
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      if (req.method === 'PATCH') {
        const body = await readBody(req);
        const values = body.values || body;
        const data = section === 'economy'
          ? await settingsService.updateEconomy(guildId, values, 'dashboard')
          : await settingsService.updateSection(guildId, section, values, 'dashboard');
        sendJson(res, 200, { ok: true, data });
        return true;
      }
      if (req.method === 'POST' && /\/reset$/.test(pathName)) {
        const data = await settingsService.resetSection(guildId, section, 'dashboard');
        sendJson(res, 200, { ok: true, data });
        return true;
      }
    }
    const resetMatch = /^\/api\/dashboard\/settings\/([A-Za-z]+)\/reset$/.exec(pathName);
    if (resetMatch && req.method === 'POST') {
      if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' }), true;
      const data = await settingsService.resetSection(guildId, resetMatch[1], 'dashboard');
      sendJson(res, 200, { ok: true, data });
      return true;
    }
    sendJson(res, 404, { ok: false, error: 'dashboard_route_not_found' });
  } catch (error) {
    sendJson(res, error.statusCode || 400, { ok: false, error: 'dashboard_request_failed', message: error.message });
  }
  return true;
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-api-key, x-admin-key, authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    });
    return res.end();
  }

  const ip = req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { ok: false, error: 'rate_limited' });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rawPath = url.pathname || '/';
  const path = rawPath.replace(/\/+$/, '') || '/';

  if (await handleWebRequest(req, res, path, rawPath)) return;
  if (await handleDashboardRequest(req, res, url, path)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  if (path === '/' && String(req.headers.accept || '').includes('text/html')) {
    res.writeHead(302, { Location: '/site/' });
    return res.end();
  }

  if (path === '/' ) {
    return sendJson(res, 200, {
      ok: true,
      name: '666 BOT • DUO STREAK API',
      tagline: 'TWO MEMBERS. ONE CONNECTION. ONE STREAK.',
      endpoints: ['/health', '/api/stats', '/api/leaderboard', '/api/duo/:userId', '/api/rewards/:userId'],
      dashboard: '/dashboard',
    });
  }

  if (path === '/health') {
    return sendJson(res, dbHealth().ready ? 200 : 503, {
      ok: dbHealth().ready,
      status: dbHealth().ready ? 'online' : 'degraded',
      uptimeSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
      bot: client?.user ? {
        id: client.user.id,
        tag: client.user.tag,
        ping: client.ws.ping,
        guilds: client.guilds.cache.size,
      } : null,
      database: dbHealth(),
      notificationsQueued: notificationService.getQueueSize(),
      timestamp: new Date().toISOString(),
    });
  }

  if (!path.startsWith('/api/')) {
    return sendJson(res, 404, { ok: false, error: 'not_found' });
  }

  if (!isAuthorized(req, url)) {
    return sendJson(res, 401, { ok: false, error: 'unauthorized' });
  }

  if (!dbHealth().ready) {
    return sendJson(res, 503, { ok: false, error: 'database_unavailable' });
  }

  const guildId = url.searchParams.get('guildId');

  if (path === '/api/stats') {
    const stats = await duoService.getGlobalStats(guildId);
    return sendJson(res, 200, { ok: true, data: stats, timestamp: new Date().toISOString() });
  }

  if (path === '/api/leaderboard') {
    if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' });
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit')) || 10));
    const category = url.searchParams.get('category') || 'current';
    const board = await duoService.getLeaderboard({ guildId, category, page: 0, pageSize: limit });
    return sendJson(res, 200, {
      ok: true,
      category: board.category,
      total: board.total,
      data: board.entries.map((entry, index) => ({ rank: index + 1, ...serializeDuo(entry) })),
    });
  }

  const duoMatch = /^\/api\/duo\/(\d{17,20})$/.exec(path);
  if (duoMatch) {
    if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' });
    const duo = await duoService.getActiveDuoForUser(guildId, duoMatch[1], { fresh: true });
    if (!duo) return sendJson(res, 404, { ok: false, error: 'duo_not_found' });
    const guildConfig = await configService.getGuildConfig(guildId);
    const [today, rewards] = await Promise.all([
      activityService.getTodayStatus(duo, guildConfig.timezone),
      rewardService.getRewardSummary(duo),
    ]);
    return sendJson(res, 200, {
      ok: true,
      data: {
        ...serializeDuo(duo),
        timezone: guildConfig.timezone,
        today: {
          dayKey: today.dayKey,
          bothCompleted: today.bothCompleted,
          members: today.members.map((entry) => ({
            userId: entry.userId,
            completed: entry.completed,
            completedAt: entry.completedAt,
          })),
        },
        rewards: rewards.list.map((reward) => ({
          milestone: reward.days,
          name: reward.name,
          unlocked: reward.unlocked,
          grantedAt: reward.grantedAt,
        })),
      },
    });
  }

  const rewardsMatch = /^\/api\/rewards\/(\d{17,20})$/.exec(path);
  if (rewardsMatch) {
    if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId_required' });
    const duo = await duoService.getActiveDuoForUser(guildId, rewardsMatch[1], { fresh: true });
    if (!duo) return sendJson(res, 404, { ok: false, error: 'duo_not_found' });
    const summary = await rewardService.getRewardSummary(duo);
    return sendJson(res, 200, {
      ok: true,
      data: {
        unlocked: summary.unlocked,
        total: summary.total,
        highest: summary.highest,
        rewards: summary.list,
      },
    });
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
}

/**
 * Starts the optional HTTP Streak API (useful for uptime checks / dashboards).
 * Failure to bind the port never prevents the bot from running.
 */
function start(discordClient = null) {
  client = discordClient;
  if (!config.api.enabled) {
    log.info('Streak API disabled (ENABLE_API=false).');
    return null;
  }
  if (server) return server;

  startedAt = Date.now();
  if (config.web.adminKey === '666-admin') {
    log.warn('DASHBOARD_ADMIN_KEY belum diset — memakai default 666-admin. Ganti di production!');
  }
  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      log.error('API request failed.', error);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'internal_error' });
      else res.end();
    });
  });

  server.on('error', (error) => {
    log.error(`Streak API server error: ${error.message}`);
    server = null;
  });

  server.listen(config.api.port, config.api.host, () => {
    log.info(`Streak API listening on http://${config.api.host}:${config.api.port}`);
  });

  return server;
}

function stop() {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(() => {
      server = null;
      log.info('Streak API stopped.');
      resolve();
    });
    setTimeout(resolve, 3000).unref?.();
  });
}

module.exports = {
  start,
  stop,
  serializeDuo,
  _internal: { handleRequest, isAuthorized, isRateLimited, sendJson },
};
