"""Re-embed tools/gb75.js in place (Red Bull grille bars + script follow crash damage per car) and embed
tools/wd77.js (wheel crash damage) as the last script.
Usage: python3 tools/build_wd77.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
f=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=f.read_text()
gb=(root/'tools/gb75.js').read_text()
html,n=re.subn(r'(<script id="gb75-grille">\n).*?(</script>)',lambda m:m.group(1)+gb+m.group(2),html,count=1,flags=re.S)
assert n==1,'gb75-grille block not found'
js=(root/'tools/wd77.js').read_text()
html=re.sub(r'<script id="wd77-wheels">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="wd77-wheels">\n'+js+'</script>'+html[i:]
f.write_text(html)
print('ok',f,len(html))
