'use strict';

const { Duo, DuoReward, Invitation, UserStat, StreakHistory } = require('../database/models');
const { config } = require('../config');
const { createLogger } = require('../utils/logger');
const { UserError, isDuplicateKeyError } = require('../utils/errors');
const { sanitizeDuoName } = require('../utils/validators');
const { getDayKey } = require('../utils/time');
const { getGuildConfig } = require('./configService');

const log = createLogger('duo');

const CACHE_TTL_MS = 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 15 * 1000;
const INVITE_RATE_LIMIT_PER_HOUR = 10;

/** userId -> { value: duo|null, expiresAt } */
const duoCache = new Map();

const LEADERBOARD_CATEGORIES = {
  current: { field: 'currentStreak', label: '🔥 Current Streak' },
  streak: { field: 'currentStreak', label: '🔥 Current Streak' },
  best: { field: 'bestStreak', label: '🏆 Best Streak' },
  xp: { field: 'xp', label: '💎 Total Duo XP' },
  days: { field: 'totalDays', label: '📅 Total Days Together' },
};

function plain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

function cacheKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function putsCache(duo) {
  if (!duo || duo.status !== 'active') return;
  for (const member of duo.members || []) {
    duoCache.set(cacheKey(duo.guildId, member.userId), {
      value: duo,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}

function dropCacheForGuild(guildId) {
  for (const key of duoCache.keys()) {
    if (key.startsWith(`${guildId}:`)) duoCache.delete(key);
  }
}

function invalidateDuo(duo) {
  if (!duo) return;
  for (const member of duo.members || []) {
    duoCache.delete(cacheKey(duo.guildId, member.userId));
  }
}

function clearDuoCache() {
  duoCache.clear();
}

function memberFromDiscord(member) {
  return {
    userId: String(member.id || member.userId),
    username: member.user?.username || member.username || 'unknown',
    displayName: member.displayName || member.nickname || member.user?.globalName || member.username || 'Unknown',
    avatar: typeof member.displayAvatarURL === 'function'
      ? member.displayAvatarURL({ size: 256, extension: 'png' })
      : member.avatar || null,
  };
}

/**
 * Active duo for a user (cached for the hot message path).
 */
async function getActiveDuoForUser(guildId, userId, { fresh = false } = {}) {
  const id = String(guildId);
  const uid = String(userId);
  const key = cacheKey(id, uid);

  if (!fresh) {
    const cached = duoCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      // Never serve a cached Duo that has ended in the meantime.
      return cached.value && cached.value.status === 'active' ? cached.value : null;
    }
  }

  const doc = await Duo.findOne({ guildId: id, status: 'active', 'members.userId': uid }).lean();
  duoCache.set(key, {
    value: doc || null,
    expiresAt: Date.now() + (doc ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
  });
  if (doc) putsCache(doc);
  return doc || null;
}

async function getDuoById(duoId, { fresh = false } = {}) {
  if (!duoId) return null;
  if (!fresh) {
    for (const entry of duoCache.values()) {
      if (
        entry.value
        && entry.value.status === 'active'
        && String(entry.value._id) === String(duoId)
        && entry.expiresAt > Date.now()
      ) {
        return entry.value;
      }
    }
  }
  const doc = await Duo.findOne({ _id: duoId }).lean();
  if (doc) putsCache(doc);
  return doc || null;
}

function getPartner(duo, userId) {
  if (!duo) return null;
  return (duo.members || []).find((member) => String(member.userId) !== String(userId)) || null;
}

function isMember(duo, userId) {
  if (!duo) return false;
  return (duo.members || []).some((member) => String(member.userId) === String(userId));
}

async function getLatestPendingInvitation(guildId, userId) {
  return Invitation.findOne({
    guildId: String(guildId),
    toUserId: String(userId),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
}

async function getPendingInvitationById(guildId, userId, invitationId) {
  return Invitation.findOne({
    _id: invitationId,
    guildId: String(guildId),
    toUserId: String(userId),
    status: 'pending',
  }).lean();
}

async function getPendingInvitationsFrom(guildId, userId) {
  return Invitation.find({
    guildId: String(guildId),
    fromUserId: String(userId),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Creates a Duo invitation with anti-spam & anti-duplicate validation.
 */
async function invite({ guildId, from, to, inviterIsBot = false }) {
  const gid = String(guildId);
  const fromMember = memberFromDiscord(from);
  const toMember = memberFromDiscord(to);

  if (inviterIsBot) throw new UserError('Bot tidak dapat membuat Duo.');
  if (!toMember.userId || toMember.userId === fromMember.userId) {
    throw new UserError('Kamu tidak bisa mengundang dirimu sendiri.');
  }
  if (to?.user?.bot || to?.bot) {
    throw new UserError('Kamu tidak bisa mengundang bot sebagai Duo partner.');
  }

  const [fromDuo, toDuo] = await Promise.all([
    getActiveDuoForUser(gid, fromMember.userId, { fresh: true }),
    getActiveDuoForUser(gid, toMember.userId, { fresh: true }),
  ]);

  if (fromDuo) {
    const partner = getPartner(fromDuo, fromMember.userId);
    throw new UserError(`Kamu sudah terhubung dengan <@${partner?.userId || 'unknown'}>. Gunakan \`/duo profile\`.`);
  }
  if (toDuo) {
    throw new UserError(`<@${toMember.userId}> sudah terhubung dengan Duo lain.`);
  }

  const now = new Date();

  const pendingCount = await Invitation.countDocuments({
    guildId: gid,
    fromUserId: fromMember.userId,
    status: 'pending',
    expiresAt: { $gt: now },
  });
  if (pendingCount >= config.duo.maxPendingInvites) {
    throw new UserError(
      `Kamu punya ${pendingCount} undangan pending. Tunggu jawaban atau batalkan salah satunya dulu.`,
      { code: 'TOO_MANY_PENDING' },
    );
  }

  const recentCount = await Invitation.countDocuments({
    guildId: gid,
    fromUserId: fromMember.userId,
    createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
  });
  if (recentCount >= INVITE_RATE_LIMIT_PER_HOUR) {
    throw new UserError('Terlalu banyak undangan dalam 1 jam terakhir. Coba lagi nanti.', {
      code: 'INVITE_RATE_LIMITED',
    });
  }

  const existing = await Invitation.findOne({
    guildId: gid,
    fromUserId: fromMember.userId,
    toUserId: toMember.userId,
    status: 'pending',
  }).lean();

  if (existing) {
    if (new Date(existing.expiresAt).getTime() > now.getTime()) {
      return { invitation: existing, existing: true };
    }
    await Invitation.updateOne({ _id: existing._id }, { $set: { status: 'expired', respondedAt: now } });
  }

  // Keep the generated name readable and inside the 32 character limit.
  const shortName = (value) => String(value || 'Duo').replace(/\s+/g, ' ').trim().slice(0, 14);
  let duoName;
  try {
    duoName = sanitizeDuoName(`${shortName(fromMember.displayName)} × ${shortName(toMember.displayName)}`, {
      maxLength: 32,
    });
  } catch {
    duoName = '666 DUO';
  }

  const expiresAt = new Date(now.getTime() + config.duo.inviteTtlHours * 60 * 60 * 1000);

  try {
    const created = await Invitation.create({
      guildId: gid,
      fromUserId: fromMember.userId,
      toUserId: toMember.userId,
      fromUsername: fromMember.username,
      toUsername: toMember.username,
      fromDisplayName: fromMember.displayName,
      toDisplayName: toMember.displayName,
      duoName,
      status: 'pending',
      expiresAt,
    });

    return { invitation: plain(created), existing: false };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const duplicate = await getLatestPendingInvitation(gid, toMember.userId);
      if (duplicate) return { invitation: duplicate, existing: true };
    }
    throw error;
  }
}

async function cancelInvitation({ guildId, invitationId, status = 'cancelled' }) {
  return Invitation.findOneAndUpdate(
    { _id: invitationId, guildId: String(guildId), status: 'pending' },
    { $set: { status, respondedAt: new Date() } },
    { new: true },
  ).lean();
}

/**
 * Accepts an invitation and creates the Duo atomically (protected by the
 * unique partial index on active members).
 */
async function acceptInvitation({ guildId, userId, invitationId = null }) {
  const gid = String(guildId);
  const uid = String(userId);
  const now = new Date();

  const invitation = invitationId
    ? await getPendingInvitationById(gid, uid, invitationId)
    : await getLatestPendingInvitation(gid, uid);

  if (!invitation) {
    throw new UserError('Tidak ada undangan Duo yang menunggu. Minta partner mengirim `/duo invite` dulu.');
  }

  if (new Date(invitation.expiresAt).getTime() < now.getTime()) {
    await Invitation.updateOne({ _id: invitation._id }, { $set: { status: 'expired', respondedAt: now } });
    throw new UserError('Undangan sudah kedaluwarsa. Minta partner mengirim undangan baru.');
  }

  const [accepterDuo, inviterDuo] = await Promise.all([
    getActiveDuoForUser(gid, uid, { fresh: true }),
    getActiveDuoForUser(gid, invitation.fromUserId, { fresh: true }),
  ]);

  if (accepterDuo) throw new UserError('Kamu sudah terhubung dengan Duo lain.');
  if (inviterDuo) throw new UserError('Pengundang sudah terhubung dengan Duo lain.');

  const guildConfig = await getGuildConfig(gid);

  const members = [
    {
      userId: String(invitation.fromUserId),
      username: invitation.fromUsername || 'unknown',
      displayName: invitation.fromDisplayName || invitation.fromUsername || 'Unknown',
      avatar: null,
    },
    {
      userId: uid,
      username: invitation.toUsername || 'unknown',
      displayName: invitation.toDisplayName || invitation.toUsername || 'Unknown',
      avatar: null,
    },
  ];

  let duoDoc;
  try {
    duoDoc = await Duo.create({
      guildId: gid,
      name: invitation.duoName || '666 DUO',
      members,
      status: 'active',
      notificationsEnabled: true,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new UserError('Salah satu member sudah terhubung dengan Duo lain.');
    }
    throw error;
  }

  const duo = plain(duoDoc);

  await Invitation.updateOne(
    { _id: invitation._id, status: 'pending' },
    { $set: { status: 'accepted', respondedAt: now } },
  ).catch((error) => log.warn('Failed to mark invitation accepted.', error.message));

  // Cancel every other pending invitation that involves these two users.
  await Invitation.updateMany(
    {
      guildId: gid,
      status: 'pending',
      $or: [
        { fromUserId: { $in: [members[0].userId, members[1].userId] } },
        { toUserId: { $in: [members[0].userId, members[1].userId] } },
      ],
    },
    { $set: { status: 'cancelled', respondedAt: now } },
  ).catch((error) => log.warn('Failed to cancel other invitations.', error.message));

  const dayKey = getDayKey(now, guildConfig.timezone);
  await StreakHistory.create({
    guildId: gid,
    duoId: duo._id,
    dayKey,
    type: 'joined',
    streak: 0,
    note: `Duo created with ${members.map((member) => member.username).join(' × ')}`,
  }).catch((error) => {
    if (!isDuplicateKeyError(error)) log.warn('Failed to record joined history.', error.message);
  });

  await Promise.all(members.map((member) => UserStat.updateOne(
    { guildId: gid, userId: member.userId },
    {
      $inc: { duosCount: 1 },
      $set: { duoId: duo._id, username: member.username, currentStreak: 0, lastActiveAt: null },
      $setOnInsert: { guildId: gid, userId: member.userId },
    },
    { upsert: true },
  ).catch((error) => log.warn('Failed to update user stats.', error.message))));

  putsCache(duo);
  return { duo, invitation };
}

async function declineInvitation({ guildId, userId, invitationId = null }) {
  const gid = String(guildId);
  const uid = String(userId);
  const now = new Date();

  const invitation = invitationId
    ? await getPendingInvitationById(gid, uid, invitationId)
    : await getLatestPendingInvitation(gid, uid);

  if (!invitation) throw new UserError('Tidak ada undangan Duo yang bisa ditolak.');

  const updated = await Invitation.findOneAndUpdate(
    { _id: invitation._id, status: 'pending' },
    { $set: { status: 'declined', respondedAt: now } },
    { new: true },
  ).lean();

  return updated || invitation;
}

async function renameDuo({ duo, userId, newName }) {
  if (!duo) throw new UserError('Duo tidak ditemukan.');
  if (!isMember(duo, userId)) throw new UserError('Kamu bukan member Duo ini.');

  const name = sanitizeDuoName(newName, { maxLength: 32 });

  const updated = await Duo.findOneAndUpdate(
    { _id: duo._id, status: 'active' },
    { $set: { name } },
    { new: true },
  ).lean();

  if (!updated) throw new UserError('Duo ini sudah tidak aktif.');

  invalidateDuo(duo);
  putsCache(updated);
  return updated;
}

/**
 * Ends a Duo. Best streak is preserved for the leaderboard/history.
 */
async function breakDuo({ duo, userId, reason = 'manual', actorId = null }) {
  if (!duo) throw new UserError('Duo tidak ditemukan.');

  // Always read the latest state: the caller may hold a cached (older) copy.
  const current = await Duo.findOne({ _id: duo._id, status: 'active' }).lean();
  if (!current) throw new UserError('Duo ini sudah tidak aktif.');
  if (!isMember(current, userId)) throw new UserError('Kamu bukan member Duo ini.');

  const now = new Date();
  const finalStreak = Number(current.currentStreak) || 0;

  if (Number(current.bestStreak) < finalStreak) {
    await Duo.updateOne({ _id: current._id }, { $set: { bestStreak: finalStreak } });
  }

  const updated = await Duo.findOneAndUpdate(
    { _id: current._id, status: 'active' },
    {
      $set: {
        status: 'broken',
        currentStreak: 0,
        brokenAt: now,
        brokenBy: String(actorId || userId),
        breakReason: reason,
      },
    },
    { new: true },
  ).lean();

  if (!updated) throw new UserError('Duo ini sudah tidak aktif.');

  let guildConfig = null;
  try {
    guildConfig = await getGuildConfig(current.guildId);
  } catch {
    guildConfig = null;
  }
  const dayKey = getDayKey(now, guildConfig?.timezone);

  await StreakHistory.create({
    guildId: current.guildId,
    duoId: current._id,
    dayKey,
    type: 'ended',
    streak: finalStreak,
    note: reason === 'partner_left' ? 'Partner left the server' : 'Duo ended manually',
  }).catch((error) => {
    if (!isDuplicateKeyError(error)) log.warn('Failed to record ended history.', error.message);
  });

  await Invitation.updateMany(
    {
      guildId: current.guildId,
      status: 'pending',
      $or: [
        { fromUserId: { $in: current.members.map((member) => member.userId) } },
        { toUserId: { $in: current.members.map((member) => member.userId) } },
      ],
    },
    { $set: { status: 'cancelled', respondedAt: now } },
  ).catch(() => {});

  await UserStat.updateMany(
    { guildId: current.guildId, duoId: current._id },
    { $set: { duoId: null, currentStreak: 0 } },
  ).catch((error) => log.warn('Failed to reset user stats.', error.message));

  invalidateDuo(current);
  dropCacheForGuild(current.guildId);
  putsCache(updated);

  return { duo: updated, finalStreak };
}

async function getLeaderboard({ guildId, category = 'current', page = 0, pageSize = 5 }) {
  const configEntry = LEADERBOARD_CATEGORIES[category] || LEADERBOARD_CATEGORIES.current;
  const safePageSize = Math.min(10, Math.max(1, Number(pageSize) || 5));

  const total = await Duo.countDocuments({ guildId: String(guildId), status: 'active' });
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(0, Number(page) || 0), pageCount - 1);

  const entries = await Duo.find({ guildId: String(guildId), status: 'active' })
    .sort({ [configEntry.field]: -1, bestStreak: -1, createdAt: 1 })
    .skip(safePage * safePageSize)
    .limit(safePageSize)
    .lean();

  return {
    entries,
    total,
    page: safePage,
    pageSize: safePageSize,
    pageCount,
    category: LEADERBOARD_CATEGORIES[category] ? category : 'current',
    field: configEntry.field,
    label: configEntry.label,
  };
}

async function getHistory({ duoId, page = 0, pageSize = 8 }) {
  const safePageSize = Math.min(20, Math.max(1, Number(pageSize) || 8));
  const total = await StreakHistory.countDocuments({ duoId });
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(0, Number(page) || 0), pageCount - 1);

  const entries = await StreakHistory.find({ duoId })
    .sort({ createdAt: -1 })
    .skip(safePage * safePageSize)
    .limit(safePageSize)
    .lean();

  return { entries, total, page: safePage, pageSize: safePageSize, pageCount };
}

async function getGlobalStats(guildId = null) {
  const filter = guildId ? { guildId: String(guildId) } : {};
  const [activeDuos, brokenDuos, totalRewards] = await Promise.all([
    Duo.countDocuments({ ...filter, status: 'active' }),
    Duo.countDocuments({ ...filter, status: 'broken' }),
    DuoReward.countDocuments(guildId ? { guildId: String(guildId) } : {}),
  ]);

  const topDuo = await Duo.findOne({ ...filter, status: 'active' }).sort({ bestStreak: -1 }).lean();

  return {
    activeDuos,
    brokenDuos,
    totalRewards,
    topDuo: topDuo
      ? {
        name: topDuo.name,
        currentStreak: topDuo.currentStreak,
        bestStreak: topDuo.bestStreak,
        xp: topDuo.xp,
        totalDays: topDuo.totalDays,
        members: topDuo.members.map((member) => member.userId),
      }
      : null,
  };
}

module.exports = {
  LEADERBOARD_CATEGORIES,
  INVITE_RATE_LIMIT_PER_HOUR,
  memberFromDiscord,
  plain,
  getActiveDuoForUser,
  getDuoById,
  getPartner,
  isMember,
  getLatestPendingInvitation,
  getPendingInvitationById,
  getPendingInvitationsFrom,
  invite,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
  renameDuo,
  breakDuo,
  getLeaderboard,
  getHistory,
  getGlobalStats,
  invalidateDuo,
  clearDuoCache,
};
