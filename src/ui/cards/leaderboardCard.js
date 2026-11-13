'use strict';

const {
  P,
  FONT,
  createCard,
  loadBackground,
  drawCover,
  drawText,
  drawSpacedText,
  drawGradientText,
  drawPanel,
  drawCornerBrackets,
  drawLine,
  drawDivider,
  drawCrown,
  drawFlame,
  drawTrophy,
  drawAvatar,
  drawVignette,
  drawScanlines,
  drawEmbers,
  drawHeaderGlow,
  drawBottomFade,
  drawDiamond,
  measureText,
  safeInitials,
  withAlpha,
} = require('./canvasTools');

const WIDTH = 1280;
const HEIGHT = 1280;
const PAGE_ROWS = 10;

const RANK_STYLES = [
  { accent: P.gold, deep: P.goldDeep, glow: 26, label: P.gold },
  { accent: P.silver, deep: P.silverDeep, glow: 20, label: P.silver },
  { accent: P.bronze, deep: P.bronzeDeep, glow: 20, label: P.bronze },
];

function rankStyle(rank) {
  if (rank <= 3) return RANK_STYLES[rank - 1];
  return { accent: P.red, deep: P.redDark, glow: 12, label: withAlpha(P.white, 0.9) };
}

function displayName(member) {
  return member?.displayName || member?.username || 'Unknown';
}

function drawHeader(ctx, { page, pageCount, total }) {
  drawHeaderGlow(ctx, WIDTH, P.red, 0.5);

  drawCrown(ctx, WIDTH / 2, 60, 72, { glow: 22 });

  // "666" silver + "DUO STREAK" red, centered as one lockup.
  const size = 96;
  const silver = '666';
  const red = 'DUO STREAK';
  const gap = 16;
  const silverWidth = measureText(ctx, silver, size, FONT.display);
  const redWidth = measureText(ctx, red, size, FONT.display);
  const startX = WIDTH / 2 - (silverWidth + gap + redWidth) / 2;

  drawGradientText(ctx, silver, startX, 148, {
    size,
    align: 'left',
    stops: [[0, '#ffffff'], [0.45, '#e2e4e9'], [0.8, '#9b9fa8'], [1, '#6c7079']],
    shadow: 30,
    shadowColor: P.redDeep,
    stroke: 'rgba(0,0,0,0.55)',
    strokeWidth: 5,
  });
  drawGradientText(ctx, red, startX + silverWidth + gap, 148, {
    size,
    align: 'left',
    stops: [[0, '#ff6a70'], [0.45, P.red], [1, '#9b0613']],
    shadow: 24,
    shadowColor: P.red,
    stroke: 'rgba(0,0,0,0.5)',
    strokeWidth: 4,
  });

  drawSpacedText(ctx, 'LEADERBOARD', WIDTH / 2, 224, {
    size: 46,
    family: FONT.display,
    color: P.white,
    spacing: 8,
    shadow: 18,
    shadowColor: P.redDeep,
  });

  drawText(ctx, 'TWO MEMBERS. ONE CONNECTION. ONE STREAK.', WIDTH / 2, 264, {
    size: 18,
    family: FONT.semi,
    color: withAlpha(P.white, 0.78),
    align: 'center',
  });

  drawDivider(ctx, WIDTH / 2, 292, 520);
}

function drawHeaderRow(ctx) {
  drawSpacedText(ctx, 'RANK', 132, 352, {
    size: 13,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.4,
    align: 'center',
  });

  drawSpacedText(ctx, 'DUO', 300, 352, {
    size: 13,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.4,
    align: 'left',
  });

  drawFlame(ctx, 838, 352, 18, { glow: 8 });
  drawSpacedText(ctx, 'CURRENT STREAK', 918, 352, {
    size: 13,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.2,
    align: 'center',
  });

  drawTrophy(ctx, 1034, 352, 17, { color: P.ash, glow: 0 });
  drawSpacedText(ctx, 'BEST STREAK', 1112, 352, {
    size: 13,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.2,
    align: 'center',
  });

  drawLine(ctx, 84, 378, 1196, 378, withAlpha(P.red, 0.45), 1, 6);
}

