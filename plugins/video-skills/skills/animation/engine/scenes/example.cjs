// Приклад-еталон: «кубик підстрибує і перелітає через блок», 4 секунди.
// Запуск:  node scenes/example.cjs [--format=reel|post|square|wide] [--sheet] [--voice] [--sound]
//   --sheet  ще й розкадровка 3×3 (out/example-<format>-sheet.png)
//   --voice  озвучити репліку (потрібен ключ у .env)
//   --sound  синтезована музика й ефекти («поп», «боїнь», «туп»)
// Нову сцену починайте з копії цього файлу: замініть тексти, об'єкти й ключі руху.
const path = require('path');
const { E, kf, jump, prog } = require('../lib/motion.cjs');
const { FORMATS, video, flag } = require('../lib/render.cjs');
const { S, open, close, text, card } = require('../lib/kit.cjs');
const { music, sfx } = require('../lib/sound.cjs');

const FORMAT = flag('format', 'reel');
const { w, h } = FORMATS[FORMAT];
const DUR = 4;
const floor = h * 0.72;
const cube = 140, block = { w: 160, h: 220 };

// таймінг сцен: розбіг 0–1 с · стрибок 1–2 с · приземлення 2–3 с · фінальна картка 3–4 с
const JUMP = { t0: 1.1, dur: 0.9, h: 420 };

function frame(t) {
  const x = kf(t, [[0, w * 0.12], [1.1, w * 0.3, E.out], [2.0, w * 0.72, E.lin], [2.6, w * 0.76, E.out]]);
  const { dy, sy } = jump(t, JUMP);
  const cx = x, cy = floor + dy;
  const rot = t > JUMP.t0 && t < JUMP.t0 + JUMP.dur ? 360 * prog(t, JUMP.t0, JUMP.t0 + JUMP.dur, E.inOut) : 0;
  return open(w, h)
    + text(t, 0.1, 'Кубик і блок', { x: w / 2, y: h * 0.2, size: Math.round(w * 0.085), anchor: 'middle' })
    + `<rect x="0" y="${floor}" width="${w}" height="${h - floor}" fill="${S.ink}" opacity="0.08"/>`
    + `<rect x="${w / 2 - block.w / 2}" y="${floor - block.h}" width="${block.w}" height="${block.h}" rx="18" fill="${S.ink}"/>`
    + `<g transform="translate(${cx} ${cy}) scale(${1 / sy} ${sy}) rotate(${rot} 0 ${-cube / 2})">`
    + `<rect x="${-cube / 2}" y="${-cube}" width="${cube}" height="${cube}" rx="22" fill="${S.accent}" stroke="${S.ink}" stroke-width="8"/></g>`
    + card(t, 3.0, 'Готово!', { x: w / 2 - 260, y: h * 0.3, w: 520, h: 130, size: 60 })
    + close;
}

(async () => {
  const name = `example-${FORMAT}`;
  let audio, dur = DUR;
  if (flag('voice') || flag('sound')) {
    const { narrate, mix } = require('../lib/voice.cjs');
    const parts = [];
    if (flag('voice')) {
      const [line] = await narrate(['Кубик розганяється, стрибає і перелітає через блок!'], { dir: path.join(__dirname, '..', 'out', 'voice') });
      parts.push({ file: line.file, at: 0.2 });
      dur = Math.max(DUR, 0.2 + line.dur + 0.6);   // тривалість ролика задає голос
    }
    if (flag('sound')) {
      parts.push({ file: sfx('pop'), at: 0.1, gain: -11 }, { file: sfx('hop'), at: JUMP.t0 - 0.03, gain: -11 },
        { file: sfx('land'), at: JUMP.t0 + JUMP.dur - 0.01, gain: -11 }, { file: sfx('chime'), at: 3.05, gain: -11 });
    }
    audio = mix({ parts, music: flag('sound') ? music(dur) : null, file: path.join(__dirname, '..', 'out', name + '.wav') });
  }
  await video({ name, frame, dur, w, h, poster: 2.2, sheet: flag('sheet') ? { cols: 3, count: 9 } : false, audio });
})().catch(e => { console.error(e.message); process.exit(1); });
