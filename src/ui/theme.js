'use strict';

/** 666 visual identity: black / cyber red / fire accents. */
const COLORS = {
  flame: 0xff3b00,
  ember: 0xff8a00,
  blood: 0xc1121f,
  ash: 0x2b2b2b,
  success: 0x2ecc71,
  warning: 0xffb020,
  error: 0xed4245,
  info: 0x5865f2,
  platinum: 0xe5e7eb,
};

const BRAND = '666 SYSTEM • DUO CONNECTION';
const EMOJI = {
  fire: '🔥',
  bolt: '⚡',
  duo: '🤝',
  badge: '🎖️',
  trophy: '🏆',
  clock: '⏳',
  check: '✅',
  cross: '❌',
  skull: '💀',
  chain: '⛓️',
  chart: '📊',
  gem: '💎',
};

/** Renders `▰▰▰▰▱▱▱▱▱▱` progress bars. */
function progressBar(current, target, size = 10) {
  const safeTarget = Math.max(1, Number(target) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / safeTarget));
  const filled = Math.round(ratio * size);
  return `${'▰'.repeat(filled)}${'▱'.repeat(Math.max(0, size - filled))}`;
}

function percentage(current, target) {
  const safeTarget = Math.max(1, Number(target) || 1);
  return Math.max(0, Math.min(100, Math.round(((Number(current) || 0) / safeTarget) * 100)));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDays(days) {
  const n = Number(days) || 0;
  return `${formatNumber(n)} day${n === 1 ? '' : 's'}`;
}

/** Discord timestamp (`<t:...:R>`), safe for null dates. */
function relativeTimestamp(date) {
  if (!date) return '—';
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(time)) return '—';
  return `<t:${Math.floor(time / 1000)}:R>`;
}

/** Absolute Discord timestamp. */
function absoluteTimestamp(date, style = 'f') {
  if (!date) return '—';
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(time)) return '—';
  return `<t:${Math.floor(time / 1000)}:${style}>`;
}

function memberAvatar(member) {
  if (!member) return null;
  if (member.avatar) return member.avatar;
  if (/^\d{17,20}$/.test(String(member.userId))) {
    const index = Number(BigInt(member.userId) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return null;
}

function memberName(member) {
  if (!member) return 'Unknown';
  return member.displayName || member.username || `<@${member.userId}>`;
}

function mention(member) {
  return member?.userId ? `<@${member.userId}>` : 'Unknown';
}

function divider() {
  return '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
}

function codeblock(text) {
  return `\`\`\`\n${text}\n\`\`\``;
}

module.exports = {
  COLORS,
  BRAND,
  EMOJI,
  progressBar,
  percentage,
  formatNumber,
  formatDays,
  relativeTimestamp,
  absoluteTimestamp,
  memberAvatar,
  memberName,
  mention,
  divider,
  codeblock,
};
