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
GitHub Actions now runs the browser and data suite on every branch push, on `master`, and on pull requests.

- Branches: test job only
- `master` pushes: test job, then deploy if tests pass

If the repository is still configured to publish GitHub Pages directly from a branch, switch Pages to the GitHub Actions source so the new gated deploy job becomes the only deploy path.
