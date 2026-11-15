'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const cooldownService = require('./cooldownService');
const userService = require('./userService');
const questService = require('./questService');
const { BOSS_TEMPLATES } = require('../data/catalog');
const { playerBattleStats, formatCoins } = require('../utils/formulas');
const { randomFloat, chance, pick } = require('../utils/rng');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-boss');

function templateFor(index) {
  return BOSS_TEMPLATES[Math.abs(Number(index) || 0) % BOSS_TEMPLATES.length];
}

async function expireStale(guildId) {
  await models.WorldBossSession.updateMany(
    { guildId, status: 'active', endsAt: { $lte: new Date() } },
    { $set: { status: 'expired' } },
  ).catch(() => {});
}

async function ensureBoss(guildId, force = false) {
  const game = await settingsService.getGame(guildId);
  const cfg = game.worldBoss;
  if (!cfg.enabled && !force) return null;
  await expireStale(guildId);
  let active = await models.WorldBossSession.findOne({ guildId, status: 'active' }).lean();
  if (active) return active;

  if (!force) {
    const last = await models.WorldBossSession.findOne({ guildId }).sort({ createdAt: -1 }).lean();
    if (last && Date.now() - new Date(last.createdAt).getTime() < cfg.spawnIntervalMinutes * 60000) return null;
  }
  const template = templateFor(cfg.bossIndex);
  const hp = Math.max(1000, Math.round(cfg.baseHp));
  try {
    const session = await models.WorldBossSession.create({
      guildId,
      bossKey: template.key,
      name: template.name,
      image: template.image,
      hpMax: hp,
      hp,
      attack: cfg.attack,
      defense: cfg.defense,
      level: 1,
      status: 'active',
      spawnedAt: new Date(),
      endsAt: new Date(Date.now() + cfg.durationMinutes * 60000),
    });
    await models.WorldBoss.findOneAndUpdate(
      { key: template.key },
      { $setOnInsert: { ...template } },
      { upsert: true },
    ).catch(() => {});
    log.info(`World boss ${template.name} spawned di guild ${guildId} (${hp} HP).`);
    return session;
  } catch (error) {
    if (error.code === 11000) return models.WorldBossSession.findOne({ guildId, status: 'active' }).lean();
    throw error;
  }
}

async function getStatus(guildId) {
  const boss = await ensureBoss(guildId);
  if (!boss) return { boss: null, contributors: [] };
  const contributors = await models.WorldBossContribution.find({ sessionId: boss._id }).sort({ damage: -1 }).limit(10).lean();
  const totalDamage = contributors.reduce((sum, c) => sum + (c.damage || 0), 0);
  return { boss, contributors, totalDamage };
}

