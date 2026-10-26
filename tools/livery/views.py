import numpy as np,sys
from PIL import Image
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy')
c=np.stack([POS[...,0]/.96,(POS[...,1]-.7)/.7,POS[...,2]/2.6],-1)
flip=(NRM*c).sum(-1)<0;NRM[flip]*=-1;np.save('nrm.npy',NRM)
tex=np.array(Image.open(sys.argv[1]).convert('RGB').resize((4096,4096)))
ys,xs=np.nonzero(M);p=POS[ys,xs];n=NRM[ys,xs];col=tex[ys,xs]
S=200 # px per metre
def view(sel,u,v,depth,W,H,name):
    img=np.full((H,W,3),128,np.uint8);zb=np.full((H,W),-9.0)
    uu=(u[sel]*S+W/2).astype(int);vv=(H-v[sel]*S).astype(int);dd=depth[sel];cc=col[sel]
    o=np.argsort(dd);uu,vv,cc,dd=uu[o],vv[o],cc[o],dd[o]
    k=(uu>=0)&(uu<W)&(vv>=0)&(vv<H)
    img[vv[k],uu[k]]=cc[k]
    Image.fromarray(img).save(name)
x,y,z=p.T
view(n[:,0]>.3,-z,y,x,1100,320,'v_right.png')   # viewed from +x: front on left
view(n[:,0]<-.3,z,y,-x,1100,320,'v_left.png')
view(n[:,1]>.3,-z,x+1.05,y,1100,420,'v_top.png')
view(n[:,2]>.3,-x,y,z,420,320,'v_front.png')
view(n[:,2]<-.3,x,y,-z,420,320,'v_rear.png')
