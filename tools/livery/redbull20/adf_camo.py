# ADF livery: lay Auscam (DPCU-style) camo into the navy areas of the 2020 Red Bull design.
# Run in the posmap folder after painting twice:
#   RB_SCHEME=adf RB_NAVY=#000000 RB_OUT=adf_b.png python3 paint_rb20.py
#   RB_SCHEME=adf RB_NAVY=#ffffff RB_OUT=adf_w.png python3 paint_rb20.py
#   python3 adf_camo.py            -> adf_tex.png
# The two renders differ only where navy shows, by exactly (navy coverage)*255, so the camo goes in with the same
# anti-aliasing as the navy had (logo edges, shard edges). The pattern is a 3D field sampled at each texel's car-space
# position, so it runs on unbroken across panel seams and UV islands.
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter,map_coordinates,distance_transform_edt
B=np.asarray(Image.open('adf_b.png').convert('RGB'),np.float32)
Wt=np.asarray(Image.open('adf_w.png').convert('RGB'),np.float32)
cov=np.clip((Wt-B).mean(2)/255.0,0,1)
POS=np.load('pos.npy').astype(np.float32);M=np.load('mask.npy')
N=M.shape[0]
# fill positions of unmasked (dilated) texels from their nearest masked texel so the camo continues into the gutters
idx=distance_transform_edt(~M,return_distances=False,return_indices=True)
P=POS[idx[0],idx[1]]
rng=np.random.default_rng(1915)   # Gallipoli
H=0.02;lo=np.array([-1.2,-0.2,-3.3],np.float32);shape=(121,96,331)
def field(sig_m,seed):
    g=np.random.default_rng(seed).standard_normal(shape).astype(np.float32)
    g=gaussian_filter(g,sig_m/H,mode='wrap');return g/g.std()
def sample(f,Q):
    c=((Q-lo)/H).reshape(-1,3).T
    return map_coordinates(f,c,order=1,mode='nearest').reshape(Q.shape[:2])
Q=P.copy()
# domain warp: bends blob outlines into the ragged, leafy edges of Auscam
wx=field(0.10,11);wy=field(0.10,12);wz=field(0.10,13)
Q[...,0]+=0.035*sample(wx,P);Q[...,1]+=0.035*sample(wy,P);Q[...,2]+=0.035*sample(wz,P)
def layer(seed,big,small):
    a=field(big,seed);b=field(small,seed+100)
    return sample(a,Q)*0.8+sample(b,Q)*0.45
# Auscam colours: light green base, khaki, mid green, red-brown, near-black
BASE=np.array([141,143,96],np.float32);KHAKI=np.array([196,178,134],np.float32);GREEN=np.array([86,100,54],np.float32)
BROWN=np.array([110,74,46],np.float32);DARK=np.array([42,49,35],np.float32)
camo=np.empty((N,N,3),np.float32);camo[:]=BASE
def put(c,f,t):
    a=np.clip((f-t)/0.06+0.5,0,1)[...,None]
    global camo;camo=camo*(1-a)+c*a
put(KHAKI,layer(21,0.13,0.045),0.55)
put(GREEN,layer(22,0.12,0.04),0.35)
put(BROWN,layer(23,0.11,0.035),0.95)
put(DARK,layer(24,0.07,0.03),1.35)
out=B+cov[...,None]*camo
Image.fromarray(np.clip(out+0.5,0,255).astype(np.uint8)).save('adf_tex.png')
print('ok cover',float(cov[M].mean()))
