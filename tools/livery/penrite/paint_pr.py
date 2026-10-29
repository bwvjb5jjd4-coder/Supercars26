# Grove Racing Penrite livery for the Falcon FG X body (both Grove cars share Ford_penrite).
# Run in a folder holding pos.npy/nrm.npy/mask.npy from ../pepsimax/posmap2.py (+ views.py once). Writes new_tex.png.
import numpy as np,math
from PIL import Image,ImageDraw
N=4096;LG='/home/claude/supercars26/tools/livery/logos/pr_'
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy')
ys,xs=np.nonzero(M);p=POS[ys,xs].astype(np.float64);n=NRM[ys,xs].astype(np.float64)
x,y,z=p.T;ax=np.abs(x)
nothood=~((xs>=320)&(xs<=1426)&(ys>=982)&(ys<=2288))
def hexc(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
BK=hexc('#17181c');OR=hexc('#f2501f');RD=hexc('#e3181d');BL=hexc('#1d52c2');AZ=hexc('#118ade');WH=hexc('#f3f4f6');GD=hexc('#f6be1e');FB=hexc('#163ea6')
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004
def edge(d):return ss(-E/2,E/2,d)
col=np.tile(BK,(len(x),1))
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c)[None,:]*a[:,None]
# ---------- nose: orange band across the bonnet's leading edge, swept back at the sides ----------
zn=2.16+0.08*(1-np.clip(ax/0.75,0,1)**2)
mix(OR,edge(z-zn)*edge(y-0.735)*(ax<0.78))
# lower front: blue lip band under the bumper
mix(BL,edge(0.255-y)*edge(y-0.16)*edge(z-2.05)*(ax<0.78))
# rear bumper: flag blue band (continues the side flags)
mix(FB,edge(0.48-y)*edge(-2.30-z)*edge(y-0.26)*(ax<0.80))
mix(WH,edge(0.495-y)*edge(y-0.48)*edge(-2.30-z)*(ax<0.80))
# wing blade black, endplates black
S=900.0
class Cv:
    def __init__(s,V,U,a0,a1,b0,b1,sel):
        s.V=np.array(V,float);s.V/=np.linalg.norm(s.V);s.U=np.array(U,float);s.U-=s.V*(s.U@s.V);s.U/=np.linalg.norm(s.U);s.R=np.cross(s.U,s.V)
        s.a0,s.a1,s.b0,s.b1=a0,a1,b0,b1;s.W=int((a1-a0)*S);s.H=int((b1-b0)*S)
        s.im=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.sel=sel
    def px(s,a,b):return ((a-s.a0)*S,(s.b1-b)*S)
    def put(s,logo,a,b,w,h=None,flip=False,rot=0):
        lg=Image.open(LG+logo+'.png').convert('RGBA') if isinstance(logo,str) else logo
        W=int(w*S);H=int(W*lg.height/lg.width) if h is None else int(h*S)
        lg=lg.resize((W,H),Image.LANCZOS)
        if rot:lg=lg.rotate(rot,Image.BICUBIC,expand=True)
        X,Y=s.px(a,b);s.im.alpha_composite(lg,(int(X-lg.width/2),int(Y-lg.height/2)))
    def poly(s,pts,c):
        big=Image.new('RGBA',(s.W*2,s.H*2),(0,0,0,0));ImageDraw.Draw(big).polygon([(2*u,2*v) for u,v in (s.px(a,b) for a,b in pts)],fill=c)
        s.im.alpha_composite(big.resize((s.W,s.H),Image.LANCZOS))
    def bez(s,pts,steps=48):
        (a0,b0),(a1,b1),(a2,b2)=pts;o=[]
        for i in range(steps+1):
            t=i/steps;o.append(((1-t)**2*a0+2*(1-t)*t*a1+t*t*a2,(1-t)**2*b0+2*(1-t)*t*b1+t*t*b2,
                                2*(1-t)*(a1-a0)+2*t*(a2-a1),2*(1-t)*(b1-b0)+2*t*(b2-b1),t))
        return o
    def swoosh(s,pts,w0,w1,c,off=0.0,ease=1.0):
        # tapered curved band along a quadratic bezier (width eased so ends are blade-like, not boxy)
        L=[];R=[]
        for a,b,da,db,t in s.bez(pts):
            l=math.hypot(da,db)+1e-9;w=(w0+(w1-w0)*t**ease)/2;nx,ny=-db/l,da/l
            L.append((a+nx*(w+off),b+ny*(w+off)));R.append((a-nx*(w-off),b-ny*(w-off)))
        s.poly(L+R[::-1],c)
    def leaves(s,a,b,size,c,ang=0):
        # one laurel sprig from the Penrite wreath: two curved, pointed leaves in a V with a darker midrib
        for side in (-1,1):
            th=math.radians(90+ang+side*36);L=[];R=[];M=[]
            for i in range(41):
                t=i/40;bend=side*0.10*size*math.sin(math.pi*t)
                cx=a+math.cos(th)*size*t-math.sin(th)*bend;cy=b+math.sin(th)*size*t+math.cos(th)*bend
                w=size*0.16*(math.sin(math.pi*t**0.8))**0.9
                L.append((cx-math.sin(th)*w,cy+math.cos(th)*w));R.append((cx+math.sin(th)*w,cy-math.cos(th)*w));M.append((cx,cy))
            s.poly(L+R[::-1],c)
            dk=tuple(int(v*0.78) for v in c[:3])+(255,)
            s.poly(M[3:34]+[(x_+math.sin(th)*size*0.012,y_-math.cos(th)*size*0.012) for x_,y_ in M[3:34][::-1]],dk)
    def flag(s,pts,w0,w1,ease=1.0,border=0.014,waves=2.4,steps=900):
        # the real 2:1 Australian flag wrapped along a tapered bezier band, hoist (Union Jack) at the wide end,
        # rippling: the cloth line waves and the folds get light/dark shading, white keyline round it
        from scipy.spatial import cKDTree
        B=s.bez(pts,steps);P=np.array([(a,b) for a,b,*_ in B]);T=np.array([o[4] for o in B])
        D=np.array([(o[2],o[3]) for o in B]);D/=np.linalg.norm(D,axis=1,keepdims=True);Nn=np.c_[-D[:,1],D[:,0]]
        Nn*=np.sign(Nn[:,1:2]+1e-9)                       # flag top always faces up, on both sides of the car
        arc=np.r_[0,np.cumsum(np.hypot(*np.diff(P,axis=0).T))]
        Wt=w0+(w1-w0)*T**ease;Wm=max(w0,w1);Lw=(arc[-1]-arc) if w1>w0 else arc
        pad=Wm/2+border+0.01
        Xa,Ya=s.px(P[:,0].min()-pad,P[:,1].max()+pad);Xb,Yb=s.px(P[:,0].max()+pad,P[:,1].min()-pad)
        X0,X1=max(int(Xa),0),min(int(Xb)+1,s.W);Y0,Y1=max(int(Ya),0),min(int(Yb)+1,s.H)
        xx,yy=np.meshgrid(np.arange(X0,X1),np.arange(Y0,Y1));A=s.a0+(xx+0.5)/S;Bv=s.b1-(yy+0.5)/S
        Q=np.c_[A.ravel(),Bv.ravel()];_,i=cKDTree(P).query(Q)
        sd=((Q-P[i])*Nn[i]).sum(1);half=Wt[i]/2
        u=Lw[i]/(2*Wm);ph=2*np.pi*u*waves
        v=0.5-sd/(2*np.maximum(half,1e-4))+0.05*np.sin(ph)
        Hf,Wf=FLAG.shape[:2]
        uu=np.clip(u,0,0.999)*(Wf-1);vv=np.clip(v,0,0.999)*(Hf-1)
        c=FLAG[vv.astype(int),uu.astype(int)].copy()
        c[u>=1]=FB                                         # beyond the flag: the field carries on
        sh=1+0.20*np.sin(ph+0.9)-0.10*np.abs(sd)/np.maximum(half,1e-4)
        c=np.clip(c*sh[:,None],0,255)
        inner=np.clip((half-np.abs(sd))*S+0.5,0,1);outer=np.clip((half+border*np.clip(Wt[i]/Wm*2,0.3,1)-np.abs(sd))*S+0.5,0,1)
        rgb=c*inner[:,None]+WH*(1-inner[:,None]);al=outer
        out=np.zeros((Y1-Y0,X1-X0,4));out[...,:3]=rgb.reshape(Y1-Y0,X1-X0,3);out[...,3]=al.reshape(Y1-Y0,X1-X0)*255
        s.im.alpha_composite(Image.fromarray(out.astype(np.uint8)),(X0,Y0))
    def apply(s):
        a=p@s.R;b=p@s.U;dn=n@s.V
        w=ss(0.22,0.42,dn)*s.sel
        X=(a-s.a0)*S-0.5;Y=(s.b1-b)*S-0.5
        k=(w>0)&(X>=0)&(Y>=0)&(X<s.W-1)&(Y<s.H-1)
        A=np.asarray(s.im,np.float64)
        X0=np.floor(X[k]).astype(int);Y0=np.floor(Y[k]).astype(int);fx=(X[k]-X0)[:,None];fy=(Y[k]-Y0)[:,None]
        Pm=A.copy();Pm[...,:3]*=Pm[...,3:4]/255
        smp=(Pm[Y0,X0]*(1-fx)*(1-fy)+Pm[Y0,X0+1]*fx*(1-fy)+Pm[Y0+1,X0]*(1-fx)*fy+Pm[Y0+1,X0+1]*fx*fy)
        al=smp[:,3]/255*w[k]
        rgb=np.where(smp[:,3:4]>0,smp[:,:3]/np.maximum(smp[:,3:4],1e-6)*255,0)
        global col
        col[k]=col[k]*(1-al[:,None])+rgb*al[:,None]
