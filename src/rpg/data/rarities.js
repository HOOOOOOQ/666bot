'use strict';

/** Rarity ladder used by every collection system. Colors use the 666 palette. */
const RARITIES = [
  { id: 'common', label: 'Common', color: 0x8a8f98, emoji: '⚪', weight: 55, coinMultiplier: 1, xpMultiplier: 1, statMultiplier: 1 },
  { id: 'uncommon', label: 'Uncommon', color: 0x4ade80, emoji: '🟢', weight: 25, coinMultiplier: 1.6, xpMultiplier: 1.4, statMultiplier: 1.25 },
  { id: 'rare', label: 'Rare', color: 0x38bdf8, emoji: '🔵', weight: 12, coinMultiplier: 2.6, xpMultiplier: 2, statMultiplier: 1.6 },
  { id: 'epic', label: 'Epic', color: 0xa855f7, emoji: '🟣', weight: 5, coinMultiplier: 4.5, xpMultiplier: 3, statMultiplier: 2.1 },
  { id: 'legendary', label: 'Legendary', color: 0xffb020, emoji: '🟡', weight: 2, coinMultiplier: 8, xpMultiplier: 5, statMultiplier: 2.8 },
  { id: 'mythical', label: 'Mythical', color: 0xff4d6d, emoji: '🔴', weight: 0.8, coinMultiplier: 16, xpMultiplier: 8, statMultiplier: 3.6 },
  { id: 'secret', label: 'Secret', color: 0xff1b3c, emoji: '☠️', weight: 0.2, coinMultiplier: 40, xpMultiplier: 15, statMultiplier: 5 },
];

const RARITY_MAP = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
const RARITY_IDS = RARITIES.map((r) => r.id);

function getRarity(id) {
  return RARITY_MAP[id] || RARITY_MAP.common;
}

module.exports = { RARITIES, RARITY_MAP, RARITY_IDS, getRarity };
