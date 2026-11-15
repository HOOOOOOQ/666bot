'use strict';

const crypto = require('node:crypto');
const { EmbedBuilder } = require('discord.js');
const { define, info, ok, fail } = require('./_factory');
const { reply, resolveTarget } = require('./_helpers');
const extraService = require('../services/extraService');
const userService = require('../services/userService');
const cooldownService = require('../services/cooldownService');
const { BRAND } = require('../ui/embeds');
const { COLORS } = require('../../ui/theme');
const { money } = require('../ui/embeds');
const { formatCoins, xpForLevel } = require('../utils/formulas');
const { randomInt } = require('../utils/rng');
const { UserError } = require('../../utils/errors');

const ACTION_COOLDOWN = 30 * 1000;

async function socialCooldown(guildId, userId, action) {
  const cd = await cooldownService.claim(guildId, userId, `social:${action}`, ACTION_COOLDOWN);
  if (!cd.ok) throw new UserError(`Cooldown ${action}. Coba lagi <t:${Math.floor(cd.retryAt.getTime() / 1000)}:R>.`);
}

async function targetOf(ctx, required = false) {
  if (!ctx.args[0]) {
    if (required) throw new UserError('Tag member yang dimaksud.');
    return null;
  }
  return resolveTarget(ctx.message, ctx.args[0]);
}

