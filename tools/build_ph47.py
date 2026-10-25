"""Embed tools/ph47.js into index.html as the last script and apply the small hooks it needs."""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ph47.js').read_text()
hooks=[
 ("const dc32FreeDrive=function(x,dt,input){","let dc32FreeDrive=function(x,dt,input){"),
 ("const wet=L.weather!=='Dry'&&!x.pitStage&&!x.outlapHold,water=wet?rf40Water(x):0","const wet=L.weather!=='Dry'&&!x.pitStage&&!x.outlapHold&&!x.ph47On,water=wet?rf40Water(x):0"),
 ("if(input.reverse&&!x.rf40Reverse&&x.v<.30&&","if(input.reverse&&!x.rf40Reverse&&Math.hypot(x.v,x.latV||0)<.30&&"),
]
for a,b in hooks:
    if b in html: continue
    assert html.count(a)==1,a
    html=html.replace(a,b)
html=re.sub(r'<script id="ph47-physics">.*?</script>','',html,flags=re.S)
# Circuits (ct48) build on the physics, so physics goes in front of them.
i=html.find('<script id="ct48-circuits">')
if i<0:i=html.rindex('</body>')
html=html[:i]+'<script id="ph47-physics">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
