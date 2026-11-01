"""Embed tools/ct48.js (circuits, kerbs, ground, Bathurst scenery) into index.html after the physics script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=''.join((root/'tools'/name).read_text() for name in ['ct48.js','ct48_bathurst.js','ct48_goldcoast.js','ct49_tracks.js','ct50_streets.js','ct51_tracks.js','ct52_homebush.js','ct54_tracks.js','ct53_qa.js','sk66.js'] if (root/'tools'/name).exists())
block='<script id="ct48-circuits">\n'+js+'</script>'
m=re.search(r'<script id="ct48-circuits">.*?</script>',html,flags=re.S)
if m:html=html[:m.start()]+block+html[m.end():]  # keep its place in the script order
else:
 i=html.rindex('</body>');html=html[:i]+block+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
