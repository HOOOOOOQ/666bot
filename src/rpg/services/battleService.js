'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const userService = require('./userService');
const questService = require('./questService');
const { playerBattleStats, damage, eloDelta, formatCoins } = require('../utils/formulas');
const { randomFloat } = require('../utils/rng');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-battle');

async function buildSnapshot(guildId, userId, profile = {}) {
  const user = await userService.ensureUser(guildId, userId, profile);
  let pet = null;
  if (user.activePetId) pet = await models.Pet.findOne({ _id: user.activePetId, guildId, userId }).lean();
  const game = await settingsService.getGame(guildId);
  return {
    userId,
    username: profile.username || user.username || `User ${userId}`,
    level: user.level || 1,
    rating: user.battleRating || 1000,
    stats: playerBattleStats(user, pet, game.battle),
    pet: pet ? { id: String(pet._id), name: pet.name, skill: pet.skill, attack: pet.attack } : null,
  };
}

async function challenge(guildId, challengerId, opponentId, challengerProfile = {}, opponentProfile = {}) {
  if (String(challengerId) === String(opponentId)) throw new UserError('Tidak bisa menantang diri sendiri.');
  const game = await settingsService.getGame(guildId);
  if (!game.battle.enabled) throw new UserError('Battle sedang dinonaktifkan admin.');
  const [a, b] = await Promise.all([
    userService.ensureUser(guildId, challengerId, challengerProfile),
    userService.ensureUser(guildId, opponentId, opponentProfile),
  ]);
  if (Math.abs((a.battleRating || 1000) - (b.battleRating || 1000)) > game.battle.maxRatingGap) {
    throw new UserError('Selisih rating terlalu jauh. Tantang lawan dengan rating seimbang.');
  }
  const pending = await models.Battle.findOne({
    guildId,
    status: 'pending',
    $or: [
      { challengerId, opponentId },
      { challengerId: opponentId, opponentId: challengerId },
    ],
    expiresAt: { $gt: new Date() },
  });
  if (pending) throw new UserError('Sudah ada tantangan battle yang menunggu antara kalian.');
  await models.Battle.updateMany(
    { guildId, status: 'pending', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } },
  ).catch(() => {});
  const expiry = new Date(Date.now() + game.battle.challengeExpirySec * 1000);
  const battle = await models.Battle.create({
    guildId,
    challengerId,
    opponentId,
    status: 'pending',
    challengerSnapshot: await buildSnapshot(guildId, challengerId, challengerProfile),
    opponentSnapshot: await buildSnapshot(guildId, opponentId, opponentProfile),
    expiresAt: expiry,
    idempotencyKey: `battle:${guildId}:${challengerId}:${opponentId}:${Date.now()}`,
  });
  return battle;
}

function simulateBattle(snapshotA, snapshotB, settings = {}) {
  const a = { ...snapshotA, hp: snapshotA.stats.hp, maxHp: snapshotA.stats.hp, stats: { ...snapshotA.stats } };
  const b = { ...snapshotB, hp: snapshotB.stats.hp, maxHp: snapshotB.stats.hp, stats: { ...snapshotB.stats } };
  const log = [];
  const crit = Number(settings.critChance) || 15;
  const first = a.stats.speed >= b.stats.speed ? [a, b] : [b, a];
  let [atk, def] = first;
  let rounds = 0;
  while (a.hp > 0 && b.hp > 0 && rounds < 60) {
    rounds += 1;
    let bonus = 1;
    if (atk.pet?.skill === 'inferno' || atk.pet?.skill === 'apocalypse') bonus += 0.18;
    if (atk.pet?.skill === 'annihilate') bonus += 0.3;
    if (def.pet?.skill === 'guard') bonus -= 0.1;
    const hit = damage({ attack: atk.stats.attack * bonus }, def.stats, crit, randomFloat);
    def.hp = Math.max(0, def.hp - hit.value);
    log.push(`${atk.username} menyerang ${def.username} sebesar **${formatCoins(hit.value)}**${hit.crit ? ' 💥 CRIT' : ''}${def.hp > 0 ? '' : ' ☠️'}`);
    if (def.hp <= 0) break;
    if (atk.pet?.skill === 'regen' || atk.pet?.skill === 'tide') {
      const heal = Math.round(atk.maxHp * 0.04);
      atk.hp = Math.min(atk.maxHp, atk.hp + heal);
    }
    if (atk.pet?.skill === 'freeze' && randomFloat() < 0.1) {
      log.push(`${def.username} terkena freeze dan melewatkan giliran.`);
    } else {
      const counter = damage({ attack: def.stats.attack }, atk.stats, crit, randomFloat);
      atk.hp = Math.max(0, atk.hp - counter.value);
      log.push(`${def.username} membalas ${atk.username} sebesar **${formatCoins(counter.value)}**${counter.crit ? ' 💥 CRIT' : ''}`);
    }
    [atk, def] = [def, atk];
  }
  const winner = a.hp > b.hp ? a : b;
  const loser = winner === a ? b : a;
  return {
    winnerId: winner.userId,
    loserId: loser.userId,
    rounds,
    log,
    aHp: a.hp,
    bHp: b.hp,
  };
}

