"""Embed tools/pf61.js (measured smoothness fixes and the F-key frame-time overlay) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/pf61.js').read_text()
html=re.sub(r'<script id="pf61-performance">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="pf61-performance">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
