import { useCallback, useEffect, useRef, useState } from 'react';
import type { StopsData } from '../../lib/hotelPicker';
import { initialStopId } from '../../lib/hotelPicker';
import { bearingDeg, distanceM } from '../../lib/trip';
import { setLang } from '../../lib/lang';
import { Tx, U } from './Tx';
import './beacon.css';

interface Props {
  data: StopsData;
}
interface Fix {
  lat: number;
  lng: number;
  acc: number;
  speed: number | null;
  course: number | null;
}
interface Meet {
  lat: number;
  lng: number;
  at: string;
}
type Mode = 'compass' | 'course' | 'north';

const MEET_KEY = 'tc.meet';
const rad = Math.PI / 180;

function loadMeet(): Meet | null {
  try {
    return JSON.parse(localStorage.getItem(MEET_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function screenAngle(): number {
  return (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
}

export default function Beacon({ data }: Props) {
  const [stopId, setStopId] = useState<string>(data.stops[0].id);
  const [target, setTarget] = useState<'hotel' | 'meet'>('hotel');
  const [meet, setMeet] = useState<Meet | null>(null);
  const [running, setRunning] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [mode, setMode] = useState<Mode>('north');
  const [unstable, setUnstable] = useState(false);
  const [denied, setDenied] = useState(false);

  const arrowRef = useRef<SVGSVGElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const fixRef = useRef<Fix | null>(null);
  const headingRef = useRef<{ deg: number; t: number; acc?: number } | null>(null);
  const historyRef = useRef<{ deg: number; t: number }[]>([]);
  const smooth = useRef({ arrow: [0, -1] as [number, number], dial: [0, -1] as [number, number] });
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => {
    setStopId(initialStopId(data));
    setMeet(loadMeet());
    if (new URLSearchParams(location.search).get('target') === 'meet') setTarget('meet');
  }, [data]);

  const stop = data.stops.find((s) => s.id === stopId)!;
  const goal = target === 'hotel' ? { lat: stop.hotel.lat, lng: stop.hotel.lng, name: stop.hotel.name } : meet && { lat: meet.lat, lng: meet.lng, name: null };

  // Heading readings from the compass (degrees clockwise from north).
  const pushHeading = (deg: number, acc?: number) => {
    const h = (deg + screenAngle() + 360) % 360;
    const t = performance.now();
    headingRef.current = { deg: h, t, acc };
    const hist = historyRef.current;
    hist.push({ deg: h, t });
    while (hist.length && t - hist[0].t > 1500) hist.shift();
  };

  const stopSensors = useCallback(() => {
    cleanup.current();
    cleanup.current = () => {};
    setRunning(false);
  }, []);

  const start = () => {
    // iOS: permission must be requested synchronously inside the tap.
    const DOE = (window as any).DeviceOrientationEvent;
    const perm: Promise<string> | undefined = DOE?.requestPermission?.();
    (perm ?? Promise.resolve('granted')).catch(() => 'denied').then((state) => begin(state === 'granted'));
  };

  const begin = (orientationAllowed: boolean) => {
    cleanup.current();
    let gotAbsolute = false;
    const onAbs = (e: DeviceOrientationEvent) => {
      if (e.alpha == null) return;
      gotAbsolute = true;
      pushHeading(360 - e.alpha);
    };
    const onRel = (e: DeviceOrientationEvent) => {
      const w = e as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
      if (typeof w.webkitCompassHeading === 'number' && !isNaN(w.webkitCompassHeading)) pushHeading(w.webkitCompassHeading, w.webkitCompassAccuracy);
      else if (!gotAbsolute && e.absolute && e.alpha != null) pushHeading(360 - e.alpha);
    };
    if (orientationAllowed) {
      addEventListener('deviceorientationabsolute', onAbs as EventListener);
      addEventListener('deviceorientation', onRel);
    }

    const watch = navigator.geolocation?.watchPosition(
      (p) => {
        const f = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          speed: p.coords.speed,
          course: p.coords.heading != null && !isNaN(p.coords.heading) ? p.coords.heading : null,
        };
        fixRef.current = f;
        setFix(f);
        setDenied(false);
      },
      (err) => err.code === err.PERMISSION_DENIED && setDenied(true),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );

    let wake: any = null;
    (navigator as any).wakeLock?.request('screen').then((w: any) => (wake = w)).catch(() => {});

    let raf = 0;
    let lastUi = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const f = fixRef.current;
      const g = goalRef.current;
      const hd = headingRef.current;
      const compassFresh = hd && t - hd.t < 2000;
      let heading: number | null = null;
      let m: Mode = 'north';
      if (compassFresh) {
        heading = hd!.deg;
        m = 'compass';
      } else if (f && f.course != null && (f.speed ?? 0) > 1) {
        heading = f.course;
        m = 'course';
      }
      if (t - lastUi > 500) {
        lastUi = t;
        setMode(m);
        // Unsteady = readings spread widely, or iOS reports poor accuracy.
        const hist = historyRef.current;
        let unsteady = false;
        if (m === 'compass' && hist.length > 5) {
          const sx = hist.reduce((a, h) => a + Math.sin(h.deg * rad), 0) / hist.length;
          const cy = hist.reduce((a, h) => a + Math.cos(h.deg * rad), 0) / hist.length;
          unsteady = Math.hypot(sx, cy) < 0.9 || (hd!.acc != null && (hd!.acc < 0 || hd!.acc > 25));
        }
        setUnstable(unsteady);
      }
      const bearing = f && g ? bearingDeg(f.lat, f.lng, g.lat, g.lng) : 0;
      const arrowDeg = heading == null ? bearing : bearing - heading;
      const dialDeg = heading == null ? 0 : -heading;
      apply(smooth.current.arrow, arrowDeg, arrowRef.current);
      apply(smooth.current.dial, dialDeg, dialRef.current);
    };
    raf = requestAnimationFrame(loop);

    cleanup.current = () => {
      removeEventListener('deviceorientationabsolute', onAbs as EventListener);
      removeEventListener('deviceorientation', onRel);
      if (watch != null) navigator.geolocation.clearWatch(watch);
      cancelAnimationFrame(raf);
      wake?.release?.().catch(() => {});
      historyRef.current = [];
      headingRef.current = null;
    };
    setRunning(true);
  };

  const goalRef = useRef(goal);
  goalRef.current = goal;

  // Battery: stop sensors when hidden or leaving; resume when back.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && running) {
        cleanup.current();
        cleanup.current = () => {};
        resumeRef.current = true;
      } else if (document.visibilityState === 'visible' && resumeRef.current) {
        resumeRef.current = false;
        begin(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    addEventListener('pagehide', stopSensors);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pagehide', stopSensors);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const resumeRef = useRef(false);
  useEffect(() => () => cleanup.current(), []);

  const close = () => {
    stopSensors();
    if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
    else location.assign('/');
  };

  const saveMeet = () => {
    if (!fix) return;
    const m = { lat: fix.lat, lng: fix.lng, at: new Date().toISOString() };
    try {
      localStorage.setItem(MEET_KEY, JSON.stringify(m));
    } catch {}
    setMeet(m);
  };

  const dist = fix && goal ? distanceM(fix.lat, fix.lng, goal.lat, goal.lng) : null;

  return (
    <div className="beacon">
      <div className="b-top">
        <button type="button" className="b-x" onClick={close} aria-label="Sulge / Close">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5l14 14M19 5 5 19" /></svg>
        </button>
        <div className="b-seg" role="tablist">
          <button type="button" role="tab" aria-selected={target === 'hotel'} onClick={() => setTarget('hotel')}><U k="beacon.hotel" /></button>
          <button type="button" role="tab" aria-selected={target === 'meet'} onClick={() => setTarget('meet')}><U k="beacon.meet" /></button>
        </div>
        <div className="b-lang">
          <button type="button" onClick={() => setLang('et')}>ET</button>
          <button type="button" onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      {target === 'hotel' && (
        <select className="b-pick" value={stopId} onChange={(e) => setStopId(e.target.value)} aria-label="Hotell / Hotel">
          {data.stops.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.hotel.name}</option>)}
        </select>
      )}

      <div className={`b-dial-wrap${running && fix ? '' : ' idle'}`}>
        <div className="b-dial" ref={dialRef}>
          <span className="b-n">N</span>
        </div>
        <svg className="b-arrow" ref={arrowRef} viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 8 78 86 50 70 22 86Z" />
        </svg>
        {!running && (
          <button type="button" className="b-start btn btn-primary" onClick={start}>
            <U k="beacon.start" />
          </button>
        )}
      </div>

      <div className="b-read">
        {target === 'meet' && !meet ? (
          <p className="b-msg"><U k="beacon.noMeet" /></p>
        ) : !running ? (
          <p className="b-msg muted"><U k="beacon.startNote" /></p>
        ) : denied ? (
          <p className="b-msg"><U k="beacon.denied" /></p>
        ) : dist == null ? (
          <p className="b-msg"><U k="beacon.waiting" /></p>
        ) : (
          <>
            <p className="b-dist">{fmtDist(dist)}</p>
            {goal?.name && <p className="b-to">→ {goal.name}</p>}
            {dist < 10000 && (
              <p className="b-walk muted">
                <U k="beacon.about" /> {Math.max(1, Math.round(dist / 80))} <U k="beacon.walk" />
              </p>
            )}
            <p className="b-note"><U k="beacon.straight" /></p>
          </>
        )}
        {running && mode === 'compass' && unstable && <p className="b-hint"><U k="beacon.calibrate" /></p>}
        {running && fix && mode === 'north' && <p className="b-hint"><U k="beacon.noCompass" /></p>}
        {running && mode === 'course' && <p className="b-hint"><U k="beacon.course" /></p>}
        {target === 'meet' && running && fix && (
          <button type="button" className="btn b-meet" onClick={saveMeet}>
            {meet ? <U k="beacon.resetMeet" /> : <U k="beacon.setMeet" />}
          </button>
        )}
        {target === 'meet' && meet && <p className="b-small muted"><U k="beacon.meetSaved" /></p>}
        {target === 'meet' && !meet && !running && (
          <button type="button" className="btn btn-primary b-meet" onClick={start}><U k="beacon.start" /></button>
        )}
      </div>

      <footer className="b-foot">
        <span><U k="beacon.flat" /></span>
        <span>GPS {fix ? `± ${Math.round(fix.acc)} m` : '—'} · <U k="beacon.offline" /></span>
      </footer>
    </div>
  );
}

/** Ease a unit vector towards the target angle (no 359°→0° jumps), then rotate the element. */
function apply(v: [number, number], deg: number, el: Element | null) {
  const tx = Math.sin(deg * rad), ty = -Math.cos(deg * rad);
  v[0] += (tx - v[0]) * 0.15;
  v[1] += (ty - v[1]) * 0.15;
  const a = Math.atan2(v[0], -v[1]) / rad;
  if (el) (el as HTMLElement).style.transform = `rotate(${a}deg)`;
}

function fmtDist(m: number) {
  if (m < 1000) return <>{Math.round(m / 10) * 10}<small> m</small></>;
  const km = m < 10000 ? (m / 1000).toFixed(1) : String(Math.round(m / 1000));
  return <><Tx v={{ et: km.replace('.', ','), en: km }} /><small> km</small></>;
}
