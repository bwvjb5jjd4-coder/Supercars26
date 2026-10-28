import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageChops
F='fonts/';IMG='/home/claude/supercars26/assets/img/'
RED=(225,26,45);WHITE=(255,255,255);BK=(16,18,26);LB=(42,164,222);NAVY=(14,40,100);YEL=(250,200,0)
def font(n,s,w=None):
    f=ImageFont.truetype(F+n,s)
    if w:
        try:f.set_variation_by_axes([w])
        except Exception:pass
    return f
def mask(t,f,track=0):
    W=int(sum(f.getlength(c) for c in t)+track*len(t)+f.size);H=int(f.size*1.6)
    m=Image.new('L',(W,H),0);d=ImageDraw.Draw(m);X=f.size*0.2
    for c in t:d.text((X,f.size*0.15),c,font=f,fill=255);X+=f.getlength(c)+track
    return m.crop(m.getbbox())
def skew(m,k):
    W,H=m.size;e=int(abs(k)*H)+4;o=m.transform((W+e,H),Image.AFFINE,(1,k,-e if k>0 else 0,0,1,0),Image.BICUBIC);return o.crop(o.getbbox())
def pad(m,p):o=Image.new('L',(m.width+2*p,m.height+2*p),0);o.paste(m,(p,p));return o
def grow(m,r):
    a=np.asarray(m,float)/255
    from scipy.ndimage import distance_transform_edt as dt
    d=dt(a<0.5);return Image.fromarray((np.clip(r-d+0.5,0,1)*255).astype(np.uint8))
