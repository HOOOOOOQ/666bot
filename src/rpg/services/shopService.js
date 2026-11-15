'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const { SHOP_MAP, SHOP_ITEMS } = require('../data/catalog');
const settingsService = require('./settingsService');
const userService = require('./userService');
const { formatCoins } = require('../utils/formulas');

function list() {
  return SHOP_ITEMS.map((item) => ({ ...item }));
}

async function buy(guildId, userId, itemId, qty = 1) {
  const item = SHOP_MAP[itemId];
  if (!item) throw new UserError('Item tidak ada di shop.');
  const amount = Math.max(1, Math.floor(Number(qty) || 1));
  const game = await settingsService.getGame(guildId);
  const unitPrice = item.type === 'egg' && item.id === 'egg_basic' ? Math.max(0, game.pets.eggPrice || item.price) : item.price;
  const total = unitPrice * amount;
  const key = `shop_buy:${guildId}:${userId}:${itemId}:${Date.now()}`;
  const result = await userService.spendCoins(guildId, userId, total, 'shop_buy', key, { itemId, qty: amount });
  try {
    await userService.addItem(guildId, userId, itemId, amount);
  } catch (error) {
    await userService.addCoins(guildId, userId, total, 'shop_refund', `${key}:refund`, { itemId, qty: amount }).catch(() => {});
    throw error;
  }
  return { item, qty: amount, total, user: result.user };
}

async function sell(guildId, userId, itemId, qty = 1) {
  const item = SHOP_MAP[itemId];
  if (!item) throw new UserError('Item tidak bisa dijual ke shop.');
  const amount = Math.max(1, Math.floor(Number(qty) || 1));
  const unit = Math.max(1, Math.floor(item.price * 0.45));
  const total = unit * amount;
  const economy = await settingsService.getEconomy(guildId);
  const seller = await userService.ensureUser(guildId, userId);
  if ((seller.wallet || 0) + total > economy.maxWallet) throw new UserError('Wallet kamu sudah penuh. Deposit sebagian ke bank dulu.');
  await userService.removeItem(guildId, userId, itemId, amount);
  let result;
  try {
    result = await userService.addCoins(guildId, userId, total, 'shop_sell', `shop_sell:${guildId}:${userId}:${itemId}:${Date.now()}`, { itemId, qty: amount });
  } catch (error) {
    await userService.addItem(guildId, userId, itemId, amount).catch(() => {});
    throw error;
  }
  return { item, qty: amount, total, user: result.user, unit };
}

async function inventory(guildId, userId) {
  const items = await userService.getInventory(guildId, userId);
  return items.map((entry) => ({ ...entry, item: SHOP_MAP[entry.itemId] || null, sellPrice: SHOP_MAP[entry.itemId] ? Math.floor(SHOP_MAP[entry.itemId].price * 0.45) : 0 }));
}

module.exports = { list, buy, sell, inventory };
