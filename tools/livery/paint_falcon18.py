import sys,numpy as np
from PIL import Image,ImageDraw,ImageFont
LIV=sys.argv[1]
IMG='/home/claude/supercars26/assets/img/'
MONT='../fonts/Montserrat.ttf';MONTI='../fonts/MontserratI.ttf'
N=4096
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy');HOOD=np.load('hood.npy')
ys,xs=np.nonzero(M);p=POS[ys,xs].astype(np.float64);n=NRM[ys,xs].astype(np.float64)
hood=HOOD[ys,xs];nothood=~hood
x,y,z=p.T
def hexc(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004
def edge(d):return ss(-E/2,E/2,d)
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c,float)[None,:]*a[:,None]
S=800.0
class Cv:
    def __init__(s,V,U,a0,a1,b0,b1,sel):
        s.V=np.array(V,float);s.V/=np.linalg.norm(s.V);s.U=np.array(U,float);s.R=np.cross(s.U,s.V)
        s.a0,s.a1,s.b0,s.b1=a0,a1,b0,b1;s.W=int((a1-a0)*S);s.H=int((b1-b0)*S)
        s.im=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.sel=sel
    def px(s,a,b):return ((a-s.a0)*S,(s.b1-b)*S)
    def put(s,logo,a,b,w,flip=False,h=None,rot=0):
        lg=logo.transpose(Image.FLIP_LEFT_RIGHT) if flip else logo
        if rot:lg=lg.rotate(rot,expand=True,resample=Image.BICUBIC)
        W=int(w*S);H=int(W*lg.height/lg.width) if h is None else int(h*S)
        lg=lg.resize((W,H),Image.LANCZOS);X,Y=s.px(a,b);s.im.alpha_composite(lg,(int(X-W/2),int(Y-H/2)))
    def poly(s,pts,c):
        big=Image.new('RGBA',(s.W,s.H),(0,0,0,0))
        ImageDraw.Draw(big).polygon([s.px(a,b) for a,b in pts],fill=c);s.im.alpha_composite(big)
    def apply(s):
        global col
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
        col[k]=col[k]*(1-al[:,None])+rgb*al[:,None]
def L(f):
    im=Image.open(f).convert('RGBA');return im.crop(im.getbbox())
def recol(im,c):
    a=im.split()[3];o=Image.new('RGBA',im.size,tuple(c)+(255,));o.putalpha(a);return o
def font(f,size,wght):
    ft=ImageFont.truetype(f,size)
    try:ft.set_variation_by_axes([wght])
    except Exception as e:print('var',e)
    return ft
def txt(parts,size=300,f=MONT,wght=700,track=0):
    ft=font(f,size,wght)
    W=sum(int(ft.getlength(t))+track*len(t) for t,_ in parts)+80
    im=Image.new('RGBA',(W,int(size*1.6)),(0,0,0,0));d=ImageDraw.Draw(im);X=20
    for t,c in parts:
        for ch in t:
            d.text((X,size*0.15),ch,font=ft,fill=c);X+=int(ft.getlength(ch))+track
    return im.crop(im.getbbox())
def pad(im,c,px=0.25,py=0.3,r=0.3):
    W=int(im.width*(1+2*px));H=int(im.height+im.width*py*2*0.25)
    H=max(H,int(im.height*(1+2*py)));o=Image.new('RGBA',(W,H),(0,0,0,0))
    ImageDraw.Draw(o).rounded_rectangle((0,0,W-1,H-1),radius=int(H*r),fill=tuple(c)+(255,))
    o.alpha_composite(im,((W-im.width)//2,(H-im.height)//2));return o
def disc(D,c):
    im=Image.new('RGBA',(D*4,D*4),(0,0,0,0));ImageDraw.Draw(im).ellipse((0,0,D*4-1,D*4-1),fill=tuple(c)+(255,));return im.resize((D,D),Image.LANCZOS)

shell=L(IMG+'9984da7c5a.png');ppg=L(IMG+'941b73578c.png');penske=L(IMG+'2636227148.png')
pirtek=L(IMG+'eac5e04ac9.png');wst=L(IMG+'983e8319e5.png');ford=L(IMG+'c6def2ec7e.png')
havoline=L(IMG+'c0f351584f.png');bosch=L(IMG+'76be370dde.png');dunlop=L(IMG+'4e18d3dc8c.png')
boschword=bosch.crop((int(bosch.width*0.33),0,bosch.width,bosch.height));boschword=boschword.crop(boschword.getbbox())

cvs=[]
def sides(sel=None):
    out=[]
    for sgn in (-1,1):
        c=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.3)&nothood)
        c.f=(lambda zz,s=sgn:zz*(-s));c.sgn=sgn;out.append(c)
    return out
