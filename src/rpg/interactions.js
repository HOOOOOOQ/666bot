'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../ui/theme');
const battleService = require('./services/battleService');
const tradeService = require('./services/tradeService');
const gameService = require('./services/minigameService');
const { handleHelpInteraction } = require('./ui/help');
const { tradeEmbed, blackjackButtons, triviaButtons, rpsButtons, inventoryEmbed, monsterListEmbed, BRAND, money } = require('./ui/embeds');
const { battleResultView, blackjackView, triviaView, mineView } = require('./ui/responseViews');
const { toPayload, paginationButtons } = require('./ui/response');
const shopService = require('./services/shopService');
const huntingService = require('./services/huntingService');
const { createLogger } = require('../utils/logger');
const { UserError } = require('../utils/errors');

const log = createLogger('rpg-interaction');

function isRPGInteraction(customId) {
  return typeof customId === 'string' && customId.startsWith('rpg:');
}

function fmtCards(cards, hide = false) {
  return gameService.formatCards(cards, hide);
}

async function handleBattle(interaction, action, id) {
  if (action === 'accept') {
    const result = await battleService.accept(interaction.guildId, interaction.user.id, id, {
      username: interaction.user.username,
      avatar: interaction.user.displayAvatarURL?.({ extension: 'png' }),
    });
    await interaction.editReply({ ...toPayload(battleResultView(result)) });
    return;
  }
  if (action === 'decline') {
    await battleService.decline(interaction.guildId, interaction.user.id, id);
    await interaction.editReply({ content: '❌ | Tantangan battle ditolak.', embeds: [], components: [] });
  }
}

async function handleTrade(interaction, action, id) {
  if (action === 'accept' || action === 'decline') {
    const trade = await tradeService.respond(interaction.guildId, interaction.user.id, id, action === 'accept');
    await interaction.editReply({
      embeds: [tradeEmbed(trade, `<@${trade.initiatorId}>`, `<@${trade.targetId}>`)],
      components: action === 'accept' ? [require('./ui/embeds').tradeButtons(String(trade._id), false)] : [],
    });
    return;
  }
  if (action === 'confirm') {
    const result = await tradeService.confirm(interaction.guildId, interaction.user.id, id);
    const embed = new EmbedBuilder()
      .setColor(result.waiting ? COLORS.warning : COLORS.success)
      .setTitle(result.waiting ? '🤝 MENUNGGU CONFIRM' : '✅ TRADE SELESAI')
      .setDescription(result.waiting ? 'Konfirmasi tercatat. Menunggu pihak lain menekan Confirm.' : 'Trade selesai. Item dan koin sudah dipindahkan secara aman.')
      .setFooter({ text: BRAND });
    await interaction.editReply({ embeds: [embed], components: result.waiting ? [require('./ui/embeds').tradeButtons(id, false)] : [] });
    return;
  }
  if (action === 'cancel') {
    await tradeService.cancel(interaction.guildId, interaction.user.id, id);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.ash).setTitle('✖️ TRADE DIBATALKAN').setDescription('Item dikembalikan ke pemilik.').setFooter({ text: BRAND })],
      components: [],
    });
  }
}

async function handleBlackjack(interaction, action, id) {
  const result = await gameService.blackjackAction(interaction.guildId, interaction.user.id, id, action);
  const view = blackjackView({
    userId: interaction.user.id,
    playerValue: result.playerValue,
    dealerValue: result.finished ? result.dealerValue : 0,
    playerText: fmtCards(result.player),
    dealerText: result.finished ? fmtCards(result.dealer) : '🂠 🂠',
    finished: result.finished,
    payout: result.payout,
    bet: result.bet,
    result: result.result,
  });
  await interaction.editReply({
    ...toPayload(view),
    components: result.finished ? [] : [blackjackButtons(id)],
  });
}

async function handleTrivia(interaction, id, index) {
  const result = await gameService.answerTrivia(interaction.guildId, interaction.user.id, id, Number(index));
  const view = triviaView({
    userId: interaction.user.id,
    question: result.question,
    options: result.options,
    answer: result.answer,
    correct: result.correct,
    amount: result.amount,
    finished: true,
  });
  await interaction.editReply({ ...toPayload(view), components: [] });
}

