"""Embed tools/pt61.js (realistic pit stops, pit limiter, crew, Bathurst co-drivers) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/pt61.js').read_text()
html=re.sub(r'<script id="pt61-pitstops">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="pt61-pitstops">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
