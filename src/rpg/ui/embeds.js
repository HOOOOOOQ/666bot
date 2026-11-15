'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, progressBar, percentage, formatNumber } = require('../../ui/theme');
const { getRarity } = require('../data/rarities');
const { formatCoins } = require('../utils/formulas');

const BRAND = '666 SYSTEM • ULTIMATE RPG';

function base(title, description, color = COLORS.flame) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || null)
    .setFooter({ text: BRAND })
    .setTimestamp();
}

function money(value) {
  return `${formatCoins(value)} 🪙`;
}

function cashEmbed({ user, economy, rank, position }) {
  const wealth = (user.wallet || 0) + (user.bank || 0);
  return base('💰 666 ECONOMY', `**${user.username || `<@${user.userId}>`}** — rank **#${position || 1}**`, COLORS.ember)
    .addFields(
      { name: '👛 Wallet', value: money(user.wallet), inline: true },
      { name: '🏦 Bank', value: money(user.bank), inline: true },
      { name: '💎 Total', value: money(wealth), inline: true },
      { name: '⭐ Level', value: `${user.level || 1} ${rank?.emoji || ''} ${rank?.name || ''}`, inline: true },
      { name: '🔥 Daily Streak', value: `${user.dailyStreak || 0} hari`, inline: true },
      { name: '🎯 Hunt Level', value: `${user.huntLevel || 1}`, inline: true },
    )
    .setDescription(`**${economy?.currencyName || '666 Coins'}** adalah mata uang resmi server ini.\nGunakan \`6cash help\` untuk semua perintah.`);
}

function dailyEmbed({ reward, streak, bonus, user, type = 'Daily' }) {
  return base(`🎁 ${type.toUpperCase()} REWARD`, `Kamu mendapat **${money(reward)}**${bonus ? ` (bonus streak +${money(bonus)})` : ''}.`, COLORS.success)
    .addFields(
      { name: '🔥 Streak', value: `${streak} hari`, inline: true },
      { name: '👛 Wallet', value: money(user.wallet), inline: true },
    );
}

function huntEmbed(result, economy) {
  if (!result.spawned) return base('🌫️ HUNTING', result.message, COLORS.ash);
  const rarity = getRarity(result.monster.rarity);
  const e = base(`${result.shiny ? '✨ SHINY ' : ''}${result.monster.name}`, `Kamu menemukan monster **${rarity.label}**!`, result.shiny ? COLORS.ember : rarity.color)
    .setImage(result.monster.image || null)
    .addFields(
      { name: '🩸 Rarity', value: `${rarity.emoji} ${rarity.label}`, inline: true },
      { name: '❤️ HP', value: `${result.monster.hp}`, inline: true },
      { name: '⚔️ ATK', value: `${result.monster.attack}`, inline: true },
      { name: '🛡️ DEF', value: `${result.monster.defense}`, inline: true },
      { name: '💨 SPD', value: `${result.monster.speed}`, inline: true },
      { name: '🪙 Reward', value: money(result.coins), inline: true },
    );
  if (result.itemDrop) e.addFields({ name: '🎒 Item Drop', value: result.itemDrop, inline: true });
  if (result.levelsGained) e.addFields({ name: '⬆️ Hunt Level', value: `Naik **${result.levelsGained}** level → **${result.level}**`, inline: false });
  e.setFooter({ text: `${BRAND} • simpan dengan 6hunt inventory` });
  return e;
}

function monsterListEmbed({ monsters, page, pages, total }, economy) {
  const lines = monsters.map((m) => {
    const rarity = getRarity(m.rarity);
    return `\`${String(m._id).slice(-6)}\` ${m.shiny ? '✨' : rarity.emoji} **${m.name}** • ${rarity.label} • HP ${m.hp} • jual ${money(m.sellValue)}`;
  });
  return base('🐾 KANDANG MONSTER', lines.length ? lines.join('\n') : 'Kandang kosong. Hunt dulu dengan `6hunt`.', COLORS.blood)
    .setFooter({ text: `${BRAND} • halaman ${page}/${pages} • total ${total}` });
}

