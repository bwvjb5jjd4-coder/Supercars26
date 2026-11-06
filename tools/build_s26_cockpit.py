"""Embed tools/s26_cockpit.js (Supercars 26 right-hand-drive Gen3 cockpit) as the last script.

    python3 tools/build_s26_cockpit.py [path/to/index.html]

Run it after tools/build_s26.py (it wraps the Supercars 26 car builder)."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'index.html'
html = target.read_text()
js = (root / 'tools/s26_cockpit.js').read_text()
html = re.sub(r'<script id="s26-cockpit">.*?</script>', '', html, flags=re.S)
i = html.rindex('</body>')
html = html[:i] + '<script id="s26-cockpit">\n' + js + '</script>' + html[i:]
target.write_text(html)
print('ok', target, len(html))
