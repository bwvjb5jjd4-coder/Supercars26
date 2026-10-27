"""Embed tools/cp65.js (smooth cockpit wheel, speed/gear/fuel in the column housing, race-info centre screen) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/cp65.js').read_text()
html=re.sub(r'<script id="cp65-cockpit">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="cp65-cockpit">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