async function accept(guildId, userId, battleId, profile = {}) {
  const battle = await models.Battle.findOne({ _id: battleId, guildId }).lean();
  if (!battle) throw new UserError('Battle tidak ditemukan.');
  if (battle.opponentId !== userId) throw new UserError('Hanya lawan yang ditantang yang bisa accept.');
  if (battle.status === 'completed') return { battle, alreadyDone: true };
  if (battle.status !== 'pending') throw new UserError(`Battle status: ${battle.status}.`);
  if (battle.expiresAt && new Date(battle.expiresAt).getTime() <= Date.now()) {
    await models.Battle.updateOne({ _id: battleId }, { $set: { status: 'expired' } });
    throw new UserError('Tantangan sudah kedaluwarsa.');
  }
  const game = await settingsService.getGame(guildId);
  const [snapA, snapB] = await Promise.all([
    buildSnapshot(guildId, battle.challengerId, {}),
    buildSnapshot(guildId, battle.opponentId, profile),
  ]);
  const claimed = await models.Battle.findOneAndUpdate(
    { _id: battleId, status: 'pending' },
    { $set: { status: 'active', challengerSnapshot: snapA, opponentSnapshot: snapB } },
    { new: true },
  ).catch(() => null);
  let active = claimed;
  if (!active) {
    const current = await models.Battle.findOne({ _id: battleId }).lean();
    if (current?.status === 'completed') return { battle: current, alreadyDone: true };
    throw new UserError('Battle sedang diproses instance lain.');
  }

  const result = simulateBattle(active.challengerSnapshot, active.opponentSnapshot, game.battle);
  const recent = await models.Battle.countDocuments({
    guildId,
    status: 'completed',
    createdAt: { $gte: new Date(Date.now() - 86400000) },
    $or: [
      { challengerId: battle.challengerId, opponentId: battle.opponentId },
      { challengerId: battle.opponentId, opponentId: battle.challengerId },
    ],
  });
  const antiFarm = recent >= 3;
  const reward = antiFarm ? 0 : game.battle.reward;
  const xpReward = antiFarm ? Math.floor(game.battle.xpReward / 4) : game.battle.xpReward;
  const delta = Math.abs(eloDelta(snapA.rating, snapB.rating, result.winnerId === snapA.userId ? 1 : 0));

  const completed = await models.Battle.findOneAndUpdate(
    { _id: battleId, status: 'active' },
    { $set: { status: 'completed', winnerId: result.winnerId, loserId: result.loserId, log: result.log, reward, xpReward } },
    { new: true },
  );
  if (!completed) {
    const current = await models.Battle.findOne({ _id: battleId }).lean();
    return { battle: current, alreadyDone: true };
  }

  const winnerId = result.winnerId;
  const loserId = result.loserId;
  await models.RPGUser.updateOne(
    { guildId, userId: winnerId },
    { $inc: { battleWins: 1, totalBattles: 1, battleStreak: 1, battleRating: delta } },
  );
  await models.RPGUser.updateOne(
    { guildId, userId: loserId },
    { $inc: { battleLosses: 1, totalBattles: 1, battleRating: -delta }, $set: { battleStreak: 0 } },
  );
  if (reward > 0) await userService.addCoins(guildId, winnerId, reward, 'battle_win', `battle:${battleId}:reward`, { opponentId: loserId });
  await userService.addXp(guildId, winnerId, xpReward, 'xp');
  await userService.addXp(guildId, loserId, Math.max(1, Math.floor(xpReward / 3)), 'xp');
  const winnerUser = await models.RPGUser.findOne({ guildId, userId: winnerId }).catch(() => null);
  await questService.track(guildId, winnerId, 'battleWin', 1, winnerUser).catch(() => {});
  try {
    const guildWar = require('./guildService');
    await guildWar.addBattlePoints(guildId, winnerId, loserId);
  } catch (error) {
    log.warn(`Guild war hook failed: ${error.message}`);
  }
  return {
    battle: completed,
    winnerId,
    loserId,
    reward,
    xpReward,
    antiFarm,
    ratingDelta: delta,
    result,
    snapshots: { a: snapA, b: snapB },
    alreadyDone: false,
  };
}

async function decline(guildId, userId, battleId) {
  const updated = await models.Battle.findOneAndUpdate(
    { _id: battleId, guildId, opponentId: userId, status: 'pending' },
    { $set: { status: 'declined' } },
    { new: true },
  );
  if (!updated) throw new UserError('Tantangan tidak ditemukan atau sudah diproses.');
  return updated;
}

async function stats(guildId, userId) {
  const user = await userService.ensureUser(guildId, userId);
  return {
    user,
    rating: user.battleRating || 1000,
    wins: user.battleWins || 0,
    losses: user.battleLosses || 0,
    streak: user.battleStreak || 0,
    winRate: user.battleWins + user.battleLosses > 0 ? Math.round((user.battleWins / (user.battleWins + user.battleLosses)) * 100) : 0,
  };
}

async function leaderboard(guildId, limit = 10) {
  return models.RPGUser.find({ guildId }).sort({ battleRating: -1, battleWins: -1 }).limit(Math.min(25, limit)).lean();
}

module.exports = { challenge, accept, decline, stats, leaderboard, simulateBattle, buildSnapshot };
