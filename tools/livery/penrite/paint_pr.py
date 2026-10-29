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
BK=hexc('#17181c');OR=hexc('#f2501f');RD=hexc('#e3181d');BL=hexc('#1d52c2');AZ=hexc('#118ade');WH=hexc('#f3f4f6');GD=hexc('#f2bd2c')
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004
def edge(d):return ss(-E/2,E/2,d)
col=np.tile(BK,(len(x),1))
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c)[None,:]*a[:,None]
# ---------- nose: orange band over the bonnet lip and above the grille, swept back at the sides ----------
zn=2.12+0.10*(1-np.clip(ax/0.78,0,1)**2)
mix(OR,edge(z-zn)*edge(y-0.70)*(ax<0.80))
mix(WH,edge(zn-z)*edge(z-(zn-0.022))*edge(y-0.70)*(ax<0.62))
# lower front: blue lip band under the bumper, white keyline above it
mix(BL,edge(0.27-y)*edge(y-0.16)*edge(z-2.05)*(ax<0.78))
mix(WH,edge(0.30-y)*edge(y-0.27)*edge(z-2.05)*(ax<0.76))
# rear: blue bumper band with white keyline (continues the side band)
mix(BL,edge(0.50-y)*edge(-2.30-z)*edge(y-0.26)*(ax<0.80))
mix(WH,edge(0.53-y)*edge(y-0.50)*edge(-2.30-z)*(ax<0.80))
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
        # one laurel sprig from the Penrite wreath: two pointed leaves in a V plus the berry
        for side in (-1,1):
            th=math.radians(90+ang+side*40);L=[];R=[]
            for i in range(25):
                t=i/24;cx=a+math.cos(th)*size*t;cy=b+math.sin(th)*size*t;w=size*0.17*math.sin(math.pi*t)**0.75
                L.append((cx-math.sin(th)*w,cy+math.cos(th)*w));R.append((cx+math.sin(th)*w,cy-math.cos(th)*w))
            s.poly(L+R[::-1],c)
        r=size*0.09;th=math.radians(ang-90)
        s.poly([(a+math.cos(th)*size*0.18+r*math.cos(k*math.pi/8),b+math.sin(th)*size*0.18+r*math.sin(k*math.pi/8)) for k in range(16)],c)
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
def c4(v):return tuple(int(t) for t in v)+(255,)
C_OR,C_RD,C_BL,C_AZ,C_WH,C_GD=map(c4,(OR,RD,BL,AZ,WH,GD))
cvs=[]
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.3)&nothood)
    f=lambda zz:zz*(-sgn)
    F=lambda pts:[(f(a),b) for a,b in pts]
    # --- front fender: azure blade over the arch, orange blade under it, white keyline between ---
    c.swoosh(F([(2.42,0.66),(1.55,0.84),(0.70,0.90)]),0.13,0.008,C_AZ,ease=0.8)
    c.swoosh(F([(2.40,0.50),(1.45,0.735),(0.58,0.835)]),0.15,0.010,C_WH,ease=0.9)
    c.swoosh(F([(2.40,0.495),(1.45,0.725),(0.60,0.825)]),0.125,0.006,C_OR,ease=0.9)
    # low front wedge: orange rising into the arch, blue under it
    c.swoosh(F([(2.45,0.34),(2.15,0.37),(1.88,0.47)]),0.10,0.01,C_OR)
    c.swoosh(F([(2.46,0.255),(2.20,0.255),(1.90,0.30)]),0.075,0.008,C_BL)
    # --- door top: orange block under the window line, raked rear edge ---
    c.poly(F([(0.66,0.935),(-0.12,0.955),(-0.40,0.795),(0.54,0.790)]),C_OR)
    # --- royal-blue blade from the rear door sweeping over the rear arch to the tail ---
    c.swoosh(F([(-0.30,0.262),(-1.35,0.36),(-2.50,0.66)]),0.008,0.20,C_WH,ease=0.8)
    c.swoosh(F([(-0.32,0.262),(-1.35,0.355),(-2.50,0.655)]),0.004,0.17,C_BL,ease=0.8)
    # --- white lower rear sill with raked front edge ---
    c.poly(F([(-0.30,0.150),(-0.42,0.235),(-1.06,0.272),(-1.06,0.150)]),C_WH)
    # --- C-pillar: orange sail-panel flash around the rear quarter glass ---
    # --- Australian flag elements ---
    c.put('unionjack',f(-2.10),0.745,0.23)
    c.put('unionjack',f(1.80),0.765,0.20)
    star=Image.open(LG+'ausflag.png').convert('RGBA');Wf,Hf=star.size
    cs=star.crop((int(Wf*0.12),int(Hf*0.66),int(Wf*0.30),int(Hf*0.90)))     # Commonwealth star from the real flag
    a_=np.asarray(cs,float);al=np.clip((a_[...,:3].min(-1)-120)/100,0,1)*255
    cs=Image.fromarray(np.dstack([np.full(al.shape+(3,),255),al]).astype(np.uint8));cs=cs.crop(cs.getbbox())
    for zz,yy,sz in ((-0.62,0.290,0.042),(-1.98,0.555,0.06),(-2.30,0.62,0.04),(1.30,0.835,0.045)):c.put(cs,f(zz),yy,sz)
    # --- laurel sprigs from the Penrite wreath around the door script ---
    for zz,yy,sz,an in ((0.68,0.795,0.19,8),(-0.74,0.835,0.18,-6),(0.58,0.235,0.15,-6),(-0.88,0.27,0.13,6)):
        c.leaves(f(zz),yy,sz,C_GD,an*(-sgn))
    # --- SINCE 1926 red flag under the script ---
    c.poly(F([(0.05,0.365),(-0.80,0.375),(-0.74,0.285),(0.10,0.280)]),C_RD)
    c.put('since',f(-0.35),0.327,0.36)
    # --- hero script: the real Penrite wordmark ---
    c.put('word',f(-0.09),0.565,1.76)
    # --- partners ---
    c.put('dunlop',f(1.12),0.745,0.40,rot=8.0*(-sgn))
    c.put('ppg',f(0.91),0.53,0.085)
    c.put('ford',f(-2.30),0.38,0.15)
    c.put('autodesk',f(-0.55),1.315,0.34)
    cvs.append(c)
