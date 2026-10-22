import { useEffect, useMemo, useRef, useState } from 'react';
import type { Place, Stop, Localized } from '../../data/schema';
import { createMap, maplibregl } from '../../lib/mapSetup';
import { localPins, refresh, PINS_EVENT, type Pin } from '../../lib/pins';
import { tripNow } from '../../lib/time';
import { dayNumber, gmapsHref, telHref } from '../../lib/trip';
import { Tx, U } from './Tx';
import './map.css';

type MapStop = Pick<Stop, 'id' | 'name' | 'country' | 'lat' | 'lng'> & { hotel: Pick<Stop['hotel'], 'name' | 'nameLocal' | 'address' | 'phone' | 'lat' | 'lng'> };
type MapPlace = Pick<Place, 'id' | 'stopId' | 'name' | 'nameLocal' | 'tier' | 'lat' | 'lng' | 'note' | 'bestTime'>;
interface MapDay {
  date: string;
  stopId: string;
  title: Localized;
  placeIds: string[];
}
type WishPin = Pin;
interface Props {
  startDate: string;
  stops: MapStop[];
  places: MapPlace[];
  days: MapDay[];
}

type Layer = 'popular' | 'hidden' | 'wishlist' | 'hotels';
const LAYERS: Layer[] = ['popular', 'hidden', 'wishlist', 'hotels'];
type Selection = { kind: 'place'; place: MapPlace } | { kind: 'hotel'; stop: MapStop } | { kind: 'pin'; pin: WishPin };

const LAYER_KEY = 'tc.mapLayers';

function loadLayers(): Record<Layer, boolean> {
  const all = { popular: true, hidden: true, wishlist: true, hotels: true };
  try {
    return { ...all, ...JSON.parse(localStorage.getItem(LAYER_KEY) ?? '{}') };
  } catch {
    return all;
  }
}

const SHEET_PAD = { top: 170, bottom: 150, left: 40, right: 40 };

