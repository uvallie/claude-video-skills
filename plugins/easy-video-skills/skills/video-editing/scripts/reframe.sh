#!/usr/bin/env bash
# reframe.sh <відео> <формат> [режим] [папка]
#   формат: reels_9x16 | feed_4x5 | square_1x1 | youtube_16x9  (config/formats.json)
#   режим:  crop (за замовч., обрізати по центру) | pad (вписати з чорними смугами) | blur (вписати на розмитий фон)
#   center: X — горизонтальний центр кадру 0..1 для crop (0.5 — по центру; 0.35 — людина лівіше)
source "$(dirname "$0")/lib.sh"; need jq
IN="${1:?використання: reframe.sh <відео> <формат> [crop|pad|blur] [папка]}"
P="${2:?формат}"; MODE="${3:-crop}"; CENTER="${CENTER:-0.5}"
CFG="$(cfg formats.json)"
jq -e --arg p "$P" 'has($p)' "$CFG" >/dev/null || die "невідомий формат '$P' (є: $(jq -r 'keys|join(", ")' "$CFG"))"
W=$(jq -r --arg p "$P" '.[$p].w' "$CFG"); H=$(jq -r --arg p "$P" '.[$p].h' "$CFG")
FPS=$(jq -r --arg p "$P" '.[$p].fps' "$CFG"); VBR=$(jq -r --arg p "$P" '.[$p].vbr' "$CFG"); ABR=$(jq -r --arg p "$P" '.[$p].abr' "$CFG")
OUT="${4:-$WORK/formats}"; mkdir -p "$OUT"
case "$MODE" in
  crop) VF="scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${CENTER}:(ih-${H})/2" ;;
  pad)  VF="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black" ;;
  blur) VF="split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=30[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" ;;
  *)    die "режим: crop|pad|blur" ;;
esac
"$FF" -hide_banner -loglevel error -y -i "$IN" -filter_complex "$VF,fps=${FPS},format=yuv420p" \
       -c:v libx264 -preset slow -b:v "$VBR" -maxrate "$VBR" -bufsize 20M \
       -c:a aac -b:a "$ABR" -movflags +faststart "$OUT/$(stem "$IN")_${P}.mp4"
echo "$OUT/$(stem "$IN")_${P}.mp4"
