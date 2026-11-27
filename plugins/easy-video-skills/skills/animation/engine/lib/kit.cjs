// Дрібні будівельні блоки кадру. Кольори й шрифти беруться з animation.config.json → "style".
const fs = require('fs'), path = require('path');
const { clamp, E } = require('./motion.cjs');

function style() {
  const f = path.join(__dirname, '..', '..', 'animation.config.json');
  const s = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).style || {}) : {};
  return {
    bg: '#F6F1E7', ink: '#1B1B1F', accent: '#C6F432', warn: '#FFB38A', final: '#6C4CF5',
    headFont: 'Arial Black', bodyFont: 'Arial',
    ...s,
  };
}
const S = style();

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const open = (w, h, bg = S.bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>`;
const close = '</svg>';

// текст, що з'являється: виїжджає знизу й проявляється за 0,5 с від моменту at
function text(t, at, str, { x, y, size = 72, font = S.headFont, color = S.ink, anchor = 'start', weight = 900, dur = 0.5 } = {}) {
  const u = E.out4(clamp((t - at) / dur));
  if (u <= 0) return '';
  return `<text x="${x}" y="${y + (1 - u) * size * 0.6}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" opacity="${u}" text-anchor="${anchor}">${esc(str)}</text>`;
}

// картка-плашка з підписом; з'являється з легким перельотом
function card(t, at, str, { x, y, w = 600, h = 120, fill = S.accent, color = S.ink, size = 48, font = S.bodyFont, r = 28 } = {}) {
  const u = clamp((t - at) / 0.45);
  if (u <= 0) return '';
  const k = E.back(u);
  return `<g transform="translate(${x + w / 2} ${y + h / 2}) scale(${k}) translate(${-w / 2} ${-h / 2})" opacity="${Math.min(1, u * 2)}">`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
    + `<text x="${w / 2}" y="${h / 2 + size * 0.35}" font-family="${font}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle">${esc(str)}</text></g>`;
}

// закреслення лінією, що малюється за 0,4 с
function strike(t, at, { x1, y1, x2, y2, color = S.ink, width = 10 } = {}) {
  const u = E.out(clamp((t - at) / 0.4));
  if (u <= 0) return '';
  return `<line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * u}" y2="${y1 + (y2 - y1) * u}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

// галочка в колі
function check(t, at, { x, y, r = 40, fill = S.accent, color = S.ink } = {}) {
  const u = clamp((t - at) / 0.4);
  if (u <= 0) return '';
  const k = E.back(u);
  return `<g transform="translate(${x} ${y}) scale(${k})"><circle r="${r}" fill="${fill}"/>`
    + `<path d="M${-r * 0.45} 0 L${-r * 0.1} ${r * 0.35} L${r * 0.5} ${-r * 0.35}" fill="none" stroke="${color}" stroke-width="${r * 0.2}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

module.exports = { S, style, esc, open, close, text, card, strike, check };
