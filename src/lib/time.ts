// All trip date logic runs in Vietnam/Cambodia time (UTC+7), whatever the phone says.
import type { Localized } from '../data/schema';

export const TZ = 'Asia/Ho_Chi_Minh';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export interface TripNow {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export function toTripNow(d: Date): TripNow {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * Current trip-local date and time. For testing, add `?now=2026-12-21T19:00`
 * (trip-local) to any page URL.
 */
export function tripNow(): TripNow {
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('now');
    const m = q?.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/);
    if (m) return { date: m[1], time: m[2] ?? '09:00' };
  }
  return toTripNow(new Date());
}

/** "HH:MM" of an instant, in trip time. */
export function hhmm(d: Date): string {
  return toTripNow(d).time;
}

const dayNum = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const fromDayNum = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

export const addDays = (date: string, n: number) => fromDayNum(dayNum(date) + n);
/** b − a in whole days. */
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
const weekday = (date: string) => new Date(dayNum(date) * 86_400_000).getUTCDay();

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const WD = {
  et: ['P', 'E', 'T', 'K', 'N', 'R', 'L'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const MON = {
  et: ['jaan', 'veebr', 'märts', 'apr', 'mai', 'juuni', 'juuli', 'aug', 'sept', 'okt', 'nov', 'dets'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const md = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return { m: m - 1, d };
};

export const fmtWeekday = (date: string): Localized => ({ et: WD.et[weekday(date)], en: WD.en[weekday(date)] });

/** "E 21. dets" / "Mon 21 Dec" */
export function fmtDay(date: string): Localized {
  const { m, d } = md(date);
  const w = weekday(date);
  return { et: `${WD.et[w]} ${d}. ${MON.et[m]}`, en: `${WD.en[w]} ${d} ${MON.en[m]}` };
}

/** "16.12" style stamp */
export const fmtShort = (date: string) => {
  const { m, d } = md(date);
  return `${d}.${m + 1}`;
};

/** "20.–24. dets" / "20–24 Dec", across months "29. dets – 3. jaan" / "29 Dec – 3 Jan" */
export function fmtRange(a: string, b: string): Localized {
  const A = md(a), B = md(b);
  if (A.m === B.m) return { et: `${A.d}.–${B.d}. ${MON.et[B.m]}`, en: `${A.d}–${B.d} ${MON.en[B.m]}` };
  return { et: `${A.d}. ${MON.et[A.m]} – ${B.d}. ${MON.et[B.m]}`, en: `${A.d} ${MON.en[A.m]} – ${B.d} ${MON.en[B.m]}` };
}
