# GeoLearn

Mobile-first static flashcard app for learning country shapes.

## Current MVP
- Shows country shape (SVG)
- Tap to reveal country name
- Swipe right = correct
- Swipe left = wrong
- Green/red feedback + toast

## Data
SVGs are synced from `mapsicon` and kept with original filenames.

- Source: https://github.com/djaiss/mapsicon
- Local mirror: `vendor/mapsicon` (ignored by git)
- Extracted assets: `country-shapes/**.svg`
- Manifest: `country-shapes/manifest.json`

## Sync SVGs
```bash
./scripts/sync_mapsicon_svgs.sh
```

The Bahamas icon is overridden with the full archipelago from
[Natural Earth 1:10m Admin 0 Countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/)
(public domain, pinned to the v5.1.2 repository). The original mapsicon asset
depicted only one island. Source coordinates are in `data/shape-overrides/bs.geojson`;
`python3 scripts/generate_bahamas_shape.py` regenerates both copies using a
north-up local projection with proportional spacing. The sync script reapplies
this correction automatically. The service worker refreshes this outline even
when an older copy is still within its one-year cache lifetime.

## Run locally
```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Test locally
```bash
npm install
npx playwright install --with-deps chromium
npm test
```

## CI and deploy
GitHub Actions runs the browser and data suite on every branch push, including `master`.

- Branches: test job only
- `master` pushes: test job, then deploy if tests pass

If the repository is still configured to publish GitHub Pages directly from a branch, switch Pages to the GitHub Actions source so the new gated deploy job becomes the only deploy path.

## Practice and offline use

Every grade reveals the current answer with green/red feedback for 700ms before
advancing. The next card is reset to its front before its content is replaced.

The circular ❄️ button beside Back freezes score lists. Its icy blue border means
freeze is on; the gray snowflake means grades update lists normally. The setting
persists across reloads. Frozen practice keeps wrong cards available for repeated
passes. Explicit list removal/clearing remains available.

On load, a service worker asynchronously downloads all flags, then all outlines,
with six concurrent requests. The app shell and deck data are cached too. Wait for
“Ready for offline play” before disconnecting; reloads and all three modes then
work offline. Missing downloads retry on reload or reconnect. Images refresh after
one year, retaining older copies if offline. Browsers may evict site storage or
users may clear it, in which case another online download is needed.

Service workers require HTTPS or localhost (the local command above works).
Include `sw.js` with the app's static files. Bump `SHELL_CACHE` in `sw.js` when
changing the app shell or deck data so new installations receive a complete shell.
