# Supercars 26 (unofficial fan game)

An unofficial, fan-made Supercars 2026 browser game: driver career, instant races and test days, with Xbox controller support.

## Play

Open the hosted site (GitHub Pages) in any modern browser, including Microsoft Edge on Xbox. The game needs to be served from a website or local web server; opening `index.html` straight from disk won't load the 3D models and liveries.

To run it locally on a Mac, double-click `Play on Mac.command` (the first time, right-click it and choose Open). Or run `python3 -m http.server` in this folder and open http://localhost:8000.

## Layout

- `index.html` — the game (code, UI and data)
- `assets/img/` — logos, sponsor and driver images
- `assets/fonts/` — UI fonts
- `assets/liveries/` — car livery textures (`.dds.gz.bin` for GPUs with S3TC, `.webp` fallback)
- `assets/models.json.gz.bin` — gzipped 3D model pack
- `tools/ph47.js` — driving physics (tyre grip, weight transfer, crashes, rollovers, skid marks and smoke). Edit it, then run `python3 tools/build_ph47.py` to embed it in `index.html`
- `tools/split.py` — turns an all-in-one HTML build into this layout: `python3 tools/split.py Game.html out/`

Saves live in the browser's local storage for the site you play on. Use the in-game career export to move a save between sites or devices.

## Handling

Settings → Handling sets the driving assists (Full, Standard or Off) and can switch back to the classic on-rails handling.
