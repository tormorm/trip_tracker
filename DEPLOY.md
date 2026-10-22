# Deploying to Plesk (kaifu.ee)

The server only serves files and runs one PHP script. Nothing Node-related runs
on it. You (or GitHub) build the site; Plesk receives the finished `dist/` folder.

```
/var/www/vhosts/kaifu.ee/
├── httpdocs/                  ← contents of dist/ (the site)
│   ├── api/pins.php           ← wishlist API
│   └── tiles/                 ← NOT in Git — you upload this once
│       ├── vietnam-cambodia.pmtiles
│       └── glyphs/Noto Sans Regular/*.pbf
└── private/                   ← wishlist database (pins.sqlite), created automatically
```

## 1. Build

Node 20 or newer.

```
npm ci          # install dependencies first — without it the build fails with exit code 127
npm run build   # type-checks, validates src/data, writes dist/
```

Bad data stops the build with a list such as
`trip.json → stops.0.lat: Too big: expected number to be <=90`. See DATA.md.

## 2. One-time Plesk setup

**HTTPS (required).** GPS, compass, offline mode and install all need HTTPS.
Websites & Domains → kaifu.ee → **SSL/TLS Certificates** → **Let's Encrypt** (include www).
Then **Hosting & DNS → Hosting** → tick **Permanent SEO-safe 301 redirect from HTTP to HTTPS**.

**Password.** Websites & Domains → kaifu.ee → **Password-Protected Directories** →
**Add Protected Directory** → directory `/` → then **Add User** (one shared login).
This protects everything, including `api/` and `tiles/`.

**PHP.** Hosting settings → PHP support on, PHP 8.1 or newer (FPM is fine).
The wishlist needs the `pdo_sqlite` extension. Check by opening `https://kaifu.ee/api/pins.php`
after deploying: `{"pins":[]}` means OK; `pdo_sqlite is not enabled` means:
- **Tools & Settings → PHP Settings** → click your PHP version → **Extensions** tab (or the
  "php.ini" view) → enable `pdo_sqlite` (and `sqlite3`) → OK.
- If it isn't listed (some Linux packages split it out), on the server as root:
  `apt install plesk-php83-sqlite` / `dnf install plesk-php83-sqlite` (match your PHP
  version), then `plesk repair web kaifu.ee`. On a managed Plesk, ask your host to
  "enable pdo_sqlite for PHP 8.x".

**Private database folder.** Plesk already has `/var/www/vhosts/kaifu.ee/private`,
owned by the subscription's system user, which is also the user PHP runs as. Nothing to do
normally. `api/pins.config.php` points there (`__DIR__/../../private/pins.sqlite`) and the
database file is created on the first request. If you get `database unavailable`:
- File Manager → go up one level from `httpdocs` → `private` → **Change Permissions**:
  owner read/write/execute (700), owned by the subscription user, not root.
- The PHP `open_basedir` setting must include the webspace root (Plesk's default
  `{WEBSPACEROOT}{/}{:}{TMP}{/}` does).

Never put the database inside `httpdocs`.

## 3. Deploying the site — pick one

### A. Git (recommended): GitHub builds, Plesk pulls
1. The workflow `.github/workflows/build.yml` runs on every push to `main`: it builds and
   commits `dist/` to a branch named **`deploy`**. Push to `main` once and check the
   **Actions** tab is green. A red ✗ usually means bad data; the log shows which field.
2. In Plesk: Websites & Domains → kaifu.ee → **Git** → **Add Repository** → **Remote Git hosting**:
   - Repository URL: `git@github.com:tormorm/trip_tracker.git`
   - Plesk shows an **SSH public key**: add it on GitHub → repo → Settings → **Deploy keys** (read-only).
   - Branch: **`deploy`** · Deployment mode: **Automatic** · Deployment path: **`/httpdocs`**
3. Plesk shows a **Webhook URL**: add it on GitHub → Settings → **Webhooks**
   (content type `application/json`, "Just the push event").

After that, editing a data file on github.com (even from a phone) updates the live site
in about a minute. Files you uploaded yourself (like `tiles/`) aren't in the
repository, and the deployment leaves them alone. Check that `tiles/` is still there
after your first automatic deploy.

