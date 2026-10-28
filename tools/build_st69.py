"""Stuck cars (st69): refresh the ic59 script in place from tools/ic59.js (its old speed-based rescue
stands down when st69 is loaded), then embed tools/st69.js as the last script. Rerun this after
build_ai68.py, which appends ai68 last."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
ic59=(root/'tools/ic59.js').read_text()
js=(root/'tools/st69.js').read_text()
m=re.search(r'(<script id="ic59-incidents">\n).*?(</script>)',html,flags=re.S)
assert m
html=html[:m.start()]+m.group(1)+ic59+m.group(2)+html[m.end():]
html=re.sub(r'<script id="st69-stuck">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="st69-stuck">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
