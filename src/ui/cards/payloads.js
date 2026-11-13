'use strict';

/**
 * Builds Discord message payloads (embed + PNG attachment) for every 666 card.
 *
 * If canvas rendering ever fails, the command/log still delivers the textual
 * embed instead of disappearing — the bot never becomes unusable because of an
 * image problem.
 */

const { AttachmentBuilder } = require('discord.js');
const cardService = require('../../services/cardService');
const { resolveManyMembers } = require('../../utils/members');
const { createLogger } = require('../../utils/logger');
const {
  profileEmbed,
  profileCardEmbed,
  leaderboardEmbed,
  leaderboardCardEmbed,
  streakLogEmbed,
} = require('../embeds');

const log = createLogger('payloads');

const PROFILE_FILE = 'duo-profile.png';
const LEADERBOARD_FILE = 'duo-leaderboard.png';
const STREAK_LOG_FILE = 'duo-streak-log.png';

function attachment(buffer, name, description) {
  return new AttachmentBuilder(buffer, { name, description });
}

/**
 * @param {object} overview profileService.getDuoOverview() result
 * @param {{title?: string}} [options]
 * @returns {Promise<{embed: import('discord.js').EmbedBuilder, files: import('discord.js').AttachmentBuilder[]}>}
 */
async function buildProfilePayload(overview, { title } = {}) {
  const withTitle = (embed) => {
    if (title) embed.setTitle(title);
    return embed;
  };

  try {
    const buffer = await cardService.renderProfile(overview);
    const embed = withTitle(profileCardEmbed({
      duo: overview.duo,
      members: overview.members,
      today: overview.today,
      timezone: overview.timezone,
    }));
    embed.setImage(`attachment://${PROFILE_FILE}`);
    return {
      embed,
      files: [attachment(buffer, PROFILE_FILE, '666 DUO STREAK profile card — two members, one streak.')],
    };
  } catch (error) {
    log.error('Profile card render failed; sending text embed fallback.', error);
    return {
      embed: withTitle(profileEmbed({
        duo: overview.duo,
        members: overview.members,
        today: overview.today,
        rewardSummary: overview.rewardSummary,
        nextMilestone: overview.nextMilestone,
        timezone: overview.timezone,
      })),
      files: [],
    };
  }
}

/**
 * Hydrates leaderboard rows then renders the page image.
 *
 * @param {object} data
 * @param {object} data.board duoService.getLeaderboard() result
 * @param {import('discord.js').Guild} data.guild
 */
async function buildLeaderboardPayload({ board, guild }) {
  const ids = board.entries.flatMap((duo) => (duo.members || []).map((member) => member.userId));
  let live = new Map();
  try {
    live = await resolveManyMembers(guild, ids);
  } catch (error) {
    log.warn('Could not hydrate leaderboard members; using stored names.', error.message);
  }

  const entries = board.entries.map((duo) => ({
    duo,
    members: (duo.members || []).map((member) => live.get(String(member.userId)) || {
      userId: String(member.userId),
      username: member.username,
      displayName: member.displayName || member.username,
      avatar: member.avatar || null,
    }),
  }));

  try {
    const buffer = await cardService.renderLeaderboard({
      entries,
      page: board.page,
      pageCount: board.pageCount,
      total: board.total,
    });
    const embed = leaderboardCardEmbed({
      page: board.page,
      pageCount: board.pageCount,
      total: board.total,
      categoryLabel: board.label,
      guildName: guild?.name,
    });
    embed.setImage(`attachment://${LEADERBOARD_FILE}`);
    return {
      embed,
      files: [attachment(buffer, LEADERBOARD_FILE, '666 DUO STREAK leaderboard — ranked Duos.')],
    };
  } catch (error) {
    log.error('Leaderboard card render failed; sending text embed fallback.', error);
    return {
      embed: leaderboardEmbed({
        entries: board.entries,
        page: board.page,
        pageSize: board.pageSize,
        total: board.total,
        categoryLabel: board.label,
        guildName: guild?.name,
      }),
      files: [],
    };
  }
}

/**
 * Builds the automatic streak log message. Rendering failures fall back to the
 * text embed, so a delivery never blocks the retry queue.
 *
 * @param {object} logEntry persisted StreakLog document (lean)
 * @param {{guildName?: string, timezone?: string}} [context]
 */
async function buildStreakLogPayload(logEntry, { guildName, timezone } = {}) {
  const embed = streakLogEmbed({ log: logEntry, timezone });

  try {
    const buffer = await cardService.renderStreakLog(logEntry, { timezone, guildName });
    embed.setImage(`attachment://${STREAK_LOG_FILE}`);
    return {
      embed,
      files: [attachment(buffer, STREAK_LOG_FILE, '666 DUO STREAK LOGS banner — streak increased.')],
    };
  } catch (error) {
    log.error(`Streak log card render failed for ${logEntry.duoId}/${logEntry.dayKey}.`, error);
    return { embed, files: [] };
  }
}

module.exports = {
  buildProfilePayload,
  buildLeaderboardPayload,
  buildStreakLogPayload,
  PROFILE_FILE,
  LEADERBOARD_FILE,
  STREAK_LOG_FILE,
};
