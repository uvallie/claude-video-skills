#!/usr/bin/env bash
# cut.sh <відео> <початок> <кінець> [вихід]  — вирізати шматок. Час: ГГ:ХХ:СС(.мс) або секунди.
source "$(dirname "$0")/lib.sh"
IN="${1:?використання: cut.sh <відео> <початок> <кінець> [вихід]}"; S="${2:?початок}"; E="${3:?кінець}"
OUT="${4:-$WORK/cuts/$(stem "$IN")_${S//:/-}_${E//:/-}.mp4}"
mkdir -p "$(dirname "$OUT")"
"$FF" -hide_banner -loglevel error -y -ss "$S" -to "$E" -i "$IN" -c:v libx264 -preset slow -crf 18 \
       -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "$OUT"
