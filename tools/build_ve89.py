"""Embed tools/ve89.js (VE Commodore road cars + Supercars / Road Cars picker tabs) as the last script.

    python3 tools/build_ve89.py [path/to/index.html]

Rebuild the models first with tools/roadcars/build_ve.py if the GLB changes."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'index.html'
html = target.read_text()
js = (root / 'tools/ve89.js').read_text()
html = re.sub(r'<script id="ve89-roadcars">.*?</script>', '', html, flags=re.S)
i = html.rindex('</body>')
html = html[:i] + '<script id="ve89-roadcars">\n' + js + '</script>' + html[i:]
target.write_text(html)
print('ok', target, len(html))
