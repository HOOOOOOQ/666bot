'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const userService = require('./userService');
const questService = require('./questService');
const { formatCoins, applyTax } = require('../utils/formulas');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-market');

async function lockItem(guildId, sellerId, itemType, itemId) {
  if (itemType === 'monster') {
    const item = await models.Monster.findOneAndUpdate(
      { _id: itemId, guildId, userId: sellerId, lockedBy: null },
      { $set: { lockedBy: 'market' } },
      { new: true },
    ).lean();
    if (!item) throw new UserError('Monster tidak ditemukan atau sedang dikunci.');
    return { item, snapshot: { name: item.name, rarity: item.rarity, speciesId: item.speciesId, image: item.image, level: item.level } };
  }
  if (itemType === 'pet') {
    const item = await models.Pet.findOneAndUpdate(
      { _id: itemId, guildId, userId: sellerId, lockedBy: null },
      { $set: { lockedBy: 'market' } },
      { new: true },
    ).lean();
    if (!item) throw new UserError('Pet tidak ditemukan atau sedang dikunci.');
    return { item, snapshot: { name: item.name, rarity: item.rarity, speciesId: item.speciesId, image: item.image, level: item.level } };
  }
  if (itemType === 'item' || itemType === 'egg') {
    const user = await userService.ensureUser(guildId, sellerId);
    const owned = Number(user.inventory?.[itemId] || 0);
    if (owned < 1) throw new UserError('Item tidak ada di inventory.');
    await userService.removeItem(guildId, sellerId, itemId, 1);
    return { item: null, snapshot: { itemId } };
  }
  throw new UserError('Tipe item harus monster, pet, item, atau egg.');
}

async function unlockItem(guildId, sellerId, listing) {
  try {
    if (listing.itemType === 'monster') {
      await models.Monster.updateOne({ _id: listing.itemId, guildId, userId: sellerId, lockedBy: 'market' }, { $set: { lockedBy: null } });
    } else if (listing.itemType === 'pet') {
      await models.Pet.updateOne({ _id: listing.itemId, guildId, userId: sellerId, lockedBy: 'market' }, { $set: { lockedBy: null } });
    } else if (listing.itemType === 'item' || listing.itemType === 'egg') {
      await userService.addItem(guildId, sellerId, listing.itemId, 1);
    }
  } catch (error) {
    log.warn(`Failed to unlock listing item: ${error.message}`);
  }
}

async function createListing(guildId, sellerId, itemType, itemId, price) {
  const game = await settingsService.getGame(guildId);
  const cfg = game.market;
  if (!cfg.enabled) throw new UserError('Market sedang dinonaktifkan admin.');
  const value = Math.floor(Number(price));
  if (!Number.isInteger(value) || value < cfg.minPrice || value > cfg.maxPrice) {
    throw new UserError(`Harga harus antara ${formatCoins(cfg.minPrice)} dan ${formatCoins(cfg.maxPrice)}.`);
  }
  const count = await models.MarketListing.countDocuments({ guildId, sellerId, status: 'active' });
  if (count >= cfg.maxListings) throw new UserError(`Maksimal ${cfg.maxListings} listing aktif.`);
  const { snapshot } = await lockItem(guildId, sellerId, itemType, itemId);
  let listing;
  try {
    const fee = Math.floor(value * (cfg.listingFeePct / 100));
    if (fee > 0) await userService.spendCoins(guildId, sellerId, fee, 'market_fee', `market_fee:${guildId}:${sellerId}:${Date.now()}`, { itemId, price: value });
    listing = await models.MarketListing.create({
      guildId,
      sellerId,
      itemType,
      itemId: String(itemId),
      itemSnapshot: snapshot,
      price: value,
      fee,
      expiresAt: new Date(Date.now() + cfg.listingHours * 3600000),
      status: 'active',
      lockedBy: null,
    });
  } catch (error) {
    await unlockItem(guildId, sellerId, { itemType, itemId });
    throw error;
  }
  return listing;
}

