"""Embed tools/sc83.js (rolling safety car, Simulate on L) into index.html as the LAST script,
refresh ap73 in place from tools/ap73.js, and move the on-screen limiter key from L to K.
Usage: python3 tools/build_sc83.py [path/to/index.html]"""
import re,sys,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
subprocess.run([sys.executable,str(root/'tools/build_ap73.py'),str(target)],check=True)
html=target.read_text()
for a,b in [('RB / L','RB / K'),('Pit limiter: Xbox RB / L key','Pit limiter: Xbox RB / K key')]:html=html.replace(a,b)
js=(root/'tools/sc83.js').read_text()
tag='<script id="sc83-safety-car">\n'+js+'</script>'
pat=re.compile(r'<script id="sc83-safety-car">.*?</script>',re.S)
html=pat.sub('',html)
i=html.rindex('</body>');html=html[:i]+tag+html[i:]
target.write_text(html)
print('ok',target,len(html))
