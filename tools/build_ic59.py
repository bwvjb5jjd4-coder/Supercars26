"""Embed tools/ic59.js (incident MFD, wreck clearing, start-line safety car) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ic59.js').read_text()
html=re.sub(r'<script id="ic59-incidents">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ic59-incidents">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
