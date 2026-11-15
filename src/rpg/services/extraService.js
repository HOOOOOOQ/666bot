'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const userService = require('./userService');
const cooldownService = require('./cooldownService');
const petService = require('./petService');
const huntingService = require('./huntingService');
const questService = require('./questService');
const { MONSTERS, PETS, MONSTER_MAP, PET_MAP, EGGS, EGGS_MAP, WEAPON_MAP } = require('../data/catalog');
const { getRarity, RARITY_MAP } = require('../data/rarities');
const { playerBattleStats, formatCoins, xpForLevel } = require('../utils/formulas');
const { randomInt, pick, chance, randomFloat, weightedPick } = require('../utils/rng');
const { dayKey } = require('../utils/periods');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-extra');

function assertPositive(value, label = 'Jumlah') {
  const number = Math.floor(Number(value));
  if (!Number.isInteger(number) || number <= 0) throw new UserError(`${label} harus bilangan bulat positif.`);
  return number;
}

function cleanName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 32) throw new UserError('Nama harus 2–32 karakter.');
  return name;
}

async function profileSummary(guildId, userId) {
  const user = await userService.ensureUser(guildId, userId);
  const position = await userService.getPosition(guildId, userId, 'level', user.level || 1);
  return { user, position, nextXp: xpForLevel(user.level || 1) };
}

async function top(guildId, category = 'wealth', limit = 10) {
  const valid = new Set(['wealth', 'wallet', 'bank', 'level', 'hunt', 'battle', 'boss', 'games', 'shards']);
  const key = valid.has(String(category).toLowerCase()) ? String(category).toLowerCase() : 'wealth';
  if (key === 'shards') {
    return models.RPGUser.find({ guildId }).sort({ shards: -1 }).limit(Math.min(25, limit)).lean();
  }
  return userService.leaderboard(guildId, key, limit);
}

async function checklist(guildId, userId) {
  const quests = await questService.list(guildId, userId);
  return quests.filter((quest) => quest.type === 'daily' || quest.type === 'weekly').map((quest) => ({
    id: quest.id, title: quest.title, emoji: quest.emoji, type: quest.type,
    progress: quest.progress, target: quest.target, completed: quest.completed, claimed: quest.claimed,
  }));
}

