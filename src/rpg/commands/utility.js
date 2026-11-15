'use strict';

const os = require('node:os');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { define, info, ok, fail } = require('./_factory');
const { reply } = require('./_helpers');
const userService = require('../services/userService');
const serverConfigService = require('../services/serverConfigService');
const models = require('../../database/models');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { formatCoins } = require('../utils/formulas');
const { UserError } = require('../../utils/errors');

function isAdmin(message) {
  return Boolean(message.member?.permissions?.has(PermissionFlagsBits.ManageGuild));
}

function webUrl() {
  return (process.env.PUBLIC_WEB_URL || 'https://github.com/HOOOOOOQ/666bot').replace(/\/$/, '');
}

function siteUrl() {
  return process.env.PUBLIC_WEB_URL ? webUrl() : `${webUrl()}/site`;
}

function safeMath(expression) {
  const src = String(expression || '').replace(/\s+/g, '');
  if (src.length > 120) throw new UserError('Ekspresi terlalu panjang (maks 120 karakter).');
  if (!/^[0-9+\-*/().%^]+$/.test(src)) throw new UserError('Ekspresi hanya boleh angka dan + - * / ( ) % ^.');
  let index = 0;
  function parseExpression() {
    let value = parseTerm();
    while (src[index] === '+' || src[index] === '-') {
      const op = src[index++];
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }
  function parseTerm() {
    let value = parseFactor();
    while (['*', '/', '%'].includes(src[index])) {
      const op = src[index++];
      const rhs = parseFactor();
      if ((op === '/' || op === '%') && rhs === 0) throw new UserError('Tidak bisa membagi dengan nol.');
      value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
    }
    return value;
  }
  function parseFactor() {
    const base = parseUnary();
    if (src[index] === '^') {
      index += 1;
      return base ** parseFactor();
    }
    return base;
  }
  function parseUnary() {
    if (src[index] === '+') { index += 1; return parseUnary(); }
    if (src[index] === '-') { index += 1; return -parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary() {
    if (src[index] === '(') {
      index += 1;
      const value = parseExpression();
      if (src[index] !== ')') throw new UserError('Kurung tidak seimbang.');
      index += 1;
      return value;
    }
    const match = /^\d+(\.\d+)?/.exec(src.slice(index));
    if (!match) throw new UserError('Ekspresi tidak valid.');
    index += match[0].length;
    return Number(match[0]);
  }
  const result = parseExpression();
  if (index !== src.length) throw new UserError('Ekspresi tidak valid.');
  if (!Number.isFinite(result)) throw new UserError('Hasil tidak valid.');
  return result;
}

const commands = [
  define({
    name: 'ping', category: 'utility', aliases: [], description: 'Cek latency WebSocket dan uptime bot.',
    usage: '`6ping`', examples: ['6ping'], cooldown: '3 detik',
    async execute(ctx) {
      const client = ctx.message.client;
      const dbState = models.RPGUser.db?.readyState === 1 ? 'connected' : 'disconnected';
      return reply(ctx.message, info('🏓 PONG', `WebSocket: **${Math.round(client.ws.ping)}ms**\nDatabase: **${dbState}**\nUptime: **${Math.floor(process.uptime() / 60)} menit**`));
    },
  }),
  define({
    name: 'stats', category: 'utility', aliases: [], description: 'Statistik bot dan server.',
    usage: '`6stats`', examples: ['6stats'], cooldown: '5 detik',
    async execute(ctx) {
      const client = ctx.message.client;
      const users = client.guilds.cache.reduce((sum, guild) => sum + (guild.memberCount || 0), 0);
      const mem = process.memoryUsage();
      return reply(ctx.message, info('📊 666 STATS',
        `**Guilds** ${client.guilds.cache.size}\n**Members** ${formatCoins(users)}\n**Uptime** ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\n` +
        `**Memory** ${(mem.rss / 1024 / 1024).toFixed(1)} MB\n**Node** ${process.version}\n**Platform** ${os.platform()} ${os.arch()}`));
    },
  }),
  define({
    name: 'link', category: 'utility', aliases: [], description: 'Tautan website, help center, dan dashboard 666.',
    usage: '`6link`', examples: ['6link'], cooldown: '2 detik',
    async execute(ctx) {
      return reply(ctx.message, info('🔗 666 LINKS', `[Website](${siteUrl()}/)\n[Help Center](${siteUrl()}/help/)\n[Commands JSON](${siteUrl()}/commands.json)\n[Source](${webUrl()})`));
    },
  }),
  define({
    name: 'guildlink', category: 'utility', aliases: ['serverlink'], description: 'Buat link invite server ini atau tampilkan support server.',
    usage: '`6guildlink`', examples: ['6guildlink'], cooldown: '5 detik',
    async execute(ctx) {
      const support = process.env.SUPPORT_SERVER_URL;
      if (support) return reply(ctx.message, info('🔗 GUILD LINK', `Support server: ${support}\nServer ini: ${ctx.message.guild?.name || 'DM'}`));
      if (!ctx.message.guild) throw new UserError('Command ini hanya bisa dipakai di server.');
      let invite = null;
      if (ctx.message.guild.members.me?.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
        invite = await ctx.message.guild.invites.create(ctx.message.channelId, { maxAge: 0, maxUses: 0, unique: false, reason: '6guildlink' }).catch(() => null);
      }
      return reply(ctx.message, info('🔗 GUILD LINK', invite ? `Invite permanen: ${invite.url}` : `Server ID: \`${ctx.message.guild.id}\` (bot tidak punya izin Create Invite)`));
    },
  }),
  define({
    name: 'disable', category: 'utility', aliases: [], description: 'Aktif/nonaktifkan command di server ini (admin).',
    usage: '`6disable <command>` • `6disable enable <command>`', examples: ['6disable hunt', '6disable enable hunt'], cooldown: '2 detik', permissions: 'Manage Server',
    async execute(ctx) {
      if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
      const enable = (ctx.args[0] || '').toLowerCase() === 'enable';
      const token = (enable ? ctx.args[1] : ctx.args[0] || '').replace(/^6/, '').toLowerCase();
      if (!token) throw new UserError('Format: `6disable <command>` atau `6disable enable <command>`.');
      const target = require('./index').get(`6${token}`);
      const names = target?.names?.length ? target.names.map((name) => name.replace(/^6/, '')) : [token];
      let result;
      for (const name of names) result = await serverConfigService.toggleCommand(ctx.guildId, name, enable);
      return reply(ctx.message, ok('🔧 COMMAND SETTING', `\`6${token}\` sekarang **${enable ? 'aktif' : 'nonaktif'}** di server ini.`));
    },
  }),
  define({
    name: 'censor', category: 'utility', aliases: [], description: 'Kelola filter kata server (admin).',
    usage: '`6censor on|off|add <kata>|remove <kata>|list`', examples: ['6censor on', '6censor add badword'], cooldown: '2 detik', permissions: 'Manage Server',
    async execute(ctx) {
      if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
      const action = (ctx.args[0] || 'list').toLowerCase();
      if (action === 'on' || action === 'off') {
        await serverConfigService.setCensor(ctx.guildId, action === 'on');
        return reply(ctx.message, ok('🛡️ CENSOR', `Filter kata **${action === 'on' ? 'aktif' : 'nonaktif'}**.`));
      }
      if (action === 'add' || action === 'remove') {
        if (!ctx.args[1]) throw new UserError('Masukkan kata.');
        const cfg = action === 'add' ? await serverConfigService.addCensoredWord(ctx.guildId, ctx.args[1]) : await serverConfigService.removeCensoredWord(ctx.guildId, ctx.args[1]);
        return reply(ctx.message, ok('🛡️ CENSOR', `Kata ${action === 'add' ? 'ditambahkan' : 'dihapus'}. Total: **${(cfg.censoredWords || []).length}**`));
      }
      const cfg = await serverConfigService.getConfig(ctx.guildId);
      return reply(ctx.message, info('🛡️ CENSOR', `Status: **${cfg.censorEnabled ? 'ON' : 'OFF'}**\nKata: ${(cfg.censoredWords || []).join(', ') || '—'}`));
    },
  }),
  define({
    name: 'prefix', category: 'utility', aliases: [], description: 'Lihat atau ubah prefix tambahan server (admin). `6` selalu aktif.',
    usage: '`6prefix [prefix]`', examples: ['6prefix', '6prefix !'], cooldown: '3 detik', permissions: 'Manage Server',
    async execute(ctx) {
      if (!ctx.args[0]) {
        const cfg = await serverConfigService.getConfig(ctx.guildId);
        return reply(ctx.message, info('🔧 PREFIX', `Prefix utama: \`6\`\nPrefix tambahan: \`${cfg.customPrefix || '—'}\``));
      }
      if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
      const cfg = await serverConfigService.setCustomPrefix(ctx.guildId, ctx.args[0]);
      return reply(ctx.message, ok('🔧 PREFIX', `Prefix tambahan diset ke \`${cfg.customPrefix}\`. Prefix \`6\` tetap aktif.`));
    },
  }),
  define({
    name: 'announcement', category: 'utility', aliases: ['announce'], description: 'Kirim pengumuman embed dan set channel announcement (admin).',
    usage: '`6announcement <teks>`', examples: ['6announcement Maintenance malam ini'], cooldown: '5 detik', permissions: 'Manage Server',
    async execute(ctx) {
      if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
      const text = ctx.args.join(' ').trim();
      if (!text) throw new UserError('Tulis isi pengumuman.');
      await serverConfigService.setChannel(ctx.guildId, 'announcement', ctx.message.channelId);
      const embed = new EmbedBuilder().setColor(COLORS.flame).setTitle('📢 ANNOUNCEMENT').setDescription(text).setFooter({ text: `666 • ${ctx.message.author.username}` }).setTimestamp();
      return reply(ctx.message, embed);
    },
  }),
  define({
    name: 'rules', category: 'utility', aliases: [], description: 'Tampilkan atau set rules server (admin).',
    usage: '`6rules` • `6rules set <rule1> | <rule2>`', examples: ['6rules', '6rules set Hormati semua orang | No spam'], cooldown: '3 detik', permissions: 'Everyone (set: Manage Server)',
    async execute(ctx) {
      if ((ctx.args[0] || '').toLowerCase() === 'set') {
        if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
        const rules = ctx.args.slice(1).join(' ').split('|').map((r) => r.trim()).filter(Boolean).slice(0, 20);
        if (!rules.length) throw new UserError('Format: `6rules set rule1 | rule2`.');
        await serverConfigService.setRules(ctx.guildId, rules);
        return reply(ctx.message, ok('📜 RULES UPDATED', `${rules.length} rules disimpan.`));
      }
      const cfg = await serverConfigService.getConfig(ctx.guildId);
      const rules = (cfg.rules || []).map((rule, index) => `**${index + 1}.** ${rule}`).join('\n') || 'Belum ada rules. Admin bisa set dengan `6rules set ...`.';
      return reply(ctx.message, info('📜 SERVER RULES', rules));
    },
  }),
  define({
    name: 'suggest', category: 'utility', aliases: ['suggestion'], description: 'Kirim saran untuk server/bot. Admin dapat menandai status.',
    usage: '`6suggest <ide>` • `6suggest accept|reject|implemented <id>`', examples: ['6suggest tambah command fish'], cooldown: '10 detik',
    async execute(ctx) {
      const action = (ctx.args[0] || '').toLowerCase();
      if (['accept', 'reject', 'implemented'].includes(action)) {
        if (!isAdmin(ctx.message)) throw new UserError('Butuh permission **Manage Server**.');
        const id = ctx.args[1];
        if (!id || !/^[a-f0-9]{24}$/i.test(id)) throw new UserError('Format: `6suggest accept <id>`.');
        const suggestion = await models.Suggestion.findOneAndUpdate({ _id: id, guildId: ctx.guildId }, { $set: { status: action === 'accept' ? 'accepted' : action, reviewedBy: ctx.userId, reviewedAt: new Date() } }, { new: true });
        if (!suggestion) throw new UserError('Suggestion tidak ditemukan.');
        return reply(ctx.message, ok('💡 SUGGESTION', `Suggestion \`${id}\` → **${suggestion.status}**.`));
      }
      const text = ctx.args.join(' ').trim();
      if (!text) throw new UserError('Tulis saran: `6suggest tambah command fish`.');
      const suggestion = await models.Suggestion.create({ guildId: ctx.guildId, userId: ctx.userId, username: ctx.message.author.username, message: text.slice(0, 1000), status: 'open' });
      return reply(ctx.message, ok('💡 SUGGESTION TERKIRIM', `\`${suggestion._id}\`\n${text}\n\nAdmin dapat review dengan \`6suggest accept ${suggestion._id}\`.`));
    },
  }),
  define({
    name: 'shards', category: 'utility', aliases: ['shard'], description: 'Lihat jumlah shards dan kegunaannya.',
    usage: '`6shards [@user]`', examples: ['6shards'], cooldown: '2 detik',
    async execute(ctx) {
      const target = ctx.message.mentions?.users?.first()?.id || ctx.userId;
      const user = await userService.ensureUser(ctx.guildId, target);
      return reply(ctx.message, info('💎 SHARDS', `<@${target}> punya **${user.shards || 0} shards**.\nDapatkan dari dismantle, lootbox, dan event.`));
    },
  }),
  define({
    name: 'math', category: 'utility', aliases: ['calc'], description: 'Kalkulator aman untuk ekspresi matematika.',
    usage: '`6math <ekspresi>`', examples: ['6math (12+3)*4^2'], cooldown: '2 detik',
    async execute(ctx) {
      const expression = ctx.args.join(' ');
      if (!expression) throw new UserError('Contoh: `6math (12+3)*4`.');
      const value = safeMath(expression);
      return reply(ctx.message, info('🧮 MATH', `\`${expression}\` = **${Number(value.toFixed(10))}**`));
    },
  }),
  define({
    name: 'color', category: 'utility', aliases: ['colour'], description: 'Preview warna dari kode hex.',
    usage: '`6color <#RRGGBB>`', examples: ['6color #ff5a00'], cooldown: '2 detik',
    async execute(ctx) {
      const raw = (ctx.args[0] || '').replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(raw)) throw new UserError('Gunakan format hex 6 digit, contoh `#ff5a00`.');
      const color = parseInt(raw, 16);
      return reply(ctx.message, new EmbedBuilder().setColor(color).setTitle(`🎨 #${raw.toUpperCase()}`).setDescription(`RGB: ${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}`).setFooter({ text: BRAND }));
    },
  }),
  define({
    name: 'patron', category: 'utility', aliases: ['donate'], description: 'Info patron/donasi dan benefit tanpa klaim palsu.',
    usage: '`6patron`', examples: ['6patron'], cooldown: '3 detik',
    async execute(ctx) {
      return reply(ctx.message, info('💖 PATRON 666', 'Patron membantu biaya server & pengembangan.\nBenefit diberikan manual oleh admin setelah donasi terverifikasi.\n\nHubungi admin server untuk detail. Tidak ada reward otomatis dari command ini.'));
    },
  }),
];

module.exports = { commands, safeMath, isAdmin };
