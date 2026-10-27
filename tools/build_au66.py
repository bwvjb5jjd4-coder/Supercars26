"""Embed tools/au66.js (sound overhaul: V8 engine loops, opponents, tyres, crashes, mixer) into index.html
as the last script. Removes the older au56 sound layer it replaces."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/au66.js').read_text()
html=re.sub(r'<script id="au56-graphics">.*?</script>','',html,flags=re.S)
html=re.sub(r'<script id="au66-sound">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="au66-sound">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
