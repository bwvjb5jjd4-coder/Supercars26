# 2020 Red Bull Holden Racing Team ZB Commodore (#88 / #888 share Holden_redbull).
# Run in a folder holding pos.npy/nrm.npy/mask.npy/hood.npy from posmap_s.py (smooth outward normals; don't run views.py after it). Writes new_tex.png.
# Design is drawn as vector shapes in flat views (metres, car coords: x left+, y up, z forward) and baked through the posmap.
import numpy as np,math
from PIL import Image,ImageDraw
N=4096;LG='/home/claude/supercars26/tools/livery/logos/rb_';IMG='/home/claude/supercars26/assets/img/'
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy');HOOD=np.load('hood.npy')
ys,xs=np.nonzero(M);p=POS[ys,xs].astype(np.float64);n=NRM[ys,xs].astype(np.float64)
x,y,z=p.T;ax=np.abs(x);nothood=~HOOD[ys,xs]
def hexc(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
NAVY=hexc('#1b1a55');ROYAL=hexc('#2b3ea6');MID=hexc('#4166cc');LIGHT=hexc('#86a8e8');PALE=hexc('#c9d8f4')
WHITE=hexc('#f3f4f6');RED=hexc('#d6203a');YEL=hexc('#fcc800');INK=hexc('#121316');WINGB=hexc('#111216')
def c4(v):return tuple(int(t) for t in v)+(255,)
C_NAVY,C_ROYAL,C_MID,C_LIGHT,C_PALE,C_WHITE,C_YEL=map(c4,(NAVY,ROYAL,MID,LIGHT,PALE,WHITE,YEL))
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004
def edge(d):return ss(-E/2,E/2,d)
col=np.tile(NAVY,(len(x),1))
wing0=(z<-1.98)&(y>1.12)
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c)[None,:]*a[:,None]
# ---------- 3D base rules ----------
# white roof panel with a royal keyline where it meets the navy pillars
mix(ROYAL,edge(0.695-ax)*edge(y-1.14))
mix(WHITE,edge(0.675-ax)*edge(y-1.15))
S=1000.0
OWNER=None
class Cv:
    def __init__(s,V,U,a0,a1,b0,b1,sel):
        s.V=np.array(V,float);s.V/=np.linalg.norm(s.V);s.U=np.array(U,float);s.U-=s.V*(s.U@s.V);s.U/=np.linalg.norm(s.U);s.R=np.cross(s.U,s.V)
        s.a0,s.a1,s.b0,s.b1=a0,a1,b0,b1;s.W=int((a1-a0)*S);s.H=int((b1-b0)*S)
        s.im=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.lg=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.sel=sel;s.logo_only=False
    def px(s,a,b):return ((a-s.a0)*S,(s.b1-b)*S)
    def put(s,logo,a,b,w,h=None,flip=False,rot=0):
        lg=Image.open(LG+logo+'.png').convert('RGBA') if isinstance(logo,str) else logo
        if flip:lg=lg.transpose(Image.FLIP_LEFT_RIGHT)
        W=int(w*S);H=int(W*lg.height/lg.width) if h is None else int(h*S)
        lg=lg.resize((W,H),Image.LANCZOS)
        if rot:lg=lg.rotate(rot,Image.BICUBIC,expand=True)
        X,Y=s.px(a,b);s.lg.alpha_composite(lg,(int(round(X-lg.width/2)),int(round(Y-lg.height/2))))
    def poly(s,pts,c,k=4):
        # anti-aliased polygon: drawn at k x inside its own bounding box, then filtered down
        P=[s.px(a,b) for a,b in pts];X0=max(int(min(q[0] for q in P))-2,0);Y0=max(int(min(q[1] for q in P))-2,0)
        X1=min(int(max(q[0] for q in P))+3,s.W);Y1=min(int(max(q[1] for q in P))+3,s.H)
        if X1<=X0 or Y1<=Y0:return
        big=Image.new('RGBA',((X1-X0)*k,(Y1-Y0)*k),c[:3]+(0,))
        ImageDraw.Draw(big).polygon([((u-X0)*k,(v-Y0)*k) for u,v in P],fill=c)
        s.im.alpha_composite(big.resize((X1-X0,Y1-Y0),Image.BOX),(X0,Y0))
    def circle(s,a,b,r,c,steps=180):
        s.poly([(a+r*math.cos(t*2*math.pi/steps),b+r*math.sin(t*2*math.pi/steps)) for t in range(steps)],c)
    def apply(s,layer=None):
        a=p@s.R;b=p@s.U;dn=n@s.V
        w=(OWNER==id(s)) if OWNER is not None else ss(0.28,0.36,dn)*s.sel   # each texel is painted by the one view facing it best: crisp seams, logos never half-faded
        X=(a-s.a0)*S-0.5;Y=(s.b1-b)*S-0.5
        k=(w>0)&(X>=0)&(Y>=0)&(X<s.W-1)&(Y<s.H-1)
        A=np.asarray(s.im if layer is None else layer,np.float32)
        X0=np.floor(X[k]).astype(int);Y0=np.floor(Y[k]).astype(int);fx=(X[k]-X0)[:,None];fy=(Y[k]-Y0)[:,None]
        Pm=A.copy();Pm[...,:3]*=Pm[...,3:4]/255
        smp=(Pm[Y0,X0]*(1-fx)*(1-fy)+Pm[Y0,X0+1]*fx*(1-fy)+Pm[Y0+1,X0]*(1-fx)*fy+Pm[Y0+1,X0+1]*fx*fy)
        al=smp[:,3]/255*w[k]
        rgb=np.where(smp[:,3:4]>0,smp[:,:3]/np.maximum(smp[:,3:4],1e-6)*255,0)
        global col
        col[k]=col[k]*(1-al[:,None])+rgb*al[:,None]
