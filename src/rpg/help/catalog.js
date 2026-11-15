'use strict';

/**
 * Single source of truth for the public command list. Category membership is
 * static (so the website can render without booting discord.js) while the
 * human-readable detail for new commands is read lazily from the command
 * registry metadata. Legacy commands keep an explicit description here.
 */

const DETAILS = {
  'tcash': { aliases: ['teconomy'], summary: 'Dompet, bank, reward harian/mingguan/bulanan, kerja, transfer, shop, dan history.', usage: 'tcash <balance|daily|weekly|monthly|work|beg|deposit|withdraw|transfer|leaderboard|inventory|shop|buy|sell|history|profile>', examples: ['tcash', 'tcash daily', 'tcash transfer @teman 500'], note: 'Semua transaksi memakai idempotency key dan tidak bisa membuat saldo minus.', cooldown: '2 detik', permission: 'Everyone' },
  'thunt': { summary: 'Hunt monster, inventory, koleksi, jual, statistik, dan leaderboard.', usage: 'thunt [start|inventory|collection|sell|stats|leaderboard]', examples: ['thunt', 'thunt inventory', 'thunt sell <id>'], note: 'Monster tidak akan hilang jika wallet penuh saat dijual.', cooldown: '30 detik', permission: 'Everyone' },
  'tbattle': { summary: 'Tantang player, accept/decline, stats, dan leaderboard.', usage: 'tbattle @user | tbattle accept [id] | tbattle decline [id] | tbattle stats | tbattle leaderboard', examples: ['tbattle @rival', 'tbattle accept', 'tbattle stats'], note: 'Battle memakai cooldown dan anti-farm untuk poin guild war.', cooldown: '15 detik', permission: 'Everyone' },
  'tpet': { summary: 'Hatch, feed, equip/unequip, inventory, stats, upgrade, evolve, collection.', usage: 'tpet <hatch|feed|equip|unequip|inventory|stats|upgrade|evolve|collection> [id]', examples: ['tpet hatch', 'tpet equip <id>', 'tpet unequip <id>', 'tpet collection'], note: 'Jumlah slot aktif mengikuti setting `pets.maxSlots` di dashboard.', cooldown: '2 detik', permission: 'Everyone' },
  'tquest': { summary: 'Quest harian/mingguan dan klaim reward.', usage: 'tquest [list|daily|weekly] | tquest claim <questId>', examples: ['tquest', 'tquest daily', 'tquest claim <id>'], cooldown: '2 detik', permission: 'Everyone' },
  'tachievement': { aliases: ['tachievements'], summary: 'Daftar badge dan progres achievement.', usage: 'tachievement', examples: ['tachievement'], cooldown: '3 detik', permission: 'Everyone' },
  'trank': { summary: 'Level, rank, EXP, dan posisi server.', usage: 'trank', examples: ['trank'], cooldown: '2 detik', permission: 'Everyone' },
  'tprofile': { aliases: ['tme'], summary: 'Kartu profil lengkap dengan statistik, sosial, dan quest.', usage: 'tprofile [@user]', examples: ['tprofile', 'tprofile @teman'], cooldown: '2 detik', permission: 'Everyone' },
  'tmarket': { aliases: ['tshopmarket'], summary: 'Lihat listing, sell, buy, cancel, mine, dan history dengan escrow.', usage: 'tmarket [list] [halaman] | tmarket sell <monster|pet|item|egg> <id> <harga> | tmarket buy <id> | tmarket cancel <id>', examples: ['tmarket', 'tmarket sell pet <id> 5000', 'tmarket buy <id>'], note: 'Listing memakai escrow dan short ID; item tidak bisa dipakai saat dikunci.', cooldown: '3 detik', permission: 'Everyone' },
  'tguild': { summary: 'Create/join/leave/info/members/invite/deposit/upgrade/leaderboard/war.', usage: 'tguild <subcommand> [args]', examples: ['tguild create <nama>', 'tguild join <nama>', 'tguild war challenge <guild>'], note: 'Season war mengikuti setting `guild.season` (daily/weekly/monthly).', cooldown: '3 detik', permission: 'Everyone' },
  'ttrade': { summary: 'Trade aman: item dikunci dan dua pihak wajib confirm.', usage: 'ttrade @user [koin] | ttrade offer <id> coins <n> monster <id> pet <id> item <id> <qty>', examples: ['ttrade @teman', 'ttrade offer <id> coins 500', 'ttrade confirm <id>'], note: 'Item dikunci selama transfer dan baru berpindah setelah kedua pihak confirm.', cooldown: '3 detik', permission: 'Everyone' },
  'tboss': { summary: 'Status world boss, serang, leaderboard, dan preview reward.', usage: 'tboss [status|attack|leaderboard|rewards]', examples: ['tboss', 'tboss attack', 'tboss leaderboard'], note: 'Boss di-spawn scheduler; minimum kontribusi diatur dari dashboard.', cooldown: '10 detik', permission: 'Everyone' },
  'tslots': { summary: 'Spin slot dan menangkan payout.', usage: 'tslots [bet]', examples: ['tslots 100'], cooldown: '3 detik', permission: 'Everyone' },
  'tcoinflip': { summary: 'Tebak heads/tails dengan bet.', usage: 'tcoinflip <heads|tails> [bet]', examples: ['tcoinflip heads 100'], cooldown: '3 detik', permission: 'Everyone' },
  'tblackjack': { summary: 'Blackjack melawan dealer dengan tombol hit/stand.', usage: 'tblackjack [bet]', examples: ['tblackjack 100'], cooldown: '5 detik', permission: 'Everyone' },
  'tdice': { summary: 'Tebak hasil dadu.', usage: 'tdice <1-6> [bet]', examples: ['tdice 6 100'], cooldown: '3 detik', permission: 'Everyone' },
  'troulette': { summary: 'Taruhan warna/angka roulette.', usage: 'troulette <red|black|green|0-36> [bet]', examples: ['troulette red 100'], cooldown: '3 detik', permission: 'Everyone' },
  'tguess': { summary: 'Tebak angka yang dipilih sistem.', usage: 'tguess <1-100> [bet]', examples: ['tguess 42 100'], cooldown: '3 detik', permission: 'Everyone' },
  'ttrivia': { summary: 'Trivia dengan pilihan tombol.', usage: 'ttrivia [bet]', examples: ['ttrivia 100'], cooldown: '5 detik', permission: 'Everyone' },
  'trps': { summary: 'Rock-paper-scissors lawan bot atau player.', usage: 'trps [bet] | trps @user [bet]', examples: ['trps 100', 'trps @teman 100'], cooldown: '3 detik', permission: 'Everyone' },
  'tmine': { summary: 'Mines 3x3 dengan poin virtual, tombol interaktif, dan reward EXP tanpa taruhan saldo.', usage: 'tmine [points]', examples: ['tmine', 'tmine 3000'], note: 'Buka minimal satu kotak aman lalu Cash Out. Tiga mine mengakhiri sesi.', cooldown: '5 detik', permission: 'Everyone' },
  'thelp': { aliases: ['tcommands', 'th', 't?'], summary: 'Command list interaktif, detail per command, pencarian, dan kategori.', usage: 'thelp [command|kategori|keyword]', examples: ['thelp', 'thelp cash', 'thelp economy', 'thelp sell'], note: 'Gunakan menu kategori di bawah embed atau `/help` untuk versi slash.', cooldown: '2 detik', permission: 'Everyone' },
};