function collectionEmbed(items, type = 'MONSTER') {
  const owned = items.filter((i) => i.owned);
  const lines = owned.slice(0, 20).map((i) => `${getRarity(i.rarity).emoji} **${i.name}** ×${i.count}${i.shinyCount ? ` (✨${i.shinyCount})` : ''}`);
  const pct = percentage(owned.length, items.length);
  return base(`📚 666 ${type} COLLECTION`, `${progressBar(owned.length, items.length)} **${owned.length}/${items.length}** (${pct}%)\n${lines.join('\n') || 'Belum ada koleksi.'}`, COLORS.flame);
}

function battleChallengeEmbed(battle) {
  return base('⚔️ BATTLE CHALLENGE', `<@${battle.challengerId}> menantang <@${battle.opponentId}>!\nTantangan berlaku sampai <t:${Math.floor(new Date(battle.expiresAt).getTime() / 1000)}:R>.`, COLORS.blood)
    .addFields(
      { name: 'Challenger', value: `Level ${battle.challengerSnapshot?.level || 1} • Rating ${battle.challengerSnapshot?.rating || 1000}`, inline: true },
      { name: 'Opponent', value: `Level ${battle.opponentSnapshot?.level || 1} • Rating ${battle.opponentSnapshot?.rating || 1000}`, inline: true },
    );
}

function battleResultEmbed(result) {
  const lines = (result.log || []).slice(-12).join('\n');
  const e = base('🏆 BATTLE RESULT', `<@${result.winnerId}> MENANG melawan <@${result.loserId}>!\n\n${lines}`, COLORS.ember)
    .addFields(
      { name: '🪙 Reward', value: money(result.reward), inline: true },
      { name: '⭐ EXP', value: `${result.xpReward || 0}`, inline: true },
      { name: '📈 Rating', value: `±${result.ratingDelta || 0}`, inline: true },
    );
  if (result.antiFarm) e.addFields({ name: '🛡️ Anti Win-Trading', value: 'Reward dikurangi karena matchup berulang dalam 24 jam.', inline: false });
  return e;
}

function petEmbed(pet, rarity) {
  return base(`${pet.evolved ? '🌟' : '🐾'} ${pet.name}`, `Pet **${rarity?.label || pet.rarity}** • Skill: **${pet.skill || '—'}**`, rarity?.color || COLORS.flame)
    .setImage(pet.image || null)
    .addFields(
      { name: '⭐ Level', value: `${pet.level}`, inline: true },
      { name: '❤️ HP', value: `${pet.hp}`, inline: true },
      { name: '⚔️ ATK', value: `${pet.attack}`, inline: true },
      { name: '🛡️ DEF', value: `${pet.defense}`, inline: true },
      { name: '💨 SPD', value: `${pet.speed}`, inline: true },
      { name: '✨ Evolved', value: pet.evolved ? 'Ya' : 'Belum', inline: true },
    );
}

function petListEmbed(pets) {
  const lines = pets.map((p) => `\`${String(p._id).slice(-6)}\` ${getRarity(p.rarity).emoji} **${p.name}** Lv.${p.level}${p.evolved ? ' 🌟' : ''}`);
  return base('🐾 PET INVENTORY', lines.join('\n') || 'Belum punya pet. Hatch dengan `6pet hatch`.', COLORS.ember);
}

function gameEmbed(title, result, color = COLORS.flame) {
  const e = base(title, result.message || null, color);
  if (result.fields) for (const field of result.fields) e.addFields(field);
  return e;
}

