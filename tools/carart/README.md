# Menu car art (2026-10-27)

The car-select tiles and title car (ASSET in the ui26 script, copied into ui58 by build_ui58.py) are renders of the real in-game cars.

1. Serve the game on :8765 (`python3 -m http.server 8765`).
2. `node shoot.js "" '{"yaw":-0.85,"exp":1.35,"dist":12,"pitch":0.17,"fill":1.4}'` starts an instant race, takes every car node from the live world and renders it alone on a transparent studio with a soft ground shadow (car_<number>.png). Pass `88,19` as the first argument to shoot only some cars.
3. `python3 crop.py` fits each render into the 900x520 tile frame (out/<number>.webp).
4. Copy them into assets/img under new hashed names and update the ASSET paths in index.html (both the ui26 and ui58 copies), so browsers don't show cached old art.

Re-run after any livery or body change.
