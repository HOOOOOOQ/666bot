'use strict';

const { RARITY_IDS } = require('../data/rarities');

const DEFAULT_ECONOMY = Object.freeze({
  enabled: true,
  currencyName: '666 Coins',
  startingBalance: 500,
  dailyReward: 250,
  weeklyReward: 1500,
  monthlyReward: 6000,
  workMin: 50,
  workMax: 150,
  workCooldownSec: 3600,
  begMin: 5,
  begMax: 30,
  begCooldownSec: 600,
  transferTaxPct: 2,
  depositLimit: 1000000,
  withdrawLimit: 1000000,
  maxWallet: 100000000,
  taxPct: 2,
});

const DEFAULT_DROP_RATES = Object.freeze({
  monster: Object.freeze({ common: 45, uncommon: 27, rare: 15, epic: 8, legendary: 3.5, mythical: 1.2, secret: 0.3 }),
  pet: Object.freeze({ common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 2.5, mythical: 0.4, secret: 0.1 }),
});

const DEFAULT_GAME = Object.freeze({
  hunting: {
    enabled: true,
    cooldownSec: 60,
    spawnChance: 0.9,
    shinyChance: 1,
    coinMultiplier: 1,
    xpMultiplier: 1,
    maxMonsters: 200,
    sellTaxPct: 5,
  },
  pets: {
    enabled: true,
    eggPrice: 500,
    maxSlots: 3,
    xpMultiplier: 1,
    evolveLevel: 20,
    bonusMultiplier: 1,
    feedCost: 25,
  },
  battle: {
    enabled: true,
    cooldownSec: 120,
    reward: 200,
    xpReward: 50,
    hpMultiplier: 1,
    attackMultiplier: 1,
    defenseMultiplier: 1,
    critChance: 15,
    maxRatingGap: 400,
    challengeExpirySec: 120,
  },
  minigames: {
    enabled: true,
    minBet: 10,
    maxBet: 5000,
    cooldownSec: 10,
    houseEdgePct: 2,
    allowMultiplayer: true,
  },
  market: {
    enabled: true,
    listingFeePct: 2,
    taxPct: 5,
    maxListings: 5,
    listingHours: 72,
    minPrice: 10,
    maxPrice: 10000000,
  },
  guild: {
    enabled: true,
    creationCost: 5000,
    maxMembers: 50,
    upgradeBaseCost: 10000,
    xpMultiplier: 1,
    warMinMembers: 3,
    warMinLevel: 3,
    warReward: 2500,
    warDurationHours: 24,
    season: 'weekly',
  },
  worldBoss: {
    enabled: true,
    baseHp: 100000,
    spawnIntervalMinutes: 360,
    durationMinutes: 180,
    attack: 120,
    defense: 40,
    damageMultiplier: 1,
    xpReward: 120,
    coinReward: 500,
    bossIndex: 0,
  },
  dropRates: DEFAULT_DROP_RATES,
});

