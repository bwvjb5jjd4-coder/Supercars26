"""Falcon vs Commodore car character (mk71): embed tools/mk71.js as the last script and refresh the
au66 sound block in place (its engine profiles were pushed further apart for mk71)."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
au=(root/'tools/au66.js').read_text()
html,n=re.subn(r'<script id="au66-sound">.*?</script>',lambda m:'<script id="au66-sound">\n'+au+'</script>',html,flags=re.S)
assert n==1
js=(root/'tools/mk71.js').read_text()
html=re.sub(r'<script id="mk71-character">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="mk71-character">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
