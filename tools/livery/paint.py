import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
IMG='/home/claude/supercars26/assets/img/'
N=4096
POS=np.load('pos.npy');NRM=np.load('nrm.npy');M=np.load('mask.npy')
ys,xs=np.nonzero(M);p=POS[ys,xs].astype(np.float64);n=NRM[ys,xs].astype(np.float64)
x,y,z=p.T
nothood=~((xs>=330)&(xs<=1390)&(ys>=1055)&(ys<=1875))
def hexc(h):return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
NAVY=hexc('#17214c');WHITE=hexc('#f3f4f6');LBLUE=hexc('#4f9ed6');SILV=hexc('#bcc6d2');BLACK=hexc('#121315');YEL=(244,191,38)
def ss(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
E=0.004 # edge softness, metres (~3 texels)
def edge(d):return ss(-E/2,E/2,d)  # d>0 inside
# ---------- base colour (3D rules) ----------
def zb(yy):
    return np.where(yy>=0.62,-0.05-(1.05-yy)*1.0,-0.48-(0.62-yy)*1.4)
col=np.tile(NAVY,(len(x),1))
def mix(c,a):
    global col;col=col*(1-a[:,None])+np.asarray(c)[None,:]*a[:,None] if np.ndim(c)==1 else col*(1-a[:,None])+c*a[:,None]
d_rear=(zb(y)-z)/np.sqrt(1+1.0)   # approx perpendicular distance
side=np.abs(x)>0.55
mix(LBLUE,edge(d_rear+0.0))
mix(WHITE,edge(d_rear-0.03))
roof=(y>1.17)&(np.abs(x)<0.70)
mix(LBLUE,edge(0.68-np.abs(x))*edge(y-1.17)*(z>-1.2))
mix(WHITE,edge(0.655-np.abs(x))*edge(y-1.17))
# sill + front lip
mix(LBLUE,edge(0.275-y)*(np.abs(x)>0.7)*edge(z+2.0)*edge(1.95-z))
mix(WHITE,edge(0.25-y)*(np.abs(x)>0.7))
mix(LBLUE,edge(0.215-y)*edge(z-1.95))
mix(WHITE,edge(0.19-y)*edge(z-1.95))
# rear wing black
wing=(z<-1.98)&(y>1.12)
col[wing]=BLACK
# ---------- canvases ----------
S=800.0
class Cv:
    def __init__(s,V,U,a0,a1,b0,b1,sel):
        s.V=np.array(V,float);s.V/=np.linalg.norm(s.V);s.U=np.array(U,float);s.R=np.cross(s.U,s.V)
        s.a0,s.a1,s.b0,s.b1=a0,a1,b0,b1;s.W=int((a1-a0)*S);s.H=int((b1-b0)*S)
        s.im=Image.new('RGBA',(s.W,s.H),(0,0,0,0));s.sel=sel
    def px(s,a,b):return ((a-s.a0)*S,(s.b1-b)*S)
    def put(s,logo,a,b,w,flip=False,h=None):
        lg=logo.transpose(Image.FLIP_LEFT_RIGHT) if flip else logo
        W=int(w*S);H=int(W*lg.height/lg.width) if h is None else int(h*S)
        lg=lg.resize((W,H),Image.LANCZOS);X,Y=s.px(a,b);s.im.alpha_composite(lg,(int(X-W/2),int(Y-H/2)))
    def poly(s,pts,c):
        big=Image.new('RGBA',(s.W,s.H),(0,0,0,0))
        ImageDraw.Draw(big).polygon([s.px(a,b) for a,b in pts],fill=c);s.im.alpha_composite(big)
    def apply(s):
        a=p@s.R;b=p@s.U;dn=n@s.V
        w=ss(0.22,0.42,dn)*s.sel
        X=(a-s.a0)*S-0.5;Y=(s.b1-b)*S-0.5
        k=(w>0)&(X>=0)&(Y>=0)&(X<s.W-1)&(Y<s.H-1)
        A=np.asarray(s.im,np.float64)
        X0=np.floor(X[k]).astype(int);Y0=np.floor(Y[k]).astype(int);fx=(X[k]-X0)[:,None];fy=(Y[k]-Y0)[:,None]
        # premultiplied bilinear
        Pm=A.copy();Pm[...,:3]*=Pm[...,3:4]/255
        smp=(Pm[Y0,X0]*(1-fx)*(1-fy)+Pm[Y0,X0+1]*fx*(1-fy)+Pm[Y0+1,X0]*(1-fx)*fy+Pm[Y0+1,X0+1]*fx*fy)
        al=smp[:,3]/255*w[k]
        rgb=np.where(smp[:,3:4]>0,smp[:,:3]/np.maximum(smp[:,3:4],1e-6)*255,0)
        global col
        col[k]=col[k]*(1-al[:,None])+rgb*al[:,None]
def L(f,box=True):
    im=Image.open(f).convert('RGBA')
    return im.crop(im.getbbox()) if box else im
def recol(im,c):
    a=im.split()[3];o=Image.new('RGBA',im.size,c+(255,));o.putalpha(a);return o
def sharp_up(im,k=3):
    im=im.resize((im.width*k,im.height*k),Image.BICUBIC);a=np.asarray(im.split()[3],float)/255
    a=np.clip((a-0.5)*2.2+0.5,0,1);a=a*a*(3-2*a);im.putalpha(Image.fromarray((a*255).astype(np.uint8)));return im
bull=L(IMG+'9cb63de205.png')
rbword=L(IMG+'8128abc05e.png')
holden=L(IMG+'6bb14b7642.png')
gw=L(IMG+'bb343f5a41.png')
twin=L(IMG+'2d4fdb58ee.png')
lion=L(IMG+'299b51591e.png')
ampolA=L(IMG+'e4ff33f715.png')
ampolW=sharp_up(L(IMG+'e160ac7f24.png'),6)
iveco=L('iveco_w.png')
# bull + sun icon (bull charges right into the sun)
bh=bull.height;D=int(bh*1.08);Wc=int(bull.width+D*0.45);icon=Image.new('RGBA',(Wc,max(bh,D)+4),(0,0,0,0))
sun=Image.new('RGBA',(D*4,D*4),(0,0,0,0));ImageDraw.Draw(sun).ellipse((0,0,D*4-1,D*4-1),fill=YEL+(255,));sun=sun.resize((D,D),Image.LANCZOS)
icon.alpha_composite(sun,(Wc-D,(icon.height-D)//2));icon.alpha_composite(bull,(0,(icon.height-bh)//2+int(bh*0.06)))
icon=icon.crop(icon.getbbox());icon.save('icon_bullsun.png')
cvs=[]
# ---- sides: R = x<0 (front on right), L = x>0 (front on left) ----
for sgn in (-1,1):
    V=(sgn,0,0)
    c=Cv(V,(0,1,0),-2.7,2.7,0.0,1.5,(x*sgn>0.3)&nothood)
    f=lambda zz:zz*(-sgn)  # canvas a coordinate for a car z  (R: a=z ; L: a=-z)
    flip=(sgn>0)
    zbf=lambda yy:(-0.05-(1.05-yy)*1.0) if yy>=0.62 else (-0.48-(0.62-yy)*1.4)
    # speed streaks emanating rearwards from the white boundary
    for (yy,t,ln,cc) in [(0.33,0.05,1.0,(23,33,76,255)),(0.405,0.022,0.65,(79,158,214,255)),(0.70,0.026,0.55,(79,158,214,255)),(0.765,0.03,0.85,(23,33,76,255)),(0.53,0.02,0.45,(188,198,210,255))]:
        z0=zbf(yy)+0.02
        c.poly([(f(z0),yy+t/2),(f(z0-ln),yy),(f(z0),yy-t/2)],cc)
    # sill streaks
    c.poly([(f(1.2),0.287),(f(-0.9),0.262),(f(1.2),0.262)],(79,158,214,255))
    c.poly([(f(-1.75),0.21),(f(-2.65),0.19),(f(-2.65),0.235)],(79,158,214,255))
    c.poly([(f(-1.75),0.17),(f(-2.65),0.15),(f(-2.65),0.18)],(23,33,76,255))
    c.poly([(f(2.7),0.235),(f(1.95),0.222),(f(2.7),0.21)],(23,33,76,255))
    c.put(holden,f(-1.02),0.85,1.16)
    c.put(rbword,f(-0.42),0.50,0.86)
    c.put(icon,f(0.66),0.60,1.32,flip=flip)
    c.put(gw,f(1.47),0.785,0.42)
    cvs.append(c)
# ---- top: bonnet + roof read from the nose; boot + lion read from the tail ----
tf=Cv((0,1,0),(0,0,-1),-1.0,1.0,-2.7,2.7,(y>0.6))
tf.put(twin,0,-1.78,0.95)
amp=Image.new('RGBA',(int(ampolA.width*0.55+ampolW.width*1.0)+120, max(int(ampolA.height*0.55),ampolW.height)),(0,0,0,0))
aA=ampolA.resize((int(ampolA.width*0.55),int(ampolA.height*0.55)),Image.LANCZOS);amp.alpha_composite(aA,(0,(amp.height-aA.height)//2))
amp.alpha_composite(recol(ampolW,(26,38,128)),(aA.width+120,(amp.height-ampolW.height)//2))
amp=amp.crop(amp.getbbox());amp.save('ampol_lockup.png')
tf.put(amp,0,-0.10,1.10)
tr=Cv((0,1,0),(0,0,1),-1.0,1.0,-2.7,2.7,(y>0.6))
tr.put(lion,0,-0.90,0.56)
tr.put(holden,0,-2.12,0.85)
cvs+= [tf,tr]
# ---- rear face ----
rr=Cv((0,0,-1),(0,1,0),-1.0,1.0,0,1.3,(z<-1.8))
rr.put(holden,0,0.875,0.60)
rr.put(rbword,0,0.40,0.40)
rr.put(recol(iveco,(23,33,76)),0.62,0.40,0.18)
cvs.append(rr)
# ---- front corners (oblique) ----
for sgn in (-1,1):
    V=np.array([sgn*0.6,0,0.8]);U=np.array([0,1,0]);R=np.cross(U,V/np.linalg.norm(V))
    ref=np.array([sgn*0.70,0,2.30]);a0=ref@R
    c=Cv(V,U,a0-0.6,a0+0.6,0.1,1.0,(z>1.7)&(x*sgn>0.25)&nothood)
    c.put(iveco,a0,0.515,0.22)
    c.put(recol(holden,(255,255,255)),a0,0.44,0.31)
    c.put(ampolW,a0,0.362,0.26)
    cvs.append(c)
# ---- extras: wing zebra, XFORCE, octane, small sponsor stickers ----
FB='/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf'
def txt(parts,size=200,font=FB):
    f=ImageFont.truetype(font,size);W=sum(int(f.getlength(t)) for t,_ in parts)+40
    im=Image.new('RGBA',(W,int(size*1.4)),(0,0,0,0));d=ImageDraw.Draw(im);X=10
    for t,c in parts:d.text((X,size*0.1),t,font=f,fill=c);X+=int(f.getlength(t))
    return im.crop(im.getbbox())
xf_dark=txt([('X',(225,30,40,255)),('FORCE',(20,22,26,255))])
xf_light=txt([('X',(225,30,40,255)),('FORCE',(255,255,255,255))])
octn=txt([('octane',(255,255,255,255))],font='/usr/share/fonts/opentype/inter/Inter-Bold.otf')
dunlop=L(IMG+'4e18d3dc8c.png');acd=L(IMG+'0f19a59240.png');acdp=Image.new('RGBA',(acd.width+160,acd.height+90),(0,0,0,0));ImageDraw.Draw(acdp).rounded_rectangle((0,0,acdp.width-1,acdp.height-1),radius=acdp.height//2,fill=(245,246,248,255));acdp.alpha_composite(acd,(80,45));acd=acdp
tws=recol(L(IMG+'526bc2807a.png'),(23,33,76))


zeb=Image.new('RGBA',(tr.W,tr.H),(0,0,0,0));dz=ImageDraw.Draw(zeb)
for k in range(-30,30):
    a=-0.66+k*0.085
    pts=[tr.px(a,-2.62),tr.px(a+0.035,-2.62),tr.px(a+0.035+0.30,-2.32),tr.px(a+0.30,-2.32)]
    dz.polygon(pts,fill=(240,242,245,255))
m=Image.new('L',(tr.W,tr.H),0);ImageDraw.Draw(m).rectangle([tr.px(-0.64,-2.32),tr.px(0.64,-2.62)],fill=255)
zz=Image.new('RGBA',(tr.W,tr.H),(0,0,0,0));zz.paste(zeb,(0,0),m);tr.im.alpha_composite(zz)
tr.put(tws,0.42,-2.08,0.26)
rr.put(octn,-0.42,1.345,0.20)
rr.put(xf_light,0.42,1.345,0.22)
for c,sgn in ((cvs[0],-1),(cvs[1],1)):
    f=lambda zz,s=sgn:zz*(-s)
    c.put(xf_dark,f(0.42),0.19,0.34)
    c.put(dunlop,f(-1.97),0.56,0.15)
    c.put(xf_dark,f(-2.05),0.34,0.24)
    c.put(acd,f(0.42),0.905,0.20)
for c in cvs:c.apply()
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
