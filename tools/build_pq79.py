"""Pit lane flow (pq79): AI cars never get stuck in the pit lane.
Patches the base pit step so a car waiting to merge can ask PQ79 for a safe gap and a double-stacked
car waits inside its own box, then embeds
tools/pq79.js as the last script. Safe to rerun (replaces the old copy).
Usage: python3 tools/build_pq79.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text()
js=(root/'tools/pq79.js').read_text()
old='if(busy&&Math.abs(x.pitLane||0)>3.5){target=0;goalLane=x.pitLane;}'
new='if(busy&&Math.abs(x.pitLane||0)>3.5&&!window.PQ79?.merge?.(x,dt)){target=0;goalLane=x.pitLane;}'
if new not in html:
    assert html.count(old)==1,'merge rule not found'
    html=html.replace(old,new)
old='target=Math.min(target,Math.max(0,(dist-12)*.6));goalLane=side*8.1;'
new='target=Math.min(target,Math.max(0,(dist-7.5)*.6));goalLane=side*8.1;'
if new not in html:
    assert html.count(old)==1,'double stack rule not found'
    html=html.replace(old,new)
html=re.sub(r'<script id="pq79-pitflow">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="pq79-pitflow">\n'+js+'</script>'+html[i:]
target.write_text(html)
print('ok',len(html))