def col(m,c):o=Image.new('RGBA',m.size,c+(255,));o.putalpha(m);return o
def layers(*ls):
    W=max(l.width for l in ls);H=max(l.height for l in ls);o=Image.new('RGBA',(W,H),(0,0,0,0))
    for l in ls:o.alpha_composite(l,((W-l.width)//2,(H-l.height)//2))
    return o.crop(o.getbbox())
def crop(im):return im.crop(im.getbbox())
def save(im,n):crop(im).save('logos/'+n+'.png')
# ---- MAX: heavy condensed italic, red, white keyline, black outer edge ----
m=pad(skew(mask('MAX',font('Anton-Regular.ttf',600),track=-8),0.2),90)
w=grow(m,26);b=grow(m,40)
MAX=layers(col(b,BK),col(w,WHITE),col(m,RED))
reg=mask('®',font('Montserrat[wght].ttf',150,700));MAXr=Image.new('RGBA',(MAX.width+reg.width+10,MAX.height),(0,0,0,0));MAXr.alpha_composite(MAX,(0,0));MAXr.alpha_composite(col(reg,WHITE),(MAX.width+5,MAX.height-reg.height-60))
save(MAX,'max');save(MAXr,'max_r')
# small MAX (thinner keyline for small stickers)
w2=grow(m,20);MAXs=layers(col(w2,WHITE),col(m,RED));save(MAXs,'max_s')
# ---- 'pepsi' lowercase word (2008 wordmark is a light rounded lowercase) ----
pw=mask('pepsi',font('Questrial-Regular.ttf',400),track=-6);save(col(pw,WHITE),'pepsi_w')
# stack: pepsi over MAX
def stack(top,bot,sc=0.42,gap=0.02):
    t=top.resize((int(bot.width*sc),int(top.height*bot.width*sc/top.width)),Image.LANCZOS)
    o=Image.new('RGBA',(bot.width,bot.height+t.height+int(bot.height*gap)),(0,0,0,0));o.alpha_composite(t,(int(bot.width*0.1),0));o.alpha_composite(bot,(0,t.height+int(bot.height*gap)));return o
save(stack(col(pw,WHITE),MAXs),'pepsimax')
glob=crop(Image.open('logos/globe.png'))
# globe + pepsi MAX lockup
pm=crop(Image.open('logos/pepsimax.png'));g=glob.resize((int(pm.height*0.95),int(pm.height*0.95)),Image.LANCZOS)
o=Image.new('RGBA',(g.width+pm.width+int(pm.height*0.15),pm.height),(0,0,0,0));o.alpha_composite(g,(0,(pm.height-g.height)//2));o.alpha_composite(pm,(g.width+int(pm.height*0.15),0));save(o,'globe_pepsimax')
# ---- Castrol: real logo in a white rounded box ----
cas=crop(Image.open(IMG+'2e167ec379.png').convert('RGBA'));pd=int(cas.height*0.28)
box=Image.new('RGBA',(cas.width+2*pd,cas.height+2*pd),(0,0,0,0));ImageDraw.Draw(box).rounded_rectangle((0,0,box.width-1,box.height-1),radius=pd,fill=WHITE+(255,),outline=(200,24,40,255),width=max(4,pd//5))
box.alpha_composite(cas,(pd,pd));save(box,'castrol_box');save(cas,'castrol')
# ---- Orrcon Steel oval: navy oval, yellow rim, white italic Orrcon + Steel ----
W,H=1200,520;o=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(o)
d.ellipse((0,0,W-1,H-1),fill=YEL+(255,));d.ellipse((26,26,W-27,H-27),fill=NAVY+(255,));d.ellipse((44,44,W-45,H-45),fill=(248,248,248,255))
d.chord((44,44,W-45,H-45),20,160,fill=NAVY+(255,))
t=col(skew(mask('Orrcon',font('Montserrat-Italic[wght].ttf',230,800),track=-6),0.05),NAVY);t=t.resize((int(t.width*0.95),int(t.height*0.95)))
o.alpha_composite(t,((W-t.width)//2+40,int(H*0.16)))
s=col(mask('Steel',font('Montserrat[wght].ttf',150,700)),WHITE);o.alpha_composite(s,((W-s.width)//2+40,int(H*0.60)))
# blue swoosh mark at left
sw=Image.new('L',(W,H),0);ds=ImageDraw.Draw(sw);ds.ellipse((90,150,330,390),fill=255);ds.ellipse((140,170,360,370),fill=0)
o.alpha_composite(col(sw,(0,140,210)))
save(o,'orrcon')
# ---- OurAuto ----
oa=mask('OurAuto',font('Montserrat[wght].ttf',300,600),track=-4);save(col(oa,WHITE),'ourauto')
# ---- SUPASHOCK race suspension ----
s1=skew(mask('SUPASHOCK',font('BarlowCondensed-BlackItalic.ttf',300),track=4),0.0);s2=mask('RACE SUSPENSION',font('BarlowCondensed-ExtraBoldItalic.ttf',110),track=10)
o=Image.new('RGBA',(s1.width,s1.height+s2.height+25),(0,0,0,0));sup=col(s1,WHITE);
# 'SUPA' white, 'SHOCK' red
a=np.asarray(s1);cut=int(s1.width*0.43);r=Image.new('RGBA',s1.size,(0,0,0,0));r.alpha_composite(col(s1,WHITE));rr=col(s1,RED);rr2=Image.new('RGBA',s1.size,(0,0,0,0));rr2.paste(rr.crop((cut,0,s1.width,s1.height)),(cut,0));r.alpha_composite(rr2)
o.alpha_composite(r,(0,0));o.alpha_composite(col(s2,WHITE),(s1.width-s2.width,s1.height+25));save(o,'supashock')
# ---- text stickers ----
save(col(mask('Winterbottom',font('Poppins-SemiBold.ttf',300),track=-4),WHITE),'winterbottom')
save(col(mask('ALLGATE',font('BarlowCondensed-BlackItalic.ttf',300),track=12),WHITE),'allgate')
save(col(mask('skye sands',font('Poppins-SemiBold.ttf',300),track=-4),WHITE),'skye')
save(col(mask('TEAC',font('RobotoSlab[wght].ttf',300,800),track=10),WHITE),'teac')
save(col(mask('MIGHTY MITE',font('BarlowCondensed-BlackItalic.ttf',300),track=14),WHITE),'mightymite')
save(col(mask('LIVE LIFE TO THE MAX',font('BarlowCondensed-BlackItalic.ttf',300),track=18),WHITE),'livelife')
e1=mask('elite',font('Comfortaa[wght].ttf',420,700),track=-10);e2=mask('CARAVANS',font('Montserrat[wght].ttf',230,400),track=40)
o=Image.new('RGBA',(e1.width+e2.width+80,e1.height),(0,0,0,0));o.alpha_composite(col(e1,WHITE),(0,0));o.alpha_composite(col(e2,WHITE),(e1.width+80,e1.height-e2.height-10));save(o,'elite')
save(col(mask('TSW',font('BarlowCondensed-BlackItalic.ttf',300),track=10),WHITE),'tsw')
save(col(mask('APEX',font('Montserrat-Italic[wght].ttf',300,800),track=10),WHITE),'apex')
p=mask('PPG',font('Montserrat[wght].ttf',300,800),track=6);bx=Image.new('RGBA',(p.width+120,p.height+120),(0,0,0,0));ImageDraw.Draw(bx).rectangle((0,0,bx.width-1,bx.height-1),outline=WHITE+(255,),width=18);bx.alpha_composite(col(p,WHITE),(60,60));save(bx,'ppg')
# WA WASTE: yellow block WA + WASTE
wa=mask('WA',font('BarlowCondensed-BlackItalic.ttf',300));ws=mask('WASTE',font('BarlowCondensed-BlackItalic.ttf',300),track=6)
o=Image.new('RGBA',(wa.width+80+ws.width+40,wa.height+60),(0,0,0,0));d=ImageDraw.Draw(o);d.rectangle((0,0,wa.width+60,o.height-1),fill=YEL+(255,));o.alpha_composite(col(wa,BK),(30,30));o.alpha_composite(col(ws,WHITE),(wa.width+100,30));save(o,'wawaste')
# WesTrac-style W mark + name
W,H=600,520;o=Image.new('RGBA',(W,H+180),(0,0,0,0));d=ImageDraw.Draw(o)
d.polygon([(0,0),(150,0),(215,250),(270,90),(330,90),(385,250),(450,0),(600,0),(450,H),(330,H),(300,330),(270,H),(150,H)],fill=WHITE+(255,))
d.polygon([(150,0),(215,250),(150,H)],fill=(220,30,40,255))
t=mask('WESTRAC',font('BarlowCondensed-BlackItalic.ttf',160),track=10);t=t.resize((W,int(t.height*W/t.width)));o.alpha_composite(col(t,WHITE),(0,H+30));save(o,'westrac')
save(col(mask('REVOLUTION',font('BarlowCondensed-BlackItalic.ttf',300),track=8),WHITE),'revolution')
save(col(mask('iHear',font('Poppins-Medium.ttf',300)),WHITE),'ihear')
# small dark sticker panel helper output: ford oval, dunlop
save(Image.open(IMG+'3952a5b529.png').convert('RGBA'),'ford');save(Image.open(IMG+'4e18d3dc8c.png').convert('RGBA'),'dunlop')
