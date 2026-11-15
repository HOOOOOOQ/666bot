'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const userService = require('./userService');
const { formatCoins, xpForLevel, applyXp } = require('../utils/formulas');
const { seasonKey } = require('../utils/periods');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-guild');

function memberFilter(discordGuildId, userId) {
  return { discordGuildId, userId };
}

async function create(discordGuildId, userId, name) {
  const game = await settingsService.getGame(discordGuildId);
  const cfg = game.guild;
  if (!cfg.enabled) throw new UserError('Guild system sedang dinonaktifkan admin.');
  const clean = String(name || '').trim().slice(0, 32);
  if (clean.length < 3) throw new UserError('Nama guild minimal 3 karakter.');
  const existing = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (existing) throw new UserError('Kamu sudah berada di guild. Keluar dulu dengan `tguild leave`.');
  const nameTaken = await models.Guild.findOne({ discordGuildId, name: clean }).lean();
  if (nameTaken) throw new UserError('Nama guild sudah dipakai.');
  await userService.ensureUser(discordGuildId, userId);
  const creationKey = `guild_create:${discordGuildId}:${userId}:${Date.now()}`;
  if (cfg.creationCost > 0) {
    await userService.spendCoins(discordGuildId, userId, cfg.creationCost, 'guild_create', creationKey, { name: clean });
  }
  let guild;
  try {
    guild = await models.Guild.create({
      discordGuildId, name: clean, leaderId: userId, maxMembers: cfg.maxMembers,
      season: seasonKey(new Date(), cfg.season), missions: {},
    });
    await models.GuildMember.create({ guildRef: guild._id, discordGuildId, userId, role: 'leader' });
    await models.RPGUser.updateOne({ guildId: discordGuildId, userId }, { $set: { rpgGuildId: guild._id } });
  } catch (error) {
    if (cfg.creationCost > 0) await userService.addCoins(discordGuildId, userId, cfg.creationCost, 'guild_create_refund', `${creationKey}:refund`, {}).catch(() => {});
    if (guild) {
      await models.GuildMember.deleteMany({ guildRef: guild._id }).catch(() => {});
      await models.Guild.deleteOne({ _id: guild._id }).catch(() => {});
    }
    throw error;
  }
  return guild;
}

async function join(discordGuildId, userId, nameOrId) {
  const game = await settingsService.getGame(discordGuildId);
  const cfg = game.guild;
  const existing = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (existing) throw new UserError('Kamu sudah berada di guild.');
  const guild = await models.Guild.findOne({
    discordGuildId,
    $or: [{ name: String(nameOrId || '') }, ...(String(nameOrId || '').match(/^[a-f0-9]{24}$/i) ? [{ _id: nameOrId }] : [])],
  }).lean();
  if (!guild) throw new UserError('Guild tidak ditemukan.');
  if (guild.memberCount >= Math.min(guild.maxMembers || cfg.maxMembers, cfg.maxMembers)) throw new UserError('Guild sudah penuh.');
  try {
    await models.GuildMember.create({ guildRef: guild._id, discordGuildId, userId, role: 'member' });
  } catch (error) {
    if (error.code === 11000) throw new UserError('Kamu sudah berada di guild.');
    throw error;
  }
  await models.Guild.updateOne({ _id: guild._id }, { $inc: { memberCount: 1 } });
  await models.RPGUser.updateOne({ guildId: discordGuildId, userId }, { $set: { rpgGuildId: guild._id } });
  return guild;
}

async function leave(discordGuildId, userId) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  const guild = await models.Guild.findOne({ _id: member.guildRef }).lean();
  if (guild?.leaderId === userId) throw new UserError('Leader tidak bisa leave. Transfer kepemimpinan atau bubarkan guild.');
  await models.GuildMember.deleteOne({ _id: member._id });
  await models.Guild.updateOne({ _id: member.guildRef }, { $inc: { memberCount: -1 } });
  await models.RPGUser.updateOne({ guildId: discordGuildId, userId }, { $set: { rpgGuildId: null } });
  return guild;
}

async function info(discordGuildId, userId) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  const guild = await models.Guild.findOne({ _id: member.guildRef }).lean();
  const members = await models.GuildMember.find({ guildRef: member.guildRef }).sort({ contribution: -1 }).limit(25).lean();
  return { guild, member, members };
}

async function members(discordGuildId, userId) {
  return info(discordGuildId, userId);
}