def logo(f):return Image.open(LG+f+'.png').convert('RGBA')
def crop(im):return im.crop(im.getbbox())
def recol(im,c):o=Image.new('RGBA',im.size,tuple(c)+(255,));o.putalpha(im.split()[3]);return o
def row(parts,gap):
    # lay images side by side, vertically centred
    H=max(i.height for i in parts);W=sum(i.width for i in parts)+gap*(len(parts)-1);o=Image.new('RGBA',(W,H),(0,0,0,0));X=0
    for i in parts:o.alpha_composite(i,(X,(H-i.height)//2));X+=i.width+gap
    return o
# mtaa super on one line (the sill / endplate version)
mt=logo('mtaa_w');mtaa=crop(mt.crop((0,0,583,214)));sup=crop(mt.crop((0,214,583,mt.height)));disc=crop(mt.crop((583,0,mt.width,mt.height)))
base=int(sup.height*0.80)          # baseline of 'super' (the p hangs below)
d2=disc.resize((int(disc.width*mtaa.height*1.05/disc.height),int(mtaa.height*1.05)),Image.LANCZOS)
H=max(mtaa.height,base)+ (sup.height-base);mtaa1=Image.new('RGBA',(mtaa.width+sup.width+d2.width+140,H+40),(0,0,0,0))
top=max(mtaa.height,base)
mtaa1.alpha_composite(mtaa,(0,top-mtaa.height));mtaa1.alpha_composite(sup,(mtaa.width+60,top-base));mtaa1.alpha_composite(d2,(mtaa.width+sup.width+120,top-d2.height+10))
mtaa1=crop(mtaa1)
mtaa1.save('mtaa1.png')
cal=logo('caltex');A=np.asarray(cal)[...,3]>0;cc=A.any(0);cut=[i for i in range(1,len(cc)) if cc[i]!=cc[i-1]][0]
hall=crop(cal.crop((0,0,cut,cal.height)));cword=crop(cal.crop((cut,0,cal.width,cal.height)))
cal_L=row([cword,hall.resize((int(hall.width*0.92),int(hall.height*0.92)),Image.LANCZOS)],int(hall.width*0.22))   # hallmark inboard
cal_R=row([hall.resize((int(hall.width*0.92),int(hall.height*0.92)),Image.LANCZOS),cword],int(hall.width*0.22))
# bull charging into a sun (rear corners)
bull=logo('bull');sun=logo('sun')
D=int(bull.height*1.05);bs=Image.new('RGBA',(int(bull.width*1.05)+D//3,D+20),(0,0,0,0))
bs.alpha_composite(sun.resize((D,D),Image.LANCZOS),(int(bull.width*0.70)-D//2+D//3,0))
bs.alpha_composite(bull,(0,bs.height-bull.height));bs=crop(bs)

cvs=[]
# ================= sides =================
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.8,2.8,0.0,1.6,(x*sgn>0.3)&nothood&~((z<-1.98)&(y>1.12)))
    f=lambda zz:zz*(-sgn)
    F=lambda pts:[(f(a),b) for a,b in pts]
    flip=(sgn>0)
    # --- front guard: white, royal/light shards along the top, sill navy ---
    c.poly(F([(2.85,0.05),(2.85,0.60),(2.50,0.635),(2.15,0.69),(1.80,0.745),(1.45,0.785),(1.15,0.80),(1.15,0.05)]),C_WHITE)
    # royal band: carries the IVECO lozenge round the nose corner, then sweeps up the guard to meet the royal bonnet edges
    band=[(2.85,0.455),(2.55,0.462),(2.32,0.49),(2.12,0.585),(1.85,0.685),(1.55,0.745),(1.30,0.785),(1.15,0.80),(1.15,1.6),(2.85,1.6)]
    c.poly(F(band),C_ROYAL)
    c.poly(F([(2.85,0.455),(2.55,0.462),(2.32,0.49),(2.12,0.585),(1.85,0.685),(1.55,0.745),(1.30,0.785),(1.15,0.80),
              (1.15,0.775),(1.40,0.752),(1.70,0.705),(2.00,0.60),(2.25,0.490),(2.55,0.468),(2.85,0.468)]),C_LIGHT)
    c.poly(F([(2.85,0.05),(2.85,0.13),(2.05,0.145),(1.15,0.16),(1.15,0.05)]),C_NAVY)
    c.poly(F([(2.85,0.13),(2.40,0.14),(2.85,0.155)]),C_LIGHT)
    # --- navy doors; a round sun behind the bull's shoulders (as in the Red Bull mark) ---
    c.poly(F([(1.45,1.6),(1.40,0.80),(1.02,0.16),(1.0,0.0),(-0.30,0.0),(-0.30,1.6)]),C_NAVY)
    # the door's leading edge rakes forward into the white guard: royal and light blades ahead of it
    c.poly(F([(1.55,0.79),(1.40,0.80),(1.02,0.16),(1.12,0.16)]),C_ROYAL)
    c.poly(F([(1.63,0.783),(1.58,0.787),(1.15,0.16),(1.19,0.16)]),C_LIGHT)
    c.circle(f(0.80),0.605,0.31,C_YEL)
    # lighter facets on the doors (the 2020 'fragment' pattern)
    c.poly(F([(0.95,0.95),(0.62,0.95),(0.80,0.86)]),C_ROYAL)
    c.poly(F([(0.40,0.95),(0.05,0.95),(0.18,0.84)]),C_ROYAL)
    c.poly(F([(0.86,0.22),(0.40,0.15),(0.86,0.12)]),C_ROYAL)
    c.poly(F([(0.86,0.16),(0.62,0.13),(0.86,0.11)]),C_LIGHT)
    # --- rear door / quarter: white, navy mountains rising under HOLDEN ---
    c.poly(F([(0.13,1.6),(0.12,1.0),(-2.85,1.0),(-2.85,1.6)]),C_WHITE)
    c.poly(F([(0.12,1.0),(-2.85,1.0),(-2.85,0.05),(-0.95,0.05),(-0.95,0.60),(-0.25,0.62),(-0.08,0.63)]),C_WHITE)
    # facets down the B-pillar edge
    c.poly(F([(0.13,1.6),(0.21,1.6),(0.17,1.0),(-0.03,0.63),(-0.08,0.63),(0.12,1.0)]),C_LIGHT)
    c.poly(F([(0.25,0.98),(0.02,0.66),(0.12,0.90)]),C_ROYAL)
    # swept shards rising out of the navy under HOLDEN: light, royal and navy blades raking back
    c.poly(F([(-0.05,0.62),(-0.97,0.555),(-0.97,0.05),(-0.05,0.05)]),C_NAVY)
    for col_,sh in ((C_LIGHT,[((-0.02,0.63),(-0.46,0.745),(-0.34,0.60)),((-0.28,0.60),(-0.86,0.735),(-0.72,0.585)),
                               ((-0.64,0.585),(-1.22,0.705),(-1.06,0.572)),((-1.00,0.572),(-1.62,0.655),(-1.40,0.566)),
                               ((-1.30,0.566),(-2.35,0.598),(-1.80,0.552))]),
                    (C_ROYAL,[((-0.04,0.615),(-0.40,0.705),(-0.30,0.598)),((-0.26,0.598),(-0.78,0.700),(-0.66,0.584)),
                               ((-0.60,0.584),(-1.12,0.672),(-0.98,0.570)),((-0.95,0.570),(-1.52,0.625),(-1.30,0.562)),
                               ((-1.25,0.562),(-2.10,0.580),(-1.70,0.550))]),
                    (C_NAVY,[((-0.05,0.605),(-0.33,0.662),(-0.26,0.592)),((-0.24,0.592),(-0.66,0.660),(-0.58,0.580)),
                              ((-0.55,0.580),(-1.00,0.640),(-0.92,0.566)),((-0.90,0.566),(-1.36,0.598),(-1.20,0.556))])):
        for p0,p1,p2 in sh:c.poly(F([p0,p1,p2,(p2[0],p2[1]-0.03),(p0[0],p0[1]-0.03)]),col_)
    # a long light spear over the rear arch
    c.poly(F([(-0.90,0.60),(-1.95,0.628),(-1.10,0.592)]),C_PALE)
    # rear bumper corner: navy facets from the bottom
    c.poly(F([(-1.72,0.05),(-1.80,0.18),(-2.10,0.13),(-2.35,0.24),(-2.60,0.20),(-2.85,0.30),(-2.85,0.05)]),C_NAVY)
    c.poly(F([(-1.80,0.18),(-2.10,0.13),(-2.35,0.24),(-2.20,0.19),(-2.00,0.21)]),C_ROYAL)
    c.poly(F([(-2.35,0.24),(-2.60,0.20),(-2.85,0.30),(-2.85,0.33),(-2.60,0.235)]),C_LIGHT)
    # light-blue spear behind the rear wheel
    c.poly(F([(-1.74,0.47),(-2.25,0.455),(-1.74,0.44)]),C_LIGHT)
    # navy sill strip with royal speed line
    c.poly(F([(0.87,0.0),(0.87,0.155),(-0.95,0.165),(-0.95,0.0)]),C_NAVY)
    c.poly(F([(0.80,0.17),(-0.90,0.185),(-0.90,0.172),(0.40,0.163)]),C_LIGHT)
    # --- stickers ---
    c.put('bull',f(0.60),0.525,1.02,flip=flip)
    c.put('word_k',f(-0.56),0.465,0.86)
    c.put('holden_k',f(-0.80),0.815,1.08,rot=3*sgn)   # a slight rake with the shards under it
    c.put('gw_k',f(1.66),0.655,0.36,rot=6*sgn)
    c.put('dunlop',f(1.40),0.735,0.15,rot=5*sgn)
    c.put(mtaa1,f(0.02),0.225,0.36)
    c.put('iveco_n',f(-1.93),0.585,0.30)
    c.put('havoline',f(-1.95),0.36,0.34)
    c.put('hp',f(-1.64),1.02,0.14)
    c.im.save('side%d.png'%sgn)
    cvs.append(c)
# ================= top: bonnet (read from the nose) =================
tf=Cv((0,1,0),(0,0,-1),-1.0,1.0,-2.7,-0.6,(y>0.6)&(z>0.6))
for s_ in (-1,1):
    G=lambda pts:[(a*s_,b) for a,b in pts]
    # royal facets along the bonnet edges, light slivers inside them
    tf.poly(G([(0.58,-0.6),(1.0,-0.6),(1.0,-2.7),(0.70,-2.7),(0.68,-2.40),(0.66,-1.80)]),C_ROYAL)
    tf.poly(G([(0.58,-0.6),(0.60,-0.6),(0.68,-1.80),(0.70,-2.40),(0.68,-2.40),(0.66,-1.80)]),C_LIGHT)
tf.put('twin',0,-1.74,1.16)
tf.put('word_k',0,-2.13,1.22)
cvs.append(tf)
# ================= roof (reads from behind, like the real car): CALTEX, hallmark, big navy Holden lion =================
rf=Cv((0,1,0),(0,0,1),-0.8,0.8,-1.2,0.6,(y>1.15)&(ax<0.70)&(z>-1.1)&(z<0.6))
for s_ in (-1,1):
    G=lambda pts:[(a*s_,b) for a,b in pts]
    rf.poly(G([(0.40,0.6),(0.80,0.6),(0.80,0.10)]),C_LIGHT)
    rf.poly(G([(0.52,0.6),(0.80,0.6),(0.80,0.30)]),C_ROYAL)
    rf.poly(G([(0.50,-1.2),(0.80,-1.2),(0.80,-0.80)]),C_ROYAL)
rf.put(cword,0,0.37,0.34)
rf.put(hall,0,0.15,0.27)
rf.put('lion_n',0,-0.50,0.96)
cvs.append(rf)
# ================= front face =================
fr=Cv((0,0,1),(0,1,0),-1.05,1.05,0.0,0.95,(z>1.9))
for s_ in (-1,1):
    G=lambda pts:[(a*s_,b) for a,b in pts]
    fr.poly(G([(0.50,0.165),(1.05,0.165),(1.05,0.60),(0.70,0.565),(0.56,0.46)]),C_WHITE)
    # IVECO lozenge under the headlamp
    fr.poly(G([(0.46,0.575),(0.60,0.455),(1.05,0.455),(1.05,0.78),(0.62,0.62)]),C_ROYAL)
    fr.poly(G([(0.60,0.455),(1.05,0.455),(1.05,0.468),(0.63,0.468)]),C_LIGHT)

    fr.poly(G([(0.50,0.165),(1.05,0.165),(1.05,0.18),(0.52,0.178)]),C_LIGHT)
fr.put('gw_wo',0,0.362,0.52)
cvs.append(fr)
# front corners (oblique views, stickers only): IVECO in the lozenge, CALTEX + hallmark on the white
for s_ in (-1,1):
    V=np.array([s_*0.6,0,0.8]);U=np.array([0,1,0]);R=np.cross(U,V/np.linalg.norm(V))
    a0=np.array([s_*0.74,0,2.26])@R
    c=Cv(V,U,a0-0.6,a0+0.6,0.1,0.8,(z>1.7)&(x*s_>0.3)&nothood);c.logo_only=True
    c.put('iveco_w',a0,0.522,0.21,rot=2*s_)
    c.put(cal_R if s_>0 else cal_L,a0,0.31,0.32)
    cvs.append(c)
# ================= rear face =================
rr=Cv((0,0,-1),(0,1,0),-1.05,1.05,0.0,1.4,(z<-1.8)&~((z<-1.98)&(y>1.12)))
# white rear corners (they carry on from the white quarters), navy centre panel with royal facets on its edges
for s_ in (-1,1):
    G=lambda pts:[(a*s_,b) for a,b in pts]
    rr.poly(G([(0.58,1.4),(1.05,1.4),(1.05,0.0),(0.66,0.0),(0.60,0.30),(0.58,0.62)]),C_WHITE)
    rr.poly(G([(0.58,1.4),(0.62,1.4),(0.62,0.62),(0.65,0.30),(0.60,0.30),(0.58,0.62)]),C_ROYAL)
    rr.poly(G([(0.62,1.4),(0.64,1.4),(0.64,0.62),(0.62,0.62)]),C_LIGHT)
rr.put('holden_w',0,0.825,0.50)
rr.put('word_k',0.0,0.425,0.38)
rr.put(bs,-0.46,0.43,0.24)
rr.put(bs,0.46,0.43,0.24,flip=True)
for s_ in (-1,1):
    rr.put(mtaa1.copy() if s_<0 else 'acdelco_w',0.20*s_,0.685,0.16)
cvs.append(rr)
# boot lid / rear deck from above: navy lid, white quarter tops that meet the white rear corners
tr=Cv((0,1,0),(0,0,1),-1.05,1.05,-2.8,-1.0,(y>0.75)&(z<-1.0)&~wing0)
for s_ in (-1,1):
    G=lambda pts:[(a*s_,b) for a,b in pts]
    tr.poly(G([(0.66,-1.0),(1.05,-1.0),(1.05,-2.8),(0.765,-2.8),(0.70,-2.0)]),C_WHITE)
    tr.poly(G([(0.64,-1.0),(0.66,-1.0),(0.70,-2.0),(0.765,-2.8),(0.745,-2.8),(0.68,-2.0)]),C_LIGHT)
    tr.poly(G([(0.62,-1.0),(0.64,-1.0),(0.68,-2.0),(0.745,-2.8),(0.70,-2.8),(0.65,-2.0)]),C_ROYAL)
cvs.append(tr)
# owner of every texel = the view whose direction is closest to its (smooth) normal
def owners(cs):
    D=np.stack([np.where(c.sel,n@c.V,-9) for c in cs]);best=D.argmax(0)
    return np.where(D.max(0)>0.05,np.array([id(c) for c in cs])[best],0)
# pass 1: colour fields from the main views; pass 2: stickers, where the front corners get their own oblique views
OWNER=owners([c for c in cvs if not c.logo_only])
for c in cvs:
    if not c.logo_only:c.apply()
# the guard's royal band as one 3D surface rule, so its lower edge runs clean across the side/top/front seams
zz=np.clip(z,1.6,2.6);yb=np.interp(zz,[1.6,1.85,2.12,2.32,2.55,2.6],[0.735,0.685,0.585,0.49,0.462,0.46])
gd=(ax>0.62)&(z>1.6)&(z<2.6)&(y>0.3)&(y<1.0)&~((z<2.6)&(ax<0.7)&(y>0.78))
mix(WHITE,gd*1.0);mix(ROYAL,gd*edge(y-yb));mix(LIGHT,gd*edge(y-yb+0.013)*edge(yb-y))
OWNER=owners(cvs)
for c in cvs:
    if not c.logo_only:c.apply(c.lg)
OWNER=None
for c in cvs:
    if c.logo_only:c.apply(c.lg)     # corner stickers win over the seam so they are never cut
# ---------- rear wing: black blade, navy endplates with mtaa super ----------
wing=(z<-1.98)&(y>1.12)
col[wing]=WINGB
endp=wing&(ax>0.66)&(np.abs(n[:,0])>0.6)
col[endp]=NAVY
for sgn in (-1,1):
    c=Cv((sgn,0,0),(0,1,0),-2.8,-1.6,1.0,1.6,endp&(x*sgn>0))
    f=lambda zz:zz*(-sgn)
    c.poly([(f(-2.1),1.6),(f(-2.8),1.6),(f(-2.8),1.395),(f(-2.2),1.425)],C_ROYAL)
    c.poly([(f(-2.2),1.425),(f(-2.8),1.395),(f(-2.8),1.385),(f(-2.3),1.41)],C_LIGHT)
    c.put(mtaa1,f(-2.42),1.325,0.28)
    c.apply()
out=np.zeros((N,N,3),np.float64);out[ys,xs]=col
# dilate into empty texels so mipmaps don't bleed grey
filled=M.copy();o8=out.copy()
for it in range(24):
    acc=np.zeros_like(o8);cnt=np.zeros((N,N))
    for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
        sh=np.roll(np.roll(o8,dy,0),dx,1);sf=np.roll(np.roll(filled,dy,0),dx,1)
        acc+=sh*sf[...,None];cnt+=sf
    new=(~filled)&(cnt>0);o8[new]=acc[new]/cnt[new][:,None];filled|=new
o8[~filled]=NAVY
Image.fromarray(np.clip(o8+0.5,0,255).astype(np.uint8)).save('new_tex.png')
print('ok')
