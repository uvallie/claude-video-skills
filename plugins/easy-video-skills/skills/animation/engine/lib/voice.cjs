// Озвучка: текст → WAV. Постачальники: gemini (за замовчуванням, безкоштовний ключ), elevenlabs, openai.
// Ключі беруться зі змінних середовища або з файлу .env у корені проєкту. Ключ ніколи не друкуємо.
// Налаштування голосу — у animation.config.json → "voice": { provider, voice, style, model, tempo, language }.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const DEFAULTS = {
  gemini: { model: 'gemini-3.8-flash-tts', voice: 'Zephyr' },   // дешевше: gemini-3.8-flash-lite-tts
  elevenlabs: { model: 'eleven_multilingual_v2', voice: '' },   // voice — voice_id з кабінету ElevenLabs
  openai: { model: '', voice: '' },                              // модель і голос перевірити в документації OpenAI під час налаштування
};
const KEYS = { gemini: 'GEMINI_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY', openai: 'OPENAI_API_KEY' };
const WHERE = {
  gemini: 'https://aistudio.google.com/apikey',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
  openai: 'https://platform.openai.com/api-keys',
};

function config() {
  const f = path.join(ROOT, '..', 'animation.config.json');
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const v = c.voice || {};
  const provider = v.provider || 'gemini';
  return { provider, ...DEFAULTS[provider], ...v };
}

