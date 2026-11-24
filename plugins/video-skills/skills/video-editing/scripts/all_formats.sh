#!/usr/bin/env bash
# all_formats.sh <відео> [crop|pad|blur] — усі формати з config/formats.json
source "$(dirname "$0")/lib.sh"; need jq
IN="${1:?використання: all_formats.sh <відео> [crop|pad|blur]}"; MODE="${2:-crop}"
for p in $(jq -r 'keys[]' "$(cfg formats.json)"); do "$(dirname "$0")/reframe.sh" "$IN" "$p" "$MODE"; done
