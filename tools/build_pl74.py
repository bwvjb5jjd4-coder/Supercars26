"""Embed tools/pl74.js (pit lane rules, strategy, penalties served in the lane, crew mistakes) into index.html.
Also refreshes pt61 and ic59 in place (both are edited alongside pl74)."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
def put(sid,name,last=False):
    global html
    js=(root/'tools'/name).read_text();tag=f'<script id="{sid}">\n'+js+'</script>'
    m=re.search(rf'<script id="{sid}">.*?</script>',html,flags=re.S)
    if m:html=html[:m.start()]+tag+html[m.end():]
    elif last:
        i=html.rindex('</body>');html=html[:i]+tag+html[i:]
    else:raise SystemExit('missing '+sid)
put('ic59-incidents','ic59.js')
put('pt61-pitstops','pt61.js')
put('pl74-pitlane','pl74.js',last=True)
(root/'index.html').write_text(html)
print('ok',len(html))