FLAG=np.asarray(Image.open(LG+'ausflag21.png').convert('RGB'),float)
_b=(FLAG[...,2]>80)&(FLAG[...,0]<60);FLAG[_b]=FB
def c4(v):return tuple(int(t) for t in v)+(255,)
C_OR,C_RD,C_BL,C_AZ,C_WH,C_GD=map(c4,(OR,RD,BL,AZ,WH,GD))
cvs=[]
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.3)&nothood)
    f=lambda zz:zz*(-sgn)
    F=lambda pts:[(f(a),b) for a,b in pts]
    # --- front guard: orange blade from the nose corner to the door, the flag rippling above it ---
    c.swoosh(F([(2.47,0.505),(1.95,0.625),(1.15,0.712)]),0.155,0.010,C_WH,ease=0.9)
    c.swoosh(F([(2.47,0.50),(1.95,0.618),(1.17,0.706)]),0.13,0.005,C_OR,ease=0.9)
    c.flag(F([(0.84,0.865),(1.40,0.805),(1.97,0.752)]),0.012,0.155,ease=1.3)
    # low front: orange wedge over a blue chin blade, MACK between
    c.swoosh(F([(2.46,0.36),(2.15,0.385),(1.88,0.47)]),0.09,0.008,C_OR)
    c.swoosh(F([(2.46,0.235),(2.18,0.24),(1.90,0.29)]),0.07,0.006,C_BL)
    # --- door top: orange block under the window line, raked rear edge ---
    c.poly(F([(0.70,0.935),(-0.10,0.955),(-0.40,0.785),(0.58,0.780)]),C_OR)
    # --- the flag sweeping from the rear door over the rear wheel to the tail ---
    c.flag(F([(-0.40,0.255),(-1.40,0.37),(-2.42,0.60)]),0.012,0.34,ease=0.85)
    # --- laurel sprigs from the Penrite wreath around the door script ---
    for zz,yy,sz,an in ((0.70,0.79,0.22,10),(-0.74,0.83,0.21,-8),(0.62,0.215,0.17,-8),(-0.92,0.255,0.15,8)):
        c.leaves(f(zz),yy,sz,C_GD,an*(-sgn))
    # --- SINCE 1926 red flag under the script ---
    c.poly(F([(0.05,0.365),(-0.80,0.375),(-0.74,0.285),(0.10,0.280)]),C_RD)
    c.put('since',f(-0.35),0.327,0.36)
    # --- hero script: the real Penrite wordmark in race yellow ---
    c.put('wordy',f(-0.09),0.57,1.80)
    # --- partners ---
    c.put('dunlop',f(2.10),0.585,0.26,rot=13*(-sgn))
    c.put('ppg',f(0.93),0.52,0.10)
    c.put('snapon',f(-1.58),0.815,0.44,rot=4*(-sgn))
    c.put('ford',f(-2.30),0.835,0.14)
    c.put('mack',f(2.12),0.30,0.26)
    c.put('autodesk',f(-0.55),1.315,0.34)
    cvs.append(c)
