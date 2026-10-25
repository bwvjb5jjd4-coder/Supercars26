"""Embed tools/fx52.js (live mirrors, wet reflections, shadows, scenery batching) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/fx52.js').read_text()
html=re.sub(r'<script id="fx52-render">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="fx52-render">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
