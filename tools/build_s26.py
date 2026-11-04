"""Embed tools/s26.js (Supercars 26: Gen3 Mustang / Camaro / Supra grid in Instant Race) as the last script,
with the roster and livery profiles from tools/s26/grid.json.

    python3 tools/build_s26.py [path/to/index.html]

Bodies: tools/s26/build_bodies.py. Liveries: tools/s26/paint_liveries.py. Tile art: tools/s26/shoot_tiles.js."""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'index.html'
html = target.read_text()
grid = json.loads((root / 'tools/s26/grid.json').read_text())
js = (root / 'tools/s26.js').read_text()
js = js.replace('/*S26_ROSTER*/{}', json.dumps(grid['roster'], separators=(',', ':')))
js = js.replace('/*S26_LIVERIES*/{}', json.dumps({k: {a: b for a, b in v.items() if a not in ('note', 'body')} for k, v in grid['liveries'].items()}, separators=(',', ':')))
html = re.sub(r'<script id="s26-gen3">.*?</script>', '', html, flags=re.S)
i = html.rindex('</body>')
html = html[:i] + '<script id="s26-gen3">\n' + js + '</script>' + html[i:]
target.write_text(html)
print('ok', target, len(html))