function drawRankBadge(ctx, rank, cx, cy, style) {
  if (rank <= 3) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,4,5,0.9)';
    ctx.fill();
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = style.glow;
    ctx.stroke();
    ctx.restore();

    if (rank === 1) drawCrown(ctx, cx, cy - 27, 22, { glow: 12, jewel: P.gold });

    drawText(ctx, String(rank), cx, cy + 1, {
      size: 36,
      family: FONT.display,
      color: style.accent,
      align: 'center',
      shadow: 14,
      shadowColor: style.deep,
    });
    return;
  }

  drawText(ctx, String(rank).padStart(2, '0'), cx, cy, {
    size: 34,
    family: FONT.display,
    color: withAlpha(P.white, 0.82),
    align: 'center',
  });
}

function drawRow(ctx, options) {
  const {
    rank, duo, members, y, avatars,
  } = options;
  const style = rankStyle(rank);
  const x = 80;
  const w = 1120;
  const h = 72;

  drawPanel(ctx, {
    x,
    y,
    w,
    h,
    cut: 10,
    fill: rank <= 3 ? `rgba(22,14,8,0.72)` : 'rgba(8,5,7,0.72)',
    stroke: withAlpha(style.accent, rank <= 3 ? 0.72 : 0.28),
    strokeWidth: rank <= 3 ? 1.6 : 1,
    glow: rank <= 3 ? style.glow : 0,
  });

  // Left accent bar
  ctx.save();
  ctx.fillStyle = style.accent;
  ctx.shadowColor = style.accent;
  ctx.shadowBlur = rank <= 3 ? 16 : 0;
  ctx.fillRect(x + 1, y + 14, 4, h - 28);
  ctx.restore();

  const centerY = y + h / 2;
  drawRankBadge(ctx, rank, 132, centerY, style);

  const [memberA, memberB] = members;
  const ring = rank <= 3 ? style.accent : withAlpha(P.red, 0.85);

  drawAvatar(ctx, avatars.get(String(memberA?.userId)) || null, 205, centerY, 26, {
    ring,
    glow: rank <= 3 ? 18 : 10,
    ringWidth: 2,
    initials: safeInitials(displayName(memberA)),
    fallbackSeed: rank * 7 + 1,
  });
  drawAvatar(ctx, avatars.get(String(memberB?.userId)) || null, 252, centerY, 26, {
    ring,
    glow: rank <= 3 ? 18 : 10,
    ringWidth: 2,
    initials: safeInitials(displayName(memberB)),
    fallbackSeed: rank * 13 + 5,
  });

  drawText(ctx, duo.name, 302, centerY - 12, {
    size: 34,
    family: FONT.display,
    color: P.white,
    maxWidth: 470,
    shadow: 10,
    shadowColor: '#000',
  });

  const totalDays = Number(duo.totalDays) || 0;
  const xp = Number(duo.xp) || 0;
  drawText(ctx, `${totalDays} TOTAL DAYS  \u2022  ${xp.toLocaleString('en-US')} XP`, 302, centerY + 18, {
    size: 15,
    family: FONT.body,
    color: withAlpha(P.ash, 0.9),
    maxWidth: 470,
  });

  drawFlame(ctx, 858, centerY, 30, { glow: 16, alpha: 0.95 });
  drawText(ctx, String(Number(duo.currentStreak) || 0), 922, centerY, {
    size: 42,
    family: FONT.display,
    color: rank <= 3 ? style.accent : P.white,
    align: 'center',
    shadow: rank <= 3 ? 16 : 8,
    shadowColor: style.deep,
  });

  drawTrophy(ctx, 1052, centerY, 28, {
    color: rank <= 3 ? style.accent : P.gold,
    glow: rank <= 3 ? 14 : 8,
  });
  drawText(ctx, String(Number(duo.bestStreak) || 0), 1120, centerY, {
    size: 42,
    family: FONT.display,
    color: P.white,
    align: 'center',
    shadow: 8,
    shadowColor: P.redDeep,
  });
}

function drawEmptyState(ctx, y) {
  drawText(ctx, 'NO DUO HAS REACHED THIS PAGE YET', WIDTH / 2, y, {
    size: 26,
    family: FONT.semi,
    color: P.ashDark,
    align: 'center',
  });
}