SD=sides()
TF=Cv((0,1,0),(0,0,-1),-1.1,1.1,-2.7,2.7,(y>0.6))   # top, reads from the nose
TR=Cv((0,1,0),(0,0,1),-1.1,1.1,-2.7,2.7,(y>0.6))    # top, reads from the tail
FR=Cv((0,0,1),(0,1,0),-1.1,1.1,0,1.0,(z>1.9)&nothood)  # nose face
RR=Cv((0,0,-1),(0,1,0),-1.1,1.1,0,1.3,(z<-1.8))      # rear face
CN=[]
for sgn in (-1,1):
    V=np.array([sgn*0.6,0,0.8]);U=np.array([0,1,0]);R=np.cross(U,V/np.linalg.norm(V))
    ref=np.array([sgn*0.80,0,2.20]);a0=ref@R
    c=Cv(V,U,a0-0.6,a0+0.6,0.0,1.0,(z>1.6)&(x*sgn>0.3)&nothood);c.ac=a0;CN.append(c)
wing=(z<-2.12)&(y>1.04)

if LIV=='xbox':
    GREEN=hexc('#36a82e');BLACK=hexc('#151617');WHITE=(245,246,247)
    col=np.tile(GREEN,(len(x),1))
    sph=Image.open('xbox_w.png').convert('RGBA');D=sph.width
    sphere=disc(D,(54,168,46));sphere.alpha_composite(sph)
    sphere_ghost=recol(sph,(98,196,88))
    xboxw=txt([('XBOX',WHITE+(255,))],wght=420,track=30)
    xboxw_dark=recol(xboxw,(20,22,24))
    forza=txt([('FORZA',WHITE+(255,))],wght=800,track=10);motor=txt([('MOTORSPORT',WHITE+(255,))],wght=600,track=12)
    fz=Image.new('RGBA',(max(forza.width,motor.width),forza.height+motor.height+60),(0,0,0,0))
    fz.alpha_composite(forza,(0,0));fz.alpha_composite(motor.resize((forza.width,int(motor.height*forza.width/motor.width))),(0,forza.height+40))
    fz=fz.crop(fz.getbbox())
    for c in SD:
        f=c.f
        # black side panel: belt line down to the sill, raked front edge behind the front wheel
        top=0.865;bot=0.30
        c.poly([(f(-2.35),top),(f(0.55),top),(f(1.18),0.52),(f(1.12),bot),(f(-1.0),bot),(f(-1.25),0.24),(f(-2.6),0.24),(f(-2.6),top)],(21,22,23,255))
        # white flash leading the panel, then a thin green one inside it
        c.poly([(f(0.50),top+0.015),(f(0.62),top+0.015),(f(1.30),0.50),(f(1.24),0.48)],WHITE+(255,))
        c.poly([(f(0.40),top),(f(0.47),top),(f(1.12),0.52),(f(1.07),0.50)],(54,168,46,255))
        # green speed stripe along the bottom of the panel
        c.poly([(f(0.95),0.36),(f(-2.4),0.33),(f(-2.4),0.37),(f(0.95),0.385)],(54,168,46,255))
        c.poly([(f(-1.0),0.27),(f(-2.6),0.27),(f(-2.6),0.285),(f(-1.0),0.29)],WHITE+(255,))
        # sphere then wordmark, reading the same way on both sides
        c.put(sphere,-0.86,0.585,0.47)
        c.put(xboxw,0.24,0.585,1.10)
        c.put(fz,f(-2.05),0.70,0.30)
        c.put(ford,f(1.02),0.42,0.14)
        c.put(shell,f(2.05),0.47,0.17)
        cvs.append(c)
    # bonnet: big wordmark + ghost sphere
    TF.put(sphere_ghost,0,-1.30,0.62)
    TF.put(xboxw,0,-1.86,1.05)
    TF.put(recol(wst,(255,255,255)),0,-0.62,0.62)   # roof front edge, above the windscreen
    TR.put(sphere,0,-1.95,0.30)
    TR.put(xboxw,0,-0.05,0.95)
    # tail
    RR.put(xboxw,0,0.62,0.55)
    RR.put(pad(recol(penske.crop((0,0,penske.width,int(penske.height*0.52))),(255,255,255)),(21,22,23),0.12,0.25,0.2),0,0.32,0.36)
    # nose: lower intake band black, logos kept below the lamps (lamps sit at y>0.56)
    mix(BLACK,edge(0.30-y)*edge(z-2.0)*edge(y-0.17))
    FR.put(pirtek,0,0.47,0.38)
    FR.put(pad(recol(penske.crop((0,0,penske.width,int(penske.height*0.52))),(255,255,255)),(21,22,23),0.1,0.2,0.2),0,0.235,0.30)
    for c in CN:
        c.put(ppg,c.ac,0.42,0.13)
    cvs+=[TF,TR,RR,FR]+CN
    WINGC=None
