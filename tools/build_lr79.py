"""Embed tools/lr79.js (pit limiter always on in the pit lane, revving on the grid) into index.html as the last script."""
import re,pathlib,sys
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/lr79.js').read_text()
tag='<script id="lr79-limiter-revs">\n'+js+'</script>'
m=re.search(r'<script id="lr79-limiter-revs">.*?</script>',html,flags=re.S)
if m:html=html[:m.start()]+tag+html[m.end():]
else:
 i=html.rindex('</body>');html=html[:i]+tag+html[i:]
target.write_text(html)
print('ok',target,len(html))
