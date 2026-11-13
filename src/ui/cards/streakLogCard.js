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
  drawDivider,
  drawLine,
  drawCrown,
  drawFlame,
  drawTrophy,
  drawDiamondIcon,
  drawCheck,
  drawAvatar,
  drawVignette,
  drawScanlines,
  drawEmbers,
  drawHeaderGlow,
  setFont,
  measureText,
  safeInitials,
  withAlpha,
} = require('./canvasTools');

const WIDTH = 1280;
const HEIGHT = 720;

function displayName(member) {
  return member?.displayName || member?.username || 'Unknown';
}

function username(member) {
  return member?.username ? `@${member.username}` : '';
}

function formatTimestamp(value, timezone) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date).replace(',', ' \u2022');
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function drawHeader(ctx) {
  drawHeaderGlow(ctx, WIDTH, P.red, 0.32);

  drawCrown(ctx, WIDTH / 2, 50, 42, { jewel: P.gold, glow: 16 });

  const size = 54;
  const partA = '666';
  const partB = 'DUO STREAK UPDATED';
  const gap = 14;
  const widthA = measureText(ctx, partA, size, FONT.display);
  const widthB = measureText(ctx, partB, size, FONT.display);
  const startX = WIDTH / 2 - (widthA + gap + widthB) / 2;

  drawGradientText(ctx, partA, startX, 107, {
    size,
    align: 'left',
    stops: [[0, '#ffffff'], [0.5, '#dfe1e6'], [1, '#8f939b']],
    shadow: 22,
    shadowColor: P.redDeep,
    stroke: 'rgba(0,0,0,0.6)',
    strokeWidth: 3,
  });
  drawGradientText(ctx, partB, startX + widthA + gap, 107, {
    size,
    align: 'left',
    stops: [[0, '#ff6b72'], [0.5, P.red], [1, '#9a0714']],
    shadow: 18,
    shadowColor: P.red,
    stroke: 'rgba(0,0,0,0.5)',
    strokeWidth: 2.5,
  });

  drawSpacedText(ctx, 'AUTOMATIC STREAK LOG', WIDTH / 2, 148, {
    size: 13,
    family: FONT.semi,
    color: withAlpha(P.white, 0.72),
    spacing: 4.6,
  });

  drawDivider(ctx, WIDTH / 2, 170, 460);
}

