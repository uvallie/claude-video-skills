#!/usr/bin/env bash
# Спільне для всіх скриптів. Проєкт — поточна папка (або MONTAGE_PROJECT).
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${MONTAGE_PROJECT:-$PWD}"
WORK="$PROJECT/.work"

# Налаштування: спершу з проєкту (.montage/), інакше — стандартні зі скіла.
cfg() { if [[ -f "$PROJECT/.montage/$1" ]]; then echo "$PROJECT/.montage/$1"; else echo "$SKILL_DIR/config/$1"; fi; }

# Субтитри потребують ffmpeg з libass. На Mac звичайний brew-ffmpeg буває без неї — тоді беремо ffmpeg-full.
FF="ffmpeg"; FFPROBE="ffprobe"
for p in /opt/homebrew/opt/ffmpeg-full/bin /usr/local/opt/ffmpeg-full/bin; do
  if [[ -x "$p/ffmpeg" ]]; then FF="$p/ffmpeg"; FFPROBE="$p/ffprobe"; break; fi
done
PY="python3"; [[ -x "$PROJECT/.venv/bin/python" ]] && PY="$PROJECT/.venv/bin/python"

die()  { echo "помилка: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "не встановлено '$1'"; }
stem() { local b; b="$(basename "$1")"; echo "${b%.*}"; }
