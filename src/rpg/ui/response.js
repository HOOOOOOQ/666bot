'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { formatCoins } = require('../utils/formulas');

/**
 * Central response renderer.
 *
 * Commands pick the smallest presentation that fits their content instead of
 * wrapping every result in an embed. The returned objects are plain Discord
 * payload builders, so they can also be edited in place by button handlers.
 */
const RESPONSE_TYPES = Object.freeze({
  PLAIN: 'plain',
  RICH_TEXT: 'rich_text',
  EMBED: 'embed',
  INTERACTIVE: 'interactive',
  IMAGE: 'image',
  GIF: 'gif',
  GAME_BOARD: 'game_board',
  PROFILE_CARD: 'profile_card',
  LEADERBOARD: 'leaderboard',
});

const ALLOWED_MENTIONS = Object.freeze({ parse: [], repliedUser: false });

function response(type, { content = null, embeds = [], components = [], files = [] } = {}) {
  return {
    __response: true,
    type,
    content: content || null,
    embeds: Array.isArray(embeds) ? embeds : [embeds],
    components: Array.isArray(components) ? components : [components],
    files,
  };
}

function plain(content, components = []) {
  return response(RESPONSE_TYPES.PLAIN, { content, components });
}

function richText(content, components = []) {
  return response(RESPONSE_TYPES.RICH_TEXT, { content, components });
}

function embed(payload, components = []) {
  return response(RESPONSE_TYPES.EMBED, { embeds: payload, components });
}

function interactive(content, components = []) {
  return response(RESPONSE_TYPES.INTERACTIVE, { content, components });
}

function gameBoard(content, components = []) {
  return response(RESPONSE_TYPES.GAME_BOARD, { content, components });
}

function image(content, url, components = []) {
  const imageEmbed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setImage(url || null);
  return response(RESPONSE_TYPES.IMAGE, { content, embeds: imageEmbed, components });
}

function gif(content, url, components = []) {
  // Let Discord render the GIF URL as a link preview. This keeps simple
  // social interactions free of unnecessary embeds.
  return response(RESPONSE_TYPES.GIF, { content: [content, url].filter(Boolean).join('\n'), components });
}

function profileCard(payload, components = []) {
  return response(RESPONSE_TYPES.PROFILE_CARD, { embeds: payload, components });
}

function leaderboard(content, components = []) {
  return response(RESPONSE_TYPES.LEADERBOARD, { content, components });
}

function isResponse(value) {
  return Boolean(value && value.__response === true);
}

function toPayload(value) {
  if (!isResponse(value)) return value;
  const payload = { allowedMentions: ALLOWED_MENTIONS };
  if (value.content) payload.content = value.content;
  if (value.embeds?.length) payload.embeds = value.embeds;
  if (value.components?.length) payload.components = value.components;
  if (value.files?.length) payload.files = value.files;
  return payload;
}

async function send(message, value) {
  if (isResponse(value)) return message.reply(toPayload(value));
  return message.reply(value);
}

async function edit(interaction, value) {
  const payload = isResponse(value) ? toPayload(value) : value;
  return interaction.editReply(payload);
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [];
  if (days) parts.push(`${days}D`);
  parts.push(`${hours}H`, `${minutes}M`, `${seconds}S`);
  return parts.join(' ');
}

function nextDailyReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
}

function nextWeeklyReset(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const days = ((8 - day) % 7) || 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).getTime();
}

function nextMonthlyReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).getTime();
}

function countdownTo(timestamp, now = Date.now()) {
  return formatCountdown(Number(timestamp) - now);
}

function paginationButtons({ ownerId, page, pages, prefix = 'inv' }) {
  const id = (next) => `rpg:${prefix}:${ownerId}:${next}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(Math.max(1, page - 1))).setLabel('Previous').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(id(Math.min(pages, page + 1))).setLabel('Next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );
}

function coin(value) {
  return `${formatCoins(value)} 🪙`;
}

module.exports = {
  RESPONSE_TYPES,
  ALLOWED_MENTIONS,
  response,
  plain,
  richText,
  embed,
  interactive,
  gameBoard,
  image,
  gif,
  profileCard,
  leaderboard,
  isResponse,
  toPayload,
  send,
  edit,
  formatCountdown,
  nextDailyReset,
  nextWeeklyReset,
  nextMonthlyReset,
  countdownTo,
  paginationButtons,
  coin,
};
