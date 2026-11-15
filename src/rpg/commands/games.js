'use strict';

const { UserError } = require('../../utils/errors');
const games = require('../services/minigameService');
const { blackjackButtons, triviaButtons, rpsButtons } = require('../ui/embeds');
const { interactive } = require('../ui/response');
const { coinflipView, slotsView, diceView, rouletteView, guessView, rpsView, blackjackView, triviaView, mineView } = require('../ui/responseViews');
const { helpEmbed, reply, resolveTarget } = require('./_helpers');
const { formatCoins } = require('../utils/formulas');

const HELP = {
  coinflip: ['`tcoinflip heads|tails <bet>` — lempar koin adil 50/50'],
  dice: ['`tdice <1-6> <bet>` — tebak dadu, bayaran tx'],
  slots: ['`tslots <bet>` — 3 reel, triple up to 200x'],
  roulette: ['`troulette <red|black|green|0-36> <bet>`'],
  blackjack: ['`tblackjack <bet>` — hit/stand melawan dealer'],
  guess: ['`tguess <1-10> <bet>` — tebak angka, bayaran 10x'],
  trivia: ['`ttrivia <bet>` — jawab pertanyaan via tombol'],
  rps: ['`trps <rock|paper|scissors> <bet>` — lawan bot', '`trps @user <choice> <bet>` — tantang pemain'],
  mine: ['`tmine [points]` — mines 3x3 dengan poin virtual (tanpa taruhan saldo)', 'Buka kotak aman, hindari 3 mine, lalu Cash Out untuk EXP.'],
};

function parsePoints(value) {
  const points = value === undefined ? 100 : Math.floor(Number(value));
  if (!Number.isFinite(points) || points <= 0 || points > 10000) throw new UserError('Points mines harus 1-10.000. Contoh: `tmine 3000`.');
  return points;
}

async function executeMines(ctx) {
  const points = parsePoints(ctx.args[0]);
  const result = await games.createMines(ctx.guildId, ctx.userId, points, ctx.message.channelId, ctx.message.id);
  return reply(ctx.message, mineView({
    sessionId: String(result.session._id),
    userId: ctx.userId,
    state: result.state,
  }));
}

function parseBet(value) {
  const bet = Math.floor(Number(value));
  if (!Number.isFinite(bet) || bet <= 0) throw new UserError('Bet harus angka positif. Contoh: `tcoinflip heads 100`.');
  return bet;
}

async function executeCoinflip(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.coinflip(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, coinflipView({ userId: ctx.userId, choice: ctx.args[0], ...result }));
}

async function executeDice(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.dice(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, diceView({ userId: ctx.userId, result }));
}

async function executeSlots(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.slots(ctx.guildId, ctx.userId, bet, ctx.message.id);
  return reply(ctx.message, slotsView({ userId: ctx.userId, result }));
}

async function executeRoulette(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.roulette(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, rouletteView({ userId: ctx.userId, choice: ctx.args[0], result }));
}

async function executeGuess(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.guess(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, guessView({ userId: ctx.userId, result }));
}

async function executeTrivia(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.createTrivia(ctx.guildId, ctx.userId, bet, ctx.message.channelId, ctx.message.id);
  return reply(ctx.message, triviaView({
    userId: ctx.userId,
    question: result.question.q,
    options: result.question.options,
    bet,
  }), [triviaButtons(String(result.session._id), result.question.options)]);
}

async function executeBlackjack(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.createBlackjack(ctx.guildId, ctx.userId, bet, ctx.message.channelId, ctx.message.id);
  const state = result.state;
  const view = blackjackView({
    userId: ctx.userId,
    playerValue: result.playerValue,
    dealerValue: result.finished ? result.dealerValue : 0,
    playerText: games.formatCards(state.player),
    dealerText: result.finished ? games.formatCards(state.dealer) : '🂠 🂠',
    finished: result.finished,
    payout: result.payout,
    bet,
    result: result.result,
  });
  if (result.finished) return reply(ctx.message, view);
  return reply(ctx.message, view, [blackjackButtons(String(result.session._id))]);
}

async function executeRps(ctx) {
  const target = await resolveTarget(ctx.message, ctx.args[0]);
  if (target) {
    const choice = ctx.args[1];
    const bet = parseBet(ctx.args[2]);
    const result = await games.rpsChallenge(ctx.guildId, ctx.userId, target.id, choice, bet, ctx.message.channelId, ctx.message.id);
    return reply(ctx.message, interactive([
      `✊✋✌️ <@${ctx.userId}> menantang <@${target.id}>!`,
      'Initiator memilih gerakan secara rahasia.',
      `Bet: **${formatCoins(result.value)}** per pemain.`,
      `<@${target.id}> pilih gerakan lewat tombol!`,
    ].join('\n')), [rpsButtons(String(result.session._id))]);
  }
  const bet = parseBet(ctx.args[1]);
  const result = await games.rps(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, rpsView({ userId: ctx.userId, result }));
}

const modules = {
  'tcoinflip': { execute: executeCoinflip, help: HELP.coinflip },
  'tdice': { execute: executeDice, help: HELP.dice },
  'tslots': { execute: executeSlots, help: HELP.slots },
  'troulette': { execute: executeRoulette, help: HELP.roulette },
  'tblackjack': { execute: executeBlackjack, help: HELP.blackjack },
  'tguess': { execute: executeGuess, help: HELP.guess },
  'ttrivia': { execute: executeTrivia, help: HELP.trivia },
  'trps': { execute: executeRps, help: HELP.rps },
  'tmine': { execute: executeMines, help: HELP.mine },
};

function make(name) {
  return {
    names: [name],
    async execute(ctx) {
      if ((ctx.args[0] || '').toLowerCase() === 'help') return reply(ctx.message, helpEmbed(`666 ${name.slice(1).toUpperCase()}`, modules[name].help));
      return modules[name].execute(ctx);
    },
    help: modules[name].help,
  };
}

module.exports = Object.keys(modules).map(make);
module.exports.help = HELP;
