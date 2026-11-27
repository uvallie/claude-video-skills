#!/usr/bin/env bash
# extract_audio.sh <відео> [папка] → WAV 16 кГц моно (для розпізнавання мови)
source "$(dirname "$0")/lib.sh"
IN="${1:?використання: extract_audio.sh <відео> [папка]}"; OUT="${2:-$WORK/audio}"; mkdir -p "$OUT"
"$FF" -hide_banner -loglevel error -y -i "$IN" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$OUT/$(stem "$IN").wav"
echo "$OUT/$(stem "$IN").wav"
