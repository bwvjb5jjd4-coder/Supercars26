"""Embed tools/dr82.js (3D career driver, My Driver page and cut scenes) as the last script of an index.html.
Usage: python3 tools/build_dr82.py [path/to/index.html]   (default: ./index.html)"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/dr82.js').read_text()
html=re.sub(r'<script id="dr82-driver">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="dr82-driver">\n'+js+'</script>'+html[i:]
target.write_text(html)
print('ok',target,len(html))
