'use strict';

const { RARITY_MAP, RARITIES } = require('./rarities');

function art(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256&backgroundColor=0b0b0f,150406,1a0505`;
}

function monster(id, name, rarity, hp, attack, defense, speed, coins) {
  return {
    id,
    name,
    rarity,
    hp,
    attack,
    defense,
    speed,
    coins,
    image: art('bottts', `666-${id}`),
  };
}

const MONSTERS = [
  monster('slime', 'Crimson Slime', 'common', 40, 8, 4, 5, 25),
  monster('goblin', 'Ash Goblin', 'common', 55, 11, 6, 7, 30),
  monster('bat', 'Night Bat', 'common', 35, 12, 3, 12, 28),
  monster('rat', 'Sewer Rat', 'common', 38, 9, 4, 9, 22),
  monster('mushroom', 'Toxic Shroom', 'common', 48, 7, 8, 3, 26),
  monster('skeleton', 'Bone Walker', 'common', 60, 10, 7, 6, 32),
  monster('imp', 'Ember Imp', 'common', 42, 13, 5, 10, 34),
  monster('wolf', 'Grey Wolf', 'common', 58, 14, 6, 13, 36),

  monster('orc', 'Iron Orc', 'uncommon', 100, 22, 14, 8, 70),
  monster('golem', 'Stone Golem', 'uncommon', 140, 18, 24, 3, 78),
  monster('harpy', 'Storm Harpy', 'uncommon', 90, 26, 9, 20, 74),
  monster('lizardman', 'Lizardman Raider', 'uncommon', 110, 24, 13, 14, 76),
  monster('spider', 'Spider Queen', 'uncommon', 105, 28, 11, 17, 82),
  monster('werewolf', 'Werewolf', 'uncommon', 125, 30, 12, 18, 88),

  monster('wyvern', 'Blood Wyvern', 'rare', 210, 48, 24, 28, 190),
  monster('necromancer', 'Necromancer', 'rare', 180, 58, 18, 20, 205),
  monster('chimera', 'Chimera', 'rare', 240, 45, 30, 22, 210),
  monster('icefiend', 'Ice Fiend', 'rare', 200, 52, 26, 24, 200),
  monster('wraith', 'Sand Wraith', 'rare', 175, 62, 16, 32, 220),

  monster('vampire', 'Vampire Lord', 'epic', 360, 86, 42, 36, 520),
  monster('thunderdrake', 'Thunder Drake', 'epic', 390, 94, 38, 40, 560),
  monster('abyssknight', 'Abyss Knight', 'epic', 430, 78, 58, 26, 540),
  monster('hellhound', 'Infernal Hound', 'epic', 340, 102, 34, 48, 580),

  monster('cerberus', 'Cerberus', 'legendary', 680, 150, 82, 58, 1600),
  monster('shadowdragon', 'Shadow Dragon', 'legendary', 760, 168, 76, 52, 1800),
  monster('titan', 'Fallen Titan', 'legendary', 900, 140, 110, 34, 1750),

  monster('voidserpent', 'Void Serpent', 'mythical', 1400, 260, 150, 90, 5200),
  monster('chronos', 'Chronos Beast', 'mythical', 1250, 290, 130, 105, 5600),

  monster('demonking', '666 Demon King', 'secret', 2600, 420, 240, 140, 18000),
];

const MONSTER_MAP = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

function pet(id, name, rarity, hp, attack, defense, speed, skill, skillText) {
  return {
    id,
    name,
    rarity,
    hp,
    attack,
    defense,
    speed,
    skill,
    skillText,
    image: art('fun-emoji', `pet-${id}`),
  };
}

const PETS = [
  pet('emberpup', 'Ember Pup', 'common', 50, 12, 8, 14, 'burn', 'Burn: +8% damage'),
  pet('shadowcat', 'Shadow Cat', 'common', 45, 14, 6, 18, 'evade', 'Evade: 6% dodge'),
  pet('mossling', 'Mossling', 'common', 65, 8, 14, 6, 'regen', 'Regen: heal 4% per turn'),
  pet('sparkbat', 'Spark Bat', 'common', 40, 16, 5, 20, 'shock', 'Shock: 8% crit bonus'),

  pet('ironbeak', 'Iron Beak', 'uncommon', 95, 26, 18, 22, 'pierce', 'Pierce: ignore 12% DEF'),
  pet('frostfox', 'Frost Fox', 'uncommon', 85, 30, 15, 26, 'freeze', 'Freeze: 10% skip chance'),
  pet('stonepup', 'Stone Pup', 'uncommon', 120, 22, 28, 12, 'guard', 'Guard: -10% incoming damage'),

  pet('blazehound', 'Blaze Hound', 'rare', 170, 55, 32, 38, 'inferno', 'Inferno: +18% damage'),
  pet('voidowl', 'Void Owl', 'rare', 150, 62, 26, 44, 'curse', 'Curse: lower enemy ATK 10%'),
  pet('seadrake', 'Sea Drake', 'rare', 195, 48, 40, 30, 'tide', 'Tide: heal 8% per turn'),

  pet('thunderlion', 'Thunder Lion', 'epic', 290, 96, 62, 54, 'storm', 'Storm: 20% double strike'),
  pet('abysswolf', 'Abyss Wolf', 'epic', 270, 108, 54, 62, 'rend', 'Rend: bleed 6% max HP'),

  pet('phoenix', 'Blood Phoenix', 'legendary', 430, 160, 92, 88, 'rebirth', 'Rebirth: revive once at 25%'),
  pet('voiddragon', 'Void Dragon', 'mythical', 720, 260, 160, 110, 'annihilate', 'Annihilate: +35% damage'),
  pet('demoncat', '666 Demon Cat', 'secret', 1100, 380, 220, 150, 'apocalypse', 'Apocalypse: +60% damage'),
];

const PET_MAP = Object.fromEntries(PETS.map((p) => [p.id, p]));

const EGGS = [
  { id: 'egg_basic', name: 'Egg Basic', price: 500, style: 'common', rates: { common: 55, uncommon: 28, rare: 12, epic: 4, legendary: 0.9, mythical: 0.1, secret: 0 } },
  { id: 'egg_rare', name: 'Egg Rare', price: 2500, style: 'rare', rates: { common: 20, uncommon: 32, rare: 28, epic: 14, legendary: 5, mythical: 0.9, secret: 0.1 } },
  { id: 'egg_legendary', name: 'Egg Legendary', price: 10000, style: 'legendary', rates: { common: 0, uncommon: 10, rare: 30, epic: 35, legendary: 20, mythical: 4.5, secret: 0.5 } },
];

const EGGS_MAP = Object.fromEntries(EGGS.map((e) => [e.id, e]));

const SHOP_ITEMS = [
  { id: 'potion', name: 'Blood Potion', type: 'consumable', price: 120, emoji: '🧪', description: 'Heal 30% HP di battle berikutnya.', effect: { battleHealPct: 30 } },
  { id: 'bait', name: 'Hunt Bait', type: 'consumable', price: 180, emoji: '🪱', description: '+15% spawn chance pada hunt berikutnya.', effect: { spawnBonusPct: 15 } },
  { id: 'charm', name: 'Lucky Charm', type: 'consumable', price: 450, emoji: '🍀', description: '+3% peluang rarity tinggi pada hunt berikutnya.', effect: { luckBonusPct: 3 } },
  { id: 'pet_food', name: 'Pet Food', type: 'consumable', price: 60, emoji: '🍖', description: 'Naikkan EXP pet aktif.', effect: { petXp: 25 } },
  { id: 'egg_basic', name: 'Egg Basic', type: 'egg', price: 500, emoji: '🥚', description: 'Telur pet umum.', effect: { egg: 'egg_basic' } },
  { id: 'egg_rare', name: 'Egg Rare', type: 'egg', price: 2500, emoji: '🥚', description: 'Telur pet langka.', effect: { egg: 'egg_rare' } },
  { id: 'egg_legendary', name: 'Egg Legendary', type: 'egg', price: 10000, emoji: '🥚', description: 'Telur pet legendaris.', effect: { egg: 'egg_legendary' } },
  { id: 'repair_kit', name: 'Guild Repair Kit', type: 'guild', price: 800, emoji: '🛠️', description: 'Kontribusi 50 guild EXP.', effect: { guildXp: 50 } },
];

const SHOP_MAP = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

const BOSS_TEMPLATES = [
  {
    key: 'demon_king',
    name: '666 Demon King',
    rarity: 'secret',
    hp: 100000,
    attack: 120,
    defense: 40,
    image: art('bottts', 'boss-666-demon-king'),
    skills: ['Infernal Roar', 'Blood Rain', '666 Judgement'],
    rewards: { coin: 500, xp: 120, drop: 'demonking' },
  },
  {
    key: 'void_leviathan',
    name: 'Void Leviathan',
    rarity: 'mythical',
    hp: 75000,
    attack: 95,
    defense: 55,
    image: art('bottts', 'boss-void-leviathan'),
    skills: ['Void Crush', 'Tidal Erasure'],
    rewards: { coin: 350, xp: 90, drop: 'voidserpent' },
  },
  {
    key: 'ash_titan',
    name: 'Ash Titan',
    rarity: 'legendary',
    hp: 55000,
    attack: 80,
    defense: 70,
    image: art('bottts', 'boss-ash-titan'),
    skills: ['Ashfall', 'Titan Slam'],
    rewards: { coin: 250, xp: 70, drop: 'titan' },
  },
];

const RANKS = [
  { minLevel: 1, name: 'Rookie', emoji: '🥚' },
  { minLevel: 5, name: 'Hunter', emoji: '🗡️' },
  { minLevel: 10, name: 'Slayer', emoji: '⚔️' },
  { minLevel: 20, name: 'Elite', emoji: '🛡️' },
  { minLevel: 35, name: 'Warlord', emoji: '👑' },
  { minLevel: 50, name: 'Demon Lord', emoji: '☠️' },
  { minLevel: 75, name: '666 Legend', emoji: '🔥' },
  { minLevel: 100, name: 'Ascended', emoji: '🌌' },
];

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', description: 'Menangkan battle pertama.', metric: 'battleWins', threshold: 1, coins: 200, xp: 50, emoji: '🩸' },
  { id: 'hunter_10', name: 'Hunter Initiate', description: 'Bunuh 10 monster.', metric: 'huntKills', threshold: 10, coins: 250, xp: 60, emoji: '🗡️' },
  { id: 'hunter_100', name: 'Monster Butcher', description: 'Bunuh 100 monster.', metric: 'huntKills', threshold: 100, coins: 1500, xp: 250, emoji: '⚔️' },
  { id: 'shiny_hunter', name: 'Shiny Hunter', description: 'Tangkap 1 shiny.', metric: 'shinyCount', threshold: 1, coins: 1000, xp: 150, emoji: '✨' },
  { id: 'legend_collector', name: 'Legend Collector', description: 'Memiliki 1 monster legendary.', metric: 'legendaryCount', threshold: 1, coins: 2000, xp: 250, emoji: '🟡' },
  { id: 'myth_seeker', name: 'Myth Seeker', description: 'Memiliki 1 monster mythical.', metric: 'mythicalCount', threshold: 1, coins: 5000, xp: 500, emoji: '🔴' },
  { id: 'secret_finder', name: 'Secret Finder', description: 'Temukan monster secret.', metric: 'secretCount', threshold: 1, coins: 20000, xp: 2000, emoji: '☠️' },
  { id: 'battle_50', name: 'Arena Veteran', description: 'Menangkan 50 battle.', metric: 'battleWins', threshold: 50, coins: 5000, xp: 600, emoji: '🏆' },
  { id: 'rich_100k', name: '666 Rich', description: 'Total kekayaan 100.000.', metric: 'totalWealth', threshold: 100000, coins: 5000, xp: 500, emoji: '💰' },
  { id: 'pet_lover', name: 'Pet Lover', description: 'Hatch 10 pet.', metric: 'petCount', threshold: 10, coins: 1200, xp: 200, emoji: '🐾' },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Total damage boss 10.000.', metric: 'totalBossDamage', threshold: 10000, coins: 6000, xp: 700, emoji: '👹' },
  { id: 'gambler', name: 'Gambler', description: 'Main 100 mini games.', metric: 'gameWins', threshold: 100, coins: 3000, xp: 400, emoji: '🎲' },
  { id: 'trader', name: 'Market Shark', description: 'Selesaikan 25 transaksi market.', metric: 'totalMarketTrades', threshold: 25, coins: 4000, xp: 450, emoji: '📈' },
  { id: 'level_50', name: 'Halfway to 666', description: 'Capai level 50.', metric: 'level', threshold: 50, coins: 10000, xp: 0, emoji: '🔥' },
  { id: 'level_100', name: 'Centurion', description: 'Capai level 100.', metric: 'level', threshold: 100, coins: 25000, xp: 2500, emoji: '💯' },
  { id: 'boss_100k', name: 'Raid Commander', description: 'Total damage boss 100.000.', metric: 'totalBossDamage', threshold: 100000, coins: 20000, xp: 1800, emoji: '🐲' },
  { id: 'gambler_500', name: 'Casino Legend', description: 'Menangkan 500 mini game.', metric: 'gameWins', threshold: 500, coins: 15000, xp: 1200, emoji: '🎰' },
];

const QUESTS = [
  { id: 'daily_hunt_5', type: 'daily', title: 'Hunt 5 Monster', event: 'hunt', target: 5, coins: 200, xp: 60, emoji: '🗡️' },
  { id: 'daily_work_2', type: 'daily', title: 'Kerja 2x', event: 'work', target: 2, coins: 150, xp: 40, emoji: '💼' },
  { id: 'daily_game_3', type: 'daily', title: 'Main 3 Mini Game', event: 'gamePlay', target: 3, coins: 180, xp: 50, emoji: '🎲' },
  { id: 'daily_boss_1', type: 'daily', title: 'Serang World Boss', event: 'bossAttack', target: 1, coins: 250, xp: 70, emoji: '👹' },
  { id: 'weekly_hunt_30', type: 'weekly', title: 'Hunt 30 Monster', event: 'hunt', target: 30, coins: 1200, xp: 300, emoji: '⚔️' },
  { id: 'weekly_battle_10', type: 'weekly', title: 'Menangkan 10 Battle', event: 'battleWin', target: 10, coins: 1500, xp: 350, emoji: '🏆' },
  { id: 'weekly_market_1', type: 'weekly', title: 'Transaksi Market 1x', event: 'marketBuy', target: 1, coins: 800, xp: 200, emoji: '🛒' },
  { id: 'weekly_boss_5', type: 'weekly', title: 'Serang Boss 5x', event: 'bossAttack', target: 5, coins: 1600, xp: 380, emoji: '👺' },
  { id: 'special_hunt_100', type: 'special', title: 'Hunt 100 Monster', event: 'hunt', target: 100, coins: 8000, xp: 1200, emoji: '💀' },
  { id: 'special_level_10', type: 'special', title: 'Capai Level 10', event: 'levelUp', target: 10, coins: 5000, xp: 800, emoji: '🔥' },
  { id: 'hidden_shiny', type: 'hidden', title: 'Tangkap Shiny', event: 'shiny', target: 1, coins: 3000, xp: 500, emoji: '✨', hidden: true },
  { id: 'hidden_legend', type: 'hidden', title: 'Tangkap Legendary', event: 'legendary', target: 1, coins: 6000, xp: 900, emoji: '🟡', hidden: true },
];

const QUEST_MAP = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

module.exports = {
  MONSTERS,
  MONSTER_MAP,
  PETS,
  PET_MAP,
  EGGS,
  EGGS_MAP,
  SHOP_ITEMS,
  SHOP_MAP,
  BOSS_TEMPLATES,
  RANKS,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  QUESTS,
  QUEST_MAP,
  RARITIES,
  RARITY_MAP,
  art,
};
