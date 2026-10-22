#!/usr/bin/env bash
# Cut a Vietnam + Cambodia map extract from the daily Protomaps planet build.
# Needs the `pmtiles` CLI: https://github.com/protomaps/go-pmtiles/releases
#
#   scripts/extract-tiles.sh            # yesterday's build, maxzoom 15
#   scripts/extract-tiles.sh 20261020 14
#
# Only the needed byte ranges are downloaded, not the whole planet.
# Add --dry-run by hand first if you want to see the size before downloading.
set -euo pipefail

DATE="${1:-$(date -u -d yesterday +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d)}"
MAXZOOM="${2:-15}"
BBOX="102.1,8.4,109.6,23.4"   # west,south,east,north — all of Vietnam and Cambodia
OUT="vietnam-cambodia.pmtiles"

pmtiles extract "https://build.protomaps.com/${DATE}.pmtiles" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"
pmtiles show "$OUT" | head -20
ls -lh "$OUT"
echo
echo "Upload $OUT to httpdocs/tiles/ on the server (see DEPLOY.md)."
echo "Replacing an older file? Bump TILE_CACHE in public/sw-tiles.js before the next deploy."
