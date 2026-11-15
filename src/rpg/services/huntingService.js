'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const { MONSTERS, MONSTER_MAP } = require('../data/catalog');
const { RARITY_MAP, getRarity } = require('../data/rarities');
const settingsService = require('./settingsService');
const cooldownService = require('./cooldownService');
const userService = require('./userService');
const questService = require('./questService');
const { monsterStats, applyTax, formatCoins } = require('../utils/formulas');
const { weightedPickTable, chance, randomFloat, pick } = require('../utils/rng');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-hunt');

function monstersByRarity(rarity) {
  return MONSTERS.filter((m) => m.rarity === rarity);
}

function catchValue(species, shiny) {
  return Math.floor(species.coins * (getRarity(species.rarity).coinMultiplier || 1) * 2 * (shiny ? 1.6 : 1));
}

async function hunt(guildId, userId, profile = {}, requestId = null) {
  const game = await settingsService.getGame(guildId);
  const cfg = game.hunting;
  if (!cfg.enabled) throw new UserError('Hunting sedang dinonaktifkan admin.');
  const existing = await models.Monster.countDocuments({ guildId, userId });
  if (existing >= cfg.maxMonsters) throw new UserError(`Kandang penuh (${existing}/${cfg.maxMonsters}). Jual monster dulu dengan \`6hunt sell\`.`);

  await userService.ensureUser(guildId, userId, profile);
  const cd = await cooldownService.claim(guildId, userId, 'hunt', cfg.cooldownSec * 1000);
  if (!cd.ok) throw new UserError(`Hunt cooldown. Siap lagi <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);

  try {
    if (!chance(cfg.spawnChance)) {
      await userService.ensureUser(guildId, userId, profile);
      return { spawned: false, message: 'Tidak ada monster yang muncul. Coba lagi nanti.' };
    }

    const rarity = weightedPickTable(game.dropRates.monster, MONSTERS.map((m) => ({ rarity: m.rarity })));
    const rarityId = rarity?.rarity || 'common';
    const pool = monstersByRarity(rarityId);
    const species = pick(pool.length ? pool : MONSTERS);
    const shiny = chance(cfg.shinyChance);
    const stats = monsterStats(species, shiny);
    const rarityData = getRarity(species.rarity);
    const coins = Math.max(1, Math.round(species.coins * cfg.coinMultiplier * (0.9 + randomFloat() * 0.2) * (shiny ? 2 : 1)));
    const xp = Math.max(1, Math.round((10 + species.hp / 12 + rarityData.xpMultiplier * 8) * cfg.xpMultiplier));

    const monster = await models.Monster.create({
      guildId,
      userId,
      speciesId: species.id,
      name: shiny ? `✨ Shiny ${species.name}` : species.name,
      rarity: species.rarity,
      shiny,
      level: 1,
      ...stats,
      image: species.image,
      sellValue: catchValue(species, shiny),
    });

    await models.MonsterCollection.findOneAndUpdate(
      { guildId, userId, speciesId: species.id },
      { $inc: { count: 1, shinyCount: shiny ? 1 : 0 }, $setOnInsert: { firstCaughtAt: new Date() } },
      { upsert: true, new: true },
    );

    const inc = {
      huntKills: 1,
      totalHunts: 1,
      shinyCount: shiny ? 1 : 0,
      legendaryCount: species.rarity === 'legendary' ? 1 : 0,
      mythicalCount: species.rarity === 'mythical' ? 1 : 0,
      secretCount: species.rarity === 'secret' ? 1 : 0,
    };
    await models.RPGUser.updateOne({ guildId, userId }, { $inc: inc });

    const key = `hunt:${guildId}:${userId}:${requestId || Date.now()}`;
    const coinResult = await userService.addCoins(guildId, userId, coins, 'hunt', `${key}:coin`, { speciesId: species.id, shiny });
    const xpResult = await userService.addXp(guildId, userId, xp, 'hunt');
    await models.HuntingUser.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { kills: 1, shiny: shiny ? 1 : 0, legendary: species.rarity === 'legendary' ? 1 : 0, mythical: species.rarity === 'mythical' ? 1 : 0, secret: species.rarity === 'secret' ? 1 : 0 },
        $set: { huntLevel: xpResult?.level || 1, huntXp: xpResult?.user?.huntXp || 0, lastHuntAt: new Date() },
        $setOnInsert: { guildId, userId },
      },
      { upsert: true },
    ).catch(() => {});

    // 8% chance for a consumable drop, independent of monster rarity.
    let itemDrop = null;
    if (chance(8)) {
      itemDrop = chance(50) ? 'potion' : 'bait';
      await userService.addItem(guildId, userId, itemDrop, 1);
    }

    await questService.track(guildId, userId, 'hunt', 1, xpResult.user);
    if (shiny) await questService.track(guildId, userId, 'shiny', 1, xpResult.user);
    if (species.rarity === 'legendary') await questService.track(guildId, userId, 'legendary', 1, xpResult.user);

    return {
      spawned: true,
      monster,
      species,
      shiny,
      coins,
      xp,
      itemDrop,
      levelsGained: xpResult.levelsGained,
      level: xpResult.level,
      user: xpResult.user,
    };
  } catch (error) {
    await cooldownService.clear(guildId, userId, 'hunt').catch(() => {});
    throw error;
  }
}

async function inventory(guildId, userId, page = 1, perPage = 8) {
  const total = await models.Monster.countDocuments({ guildId, userId });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(pages, Math.max(1, page));
  const monsters = await models.Monster.find({ guildId, userId }).sort({ rarity: -1, createdAt: -1 }).skip((current - 1) * perPage).limit(perPage).lean();
  return { monsters, total, pages, page: current };
}

async function collection(guildId, userId) {
  const docs = await models.MonsterCollection.find({ guildId, userId }).lean();
  const map = new Map(docs.map((d) => [d.speciesId, d]));
  return MONSTERS.map((species) => ({
    ...species,
    count: map.get(species.id)?.count || 0,
    shinyCount: map.get(species.id)?.shinyCount || 0,
    owned: Boolean(map.get(species.id)),
  }));
}

async function sell(guildId, userId, monsterId) {
  if (!monsterId) throw new UserError('Tentukan ID monster yang mau dijual.');
  const game = await settingsService.getGame(guildId);
  const monster = await models.Monster.findOne({ _id: monsterId, guildId, userId }).lean();
  if (!monster) throw new UserError('Monster tidak ditemukan di kandangmu.');
  if (monster.lockedBy) throw new UserError('Monster sedang dikunci di trade/market.');
  const { tax, net } = applyTax(monster.sellValue, game.hunting.sellTaxPct);
  const economy = await settingsService.getEconomy(guildId);
  const seller = await userService.ensureUser(guildId, userId);
  if (net > 0 && (seller.wallet || 0) + net > economy.maxWallet) {
    throw new UserError('Wallet kamu sudah penuh. Deposit sebagian ke bank dulu sebelum menjual monster.');
  }
  const deleted = await models.Monster.findOneAndDelete({ _id: monsterId, guildId, userId, lockedBy: null });
  if (!deleted) throw new UserError('Monster sedang diproses. Coba lagi.');
  if (net > 0) {
    try {
      await userService.addCoins(guildId, userId, net, 'monster_sell', `monster_sell:${monsterId}`, { tax, gross: monster.sellValue });
    } catch (error) {
      // Restore the exact monster if the credit failed, so a full wallet can
      // never destroy a monster without paying for it.
      const raw = typeof deleted.toObject === 'function' ? deleted.toObject() : { ...deleted };
      await models.Monster.create(raw).catch(() => {});
      throw error;
    }
  }
  await models.MonsterCollection.updateOne(
    { guildId, userId, speciesId: monster.speciesId, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  ).catch(() => {});
  return { monster, gross: monster.sellValue, tax, net };
}

async function stats(guildId, userId) {
  const user = await userService.ensureUser(guildId, userId);
  const unique = await models.MonsterCollection.countDocuments({ guildId, userId });
  const total = await models.Monster.countDocuments({ guildId, userId });
  return { user, unique, total, catalogSize: MONSTERS.length };
}

async function leaderboard(guildId, limit = 10) {
  const docs = await models.RPGUser.find({ guildId }).sort({ huntKills: -1, huntLevel: -1 }).limit(Math.min(25, limit)).lean();
  return docs;
}

async function sellAllDuplicates(guildId, userId) {
  const docs = await models.Monster.find({ guildId, userId, lockedBy: null }).sort({ createdAt: 1 }).lean();
  const seen = new Set();
  const toSell = [];
  for (const m of docs) {
    if (seen.has(m.speciesId)) toSell.push(m._id);
    else seen.add(m.speciesId);
  }
  let total = 0;
  for (const id of toSell) {
    try {
      const result = await sell(guildId, userId, id);
      total += result.net;
    } catch (error) {
      log.warn(`sellAll skipped ${id}: ${error.message}`);
    }
  }
  return { count: toSell.length, total: formatCoins(total), raw: total };
}

module.exports = { hunt, inventory, collection, sell, stats, leaderboard, sellAllDuplicates, catchValue, monstersByRarity };
