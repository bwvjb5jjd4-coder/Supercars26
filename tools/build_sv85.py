"""Embed tools/sv85.js (career save safety: per-round copies, Earlier saves restore, loud
save-failure banner) as the LAST script, and patch dc36Boot so the built-in starter career is
only loaded when the browser holds no career data at all (an unreadable save is copied aside).
Usage: python3 tools/build_sv85.py [path/to/index.html]"""
import re,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
target=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'index.html'
html=target.read_text(encoding='utf-8')
old="if(!stored){try{const included="
new="if(!stored&&!sv85AnySave()){try{const included="
helper=("function sv85AnySave(){/* sv85: never seed over career data that exists but did not load */\n"
 " let raw=null;try{raw=localStorage.getItem(DC_KEY)||localStorage.getItem(DC_KEY+'_backup');}catch(_){return false;}\n"
 " if(!raw)return false;try{const k=DC_KEY+'_unreadable';if(localStorage.getItem(k)!==raw)localStorage.setItem(k,raw);}catch(_){}\n"
 " console.warn('sv85: a career save exists but could not be loaded; it was kept as '+DC_KEY+'_unreadable');return true;}\n")
if new not in html:
    assert html.count(old)==1, 'dc36Boot seed line not found'
    html=html.replace(old,new)
    i=html.index('function dc36Boot(){')
    html=html[:i]+helper+html[i:]
js=(root/'tools/sv85.js').read_text(encoding='utf-8')
tag='<script id="sv85-saves">\n'+js+'</script>'
html=re.compile(r'<script id="sv85-saves">.*?</script>',re.S).sub('',html)
i=html.rindex('</body>');html=html[:i]+tag+html[i:]
target.write_text(html,encoding='utf-8')
print('ok',target,len(html))
