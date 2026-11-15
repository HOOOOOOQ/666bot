'use strict';

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { define, info } = require('./_factory');
const { TEMPLATES, renderMeme } = require('../ui/memes');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { UserError } = require('../../utils/errors');

function memeCommand(id, description, example) {
  const template = TEMPLATES[id];
  return define({
    name: id, category: 'meme', aliases: [], description,
    usage: `\`6${id} [teks atas | teks bawah]\``, examples: [`6${id}${example ? ` ${example}` : ''}`], cooldown: '5 detik',
    async execute(ctx) {
      const parts = ctx.args.join(' ').split('|').map((part) => part.trim()).filter(Boolean);
      const buffer = await renderMeme(id, parts, {
        avatarUrl: ctx.message.author.displayAvatarURL({ extension: 'png', size: 256 }),
        username: ctx.message.author.username,
      });
      const embed = new EmbedBuilder().setColor(COLORS.flame).setTitle(template.title)
        .setDescription('Meme dibuat oleh 666 Meme Engine.').setImage(`attachment://${id}.png`).setFooter({ text: BRAND });
      return ctx.message.reply({ embeds: [embed], files: [new AttachmentBuilder(buffer, { name: `${id}.png` })] });
    },
  });
}

module.exports = [
  memeCommand('spongebobchicken', 'Meme SpongeBob chicken dengan teks custom.', 'ketika kamu | klaim daily'),
  memeCommand('slapcar', 'Meme slap car untuk rasa kesal.', 'aku kalah | RNG'),
  memeCommand('isthisa', 'Meme is this a pigeon?', 'apakah ini | reward gratis'),
  memeCommand('drake', 'Meme Drake NO/YES. Pisahkan dua teks dengan |.', 'grind manual | autohunt'),
  memeCommand('distractedbf', 'Meme distracted boyfriend.', 'walletku | egg legendary'),
  memeCommand('communismcat', 'Meme communism cat.', 'koinmu | koin kita'),
  memeCommand('eject', 'Meme emergency eject.', 'listing kemahalan | eject'),
  memeCommand('emergencymeeting', 'Meme emergency meeting.', 'ada secret monster | sus'),
  memeCommand('headpat', 'Meme headpat untuk teman.', 'kamu hebat | semoga hoki'),
  memeCommand('tradeoffer', 'Meme trade offer.', 'aku dapat pet langka | kamu dapat egg umum'),
  memeCommand('waddle', 'Meme waddle saat boss muncul.', 'boss spawn | semua waddle'),
];
