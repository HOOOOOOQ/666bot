'use strict';

/**
 * Renders the 666 card system and feeds it real Discord avatars.
 *
 * Avatar images are downloaded once, cached in-memory and shared by profiles,
 * leaderboard pages and streak logs. Any avatar failure degrades to a styled
 * initial instead of breaking a command or an automated log.
 */

const { loadImage } = require('@napi-rs/canvas');
const { renderProfileCard } = require('../ui/cards/profileCard');
const { renderLeaderboardCard } = require('../ui/cards/leaderboardCard');
const { renderStreakLogCard } = require('../ui/cards/streakLogCard');
const { registerFonts, loadBackground } = require('../ui/cards/canvasTools');
const { createLogger } = require('../utils/logger');

const log = createLogger('cards');

const AVATAR_TTL_MS = 15 * 60 * 1000;
const AVATAR_FAILURE_TTL_MS = 2 * 60 * 1000;
const AVATAR_CACHE_MAX = 250;
const AVATAR_TIMEOUT_MS = 6000;
const AVATAR_MAX_BYTES = 6 * 1024 * 1024;

const avatarCache = new Map();
const avatarFailures = new Map();

async function defaultAvatarFetcher(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': '666-bot/1.0 (+discord)' },
    });
    if (!response.ok) throw new Error(`avatar HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('empty avatar');
    if (buffer.length > AVATAR_MAX_BYTES) throw new Error('avatar too large');
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

let avatarFetcher = defaultAvatarFetcher;

function setAvatarFetcher(fetcher) {
  avatarFetcher = typeof fetcher === 'function' ? fetcher : defaultAvatarFetcher;
}

function clearAvatarCache() {
  avatarCache.clear();
  avatarFailures.clear();
}

function pruneCache() {
  const now = Date.now();
  for (const [url, entry] of avatarCache) {
    if (entry.expiresAt <= now) avatarCache.delete(url);
  }
  for (const [url, failedAt] of avatarFailures) {
    if (now - failedAt > AVATAR_FAILURE_TTL_MS) avatarFailures.delete(url);
  }
  while (avatarCache.size > AVATAR_CACHE_MAX) {
    const oldest = avatarCache.keys().next().value;
    avatarCache.delete(oldest);
  }
}

async function loadAvatar(url) {
  if (!url) return null;
  const now = Date.now();
  const cached = avatarCache.get(url);
  if (cached && cached.expiresAt > now) return cached.image;

  const failedAt = avatarFailures.get(url);
  if (failedAt && now - failedAt < AVATAR_FAILURE_TTL_MS) return null;

  try {
    const payload = await avatarFetcher(url);
    if (!payload) throw new Error('empty avatar payload');
    const image = await loadImage(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
    avatarCache.set(url, { image, expiresAt: now + AVATAR_TTL_MS });
    avatarFailures.delete(url);
    pruneCache();
    return image;
  } catch (error) {
    avatarFailures.set(url, now);
    log.debug(`Avatar unavailable (${error.message}); using initials.`);
    return null;
  }
}

/**
 * Resolves images for a list of hydrated members, keyed by userId.
 * @param {Array<{userId: string, avatar?: string}>} members
 * @returns {Promise<Map<string, import('@napi-rs/canvas').Image>>}
 */
async function resolveAvatars(members = []) {
  const wanted = new Map();
  for (const member of members) {
    const userId = member?.userId ? String(member.userId) : null;
    if (!userId || !member?.avatar || wanted.has(userId)) continue;
    wanted.set(userId, member.avatar);
  }

  const result = new Map();
  const entries = [...wanted.entries()];
  const concurrency = 6;

  for (let index = 0; index < entries.length; index += concurrency) {
    const batch = entries.slice(index, index + concurrency);
    const images = await Promise.all(batch.map(([, url]) => loadAvatar(url)));
    batch.forEach(([userId], offset) => {
      if (images[offset]) result.set(userId, images[offset]);
    });
  }

  return result;
}

/**
 * @param {object} overview output of profileService.getDuoOverview()
 */
async function renderProfile(overview) {
  const avatars = await resolveAvatars(overview.members);
  return renderProfileCard({
    duo: overview.duo,
    members: overview.members,
    today: overview.today,
    rewardSummary: overview.rewardSummary,
    nextMilestone: overview.nextMilestone,
    timezone: overview.timezone,
    avatars,
  });
}

/**
 * @param {object} data
 * @param {Array<{duo: object, members: Array}>} data.entries hydrated entries
 */
async function renderLeaderboard({
  entries, page, pageCount, total,
}) {
  const members = entries.flatMap((entry) => entry.members || []);
  const avatars = await resolveAvatars(members);
  return renderLeaderboardCard({
    entries,
    page,
    pageCount,
    total,
    avatars,
  });
}

/**
 * @param {object} log persisted StreakLog snapshot
 * @param {{timezone?: string, guildName?: string}} [context]
 */
async function renderStreakLog(log, { timezone, guildName } = {}) {
  const avatars = await resolveAvatars(Array.isArray(log.members) ? log.members : []);
  return renderStreakLogCard({
    log,
    timezone,
    guildName,
    avatars,
  });
}

let warmupPromise = null;

/**
 * Registers bundled fonts and preloads the background plates.
 * Safe to call more than once.
 */
function warmup() {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      registerFonts();
      await Promise.all([
        loadBackground('profile-bg.png'),
        loadBackground('leaderboard-bg.png'),
        loadBackground('log-bg.png'),
      ]);
      log.info('Canvas renderer ready (fonts + background plates loaded).');
    })().catch((error) => {
      warmupPromise = null;
      log.error('Canvas warmup failed; cards will retry on demand.', error);
    });
  }
  return warmupPromise;
}

module.exports = {
  renderProfile,
  renderLeaderboard,
  renderStreakLog,
  resolveAvatars,
  warmup,
  setAvatarFetcher,
  clearAvatarCache,
};
