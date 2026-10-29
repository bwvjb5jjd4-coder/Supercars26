"""Career contracts and session sims (cs70): embed tools/cs70.js as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/cs70.js').read_text()
html=re.sub(r'<script id="cs70-career">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="cs70-career">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
