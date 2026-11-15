'use strict';

const { getRarity } = require('../data/rarities');
const { formatCoins } = require('../utils/formulas');
const { mineButtons } = require('./embeds');
const {
  plain, richText, image, gameBoard, interactive, response, RESPONSE_TYPES,
  formatCountdown, nextDailyReset, nextWeeklyReset, nextMonthlyReset,
} = require('./response');

function displayName(user, fallbackId) {
  const name = user?.username || null;
  return name ? `**${name}**` : `<@${fallbackId}>`;
}

function amount(value, currency = '666 Coins') {
  return `**${formatCoins(value || 0)}** ${currency}`;
}

function resetFor(type, now = new Date()) {
  if (type === 'weekly') return nextWeeklyReset(now);
  if (type === 'monthly') return nextMonthlyReset(now);
  return nextDailyReset(now);
}

function rewardView({ type = 'Daily', reward = 0, bonus = 0, streak = 0, user = {}, userId, currency = '666 Coins', now = Date.now() }) {
  const label = String(type).toLowerCase();
  const lines = [
    `💰 | <@${userId}>, Here is your ${label} ${amount(reward, currency)}!`,
  ];
  if (label === 'daily' && streak > 0) lines.push(`🔥 | You're on a **${streak}** daily streak!`);
  if (bonus > 0) lines.push(`🎁 | Streak bonus: ${amount(bonus, currency)}`);
  lines.push(`⏱️ | Your next ${label} is in: **${formatCountdown(resetFor(label, new Date(now)) - now)}**`);
  if (user.wallet != null) lines.push(`👛 | Wallet: ${amount(user.wallet, currency)}`);
  return plain(lines.join('\n'));
}

function workView({ user = {}, reward = 0, userId, cooldownSec = 3600, currency = '666 Coins' }) {
  return plain([
    `💼 | <@${userId}> worked and earned ${amount(reward, currency)}.`,
    `👛 | Wallet: ${amount(user.wallet, currency)}`,
    `⏱️ | Next work in: **${formatCountdown(Math.max(0, cooldownSec * 1000))}**`,
  ].join('\n'));
}

function begView({ user = {}, reward = 0, userId, cooldownSec = 1800, currency = '666 Coins' }) {
  return plain([
    `🙏 | Someone gave <@${userId}> ${amount(reward, currency)}.`,
    `👛 | Wallet: ${amount(user.wallet, currency)}`,
    `⏱️ | Try again in: **${formatCountdown(Math.max(0, cooldownSec * 1000))}**`,
  ].join('\n'));
}

function balanceView({ user = {}, economy = {}, rank, position = 1, currency = '666 Coins' }) {
  const wealth = (user.wallet || 0) + (user.bank || 0);
  return richText([
    `💰 **666 ECONOMY** — ${displayName(user, user.userId)}`,
    `👛 Wallet: ${amount(user.wallet, currency)}`,
    `🏦 Bank: ${amount(user.bank, currency)}`,
    `💎 Total: ${amount(wealth, currency)}`,
    `⭐ Level: **${user.level || 1}** ${rank?.emoji || ''} ${rank?.name || ''}`,
    `🏅 Server rank: **#${position}**`,
    `🔥 Daily streak: **${user.dailyStreak || 0}** hari`,
    '',
    `-# ${economy.currencyName || currency} • gunakan tcash help untuk semua perintah.`,
  ].join('\n'));
}

function coinflipView({ userId, choice, result, won, payout, bet, edge = 0 }) {
  return gameBoard([
    `🪙 <@${userId}> selected **${String(choice || '').toUpperCase()}**.`,
    '',
    'The coin spins...',
    '',
    `🪙 **${String(result || '').toUpperCase()}!**`,
    won ? 'Congratulations! You won!' : 'Better luck next time.',
    '',
    `Bet: **${formatCoins(bet)}** • Payout: **${formatCoins(payout)}** • Edge ${edge}%`,
  ].join('\n'));
}

function slotsView({ userId, result }) {
  const reels = (result.reels || []).map((reel) => reel.emoji).join(' | ');
  const title = result.multiplier >= 50 ? '🎉 JACKPOT!' : result.won ? '✨ WIN!' : '💨 NO MATCH';
  return gameBoard([
    '🎰 ━━━ **666 SLOTS** ━━━',
    '',
    reels,
    '',
    title,
    `Multiplier: **${result.multiplier}x**`,
    `Bet: **${formatCoins(result.bet)}** • Payout: **${formatCoins(result.payout)}** • Edge ${result.edge}%`,
    `-# <@${userId}> • house edge transparan`,
  ].join('\n'));
}