const SETTING_SCHEMA = Object.freeze({
  economy: {
    label: 'Economy',
    fields: {
      enabled: { label: 'Economy aktif', type: 'boolean' },
      currencyName: { label: 'Nama mata uang', type: 'string', maxLength: 32 },
      startingBalance: { label: 'Saldo awal', type: 'number', min: 0, max: 1000000, step: 50 },
      dailyReward: { label: 'Reward harian', type: 'number', min: 0, max: 1000000, step: 50 },
      weeklyReward: { label: 'Reward mingguan', type: 'number', min: 0, max: 5000000, step: 100 },
      monthlyReward: { label: 'Reward bulanan', type: 'number', min: 0, max: 20000000, step: 500 },
      workMin: { label: 'Kerja minimal', type: 'number', min: 0, max: 100000, step: 5 },
      workMax: { label: 'Kerja maksimal', type: 'number', min: 1, max: 200000, step: 5 },
      workCooldownSec: { label: 'Cooldown kerja (detik)', type: 'number', min: 10, max: 86400, step: 10 },
      begMin: { label: 'Mengemis minimal', type: 'number', min: 0, max: 10000, step: 1 },
      begMax: { label: 'Mengemis maksimal', type: 'number', min: 1, max: 20000, step: 1 },
      begCooldownSec: { label: 'Cooldown mengemis (detik)', type: 'number', min: 10, max: 86400, step: 10 },
      transferTaxPct: { label: 'Pajak transfer (%)', type: 'number', min: 0, max: 50, step: 0.5 },
      depositLimit: { label: 'Limit deposit', type: 'number', min: 1, max: 1000000000, step: 1000 },
      withdrawLimit: { label: 'Limit withdraw', type: 'number', min: 1, max: 1000000000, step: 1000 },
      maxWallet: { label: 'Maksimal dompet', type: 'number', min: 1, max: 10000000000, step: 10000 },
      taxPct: { label: 'Pajak transaksi (%)', type: 'number', min: 0, max: 50, step: 0.5 },
    },
  },
  hunting: {
    label: 'Hunting',
    fields: {
      enabled: { label: 'Hunting aktif', type: 'boolean' },
      cooldownSec: { label: 'Cooldown hunt (detik)', type: 'number', min: 5, max: 86400, step: 5 },
      spawnChance: { label: 'Peluang spawn (%)', type: 'number', min: 1, max: 100, step: 1 },
      shinyChance: { label: 'Peluang shiny (%)', type: 'number', min: 0, max: 100, step: 0.1 },
      coinMultiplier: { label: 'Multiplier koin', type: 'number', min: 0, max: 100, step: 0.1 },
      xpMultiplier: { label: 'Multiplier EXP', type: 'number', min: 0, max: 100, step: 0.1 },
      maxMonsters: { label: 'Maksimal monster', type: 'number', min: 1, max: 5000, step: 1 },
      sellTaxPct: { label: 'Pajak jual monster (%)', type: 'number', min: 0, max: 50, step: 0.5 },
    },
  },
  pets: {
    label: 'Pet',
    fields: {
      enabled: { label: 'Pet aktif', type: 'boolean' },
      eggPrice: { label: 'Harga telur dasar', type: 'number', min: 0, max: 1000000, step: 50 },
      maxSlots: { label: 'Slot pet aktif', type: 'number', min: 1, max: 10, step: 1 },
      xpMultiplier: { label: 'Multiplier EXP pet', type: 'number', min: 0, max: 100, step: 0.1 },
      evolveLevel: { label: 'Level evolusi', type: 'number', min: 2, max: 100, step: 1 },
      bonusMultiplier: { label: 'Multiplier bonus pet', type: 'number', min: 0, max: 100, step: 0.1 },
      feedCost: { label: 'Biaya feed', type: 'number', min: 0, max: 1000000, step: 5 },
    },
  },
  battle: {
    label: 'Battle',
    fields: {
      enabled: { label: 'Battle aktif', type: 'boolean' },
      cooldownSec: { label: 'Cooldown battle (detik)', type: 'number', min: 5, max: 86400, step: 5 },
      reward: { label: 'Reward koin', type: 'number', min: 0, max: 1000000, step: 10 },
      xpReward: { label: 'Reward EXP', type: 'number', min: 0, max: 100000, step: 5 },
      hpMultiplier: { label: 'Multiplier HP', type: 'number', min: 0.1, max: 100, step: 0.1 },
      attackMultiplier: { label: 'Multiplier ATK', type: 'number', min: 0.1, max: 100, step: 0.1 },
      defenseMultiplier: { label: 'Multiplier DEF', type: 'number', min: 0.1, max: 100, step: 0.1 },
      critChance: { label: 'Peluang crit (%)', type: 'number', min: 0, max: 100, step: 1 },
      maxRatingGap: { label: 'Batas rating', type: 'number', min: 0, max: 10000, step: 50 },
      challengeExpirySec: { label: 'Kedaluwarsa tantangan (detik)', type: 'number', min: 30, max: 3600, step: 10 },
    },
  },
  minigames: {
    label: 'Mini Games',
    fields: {
      enabled: { label: 'Mini games aktif', type: 'boolean' },
      minBet: { label: 'Bet minimal', type: 'number', min: 1, max: 1000000, step: 1 },
      maxBet: { label: 'Bet maksimal', type: 'number', min: 1, max: 10000000, step: 100 },
      cooldownSec: { label: 'Cooldown game (detik)', type: 'number', min: 0, max: 3600, step: 1 },
      houseEdgePct: { label: 'House edge (%)', type: 'number', min: 0, max: 25, step: 0.5 },
      allowMultiplayer: { label: 'Multiplayer aktif', type: 'boolean' },
    },
  },
  market: {
    label: 'Market',
    fields: {
      enabled: { label: 'Market aktif', type: 'boolean' },
      listingFeePct: { label: 'Biaya listing (%)', type: 'number', min: 0, max: 50, step: 0.5 },
      taxPct: { label: 'Pajak penjualan (%)', type: 'number', min: 0, max: 50, step: 0.5 },
      maxListings: { label: 'Maksimal listing/user', type: 'number', min: 1, max: 100, step: 1 },
      listingHours: { label: 'Durasi listing (jam)', type: 'number', min: 1, max: 720, step: 1 },
      minPrice: { label: 'Harga minimal', type: 'number', min: 1, max: 1000000, step: 1 },
      maxPrice: { label: 'Harga maksimal', type: 'number', min: 1, max: 1000000000, step: 1000 },
    },
  },
  guild: {
    label: 'Guild',
    fields: {
      enabled: { label: 'Guild aktif', type: 'boolean' },
      creationCost: { label: 'Biaya membuat guild', type: 'number', min: 0, max: 10000000, step: 500 },
      maxMembers: { label: 'Maksimal anggota', type: 'number', min: 2, max: 500, step: 1 },
      upgradeBaseCost: { label: 'Biaya upgrade dasar', type: 'number', min: 0, max: 100000000, step: 1000 },
      xpMultiplier: { label: 'Multiplier EXP guild', type: 'number', min: 0, max: 100, step: 0.1 },
      warMinMembers: { label: 'Minimal anggota war', type: 'number', min: 1, max: 50, step: 1 },
      warMinLevel: { label: 'Minimal level guild war', type: 'number', min: 1, max: 100, step: 1 },
      warReward: { label: 'Reward war', type: 'number', min: 0, max: 10000000, step: 100 },
      warDurationHours: { label: 'Durasi war (jam)', type: 'number', min: 1, max: 168, step: 1 },
      season: { label: 'Season', type: 'string', maxLength: 16 },
    },
  },
  worldBoss: {
    label: 'World Boss',
    fields: {
      enabled: { label: 'World boss aktif', type: 'boolean' },
      baseHp: { label: 'HP dasar', type: 'number', min: 1000, max: 100000000, step: 1000 },
      spawnIntervalMinutes: { label: 'Interval spawn (menit)', type: 'number', min: 5, max: 10080, step: 5 },
      durationMinutes: { label: 'Durasi boss (menit)', type: 'number', min: 5, max: 1440, step: 5 },
      attack: { label: 'ATK boss', type: 'number', min: 0, max: 100000, step: 10 },
      defense: { label: 'DEF boss', type: 'number', min: 0, max: 100000, step: 10 },
      damageMultiplier: { label: 'Multiplier damage', type: 'number', min: 0.1, max: 100, step: 0.1 },
      xpReward: { label: 'Reward EXP', type: 'number', min: 0, max: 100000, step: 10 },
      coinReward: { label: 'Reward koin', type: 'number', min: 0, max: 10000000, step: 50 },
      bossIndex: { label: 'Index boss', type: 'number', min: 0, max: 99, step: 1 },
    },
  },
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
  const out = clone(base || {});
  if (!patch || typeof patch !== 'object') return out;
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object' && out[key] !== null && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function coerceSection(sectionName, patch, defaults = DEFAULT_GAME) {
  const schema = SETTING_SCHEMA[sectionName];
  if (!schema) throw new Error(`Unknown settings section: ${sectionName}`);
  const base = defaults[sectionName] || {};
  const out = clone(base);
  for (const [key, field] of Object.entries(schema.fields)) {
    if (!(key in (patch || {}))) continue;
    const raw = patch[key];
    if (field.type === 'boolean') {
      out[key] = Boolean(raw);
    } else if (field.type === 'number') {
      const num = Number(raw);
      if (!Number.isFinite(num)) throw new Error(`${field.label} harus berupa angka`);
      out[key] = Math.min(field.max, Math.max(field.min, num));
    } else {
      const str = String(raw ?? '').trim();
      if (field.maxLength && str.length > field.maxLength) throw new Error(`${field.label} terlalu panjang`);
      out[key] = str;
    }
  }
  if (sectionName === 'economy' && out.workMax < out.workMin) throw new Error('workMax harus >= workMin');
  if (sectionName === 'economy' && out.begMax < out.begMin) throw new Error('begMax harus >= begMin');
  if (sectionName === 'minigames' && out.maxBet < out.minBet) throw new Error('maxBet harus >= minBet');
  if (sectionName === 'market' && out.maxPrice < out.minPrice) throw new Error('maxPrice harus >= minPrice');
  return out;
}

function validateDropRates(table, rarityIds = RARITY_IDS) {
  if (!table || typeof table !== 'object') throw new Error('Tabel drop rate tidak valid');
  const keys = Object.keys(table);
  for (const key of keys) {
    if (!rarityIds.includes(key)) throw new Error(`Rarity tidak dikenal: ${key}`);
    const value = Number(table[key]);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Drop rate ${key} harus >= 0`);
  }
  for (const id of rarityIds) {
    if (!(id in table)) throw new Error(`Rarity ${id} belum diisi`);
  }
  const sum = rarityIds.reduce((acc, id) => acc + Number(table[id]), 0);
  if (Math.abs(sum - 100) > 0.001) throw new Error(`Total drop rate harus 100% (sekarang ${sum.toFixed(2)}%)`);
  return true;
}

function normalizeDropRates(input, rarityIds = RARITY_IDS) {
  const out = {};
  for (const id of rarityIds) out[id] = Math.max(0, Number(input?.[id]) || 0);
  return out;
}

module.exports = {
  DEFAULT_ECONOMY,
  DEFAULT_GAME,
  DEFAULT_DROP_RATES,
  SETTING_SCHEMA,
  clone,
  deepMerge,
  coerceSection,
  validateDropRates,
  normalizeDropRates,
};
