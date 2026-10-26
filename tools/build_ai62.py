"""Embed tools/ai62.js (AI cars on the PH47 tyre model) into index.html as the last script, and expose the race AI's speed target."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ai62.js').read_text()
for old,new in [('x.progress+=x.v/Math.max(5,s.speed)/L.e.realLap*dt','x.progress+=x.v/Math.max(5,s.speed)/(L.e.realLap*(L.ai62Pace||1))*dt'),('oldV=x.v;x.v=Math.max(0,x.v+clamp(target-x.v,-brake*dt,accel*dt));','oldV=x.v;x.ai62Target=target;x.v=Math.max(0,x.v+clamp(target-x.v,-brake*dt,accel*dt));')]:
    assert html.count(old)+html.count(new)>=1,old
    html=html.replace(old,new)
html=re.sub(r'<script id="ai62-physics">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ai62-physics">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
