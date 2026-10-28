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
WG=Cv((0,1,0),(0,0,1),-1.1,1.1,-2.7,2.7,wing)   # wing top, reads from the tail
LG='logos/'
def clear_bg(im,th=40):
    im=im.convert('RGBA');a=np.asarray(im).copy()
    from PIL import ImageDraw as D
    W,H=im.size
    for pt in [(0,0),(W-1,0),(0,H-1),(W-1,H-1)]:
        if a[pt[1],pt[0],3]>0 and a[pt[1],pt[0],:3].min()>215:D.floodfill(im,pt,(255,255,255,0),thresh=th)
    a=np.asarray(im).copy();a[a[...,3]==0]=0;im=Image.fromarray(a)
    return im.crop(im.getbbox())
def ck(im):return im.crop(im.getbbox())
def keep(im,box):  # crop by fractions of the trimmed logo
    W,H=im.size;return ck(im.crop((int(box[0]*W),int(box[1]*H),int(box[2]*W),int(box[3]*H))))
pirtek=L(IMG+'eac5e04ac9.png');pirtek_w=ck(Image.open(LG+'pirtek.png').convert('RGBA'))
wst=clear_bg(Image.open(LG+'wst.png'))
wst_txt=keep(wst,(0,0.72,1,1));wst_w=keep(wst,(0,0,1,0.70))
penske=clear_bg(Image.open(LG+'penske.png'))
shell=clear_bg(Image.open(LG+'shell.png'));shell_emb=keep(shell,(0,0,1,0.72))
lg=clear_bg(Image.open(LG+'lg.png'));dlink=clear_bg(Image.open(LG+'dlink.png'));dlink_w=keep(dlink,(0,0,1,0.62))
dunlop=ck(Image.open(LG+'dunlop.png').convert('RGBA'))
bosch=ck(Image.open(LG+'bosch.png').convert('RGBA'));bosch_w=keep(bosch,(0.31,0,1,1))
cal=ck(Image.open(LG+'caltexlogo.png').convert('RGBA'))
calstar=keep(cal,(0,0,842/2400,1));calword=keep(cal,(1000/2400,0,1,1))
xword=ck(Image.open(LG+'xboxword.png').convert('RGBA'))
xsph=ck(Image.open(LG+'xboxsphere.png').convert('RGBA'))
fordov=L(IMG+'c6def2ec7e.png');havoline=L(IMG+'c0f351584f.png');ppg=L(IMG+'941b73578c.png')
for nm,im in [('pirtek',pirtek),('calstar2',calstar),('wst_txt',wst_txt),('wst_w',wst_w),('penske',penske),('shell',shell_emb),('lg',lg),('dlink',dlink_w),('dunlop',dunlop),('bosch_w',bosch_w),('calstar',calstar),('calword',calword),('xword',xword),('xsph',xsph)]:im.save('logos/_'+nm+'.png')
def plate(im,c,px=0.10,py=0.22,r=0.18):
    W=int(im.width+2*px*im.height*2.2);H=int(im.height*(1+2*py));o=Image.new('RGBA',(W,H),(0,0,0,0))
    ImageDraw.Draw(o).rounded_rectangle((0,0,W-1,H-1),radius=int(H*r),fill=tuple(c)+(255,))
    o.alpha_composite(im,((W-im.width)//2,(H-im.height)//2));return o
WH=(246,247,248)

if LIV=='xbox':
    GREEN=hexc('#38a82c');BLK=(20,21,22)
    col=np.tile(GREEN,(len(x),1))
    sphere=disc(xsph.width,(56,168,44));sphere.alpha_composite(recol(xsph,WH))
    xw=recol(xword,WH);xk=recol(xword,BLK)
    for c in SD:
        f=c.f
        top=lambda zz:0.885 if zz>-1.0 else 0.885+(-1.0-zz)*0.04
        # black side panel: belt line to sill, raked front edge, ends before the rear lamps/bumper corner
        pts=[(f(0.80),0.885),(f(-1.0),0.885),(f(-1.95),0.925),(f(-2.20),0.30),(f(0.93),0.30),(f(0.96),0.45)]
        c.poly(pts,BLK+(255,))
        # white swoosh leading the panel
        c.poly([(f(0.86),0.895),(f(0.95),0.895),(f(1.06),0.60),(f(1.01),0.53)],WH+(255,))
        # green sweep along the bottom of the doors, thin white pinstripe at the rear
        c.poly([(f(0.93),0.30),(f(0.93),0.42),(f(0.4),0.36),(f(-2.14),0.335),(f(-2.16),0.30)],(56,168,44,255))
        c.poly([(f(-1.0),0.315),(f(-2.17),0.312),(f(-2.165),0.322),(f(-1.0),0.326)],WH+(255,))
        # sphere + XBOX wordmark, same reading order both sides
        c.put(sphere,-0.60,0.615,0.46)
        c.put(xw,0.16,0.615,0.96)
        c.put(pirtek,f(-1.48),0.845,0.34)
        c.put(fordov,f(0.80),0.45,0.15)
        c.put(pirtek,f(1.95),0.55,0.26)
        c.put(recol(wst_w,WH),f(-2.27),0.52,0.13)
        cvs.append(c)
    # bonnet: big sphere at the back, XBOX across the middle (reads from the nose)
    TF.put(recol(xsph,WH),0,-1.40,0.54)
    TF.put(xw,0,-1.92,1.14)
    # roof: Western Star banner at the windscreen header, sphere in the middle
    TF.poly([(-0.9,-0.37),(0.9,-0.37),(0.9,-0.22),(-0.9,-0.22)],BLK+(255,))
    TF.put(recol(wst_txt,WH),0,-0.295,0.86)
    TF.put(recol(xsph,WH),0,0.22,0.46)
    # boot and wing read from behind
    TR.put(xw,0,-1.88,0.78)
    WG.put(xw,0,-2.35,0.62)
    # nose: black brow between the lamps with PIRTEK, black chin with PENSKE
    FR.poly([(-0.95,0.16),(0.95,0.16),(0.95,0.27),(-0.95,0.27)],BLK+(255,))
    for sx in (-0.66,0.66):FR.put(plate(ck(recol(penske,BLK)),WH),sx,0.215,0.24)
    for c in CN:
        c.put(shell_emb,c.ac,0.46,0.12)
        c.put(ppg,c.ac,0.33,0.12)
    RR.put(xw,0,0.52,0.50)
    RR.put(pirtek,0,0.38,0.30)
    cvs+=[TF,TR,WG,RR,FR]+CN
elif LIV=='caltex':
    BLUE=hexc('#2c5b78');SILV=(172,180,187);RED=hexc('#d72a30')
    col=np.tile(BLUE,(len(x),1))
    star=ck(calstar)
    cw=recol(calword,WH);cwb=recol(calword,(44,91,120))
    vtx=txt([('Vortex',WH+(255,))],f=MONTI,wght=900,track=-14)
    Vw=Image.new('RGBA',(int(vtx.width*1.22),int(vtx.height*2.0)),(0,0,0,0));ew,eh=Vw.size
    sw=Image.new('RGBA',(ew*2,eh*2),(0,0,0,0));ds=ImageDraw.Draw(sw)
    ds.ellipse((0,eh*0.2,ew*2-1,eh*1.9),fill=WH+(255,));ds.ellipse((ew*0.06,eh*0.05,ew*1.96,eh*1.72),fill=(0,0,0,0))
    sw=sw.resize((ew,eh),Image.LANCZOS);m=Image.new('L',(ew,eh),0);ImageDraw.Draw(m).rectangle((0,eh*0.55,ew,eh),fill=255)
    Vw.paste(sw,(0,0),m);Vw.alpha_composite(vtx,((ew-vtx.width)//2,int(eh*0.16)))
    n98=txt([('98',(215,42,48,255))],f=MONTI,wght=900);n98=n98.resize((int(vtx.height*0.5*n98.width/n98.height),int(vtx.height*0.5)),Image.LANCZOS)
    Vw.alpha_composite(n98,(int(ew*0.80),int(eh*0.60)));Vw=ck(Vw)
    for c in SD:
        f=c.f
        # silver nose/fender sweep running back under the doors, white edge line
        c.poly([(f(2.7),0.0),(f(2.7),0.80),(f(1.2),0.80),(f(0.75),0.66),(f(0.0),0.43),(f(-0.95),0.30),(f(-0.95),0.0)],SILV+(255,))
        c.poly([(f(1.2),0.80),(f(0.75),0.66),(f(0.0),0.43),(f(-0.95),0.30),(f(-0.95),0.325),(f(0.0),0.46),(f(0.73),0.695),(f(1.18),0.835)],WH+(255,))
        c.put(Vw,0.0,0.62,1.22)
        c.put(bosch,f(0.55),0.37,0.30)
        c.put(dunlop,f(1.95),0.52,0.24)
        c.put(star,f(-2.13),0.52,0.24)
        c.put(fordov,f(-1.55),0.84,0.16)
        c.put(recol(dlink_w,WH),f(-0.55),0.855,0.20)
        cvs.append(c)
    mix(RED,edge(0.175-y)*edge(z-2.0))
    # bonnet: silver corners, blue tongue with the hallmark, CALTEX on the nose
    TF.poly([(-1.1,-2.7),(1.1,-2.7),(1.1,-1.0),(0.62,-1.0),(0.48,-2.12),(-0.48,-2.12),(-0.62,-1.0),(-1.1,-1.0)],SILV+(255,))
    TF.put(star,0,-1.58,0.62)
    TF.put(cwb,0,-2.30,0.56)
    TF.put(havoline,0.45,-1.15,0.24)
    # roof: CALTEX + Ford oval at the header, hallmark behind
    TF.put(cw,0,-0.30,0.50)
    TF.put(fordov,0,-0.06,0.44)
    TF.put(star,0,0.38,0.42)
    # boot + wing (read from behind)
    TR.put(star,0,-1.80,0.32)
    WG.put(havoline,0,-2.35,0.95)
    WG.put(star,-0.62,-2.35,0.13);WG.put(star,0.62,-2.35,0.13)
    # nose
    FR.put(havoline,0,0.235,0.52)
    for c in CN:
        c.put(pirtek,c.ac,0.42,0.26)
        c.put(bosch_w and recol(bosch_w,WH),c.ac,0.31,0.20)
    RR.put(havoline,0,0.47,0.48)
    RR.put(cw,0,0.63,0.32)
    cvs+=[TF,TR,WG,RR,FR]+CN
    col[wing]=hexc('#1b1d20')
elif LIV=='taubmans':
    from PIL import ImageFilter
    SKY=hexc('#2b8fd8');BLK=(22,24,27);ORG=(240,134,30);WHT=(247,248,249)
    col=np.tile(SKY,(len(x),1))
    hg=Image.open(LG+'hogs.png').convert('RGBA').crop((130,1085,830,1495))
    ha=np.asarray(hg);m=(ha[...,3]>60)
    mi=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    hogs=Image.new('RGBA',hg.size,(16,30,60,0));hogs.putalpha(mi)
    fill=Image.new('RGBA',hg.size,WHT+(255,));fill.putalpha(Image.fromarray((m*255).astype(np.uint8)));hogs.alpha_composite(fill);hogs=ck(hogs)
    det=Image.open(LG+'detroit.png').convert('RGBA');det=ck(det.crop((int(det.width*0.245),0,det.width,det.height)));det=recol(det,WHT)
    mtu=ck(Image.open(LG+'mtu.png').convert('RGBA'))
    man=recol(ck(Image.open(LG+'man.png').convert('RGBA')),WHT)
    wurth=recol(L(IMG+'f308c3b2a5.png'),WHT)
    penske_r=L(IMG+'2636227148.png')
    # Taubmans: colour-dot cluster + wordmark, "by" + PPG underneath
    D=900;dots=Image.new('RGBA',(D,D),(0,0,0,0));dd=ImageDraw.Draw(dots)
    for (cx,cy,r,c) in [(0.30,0.30,0.20,(238,52,43)),(0.62,0.22,0.17,(250,166,26)),(0.80,0.50,0.17,(255,214,0)),(0.62,0.78,0.18,(122,190,66)),(0.30,0.72,0.20,(0,150,214)),(0.14,0.50,0.12,(140,80,160)),(0.50,0.50,0.15,(234,90,140))]:
        dd.ellipse(((cx-r)*D,(cy-r)*D,(cx+r)*D,(cy+r)*D),fill=c+(255,))
    dots=ck(dots)
    tw=txt([('TAUBMANS',WHT+(255,))],wght=620,track=-4)
    byt=txt([('by',WHT+(255,))],wght=500)
    TB=Image.new('RGBA',(int(dots.width*1.15+tw.width),int(tw.height*2.05)),(0,0,0,0))
    dh=int(tw.height*1.75);ds_=dots.resize((int(dots.width*dh/dots.height),dh),Image.LANCZOS)
    TB.alpha_composite(ds_,(0,0));tx0=int(ds_.width*1.12);TB.alpha_composite(tw,(tx0,int(tw.height*0.18)))
    pg=ppg.resize((int(ppg.width*tw.height*0.62/ppg.height),int(tw.height*0.62)),Image.LANCZOS)
    by=byt.resize((int(byt.width*tw.height*0.36/byt.height),int(tw.height*0.36)),Image.LANCZOS)
    bx=tx0+tw.width//2-(by.width+pg.width)//2;TB.alpha_composite(by,(bx,int(tw.height*1.48)));TB.alpha_composite(pg,(bx+by.width+int(tw.height*0.08),int(tw.height*1.30)))
    TB=ck(TB);TB.save('taubmans_lockup.png')
    for c in SD:
        f=c.f
        # orange belt stripe from the front fender top, filling the C-pillar behind the rear window
        c.poly([(f(1.95),0.79),(f(0.95),0.86),(f(-1.0),0.875),(f(-1.55),0.93),(f(-2.6),0.95),(f(-2.6),1.04),(f(-1.55),1.04),(f(-1.2),0.95),(f(-1.0),0.92),(f(0.95),0.895),(f(1.95),0.815)],ORG+(255,))
        # black main panel: front door to tail
        c.poly([(f(0.98),0.865),(f(-1.0),0.88),(f(-1.55),0.935),(f(-2.6),0.955),(f(-2.6),0.44),(f(-1.95),0.43),(f(-1.0),0.37),(f(0.62),0.40),(f(0.90),0.48)],BLK+(255,))
        # orange stripe along the bottom of the panel, and across the rear bumper
        c.poly([(f(0.90),0.48),(f(0.62),0.40),(f(-1.0),0.37),(f(-1.95),0.43),(f(-2.6),0.44),(f(-2.6),0.385),(f(-1.95),0.375),(f(-1.0),0.33),(f(0.62),0.36),(f(0.95),0.46)],ORG+(255,))
        c.put(TB,0.02,0.60,1.55)
        c.put(man,f(-1.88),0.66,0.40)
        c.put(hogs,f(-2.05),0.265,0.26)
        c.put(bosch,f(-1.80),0.985,0.24)
        c.put(fordov,f(0.82),0.55,0.15)
        c.put(wurth,f(1.97),0.635,0.20)
        c.put(pirtek,f(1.95),0.50,0.24)
        c.put(dunlop,f(-0.2),0.20,0.22)
        cvs.append(c)
    # bonnet: white with the big PPG, orange edge stripes; blue stays at the base of the windscreen
    mix(np.array(WHT,float),(hood|((z>2.12)&(y>0.62)&(np.abs(x)<0.78))).astype(float))
    for sx in (-1,1):TF.poly([(sx*0.60,-1.05),(sx*0.75,-1.05),(sx*0.95,-1.75),(sx*0.85,-1.80)],ORG+(255,))
    TF.put(ppg,0.0,-1.72,0.60,rot=90)
    # roof: Western Star header
    TF.poly([(-0.9,-0.37),(0.9,-0.37),(0.9,-0.22),(-0.9,-0.22)],(30,40,52,255))
    TF.put(recol(wst_txt,WHT),0,-0.295,0.86)
    WG.put(det,0,-2.35,0.95)
    for sgn in (-1,1):
        ep=Cv((sgn,0,0),(0,1,0),-2.7,2.7,0.0,1.5,wing&(x*sgn>0.6));ep.put(mtu,-2.36*(-sgn),1.16,0.17);cvs.append(ep)
    TR.put(fordov,0,-1.86,0.22)
    for c in CN:
        c.put(ppg,c.ac,0.42,0.12)
        c.put(penske_r,c.ac,0.27,0.19)
    RR.put(fordov,0.45,0.72,0.16)
    RR.put(ppg,-0.62,0.40,0.10)
    RR.put(hogs,0,0.30,0.34)
    cvs+=[TF,TR,WG,RR,FR]+CN
    col[wing&(np.abs(x)>0.70)]=np.array(ORG,float)
    rear=(z<-2.22)&~wing
    mix(np.array(BLK,float),(rear&(y>0.45)).astype(float))
    mix(np.array(ORG,float),(rear&(y>0.39)&(y<=0.45)).astype(float))
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
