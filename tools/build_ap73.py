"""Embed tools/ap73.js (Simulate / autopilot with driving styles) into index.html.
Replaces the existing ap73 script in place, or adds it as the last script.
Usage: python3 tools/build_ap73.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/ap73.js').read_text()
tag='<script id="ap73-autopilot">\n'+js+'</script>'
pat=re.compile(r'<script id="ap73-autopilot">.*?</script>',re.S)
if pat.search(html):html=pat.sub(lambda m:tag,html,count=1)
else:
    i=html.rindex('</body>');html=html[:i]+tag+html[i:]
target.write_text(html)
print('ok',target,len(html))
