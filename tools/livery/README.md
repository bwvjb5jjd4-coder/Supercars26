# Livery projection painter (Holden_redbull, 2026-10-26)

1. `node dump.js` (game served on :8765) dumps the ZB paint + hood geometry to geo.json.
2. `python3 posmap.py` rasterises it into a 4096 UV position/normal map.
3. `python3 paint.py` paints the livery in flat side/top/front/rear views (metres) and bakes it through the posmap, so logos are never stretched by the UV layout. Writes new_tex.png.
4. `python3 views.py new_tex.png` / `node shot.js tex.jpg out` preview it.
5. `python3 bc1.py new_tex.png Holden_redbull.dds.gz.bin Holden_redbull.webp` encodes DXT1 + 13 mips (pure numpy BC1 encoder).
Logos come from assets/img; IVECO is the simple-icons vector rendered by svg2png.js.

# Team 18 Falcons (2026-10-28): Ford_xbox18 (#18, 2015 Xbox) and Ford_caltex18 (#48, Caltex Vortex)
Same steps on the Ford body: in dump.js use 'Ford' instead of 'Holden'. posmap.py now also writes hood.npy (exact hood texels) and draws the
outer skin last (roof centre wins over the wing endplates, which share its UVs), because the Falcon's inner door skins share UVs with the outer doors (they showed as stripes). Run views.py once after
posmap.py so the normals face outwards, then `python3 paint_falcon18.py xbox|caltex` and bc1.py.
Logos (v2, 2026-10-28): real vector files from github.com/detain/svg-logos (worldvectorlogo mirror; raw.githubusercontent.com is
reachable from the cloud), rendered to logos/*.png with `node svgr.js file.svg::out.png::2400`: xbox-12 (XBOX wordmark), xbox-1 (sphere),
caltex-logo (hallmark + wordmark), pirtek, penske-truck-leasing, western-star-trucks-1, lg-electronics, d-link, dunlop-1, bosch, shell.
Havoline, PPG and the Ford oval come from assets/img. Only "Vortex 98" is typeset (Montserrat Black Italic): no real file exists online.
v1 was rejected by Riley (home-made fonts, logos under the lamps, black panel wrapping the corners, bare roof/nose).
Both keys use RF49_KEY_MAKE -> Ford and are in RF49_BAKED. Nothing is painted on the lamp meshes (lamps are separate geometry).

## Ford_objective -> 2015 Prodrive Pepsi Max Crew Falcon (SCT Motorsport, both seats), 2026-10-28
Files in `pepsimax/` (texture now ships as assets/liveries/Ford_pepsimax.*). Same flow with the Ford body (`dump.js` with 'Ford'),
but use `pepsimax/posmap2.py`: the Falcon UV atlas has big overlaps (wing, roof, boot corners and doors share texels),
so triangles are drawn in priority order (wing < other < roof < door/quarter sides, larger last) and visible panels win.
`logos.py` builds the stickers (fonts from raw.githubusercontent.com/google/fonts; Pepsi globe from simple-icons 7.0.0
coloured in `globe.svg`, rendered by `svgr.js`; Castrol/Ford/Dunlop from assets/img). `paint_pm.py` paints and bakes.

## Ford_penrite -> Grove Racing Penrite livery (both Grove Falcons, #19 and #26), 2026-10-29
Adapted from the Penrite Mustang launch livery to the Falcon FG X. Texture ships as assets/liveries/Ford_penrite27.* (new name beats browser cache).
Same flow as Pepsi Max: `dump.js` with 'Ford', `pepsimax/posmap2.py`, `views.py` once, then `python3 penrite/paint_pr.py` and `bc1.py`.
`penrite/logos.py` builds logos/pr_*.png: the Penrite wordmark and wreath emblem are the real logo already in the game (ef64ee4a7a, from
penriteoil.com.au's PENRITE_Logo_Long.pdf) upscaled with a re-thresholded alpha edge; Snap-on (snap-on-1), Autodesk (autodesk-4),
Mack (mack-trucks-1, wordmark only), PPG (ppg-industries-1) and Dunlop (dunlop-1) from github.com/detain/svg-logos; the Australian flag
and its Commonwealth star from flag-icons 7.6.0 (npm); "SINCE 1926" in Barlow Condensed SemiBold (Google Fonts).
Not reachable from the cloud as real files, so left off rather than faked: Steadfast, Steeline, ENGEL, UNIT, ACE, ACL, Kangan, Sutton Tools, KENG.
v2 (2026-10-29, after Riley said v1 looked terrible and the flag was the worst part): the side swooshes are now the real 2:1 Australian
flag (svg-country-flags 1.2.10 on npm, logos/pr_ausflag21.png) wrapped along the bezier band by `Cv.flag()`: Union Jack at the wide end,
cloth line rippling with fold shading and a white keyline. PENRITE is the same real wordmark recoloured to race yellow (pr_wordy.png).
Bigger laurel leaves, slim orange nose band, Snap-on on the rear quarters. Needs scipy (cKDTree). Texture renamed Ford_penrite27.* for cache.
