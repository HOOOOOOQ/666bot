'use strict';

const { loadImage } = require('@napi-rs/canvas');
const { createCard, P, setFont, drawText, drawPanel, roundRect } = require('../../ui/cards/canvasTools');

const TEMPLATES = {
  spongebobchicken: { title: 'SPONGEBOB CHICKEN', top: 'When someone says', bottom: '666 is just a bot', accent: P.gold },
  slapcar: { title: 'SLAP CAR', top: 'Me after losing 10 coinflips', bottom: 'The coinflip RNG', accent: P.red },
  isthisa: { title: 'IS THIS A...', top: 'Is this a pigeon?', bottom: 'Is this a free reward?', accent: P.flame },
  drake: { title: 'DRAKE STYLE', top: 'Grinding manually', bottom: 'Auto-hunt every 5 minutes', accent: P.flame, layout: 'drake' },
  distractedbf: { title: 'DISTRACTED BOYFRIEND', top: 'My wallet', bottom: 'Another legendary egg', accent: P.red, layout: 'drake' },
  communismcat: { title: 'COMMUNISM CAT', top: 'Your coins', bottom: 'Our coins', accent: P.red },
  eject: { title: 'EMERGENCY EJECT', top: 'When the market listing is overpriced', bottom: 'Eject.', accent: P.red },
  emergencymeeting: { title: 'EMERGENCY MEETING', top: 'Someone got a secret monster', bottom: 'Sus.', accent: P.gold },
  headpat: { title: 'HEADPAT', top: 'You deserve headpats', bottom: 'Good luck on the next hunt', accent: P.flame },
  tradeoffer: { title: 'TRADE OFFER', top: 'I receive: your rarest pet', bottom: 'You receive: 3 common eggs', accent: P.gold, layout: 'drake' },
  waddle: { title: 'WADDLE', top: 'When the boss spawns', bottom: 'Everybody waddles to the arena', accent: P.flame },
};

function drawAvatar(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
  ctx.strokeStyle = P.flame;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();
}

async function fetchAvatar(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

async function renderMeme(templateId, texts = [], { avatarUrl = null, username = '666 Player' } = {}) {
  const template = TEMPLATES[templateId];
  if (!template) throw new Error('Template tidak ditemukan.');
  const { canvas, ctx } = createCard(1000, 760);
  const grad = ctx.createLinearGradient(0, 0, 1000, 760);
  grad.addColorStop(0, '#08050a');
  grad.addColorStop(1, '#1b0709');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1000, 760);

  drawPanel(ctx, { x: 30, y: 26, w: 940, h: 708, fill: 'rgba(8,5,8,0.55)', stroke: template.accent, strokeWidth: 3 });
  setFont(ctx, 46, 'display');
  ctx.fillStyle = template.accent;
  ctx.fillText(template.title, 64, 100);

  const labels = template.layout === 'drake'
    ? [`NO: ${texts[0] || template.top}`, `YES: ${texts[1] || template.bottom}`]
    : [texts[0] || template.top, texts[1] || template.bottom];

  if (template.layout === 'drake') {
    for (let i = 0; i < 2; i += 1) {
      const y = 180 + i * 260;
      drawPanel(ctx, { x: 60, y, w: 880, h: 220, fill: i === 0 ? 'rgba(130,20,25,0.3)' : 'rgba(35,110,60,0.25)', stroke: i === 0 ? P.red : '#3fb96a' });
      setFont(ctx, 40, 'bold');
      ctx.fillStyle = i === 0 ? P.red : '#6ee29a';
      ctx.fillText(i === 0 ? '✗' : '✓', 90, y + 92);
      setFont(ctx, 34, 'semi');
      ctx.fillStyle = P.silver;
      drawMultiline(ctx, labels[i], 170, y + 70, 730, 48, 3);
    }
  } else {
    setFont(ctx, 36, 'semi');
    ctx.fillStyle = P.silver;
    drawMultiline(ctx, labels[0], 70, 210, 860, 50, 3);
    setFont(ctx, 30, 'display');
    ctx.fillStyle = template.accent;
    ctx.fillText('666 ULTIMATE', 70, 640);
    setFont(ctx, 34, 'semi');
    ctx.fillStyle = P.white;
    drawMultiline(ctx, labels[1], 70, 690, 860, 46, 2);
    const avatar = await fetchAvatar(avatarUrl);
    if (avatar) drawAvatar(ctx, avatar, 810, 540, 110);
  }

  return canvas.toBuffer('image/png');
}

function drawMultiline(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y + lines * lineHeight);
}

module.exports = { TEMPLATES, renderMeme };
