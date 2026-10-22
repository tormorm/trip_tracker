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
};
