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
