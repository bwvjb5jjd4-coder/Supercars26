/* CP65: cockpit rework for the Falcon and the ZB Commodore.
   The low-poly steering wheel from the car models is swapped for a smooth one (round rim,
   three spokes, carbon hub with buttons and knobs) that turns on the same pivot.
   Speed, gear and fuel now read out of a display set flush into the steering column
   housing behind the wheel, with shift lights along its top edge, like a real car.
   The centre screen keeps race info: position, fuel, tyre temperature and damage,
   under a digital logo of the car's main sponsor. */

// Car space (+Z forward, +X the car's left, driver at x .37). face: centre of the display on the
// column housing, tilt: degrees the face leans away from the driver at the top. drop: metres the
// wheel sits lower than the model's pivot, so the hub doesn't hide the display (the Falcon's
// housing sits close behind its wheel).
const CP65_COLUMN={
 Holden:{face:[.399,.94,.664],tilt:7,w:.19,h:.062},
 Ford:{face:[.37,.912,.591],tilt:-20,w:.17,h:.044,drop:.03}
};

function cp65Mats(E){
 const T=THREE;
 return E.cp65Mats||={
  grip:new T.MeshStandardMaterial({color:'#141517',roughness:.88,metalness:0}),
  spoke:new T.MeshStandardMaterial({color:'#2b2f34',roughness:.32,metalness:.65}),
  hub:new T.MeshStandardMaterial({color:'#17191c',roughness:.42,metalness:.25}),
  housing:new T.MeshStandardMaterial({color:'#08090a',roughness:.75,metalness:.05}),
  glass:new T.MeshBasicMaterial({color:'#d8dee0',toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
  button:['#d8282b','#f0b51c','#2a7de1','#2fbf5b','#e8e8e8'].map(c=>new T.MeshStandardMaterial({color:c,roughness:.35,metalness:.1,emissive:c,emissiveIntensity:.12}))
 };
}

// Smooth wheel geometry, shared by every car. Local space of the steering pivot: the wheel lies
// in XY and the driver looks at it from -Z.
function cp65WheelParts(){
 if(cp65WheelParts.cache)return cp65WheelParts.cache;
 const T=THREE,parts=[];
 const rim=new T.TorusGeometry(.166,.0205,28,192);rim.scale(1,1,1.2);parts.push(['grip',rim]);
 const hub=new T.Shape(),hw=.068,hh=.036,r=.016;
 hub.moveTo(-hw+r,-hh);hub.lineTo(hw-r,-hh);hub.quadraticCurveTo(hw,-hh,hw,-hh+r);hub.lineTo(hw,hh-r);hub.quadraticCurveTo(hw,hh,hw-r,hh);
 hub.lineTo(-hw+r,hh);hub.quadraticCurveTo(-hw,hh,-hw,hh-r);hub.lineTo(-hw,-hh+r);hub.quadraticCurveTo(-hw,-hh,-hw+r,-hh);
 const plate=new T.ExtrudeGeometry(hub,{depth:.022,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:4,curveSegments:16});
 plate.translate(0,-.032,-.008);plate.computeVertexNormals();parts.push(['hub',plate]);
 // Spokes: flattened capsules from the hub out to the rim at 3, 9 and 6 o'clock.
 for(const [ang,len] of [[0,.1],[Math.PI,.1],[-Math.PI/2,.11]]){
  const s=new T.CapsuleGeometry(.013,len,8,24);s.scale(1,1,.55);s.rotateZ(ang-Math.PI/2);
  const mid=(len/2)+.06;s.translate(Math.cos(ang)*mid,Math.sin(ang)*mid,.004);parts.push(['spoke',s]);
 }
 // Buttons and two rotary knobs on the hub face.
 const btn=(x,y,rad,mat)=>{const c=new T.CylinderGeometry(rad,rad,.006,28);c.rotateX(Math.PI/2);c.translate(x,y,-.0155);parts.push([mat,c]);};
 [[-.046,-.012,0],[-.046,-.032,1],[-.046,-.052,2],[.046,-.012,3],[.046,-.032,4],[.046,-.052,0]].forEach(([x,y,m])=>btn(x,y,.0062,'button'+m));
 for(const x of [-.018,.018]){const k=new T.CylinderGeometry(.009,.01,.012,32);k.rotateX(Math.PI/2);k.translate(x,-.05,-.018);parts.push(['spoke',k]);}
 return cp65WheelParts.cache=parts;
}

function cp65Wheel(E,car){
 const T=THREE,M=cp65Mats(E),drop=CP65_COLUMN[car.userData.make].drop||0;
 for(const pivot of car.userData.dc35Steering||[]){
  if(!pivot.userData.cp65Drop){pivot.position.y-=drop;pivot.userData.cp65Drop=true;}
  for(const c of pivot.children)if(!c.userData.cp65)c.visible=false;
  const g=new T.Group();g.name='CP65 wheel';g.userData.cp65=true;
  for(const [mat,geo] of cp65WheelParts()){const m=new T.Mesh(geo,mat.startsWith('button')?M.button[+mat.slice(6)]:M[mat]);m.userData.cp65=true;g.add(m);}
  pivot.add(g);
 }
}

// The display in the column housing: a flush black glass panel with a thin surround.
function cp65Column(E,car){
 const T=THREE,spec=CP65_COLUMN[car.userData.make],M=cp65Mats(E),rad=Math.PI/180;
 if(!E.cp65ColTex){const c=document.createElement('canvas');c.width=640;c.height=205;E.cp65ColTex=new T.CanvasTexture(c);E.cp65ColTex.colorSpace=T.SRGBColorSpace;E.cp65ColTex.anisotropy=8;}
 const glass=M.glass.clone();glass.map=E.cp65ColTex;
 for(const root of car.userData.dc35Chassis){
  const g=new T.Group();g.name='CP65 column display';g.position.set(...spec.face);g.rotation.set(spec.tilt*rad,0,0,'YXZ');
  const surround=new T.Mesh(new T.BoxGeometry(spec.w+.014,spec.h+.014,.012),M.housing);surround.position.z=.002;
  const panel=new T.Mesh(new T.PlaneGeometry(spec.w,spec.h),glass);panel.rotation.y=Math.PI;panel.position.z=-.0045;
  for(const m of [surround,panel])m.userData.cp65=true;g.add(surround,panel);root.add(g);
 }
}

// The car's main sponsor as a full-colour image for the centre screen.
function cp65Logo(make,key,team,brand){
 cp65Logo.cache||={};const id=make+'_'+key+'_'+(team?.id??'');if(cp65Logo.cache[id])return cp65Logo.cache[id];
 const out=cp65Logo.cache[id]={img:null,text:String(brand||'').toUpperCase(),plate:false};
 const src=in55LogoSource(make,key,team),img=new Image();
 img.onload=()=>{const c=document.createElement('canvas'),s=Math.min(1,256/img.height);c.width=Math.max(1,img.width*s);c.height=Math.max(1,img.height*s);const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);
  // Dark lettering would vanish on the black screen, so it gets a light plate.
  try{const d=x.getImageData(0,0,c.width,c.height).data;let n=0,l=0;for(let i=0;i<d.length;i+=16){if(d[i+3]<60)continue;n++;l+=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;}out.plate=n>0&&l/n<.3;}catch(_){}
  out.img=c;};
 if(src?.holden){out.text='HOLDEN';img.src=RF43_LOGO_DATA?.['Holden Lion']?.data||'assets/img/299b51591e.png';out.holden=true;}
 else if(src?.src)img.src=src.src;
 return out;
}

const cp65Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=cp65Car(E,team,driver),make=car?.userData?.make;
 if(!CP65_COLUMN[make])return car;
 // Only cockpits that got the in55 centre screen (the player's car, and player 2's in Co-Op).
 let cockpit=false;car.traverse(o=>{if(o.name==='IN55 centre screen')cockpit=true;});
 if(!cockpit)return car;
 try{cp65Wheel(E,car);cp65Column(E,car);const skin=sc27LiveryProfile(team,driver);car.userData.cp65Logo=cp65Logo(make,skin.key,team,skin.brand);}catch(e){console.warn('CP65 cockpit',e);}
 return car;
};

