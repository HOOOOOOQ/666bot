'use strict';

const models = require('../../database/models');
const { UserError } = require('../../utils/errors');
const settingsService = require('./settingsService');
const cooldownService = require('./cooldownService');
const userService = require('./userService');
const questService = require('./questService');
const { formatCoins, applyTax } = require('../utils/formulas');
const { randomInt, chance, pick, shuffle } = require('../utils/rng');
const { createLogger } = require('../../utils/logger');

const log = createLogger('rpg-games');

const SLOT_SYMBOLS = [
  { id: 'cherry', emoji: '🍒', weight: 34, triple: 3 },
  { id: 'lemon', emoji: '🍋', weight: 26, triple: 5 },
  { id: 'fire', emoji: '🔥', weight: 20, triple: 10 },
  { id: 'skull', emoji: '💀', weight: 12, triple: 20 },
  { id: 'crown', emoji: '👑', weight: 7, triple: 50 },
  { id: '666', emoji: '☠️', weight: 1, triple: 200 },
];

const TRIVIA = [
  { q: 'Berapa jumlah legiun 666?', options: ['6', '66', '666', '6666'], answer: 2 },
  { q: 'Ibukota Indonesia sekarang?', options: ['Jakarta', 'Nusantara', 'Bandung', 'Surabaya'], answer: 1 },
  { q: 'Berapa 6 × 6 × 6?', options: ['36', '216', '666', '1296'], answer: 1 },
  { q: 'Planet terdekat dari Matahari?', options: ['Venus', 'Merkurius', 'Mars', 'Bumi'], answer: 1 },
  { q: 'Siapa presiden pertama Indonesia?', options: ['Soeharto', 'Soekarno', 'Habibie', 'Megawati'], answer: 1 },
  { q: 'Berapa sisi dadu standar?', options: ['4', '6', '8', '12'], answer: 1 },
  { q: 'Warna darah segar?', options: ['Biru', 'Merah', 'Hijau', 'Hitam'], answer: 1 },
  { q: '666 dalam biner?', options: ['1010011010', '1010011011', '1001100110', '1100110011'], answer: 0 },
  { q: 'Berapa hasil 6! ?', options: ['36', '360', '720', '666'], answer: 2 },
  { q: 'Laut terluas di dunia?', options: ['Atlantik', 'Pasifik', 'Hindia', 'Arktik'], answer: 1 },
];

function payout(bet, multiplier, edgePct) {
  const edge = Math.max(0, Math.min(25, Number(edgePct) || 0));
  return Math.max(0, Math.floor(bet * multiplier * (1 - edge / 100)));
}

async function assertGame(guildId, bet) {
  const game = await settingsService.getGame(guildId);
  if (!game.minigames.enabled) throw new UserError('Mini games sedang dinonaktifkan admin.');
  const value = Math.floor(Number(bet));
  if (!Number.isInteger(value) || value <= 0) throw new UserError('Bet harus angka bulat positif.');
  if (value < game.minigames.minBet) throw new UserError(`Bet minimal ${formatCoins(game.minigames.minBet)}.`);
  if (value > game.minigames.maxBet) throw new UserError(`Bet maksimal ${formatCoins(game.minigames.maxBet)}.`);
  return { game, bet: value };
}

