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

/**
 * Bulk variant used by the leaderboard renderer. Uses the guild cache first,
 * then one bulk fetch, then individual fallbacks for stragglers.
 *
 * @param {import('discord.js').Guild|null} guild
 * @param {string[]} userIds
 * @returns {Promise<Map<string, object>>}
 */
async function resolveManyMembers(guild, userIds = []) {
  const result = new Map();
  const unique = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];
  if (!guild || !unique.length) return result;

  const missing = [];
  for (const id of unique) {
    const cached = guild.members.cache.get(id);
    if (cached) {
      result.set(id, {
        userId: id,
        username: cached.user?.username || cached.username || 'Unknown',
        displayName: cached.displayName || cached.user?.username || 'Unknown',
        avatar: cached.displayAvatarURL
          ? cached.displayAvatarURL({ size: 256, extension: 'png' })
          : null,
      });
    } else {
      missing.push(id);
    }
  }

  if (!missing.length) return result;

  try {
    if (typeof guild.members.fetch === 'function') {
      await guild.members.fetch({ user: missing }).catch(() => null);
    }
  } catch {
    // A single failed bulk fetch should never break a leaderboard page.
  }

  await Promise.all(missing.map(async (id) => {
    const cached = guild.members.cache.get(id);
    if (cached) {
      result.set(id, {
        userId: id,
        username: cached.user?.username || cached.username || 'Unknown',
        displayName: cached.displayName || cached.user?.username || 'Unknown',
        avatar: cached.displayAvatarURL
          ? cached.displayAvatarURL({ size: 256, extension: 'png' })
          : null,
      });
      return;
    }

    const member = await guild.members.fetch(id).catch(() => null);
    if (member) {
      result.set(id, {
        userId: id,
        username: member.user?.username || member.username || 'Unknown',
        displayName: member.displayName || member.user?.username || 'Unknown',
        avatar: member.displayAvatarURL
          ? member.displayAvatarURL({ size: 256, extension: 'png' })
          : null,
      });
    }
  }));

  return result;
}

module.exports = { resolveMember, resolveDuoMembers, resolveManyMembers };
