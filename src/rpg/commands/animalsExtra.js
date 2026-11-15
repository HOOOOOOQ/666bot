'use strict';

const { define, info, ok } = require('./_factory');
const { reply, resolveMonsterId, resolvePetId, requireArgs } = require('./_helpers');
const extraService = require('../services/extraService');
const huntingService = require('../services/huntingService');
const petService = require('../services/petService');
const userService = require('../services/userService');
const models = require('../../database/models');
const { MONSTERS, PETS, EGGS, EGGS_MAP, WEAPON_MAP, SHOP_MAP, WEAPONS } = require('../data/catalog');
const shopService = require('../services/shopService');
const { getRarity } = require('../data/rarities');
const { money } = require('../ui/embeds');
const { formatCoins } = require('../utils/formulas');
const { UserError } = require('../../utils/errors');

const zoo = define({
  name: 'zoo', category: 'animals', aliases: [], description: 'Lihat kandang monster dan koleksi pet kamu.',
  usage: '`tzoo`', examples: ['tzoo'], cooldown: '2 detik',
  async execute(ctx) {
    const data = await extraService.zoo(ctx.guildId, ctx.userId);
    const monsters = data.monsters.slice(0, 8).map((m) => `${getRarity(m.rarity).emoji} **${m.name}** • Lv ${m.level} • \`${String(m._id).slice(-6)}\``).join('\n') || 'Belum ada monster.';
    const pets = data.pets.slice(0, 8).map((p) => `${getRarity(p.rarity).emoji} **${p.name}** • Lv ${p.level} • \`${String(p._id).slice(-6)}\``).join('\n') || 'Belum ada pet.';
    return reply(ctx.message, info('🦁 ZOO KAMU',
      `**${data.monsterCount} monster** • **${data.petCount} pet**\n\n**Monsters**\n${monsters}\n\n**Pets**\n${pets}`));
  },
});

const sell = define({
  name: 'sell', category: 'animals', aliases: [], description: 'Jual monster, item shop, atau semua duplikat monster.',
  usage: '`tsell <monsterId|itemId|all>`', examples: ['tsell all', 'tsell a1b2c3'], cooldown: '3 detik',
  async execute(ctx) {
    if (!ctx.args[0]) throw new UserError('Format: `tsell <id|all>`.');
    if (SHOP_MAP[ctx.args[0].toLowerCase()]) {
      const result = await shopService.sell(ctx.guildId, ctx.userId, ctx.args[0].toLowerCase(), Number(ctx.args[1] || 1));
      return reply(ctx.message, ok('💱 ITEM TERJUAL', `${result.item.emoji} **${result.item.name}** ×${result.qty}\nDapat: **${money(result.total)}**`));
    }
    if (ctx.args[0].toLowerCase() === 'all') {
      const result = await huntingService.sellAllDuplicates(ctx.guildId, ctx.userId);
      return reply(ctx.message, ok('💰 SELL ALL DUPLICATES', `${result.count} monster terjual • **${result.total}** coins diterima.`));
    }
    const id = await resolveMonsterId(ctx.guildId, ctx.userId, ctx.args[0]);
    const result = await huntingService.sell(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, ok('💰 MONSTER TERJUAL', `**${result.monster.name}**\nGross ${money(result.gross)} • Tax ${money(result.tax)} • Net **${money(result.net)}**`));
  },
});

const sacrifice = define({
  name: 'sacrifice', category: 'animals', aliases: [], description: 'Korbankan monster untuk koin dan XP instan. Monster akan dihapus permanen.',
  usage: '`tsacrifice <id>`', examples: ['tsacrifice a1b2c3'], cooldown: '3 detik', required: ['monster id'],
  async execute(ctx) {
    requireArgs(ctx.args, 1, 'tsacrifice <id>');
    const id = await resolveMonsterId(ctx.guildId, ctx.userId, ctx.args[0]);
    const result = await extraService.sacrifice(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, ok('🩸 SACRIFICE', `**${result.monster.name}** dikorbankan.\n+${money(result.coins)} coins • +${formatCoins(result.xp)} XP`));
  },
});

