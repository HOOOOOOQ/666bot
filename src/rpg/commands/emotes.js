'use strict';

const { EmbedBuilder } = require('discord.js');
const { define, fetchJson } = require('./_factory');
const { reply, resolveTarget } = require('./_helpers');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { pick } = require('../utils/rng');

const EMOTES = [
  ['blush', 'blush', '😊', 'merona karena malu'],
  ['cry', 'cry', '😭', 'menangis'],
  ['dance', 'dance', '💃', 'menari'],
  ['pout', 'pout', '😤', 'cemberut'],
  ['shrug', 'shrug', '🤷', 'angkat bahu'],
  ['sleepy', 'sleepy', '😴', 'mengantuk'],
  ['smile', 'smile', '😄', 'tersenyum'],
  ['smug', 'smug', '😏', 'smug'],
  ['thumbsup', 'thumbsup', '👍', 'memberi thumbs up'],
  ['wag', 'wag', '🐕', 'menggoyangkan ekor'],
  ['thinking', 'thinking', '🤔', 'berpikir'],
  ['triggered', 'triggered', '😡', 'triggered'],
  ['teehee', 'teehee', '😋', 'teehee'],
  ['deredere', 'happy', '🥰', 'deredere'],
  ['thonsking', 'thinking', '🤨', 'thonsking'],
  ['scoff', 'smug', '😒', 'scoff'],
  ['happy', 'happy', '😁', 'bahagia'],
  ['thumbs', 'thumbsup', '👍', 'thumbs up'],
  ['grin', 'grin', '😁', 'grin'],
];

const ACTIONS = [
  ['cuddle', 'cuddle', '🤗', 'memeluk'],
  ['hug', 'hug', '🫂', 'memeluk'],
  ['kiss', 'kiss', '😘', 'mencium'],
  ['lick', 'lick', '👅', 'menjilat'],
  ['nom', 'nom', '😋', 'menggigit'],
  ['pat', 'pat', '🫳', 'mengelus'],
  ['pats', 'pat', '🫳', 'mengelus'],
  ['poke', 'poke', '👉', 'mencolek'],
  ['slap', 'slap', '🖐️', 'menampar'],
  ['stare', 'stare', '👀', 'menatap'],
  ['highfive', 'highfive', '🙌', 'tos'],
  ['bite', 'bite', '🦷', 'menggigit'],
  ['greet', 'greet', '👋', 'menyapa'],
  ['punch', 'punch', '👊', 'meninju'],
  ['handholding', 'handhold', '🤝', 'menggandeng tangan'],
  ['tickle', 'tickle', '🪶', 'menggelitik'],
  ['hold', 'hold', '🫴', 'menggenggam'],
  ['wave', 'wave', '👋', 'melambai'],
  ['boop', 'boop', '👉', 'boop hidung'],
  ['snuggle', 'snuggle', '🛌', 'snuggle'],
  ['bully', 'bully', '😈', 'mengganggu'],
];

async function nekoGif(endpoint) {
  try {
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`);
    const url = data?.results?.[0]?.url;
    if (url) return url;
  } catch { /* fallback below */ }
  return `https://cataas.com/cat/gif?${Date.now()}`;
}

function actionCommand(name, endpoint, emoji, verb) {
  return define({
    name, category: 'actions', aliases: [], description: `${emoji} ${verb[0].toUpperCase() + verb.slice(1)} member lain dengan GIF.`,
    usage: `\`t${name} [@user]\``, examples: [`t${name}`, `t${name} @friend`], cooldown: '5 detik',
    async execute(ctx) {
      const target = ctx.args[0] ? await resolveTarget(ctx.message, ctx.args[0]) : null;
      const url = await nekoGif(endpoint);
      const text = target ? `<@${ctx.userId}> ${verb} <@${target.id}>!` : `<@${ctx.userId}> ${verb} udara.`;
      const embed = new EmbedBuilder().setColor(COLORS.flame).setTitle(`${emoji} ${name.toUpperCase()}`).setDescription(text).setImage(url).setFooter({ text: BRAND });
      return reply(ctx.message, embed);
    },
  });
}

function emoteCommand(name, endpoint, emoji, verb) {
  return define({
    name, category: 'emotes', aliases: [], description: `${emoji} Ekspresi ${name}: ${verb}.`,
    usage: `\`t${name}\``, examples: [`t${name}`], cooldown: '4 detik',
    async execute(ctx) {
      const url = await nekoGif(endpoint);
      const lines = [`<@${ctx.userId}> ${verb}.`, 'Tetap chill, 666 di sini.', 'Semangat untuk grind berikutnya.'];
      const embed = new EmbedBuilder().setColor(COLORS.ember).setTitle(`${emoji} ${name.toUpperCase()}`).setDescription(pick(lines)).setImage(url).setFooter({ text: BRAND });
      return reply(ctx.message, embed);
    },
  });
}

module.exports = [
  ...EMOTES.map(([name, endpoint, emoji, verb]) => emoteCommand(name, endpoint, emoji, verb)),
  ...ACTIONS.map(([name, endpoint, emoji, verb]) => actionCommand(name, endpoint, emoji, verb)),
];