export default function MapView({ startDate, stops, places, days }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<maplibregl.Marker | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const [layers, setLayers] = useState(loadLayers);
  const [sel, setSel] = useState<Selection | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const stopById = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const flyToDay = (date: string, animate = true) => {
    const map = mapRef.current;
    const day = days.find((d) => d.date === date);
    if (!map || !day) return;
    setActiveDay(date);
    const stop = stopById.get(day.stopId)!;
    const pts: [number, number][] = [[stop.hotel.lng, stop.hotel.lat], ...day.placeIds.map((id) => placeById.get(id)!).map((p) => [p.lng, p.lat] as [number, number])];
    if (pts.length === 1) map.flyTo({ center: pts[0], zoom: 14, animate });
    else {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: SHEET_PAD, maxZoom: 15, animate, duration: 900 });
    }
  };

  const focus = (lng: number, lat: number) => mapRef.current?.flyTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 14), offset: [0, -80] });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | undefined;
    let pinMarkers: maplibregl.Marker[] = [];
    const drawPins = async () => {
      const pins = await localPins();
      if (cancelled || !map) return;
      pinMarkers.forEach((m) => m.remove());
      pinMarkers = pins.map((pin) =>
        marker(`mkr-wishlist${pin.pending ? ' pending' : ''}`, pin.name, () => {
          setSel({ kind: 'pin', pin });
          focus(pin.lng, pin.lat);
        }).setLngLat([pin.lng, pin.lat]).addTo(map!),
      );
    };
    addEventListener(PINS_EVENT, drawPins);
    (async () => {
      if (!mapEl.current) return;
      const created = await createMap(mapEl.current, {
        bounds: boundsOf(stops.map((s) => [s.lng, s.lat])),
        fitBoundsOptions: { padding: SHEET_PAD },
      });
      map = created.map;
      const dark = created.dark;
      if (cancelled) return map.remove();
      mapRef.current = map;

      map.on('load', () => {
        map!.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stops.map((s) => [s.lng, s.lat]) } },
        });
        map!.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': dark ? '#f5ecdd' : '#1b1915', 'line-width': 3, 'line-dasharray': [0.1, 2] },
        });
      });

      // Far out: only stops (hotels) with names; mid: places without labels; close: everything.
      const zoomClass = () => {
        const z = map!.getZoom();
        wrapRef.current?.classList.toggle('zoom-far', z < 9);
        wrapRef.current?.classList.toggle('zoom-low', z < 12);
      };
      map.on('zoom', zoomClass);
      zoomClass();

      for (const p of places) {
        marker(`mkr-${p.tier}`, p.name, () => {
          setSel({ kind: 'place', place: p });
          focus(p.lng, p.lat);
        }).setLngLat([p.lng, p.lat]).addTo(map);
      }
      for (const s of stops) {
        marker('mkr-hotels', s.name, () => {
          setSel({ kind: 'hotel', stop: s });
          focus(s.hotel.lng, s.hotel.lat);
        }, BED_ICON).setLngLat([s.hotel.lng, s.hotel.lat]).addTo(map);
      }
      drawPins();
      refresh();

      // Initial view: ?place=… › ?day=… › today › whole route.
      const q = new URLSearchParams(location.search);
      const now = tripNow().date;
      setToday(now);
      const place = q.get('place') && placeById.get(q.get('place')!);
      const pinParam = q.get('pin');
      if (place) {
        setSel({ kind: 'place', place });
        map.jumpTo({ center: [place.lng, place.lat], zoom: 15 });
        const day = days.find((d) => d.placeIds.includes(place.id));
        if (day) setActiveDay(day.date);
      } else if (pinParam) {
        const pin = (await localPins()).find((p) => p.id === pinParam);
        if (pin) {
          setSel({ kind: 'pin', pin });
          map.jumpTo({ center: [pin.lng, pin.lat], zoom: 15 });
        }
      } else if (q.get('day') && days.some((d) => d.date === q.get('day'))) {
        flyToDay(q.get('day')!, false);
      } else if (days.some((d) => d.date === now)) {
        flyToDay(now, false);
      }
    })();
    return () => {
      cancelled = true;
      removeEventListener(PINS_EVENT, drawPins);
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the selected day visible in the strip.
  useEffect(() => {
    const d = activeDay ?? today;
    stripRef.current?.querySelector(`[data-date="${d}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeDay, today]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYER_KEY, JSON.stringify(layers));
    } catch {}
  }, [layers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const map = mapRef.current;
        if (!map) return;
        if (!meRef.current) {
          const el = document.createElement('div');
          el.className = 'me';
          meRef.current = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
        } else meRef.current.setLngLat(ll);
        map.flyTo({ center: ll, zoom: Math.max(map.getZoom(), 15) });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const active = days.find((d) => d.date === activeDay);
  const activeStop = active && stopById.get(active.stopId);
  const hidden = LAYERS.filter((l) => !layers[l]).map((l) => `hide-${l}`).join(' ');

  return (
    <div ref={wrapRef} className={`mapwrap ${hidden}`}>
      <div ref={mapEl} className="map" />

      <div className="map-top">
        <div className="where">
          <strong>
            {activeStop ? (
              <>
                {activeStop.name} · <Tx v={{ et: `${dayNumber({ startDate }, active!.date)}. päev`, en: `day ${dayNumber({ startDate }, active!.date)}` }} />
              </>
            ) : (
              <U k="tab.map" />
            )}
          </strong>
          <span className="pill offline-pill"><U k="offline" /></span>
        </div>
        <div className="chips" role="group">
          {LAYERS.map((l) => (
            <button key={l} type="button" className={`chip chip-${l}`} aria-pressed={layers[l]} onClick={() => setLayers({ ...layers, [l]: !layers[l] })}>
              <span className="chip-mk" aria-hidden="true" />
              <U k={`layer.${l}`} />
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={`locate${locating ? ' busy' : ''}`} onClick={locate} aria-label="Minu asukoht / My location">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 1v4m0 14v4M1 12h4m14 0h4" /></svg>
      </button>

      <ol className="strip" ref={stripRef}>
        {days.map((d) => {
          const isToday = d.date === today;
          return (
            <li key={d.date}>
              <button type="button" data-date={d.date} className={`dayb${isToday ? ' today' : ''}${d.date === activeDay ? ' active' : ''}${today && d.date < today ? ' past' : ''}`} onClick={() => { setSel(null); flyToDay(d.date); }}>
                <span className="dnum">{Number(d.date.slice(8))}</span>
                <span className="dstop">{isToday ? <U k="today" /> : stopById.get(d.stopId)!.name}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {sel && <Sheet sel={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function Sheet({ sel, onClose }: { sel: Selection; onClose: () => void }) {
  const lat = sel.kind === 'place' ? sel.place.lat : sel.kind === 'hotel' ? sel.stop.hotel.lat : sel.pin.lat;
  const lng = sel.kind === 'place' ? sel.place.lng : sel.kind === 'hotel' ? sel.stop.hotel.lng : sel.pin.lng;
  return (
    <section className="sheet" role="dialog" aria-modal="false">
      <button type="button" className="close" onClick={onClose} aria-label="Sulge / Close">×</button>
      {sel.kind === 'place' && (
        <>
          <p className={`kind kind-${sel.place.tier}`}><span className="chip-mk" /> <U k={`tier.${sel.place.tier}`} /></p>
          <h2>{sel.place.name}</h2>
          {sel.place.nameLocal && <p className="local">{sel.place.nameLocal}</p>}
          <p><Tx v={sel.place.note} /></p>
          <p className="best"><strong><U k="map.bestTime" />:</strong> <Tx v={sel.place.bestTime} /></p>
        </>
      )}
      {sel.kind === 'hotel' && (
        <>
          <p className="kind kind-hotels"><span className="chip-mk" /> <U k="hotel" /> · {sel.stop.name}</p>
          <h2>{sel.stop.hotel.name}</h2>
          <p className="local">{sel.stop.hotel.nameLocal}</p>
          <p>{sel.stop.hotel.address}</p>
        </>
      )}
      {sel.kind === 'pin' && (
        <>
          <p className="kind kind-wishlist"><span className="chip-mk" /> <U k="layer.wishlist" /> · {sel.pin.addedBy}</p>
          <h2>{sel.pin.name}</h2>
          {sel.pin.note && <p className="aside">„{sel.pin.note}“</p>}
        </>
      )}
      <div className="sheet-actions">
        <a className="btn btn-ink" href={gmapsHref(lat, lng)} target="_blank" rel="noopener noreferrer"><U k="map.openGoogle" /></a>
        {sel.kind === 'hotel' && (
          <>
            <a className="btn" href={`/driver/?hotel=${sel.stop.id}`}><U k="today.driver" /></a>
            <a className="btn" href={telHref(sel.stop.hotel.phone)}><U k="plan.callHotel" /></a>
          </>
        )}
      </div>
    </section>
  );
}

const BED_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 18V7m0 7h18v4M3 11h7v3m11 0v-1a2 2 0 0 0-2-2h-9"/></svg>';

function marker(cls: string, label: string, onClick: () => void, inner = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `mkr ${cls}`;
  b.setAttribute('aria-label', label);
  b.innerHTML = `<span class="shape">${inner}</span><span class="lbl"></span>`;
  b.querySelector('.lbl')!.textContent = label;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  // Anchor on the shape's centre, label hangs to the right.
  return new maplibregl.Marker({ element: b, anchor: 'left', offset: [-16, 0] });
}

function boundsOf(pts: [number, number][]) {
  const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach((p) => b.extend(p));
  return b;
}
