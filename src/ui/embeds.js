'use strict';

const { EmbedBuilder } = require('discord.js');
const {
  COLORS,
  BRAND,
  EMOJI,
  progressBar,
  percentage,
  formatNumber,
  formatDays,
  relativeTimestamp,
  memberAvatar,
  memberName,
  mention,
  divider,
  codeblock,
} = require('./theme');
const { formatDayKey } = require('../utils/time');

/** Base constructor so every embed shares the 666 look. */
function buildEmbed({
  color = COLORS.flame,
  title,
  description,
  fields = [],
  footer = BRAND,
  footerIcon,
  thumbnail,
  authorName,
  authorIcon,
  timestamp = true,
  url,
} = {}) {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (url) embed.setURL(url);
  if (fields.length) embed.addFields(fields.filter(Boolean).map((field) => ({
    name: field.name,
    value: field.value || '—',
    inline: Boolean(field.inline),
  })));
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (authorName) embed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });
  if (footer) embed.setFooter({ text: footer, iconURL: footerIcon || undefined });
  if (timestamp) embed.setTimestamp(new Date());
  return embed;
}

function todayStatusLine(today, duo) {
  if (!today) return '⏳ Belum ada aktivitas hari ini.';
  if (today.bothCompleted) {
    return 'Both members completed today\'s activity.';
  }
  if (!today.anyCompleted) {
    return duo?.currentStreak
      ? '⏳ Belum ada aktivitas hari ini. Jangan biarkan streak kalian putus!'
      : '⏳ Streak dimulai setelah kedua member menyelesaikan aktivitas pertama.';
  }
  const missing = today.members.filter((entry) => !entry.completed).map((entry) => `<@${entry.userId}>`);
  return `⏳ Menunggu aktivitas dari ${missing.join(', ')} hari ini.`;
}

function memberField(entry, index) {
  const member = entry.member;
  const status = entry.completed
    ? `${EMOJI.check} Active${entry.completedAt ? ` • ${relativeTimestamp(entry.completedAt)}` : ''}`
    : `${EMOJI.clock} Pending`;
  return {
    name: `PARTNER ${index === 0 ? 'A' : 'B'}`,
    value: `**[${memberName(member)}](${memberAvatar(member) || 'https://discord.com'})**\n${mention(member)}\n${status}`,
    inline: true,
  };
}

function nextMilestoneField(nextMilestone, currentStreak) {
  if (!nextMilestone) {
    return { name: `${EMOJI.badge} NEXT REWARD`, value: '👑 Semua badge telah terbuka!' };
  }
  const remaining = Math.max(0, nextMilestone.days - currentStreak);
  const bar = progressBar(currentStreak, nextMilestone.days, 10);
  return {
    name: `${EMOJI.badge} NEXT REWARD • ${nextMilestone.name}`,
    value: `${bar} **${currentStreak}/${nextMilestone.days}** (${percentage(currentStreak, nextMilestone.days)}%)\n${remaining} hari lagi untuk membuka badge **${nextMilestone.name}**.`,
  };
}

/**
 * The main Duo profile card.
 */
function profileEmbed({ duo, members, today, rewardSummary, nextMilestone, timezone }) {
  const active = duo.status === 'active';
  const entries = Array.isArray(today?.members) && today.members.length === 2
    ? today.members
    : members.map((member) => ({ member, userId: member.userId, completed: false, completedAt: null }));
  const avatarA = memberAvatar(entries[0]?.member);
  const avatarB = memberAvatar(entries[1]?.member);
  const connection = active ? 'ACTIVE' : 'BROKEN';
  const statusColor = active ? COLORS.flame : COLORS.ash;

  const description = [
    `**DUO CONNECTION: \`${connection}\`**`,
    '',
    `<@${duo.members[0].userId}> ${EMOJI.fire} <@${duo.members[1].userId}>`,
    '',
    `## ${EMOJI.fire} ${formatDays(duo.currentStreak).toUpperCase()} STREAK`,
    `**${formatDays(duo.totalDays)} together**`,
    '',
    todayStatusLine(today, duo),
    '',
    codeblock(
      [
        `BEST STREAK : ${formatDays(duo.bestStreak).toUpperCase()}`,
        `DUO XP      : ${formatNumber(duo.xp)} XP`,
        `TOTAL DAYS  : ${formatDays(duo.totalDays).toUpperCase()}`,
        `STATUS      : ${connection}`,
      ].join('\n'),
    ),
  ].join('\n');

  const embed = buildEmbed({
    color: statusColor,
    authorName: `${EMOJI.fire} 666 DUO STREAK`,
    authorIcon: avatarA || undefined,
    title: duo.name,
    description,
    fields: [
      entries[0] ? memberField(entries[0], 0) : null,
      entries[1] ? memberField(entries[1], 1) : null,
      nextMilestoneField(nextMilestone, duo.currentStreak),
      {
        name: `${EMOJI.badge} BADGES`,
        value: rewardSummary
          ? `**${rewardSummary.unlocked}/${rewardSummary.total}** badge terbuka${rewardSummary.highest ? `\nTerakhir: **${rewardSummary.highest.name}**` : ''}`
          : '—',
        inline: true,
      },
      {
        name: `${EMOJI.chart} STREAK START`,
        value: duo.streakStartedAt ? `${relativeTimestamp(duo.streakStartedAt)}` : 'Belum dimulai',
        inline: true,
      },
    ],
    thumbnail: avatarB || undefined,
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
    footerIcon: avatarA || undefined,
  });

  return embed;
}