async function upgrade(discordGuildId, userId) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  if (member.role !== 'leader') throw new UserError('Hanya leader yang bisa upgrade guild.');
  const guild = await models.Guild.findOne({ _id: member.guildRef }).lean();
  if (!guild) throw new UserError('Guild tidak ditemukan.');
  const game = await settingsService.getGame(discordGuildId);
  const cost = Math.floor(game.guild.upgradeBaseCost * Math.pow(1.6, guild.level - 1));
  if ((guild.bank || 0) < cost) throw new UserError(`Bank guild kurang. Butuh ${formatCoins(cost)} koin (sekarang ${formatCoins(guild.bank || 0)}).`);
  const updated = await models.Guild.findOneAndUpdate(
    { _id: guild._id, level: guild.level, bank: { $gte: cost } },
    { $inc: { level: 1, xp: 0, bank: -cost, maxMembers: 5 } },
    { new: true },
  );
  if (!updated) throw new UserError('Upgrade gagal, coba lagi.');
  return { guild: updated, cost };
}

async function deposit(discordGuildId, userId, amount) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  const value = userService.assertAmount(amount);
  const key = `guild_deposit:${discordGuildId}:${userId}:${Date.now()}`;
  const result = await userService.spendCoins(discordGuildId, userId, value, 'guild_deposit', key, { guildRef: String(member.guildRef) });
  try {
    await models.Guild.updateOne({ _id: member.guildRef }, { $inc: { bank: value, xp: Math.floor(value / 10) } });
    await models.GuildMember.updateOne({ _id: member._id }, { $inc: { contribution: value } });
  } catch (error) {
    await userService.addCoins(discordGuildId, userId, value, 'guild_deposit_refund', `${key}:refund`, { guildRef: String(member.guildRef) }).catch(() => {});
    throw error;
  }
  return { guildRef: member.guildRef, amount: value, user: result.user };
}

async function addXp(discordGuildId, userId, amount) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) return null;
  const guild = await models.Guild.findOne({ _id: member.guildRef });
  if (!guild) return null;
  const game = await settingsService.getGame(discordGuildId);
  const gained = Math.max(0, Math.floor(amount * game.guild.xpMultiplier));
  let nextXp = (guild.xp || 0) + gained;
  let nextLevel = guild.level || 1;
  let guard = 0;
  while (nextXp >= xpForLevel(nextLevel) * 3 && guard < 20) {
    nextXp -= xpForLevel(nextLevel) * 3;
    nextLevel += 1;
    guard += 1;
  }
  await models.Guild.updateOne({ _id: guild._id }, { $set: { xp: nextXp, level: nextLevel } });
  return { level: nextLevel, xp: nextXp, levelsGained: guard };
}

async function leaderboard(discordGuildId, limit = 10) {
  const filter = discordGuildId ? { discordGuildId } : {};
  return models.Guild.find(filter).sort({ level: -1, warPoints: -1, bank: -1 }).limit(Math.min(25, limit)).lean();
}

async function warChallenge(discordGuildId, userId, targetName, requestId) {
  const game = await settingsService.getGame(discordGuildId);
  const cfg = game.guild;
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  if (member.role !== 'leader') throw new UserError('Hanya leader yang bisa mendeklarasikan war.');
  const challenger = await models.Guild.findOne({ _id: member.guildRef }).lean();
  const defender = await models.Guild.findOne({ discordGuildId, $or: [{ name: String(targetName || '') }, ...(String(targetName || '').match(/^[a-f0-9]{24}$/i) ? [{ _id: targetName }] : [])] }).lean();
  if (!defender) throw new UserError('Guild target tidak ditemukan.');
  if (String(defender._id) === String(challenger._id)) throw new UserError('Tidak bisa war dengan guild sendiri.');
  if ((challenger.memberCount || 0) < cfg.warMinMembers) throw new UserError(`Guild butuh minimal ${cfg.warMinMembers} anggota.`);
  if ((challenger.level || 1) < cfg.warMinLevel) throw new UserError(`Guild butuh level minimal ${cfg.warMinLevel}.`);
  if ((defender.memberCount || 0) < cfg.warMinMembers) throw new UserError('Guild target belum memenuhi syarat minimal anggota.');
  const existing = await models.GuildWar.findOne({ discordGuildId, status: { $in: ['pending', 'active'] }, $or: [{ challengerGuildId: challenger._id }, { defenderGuildId: challenger._id }, { challengerGuildId: defender._id }, { defenderGuildId: defender._id }] }).lean();
  if (existing) throw new UserError('Salah satu guild sedang dalam war.');
  const war = await models.GuildWar.create({
    discordGuildId,
    challengerGuildId: challenger._id,
    defenderGuildId: defender._id,
    status: 'pending',
    season: seasonKey(new Date(), game.guild.season),
    idempotencyKey: `war:${discordGuildId}:${challenger._id}:${defender._id}:${requestId || Date.now()}`,
  });
  return { war, challenger, defender };
}