# ---- bonnet, read from the front ----
tf=Cv((0,1,0),(0,0,-1),-1.0,1.0,-2.7,2.7,(y>0.6)&(z>0.9))
tf.leaves(-0.62,-1.20,0.17,C_GD,30);tf.leaves(0.62,-1.20,0.17,C_GD,-30)
tf.leaves(-0.52,-2.02,0.14,C_GD,150);tf.leaves(0.52,-2.02,0.14,C_GD,-150)
tf.put('wordy',0,-1.62,1.30)
cvs.append(tf)
# nose: Ford oval on the orange band
fr=Cv((0,0,1),(0,1,0),-1.0,1.0,0,1.2,(z>2.0)&(y>0.70)&(y<0.86))
fr.put('ford',0,0.775,0.22)
cvs.append(fr)
# ---- roof, read from the back ----
tr=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>1.15)&(z>-1.3)&(z<0.7))
tr.put('snapon',0,0.38,0.80)
tr.put('wordy',0,-0.45,0.95)
cvs.append(tr)
# boot lid, read from the back
tb=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>0.8)&(y<1.07)&(z<-1.4)&(z>-2.35))
tb.put('wordy',0,-1.86,1.05)
cvs.append(tb)
# wing blade
wing=(z<-2.17)&(y>1.08)
wg=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,wing&(ax<0.8))
wg.put('wordy',0,-2.47,1.20)
cvs.append(wg)
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.6)&(z<-2.1)&(y>1.0))
    c.put('autodesk',(-2.45)*(-sgn),1.30,0.20);c.put('snapon',(-2.45)*(-sgn),1.20,0.20);cvs.append(c)
