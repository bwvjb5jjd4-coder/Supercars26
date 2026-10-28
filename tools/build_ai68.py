"""Racing line (ai68): refresh the AI62 script in place from tools/ai62.js, build the circuit's racing
line when the track is made, point the race planner's corner speeds at the line's curvature and let
its lane follow the line at full rate, then embed tools/ai68.js as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
ai62=(root/'tools/ai62.js').read_text()
js=(root/'tools/ai68.js').read_text()
m=re.search(r'(<script id="ai62-physics">\n).*?(</script>)',html,flags=re.S)
assert m
html=html[:m.start()]+m.group(1)+ai62+m.group(2)+html[m.end():]
html=re.sub(r'<script id="ai68-line">.*?</script>','',html,flags=re.S)
for old,new in [
 ("for(const s of this.samples)s.speed*=.93;};","for(const s of this.samples)s.speed*=.93;if(typeof ai68Build==='function')ai68Build(this);};"),
 ("k=Math.abs(dcTrackCurvature(W,x.progress));let target=Math.min(s.speed,W.at(x.progress+.002).speed)*Math.sqrt(clamp(grip/1.02,.28","k=Math.abs(ai68Curv(W,x.progress));let target=Math.min(s.speed,W.at(x.progress+.002).speed)*Math.sqrt(clamp(grip/1.02,.28"),
 ("const ck=Math.abs(dcTrackCurvature(W,x.progress+metres/(L.e.lengthKm*1000))),limit=ck>.00001?Math.sqrt(19*grip","const ck=Math.abs(ai68Curv(W,x.progress+metres/(L.e.lengthKm*1000))),limit=ck>.00001?Math.sqrt(19*grip"),
 # earlier ai68 builds let the lane move by up to the line's drift beyond the rate limit
 ("drift=ai68Drift(W,x,dt),newLane=x.lane+clamp(lane-x.lane,Math.min(0,drift)-maxShift,Math.max(0,drift)+maxShift)","drift=ai68Drift(W,x,dt),newLane=x.lane+clamp(lane-x.lane,drift-maxShift,drift+maxShift)"),
 ("x.lane+clamp(lane-x.lane,Math.min(0,drift)-maxShift,Math.max(0,drift)+maxShift):newLane","x.lane+clamp(lane-x.lane,drift-maxShift,drift+maxShift):newLane"),
 ("newLane=x.lane+clamp(lane-x.lane,-maxShift,maxShift)","drift=ai68Drift(W,x,dt),newLane=x.lane+clamp(lane-x.lane,drift-maxShift,drift+maxShift)"),
 ("x.lane+clamp(lane-x.lane,-maxShift,maxShift):newLane","x.lane+clamp(lane-x.lane,drift-maxShift,drift+maxShift):newLane"),
]:
    assert html.count(old)==1 or (html.count(old)==0 and new in html),old
    html=html.replace(old,new)
i=html.rindex('</body>')
html=html[:i]+'<script id="ai68-line">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