async function warAccept(discordGuildId, userId, warId) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member || member.role !== 'leader') throw new UserError('Hanya leader guild target yang bisa accept war.');
  const war = await models.GuildWar.findOne({ _id: warId, discordGuildId }).lean();
  if (!war) throw new UserError('War tidak ditemukan.');
  if (String(war.defenderGuildId) !== String(member.guildRef)) throw new UserError('Guild-mu bukan target war ini.');
  const game = await settingsService.getGame(discordGuildId);
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + game.guild.warDurationHours * 3600000);
  const updated = await models.GuildWar.findOneAndUpdate(
    { _id: warId, status: 'pending' },
    { $set: { status: 'active', startsAt, endsAt } },
    { new: true },
  );
  if (!updated) throw new UserError('War sudah diproses.');
  return updated;
}

async function addBattlePoints(discordGuildId, winnerId, loserId, antiFarm = false) {
  if (antiFarm) return null;
  const [winner, loser] = await Promise.all([
    models.RPGUser.findOne({ guildId: discordGuildId, userId: winnerId }).lean(),
    models.RPGUser.findOne({ guildId: discordGuildId, userId: loserId }).lean(),
  ]);
  if (!winner?.rpgGuildId || !loser?.rpgGuildId) return null;
  const war = await models.GuildWar.findOne({
    discordGuildId,
    status: 'active',
    $or: [
      { challengerGuildId: winner.rpgGuildId, defenderGuildId: loser.rpgGuildId },
      { challengerGuildId: loser.rpgGuildId, defenderGuildId: winner.rpgGuildId },
    ],
  });
  if (!war) return null;
  const field = String(war.challengerGuildId) === String(winner.rpgGuildId) ? 'challengerPoints' : 'defenderPoints';
  await models.GuildWar.updateOne({ _id: war._id }, { $inc: { [field]: 10 } });
  return war;
}

async function warStatus(discordGuildId, userId) {
  const member = await models.GuildMember.findOne(memberFilter(discordGuildId, userId)).lean();
  if (!member) throw new UserError('Kamu tidak berada di guild.');
  const war = await models.GuildWar.findOne({
    discordGuildId,
    $or: [{ challengerGuildId: member.guildRef }, { defenderGuildId: member.guildRef }],
    status: { $in: ['pending', 'active'] },
  }).sort({ createdAt: -1 }).lean();
  if (!war) return { war: null };
  const [challenger, defender] = await Promise.all([
    models.Guild.findOne({ _id: war.challengerGuildId }).lean(),
    models.Guild.findOne({ _id: war.defenderGuildId }).lean(),
  ]);
  return { war, challenger, defender };
}

async function warLeaderboard(discordGuildId, limit = 10) {
  return models.Guild.find({ discordGuildId }).sort({ warPoints: -1, wins: -1 }).limit(Math.min(25, limit)).lean();
}

async function finalizeWars() {
  const expired = await models.GuildWar.find({ status: 'active', endsAt: { $lte: new Date() } }).limit(50).lean();
  for (const war of expired) {
    const winnerGuildId = war.challengerPoints >= war.defenderPoints ? war.challengerGuildId : war.defenderGuildId;
    const loserGuildId = String(winnerGuildId) === String(war.challengerGuildId) ? war.defenderGuildId : war.challengerGuildId;
    const updated = await models.GuildWar.findOneAndUpdate(
      { _id: war._id, status: 'active' },
      { $set: { status: 'completed', winnerGuildId } },
      { new: true },
    );
    if (!updated) continue;
    await models.Guild.updateOne({ _id: winnerGuildId }, { $inc: { wins: 1, warPoints: 100 } });
    await models.Guild.updateOne({ _id: loserGuildId }, { $inc: { losses: 1 } });
    const game = await settingsService.getGame(war.discordGuildId);
    const reward = game.guild.warReward;
    if (reward > 0) await models.Guild.updateOne({ _id: winnerGuildId }, { $inc: { bank: reward } });
    log.info(`Guild war ${war._id} selesai. Winner: ${winnerGuildId}`);
  }
  return expired.length;
}

module.exports = {
  create, join, leave, info, members, upgrade, deposit, addXp, leaderboard,
  warChallenge, warAccept, addBattlePoints, warStatus, warLeaderboard, finalizeWars,
};
