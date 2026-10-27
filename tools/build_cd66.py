"""Embed tools/cd66.js (cool-down lap after the chequered flag, park in your bay, End Race) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/cd66.js').read_text()
html=re.sub(r'<script id="cd66-cooldown">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="cd66-cooldown">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
