"""AI race craft, mistakes and tyre warm-up weaving (ai76): refresh the tw67 script in place from
tools/tw67.js, route the race planner's pass decision through ai76Pass, then embed tools/ai76.js
as the last script."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
tw=(root/'tools/tw67.js').read_text()
js=(root/'tools/ai76.js').read_text()
m=re.search(r'(<script id="tw67-tyres">\n).*?(</script>)',html,flags=re.S)
assert m
html=html[:m.start()]+m.group(1)+tw+m.group(2)+html[m.end():]
old="if(traffic.front&&!noPass&&!headingToPit&&traffic.gap>8&&traffic.gap<Math.max(70,x.v*1.8)){"
new="if(typeof ai76Pass==='function'?ai76Pass(x,traffic,noPass||headingToPit):traffic.front&&!noPass&&!headingToPit&&traffic.gap>8&&traffic.gap<Math.max(70,x.v*1.8)){"
assert html.count(old)==1 or (html.count(old)==0 and html.count(new)==1)
if html.count(new)==0:html=html.replace(old,new)
html=re.sub(r'<script id="ai76-race">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ai76-race">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
