# GeoLearn social assets

The page head contains static Open Graph and X/Twitter card metadata so link
crawlers can read it without JavaScript. Absolute URLs use the existing CNAME,
`https://gquiz.pirategames.org/`. These changes are local until the site's normal
deployment runs; no publishing is performed by asset generation.

| Asset | Size | Use |
| --- | --- | --- |
| `images/og/geolearn.jpg` | 1200 × 630 | Primary Open Graph cover and Pirate Games thumbnail |
| `images/og/geolearn-twitter.jpg` | 1200 × 600 | X/Twitter large image card |
| `images/og/geolearn-square.jpg` | 1080 × 1080 | Alternate Open Graph image and square social posts |

The wide image is listed first, followed by the square alternative. Consumers
choose their own image and crop; a square alternate does not force a particular
platform to use it. Services without automatic link previews can use the image
files directly. Metadata follows the [Open Graph specification](https://ogp.me/).

The primary JPEG is also copied byte-for-byte to
`../pirategames/images/games/geolearn.jpg`, referenced by the GeoLearn entry in
`../pirategames/data/games.js`. Keep that copy synchronized when replacing the
cover. The artwork leaves room for the catalogue's 16:9 crop.

## Icons

`favicon.svg` is the editable source for the navy-and-mint globe mark. Regenerate
the PNG icons and multi-resolution ICO with:

```sh
node scripts/generate_icons.js
```

This uses the existing Playwright dependency and its Chromium installation.
The page references SVG, ICO, 16/32px PNG, an opaque 180px Apple touch icon, and
a web manifest with opaque 192/512px icons. Icons and the manifest are cached
with the offline shell. Bump `SHELL_CACHE` when changing them.

## Artwork generation

Edited with the built-in imagegen tool to retain only a centered Earth globe
on the app's plain navy background. All typography, flashcards, orbit lines,
and background decoration were removed. Exports use macOS `sips`: the wide
image is 1200 × 630, X/Twitter is a centered 1200 × 600 crop, and the square
image is a centered square crop of the same source resized to 1080 × 1080.

### Revision prompt

Edit this GeoLearn cover: remove absolutely everything except the Earth globe itself and center that globe precisely horizontally and vertically on a completely plain solid dark navy #0f172a background. Remove ALL text, ALL flashcards, ALL orbit lines and glowing dots, ALL background maps and grids, and ALL decorative elements. Preserve the existing globe Earth appearance and Atlantic-facing orientation with the Americas on the left and Europe/Africa on the right, green land, blue oceans, and subtle cyan atmospheric rim. Restore any parts previously hidden by cards. The globe must be circular, fully visible, with diameter 78% of the image height. Minimal spare composition that matches a simple dark geography flashcard app. Wide 1200x630 composition, aspect ratio 1.905:1. Only a centered Earth globe on flat navy, no typography or objects.

