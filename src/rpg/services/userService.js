'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const { createLogger } = require('../../utils/logger');
const { applyXp, xpForLevel, formatCoins } = require('../utils/formulas');
const { dayKey, weekKey, monthKey } = require('../utils/periods');
const { withTransaction, sessionOptions } = require('../utils/db');
const { randomInt } = require('../utils/rng');
const settingsService = require('./settingsService');
const cooldownService = require('./cooldownService');

const log = createLogger('rpg-user');

function assertAmount(amount) {
  const num = Number(amount);
  if (!Number.isInteger(num) || num <= 0) throw new UserError('Jumlah harus bilangan bulat positif.');
  return num;
}

async function ensureUser(guildId, userId, profile = {}) {
  const economy = await settingsService.getEconomy(guildId);
  let user = await models.RPGUser.findOne({ guildId, userId });
  if (!user) {
    try {
      user = await models.RPGUser.create({
        guildId,
        userId,
        wallet: economy.startingBalance,
        username: profile.username || null,
        avatar: profile.avatar || null,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await models.RPGUser.findOne({ guildId, userId });
    }
  } else if ((profile.username && user.username !== profile.username) || (profile.avatar && user.avatar !== profile.avatar)) {
    await models.RPGUser.updateOne(
      { guildId, userId },
      { $set: { username: profile.username || user.username, avatar: profile.avatar || user.avatar } },
    ).catch(() => {});
  }
  return user;
}

async function getUser(guildId, userId) {
  return ensureUser(guildId, userId);
}

async function getTransaction(idempotencyKey) {
  return models.EconomyTransaction.findOne({ idempotencyKey });
}

/**
 * Claims an idempotency key before touching a balance. Only the writer that
 * creates the `processing` row may mutate coins, so duplicate commands or two
 * bot instances can never double-credit.
 */
async function claimTransaction({ guildId, userId, type, amount, idempotencyKey, metadata, counterpartyId, session }) {
  if (!idempotencyKey) throw new Error('idempotencyKey wajib untuk transaksi ekonomi');
  try {
    const doc = await models.EconomyTransaction.create(
      [{
        guildId,
        userId,
        type,
        amount,
        idempotencyKey,
        counterpartyId: counterpartyId || null,
        status: 'processing',
        metadata: metadata || {},
      }],
      sessionOptions(session),
    );
    return { owned: true, tx: Array.isArray(doc) ? doc[0] : doc };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await getTransaction(idempotencyKey);
    if (existing?.status === 'failed') {
      // Allow a retry after a failed attempt (nothing was applied).
      const reset = await models.EconomyTransaction.findOneAndUpdate(
        { idempotencyKey, status: 'failed' },
        { $set: { status: 'processing', amount, metadata: metadata || {} } },
        { new: true },
      );
      if (reset) return { owned: true, tx: reset };
    }
    return { owned: false, tx: existing };
  }
}

async function applyBalance({
  guildId,
  userId,
  delta,
  type,
  idempotencyKey,
  metadata,
  counterpartyId,
  allowBank = false,
  budget = null,
}) {
  const change = Math.trunc(Number(delta));
  if (!Number.isFinite(change) || change === 0) throw new UserError('Perubahan saldo tidak valid.');
  const economy = await settingsService.getEconomy(guildId);
  await ensureUser(guildId, userId);

  const claim = await claimTransaction({ guildId, userId, type, amount: change, idempotencyKey, metadata, counterpartyId });
  if (!claim.owned) {
    const user = await models.RPGUser.findOne({ guildId, userId });
    return { user, duplicate: true, transaction: claim.tx };
  }

  const filter = { guildId, userId };
  if (change < 0) filter.wallet = { $gte: Math.abs(change) };
  if (change > 0) filter.wallet = { $lte: Math.max(0, economy.maxWallet - change) };

  const update = {
    $inc: {
      wallet: change,
      totalEarned: change > 0 ? change : 0,
      totalSpent: change < 0 ? Math.abs(change) : 0,
    },
  };

  let updated;
  try {
    updated = await models.RPGUser.findOneAndUpdate(filter, update, { new: true });
  } catch (error) {
    await models.EconomyTransaction.updateOne({ idempotencyKey }, { $set: { status: 'failed' } }).catch(() => {});
    throw error;
  }

  if (!updated) {
    await models.EconomyTransaction.updateOne({ idempotencyKey }, { $set: { status: 'failed' } }).catch(() => {});
    const user = await models.RPGUser.findOne({ guildId, userId });
    if (change < 0) throw new UserError(`Saldo tidak cukup. Wallet kamu: ${formatCoins(user?.wallet || 0)}.`);
    throw new UserError('Wallet kamu sudah mencapai batas maksimal. Deposit sebagian ke bank.');
  }

  await models.EconomyTransaction.updateOne(
    { idempotencyKey },
    { $set: { status: 'completed', walletAfter: updated.wallet, bankAfter: updated.bank } },
  ).catch((error) => log.warn(`Failed to finalize transaction ${idempotencyKey}: ${error.message}`));

  return { user: updated, duplicate: false, transaction: claim.tx };
}

async function addCoins(guildId, userId, amount, type, idempotencyKey, metadata = {}) {
  return applyBalance({ guildId, userId, delta: assertAmount(amount), type, idempotencyKey, metadata });
}

async function spendCoins(guildId, userId, amount, type, idempotencyKey, metadata = {}) {
  return applyBalance({ guildId, userId, delta: -assertAmount(amount), type, idempotencyKey, metadata });
}

async function logOnly({ guildId, userId, amount, type, idempotencyKey, metadata, counterpartyId }) {
  try {
    await models.EconomyTransaction.create({
      guildId, userId, amount, type, idempotencyKey, metadata: metadata || {}, counterpartyId: counterpartyId || null, status: 'completed',
    });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function claimDaily(guildId, userId, profile) {
  const economy = await settingsService.getEconomy(guildId);
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const user = await ensureUser(guildId, userId, profile);
  if (user.lastDailyDay === today) throw new UserError('Daily reward sudah diklaim hari ini. Kembali besok!');

  const streak = user.lastDailyDay === yesterday ? (user.dailyStreak || 0) + 1 : 1;
  const bonus = Math.min(100, Math.max(0, streak - 1)) * 10;
  const reward = Math.min(economy.dailyReward + bonus, Math.max(0, economy.maxWallet - (user.wallet || 0)));
  if (reward <= 0) throw new UserError('Wallet sudah mencapai batas maksimal. Deposit sebagian ke bank dulu.');
  const updated = await models.RPGUser.findOneAndUpdate(
    { guildId, userId, lastDailyDay: { $ne: today } },
    { $inc: { wallet: reward, totalEarned: reward }, $set: { lastDailyDay: today, dailyStreak: streak } },
    { new: true },
  );
  if (!updated) throw new UserError('Daily reward sudah diklaim hari ini.');
  await logOnly({ guildId, userId, amount: reward, type: 'daily', idempotencyKey: `daily:${guildId}:${userId}:${today}`, metadata: { streak } });
  return { user: updated, reward, streak, bonus };
}

async function claimWeekly(guildId, userId, profile) {
  const economy = await settingsService.getEconomy(guildId);
  const week = weekKey();
  const user = await ensureUser(guildId, userId, profile);
  if (user.lastWeeklyWeek === week) throw new UserError('Weekly reward sudah diklaim minggu ini.');
  const reward = Math.min(economy.weeklyReward, Math.max(0, economy.maxWallet - (user.wallet || 0)));
  if (reward <= 0) throw new UserError('Wallet sudah mencapai batas maksimal. Deposit sebagian ke bank dulu.');
  const updated = await models.RPGUser.findOneAndUpdate(
    { guildId, userId, lastWeeklyWeek: { $ne: week } },
    { $inc: { wallet: reward, totalEarned: reward }, $set: { lastWeeklyWeek: week } },
    { new: true },
  );
  if (!updated) throw new UserError('Weekly reward sudah diklaim minggu ini.');
  await logOnly({ guildId, userId, amount: reward, type: 'weekly', idempotencyKey: `weekly:${guildId}:${userId}:${week}` });
  return { user: updated, reward };
}

async function claimMonthly(guildId, userId, profile) {
  const economy = await settingsService.getEconomy(guildId);
  const month = monthKey();
  const user = await ensureUser(guildId, userId, profile);
  if (user.lastMonthlyMonth === month) throw new UserError('Monthly reward sudah diklaim bulan ini.');
  const reward = Math.min(economy.monthlyReward, Math.max(0, economy.maxWallet - (user.wallet || 0)));
  if (reward <= 0) throw new UserError('Wallet sudah mencapai batas maksimal. Deposit sebagian ke bank dulu.');
  const updated = await models.RPGUser.findOneAndUpdate(
    { guildId, userId, lastMonthlyMonth: { $ne: month } },
    { $inc: { wallet: reward, totalEarned: reward }, $set: { lastMonthlyMonth: month } },
    { new: true },
  );
  if (!updated) throw new UserError('Monthly reward sudah diklaim bulan ini.');
  await logOnly({ guildId, userId, amount: reward, type: 'monthly', idempotencyKey: `monthly:${guildId}:${userId}:${month}` });
  return { user: updated, reward };
}

async function work(guildId, userId, profile) {
  const economy = await settingsService.getEconomy(guildId);
  const cd = await cooldownService.claim(guildId, userId, 'work', economy.workCooldownSec * 1000);
  if (!cd.ok) throw new UserError(`Kamu masih lelah. Kerja lagi <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);
  const reward = randomInt(economy.workMin, economy.workMax);
  const key = `work:${guildId}:${userId}:${Date.now()}`;
  try {
    const result = await addCoins(guildId, userId, reward, 'work', key, { source: 'work' });
    return { user: result.user, reward };
  } catch (error) {
    await cooldownService.clear(guildId, userId, 'work');
    throw error;
  }
}

async function beg(guildId, userId, profile) {
  const economy = await settingsService.getEconomy(guildId);
  const cd = await cooldownService.claim(guildId, userId, 'beg', economy.begCooldownSec * 1000);
  if (!cd.ok) throw new UserError(`Jangan mengemis terus. Coba lagi <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);
  const reward = randomInt(economy.begMin, economy.begMax);
  try {
    const result = await addCoins(guildId, userId, reward, 'beg', `beg:${guildId}:${userId}:${Date.now()}`, { source: 'beg' });
    return { user: result.user, reward };
  } catch (error) {
    await cooldownService.clear(guildId, userId, 'beg');
    throw error;
  }
}

async function transfer(guildId, fromId, toId, amount, idempotencyKey, taxPct = 0, notes = {}) {
  if (String(fromId) === String(toId)) throw new UserError('Tidak bisa transfer ke diri sendiri.');
  const value = assertAmount(amount);
  const economy = await settingsService.getEconomy(guildId);
  const pct = Number.isFinite(Number(taxPct)) ? Number(taxPct) : economy.transferTaxPct;
  const tax = Math.floor((value * pct) / 100);
  const net = value - tax;
  await ensureUser(guildId, fromId);
  await ensureUser(guildId, toId);

  const existing = await getTransaction(idempotencyKey);
  if (existing?.status === 'completed') {
    const user = await models.RPGUser.findOne({ guildId, userId: fromId });
    return { user, duplicate: true, net, tax };
  }

  const run = async (session) => {
    const debited = await models.RPGUser.findOneAndUpdate(
      { guildId, userId: fromId, wallet: { $gte: value } },
      { $inc: { wallet: -value, totalSpent: value } },
      { new: true, ...sessionOptions(session) },
    );
    if (!debited) throw new UserError('Saldo tidak cukup untuk transfer.');
    try {
      const credited = await models.RPGUser.findOneAndUpdate(
        { guildId, userId: toId, wallet: { $lte: Math.max(0, economy.maxWallet - net) } },
        { $inc: { wallet: net, totalEarned: net } },
        { new: true, ...sessionOptions(session) },
      );
      if (!credited) throw new UserError('Penerima tidak ditemukan atau wallet penerima sudah penuh.');
      await models.EconomyTransaction.create([{
        guildId, userId: fromId, type: 'transfer_out', amount: -value, idempotencyKey,
        counterpartyId: toId, status: 'completed', metadata: { net, tax, ...notes },
        walletAfter: debited.wallet,
      }], sessionOptions(session));
      await models.EconomyTransaction.create([{
        guildId, userId: toId, type: 'transfer_in', amount: net, idempotencyKey: `${idempotencyKey}:in`,
        counterpartyId: fromId, status: 'completed', metadata: { gross: value, tax, ...notes },
        walletAfter: credited.wallet,
      }], sessionOptions(session));
      return { user: debited, recipient: credited, net, tax, duplicate: false };
    } catch (error) {
      if (!session) {
        await models.RPGUser.updateOne({ guildId, userId: fromId }, { $inc: { wallet: value, totalSpent: -value } }).catch(() => {});
      }
      throw error;
    }
  };

  try {
    return await withTransaction(run);
  } catch (error) {
    if (error.code === 11000) {
      const user = await models.RPGUser.findOne({ guildId, userId: fromId });
      return { user, duplicate: true, net, tax };
    }
    throw error;
  }
}

async function deposit(guildId, userId, amount, idempotencyKey) {
  const economy = await settingsService.getEconomy(guildId);
  const value = assertAmount(amount);
  if (value > economy.depositLimit) throw new UserError(`Maksimal deposit per transaksi: ${formatCoins(economy.depositLimit)}.`);
  await ensureUser(guildId, userId);
  const updated = await models.RPGUser.findOneAndUpdate(
    { guildId, userId, wallet: { $gte: value } },
    { $inc: { wallet: -value, bank: value } },
    { new: true },
  );
  if (!updated) throw new UserError('Saldo wallet tidak cukup untuk deposit.');
  await logOnly({ guildId, userId, amount: value, type: 'deposit', idempotencyKey, metadata: { bank: true } });
  return { user: updated, amount: value };
}

async function withdraw(guildId, userId, amount, idempotencyKey) {
  const economy = await settingsService.getEconomy(guildId);
  const value = assertAmount(amount);
  if (value > economy.withdrawLimit) throw new UserError(`Maksimal withdraw per transaksi: ${formatCoins(economy.withdrawLimit)}.`);
  await ensureUser(guildId, userId);
  const updated = await models.RPGUser.findOneAndUpdate(
    { guildId, userId, bank: { $gte: value } },
    { $inc: { bank: -value, wallet: value } },
    { new: true },
  );
  if (!updated) throw new UserError('Saldo bank tidak cukup untuk withdraw.');
  await logOnly({ guildId, userId, amount: value, type: 'withdraw', idempotencyKey, metadata: { bank: true } });
  return { user: updated, amount: value };
}

async function addXp(guildId, userId, amount, kind = 'xp') {
  const field = kind === 'hunt' ? 'huntXp' : 'xp';
  const levelField = kind === 'hunt' ? 'huntLevel' : 'level';
  await ensureUser(guildId, userId);
  let user = await models.RPGUser.findOneAndUpdate(
    { guildId, userId },
    { $inc: { [field]: Math.max(0, Math.floor(amount)) } },
    { new: true },
  );
  let levels = 0;
  let guard = 0;
  while (user && user[field] >= xpForLevel(user[levelField]) && guard < 50) {
    const next = applyXp(user[levelField], user[field], 0);
    const need = xpForLevel(user[levelField]);
    const updated = await models.RPGUser.findOneAndUpdate(
      { guildId, userId, [levelField]: user[levelField], [field]: user[field] },
      { $set: { [levelField]: next.level, [field]: user[field] - need } },
      { new: true },
    );
    if (!updated) break;
    user = updated;
    levels += 1;
    guard += 1;
  }
  return { user, levelsGained: levels, level: user?.[levelField] || 1 };
}

async function addItem(guildId, userId, itemId, qty = 1) {
  await ensureUser(guildId, userId);
  return models.RPGUser.findOneAndUpdate(
    { guildId, userId },
    { $inc: { [`inventory.${itemId}`]: Math.max(1, Math.floor(qty)) } },
    { new: true },
  );
}

async function removeItem(guildId, userId, itemId, qty = 1) {
  const quantity = Math.max(1, Math.floor(qty));
  const user = await ensureUser(guildId, userId);
  const owned = Number(user.inventory?.[itemId] || 0);
  if (owned < quantity) throw new UserError('Item tidak cukup di inventory.');
  return models.RPGUser.findOneAndUpdate(
    { guildId, userId, [`inventory.${itemId}`]: { $gte: quantity } },
    { $inc: { [`inventory.${itemId}`]: -quantity } },
    { new: true },
  );
}

async function getInventory(guildId, userId) {
  const user = await ensureUser(guildId, userId);
  return Object.entries(user.inventory || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([itemId, qty]) => ({ itemId, qty: Number(qty) }));
}

async function leaderboard(guildId, category = 'wealth', limit = 10) {
  const size = Math.min(25, Math.max(1, Number(limit) || 10));
  const map = {
    wealth: { wallet: -1 },
    wallet: { wallet: -1 },
    bank: { bank: -1 },
    level: { level: -1, xp: -1 },
    hunt: { huntKills: -1 },
    battle: { battleRating: -1, battleWins: -1 },
    boss: { totalBossDamage: -1 },
    games: { gameWins: -1 },
  };
  const sort = map[category] || map.wealth;
  if (category === 'wealth') {
    try {
      return await models.RPGUser.aggregate([
        { $match: { guildId } },
        { $addFields: { wealth: { $add: ['$wallet', '$bank'] } } },
        { $sort: { wealth: -1 } },
        { $limit: size },
      ]);
    } catch { /* fall through */ }
  }
  return models.RPGUser.find({ guildId }).sort(sort).limit(size).lean();
}

async function history(guildId, userId, limit = 10) {
  return models.EconomyTransaction.find({ guildId, userId }).sort({ createdAt: -1 }).limit(Math.min(25, limit)).lean();
}

async function getPosition(guildId, userId, category = 'wealth', value) {
  const greater = await models.RPGUser.countDocuments({ guildId, [category]: { $gt: value } });
  return greater + 1;
}

module.exports = {
  ensureUser,
  getUser,
  applyBalance,
  addCoins,
  spendCoins,
  logOnly,
  claimDaily,
  claimWeekly,
  claimMonthly,
  work,
  beg,
  transfer,
  deposit,
  withdraw,
  addXp,
  addItem,
  removeItem,
  getInventory,
  leaderboard,
  history,
  getPosition,
  assertAmount,
  getTransaction,
};
