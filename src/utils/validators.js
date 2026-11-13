'use strict';

const { UserError } = require('./errors');

const SNOWFLAKE_RE = /^\d{17,20}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const MENTION_RE = /<@[!&]?\d+>|@everyone|@here/gi;
const URL_RE = /https?:\/\/\S+/gi;
const INVITE_RE = /(discord\.gg|discord\.com\/invite)\/\S+/gi;
const ZERO_WIDTH_RE = /[\u200b-\u200d\ufeff]/g;

function isSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function isObjectIdLike(value) {
  if (!value) return false;
  const str = typeof value === 'string' ? value : String(value);
  return /^[a-f0-9]{24}$/i.test(str);
}

/**
 * Cleans a user supplied duo name.
 * Throws a UserError when the result is not acceptable.
 */
function sanitizeDuoName(rawName, { maxLength = 32, minLength = 2 } = {}) {
  if (typeof rawName !== 'string') {
    throw new UserError('Nama Duo tidak valid.');
  }

  const cleaned = rawName
    .replace(CONTROL_CHARS_RE, '')
    .replace(ZERO_WIDTH_RE, '')
    .replace(MENTION_RE, '')
    .replace(INVITE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < minLength) {
    throw new UserError(`Nama Duo minimal ${minLength} karakter (setelah karakter terlarang dibersihkan).`);
  }
  if (cleaned.length > maxLength) {
    throw new UserError(`Nama Duo maksimal ${maxLength} karakter.`);
  }

  return cleaned;
}

/**
 * Returns true when the message contains something beyond mentions/emoji/links.
 */
function hasMeaningfulContent(content, minLength = 3) {
  if (typeof content !== 'string') return false;

  const stripped = content
    .replace(/<a?:\w+:\d+>/g, ' ') // custom emoji
    .replace(/<@[!&]?\d+>/g, ' ') // mentions
    .replace(URL_RE, ' ')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Component}]/gu, ' ')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim();

  return stripped.length >= Math.max(1, minLength);
}

/**
 * Detects low-effort spam such as `aaaaaaaaaaaa`, `asdfasdfasdf` or a single
 * character repeated over and over. These messages never count as activity.
 */
function isLowEffortSpam(content) {
  if (typeof content !== 'string') return true;

  const normalized = content.replace(/\s+/g, '').toLowerCase();
  if (normalized.length === 0) return true;

  // One character repeated: "aaaaaaaa", "!!!!!!"
  if (new Set(normalized).size === 1) return true;

  // The same short block repeated: "lololololol", "asdfasdfasdf"
  for (let size = 2; size <= 6; size += 1) {
    if (normalized.length < size * 3) break;
    const block = normalized.slice(0, size);
    const rebuilt = block.repeat(Math.ceil(normalized.length / size)).slice(0, normalized.length);
    if (rebuilt === normalized) return true;
  }

  // Keyboard mashing with very low character variety over a long message
  const uniqueRatio = new Set(normalized).size / normalized.length;
  if (normalized.length >= 12 && uniqueRatio < 0.25) return true;

  return false;
}

function isUrlOnly(content) {
  if (typeof content !== 'string') return true;
  const stripped = content.replace(URL_RE, '').replace(/\s+/g, '');
  return stripped.length === 0;
}

module.exports = {
  SNOWFLAKE_RE,
  isSnowflake,
  isObjectIdLike,
  sanitizeDuoName,
  hasMeaningfulContent,
  isLowEffortSpam,
  isUrlOnly,
};
