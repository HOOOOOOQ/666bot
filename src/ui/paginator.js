'use strict';

const { randomUUID } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

function clampPage(page, pageCount) {
  return Math.min(Math.max(0, page), Math.max(0, pageCount - 1));
}

function buildRow(token, page, pageCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pg:${token}:prev`)
      .setLabel('‹ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`pg:${token}:page`)
      .setLabel(`${page + 1} / ${pageCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`pg:${token}:next`)
      .setLabel('Next ›')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pageCount - 1),
    new ButtonBuilder()
      .setCustomId(`pg:${token}:close`)
      .setLabel('✖')
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Renders paginated embeds with Prev/Next buttons.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {(page: number) => Promise<import('discord.js').EmbedBuilder>} render
 * @param {{pageCount:number, page?:number, ephemeral?:boolean, timeoutMs?:number}} options
 */
async function paginate(interaction, render, { pageCount, page = 0, ephemeral = false, timeoutMs = 120000 } = {}) {
  const token = randomUUID().slice(0, 8);
  const safePageCount = Math.max(1, Number(pageCount) || 1);
  let currentPage = clampPage(Number(page) || 0, safePageCount);

  const buildPayload = async (targetPage) => {
    const embed = await render(targetPage);
    return {
      embeds: [embed],
      components: safePageCount > 1 ? [buildRow(token, targetPage, safePageCount)] : [],
    };
  };

  const firstPayload = await buildPayload(currentPage);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(firstPayload);
  } else {
    await interaction.reply({
      ...firstPayload,
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
  }

  if (safePageCount <= 1) return;

  const message = await interaction.fetchReply().catch(() => null);
  if (!message) return;

  const collector = message.createMessageComponentCollector({
    filter: (component) => component.customId?.startsWith(`pg:${token}:`),
    time: timeoutMs,
  });

  collector.on('collect', async (component) => {
    if (component.user.id !== interaction.user.id) {
      await component.reply({
        content: 'Hanya pengguna yang menjalankan command ini yang bisa mengganti halaman.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const action = component.customId.split(':')[2];

    if (action === 'close') {
      collector.stop('closed');
      await component.update({ components: [] }).catch(() => {});
      return;
    }

    if (action === 'prev') currentPage = clampPage(currentPage - 1, safePageCount);
    else if (action === 'next') currentPage = clampPage(currentPage + 1, safePageCount);
    else return;

    const payload = await buildPayload(currentPage);
    await component.update(payload).catch(() => {});
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'closed') return;
    try {
      await interaction.editReply({ components: [] });
    } catch {
      /* message deleted / interaction expired */
    }
  });
}

module.exports = { paginate, clampPage, buildRow };
