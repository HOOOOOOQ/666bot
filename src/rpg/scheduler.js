'use strict';

const { createLogger } = require('../utils/logger');

const log = createLogger('rpg-scheduler');
const last = { boss: 0, market: 0, war: 0, sessions: 0, autohunt: 0, lottery: 0 };

async function cleanupSessions() {
  const models = require('../database/models');
  const userService = require('./services/userService');
  const now = new Date();
  try {
    const staleRps = await models.GameSession.find({
      game: 'rps_pvp',
      status: { $in: ['pending', 'active'] },
      expiresAt: { $lte: now },
    }).limit(100).lean();
    for (const session of staleRps) {
      const closed = await models.GameSession.findOneAndUpdate(
        { _id: session._id, status: { $in: ['pending', 'active'] } },
        { $set: { status: 'expired' } },
        { new: true },
      );
      if (closed) {
        await userService.addCoins(
          session.guildId,
          session.userId,
          session.bet,
          'game_refund',
          `${session.idempotencyKey}:refund:expiry`,
          { game: 'rps', reason: 'expired' },
        ).catch(() => {});
      }
    }
  } catch { /* ignore */ }
  try {
    await models.GameSession.updateMany(
      { status: { $in: ['pending', 'active'] }, expiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
    );
  } catch { /* ignore */ }
  try {
    await models.Battle.updateMany(
      { status: 'pending', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
    );
  } catch { /* ignore */ }
  try {
    await models.TradeSession.updateMany(
      { status: { $in: ['pending', 'active'] }, expiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
    );
  } catch { /* ignore */ }
}

/**
 * Called from the existing scheduler tick (every 30s). Each subsystem is
 * throttled and all mutations are idempotent so running on several bot
 * instances cannot duplicate rewards or spawn duplicate bosses.
 */
async function tick() {
  const now = Date.now();
  if (now - last.boss > 5 * 60 * 1000) {
    last.boss = now;
    await require('./services/worldBossService').tick().catch((error) => log.warn(`Boss tick: ${error.message}`));
  }
  if (now - last.market > 60 * 1000) {
    last.market = now;
    await require('./services/marketService').expireListings().catch((error) => log.warn(`Market expiry: ${error.message}`));
  }
  if (now - last.war > 60 * 1000) {
    last.war = now;
    await require('./services/guildService').finalizeWars().catch((error) => log.warn(`War finalize: ${error.message}`));
  }
  if (now - last.sessions > 60 * 1000) {
    last.sessions = now;
    await cleanupSessions().catch((error) => log.warn(`Session cleanup: ${error.message}`));
  }
  if (now - last.autohunt > 60 * 1000) {
    last.autohunt = now;
    await require('./services/extraService').autoHuntTick().catch((error) => log.warn(`Auto-hunt tick: ${error.message}`));
  }
  if (now - last.lottery > 60 * 1000) {
    last.lottery = now;
    const models = require('../database/models');
    const guildIds = await models.Lottery.distinct('guildId', { status: 'open', endsAt: { $lte: new Date() } }).catch(() => []);
    for (const guildId of guildIds) {
      await require('./services/extraService').drawLottery(guildId).catch((error) => log.warn(`Lottery draw (${guildId}): ${error.message}`));
    }
  }
}

module.exports = { tick, cleanupSessions };
