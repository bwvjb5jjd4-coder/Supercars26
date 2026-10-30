"""Embed tools/ap73.js (safety car autopilot button) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ap73.js').read_text()
html=re.sub(r'<script id="ap73-autopilot">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ap73-autopilot">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