# rear face
rr=Cv((0,0,-1),(0,1,0),-1.0,1.0,0,1.3,(z<-2.2))
rr.put('emblem',0,0.74,0.18)
rr.put('ppg',-0.45,0.66,0.08);rr.put('snapon',0.45,0.66,0.26)
rr.put('dunlop',0,0.40,0.34)
cvs.append(rr)
# front corners (oblique): MACK on the bumper corners
for sgn in (-1,1):
    V=np.array([sgn*0.6,0,0.8]);U=np.array([0,1,0]);R=np.cross(U,V/np.linalg.norm(V))
    ref=np.array([sgn*0.70,0,2.25]);a0=ref@R
    c=Cv(V,U,a0-0.6,a0+0.6,0.1,1.0,(z>1.95)&(x*sgn>0.45)&nothood)
    cvs.append(c)
fl=Cv((0,0,1),(0,1,0),-1.0,1.0,0,1.0,(z>2.25)&(ax<0.6)&(y<0.5))
fl.put('snapon',0,0.385,0.40)
cvs.append(fl)
for c in cvs:c.apply()
out=np.zeros((N,N,3),np.float64);out[ys,xs]=col
filled=M.copy();o8=out.copy()
for it in range(24):
    acc=np.zeros_like(o8);cnt=np.zeros((N,N))
    for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
        sh=np.roll(np.roll(o8,dy,0),dx,1);sf=np.roll(np.roll(filled,dy,0),dx,1)
        acc+=sh*sf[...,None];cnt+=sf
    new=(~filled)&(cnt>0);o8[new]=acc[new]/cnt[new][:,None];filled|=new
o8[~filled]=BK
Image.fromarray(np.clip(o8+0.5,0,255).astype(np.uint8)).save('new_tex.png')
