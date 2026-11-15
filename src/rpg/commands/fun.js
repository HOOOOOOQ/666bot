'use strict';

const { EmbedBuilder } = require('discord.js');
const { define, info, fail, fetchJson } = require('./_factory');
const { reply } = require('./_helpers');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { randomInt, pick } = require('../utils/rng');
const { config } = require('../../config');
const { UserError } = require('../../utils/errors');

const EIGHT_BALL = [
  'Ya, pasti.', 'Tidak.', 'Mungkin nanti.', 'Coba lagi besok.', 'Peluangnya besar.',
  'Jangan terlalu berharap.', 'Tentu saja!', 'Sumber bilang tidak.', 'Bisa jadi.', '666% ya.',
  'Tunggu momen yang tepat.', 'Tidak sekarang.', 'Percaya instingmu.', 'Hasilnya di tangan RNG.',
];

function imageEmbed(title, description, url) {
  return new EmbedBuilder().setColor(COLORS.flame).setTitle(title).setDescription(description).setImage(url).setFooter({ text: BRAND });
}

const commands = [
  define({
    name: '8ball', category: 'fun', aliases: [], description: 'Tanya bola 8 dan dapatkan jawaban dari RNG.',
    usage: '`68ball <pertanyaan>`', examples: ['68ball apakah aku menang?'], cooldown: '3 detik',
    async execute(ctx) {
      const question = ctx.args.join(' ').trim();
      if (!question) throw new UserError('Tulis pertanyaan: `68ball apakah aku menang?`.');
      return reply(ctx.message, info('🎱 THE 8-BALL', `> ${question}\n\n**${pick(EIGHT_BALL)}**`));
    },
  }),
  define({
    name: 'define', category: 'fun', aliases: ['dictionary'], description: 'Cari arti kata bahasa Inggris lewat dictionary API.',
    usage: '`6define <kata>`', examples: ['6define serendipity'], cooldown: '3 detik',
    async execute(ctx) {
      const word = (ctx.args[0] || '').replace(/[^a-zA-Z-]/g, '');
      if (!word) throw new UserError('Masukkan kata bahasa Inggris: `6define serendipity`.');
      let data;
      try { data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`); } catch { throw new UserError(`Kata **${word}** tidak ditemukan.`); }
      const entry = Array.isArray(data) ? data[0] : null;
      if (!entry) throw new UserError('Kata tidak ditemukan.');
      const meaning = entry.meanings?.[0];
      return reply(ctx.message, info(`📚 ${entry.word.toUpperCase()}`,
        `**${meaning?.partOfSpeech || 'unknown'}**\n${meaning?.definitions?.[0]?.definition || 'Tidak ada definisi.'}\n\n` +
        (meaning?.definitions?.[0]?.example ? `Contoh: *${meaning.definitions[0].example}*` : '')));
    },
  }),
  define({
    name: 'gif', category: 'fun', aliases: [], description: 'Cari GIF dari Tenor berdasarkan kata kunci.',
    usage: '`6gif <kata kunci>`', examples: ['6gif cat dance'], cooldown: '3 detik',
    async execute(ctx) {
      const query = ctx.args.join(' ').trim() || '666';
      let data;
      try {
        const key = process.env.TENOR_API_KEY || 'LIVDSRZULELA';
        data = await fetchJson(`https://api.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${key}&limit=1&media_filter=minimal`);
      } catch { throw new UserError('Layanan GIF sedang tidak tersedia. Coba lagi nanti.'); }
      const url = data?.results?.[0]?.media?.[0]?.gif?.url;
      if (!url) throw new UserError(`Tidak ada GIF untuk **${query}**.`);
      return reply(ctx.message, imageEmbed('🎞️ GIF', `Query: **${query}**`, url));
    },
  }),
  define({
    name: 'pic', category: 'fun', aliases: ['image'], description: 'Ambil gambar acak dari LoremFlickr.',
    usage: '`6pic [kata kunci]`', examples: ['6pic sunset', '6pic'], cooldown: '3 detik',
    async execute(ctx) {
      const query = ctx.args.join(' ').trim() || '666,dark';
      const url = `https://loremflickr.com/1024/768/${encodeURIComponent(query)}?lock=${randomInt(1, 999999)}`;
      return reply(ctx.message, imageEmbed('🖼️ RANDOM PICTURE', `Query: **${query}**`, url));
    },
  }),
  define({
    name: 'translate', category: 'fun', aliases: [], description: 'Terjemahkan teks via MyMemory API. Format: dari ke teks.',
    usage: '`6translate <from> <to> <teks>`', examples: ['6translate id en halo dunia'], cooldown: '3 detik',
    async execute(ctx) {
      if (ctx.args.length < 3) throw new UserError('Format: `6translate id en halo dunia`.');
      const from = ctx.args[0].toLowerCase();
      const to = ctx.args[1].toLowerCase();
      const text = ctx.args.slice(2).join(' ');
      let data;
      try { data = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`); } catch { throw new UserError('Layanan translate sedang tidak tersedia.'); }
      const translated = data?.responseData?.translatedText;
      if (!translated) throw new UserError('Terjemahan tidak ditemukan.');
      return reply(ctx.message, info('🌐 TRANSLATE', `**${from} → ${to}**\n${translated}`));
    },
  }),
  define({
    name: 'roll', category: 'fun', aliases: [], description: 'Roll dadu dengan format NdM atau angka biasa.',
    usage: '`6roll [2d6|100]`', examples: ['6roll', '6roll 2d6+3', '6roll 100'], cooldown: '2 detik',
    async execute(ctx) {
      const input = (ctx.args[0] || '1d6').toLowerCase();
      const match = /^(\d{0,2})d(\d{1,4})([+-]\d{1,4})?$/.exec(input);
      if (match) {
        const count = Math.min(20, Math.max(1, Number(match[1]) || 1));
        const sides = Math.min(1000, Math.max(2, Number(match[2]) || 6));
        const mod = Number(match[3] || 0);
        const rolls = Array.from({ length: count }, () => randomInt(1, sides));
        const total = rolls.reduce((sum, value) => sum + value, 0) + mod;
        return reply(ctx.message, info('🎲 ROLL', `**${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ''}**\nRolls: ${rolls.join(', ')}\nTotal: **${total}**`));
      }
      const max = Math.min(1000000, Math.max(2, Number(input) || 100));
      return reply(ctx.message, info('🎲 ROLL', `Angka acak 1–${max}: **${randomInt(1, max)}**`));
    },
  }),
  define({
    name: 'choose', category: 'fun', aliases: ['pick'], description: 'Pilih satu opsi secara acak.',
    usage: '`6choose opsi1, opsi2, opsi3`', examples: ['6choose nasi, mie, sate'], cooldown: '2 detik',
    async execute(ctx) {
      const options = ctx.args.join(' ').split(',').map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) throw new UserError('Pisahkan minimal dua pilihan dengan koma.');
      return reply(ctx.message, info('🎯 CHOOSE', `Aku pilih: **${pick(options)}**\n\n${options.map((option) => `• ${option}`).join('\n')}`));
    },
  }),
  define({
    name: 'bell', category: 'fun', aliases: [], description: 'Bunyikan bel keberuntungan 666.',
    usage: '`6bell`', examples: ['6bell'], cooldown: '5 detik',
    async execute(ctx) {
      const fortunes = ['Keberuntungan menghampirimu.', 'Hati-hati dengan wallet.', 'Waktunya hunt!', 'Satu pet menanti.', 'Jangan lupa daily.', 'RNG sedang tersenyum.'];
      return reply(ctx.message, info('🔔 DING DING', `*Bel berbunyi...*\n\n**${pick(fortunes)}**\n\n<@${ctx.userId}>`));
    },
  }),
];

module.exports = commands;
