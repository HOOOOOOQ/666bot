'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../ui/theme');
const { BRAND } = require('../ui/embeds');
const { reply } = require('./_helpers');

function define(def) {
  const name = def.name.startsWith('6') ? def.name : `6${def.name}`;
  const aliases = (def.aliases || []).map((alias) => (alias.startsWith('6') ? alias : `6${alias}`));
  const meta = {
    name,
    category: def.category,
    description: def.description,
    usage: def.usage || `\`${name}\``,
    examples: def.examples || [],
    required: def.required || [],
    optional: def.optional || [],
    cooldown: def.cooldown || '2 detik',
    permissions: def.permissions || 'Everyone',
    aliases: aliases.map((alias) => `\`${alias}\``),
  };
  return {
    names: [name, ...aliases],
    meta,
    help: def.help || [meta.usage, ...meta.examples.map((example) => `Contoh: \`${example}\``)],
    async execute(ctx) {
      if ((ctx.args[0] || '').toLowerCase() === 'help') {
        const { commandEmbed } = require('../ui/help');
        return reply(ctx.message, commandEmbed(meta));
      }
      return def.execute(ctx);
    },
  };
}

function base(title, description, color = COLORS.flame) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({ text: BRAND });
}

function ok(title, description, fields = []) {
  const embed = base(title, description, COLORS.success);
  if (fields.length) embed.addFields(fields);
  return embed;
}

function fail(title, description) {
  return base(title, description, COLORS.error);
}

function info(title, description, fields = []) {
  const embed = base(title, description, COLORS.ember);
  if (fields.length) embed.addFields(fields);
  return embed;
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': '666-Ultimate-RPG/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { define, base, ok, fail, info, fetchJson };