async function claimGameCooldown(guildId, userId, game) {
  const cfg = await settingsService.getGame(guildId);
  const cd = await cooldownService.claim(guildId, userId, `game_${game}`, cfg.minigames.cooldownSec * 1000);
  if (!cd.ok) throw new UserError(`Cooldown game <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);
}

async function record(guildId, userId, game, bet, won, payoutAmount, details, key) {
  try {
    await models.GameHistory.create({
      guildId, userId, game, bet, won, payout: payoutAmount, details, idempotencyKey: key,
    });
  } catch (error) {
    if (error.code !== 11000) log.warn(`Game history failed: ${error.message}`);
  }
  await models.RPGUser.updateOne(
    { guildId, userId },
    { $inc: won ? { gameWins: 1 } : { gameLosses: 1 } },
  ).catch(() => {});
  await questService.track(guildId, userId, 'gamePlay', 1).catch(() => {});
  if (won) await questService.track(guildId, userId, 'gameWin', 1).catch(() => {});
}

async function stake(guildId, userId, bet, game, key) {
  return userService.spendCoins(guildId, userId, bet, `bet_${game}`, `${key}:stake`, { game });
}

async function settleWin(guildId, userId, amount, game, key, details) {
  if (amount <= 0) return null;
  return userService.addCoins(guildId, userId, amount, `win_${game}`, `${key}:payout`, { game, ...details });
}

async function coinflip(guildId, userId, choice, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  const side = String(choice || '').toLowerCase();
  if (!['heads', 'tails', 'head', 'tail'].includes(side)) throw new UserError('Pilih `heads` atau `tails`.');
  await claimGameCooldown(guildId, userId, 'coinflip');
  const key = `game:coinflip:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'coinflip', key);
  const result = chance(50) ? 'heads' : 'tails';
  const won = result === (side.startsWith('head') ? 'heads' : 'tails');
  const amount = won ? payout(value, 2, game.minigames.houseEdgePct) : 0;
  if (won) await settleWin(guildId, userId, amount, 'coinflip', key, { result });
  await record(guildId, userId, 'coinflip', value, won, amount, { choice: side, result }, key);
  return { result, won, payout: amount, bet: value, edge: game.minigames.houseEdgePct };
}

async function dice(guildId, userId, choice, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  const target = Math.floor(Number(choice));
  if (target < 1 || target > 6) throw new UserError('Pilih angka dadu 1-6.');
  await claimGameCooldown(guildId, userId, 'dice');
  const key = `game:dice:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'dice', key);
  const roll = randomInt(1, 6);
  const won = roll === target;
  const amount = won ? payout(value, 6, game.minigames.houseEdgePct) : 0;
  if (won) await settleWin(guildId, userId, amount, 'dice', key, { roll });
  await record(guildId, userId, 'dice', value, won, amount, { target, roll }, key);
  return { roll, target, won, payout: amount, bet: value, edge: game.minigames.houseEdgePct };
}

async function slots(guildId, userId, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  await claimGameCooldown(guildId, userId, 'slots');
  const key = `game:slots:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'slots', key);
  const reels = [0, 1, 2].map(() => pick(SLOT_SYMBOLS));
  let multiplier = 0;
  if (reels[0].id === reels[1].id && reels[1].id === reels[2].id) multiplier = reels[0].triple;
  else if (reels[0].id === reels[1].id || reels[1].id === reels[2].id || reels[0].id === reels[2].id) multiplier = 1.5;
  const won = multiplier > 0;
  const amount = won ? payout(value, multiplier, game.minigames.houseEdgePct) : 0;
  if (won) await settleWin(guildId, userId, amount, 'slots', key, { reels: reels.map((r) => r.id) });
  await record(guildId, userId, 'slots', value, won, amount, { reels: reels.map((r) => r.emoji), multiplier }, key);
  return { reels, multiplier, won, payout: amount, bet: value, edge: game.minigames.houseEdgePct };
}

async function roulette(guildId, userId, choice, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  const raw = String(choice || '').toLowerCase();
  const color = ['red', 'black', 'green'].includes(raw) ? raw : null;
  const number = Number.isInteger(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 36 ? Number(raw) : null;
  if (!color && number === null) throw new UserError('Pilih `red`, `black`, `green`, atau angka 0-36.');
  await claimGameCooldown(guildId, userId, 'roulette');
  const key = `game:roulette:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'roulette', key);
  const roll = randomInt(0, 36);
  const rollColor = roll === 0 ? 'green' : (roll % 2 === 0 ? 'black' : 'red');
  let multiplier = 0;
  if (number !== null && number === roll) multiplier = 36;
  else if (color && color === rollColor) multiplier = color === 'green' ? 14 : 2;
  const won = multiplier > 0;
  const amount = won ? payout(value, multiplier, game.minigames.houseEdgePct) : 0;
  if (won) await settleWin(guildId, userId, amount, 'roulette', key, { roll, rollColor });
  await record(guildId, userId, 'roulette', value, won, amount, { choice: raw, roll, rollColor, multiplier }, key);
  return { roll, rollColor, won, multiplier, payout: amount, bet: value, edge: game.minigames.houseEdgePct };
}

async function guess(guildId, userId, choice, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  const target = Math.floor(Number(choice));
  if (target < 1 || target > 10) throw new UserError('Tebak angka 1-10.');
  await claimGameCooldown(guildId, userId, 'guess');
  const key = `game:guess:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'guess', key);
  const roll = randomInt(1, 10);
  const won = roll === target;
  const amount = won ? payout(value, 10, game.minigames.houseEdgePct) : 0;
  if (won) await settleWin(guildId, userId, amount, 'guess', key, { roll });
  await record(guildId, userId, 'guess', value, won, amount, { target, roll }, key);
  return { roll, target, won, payout: amount, bet: value, edge: game.minigames.houseEdgePct };
}

