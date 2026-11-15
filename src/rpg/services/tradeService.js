'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const userService = require('./userService');
const petService = require('./petService');
const { withTransaction, sessionOptions } = require('../utils/db');
const { formatCoins } = require('../utils/formulas');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-trade');

function emptyOffer() {
  return { coins: 0, monsters: [], pets: [], items: [] };
}

function normalizeOffer(offer) {
  return {
    coins: Math.max(0, Math.floor(Number(offer?.coins) || 0)),
    monsters: Array.isArray(offer?.monsters) ? [...new Set(offer.monsters.map(String))] : [],
    pets: Array.isArray(offer?.pets) ? [...new Set(offer.pets.map(String))] : [],
    items: Array.isArray(offer?.items) ? offer.items.slice(0, 20).map((i) => ({ id: String(i.id), qty: Math.max(1, Math.floor(Number(i.qty) || 1)) })) : [],
  };
}

async function releaseOffer(guildId, userId, offer) {
  const normalized = normalizeOffer(offer);
  await models.Monster.updateMany(
    { _id: { $in: normalized.monsters }, guildId, userId, lockedBy: /^trade:/ },
    { $set: { lockedBy: null } },
  ).catch(() => {});
  await models.Pet.updateMany(
    { _id: { $in: normalized.pets }, guildId, userId, lockedBy: /^trade:/ },
    { $set: { lockedBy: null } },
  ).catch(() => {});
  for (const item of normalized.items) {
    await userService.addItem(guildId, userId, item.id, item.qty).catch(() => {});
  }
}

async function applyOffer(guildId, userId, tradeId, rawOffer) {
  const offer = normalizeOffer(rawOffer);
  const user = await userService.ensureUser(guildId, userId);
  if (offer.coins > (user.wallet || 0)) throw new UserError('Koin yang ditawarkan melebihi saldo wallet.');
  for (const id of offer.monsters) {
    const locked = await models.Monster.findOneAndUpdate(
      { _id: id, guildId, userId, lockedBy: null },
      { $set: { lockedBy: `trade:${tradeId}` } },
      { new: true },
    );
    if (!locked) throw new UserError('Salah satu monster tidak dimiliki atau sedang dikunci.');
  }
  for (const id of offer.pets) {
    const locked = await models.Pet.findOneAndUpdate(
      { _id: id, guildId, userId, lockedBy: null },
      { $set: { lockedBy: `trade:${tradeId}` } },
      { new: true },
    );
    if (!locked) throw new UserError('Salah satu pet tidak dimiliki atau sedang dikunci.');
  }
  for (const item of offer.items) {
    await userService.removeItem(guildId, userId, item.id, item.qty);
  }
  return offer;
}

async function create(guildId, initiatorId, targetId, offer, channelId, requestId) {
  if (String(initiatorId) === String(targetId)) throw new UserError('Tidak bisa trade dengan diri sendiri.');
  await Promise.all([userService.ensureUser(guildId, initiatorId), userService.ensureUser(guildId, targetId)]);
  const key = `trade:${guildId}:${initiatorId}:${targetId}:${requestId || Date.now()}`;
  const existing = await models.TradeSession.findOne({
    guildId, status: { $in: ['pending', 'active'] },
    $or: [{ initiatorId, targetId }, { initiatorId: targetId, targetId: initiatorId }],
  });
  if (existing) throw new UserError('Sudah ada trade aktif antara kalian.');
  const trade = await models.TradeSession.create({
    guildId, channelId: channelId || null, initiatorId, targetId,
    offerA: emptyOffer(), offerB: emptyOffer(), status: 'pending',
    idempotencyKey: key,
    expiresAt: new Date(Date.now() + 10 * 60000),
  });
  try {
    const applied = await applyOffer(guildId, initiatorId, trade._id, offer);
    await models.TradeSession.updateOne({ _id: trade._id }, { $set: { offerA: applied } });
  } catch (error) {
    await releaseOffer(guildId, initiatorId, offer);
    await models.TradeSession.updateOne({ _id: trade._id }, { $set: { status: 'cancelled' } });
    throw error;
  }
  return trade;
}

async function respond(guildId, userId, tradeId, accept) {
  const trade = await models.TradeSession.findOne({ _id: tradeId, guildId }).lean();
  if (!trade) throw new UserError('Trade tidak ditemukan.');
  if (trade.targetId !== userId) throw new UserError('Hanya target trade yang bisa merespons.');
  if (trade.status !== 'pending') throw new UserError('Trade sudah diproses.');
  if (new Date(trade.expiresAt).getTime() < Date.now()) throw new UserError('Trade sudah kedaluwarsa.');
  const updated = await models.TradeSession.findOneAndUpdate(
    { _id: tradeId, status: 'pending' },
    { $set: { status: accept ? 'active' : 'declined' } },
    { new: true },
  );
  if (!updated) throw new UserError('Trade sudah diproses.');
  if (!accept) {
    await releaseOffer(guildId, trade.initiatorId, trade.offerA);
    await releaseOffer(guildId, trade.targetId, trade.offerB);
  }
  return updated;
}