const CATEGORY_DEFS = [
  { id: 'rankings', label: 'Rankings', emoji: '🏅', blurb: 'Peringkat wealth, level, hunt, battle, dan achievement.', commands: ['ttop', 'tmy', 'trank', 'tachievement'] },
  { id: 'economy', label: 'Economy', emoji: '💰', blurb: 'Dompet, bank, reward berkala, kerja, quest, checklist, shop, dan market.', commands: ['tcash', 'tgive', 'tdaily', 'tweekly', 'tmonthly', 'twork', 'tvote', 'tquest', 'tchecklist', 'tshop', 'tbuy', 'tsell', 'tmarket', 'ttrade'] },
  { id: 'animals', label: 'Animals', emoji: '🌱', blurb: 'Hunt, zoo, pet, battle, dungeon, lootbox, egg, dan world boss.', commands: ['tzoo', 'thunt', 'tsell', 'tsacrifice', 'tbattle', 'tsim', 'tinv', 'tequip', 'tautohunt', 'tdex', 'tlootbox', 'tegg', 'tcrate', 'tteam', 'tweapon', 'trename', 'tdismantle', 'tboss', 'tpet'] },
  { id: 'gambling', label: 'Gambling', emoji: '🎲', blurb: 'RNG crypto, house edge transparan, dan tombol interaktif.', commands: ['tslots', 'tcoinflip', 'tlottery', 'tblackjack', 'tdice', 'troulette', 'tguess', 'ttrivia', 'trps', 'tmine'] },
  { id: 'fun', label: 'Fun', emoji: '🎱', blurb: '8ball, kamus, GIF, gambar, translate, dadu, pilihan, dan bel.', commands: ['t8ball', 'tdefine', 'tgif', 'tpic', 'ttranslate', 'troll', 'tchoose', 'tbell'] },
  { id: 'social', label: 'Social', emoji: '🎭', blurb: 'Profil, level, avatar, pernikahan, ship, cookie, emoji, dan wallpaper.', commands: ['tcookie', 'tship', 'tpray', 'tcurse', 'tmarry', 'temoji', 'tprofile', 'tlevel', 'twallpaper', 'tgodify', 'tavatar'] },
  { id: 'meme', label: 'Meme', emoji: '😂', blurb: 'Meme generator canvas dengan teks custom.', commands: ['tspongebobchicken', 'tslapcar', 'tisthisa', 'tdrake', 'tdistractedbf', 'tcommunismcat', 'teject', 'temergencymeeting', 'theadpat', 'ttradeoffer', 'twaddle'] },
  { id: 'emotes', label: 'Emotes', emoji: '🙂', blurb: 'Ekspresi dan reaksi dengan GIF nyata.', commands: ['tblush', 'tcry', 'tdance', 'tpout', 'tshrug', 'tsleepy', 'tsmile', 'tsmug', 'tthumbsup', 'twag', 'tthinking', 'ttriggered', 'tteehee', 'tderedere', 'tthonsking', 'tscoff', 'thappy', 'tthumbs', 'tgrin'] },
  { id: 'actions', label: 'Actions', emoji: '🤗', blurb: 'Aksi sosial ke member lain dengan GIF.', commands: ['tcuddle', 'thug', 'tkiss', 'tlick', 'tnom', 'tpat', 'tpoke', 'tslap', 'tstare', 'thighfive', 'tbite', 'tgreet', 'tpunch', 'thandholding', 'ttickle', 'thold', 'tpats', 'twave', 'tboop', 'tsnuggle', 'tbully'] },
  { id: 'utility', label: 'Utility', emoji: '🔧', blurb: 'Info bot, link, prefix, moderator tools, saran, shards, math, dan warna.', commands: ['thelp', 'tping', 'tstats', 'tlink', 'tguildlink', 'tdisable', 'tcensor', 'tpatron', 'tannouncement', 'trules', 'tsuggest', 'tshards', 'tmath', 'tcolor', 'tprefix', 'tguild'] },
];

