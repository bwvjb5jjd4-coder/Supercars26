"""Embed tools/au56.js (engine RPM sound, tyre squeal, crash sounds) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/au56.js').read_text()
html=re.sub(r'<script id="au56-graphics">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="au56-graphics">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