# ---- bonnet, read from the front ----
tf=Cv((0,1,0),(0,0,-1),-1.0,1.0,-2.7,2.7,(y>0.6)&(z>0.9))
tf.leaves(-0.62,-1.20,0.17,C_GD,30);tf.leaves(0.62,-1.20,0.17,C_GD,-30)
tf.leaves(-0.52,-2.02,0.14,C_GD,150);tf.leaves(0.52,-2.02,0.14,C_GD,-150)
tf.put('word',0,-1.62,1.30)
cvs.append(tf)
# nose: Ford oval on the orange band
fr=Cv((0,0,1),(0,1,0),-1.0,1.0,0,1.2,(z>2.0)&(y>0.66)&(y<0.86))
fr.put('ford',0,0.755,0.26)
cvs.append(fr)
# ---- roof, read from the back ----
tr=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>1.15)&(z>-1.3)&(z<0.7))
tr.put('snapon',0,0.38,0.80)
tr.put('word',0,-0.45,0.95)
cvs.append(tr)
# boot lid, read from the back
tb=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>0.8)&(y<1.07)&(z<-1.4)&(z>-2.35))
tb.put('word',0,-1.86,1.05)
cvs.append(tb)
# wing blade
wing=(z<-2.17)&(y>1.08)
wg=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,wing&(ax<0.8))
wg.put('word',0,-2.47,1.20)
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
    c.put('mack',a0,0.355,0.26)
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
