"""Embed tools/ui58.js (F1-style menus, HUD and broadcast graphics) into index.html as the last script.
The menu car art and circuit silhouettes are copied from the ui26 layer so both stay in step."""
import re,json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ui58.js').read_text()
ui26=re.search(r'<script id="ui26-interface">(.*?)</script>',html,re.S).group(1)
asset=re.search(r'const ASSET=(\{.*?\}\}),root=',ui26).group(1)
track=re.search(r'const TRACK_ART=(\{.*?\});',ui26).group(1)
json.loads(asset);json.loads(track)
js=js.replace('/*UI58_ASSET*/{}',asset).replace('/*UI58_TRACK*/{}',track)
tag='<script id="ui58-interface">\n'+js+'</script>'
if '<script id="ui58-interface">' in html:
    # Replace in place: later layers (gx55, ic59, pt61, pf61, co63…) wrap functions after it.
    html=re.sub(r'<script id="ui58-interface">.*?</script>',lambda m:tag,html,count=1,flags=re.S)
else:
    i=html.rindex('</body>')
    html=html[:i]+tag+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
