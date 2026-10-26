"""Embed tools/in55.js (centre-dash screen, dash sponsor logo, hideable speed HUD) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/in55.js').read_text()
html=re.sub(r'<script id="in55-interior">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="in55-interior">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
