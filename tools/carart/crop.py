from PIL import Image
import glob,os,numpy as np
os.makedirs('out',exist_ok=True)
for f in sorted(glob.glob('car_*.png')):
  n=f[4:-4]; im=Image.open(f).convert('RGBA')
  a=np.array(im)[:,:,3]
  ys,xs=np.where(a>200)  # body only for fitting
  x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
  s=min(600/(x1-x0),300/(y1-y0))
  big=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
  cx=(x0+x1)/2*s; cy=(y0+y1)/2*s
  out=Image.new('RGBA',(900,520),(0,0,0,0))
  out.paste(big,(int(470-cx),int(285-cy)),big)
  out.save(f'out/{n}.webp',quality=90,method=6)
  out.save(f'out/{n}.png')
print('ok')
