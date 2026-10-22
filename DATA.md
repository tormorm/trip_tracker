# Editing trip data

All trip content lives in `src/data/`. You never need to touch components.

| File | What |
|---|---|
| `trip.json` | travellers, stops (each with its hotel), days, transfers |
| `places.json` | places to see, tier `popular` or `hidden` |
| `prices.json` | price guide per country |
| `phrases.json` | phrasebook, numbers, fixed lines for the driver/lost cards |
| `banknotes.json` | banknote guide, look-alike warnings |
| `emergency.json` | emergency numbers, embassies, insurance, lost-card contact |

UI labels (buttons, headings) are in `src/i18n/ui.ts`.

**Check your edits:** `npm run validate` (fast) or `npm run build`. A mistake stops the
build with a list such as:

```
Trip data is invalid (2 problems):
  trip.json → stops.2.hotel.checkIn: expected YYYY-MM-DDTHH:MM (local trip time)
  places.json places.4 (hoian-an-bang): unknown stopId "hoi-an2"
```

Editing on github.com works too (pencil icon on a file → Commit). The GitHub Action
builds it; a red ✗ in the **Actions** tab means a data error. Click it to see which.

## Rules that apply everywhere

- **Text in two languages.** Any text field can be a plain string (same in both
  languages) or `{ "et": "…", "en": "…" }`. Estonian is the default.
- **Placeholder flag.** Every invented entry has `"placeholder": true`. The orange
  "PLACEHOLDER DATA" banner shows while **any** remain, so delete the flag (or set it
  `false`) as you replace each entry with real data.
- **Ids** use lowercase letters, digits and dashes: `hoi-an`, `sr-angkor-wat`. Other
  entries refer to them, so rename carefully.
- **Dates** are `YYYY-MM-DD`; times `HH:MM` (24 h); date-times `YYYY-MM-DDTHH:MM`. All are
  **local trip time** (Vietnam and Cambodia are both UTC+7).
- **Coordinates** are decimal `lat`, `lng`. In Google Maps, right-click (long-press on a
  phone) a spot and tap the numbers to copy them, e.g. `15.8770, 108.3263`.
- **Phone numbers** with country code: `+84 235 3912 345`.

## trip.json

```jsonc
{
  "title": { "et": "Vietnam ja Kambodža", "en": "Vietnam & Cambodia" },
  "timezone": "Asia/Ho_Chi_Minh",          // leave as is
  "startDate": "2026-12-16",
  "endDate": "2027-01-08",
  "travellers": [
    { "id": "ema", "name": "Ema", "color": "#1D6A4F" }   // color = avatar colour
  ],
  "stops": [ /* see below */ ],
  "days": [ /* see below */ ],
  "transfers": [ /* see below */ ]
}
```

### Stops (in travel order; the map's route line follows this order)

```jsonc
{
  "id": "hoi-an",
  "name": "Hội An",                    // shown everywhere
  "nameLocal": "Hội An",               // local script (Khmer for Cambodia: "សៀមរាប")
  "country": "VN",                     // "VN" or "KH" — picks card language and Kit tab
  "lat": 15.8801, "lng": 108.3380,
  "bbox": [108.28, 15.85, 108.37, 15.93],   // [west, south, east, north] for "Save city for offline"
  "arrive": "2026-12-20",
  "depart": "2026-12-24",              // the night before depart is the last one here
  "blurb": { "et": "Laternalinn…", "en": "Lantern town…" },
  "bestTimes": [
    { "when": { "et": "enne 08:00", "en": "before 08:00" }, "what": { "et": "…", "en": "…" } }
  ],
  "hotel": {
    "name": "Little Hoi An Boutique",          // for you
    "nameLocal": "Khách sạn Little Hội An",    // for the driver — LOCAL SCRIPT, shown huge
    "address": "12 Phan Bội Châu, Hội An",
    "addressLocal": "12 Phan Bội Châu, Phường Minh An, Hội An",
    "phone": "+84 235 3912 345",
    "lat": 15.8790, "lng": 108.3300,           // exact entrance — the Beacon points here
    "checkIn": "2026-12-20T14:00",
    "checkOut": "2026-12-24T12:00",
    "hint": { "et": "Vanalinna serv", "en": "Edge of the old town" }   // optional, small line on the driver card
  }
}
```

Tips:
- **bbox:** take two corners in Google Maps around the area you'll walk. Bigger means
  more to download (the city page shows the estimate). Keep it to the town.
- **Khmer addresses:** ask the hotel to send its name and address in Khmer (most
  will). Paste them as they are.

### Days (one per date, from `startDate` to `endDate`)