const sim = define({
  name: 'sim', category: 'animals', aliases: ['simulate'], description: 'Simulasikan battle melawan monster liar tanpa mempertaruhkan apa pun.',
  usage: '`tsim`', examples: ['tsim'], cooldown: '3 detik',
  async execute(ctx) {
    const result = await extraService.simulate(ctx.guildId, ctx.userId);
    return reply(ctx.message, info('🧪 BATTLE SIMULATION',
      `**${result.enemy.name}** Lv ${result.enemy.level}\nHP ${formatCoins(result.enemy.hp)} • ATK ${result.enemy.attack} • DEF ${result.enemy.defense} • SPD ${result.enemy.speed}\n\n` +
      `Your stats: HP ${formatCoins(result.stats.hp)} • ATK ${result.stats.attack} • DEF ${result.stats.defense} • SPD ${result.stats.speed}\n\n` +
      `${result.win ? '✅ **Simulasi menang.**' : '⚠️ **Simulasi kalah.**'} Tidak ada reward/kerusakan.`));
  },
});

const inv = define({
  name: 'inv', category: 'animals', aliases: ['inventory'], description: 'Inventory gabungan: item, monster, dan pet.',
  usage: '`tinv`', examples: ['tinv'], cooldown: '2 detik',
  async execute(ctx) {
    const data = await extraService.inventory(ctx.guildId, ctx.userId);
    const items = data.items.map((entry) => `${SHOP_MAP[entry.itemId]?.emoji || '📦'} **${SHOP_MAP[entry.itemId]?.name || entry.itemId}** × ${entry.qty}`).join('\n') || 'Belum ada item.';
    const monsters = data.monsters.slice(0, 6).map((m) => `• ${m.name} \`${String(m._id).slice(-6)}\``).join('\n') || '—';
    const pets = data.pets.slice(0, 6).map((p) => `• ${p.name} \`${String(p._id).slice(-6)}\``).join('\n') || '—';
    return reply(ctx.message, info('🎒 INVENTORY',
      `**Items**\n${items}\n\n**Monsters**\n${monsters}\n\n**Pets**\n${pets}\n\n💎 Shards: **${data.user.shards || 0}**`));
  },
});

const equip = define({
  name: 'equip', category: 'animals', aliases: [], description: 'Pasang pet ke slot aktif atau equip weapon.',
  usage: '`tequip <petId|weaponId>`', examples: ['tequip a1b2c3'], required: ['pet id'], cooldown: '2 detik',
  async execute(ctx) {
    requireArgs(ctx.args, 1, 'tequip <petId>');
    const input = ctx.args[0].toLowerCase();
    if (WEAPON_MAP[input]) {
      const result = await extraService.equipWeapon(ctx.guildId, ctx.userId, input);
      return reply(ctx.message, ok('🗡️ WEAPON EQUIPPED', `${result.weapon.emoji} **${result.weapon.name}** terpasang.`));
    }
    const id = await resolvePetId(ctx.guildId, ctx.userId, ctx.args[0]);
    const pet = await petService.equip(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, ok('🐾 PET EQUIPPED', `**${pet.name}** sekarang aktif. Bonus stat berlaku di hunt & battle.`));
  },
});

const autohunt = define({
  name: 'autohunt', category: 'animals', aliases: [], description: 'Aktifkan auto-hunt. Scheduler akan hunt otomatis setiap ±5 menit.',
  usage: '`tautohunt [on|off|status]`', examples: ['tautohunt on', 'tautohunt status'], cooldown: '3 detik',
  async execute(ctx) {
    const action = (ctx.args[0] || 'status').toLowerCase();
    if (action === 'status') {
      const doc = await models.AutoHunt.findOne({ guildId: ctx.guildId, userId: ctx.userId }).lean();
      return reply(ctx.message, info('🤖 AUTO HUNT', doc ? `Status: **${doc.enabled ? 'ON' : 'OFF'}**\nRuns: ${doc.totalRuns || 0}\nLast: ${doc.lastResult || '—'}` : 'Belum pernah diaktifkan. Gunakan `tautohunt on`.'));
    }
    if (!['on', 'off', 'enable', 'disable'].includes(action)) throw new UserError('Gunakan `tautohunt on|off|status`.');
    const enabled = action === 'on' || action === 'enable';
    const doc = await extraService.toggleAutoHunt(ctx.guildId, ctx.userId, enabled, ctx.message.channelId);
    return reply(ctx.message, ok('🤖 AUTO HUNT', `Auto-hunt sekarang **${doc.enabled ? 'ON' : 'OFF'}**.\nBerjalan setiap ±5 menit selama bot online.`));
  },
});

