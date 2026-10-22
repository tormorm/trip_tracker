# Trip Companion — Vietnam & Cambodia

Private offline-first PWA for the group trip. Astro (static) + React islands,
PHP + SQLite for shared wishlist pins.

```
npm install
npm run dev        # http://localhost:4321
npm run validate   # check src/data/*.json only
npm run build      # type-check + validate data + build into dist/
```

All trip content lives in `src/data/*.json` (schemas in `src/data/schema.ts`).
UI strings (Estonian/English) live in `src/i18n/ui.ts`.
Docs: `DATA.md` (editing data), `DEPLOY.md` (Plesk) — written in the final phase.