function cp65Shift(p){
 const gear=dcGear(p),speed=p.speed,low=[0,0,65,108,151,196,246][+gear||1],hi=[0,65,108,151,196,246,320][+gear||1];
 return {gear,speed:Math.round(speed),rpm:clamp((speed-low)/(hi-low),0,1)};
}

// Column display: shift lights, speed, gear and fuel.
function cp65DrawColumn(W,L){
 const tex=W.cp65ColTex;if(!tex)return;
 const p=L.player,c=tex.image.getContext('2d'),w=c.canvas.width,h=c.canvas.height,{gear,speed,rpm}=cp65Shift(p);
 c.fillStyle='#050708';c.fillRect(0,0,w,h);
 const n=12,gap=10,lw=(w-60-gap*(n-1))/n,flash=rpm>.94&&Math.floor(W.clock*12)%2;
 for(let i=0;i<n;i++){const on=rpm*n>i+.25,col=i<4?'#38e07b':i<8?'#ffcc33':'#ff3b3b';c.fillStyle=on?(flash?'#5aa9ff':col):'#131a1e';c.beginPath();c.arc(30+lw/2+i*(lw+gap),20,Math.min(lw/2,11),0,Math.PI*2);c.fill();}
 c.textBaseline='alphabetic';
 c.textAlign='left';c.fillStyle='#f1f5f6';c.font='800 92px Arial';c.fillText(String(speed),24,158,210);
 c.fillStyle='#7d929c';c.font='700 22px Arial';c.fillText('KM/H',28,192);
 c.textAlign='center';c.fillStyle=gear==='N'?'#9fb3bb':gear==='R'?'#ff6b5c':rpm>.9?'#ff4b3b':'#ffd25c';c.font='900 150px Arial';c.fillText(gear,w/2,180);
 const fuel=p.fuel??0;
 c.textAlign='right';c.fillStyle=fuel<8?'#ff8a5c':'#f1f5f6';c.font='800 72px Arial';c.fillText(fuel.toFixed(1),w-24,150,200);
 c.fillStyle='#7d929c';c.font='700 22px Arial';c.fillText('FUEL L',w-28,192);
 tex.needsUpdate=true;
}

