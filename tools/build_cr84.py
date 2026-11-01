"""Embed tools/cr84.js (crash -> safety car, wrecks pull aside and are recovered to the pits,
heavy damage only repaired to 25%) into index.html as the LAST script.
Usage: python3 tools/build_cr84.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/cr84.js').read_text()
tag='<script id="cr84-crashes">\n'+js+'</script>'
html=re.compile(r'<script id="cr84-crashes">.*?</script>',re.S).sub('',html)
i=html.rindex('</body>');html=html[:i]+tag+html[i:]
target.write_text(html)
print('ok',target,len(html))
