"""Circuit-select silhouettes (ui26 trackArt) drawn from each circuit's real driven centreline.
Reads SC25_DATA (OpenStreetMap-traced layouts the 3D races use) from index.html, draws each
one north-up, pushes apart legs that run side by side (Townsville's out-and-back) so the loop
still reads at icon size, and embeds the result as TRACK_ART. Mount Panorama and Taupō keep
their hand-traced VERIFIED_CIRCUITS outlines. Idempotent: run again after a layout changes."""
import json,math,re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
h=(root/'index.html').read_text()
data=json.loads(re.search(r'const SC25_DATA=(\{.*?\});\n',h).group(1))
rounds={int(m.group(1)):m.group(2) for m in re.finditer(r"\n \[(\d+),'[^']*','[^']*',\d+,'[^']*',\[[\d,]*\],[\d.]+,\d+,'(\w+)'\]",h)}
verified=re.search(r'const VERIFIED_CIRCUITS=\{(.*?)\n\};',h,re.S).group(1)
KEEP={2,10}  # Taupō and Mount Panorama: Riley likes the existing outlines.
W,H,PAD,GAP=120,100,9,5.5

def resample(p,step):
 out=[];n=len(p)
 for i in range(n):
  a,b=p[i],p[(i+1)%n];k=max(1,int(math.dist(a,b)/step))
  out+=[[a[0]+(b[0]-a[0])*t/k,a[1]+(b[1]-a[1])*t/k] for t in range(k)]
 return out

def fit(p):
 xs=[q[0] for q in p];ys=[q[1] for q in p]
 s=min((W-2*PAD)/(max(xs)-min(xs)),(H-2*PAD)/(max(ys)-min(ys)))
 ox=(W-(max(xs)-min(xs))*s)/2-min(xs)*s;oy=(H-(max(ys)-min(ys))*s)/2-min(ys)*s
 return [[q[0]*s+ox,q[1]*s+oy] for q in p]

def separate(p):
 # Points further than 18 units apart along the lap but closer than GAP on screen belong to
 # legs running side by side: push them apart, then smooth so the bend stays round.
 n=len(p);arc=[0]
 for i in range(1,n):arc.append(arc[-1]+math.dist(p[i-1],p[i]))
 lap=arc[-1]+math.dist(p[-1],p[0])
 for _ in range(60):
  move=[[0,0] for _ in p]
  for i in range(n):
   for j in range(i+1,n):
    da=abs(arc[i]-arc[j]);da=min(da,lap-da)
    if da<18:continue
    dx=p[i][0]-p[j][0];dy=p[i][1]-p[j][1];d=math.hypot(dx,dy)
    if d<GAP:
     # Push each point along its own normal; legs drawn on top of each other (one OSM way
     # used in both directions) go to the left of their direction of travel.
     f=(GAP-d)/2
     for a,b,sx,sy in ((i,j,dx,dy),(j,i,-dx,-dy)):
      tx=p[(a+1)%n][0]-p[a-1][0];ty=p[(a+1)%n][1]-p[a-1][1];tl=math.hypot(tx,ty) or 1
      nx,ny=ty/tl,-tx/tl;s=1 if d<.4 or sx*nx+sy*ny>=0 else -1
      move[a][0]+=nx*f*s;move[a][1]+=ny*f*s
  if not any(m[0] or m[1] for m in move):break
  p=[[q[0]+m[0]*.5,q[1]+m[1]*.5] for q,m in zip(p,move)]
  p=[[(p[i-1][0]+2*p[i][0]+p[(i+1)%n][0])/4,(p[i-1][1]+2*p[i][1]+p[(i+1)%n][1])/4] for i in range(n)]
 return p

def simplify(p,eps=.35):
 def rdp(a):
  if len(a)<3:return a
  (x1,y1),(x2,y2)=a[0],a[-1];L=math.hypot(x2-x1,y2-y1) or 1
  d=[abs((x2-x1)*(y1-q[1])-(x1-q[0])*(y2-y1))/L for q in a[1:-1]];i=max(range(len(d)),key=d.__getitem__)
  return rdp(a[:i+2])[:-1]+rdp(a[i+1:]) if d[i]>eps else [a[0],a[-1]]
 k=max(range(len(p)),key=lambda i:math.dist(p[0],p[i]))
 return rdp(p[:k+1])[:-1]+rdp(p[k:]+[p[0]])[:-1]

def path(p):return 'M'+'L'.join(f'{q[0]:.1f},{q[1]:.1f}' for q in p)+'Z'

art={}
for eid,key in sorted(rounds.items()):
 if eid in KEEP:
  m=re.search(r'\n\s*%d:\{.*?points:(\[\[.*?\]\])'%eid,verified)
  pts=json.loads(re.sub(r'(?<![\d])\.',r'0.',m.group(1)));art[eid]=path([[q[0]*W,q[1]*H] for q in pts]);continue
 p=fit(data[key]['points'])
 p=separate(resample(p,1.2))
 art[eid]=path(simplify(fit(p)))
block='const TRACK_ART='+json.dumps({str(k):v for k,v in art.items()},separators=(',',':'))+';\n'
h=re.sub(r' const TRACK_ART=\{.*?\};\n','',h,count=1)
fn=" function trackArt(value){"
assert h.count(fn)==1
h=h.replace(fn,' '+block+fn)
old="function trackArt(value){const points=typeof VERIFIED_CIRCUITS!=='undefined'?VERIFIED_CIRCUITS[value]?.points:null;if(!points)return svgIcon('flag');return `<svg class=\"ui26-track-art\" viewBox=\"0 0 120 100\" aria-hidden=\"true\"><path d=\"M${points.map(p=>`${(p[0]*120).toFixed(1)},${(p[1]*100).toFixed(1)}`).join('L')}Z\""
new="function trackArt(value){const d=TRACK_ART[value];if(!d)return svgIcon('flag');return `<svg class=\"ui26-track-art\" viewBox=\"0 0 120 100\" aria-hidden=\"true\"><path d=\"${d}\""
if old in h:h=h.replace(old,new)
assert new in h
(root/'index.html').write_text(h)
print('ok',{k:len(v) for k,v in art.items()})
