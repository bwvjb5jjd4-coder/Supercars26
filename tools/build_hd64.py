"""Difficulty tiers (hd64): refresh the AI62 script in place from tools/ai62.js, route the race
pace and championship target through hd64, and embed tools/hd64.js as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
ai62=(root/'tools/ai62.js').read_text()
js=(root/'tools/hd64.js').read_text()
m=re.search(r'(<script id="ai62-physics">\n).*?(</script>)',html,flags=re.S)
assert m
html=html[:m.start()]+m.group(1)+ai62+m.group(2)+html[m.end():]
html=re.sub(r'<script id="hd64-difficulty">.*?</script>','',html,flags=re.S)
for old,new in [
 ("D.settings.difficulty==='Easy'?.93:D.settings.difficulty==='Hard'?1.035:1)}","hd64Pace())}"),
 ("(D.settings.difficulty==='Easy'?3:D.settings.difficulty==='Hard'?-1:1)","hd64TargetShift()"),
 ("const maxShift=(L.weather==='Dry'?2.0:1.35)*dt,newLane","const maxShift=(L.weather==='Dry'?2.0:1.35)*dt*(x.hd64Rate||1),newLane"),
]:
    assert html.count(old)+html.count(new)==1,old
    html=html.replace(old,new)
i=html.rindex('</body>')
html=html[:i]+'<script id="hd64-difficulty">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