async function vote(guildId, userId) {
  const cd = await cooldownService.claim(guildId, userId, 'vote', 12 * 60 * 60 * 1000);
  if (!cd.ok) throw new UserError(`Vote cooldown. Coba lagi <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);
  const reward = 250;
  try {
    const result = await userService.addCoins(guildId, userId, reward, 'vote', `vote:${guildId}:${userId}:${Date.now()}`, { source: 'vote' });
    await models.RPGUser.updateOne({ guildId, userId }, { $inc: { voteCount: 1 }, $set: { lastVoteAt: new Date() } });
    await questService.track(guildId, userId, 'vote', 1, result.user);
    return { reward, user: result.user };
  } catch (error) {
    await cooldownService.clear(guildId, userId, 'vote').catch(() => {});
    throw error;
  }
}

async function zoo(guildId, userId) {
  const [monsters, pets] = await Promise.all([
    models.Monster.find({ guildId, userId }).sort({ rarity: -1, createdAt: -1 }).limit(12).lean(),
    models.Pet.find({ guildId, userId }).sort({ rarity: -1, level: -1 }).limit(12).lean(),
  ]);
  const [monsterCount, petCount] = await Promise.all([
    models.Monster.countDocuments({ guildId, userId }),
    models.Pet.countDocuments({ guildId, userId }),
  ]);
  return { monsters, pets, monsterCount, petCount };
}

async function sacrifice(guildId, userId, monsterId) {
  const monster = await models.Monster.findOne({ _id: monsterId, guildId, userId }).lean();
  if (!monster) throw new UserError('Monster tidak ditemukan.');
  if (monster.lockedBy) throw new UserError('Monster sedang dikunci di trade/market.');
  const game = await settingsService.getGame(guildId);
  const coins = Math.max(10, Math.floor((monster.sellValue || 20) * 0.7));
  const xp = Math.max(5, Math.floor(coins / 4));
  if ((await userService.ensureUser(guildId, userId)).wallet + coins > (await settingsService.getEconomy(guildId)).maxWallet) {
    throw new UserError('Wallet penuh. Deposit dulu sebelum sacrifice.');
  }
  const deleted = await models.Monster.findOneAndDelete({ _id: monsterId, guildId, userId, lockedBy: null });
  if (!deleted) throw new UserError('Monster sedang diproses.');
  try {
    const result = await userService.addCoins(guildId, userId, coins, 'sacrifice', `sacrifice:${monsterId}`, { monsterId: String(monsterId) });
    await userService.addXp(guildId, userId, xp, 'xp');
    await models.MonsterCollection.updateOne({ guildId, userId, speciesId: monster.speciesId, count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
    await questService.track(guildId, userId, 'sacrifice', 1, result.user);
    return { monster, coins, xp };
  } catch (error) {
    await models.Monster.create({ ...deleted.toObject(), _id: deleted._id }).catch(() => {});
    throw error;
  }
}

async function simulate(guildId, userId) {
  const user = await userService.ensureUser(guildId, userId);
  const pets = await petService.activePets(guildId, userId, user);
  const game = await settingsService.getGame(guildId);
  const stats = playerBattleStats(user, pets, { ...game.battle, petBonusMultiplier: game.pets.bonusMultiplier });
  const species = pick(MONSTERS);
  const levelScale = 1 + Math.max(0, (user.huntLevel || 1) - 1) * 0.12;
  const enemy = {
    name: species.name,
    level: Math.max(1, Math.round((user.huntLevel || 1) + randomInt(-1, 2))),
    hp: Math.round(species.hp * levelScale),
    attack: Math.round(species.attack * levelScale),
    defense: Math.round(species.defense * levelScale),
    speed: species.speed,
  };
  const damage = Math.max(1, stats.attack - enemy.defense * 0.5);
  const enemyDamage = Math.max(1, enemy.attack - stats.defense * 0.5);
  const win = stats.hp / enemyDamage > enemy.hp / damage || stats.speed > enemy.speed;
  return { stats, enemy, win: Boolean(win), species };
}

async function inventory(guildId, userId) {
  const [monsters, pets, items, user] = await Promise.all([
    models.Monster.find({ guildId, userId }).sort({ createdAt: -1 }).limit(10).lean(),
    models.Pet.find({ guildId, userId }).sort({ createdAt: -1 }).limit(10).lean(),
    userService.getInventory(guildId, userId),
    userService.ensureUser(guildId, userId),
  ]);
  return { monsters, pets, items, user };
}

async function dex(guildId, userId) {
  const [monsterDocs, petDocs] = await Promise.all([
    models.MonsterCollection.find({ guildId, userId }).lean(),
    models.PetCollection.find({ guildId, userId }).lean(),
  ]);
  const monsters = MONSTERS.map((entry) => ({ ...entry, owned: Boolean(monsterDocs.find((doc) => doc.speciesId === entry.id)) }));
  const pets = PETS.map((entry) => ({ ...entry, owned: Boolean(petDocs.find((doc) => doc.speciesId === entry.id)) }));
  return { monsters, pets, monsterOwned: monsters.filter((m) => m.owned).length, petOwned: pets.filter((p) => p.owned).length };
}

async function openLootbox(guildId, userId, kind) {
  const box = String(kind || 'lootbox').toLowerCase();
  if (!['lootbox', 'crate'].includes(box)) throw new UserError('Pilih `lootbox` atau `crate`.');
  const price = box === 'crate' ? 4500 : 1500;
  const key = `${box}:${guildId}:${userId}:${Date.now()}`;
  const spent = await userService.spendCoins(guildId, userId, price, 'lootbox_buy', `${key}:buy`, { box });
  const roll = randomInt(1, 100);
  try {
    if (roll <= (box === 'crate' ? 30 : 45)) {
      const amount = randomInt(box === 'crate' ? 400 : 150, box === 'crate' ? 1800 : 700);
      const result = await userService.addCoins(guildId, userId, amount, 'lootbox', `${key}:coins`, { box });
      return { box, type: 'coins', amount, user: result.user };
    }
    if (roll <= (box === 'crate' ? 55 : 75)) {
      const amount = randomInt(1, box === 'crate' ? 6 : 3);
      await models.RPGUser.updateOne({ guildId, userId }, { $inc: { shards: amount } });
      return { box, type: 'shards', amount };
    }
    if (roll <= (box === 'crate' ? 85 : 95)) {
      const itemId = box === 'crate' ? (chance(50) ? 'void_scythe' : 'titan_hammer') : (chance(50) ? 'iron_sword' : 'bait');
      await userService.addItem(guildId, userId, itemId, 1);
      return { box, type: 'item', itemId, name: WEAPON_MAP[itemId]?.name || itemId };
    }
    const egg = box === 'crate' ? 'egg_legendary' : 'egg_rare';
    await userService.addItem(guildId, userId, egg, 1);
    return { box, type: 'egg', egg, name: EGGS_MAP[egg].name };
  } catch (error) {
    await userService.addCoins(guildId, userId, price, 'lootbox_refund', `${key}:refund`, { box }).catch(() => {});
    throw error;
  } finally {
    log.debug(`${spent.user?._id || userId} opened ${box}`);
  }
}

async function equipWeapon(guildId, userId, itemId) {
  if (!itemId || String(itemId).toLowerCase() === 'unequip') {
    const user = await userService.ensureUser(guildId, userId);
    if (!user.equippedWeapon) throw new UserError('Kamu belum memakai weapon.');
    const old = user.equippedWeapon;
    await models.RPGUser.updateOne({ guildId, userId }, { $set: { equippedWeapon: null } });
    await userService.addItem(guildId, userId, old.id, 1).catch(() => {});
    return { weapon: old, unequipped: true };
  }
  const weapon = WEAPON_MAP[String(itemId)];
  if (!weapon) throw new UserError('Weapon tidak ditemukan. Lihat `6weapon list`.');
  const user = await userService.ensureUser(guildId, userId);
  await userService.removeItem(guildId, userId, weapon.id, 1);
  try {
    await models.RPGUser.updateOne({ guildId, userId }, {
      $set: {
        equippedWeapon: { id: weapon.id, name: weapon.name, emoji: weapon.emoji, attack: weapon.effect.attack, defense: weapon.effect.defense, speed: weapon.effect.speed },
      },
    });
    if (user.equippedWeapon?.id) await userService.addItem(guildId, userId, user.equippedWeapon.id, 1).catch(() => {});
    return { weapon, old: user.equippedWeapon || null, unequipped: false };
  } catch (error) {
    await userService.addItem(guildId, userId, weapon.id, 1).catch(() => {});
    throw error;
  }
}

async function rename(guildId, userId, type, id, name) {
  const kind = String(type || '').toLowerCase();
  const clean = cleanName(name);
  if (!['monster', 'pet'].includes(kind)) throw new UserError('Tipe harus `monster` atau `pet`.');
  const model = kind === 'monster' ? models.Monster : models.Pet;
  const doc = await model.findOne({ _id: id, guildId, userId }).lean();
  if (!doc) throw new UserError(`${kind} tidak ditemukan.`);
  const cost = 500;
  const key = `rename:${kind}:${id}:${Date.now()}`;
  await userService.spendCoins(guildId, userId, cost, 'rename', key, { type: kind, id: String(id) });
  try {
    const updated = await model.findOneAndUpdate({ _id: id, guildId, userId }, { $set: { name: clean } }, { new: true }).lean();
    return { type: kind, before: doc.name, after: updated.name, cost };
  } catch (error) {
    await userService.addCoins(guildId, userId, cost, 'rename_refund', `${key}:refund`).catch(() => {});
    throw error;
  }
}

async function dismantle(guildId, userId, type, id) {
  const kind = String(type || '').toLowerCase();
  if (!['monster', 'pet'].includes(kind)) throw new UserError('Tipe harus `monster` atau `pet`.');
  const model = kind === 'monster' ? models.Monster : models.Pet;
  const doc = await model.findOne({ _id: id, guildId, userId, lockedBy: null }).lean();
  if (!doc) throw new UserError(`${kind} tidak ditemukan atau sedang dikunci.`);
  const shards = Math.max(1, Math.round((RARITY_MAP[doc.rarity]?.coinMultiplier || 1) * (kind === 'pet' ? 3 : 2)));
  const deleted = await model.findOneAndDelete({ _id: id, guildId, userId, lockedBy: null });
  if (!deleted) throw new UserError('Item sedang diproses.');
  try {
    await models.RPGUser.updateOne({ guildId, userId }, { $inc: { shards } });
    await models.PetCollection.updateOne({ guildId, userId, speciesId: doc.speciesId, count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
    return { type: kind, name: doc.name, shards };
  } catch (error) {
    await model.create({ ...deleted.toObject(), _id: deleted._id }).catch(() => {});
    throw error;
  }
}

async function toggleAutoHunt(guildId, userId, enabled, channelId = null) {
  const doc = await models.AutoHunt.findOneAndUpdate(
    { guildId, userId },
    { $set: { enabled: Boolean(enabled), channelId, lastResult: null }, $setOnInsert: { totalRuns: 0 } },
    { upsert: true, new: true },
  );
  return doc;
}

async function autoHuntTick() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const due = await models.AutoHunt.find({ enabled: true, $or: [{ lastRunAt: null }, { lastRunAt: { $lte: cutoff } }] }).limit(10).lean();
  for (const entry of due) {
    try {
      const result = await huntingService.hunt(entry.guildId, entry.userId, {}, `autohunt:${entry._id}:${Date.now()}`);
      await models.AutoHunt.updateOne(
        { _id: entry._id },
        { $set: { lastRunAt: new Date(), lastResult: result.spawned ? `Found ${result.monster?.name || 'monster'}` : 'No spawn' }, $inc: { totalRuns: 1 } },
      );
    } catch (error) {
      await models.AutoHunt.updateOne({ _id: entry._id }, { $set: { lastRunAt: new Date(), lastResult: error.message.slice(0, 180) } }).catch(() => {});
    }
  }
  return due.length;
}

async function lotteryStatus(guildId) {
  const roundKey = dayKey();
  let round = await models.Lottery.findOne({ guildId, roundKey }).lean();
  if (!round) {
    round = await models.Lottery.findOneAndUpdate(
      { guildId, roundKey },
      { $setOnInsert: { guildId, roundKey, status: 'open', ticketPrice: 100, pot: 0, totalTickets: 0, endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { upsert: true, new: true },
    ).lean();
  }
  return round;
}

async function buyLottery(guildId, userId, tickets = 1) {
  const count = Math.min(100, assertPositive(tickets, 'Tiket'));
  const round = await lotteryStatus(guildId);
  if (round.status !== 'open' || new Date(round.endsAt).getTime() <= Date.now()) throw new UserError('Lottery round ini sudah ditutup.');
  const total = round.ticketPrice * count;
  const key = `lottery:${round._id}:${userId}:${Date.now()}`;
  const spent = await userService.spendCoins(guildId, userId, total, 'lottery_ticket', key, { roundId: String(round._id), tickets: count });
  try {
    await models.Lottery.updateOne({ _id: round._id, status: 'open' }, { $inc: { pot: total, totalTickets: count } });
    await models.LotteryTicket.findOneAndUpdate(
      { roundId: round._id, userId },
      { $inc: { count }, $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    return { round: await models.Lottery.findById(round._id).lean(), tickets: count, total, user: spent.user };
  } catch (error) {
    await userService.addCoins(guildId, userId, total, 'lottery_refund', `${key}:refund`).catch(() => {});
    throw error;
  }
}

async function drawLottery(guildId) {
  const round = await models.Lottery.findOneAndUpdate(
    { guildId, status: 'open', endsAt: { $lte: new Date() } },
    { $set: { status: 'drawing' } },
    { new: true },
  );
  if (!round) return null;
  const tickets = await models.LotteryTicket.find({ roundId: round._id }).lean();
  if (!tickets.length) {
    await models.Lottery.updateOne({ _id: round._id }, { $set: { status: 'drawn', drawnAt: new Date(), winnerId: null } });
    return { winnerId: null, pot: round.pot };
  }
  const total = tickets.reduce((sum, ticket) => sum + ticket.count, 0);
  let roll = randomInt(1, total);
  let winner = tickets[tickets.length - 1];
  for (const ticket of tickets) {
    roll -= ticket.count;
    if (roll <= 0) { winner = ticket; break; }
  }
  try {
    if (round.pot > 0) await userService.addCoins(guildId, winner.userId, round.pot, 'lottery_win', `lottery:${round._id}:payout`, { roundId: String(round._id) });
  } catch (error) {
    await models.Lottery.updateOne({ _id: round._id }, { $set: { status: 'open' } }).catch(() => {});
    throw error;
  }
  await models.Lottery.updateOne({ _id: round._id }, { $set: { status: 'drawn', winnerId: winner.userId, winningTicket: winner.count, drawnAt: new Date() } });
  return { winnerId: winner.userId, pot: round.pot };
}

async function proposeMarriage(guildId, userId, targetId) {
  if (String(userId) === String(targetId)) throw new UserError('Tidak bisa menikahi diri sendiri.');
  const [me, target] = await Promise.all([userService.ensureUser(guildId, userId), userService.ensureUser(guildId, targetId)]);
  if (me.partnerId) throw new UserError('Kamu sudah menikah.');
  if (target.partnerId) throw new UserError('Dia sudah menikah dengan orang lain.');
  const key = `marriage:${guildId}:${userId}:${targetId}:${Date.now()}`;
  const session = await models.GameSession.create({ guildId, userId, opponentId: targetId, game: 'marriage', status: 'pending', idempotencyKey: key, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return session;
}

async function acceptMarriage(guildId, userId, proposalId) {
  const proposal = await models.GameSession.findOneAndUpdate(
    { _id: proposalId, guildId, opponentId: userId, game: 'marriage', status: 'pending', expiresAt: { $gt: new Date() } },
    { $set: { status: 'completed' } },
    { new: true },
  );
  if (!proposal) throw new UserError('Proposal tidak ditemukan atau sudah kedaluwarsa.');
  const mine = await models.RPGUser.updateOne({ guildId, userId, partnerId: null }, { $set: { partnerId: proposal.userId, marriedAt: new Date() } });
  if (!mine.modifiedCount) {
    await models.GameSession.updateOne({ _id: proposal._id }, { $set: { status: 'pending' } });
    throw new UserError('Kamu sudah menikah.');
  }
  const theirs = await models.RPGUser.updateOne({ guildId, userId: proposal.userId, partnerId: null }, { $set: { partnerId: userId, marriedAt: new Date() } });
  if (!theirs.modifiedCount) {
    await models.RPGUser.updateOne({ guildId, userId }, { $set: { partnerId: null, marriedAt: null } });
    await models.GameSession.updateOne({ _id: proposal._id }, { $set: { status: 'pending' } });
    throw new UserError('Pengirim proposal sudah menikah.');
  }
  return proposal;
}

async function socialCount(guildId, userId, key, amount = 1) {
  await userService.ensureUser(guildId, userId);
  await models.RPGUser.updateOne({ guildId, userId }, { $inc: { [`social.${key}`]: amount } });
}

module.exports = {
  profileSummary, top, checklist, vote, zoo, sacrifice, simulate, inventory, dex,
  openLootbox, equipWeapon, rename, dismantle, toggleAutoHunt, autoHuntTick,
  lotteryStatus, buyLottery, drawLottery, proposeMarriage, acceptMarriage, socialCount,
  assertPositive, cleanName,
};
