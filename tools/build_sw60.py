"""Embed tools/sw60.js (cockpit steering wheel: no gloves, only the wheel turns, correct direction) into index.html as the last script, and flip the steering sign in the dc35/ph47 code."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/sw60.js').read_text()
for old,new in [('for(const steering of car.userData.dc35Steering)steering.rotation.z=-(L.player.steer||0)*4','for(const steering of car.userData.dc35Steering)steering.rotation.z=(L.player.steer||0)*4'),
                ('for(const wheel of car.userData.dc35Steering)wheel.rotation.z=-(x.steer||0)*4','for(const wheel of car.userData.dc35Steering)wheel.rotation.z=(x.steer||0)*4'),
                ('wheel.rotation.z=clamp(s.delta*9,-2.7,2.7)','wheel.rotation.z=clamp(-s.delta*9,-2.7,2.7)')]:
    assert html.count(old)+html.count(new)==1,old
    html=html.replace(old,new)
html=re.sub(r'<script id="sw60-steering">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="sw60-steering">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
