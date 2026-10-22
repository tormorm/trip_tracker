// One place to boot MapLibre: worker URL, PMTiles protocol, best available style.
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
// MapLibre locates its worker relative to its own file, which bundling breaks.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { resolveStyle } from './mapStyle';
import { MAP } from '../config';

let ready = false;
function init() {
  if (ready) return;
  maplibregl.setWorkerUrl(workerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  ready = true;
}

export async function createMap(container: HTMLElement, options: Omit<maplibregl.MapOptions, 'container' | 'style'>) {
  init();
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const style = await resolveStyle(dark);
  const map = new maplibregl.Map({
    container,
    style,
    maxZoom: MAP.maxDataZoom + 3,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true },
    ...options,
  });
  map.touchZoomRotate.disableRotation();
  // Missing tiles offline are expected; keep the console quiet.
  map.on('error', () => {});
  return { map, dark };
}

export { maplibregl };
