# Builds the sticker artwork for the 2020 Red Bull Holden ZB livery (tools/livery/logos/rb_*.png).
# Vector sources in svg/ come from github.com/detain/svg-logos (worldvectorlogo mirror); rasters from assets/img.
# Run from anywhere: python3 logos.py   (needs node + playwright for svgr.js)
import re,os,subprocess,numpy as np
from PIL import Image,ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__));SVG=HERE+'/svg/';OUT=HERE+'/../logos/rb_';IMG=HERE+'/../../../assets/img/'
TMP=HERE+'/.tmp/';os.makedirs(TMP,exist_ok=True)
RED='#d6203a';YEL='#fcc800';NAVY='#191a52'
rb=open(SVG+'redbullenergydrink.svg').read()
head=rb[:rb.index('>')+1];body=rb[len(head):-len('</svg>')]
paths=re.findall(r'<path[^>]*/>',body,flags=re.S)
word=paths[0]+paths[1];sun=paths[2];keyline=paths[3];bulls='<g fill="#e21b4d">'+paths[4]+'</g>'   # paths[5] = ENERGY DRINK
def svg(name,inner,vb=None,fixes=()):
    h=head if vb is None else re.sub(r'viewBox="[^"]*"','viewBox="%s"'%vb,head)
    s=h+inner+'</svg>'
    for a,b in fixes:s=s.replace(a,b)
    open(TMP+name+'.svg','w').write(s);return TMP+name+'.svg::'+TMP+name+'.png::%d'
jobs=[]
jobs.append(svg('word',word,fixes=[('#e21b4d',RED)])%4000)
jobs.append(svg('twin',sun+keyline+bulls,fixes=[('#e21b4d',RED),('#ffd300',YEL)])%4000)
jobs.append(svg('twin_nosun',keyline+bulls,fixes=[('#e21b4d',RED),('#ffd300',YEL)])%4000)
# one bull (the left-hand one, charging right) without the sun, for the doors and rear corners
jobs.append(svg('bull',keyline+bulls,vb='0 95 215 80',fixes=[('#e21b4d',RED),('#ffd300',YEL)])%4000)
jobs.append(svg('sun',sun,fixes=[('#ffd300',YEL)])%2000)
cx=open(SVG+'caltex-logo.svg').read();k=cx.rindex('fill="#004c5f"');cx=cx[:k]+'fill="#121316"'+cx[k+len('fill="#004c5f"'):]
open(TMP+'caltex.svg','w').write(cx);jobs.append(TMP+'caltex.svg::'+TMP+'caltex.png::3000')
iv=open(SVG+'iveco-2.svg').read().replace('height="-281"','')
for nm,c in (('iveco_w','#ffffff'),('iveco_n',NAVY)):
    s=re.sub(r'<path ',f'<path fill="{c}" ',iv);open(TMP+nm+'.svg','w').write(s);jobs.append(TMP+nm+'.svg::'+TMP+nm+'.png::3000')
