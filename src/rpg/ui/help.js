'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { COLORS, divider } = require('../../ui/theme');
const { BRAND } = require('./embeds');
const { config } = require('../../config');
const {
  CATEGORIES,
  ENTRIES,
  getEntry,
  getCategory,
  search,
  linesFor,
  categoryOf,
  describe,
  commandsFor,
} = require('../help/catalog');

const FIELD_LIMIT = 1024;

function clip(text, limit = FIELD_LIMIT) {
  const value = String(text || '');
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function commandLine(entry) {
  return `\`${entry.name}\` — ${entry.summary}`;
}

function guildLink() {
  return process.env.SUPPORT_SERVER_URL || config.web?.publicUrl || 'https://github.com/HOOOOOOQ/666bot';
}

function overviewEmbed(client = null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle('Command List')
    .setDescription(
      `Here is the list of commands!\n\n` +
      `For more info on a specific command, use\n\`thelp {command}\`\n\n` +
      `Need more help? Come join our guild\n[Join 666 Guild](${guildLink()})`,
    )
    .setFooter({ text: `${BRAND} • ${new Set(ENTRIES.map((entry) => entry.name)).size} commands` });
  if (client?.user?.displayAvatarURL) embed.setAuthor({ name: '666 ULTIMATE', iconURL: client.user.displayAvatarURL({ extension: 'png', size: 128 }) });
  for (const category of CATEGORIES) {
    embed.addFields({
      name: `${category.emoji} **${category.label}**`,
      value: commandsFor(category).map((name) => `\`${name}\``).join(' '),
      inline: false,
    });
  }
  return embed;
}

function categoryEmbed(category) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.ember || COLORS.flame)
    .setTitle(`${category.emoji} ${category.label.toUpperCase()} • COMMANDS`)
    .setDescription(`${category.blurb}\n${divider()}`)
    .setFooter({ text: `${BRAND} • thelp <command> untuk detail` });
  for (const entry of category.commands) {
    embed.addFields({
      name: `${entry.name}${entry.aliases?.length ? `  ·  ${entry.aliases.join(' / ')}` : ''}`,
      value: clip(`${entry.summary}\n\`${entry.usage}\``),
      inline: false,
    });
  }
  return embed;
}

function commandEmbed(input) {
  const entry = describe(input);
  if (!entry) return new EmbedBuilder().setColor(COLORS.error).setTitle('Command tidak ditemukan');
  const category = categoryOf(entry);
  const examples = (entry.examples || []).map((example) => `\`${example}\``).join('\n');
  const details = linesFor(entry).join('\n');
  const embed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle(`📖 ${entry.name}`)
    .setDescription(entry.summary || 'Tidak ada deskripsi.')
    .addFields({ name: '📌 Usage', value: clip(`\`${entry.usage || entry.name}\``), inline: false });
  if (entry.required?.length) embed.addFields({ name: '✅ Required', value: clip(entry.required.map((arg) => `\`${arg}\``).join(' ')), inline: true });
  if (entry.optional?.length) embed.addFields({ name: '🟡 Optional', value: clip(entry.optional.map((arg) => `\`${arg}\``).join(' ')), inline: true });
  embed.addFields(
    { name: '⏱️ Cooldown', value: entry.cooldown || '—', inline: true },
    { name: '🔐 Permission', value: entry.permission || 'Everyone', inline: true },
  );
  if (examples) embed.addFields({ name: '💡 Examples', value: clip(examples), inline: false });
  if (details) embed.addFields({ name: '📚 Subcommands', value: clip(details), inline: false });
  if (entry.aliases?.length) embed.addFields({ name: '🔗 Aliases', value: clip(entry.aliases.map((alias) => `\`${alias}\``).join(' ')), inline: false });
  if (entry.note) embed.addFields({ name: 'ℹ️ Note', value: clip(entry.note), inline: false });
  if (category) embed.addFields({ name: '🗂️ Category', value: `${category.emoji} ${category.label}`, inline: true });
  return embed.setFooter({ text: `${BRAND} • thelp untuk kembali` });
}

function searchEmbed(term, results) {
  const embed = new EmbedBuilder()
    .setColor(results.length ? COLORS.warning : COLORS.ash)
    .setTitle(`🔎 HASIL PENCARIAN: ${term}`)
    .setDescription(
      results.length
        ? results.map(commandLine).join('\n')
        : 'Tidak ada command yang cocok. Coba `thelp` untuk melihat semua kategori.',
    )
    .setFooter({ text: BRAND });
  return embed;
}

function helpSelect(currentCategoryId = null) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('rpg:help:select:0')
    .setPlaceholder('Pilih kategori command…')
    .setMinValues(1)
    .setMaxValues(1);
  const options = CATEGORIES.map((category) => {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(`${category.label} (${category.commands.length})`)
      .setDescription(clip(category.blurb, 100))
      .setEmoji(category.emoji)
      .setValue(category.id);
    if (category.id === currentCategoryId) option.setDefault(true);
    return option;
  });
  menu.addOptions(options);
  return menu;
}

function helpComponents(currentCategoryId = null) {
  const row = new ActionRowBuilder().addComponents(helpSelect(currentCategoryId));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rpg:help:home:0')
      .setLabel('Semua Kategori')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary),
  );
  if (process.env.SUPPORT_SERVER_URL) {
    buttons.addComponents(
      new ButtonBuilder()
        .setLabel('Join Guild')
        .setEmoji('🏰')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.SUPPORT_SERVER_URL),
    );
  }
  if (config.web.publicUrl) {
    buttons.addComponents(
      new ButtonBuilder()
        .setLabel('Buka Website')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(config.web.publicUrl),
    );
  }
  return [row, buttons];
}

function helpView(query = null, client = null) {
  const input = String(query || '').trim();
  if (!input) return { embeds: [overviewEmbed(client)], components: helpComponents() };

  const category = getCategory(input);
  if (category) return { embeds: [categoryEmbed(category)], components: helpComponents(category.id) };

  const entry = getEntry(input);
  if (entry) return { embeds: [commandEmbed(entry)], components: helpComponents(entry.category) };

  return { embeds: [searchEmbed(input, search(input))], components: helpComponents() };
}

async function handleHelpInteraction(interaction, action) {
  let query = null;
  if (action === 'select' && typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
    query = interaction.values?.[0] || null;
  } else if (action && action !== 'home') {
    query = action;
  }
  const payload = helpView(query, interaction.client);
  await interaction.editReply(payload);
}

module.exports = {
  overviewEmbed,
  categoryEmbed,
  commandEmbed,
  searchEmbed,
  helpComponents,
  helpView,
  handleHelpInteraction,
};
