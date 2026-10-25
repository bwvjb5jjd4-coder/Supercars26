"""Add the Sydney Olympic Park (Homebush) street circuit to index.html as the final round.
Idempotent: run again after tools/homebush_layout.py changes. The 3D circuit itself is
tools/ct52_homebush.js (embedded by build_ct48.py)."""
import json,re,subprocess,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
lay=json.loads(subprocess.check_output([sys.executable,str(root/'tools'/'homebush_layout.py')]))
h=(root/'index.html').read_text()
def once(old,new,count=1):
 global h
 if new in h:return
 assert h.count(old)==count,(old,h.count(old));h=h.replace(old,new)
# Base calendar row (id 14) after the Adelaide Grand Final.
once("['Adelaide Grand Final','Adelaide Street Circuit',48,'November 26–29',3,'finals',true,50,'street']\n]",
 "['Adelaide Grand Final','Adelaide Street Circuit',48,'November 26–29',3,'finals',true,50,'street'],\n['Sydney Olympic Park 500','Homebush Street Circuit',49,'December 4–6',2,'finals',true,74,'street']\n]")
# 2D map for the timing screens.
mp=lay['map'];n=len(mp);pit=[[round(mp[i%n][0]-.035,3),mp[i%n][1]] for i in (n-3,n-2,n-1,0,1,2,3)]
row="{name:'Homebush Street Circuit',points:%s,pit:%s}"%(json.dumps(mp,separators=(',',':')),json.dumps(pit,separators=(',',':')))
h=re.sub(r",\n\{name:'Homebush Street Circuit'.*?\}\n\];",'\n];',h,flags=re.S)
once("{name:'Adelaide Street Circuit',points:[[.16,.58],[.16,.31],[.30,.19],[.56,.18],[.76,.20],[.84,.31],[.80,.44],[.86,.56],[.78,.71],[.59,.82],[.34,.82],[.19,.69]],pit:[[.19,.55],[.19,.46],[.19,.38],[.22,.31]]}\n];",
 "{name:'Adelaide Street Circuit',points:[[.16,.58],[.16,.31],[.30,.19],[.56,.18],[.76,.20],[.84,.31],[.80,.44],[.86,.56],[.78,.71],[.59,.82],[.34,.82],[.19,.69]],pit:[[.19,.55],[.19,.46],[.19,.38],[.22,.31]]},\n"+row+"\n];")
# 3D centreline.
data=json.dumps({'points':lay['points'],'pit':[],'buildings':[],'source':'Sydney Olympic Park street map reconstruction (Australia Ave, Kevin Coombs Ave, Edwin Flack Ave, Dawn Fraser Ave, Showground Rd, Murray Rose Ave, Park St)'},separators=(',',':'))
h=re.sub(r',"homebush":\{.*?\}(?=\};\n)', '', h, count=1, flags=re.S)
i=h.index('const SC25_DATA=');j=h.index('};\n',i)
h=h[:j]+',"homebush":'+data+h[j:]
# Season round: two 250 km races, Super2 support, finals type, a shootout for each race.
once(" [13,'Adelaide Grand Final','Adelaide Street Circuit',48,'November 27–30',[32,78,78],3.219,81,'adelaide']\n];",
 " [13,'Adelaide Grand Final','Adelaide Street Circuit',48,'November 27–30',[32,78,78],3.219,81,'adelaide'],\n [14,'Sydney Olympic Park 500','Homebush Street Circuit',49,'December 4–6',[74,74],3.42,88,'homebush']\n];")
once("super2:[0,4,5,8,10,13].includes(row[0])","super2:[0,4,5,8,10,13,14].includes(row[0])")
once("[11,12,13].includes(e.id)?'finals'","[11,12,13,14].includes(e.id)?'finals'")
once("function sc25Shootout(e,i){return [9,10,11,12].includes(e.id)","function sc25Shootout(e,i){return [9,10,11,12,14].includes(e.id)")
once("const wet=[0,2,4,11,12,13].includes(e.id)","const wet=[0,2,4,11,12,13,14].includes(e.id)")
once("13 rounds · 34 races","${EVENTS.length} rounds · ${EVENTS.reduce((n,e)=>n+e.races,0)} races")
once("<span>13 venues</span>","<span>${EVENTS.length} venues</span>")
# Street-circuit rules everywhere the old code lists the street tracks.
h=h.replace("['goldcoast','adelaide','townsville']","['goldcoast','adelaide','townsville','homebush']")
h=h.replace("['goldcoast','adelaide','townsville','albert']","['goldcoast','adelaide','townsville','albert','homebush']")
# Pit lane on the left of Australia Avenue (west), the grid on the right.
# Pit exit where the map has it, just past the Australia Avenue kink (the entry already matches).
once("exit=this.e.key==='sandown'?235:340","exit=this.e.key==='sandown'?235:this.e.key==='homebush'?140:340")
once("this.e.key==='townsville'?-1:chosen","['townsville','homebush'].includes(this.e.key)?-1:chosen")
(root/'index.html').write_text(h)
print('ok',lay['length'],len(h))
