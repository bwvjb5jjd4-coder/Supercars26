"""Camera look fix (cm73): embed tools/cm73.js as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/cm73.js').read_text()
html=re.sub(r'<script id="cm73-camera">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="cm73-camera">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