function diceView({ userId, result }) {
  return gameBoard([
    `🎲 <@${userId}> rolled **${result.roll}** (target **${result.target}**).`,
    '',
    result.won ? '🎉 You won!' : '💨 Not this time.',
    `Bet: **${formatCoins(result.bet)}** • Payout: **${formatCoins(result.payout)}** • Edge ${result.edge}%`,
  ].join('\n'));
}

function rouletteView({ userId, choice, result }) {
  return gameBoard([
    `🎡 <@${userId}> bet on **${choice}**.`,
    `The wheel stops at **${result.roll} ${result.rollColor}**.`,
    '',
    result.won ? `🎉 You won **${result.multiplier}x**!` : '💨 Better luck next spin.',
    `Bet: **${formatCoins(result.bet)}** • Payout: **${formatCoins(result.payout)}** • Edge ${result.edge}%`,
  ].join('\n'));
}

function guessView({ userId, result }) {
  return gameBoard([
    `🔢 <@${userId}> guessed **${result.target}** — the number was **${result.roll}**.`,
    '',
    result.won ? '🎉 Correct!' : '💨 Wrong guess.',
    `Bet: **${formatCoins(result.bet)}** • Payout: **${formatCoins(result.payout)}** • Edge ${result.edge}%`,
  ].join('\n'));
}

function rpsView({ userId, result, opponent = 'Bot' }) {
  return gameBoard([
    `✊✋✌️ <@${userId}> vs **${opponent}**`,
    `You: **${result.mine}** • Opponent: **${result.theirs}**`,
    '',
    result.tie ? '🤝 Tie! Bet returned.' : result.won ? '🎉 You won!' : '💨 You lost.',
    `Payout: **${formatCoins(result.payout)}**`,
  ].join('\n'));
}

function blackjackView({ userId, playerValue = 0, dealerValue = 0, playerText = '', dealerText = '', finished = false, payout = 0, bet = 0, result = null }) {
  const title = finished
    ? result === 'win' || result === 'blackjack' ? '🏆 BLACKJACK WIN' : result === 'push' ? '🤝 PUSH' : '💀 BLACKJACK LOSE'
    : '🃏 **BLACKJACK**';
  return gameBoard([
    title,
    `👤 Kamu (${playerValue}) — ${playerText}`,
    `🎩 Dealer (${dealerValue}) — ${dealerText}`,
    '',
    finished ? `Payout: **${formatCoins(payout)}**` : `Bet: **${formatCoins(bet)}** • pilih Hit atau Stand.`,
    `-# <@${userId}> • sesi 3 menit`,
  ].join('\n'));
}

function triviaView({ userId, question, options, bet = 0, answer = null, correct = false, amount = 0, finished = false }) {
  const lines = [`🧠 **666 TRIVIA**`, '', `**${question}**`, ''];
  options.forEach((option, index) => lines.push(`**${index + 1}.** ${option}`));
  lines.push('');
  if (finished) {
    lines.push(correct ? '✅ **BENAR!**' : '❌ **SALAH**');
    if (answer != null) lines.push(`Jawaban: **${options[answer]}**`);
    lines.push(`Payout: **${formatCoins(amount)}**`);
  } else {
    lines.push(`Bet: **${formatCoins(bet)}** • jawab lewat tombol dalam 60 detik.`);
  }
  lines.push(`-# <@${userId}>`);
  return gameBoard(lines.join('\n'));
}

function mineView({ sessionId, userId, state = {}, ended = false, result = null }) {
  const revealed = state.revealed || [];
  const safeCount = revealed.length;
  const multiplier = 1 + safeCount * 0.25;
  const preview = Math.min(1000, Math.max(1, Math.round(((state.points || 0) * multiplier) / 10)));
  const lines = [
    '⛏️ **666 MINES**',
    `👤 <@${userId}> • Points: **${formatCoins(state.points || 0)}**`,
    `💣 Mines: **3** • 💎 Safe: **${safeCount}** • Multiplier: **${multiplier.toFixed(2)}x**`,
    '',
  ];
  if (result === 'hit') {
    lines.push('💥 **BOOM!** Kamu mengenai mine.', 'Tidak ada reward dari sesi ini.');
  } else if (result === 'cashout') {
    lines.push('💰 **CASH OUT!**', `Reward: **+${formatCoins(state.reward || preview)} EXP**`);
  } else {
    lines.push(safeCount ? `💰 Cash out sekarang: **+${formatCoins(preview)} EXP**` : 'Pilih kotak aman. Hindari 3 mine!', '-# Poin virtual • tanpa taruhan saldo.');
  }
  return gameBoard(lines.join('\n'), mineButtons(sessionId, state, ended));
}

