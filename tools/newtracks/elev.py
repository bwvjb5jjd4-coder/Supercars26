# Terrarium elevation sampler (AWS open data, Mapzen/Tilezen). elev(lat,lon) in metres.
import math,io,os,urllib.request
from PIL import Image
Z=15;C=os.environ.get('TILE_CACHE','/tmp/terrarium-tiles');os.makedirs(C,exist_ok=True);_m={}
def _tile(x,y):
  k=(x,y)
  if k in _m:return _m[k]
  p=f'{C}/{Z}_{x}_{y}.png'
  if not os.path.exists(p):open(p,'wb').write(urllib.request.urlopen(f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{Z}/{x}/{y}.png').read())
  im=Image.open(p).convert('RGB');_m[k]=im.load();return _m[k]
def elev(lat,lon):
  n=2**Z;fx=(lon+180)/360*n;fy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
  px=fx*256-.5;py=fy*256-.5;x0=math.floor(px);y0=math.floor(py);tx=px-x0;ty=py-y0;s=0
  for dx,dy,w in((0,0,(1-tx)*(1-ty)),(1,0,tx*(1-ty)),(0,1,(1-tx)*ty),(1,1,tx*ty)):
    X=x0+dx;Y=y0+dy;t=_tile(X//256,Y//256);r,g,b=t[X%256,Y%256];s+=w*(r*256+g+b/256-32768)
  return s
