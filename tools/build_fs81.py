"""Embed tools/fs81.js (formation lap / start watchdog) as the last script of an index.html.
Usage: python3 tools/build_fs81.py [path/to/index.html]   (default: ./index.html)"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/fs81.js').read_text()
html=re.sub(r'<script id="fs81-start">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="fs81-start">\n'+js+'</script>'+html[i:]
target.write_text(html)
print('ok',target,len(html))
