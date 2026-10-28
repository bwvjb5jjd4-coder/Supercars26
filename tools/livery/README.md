# Livery projection painter (Holden_redbull, 2026-10-26)

1. `node dump.js` (game served on :8765) dumps the ZB paint + hood geometry to geo.json.
2. `python3 posmap.py` rasterises it into a 4096 UV position/normal map.
3. `python3 paint.py` paints the livery in flat side/top/front/rear views (metres) and bakes it through the posmap, so logos are never stretched by the UV layout. Writes new_tex.png.
4. `python3 views.py new_tex.png` / `node shot.js tex.jpg out` preview it.
5. `python3 bc1.py new_tex.png Holden_redbull.dds.gz.bin Holden_redbull.webp` encodes DXT1 + 13 mips (pure numpy BC1 encoder).
Logos come from assets/img; IVECO is the simple-icons vector rendered by svg2png.js.

# Team 18 Falcons (2026-10-28): Ford_xbox18 (#18, 2015 Xbox) and Ford_caltex18 (#48, Caltex Vortex)
Same steps on the Ford body: in dump.js use 'Ford' instead of 'Holden'. posmap.py now also writes hood.npy (exact hood texels) and draws the
outer skin last, because the Falcon's inner door skins share UVs with the outer doors (they showed as stripes). Run views.py once after
posmap.py so the normals face outwards, then `python3 paint_falcon18.py xbox|caltex` and bc1.py.
Logos: Xbox sphere = simple-icons@7 xbox.svg (xbox_w.png); XBOX / CALTEX / FORD / Vortex set in Montserrat (Google Fonts, tools/fonts);
Caltex hallmark drawn as vector; Shell, PPG, Penske, Pirtek, Western Star, Havoline, Bosch, Dunlop, Ford oval from assets/img.
Both keys use RF49_KEY_MAKE -> Ford and are in RF49_BAKED. Nothing is painted on the lamp meshes (lamps are separate geometry).