function streakEmbed({ duo, today, nextMilestone, timezone }) {
  const active = duo.status === 'active';
  const members = today?.members || [];
  const todayLine = todayStatusLine(today, duo);
  return buildEmbed({
    color: active ? COLORS.ember : COLORS.ash,
    authorName: `${EMOJI.fire} 666 DUO STREAK`,
    title: `${EMOJI.fire} ${formatDays(duo.currentStreak)} streak`,
    description: [
      `**${duo.name}**`,
      '',
      todayLine,
      '',
      members.length
        ? members.map((entry) => `${entry.completed ? EMOJI.check : EMOJI.clock} <@${entry.userId}> — ${entry.completed ? 'completed' : 'pending'}`).join('\n')
        : '',
      '',
      nextMilestone
        ? `${progressBar(duo.currentStreak, nextMilestone.days)} **${duo.currentStreak}/${nextMilestone.days}** menuju **${nextMilestone.name}**`
        : `${EMOJI.badge} Semua badge sudah terbuka!`,
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'CURRENT', value: `🔥 **${formatDays(duo.currentStreak)}**`, inline: true },
      { name: 'BEST', value: `🏆 **${formatDays(duo.bestStreak)}**`, inline: true },
      { name: 'TOTAL', value: `📅 **${formatDays(duo.totalDays)}**`, inline: true },
      { name: 'DUO XP', value: `💎 **${formatNumber(duo.xp)}** XP`, inline: true },
      { name: 'STARTED', value: duo.streakStartedAt ? relativeTimestamp(duo.streakStartedAt) : '—', inline: true },
      { name: 'TIMEZONE', value: timezone || 'Asia/Jakarta', inline: true },
    ],
    footer: `${BRAND} • daily reset follows server timezone`,
  });
}

const MEDALS = ['🥇', '🥈', '🥉'];