else:
    BLUE=hexc('#2c5a76');SILV=hexc('#a9b2b9');RED=hexc('#d42a2f');WHITE=(246,247,248)
    col=np.tile(BLUE,(len(x),1))
    # Caltex star: red disc, white five-point star with the shaded facets
    def star(D):
        k=4;im=Image.new('RGBA',(D*k,D*k),(0,0,0,0));d=ImageDraw.Draw(im);R0=D*k/2
        d.ellipse((0,0,D*k-1,D*k-1),fill=(255,255,255,255));d.ellipse((R0*0.06,R0*0.06,D*k-1-R0*0.06,D*k-1-R0*0.06),fill=(218,37,44,255))
        cx=cy=R0;Ro=R0*0.86;Ri=Ro*0.382;pts=[]
        for i in range(10):
            r=Ro if i%2==0 else Ri;t=np.pi/2+i*np.pi/5;pts.append((cx+r*np.cos(t),cy-r*np.sin(t)))
        d.polygon(pts,fill=(255,255,255,255))
        # each point: the clockwise half slightly shaded, as on the Caltex hallmark
        for i in range(0,10,2):
            d.polygon([(cx,cy),pts[i],pts[(i+1)%10]],fill=(236,232,232,255))
        return im.resize((D,D),Image.LANCZOS)
    st=star(1200)
    caltex=txt([('CALTEX',WHITE+(255,))],wght=850,track=8)
    fordw=txt([('FORD',WHITE+(255,))],wght=900,track=6)
    vtx=txt([('Vortex',WHITE+(255,))],f=MONTI,wght=850,track=-6)
    # Vortex swoosh: white ellipse arc around the word, with the red 98
    V=Image.new('RGBA',(int(vtx.width*1.25),int(vtx.height*2.1)),(0,0,0,0));dv=ImageDraw.Draw(V)
    ew,eh=V.width,V.height
    dv.ellipse((0,eh*0.05,ew-1,eh*0.95),outline=WHITE+(255,),width=int(eh*0.06))
    dv.ellipse((ew*0.02,eh*0.03,ew*0.98,eh*0.80),fill=(0,0,0,0))
    msk=Image.new('L',V.size,0);ImageDraw.Draw(msk).rectangle((0,eh*0.5,ew,eh),fill=255);arc=Image.new('RGBA',V.size,(0,0,0,0));arc.paste(V,(0,0),msk)
    V=arc;V.alpha_composite(vtx,((ew-vtx.width)//2,int(eh*0.18)))
    n98=txt([('98',(214,42,47,255))],f=MONTI,wght=850)
    n98=n98.resize((int(vtx.height*0.55*n98.width/n98.height),int(vtx.height*0.55)),Image.LANCZOS)
    V.alpha_composite(n98,(int(ew*0.80),int(eh*0.62)))
    V=V.crop(V.getbbox())
    vtxblue=recol(vtx,(44,90,118))
    for c in SD:
        f=c.f
        # silver sweep: front fender and lower doors, curling up behind the front wheel
        c.poly([(f(2.7),0.0),(f(2.7),0.76),(f(1.25),0.78),(f(0.85),0.70),(f(0.2),0.46),(f(-0.6),0.33),(f(-1.0),0.30),(f(-1.0),0.0)],(169,178,185,255))
        c.poly([(f(1.25),0.78),(f(0.85),0.70),(f(0.2),0.46),(f(-0.6),0.33),(f(-0.6),0.36),(f(0.18),0.50),(f(0.83),0.735),(f(1.22),0.815)],WHITE+(255,))
        # rear-quarter star, cut by the window line like the real car
        c.put(st,f(-1.86),0.70,0.56)
        c.put(V,0.05,0.62,1.30)
        c.put(recol(boschword,(255,255,255)),f(0.72),0.36,0.30)
        c.put(ford,f(-2.15),0.45,0.17)
        c.put(dunlop.resize((dunlop.width,dunlop.height)),f(1.45),0.80,0.07)
        cvs.append(c)
    # red front splitter lip
    mix(RED,edge(0.215-y)*edge(z-2.05))
    # bonnet: silver front corners, star disc, CALTEX across the nose
    TF.poly([(-1.1,-2.7),(1.1,-2.7),(1.1,-1.15),(0.62,-1.25),(0.42,-2.05),(-0.42,-2.05),(-0.62,-1.25),(-1.1,-1.15)],(169,178,185,255))
    TF.put(st,0,-1.58,0.70)
    TF.put(caltex,0,-2.27,0.70)
    # roof: CALTEX / FORD reading from the front, star in the middle
    TF.put(caltex,0,-0.40,0.42)
    TF.put(fordw,0,-0.20,0.72)
    TF.put(st,0,0.42,0.48)
    # tail
    RR.put(havoline,0,0.40,0.62)
    RR.put(caltex,0,0.66,0.45)
    TR.put(havoline,0,-2.40,0.95)
    # nose: CALTEX + Vortex low, nothing on the lamps
    FR.put(havoline,0,0.30,0.55)
    for c in CN:
        c.put(pirtek,c.ac,0.40,0.24)
        c.put(recol(boschword,(255,255,255)),c.ac,0.30,0.20)
    cvs+=[TF,TR,RR,FR]+CN
    col[wing]=hexc('#1b1d20')
for c in cvs:c.apply()
out=np.zeros((N,N,3),np.float64);out[ys,xs]=col
filled=M.copy();o8=out.copy()
for it in range(24):
    acc=np.zeros_like(o8);cnt=np.zeros((N,N))
    for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
        sh=np.roll(np.roll(o8,dy,0),dx,1);sf=np.roll(np.roll(filled,dy,0),dx,1)
        acc+=sh*sf[...,None];cnt+=sf
    new=(~filled)&(cnt>0);o8[new]=acc[new]/cnt[new][:,None];filled|=new
o8[~filled]=col.mean(0)
Image.fromarray(np.clip(o8+0.5,0,255).astype(np.uint8)).save(LIV+'_tex.png')
