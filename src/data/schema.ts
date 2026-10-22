// Schemas for every file in src/data. The build imports these through
// src/lib/data.ts, so malformed data stops `npm run build` with a readable list
// of problems. Run `npm run validate` to check data without building.
import { z } from 'zod';

// ---------- shared ----------

/** Text shown in the UI. Plain string = same in both languages. */
export const Localized = z.union([
  z.string().min(1),
  z.object({ et: z.string().min(1), en: z.string().min(1) }).strict(),
]);
export type Localized = z.infer<typeof Localized>;

const id = z.string().regex(/^[a-z0-9-]+$/, 'use lowercase letters, digits and dashes');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM (24h)');
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'expected YYYY-MM-DDTHH:MM (local trip time)');
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const phone = z.string().regex(/^\+?[0-9 ()\-\[\]a-zA-Z.]+$/, 'phone: digits, spaces, + ( ) -');
const country = z.enum(['VN', 'KH']);
/** Mark every made-up entry; the UI shows a banner while any remain. */
const placeholder = z.boolean().optional();

// ---------- trip.json ----------

export const Hotel = z
  .object({
    name: z.string().min(1),
    nameLocal: z.string().min(1),
    address: z.string().min(1),
    addressLocal: z.string().min(1),
    phone,
    lat,
    lng,
    checkIn: dateTime,
    checkOut: dateTime,
    /** Small landmark hint on the driver card, e.g. "Near the old market". */
    hint: Localized.optional(),
    placeholder,
  })
  .strict();

export const Traveller = z
  .object({
    id,
    name: z.string().min(1).max(40),
    /** Avatar colour, any CSS colour. */
    color: z.string().min(3),
    placeholder,
  })
  .strict();

export const Stop = z
  .object({
    id,
    name: z.string().min(1),
    nameLocal: z.string().min(1),
    country,
    lat,
    lng,
    /** Map bounds for "Save city for offline": [west, south, east, north]. */
    bbox: z.tuple([lng, lat, lng, lat]),
    arrive: date,
    depart: date,
    blurb: Localized,
    bestTimes: z.array(z.object({ when: Localized, what: Localized }).strict()).default([]),
    hotel: Hotel,
    placeholder,
  })
  .strict();

export const DayItem = z
  .object({
    time: time.optional(),
    /** Link to a place in places.json … */
    placeId: id.optional(),
    /** … or free text. */
    text: Localized.optional(),
  })
  .strict()
  .refine((i) => i.placeId || i.text, 'day item needs placeId or text');

export const Day = z
  .object({
    date,
    stopId: id,
    title: Localized,
    note: Localized.optional(),
    items: z.array(DayItem).default([]),
    placeholder,
  })
  .strict();

export const Transfer = z
  .object({
    id,
    date,
    time,
    mode: z.enum(['flight', 'car', 'bus', 'train', 'boat']),
    fromStopId: id,
    toStopId: id,
    detail: Localized,
    placeholder,
  })
  .strict();

export const Trip = z
  .object({
    title: Localized,
    /** All date logic runs in this zone, whatever the phone says. */
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    startDate: date,
    endDate: date,
    travellers: z.array(Traveller).min(1),
    stops: z.array(Stop).min(1),
    days: z.array(Day).min(1),
    transfers: z.array(Transfer).default([]),
  })
  .strict();

// ---------- places.json ----------

export const Place = z
  .object({
    id,
    stopId: id,
    name: z.string().min(1),
    nameLocal: z.string().optional(),
    tier: z.enum(['popular', 'hidden']),
    lat,
    lng,
    note: Localized,
    bestTime: Localized,
    placeholder,
  })
  .strict();
export const Places = z.object({ places: z.array(Place) }).strict();

// ---------- prices.json ----------

export const PriceItem = z
  .object({
    item: Localized,
    detail: Localized.optional(),
    asking: z.string().min(1),
    fair: z.string().min(1),
    placeholder,
  })
  .strict();
