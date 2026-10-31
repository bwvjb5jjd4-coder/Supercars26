"""Embed tools/pf79.js (cockpit frame rate: single-pass glass, cheaper mirror, auto frame-rate boost) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/pf79.js').read_text()
html=re.sub(r'<script id="pf79-cockpit-fps">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="pf79-cockpit-fps">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
