"""Embed tools/rv74.js (hanging interior rear view mirror, drag to adjust) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/rv74.js').read_text()
html=re.sub(r'<script id="rv74-mirror">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="rv74-mirror">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
