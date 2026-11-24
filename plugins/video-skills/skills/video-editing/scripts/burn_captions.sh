#!/usr/bin/env bash
# burn_captions.sh <відео> <субтитри.srt|.ass> [стиль: Vertical|Horizontal|Highlight] [вихід]
# .ass впалюється як є; .srt спершу перетворюється у вибраний стиль з config/caption_style.ass.
# Спершу кадруй (reframe), потім субтитри — інакше обріжеться текст.
source "$(dirname "$0")/lib.sh"
FILTERS="$("$FF" -hide_banner -filters 2>/dev/null || true)"
grep -q ' ass ' <<<"$FILTERS" || die "цей ffmpeg без libass (не вміє субтитри). Mac: brew install ffmpeg-full; Windows: збірка gyan.dev full; Linux: пакет ffmpeg з дистрибутива"
IN="${1:?використання: burn_captions.sh <відео> <субтитри> [стиль] [вихід]}"
SUB="${2:?субтитри}"; STYLE="${3:-Vertical}"
OUT="${4:-$WORK/captioned/$(stem "$IN")_captions.mp4}"; mkdir -p "$(dirname "$OUT")"
FONTS="$PROJECT/fonts"; mkdir -p "$FONTS"
TMP=""
if [[ "$SUB" != *.ass ]]; then
  TMP="$(mktemp -t captions).ass"; trap 'rm -f "$TMP"' EXIT
  "$PY" "$(dirname "$0")/srt_to_ass.py" "$SUB" "$TMP" --style "$STYLE"
  SUB="$TMP"
fi
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" -e 's/:/\\:/g'; }
"$FF" -hide_banner -loglevel error -y -i "$IN" \
  -vf "ass=filename='$(esc "$SUB")':fontsdir='$(esc "$FONTS")'" \
  -c:v libx264 -preset slow -crf 18 -c:a copy -movflags +faststart "$OUT"
echo "$OUT"