async function attack(guildId, userId, profile = {}, requestId = null) {
  const game = await settingsService.getGame(guildId);
  const cfg = game.worldBoss;
  if (!cfg.enabled) throw new UserError('World boss sedang dinonaktifkan admin.');
  const boss = await ensureBoss(guildId);
  if (!boss) throw new UserError('Belum ada world boss. Tunggu spawn berikutnya.');
  if (boss.hp <= 0) throw new UserError('World boss sudah dikalahkan. Tunggu spawn berikutnya.');
  if (new Date(boss.endsAt).getTime() <= Date.now()) {
    await models.WorldBossSession.updateOne({ _id: boss._id, status: 'active' }, { $set: { status: 'expired' } });
    throw new UserError('World boss sudah kabur. Tunggu spawn berikutnya.');
  }
  const cd = await cooldownService.claim(guildId, userId, 'worldboss', 30000);
  if (!cd.ok) throw new UserError(`Serangan boss cooldown <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);

  const user = await userService.ensureUser(guildId, userId, profile);
  let pet = null;
  if (user.activePetId) pet = await models.Pet.findOne({ _id: user.activePetId, guildId, userId }).lean();
  const stats = playerBattleStats(user, pet, game.battle);
  const raw = Math.max(1, Math.round((stats.attack * (0.85 + randomFloat() * 0.3) + stats.speed * 0.5 - boss.defense * 0.25) * cfg.damageMultiplier));
  const damage = Math.max(1, Math.min(raw, boss.hp));
  const updated = await models.WorldBossSession.findOneAndUpdate(
    { _id: boss._id, status: 'active', hp: { $gt: 0 } },
    { $inc: { hp: -damage } },
    { new: true },
  );
  if (!updated) throw new UserError('Boss sudah diproses instance lain.');
  await models.WorldBossContribution.findOneAndUpdate(
    { sessionId: boss._id, guildId, userId },
    { $inc: { damage, attacks: 1 }, $setOnInsert: { guildId } },
    { upsert: true, new: true },
  );
  await models.RPGUser.updateOne({ guildId, userId }, { $inc: { totalBossDamage: damage } });
  await questService.track(guildId, userId, 'bossAttack', 1).catch(() => {});

  let defeated = false;
  if (updated.hp <= 0) {
    const marked = await models.WorldBossSession.findOneAndUpdate(
      { _id: boss._id, status: 'active', hp: { $lte: 0 } },
      { $set: { status: 'defeated', defeatedAt: new Date() } },
      { new: true },
    );
    if (marked) {
      defeated = true;
      await grantRewards(marked).catch((error) => log.error(`Boss reward failed: ${error.message}`, error));
    }
  }
  return {
    boss: updated,
    damage,
    defeated,
    hpLeft: Math.max(0, updated.hp),
    counterDamage: Math.round(boss.attack * (0.1 + randomFloat() * 0.15)),
    skill: defeated ? '666 Judgement' : pick((BOSS_TEMPLATES.find((b) => b.key === boss.bossKey)?.skills) || ['Boss Strike']),
  };
}

async function grantRewards(session) {
  const claimed = await models.WorldBossSession.findOneAndUpdate(
    { _id: session._id, rewardsGranted: false },
    { $set: { rewardsGranted: true } },
    { new: true },
  );
  if (!claimed) return false;
  const contributions = await models.WorldBossContribution.find({ sessionId: session._id }).sort({ damage: -1 }).lean();
  if (contributions.length === 0) return true;
  const total = contributions.reduce((sum, c) => sum + c.damage, 0) || 1;
  const game = await settingsService.getGame(session.guildId);
  const cfg = game.worldBoss;
  const top = contributions[0];
  for (const [index, contribution] of contributions.entries()) {
    const share = contribution.damage / total;
    const coins = Math.max(1, Math.round(cfg.coinReward * (0.3 + share * 2)));
    const xp = Math.max(1, Math.round(cfg.xpReward * (0.3 + share * 2)));
    await userService.addCoins(session.guildId, contribution.userId, coins, 'worldboss_reward', `boss:${session._id}:${contribution.userId}:coin`, { boss: session.bossKey, share }).catch(() => {});
    await userService.addXp(session.guildId, contribution.userId, xp, 'xp').catch(() => {});
    if (index === 0 && chance(60)) {
      const speciesId = session.bossKey === 'demon_king' ? 'demonking' : session.bossKey === 'void_leviathan' ? 'voidserpent' : 'titan';
      const { MONSTER_MAP } = require('../data/catalog');
      const species = MONSTER_MAP[speciesId];
      if (species) {
        const shiny = chance(8);
        const created = await models.Monster.create({
          guildId: session.guildId, userId: contribution.userId, speciesId: species.id,
          name: species.name, rarity: species.rarity, shiny, level: 1,
          hp: species.hp, attack: species.attack, defense: species.defense, speed: species.speed,
          image: species.image, sellValue: species.coins * 4,
        }).catch(() => null);
        if (created) {
          await models.MonsterCollection.findOneAndUpdate(
            { guildId: session.guildId, userId: contribution.userId, speciesId: species.id },
            { $inc: { count: 1, shinyCount: shiny ? 1 : 0 }, $setOnInsert: { firstCaughtAt: new Date() } },
            { upsert: true },
          ).catch(() => {});
        }
      }
    }
    await models.WorldBossContribution.updateOne({ _id: contribution._id }, { $set: { rewarded: true } }).catch(() => {});
  }
  log.info(`Boss ${session.name} defeated in ${session.guildId}; rewarded ${contributions.length} players.`);
  return true;
}

async function leaderboard(guildId) {
  const boss = await models.WorldBossSession.findOne({ guildId }).sort({ createdAt: -1 }).lean();
  if (!boss) return { boss: null, entries: [] };
  const entries = await models.WorldBossContribution.find({ sessionId: boss._id }).sort({ damage: -1 }).limit(15).lean();
  return { boss, entries };
}

async function myContribution(guildId, userId) {
  const boss = await models.WorldBossSession.findOne({ guildId }).sort({ createdAt: -1 }).lean();
  if (!boss) return null;
  return models.WorldBossContribution.findOne({ sessionId: boss._id, userId }).lean();
}

async function rewardsPreview(guildId) {
  const game = await settingsService.getGame(guildId);
  const boss = await models.WorldBossSession.findOne({ guildId, status: 'active' }).lean();
  return {
    coinReward: game.worldBoss.coinReward,
    xpReward: game.worldBoss.xpReward,
    bossHp: boss?.hp || game.worldBoss.baseHp,
    note: `Reward dibagi berdasarkan kontribusi damage. Bonus drop untuk rank #1.`,
  };
}

async function tick(client = null) {
  const guildIds = new Set();
  try {
    const users = await models.RPGUser.distinct('guildId');
    for (const id of users || []) guildIds.add(String(id));
  } catch { /* ignore */ }
  try {
    const guilds = await models.GuildConfig.distinct('guildId');
    for (const id of guilds || []) guildIds.add(String(id));
  } catch { /* ignore */ }
  for (const guildId of guildIds) {
    try {
      await ensureBoss(guildId);
    } catch (error) {
      log.warn(`Boss tick failed for ${guildId}: ${error.message}`);
    }
  }
}

module.exports = { ensureBoss, attack, getStatus, leaderboard, myContribution, rewardsPreview, grantRewards, tick, expireStale, templateFor };
