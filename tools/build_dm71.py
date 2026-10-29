"""Crash damage moves every body part together (dm71): embed tools/dm71.js as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/dm71.js').read_text()
html=re.sub(r'<script id="dm71-damage">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="dm71-damage">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
