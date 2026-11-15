'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { UserError } = require('../../utils/errors');
const games = require('../services/minigameService');
const { BRAND, money, blackjackButtons, triviaButtons, rpsButtons } = require('../ui/embeds');
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
};

function resultEmbed(title, result, description) {
  const e = new EmbedBuilder()
    .setColor(result.won || result.correct || result.result === 'win' ? COLORS.success : result.tie || result.result === 'push' ? COLORS.warning : COLORS.error)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `${BRAND} • house edge transparan` });
  return e;
}

function parseBet(value) {
  const bet = Math.floor(Number(value));
  if (!Number.isFinite(bet) || bet <= 0) throw new UserError('Bet harus angka positif. Contoh: `tcoinflip heads 100`.');
  return bet;
}

async function executeCoinflip(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.coinflip(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('🪙 COINFLIP', result,
    `Pilihan: **${ctx.args[0].toLowerCase()}** • Hasil: **${result.result.toUpperCase()}**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}**\nHouse edge: ${result.edge}%`)
    .addFields({ name: 'Hasil', value: result.won ? '✅ MENANG' : '❌ KALAH', inline: true }));
}

async function executeDice(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.dice(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('🎲 DICE', result,
    `Tebakan: **${result.target}** • Dadu: **${result.roll}**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}** • Edge ${result.edge}%`));
}

async function executeSlots(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.slots(ctx.guildId, ctx.userId, bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('🎰 SLOTS', result,
    `## ${result.reels.map((r) => r.emoji).join(' | ')}\nMultiplier: **${result.multiplier}x**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}** • Edge ${result.edge}%`));
}

async function executeRoulette(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.roulette(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('🎡 ROULETTE', result,
    `Pilihan: **${ctx.args[0]}** • Bola: **${result.roll} ${result.rollColor}**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}** • Edge ${result.edge}%`));
}

async function executeGuess(ctx) {
  const bet = parseBet(ctx.args[1]);
  const result = await games.guess(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('🔢 GUESS', result,
    `Tebakan: **${result.target}** • Angka: **${result.roll}**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}** • Edge ${result.edge}%`));
}

async function executeTrivia(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.createTrivia(ctx.guildId, ctx.userId, bet, ctx.message.channelId, ctx.message.id);
  const embed = new EmbedBuilder()
    .setColor(COLORS.ember)
    .setTitle('🧠 666 TRIVIA')
    .setDescription(`**${result.question.q}**\n\n${result.question.options.map((o, i) => `**${i + 1}.** ${o}`).join('\n')}\n\nBet: ${money(bet)} • jawab via tombol dalam 60 detik.`)
    .setFooter({ text: BRAND });
  return reply(ctx.message, embed, [triviaButtons(String(result.session._id), result.question.options)]);
}

async function executeBlackjack(ctx) {
  const bet = parseBet(ctx.args[0]);
  const result = await games.createBlackjack(ctx.guildId, ctx.userId, bet, ctx.message.channelId, ctx.message.id);
  const state = result.state;
  const embed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle('🃏 BLACKJACK')
    .addFields(
      { name: `Kamu (${result.playerValue})`, value: games.formatCards(state.player), inline: true },
      { name: `Dealer (${result.finished ? result.dealerValue : '?'})`, value: games.formatCards(state.dealer, !result.finished), inline: true },
    )
    .setDescription(result.finished ? `**BLACKJACK!** Payout: ${money(result.payout)}` : `Bet: ${money(bet)} • pilih Hit atau Stand.`)
    .setFooter({ text: BRAND });
  if (result.finished) return reply(ctx.message, embed);
  return reply(ctx.message, embed, [blackjackButtons(String(result.session._id))]);
}

async function executeRps(ctx) {
  const target = await resolveTarget(ctx.message, ctx.args[0]);
  if (target) {
    const choice = ctx.args[1];
    const bet = parseBet(ctx.args[2]);
    const result = await games.rpsChallenge(ctx.guildId, ctx.userId, target.id, choice, bet, ctx.message.channelId, ctx.message.id);
    const embed = new EmbedBuilder()
      .setColor(COLORS.ember)
      .setTitle('✊✋✌️ RPS PVP')
      .setDescription(`<@${ctx.userId}> menantang <@${target.id}>\nInitiator memilih **${result.choice}** secara rahasia.\nBet: ${money(result.value)} per pemain.\n\n<@${target.id}> pilih gerakan lewat tombol!`)
      .setFooter({ text: BRAND });
    return reply(ctx.message, embed, [rpsButtons(String(result.session._id))]);
  }
  const bet = parseBet(ctx.args[1]);
  const result = await games.rps(ctx.guildId, ctx.userId, ctx.args[0], bet, ctx.message.id);
  return reply(ctx.message, resultEmbed('✊✋✌️ RPS', result,
    `Kamu: **${result.mine}** • Bot: **${result.theirs}**\nBet: ${money(result.bet)} • Payout: **${money(result.payout)}**`));
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