function huntView(result, { userId, currency = '666 Coins' } = {}) {
  if (!result.spawned) return plain(`🌫️ | <@${userId}> ${result.message || 'tidak menemukan monster.'}`);
  const rarity = getRarity(result.monster.rarity);
  const name = `${result.shiny ? '✨ ' : ''}${result.monster.name}`;
  const lines = [
    `🌲 | <@${userId}> encountered a wild monster!`,
    '',
    `**${name}** appeared!`,
    `⭐ Rarity: **${rarity.label}**`,
    `❤️ HP: **${formatCoins(result.monster.hp)}** • ⚔️ Attack: **${formatCoins(result.monster.attack)}**`,
    `🛡️ Defense: **${formatCoins(result.monster.defense)}** • 💨 Speed: **${formatCoins(result.monster.speed)}**`,
    `🪙 Reward: ${amount(result.coins, currency)}`,
    result.itemDrop ? `🎒 Item drop: **${result.itemDrop}**` : null,
    result.levelsGained ? `⬆️ Hunt level naik **${result.levelsGained}** → **${result.level}**` : null,
    '',
    '-# Monster masuk kandangmu. Gunakan `thunt inventory` untuk melihatnya.',
  ].filter(Boolean);
  return image(lines.join('\n'), result.monster.image || null);
}

function battleResultView(result, { winnerName, loserName } = {}) {
  const a = result.snapshots?.a;
  const b = result.snapshots?.b;
  const hp = (current, max) => `${'█'.repeat(Math.round((current / Math.max(1, max)) * 10)).padEnd(10, '░')} ${formatCoins(current)}/${formatCoins(max)}`;
  const lines = [
    '⚔️ **BATTLE RESULT**',
    `${winnerName || `<@${result.winnerId}>`} **MENANG** melawan ${loserName || `<@${result.loserId}>`}`,
    a ? `🟥 ${a.username} ${hp(result.result?.aHp ?? 0, a.stats.hp)}` : null,
    b ? `🟦 ${b.username} ${hp(result.result?.bHp ?? 0, b.stats.hp)}` : null,
    '',
    ...(result.result?.log || []).slice(-8),
    '',
    `🪙 Reward: ${amount(result.reward || 0)} • ⭐ EXP: **${result.xpReward || 0}** • 📈 Rating: ±${result.ratingDelta || 0}`,
    result.antiFarm ? '🛡️ Anti win-trading: reward dikurangi karena matchup berulang.' : null,
  ].filter(Boolean);
  return response(RESPONSE_TYPES.GAME_BOARD, { content: lines.join('\n') });
}

function battleChallengeView(battle, { challengeId } = {}) {
  return interactive([
    `⚔️ <@${battle.challengerId}> menantang <@${battle.opponentId}>!`,
    `Challenger: **Lv.${battle.challengerSnapshot?.level || 1}** • Rating **${battle.challengerSnapshot?.rating || 1000}**`,
    `Opponent: **Lv.${battle.opponentSnapshot?.level || 1}** • Rating **${battle.opponentSnapshot?.rating || 1000}**`,
    `-# Terima lewat tombol atau \`tbattle accept ${challengeId || battle._id}\` • <t:${Math.floor(new Date(battle.expiresAt).getTime() / 1000)}:R>`,
  ].join('\n'));
}

function tradeStatusView(trade, { userA, userB }) {
  return richText([
    '🤝 **666 TRADE**',
    'Kedua pihak harus confirm. Item dikunci selama trade.',
    `📤 ${userA}: ${trade.offerA ? `${amount(trade.offerA.coins)} • ${trade.offerA.monsters?.length || 0} monster • ${trade.offerA.pets?.length || 0} pet` : '—'}`,
    `📥 ${userB}: ${trade.offerB ? `${amount(trade.offerB.coins)} • ${trade.offerB.monsters?.length || 0} monster • ${trade.offerB.pets?.length || 0} pet` : '—'}`,
    `Status: **${trade.status}** • confirm A: ${trade.confirmations?.initiator ? '✅' : '❌'} • B: ${trade.confirmations?.target ? '✅' : '❌'}`,
  ].join('\n'));
}

module.exports = {
  displayName,
  amount,
  rewardView,
  workView,
  begView,
  balanceView,
  coinflipView,
  slotsView,
  diceView,
  rouletteView,
  guessView,
  rpsView,
  blackjackView,
  triviaView,
  mineView,
  huntView,
  battleResultView,
  battleChallengeView,
  tradeStatusView,
};
