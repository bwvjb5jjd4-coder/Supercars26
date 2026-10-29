"""Embed tools/ui72.js (UI polish: standings, settings sections, tile art, inbox, home hero,
race results, context prompts, hold Y restart) as the last script.
Menu car art and circuit silhouettes are copied from the ui26 layer."""
import re,json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/ui72.js').read_text()
ui26=re.search(r'<script id="ui26-interface">(.*?)</script>',html,re.S).group(1)
asset=re.search(r'const ASSET=(\{.*?\}\}),root=',ui26).group(1)
track=re.search(r'const TRACK_ART=(\{.*?\});',ui26).group(1)
json.loads(asset);json.loads(track)
js=js.replace('/*UI72_ASSET*/{}',asset).replace('/*UI72_TRACK*/{}',track)
html=re.sub(r'<script id="ui72-interface">.*?</script>','',html,flags=re.S)
i=html.rindex('</body>')
html=html[:i]+'<script id="ui72-interface">\n'+js+'</script>'+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