function questEmbed(quests) {
  const daily = quests.filter((q) => q.type === 'daily');
  const weekly = quests.filter((q) => q.type === 'weekly');
  const other = quests.filter((q) => !['daily', 'weekly'].includes(q.type) && !(q.hidden && !q.completed));
  const render = (list) => list.map((q) => `${q.claimed ? '✅' : q.completed ? '🎁' : q.emoji} **${q.title}** — ${progressBar(q.progress, q.target, 8)} ${q.progress}/${q.target}${q.claimed ? ' • claimed' : q.completed ? ' • siap claim' : ''}`).join('\n') || '—';
  return base('📜 666 QUEST', 'Selesaikan misi, klaim reward dengan `6quest claim <id>`.', COLORS.ember)
    .addFields(
      { name: '☀️ Daily', value: render(daily).slice(0, 1024), inline: false },
      { name: '📅 Weekly', value: render(weekly).slice(0, 1024), inline: false },
      { name: '🔥 Special / Hidden', value: render(other).slice(0, 1024), inline: false },
    );
}

function achievementEmbed(items) {
  const unlocked = items.filter((a) => a.unlocked);
  return base('🎖️ ACHIEVEMENTS', `${progressBar(unlocked.length, items.length)} **${unlocked.length}/${items.length}**`, COLORS.warning)
    .addFields({ name: 'Unlocked', value: items.map((a) => `${a.unlocked ? '✅' : '🔒'} ${a.emoji} **${a.name}** — ${a.description}`).join('\n').slice(0, 4000) || '—' });
}

function rankEmbed(rankData) {
  return base('🏅 666 RANK', `**${rankData.rank.emoji} ${rankData.rank.name}**`, COLORS.ember)
    .addFields(
      { name: '⭐ Level', value: `${rankData.user.level}`, inline: true },
      { name: '📊 Posisi Server', value: `#${rankData.position}`, inline: true },
      { name: '✨ EXP', value: `${rankData.progressLabel}\n${progressBar(rankData.user.xp, rankData.nextLevelXp, 12)}`, inline: false },
    );
}

function shopEmbed(items) {
  return base('🛒 666 SHOP', 'Beli dengan `6cash buy <id> [qty]`.', COLORS.flame)
    .addFields({ name: 'Item', value: items.map((i) => `${i.emoji} **${i.id}** — ${money(i.price)}\n${i.description}`).join('\n').slice(0, 4000) });
}

function marketEmbed({ listings, page, pages, total }) {
  const lines = listings.map((l) => `\`${String(l._id).slice(-6)}\` ${l.itemType === 'monster' ? '🐾' : l.itemType === 'pet' ? '🐕' : '📦'} **${l.itemSnapshot?.name || l.itemId}** ${l.itemSnapshot?.rarity ? `(${l.itemSnapshot.rarity})` : ''} — **${money(l.price)}** • <@${l.sellerId}>`);
  return base('🏪 666 MARKET', lines.join('\n') || 'Belum ada listing.', COLORS.ember)
    .setFooter({ text: `${BRAND} • halaman ${page}/${pages} • ${total} listing` });
}

function tradeEmbed(trade, userA, userB) {
  return base('🤝 666 TRADE', 'Kedua pihak harus confirm. Item dikunci selama trade.', COLORS.ember)
    .addFields(
      { name: `📤 ${userA}`, value: trade.offerA ? `${money(trade.offerA.coins)}\n${trade.offerA.monsters?.length || 0} monster • ${trade.offerA.pets?.length || 0} pet` : '—', inline: true },
      { name: `📥 ${userB}`, value: trade.offerB ? `${money(trade.offerB.coins)}\n${trade.offerB.monsters?.length || 0} monster • ${trade.offerB.pets?.length || 0} pet` : '—', inline: true },
      { name: 'Status', value: `${trade.status} • confirm A: ${trade.confirmations?.initiator ? '✅' : '❌'} • B: ${trade.confirmations?.target ? '✅' : '❌'}`, inline: false },
    );
}