function drawFooter(ctx, { page, pageCount, total }) {
  drawDivider(ctx, WIDTH / 2, 1206, 560);

  drawSpacedText(ctx, 'DUO STREAK LEADERBOARD', 120, 1240, {
    size: 13,
    family: FONT.semi,
    color: P.ash,
    spacing: 2.2,
    align: 'left',
  });

  drawCrown(ctx, WIDTH / 2, 1228, 30, { jewel: P.silver, glow: 12 });
  drawSpacedText(ctx, '666 SYSTEM', WIDTH / 2, 1252, {
    size: 22,
    family: FONT.display,
    color: P.white,
    spacing: 3,
    shadow: 12,
    shadowColor: P.redDeep,
  });

  drawSpacedText(ctx, `PAGE ${page + 1}/${pageCount}  \u2022  ${total} DUOS`, 1160, 1240, {
    size: 13,
    family: FONT.semi,
    color: P.ash,
    spacing: 1.6,
    align: 'right',
  });

  drawDiamond(ctx, 286, 1240, 4, withAlpha(P.red, 0.8), false);
  drawDiamond(ctx, 994, 1240, 4, withAlpha(P.red, 0.8), false);
}

/**
 * Renders one leaderboard page as a 1280x1280 image.
 *
 * @param {object} data
 * @param {Array<{duo: object, members: Array}>} data.entries
 * @param {number} data.page zero based
 * @param {number} data.pageCount
 * @param {number} data.total
 * @param {Map<string, import('@napi-rs/canvas').Image>} [data.avatars]
 * @returns {Promise<Buffer>}
 */
async function renderLeaderboardCard({
  entries, page, pageCount, total, avatars = new Map(),
}) {
  const background = await loadBackground('leaderboard-bg.png');
  const { canvas, ctx } = createCard(WIDTH, HEIGHT);

  drawCover(ctx, background, WIDTH, HEIGHT);

  // Darken header art enough for the typography, keep the characters visible.
  const header = ctx.createLinearGradient(0, 0, 0, 340);
  header.addColorStop(0, 'rgba(0,0,0,0.72)');
  header.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  header.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.save();
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, WIDTH, 340);
  ctx.restore();

  drawBottomFade(ctx, WIDTH, HEIGHT, 0.7);
  drawEmbers(ctx, WIDTH, HEIGHT, { count: 30, seed: 0x999, area: [60, 300, WIDTH - 120, 880] });

  drawHeader(ctx, { page, pageCount, total });

  // Table frame
  drawPanel(ctx, {
    x: 58,
    y: 326,
    w: 1164,
    h: 862,
    cut: 20,
    fill: 'rgba(4,2,3,0.58)',
    stroke: withAlpha(P.red, 0.7),
    strokeWidth: 1.6,
    glow: 18,
  });
  drawCornerBrackets(ctx, 66, 334, 1148, 846, 28, withAlpha(P.redBright, 0.65), 1.6);

  drawHeaderRow(ctx);

  const safeEntries = entries.slice(0, PAGE_ROWS);
  const rowStart = 396;
  const rowStep = 76;

  safeEntries.forEach((entry, index) => {
    drawRow(ctx, {
      rank: page * PAGE_ROWS + index + 1,
      duo: entry.duo,
      members: entry.members,
      y: rowStart + index * rowStep,
      avatars,
    });
  });

  if (!safeEntries.length) drawEmptyState(ctx, 600);
  else if (safeEntries.length < PAGE_ROWS && page === pageCount - 1) {
    drawText(
      ctx,
      `\u2014 END OF RANKING \u2022 ${total} DUOS \u2014`,
      WIDTH / 2,
      1150,
      {
        size: 12,
        family: FONT.semi,
        color: P.ashDark,
        align: 'center',
      },
    );
  }

  drawFooter(ctx, { page, pageCount, total });

  drawScanlines(ctx, WIDTH, HEIGHT, 0.02);
  drawVignette(ctx, WIDTH, HEIGHT, 0.68);

  return canvas.toBuffer('image/png');
}

module.exports = { renderLeaderboardCard, WIDTH, HEIGHT, PAGE_ROWS };