const dex = define({
  name: 'dex', category: 'animals', aliases: ['encyclopedia'], description: 'Ensiklopedia monster dan pet beserta status koleksi.',
  usage: '`tdex [monster|pet]`', examples: ['tdex', 'tdex pet'], cooldown: '3 detik',
  async execute(ctx) {
    const data = await extraService.dex(ctx.guildId, ctx.userId);
    const kind = (ctx.args[0] || 'monster').toLowerCase();
    const source = kind === 'pet' ? data.pets : data.monsters;
    const owned = source.filter((entry) => entry.owned).length;
    const lines = source.slice(0, 30).map((entry) => `${entry.owned ? '✅' : '▫️'} ${getRarity(entry.rarity).emoji} **${entry.name}**`);
    return reply(ctx.message, info(`📖 ${kind === 'pet' ? 'PET' : 'MONSTER'} DEX`,
      `${owned}/${source.length} terkoleksi\n${lines.join('\n')}\n\nGunakan \`tdex pet\` untuk koleksi pet.`));
  },
});

const lootbox = define({
  name: 'lootbox', category: 'animals', aliases: [], description: 'Beli dan buka lootbox berisi koin, shards, item, atau egg.',
  usage: '`tlootbox`', examples: ['tlootbox'], cooldown: '3 detik',
  async execute(ctx) {
    const result = await extraService.openLootbox(ctx.guildId, ctx.userId, 'lootbox');
    return reply(ctx.message, ok('🎁 LOOTBOX', describeBox(result)));
  },
});

const crate = define({
  name: 'crate', category: 'animals', aliases: [], description: 'Buka crate dengan hadiah lebih besar dan peluang item langka.',
  usage: '`tcrate`', examples: ['tcrate'], cooldown: '3 detik',
  async execute(ctx) {
    const result = await extraService.openLootbox(ctx.guildId, ctx.userId, 'crate');
    return reply(ctx.message, ok('📦 CRATE', describeBox(result)));
  },
});

function describeBox(result) {
  if (result.type === 'coins') return `Kamu mendapat **${money(result.amount)}** coins!`;
  if (result.type === 'shards') return `Kamu mendapat **${result.amount} shards**!`;
  if (result.type === 'egg') return `Kamu mendapat **${result.name}**! Gunakan \`tegg\` untuk menetas.`;
  return `Kamu mendapat **${result.name}**! Cek dengan \`tinv\`.`;
}

const egg = define({
  name: 'egg', category: 'animals', aliases: [], description: 'Hatch egg pet. Tanpa argumen akan menampilkan daftar egg.',
  usage: '`tegg [basic|rare|legendary]`', examples: ['tegg', 'tegg rare'], cooldown: '1.5 detik',
  async execute(ctx) {
    const input = (ctx.args[0] || '').toLowerCase();
    if (!input) {
      const lines = EGGS.map((entry) => `${entry.id} — ${money(entry.price)} (${Object.entries(entry.rates).filter(([, value]) => value > 0).map(([rarity, value]) => `${rarity} ${value}%`).join(', ')})`);
      return reply(ctx.message, info('🥚 EGG SHOP', lines.join('\n')));
    }
    const id = EGGS_MAP[`egg_${input}`] ? `egg_${input}` : input;
    const result = await petService.hatch(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, ok('🥚 EGG HATCHED', `**${result.egg.name}** menetas menjadi ${getRarity(result.pet.rarity).emoji} **${result.pet.name}**!`));
  },
});

