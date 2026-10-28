import json,numpy as np
from PIL import Image,ImageDraw
N=1024
r=json.load(open('geo.json'))
P=np.array(r[0]['pos'],np.float32).reshape(-1,3);U=np.array(r[0]['uvs'],np.float32).reshape(-1,2)
for k in range(3):
    T=np.array(r[k]['index']).reshape(-1,3);print(k,len(T),T.min(),T.max())
T=np.concatenate([np.array(x['index']).reshape(-1,3) for x in r[:3]])
C=P[T].mean(1);A=np.linalg.norm(np.cross(P[T[:,1]]-P[T[:,0]],P[T[:,2]]-P[T[:,0]]),axis=1);wing=(C[:,2]<-2.15)&(C[:,1]>1.07);T=T[np.lexsort((A,~wing))]
cent=P[T].mean(1);px=U*N
first=np.full((N,N),-1,np.int64);conf=np.zeros((N,N),bool)
img=Image.new('I',(N,N),-1)
# draw each triangle into a fresh small mask is slow; instead draw in two orders and compare 3D positions
def draw(order):
    im=Image.new('I',(N,N),-1);d=ImageDraw.Draw(im)
    for i in order:t=T[i];d.polygon([tuple(px[t[0]]),tuple(px[t[1]]),tuple(px[t[2]])],fill=int(i))
    return np.array(im,np.int64)
a=draw(range(len(T)));b=draw(range(len(T)-1,-1,-1))
Wg=(cent[:,2]<-2.15)&(cent[:,1]>1.07)
print('texels won by wing',(Wg[a[a>=0]]).sum())
m=(a>=0)&(b>=0)
dist=np.linalg.norm(cent[a[m]]-cent[b[m]],axis=1)
bad=np.zeros((N,N),bool);bad[m]=dist>0.15
print('overlap texels',bad.sum())
ys,xs=np.nonzero(bad)
ca=cent[a[bad]];cb=cent[b[bad]]
for i in np.random.default_rng(0).choice(len(ys),min(25,len(ys)),replace=False):print(xs[i]*4,ys[i]*4,ca[i].round(2),cb[i].round(2))
np.save('bad1024.npy',bad)
roof=(cent[:,1]>1.25)
ra=np.zeros((N,N),bool);rb=np.zeros((N,N),bool)
ra[a>=0]=roof[a[a>=0]];rb[b>=0]=roof[b[b>=0]]
k=rb&~ra&(a>=0)
print('roof texels lost',k.sum())
pa=cent[a[k]];print(np.round(np.percentile(pa,[5,50,95],axis=0),2))