async function createTrivia(guildId, userId, bet, channelId, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  await claimGameCooldown(guildId, userId, 'trivia');
  const key = `game:trivia:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'trivia', key);
  const question = pick(TRIVIA);
  let session;
  try {
    session = await models.GameSession.create({
      guildId, channelId: channelId || null, userId, game: 'trivia', bet: value,
      status: 'active',
      state: { question: question.q, options: question.options, answer: question.answer },
      idempotencyKey: key,
      expiresAt: new Date(Date.now() + 60000),
    });
  } catch (error) {
    await userService.addCoins(guildId, userId, value, 'game_refund', `${key}:refund`, { game: 'trivia' }).catch(() => {});
    throw error;
  }
  return { session, question };
}

async function answerTrivia(guildId, userId, sessionId, optionIndex) {
  const session = await models.GameSession.findOne({ _id: sessionId, guildId, userId, game: 'trivia' }).lean();
  if (!session) throw new UserError('Trivia tidak ditemukan.');
  if (session.status !== 'active') throw new UserError('Trivia ini sudah selesai.');
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await models.GameSession.updateOne({ _id: sessionId }, { $set: { status: 'expired' } });
    throw new UserError('Trivia sudah kedaluwarsa.');
  }
  const completed = await models.GameSession.findOneAndUpdate(
    { _id: sessionId, status: 'active' },
    { $set: { status: 'completed' } },
    { new: true },
  );
  if (!completed) throw new UserError('Trivia sudah dijawab.');
  const correct = Number(optionIndex) === Number(session.state.answer);
  const game = await settingsService.getGame(guildId);
  const amount = correct ? payout(session.bet, 2, game.minigames.houseEdgePct) : 0;
  if (correct) await settleWin(guildId, userId, amount, 'trivia', session.idempotencyKey, { sessionId: String(session._id) });
  await models.GameSession.updateOne({ _id: sessionId }, { $set: { winnerId: correct ? userId : null, payout: amount } });
  await record(guildId, userId, 'trivia', session.bet, correct, amount, { answer: session.state.answer, picked: optionIndex }, `${session.idempotencyKey}:result`);
  return { correct, amount, answer: session.state.answer, options: session.state.options, question: session.state.question };
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 'A') { total += 11; aces += 1; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

function newDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return shuffle(suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })))); 
}

function formatCards(cards, hideHole = false) {
  return cards.map((card, index) => (hideHole && index === 1 ? '🂠' : `${card.rank}${card.suit}`)).join(' ');
}

async function createBlackjack(guildId, userId, bet, channelId, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  await claimGameCooldown(guildId, userId, 'blackjack');
  const key = `game:blackjack:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'blackjack', key);
  const deck = newDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const state = { deck, player, dealer };
  let session;
  try {
    session = await models.GameSession.create({
      guildId, channelId: channelId || null, userId, game: 'blackjack', bet: value,
      status: 'active', state, idempotencyKey: key,
      expiresAt: new Date(Date.now() + 180000),
    });
  } catch (error) {
    await userService.addCoins(guildId, userId, value, 'game_refund', `${key}:refund`, { game: 'blackjack' }).catch(() => {});
    throw error;
  }
  if (handValue(player) === 21) {
    const amount = payout(value, 2.5, game.minigames.houseEdgePct);
    await models.GameSession.updateOne({ _id: session._id }, { $set: { status: 'completed', payout: amount, winnerId: userId } });
    await settleWin(guildId, userId, amount, 'blackjack', key, { natural: true });
    await record(guildId, userId, 'blackjack', value, true, amount, { natural: true }, `${key}:result`);
    return { session, state, finished: true, result: 'blackjack', payout: amount, playerValue: 21, dealerValue: handValue(dealer) };
  }
  return { session, state, finished: false, playerValue: handValue(player), dealerValue: handValue(dealer) };
}

