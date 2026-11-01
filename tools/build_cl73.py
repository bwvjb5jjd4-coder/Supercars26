"""Embed tools/cl73.js (season calendars + the Calendar page) into index.html, just before the
fx52 script (fx52 stays last), and add the Calendar page to the career sidebar and page table.
Build order: ... build_ui58 -> build_ui72 -> build_cl73 -> build_fx52."""
import re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
js=(root/'tools/cl73.js').read_text()
def once(old,new):
    global html
    if new in html:return
    assert html.count(old)==1,old
    html=html.replace(old,new)
once("['Championship','▥'],['Inbox','✉']","['Championship','▥'],['Calendar','▦'],['Inbox','✉']")
once("'Contracts':dcContracts,'Settings':dcSettings};","'Contracts':dcContracts,'Settings':dcSettings,'Calendar':()=>window.CL73?CL73.page():''};")
html=re.sub(r'<script id="cl73-calendar">.*?</script>','',html,flags=re.S)
tag='<script id="cl73-calendar">\n'+js+'</script>'
i=html.find('<script id="fx52-render">')
if i<0:i=html.rindex('</body>')
html=html[:i]+tag+html[i:]
(root/'index.html').write_text(html)
print('ok',len(html))
