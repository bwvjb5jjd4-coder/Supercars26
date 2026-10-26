"""Embed tools/rn59.js (heavy rain: downpour, windscreen water, mist, spray, aquaplaning) into index.html as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/rn59.js').read_text()
html=re.sub(r'<script id="rn59-rain">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="rn59-rain">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
