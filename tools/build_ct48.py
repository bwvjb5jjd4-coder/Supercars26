"""Embed tools/ct48.js (circuits, kerbs, ground, Bathurst scenery) into index.html after the physics script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=''.join((root/'tools'/name).read_text() for name in ['ct48.js','ct48_bathurst.js','ct48_goldcoast.js','ct49_tracks.js','ct50_streets.js','ct51_tracks.js','ct52_homebush.js','ct53_qa.js'] if (root/'tools'/name).exists())
html=re.sub(r'<script id="ct48-circuits">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ct48-circuits">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
