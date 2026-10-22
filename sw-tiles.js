// Map tile caching for the self-hosted PMTiles file, imported into the
// Workbox service worker. PMTiles reads byte ranges of one big file; the Cache
// API can't store 206 responses, so each range is stored as a 200 under a
// range-specific key and turned back into a 206 when served.
//
// Strategy: cache on view, stale-while-revalidate — but only revalidate
// entries older than a week (tiles rarely change; saves mobile data).
// Replaced the .pmtiles file? Bump TILE_CACHE so old ranges are dropped.
const TILE_CACHE = 'tiles-v1';
const REVALIDATE_AFTER_MS = 7 * 24 * 3600 * 1000;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('tiles-') && k !== TILE_CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/tiles/') || !url.pathname.endsWith('.pmtiles')) return;
  const range = req.headers.get('range');
  if (!range) return; // never cache the whole file
  event.respondWith(serveRange(event, url, range));
});

async function serveRange(event, url, range) {
  const key = `${url.origin}${url.pathname}?range=${encodeURIComponent(range)}`;
  const cache = await caches.open(TILE_CACHE);
  // pmtiles retries with cache:'reload' when the file's ETag changed.
  const cached = event.request.cache === 'reload' ? undefined : await cache.match(key);

  const network = fetch(event.request).then(async (res) => {
    if (res.status === 206) {
      const body = await res.clone().arrayBuffer();
      await cache.put(
        key,
        new Response(body, {
          status: 200,
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'X-Content-Range': res.headers.get('Content-Range') || '',
            'X-ETag': res.headers.get('ETag') || '',
            'X-Cached-At': String(Date.now()),
          },
        }),
      );
    }
    return res;
  });

  if (!cached) return network;
  if (Date.now() - Number(cached.headers.get('X-Cached-At') || 0) > REVALIDATE_AFTER_MS) {
    event.waitUntil(network.catch(() => {}));
  }
  const body = await cached.arrayBuffer();
  const headers = {
    'Content-Type': cached.headers.get('Content-Type'),
    'Content-Range': cached.headers.get('X-Content-Range'),
    'Content-Length': String(body.byteLength),
  };
  const etag = cached.headers.get('X-ETag');
  if (etag) headers.ETag = etag;
  return new Response(body, { status: 206, headers });
}
