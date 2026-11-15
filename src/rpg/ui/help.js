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
} = require('../help/catalog');

const FIELD_LIMIT = 1024;

function clip(text, limit = FIELD_LIMIT) {
  const value = String(text || '');
  return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function commandLine(entry) {
  return `\`${entry.name}\` — ${entry.summary}`;
}

function overviewEmbed() {
  const embed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle('📖 666 ULTIMATE RPG • PUSAT BANTUAN')
    .setDescription(
      `Prefix \`6\` • pilih kategori di menu, atau ketik \`6help <command>\` untuk detail.\n` +
      `Contoh: \`6help cash\`, \`6help battle\`, \`6help economy\`.\n${divider()}`,
    )
    .setFooter({ text: `${BRAND} • ${ENTRIES.length} command terdokumentasi` });
  for (const category of CATEGORIES) {
    embed.addFields({
      name: `${category.emoji} ${category.label}`,
      value: clip(category.commands.map(commandLine).join('\n')),
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
    .setFooter({ text: `${BRAND} • 6help <command> untuk detail` });
  for (const entry of category.commands) {
    embed.addFields({
      name: `${entry.name}${entry.aliases?.length ? `  ·  ${entry.aliases.join(' / ')}` : ''}`,
      value: clip(`${entry.summary}\n\`${entry.usage}\``),
      inline: false,
    });
  }
  return embed;
}

function commandEmbed(entry) {
  const category = categoryOf(entry);
  const examples = (entry.examples || []).map((example) => `\`${example}\``).join('\n');
  const details = linesFor(entry).join('\n');
  const embed = new EmbedBuilder()
    .setColor(COLORS.flame)
    .setTitle(`📖 ${entry.name}`)
    .setDescription(entry.summary)
    .addFields(
      { name: '📌 Cara pakai', value: clip(`\`${entry.usage}\``), inline: false },
      { name: '📚 Subcommand', value: clip(details || '—'), inline: false },
    );
  if (examples) embed.addFields({ name: '💡 Contoh', value: clip(examples), inline: false });
  if (entry.note) embed.addFields({ name: 'ℹ️ Catatan', value: clip(entry.note), inline: false });
  const meta = [];
  if (category) meta.push(`${category.emoji} ${category.label}`);
  if (entry.aliases?.length) meta.push(`Alias: ${entry.aliases.join(', ')}`);
  if (meta.length) embed.addFields({ name: '🔗 Terkait', value: meta.join(' • '), inline: false });
  return embed.setFooter({ text: `${BRAND} • 6help untuk kembali` });
}

function searchEmbed(term, results) {
  const embed = new EmbedBuilder()
    .setColor(results.length ? COLORS.warning : COLORS.ash)
    .setTitle(`🔎 HASIL PENCARIAN: ${term}`)
    .setDescription(
      results.length
        ? results.map(commandLine).join('\n')
        : 'Tidak ada command yang cocok. Coba `6help` untuk melihat semua kategori.',
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

function helpView(query = null) {
  const input = String(query || '').trim();
  if (!input) return { embeds: [overviewEmbed()], components: helpComponents() };

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
  const payload = helpView(query);
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
