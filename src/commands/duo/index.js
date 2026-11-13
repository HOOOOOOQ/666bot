'use strict';

const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { UserError } = require('../../utils/errors');

const log = createLogger('cmd:duo');

const SUBCOMMAND_NAMES = [
  'help',
  'invite',
  'accept',
  'decline',
  'profile',
  'streak',
  'leaderboard',
  'rewards',
  'history',
  'rename',
  'break',
  'config',
  'setlog',
  'logstatus',
];

const subcommands = new Map(
  SUBCOMMAND_NAMES.map((name) => [name, require(`./${name}`)]),
);

const data = new SlashCommandBuilder()
  .setName('duo')
  .setDescription('🔥 666 DUO STREAK — TWO MEMBERS. ONE CONNECTION. ONE STREAK.')
  .setContexts(InteractionContextType.Guild);

for (const subcommand of subcommands.values()) {
  data.addSubcommand(subcommand.data);
}

module.exports = {
  data,
  cooldownMs: 2000,
  async execute(interaction) {
    const name = interaction.options.getSubcommand(false) || 'help';
    const subcommand = subcommands.get(name);

    if (!subcommand) {
      throw new UserError('Subcommand tidak dikenal. Gunakan `/duo help`.');
    }

    log.debug(`/${interaction.commandName} ${name} by ${interaction.user.id} (${interaction.guildId}).`);
    await subcommand.execute(interaction);
  },
};