async function buy(guildId, buyerId, listingId) {
  const game = await settingsService.getGame(guildId);
  const cfg = game.market;
  if (!cfg.enabled) throw new UserError('Market sedang dinonaktifkan admin.');
  const listing = await models.MarketListing.findOne({ _id: listingId, guildId, status: 'active' }).lean();
  if (!listing) throw new UserError('Listing tidak ditemukan atau sudah tidak aktif.');
  if (listing.sellerId === buyerId) throw new UserError('Tidak bisa membeli listing sendiri.');
  if (new Date(listing.expiresAt).getTime() <= Date.now()) {
    await models.MarketListing.updateOne({ _id: listingId, status: 'active' }, { $set: { status: 'expired' } });
    await unlockItem(guildId, listing.sellerId, listing);
    throw new UserError('Listing sudah kedaluwarsa.');
  }
  const key = `market_buy:${guildId}:${listingId}:${buyerId}`;
  await userService.ensureUser(guildId, buyerId);
  const claimed = await models.MarketListing.findOneAndUpdate(
    { _id: listingId, status: 'active', lockedBy: null },
    { $set: { lockedBy: buyerId } },
    { new: true },
  ).lean();
  if (!claimed) throw new UserError('Listing sedang dibeli orang lain.');
  const tax = Math.floor(claimed.price * (cfg.taxPct / 100));
  const net = claimed.price - tax;
  let paid = false;
  try {
    await userService.spendCoins(guildId, buyerId, claimed.price, 'market_buy', `${key}:pay`, { listingId: String(listingId) });
    paid = true;
    if (net > 0) {
      await userService.addCoins(guildId, claimed.sellerId, net, 'market_sell', `${key}:seller`, { listingId: String(listingId), tax });
    }
    if (claimed.itemType === 'monster' || claimed.itemType === 'pet') {
      const Model = claimed.itemType === 'monster' ? models.Monster : models.Pet;
      const moved = await Model.findOneAndUpdate(
        { _id: claimed.itemId, guildId, userId: claimed.sellerId, lockedBy: 'market' },
        { $set: { userId: buyerId, lockedBy: null } },
        { new: true },
      );
      if (!moved) throw new UserError('Item tidak lagi tersedia.');
    } else {
      await userService.addItem(guildId, buyerId, claimed.itemId, 1);
    }
    await models.MarketListing.updateOne({ _id: listingId }, { $set: { status: 'sold', buyerId, tax, lockedBy: null } });
    await models.MarketTransaction.create({
      guildId, listingId, sellerId: claimed.sellerId, buyerId, amount: claimed.price, tax,
      itemType: claimed.itemType, itemId: claimed.itemId, idempotencyKey: key,
    }).catch((error) => { if (error.code !== 11000) throw error; });
    await models.RPGUser.updateOne({ guildId, userId: buyerId }, { $inc: { totalMarketTrades: 1 } });
    await models.RPGUser.updateOne({ guildId, userId: claimed.sellerId }, { $inc: { totalMarketTrades: 1 } });
    await questService.track(guildId, buyerId, 'marketBuy', 1).catch(() => {});
    return { listing: { ...claimed, status: 'sold', buyerId }, net, tax, price: claimed.price };
  } catch (error) {
    if (paid) await userService.addCoins(guildId, buyerId, claimed.price, 'market_refund', `${key}:refund`, { listingId: String(listingId) }).catch(() => {});
    await models.MarketListing.updateOne({ _id: listingId, status: 'active' }, { $set: { lockedBy: null } }).catch(() => {});
    throw error;
  }
}

async function cancel(guildId, sellerId, listingId) {
  const listing = await models.MarketListing.findOneAndUpdate(
    { _id: listingId, guildId, sellerId, status: 'active', lockedBy: null },
    { $set: { status: 'cancelled' } },
    { new: true },
  ).lean();
  if (!listing) throw new UserError('Listing tidak ditemukan atau tidak bisa dibatalkan.');
  await unlockItem(guildId, sellerId, listing);
  return listing;
}

async function list(guildId, limit = 10, page = 1) {
  const perPage = Math.min(15, Math.max(1, limit));
  const filter = guildId ? { guildId, status: 'active' } : { status: 'active' };
  const total = await models.MarketListing.countDocuments(filter);
  const docs = await models.MarketListing.find(filter).sort({ createdAt: -1 }).skip((Math.max(1, page) - 1) * perPage).limit(perPage).lean();
  return { listings: docs, total, pages: Math.max(1, Math.ceil(total / perPage)), page: Math.max(1, page) };
}

async function myListings(guildId, sellerId) {
  return models.MarketListing.find({ guildId, sellerId, status: { $in: ['active', 'sold'] } }).sort({ createdAt: -1 }).limit(20).lean();
}

async function history(guildId, userId, limit = 10) {
  return models.MarketTransaction.find({ guildId, $or: [{ buyerId: userId }, { sellerId: userId }] }).sort({ createdAt: -1 }).limit(Math.min(25, limit)).lean();
}

async function expireListings() {
  const expired = await models.MarketListing.find({ status: 'active', expiresAt: { $lte: new Date() } }).limit(100).lean();
  for (const listing of expired) {
    const updated = await models.MarketListing.findOneAndUpdate(
      { _id: listing._id, status: 'active' },
      { $set: { status: 'expired' } },
      { new: true },
    );
    if (updated) await unlockItem(listing.guildId, listing.sellerId, listing);
  }
  return expired.length;
}

module.exports = { createListing, buy, cancel, list, myListings, history, expireListings, lockItem, unlockItem };
