"""Embed tools/sc54_m4.js (BMW M4 CSL safety car) into index.html as the last script.
Rebuild the model asset first with tools/build_m4.py if the OBJ changes."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/sc54_m4.js').read_text()
html=re.sub(r'<script id="sc54-safety-car">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="sc54-safety-car">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