const team = define({
  name: 'team', category: 'animals', aliases: [], description: 'Lihat tim pet aktif dan bonus stat mereka.',
  usage: '`tteam`', examples: ['tteam'], cooldown: '2 detik',
  async execute(ctx) {
    const user = await userService.ensureUser(ctx.guildId, ctx.userId);
    const pets = await petService.activePets(ctx.guildId, ctx.userId, user);
    if (!pets.length) throw new UserError('Belum ada pet aktif. Hatch dan equip pet dulu.');
    const lines = pets.map((pet, index) => `**${index + 1}.** ${getRarity(pet.rarity).emoji} **${pet.name}** Lv ${pet.level} • ATK ${pet.attack} • DEF ${pet.defense} • SPD ${pet.speed}`).join('\n');
    return reply(ctx.message, info('🐾 ACTIVE TEAM', `${lines}\n\nGabungkan slot dengan \`tpet equip\` dan \`tpet unequip\`.`));
  },
});

const weapon = define({
  name: 'weapon', category: 'animals', aliases: [], description: 'Lihat, equip, atau unequip weapon untuk bonus battle.',
  usage: '`tweapon [list|equip <id>|unequip]`', examples: ['tweapon list', 'tweapon equip iron_sword'], cooldown: '2 detik',
  async execute(ctx) {
    const action = (ctx.args[0] || 'list').toLowerCase();
    if (action === 'list') {
      const user = await userService.ensureUser(ctx.guildId, ctx.userId);
      const lines = WEAPONS.map((entry) => `${entry.emoji} \`${entry.id}\` — ${money(entry.price)} • ATK +${entry.effect.attack} DEF +${entry.effect.defense} SPD +${entry.effect.speed}`).join('\n');
      const equipped = user.equippedWeapon ? `\n\nEquipped: ${user.equippedWeapon.emoji} **${user.equippedWeapon.name}**` : '\n\nBelum memakai weapon.';
      return reply(ctx.message, info('🗡️ WEAPONS', `${lines}${equipped}`));
    }
    if (action === 'equip') {
      requireArgs(ctx.args, 2, 'tweapon equip <id>');
      const result = await extraService.equipWeapon(ctx.guildId, ctx.userId, ctx.args[1]);
      return reply(ctx.message, ok('🗡️ WEAPON EQUIPPED', `${result.weapon.emoji} **${result.weapon.name}** terpasang.`));
    }
    if (action === 'unequip') {
      const result = await extraService.equipWeapon(ctx.guildId, ctx.userId, null);
      return reply(ctx.message, ok('🗡️ WEAPON UNEQUIPPED', `**${result.weapon.name}** dikembalikan ke inventory.`));
    }
    throw new UserError('Gunakan `tweapon list|equip <id>|unequip`.');
  },
});

const rename = define({
  name: 'rename', category: 'animals', aliases: [], description: 'Ganti nama monster atau pet dengan biaya 500 coins.',
  usage: '`trename <monster|pet> <id> <nama baru>`', examples: ['trename pet a1b2c3 Kuro'], cooldown: '3 detik',
  async execute(ctx) {
    requireArgs(ctx.args, 3, 'trename <monster|pet> <id> <nama baru>');
    const type = ctx.args[0].toLowerCase();
    const id = type === 'pet' ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : await resolveMonsterId(ctx.guildId, ctx.userId, ctx.args[1]);
    const result = await extraService.rename(ctx.guildId, ctx.userId, type, id, ctx.args.slice(2).join(' '));
    return reply(ctx.message, ok('✏️ RENAMED', `${type === 'pet' ? 'Pet' : 'Monster'} **${result.before}** → **${result.after}**\nBiaya: ${money(result.cost)}`));
  },
});

const dismantle = define({
  name: 'dismantle', category: 'animals', aliases: [], description: 'Bongkar monster atau pet menjadi shards.',
  usage: '`tdismantle <monster|pet> <id>`', examples: ['tdismantle monster a1b2c3'], cooldown: '3 detik',
  async execute(ctx) {
    requireArgs(ctx.args, 2, 'tdismantle <monster|pet> <id>');
    const type = ctx.args[0].toLowerCase();
    const id = type === 'pet' ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : await resolveMonsterId(ctx.guildId, ctx.userId, ctx.args[1]);
    const result = await extraService.dismantle(ctx.guildId, ctx.userId, type, id);
    return reply(ctx.message, ok('♻️ DISMANTLED', `**${result.name}** dibongkar menjadi **${result.shards} shards**.`));
  },
});

module.exports = [zoo, sell, sacrifice, sim, inv, equip, autohunt, dex, lootbox, crate, egg, team, weapon, rename, dismantle];
