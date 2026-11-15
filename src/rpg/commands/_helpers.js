'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { UserError } = require('../../utils/errors');

function payload(embed, components = []) {
  const data = { embeds: [embed], allowedMentions: { parse: [], repliedUser: false } };
  if (components.length) data.components = components;
  return data;
}

function helpEmbed(title, lines) {
  return new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle(`📖 ${title}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: BRAND });
}

async function reply(message, embed, components = []) {
  return message.reply(payload(embed, components));
}

function mentionUser(id) {
  return `<@${id}>`;
}

async function resolveTarget(message, input) {
  if (message.mentions?.users?.size) return message.mentions.users.first();
  const raw = String(input || '').replace(/[^0-9]/g, '');
  if (!/^\d{15,25}$/.test(raw)) return null;
  try {
    const user = await message.client.users.fetch(raw);
    return user;
  } catch {
    return { id: raw, username: `User ${raw}`, displayAvatarURL: () => null };
  }
}

function profileOf(user) {
  return {
    username: user?.username || null,
    avatar: typeof user?.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null,
  };
}

function parseAmount(input, fallback = null) {
  if (input === 'all') return 'all';
  const value = Math.floor(Number(input));
  if (!Number.isFinite(value)) return fallback;
  return value;
}

function argAmount(args, index, fallback = null) {
  return parseAmount(args[index], fallback);
}

function splitIdAndQty(value) {
  const [id, qty] = String(value || '').split(':');
  return { id, qty: Math.max(1, Math.floor(Number(qty) || 1)) };
}

async function resolveMonsterId(guildId, userId, input) {
  const raw = String(input || '');
  if (/^[a-f0-9]{24}$/i.test(raw)) return raw;
  const models = require('../../database/models');
  const docs = await models.Monster.find({ guildId, userId }).select('_id name').lean();
  const match = docs.find((d) => String(d._id).endsWith(raw));
  return match ? String(match._id) : raw;
}

async function resolvePetId(guildId, userId, input) {
  const raw = String(input || '');
  if (/^[a-f0-9]{24}$/i.test(raw)) return raw;
  const models = require('../../database/models');
  const docs = await models.Pet.find({ guildId, userId }).select('_id name').lean();
  const match = docs.find((d) => String(d._id).endsWith(raw));
  return match ? String(match._id) : raw;
}

function requireArgs(args, count, usage) {
  if (args.length < count) throw new UserError(`Format: \`${usage}\``);
}

function btn(label, id, style = ButtonStyle.Secondary, emoji = null) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

module.exports = {
  payload, helpEmbed, reply, mentionUser, resolveTarget, profileOf, parseAmount, argAmount,
  splitIdAndQty, resolveMonsterId, resolvePetId, requireArgs, btn, ActionRowBuilder, ButtonBuilder, ButtonStyle,
};
