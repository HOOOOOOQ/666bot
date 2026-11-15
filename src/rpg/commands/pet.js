'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const petService = require('../services/petService');
const { petEmbed, petListEmbed, collectionEmbed, money } = require('../ui/embeds');
const { helpEmbed, reply, resolvePetId, requireArgs } = require('./_helpers');
const { getRarity } = require('../data/rarities');
const { formatCoins } = require('../utils/formulas');

const HELP = [
  '`6pet hatch [egg_basic|egg_rare|egg_legendary]` — menetas',
  '`6pet feed [id]` — naikkan level pet',
  '`6pet equip <id>` — pasang pet aktif',
  '`6pet inventory` — semua pet',
  '`6pet stats [id]` — detail pet',
  '`6pet upgrade [id]` — boost stat',
  '`6pet evolve [id]` — evolusi saat level cukup',
  '`6pet collection` — koleksi spesies',
];

async function execute(ctx) {
  const sub = (ctx.args[0] || 'inventory').toLowerCase();
  if (sub === 'hatch') {
    const result = await petService.hatch(ctx.guildId, ctx.userId, ctx.args[1]);
    const rarity = getRarity(result.pet.rarity);
    const embed = petEmbed(result.pet, rarity)
      .setDescription(`🥚 **${result.egg.name}** menetas menjadi **${result.pet.name}**!\nRarity: ${rarity.emoji} **${rarity.label}**${result.paid ? ` • biaya ${money(result.paid)}` : ' • dari inventory'}`);
    return reply(ctx.message, embed);
  }
  if (sub === 'feed') {
    const id = ctx.args[1] ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : null;
    const result = await petService.feed(ctx.guildId, ctx.userId, id);
    const rarity = getRarity(result.pet.rarity);
    return reply(ctx.message, petEmbed(result.pet, rarity)
      .setDescription(`🍖 Feed berhasil (+${result.xp} XP)${result.levelsGained ? ` • **naik ${result.levelsGained} level!**` : ''}\nBiaya: ${money(result.cost)}`));
  }
  if (sub === 'equip') {
    requireArgs(ctx.args, 2, '6pet equip <id>');
    const id = await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]);
    const pet = await petService.equip(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, petEmbed(pet, getRarity(pet.rarity)).setDescription('✅ Pet aktif dipasang. Bonus pet sekarang berlaku di hunt & battle.'));
  }
  if (sub === 'inventory' || sub === 'list') {
    const pets = await petService.inventory(ctx.guildId, ctx.userId);
    return reply(ctx.message, petListEmbed(pets));
  }
  if (sub === 'stats') {
    const id = ctx.args[1] ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : null;
    const data = await petService.stats(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, petEmbed(data.pet, data.rarity)
      .setDescription(`${data.pet.skill || ''}\nEXP: ${formatCoins(data.pet.xp)} / ${formatCoins(data.nextXp)}`));
  }
  if (sub === 'upgrade') {
    const id = ctx.args[1] ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : null;
    const result = await petService.upgrade(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, petEmbed(result.pet, getRarity(result.pet.rarity))
      .setDescription(`🛠️ Upgrade berhasil. Biaya: ${money(result.cost)}`));
  }
  if (sub === 'evolve') {
    const id = ctx.args[1] ? await resolvePetId(ctx.guildId, ctx.userId, ctx.args[1]) : null;
    const result = await petService.evolve(ctx.guildId, ctx.userId, id);
    return reply(ctx.message, petEmbed(result.pet, getRarity(result.pet.rarity))
      .setDescription(`🌟 **EVOLUSI!** ${result.from.name} → **${result.pet.name}**`));
  }
  if (sub === 'collection' || sub === 'col') {
    return reply(ctx.message, collectionEmbed(await petService.collection(ctx.guildId, ctx.userId), 'PET'));
  }
  if (sub === 'help') return reply(ctx.message, helpEmbed('666 PET', HELP));
  throw new UserError(`Subcommand \`${sub}\` tidak dikenal. Lihat \`6pet help\`.`);
}

module.exports = { names: ['6pet'], execute, help: HELP };