function drawMember(ctx, options) {
  const {
    member, activity, cx, avatar,
  } = options;
  const name = displayName(member);
  const completed = activity ? activity.completed !== false : true;

  drawAvatar(ctx, avatar || null, cx, 298, 84, {
    ring: P.red,
    glow: 30,
    ringWidth: 3,
    initials: safeInitials(name),
    fallbackSeed: cx,
  });

  drawText(ctx, name.toUpperCase(), cx, 414, {
    size: 31,
    family: FONT.display,
    color: P.white,
    align: 'center',
    maxWidth: 260,
    shadow: 12,
    shadowColor: '#000',
  });

  drawText(ctx, username(member), cx, 440, {
    size: 14,
    family: FONT.body,
    color: P.ash,
    align: 'center',
    maxWidth: 250,
  });

  const label = completed ? 'ACTIVE' : 'PENDING';
  const color = completed ? P.redBright : P.flame;
  ctx.save();
  setFont(ctx, 14, FONT.semi, '600');
  const textWidth = ctx.measureText(label).width;
  ctx.restore();
  const groupWidth = 14 + 7 + textWidth;
  const startX = cx - groupWidth / 2;

  if (completed) drawCheck(ctx, startX + 7, 463, 7, color);
  else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(startX + 7, 463, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  drawSpacedText(ctx, label, startX + 21, 463, {
    size: 14,
    family: FONT.semi,
    weight: '600',
    color,
    spacing: 1.8,
    align: 'left',
  });
}

function drawStreakEvolution(ctx, log) {
  const previous = Number(log.previousStreak) || 0;
  const current = Number(log.currentStreak) || 0;

  const panelX = 400;
  const panelY = 186;
  const panelW = 480;
  const panelH = 228;

  drawPanel(ctx, {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    cut: 18,
    stroke: P.red,
    strokeWidth: 1.6,
    glow: 24,
  });
  drawCornerBrackets(ctx, panelX + 5, panelY + 5, panelW - 10, panelH - 10, 18, withAlpha(P.redBright, 0.65), 1.4);

  drawSpacedText(ctx, 'STREAK INCREASED', WIDTH / 2, panelY + 30, {
    size: 17,
    family: FONT.display,
    color: P.redBright,
    spacing: 3.4,
    shadow: 12,
    shadowColor: P.redDeep,
  });

  let numberSize = 118;
  const measure = (value) => measureText(ctx, String(value), numberSize, FONT.display);
  while (Math.max(measure(previous), measure(current)) > 190 && numberSize > 62) {
    numberSize -= 8;
  }

  const arrowY = panelY + 112;
  const prevX = WIDTH / 2 - 82;
  const nextX = WIDTH / 2 + 82;

  drawText(ctx, String(previous), prevX, arrowY, {
    size: numberSize,
    family: FONT.display,
    color: P.silver,
    align: 'right',
    shadow: 14,
    shadowColor: '#000',
  });

  // Arrow
  ctx.save();
  ctx.strokeStyle = P.redBright;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.shadowColor = P.red;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 26, arrowY);
  ctx.lineTo(WIDTH / 2 + 20, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 + 6, arrowY - 12);
  ctx.lineTo(WIDTH / 2 + 22, arrowY);
  ctx.lineTo(WIDTH / 2 + 6, arrowY + 12);
  ctx.stroke();
  ctx.restore();

  drawText(ctx, String(current), nextX, arrowY, {
    size: numberSize,
    family: FONT.display,
    color: P.white,
    align: 'left',
    shadow: 26,
    shadowColor: P.redDeep,
    stroke: 'rgba(0,0,0,0.45)',
    strokeWidth: 3,
  });

  drawSpacedText(ctx, 'DAYS STREAK', WIDTH / 2, panelY + 176, {
    size: 27,
    family: FONT.display,
    color: P.redBright,
    spacing: 4,
    shadow: 14,
    shadowColor: P.redDeep,
  });

  drawLine(ctx, panelX + 80, panelY + 194, panelX + panelW - 80, panelY + 194, withAlpha(P.red, 0.28), 1, 0);
  drawText(
    ctx,
    `PREVIOUS ${previous}  \u2192  CURRENT ${current}  \u2022  +${Math.max(0, current - previous)} DAY`,
    WIDTH / 2,
    panelY + 209,
    {
      size: 12,
      family: FONT.semi,
      color: P.ash,
      align: 'center',
    },
  );
}

function drawStatPanel(ctx, options) {
  const {
    x, y, w, h, label, value, icon, accent,
  } = options;

  drawPanel(ctx, {
    x,
    y,
    w,
    h,
    cut: 12,
    stroke: withAlpha(accent, 0.65),
    strokeWidth: 1.3,
    glow: 12,
  });

  if (icon === 'trophy') drawTrophy(ctx, x + 42, y + h / 2, 36, { color: P.gold, glow: 12 });
  else if (icon === 'flame') drawFlame(ctx, x + 42, y + h / 2, 42, { glow: 16 });
  else drawDiamondIcon(ctx, x + 42, y + h / 2, 22, { color: P.redBright, glow: 14 });

  drawSpacedText(ctx, label, x + 78, y + 33, {
    size: 11,
    family: FONT.semi,
    weight: '600',
    color: P.ash,
    spacing: 2.2,
    align: 'left',
  });

  drawText(ctx, value, x + 78, y + 68, {
    size: 44,
    family: FONT.display,
    color: P.white,
    maxWidth: w - 100,
    shadow: 12,
    shadowColor: P.redDeep,
  });
}

