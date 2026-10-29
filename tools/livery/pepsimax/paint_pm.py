import numpy as np
from PIL import Image,ImageDraw
N=4096;LG='logos/'
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy')
ys,xs=np.nonzero(M);p=POS[ys,xs].astype(np.float64);n=NRM[ys,xs].astype(np.float64)
x,y,z=p.T;ax=np.abs(x)
nothood=~((xs>=320)&(xs<=1426)&(ys>=982)&(ys<=2288))
def hexc(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
BK=hexc('#12151e');LB=hexc('#2ba3dc');GRN=hexc('#0b9a4a');WH=hexc('#f4f5f7');RD=hexc('#e01a2d');YL=hexc('#f6c500');DB=hexc('#1560b8')
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004
def edge(d):return ss(-E/2,E/2,d)
col=np.tile(BK,(len(x),1))
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c)[None,:]*a[:,None]
# roof + upper glasshouse frame light blue
mix(LB,edge(y-0.97)*edge(z+1.70)*edge(1.10-z))   # roof, pillars and window frames
# rear: blue tail (behind a line rising from the rear arch to the tail lamp)
zr=-1.78-0.45*np.clip(y-0.3,0,1)
mix(LB,edge(zr-z)*edge(0.93-y))
mix(LB,edge(-2.28-z))            # rear face
mix(BK,edge(y-0.93)*edge(-1.7-z)*edge(z+2.30)*edge(1.12-y))   # boot lid black
# front: lower bumper + front lower corners blue
mix(LB,edge(0.37-y)*edge(z-1.92))
mix(LB,edge(0.45-y)*edge(z-2.22))
mix(LB,edge(0.43-y)*edge(z-2.05)*(ax>0.55))
# sills
mix(LB,edge(0.19-y)*(ax>0.8))
# Castrol green nose: bonnet front + upper bumper above grille
zg=1.86+0.10*np.clip(ax/0.8,0,1)
mix(GRN,edge(z-zg)*edge(y-0.52))
mix(WH,edge(zg-z)*edge(z-(zg-0.025))*edge(y-0.52))
mix(RD,edge((zg-0.045)-z)*edge(z-(zg-0.10))*edge(y-0.60))
mix(DB,edge((zg-0.12)-z)*edge(z-(zg-0.16))*edge(y-0.66))
# wing: black blade, blue endplates
wing=(z<-2.17)&(y>1.08)
col[wing&(ax<0.70)]=BK;col[wing&(ax>=0.70)]=LB
S=800.0
class Cv:
    def __init__(s,V,U,a0,a1,b0,b1,sel):
        s.V=np.array(V,float);s.V/=np.linalg.norm(s.V);s.U=np.array(U,float);s.R=np.cross(s.U,s.V)
        s.a0,s.a1,s.b0,s.b1=a0,a1,b0,b1;s.W=int((a1-a0)*S);s.H=int((b1-b0)*S)
        s.im=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.sel=sel
    def px(s,a,b):return ((a-s.a0)*S,(s.b1-b)*S)
    def put(s,logo,a,b,w,h=None,flip=False):
        lg=Image.open(LG+logo+'.png').convert('RGBA') if isinstance(logo,str) else logo
        if flip:lg=lg.transpose(Image.FLIP_LEFT_RIGHT)
        W=int(w*S);H=int(W*lg.height/lg.width) if h is None else int(h*S)
        lg=lg.resize((W,H),Image.LANCZOS);X,Y=s.px(a,b);s.im.alpha_composite(lg,(int(X-W/2),int(Y-H/2)))
    def poly(s,pts,c):
        big=Image.new('RGBA',(s.W,s.H),(0,0,0,0));ImageDraw.Draw(big).polygon([s.px(a,b) for a,b in pts],fill=c);s.im.alpha_composite(big)
    def swoosh(s,pts,w0,w1,c,steps=40):
        # tapered curved band along a quadratic bezier
        (a0,b0),(a1,b1),(a2,b2)=pts;L=[];R=[]
        for i in range(steps+1):
            t=i/steps;a=(1-t)**2*a0+2*(1-t)*t*a1+t*t*a2;b=(1-t)**2*b0+2*(1-t)*t*b1+t*t*b2
            da=2*(1-t)*(a1-a0)+2*t*(a2-a1);db=2*(1-t)*(b1-b0)+2*t*(b2-b1);l=np.hypot(da,db)+1e-9;w=(w0+(w1-w0)*t)/2
            L.append((a-db/l*w,b+da/l*w));R.append((a+db/l*w,b-da/l*w))
        s.poly(L+R[::-1],c)
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
C_LB=(43,163,220,255);C_RD=(224,26,45,255);C_YL=(246,197,0,255);C_DB=(21,96,184,255);C_WH=(244,245,247,255)
cvs=[]
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.3)&nothood)
    f=lambda zz:zz*(-sgn)
    # body swooshes: blue + red sweep from front fender back under the MAX, yellow + blue over rear quarter
    c.swoosh([(f(2.05),0.62),(f(1.0),0.30),(f(-0.9),0.27)],0.055,0.006,C_LB)
    c.swoosh([(f(1.95),0.70),(f(1.2),0.47),(f(0.2),0.30)],0.03,0.004,C_RD)
    c.swoosh([(f(1.75),0.80),(f(1.3),0.76),(f(0.85),0.74)],0.035,0.004,C_LB)
    c.swoosh([(f(-0.85),0.36),(f(-1.25),0.60),(f(-2.05),0.64)],0.004,0.05,C_LB)
    c.swoosh([(f(-1.15),0.56),(f(-1.5),0.66),(f(-2.05),0.71)],0.004,0.035,C_YL)
    c.swoosh([(f(-1.0),0.86),(f(-1.5),0.84),(f(-1.95),0.88)],0.004,0.03,C_LB)
    # hero graphics
    c.put('globe',f(0.86),0.50,0.50)
    c.put('max_r',f(-0.08),0.56,1.36,h=0.52)
    c.put('allgate',f(0.50),0.868,0.20)
    c.put('ford',f(0.62),0.235,0.17)
    c.put('revolution',f(-0.55),0.225,0.30)
    c.put('ihear',f(0.05),0.225,0.14)
    # front fender / bumper corner
    c.put('supashock',f(1.38),0.78,0.50)
    c.put('skye',f(1.52),0.86,0.34)
    c.put('orrcon',f(2.05),0.64,0.34)
    # rear quarter
    c.put('orrcon',f(-1.55),0.79,0.44)
    c.put('wawaste',f(-2.0),0.58,0.30)
    c.put('westrac',f(-2.0),0.38,0.13)
    c.put('dunlop',f(-0.95),0.24,0.08)
    cvs.append(c)
