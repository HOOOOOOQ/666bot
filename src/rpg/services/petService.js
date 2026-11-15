'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const { PETS, PET_MAP, EGGS_MAP, SHOP_MAP } = require('../data/catalog');
const { getRarity } = require('../data/rarities');
const settingsService = require('./settingsService');
const userService = require('./userService');
const cooldownService = require('./cooldownService');
const { petStats, applyXp, xpForLevel, formatCoins } = require('../utils/formulas');
const { weightedPickTable, pick } = require('../utils/rng');
const { DEFAULT_DROP_RATES } = require('../config/defaults');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-pet');

function petsByRarity(rarity) {
  return PETS.filter((p) => p.rarity === rarity);
}

/**
 * Global pet drop rates are the admin-tunable base table; each egg keeps its own
 * premium bias, expressed as a multiplier relative to the default pet table.
 * Setting a rarity to 0% therefore disables it for every egg immediately.
 */
function eggRatesFor(game, egg) {
  const global = game?.dropRates?.pet || DEFAULT_DROP_RATES.pet;
  const defaults = DEFAULT_DROP_RATES.pet;
  const table = {};
  for (const [rarity, eggWeight] of Object.entries(egg.rates || {})) {
    const base = Number(global[rarity]) || 0;
    const ref = Number(defaults[rarity]) || 0;
    table[rarity] = eggWeight > 0 && base > 0 && ref > 0 ? eggWeight * (base / ref) : 0;
  }
  return table;
}

function activeIdList(user) {
  const list = (user?.activePetIds || []).map(String);
  if (list.length > 0) return list;
  return user?.activePetId ? [String(user.activePetId)] : [];
}