function guildEmbed({ guild, member, members }) {
  const lines = (members || []).map((m, i) => `${i + 1}. <@${m.userId}> • ${m.role} • kontribusi ${formatNumber(m.contribution)}`);
  return base(`🛡️ GUILD • ${guild.name}`, `Level **${guild.level}** • ${progressBar(guild.xp, Math.max(1, guild.level * 300), 12)} XP\nLeader: <@${guild.leaderId}> • Anggota: ${guild.memberCount}/${guild.maxMembers}`, COLORS.flame)
    .addFields(
      { name: '🏦 Bank', value: money(guild.bank), inline: true },
      { name: '⚔️ War', value: `${guild.wins || 0}W / ${guild.losses || 0}L`, inline: true },
      { name: '👥 Members', value: lines.join('\n').slice(0, 1024) || '—', inline: false },
    )
    .setFooter({ text: `${BRAND} • role kamu: ${member?.role || 'member'}` });
}

function warEmbed({ war, challenger, defender }) {
  if (!war) return base('⚔️ GUILD WAR', 'Tidak ada war aktif. Leader bisa deklarasi dengan `6guild war challenge <guild>`.', COLORS.ash);
  return base('⚔️ GUILD WAR', `Status: **${war.status}** • Season ${war.season}`, COLORS.blood)
    .addFields(
      { name: challenger?.name || 'Challenger', value: `${war.challengerPoints} poin`, inline: true },
      { name: defender?.name || 'Defender', value: `${war.defenderPoints} poin`, inline: true },
      { name: '⏳ Berakhir', value: war.endsAt ? `<t:${Math.floor(new Date(war.endsAt).getTime() / 1000)}:R>` : '—', inline: false },
    );
}

function bossEmbed({ boss, contributors, totalDamage }) {
  if (!boss) return base('👹 WORLD BOSS', 'Belum ada boss aktif. Scheduler akan spawn otomatis.', COLORS.ash);
  const hpPct = percentage(boss.hp, boss.hpMax);
  const lines = (contributors || []).slice(0, 10).map((c, i) => `**#${i + 1}** <@${c.userId}> — ${formatCoins(c.damage)} damage`).join('\n');
  const e = base(`👹 ${boss.name}`, `${progressBar(boss.hp, boss.hpMax, 18)} **${formatCoins(boss.hp)} / ${formatCoins(boss.hpMax)} HP** (${hpPct}%)\nSerang dengan \`6boss attack\`.`, boss.status === 'defeated' ? COLORS.success : COLORS.blood)
    .addFields(
      { name: '⚔️ ATK / 🛡️ DEF', value: `${boss.attack} / ${boss.defense}`, inline: true },
      { name: '⏳ Ends', value: `<t:${Math.floor(new Date(boss.endsAt).getTime() / 1000)}:R>`, inline: true },
      { name: '📊 Total Damage', value: formatCoins(totalDamage || 0), inline: true },
      { name: '🏆 Damage Leaderboard', value: lines || 'Belum ada serangan.' },
    );
  if (boss.image) e.setThumbnail(boss.image);
  return e;
}

function profileEmbed(profile, avatarUrl) {
  const e = base(`👤 ${profile.user.username || '666 PLAYER'}`, `${progressBar(profile.xp, profile.nextXp, 12)} **Level ${profile.level}** • ${profile.rank.emoji} ${profile.rank.name}`, COLORS.flame)
    .setThumbnail(avatarUrl || profile.user.avatar || null)
    .addFields(
      { name: '💰 Wealth', value: `${money(profile.wallet)}\nBank ${money(profile.bank)}`, inline: true },
      { name: '🗡️ Hunt', value: `Lv.${profile.hunt.level} • ${formatNumber(profile.hunt.kills)} kills\n✨ ${profile.hunt.shiny} shiny`, inline: true },
      { name: '⚔️ Battle', value: `${profile.battle.wins}W/${profile.battle.losses}L • ${profile.battle.rating} ELO`, inline: true },
      { name: '🐾 Collection', value: `${profile.monsterCount} monster (${profile.uniqueMonsters} unik)\n${profile.petCount} pet (${profile.uniquePets} unik)`, inline: true },
      { name: '🎖️ Achievement', value: `${profile.achievements}/${profile.achievementTotal}`, inline: true },
      { name: '🛡️ Guild', value: profile.guild ? `**${profile.guild.name}** (${profile.guildMember.role})` : '—', inline: true },
      { name: '👹 Boss Damage', value: formatCoins(profile.bossContribution), inline: true },
      { name: '📈 Trading', value: `${profile.trading.trades} trade • ${profile.trading.market} market`, inline: true },
    );
  return e;
}

