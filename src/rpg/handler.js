'use strict';

const { MessageFlags } = require('discord.js');
const commands = require('./commands');
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

function parse(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed.startsWith('6')) return null;
  const [token, ...args] = trimmed.split(/\s+/);
  const command = commands.get(token.toLowerCase());
  if (!command) return null;
  return { token: token.toLowerCase(), args, command };
}

async function handleMessage(message) {
  if (!message || message.author?.bot || message.author?.system) return false;
  if (!message.guildId) return false;
  const parsed = parse(message.content);
  if (!parsed) return false;

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
