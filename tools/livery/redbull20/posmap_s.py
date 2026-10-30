import json,numpy as np
from PIL import Image,ImageDraw
N=4096
r=json.load(open('geo.json'))
P=np.array(r[0]['pos'],np.float32).reshape(-1,3);U=np.array(r[0]['uvs'],np.float32).reshape(-1,2)
tris=[np.array(x['index']).reshape(-1,3) for x in r[:3]]
T=np.concatenate(tris)
C=P[T].mean(1);T=T[np.argsort(np.where((C[:,1]>1.2)&(C[:,2]>-1.2)&(np.abs(C[:,0])<0.55),9.0,np.abs(C[:,0])),kind='stable')]  # outer skin wins over inner door skins sharing UVs; roof wins over the wing endplates
# hood separate geometry
Ph=np.array(r[3]['pos'],np.float32).reshape(-1,3);Uh=np.array(r[3]['uvs'],np.float32).reshape(-1,2);Th=np.array(r[3]['index']).reshape(-1,3)
P=np.concatenate([P,Ph]);U=np.concatenate([U,Uh]);T=np.concatenate([T,Th+len(r[0]['pos'])//3])
print(len(T))
img=Image.new('I',(N,N),-1);d=ImageDraw.Draw(img)
px=U*N
for i,t in enumerate(T):
    d.polygon([tuple(px[t[0]]),tuple(px[t[1]]),tuple(px[t[2]])],fill=i)
tid=np.array(img,np.int64)
m=tid>=0
ys,xs=np.nonzero(m);ti=tid[m]
A=px[T[ti,0]];B=px[T[ti,1]];C=px[T[ti,2]]
p=np.stack([xs+.5,ys+.5],1)
v0=B-A;v1=C-A;v2=p-A
den=v0[:,0]*v1[:,1]-v1[:,0]*v0[:,1];den[np.abs(den)<1e-9]=1e-9
b1=(v2[:,0]*v1[:,1]-v1[:,0]*v2[:,1])/den;b2=(v0[:,0]*v2[:,1]-v2[:,0]*v0[:,1])/den
b1=np.clip(b1,0,1);b2=np.clip(b2,0,1-b1);b0=1-b1-b2
pos=P[T[ti,0]]*b0[:,None]+P[T[ti,1]]*b1[:,None]+P[T[ti,2]]*b2[:,None]
fn=np.cross(P[T[:,1]]-P[T[:,0]],P[T[:,2]]-P[T[:,0]]);fn/=np.linalg.norm(fn,axis=1,keepdims=True)+1e-12
# smooth normals: orient every face outwards (same test as views.py), then area-weight them onto welded
# vertices and interpolate across each triangle, so faceted panels don't flicker between projection views
Cc=P[T].mean(1);cv=np.stack([Cc[:,0]/.96,(Cc[:,1]-.7)/.7,Cc[:,2]/2.6],-1)
fa=np.cross(P[T[:,1]]-P[T[:,0]],P[T[:,2]]-P[T[:,0]]);fa*=np.where((fa*cv).sum(1)<0,-1,1)[:,None]
key=np.round(P*2000).astype(np.int64);_,wid=np.unique(key,axis=0,return_inverse=True);wid=wid.ravel()
VN=np.zeros((wid.max()+1,3))
for j in range(3):np.add.at(VN,wid[T[:,j]],fa)
VN/=np.linalg.norm(VN,axis=1,keepdims=True)+1e-12
nrm=VN[wid[T[ti,0]]]*b0[:,None]+VN[wid[T[ti,1]]]*b1[:,None]+VN[wid[T[ti,2]]]*b2[:,None]
nrm/=np.linalg.norm(nrm,axis=1,keepdims=True)+1e-12
POS=np.zeros((N,N,3),np.float32);NRM=np.zeros((N,N,3),np.float32)
POS[ys,xs]=pos;NRM[ys,xs]=nrm
np.save('hood.npy',tid>=len(T)-len(Th));np.save('pos.npy',POS);np.save('nrm.npy',NRM);np.save('mask.npy',m)
print(m.mean())
