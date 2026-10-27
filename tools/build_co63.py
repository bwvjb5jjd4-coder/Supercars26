"""Embed tools/co63.js (two-player split-screen Co-Op race) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/co63.js').read_text()
html=re.sub(r'<script id="co63-coop">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="co63-coop">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
