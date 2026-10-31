"""Livery switcher (lv78): registers the Bathurst, Gold Coast and ADF Red Bull textures (assets/liveries/Holden_redbullpink.*, Holden_redbullgc.*, Holden_redbulladf.*) and
embeds tools/lv78.js as the last script. Safe to rerun.
Usage: python3 tools/build_lv78.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
f=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=f.read_text()
for k in ('Holden_redbullpink','Holden_redbullgc','Holden_redbulladf'):
    entry='"%s":{"dds":"assets/liveries/%s.dds.gz.bin","webp":"assets/liveries/%s.webp"},'%(k,k,k)
    if '"%s"'%k not in html:
        html,n=re.subn(r'(<script id="rf41-liveries" type="application/json">\{)',lambda m:m.group(1)+entry,html,count=1)
        assert n==1,'rf41-liveries block not found'
js=(root/'tools/lv78.js').read_text()
html=re.sub(r'<script id="lv78-liveries">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="lv78-liveries">\n'+js+'</script>'+html[i:]
f.write_text(html)
print('ok',f,len(html))
