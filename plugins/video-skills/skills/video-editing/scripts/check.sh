#!/usr/bin/env bash
# Перевірка: що вже стоїть, чого бракує для монтажу. Нічого не встановлює — лише друкує звіт.
# Запуск: bash check.sh [папка-проєкту]
PROJECT="${1:-$PWD}"; cd "$PROJECT" || exit 1
ok()   { printf '  ✅ %s\n' "$1"; }
miss() { printf '  ❌ %s — %s\n' "$1" "$2"; MISSING=1; }
opt()  { printf '  ➖ %s — %s\n' "$1" "$2"; }

OS="$(uname -s)"
echo "Система: $OS $(uname -m)"
case "$OS" in
  Darwin) PM="brew install"; command -v brew >/dev/null && ok "Homebrew" || miss "Homebrew" "https://brew.sh";;
  Linux)  PM="sudo apt install";;
  *)      PM="winget install";;
esac

echo "Обов'язкове:"
FF=ffmpeg
for p in /opt/homebrew/opt/ffmpeg-full/bin /usr/local/opt/ffmpeg-full/bin; do [ -x "$p/ffmpeg" ] && FF="$p/ffmpeg" && break; done
if command -v "$FF" >/dev/null; then
  ok "FFmpeg ($("$FF" -version | head -1 | cut -d' ' -f3))"
  "$FF" -hide_banner -filters 2>/dev/null | grep -q ' ass ' && ok "FFmpeg уміє впалювати субтитри (libass)" \
    || miss "libass у FFmpeg" "без неї не буде субтитрів. Mac: brew install ffmpeg-full"
else miss "FFmpeg" "$PM ffmpeg"; fi
command -v jq >/dev/null && ok "jq" || miss "jq" "$PM jq"
if command -v python3 >/dev/null; then ok "Python $(python3 -V | cut -d' ' -f2)"; else miss "Python 3.10+" "$PM python"; fi

PY=python3; [ -x .venv/bin/python ] && PY=.venv/bin/python
echo "Python-бібліотеки ($PY):"
"$PY" -c "import faster_whisper" 2>/dev/null && ok "faster-whisper (субтитри, локально)" || miss "faster-whisper" "python3 -m venv .venv && .venv/bin/pip install -r <скіл>/scripts/requirements.txt"
"$PY" -c "import numpy, scipy, soundfile" 2>/dev/null && ok "numpy/scipy/soundfile (музика кодом)" || opt "numpy/scipy/soundfile" "лише для синтезованої музики"
command -v yt-dlp >/dev/null || "$PY" -c "import yt_dlp" 2>/dev/null && ok "yt-dlp" || opt "yt-dlp" "лише щоб качати референси"

echo "Проєкт ($PROJECT):"
[ -f montage.config.json ] && ok "montage.config.json (налаштування вже є)" || opt "montage.config.json" "ще не створено — пройдемо знайомство"
for d in "Сирі відео" "Референси" "Готове"; do [ -d "$d" ] && ok "папка «$d»" || opt "папка «$d»" "створимо"; done

echo "Ключі (необов'язково):"
for k in GEMINI_API_KEY ELEVENLABS_API_KEY OPENAI_API_KEY; do
  if [ -n "${!k}" ] || { [ -f .env ] && grep -Eq "^\s*$k\s*=\s*\S+" .env; }; then ok "$k є (значення не показуємо)"; else opt "$k" "немає"; fi
done

[ -z "$MISSING" ] && echo "Готово: усе потрібне стоїть." || echo "Чогось бракує (❌) — Claude запропонує встановити."
