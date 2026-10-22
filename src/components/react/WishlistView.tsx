import { useEffect, useRef, useState } from 'react';
import type { Traveller, Localized } from '../../data/schema';
import { localPins, pendingCount, refresh, deletePin, addPin, PINS_EVENT, type Pin } from '../../lib/pins';
import { defaultStopId, nearestStop } from '../../lib/trip';
import { tripNow } from '../../lib/time';
import { getLang } from '../../lib/lang';
import { ui } from '../../i18n/ui';
import { Tx, U } from './Tx';
import './wishlist.css';

type MiniStop = { id: string; name: string; lat: number; lng: number; arrive: string; depart: string };
interface Props {
  travellers: Pick<Traveller, 'name' | 'color'>[];
  stops: MiniStop[];
  startDate: string;
  endDate: string;
}
type Filter = 'all' | 'city' | 'mine';

function useMe() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setMe(localStorage.getItem('tc.name'));
      } catch {}
    };
    read();
    addEventListener('tc:name', read);
    return () => removeEventListener('tc:name', read);
  }, []);
  return me;
}

function ago(iso: string): Localized {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return ui['wish.ago.now'];
  if (s < 3600) return { et: `${Math.floor(s / 60)} min tagasi`, en: `${Math.floor(s / 60)} min ago` };
  if (s < 86400) return { et: `${Math.floor(s / 3600)} h tagasi`, en: `${Math.floor(s / 3600)} h ago` };
  const d = Math.floor(s / 86400);
  return { et: `${d} p tagasi`, en: `${d} d ago` };
}

