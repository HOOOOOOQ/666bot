'use strict';

const crypto = require('node:crypto');

/**
 * Cryptographically secure RNG. Every game outcome goes through this module so
 * there is a single auditable source of randomness (no hidden outcome control).
 */
function randomInt(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('randomInt: invalid range');
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  if (hi < lo) return lo;
  return crypto.randomInt(lo, hi + 1);
}

function randomFloat() {
  return crypto.randomInt(0, 1000000) / 1000000;
}

function chance(percent) {
  return randomFloat() * 100 < Number(percent);
}

function pick(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[randomInt(0, list.length - 1)];
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedPick(entries) {
  const list = (entries || []).filter((entry) => Number(entry.weight) > 0);
  if (list.length === 0) return null;
  const total = list.reduce((sum, entry) => sum + Number(entry.weight), 0);
  let roll = randomFloat() * total;
  for (const entry of list) {
    roll -= Number(entry.weight);
    if (roll < 0) return entry.value ?? entry;
  }
  return list[list.length - 1].value ?? list[list.length - 1];
}

function weightedPickTable(table, items) {
  const entries = items
    .map((item) => ({ value: item, weight: Number(table?.[item.rarity]) || 0 }))
    .filter((entry) => entry.weight > 0);
  return weightedPick(entries);
}

module.exports = { randomInt, randomFloat, chance, pick, shuffle, weightedPick, weightedPickTable };
