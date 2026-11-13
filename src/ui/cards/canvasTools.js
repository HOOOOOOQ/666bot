'use strict';

/**
 * Canvas toolkit for the 666 visual identity.
 * Dark gothic cyber, blood red neon, ember orange, silver typography.
 *
 * Fonts (OFL) are bundled in src/assets/fonts so rendering is identical on
 * every host, including Pterodactyl containers.
 */

const path = require('node:path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const FONT = {
  display: 'Bebas Neue',
  body: 'Chakra Petch',
  semi: 'Chakra Petch SemiBold',
  bold: 'Chakra Petch Bold',
};

const P = {
  black: '#050406',
  ink: '#0a0608',
  panel: 'rgba(9,5,7,0.78)',
  red: '#ff1e2d',
  redBright: '#ff3b46',
  redDeep: '#b70d1a',
  redDark: '#4d060f',
  flame: '#ff5a00',
  flameLight: '#ffb347',
  gold: '#ffcf5c',
  goldDeep: '#a97514',
  silver: '#e6e9ef',
  silverDeep: '#8a929e',
  bronze: '#e08a3c',
  bronzeDeep: '#8a4a17',
  white: '#f8f6f7',
  ash: '#a39b9e',
  ashDark: '#655c60',
};

let fontsReady = false;

function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  const fonts = [
    ['BebasNeue-Regular.ttf', FONT.display],
    ['ChakraPetch-Regular.ttf', FONT.body],
    ['ChakraPetch-SemiBold.ttf', FONT.semi],
    ['ChakraPetch-Bold.ttf', FONT.bold],
  ];

  for (const [file, alias] of fonts) {
    try {
      GlobalFonts.registerFromPath(path.join(dir, file), alias);
    } catch {
      // Rendering still falls back to a system font; never crash the bot.
    }
  }
  fontsReady = true;
}

const backgroundCache = new Map();

async function loadBackground(name) {
  if (backgroundCache.has(name)) return backgroundCache.get(name);
  const file = path.join(__dirname, '..', '..', 'assets', 'images', name);
  const image = await loadImage(file);
  backgroundCache.set(name, image);
  return image;
}

