"""Collect the real-world source data for the eight circuits added in ct54 and save it as
tools/newtracks/geo/<key>.json (lat/lon), so build_layouts.py can rebuild offline.

Sources (all open data):
 - OpenStreetMap raceway ways (Winton, Phillip Island, Lakeside, pit lanes): Daylight Map
   Distribution OSM parquet on AWS (s3://daylight-openstreetmap, release v1.58), (c) OSM
   contributors, ODbL 1.0.
 - COTA, Yas Marina (original 2009-2020 layout, as raced by V8 Supercars in 2012) and Bahrain
   GP circuit centrelines: TUMFTM racetrack-database (LGPL-3.0), georeferenced by a rigid ICP fit to
   bacinger/f1-circuits (MIT).
 - Newcastle (2017-2023) and Canberra (2000-2002) street circuits: routed along the real streets
   in Overture Maps transportation data (ODbL), in the order the race used them.
 - Buildings and water (sea, lakes, harbour): Overture Maps base/buildings themes.
Run with network access to AWS S3 and raw.githubusercontent.com. Not needed for normal builds."""
import json,math,pickle,sys,pathlib,collections
sys.path.insert(0,'/tmp/claude-0/sc/ov');sys.path.insert(0,'/tmp/claude-0/sc/tools')
import numpy as np,shapely.wkt as WKT,shapely.wkb as WKB
from shapely.geometry import box,shape,mapping,Polygon,MultiPolygon
from ovq import q
from route import load,legs,mlen
from fit import tum,bac,tolocal,dens,icp
OUT=pathlib.Path(__file__).resolve().parent/'geo'
R=pickle.load(open('/tmp/claude-0/sc/ov/raceways.pkl','rb'))
def ll(i):
  g=WKT.loads(R[i][2]);g=g.exterior if g.geom_type=='Polygon' else g;return [list(c) for c in g.coords]
def chain(ids):
  segs=[ll(i) for i in ids];out=segs[0][:];rest=segs[1:]
  while rest:
    e=out[-1];best=None
    for j,s in enumerate(rest):
      for q_ in (s,s[::-1]):
        d=math.hypot(q_[0][0]-e[0],q_[0][1]-e[1])
        if best is None or d<best[0]:best=(d,j,q_)
    d,j,q_=best;assert d<2e-4,('gap',d);out+=q_[1:];rest.pop(j)
  return out
def tumgeo(name,bid,trim):
  T=tum(name);B=bac(bid);lat0,lon0=B[:,1].mean(),B[:,0].mean();L=dens(tolocal(B,lat0,lon0),3)
  e,Rm,t=icp(T[::3,:2],L,trim=trim);P=T[:,:2]@Rm.T+t
  lon=P[:,0]/(111320*math.cos(math.radians(lat0)))+lon0;lat=P[:,1]/110540+lat0
  return [[float(a),float(b)] for a,b in zip(lon,lat)],{'icpMedianM':round(float(e),2),'widthR':T[:,2].round(2).tolist(),'widthL':T[:,3].round(2).tolist()}
def newcastle():
  S=load('/tmp/claude-0/sc/ov/newc_seg.pkl',-32.93)
  plan=[((151.7850,-32.9262),{'Watt Street'}),((151.783479,-32.930233),{'Shortland Esplanade'}),((151.787701,-32.928856),{'Zaara Street'}),((151.788043,-32.927882),{'Scott Street'}),((151.78925,-32.928204),{'Parnell Place'}),((151.78979,-32.927013),{'Nobbys Road'}),((151.7914,-32.9246),{'Wharf Road','Nobbys Road'})]
  P=[list(p) for p in legs(S,plan)]
  # Camp Shortland car-park hairpin: Nobbys Road runs on north past the Wharf Road roundabout,
  # a tight left hairpin in the car park, then back south to turn right onto Wharf Road.
  k=min(range(len(P)),key=lambda i:(P[i][0]-151.7914)**2+(P[i][1]+32.9246)**2)
  c=math.cos(math.radians(-32.92));m=lambda dx,dy:[151.7914+dx/(111320*c),-32.9246+dy/110540]
  hp=[m(8,25),m(14,55),m(16,85),m(10,105),m(-4,113),m(-18,108),m(-26,92),m(-28,70),m(-30,45),m(-34,20),m(-44,4)]
  P=P[:k]+hp+P[k+1:]
  return P