```jsonc
{
  "date": "2026-12-21",
  "stopId": "hoi-an",                  // where you are that day
  "title": { "et": "Vanalinn jalgsi", "en": "Old town on foot" },
  "note": { "et": "Rätsepa juurest läbi.", "en": "Drop by the tailor." },   // optional
  "items": [
    { "time": "07:00", "placeId": "hoian-chua-cau" },          // a place from places.json
    { "time": "19:30", "text": { "et": "Õhtusöök", "en": "Dinner" } }   // or free text
  ]
}
```
Items with a time show on Today and get struck through once that time has passed.

### Transfers

```jsonc
{
  "id": "hoi-an-saigon",
  "date": "2026-12-24", "time": "09:15",
  "mode": "car",                        // flight | car | bus | train | boat
  "fromStopId": "hoi-an", "toStopId": "saigon",
  "detail": { "et": "→ Đà Nẵngi lennujaam, VN 123", "en": "→ Đà Nẵng airport, VN 123" }
}
```

## places.json

```jsonc
{ "places": [
  {
    "id": "hoian-tra-que",
    "stopId": "hoi-an",
    "name": "Làng rau Trà Quế",
    "nameLocal": "…",                   // optional
    "tier": "hidden",                   // "popular" (red circle) or "hidden" (green diamond)
    "lat": 15.9030, "lng": 108.3380,
    "note": { "et": "Ürdiaiad, rattaga 3 km.", "en": "Herb gardens, 3 km by bike." },
    "bestTime": { "et": "hommik", "en": "morning" }
  }
]}
```

## prices.json

```jsonc
{ "countries": [
  { "country": "VN",
    "footnote": { "et": "k = tuhat đồngi.", "en": "k = thousand đồng." },
    "categories": [
      { "id": "food", "name": { "et": "Söök ja jook", "en": "Food & drink" },
        "items": [
          { "item": "Bánh mì", "detail": { "et": "Täidetud baguette", "en": "Filled baguette" },
            "fair": "25–35k", "asking": "40–60k" }
        ] }
    ] }
]}
```
`fair` is shown big and `asking` small. Both are free text, so write `$2–3` or `20k`.

## phrases.json

```jsonc
{
  "phrases": [
    { "id": "thanks", "meaning": { "et": "Aitäh", "en": "Thank you" },
      "vi": { "text": "Cảm ơn", "say": { "et": "kamm õn", "en": "gahm uhn" } },
      "km": { "text": "អរគុណ", "say": { "et": "or-kun", "en": "aw-kun" } } }
  ],
  "numbers": [ { "n": 1, "vi": { "text": "một", "say": "moht" }, "km": { "text": "មួយ", "say": "muoy" } } ],
  "cards": { "vi": { "takeMeTo": "Vui lòng đưa tôi đến:", … }, "km": { … } }
}
```
`say` is the pronunciation hint, and can differ per UI language. `cards` holds the fixed
local-language lines on the driver and lost cards. Have a native speaker check them.

## banknotes.json

```jsonc
{ "countries": [
  { "country": "VN", "currency": "VND", "symbol": "₫",
    "notes": [
      { "id": "vnd-500000", "value": 500000, "label": "500.000",
        "color": "#3AA6C9",                       // swatch until you add a photo
        "colorName": { "et": "Türkiis", "en": "Turquoise" },
        "approx": "≈ €17",
        "image": "/banknotes/vnd-500000.webp" }   // optional
    ],
    "lookalikes": [
      { "ids": ["vnd-500000", "vnd-20000"],
        "warning": { "et": "Mõlemad sinised…", "en": "Both blue…" } }
    ] }
]}
```
**Photos:** put them in `public/banknotes/` (WebP or JPG, about 600 px wide, under 100 KB
each). They're stored on the phone for offline use. Notes listed in `lookalikes` get an
orange border.

## emergency.json

```jsonc
{
  "countries": [ { "country": "VN", "numbers": [ { "label": { "et": "Politsei", "en": "Police" }, "number": "113" } ] } ],
  "embassies": [ { "name": "…", "country": "VN", "address": "…", "phone": "+84 …", "email": "…", "note": "…" } ],
  "insurance": { "provider": "…", "policy": "…", "phone": "+372 …", "note": "…" },
  "lostContact": { "name": "Isa", "phone": "+372 5xx xxxx" }   // the number the Lost card asks strangers to call
}
```
Hotel phone numbers come from `trip.json` automatically.

## Testing dates

Add `?now=` to any address to pretend it's another moment (trip time):
`/?now=2026-12-21T19:00`, `/?now=2027-02-01`, `/plan/?now=2026-12-30`.