const commands = [
  define({
    name: 'cookie', category: 'social', aliases: [], description: 'Beri cookie ke member lain.',
    usage: '`tcookie [@user]`', examples: ['tcookie @friend'], cooldown: '30 detik',
    async execute(ctx) {
      await socialCooldown(ctx.guildId, ctx.userId, 'cookie');
      const target = await targetOf(ctx);
      await extraService.socialCount(ctx.guildId, ctx.userId, 'cookiesGiven');
      if (target) await extraService.socialCount(ctx.guildId, target.id, 'cookiesReceived');
      return reply(ctx.message, ok('🍪 COOKIE', target ? `<@${ctx.userId}> memberikan cookie ke <@${target.id}>! 🍪` : `<@${ctx.userId}> memakan cookie. 🍪`));
    },
  }),
  define({
    name: 'ship', category: 'social', aliases: ['love'], description: 'Hitung compatibility dua member secara deterministik.',
    usage: '`tship @user [@user2]`', examples: ['tship @a @b'], cooldown: '10 detik',
    async execute(ctx) {
      if (!ctx.args.length) throw new UserError('Tag minimal satu member: `tship @a @b`.');
      const first = (await resolveTarget(ctx.message, ctx.args[0]))?.id || ctx.userId;
      const second = (await resolveTarget(ctx.message, ctx.args[1]))?.id || ctx.userId;
      if (first === second) throw new UserError('Pilih dua orang yang berbeda.');
      const key = [first, second].sort().join(':');
      const hash = crypto.createHash('sha256').update(key).digest();
      const percent = hash[0] % 101;
      const bar = '█'.repeat(Math.round(percent / 10)).padEnd(10, '░');
      return reply(ctx.message, info('💞 SHIP METER',
        `<@${first}> ❤️ <@${second}>\n\n\`${bar}\` **${percent}%**\n\n` +
        (percent >= 80 ? 'Jodoh banget! 💍' : percent >= 50 ? 'Ada potensi. 👀' : percent >= 25 ? 'Friendzone? 🤝' : 'Mungkin jangan dulu. 💔')));
    },
  }),
  define({
    name: 'pray', category: 'social', aliases: [], description: 'Kirim doa/blessing untuk member lain.',
    usage: '`tpray [@user]`', examples: ['tpray @friend'], cooldown: '30 detik',
    async execute(ctx) {
      await socialCooldown(ctx.guildId, ctx.userId, 'pray');
      const target = await targetOf(ctx);
      await extraService.socialCount(ctx.guildId, ctx.userId, 'prayers');
      if (target) {
        await userService.addXp(ctx.guildId, target.id, 5, 'xp').catch(() => {});
        await extraService.socialCount(ctx.guildId, target.id, 'blessings');
      }
      return reply(ctx.message, ok('🙏 PRAY', target ? `<@${ctx.userId}> mengirim doa untuk <@${target.id}>. +5 XP untuk target.` : `<@${ctx.userId}> memanjatkan doa.`));
    },
  }),
  define({
    name: 'curse', category: 'social', aliases: [], description: 'Lempar kutukan ringan (hanya social stats, tanpa mengurangi saldo).',
    usage: '`tcurse [@user]`', examples: ['tcurse @rival'], cooldown: '30 detik',
    async execute(ctx) {
      await socialCooldown(ctx.guildId, ctx.userId, 'curse');
      const target = await targetOf(ctx);
      await extraService.socialCount(ctx.guildId, ctx.userId, 'curses');
      if (target) await extraService.socialCount(ctx.guildId, target.id, 'cursesReceived');
      return reply(ctx.message, fail('🌑 CURSE', target ? `<@${ctx.userId}> melempar kutukan ke <@${target.id}>... semoga RNG baik.` : `<@${ctx.userId}> mengutuk langit.`));
    },
  }),
  define({
    name: 'marry', category: 'social', aliases: [], description: 'Propose, accept, status, atau divorce partner.',
    usage: '`tmarry @user` • `tmarry accept <proposalId>` • `tmarry status` • `tmarry divorce`',
    examples: ['tmarry @partner', 'tmarry accept a1b2c3', 'tmarry status'], cooldown: '10 detik',
    async execute(ctx) {
      const action = (ctx.args[0] || 'status').toLowerCase();
      if (action === 'status' || (!action.startsWith('@') && !ctx.message.mentions?.users?.size && ctx.args.length === 0)) {
        const user = await userService.ensureUser(ctx.guildId, ctx.userId);
        if (!user.partnerId) return reply(ctx.message, info('💍 MARRIAGE', 'Kamu belum menikah. Gunakan `tmarry @user` untuk propose.'));
        return reply(ctx.message, info('💍 MARRIAGE', `Kamu menikah dengan <@${user.partnerId}> sejak <t:${Math.floor(new Date(user.marriedAt || Date.now()).getTime() / 1000)}:R>.`));
      }
      if (action === 'accept') {
        if (!ctx.args[1] || !/^[a-f0-9]{24}$/i.test(ctx.args[1])) throw new UserError('Format: `tmarry accept <proposalId>`. Salin ID dari pesan proposal.');
        const proposal = await extraService.acceptMarriage(ctx.guildId, ctx.userId, ctx.args[1]);
        return reply(ctx.message, ok('💍 MARRIAGE ACCEPTED', `<@${proposal.userId}> dan <@${ctx.userId}> sekarang menikah!`));
      }
      if (action === 'divorce') {
        const user = await userService.ensureUser(ctx.guildId, ctx.userId);
        if (!user.partnerId) throw new UserError('Kamu belum menikah.');
        const partner = user.partnerId;
        await userService.ensureUser(ctx.guildId, partner);
        await require('../../database/models').RPGUser.updateMany({ guildId: ctx.guildId, userId: { $in: [ctx.userId, partner] } }, { $set: { partnerId: null, marriedAt: null } });
        return reply(ctx.message, ok('💔 DIVORCE', `Pernikahan dengan <@${partner}> berakhir.`));
      }
      const target = await resolveTarget(ctx.message, ctx.args[0]);
      if (!target) throw new UserError('Tag orang yang ingin dinikahi: `tmarry @user`.');
      if (target.bot) throw new UserError('Tidak bisa menikahi bot.');
      const proposal = await extraService.proposeMarriage(ctx.guildId, ctx.userId, target.id);
      return reply(ctx.message, info('💍 MARRIAGE PROPOSAL',
        `<@${ctx.userId}> melamar <@${target.id}>!\n\n<@${target.id}>, terima dengan:\n\`tmarry accept ${proposal._id}\`\n\nBerlaku 1 jam.`));
    },
  }),
  define({
    name: 'emoji', category: 'social', aliases: [], description: 'Tampilkan emoji besar atau info emoji.',
    usage: '`temoji <emoji>`', examples: ['temoji 🔥'], cooldown: '2 detik',
    async execute(ctx) {
      const value = ctx.args[0];
      if (!value) throw new UserError('Masukkan emoji: `temoji 🔥`.');
      const embed = new EmbedBuilder().setColor(COLORS.flame).setTitle('😄 EMOJI')
        .setDescription(`# ${value}\n\n\`${value.codePointAt(0)?.toString(16).toUpperCase() || 'custom'}\``).setFooter({ text: BRAND });
      return reply(ctx.message, embed);
    },
  }),
  define({
    name: 'level', category: 'social', aliases: ['lvl'], description: 'Lihat level, EXP, dan progress ke level berikutnya.',
    usage: '`tlevel [@user]`', examples: ['tlevel', 'tlevel @friend'], cooldown: '2 detik',
    async execute(ctx) {
      const target = (await targetOf(ctx))?.id || ctx.userId;
      const user = await userService.ensureUser(ctx.guildId, target);
      const need = xpForLevel(user.level || 1);
      const pct = Math.min(100, Math.round(((user.xp || 0) / need) * 100));
      const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '░');
      return reply(ctx.message, info('📈 LEVEL', `<@${target}>\n**Level ${user.level || 1}**\n\`${bar}\` ${pct}%\n${formatCoins(user.xp || 0)} / ${formatCoins(need)} XP`));
    },
  }),
  define({
    name: 'wallpaper', category: 'social', aliases: [], description: 'Ambil wallpaper acak sesuai tema.',
    usage: '`twallpaper [tema]`', examples: ['twallpaper cyberpunk'], cooldown: '3 detik',
    async execute(ctx) {
      const theme = ctx.args.join(' ').trim() || 'dark,anime';
      const url = `https://loremflickr.com/1920/1080/${encodeURIComponent(theme)}?lock=${randomInt(1, 999999)}`;
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🖼️ WALLPAPER').setDescription(`Tema: **${theme}**`).setImage(url).setFooter({ text: BRAND }));
    },
  }),
  define({
    name: 'godify', category: 'social', aliases: ['ascend'], description: 'Buat avatar member menjadi versi 666 ascended lewat canvas API.',
    usage: '`tgodify [@user]`', examples: ['tgodify', 'tgodify @friend'], cooldown: '5 detik',
    async execute(ctx) {
      const target = (await targetOf(ctx))?.id || ctx.userId;
      const member = await ctx.message.guild?.members.fetch(target).catch(() => null);
      const avatar = (member || ctx.message.author).displayAvatarURL({ extension: 'png', size: 512 });
      const url = `https://some-random-api.com/canvas/god?avatar=${encodeURIComponent(avatar)}`;
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.flame).setTitle('🔥 666 ASCEND').setDescription(`<@${target}> telah naik ke level 666.`).setImage(url).setFooter({ text: BRAND }));
    },
  }),
  define({
    name: 'avatar', category: 'social', aliases: ['av'], description: 'Tampilkan avatar member dalam ukuran besar.',
    usage: '`tavatar [@user]`', examples: ['tavatar', 'tavatar @friend'], cooldown: '2 detik',
    async execute(ctx) {
      const target = (await targetOf(ctx))?.id || ctx.userId;
      const member = await ctx.message.guild?.members.fetch(target).catch(() => null);
      const user = member || ctx.message.author;
      const url = user.displayAvatarURL({ extension: 'png', size: 1024 });
      return reply(ctx.message, new EmbedBuilder().setColor(COLORS.ember).setTitle('🖼️ AVATAR').setDescription(`<@${target}>`).setImage(url).setFooter({ text: BRAND }));
    },
  }),
];

module.exports = commands;
