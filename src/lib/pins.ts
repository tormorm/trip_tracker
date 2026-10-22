// Wishlist pins: server list cached for offline, plus an IndexedDB queue of
// changes made offline. The queue is flushed on app open and on `online`
// (no Background Sync — iOS doesn't have it).
export interface Pin {
  id: string;
  name: string;
  note: string | null;
  lat: number;
  lng: number;
  addedBy: string;
  createdAt: string;
  /** Created on this phone, not on the server yet. */
  pending?: boolean;
}
type Op = { kind: 'create'; pin: Pin } | { kind: 'delete'; id: string; addedBy: string };
interface Queued {
  seq?: number;
  op: Op;
}

const API = '/api/pins.php';
const CACHE_KEY = 'tc.pins.cache';
export const PINS_EVENT = 'tc:pins';

// ---------- tiny IndexedDB wrapper ----------
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('trip-companion', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('queue', mode);
    const r = fn(t.objectStore('queue'));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  });
}
const queueAll = async () => ((await tx('readonly', (s) => s.getAll() as IDBRequest<Queued[]>)) ?? []) as Queued[];
const enqueue = (op: Op) => tx('readwrite', (s) => s.add({ op }));
const dequeue = (seq: number) => tx('readwrite', (s) => s.delete(seq));

// ---------- cache ----------
function readCache(): Pin[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeCache(pins: Pin[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(pins));
    localStorage.setItem(CACHE_KEY + '.at', new Date().toISOString());
  } catch {}
}
export function cacheTime(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY + '.at');
  } catch {
    return null;
  }
}

const notify = () => dispatchEvent(new Event(PINS_EVENT));

/** What to show now: cached server list with local changes applied. */
export async function localPins(): Promise<Pin[]> {
  let queue: Queued[] = [];
  try {
    queue = await queueAll();
  } catch {}
  const deleted = new Set(queue.flatMap((q) => (q.op.kind === 'delete' ? [q.op.id] : [])));
  const created = queue.flatMap((q) => (q.op.kind === 'create' ? [{ ...q.op.pin, pending: true }] : []));
  const server = readCache().filter((p) => !deleted.has(p.id) && !created.some((c) => c.id === p.id));
  return [...created, ...server].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pendingCount(): Promise<number> {
  try {
    return (await queueAll()).length;
  } catch {
    return 0;
  }
}

/** Fetch the server list into the cache. Returns false when offline/unreachable. */
export async function refresh(): Promise<boolean> {
  try {
    const r = await fetch(API, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return false;
    const { pins } = (await r.json()) as { pins: Pin[] };
    writeCache(pins);
    notify();
    return true;
  } catch {
    return false;
  }
}

let flushing: Promise<void> | null = null;
/** Send queued changes in order; stop at the first network failure. */
export function flush(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (const q of await queueAll()) {
        let res: Response;
        try {
          res =
            q.op.kind === 'create'
              ? await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q.op.pin) })
              : await fetch(`${API}?id=${encodeURIComponent(q.op.id)}&addedBy=${encodeURIComponent(q.op.addedBy)}`, { method: 'DELETE', credentials: 'same-origin' });
        } catch {
          return; // offline: try again later
        }
        // 5xx/auth trouble: keep it queued. 4xx (bad data, already deleted): drop it.
        if (res.status >= 500 || res.status === 401 || res.status === 403) return;
        if (!res.ok && res.status !== 404) console.warn('Dropped wishlist change', q.op, res.status);
        await dequeue(q.seq!);
      }
    } catch {
      // IndexedDB unavailable (e.g. private mode): nothing queued.
    } finally {
      flushing = null;
    }
    await refresh();
  })();
  return flushing;
}

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function addPin(input: { name: string; note?: string; lat: number; lng: number; addedBy: string }): Promise<void> {
  const pin: Pin = {
    id: uuid(),
    name: input.name.trim().slice(0, 80),
    note: input.note?.trim().slice(0, 500) || null,
    lat: Math.round(input.lat * 1e6) / 1e6,
    lng: Math.round(input.lng * 1e6) / 1e6,
    addedBy: input.addedBy,
    createdAt: new Date().toISOString(),
  };
  await enqueue({ kind: 'create', pin });
  notify();
  flush();
}

export async function deletePin(pin: Pin): Promise<void> {
  // Never reached the server? Just drop it from the queue.
  const queued = (await queueAll()).find((q) => q.op.kind === 'create' && q.op.pin.id === pin.id);
  if (queued) await dequeue(queued.seq!);
  else await enqueue({ kind: 'delete', id: pin.id, addedBy: pin.addedBy });
  notify();
  flush();
}

/** Call once per page: sync on open and whenever the connection returns. */
export function startSync() {
  flush();
  addEventListener('online', () => flush());
}
