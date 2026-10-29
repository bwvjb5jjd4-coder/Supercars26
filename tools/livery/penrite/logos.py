# Builds the Penrite Grove Racing stickers into ../logos/pr_*.png from real logo files.
# Run from tools/livery/penrite with DL=<folder holding svg_*.png renders, au.png flag, fonts/>.
import os,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
DL=os.environ.get('DL','dl');IMG='../../../assets/img/';OUT='../logos/'
def crop(im):return im.crop(im.getbbox())
def save(im,n):crop(im).save(OUT+'pr_'+n+'.png')
def ink(path,col=(255,255,255),k=130,lum=False):
    # mono logo from a black-on-white/transparent render: alpha from darkness, recoloured
    a=np.asarray(Image.open(path).convert('RGBA'),float)
    L=a[...,:3]@[0.299,0.587,0.114] if lum else a[...,:3].min(-1)
    al=a[...,3]/255*np.clip(((255 if not lum else 150)-L)/k,0,1)
    o=np.zeros(a.shape,np.uint8);o[...,:3]=col;o[...,3]=(al*255).astype(np.uint8);return crop(Image.fromarray(o))
def superres(im,f):
    # upscale a raster logo: smooth colour, crisp re-thresholded alpha edge
    W,H=im.size;big=im.resize((W*f,H*f),Image.BICUBIC);a=np.asarray(big,float)
    al=a[...,3]/255;al=np.clip((al-0.5)*2.2+0.5,0,1)
    # colour from premultiplied blur so edge texels keep the letter colour
    pm=im.convert('RGBA');p=np.asarray(pm,float);rgb=p[...,:3]*p[...,3:4]/255
    rb=Image.fromarray(np.clip(rgb,0,255).astype(np.uint8)).resize((W*f,H*f),Image.BICUBIC);ab=Image.fromarray(p[...,3].astype(np.uint8)).resize((W*f,H*f),Image.BICUBIC)
    rgb=np.asarray(rb,float)/np.maximum(np.asarray(ab,float)[...,None]/255,0.15)
    o=np.dstack([np.clip(rgb,0,255),al*255]).astype(np.uint8);return Image.fromarray(o)
# ---- Penrite: the real logo (penriteoil.com.au PENRITE_Logo_Long.pdf raster in the game) ----
pl=Image.open(IMG+'ef64ee4a7a.png').convert('RGBA')
a=np.asarray(pl)[...,3];cols=np.nonzero((a>40).sum(0)==0)[0]
gap=[c for c in cols if 120<c<220];cut=gap[len(gap)//2] if gap else 170
word=superres(crop(pl.crop((cut,0,pl.width,pl.height))),6);save(word,'word')
emb=superres(crop(pl.crop((0,0,cut,pl.height))),8);save(emb,'emblem')
# ---- real vector logos (github.com/detain/svg-logos, worldvectorlogo mirror) ----
save(ink(DL+'/png/svg_snap-on-1.png'),'snapon')
save(ink(DL+'/png/svg_autodesk-4.png'),'autodesk')
m=ink(DL+'/png/svg_mack-trucks-1.png');A=np.asarray(m)[...,3];rows=np.nonzero((A>40).sum(1)==0)[0]
r0=max([r for r in rows if r<A.shape[0]*0.95] or [0]);save(m.crop((0,r0,m.width,m.height)),'mack')
pp=Image.open(DL+'/png/svg_ppg-industries-1.png').convert('RGBA');a=np.asarray(pp,float)
blue=(a[...,2]-a[...,0]>60)&(a[...,3]>200);ys,xs=np.nonzero(blue);sq=pp.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
p2=Image.new('RGBA',(sq.width+24,sq.height+24),(255,255,255,255));p2.alpha_composite(sq,(12,12));save(p2,'ppg')
save(ink(DL+'/png/svg_dunlop-1.png',k=90,lum=True),'dunlop')
# Ford oval (logo.wine vector render already in the game)
save(Image.open(IMG+'3952a5b529.png').convert('RGBA'),'ford')
# Official 2:1 Australian flag: svg-country-flags 1.2.10 (npm), rendered to ../logos/pr_ausflag21.png by `node ../svgr.js au.svg::../logos/pr_ausflag21.png::3000`
# Australian flag (flag-icons on npm): Union Jack canton and Commonwealth star
fl=Image.open(DL+'/au.png').convert('RGBA');W,H=fl.size
save(fl.crop((0,0,W//2,H//2)),'unionjack');save(fl,'ausflag')
# ---- type: Barlow Condensed (Google Fonts) ----
f=ImageFont.truetype(DL+'/fonts/BarlowCondensed-SemiBold.ttf',300)
t=Image.new('L',(1800,420),0);ImageDraw.Draw(t).text((20,20),'SINCE 1926',font=f,fill=255);t=t.crop(t.getbbox())
o=Image.new('RGBA',t.size,(18,18,22,255));o.putalpha(t);save(o,'since')
# bright race-yellow version of the wordmark (as painted on the car): same letterforms and bevels, colour remapped
a=np.asarray(Image.open(OUT+'pr_word.png').convert('RGBA'),float);L=a[...,:3]@[0.299,0.587,0.114]
t=np.clip((L-120)/125,0,1)[...,None];c0=np.array([222,128,8.]);c1=np.array([250,196,24.]);c2=np.array([255,228,96.])
rgb=np.where(t<0.55,c0+(c1-c0)*(t/0.55),c1+(c2-c1)*((t-0.55)/0.45))
Image.fromarray(np.dstack([rgb,a[...,3]]).astype(np.uint8)).save(OUT+'pr_wordy.png')
