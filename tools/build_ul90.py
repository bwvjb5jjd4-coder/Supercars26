"""Ultimate difficulty (ul90): add 'Ultimate' to every difficulty picker and embed tools/ul90.js as the
last script. Usage: python3 tools/build_ul90.py [index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=path.read_text()
js=(root/'tools/ul90.js').read_text()
html=re.sub(r'<script id="ul90-ultimate">.*?</script>','',html,flags=re.S)
old,new="['Easy','Intermediate','Hard']","['Easy','Intermediate','Hard','Ultimate']"
html=html.replace(new,old)
assert html.count(old)>=3,html.count(old)
html=html.replace(old,new)
for a,b in [
 ('<option>Hard</option></select>','<option>Hard</option><option>Ultimate</option></select>'),
 ('c.difficulty=LEVELS[clamp(i+d,0,2)]','c.difficulty=LEVELS[clamp(i+d,0,LEVELS.length-1)]'),
]:
    html=html.replace(b,a)
    if a in html:html=html.replace(a,b)
    else:print('note: not found (ok if layer absent):',a[:50])
i=html.rindex('</body>')
html=html[:i]+'<script id="ul90-ultimate">\n'+js+'</script>'+html[i:]
path.write_text(html)
print('ok',path,len(html))