async function activePets(guildId, userId, user = null) {
  const owner = user || (await userService.ensureUser(guildId, userId));
  const ids = activeIdList(owner);
  if (ids.length === 0) return [];
  const docs = await models.Pet.find({ _id: { $in: ids }, guildId, userId }).lean();
  const map = new Map(docs.map((pet) => [String(pet._id), pet]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

async function detach(guildId, userId, petId) {
  const id = String(petId);
  await models.RPGUser.updateOne({ guildId, userId }, { $pull: { activePetIds: petId } }).catch(() => {});
  const user = await models.RPGUser.findOne({ guildId, userId }).lean();
  if (user && String(user.activePetId || '') === id) {
    const remaining = (user.activePetIds || []).map(String).filter((value) => value !== id);
    await models.RPGUser.updateOne({ guildId, userId }, { $set: { activePetId: remaining[0] || null } }).catch(() => {});
  }
}

async function resolveEgg(guildId, userId, eggId) {
  const game = await settingsService.getGame(guildId);
  const id = eggId || 'egg_basic';
  const egg = EGGS_MAP[id];
  if (!egg) throw new UserError(`Telur tidak dikenal. Pilihan: ${Object.keys(EGGS_MAP).join(', ')}`);
  const user = await userService.ensureUser(guildId, userId);
  const owned = Number(user.inventory?.[id] || 0);
  if (owned > 0) {
    await userService.removeItem(guildId, userId, id, 1);
    return { egg, paid: 0 };
  }
  const price = Math.max(0, egg.price || game.pets.eggPrice);
  if (price === 0) return { egg, paid: 0 };
  await userService.spendCoins(guildId, userId, price, 'egg_purchase', `egg_buy:${guildId}:${userId}:${id}:${Date.now()}`, { egg: id });
  return { egg, paid: price };
}

async function hatch(guildId, userId, eggId) {
  const game = await settingsService.getGame(guildId);
  if (!game.pets.enabled) throw new UserError('Pet system sedang dinonaktifkan admin.');
  const cd = await cooldownService.claim(guildId, userId, 'pet_hatch', 1500);
  if (!cd.ok) throw new UserError('Hatch sedang diproses. Coba lagi sebentar.');
  let resolved;
  try {
    resolved = await resolveEgg(guildId, userId, eggId);
  } catch (error) {
    await cooldownService.clear(guildId, userId, 'pet_hatch').catch(() => {});
    throw error;
  }
  const { egg, paid } = resolved;
  const rarity = weightedPickTable(eggRatesFor(game, egg), PETS.map((p) => ({ rarity: p.rarity })));
  const rarityId = rarity?.rarity || 'common';
  const pool = petsByRarity(rarityId);
  const species = pick(pool.length ? pool : PETS);
  const stats = petStats(species, 1);
  const pet = await models.Pet.create({
    guildId,
    userId,
    speciesId: species.id,
    name: species.name,
    rarity: species.rarity,
    level: 1,
    xp: 0,
    ...stats,
    skill: species.skill,
    image: species.image,
  });
  await models.PetCollection.findOneAndUpdate(
    { guildId, userId, speciesId: species.id },
    { $inc: { count: 1 }, $setOnInsert: { firstHatchedAt: new Date() } },
    { upsert: true, new: true },
  );
  const user = await userService.ensureUser(guildId, userId);
  const active = activeIdList(user);
  if (active.length < Math.max(1, game.pets.maxSlots)) {
    const update = { $addToSet: { activePetIds: pet._id } };
    if (!user.activePetId) update.$set = { activePetId: pet._id };
    await models.RPGUser.updateOne({ guildId, userId }, update);
  }
  await userService.addXp(guildId, userId, Math.round(10 * game.pets.xpMultiplier), 'xp');
  return { pet, species, egg, paid };
}

async function feed(guildId, userId, petId) {
  const game = await settingsService.getGame(guildId);
  const pet = await findOwnedPet(guildId, userId, petId);
  const cost = game.pets.feedCost;
  if (cost > 0) await userService.spendCoins(guildId, userId, cost, 'pet_feed', `pet_feed:${guildId}:${userId}:${pet._id}:${Date.now()}`, { petId: String(pet._id) });
  const xp = Math.round(35 * game.pets.xpMultiplier);
  const result = applyXp(pet.level, pet.xp, xp);
  const growth = 1 + (result.levelsGained || 0) * 0.05;
  const update = { $set: { level: result.level, xp: result.xp } };
  if (result.levelsGained > 0) {
    update.$inc = {
      hp: Math.max(1, Math.round(pet.hp * growth * 0.1)),
      attack: Math.max(1, Math.round(pet.attack * growth * 0.1)),
      defense: Math.max(1, Math.round(pet.defense * growth * 0.1)),
      speed: Math.max(1, Math.round(pet.speed * growth * 0.1)),
    };
  }
  let updated;
  try {
    updated = await models.Pet.findOneAndUpdate({ _id: pet._id, guildId, userId }, update, { new: true });
  } catch (error) {
    if (cost > 0) await userService.addCoins(guildId, userId, cost, 'pet_feed_refund', `pet_feed:${guildId}:${userId}:${pet._id}:${Date.now()}:refund`, { petId: String(pet._id) }).catch(() => {});
    throw error;
  }
  if (!updated) {
    if (cost > 0) await userService.addCoins(guildId, userId, cost, 'pet_feed_refund', `pet_feed:${guildId}:${userId}:${pet._id}:${Date.now()}:refund`, { petId: String(pet._id) }).catch(() => {});
    throw new UserError('Pet sudah tidak tersedia.');
  }
  return { pet: updated, xp, levelsGained: result.levelsGained, cost };
}

async function findOwnedPet(guildId, userId, petId) {
  const pet = petId
    ? await models.Pet.findOne({ _id: petId, guildId, userId }).lean()
    : await models.Pet.findOne({ guildId, userId }).sort({ level: -1 }).lean();
  if (!pet) throw new UserError('Pet tidak ditemukan di inventory.');
  if (pet.lockedBy) throw new UserError('Pet sedang dikunci di trade/market.');
  return pet;
}

async function equip(guildId, userId, petId) {
  const game = await settingsService.getGame(guildId);
  const pet = await findOwnedPet(guildId, userId, petId);
  const user = await userService.ensureUser(guildId, userId);
  const active = activeIdList(user);
  if (!active.includes(String(pet._id)) && active.length >= Math.max(1, game.pets.maxSlots)) {
    throw new UserError(`Slot pet aktif penuh (${active.length}/${game.pets.maxSlots}). Lepas salah satu dengan \`6pet unequip <id>\`.`);
  }
  await models.RPGUser.updateOne(
    { guildId, userId },
    { $addToSet: { activePetIds: pet._id }, $set: { activePetId: pet._id } },
  );
  return pet;
}

async function unequip(guildId, userId, petId) {
  const pet = await findOwnedPet(guildId, userId, petId);
  await models.RPGUser.updateOne({ guildId, userId }, { $pull: { activePetIds: pet._id } });
  const user = await models.RPGUser.findOne({ guildId, userId }).lean();
  if (user && String(user.activePetId || '') === String(pet._id)) {
    const remaining = (user.activePetIds || []).map(String).filter((id) => id !== String(pet._id));
    await models.RPGUser.updateOne({ guildId, userId }, { $set: { activePetId: remaining[0] || null } });
  }
  return pet;
}

async function inventory(guildId, userId) {
  return models.Pet.find({ guildId, userId }).sort({ level: -1, createdAt: -1 }).lean();
}

async function stats(guildId, userId, petId) {
  const pet = await findOwnedPet(guildId, userId, petId);
  return { pet, nextXp: xpForLevel(pet.level), rarity: getRarity(pet.rarity) };
}

async function upgrade(guildId, userId, petId) {
  const game = await settingsService.getGame(guildId);
  const pet = await findOwnedPet(guildId, userId, petId);
  const cost = Math.floor(100 * Math.pow(1.35, pet.level || 1));
  await userService.spendCoins(guildId, userId, cost, 'pet_upgrade', `pet_upgrade:${guildId}:${userId}:${pet._id}:${pet.level}:${Date.now()}`, { petId: String(pet._id) });
  let updated;
  try {
    updated = await models.Pet.findOneAndUpdate(
      { _id: pet._id, guildId, userId },
      { $inc: { attack: 3, defense: 2, hp: 8, speed: 1 } },
      { new: true },
    );
  } catch (error) {
    await userService.addCoins(guildId, userId, cost, 'pet_upgrade_refund', `pet_upgrade:${guildId}:${userId}:${pet._id}:refund`, { petId: String(pet._id) }).catch(() => {});
    throw error;
  }
  if (!updated) {
    await userService.addCoins(guildId, userId, cost, 'pet_upgrade_refund', `pet_upgrade:${guildId}:${userId}:${pet._id}:refund`, { petId: String(pet._id) }).catch(() => {});
    throw new UserError('Pet sudah tidak tersedia.');
  }
  return { pet: updated, cost, bonus: game.pets.bonusMultiplier };
}

async function evolve(guildId, userId, petId) {
  const game = await settingsService.getGame(guildId);
  const pet = await findOwnedPet(guildId, userId, petId);
  if (pet.evolved) throw new UserError('Pet ini sudah berevolusi.');
  if (pet.level < game.pets.evolveLevel) throw new UserError(`Butuh level ${game.pets.evolveLevel} untuk evolve (sekarang ${pet.level}).`);
  const updated = await models.Pet.findOneAndUpdate(
    { _id: pet._id, guildId, userId, evolved: false },
    {
      $set: { evolved: true, name: `Evolved ${pet.name}`, level: 1 },
      $inc: {
        hp: Math.round(pet.hp * 0.6),
        attack: Math.round(pet.attack * 0.6),
        defense: Math.round(pet.defense * 0.6),
        speed: Math.round(pet.speed * 0.6),
      },
    },
    { new: true },
  );
  if (!updated) throw new UserError('Evolusi gagal, coba lagi.');
  return { pet: updated, from: pet };
}

async function collection(guildId, userId) {
  const docs = await models.PetCollection.find({ guildId, userId }).lean();
  const map = new Map(docs.map((d) => [d.speciesId, d]));
  return PETS.map((species) => ({ ...species, count: map.get(species.id)?.count || 0, owned: Boolean(map.get(species.id)) }));
}

async function listCollection(guildId, userId) {
  return collection(guildId, userId);
}

module.exports = { hatch, feed, equip, unequip, inventory, stats, upgrade, evolve, collection, listCollection, findOwnedPet, activePets, detach, petsByRarity, _test: { eggRatesFor } };
