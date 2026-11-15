'use strict';

/**
 * Single source of truth for the public command documentation. The Discord
 * help menu and the static website are both generated from this catalog; the
 * usage lines themselves are read from each command module's own `help` array
 * so a command can never silently drift away from the documentation.
 */

const CATEGORIES = [
  {
    id: 'economy',
    label: 'Economy',
    emoji: '💰',
    blurb: 'Dompet, bank, reward berkala, kerja, dan shop.',
    commands: [
      {
        name: '6cash',
        aliases: ['6economy'],
        summary: 'Dompet, reward harian/mingguan/bulanan, kerja, bank, transfer, shop.',
        usage: '6cash <balance|daily|weekly|monthly|work|beg|deposit|withdraw|transfer|leaderboard|inventory|shop|buy|sell|history|profile>',
        examples: ['6cash', '6cash daily', '6cash transfer @teman 500'],
        note: 'Semua transaksi memakai idempotency key dan tidak bisa membuat saldo minus.',
      },
    ],
  },
  {
    id: 'hunting',
    label: 'Hunting',
    emoji: '🏹',
    blurb: 'Cari monster, isi koleksi, jual monster, dan naikkan hunt level.',
    commands: [
      {
        name: '6hunt',
        aliases: [],
        summary: 'Hunt monster, inventory, koleksi, jual, statistik, dan leaderboard.',
        usage: '6hunt [start|inventory|collection|sell|stats|leaderboard]',
        examples: ['6hunt', '6hunt inventory', '6hunt sell <id>'],
        note: 'Monster tidak akan hilang jika wallet penuh saat dijual.',
      },
    ],
  },
  {
    id: 'battle',
    label: 'Battle',
    emoji: '⚔️',
    blurb: 'Arena turn-based dengan rating, streak, dan cooldown.',
    commands: [
      {
        name: '6battle',
        aliases: [],
        summary: 'Tantang player, accept/decline, stats, dan leaderboard.',
        usage: '6battle @user | 6battle accept [id] | 6battle decline [id] | 6battle stats | 6battle leaderboard',
        examples: ['6battle @rival', '6battle accept', '6battle stats'],
        note: 'Battle memakai cooldown dan anti-farm untuk poin guild war.',
      },
    ],
  },
  {
    id: 'pets',
    label: 'Pets',
    emoji: '🐾',
    blurb: 'Hatch, rawat, upgrade, evolusi, dan pasang beberapa pet aktif.',
    commands: [
      {
        name: '6pet',
        aliases: [],
        summary: 'Hatch, feed, equip/unequip, inventory, stats, upgrade, evolve, collection.',
        usage: '6pet <hatch|feed|equip|unequip|inventory|stats|upgrade|evolve|collection> [id]',
        examples: ['6pet hatch', '6pet equip <id>', '6pet unequip <id>', '6pet collection'],
        note: 'Jumlah slot aktif mengikuti setting `pets.maxSlots` di dashboard.',
      },
    ],
  },
  {
    id: 'games',
    label: 'Mini Games',
    emoji: '🎲',
    blurb: 'RNG crypto, house edge transparan, tombol interaktif.',
    commands: [
      { name: '6coinflip', summary: 'Tebak heads/tails dengan bet.', usage: '6coinflip <heads|tails> [bet]', examples: ['6coinflip heads 100'] },
      { name: '6dice', summary: 'Tebak hasil dadu.', usage: '6dice <1-6> [bet]', examples: ['6dice 6 100'] },
      { name: '6slots', summary: 'Spin slot dan menangkan payout.', usage: '6slots [bet]', examples: ['6slots 100'] },
      { name: '6blackjack', summary: 'Blackjack melawan dealer dengan tombol hit/stand.', usage: '6blackjack [bet]', examples: ['6blackjack 100'] },
      { name: '6roulette', summary: 'Taruhan warna/angka roulette.', usage: '6roulette <red|black|green|0-36> [bet]', examples: ['6roulette red 100'] },
      { name: '6guess', summary: 'Tebak angka yang dipilih sistem.', usage: '6guess <1-100> [bet]', examples: ['6guess 42 100'] },
      { name: '6trivia', summary: 'Trivia dengan pilihan tombol.', usage: '6trivia [bet]', examples: ['6trivia 100'] },
      { name: '6rps', summary: 'Rock-paper-scissors lawan bot atau player.', usage: '6rps [bet] | 6rps @user [bet]', examples: ['6rps 100', '6rps @teman 100'] },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    emoji: '📈',
    blurb: 'Quest, achievement, rank, dan kartu profil.',
    commands: [
      {
        name: '6quest',
        aliases: [],
        summary: 'Quest harian/mingguan dan klaim reward.',
        usage: '6quest [list|daily|weekly] | 6quest claim <questId>',
        examples: ['6quest', '6quest daily', '6quest claim <id>'],
      },
      {
        name: '6achievement',
        aliases: ['6achievements'],
        summary: 'Daftar badge dan progres achievement.',
        usage: '6achievement',
        examples: ['6achievement'],
      },
      { name: '6rank', summary: 'Level, rank, EXP, dan posisi server.', usage: '6rank', examples: ['6rank'] },
      { name: '6profile', aliases: ['6me'], summary: 'Kartu profil lengkap dengan statistik dan quest.', usage: '6profile [@user]', examples: ['6profile', '6profile @teman'] },
    ],
  },
  {
    id: 'trade',
    label: 'Trade',
    emoji: '🤝',
    blurb: 'Trade aman: item dikunci dan dua pihak wajib confirm.',
    commands: [
      {
        name: '6trade',
        aliases: [],
        summary: 'Mulai trade, offer item/koin, accept, confirm, cancel, status.',
        usage: '6trade @user [koin] | 6trade offer <id> coins <n> monster <id> pet <id> item <id> <qty>',
        examples: ['6trade @teman', '6trade offer <id> coins 500', '6trade confirm <id>'],
        note: 'Item dikunci selama transfer dan baru berpindah setelah kedua pihak confirm.',
      },
    ],
  },
  {
    id: 'market',
    label: 'Market',
    emoji: '🏪',
    blurb: 'Jual-beli monster, pet, item, dan egg dengan escrow.',
    commands: [
      {
        name: '6market',
        aliases: ['6shopmarket'],
        summary: 'Lihat listing, sell, buy, cancel, mine, history.',
        usage: '6market [list] [halaman] | 6market sell <monster|pet|item|egg> <id> <harga> | 6market buy <id> | 6market cancel <id>',
        examples: ['6market', '6market sell pet <id> 5000', '6market buy <id>'],
        note: 'Listing memakai escrow dan short ID; item tidak bisa dipakai saat dikunci.',
      },
    ],
  },
  {
    id: 'guild',
    label: 'Guild',
    emoji: '🏰',
    blurb: 'Guild, bank, upgrade, dan guild war musiman.',
    commands: [
      {
        name: '6guild',
        aliases: [],
        summary: 'Create/join/leave/info/members/invite/deposit/upgrade/leaderboard/war.',
        usage: '6guild <subcommand> [args]',
        examples: ['6guild create <nama>', '6guild join <nama>', '6guild war challenge <guild>'],
        note: 'Season war mengikuti setting `guild.season` (daily/weekly/monthly).',
      },
    ],
  },
  {
    id: 'boss',
    label: 'World Boss',
    emoji: '👹',
    blurb: 'HP bersama, damage leaderboard, dan reward kontribusi.',
    commands: [
      {
        name: '6boss',
        aliases: [],
        summary: 'Status boss, serang, leaderboard, dan preview reward.',
        usage: '6boss [status|attack|leaderboard|rewards]',
        examples: ['6boss', '6boss attack', '6boss leaderboard'],
        note: 'Boss di-spawn scheduler; minimum kontribusi diatur dari dashboard.',
      },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    emoji: '🛠️',
    blurb: 'Bantuan, pencarian command, dan navigasi.',
    commands: [
      {
        name: '6help',
        aliases: ['6commands', '6h', '6?'],
        summary: 'Panduan interaktif semua command, kategori, dan pencarian.',
        usage: '6help [command|kategori|keyword]',
        examples: ['6help', '6help cash', '6help economy', '6help sell'],
        note: 'Gunakan menu kategori di bawah embed atau `/help` untuk versi slash.',
      },
    ],
  },
];

const ENTRIES = CATEGORIES.flatMap((category) => category.commands.map((command) => ({ ...command, category: category.id })));
const ENTRY_INDEX = new Map();
for (const entry of ENTRIES) {
  ENTRY_INDEX.set(entry.name.toLowerCase(), entry);
  for (const alias of entry.aliases || []) ENTRY_INDEX.set(alias.toLowerCase(), entry);
}
const CATEGORY_INDEX = new Map(CATEGORIES.map((category) => [category.id, category]));

function normalize(input) {
  let value = String(input || '').trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('6')) return value;
  if (value.startsWith('/')) value = value.slice(1);
  return `6${value.replace(/^6+/, '')}`;
}

function getEntry(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return null;
  const direct = ENTRY_INDEX.get(value) || ENTRY_INDEX.get(normalize(value));
  if (direct) return direct;
  const bare = value.replace(/^6/, '');
  return ENTRY_INDEX.get(`6${bare}`) || null;
}

function getCategory(input) {
  const value = String(input || '').trim().toLowerCase().replace(/^6/, '');
  return CATEGORY_INDEX.get(value) || null;
}

function search(input) {
  const term = String(input || '').trim().toLowerCase();
  if (!term) return [];
  return ENTRIES.filter((entry) => {
    const haystack = [entry.name, entry.summary, entry.usage, ...(entry.aliases || []), ...(entry.examples || [])]
      .join(' ').toLowerCase();
    return haystack.includes(term);
  }).slice(0, 12);
}

function linesFor(entry) {
  if (!entry) return [];
  try {
    // Lazy require keeps this module usable while the command registry loads.
    const registry = require('../commands');
    const command = registry.get(entry.name);
    if (Array.isArray(command?.help) && command.help.length) return [...command.help];
  } catch {
    // Documentation must still render even if Discord modules are unavailable.
  }
  return [entry.usage, ...(entry.examples || []).map((example) => `Contoh: \`${example}\``)];
}

function categoryOf(entry) {
  return CATEGORY_INDEX.get(entry?.category) || null;
}

module.exports = {
  CATEGORIES,
  ENTRIES,
  getEntry,
  getCategory,
  search,
  linesFor,
  categoryOf,
};
