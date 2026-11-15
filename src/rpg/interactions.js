'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../ui/theme');
const battleService = require('./services/battleService');
const tradeService = require('./services/tradeService');
const gameService = require('./services/minigameService');
const { battleResultEmbed, tradeEmbed, blackjackButtons, BRAND, money } = require('./ui/embeds');
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
    await interaction.editReply({ embeds: [battleResultEmbed(result)], components: [] });
    return;
  }
  if (action === 'decline') {
    await battleService.decline(interaction.guildId, interaction.user.id, id);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.ash).setTitle('❌ TANTANGAN DITOLAK').setDescription('Tantangan battle ditolak.').setFooter({ text: BRAND })],
      components: [],
    });
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
  if (!result.finished) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.flame)
      .setTitle('🃏 BLACKJACK')
      .addFields(
        { name: `Kamu (${result.playerValue})`, value: fmtCards(result.player), inline: true },
        { name: `Dealer (${result.dealerValue})`, value: fmtCards(result.dealer, true), inline: true },
      )
      .setFooter({ text: BRAND });
    await interaction.editReply({ embeds: [embed], components: [blackjackButtons(id)] });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(result.result === 'win' ? COLORS.success : result.result === 'push' ? COLORS.warning : COLORS.error)
    .setTitle(result.result === 'win' ? '🏆 BLACKJACK WIN' : result.result === 'push' ? '🤝 PUSH' : '💀 BLACKJACK LOSE')
    .addFields(
      { name: `Kamu (${result.playerValue})`, value: fmtCards(result.player), inline: true },
      { name: `Dealer (${result.dealerValue})`, value: fmtCards(result.dealer), inline: true },
    )
    .setDescription(`Payout: **${money(result.payout)}**`)
    .setFooter({ text: BRAND });
  await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleTrivia(interaction, id, index) {
  const result = await gameService.answerTrivia(interaction.guildId, interaction.user.id, id, Number(index));
  const embed = new EmbedBuilder()
    .setColor(result.correct ? COLORS.success : COLORS.error)
    .setTitle(result.correct ? '✅ TRIVIA BENAR' : '❌ TRIVIA SALAH')
    .setDescription(`**${result.question}**\nJawaban: **${result.options[result.answer]}**\nPayout: **${money(result.amount)}**`)
    .setFooter({ text: BRAND });
  await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleRps(interaction, id, choice) {
  const result = await gameService.rpsChoose(interaction.guildId, interaction.user.id, id, choice);
  if (result.waiting) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle('✊ MENUNGGU LAWAN')
        .setDescription(`Kamu memilih **${result.mine || 'secara rahasia'}**. Menunggu lawan memilih.`)
        .setFooter({ text: BRAND })],
    });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(result.winner ? COLORS.success : COLORS.warning)
    .setTitle('✊✋✌️ RPS RESULT')
    .setDescription(result.winner ? `<@${result.winner}> MENANG! Payout: **${money(result.pot)}**` : 'Seri! Bet dikembalikan ke kedua pemain.')
    .addFields(
      { name: 'Pilihan A', value: result.choices?.[Object.keys(result.choices)[0]] || '—', inline: true },
      { name: 'Pilihan B', value: result.choices?.[Object.keys(result.choices)[1]] || '—', inline: true },
    )
    .setFooter({ text: BRAND });
  await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleRPGInteraction(interaction) {
  if (!isRPGInteraction(interaction.customId)) return false;
  const parts = interaction.customId.split(':');
  const [, feature, action, id] = parts;
  await interaction.deferUpdate().catch(() => {});
  try {
    if (feature === 'battle') await handleBattle(interaction, action, id);
    else if (feature === 'trade') await handleTrade(interaction, action, id);
    else if (feature === 'bj') await handleBlackjack(interaction, action, id);
    else if (feature === 'trivia') await handleTrivia(interaction, action, id);
    else if (feature === 'rps') await handleRps(interaction, action, id);
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
