"""Add the eight ct54 circuits (Winton, Phillip Island, Lakeside, COTA, Yas Marina, Bahrain,
Newcastle, Canberra) to index.html: base event rows (ids 15-22), SC25 round rows, the 3D
centrelines/elevation/buildings/water in SC25_DATA, the 2D timing-screen maps and the street
circuit lists. Idempotent. Layouts come from tools/newtracks/layouts.json (build_layouts.py);
the 3D scenery itself is tools/ct54_tracks.js, embedded by build_ct48.py.
Build order: build_ct54 -> build_ct48 -> build_trackart -> build_ui58 -> build_fx52 (last)."""
import json,re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
L=json.loads((root/'tools'/'newtracks'/'layouts.json').read_text())
h=(root/'index.html').read_text()
def once(old,new,count=1):
 global h
 if new in h:return
 assert h.count(old)==count,(old[:80],h.count(old));h=h.replace(old,new)
# id, key, event, circuit, km, race laps, real lap (s), character, Super2, finals
NEW=[
 (15,'winton','Winton SuperSprint','Winton Motor Raceway',3.0,[40,40,67],81,'technical',True),
 (16,'phillip','Phillip Island 500','Phillip Island Grand Prix Circuit',4.445,[57,57],92,'fast',True),
 (17,'lakeside','Lakeside Super 440','Lakeside Raceway',2.41,[50,50,83],56,'short',False),
 (18,'cota','Austin 400','Circuit of the Americas',5.513,[23,23,37],134,'fast',False),
 (19,'yas','Yas V8 400','Yas Marina Circuit',5.554,[36,36],133,'balanced',False),
 (20,'bahrain','Desert 400','Bahrain International Circuit',5.412,[37,37],131,'fast',False),
 (21,'newcastle','Newcastle 500','Newcastle Street Circuit',2.641,[95,95],71,'street',True),
 (22,'canberra','Canberra 400','Canberra Street Circuit',3.99,[26,26,52],104,'street',False),
]
# Base EVENTS table: rows are indexed by id, so the new ones go after Homebush (14).
tail="['Sydney Olympic Park 500','Homebush Street Circuit',49,'December 4–6',2,'finals',true,74,'street']"
rows=''.join(f",\n['{n}','{c}',{50+i},'Off calendar',{len(r)},'sprint',{'true' if s2 else 'false'},{r[0]},'{t}']" for i,(id,k,n,c,km,r,lap,t,s2) in enumerate(NEW))
h=re.sub(re.escape(tail)+r"(,\n\['[^\n]*'\])*\n\]",lambda m:tail+rows+'\n]',h,count=1)
# Season rows (same format build_trackart.py parses).
tail2=" [14,'Sydney Olympic Park 500','Homebush Street Circuit',49,'December 4–6',[74,74],3.42,88,'homebush']"
rows2=''.join(f",\n [{id},'{n}','{c}',{50+i},'Off calendar',{json.dumps(r).replace(' ','')},{km},{lap},'{k}']" for i,(id,k,n,c,km,r,lap,t,s2) in enumerate(NEW))
h=re.sub(re.escape(tail2)+r"(,\n \[\d+,[^\n]*\])*\n\];",lambda m:tail2+rows2+'\n];',h,count=1)
ids=[x[0] for x in NEW if x[8]]
h=re.sub(r"super2:\[0,4,5,8,10,13,14(?:,\d+)*\]\.includes\(row\[0\]\)",'super2:[0,4,5,8,10,13,14,'+','.join(map(str,ids))+'].includes(row[0])',h,count=1)
# 2D maps for the timing screens (indexed by id).
def maprow(c,mp):
 n=len(mp);pit=[[round(mp[i%n][0]-.035,3),mp[i%n][1]] for i in (n-3,n-2,n-1,0,1,2,3)]
 return "{name:'%s',points:%s,pit:%s}"%(c,json.dumps(mp,separators=(',',':')),json.dumps(pit,separators=(',',':')))
i=h.index('const CIRCUIT_MAPS=[');j=h.index('\n];',i);body=h[i:j]
k=body.index("{name:'Homebush Street Circuit'");k=body.index('\n',k) if '\n' in body[k:] else len(body)
body=body[:k]+''.join(',\n'+maprow(c,L[key]['map']) for id,key,n,c,*_ in NEW)
h=h[:i]+body+h[j:]
assert h[h.index('const CIRCUIT_MAPS=['):h.index('\n];',h.index('const CIRCUIT_MAPS=['))].count('{name:')==23
# 3D data.
i=h.index('const SC25_DATA=');j=h.index('};\n',i)
data=json.loads(h[i+len('const SC25_DATA='):j+1])
for id,key,n,c,*_ in NEW:
 v=L[key];data[key]={'points':v['points'],'pit':[],'buildings':[],'venue':v['buildings'],'water':v['water'],'elev':v['elev'],'pitSide':v['pitSide'],'origin':v['origin'],'source':v['source']+' · elevation: Terrarium/SRTM via AWS open data','mappedLength':v['mappedLength']}
h=h[:i]+'const SC25_DATA='+json.dumps(data,separators=(',',':'),ensure_ascii=False)+h[j+1:]
# Street-circuit rules everywhere the old code lists the street tracks.
h=h.replace("['goldcoast','adelaide','townsville','homebush']","['goldcoast','adelaide','townsville','homebush','newcastle','canberra']")
h=h.replace("['goldcoast','adelaide','townsville','albert','homebush']","['goldcoast','adelaide','townsville','albert','homebush','newcastle','canberra']")
# Pit lane on the real side for the new circuits.
once("const side=['townsville','homebush'].includes(this.e.key)?-1:chosen","const side=['townsville','homebush'].includes(this.e.key)?-1:(SC25_DATA[this.e.key]?.pitSide||chosen)")
(root/'index.html').write_text(h)
print('ok',len(h))
