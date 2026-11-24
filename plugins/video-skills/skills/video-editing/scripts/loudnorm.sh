#!/usr/bin/env bash
# loudnorm.sh <відео> [вихід] — гучність під соцмережі (−14 LUFS), відео не перекодовується
source "$(dirname "$0")/lib.sh"
IN="${1:?використання: loudnorm.sh <відео> [вихід]}"; OUT="${2:-$WORK/final/$(stem "$IN").mp4}"; mkdir -p "$(dirname "$OUT")"
"$FF" -hide_banner -loglevel error -y -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=11 -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "$OUT"