async function setOffer(guildId, userId, tradeId, offer) {
  const trade = await models.TradeSession.findOne({ _id: tradeId, guildId }).lean();
  if (!trade) throw new UserError('Trade tidak ditemukan.');
  if (trade.status !== 'active') throw new UserError('Trade belum aktif atau sudah selesai.');
  if (![trade.initiatorId, trade.targetId].includes(userId)) throw new UserError('Kamu bukan bagian dari trade ini.');
  const side = userId === trade.initiatorId ? 'offerA' : 'offerB';
  const old = trade[side];
  await releaseOffer(guildId, userId, old);
  let applied;
  try {
    applied = await applyOffer(guildId, userId, tradeId, offer);
  } catch (error) {
    await models.TradeSession.updateOne({ _id: tradeId }, { $set: { [side]: emptyOffer(), confirmations: { initiator: false, target: false } } });
    throw error;
  }
  const updated = await models.TradeSession.findOneAndUpdate(
    { _id: tradeId, status: 'active' },
    { $set: { [side]: applied, confirmations: { initiator: false, target: false } } },
    { new: true },
  );
  return updated;
}

async function confirm(guildId, userId, tradeId) {
  const trade = await models.TradeSession.findOne({ _id: tradeId, guildId }).lean();
  if (!trade) throw new UserError('Trade tidak ditemukan.');
  if (trade.status !== 'active') throw new UserError('Trade belum aktif atau sudah selesai.');
  if (![trade.initiatorId, trade.targetId].includes(userId)) throw new UserError('Kamu bukan bagian dari trade ini.');
  const side = userId === trade.initiatorId ? 'initiator' : 'target';
  const updated = await models.TradeSession.findOneAndUpdate(
    { _id: tradeId, status: 'active' },
    { $set: { [`confirmations.${side}`]: true } },
    { new: true },
  );
  if (!updated) throw new UserError('Trade sudah diproses.');
  if (!(updated.confirmations?.initiator && updated.confirmations?.target)) {
    return { trade: updated, waiting: true };
  }
  return execute(guildId, tradeId);
}

