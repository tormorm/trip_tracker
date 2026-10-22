// "Save city for offline": fetch every tile in a bbox through PMTiles so the
// service worker (public/sw-tiles.js) stores the byte ranges.
import { PMTiles } from 'pmtiles';
import { MAP } from '../config';

type BBox = [number, number, number, number];

const lon2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export function tilesFor([w, s, e, n]: BBox, [zMin, zMax]: [number, number]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let z = zMin; z <= zMax; z++)
    for (let x = lon2x(w, z); x <= lon2x(e, z); x++)
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push([z, x, y]);
  return out;
}

export function planFor(bbox: BBox) {
  const tiles = [...tilesFor(MAP.regionBbox, MAP.regionZooms), ...tilesFor(bbox, MAP.saveZooms)];
  return { tiles, estimateMb: Math.round((tiles.length * MAP.avgTileKb) / 1024) };
}

export async function tilesAvailable(): Promise<boolean> {
  try {
    await new PMTiles(new URL(MAP.pmtiles, location.origin).href).getHeader();
    return true;
  } catch {
    return false;
  }
}

export async function saveTiles(bbox: BBox, onProgress: (done: number, total: number) => void): Promise<{ failed: number }> {
  navigator.storage?.persist?.().catch(() => {});
  const pm = new PMTiles(new URL(MAP.pmtiles, location.origin).href);
  const { tiles } = planFor(bbox);
  let next = 0, done = 0, failed = 0;
  const worker = async () => {
    while (next < tiles.length) {
      const [z, x, y] = tiles[next++];
      try {
        await pm.getZxy(z, x, y);
      } catch {
        failed++;
      }
      onProgress(++done, tiles.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  // Label fonts for the offline map.
  await Promise.all(
    MAP.glyphRanges.map((r) => fetch(MAP.glyphs.replace('{fontstack}', 'Noto Sans Regular').replace('{range}', r)).catch(() => {})),
  );
  return { failed };
}

export async function storageUsedMb(): Promise<number | null> {
  const est = await navigator.storage?.estimate?.();
  return est?.usage != null ? Math.round(est.usage / 1024 / 1024) : null;
}