def canberra():
  S=load('/tmp/claude-0/sc/ov/canb_seg.pkl',-35.3)
  plan=[((149.12771,-35.29702),{'Langton Crescent'}),((149.126402,-35.300889),{'Queen Victoria Terrace'}),((149.132568,-35.304904),{'Kings Avenue'}),((149.129101,-35.306285),{'State Circle'}),((149.122319,-35.304233),{'Flynn Drive'})]
  return [list(p) for p in legs(S,plan)]
T={
 'winton':dict(loop=lambda:ll(75),dir='cw',pit=lambda:ll(129),src='OpenStreetMap way 60238255 (Winton Motor Raceway, National Circuit)'),
 'phillip':dict(loop=lambda:ll(9),dir='ccw',pit=lambda:ll(83),src='OpenStreetMap way 43598473 (Phillip Island GP Circuit)'),
 'lakeside':dict(loop=lambda:chain([127,126,101,58,52]),dir='cw',pit=lambda:chain([47,81]),src='OpenStreetMap ways 45165631, 47089801, 1201216482, 1201216483, 1201216489 (Lakeside Raceway)'),
 'cota':dict(tum=('Austin','us-2012',.9),dir='ccw',pit=lambda:ll(134),src='TUMFTM racetrack-database Austin, georeferenced to bacinger/f1-circuits us-2012'),
 'yas':dict(tum=('YasMarina','ae-2009',.6),dir='ccw',pit=lambda:ll(48),src='TUMFTM racetrack-database YasMarina (2009 layout), georeferenced to bacinger/f1-circuits ae-2009'),
 'bahrain':dict(tum=('Sakhir','bh-2002',.9),dir='cw',pit=lambda:ll(86),src='TUMFTM racetrack-database Sakhir (GP circuit), georeferenced to bacinger/f1-circuits bh-2002'),
 'newcastle':dict(loop=newcastle,dir='ccw',start=(151.7880,-32.9255),pitPoint=(151.7878,-32.9262),src='Overture Maps streets: Wharf Rd, Watt St, Shortland Esplanade, Zaara St, Scott St, Parnell Pl, Nobbys Rd, Camp Shortland hairpin'),
 'canberra':dict(loop=canberra,dir='cw',start=(149.1275,-35.2982),pitPoint=(149.1284,-35.2984),src='Overture Maps streets: Langton Cres, Queen Victoria Tce, Kings Ave, State Circle, Flynn Dr'),
}
def run(key):
  t=T[key];extra={}
  if 'tum' in t:loop,extra=tumgeo(*t['tum'])
  else:loop=t['loop']()
  if loop[0]==loop[-1]:loop=loop[:-1]
  lon=[p[0] for p in loop];lat=[p[1] for p in loop];pad=.022
  bb=(min(lon)-pad/math.cos(math.radians(lat[0])),min(lat)-pad,max(lon)+pad/math.cos(math.radians(lat[0])),max(lat)+pad)
  W=[]
  for x in q('base','water',bb,['subtype','class','geometry']):
    if x['subtype'] in('physical',) or x['class'] in('swimming_pool','drain','fountain'):continue
    g=WKB.loads(x['geometry']).intersection(box(*bb))
    if g.is_empty or g.geom_type not in('Polygon','MultiPolygon'):continue
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
      if p.area*1e10<20000 and x['subtype']!='ocean':continue   # under ~2 ha
      p=p.simplify(4e-5);W.append({'kind':x['subtype'],'ring':[[round(a,6),round(b,6)] for a,b in p.exterior.coords]})
  bbb=(min(lon)-.006,min(lat)-.006,max(lon)+.006,max(lat)+.006)
  Bs=[]
  for x in q('buildings','building',bbb,['height','num_floors','class','geometry']):
    g=WKB.loads(x['geometry'])
    if g.geom_type!='Polygon':continue
    r=g.minimum_rotated_rectangle
    if r.geom_type!='Polygon':continue
    Bs.append({'ring':[[round(a,6),round(b,6)] for a,b in r.exterior.coords][:4],'h':x['height'],'floors':x['num_floors'],'class':x['class']})
  out=dict(key=key,dir=t['dir'],source=t['src'],loop=loop,pit=t['pit']() if 'pit' in t else None,start=t.get('start'),pitPoint=t.get('pitPoint'),water=W,buildings=Bs,**extra)
  json.dump(out,open(OUT/f'{key}.json','w'),separators=(',',':'))
  print(key,len(loop),'water',len(W),'buildings',len(Bs))
for k in (sys.argv[1:] or T):run(k)
