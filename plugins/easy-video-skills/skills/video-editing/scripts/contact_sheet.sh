#!/usr/bin/env bash
# contact_sheet.sh <відео> [кількість=12] [вихід.png] — кадри на одній картинці, щоб перевірити монтаж очима
source "$(dirname "$0")/lib.sh"
IN="${1:?використання: contact_sheet.sh <відео> [кількість] [вихід.png]}"; N="${2:-12}"
OUT="${3:-$WORK/sheets/$(stem "$IN").png}"; mkdir -p "$(dirname "$OUT")"
DUR=$("$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$IN")
RATE=$(awk -v n="$N" -v d="$DUR" 'BEGIN{printf "%.5f", n/d}')
COLS=4; ROWS=$(( (N + COLS - 1) / COLS ))
"$FF" -hide_banner -loglevel error -y -i "$IN" -vf "fps=$RATE,scale=480:-1,tile=${COLS}x${ROWS}:padding=6:color=white" -frames:v 1 "$OUT"
echo "$OUT"