function stripTicks(value) { return String(value || '').replace(/`/g, '').trim(); }

function bareName(name) {
  const value = String(name || '');
  return value.startsWith('t') ? value.slice(1) : value;
}

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
  if (value.startsWith('/')) value = value.slice(1);
  // A full prefixed name or alias (tcash, teconomy, t8ball) resolves directly.
  // Bare command names may legitimately start with "t" (top, trade, trivia),
  // so only known prefixed keys skip the prefix.
  if (ENTRY_INDEX.has(value)) return value;
  return `t${value}`;
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
  try {
    const registry = require('../commands');
    const candidates = [...new Set([value, normalize(value)])];
    for (const candidate of candidates) {
      const command = registry.get(candidate);
      if (!command) continue;
      const meta = registry.metaFor(candidate);
      if (meta) {
        return describe({ name: meta.name, category: meta.category, aliases: (meta.aliases || []).map(stripTicks), summary: meta.description, usage: stripTicks(meta.usage), examples: meta.examples || [], cooldown: meta.cooldown, permission: meta.permissions });
      }
      return describe({ name: candidate, category: 'utility', summary: Array.isArray(command.help) ? command.help[0] : null, usage: Array.isArray(command.help) ? command.help[0] : null });
    }
  } catch { /* ignore */ }
  return null;
}

function getCategory(input) {
  const value = String(input || '').trim().toLowerCase();
  const bare = value.startsWith('t') ? value.slice(1) : value;
  const category = CATEGORY_INDEX.get(value) || CATEGORY_INDEX.get(bare) || CATEGORY_INDEX.get(CATEGORY_ALIASES[value]) || CATEGORY_INDEX.get(CATEGORY_ALIASES[bare]);
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
