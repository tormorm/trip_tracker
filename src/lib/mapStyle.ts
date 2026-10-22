// Paper-and-ink basemap for a Protomaps (v4 schema) PMTiles extract.
import type { StyleSpecification } from 'maplibre-gl';
import { MAP } from '../config';

const LIGHT = {
  bg: '#f3eadb', green: '#dfe3c6', water: '#a9cfc7', building: '#e6d9c2',
  road: '#fffaf0', casing: '#d3c3a6', major: '#fffaf0', highway: '#f6d9b5',
  boundary: '#4b4338', label: '#1b1915', halo: '#f3eadb', minorLabel: '#4b4338',
};
const DARK = {
  bg: '#14120e', green: '#1c2219', water: '#1f3433', building: '#26211a',
  road: '#3a332a', casing: '#14120e', major: '#4a4135', highway: '#5c4a35',
  boundary: '#c9bda9', label: '#f5ecdd', halo: '#14120e', minorLabel: '#c9bda9',
};

export function protomapsStyle(pmtilesUrl: string, dark: boolean): StyleSpecification {
  const c = dark ? DARK : LIGHT;
  const kind = (...k: string[]) => ['in', ['get', 'kind'], ['literal', k]] as any;
  const w = (z10: number, z16: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 10, z10, 16, z16] as any;
  const font = ['Noto Sans Regular'];
  // MapLibre can't shape Khmer script, so prefer English names; Vietnamese
  // streets usually have no English name and keep their own (Latin) one.
  const label = ['coalesce', ['get', 'name:en'], ['get', 'name']] as any;
  return {
    version: 8,
    glyphs: new URL(MAP.glyphs, location.origin).href.replace(/%7B/g, '{').replace(/%7D/g, '}'),
    sources: {
      pm: { type: 'vector', url: `pmtiles://${new URL(pmtilesUrl, location.origin).href}`, attribution: '© OpenStreetMap · Protomaps' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },
      { id: 'earth', type: 'fill', source: 'pm', 'source-layer': 'earth', paint: { 'fill-color': c.bg } },
      { id: 'landcover', type: 'fill', source: 'pm', 'source-layer': 'landcover', filter: kind('forest', 'grassland', 'scrub'), paint: { 'fill-color': c.green, 'fill-opacity': 0.6 } },
      { id: 'landuse', type: 'fill', source: 'pm', 'source-layer': 'landuse', filter: kind('park', 'forest', 'wood', 'nature_reserve', 'garden', 'grass', 'farmland', 'golf_course', 'cemetery'), paint: { 'fill-color': c.green } },
      { id: 'water', type: 'fill', source: 'pm', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c.water } },
      { id: 'water-line', type: 'line', source: 'pm', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': c.water, 'line-width': w(1, 4) } },
      { id: 'buildings', type: 'fill', source: 'pm', 'source-layer': 'buildings', minzoom: 14, paint: { 'fill-color': c.building } },
      { id: 'boundaries', type: 'line', source: 'pm', 'source-layer': 'boundaries', filter: kind('country'), paint: { 'line-color': c.boundary, 'line-width': 1.5, 'line-dasharray': [3, 2] } },
      { id: 'road-path', type: 'line', source: 'pm', 'source-layer': 'roads', minzoom: 14, filter: kind('path'), paint: { 'line-color': c.casing, 'line-width': 1.2, 'line-dasharray': [2, 1.5] } },
      { id: 'road-minor-case', type: 'line', source: 'pm', 'source-layer': 'roads', minzoom: 12, filter: kind('minor_road', 'other'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.casing, 'line-width': w(1, 9) } },
      { id: 'road-major-case', type: 'line', source: 'pm', 'source-layer': 'roads', filter: kind('major_road', 'highway'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.casing, 'line-width': w(2.5, 14) } },
      { id: 'road-minor', type: 'line', source: 'pm', 'source-layer': 'roads', minzoom: 12, filter: kind('minor_road', 'other'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.road, 'line-width': w(0.5, 7) } },
      { id: 'road-major', type: 'line', source: 'pm', 'source-layer': 'roads', filter: kind('major_road'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.major, 'line-width': w(1.5, 11) } },
      { id: 'road-highway', type: 'line', source: 'pm', 'source-layer': 'roads', filter: kind('highway'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.highway, 'line-width': w(2, 12) } },
      { id: 'road-label', type: 'symbol', source: 'pm', 'source-layer': 'roads', minzoom: 14, filter: kind('major_road', 'minor_road'), layout: { 'symbol-placement': 'line', 'text-field': label, 'text-font': font, 'text-size': 12 }, paint: { 'text-color': c.minorLabel, 'text-halo-color': c.halo, 'text-halo-width': 1.5 } },
      { id: 'place-label', type: 'symbol', source: 'pm', 'source-layer': 'places', filter: kind('locality', 'neighbourhood', 'macrohood', 'region', 'country'), layout: { 'text-field': label, 'text-font': font, 'text-size': ['match', ['get', 'kind'], 'country', 15, 'locality', 14, 12], 'text-max-width': 8 }, paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 2 } },
    ],
  };
}

/** Plain paper map: used when no tiles are reachable, so the screen is never blank. */
export function blankStyle(dark: boolean): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': (dark ? DARK : LIGHT).bg } }] };
}

/** Pick the best available style: own PMTiles → OpenFreeMap → blank. */
export async function resolveStyle(dark: boolean): Promise<StyleSpecification | string> {
  try {
    const r = await fetch(MAP.pmtiles, { headers: { Range: 'bytes=0-6' }, credentials: 'same-origin' });
    // Read only the first chunk, in case a server ignores Range and sends the whole file.
    const reader = r.body?.getReader();
    const first = reader && (await reader.read()).value;
    reader?.cancel().catch(() => {});
    if (r.ok && first && new TextDecoder().decode(first.slice(0, 7)) === 'PMTiles') return protomapsStyle(MAP.pmtiles, dark);
  } catch {}
  try {
    const r = await fetch(MAP.fallbackStyle);
    if (r.ok) return await r.json();
  } catch {}
  return blankStyle(dark);
}
