// Single entry point for trip data. Importing this validates every data file;
// a problem throws during `astro build` with a list of what to fix.
import tripRaw from '../data/trip.json';
import placesRaw from '../data/places.json';
import pricesRaw from '../data/prices.json';
import phrasesRaw from '../data/phrases.json';
import banknotesRaw from '../data/banknotes.json';
import emergencyRaw from '../data/emergency.json';
import { parseAll, hasPlaceholders } from '../data/schema';

const raw = {
  trip: tripRaw,
  places: placesRaw,
  prices: pricesRaw,
  phrases: phrasesRaw,
  banknotes: banknotesRaw,
  emergency: emergencyRaw,
};

export const data = parseAll(raw);
export const { trip, places, prices, phrases, banknotes, emergency } = data;
export const showPlaceholderBanner = hasPlaceholders(raw);

export const stopById = new Map(trip.stops.map((s) => [s.id, s]));
export const placeById = new Map(places.map((p) => [p.id, p]));
