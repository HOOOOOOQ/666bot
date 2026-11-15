'use strict';

const models = require('../../database/models');
const {
  DEFAULT_ECONOMY,
  DEFAULT_GAME,
  DEFAULT_DROP_RATES,
  SETTING_SCHEMA,
  clone,
  deepMerge,
  coerceSection,
  validateDropRates,
  normalizeDropRates,
} = require('../config/defaults');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-settings');
const CACHE_TTL_MS = 5000;
const cache = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function invalidate(guildId) {
  if (!guildId) cache.clear();
  else for (const key of [...cache.keys()]) if (key.startsWith(`${guildId}:`)) cache.delete(key);
}

async function getEconomy(guildId) {
  if (!models.EconomySettings) return clone(DEFAULT_ECONOMY);
  return cached(`${guildId}:economy`, async () => {
    const doc = await models.EconomySettings.findOne({ guildId }).lean();
    return coerceSection('economy', doc || {}, { economy: DEFAULT_ECONOMY });
  });
}

async function getGame(guildId) {
  if (!models.GameSettings) return clone(DEFAULT_GAME);
  return cached(`${guildId}:game`, async () => {
    const doc = await models.GameSettings.findOne({ guildId }).lean();
    const merged = deepMerge(DEFAULT_GAME, doc || {});
    merged.dropRates = deepMerge(DEFAULT_DROP_RATES, doc?.dropRates || {});
    return merged;
  });
}

async function getDropRates(guildId) {
  const game = await getGame(guildId);
  return game.dropRates;
}

async function saveHistory(guildId, section, before, after, actor) {
  if (!models.SettingsHistory) return;
  try {
    await models.SettingsHistory.create({
      guildId,
      section,
      actor: actor || 'system',
      before: before || {},
      after: after || {},
    });
  } catch (error) {
    log.warn(`Failed to write settings history: ${error.message}`);
  }
}

async function updateEconomy(guildId, patch, actor) {
  const before = await getEconomy(guildId);
  const after = coerceSection('economy', patch, { economy: before });
  if (models.EconomySettings) {
    await models.EconomySettings.findOneAndUpdate(
      { guildId },
      { $set: { ...after, updatedBy: actor || 'dashboard' }, $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
  }
  invalidate(guildId);
  await saveHistory(guildId, 'economy', before, after, actor);
  return after;
}

async function updateSection(guildId, section, patch, actor) {
  if (!SETTING_SCHEMA[section]) throw new Error(`Section tidak dikenal: ${section}`);
  const before = (await getGame(guildId))[section];
  const after = coerceSection(section, patch, { [section]: before });
  if (models.GameSettings) {
    await models.GameSettings.findOneAndUpdate(
      { guildId },
      { $set: { [section]: after, updatedBy: actor || 'dashboard', version: Date.now() }, $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
  }
  invalidate(guildId);
  await saveHistory(guildId, section, before, after, actor);
  return after;
}

async function updateDropRates(guildId, payload, actor) {
  const before = await getDropRates(guildId);
  const next = clone(before);
  const tables = ['monster', 'pet'];
  for (const table of tables) {
    if (payload?.[table] === undefined) continue;
    validateDropRates(payload[table]);
    next[table] = normalizeDropRates(payload[table]);
  }
  if (models.GameSettings) {
    await models.GameSettings.findOneAndUpdate(
      { guildId },
      { $set: { dropRates: next, updatedBy: actor || 'dashboard', version: Date.now() }, $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
  }
  invalidate(guildId);
  await saveHistory(guildId, 'dropRates', before, next, actor);
  return next;
}

async function resetSection(guildId, section, actor) {
  if (section === 'economy') return updateEconomy(guildId, DEFAULT_ECONOMY, actor);
  if (section === 'dropRates') return updateDropRates(guildId, DEFAULT_DROP_RATES, actor);
  if (!SETTING_SCHEMA[section]) throw new Error(`Section tidak dikenal: ${section}`);
  return updateSection(guildId, section, DEFAULT_GAME[section], actor);
}

async function getHistory(guildId, limit = 20) {
  if (!models.SettingsHistory) return [];
  const docs = await models.SettingsHistory.find({ guildId }).sort({ createdAt: -1 }).limit(Math.min(100, limit)).lean();
  return docs || [];
}

async function getAll(guildId) {
  const [economy, game] = await Promise.all([getEconomy(guildId), getGame(guildId)]);
  return { economy, game, schema: SETTING_SCHEMA };
}

module.exports = {
  getEconomy,
  getGame,
  getDropRates,
  updateEconomy,
  updateSection,
  updateDropRates,
  resetSection,
  getHistory,
  getAll,
  invalidate,
  SETTING_SCHEMA,
  DEFAULT_ECONOMY,
  DEFAULT_GAME,
  DEFAULT_DROP_RATES,
};