export const Prices = z
  .object({
    countries: z.array(
      z
        .object({
          country,
          /** e.g. "k = thousand đồng" */
          footnote: Localized.optional(),
          categories: z.array(z.object({ id, name: Localized, items: z.array(PriceItem).min(1) }).strict()).min(1),
        })
        .strict(),
    ),
  })
  .strict();

// ---------- phrases.json ----------

/** Local script + how to say it (pronunciation can differ per UI language). */
const LocalPhrase = z.object({ text: z.string().min(1), say: Localized }).strict();
const CardLines = z
  .object({
    takeMeTo: z.string().min(1),
    phone: z.string().min(1),
    lost: z.string().min(1),
    noLanguage: z.string().min(1),
    helpMeHotel: z.string().min(1),
    callThis: z.string().min(1),
    myHotel: z.string().min(1),
    myName: z.string().min(1),
  })
  .strict();
export const Phrases = z
  .object({
    phrases: z.array(z.object({ id, meaning: Localized, vi: LocalPhrase, km: LocalPhrase, placeholder }).strict()).min(1),
    numbers: z.array(z.object({ n: z.number().int(), vi: LocalPhrase, km: LocalPhrase }).strict()),
    /** Fixed lines for the driver and lost cards, in local script. */
    cards: z.object({ vi: CardLines, km: CardLines }).strict(),
    placeholder,
  })
  .strict();

// ---------- banknotes.json ----------

export const Banknotes = z
  .object({
    countries: z.array(
      z
        .object({
          country,
          currency: z.string().min(3).max(3),
          symbol: z.string().min(1),
          note: Localized.optional(),
          notes: z
            .array(
              z
                .object({
                  id,
                  value: z.number().positive(),
                  label: z.string().min(1),
                  /** Swatch colour shown until a photo is supplied. */
                  color: z.string().min(3),
                  colorName: Localized,
                  approx: z.string().optional(),
                  /** Path under /public, e.g. "/banknotes/vnd-500000.webp". */
                  image: z.string().startsWith('/').optional(),
                  placeholder,
                })
                .strict(),
            )
            .min(1),
          lookalikes: z.array(z.object({ ids: z.array(id).min(2), warning: Localized }).strict()).default([]),
        })
        .strict(),
    ),
  })
  .strict();

// ---------- emergency.json ----------

export const Emergency = z
  .object({
    countries: z.array(
      z.object({ country, numbers: z.array(z.object({ label: Localized, number: phone }).strict()).min(1) }).strict(),
    ),
    embassies: z.array(
      z
        .object({
          name: Localized,
          country,
          address: z.string(),
          phone,
          email: z.email().optional(),
          note: Localized.optional(),
          placeholder,
        })
        .strict(),
    ),
    insurance: z
      .object({ provider: z.string(), policy: z.string(), phone, note: Localized.optional(), placeholder })
      .strict(),
    /** The number the lost card asks a stranger to call. */
    lostContact: z.object({ name: z.string(), phone, placeholder }).strict(),
  })
  .strict();

export type Trip = z.infer<typeof Trip>;
export type Stop = z.infer<typeof Stop>;
export type Hotel = z.infer<typeof Hotel>;
export type Day = z.infer<typeof Day>;
export type DayItem = z.infer<typeof DayItem>;
export type Transfer = z.infer<typeof Transfer>;
export type Traveller = z.infer<typeof Traveller>;
export type Place = z.infer<typeof Place>;
export type Prices = z.infer<typeof Prices>;
export type Phrases = z.infer<typeof Phrases>;
export type Banknotes = z.infer<typeof Banknotes>;
export type Emergency = z.infer<typeof Emergency>;

export interface AllData {
  trip: Trip;
  places: Place[];
  prices: Prices;
  phrases: Phrases;
  banknotes: Banknotes;
  emergency: Emergency;
}

// ---------- parsing + cross-file checks ----------

function fmt(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `  ${file} → ${i.path.join('.') || '(root)'}: ${i.message}`);
}

