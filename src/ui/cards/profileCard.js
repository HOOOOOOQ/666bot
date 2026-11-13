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
  drawDiamond,
  drawDivider,
  drawCrown,
  drawTrophy,
  drawDiamondIcon,
  drawCheck,
  drawProgressBar,
  drawAvatar,
  drawVignette,
  drawScanlines,
  drawEmbers,
  drawHeaderGlow,
  drawBottomFade,
  drawFlame,
  measureText,
  safeInitials,
  withAlpha,
} = require('./canvasTools');

const WIDTH = 1280;
const HEIGHT = 1280;

function displayName(member) {
  return member?.displayName || member?.username || 'Unknown';
}

function username(member) {
  return member?.username ? `@${member.username}` : '';
}

function memberStatus(entry) {
  if (!entry) return { completed: false, label: 'PENDING' };
  return entry.completed
    ? { completed: true, label: 'ACTIVE' }
    : { completed: false, label: 'PENDING' };
}

function activityCaption(today) {
  if (!today) return 'DAILY ACTIVITY DATA UNAVAILABLE';
  if (today.bothCompleted) return 'BOTH MEMBERS COMPLETED TODAY\u2019S ACTIVITY';
  if (!today.anyCompleted) return 'NO ACTIVITY RECORDED YET TODAY';
  const waiting = (today.missing || [])
    .map((member) => displayName(member).toUpperCase())
    .join(', ');
  return waiting ? `WAITING FOR ${waiting}` : 'DAILY ACTIVITY INCOMPLETE';
}

function drawHeader(ctx) {
  drawHeaderGlow(ctx, WIDTH, P.red, 0.42);

  drawCrown(ctx, WIDTH / 2, 56, 78, { glow: 24 });
  drawGradientText(ctx, '666', WIDTH / 2, 146, {
    size: 168,
    align: 'center',
    stops: [[0, '#ffffff'], [0.4, '#e7e9ee'], [0.72, '#9ca1aa'], [1, '#5f636b']],
    shadow: 38,
    shadowColor: P.redDeep,
    stroke: 'rgba(0,0,0,0.55)',
    strokeWidth: 6,
  });
  drawGradientText(ctx, 'DUO STREAK', WIDTH / 2, 247, {
    size: 98,
    align: 'center',
    stops: [[0, '#ff646b'], [0.42, P.red], [1, '#9c0715']],
    shadow: 26,
    shadowColor: P.red,
    stroke: 'rgba(0,0,0,0.5)',
    strokeWidth: 4,
  });
  drawSpacedText(ctx, 'TWO MEMBERS. ONE CONNECTION. ONE STREAK.', WIDTH / 2, 296, {
    size: 19,
    family: FONT.semi,
    color: withAlpha(P.white, 0.86),
    spacing: 3.2,
    shadow: 8,
    shadowColor: '#000',
  });

  drawDivider(ctx, WIDTH / 2, 318, 420);
}