function createCard(width, height) {
  registerFonts();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function drawCover(ctx, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

function withAlpha(hex, alpha) {
  const clean = String(hex).replace('#', '');
  const bigint = Number.parseInt(clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setFont(ctx, size, family = FONT.body, weight = '') {
  ctx.font = `${weight ? `${weight} ` : ''}${size}px "${family}"`;
}

function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 24,
    family = FONT.body,
    weight = '',
    color = P.white,
    align = 'left',
    baseline = 'middle',
    alpha = 1,
    shadow = 0,
    shadowColor = P.red,
    stroke = null,
    strokeWidth = 1.5,
    maxWidth = null,
  } = options;

  let value = String(text ?? '');
  ctx.save();
  ctx.globalAlpha = alpha;
  setFont(ctx, size, family, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (maxWidth) value = truncateText(ctx, value, maxWidth);
  if (shadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadow;
  }
  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
  return value;
}

function drawSpacedText(ctx, text, x, y, options = {}) {
  const {
    size = 20,
    family = FONT.semi,
    weight = '',
    color = P.white,
    spacing = 4,
    align = 'center',
    shadow = 0,
    shadowColor = P.red,
    alpha = 1,
  } = options;

  const chars = [...String(text ?? '')];
  ctx.save();
  ctx.globalAlpha = alpha;
  setFont(ctx, size, family, weight);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.fillStyle = color;
  if (shadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadow;
  }
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, y);
    cursor += widths[i] + spacing;
  }
  ctx.restore();
  return total;
}

function measureText(ctx, text, size, family = FONT.body, weight = '') {
  ctx.save();
  setFont(ctx, size, family, weight);
  const width = ctx.measureText(String(text ?? '')).width;
  ctx.restore();
  return width;
}

function truncateText(ctx, text, maxWidth) {
  const value = String(text ?? '');
  if (ctx.measureText(value).width <= maxWidth) return value;

  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function drawGradientText(ctx, text, x, y, options = {}) {
  const {
    size = 120,
    family = FONT.display,
    weight = '',
    align = 'center',
    baseline = 'middle',
    stops = [
      [0, '#ffffff'],
      [0.5, '#d9dbe1'],
      [1, '#8d929c'],
    ],
    shadow = 0,
    shadowColor = P.red,
    stroke = null,
    strokeWidth = 2,
  } = options;

  const value = String(text ?? '');
  ctx.save();
  setFont(ctx, size, family, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  const metrics = ctx.measureText(value);
  const top = y - size * 0.62;
  const height = size * 1.1;
  const gradient = ctx.createLinearGradient(0, top, 0, top + height);

  for (const [offset, color] of stops) gradient.addColorStop(offset, color);

  if (shadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadow;
  }
  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.strokeText(value, x, y);
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = gradient;
  ctx.fillText(value, x, y);
  ctx.restore();
  return metrics.width;
}

function drawLine(ctx, x1, y1, x2, y2, color = P.red, width = 2, glow = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(ctx, cx, cy, size, color = P.red, filled = true) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function cutPanelPath(ctx, x, y, w, h, cut = 16) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawPanel(ctx, options = {}) {
  const {
    x, y, w, h,
    cut = 16,
    stroke = P.red,
    strokeWidth = 1.5,
    glow = 14,
    fill = null,
    alpha = 1,
  } = options;

  ctx.save();
  ctx.globalAlpha = alpha;
  cutPanelPath(ctx, x, y, w, h, cut);

  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, 'rgba(26,10,13,0.92)');
  gradient.addColorStop(0.45, 'rgba(8,4,6,0.88)');
  gradient.addColorStop(1, 'rgba(22,5,9,0.94)');

  ctx.fillStyle = fill || gradient;
  ctx.fill();

  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = glow;
    ctx.stroke();
  }

  ctx.restore();
}

function drawCornerBrackets(ctx, x, y, w, h, length = 16, color = P.red, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * length);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * length, cy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDivider(ctx, cx, y, width, options = {}) {
  const { color = P.red, glow = 8, diamond = true } = options;
  drawLine(ctx, cx - width / 2, y, cx - 14, y, color, 1.5, glow);
  drawLine(ctx, cx + 14, y, cx + width / 2, y, color, 1.5, glow);
  if (diamond) drawDiamond(ctx, cx, y, 5, color, true);
}

function drawCrown(ctx, cx, cy, width, options = {}) {
  const {
    fill = P.redDeep,
    stroke = P.redBright,
    glow = 26,
    jewel = P.gold,
    alpha = 1,
  } = options;

  const h = width * 0.72;
  const left = cx - width / 2;
  const top = cy - h / 2;

  const points = [
    [0, 0.58], [0.08, 0.18], [0.24, 0.48], [0.5, 0], [0.76, 0.48], [0.92, 0.18], [1, 0.58],
    [1, 0.88], [0.86, 1], [0.14, 1], [0, 0.88],
  ];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    const x = left + px * width;
    const y = top + py * h;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const gradient = ctx.createLinearGradient(left, top, left, top + h);
  gradient.addColorStop(0, '#ff5a62');
  gradient.addColorStop(0.35, fill);
  gradient.addColorStop(1, '#5c020c');
  ctx.fillStyle = gradient;
  ctx.shadowColor = stroke;
  ctx.shadowBlur = glow;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.2, width * 0.022);
  ctx.stroke();

  // Jewels
  const jewels = [[0.5, 0.5, 0.055], [0.22, 0.62, 0.035], [0.78, 0.62, 0.035], [0.5, 0.78, 0.03]];
  for (const [jx, jy, jr] of jewels) {
    ctx.beginPath();
    ctx.arc(left + jx * width, top + jy * h, jr * width, 0, Math.PI * 2);
    ctx.fillStyle = jewel;
    ctx.shadowColor = jewel;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawFlame(ctx, cx, cy, height, options = {}) {
  const { alpha = 1, glow = 22 } = options;
  const w = height * 0.58;
  const left = cx - w / 2;
  const top = cy - height / 2;
  const bottom = cy + height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + w * 0.25, top + height * 0.2, left + w, top + height * 0.5, left + w * 0.42, bottom - height * 0.08);
  ctx.bezierCurveTo(left + w * 0.12, bottom, left + w * 0.2, bottom - height * 0.22, left + w * 0.22, bottom - height * 0.3);
  ctx.bezierCurveTo(left + w * 0.05, bottom - height * 0.28, left, bottom - height * 0.12, left, bottom - height * 0.02);
  ctx.bezierCurveTo(left + w * 0.05, bottom - height * 0.4, left + w * 0.2, top + height * 0.5, cx, top);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(cx, top, cx, bottom);
  gradient.addColorStop(0, P.flameLight);
  gradient.addColorStop(0.45, P.flame);
  gradient.addColorStop(1, P.redDeep);
  ctx.fillStyle = gradient;
  ctx.shadowColor = P.flame;
  ctx.shadowBlur = glow;
  ctx.fill();
  ctx.restore();
}

function drawTrophy(ctx, cx, cy, size, options = {}) {
  const { color = P.gold, glow = 18, alpha = 1 } = options;
  const w = size;
  const h = size * 1.1;
  const left = cx - w / 2;
  const top = cy - h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;

  ctx.beginPath();
  ctx.moveTo(left + w * 0.2, top);
  ctx.lineTo(left + w * 0.8, top);
  ctx.bezierCurveTo(left + w * 0.8, top + h * 0.42, left + w * 0.66, top + h * 0.56, cx, top + h * 0.58);
  ctx.bezierCurveTo(left + w * 0.34, top + h * 0.56, left + w * 0.2, top + h * 0.42, left + w * 0.2, top);
  ctx.closePath();
  ctx.fill();

  // Handles
  ctx.beginPath();
  ctx.arc(left + w * 0.16, top + h * 0.22, w * 0.16, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(left + w * 0.84, top + h * 0.22, w * 0.16, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();

  // Stem + base
  ctx.fillRect(cx - w * 0.06, top + h * 0.58, w * 0.12, h * 0.2);
  ctx.fillRect(left + w * 0.25, top + h * 0.78, w * 0.5, h * 0.1);
  ctx.restore();
}

function drawDiamondIcon(ctx, cx, cy, size, options = {}) {
  const { color = P.redBright, glow = 14, alpha = 1 } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.78, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.78, cy);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(cx, cy - size, cx, cy + size);
  gradient.addColorStop(0, '#ffd9dc');
  gradient.addColorStop(0.4, color);
  gradient.addColorStop(1, P.redDark);
  ctx.fillStyle = gradient;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = withAlpha(P.white, 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawCheck(ctx, cx, cy, size, color = P.redBright) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.55, cy);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.45);
  ctx.lineTo(cx + size * 0.6, cy - size * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx, options) {
  const {
    x, y, w, h = 16,
    value = 0,
    max = 1,
    track = 'rgba(255,255,255,0.08)',
    fill = null,
    glow = 14,
    ticks = 10,
  } = options;

  const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / Math.max(1, Number(max) || 1)));

  ctx.save();
  // Track
  cutPanelPath(ctx, x, y, w, h, Math.min(8, h / 2));
  ctx.fillStyle = track;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (ratio > 0) {
    const gradient = fill || (() => {
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, P.redDeep);
      g.addColorStop(0.6, P.red);
      g.addColorStop(1, P.flame);
      return g;
    })();
    cutPanelPath(ctx, x + 1, y + 1, Math.max(4, (w - 2) * ratio), h - 2, Math.min(6, h / 2));
    ctx.fillStyle = gradient;
    ctx.shadowColor = P.red;
    ctx.shadowBlur = glow;
    ctx.fill();
  }

  // Segment ticks
  ctx.shadowBlur = 0;
  if (ticks > 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < ticks; i += 1) {
      const tx = x + (w / ticks) * i;
      ctx.beginPath();
      ctx.moveTo(tx, y + 2);
      ctx.lineTo(tx, y + h - 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawAvatar(ctx, image, cx, cy, radius, options = {}) {
  const {
    ring = P.red,
    initials = '',
    glow = 30,
    ringWidth = 3,
    fallbackSeed = 1,
  } = options;

  ctx.save();

  // Outer glow
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = ringWidth;
  ctx.shadowColor = ring;
  ctx.shadowBlur = glow;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Image / fallback
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
  } else {
    const random = mulberry32(fallbackSeed || 1);
    const hue = 350 + random() * 12;
    const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    gradient.addColorStop(0, `hsl(${hue}, 70%, 26%)`);
    gradient.addColorStop(1, `hsl(${hue}, 80%, 6%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    setFont(ctx, radius * 0.82, FONT.display);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(initials || '?').slice(0, 2).toUpperCase(), cx, cy + radius * 0.04);
  }

  // Inner shading ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // Thin outer ring for definition
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(ring, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawVignette(ctx, w, h, strength = 0.72) {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.78);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.62, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawScanlines(ctx, w, h, alpha = 0.035) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

function drawEmbers(ctx, w, h, options = {}) {
  const { count = 46, seed = 666, area = null } = options;
  const random = mulberry32(seed);
  const [ax, ay, aw, ah] = area || [0, 0, w, h];

  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = ax + random() * aw;
    const y = ay + random() * ah;
    const size = random() * 2.3 + 0.4;
    const alpha = 0.15 + random() * 0.55;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = random() > 0.55 ? P.flame : P.redBright;
    ctx.shadowColor = P.red;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeaderGlow(ctx, w, color = P.red, alpha = 0.4) {
  const gradient = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.62);
  gradient.addColorStop(0, withAlpha(color, alpha));
  gradient.addColorStop(0.55, withAlpha(color, alpha * 0.25));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, w * 0.5);
  ctx.restore();
}

function drawBottomFade(ctx, w, h, alpha = 0.88) {
  const gradient = ctx.createLinearGradient(0, h * 0.55, 0, h);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function safeInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

module.exports = {
  P,
  FONT,
  registerFonts,
  loadBackground,
  createCard,
  drawCover,
  withAlpha,
  mulberry32,
  setFont,
  drawText,
  drawSpacedText,
  measureText,
  truncateText,
  drawGradientText,
  drawLine,
  drawDiamond,
  drawPanel,
  drawCornerBrackets,
  drawDivider,
  drawCrown,
  drawFlame,
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
  roundRect,
  cutPanelPath,
  safeInitials,
};
