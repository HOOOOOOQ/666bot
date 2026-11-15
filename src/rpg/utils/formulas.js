'use strict';

const { RARITY_MAP } = require('../data/rarities');
const { RANKS } = require('../data/catalog');
const { randomFloat } = require('./rng');

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(Math.max(1, level), 1.5));
}

function applyXp(level, xp, amount) {
  let nextLevel = Math.max(1, Math.floor(level || 1));
  let nextXp = Math.max(0, Math.floor(xp || 0)) + Math.max(0, Math.floor(amount || 0));
  let gained = 0;
  while (nextXp >= xpForLevel(nextLevel) && gained < 1000) {
    nextXp -= xpForLevel(nextLevel);
    nextLevel += 1;
    gained += 1;
  }
  return { level: nextLevel, xp: nextXp, levelsGained: gained };
}

function rankForLevel(level) {
  let current = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) current = rank;
  return current;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyTax(amount, percent) {
  const tax = Math.max(0, Math.floor((Number(amount) * Number(percent || 0)) / 100));
  return { tax, net: Math.max(0, Number(amount) - tax) };
}

function monsterStats(species, shiny = false) {
  const rarity = RARITY_MAP[species.rarity] || RARITY_MAP.common;
  const factor = rarity.statMultiplier * (shiny ? 1.35 : 1);
  return {
    hp: Math.round(species.hp * factor),
    attack: Math.round(species.attack * factor),
    defense: Math.round(species.defense * factor),
    speed: Math.round(species.speed * factor),
  };
}

function petStats(species, level = 1) {
  const growth = 1 + Math.max(0, level - 1) * 0.08;
  return {
    hp: Math.round(species.hp * growth),
    attack: Math.round(species.attack * growth),
    defense: Math.round(species.defense * growth),
    speed: Math.round(species.speed * growth),
  };
}

function playerBattleStats(user, pet, settings = {}) {
  const base = {
    hp: 180 + (user.level || 1) * 18,
    attack: 22 + (user.level || 1) * 3,
    defense: 12 + (user.level || 1) * 2,
    speed: 10 + Math.floor((user.level || 1) / 2),
  };
  const pets = Array.isArray(pet) ? pet : (pet ? [pet] : []);
  const petBonus = Number(settings.petBonusMultiplier ?? 1);
  for (const activePet of pets) {
    base.hp += Math.round(activePet.hp * 0.35 * petBonus);
    base.attack += Math.round(activePet.attack * 0.5 * petBonus);
    base.defense += Math.round(activePet.defense * 0.35 * petBonus);
    base.speed += Math.round(activePet.speed * 0.25 * petBonus);
  }
  return {
    hp: Math.round(base.hp * (settings.hpMultiplier || 1)),
    attack: Math.round(base.attack * (settings.attackMultiplier || 1)),
    defense: Math.round(base.defense * (settings.defenseMultiplier || 1)),
    speed: base.speed,
  };
}

function damage(attacker, defender, critChance = 15, rng = randomFloat) {
  const crit = rng() * 100 < critChance;
  const raw = Math.max(1, attacker.attack * (crit ? 1.75 : 1) - defender.defense * 0.55);
  const variance = 0.9 + rng() * 0.2;
  return { value: Math.max(1, Math.round(raw * variance)), crit };
}

function formatCoins(value) {
  return Math.floor(Number(value) || 0).toLocaleString('id-ID');
}

function winChance(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function eloDelta(ratingA, ratingB, score, k = 24) {
  return Math.round(k * (score - winChance(ratingA, ratingB)));
}

module.exports = {
  xpForLevel,
  applyXp,
  rankForLevel,
  clamp,
  applyTax,
  monsterStats,
  petStats,
  playerBattleStats,
  damage,
  formatCoins,
  winChance,
  eloDelta,
};