function cp65RoundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

// Centre screen: sponsor, position, fuel, tyre temperature and damage.
dc36DrawDash=function(W,L){
 if(!W.dc35DashTex||W.clock-(W.dc36DashAt??-1)<.09)return;W.dc36DashAt=W.clock;
 try{cp65DrawColumn(W,L);}catch(e){}
 const p=L.player,c=W.dc35DashTex.image.getContext('2d'),w=c.canvas.width,h=c.canvas.height,d=dcDistances();
 const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0a1116');bg.addColorStop(1,'#030608');c.fillStyle=bg;c.fillRect(0,0,w,h);
 c.textBaseline='alphabetic';
 // Sponsor banner
 const logo=W.carNodes?.get(p.d?.id)?.userData?.cp65Logo,bx=24,by=16,bw=w-48,bh=96;
 cp65RoundRect(c,bx,by,bw,bh,12);c.fillStyle=logo?.plate?'#e9eef0':'#0d171d';c.fill();
 if(logo?.img){const im=logo.img,maxW=logo.holden?bh*1.1:bw-40,s=Math.min(maxW/im.width,(bh-20)/im.height),dw=im.width*s,dh=im.height*s;
  if(logo.holden){const tw=(c.font='700 64px Arial',c.measureText('Holden').width),x0=(w-(dw+18+tw))/2;c.drawImage(im,x0,by+(bh-dh)/2,dw,dh);c.textAlign='left';c.fillStyle='#e6ebee';c.fillText('Holden',x0+dw+18,by+bh/2+23);}
  else c.drawImage(im,(w-dw)/2,by+(bh-dh)/2,dw,dh);}
 else if(logo?.text){c.textAlign='center';c.fillStyle='#e6ebee';c.font='800 60px Arial';c.fillText(logo.text,w/2,by+bh/2+21,bw-40);}
 // Position
 const order=typeof dcLiveOrder==='function'?dcLiveOrder():[],pos=order.indexOf(p)+1;
 cp65RoundRect(c,24,128,250,190,12);c.fillStyle='#0d171d';c.fill();
 c.textAlign='left';c.fillStyle='#7f96a1';c.font='700 22px Arial';c.fillText(L.stage==='race'?'POSITION':'SESSION',42,162);
 c.fillStyle='#f2f7f8';c.font='800 96px Arial';c.fillText(pos?'P'+pos:'—',38,260,220);
 c.fillStyle='#9fb3bb';c.font='700 24px Arial';c.fillText(p.pitStage?(p.dc33PitLimited?'PIT LIMITER':'PIT LANE'):'LAP '+Math.max(1,Math.floor(p.progress)+1)+(order.length?' · '+order.length+' CARS':''),42,300,220);
 // Fuel, tyre temperature, damage
 const temp=Math.round(p.tyreTemp||34),dmg=Math.round(p.bodyDamage||0),tempCol=temp<70?'#5aa9ff':temp>105?'#ff8a5c':'#6fe0b6',dmgCol=dmg>40?'#ff5a4a':dmg>20?'#ff8a5c':'#6fe0b6';
 const tiles=[['FUEL',(p.fuel??0).toFixed(1)+' L',(p.fuel??0)<8?'#ff8a5c':'#cfe3e6',null],['TYRE TEMP',temp+'°',tempCol,clamp((temp-30)/90,0,1)],['DAMAGE',dmg+'%',dmgCol,clamp(dmg/100,0,1)]];
 const tx=290,tw=w-tx-24,th=58;
 tiles.forEach(([k,v,col,bar],i)=>{const y=128+i*(th+8);cp65RoundRect(c,tx,y,tw,th,10);c.fillStyle='#0d171d';c.fill();
  c.textAlign='left';c.fillStyle='#6f8792';c.font='700 20px Arial';c.fillText(k,tx+16,y+36);
  c.textAlign='right';c.fillStyle=col;c.font='800 40px Arial';c.fillText(v,tx+tw-16,y+44);
  if(bar!==null){c.fillStyle='#1b2a31';c.fillRect(tx+16,y+th-10,150,4);c.fillStyle=col;c.fillRect(tx+16,y+th-10,150*bar,4);}});
 // Gaps
 c.fillStyle='#0d171d';cp65RoundRect(c,24,334,w-48,48,10);c.fill();c.font='700 22px Arial';c.textAlign='left';c.fillStyle='#8aa2ad';c.fillText('AHEAD  '+d.ahead,40,366,(w-96)/2);c.textAlign='right';c.fillText('BEHIND  '+d.behind,w-40,366,(w-96)/2);
 // Flag strip
 c.fillStyle=L.scTrain?'#f2c230':p.pitStage?'#5aa9ff':'#1f3a44';c.fillRect(24,h-38,w-48,8);
 const sh=c.createLinearGradient(0,0,w,h);sh.addColorStop(0,'rgba(255,255,255,.07)');sh.addColorStop(.35,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(255,255,255,.02)');c.fillStyle=sh;c.fillRect(0,0,w,h);
 W.dc35DashTex.needsUpdate=true;
};