function drawFooter(ctx, { log, timezone, guildName }) {
  drawLine(ctx, 100, 646, WIDTH - 100, 646, withAlpha(P.red, 0.35), 1, 8);

  drawSpacedText(ctx, '666 SYSTEM  \u2022  AUTOMATIC LOGS', WIDTH / 2, 676, {
    size: 18,
    family: FONT.display,
    color: P.white,
    spacing: 2.6,
    shadow: 12,
    shadowColor: P.redDeep,
  });

  const left = guildName
    ? guildName.toUpperCase().slice(0, 30)
    : `LOG ${log.dayKey || ''}`.trim();
  drawText(ctx, left, 104, 676, {
    size: 11,
    family: FONT.semi,
    color: P.ashDark,
    maxWidth: 300,
  });

  drawText(ctx, formatTimestamp(log.sentAt || log.createdAt, timezone), WIDTH - 104, 676, {
    size: 11,
    family: FONT.semi,
    color: P.ashDark,
    align: 'right',
    maxWidth: 300,
  });
}

/**
 * Renders the automatic streak log banner.
 *
 * @param {object} data
 * @param {object} data.log persisted log snapshot
 * @param {string} [data.timezone]
 * @param {string} [data.guildName]
 * @param {Map<string, import('@napi-rs/canvas').Image>} [data.avatars]
 * @returns {Promise<Buffer>}
 */
async function renderStreakLogCard({
  log, timezone, guildName, avatars = new Map(),
}) {
  const background = await loadBackground('log-bg.png');
  const { canvas, ctx } = createCard(WIDTH, HEIGHT);

  drawCover(ctx, background, WIDTH, HEIGHT);
  drawEmbers(ctx, WIDTH, HEIGHT, { count: 26, seed: 0x6666, area: [80, 180, WIDTH - 160, 430] });

  const headerFade = ctx.createLinearGradient(0, 0, 0, 190);
  headerFade.addColorStop(0, 'rgba(0,0,0,0.65)');
  headerFade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = headerFade;
  ctx.fillRect(0, 0, WIDTH, 190);
  ctx.restore();

  drawHeader(ctx);

  const members = Array.isArray(log.members) ? log.members : [];
  const activityByUser = new Map(
    (Array.isArray(log.activity) ? log.activity : []).map((entry) => [String(entry.userId), entry]),
  );

  drawMember(ctx, {
    member: members[0] || { displayName: 'Unknown', username: '' },
    activity: activityByUser.get(String(members[0]?.userId)),
    cx: 282,
    avatar: avatars.get(String(members[0]?.userId)) || null,
  });
  drawMember(ctx, {
    member: members[1] || { displayName: 'Unknown', username: '' },
    activity: activityByUser.get(String(members[1]?.userId)),
    cx: 998,
    avatar: avatars.get(String(members[1]?.userId)) || null,
  });

  drawStreakEvolution(ctx, log);

  const statY = 482;
  const statH = 102;
  drawStatPanel(ctx, {
    x: 110,
    y: statY,
    w: 340,
    h: statH,
    label: 'BEST STREAK',
    value: `${Number(log.bestStreak) || 0} DAYS`,
    icon: 'trophy',
    accent: P.gold,
  });
  drawStatPanel(ctx, {
    x: 470,
    y: statY,
    w: 340,
    h: statH,
    label: 'DUO XP',
    value: `${Number(log.xp || 0).toLocaleString('en-US')} XP`,
    icon: 'diamond',
    accent: P.red,
  });
  drawStatPanel(ctx, {
    x: 830,
    y: statY,
    w: 340,
    h: statH,
    label: 'DAYS TOGETHER',
    value: `${Number(log.totalDays) || 0} DAYS`,
    icon: 'flame',
    accent: P.flame,
  });

  // Activity strip
  const activityY = 614;
  const activityLabel = 'DAILY ACTIVITY COMPLETE \u2014 BOTH MEMBERS';
  const labelWidth = measureText(ctx, activityLabel, 14, FONT.semi, '600');
  drawCheck(ctx, WIDTH / 2 - labelWidth / 2 - 18, activityY, 8, P.redBright);
  drawSpacedText(ctx, activityLabel, WIDTH / 2 + 6, activityY, {
    size: 14,
    family: FONT.semi,
    weight: '600',
    color: withAlpha(P.white, 0.88),
    spacing: 1.6,
  });

  drawFooter(ctx, { log, timezone, guildName });

  drawScanlines(ctx, WIDTH, HEIGHT, 0.02);
  drawVignette(ctx, WIDTH, HEIGHT, 0.62);

  return canvas.toBuffer('image/png');
}

module.exports = { renderStreakLogCard, WIDTH, HEIGHT };
