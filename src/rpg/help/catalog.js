'use strict';

/**
 * Single source of truth for the public command list. Category membership is
 * static (so the website can render without booting discord.js) while the
 * human-readable detail for new commands is read lazily from the command
 * registry metadata. Legacy commands keep an explicit description here.
 */

const DETAILS = {
  '6cash': { aliases: ['6economy'], summary: 'Dompet, bank, reward harian/mingguan/bulanan, kerja, transfer, shop, dan history.', usage: '6cash <balance|daily|weekly|monthly|work|beg|deposit|withdraw|transfer|leaderboard|inventory|shop|buy|sell|history|profile>', examples: ['6cash', '6cash daily', '6cash transfer @teman 500'], note: 'Semua transaksi memakai idempotency key dan tidak bisa membuat saldo minus.', cooldown: '2 detik', permission: 'Everyone' },
  '6hunt': { summary: 'Hunt monster, inventory, koleksi, jual, statistik, dan leaderboard.', usage: '6hunt [start|inventory|collection|sell|stats|leaderboard]', examples: ['6hunt', '6hunt inventory', '6hunt sell <id>'], note: 'Monster tidak akan hilang jika wallet penuh saat dijual.', cooldown: '30 detik', permission: 'Everyone' },
  '6battle': { summary: 'Tantang player, accept/decline, stats, dan leaderboard.', usage: '6battle @user | 6battle accept [id] | 6battle decline [id] | 6battle stats | 6battle leaderboard', examples: ['6battle @rival', '6battle accept', '6battle stats'], note: 'Battle memakai cooldown dan anti-farm untuk poin guild war.', cooldown: '15 detik', permission: 'Everyone' },
  '6pet': { summary: 'Hatch, feed, equip/unequip, inventory, stats, upgrade, evolve, collection.', usage: '6pet <hatch|feed|equip|unequip|inventory|stats|upgrade|evolve|collection> [id]', examples: ['6pet hatch', '6pet equip <id>', '6pet unequip <id>', '6pet collection'], note: 'Jumlah slot aktif mengikuti setting `pets.maxSlots` di dashboard.', cooldown: '2 detik', permission: 'Everyone' },
  '6quest': { summary: 'Quest harian/mingguan dan klaim reward.', usage: '6quest [list|daily|weekly] | 6quest claim <questId>', examples: ['6quest', '6quest daily', '6quest claim <id>'], cooldown: '2 detik', permission: 'Everyone' },
  '6achievement': { aliases: ['6achievements'], summary: 'Daftar badge dan progres achievement.', usage: '6achievement', examples: ['6achievement'], cooldown: '3 detik', permission: 'Everyone' },
  '6rank': { summary: 'Level, rank, EXP, dan posisi server.', usage: '6rank', examples: ['6rank'], cooldown: '2 detik', permission: 'Everyone' },
  '6profile': { aliases: ['6me'], summary: 'Kartu profil lengkap dengan statistik, sosial, dan quest.', usage: '6profile [@user]', examples: ['6profile', '6profile @teman'], cooldown: '2 detik', permission: 'Everyone' },
  '6market': { aliases: ['6shopmarket'], summary: 'Lihat listing, sell, buy, cancel, mine, dan history dengan escrow.', usage: '6market [list] [halaman] | 6market sell <monster|pet|item|egg> <id> <harga> | 6market buy <id> | 6market cancel <id>', examples: ['6market', '6market sell pet <id> 5000', '6market buy <id>'], note: 'Listing memakai escrow dan short ID; item tidak bisa dipakai saat dikunci.', cooldown: '3 detik', permission: 'Everyone' },
  '6guild': { summary: 'Create/join/leave/info/members/invite/deposit/upgrade/leaderboard/war.', usage: '6guild <subcommand> [args]', examples: ['6guild create <nama>', '6guild join <nama>', '6guild war challenge <guild>'], note: 'Season war mengikuti setting `guild.season` (daily/weekly/monthly).', cooldown: '3 detik', permission: 'Everyone' },
  '6trade': { summary: 'Trade aman: item dikunci dan dua pihak wajib confirm.', usage: '6trade @user [koin] | 6trade offer <id> coins <n> monster <id> pet <id> item <id> <qty>', examples: ['6trade @teman', '6trade offer <id> coins 500', '6trade confirm <id>'], note: 'Item dikunci selama transfer dan baru berpindah setelah kedua pihak confirm.', cooldown: '3 detik', permission: 'Everyone' },
  '6boss': { summary: 'Status world boss, serang, leaderboard, dan preview reward.', usage: '6boss [status|attack|leaderboard|rewards]', examples: ['6boss', '6boss attack', '6boss leaderboard'], note: 'Boss di-spawn scheduler; minimum kontribusi diatur dari dashboard.', cooldown: '10 detik', permission: 'Everyone' },
  '6slots': { summary: 'Spin slot dan menangkan payout.', usage: '6slots [bet]', examples: ['6slots 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6coinflip': { summary: 'Tebak heads/tails dengan bet.', usage: '6coinflip <heads|tails> [bet]', examples: ['6coinflip heads 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6blackjack': { summary: 'Blackjack melawan dealer dengan tombol hit/stand.', usage: '6blackjack [bet]', examples: ['6blackjack 100'], cooldown: '5 detik', permission: 'Everyone' },
  '6dice': { summary: 'Tebak hasil dadu.', usage: '6dice <1-6> [bet]', examples: ['6dice 6 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6roulette': { summary: 'Taruhan warna/angka roulette.', usage: '6roulette <red|black|green|0-36> [bet]', examples: ['6roulette red 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6guess': { summary: 'Tebak angka yang dipilih sistem.', usage: '6guess <1-100> [bet]', examples: ['6guess 42 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6trivia': { summary: 'Trivia dengan pilihan tombol.', usage: '6trivia [bet]', examples: ['6trivia 100'], cooldown: '5 detik', permission: 'Everyone' },
  '6rps': { summary: 'Rock-paper-scissors lawan bot atau player.', usage: '6rps [bet] | 6rps @user [bet]', examples: ['6rps 100', '6rps @teman 100'], cooldown: '3 detik', permission: 'Everyone' },
  '6help': { aliases: ['6commands', '6h', '6?'], summary: 'Command list interaktif, detail per command, pencarian, dan kategori.', usage: '6help [command|kategori|keyword]', examples: ['6help', '6help cash', '6help economy', '6help sell'], note: 'Gunakan menu kategori di bawah embed atau `/help` untuk versi slash.', cooldown: '2 detik', permission: 'Everyone' },
};

const CATEGORY_DEFS = [
  { id: 'rankings', label: 'Rankings', emoji: '🏅', blurb: 'Peringkat wealth, level, hunt, battle, dan achievement.', commands: ['6top', '6my', '6rank', '6achievement'] },
  { id: 'economy', label: 'Economy', emoji: '💰', blurb: 'Dompet, bank, reward berkala, kerja, quest, checklist, shop, dan market.', commands: ['6cash', '6give', '6daily', '6weekly', '6monthly', '6work', '6vote', '6quest', '6checklist', '6shop', '6buy', '6sell', '6market', '6trade'] },
  { id: 'animals', label: 'Animals', emoji: '🌱', blurb: 'Hunt, zoo, pet, battle, dungeon, lootbox, egg, dan world boss.', commands: ['6zoo', '6hunt', '6sell', '6sacrifice', '6battle', '6sim', '6inv', '6equip', '6autohunt', '6dex', '6lootbox', '6egg', '6crate', '6team', '6weapon', '6rename', '6dismantle', '6boss', '6pet'] },
  { id: 'gambling', label: 'Gambling', emoji: '🎲', blurb: 'RNG crypto, house edge transparan, dan tombol interaktif.', commands: ['6slots', '6coinflip', '6lottery', '6blackjack', '6dice', '6roulette', '6guess', '6trivia', '6rps'] },
  { id: 'fun', label: 'Fun', emoji: '🎱', blurb: '8ball, kamus, GIF, gambar, translate, dadu, pilihan, dan bel.', commands: ['68ball', '6define', '6gif', '6pic', '6translate', '6roll', '6choose', '6bell'] },
  { id: 'social', label: 'Social', emoji: '🎭', blurb: 'Profil, level, avatar, pernikahan, ship, cookie, emoji, dan wallpaper.', commands: ['6cookie', '6ship', '6pray', '6curse', '6marry', '6emoji', '6profile', '6level', '6wallpaper', '6godify', '6avatar'] },
  { id: 'meme', label: 'Meme', emoji: '😂', blurb: 'Meme generator canvas dengan teks custom.', commands: ['6spongebobchicken', '6slapcar', '6isthisa', '6drake', '6distractedbf', '6communismcat', '6eject', '6emergencymeeting', '6headpat', '6tradeoffer', '6waddle'] },
  { id: 'emotes', label: 'Emotes', emoji: '🙂', blurb: 'Ekspresi dan reaksi dengan GIF nyata.', commands: ['6blush', '6cry', '6dance', '6pout', '6shrug', '6sleepy', '6smile', '6smug', '6thumbsup', '6wag', '6thinking', '6triggered', '6teehee', '6deredere', '6thonsking', '6scoff', '6happy', '6thumbs', '6grin'] },
  { id: 'actions', label: 'Actions', emoji: '🤗', blurb: 'Aksi sosial ke member lain dengan GIF.', commands: ['6cuddle', '6hug', '6kiss', '6lick', '6nom', '6pat', '6poke', '6slap', '6stare', '6highfive', '6bite', '6greet', '6punch', '6handholding', '6tickle', '6hold', '6pats', '6wave', '6boop', '6snuggle', '6bully'] },
  { id: 'utility', label: 'Utility', emoji: '🔧', blurb: 'Info bot, link, prefix, moderator tools, saran, shards, math, dan warna.', commands: ['6help', '6ping', '6stats', '6link', '6guildlink', '6disable', '6censor', '6patron', '6announcement', '6rules', '6suggest', '6shards', '6math', '6color', '6prefix', '6guild'] },
];

function stripTicks(value) { return String(value || '').replace(/`/g, '').trim(); }

function bareName(name) { return String(name || '').replace(/^6/, ''); }

function buildEntry(name, categoryId) {
  const detail = DETAILS[name] || {};
  return {
    name,
    aliases: detail.aliases || [],
    summary: detail.summary || null,
    usage: detail.usage || null,
    examples: detail.examples || [],
    note: detail.note || null,
    cooldown: detail.cooldown || null,
    permission: detail.permission || 'Everyone',
    required: detail.required || [],
    optional: detail.optional || [],
    category: categoryId,
  };
}

const CATEGORIES = CATEGORY_DEFS.map((category) => ({
  ...category,
  commands: category.commands.map((name) => buildEntry(name, category.id)),
}));
const ENTRIES = CATEGORIES.flatMap((category) => category.commands);
const ENTRY_INDEX = new Map();
for (const entry of ENTRIES) {
  ENTRY_INDEX.set(entry.name.toLowerCase(), entry);
  for (const alias of entry.aliases || []) ENTRY_INDEX.set(alias.toLowerCase(), entry);
}
const CATEGORY_INDEX = new Map(CATEGORIES.map((category) => [category.id, category]));
const CATEGORY_ALIASES = { pets: 'animals', hunting: 'animals', games: 'gambling', progress: 'rankings', marketplace: 'economy', minigames: 'gambling' };

function normalize(input) {
  let value = String(input || '').trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('6')) return value;
  if (value.startsWith('/')) value = value.slice(1);
  return `6${value.replace(/^6+/, '')}`;
}

function registryMeta(name) {
  try {
    const registry = require('../commands');
    return registry.metaFor ? registry.metaFor(name) : null;
  } catch {
    return null;
  }
}

function describe(entry) {
  if (!entry) return null;
  const meta = registryMeta(entry.name);
  if (!meta) {
    return { ...entry, summary: entry.summary || `Command ${entry.name} untuk sistem 666.`, usage: entry.usage || entry.name, aliases: entry.aliases || [] };
  }
  return {
    ...entry,
    summary: meta.description || entry.summary,
    usage: stripTicks(meta.usage) || entry.usage,
    examples: meta.examples || entry.examples,
    aliases: (meta.aliases || []).map(stripTicks),
    cooldown: meta.cooldown || entry.cooldown,
    permission: meta.permissions || entry.permission,
    required: meta.required || entry.required,
    optional: meta.optional || entry.optional,
  };
}

function getEntry(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return null;
  const direct = ENTRY_INDEX.get(value) || ENTRY_INDEX.get(normalize(value));
  if (direct) return describe(direct);
  const bare = value.replace(/^6/, '');
  const found = ENTRY_INDEX.get(`6${bare}`);
  if (found) return describe(found);
  try {
    const registry = require('../commands');
    const command = registry.get(value);
    const meta = registry.metaFor(value);
    if (command && meta) {
      return describe({ name: meta.name, category: meta.category, aliases: (meta.aliases || []).map(stripTicks), summary: meta.description, usage: stripTicks(meta.usage), examples: meta.examples || [], cooldown: meta.cooldown, permission: meta.permissions });
    }
    if (command) return describe({ name: `6${bare}`, category: 'utility', summary: Array.isArray(command.help) ? command.help[0] : null, usage: Array.isArray(command.help) ? command.help[0] : null });
  } catch { /* ignore */ }
  return null;
}

function getCategory(input) {
  const value = String(input || '').trim().toLowerCase().replace(/^6/, '');
  const category = CATEGORY_INDEX.get(value) || CATEGORY_INDEX.get(CATEGORY_ALIASES[value]);
  if (!category) return null;
  return { ...category, commands: category.commands.map(describe) };
}

function search(input) {
  const term = String(input || '').trim().toLowerCase();
  if (!term) return [];
  return CATEGORIES.flatMap((category) => category.commands.map(describe)).filter((entry) => {
    const haystack = [entry.name, entry.summary, entry.usage, ...(entry.aliases || []), ...(entry.examples || [])].join(' ').toLowerCase();
    return haystack.includes(term);
  }).slice(0, 12);
}

function linesFor(entry) {
  if (!entry) return [];
  try {
    const registry = require('../commands');
    const command = registry.get(entry.name);
    if (Array.isArray(command?.help) && command.help.length) return [...command.help];
  } catch { /* docs still render */ }
  return [entry.usage, ...(entry.examples || []).map((example) => `Contoh: \`${example}\``)];
}

function categoryOf(entry) {
  return CATEGORY_INDEX.get(entry?.category) || null;
}

function commandsFor(category) {
  const names = category.commands.map((entry) => bareName(entry.name));
  try {
    const registry = require('../commands');
    for (const meta of registry.allMeta ? registry.allMeta() : []) {
      if (meta.category !== category.id) continue;
      const bare = bareName(meta.name);
      if (!names.includes(bare)) names.push(bare);
    }
  } catch { /* static list is still usable */ }
  return names;
}

module.exports = {
  CATEGORIES,
  ENTRIES,
  getEntry,
  getCategory,
  search,
  linesFor,
  categoryOf,
  describe,
  bareName,
  commandsFor,
  stripTicks,
};
