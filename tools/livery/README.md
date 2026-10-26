# Livery projection painter (Holden_redbull, 2026-10-26)

1. `node dump.js` (game served on :8765) dumps the ZB paint + hood geometry to geo.json.
2. `python3 posmap.py` rasterises it into a 4096 UV position/normal map.
3. `python3 paint.py` paints the livery in flat side/top/front/rear views (metres) and bakes it through the posmap, so logos are never stretched by the UV layout. Writes new_tex.png.
4. `python3 views.py new_tex.png` / `node shot.js tex.jpg out` preview it.
5. `python3 bc1.py new_tex.png Holden_redbull.dds.gz.bin Holden_redbull.webp` encodes DXT1 + 13 mips (pure numpy BC1 encoder).
Logos come from assets/img; IVECO is the simple-icons vector rendered by svg2png.js.