export default function WishlistView({ travellers, stops, startDate, endDate }: Props) {
  const me = useMe();
  const [pins, setPins] = useState<Pin[]>([]);
  const [pending, setPending] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [cityId, setCityId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setPins(await localPins());
      setPending(await pendingCount());
    };
    load();
    refresh();
    setCityId(defaultStopId({ startDate, endDate, stops } as any, tripNow().date));
    addEventListener(PINS_EVENT, load);
    return () => removeEventListener(PINS_EVENT, load);
  }, [startDate, endDate, stops]);

  const city = stops.find((s) => s.id === cityId);
  const colorOf = (name: string) => travellers.find((t) => t.name === name)?.color ?? '#4b4338';
  const cityOf = (p: Pin) => nearestStop(stops, p.lat, p.lng);
  const shown = pins.filter((p) => (filter === 'mine' ? p.addedBy === me : filter === 'city' ? cityOf(p)?.id === cityId : true));
  const people = new Set(pins.map((p) => p.addedBy)).size;

  const startAdd = () => {
    if (!me) dispatchEvent(new Event('tc:pick-name'));
    else setAdding(true);
  };

  return (
    <>
      <h1 className="serif wl-title"><U k="wish.title" /></h1>
      <p className="muted wl-sum">
        {pins.length} <U k="wish.places" /> · {people} <U k="wish.from" />
      </p>
      {pending > 0 && <span className="pill">{pending} <U k="wish.pending" /></span>}
      <span className="pill offline-pill"><U k="wish.savedCopy" /></span>

      <MiniMap pins={pins} center={city ?? stops[0]} />

      <div className="wl-filters" role="group">
        {(['all', 'city', 'mine'] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? <U k="wish.all" /> : f === 'mine' ? <U k="wish.mine" /> : city?.name}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="wl-empty">
          <p className="serif"><U k="wish.emptyTitle" /></p>
          <p className="muted"><U k="wish.emptyText" /></p>
        </div>
      ) : (
        <ul className="wl-list card">
          {shown.map((p) => (
            <li key={p.id} className={p.pending ? 'pending' : undefined}>
              <span className="wl-mk" aria-hidden="true" />
              <div className="wl-body">
                <a className="wl-name" href={`/map/?pin=${p.id}`}>{p.name}</a>
                {p.note && <p className="aside wl-note">„{p.note}“</p>}
                <p className="wl-meta">
                  <span className="wl-av" style={{ background: colorOf(p.addedBy) }}>{p.addedBy[0]}</span>
                  {p.addedBy}
                  {cityOf(p) && <> · {cityOf(p)!.name}</>} · {p.pending ? <U k="wish.notSynced" /> : <Tx v={ago(p.createdAt)} />}
                </p>
              </div>
              {me && p.addedBy === me && (
                <button
                  type="button"
                  className="wl-del"
                  aria-label={ui['wish.delete'][getLang()]}
                  onClick={() => confirm(ui['wish.confirmDelete'][getLang()]) && deletePin(p)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="wl-fab" onClick={startAdd}>＋ <U k="wish.add" /></button>
      {!me && <p className="wl-who muted"><U k="wish.whoFirst" /></p>}
      {adding && me && <AddSheet me={me} center={city ?? stops[0]} onClose={() => setAdding(false)} />}
    </>
  );
}

function MiniMap({ pins, center }: { pins: Pin[]; center: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const libRef = useRef<typeof import('../../lib/mapSetup') | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import('../../lib/mapSetup');
      if (cancelled || !el.current) return;
      libRef.current = lib;
      const { map } = await lib.createMap(el.current, { center: [center.lng, center.lat], zoom: 12, interactive: false, attributionControl: false });
      if (cancelled) return map.remove();
      mapRef.current = map;
      draw();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = () => {
    const map = mapRef.current, lib = libRef.current;
    if (!map || !lib) return;
    markers.current.forEach((m) => m.remove());
    markers.current = pins.map((p) => {
      const e = document.createElement('span');
      e.className = `mini-pin${p.pending ? ' pending' : ''}`;
      return new lib.maplibregl.Marker({ element: e, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    const near = pins.filter((p) => Math.abs(p.lat - center.lat) < 0.5 && Math.abs(p.lng - center.lng) < 0.5);
    if (near.length > 1) {
      const b = new lib.maplibregl.LngLatBounds([near[0].lng, near[0].lat], [near[0].lng, near[0].lat]);
      near.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 30, maxZoom: 14, animate: false });
    } else map.jumpTo({ center: [center.lng, center.lat], zoom: 12 });
  };
  useEffect(draw, [pins, center]);

  return (
    <a className="wl-mini card-strong" href="/map/">
      <div ref={el} className="wl-mini-map" />
      <span className="wl-open"><U k="wish.openMap" /></span>
    </a>
  );
}

function AddSheet({ me, center, onClose }: { me: string; center: { lat: number; lng: number }; onClose: () => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState<keyof typeof ui | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const useLocation = () => {
    setMsg('wish.locating');
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMsg(null);
        setShowMap(true);
      },
      () => {
        setMsg('wish.locFail');
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  // EXIF is read on the device; the photo itself is never uploaded or stored.
  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const exifr = await import('exifr/dist/lite.esm.mjs');
      const gps = await exifr.gps(file);
      if (gps && isFinite(gps.latitude) && isFinite(gps.longitude)) {
        setLoc({ lat: gps.latitude, lng: gps.longitude });
        setMsg(null);
      } else setMsg('wish.noGps');
    } catch {
      setMsg('wish.noGps');
    }
    setShowMap(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!name.trim() || !loc || busy) return;
    setBusy(true);
    await addPin({ name, note, lat: loc.lat, lng: loc.lng, addedBy: me });
    onClose();
  };

  return (
    <div className="add" role="dialog" aria-modal="true">
      <div className="add-inner">
        <div className="add-head">
          <h2><U k="wish.add" /></h2>
          <button type="button" className="add-x" onClick={onClose} aria-label="Sulge / Close">×</button>
        </div>
        <label className="add-label">
          <U k="wish.name" />
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        </label>
        <label className="add-label">
          <U k="wish.note" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
        </label>

        <p className="add-label"><U k="wish.where" /></p>
        <div className="add-src">
          <button type="button" className="btn" onClick={useLocation}><U k="wish.useLocation" /></button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}><U k="wish.fromPhoto" /></button>
          <button type="button" className="btn" onClick={() => setShowMap(true)}><U k="wish.tapMap" /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        <p className="add-small muted"><U k="wish.photoNote" /></p>
        {msg && <p className="add-msg"><U k={msg} /></p>}
        {showMap && <PickMap loc={loc} center={center} onPick={setLoc} />}
        {showMap && <p className="add-small muted"><U k="wish.tapHint" /></p>}
        <p className="add-small muted offline-only"><U k="wish.offlineSave" /></p>

        <div className="add-actions">
          <button type="button" className="btn" onClick={onClose}><U k="wish.cancel" /></button>
          <button type="button" className="btn btn-primary" disabled={!name.trim() || !loc || busy} onClick={save}><U k="wish.save" /></button>
        </div>
      </div>
    </div>
  );
}

function PickMap({ loc, center, onPick }: { loc: { lat: number; lng: number } | null; center: { lat: number; lng: number }; onPick: (l: { lat: number; lng: number }) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const libRef = useRef<typeof import('../../lib/mapSetup') | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const place = (l: { lat: number; lng: number }) => {
    const lib = libRef.current, map = mapRef.current;
    if (!lib || !map) return;
    if (!markerRef.current) {
      const e = document.createElement('span');
      e.className = 'mini-pin big';
      markerRef.current = new lib.maplibregl.Marker({ element: e, anchor: 'bottom', draggable: true }).setLngLat([l.lng, l.lat]).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLngLat();
        pickRef.current({ lat: p.lat, lng: p.lng });
      });
    } else markerRef.current.setLngLat([l.lng, l.lat]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await import('../../lib/mapSetup');
      if (cancelled || !el.current) return;
      libRef.current = lib;
      const start = loc ?? center;
      const { map } = await lib.createMap(el.current, { center: [start.lng, start.lat], zoom: loc ? 16 : 13 });
      if (cancelled) return map.remove();
      mapRef.current = map;
      if (loc) place(loc);
      map.on('click', (e: any) => {
        const l = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        place(l);
        pickRef.current(l);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loc || !mapRef.current) return;
    place(loc);
    mapRef.current.easeTo({ center: [loc.lng, loc.lat], zoom: Math.max(mapRef.current.getZoom(), 15) });
  }, [loc]);

  return <div ref={el} className="pick-map" />;
}