hp=open(SVG+'hp-2.svg').read().replace('<path ','<path fill="#0096d6" ');open(TMP+'hp.svg','w').write(hp);jobs.append(TMP+'hp.svg::'+TMP+'hp.png::1600')
dl=open(SVG+'dunlop-1.svg').read();dl=dl.replace('<path d="m0 0h2499.6v494h-2499.6z" fill="#ffe100"/>','')
open(TMP+'dunlop.svg','w').write(dl);jobs.append(TMP+'dunlop.svg::'+TMP+'dunlop.png::2400')
jobs.append(SVG+'holden-2019-.svg::'+TMP+'lionring.png::3000')
subprocess.run(['node',HERE+'/../svgr.js']+jobs,check=True,env={**os.environ,'NODE_PATH':subprocess.run(['npm','root','-g'],capture_output=True,text=True).stdout.strip()})
def crop(im):return im.crop(im.getbbox())
def keyline(im,px,col=(255,255,255)):
    # solid keyline round the artwork: dilate the alpha (round brush), fill with col, artwork on top
    a=im.split()[3];big=a.filter(ImageFilter.MaxFilter(2*px+1)) if px<12 else None
    if big is None:
        big=a
        for _ in range(px//5):big=big.filter(ImageFilter.MaxFilter(11))
    pad=Image.new('RGBA',im.size,col+(0,));pad.putalpha(big);pad.alpha_composite(im);return pad
def padded(im,p):o=Image.new('RGBA',(im.width+2*p,im.height+2*p),(0,0,0,0));o.alpha_composite(im,(p,p));return o
def recol(im,c):
    o=Image.new('RGBA',im.size,c+(255,));o.putalpha(im.split()[3]);return o
def L(f):return crop(Image.open(f).convert('RGBA'))
word=L(TMP+'word.png')  # wordmark incl. the (R); drop the (R) (not on the car)
from scipy import ndimage
a=np.asarray(word.split()[3])>0;lab,nl=ndimage.label(a);ar=ndimage.sum(a,lab,range(1,nl+1))
objs=ndimage.find_objects(lab)
for i,v in enumerate(ar):
    sl=objs[i]
    if v<a.sum()*0.02 and sl[0].stop<a.shape[0]*0.35:  # the (R) sits small and high
        W_=np.array(word);W_[sl[0],sl[1],3]=0;word=Image.fromarray(W_)
word=crop(word)
word.save(OUT+'word.png')
keyline(padded(word,60),int(word.height*0.055)).save(OUT+'word_k.png')          # white keyline (bonnet, doors, rear)
twin=L(TMP+'twin.png');twin.save(OUT+'twin.png')
bull=L(TMP+'bull.png');a=np.asarray(bull.split()[3])>8;lab,nl=ndimage.label(a);big=1+np.argmax(ndimage.sum(a,lab,range(1,nl+1)))
B_=np.array(bull);B_[...,3]*=(ndimage.binary_dilation(lab==big,iterations=3));bull=crop(Image.fromarray(B_));bull.save(OUT+'bull.png')
L(TMP+'sun.png').save(OUT+'sun.png')
cal=L(TMP+'caltex.png');cal.save(OUT+'caltex.png')
L(TMP+'iveco_w.png').save(OUT+'iveco_w.png');L(TMP+'iveco_n.png').save(OUT+'iveco_n.png')
L(TMP+'hp.png').save(OUT+'hp.png')
L(TMP+'dunlop.png').save(OUT+'dunlop.png')
# rasters already in the game (real artwork): Holden wordmark, GEARWRENCH, mtaa super, Havoline, ACDelco
hol=L(IMG+'6bb14b7642.png');hol=hol.resize((hol.width*3,hol.height*3),Image.LANCZOS)
al=np.asarray(hol.split()[3],float)/255;al=np.clip((al-0.5)*1.6+0.5,0,1);hol.putalpha(Image.fromarray((al*255).astype(np.uint8)))
recol(hol,(17,18,22)).save(OUT+'holden_k.png');recol(hol,(255,255,255)).save(OUT+'holden_w.png')
gw=L(IMG+'bb343f5a41.png');A=np.asarray(gw)
icon_end=np.nonzero(A[...,3].max(0)>0)[0];g=np.nonzero(np.diff(icon_end)>8)[0][0]+1;gw=crop(gw.crop((icon_end[g],0,gw.width,gw.height)))
gw=gw.resize((gw.width*3,gw.height*3),Image.LANCZOS)
B=np.asarray(gw).copy();isw=(B[...,0]>200)&(B[...,1]>200)&(B[...,2]>200)
# drop the (R): last small blob
gw.save(OUT+'gw_wo.png')                       # GEAR white, WRENCH orange (front bumper)
recol(gw,(17,18,22)).save(OUT+'gw_k.png')     # all black (front guards)
mt=L(IMG+'dcdc065439.png');mt.save(OUT+'mtaa_w.png')
hv=L(IMG+'c0f351584f.png');hv.resize((hv.width*3,hv.height*3),Image.LANCZOS).save(OUT+'havoline.png')
ac=L(IMG+'0f19a59240.png');recol(ac,(255,255,255)).save(OUT+'acdelco_w.png')
# roof lion: the holes of the 2019 roundel (lion head + mane) as a solid navy shape, ring dropped
lr=crop(Image.open(TMP+'lionring.png').convert('RGBA'));A=np.asarray(lr)[...,3].astype(float)/255
H_,W_=A.shape;yy,xx=np.mgrid[0:H_,0:W_];cy,cx=H_/2,W_/2;R=min(H_,W_)/2
r=np.hypot(yy-cy,xx-cx);inner=np.clip((R*0.85-r)/2,0,1)
L_=np.zeros((H_,W_,4),np.uint8);L_[...,0]=27;L_[...,1]=26;L_[...,2]=85;L_[...,3]=(A*inner*255).astype(np.uint8)
crop(Image.fromarray(L_)).save(OUT+'lion_n.png')
# GEARWRENCH cleaned up: the web raster is distressed; close the speckle holes, flat white/orange, no (R)
g=Image.open(OUT+'gw_wo.png').convert('RGBA')
from scipy import ndimage as _nd
B=np.asarray(g)[...,3]>90;h=B.shape[0];small=(h*0.07)**2
lab,nl=_nd.label(~B);sz=_nd.sum(np.ones_like(B),lab,range(1,nl+1))
for i,v in enumerate(sz):
    if v<small:B[lab==i+1]=True        # fill the distress speckles inside the letters
lab,nl=_nd.label(B);sz=_nd.sum(B,lab,range(1,nl+1))
for i,v in enumerate(sz):
    if v<small*0.5:B[lab==i+1]=False   # drop stray specks
a=Image.fromarray((B*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)).point(lambda v:0 if v<90 else (255 if v>165 else (v-90)*255//75))
G=np.asarray(g).astype(float);orange=(G[...,0]>150)&(G[...,2]<120)&(G[...,1]<200)
# column where orange starts = WRENCH
oc=np.nonzero(orange.any(0))[0];split=oc.min()
out=np.zeros(G.shape,np.uint8);out[...,:3]=255;out[:,split:,0]=243;out[:,split:,1]=146;out[:,split:,2]=0;out[...,3]=np.asarray(a)
lab,nl=_nd.label(out[...,3]>0);objs=_nd.find_objects(lab)
for i,sl in enumerate(objs):
    if sl[0].stop<out.shape[0]*0.45 and sl[1].start>out.shape[1]*0.95:out[sl][lab[sl]==i+1,3]=0   # (R)
g2=crop(Image.fromarray(out));g2.save(OUT+'gw_wo.png')
k=np.asarray(g2).copy();k[...,:3]=(17,18,22);Image.fromarray(k).save(OUT+'gw_k.png')
print('ok')
