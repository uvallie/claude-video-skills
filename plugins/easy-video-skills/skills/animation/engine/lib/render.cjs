// Рендер: функція frame(t) → SVG → пікселі (resvg) → MP4 (ffmpeg). Без браузера.
// Шрифти: системні + усі .ttf/.otf із папки fonts/ у корені проєкту (поруч з engine/) (покладіть туди шрифти свого бренду).
const fs = require('fs'), path = require('path'), { spawn } = require('child_process'), { once } = require('events');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const FONTS = path.join(ROOT, '..', 'fonts');

const FORMATS = {
  reel: { w: 1080, h: 1920 },   // 9:16 — Reels, Shorts, TikTok, Stories
  post: { w: 1080, h: 1350 },   // 4:5 — допис в Instagram, LinkedIn
  square: { w: 1080, h: 1080 }, // 1:1
  wide: { w: 1920, h: 1080 },   // 16:9 — YouTube
};

const fontOpts = { loadSystemFonts: true, fontDirs: fs.existsSync(FONTS) ? [FONTS] : [], defaultFontFamily: 'Arial' };
const raster = svg => new Resvg(svg, { font: fontOpts }).render();

// один кадр у PNG
function still(file, svg) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raster(svg).asPng());
  return file;
}

const run = (cmd, args) => once(spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] }), 'close');

/* video({ name, frame, dur, w, h, fps, out, poster, sheet, audio })
   frame(t) — SVG кадру в секунду t. poster — секунда для стоп-кадру PNG.
   sheet — ще й розкадровка: одна картинка з кадрами (перевірити ролик очима, не відкриваючи відео).
   audio — шлях до звукової доріжки (голос + музика). Колір позначено bt709, щоб на телефонах кольори не тьмяніли. */
async function video({ name, frame, dur, fps = 30, w, h, out = OUT, poster, sheet = false, audio }) {
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, name + '.mp4'), N = Math.round(dur * fps);
  if (poster != null) still(path.join(out, name + '-poster.png'), frame(poster));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-framerate', String(fps), '-i', 'pipe:0'];
  if (audio) args.push('-i', audio);
  args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart');
  args.push(...(audio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(dur)] : ['-an']), file);
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'] }), done = once(p, 'close');
  for (let i = 0; i < N; i++) {
    const px = raster(frame(i / fps)).pixels;
    if (!p.stdin.write(px)) await once(p.stdin, 'drain');
  }
  p.stdin.end();
  const [code] = await done;
  if (code) throw Error('ffmpeg завершився з кодом ' + code);
  if (sheet) await storyboard(file, dur, path.join(out, name + '-sheet.png'), sheet);
  console.log(`${file}  ${w}×${h}  ${dur} с`);
  return file;
}

// розкадровка готового відео: кадри через рівні проміжки на одній картинці
async function storyboard(file, dur, png, opts = {}) {
  const cols = opts.cols || 3, count = opts.count || 9, rows = Math.ceil(count / cols);
  const rate = count / dur;
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file,
    '-vf', `fps=${rate.toFixed(4)},scale=${Math.round(2400 / cols)}:-1,tile=${cols}x${rows}:padding=8:color=white`,
    '-frames:v', '1', png]);
  return png;
}

// прапорці командного рядка: --format=post, --sheet
const flag = (name, def) => {
  const a = process.argv.find(x => x.startsWith('--' + name + '='));
  return a ? a.split('=')[1] : (process.argv.includes('--' + name) ? true : def);
};

module.exports = { ROOT, OUT, FORMATS, raster, still, video, storyboard, flag };