async function execute(guildId, tradeId) {
  const claimed = await models.TradeSession.findOneAndUpdate(
    { _id: tradeId, status: 'active', 'confirmations.initiator': true, 'confirmations.target': true },
    { $set: { status: 'processing' } },
    { new: true },
  ).lean();
  if (!claimed) {
    const current = await models.TradeSession.findOne({ _id: tradeId }).lean();
    if (current?.status === 'completed') return { trade: current, alreadyDone: true };
    throw new UserError('Trade sedang diproses.');
  }
  const game = await settingsService.getGame(guildId);
  const taxPct = game.market.taxPct;
  const a = normalizeOffer(claimed.offerA);
  const b = normalizeOffer(claimed.offerB);
  const taxA = Math.floor(a.coins * taxPct / 100);
  const taxB = Math.floor(b.coins * taxPct / 100);

  const run = async (session) => {
    const [sellerA, sellerB] = await Promise.all([
      models.RPGUser.findOne({ guildId, userId: claimed.initiatorId }).lean(),
      models.RPGUser.findOne({ guildId, userId: claimed.targetId }).lean(),
    ]);
    if ((sellerA?.wallet || 0) < a.coins) throw new UserError('Initiator tidak punya cukup koin.');
    if ((sellerB?.wallet || 0) < b.coins) throw new UserError('Target tidak punya cukup koin.');
    if (a.coins > 0) {
      const debited = await models.RPGUser.findOneAndUpdate(
        { guildId, userId: claimed.initiatorId, wallet: { $gte: a.coins } },
        { $inc: { wallet: -a.coins, totalSpent: a.coins } },
        { new: true, ...sessionOptions(session) },
      );
      if (!debited) throw new UserError('Gagal mendebit koin initiator.');
    }
    if (b.coins > 0) {
      const debited = await models.RPGUser.findOneAndUpdate(
        { guildId, userId: claimed.targetId, wallet: { $gte: b.coins } },
        { $inc: { wallet: -b.coins, totalSpent: b.coins } },
        { new: true, ...sessionOptions(session) },
      );
      if (!debited) throw new UserError('Gagal mendebit koin target.');
    }
    if (a.coins - taxA > 0) await models.RPGUser.updateOne({ guildId, userId: claimed.targetId }, { $inc: { wallet: a.coins - taxA, totalEarned: a.coins - taxA } }, sessionOptions(session));
    if (b.coins - taxB > 0) await models.RPGUser.updateOne({ guildId, userId: claimed.initiatorId }, { $inc: { wallet: b.coins - taxB, totalEarned: b.coins - taxB } }, sessionOptions(session));

    for (const id of a.monsters) {
      const moved = await models.Monster.findOneAndUpdate(
        { _id: id, guildId, userId: claimed.initiatorId, lockedBy: `trade:${tradeId}` },
        { $set: { userId: claimed.targetId, lockedBy: null } },
        { new: true, ...sessionOptions(session) },
      );
      if (!moved) throw new UserError('Monster initiator tidak lagi tersedia.');
    }
    for (const id of b.monsters) {
      const moved = await models.Monster.findOneAndUpdate(
        { _id: id, guildId, userId: claimed.targetId, lockedBy: `trade:${tradeId}` },
        { $set: { userId: claimed.initiatorId, lockedBy: null } },
        { new: true, ...sessionOptions(session) },
      );
      if (!moved) throw new UserError('Monster target tidak lagi tersedia.');
    }
    for (const id of a.pets) {
      const moved = await models.Pet.findOneAndUpdate(
        { _id: id, guildId, userId: claimed.initiatorId, lockedBy: `trade:${tradeId}` },
        { $set: { userId: claimed.targetId, lockedBy: null } },
        { new: true, ...sessionOptions(session) },
      );
      if (!moved) throw new UserError('Pet initiator tidak lagi tersedia.');
      await petService.detach(guildId, claimed.initiatorId, id).catch(() => {});
    }
    for (const id of b.pets) {
      const moved = await models.Pet.findOneAndUpdate(
        { _id: id, guildId, userId: claimed.targetId, lockedBy: `trade:${tradeId}` },
        { $set: { userId: claimed.initiatorId, lockedBy: null } },
        { new: true, ...sessionOptions(session) },
      );
      if (!moved) throw new UserError('Pet target tidak lagi tersedia.');
      await petService.detach(guildId, claimed.targetId, id).catch(() => {});
    }
    for (const item of a.items) await userService.addItem(guildId, claimed.targetId, item.id, item.qty);
    for (const item of b.items) await userService.addItem(guildId, claimed.initiatorId, item.id, item.qty);

    await models.EconomyTransaction.create([{
      guildId, userId: claimed.initiatorId, type: 'trade', amount: b.coins - a.coins,
      idempotencyKey: `${claimed.idempotencyKey}:coins`, status: 'completed',
      counterpartyId: claimed.targetId,
      metadata: { offerA: a, offerB: b, taxA, taxB },
    }], sessionOptions(session)).catch((error) => { if (error.code !== 11000) throw error; });
    return true;
  };

  try {
    await withTransaction(run);
    const completed = await models.TradeSession.findOneAndUpdate(
      { _id: tradeId },
      { $set: { status: 'completed' } },
      { new: true },
    ).lean();
    await models.RPGUser.updateOne({ guildId, userId: claimed.initiatorId }, { $inc: { totalTrades: 1 } });
    await models.RPGUser.updateOne({ guildId, userId: claimed.targetId }, { $inc: { totalTrades: 1 } });
    return { trade: completed, alreadyDone: false, taxA, taxB };
  } catch (error) {
    await models.TradeSession.updateOne({ _id: tradeId, status: 'processing' }, { $set: { status: 'active', confirmations: { initiator: false, target: false } } }).catch(() => {});
    throw error;
  }
}

async function cancel(guildId, userId, tradeId) {
  const trade = await models.TradeSession.findOne({ _id: tradeId, guildId }).lean();
  if (!trade) throw new UserError('Trade tidak ditemukan.');
  if (![trade.initiatorId, trade.targetId].includes(userId)) throw new UserError('Kamu bukan bagian dari trade ini.');
  if (!['pending', 'active'].includes(trade.status)) throw new UserError('Trade tidak bisa dibatalkan.');
  const updated = await models.TradeSession.findOneAndUpdate(
    { _id: tradeId, status: { $in: ['pending', 'active'] } },
    { $set: { status: 'cancelled' } },
    { new: true },
  );
  if (!updated) throw new UserError('Trade sudah diproses.');
  await releaseOffer(guildId, trade.initiatorId, trade.offerA);
  await releaseOffer(guildId, trade.targetId, trade.offerB);
  return updated;
}

async function get(guildId, tradeId) {
  return models.TradeSession.findOne({ _id: tradeId, guildId }).lean();
}

function describeOffer(offer) {
  const o = normalizeOffer(offer);
  return `${formatCoins(o.coins)} koin • ${o.monsters.length} monster • ${o.pets.length} pet • ${o.items.reduce((sum, i) => sum + i.qty, 0)} item`;
}

module.exports = { create, respond, setOffer, confirm, execute, cancel, get, describeOffer, normalizeOffer, releaseOffer };
