import numpy as np,struct,gzip,sys
from PIL import Image
def q565(c):
    r=np.clip(np.rint(c[...,0]*31/255),0,31).astype(np.int64);g=np.clip(np.rint(c[...,1]*63/255),0,63).astype(np.int64);b=np.clip(np.rint(c[...,2]*31/255),0,31).astype(np.int64)
    return (r<<11)|(g<<5)|b
def d565(v):
    r=(v>>11)&31;g=(v>>5)&63;b=v&31
    return np.stack([(r<<3)|(r>>2),(g<<2)|(g>>4),(b<<3)|(b>>2)],-1).astype(np.float64)
W8=np.array([0.299,0.587,0.114])*3
def enc(img):
    H,W,_=img.shape;bh,bw=max(1,H//4),max(1,W//4)
    if H<4 or W<4:
        t=np.zeros((4,4,3));t[:H,:W]=img;t[H:,:]=t[H-1:H,:] if H<4 else t[H:,:];t[:,W:]=t[:,W-1:W] if W<4 else t[:,W:];img=t;H=W=4
    B=img.reshape(bh,4,bw,4,3).transpose(0,2,1,3,4).reshape(-1,16,3).astype(np.float64)
    m=B.mean(1,keepdims=True);D=B-m
    cov=np.einsum('nki,nkj->nij',D*W8,D*W8)
    ax=np.ones((len(B),3))/np.sqrt(3)
    for _ in range(6):
        ax=np.einsum('nij,nj->ni',cov,ax);ax/=np.linalg.norm(ax,axis=1,keepdims=True)+1e-12
    ax/=W8
    t=np.einsum('nki,ni->nk',D,ax)/np.maximum((ax*ax).sum(1),1e-12)[:,None]
    e0=m[:,0]+t.max(1)[:,None]*ax;e1=m[:,0]+t.min(1)[:,None]*ax
    best_err=np.full(len(B),np.inf);best=None
    A4=np.array([1,0,2/3,1/3])
    for it in range(4):
        c0=q565(e0);c1=q565(e1)
        p0=d565(c0);p1=d565(c1)
        pal=np.stack([p0,p1,(2*p0+p1)/3,(p0+2*p1)/3],1)
        dist=(((B[:,:,None,:]-pal[:,None,:,:])*W8)**2).sum(-1)
        idx=dist.argmin(2);err=dist.min(2).sum(1)
        better=err<best_err
        if best is None:best=[c0.copy(),c1.copy(),idx.copy()]
        else:
            best[0][better]=c0[better];best[1][better]=c1[better];best[2][better]=idx[better]
        best_err=np.minimum(err,best_err)
        a=A4[idx];b=1-a
        aa=(a*a).sum(1);bb=(b*b).sum(1);ab=(a*b).sum(1)
        ac=np.einsum('nk,nki->ni',a,B);bc=np.einsum('nk,nki->ni',b,B)
        det=aa*bb-ab*ab;ok=np.abs(det)>1e-9;det[~ok]=1
        ne0=(bb[:,None]*ac-ab[:,None]*bc)/det[:,None];ne1=(aa[:,None]*bc-ab[:,None]*ac)/det[:,None]
        e0=np.where(ok[:,None],np.clip(ne0,0,255),e0);e1=np.where(ok[:,None],np.clip(ne1,0,255),e1)
    c0,c1,idx=best
    sw=c0<c1
    c0s=np.where(sw,c1,c0);c1s=np.where(sw,c0,c1)
    remap=np.array([1,0,3,2]);idx=np.where(sw[:,None],remap[idx],idx)
    eq=c0s==c1s;idx[eq]=0
    bits=(idx.astype(np.uint64)<<(2*np.arange(16,dtype=np.uint64))).sum(1).astype(np.uint32)
    out=np.zeros(len(B),dtype=[('a','<u2'),('b','<u2'),('i','<u4')])
    out['a']=c0s;out['b']=c1s;out['i']=bits
    return out.tobytes()
def build(png,dst,webp):
    im=Image.open(png).convert('RGB');a=np.asarray(im,np.float64)
    hdr=gzip.open('/home/claude/supercars26/assets/liveries/Holden_boost.dds.gz.bin').read(128)  # any 4096 DXT1 livery has the same header
    data=[hdr];lv=a
    for i in range(13):
        data.append(enc(lv));print(i,lv.shape,flush=True)
        if lv.shape[0]>1:lv=lv.reshape(lv.shape[0]//2,2,lv.shape[1]//2,2,3).mean((1,3))
    raw=b''.join(data);print(len(raw))
    open(dst,'wb').write(gzip.compress(raw,9))
    im.resize((2048,2048),Image.LANCZOS).save(webp,'WEBP',quality=92,method=6)
if __name__=='__main__':build(*sys.argv[1:4])
