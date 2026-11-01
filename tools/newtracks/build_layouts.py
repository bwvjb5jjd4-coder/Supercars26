"""Turn tools/newtracks/geo/<key>.json (real lat/lon data, see fetch_geo.py) into the game's
circuit data: tools/newtracks/layouts.json, consumed by tools/build_ct54.py.

Per circuit: the centreline in metres (x east, z south, like SC25_DATA), starting at the start
line and running in the race direction; the pit-lane side; the real elevation profile along the
lap (Terrarium/SRTM tiles on AWS open data, smoothed); venue buildings as oriented boxes; water
(sea, lakes, harbour) polygons; and a small 2D map for the timing screens."""
import json,math,sys,pathlib
import numpy as np
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from elev import elev
SPEC={  # smoothing sigma (m), output spacing (m)
 'winton':(4,9),'phillip':(4,10),'lakeside':(4,8),'cota':(2,10),'yas':(2,10),'bahrain':(2,10),'newcastle':(4,7),'canberra':(4,8)}
def resample(P,step,closed=True):
  Q=np.vstack([P,P[:1]]) if closed else P
  d=np.r_[0,np.cumsum(np.hypot(*np.diff(Q,axis=0).T))];L=d[-1];n=max(8,int(round(L/step)))
  s=np.linspace(0,L,n,endpoint=not closed)
  return np.c_[np.interp(s,d,Q[:,0]),np.interp(s,d,Q[:,1])],L
def gsmooth(P,sig,step):
  if sig<=0:return P
  k=int(3*sig/step);w=np.exp(-.5*(np.arange(-k,k+1)*step/sig)**2);w/=w.sum()
  return np.c_[[np.convolve(np.r_[P[-k:,i],P[:,i],P[:k,i]],w,'valid') for i in range(P.shape[1])]].T
def arcpos(P,cum,q):
  # nearest position (metres along the lap) of point q on closed polyline P
  best=(1e18,0)
  for i in range(len(P)):
    a=P[i];b=P[(i+1)%len(P)];ab=b-a;u=np.clip(((q-a)@ab)/(ab@ab+1e-9),0,1);d=np.linalg.norm(a+ab*u-q)
    if d<best[0]:best=(d,cum[i]+u*np.linalg.norm(ab))
  return best[1]
def build(key):
  g=json.load(open(HERE/'geo'/f'{key}.json'));sig,step=SPEC[key]
  ll=np.array(g['loop']);lat0=ll[:,1].mean();lon0=ll[:,0].mean();kx=111320*math.cos(math.radians(lat0));ky=110540
  loc=lambda a:np.c_[(np.asarray(a)[:,0]-lon0)*kx,-(np.asarray(a)[:,1]-lat0)*ky]
  geo=lambda P:(P[:,0]/kx+lon0,-P[:,1]/ky+lat0)
  P,_=resample(loc(ll),2);P=gsmooth(P,sig,2)
  # Orientation: shoelace in (east, north); positive = anticlockwise.
  A=.5*np.sum(P[:,0]*np.roll(-P[:,1],-1)-np.roll(P[:,0],-1)*-P[:,1])
  if (A>0)!=(g['dir']=='ccw'):P=P[::-1].copy()
  cum=np.r_[0,np.cumsum(np.hypot(*np.diff(np.vstack([P,P[:1]]),axis=0).T))];L=cum[-1]
  # Start line: 38% of the way down the pit lane (the game builds 210 m of pit before it, 340 m after).
  if g.get('pit'):
    pit=loc(g['pit']);sa=arcpos(P,cum[:-1],pit[0]);sb=arcpos(P,cum[:-1],pit[-1])
    if (sb-sa)%L>L/2:sa,sb=sb,sa;pit=pit[::-1]
    s0=(sa+.38*((sb-sa)%L))%L;pm=pit[len(pit)//2]
  else:
    s0=arcpos(P,cum[:-1],loc([g['start']])[0]);pm=loc([g['pitPoint']])[0]
  i0=int(np.searchsorted(cum,s0))%len(P);P=np.roll(P,-i0,axis=0)
  cum=np.r_[0,np.cumsum(np.hypot(*np.diff(np.vstack([P,P[:1]]),axis=0).T))]
  sm=arcpos(P,cum[:-1],pm);i=int(np.searchsorted(cum,sm))%len(P);v=P[(i+1)%len(P)]-P[i];n=np.array([-v[1],v[0]])
  side=1 if (pm-P[i])@n>0 else -1
  out,_=resample(P,step)
  # Elevation along the lap, metres above the lowest point, smoothed over ~35 m.
  E,_=resample(P,5);lon,lat=geo(E);h=np.array([elev(a,b) for a,b in zip(lat,lon)]);h=gsmooth(h[:,None],35,5)[:,0]
  idx=np.linspace(0,len(h),257)[:-1].astype(int);prof=(h[idx]-h.min())
  # Buildings: oriented boxes within 450 m of the track, clear of the road.
  def dist(q):return np.min(np.hypot(*(out-q).T))
  B=[]
  for b in g['buildings']:
    r=loc(b['ring']);c=r.mean(0);e1=r[1]-r[0];e2=r[2]-r[1];w=np.linalg.norm(e1);d=np.linalg.norm(e2)
    if w<4 or d<4 or w*d<30:continue
    dd=dist(c)
    if dd<24 or dd>450:continue
    hh=b['h'] or (b['floors'] or 0)*3.2 or None
    B.append((dd,[round(c[0],1),round(c[1],1),round(w,1),round(d,1),round(math.atan2(e1[1],e1[0]),3),round(hh,1) if hh else 0]))
  B=[x for _,x in sorted(B)][:220]
  Wt=[]
  for w in g['water']:
    r=loc(w['ring']);Wt.append({'kind':w['kind'],'ring':np.round(r,1).tolist()})
  # 2D map for the old timing screens: ~28 points in a unit box, y down (north up).
  M,_=resample(P,L/28);lo=M.min(0);span=(M.max(0)-lo).max();mp=((M-lo)/span*.76+.12).round(3).tolist()
  print(f'{key}: {L:.0f} m mapped, {len(out)} pts, pit side {side}, climb {prof.max():.1f} m, {len(B)} buildings, {len(Wt)} water')
  return dict(points=np.round(out,2).tolist(),mappedLength=round(L),pitSide=side,elev=np.round(prof,2).tolist(),buildings=[b for b in B],water=Wt,map=mp,source=g['source'],origin=[round(lat0,6),round(lon0,6)])
if __name__=='__main__':
  keys=sys.argv[1:] or list(SPEC);path=HERE/'layouts.json'
  data=json.load(open(path)) if path.exists() else {}
  for k in keys:data[k]=build(k)
  json.dump(data,open(path,'w'),separators=(',',':'))