async function blackjackAction(guildId, userId, sessionId, action) {
  const session = await models.GameSession.findOne({ _id: sessionId, guildId, userId, game: 'blackjack' }).lean();
  if (!session) throw new UserError('Sesi blackjack tidak ditemukan.');
  if (session.status !== 'active') throw new UserError('Sesi blackjack sudah selesai.');
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await models.GameSession.updateOne({ _id: sessionId }, { $set: { status: 'expired' } });
    throw new UserError('Sesi blackjack kedaluwarsa.');
  }
  const state = session.state;
  const game = await settingsService.getGame(guildId);
  if (action === 'hit') {
    const card = state.deck.pop();
    state.player.push(card);
    const playerValue = handValue(state.player);
    if (playerValue > 21) {
      const completed = await models.GameSession.findOneAndUpdate({ _id: sessionId, status: 'active' }, { $set: { status: 'completed', state } }, { new: true });
      if (!completed) throw new UserError('Sesi sudah diproses.');
      await record(guildId, userId, 'blackjack', session.bet, false, 0, { bust: true, playerValue }, `${session.idempotencyKey}:result`);
      return { finished: true, result: 'bust', playerValue, dealerValue: handValue(state.dealer), player: state.player, dealer: state.dealer, payout: 0 };
    }
    await models.GameSession.updateOne({ _id: sessionId, status: 'active' }, { $set: { state } });
    return { finished: false, playerValue, dealerValue: handValue(state.dealer), player: state.player, dealer: state.dealer, drawn: card };
  }
  if (action !== 'stand') throw new UserError('Aksi harus `hit` atau `stand`.');
  while (handValue(state.dealer) < 17) state.dealer.push(state.deck.pop());
  const playerValue = handValue(state.player);
  const dealerValue = handValue(state.dealer);
  const won = playerValue > dealerValue || dealerValue > 21;
  const tie = playerValue === dealerValue;
  const amount = tie ? session.bet : won ? payout(session.bet, 2, game.minigames.houseEdgePct) : 0;
  const completed = await models.GameSession.findOneAndUpdate(
    { _id: sessionId, status: 'active' },
    { $set: { status: 'completed', state, winnerId: won ? userId : null, payout: amount } },
    { new: true },
  );
  if (!completed) throw new UserError('Sesi sudah diproses.');
  if (amount > 0) await settleWin(guildId, userId, amount, 'blackjack', session.idempotencyKey, { tie });
  await record(guildId, userId, 'blackjack', session.bet, won, amount, { playerValue, dealerValue, tie }, `${session.idempotencyKey}:result`);
  return { finished: true, result: tie ? 'push' : won ? 'win' : 'lose', playerValue, dealerValue, player: state.player, dealer: state.dealer, payout: amount };
}