// шукаємо .env у корені проєкту (на рівень вище за engine/) і в самому engine/
function key(name) {
  if (process.env[name]) return process.env[name];
  for (const f of [path.join(ROOT, '..', '.env'), path.join(ROOT, '.env')]) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(new RegExp('^\\s*' + name + '\\s*=\\s*["\']?([^"\'\\s]+)', 'm'));
    if (m) return m[1];
  }
  const provider = Object.keys(KEYS).find(p => KEYS[p] === name);
  throw Error(`Немає ключа ${name}. Візьміть його тут: ${WHERE[provider]} і впишіть у файл .env рядком ${name}=...`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function wavFromPcm(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/* ---------- Gemini ---------- */
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
async function gemini(method, url, body, tries = 4) {
  const r = await fetch(GEMINI + url, { method, headers: { 'x-goog-api-key': key('GEMINI_API_KEY'), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  // безкоштовний ліміт — кілька запитів на хвилину: чекаємо, скільки просить Google, і пробуємо ще раз
  if (r.status === 429 && tries > 0) {
    const s = +(txt.match(/retry in ([\d.]+)s/) || [])[1] || 20;
    await sleep((s + 2) * 1000);
    return gemini(method, url, body, tries - 1);
  }
  if (!r.ok) throw Error(`Gemini ${r.status}: ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : {};
}
async function geminiTts(text, { voice, style, model }) {
  const part = { type: 'text', text };
  if (style) part.annotations = [{ type: 'speech_metadata', style }];
  const res = await gemini('POST', '/interactions', { model, input: [{ type: 'user_input', content: [part] }], response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice }] } });
  const audio = (res.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'audio').pop();
  if (!audio) throw Error('Gemini не повернув звук: ' + JSON.stringify(res).slice(0, 300));
  return Buffer.from(audio.data, 'base64');
}

/* ---------- ElevenLabs ---------- */
async function elevenTts(text, { voice, model, language }) {
  if (!voice) throw Error('Для ElevenLabs вкажіть voice (voice_id) в animation.config.json');
  for (let i = 0; ; i++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_24000`, {
      method: 'POST', headers: { 'xi-api-key': key('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model, ...(language ? { language_code: language } : {}) }),
    });
    if (r.ok) return wavFromPcm(Buffer.from(await r.arrayBuffer()));
    const msg = (await r.text()).slice(0, 300);
    if (i >= 3 || (r.status < 500 && r.status !== 429)) throw Error('ElevenLabs ' + r.status + ': ' + msg);
    await sleep(2000 * (i + 1));
  }
}

/* ---------- OpenAI ---------- */
async function openaiTts(text, { voice, model, style }) {
  if (!model || !voice) throw Error('Для OpenAI вкажіть model і voice в animation.config.json (див. документацію OpenAI Text to speech)');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice, input: text, response_format: 'pcm', ...(style ? { instructions: style } : {}) }),
  });
  if (!r.ok) throw Error('OpenAI ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return wavFromPcm(Buffer.from(await r.arrayBuffer()));
}

// одна репліка → WAV (Buffer)
async function tts(text, opts = {}) {
  const c = { ...config(), ...opts };
  if (c.provider === 'gemini') return geminiTts(text, c);
  if (c.provider === 'elevenlabs') return elevenTts(text, c);
  if (c.provider === 'openai') return openaiTts(text, c);
  throw Error('Невідомий постачальник голосу: ' + c.provider);
}

// перевірка ключа одним коротким запитом (нічого не друкує, крім «працює» / помилки)
async function check() {
  const c = config();
  const wav = await tts('Перевірка.', c);
  return { provider: c.provider, bytes: wav.length };
}

function ff(args, what) {
  if (spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' }).status) throw Error('ffmpeg: ' + what);
}

// тривалість WAV у секундах (16 біт PCM)
function duration(file) {
  const b = fs.readFileSync(file);
  let p = 12, rate = 24000, ch = 1, len = 0;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(p + 10); rate = b.readUInt32LE(p + 12); }
    if (id === 'data') { len = Math.min(n, b.length - p - 8); break; }
    p += 8 + n + (n % 2);
  }
  return len / (rate * ch * 2);
}

/* narrate(lines, { dir }) — усі репліки ролика → WAV-файли з кешем.
   Незмінену репліку повторно не генеруємо (ні грошей, ні часу). tempo 1.2 — мова на 20 % швидша без зміни висоти.
   Повертає [{ text, file, dur }]: тривалості реплік задають таймінг сцен. */
async function narrate(lines, { dir, ...opts } = {}) {
  const c = { ...config(), ...opts };
  fs.mkdirSync(dir, { recursive: true });
  const out = [];
  for (const [i, text] of lines.entries()) {
    const h = crypto.createHash('sha1').update([c.provider, c.model, c.voice, c.style || '', text].join('|')).digest('hex').slice(0, 8);
    const file = path.join(dir, String(i + 1).padStart(2, '0') + '-' + h + '.wav');
    if (!fs.existsSync(file)) fs.writeFileSync(file, await tts(text, c));
    let use = file;
    if (c.tempo && c.tempo !== 1) {
      use = file.replace(/\.wav$/, `.t${c.tempo}.wav`);
      if (!fs.existsSync(use)) ff(['-i', file, '-af', `atempo=${c.tempo}`, '-ar', '24000', '-ac', '1', use], 'tempo');
    }
    out.push({ text, file: use, dur: duration(use) });
  }
  return out;
}

/* mix({ parts, music, file }) — зводить репліки (parts = [{ file, at }]), ефекти й музику в одну доріжку.
   Музика на ~15 дБ тихіша за голос, ефекти — на ~11 дБ. Результат близько −16 LUFS. */
function mix({ parts, music, musicGain = -15, file }) {
  const args = [];
  parts.forEach(p => args.push('-i', p.file));
  if (music) args.push('-i', music);
  const chains = parts.map((p, i) => `[${i}:a]${p.gain ? `volume=${p.gain}dB,` : ''}adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`);
  const labels = parts.map((_, i) => `[a${i}]`);
  if (music) { chains.push(`[${parts.length}:a]volume=${musicGain}dB[m]`); labels.push('[m]'); }
  const graph = chains.join(';') + ';' + labels.join('') + `amix=inputs=${labels.length}:normalize=0:duration=longest,volume=2.4dB,alimiter=limit=0.95[out]`;
  ff([...args, '-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-ac', '2', file], 'mix');
  return file;
}

module.exports = { config, tts, check, narrate, mix, duration, KEYS, WHERE };
