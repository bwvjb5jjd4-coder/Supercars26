"""Embed tools/tl54.js (Falcon and ZB tail lamps, grille backing) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/tl54.js').read_text()
html=re.sub(r'<script id="tl54-lamps">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="tl54-lamps">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
