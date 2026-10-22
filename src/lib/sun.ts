import * as SunCalc from 'suncalc';
import { hhmm } from './time';

/** Sunrise and sunset (trip-local HH:MM) for a date at a location. */
export function sunTimes(date: string, lat: number, lng: number) {
  // Noon local avoids picking the neighbouring day's events.
  const t = SunCalc.getTimes(new Date(`${date}T12:00:00+07:00`), lat, lng);
  const f = (d: Date | null) => (d && !isNaN(+d) ? hhmm(d) : '—');
  return { sunrise: f(t.sunrise), sunset: f(t.sunset) };
}
