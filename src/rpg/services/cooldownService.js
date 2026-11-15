'use strict';

const models = require('../../database/models');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-cooldown');
const fallback = new Map();

function key(guildId, userId, scope) {
  return `${guildId}:${userId}:${scope}`;
}

function cleanFallback(now) {
  for (const [k, expiresAt] of fallback.entries()) if (expiresAt <= now) fallback.delete(k);
}

/**
 * Distributed cooldown claim. The unique index on (guildId,userId,scope) makes
 * this race-safe across bot instances. Returns { ok, remainingMs, retryAt }.
 */
async function claim(guildId, userId, scope, ms) {
  const now = new Date();
  const ttl = Number.isFinite(Number(ms)) ? Math.max(0, Number(ms)) : 0;
  const expiresAt = new Date(now.getTime() + ttl);

  if (!models.GameCooldown) {
    const k = key(guildId, userId, scope);
    const current = fallback.get(k);
    if (current && current > now.getTime()) return { ok: false, remainingMs: current - now.getTime(), retryAt: new Date(current) };
    fallback.set(k, expiresAt.getTime());
    cleanFallback(now.getTime());
    return { ok: true, remainingMs: 0, retryAt: null };
  }

  try {
    const updated = await models.GameCooldown.findOneAndUpdate(
      { guildId, userId, scope, expiresAt: { $lte: now } },
      { $set: { expiresAt } },
      { new: true },
    );
    if (updated) return { ok: true, remainingMs: 0, retryAt: null };
  } catch (error) {
    log.warn(`Cooldown refresh failed: ${error.message}`);
  }

  try {
    await models.GameCooldown.create({ guildId, userId, scope, expiresAt });
    return { ok: true, remainingMs: 0, retryAt: null };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await models.GameCooldown.findOne({ guildId, userId, scope }).lean();
    if (!existing || new Date(existing.expiresAt).getTime() <= now.getTime()) {
      const updated = await models.GameCooldown.findOneAndUpdate(
        { guildId, userId, scope, expiresAt: { $lte: now } },
        { $set: { expiresAt } },
        { new: true },
      );
      if (updated) return { ok: true, remainingMs: 0, retryAt: null };
    }
    const remainingMs = Math.max(0, new Date(existing?.expiresAt || expiresAt).getTime() - now.getTime());
    return { ok: false, remainingMs, retryAt: new Date(now.getTime() + remainingMs) };
  }
}

async function peek(guildId, userId, scope) {
  if (!models.GameCooldown) {
    const k = key(guildId, userId, scope);
    const current = fallback.get(k) || 0;
    return current > Date.now() ? { active: true, remainingMs: current - Date.now(), retryAt: new Date(current) } : { active: false, remainingMs: 0, retryAt: null };
  }
  const doc = await models.GameCooldown.findOne({ guildId, userId, scope }).lean();
  if (!doc || new Date(doc.expiresAt).getTime() <= Date.now()) return { active: false, remainingMs: 0, retryAt: null };
  return { active: true, remainingMs: new Date(doc.expiresAt).getTime() - Date.now(), retryAt: new Date(doc.expiresAt) };
}

async function clear(guildId, userId, scope) {
  if (!models.GameCooldown) {
    fallback.delete(key(guildId, userId, scope));
    return;
  }
  await models.GameCooldown.deleteOne({ guildId, userId, scope });
}

function secondsLeft(ms) {
  return Math.ceil(ms / 1000);
}

module.exports = { claim, peek, clear, key, secondsLeft };
