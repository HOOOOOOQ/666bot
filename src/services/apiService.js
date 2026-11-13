'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { dbHealth } = require('../database/connection');
const duoService = require('./duoService');
const rewardService = require('./rewardService');
const activityService = require('./activityService');
const configService = require('./configService');
const notificationService = require('./notificationService');

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
    'Access-Control-Allow-Headers': 'content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-api-key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    });
    return res.end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const ip = req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { ok: false, error: 'rate_limited' });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' ) {
    return sendJson(res, 200, {
      ok: true,
      name: '666 BOT • DUO STREAK API',
      tagline: 'TWO MEMBERS. ONE CONNECTION. ONE STREAK.',
      endpoints: ['/health', '/api/stats', '/api/leaderboard', '/api/duo/:userId', '/api/rewards/:userId'],
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
