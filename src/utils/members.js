'use strict';

/**
 * Hydrates stored duo member data with live Discord profile data (avatars keep
 * working after a user changes their picture). Falls back to the data stored in
 * MongoDB when the member is no longer reachable.
 */
async function resolveMember(guild, storedMember) {
  const fallback = {
    userId: String(storedMember?.userId || ''),
    username: storedMember?.username || 'Unknown',
    displayName: storedMember?.displayName || storedMember?.username || 'Unknown',
    avatar: storedMember?.avatar || null,
  };

  if (!guild || !fallback.userId) return fallback;

  try {
    const member = guild.members.cache.get(fallback.userId)
      || (await guild.members.fetch(fallback.userId).catch(() => null));
    if (!member) return fallback;
    return {
      userId: fallback.userId,
      username: member.user?.username || fallback.username,
      displayName: member.displayName || fallback.displayName,
      avatar: member.displayAvatarURL ? member.displayAvatarURL({ size: 256, extension: 'png' }) : fallback.avatar,
    };
  } catch {
    return fallback;
  }
}

/**
 * @returns {Promise<Array>} the two hydrated members, same order as stored.
 */
async function resolveDuoMembers(guild, duo) {
  const stored = Array.isArray(duo?.members) ? duo.members : [];
  if (!stored.length) return [];
  if (!guild) return stored.map((member) => ({ ...member, userId: String(member.userId) }));
  return Promise.all(stored.map((member) => resolveMember(guild, member)));
}

module.exports = { resolveMember, resolveDuoMembers };