# ---- top, read from the nose ----
tf=Cv((0,1,0),(0,0,-1),-1.0,1.0,-2.7,2.7,(y>0.6))
tf.put('castrol_box',0,-2.12,0.98)
tf.put('globe',-0.47,-1.38,0.30)
tf.put('max_s',0.05,-1.36,0.72,h=0.27)
tf.put('pepsi_w',-0.16,-1.58,0.20)
tf.put('ford',0,-1.17,0.22)
# roof: dark strip at the windscreen header with the slogan, big MAX on roof

cvs.append(tf)
tr=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>0.6))
tr.put('globe_pepsimax',0,-2.12,0.72)
tr.put('globe_pepsimax',0,-0.30,0.95)   # roof, read from the back

cvs.append(tr)
wg=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,wing)
wg.put('mightymite',0,-2.40,1.15)
cvs.append(wg)
# rear face
rr=Cv((0,0,-1),(0,1,0),-1.0,1.0,0,1.3,(z<-2.2))
rr.put('elite',0,0.50,1.20)
rr.put('tsw',0.30,0.72,0.20);rr.put('apex',-0.25,0.72,0.20)
rr.put('ppg',-0.52,0.62,0.12);rr.put('castrol',0.55,0.62,0.18)

cvs.append(rr)
# wing endplates TEAC
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.6)&(z<-2.1)&(y>1.0))
    c.put('teac',(-2.38)*(-sgn),1.21,0.18);cvs.append(c)
# front corners (oblique): pepsi MAX + globe, OurAuto on lower front
for sgn in (-1,1):
    V=np.array([sgn*0.6,0,0.8]);U=np.array([0,1,0]);R=np.cross(U,V/np.linalg.norm(V))
    ref=np.array([sgn*0.62,0,2.32]);a0=ref@R
    c=Cv(V,U,a0-0.6,a0+0.6,0.1,1.0,(z>1.9)&(x*sgn>0.3)&nothood)
    c.put('globe_pepsimax',a0,0.47,0.36)
    cvs.append(c)
fr=Cv((0,0,1),(0,1,0),-1.0,1.0,0,1.0,(z>2.25)&(ax<0.55))
fr.put('ourauto',0,0.385,0.46)
cvs.append(fr)
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