function leaderboardEmbed(title, docs, formatter) {
  const lines = docs.map((u, i) => `**#${i + 1}** <@${u.userId}> — ${formatter(u)}`).join('\n') || 'Belum ada data.';
  return base(title, lines, COLORS.ember);
}

function transactionHistoryEmbed(docs) {
  const lines = docs.map((t) => `\`${new Date(t.createdAt).toISOString().slice(5, 10)}\` ${t.type} • **${t.amount > 0 ? '+' : ''}${formatCoins(t.amount)}** ${t.status === 'completed' ? '✅' : '⏳'}`).join('\n');
  return base('📜 TRANSACTION HISTORY', lines || 'Belum ada transaksi.', COLORS.flame);
}

function btn(label, id, style = ButtonStyle.Secondary, emoji = null) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function battleButtons(battleId) {
  return new ActionRowBuilder().addComponents(
    btn('Accept', `rpg:battle:accept:${battleId}`, ButtonStyle.Success, '⚔️'),
    btn('Decline', `rpg:battle:decline:${battleId}`, ButtonStyle.Danger, '❌'),
  );
}

function tradeButtons(tradeId, includeAccept = true) {
  return new ActionRowBuilder().addComponents(
    ...(includeAccept ? [btn('Accept', `rpg:trade:accept:${tradeId}`, ButtonStyle.Success, '✅'), btn('Decline', `rpg:trade:decline:${tradeId}`, ButtonStyle.Danger, '❌')] : []),
    btn('Confirm', `rpg:trade:confirm:${tradeId}`, ButtonStyle.Primary, '🤝'),
    btn('Cancel', `rpg:trade:cancel:${tradeId}`, ButtonStyle.Danger, '✖️'),
  );
}

function blackjackButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    btn('Hit', `rpg:bj:hit:${sessionId}`, ButtonStyle.Primary, '🃏'),
    btn('Stand', `rpg:bj:stand:${sessionId}`, ButtonStyle.Secondary, '✋'),
  );
}

function triviaButtons(sessionId, options) {
  return new ActionRowBuilder().addComponents(options.map((option, index) => btn(`${index + 1}`, `rpg:trivia:${sessionId}:${index}`, ButtonStyle.Secondary)));
}

function rpsButtons(sessionId) {
  return new ActionRowBuilder().addComponents(
    btn('Rock', `rpg:rps:${sessionId}:rock`, ButtonStyle.Primary, '✊'),
    btn('Paper', `rpg:rps:${sessionId}:paper`, ButtonStyle.Primary, '✋'),
    btn('Scissors', `rpg:rps:${sessionId}:scissors`, ButtonStyle.Primary, '✌️'),
  );
}

module.exports = {
  BRAND, base, money,
  cashEmbed, dailyEmbed, huntEmbed, monsterListEmbed, collectionEmbed,
  battleChallengeEmbed, battleResultEmbed, petEmbed, petListEmbed, gameEmbed,
  questEmbed, achievementEmbed, rankEmbed, shopEmbed, marketEmbed, tradeEmbed,
  guildEmbed, warEmbed, bossEmbed, profileEmbed, leaderboardEmbed, transactionHistoryEmbed,
  battleButtons, tradeButtons, blackjackButtons, triviaButtons, rpsButtons,
};