async function handleRps(interaction, id, choice) {
  const result = await gameService.rpsChoose(interaction.guildId, interaction.user.id, id, choice);
  if (result.waiting) {
    await interaction.editReply({ content: `✊ | Kamu memilih **${result.mine || 'secara rahasia'}**. Menunggu lawan memilih.`, embeds: [], components: [rpsButtons(id)] });
    return;
  }
  const choices = result.choices || {};
  const keys = Object.keys(choices);
  await interaction.editReply({
    content: result.winner
      ? `🏆 | <@${result.winner}> **MENANG!** Payout: **${money(result.pot)}**\nPilihan: **${choices[keys[0]] || '—'}** vs **${choices[keys[1]] || '—'}**`
      : `🤝 | Seri! Bet dikembalikan ke kedua pemain.\nPilihan: **${choices[keys[0]] || '—'}** vs **${choices[keys[1]] || '—'}**`,
    embeds: [],
    components: [],
  });
}

async function handleMine(interaction, action, sessionId, index) {
  const userId = interaction.user.id;
  if (action === 'reveal') {
    const result = await gameService.revealMine(interaction.guildId, userId, sessionId, index);
    const ended = Boolean(result.hit) || result.session?.status !== 'active';
    await interaction.editReply({
      ...toPayload(mineView({
        sessionId,
        userId,
        state: result.state,
        ended,
        result: result.hit ? 'hit' : null,
      })),
    });
    return;
  }
  if (action === 'cash') {
    const result = await gameService.cashOutMines(interaction.guildId, userId, sessionId);
    await interaction.editReply({
      ...toPayload(mineView({
        sessionId,
        userId,
        state: { ...result.state, reward: result.reward },
        ended: true,
        result: 'cashout',
      })),
    });
    return;
  }
  throw new UserError('Aksi mines tidak dikenali.');
}

async function handleInventory(interaction, ownerId, page) {
  if (String(interaction.user.id) !== String(ownerId)) throw new UserError('Inventory ini bukan milikmu.');
  const all = await shopService.inventory(interaction.guildId, ownerId);
  const perPage = 8;
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  const items = all.slice((current - 1) * perPage, current * perPage);
  await interaction.editReply({
    embeds: [inventoryEmbed({ items, page: current, pages, total: all.length })],
    components: pages > 1 ? [paginationButtons({ ownerId, page: current, pages })] : [],
  });
}

async function handleHuntInventory(interaction, ownerId, page) {
  if (String(interaction.user.id) !== String(ownerId)) throw new UserError('Kandang ini bukan milikmu.');
  const data = await huntingService.inventory(interaction.guildId, ownerId, Number(page) || 1, 8);
  await interaction.editReply({
    embeds: [monsterListEmbed(data)],
    components: data.pages > 1 ? [paginationButtons({ prefix: 'huntinv', ownerId, page: data.page, pages: data.pages })] : [],
  });
}

async function handleRPGInteraction(interaction) {
  if (!isRPGInteraction(interaction.customId)) return false;
  const parts = interaction.customId.split(':');
  const [, feature, action, id, extra] = parts;
  await interaction.deferUpdate().catch(() => {});
  try {
    if (feature === 'help') await handleHelpInteraction(interaction, action);
    else if (feature === 'battle') await handleBattle(interaction, action, id);
    else if (feature === 'trade') await handleTrade(interaction, action, id);
    else if (feature === 'bj') await handleBlackjack(interaction, action, id);
    else if (feature === 'trivia') await handleTrivia(interaction, action, id);
    else if (feature === 'rps') await handleRps(interaction, action, id);
    else if (feature === 'inv') await handleInventory(interaction, action, id);
    else if (feature === 'huntinv') await handleHuntInventory(interaction, action, id);
    else if (feature === 'mine') await handleMine(interaction, action, id, extra);
    else throw new UserError('Tombol ini tidak dikenali.');
    return true;
  } catch (error) {
    const isUser = error instanceof UserError;
    if (!isUser) log.error(`RPG button failed (${interaction.customId}).`, error);
    const embed = new EmbedBuilder().setColor(COLORS.error).setTitle(isUser ? 'Tidak Bisa Diproses' : 'Internal Error')
      .setDescription(isUser ? error.message : 'Terjadi kesalahan. Coba lagi.').setFooter({ text: BRAND });
    await interaction.editReply({ embeds: [embed] }).catch(() => {});
    return true;
  }
}

module.exports = { isRPGInteraction, handleRPGInteraction };
