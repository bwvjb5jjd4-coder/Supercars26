"""Embed tools/gb75.js (Triple Eight gloss-black grille bars + Holden grille script) into index.html as the last script,
and point Holden_redbull at the 2020 Red Bull Holden texture (assets/liveries/Holden_redbull22.*, new name beats browser cache).
Usage: python3 tools/build_gb75.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
f=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=f.read_text()
js=(root/'tools/gb75.js').read_text()
for ext in ('dds.gz.bin','webp'):
    for old in ('Holden_redbull.','Holden_redbull20.','Holden_redbull21.'):html=html.replace('assets/liveries/'+old+ext,'assets/liveries/Holden_redbull22.'+ext)
html=re.sub(r'<script id="gb75-grille">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="gb75-grille">\n'+js+'</script>'+html[i:]
f.write_text(html)
print('ok',f,len(html))
