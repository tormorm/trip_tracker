# Trip Companion — Vietnam & Cambodia

Private offline-first PWA for the group trip (16 Dec – 8 Jan). Astro (static) +
React islands, MapLibre + self-hosted PMTiles, PHP + SQLite for shared wishlist pins.

```
npm ci
npm run dev        # http://localhost:4321  (add -- --host to open it on your phone)
npm run validate   # check src/data/*.json only
npm run build      # type-check + validate data + build into dist/
```

- **Edit trip content:** `src/data/*.json` — see [DATA.md](DATA.md)
- **Deploy to Plesk:** [DEPLOY.md](DEPLOY.md)
- UI strings (Estonian/English): `src/i18n/ui.ts` · site settings: `src/config.ts`
- Pretend it's another date: add `?now=2026-12-21T19:00` to any page.

Tabs: Today · Map · Plan · Wishlist · Kit. Full-screen cards: `/driver/`, `/lost/`, `/beacon/`.
