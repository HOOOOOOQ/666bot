'use strict';

const { MessageFlags } = require('discord.js');
const commands = require('./commands');
const serverConfigService = require('./services/serverConfigService');
const { createLogger } = require('../utils/logger');
const { UserError } = require('../utils/errors');
const { errorEmbed } = require('../ui/embeds');

const log = createLogger('rpg-prefix');
const localSpam = new Map();

function profileOf(message) {
  return {
    username: message.author?.username || null,
    avatar: message.author?.displayAvatarURL?.({ extension: 'png', size: 256 }) || null,
  };
}

function parse(content, prefix = 't') {
  const trimmed = String(content || '').trim();
  if (!trimmed.startsWith(prefix)) return null;
  const [rawToken, ...args] = trimmed.slice(prefix.length).split(/\s+/);
  if (!rawToken) return null;
  const token = `t${rawToken.toLowerCase()}`;
  const command = commands.get(token);
  if (!command) return null;
  return { token, args, command, prefix };
}

async function handleMessage(message) {
  if (!message || message.author?.bot || message.author?.system) return false;
  if (!message.guildId) return false;
  let prefix = 't';
  if (!String(message.content || '').trim().startsWith('t')) {
    const custom = await serverConfigService.getCustomPrefix(message.guildId).catch(() => null);
    if (!custom || !String(message.content || '').trim().startsWith(custom)) return false;
    prefix = custom;
  }
  const parsed = parse(message.content, prefix);
  if (!parsed) return false;
  const bare = parsed.token.replace(/^t/, '');
  const canonical = parsed.command?.meta?.name ? parsed.command.meta.name.replace(/^t/, '') : bare;
  const [enabled, canonicalEnabled] = await Promise.all([
    serverConfigService.isCommandEnabled(message.guildId, bare).catch(() => true),
    canonical === bare ? Promise.resolve(true) : serverConfigService.isCommandEnabled(message.guildId, canonical).catch(() => true),
  ]);
  if (!enabled || !canonicalEnabled) return true;

  const now = Date.now();
  const last = localSpam.get(`${message.guildId}:${message.author.id}`);
  if (last && now - last < 800) return true;
  localSpam.set(`${message.guildId}:${message.author.id}`, now);
  if (localSpam.size > 5000) {
    for (const [key, at] of localSpam.entries()) if (now - at > 60000) localSpam.delete(key);
  }

  const ctx = {
    message,
    args: parsed.args,
    token: parsed.token,
    command: parsed.command,
    guildId: message.guildId,
    userId: message.author.id,
    profile: profileOf(message),
    prefix,
  };

  try {
    await message.channel.sendTyping().catch(() => {});
    await parsed.command.execute(ctx);
  } catch (error) {
    const isUser = error instanceof UserError;
    if (isUser) log.debug(`RPG user error: ${error.message}`);
    else log.error(`RPG command ${parsed.token} failed for ${message.author.id}.`, error);
    try {
      await message.reply({
        embeds: [errorEmbed(isUser ? error.message : 'Terjadi kesalahan internal. Coba lagi sebentar.', isUser ? 'Tidak Bisa Diproses' : 'Internal Error')],
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (replyError) {
      log.warn(`Could not deliver RPG error: ${replyError.message}`);
    }
  }
  return true;
}

module.exports = { handleMessage, parse, commands, profileOf, MessageFlags };
