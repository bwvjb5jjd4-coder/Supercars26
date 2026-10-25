"""Centreline of the Sydney Olympic Park (Homebush) street circuit, 2009-2016 layout.
Anticlockwise. x east, z south (metres). Corners are polyline vertices with fillet radii,
traced from the streets: Australia Avenue (pit straight, northbound), T1 into Kevin Coombs
Avenue, the T2-3-4 chicane at Olympic Boulevard, T5 onto Edwin Flack Avenue past the
stadium, the T6-7 chicane, T8 (the fastest corner) onto Dawn Fraser Avenue, T9-10 through
Showground Road onto Murray Rose Avenue, the T11-12 right-left across Park Street beside the
station and T13 back onto Australia Avenue.
Prints JSON {points, map, corners}."""
import json, math
V = [  # (x, z, radius, name)
 (530, 300, 18, 'T13'),
 (470, -520, 26, 'T1'),
 (104, -540, 13, 'T2'),
 (64, -527, 10, 'T3'),
 (26, -546, 13, 'T4'),
 (-300, -560, 34, 'T5'),
 (-300, 92, 22, 'T6'),
 (-313, 134, 22, 'T7'),
 (-312, 330, 62, 'T8'),
 (240, 330, 13, 'T9'),
 (240, 250, 13, 'T10'),
 (380, 250, 16, 'T11'),
 (410, 292, 16, 'T12'),
]
START_Z = 0  # start line on Australia Avenue
def sub(a,b): return (a[0]-b[0],a[1]-b[1])
def norm(v): l=math.hypot(*v); return (v[0]/l,v[1]/l)
n=len(V); path=[]
for i in range(n):
  p0=V[i-1][:2]; p1=V[i][:2]; p2=V[(i+1)%n][:2]; r=V[i][2]
  d0=norm(sub(p1,p0)); d1=norm(sub(p2,p1))
  ang=math.acos(max(-1,min(1,d0[0]*d1[0]+d0[1]*d1[1])))
  t=r*math.tan(ang/2)
  a=(p1[0]-d0[0]*t,p1[1]-d0[1]*t); b=(p1[0]+d1[0]*t,p1[1]+d1[1]*t)
  cross=d0[0]*d1[1]-d0[1]*d1[0]
  nrm=(-d0[1],d0[0]) if cross>0 else (d0[1],-d0[0])
  c=(a[0]+nrm[0]*r,a[1]+nrm[1]*r)
  a0=math.atan2(a[1]-c[1],a[0]-c[0]); a1=math.atan2(b[1]-c[1],b[0]-c[0])
  da=a1-a0
  while da>math.pi: da-=2*math.pi
  while da<-math.pi: da+=2*math.pi
  arc=[]; k=max(2,int(abs(da)*r/3))
  for j in range(k+1):
    q=a0+da*j/k; arc.append((c[0]+math.cos(q)*r,c[1]+math.sin(q)*r))
  path.append((V[i][3],arc))
pts=[]
for i,(name,arc) in enumerate(path):
  pts.extend(arc)
  nxt=path[(i+1)%n][1][0]; e=arc[-1]; l=math.hypot(nxt[0]-e[0],nxt[1]-e[1]); k=max(1,int(l/6))
  for j in range(1,k): pts.append((e[0]+(nxt[0]-e[0])*j/k,e[1]+(nxt[1]-e[1])*j/k))
# Rotate so the list starts at the start line (first point on Australia Ave north of START_Z).
i0=min(range(len(pts)),key=lambda i: abs(pts[i][1]-START_Z)+(0 if pts[i][0]>440 else 1e4))
pts=pts[i0:]+pts[:i0]
L=sum(math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]) for i in range(len(pts)))
xs=[p[0] for p in pts]; zs=[p[1] for p in pts]
mx,Mx,mz,Mz=min(xs),max(xs),min(zs),max(zs); s=max(Mx-mx,Mz-mz)/.72
mp=[[round(.5+(p[0]-(mx+Mx)/2)/s,3),round(.5+(p[1]-(mz+Mz)/2)/s,3)] for p in pts[::14]]
print(json.dumps({'length':round(L,1),'count':len(pts),'points':[[round(x,2),round(z,2)] for x,z in pts],'map':mp}))
