'use strict';

const models = require('../../database/models');
const { formatCoins } = require('../utils/formulas');

function guildQuery(guildId) {
  return guildId ? { guildId } : {};
}

async function count(Model, filter) {
  try { return await Model.countDocuments(filter); } catch { return 0; }
}

async function overview(guildId = null) {
  const q = guildQuery(guildId);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [players, activePlayers, transactions, hunts, monsters, pets, battles, games, marketTransactions, guilds, bossSessions, bossContributions, quests, achievements] = await Promise.all([
    count(models.RPGUser, q),
    count(models.RPGUser, { ...q, updatedAt: { $gte: weekAgo } }),
    count(models.EconomyTransaction, q),
    count(models.Monster, q),
    count(models.Monster, q),
    count(models.Pet, q),
    count(models.Battle, { ...q, status: 'completed' }),
    count(models.GameHistory, q),
    count(models.MarketTransaction, q),
    count(models.Guild, guildId ? { discordGuildId: guildId } : {}),
    count(models.WorldBossSession, q),
    count(models.WorldBossContribution, q),
    count(models.Quest, q),
    count(models.Achievement, q),
  ]);
  let coinCirculation = 0;
  try {
    const users = await models.RPGUser.find(guildId ? { guildId } : {}).select('wallet bank').lean();
    coinCirculation = (users || []).reduce((sum, u) => sum + (u.wallet || 0) + (u.bank || 0), 0);
  } catch { /* ignore */ }
  let totalHuntKills = 0;
  try {
    const users = await models.RPGUser.find(guildId ? { guildId } : {}).select('huntKills').lean();
    totalHuntKills = (users || []).reduce((sum, u) => sum + (u.huntKills || 0), 0);
  } catch { /* ignore */ }
  return {
    players,
    activePlayers,
    coinCirculation,
    coinCirculationLabel: formatCoins(coinCirculation),
    transactions,
    hunts: totalHuntKills || hunts,
    monsters,
    pets,
    battles,
    games,
    marketTransactions,
    guilds,
    bossSessions,
    bossContributions,
    quests,
    achievements,
    generatedAt: new Date().toISOString(),
  };
}

async function charts(guildId = null, days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const q = { ...guildQuery(guildId), createdAt: { $gte: since } };
  const [transactions, hunts, battles, market] = await Promise.all([
    models.EconomyTransaction.find(q).select('createdAt amount type').lean().catch(() => []),
    models.Monster.find(q).select('createdAt rarity shiny').lean().catch(() => []),
    models.Battle.find({ ...guildQuery(guildId), createdAt: { $gte: since }, status: 'completed' }).select('createdAt').lean().catch(() => []),
    models.MarketTransaction.find(q).select('createdAt amount').lean().catch(() => []),
  ]);
  const buckets = {};
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets[key] = { date: key, transactions: 0, volume: 0, hunts: 0, battles: 0, market: 0 };
  }
  for (const tx of transactions || []) {
    const key = new Date(tx.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) { buckets[key].transactions += 1; buckets[key].volume += Math.abs(tx.amount || 0); }
  }
  for (const monster of hunts || []) {
    const key = new Date(monster.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].hunts += 1;
  }
  for (const battle of battles || []) {
    const key = new Date(battle.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].battles += 1;
  }
  for (const tx of market || []) {
    const key = new Date(tx.createdAt).toISOString().slice(0, 10);
    if (buckets[key]) buckets[key].market += 1;
  }
  return Object.values(buckets);
}

async function topPlayers(guildId = null, limit = 10) {
  return models.RPGUser.find(guildQuery(guildId)).sort({ wallet: -1 }).limit(Math.min(50, limit)).lean().catch(() => []);
}

module.exports = { overview, charts, topPlayers };
