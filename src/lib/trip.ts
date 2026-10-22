// Pure helpers over validated trip data; used at build time and in islands.
import type { Trip, Stop, Transfer } from '../data/schema';
import { daysBetween } from './time';

export type Phase = 'before' | 'during' | 'after';

export function phaseOf(trip: Pick<Trip, 'startDate' | 'endDate'>, date: string): Phase {
  if (date < trip.startDate) return 'before';
  if (date > trip.endDate) return 'after';
  return 'during';
}

export const tripLength = (trip: Pick<Trip, 'startDate' | 'endDate'>) => daysBetween(trip.startDate, trip.endDate) + 1;
export const dayNumber = (trip: Pick<Trip, 'startDate'>, date: string) => daysBetween(trip.startDate, date) + 1;

/** Where you sleep the night of `date` (none on departure day). */
export function stopForNight(stops: Stop[], date: string): Stop | undefined {
  return stops.find((s) => s.arrive <= date && date < s.depart);
}

/** The stop you are in during `date` (arrival day counts as the new stop). */
export function stopForDate(stops: Stop[], date: string): Stop | undefined {
  return stopForNight(stops, date) ?? stops.find((s) => s.depart === date);
}

/** Next transfer at or after date+time. */
export function nextTransfer(transfers: Transfer[], date: string, time: string): Transfer | undefined {
  return [...transfers]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .find((t) => t.date > date || (t.date === date && t.time >= time));
}

export const nights = (s: Pick<Stop, 'arrive' | 'depart'>) => daysBetween(s.arrive, s.depart);

export const telHref = (phone: string) => `tel:${phone.replace(/[^+0-9]/g, '')}`;
export const gmapsHref = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
