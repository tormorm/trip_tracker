// Site-level settings that aren't trip content.
export const MAP = {
  /** Self-hosted Protomaps extract (see DEPLOY.md / scripts/extract-tiles.sh). */
  pmtiles: '/tiles/vietnam-cambodia.pmtiles',
  /** Self-hosted label fonts for the PMTiles style. */
  glyphs: '/tiles/glyphs/{fontstack}/{range}.pbf',
  /** Used when the PMTiles file isn't there yet (e.g. local development). */
  fallbackStyle: 'https://tiles.openfreemap.org/styles/liberty',
  /** Highest zoom in the extract; the map overzooms beyond it. */
  maxDataZoom: 15,
  /** "Save city for offline" downloads the city's bbox at these zooms… */
  saveZooms: [11, 15] as [number, number],
  /** …plus a light overview of the whole region. */
  regionBbox: [102.1, 8.4, 109.6, 23.4] as [number, number, number, number],
  regionZooms: [4, 8] as [number, number],
  /** Rough average tile size for the size estimate. */
  avgTileKb: 35,
  /** Glyph ranges to prefetch: Latin, Latin-1/Ext, combining marks, Vietnamese, punctuation. */
  glyphRanges: ['0-255', '256-511', '768-1023', '7680-7935', '8192-8447'],
};
