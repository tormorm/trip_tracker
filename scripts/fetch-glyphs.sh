#!/usr/bin/env bash
# Download map label fonts (MapLibre glyph PBFs) for the self-hosted map style.
# Result: tiles/glyphs/Noto Sans Regular/*.pbf — upload the whole tiles/glyphs
# folder to httpdocs/tiles/glyphs/ (see DEPLOY.md). Run once.
set -euo pipefail

FONT="Noto Sans Regular"
BASE="https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts"
OUT="tiles/glyphs/$FONT"
mkdir -p "$OUT"
for i in $(seq 0 255); do
  range="$((i * 256))-$((i * 256 + 255))"
  curl -sfL "$BASE/${FONT// /%20}/$range.pbf" -o "$OUT/$range.pbf" || rm -f "$OUT/$range.pbf"
done
echo "$(ls "$OUT" | wc -l) glyph files in $OUT ($(du -sh "$OUT" | cut -f1))"