### B. GitHub Actions → SFTP (if you'd rather not use Plesk Git)
Replace the last step of the workflow with an upload, and add the repository secrets
`SFTP_HOST`, `SFTP_USER`, `SFTP_PASS`:
```yaml
      - name: Upload over SFTP
        run: |
          sudo apt-get install -y lftp
          lftp -u "${{ secrets.SFTP_USER }},${{ secrets.SFTP_PASS }}" "sftp://${{ secrets.SFTP_HOST }}" \
            -e "set sftp:auto-confirm yes; mirror -R --verbose --exclude-glob tiles/ dist/ httpdocs/; quit"
```
(`--exclude-glob tiles/` keeps the map file; no `--delete`, so nothing else is removed either.)

### C. By hand
`npm ci && npm run build`, zip the **contents** of `dist/`, Plesk File Manager →
`httpdocs` → Upload → Extract.

## 4. Map tiles (once, and again only if you want fresher maps)

1. Install the `pmtiles` CLI: download from <https://github.com/protomaps/go-pmtiles/releases>.
2. Run `scripts/extract-tiles.sh` (optionally `scripts/extract-tiles.sh 20261020 14`).
   It downloads only Vietnam + Cambodia from the Protomaps daily build.
   **Size:** expect very roughly **0.5–1.5 GB at max zoom 15**; max zoom 14 is about half
   (the map still zooms in, it just stretches the detail). The script prints the real size.
3. Run `scripts/fetch-glyphs.sh` (label fonts, a few MB).
4. Upload both to `httpdocs/tiles/` with **SFTP** (FileZilla etc.). Plesk's browser
   upload has size limits too small for the tile file. Result:
   `httpdocs/tiles/vietnam-cambodia.pmtiles` and `httpdocs/tiles/glyphs/Noto Sans Regular/…`.
5. Check: `curl -u USER:PASS -r 0-6 https://kaifu.ee/tiles/vietnam-cambodia.pmtiles` should print
   `PMTiles` (HTTP 206). Apache and nginx both support these byte-range requests out of the box.

Until the file is there, the map uses OpenFreeMap tiles when online and a plain paper
background offline, so it's never broken.
**Replacing the file later:** bump `TILE_CACHE` in `public/sw-tiles.js` (e.g. `tiles-v2`)
and deploy, so phones drop the old cached pieces.

**Storage on phones.** The app itself is about 3 MB. Tiles are cached as you view them.
**Save city for offline** on each city page downloads that city (zoom 11–15) plus a light
overview of both countries: about 3–24 MB per city, roughly **60 MB for all seven** at most.
The city page shows the estimate and the space used.

## 5. Install on phones (do this at home, on Wi-Fi)

**Android (Chrome):** open `https://kaifu.ee`, log in, menu ⋮ → **Install app**
(or "Add to Home screen"). The install works behind the password because the manifest is
requested with credentials (`crossorigin="use-credentials"`). If no install option appears:
on a computer, Chrome DevTools → Application → Manifest; a 401 error there means the login
didn't carry over, so open the site once more and log in.

**iPhone (Safari):** open `https://kaifu.ee`, log in, Share → **Add to Home Screen**.
The home-screen app keeps its own storage, so it may **ask for the password once more**
on first launch. That's normal. Log in, and let it fully load.

**Then, on each phone:**
1. Pick your name.
2. Open each city in Plan → **Save city for offline**.
3. Open the Beacon once and allow Location (and Motion on iPhone).
4. Turn on **airplane mode** and check that Today, Plan, Kit, the cards and the map of a
   saved city all open.

iOS clears website storage for sites not opened for a few weeks, but home-screen apps are
exempt. If a saved city ever comes up empty, save it again.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails, exit code 127 | Run `npm ci` before `npm run build`. |
| Build fails with "Trip data is invalid" | Fix the listed field (DATA.md). |
| Map is blank on the server | Check `/_astro/maplibre-gl-worker.*.js` loads; check tiles (section 4). |
| Wishlist says "database unavailable" | `private/` permissions (section 2). |
| `/api/pins.php` → "pdo_sqlite is not enabled" | Enable the extension (section 2). |
| Phones show an old version | Close and reopen the app twice. The service worker updates in the background. |