function drawMemberPlate(ctx, entry, x, y, width) {
  const member = entry?.member || {};
  const status = memberStatus(entry);

  drawPanel(ctx, {
    x,
    y,
    w: width,
    h: 96,
    cut: 12,
    stroke: withAlpha(P.red, 0.85),
    strokeWidth: 1.4,
    glow: 14,
  });
  drawCornerBrackets(ctx, x + 3, y + 3, width - 6, 90, 12, withAlpha(P.redBright, 0.7), 1.4);

  drawText(ctx, displayName(member).toUpperCase(), x + width / 2, y + 31, {
    size: 33,
    family: FONT.display,
    color: P.white,
    align: 'center',
    maxWidth: width - 34,
    shadow: 10,
    shadowColor: '#000',
  });

  drawText(ctx, username(member), x + width / 2, y + 58, {
    size: 16,
    family: FONT.body,
    color: P.ash,
    align: 'center',
    maxWidth: width - 34,
  });

  const statusY = y + 78;
  const label = status.label;
  const color = status.completed ? P.redBright : P.flame;
  const textWidth = measureText(ctx, label, 15, FONT.semi, '600');

  if (status.completed) {
    drawCheck(ctx, x + width / 2 - textWidth / 2 - 14, statusY, 9, color);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + width / 2 - textWidth / 2 - 14, statusY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  drawSpacedText(ctx, label, x + width / 2 + 8, statusY, {
    size: 15,
    family: FONT.semi,
    weight: '600',
    color,
    spacing: 2.2,
    align: 'center',
  });
}

function drawStreak(ctx, duo) {
  const value = String(Number(duo.currentStreak) || 0);
  let size = 218;
  let width = measureText(ctx, value, size, FONT.display);
  while (width > 360 && size > 120) {
    size -= 10;
    width = measureText(ctx, value, size, FONT.display);
  }

  drawGradientText(ctx, value, WIDTH / 2, 462, {
    size,
    align: 'center',
    stops: [[0, '#ffffff'], [0.45, '#eff0f3'], [0.8, '#b9bdc5'], [1, '#757a83']],
    shadow: 44,
    shadowColor: P.redDeep,
    stroke: 'rgba(0,0,0,0.6)',
    strokeWidth: 5,
  });

  drawFlame(ctx, 448, 452, 74, { alpha: 0.92, glow: 26 });
  drawFlame(ctx, 832, 452, 74, { alpha: 0.92, glow: 26 });

  drawSpacedText(ctx, 'DAYS STREAK', WIDTH / 2, 570, {
    size: 45,
    family: FONT.display,
    color: P.redBright,
    spacing: 5,
    shadow: 20,
    shadowColor: P.redDeep,
  });
}

function drawTogetherBanner(ctx, duo, today) {
  const x = 240;
  const y = 672;
  const w = 800;
  const h = 110;

  drawPanel(ctx, { x, y, w, h, cut: 20, stroke: P.red, glow: 22, strokeWidth: 1.6 });
  drawFlame(ctx, x + 66, y + h / 2 - 2, 58, { alpha: 0.95, glow: 24 });

  drawText(ctx, `${Number(duo.totalDays) || 0} DAYS TOGETHER`, x + w / 2 + 18, y + 38, {
    size: 48,
    family: FONT.display,
    color: P.white,
    align: 'center',
    shadow: 16,
    shadowColor: '#000',
  });
  drawText(ctx, activityCaption(today), x + w / 2 + 18, y + 78, {
    size: 18,
    family: FONT.semi,
    weight: '600',
    color: today?.bothCompleted ? withAlpha(P.white, 0.85) : P.flameLight,
    align: 'center',
    maxWidth: w - 150,
  });

  drawDiamond(ctx, x + w - 34, y + h / 2, 6, P.red, true);
  drawDiamond(ctx, x + 34, y + h / 2, 6, P.red, false);
}

function drawStatPanel(ctx, options) {
  const { x, y, w, h, icon, label, value, accent } = options;
  drawPanel(ctx, { x, y, w, h, cut: 16, stroke: withAlpha(accent, 0.9), glow: 16 });
  drawCornerBrackets(ctx, x + 4, y + 4, w - 8, h - 8, 14, withAlpha(accent, 0.55), 1.2);

  if (icon === 'trophy') drawTrophy(ctx, x + 56, y + h / 2, 54, { color: P.gold, glow: 16 });
  else drawDiamondIcon(ctx, x + 56, y + h / 2, 34, { color: P.redBright, glow: 18 });

  drawSpacedText(ctx, label, x + 100, y + 46, {
    size: 16,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.4,
    align: 'left',
  });

  drawText(ctx, value, x + 100, y + 96, {
    size: 64,
    family: FONT.display,
    color: P.white,
    align: 'left',
    shadow: 18,
    shadowColor: P.redDeep,
    maxWidth: w - 130,
  });
}

function drawRewardProgress(ctx, duo, nextMilestone) {
  const x = 150;
  const y = 966;
  const w = 980;
  const h = 92;

  drawPanel(ctx, { x, y, w, h, cut: 14, stroke: withAlpha(P.red, 0.7), glow: 12 });

  if (!nextMilestone) {
    drawText(ctx, 'ALL BADGES UNLOCKED \u2014 ETERNAL STATUS', x + 34, y + h / 2, {
      size: 25,
      family: FONT.semi,
      color: P.gold,
      weight: '600',
    });
    drawCrown(ctx, x + w - 54, y + h / 2, 38, { jewel: P.gold });
    return;
  }

  const current = Number(duo.currentStreak) || 0;
  const target = Number(nextMilestone.days) || 1;

  drawSpacedText(ctx, 'NEXT REWARD', x + 34, y + 27, {
    size: 13,
    family: FONT.semi,
    color: P.ash,
    spacing: 2.6,
    align: 'left',
  });
  drawText(ctx, String(nextMilestone.name).toUpperCase(), x + 34, y + 55, {
    size: 30,
    family: FONT.display,
    color: P.white,
    maxWidth: 560,
  });
  drawText(ctx, `${current} / ${target}`, x + w - 34, y + 30, {
    size: 34,
    family: FONT.display,
    color: P.redBright,
    align: 'right',
    shadow: 12,
    shadowColor: P.redDeep,
  });
  drawText(ctx, `${Math.max(0, target - current)} DAYS TO GO`, x + w - 34, y + 60, {
    size: 14,
    family: FONT.semi,
    color: P.ash,
    align: 'right',
  });

  drawProgressBar(ctx, {
    x: x + 34,
    y: y + 72,
    w: w - 68,
    h: 10,
    value: current,
    max: target,
    ticks: 12,
  });
}

function drawFooter(ctx, timezone) {
  drawDivider(ctx, WIDTH / 2, 1100, 620);
  drawCrown(ctx, WIDTH / 2, 1136, 42, { jewel: P.silver });
  drawSpacedText(ctx, '666 SYSTEM', WIDTH / 2, 1178, {
    size: 34,
    family: FONT.display,
    color: P.white,
    spacing: 4,
    shadow: 18,
    shadowColor: P.redDeep,
  });

  drawText(ctx, `DUO CONNECTION \u2022 ${String(timezone || 'Asia/Jakarta').toUpperCase()}`, WIDTH / 2, 1214, {
    size: 14,
    family: FONT.semi,
    color: P.ashDark,
    align: 'center',
  });
}

/**
 * Renders the Duo profile card.
 *
 * @param {object} data
 * @param {object} data.duo
 * @param {Array} data.members hydrated members (userId, username, displayName, avatar)
 * @param {object} data.today
 * @param {object} [data.rewardSummary]
 * @param {object|null} [data.nextMilestone]
 * @param {string} [data.timezone]
 * @param {Map<string, import('@napi-rs/canvas').Image>} [data.avatars]
 * @returns {Promise<Buffer>}
 */
async function renderProfileCard({
  duo, members, today, rewardSummary, nextMilestone, timezone, avatars = new Map(),
}) {
  const background = await loadBackground('profile-bg.png');
  const { canvas, ctx } = createCard(WIDTH, HEIGHT);

  drawCover(ctx, background, WIDTH, HEIGHT);
  drawBottomFade(ctx, WIDTH, HEIGHT, 0.84);
  drawEmbers(ctx, WIDTH, HEIGHT, { count: 34, seed: 0x666, area: [0, 320, WIDTH, 900] });
  drawHeader(ctx);

  const [entryA, entryB] = Array.isArray(today?.members) && today.members.length === 2
    ? today.members
    : members.map((member) => ({ member, completed: false }));

  const memberA = entryA.member || members[0] || { displayName: 'Unknown', userId: '0' };
  const memberB = entryB.member || members[1] || { displayName: 'Unknown', userId: '1' };

  drawCrown(ctx, 245, 316, 44, { glow: 18 });
  drawCrown(ctx, 1035, 316, 44, { glow: 18 });

  drawAvatar(ctx, avatars.get(String(memberA.userId)) || null, 245, 440, 108, {
    ring: P.red,
    glow: 34,
    initials: safeInitials(displayName(memberA)),
    fallbackSeed: 11,
  });
  drawAvatar(ctx, avatars.get(String(memberB.userId)) || null, 1035, 440, 108, {
    ring: P.red,
    glow: 34,
    initials: safeInitials(displayName(memberB)),
    fallbackSeed: 29,
  });

  drawMemberPlate(ctx, entryA, 75, 566, 340);
  drawMemberPlate(ctx, entryB, 865, 566, 340);

  drawStreak(ctx, duo);
  drawTogetherBanner(ctx, duo, today);

  drawStatPanel(ctx, {
    x: 150,
    y: 806,
    w: 460,
    h: 140,
    icon: 'trophy',
    label: 'BEST STREAK',
    value: `${Number(duo.bestStreak) || 0} DAYS`,
    accent: P.gold,
  });
  drawStatPanel(ctx, {
    x: 670,
    y: 806,
    w: 460,
    h: 140,
    icon: 'diamond',
    label: 'DUO XP',
    value: `${Number(duo.xp || 0).toLocaleString('en-US')} XP`,
    accent: P.red,
  });

  drawRewardProgress(ctx, duo, nextMilestone);
  drawFooter(ctx, timezone);

  // Consistent film finish.
  drawScanlines(ctx, WIDTH, HEIGHT, 0.022);
  drawVignette(ctx, WIDTH, HEIGHT, 0.7);

  return canvas.toBuffer('image/png');
}

module.exports = { renderProfileCard, WIDTH, HEIGHT };