/** Parse raw JSON from all data files. Throws one Error listing every problem. */
export function parseAll(raw: Record<keyof AllData, unknown>): AllData {
  const problems: string[] = [];
  const parse = <T>(file: string, schema: z.ZodType<T>, value: unknown): T => {
    const r = schema.safeParse(value);
    if (!r.success) problems.push(...fmt(file, r.error));
    return r.data as T;
  };
  const trip = parse('trip.json', Trip, raw.trip);
  const places = parse('places.json', Places, raw.places)?.places;
  const prices = parse('prices.json', Prices, raw.prices);
  const phrases = parse('phrases.json', Phrases, raw.phrases);
  const banknotes = parse('banknotes.json', Banknotes, raw.banknotes);
  const emergency = parse('emergency.json', Emergency, raw.emergency);

  if (trip && places) {
    const stopIds = new Set(trip.stops.map((s) => s.id));
    const placeIds = new Set<string>();
    const dupes = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const i of ids) {
        if (seen.has(i)) problems.push(`  ${label}: duplicate id "${i}"`);
        seen.add(i);
      }
    };
    dupes('trip.json stops', trip.stops.map((s) => s.id));
    dupes('trip.json travellers', trip.travellers.map((t) => t.id));
    dupes('places.json', places.map((p) => p.id));
    dupes('trip.json days (date)', trip.days.map((d) => d.date));
    places.forEach((p) => placeIds.add(p.id));

    if (trip.startDate > trip.endDate) problems.push('  trip.json: startDate is after endDate');
    trip.stops.forEach((s, i) => {
      if (s.arrive > s.depart) problems.push(`  trip.json stops.${i} (${s.id}): arrive is after depart`);
      const [w, so, e, n] = s.bbox;
      if (w >= e || so >= n) problems.push(`  trip.json stops.${i} (${s.id}): bbox must be [west, south, east, north]`);
      if (s.hotel.checkIn >= s.hotel.checkOut) problems.push(`  trip.json stops.${i} (${s.id}): hotel checkIn must be before checkOut`);
    });
    trip.days.forEach((d, i) => {
      if (!stopIds.has(d.stopId)) problems.push(`  trip.json days.${i} (${d.date}): unknown stopId "${d.stopId}"`);
      if (d.date < trip.startDate || d.date > trip.endDate) problems.push(`  trip.json days.${i}: ${d.date} is outside the trip dates`);
      d.items.forEach((it, j) => {
        if (it.placeId && !placeIds.has(it.placeId)) problems.push(`  trip.json days.${i}.items.${j}: unknown placeId "${it.placeId}"`);
      });
    });
    trip.transfers.forEach((t, i) => {
      for (const k of ['fromStopId', 'toStopId'] as const)
        if (!stopIds.has(t[k])) problems.push(`  trip.json transfers.${i}: unknown ${k} "${t[k]}"`);
    });
    places.forEach((p, i) => {
      if (!stopIds.has(p.stopId)) problems.push(`  places.json places.${i} (${p.id}): unknown stopId "${p.stopId}"`);
    });
  }
  if (banknotes) {
    banknotes.countries.forEach((c, i) => {
      const ids = new Set(c.notes.map((n) => n.id));
      c.lookalikes.forEach((l, j) =>
        l.ids.forEach((x) => {
          if (!ids.has(x)) problems.push(`  banknotes.json countries.${i}.lookalikes.${j}: unknown note id "${x}"`);
        }),
      );
    });
  }

  if (problems.length) {
    throw new Error(`\n\nTrip data is invalid (${problems.length} problem${problems.length > 1 ? 's' : ''}):\n${problems.join('\n')}\n\nSee DATA.md for the expected format.\n`);
  }
  return { trip, places, prices, phrases, banknotes, emergency };
}

/** True while any entry anywhere is still marked "placeholder": true. */
export function hasPlaceholders(raw: unknown): boolean {
  return JSON.stringify(raw).includes('"placeholder":true');
}