async function rps(guildId, userId, choice, bet, requestId) {
  const { game, bet: value } = await assertGame(guildId, bet);
  const pickChoice = String(choice || '').toLowerCase();
  const moves = { rock: 'rock', paper: 'paper', scissors: 'scissors', batu: 'rock', kertas: 'paper', gunting: 'scissors' };
  const mine = moves[pickChoice];
  if (!mine) throw new UserError('Pilih `rock`, `paper`, atau `scissors`.');
  await claimGameCooldown(guildId, userId, 'rps');
  const key = `game:rps:${guildId}:${userId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'rps', key);
  const theirs = pick(['rock', 'paper', 'scissors']);
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const won = mine !== theirs && beats[mine] === theirs;
  const tie = mine === theirs;
  const amount = tie ? value : won ? payout(value, 2, game.minigames.houseEdgePct) : 0;
  if (amount > 0) await settleWin(guildId, userId, amount, 'rps', key, { tie });
  await record(guildId, userId, 'rps', value, won, amount, { mine, theirs, tie }, key);
  return { mine, theirs, won, tie, payout: amount, bet: value };
}

async function rpsChallenge(guildId, userId, opponentId, choice, bet, channelId, requestId) {
  if (String(userId) === String(opponentId)) throw new UserError('Tidak bisa menantang diri sendiri.');
  const { game, bet: value } = await assertGame(guildId, bet);
  if (!game.minigames.allowMultiplayer) throw new UserError('Mini game multiplayer sedang dinonaktifkan admin.');
  const mine = String(choice || '').toLowerCase();
  if (!['rock', 'paper', 'scissors'].includes(mine)) throw new UserError('Pilih rock/paper/scissors.');
  await userService.ensureUser(guildId, opponentId);
  const key = `rps:${guildId}:${userId}:${opponentId}:${requestId || Date.now()}`;
  await stake(guildId, userId, value, 'rps', key);
  let session;
  try {
    session = await models.GameSession.create({
      guildId, channelId: channelId || null, userId, opponentId, game: 'rps_pvp', bet: value,
      status: 'pending', state: { moves: {} }, choices: { [userId]: mine },
      idempotencyKey: key, expiresAt: new Date(Date.now() + 120000),
    });
  } catch (error) {
    await userService.addCoins(guildId, userId, value, 'game_refund', `${key}:refund`, { game: 'rps' }).catch(() => {});
    throw error;
  }
  return { session, value, choice: mine };
}

async function rpsChoose(guildId, userId, sessionId, choice) {
  const mine = String(choice || '').toLowerCase();
  if (!['rock', 'paper', 'scissors'].includes(mine)) throw new UserError('Pilih rock/paper/scissors.');
  const session = await models.GameSession.findOne({ _id: sessionId, guildId, game: 'rps_pvp' }).lean();
  if (!session) throw new UserError('Sesi RPS tidak ditemukan.');
  if (![session.userId, session.opponentId].includes(userId)) throw new UserError('Kamu bukan bagian dari sesi ini.');
  if (session.status === 'completed') throw new UserError('Sesi RPS sudah selesai.');
  if (session.choices?.[userId]) throw new UserError('Kamu sudah memilih.');
  if (session.status === 'pending' && userId === session.opponentId) {
    await userService.spendCoins(guildId, userId, session.bet, 'bet_rps', `${session.idempotencyKey}:opponent:stake`, { game: 'rps' });
  }
  const choices = { ...(session.choices || {}), [userId]: mine };
  const both = Object.keys(choices).length >= 2;
  if (!both) {
    await models.GameSession.updateOne({ _id: sessionId }, { $set: { status: 'active', choices } });
    return { waiting: true, choices };
  }
  const [a, b] = [choices[session.userId], choices[session.opponentId]];
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const winner = a === b ? null : beats[a] === b ? session.userId : session.opponentId;
  const game = await settingsService.getGame(guildId);
  const pot = Math.floor(session.bet * 2 * (1 - game.minigames.houseEdgePct / 100));
  const completed = await models.GameSession.findOneAndUpdate(
    { _id: sessionId, status: { $in: ['pending', 'active'] } },
    { $set: { status: 'completed', choices, winnerId: winner, payout: winner ? pot : session.bet } },
    { new: true },
  );
  if (!completed) throw new UserError('Sesi sudah diproses.');
  if (winner) await userService.addCoins(guildId, winner, pot, 'win_rps', `${session.idempotencyKey}:pot`, { game: 'rps' });
  else {
    await userService.addCoins(guildId, session.userId, session.bet, 'refund_rps', `${session.idempotencyKey}:refund:a`, { game: 'rps' }).catch(() => {});
    await userService.addCoins(guildId, session.opponentId, session.bet, 'refund_rps', `${session.idempotencyKey}:refund:b`, { game: 'rps' }).catch(() => {});
  }
  await record(guildId, session.userId, 'rps_pvp', session.bet, winner === session.userId, winner === session.userId ? pot : 0, { a, b, winner }, `${session.idempotencyKey}:result:a`).catch(() => {});
  await record(guildId, session.opponentId, 'rps_pvp', session.bet, winner === session.opponentId, winner === session.opponentId ? pot : 0, { a, b, winner }, `${session.idempotencyKey}:result:b`).catch(() => {});
  return { waiting: false, winner, choices, pot, mine };
}

module.exports = {
  SLOT_SYMBOLS,
  TRIVIA,
  assertGame,
  coinflip,
  dice,
  slots,
  roulette,
  guess,
  createTrivia,
  answerTrivia,
  createBlackjack,
  blackjackAction,
  handValue,
  formatCards,
  rps,
  rpsChallenge,
  rpsChoose,
  payout,
};
