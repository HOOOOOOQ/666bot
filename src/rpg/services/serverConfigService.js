'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');

const cache = new Map();
const TTL = 5000;

function cached(guildId) {
  const hit = cache.get(String(guildId));
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return null;
}

function remember(guildId, value) {
  cache.set(String(guildId), { value, expiresAt: Date.now() + TTL });
  return value;
}

async function getConfig(guildId) {
  const hit = cached(guildId);
  if (hit) return hit;
  let doc = await models.ServerConfig.findOne({ guildId }).lean();
  if (!doc) {
    try {
      doc = await models.ServerConfig.create({ guildId });
      doc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    } catch (error) {
      if (error.code !== 11000) throw error;
      doc = await models.ServerConfig.findOne({ guildId }).lean();
    }
  }
  return remember(guildId, doc || { guildId, disabledCommands: [], censoredWords: [], rules: [] });
}

async function updateConfig(guildId, patch) {
  const doc = await models.ServerConfig.findOneAndUpdate(
    { guildId },
    { $set: patch, $setOnInsert: { guildId } },
    { upsert: true, new: true, lean: true },
  );
  cache.delete(String(guildId));
  return doc;
}

async function isCommandEnabled(guildId, token) {
  const cfg = await getConfig(guildId).catch(() => null);
  if (!cfg) return true;
  return !(cfg.disabledCommands || []).includes(String(token).toLowerCase());
}

async function toggleCommand(guildId, token, enabled) {
  const name = String(token || '').toLowerCase();
  if (!name) throw new UserError('Tentukan command.');
  const cfg = await getConfig(guildId);
  const list = new Set(cfg.disabledCommands || []);
  if (enabled) list.delete(name); else list.add(name);
  const updated = await updateConfig(guildId, { disabledCommands: [...list] });
  return { enabled, command: name, disabledCommands: updated.disabledCommands };
}

async function setCustomPrefix(guildId, prefix) {
  const value = String(prefix || '').trim();
  if (!/^[!?$%&*+\-.]{1,5}$/.test(value)) throw new UserError('Prefix harus 1–5 karakter simbol (contoh: `!`, `?`, `$`). `6` tetap aktif.');
  return updateConfig(guildId, { customPrefix: value });
}

async function getCustomPrefix(guildId) {
  const cfg = await getConfig(guildId).catch(() => null);
  return cfg?.customPrefix || null;
}

async function setCensor(guildId, enabled) {
  return updateConfig(guildId, { censorEnabled: Boolean(enabled) });
}

async function addCensoredWord(guildId, word) {
  const clean = String(word || '').trim().toLowerCase();
  if (clean.length < 2 || clean.length > 40) throw new UserError('Kata harus 2–40 karakter.');
  const cfg = await getConfig(guildId);
  const words = new Set(cfg.censoredWords || []);
  words.add(clean);
  return updateConfig(guildId, { censoredWords: [...words] });
}

async function removeCensoredWord(guildId, word) {
  const cfg = await getConfig(guildId);
  const words = (cfg.censoredWords || []).filter((entry) => entry !== String(word || '').toLowerCase());
  return updateConfig(guildId, { censoredWords: words });
}

async function setChannel(guildId, type, channelId) {
  const field = type === 'suggestion' ? 'suggestionChannelId' : type === 'announcement' ? 'announcementChannelId' : 'logChannelId';
  return updateConfig(guildId, { [field]: channelId || null });
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function findCensored(guildId, content) {
  const cfg = await getConfig(guildId).catch(() => null);
  if (!cfg?.censorEnabled || !cfg.censoredWords?.length) return null;
  const text = String(content || '');
  return cfg.censoredWords.find((word) => new RegExp(`(^|\\W)${escapeRegex(word)}(\\W|$)`, 'i').test(text)) || null;
}

async function setRules(guildId, rules) {
  return updateConfig(guildId, { rules: rules.slice(0, 20) });
}

module.exports = {
  getConfig, updateConfig, isCommandEnabled, toggleCommand, setCustomPrefix, getCustomPrefix,
  setCensor, addCensoredWord, removeCensoredWord, setChannel, setRules, findCensored,
};