function leaderboardEmbed({ entries, page, pageSize, total, categoryLabel, guildName }) {
  const startRank = page * pageSize;
  const lines = entries.map((entry, index) => {
    const rank = startRank + index + 1;
    const prefix = MEDALS[rank - 1] || `\`#${String(rank).padStart(2, '0')}\``;
    const names = entry.members.map((member) => memberName(member)).join(' × ');
    return `${prefix} **${names}**\n　${EMOJI.fire} ${formatNumber(entry.currentStreak)}d • ${EMOJI.trophy} ${formatNumber(entry.bestStreak)}d • ${EMOJI.gem} ${formatNumber(entry.xp)} XP`;
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return buildEmbed({
    color: COLORS.ember,
    authorName: `${EMOJI.trophy} 666 DUO LEADERBOARD`,
    title: categoryLabel,
    description: lines.length ? lines.join('\n\n') : '*Belum ada Duo yang aktif di server ini.*',
    fields: [
      { name: 'TOTAL DUO', value: `**${formatNumber(total)}**`, inline: true },
      { name: 'PAGE', value: `**${page + 1}/${pageCount}**`, inline: true },
    ],
    footer: `${BRAND} • ${guildName || 'server'} • page ${page + 1}/${pageCount}`,
  });
}

const HISTORY_ICONS = {
  joined: '🤝',
  completed: '🔥',
  broken: '⛓️',
  reward: '🎖️',
  ended: '🚪',
  reminder: '🔔',
  milestone: '🏆',
};

function historyEmbed({ entries, page, pageSize, total, duo }) {
  const startIndex = page * pageSize;
  const lines = entries.map((entry, index) => {
    const icon = HISTORY_ICONS[entry.type] || '•';
    const label = String(entry.type || '').toUpperCase();
    const detail = entry.note ? ` — ${entry.note}` : '';
    return `\`${String(startIndex + index + 1).padStart(2, '0')}\` ${icon} **${label}** • ${formatDayKey(entry.dayKey)}${detail}`;
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return buildEmbed({
    color: COLORS.blood,
    authorName: `${EMOJI.chain} 666 DUO HISTORY`,
    title: `Riwayat • ${duo.name}`,
    description: lines.length ? lines.join('\n') : '*Belum ada riwayat aktivitas.*',
    fields: [
      { name: 'CURRENT STREAK', value: `${EMOJI.fire} ${formatNumber(duo.currentStreak)}d`, inline: true },
      { name: 'BEST STREAK', value: `${EMOJI.trophy} ${formatNumber(duo.bestStreak)}d`, inline: true },
      { name: 'EVENTS', value: `${formatNumber(total)}`, inline: true },
    ],
    footer: `${BRAND} • page ${page + 1}/${pageCount}`,
  });
}

function rewardLine(reward, duo) {
  if (reward.unlocked) {
    return `${reward.emoji || EMOJI.badge} **${reward.name}** — \`UNLOCKED\`${reward.grantedAt ? ` • ${relativeTimestamp(reward.grantedAt)}` : ''}`;
  }
  const remaining = Math.max(0, reward.days - duo.currentStreak);
  return `🔒 **${reward.name}** — ${reward.days} days · ${progressBar(duo.currentStreak, reward.days, 8)} \`${remaining}d left\``;
}

function rewardsEmbed({ duo, rewards, highest, nextMilestone, timezone }) {
  return buildEmbed({
    color: COLORS.ember,
    authorName: `${EMOJI.badge} 666 DUO REWARDS`,
    title: `Badge Collection • ${duo.name}`,
    description: [
      highest
        ? `**Highest badge:** ${highest.emoji || EMOJI.badge} **${highest.name}**`
        : '**Belum ada badge.** Selesaikan aktivitas Duo hari ini untuk memulai streak.',
      '',
      rewards.map((reward) => rewardLine(reward, duo)).join('\n'),
      '',
      divider(),
      nextMilestone
        ? `${progressBar(duo.currentStreak, nextMilestone.days)} **${duo.currentStreak}/${nextMilestone.days}** → **${nextMilestone.name}**`
        : `${EMOJI.trophy} Semua badge telah terbuka. Legenda!`,
    ].join('\n'),
    fields: [
      { name: 'CURRENT STREAK', value: `${EMOJI.fire} ${formatNumber(duo.currentStreak)} days`, inline: true },
      { name: 'DUO XP', value: `${EMOJI.gem} ${formatNumber(duo.xp)} XP`, inline: true },
      { name: 'TIMEZONE', value: timezone || 'Asia/Jakarta', inline: true },
    ],
    footer: `${BRAND} • rewards are granted automatically`,
  });
}

function invitationEmbed({ fromMember, toMember, duoName, expiresAt, timezone }) {
  return buildEmbed({
    color: COLORS.blood,
    authorName: `${EMOJI.duo} 666 DUO INVITATION`,
    title: 'Duo Connection Request',
    description: [
      `${mention(fromMember)} mengundang ${mention(toMember)} untuk menjadi **Duo Partner**.`,
      '',
      `**DUO NAME:** ${duoName}`,
      `**STATUS:** \`PENDING\``,
      `**EXPIRES:** ${relativeTimestamp(expiresAt)}`,
      '',
      divider(),
      `${EMOJI.fire} Kedua member harus menyelesaikan minimal satu aktivitas valid setiap hari.`,
      `⏰ Timezone: **${timezone || 'Asia/Jakarta'}**`,
    ].join('\n'),
    fields: [
      { name: 'INVITED BY', value: mention(fromMember), inline: true },
      { name: 'INVITED', value: mention(toMember), inline: true },
    ],
    footer: `${BRAND} • ONE STREAK. TWO MEMBERS.`,
    thumbnail: memberAvatar(toMember) || undefined,
  });
}

function breakConfirmEmbed({ duo }) {
  return buildEmbed({
    color: COLORS.error,
    authorName: `${EMOJI.skull} 666 DUO TERMINATION`,
    title: 'Konfirmasi mengakhiri Duo',
    description: [
      `Kamu akan mengakhiri Duo **${duo.name}** bersama ${mention(duo.members[1])} / ${mention(duo.members[0])}.`,
      '',
      codeblock(
        [
          `CURRENT STREAK : ${formatNumber(duo.currentStreak)} DAYS`,
          `BEST STREAK    : ${formatNumber(duo.bestStreak)} DAYS`,
          `TOTAL DAYS     : ${formatNumber(duo.totalDays)} DAYS`,
        ].join('\n'),
      ),
      '',
      `${EMOJI.chain} Streak akan berhenti dan badge tetap tersimpan di riwayat. Tindakan ini tidak bisa dibatalkan.`,
      '',
      'Tekan tombol **Konfirmasi** di bawah untuk melanjutkan.' ,
    ].join('\n'),
    footer: `${BRAND} • konfirmasi dalam 60 detik`,
  });
}

function breakResultEmbed({ duo, streakLost }) {
  return buildEmbed({
    color: COLORS.ash,
    authorName: `${EMOJI.chain} 666 DUO CONNECTION ENDED`,
    title: 'Duo telah diakhiri',
    description: [
      `Duo **${duo.name}** telah diputuskan.`,
      '',
      `**FINAL STREAK:** ${formatNumber(streakLost)} days`,
      `**BEST STREAK:** ${formatNumber(duo.bestStreak)} days`,
      `**TOTAL DAYS:** ${formatNumber(duo.totalDays)} days`,
      '',
      `${EMOJI.skull} Kalian bisa membangun Duo baru kapan saja dengan \`/duo invite\`.`,
    ].join('\n'),
    footer: `${BRAND} • until we meet again`,
  });
}

function streakCompletedNotification({ duo, streak, rewards = [], timezone }) {
  const rewardLine = rewards.length
    ? `\n${EMOJI.badge} **NEW BADGE:** ${rewards.map((reward) => reward.name).join(', ')}`
    : '';
  return buildEmbed({
    color: COLORS.flame,
    authorName: `${EMOJI.fire} 666 DUO NOTIFICATION`,
    title: `${EMOJI.fire} ${formatDays(streak)} streak!`,
    description: [
      `${mention(duo.members[0])} ${EMOJI.fire} ${mention(duo.members[1])}`,
      '',
      `Streak kalian **bertambah**! Kedua member telah menyelesaikan aktivitas hari ini.`,
      `**Current Streak:** ${formatNumber(streak)} Days`,
      rewardLine,
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'BEST STREAK', value: `${formatNumber(duo.bestStreak)} days`, inline: true },
      { name: 'TOTAL XP', value: `${formatNumber(duo.xp)} XP`, inline: true },
    ],
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
    thumbnail: memberAvatar(duo.members[0]) || undefined,
  });
}

function streakBrokenNotification({ duo, lostStreak, timezone, reason }) {
  return buildEmbed({
    color: COLORS.error,
    authorName: `${EMOJI.chain} 666 DUO NOTIFICATION`,
    title: `${EMOJI.chain} Streak terputus`,
    description: [
      `${mention(duo.members[0])} ${EMOJI.chain} ${mention(duo.members[1])}`,
      '',
      reason === 'partner_left'
        ? 'Salah satu member meninggalkan server.'
        : 'Salah satu member tidak menyelesaikan aktivitas harian sebelum pergantian hari.',
      '',
      `**Streak yang hilang:** ${formatNumber(lostStreak)} Days`,
      `**Best Streak:** ${formatNumber(duo.bestStreak)} Days`,
      '',
      `${EMOJI.bolt} Selesaikan aktivitas hari ini untuk memulai streak baru.`,
    ].join('\n'),
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
    thumbnail: memberAvatar(duo.members[0]) || undefined,
  });
}

function reminderNotification({ duo, timezone, missingMembers }) {
  return buildEmbed({
    color: COLORS.warning,
    authorName: `${EMOJI.fire} 666 DUO NOTIFICATION`,
    title: 'Streak kalian belum lengkap hari ini!',
    description: [
      `${mention(duo.members[0])} ${EMOJI.fire} ${mention(duo.members[1])}`,
      '',
      missingMembers?.length
        ? `Menunggu aktivitas dari ${missingMembers.map((member) => mention(member)).join(', ')}.`
        : 'Kedua member harus menyelesaikan aktivitas harian.',
      '',
      `**Current Streak:** ${formatNumber(duo.currentStreak)} Days`,
      '',
      'Kedua member harus menyelesaikan aktivitas harian untuk mempertahankan streak.',
    ].join('\n'),
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
    thumbnail: memberAvatar(duo.members[0]) || undefined,
  });
}

function rewardNotification({ duo, reward, timezone }) {
  return buildEmbed({
    color: COLORS.ember,
    authorName: `${EMOJI.badge} 666 DUO REWARD UNLOCKED`,
    title: `${reward.emoji || EMOJI.badge} ${reward.name}`,
    description: [
      `${mention(duo.members[0])} ${EMOJI.fire} ${mention(duo.members[1])}`,
      '',
      `Duo kalian mencapai **${formatNumber(reward.days)} days streak**.`,
      reward.description ? `\n> ${reward.description}` : '',
      '',
      `${EMOJI.fire} **Current Streak:** ${formatNumber(duo.currentStreak)} Days`,
    ].filter(Boolean).join('\n'),
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
    thumbnail: memberAvatar(duo.members[1]) || undefined,
  });
}

function partnerLeftNotification({ duo, leftMember, timezone }) {
  return buildEmbed({
    color: COLORS.ash,
    authorName: `${EMOJI.chain} 666 DUO CONNECTION`,
    title: 'Duo partner meninggalkan server',
    description: [
      `${mention(leftMember)} keluar dari server.`,
      '',
      `Duo **${duo.name}** telah diakhiri otomatis.`,
      `**Final Streak:** ${formatNumber(duo.currentStreak)} Days`,
      '',
      `Kamu bisa mencari partner baru dengan \`/duo invite\`.`,
    ].join('\n'),
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
  });
}

function configEmbed({ guildConfig, guildName }) {
  const channel = guildConfig.notificationChannelId ? `<#${guildConfig.notificationChannelId}>` : '*DM member (belum diatur)*';
  return buildEmbed({
    color: COLORS.blood,
    authorName: `${EMOJI.bolt} 666 SERVER CONFIGURATION`,
    title: `Pengaturan Duo • ${guildName || 'Server'}`,
    description: [
      'Pengaturan berikut memengaruhi sistem **666 DUO STREAK** di server ini.',
      '',
      divider(),
      '**TIMEZONE & HARI**',
      `Timezone: \`${guildConfig.timezone}\``,
      'Pergantian hari mengikuti timezone ini.',
      '',
      '**NOTIFIKASI**',
      `Notifikasi: ${guildConfig.notificationsEnabled ? '✅ aktif' : '❌ nonaktif'}`,
      `Reminder harian: ${guildConfig.remindersEnabled ? '✅ aktif' : '❌ nonaktif'} pukul \`${String(guildConfig.reminderHour).padStart(2, '0')}:${String(guildConfig.reminderMinute).padStart(2, '0')}\``,
      `Channel notifikasi: ${channel}`,
      '',
      '**666 DUO STREAK LOGS**',
      `Channel log otomatis: ${guildConfig.logChannelId ? `<#${guildConfig.logChannelId}>` : '*belum diatur — gunakan /duo setlog*'}`,
      'Log dikirim hanya saat streak benar-benar bertambah.',
      '',
      '**AKTIVITAS**',
      `Cooldown aktivitas: \`${guildConfig.activityCooldownSeconds}s\``,
      `Minimum panjang pesan: \`${guildConfig.minMessageLength}\` karakter`,
      `Duo XP per hari: \`${formatNumber(guildConfig.xpPerDay)} XP\``,
    ].join('\n'),
    footer: `${BRAND} • gunakan /duo config untuk mengubah`,
  });
}

function helpEmbed({ prefixCommands = [] } = {}) {
  return buildEmbed({
    color: COLORS.flame,
    authorName: `${EMOJI.fire} 666 BOT`,
    title: '🔥 666 DUO STREAK — PANDUAN',
    description: [
      '**TWO MEMBERS. ONE CONNECTION. ONE STREAK.**',
      '',
      divider(),
      '**CARA KERJA**',
      '1. Undang partner dengan `/duo invite @member`.',
      '2. Partner menerima dengan `/duo accept`.',
      '3. Setiap hari, **kedua member** harus mengirim minimal satu pesan valid.',
      '4. Jika keduanya aktif → streak **+1 hari**.',
      '5. Jika hanya satu aktif atau tidak ada aktivitas sampai pergantian hari → streak **terputus**.',
      '',
      divider(),
      '**COMMANDS**',
      '`/duo invite @member` — mengundang partner Duo',
      '`/duo accept` — menerima undangan',
      '`/duo decline` — menolak undangan',
      '`/duo profile [user]` — profil lengkap Duo',
      '`/duo streak` — status streak hari ini',
      '`/duo leaderboard [category]` — peringkat Duo',
      '`/duo rewards` — daftar badge & progres',
      '`/duo history` — riwayat aktivitas',
      '`/duo rename <nama>` — mengganti nama Duo',
      '`/duo break` — mengakhiri Duo (dengan konfirmasi)',
      '`/duo config` — pengaturan server (admin)',
      '`/duo setlog #channel` — channel untuk 666 DUO STREAK LOGS (admin)',
      '`/duo logstatus` — status sistem log otomatis (admin)',
      '`/duo help` — panduan ini',
      ...prefixCommands,
      '',
      divider(),
      '**VALID ACTIVITY**',
      '• Pesan tidak boleh spam, hanya emoji, link saja, atau terlalu pendek.',
      '• Ada cooldown aktivitas, jadi pesan berulang tidak menambah streak.',
      '• Hari dihitung menggunakan timezone server (default `Asia/Jakarta`).',
      '',
      `**REWARDS:** 7 → 14 → 30 → 50 → 100 → 365 days`,
    ].join('\n'),
    footer: `${BRAND} • ONE STREAK. TWO MEMBERS.`,
    thumbnail: 'https://cdn.discordapp.com/embed/avatars/0.png',
  });
}

function errorEmbed(message, title = 'Terjadi Kesalahan') {
  return buildEmbed({
    color: COLORS.error,
    authorName: `${EMOJI.cross} 666 SYSTEM`,
    title,
    description: message || 'Terjadi kesalahan yang tidak diketahui.',
    timestamp: false,
  });
}

function successEmbed(title, description) {
  return buildEmbed({
    color: COLORS.success,
    authorName: `${EMOJI.check} 666 SYSTEM`,
    title,
    description,
    timestamp: false,
  });
}

function infoEmbed(title, description) {
  return buildEmbed({
    color: COLORS.ember,
    authorName: `${EMOJI.fire} 666 SYSTEM`,
    title,
    description,
  });
}

function noDuoEmbed() {
  return buildEmbed({
    color: COLORS.ash,
    authorName: `${EMOJI.fire} 666 DUO STREAK`,
    title: 'Belum terhubung dengan Duo',
    description: [
      'Kamu belum memiliki Duo partner.',
      '',
      'Gunakan `/duo invite @member` untuk mengundang partner,',
      'lalu partner harus menerima dengan `/duo accept`.',
      '',
      'Butuh bantuan? Gunakan `/duo help`.',
    ].join('\n'),
    footer: BRAND,
  });
}

function pendingInviteEmbed({ fromMember, expiresAt }) {
  return buildEmbed({
    color: COLORS.warning,
    authorName: `${EMOJI.bolt} 666 DUO STREAK`,
    title: 'Undangan Duo menunggu konfirmasi',
    description: [
      `${mention(fromMember)} mengundangmu menjadi Duo partner.`,
      '',
      `Gunakan \`/duo accept\` untuk menerima atau \`/duo decline\` untuk menolak.`,
      `Berlaku sampai ${relativeTimestamp(expiresAt)}.`,
    ].join('\n'),
    footer: BRAND,
  });
}


/**
 * Compact companion embed for the rendered Duo profile card.
 * The image carries the visual identity; this preserves searchable text.
 */
function profileCardEmbed({ duo, members, today, timezone }) {
  const pair = Array.isArray(members) && members.length
    ? members
    : (duo?.members || []).map((member) => member);
  const [memberA, memberB] = pair;
  const bothActive = Boolean(today?.bothCompleted);

  return buildEmbed({
    color: bothActive ? COLORS.flame : COLORS.ember,
    authorName: `${EMOJI.fire} 666 DUO STREAK`,
    title: duo.name,
    description: [
      memberA && memberB
        ? `${mention(memberA)} ${EMOJI.chain} ${mention(memberB)}`
        : '',
      '',
      `## ${EMOJI.fire} ${formatDays(duo.currentStreak).toUpperCase()} STREAK`,
      `**${formatDays(duo.totalDays)} together**`,
      '',
      todayStatusLine(today, duo),
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'CURRENT STREAK', value: `🔥 **${formatDays(duo.currentStreak)}**`, inline: true },
      { name: 'BEST STREAK', value: `🏆 **${formatDays(duo.bestStreak)}**`, inline: true },
      { name: 'DUO XP', value: `💎 **${formatNumber(duo.xp)} XP**`, inline: true },
      { name: 'TOTAL DAYS', value: `📅 **${formatDays(duo.totalDays)}**`, inline: true },
      { name: 'ACTIVITY', value: bothActive ? '✅ **BOTH MEMBERS ACTIVE**' : '⏳ **IN PROGRESS**', inline: true },
      { name: 'TIMEZONE', value: String(timezone || 'Asia/Jakarta'), inline: true },
    ],
    footer: `${BRAND} • ${timezone || 'Asia/Jakarta'}`,
  });
}

/** Compact companion embed for the rendered leaderboard image. */
function leaderboardCardEmbed({ page, pageCount, total, categoryLabel, guildName }) {
  return buildEmbed({
    color: COLORS.blood,
    authorName: `${EMOJI.trophy} 666 DUO LEADERBOARD`,
    title: categoryLabel || 'Current Streak',
    description: [
      '**TWO MEMBERS. ONE CONNECTION. ONE STREAK.**',
      '',
      'Rank 1 gold • Rank 2 silver • Rank 3 bronze • everyone else fights in red.',
    ].join('\n'),
    fields: [
      { name: 'TOTAL DUO', value: `**${formatNumber(total)}**`, inline: true },
      { name: 'PAGE', value: `**${page + 1}/${pageCount}**`, inline: true },
      { name: 'SERVER', value: guildName ? `**${guildName}**` : '—', inline: true },
    ],
    footer: `${BRAND} • DUO STREAK LEADERBOARD`,
  });
}

/** Automatic streak log embed. The rendered banner is attached by the sender. */
function streakLogEmbed({ log, timezone }) {
  const members = Array.isArray(log.members) ? log.members : [];
  const memberA = members[0];
  const memberB = members[1];
  const previous = Number(log.previousStreak) || 0;
  const current = Number(log.currentStreak) || 0;
  const names = members.map((member) => `**${memberName(member)}**`).join(' & ');
  const activityLine = members.length
    ? members.map((member) => `${EMOJI.check} ${memberName(member)} completed`).join('   ')
    : `${EMOJI.check} Both members completed today`;

  const embed = buildEmbed({
    color: COLORS.flame,
    authorName: `${EMOJI.fire} 666 DUO STREAK LOGS`,
    title: `${EMOJI.fire} 666 DUO STREAK UPDATED`,
    description: [
      memberA && memberB ? `${mention(memberA)} ${EMOJI.chain} ${mention(memberB)}` : names,
      '',
      '## STREAK INCREASED!',
      `## ${EMOJI.fire} ${formatNumber(previous)} ${previous === 1 ? 'DAY' : 'DAYS'} → ${formatNumber(current)} DAYS`,
      '',
      activityLine,
    ].filter(Boolean).join('\n'),
    fields: [
      { name: 'CURRENT STREAK', value: `🔥 **${formatNumber(current)} DAYS**`, inline: true },
      { name: 'PREVIOUS STREAK', value: `⛓️ **${formatNumber(previous)} DAYS**`, inline: true },
      { name: 'BEST STREAK', value: `🏆 **${formatNumber(log.bestStreak)} DAYS**`, inline: true },
      { name: 'DUO XP', value: `💎 **${formatNumber(log.xp)} XP**`, inline: true },
      { name: 'TOTAL DAYS', value: `📅 **${formatNumber(log.totalDays)} DAYS**`, inline: true },
      { name: 'ACTIVITY STATUS', value: '✅ **BOTH MEMBERS ACTIVE**', inline: true },
    ],
    footer: `666 SYSTEM • AUTOMATIC LOGS • ${timezone || 'Asia/Jakarta'}`,
    timestamp: false,
  });

  const when = log.sentAt || log.createdAt;
  if (when) embed.setTimestamp(new Date(when));
  else embed.setTimestamp(new Date());
  return embed;
}

/** `/duo logstatus` overview of the automatic log queue. */
function logStatusEmbed({ guildConfig, counts, last, recent, channel, timezone }) {
  const statusLine = channel
    ? `Log channel: <#${channel.id}>`
    : 'Log channel belum diatur. Gunakan `/duo setlog #channel`.';

  const recentLines = (recent || []).map((entry) => {
    const icon = entry.status === 'sent'
      ? EMOJI.check
      : entry.status === 'failed'
        ? EMOJI.cross
        : entry.status === 'skipped'
          ? EMOJI.clock
          : EMOJI.fire;
    return `${icon} \`${entry.dayKey}\` • **${entry.duoName || 'Duo'}** • ${entry.previousStreak}→${entry.currentStreak} • \`${String(entry.status).toUpperCase()}\``;
  });

  return buildEmbed({
    color: COLORS.ember,
    authorName: `${EMOJI.chain} 666 DUO STREAK LOGS`,
    title: 'Log System Status',
    description: [
      statusLine,
      '',
      counts.failed > 0
        ? '⚠️ Ada log gagal. Sistem akan mencoba ulang otomatis dengan exponential backoff.'
        : 'Sistem log berjalan otomatis dan tahan restart.',
    ].join('\n'),
    fields: [
      { name: 'SENT', value: `✅ **${formatNumber(counts.sent)}**`, inline: true },
      { name: 'PENDING', value: `⏳ **${formatNumber(counts.pending)}**`, inline: true },
      { name: 'FAILED', value: `❌ **${formatNumber(counts.failed)}**`, inline: true },
      { name: 'SKIPPED', value: `⏭️ **${formatNumber(counts.skipped)}**`, inline: true },
      {
        name: 'LAST LOG',
        value: last
          ? `<t:${Math.floor(new Date(last.sentAt || last.createdAt).getTime() / 1000)}:R> • **${last.duoName || 'Duo'}** • ${last.previousStreak}→${last.currentStreak}`
          : 'Belum ada log terkirim.',
        inline: false,
      },
      {
        name: 'RECENT LOGS',
        value: recentLines.length ? recentLines.join('\n') : 'Belum ada log.',
        inline: false,
      },
    ],
    footer: `666 SYSTEM • AUTOMATIC LOGS • ${timezone || 'Asia/Jakarta'}`,
  });
}

function logChannelConfiguredEmbed({ channel, guildConfig }) {
  return buildEmbed({
    color: COLORS.success,
    authorName: `${EMOJI.chain} 666 DUO STREAK LOGS`,
    title: 'Log channel aktif',
    description: [
      `Setiap kenaikan streak akan otomatis diposting ke <#${channel.id}>.`,
      '',
      'Log hanya dikirim saat streak benar-benar bertambah.',
      'Tidak ada log untuk aktivitas satu member, dan tidak akan dobel per hari.',
      '',
      `Timezone server: \`${guildConfig?.timezone || 'Asia/Jakarta'}\``,
    ].join('\n'),
    footer: '666 SYSTEM • AUTOMATIC LOGS',
  });
}

module.exports = {
  buildEmbed,
  profileEmbed,
  profileCardEmbed,
  leaderboardCardEmbed,
  streakLogEmbed,
  logStatusEmbed,
  logChannelConfiguredEmbed,
  streakEmbed,
  leaderboardEmbed,
  historyEmbed,
  rewardsEmbed,
  invitationEmbed,
  breakConfirmEmbed,
  breakResultEmbed,
  streakCompletedNotification,
  streakBrokenNotification,
  reminderNotification,
  rewardNotification,
  partnerLeftNotification,
  helpEmbed,
  configEmbed,
  errorEmbed,
  successEmbed,
  infoEmbed,
  noDuoEmbed,
  pendingInviteEmbed,
  todayStatusLine,
};
