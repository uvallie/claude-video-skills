#!/usr/bin/env bash
# burn_captions.sh <відео> <субтитри.srt|.ass> [стиль: Vertical|Horizontal|Highlight] [вихід]
# .srt спершу перетворюється у вибраний стиль з config/caption_style.ass.
# Розмітка субтитрів (PlayRes) підганяється під справжній розмір відео, тож той самий .ass годиться для 9:16, 4:5, 1:1, 16:9.
# Спершу кадруй (reframe), потім субтитри — інакше обріжеться текст.
source "$(dirname "$0")/lib.sh"
FILTERS="$("$FF" -hide_banner -filters 2>/dev/null || true)"
grep -q ' ass ' <<<"$FILTERS" || die "цей ffmpeg без libass (не вміє субтитри). Mac: brew install ffmpeg-full; Windows: збірка gyan.dev full; Linux: пакет ffmpeg з дистрибутива"
IN="${1:?використання: burn_captions.sh <відео> <субтитри> [стиль] [вихід]}"
SUB="${2:?субтитри}"; STYLE="${3:-Vertical}"
OUT="${4:-$WORK/captioned/$(stem "$IN")_captions.mp4}"; mkdir -p "$(dirname "$OUT")"
FONTS="$PROJECT/fonts"; mkdir -p "$FONTS" "$WORK/tmp"
TMP="$WORK/tmp/$(stem "$IN").$$.ass"; trap 'rm -f "$TMP"' EXIT
if [[ "$SUB" != *.ass ]]; then "$PY" "$(dirname "$0")/srt_to_ass.py" "$SUB" "$TMP" --style "$STYLE"; else cp "$SUB" "$TMP"; fi
IFS=x read -r W H < <("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$IN")
sed -i.bak -e "s/^PlayResX: .*/PlayResX: $W/" -e "s/^PlayResY: .*/PlayResY: $H/" "$TMP" && rm -f "$TMP.bak"
# горизонтальне відео: вертикальні стилі (великий шрифт, високий відступ) замінюємо на Horizontal
if (( W > H )); then sed -i.bak -E 's/^(Dialogue: [^,]*,[^,]*,[^,]*,)(Vertical|Highlight),/\1Horizontal,/' "$TMP" && rm -f "$TMP.bak"; fi
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" -e 's/:/\\:/g'; }
"$FF" -hide_banner -loglevel error -y -i "$IN" \
  -vf "ass=filename='$(esc "$TMP")':fontsdir='$(esc "$FONTS")'" \
  -c:v libx264 -preset slow -crf 18 -c:a copy -movflags +faststart "$OUT"
echo "$OUT"
