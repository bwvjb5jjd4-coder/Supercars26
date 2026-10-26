/* IN55: realistic centre-dash screen, dash sponsor logo and a hideable speed HUD.
   The old centre display was drawn with depth testing off, so it showed through the
   bodywork from every camera. It is replaced by a depth-tested screen set into the middle
   of the ZB and Falcon dashboards, inside a gloss-black housing angled toward the driver.
   Above it, a subtle print of the car's main sponsor sits on the dash plastic
   (Triple Eight cars carry Holden). T (or the controller View button) hides or shows the
   on-screen speed HUD; the choice is kept in settings. */

// Measured from the dash surfaces of each model (car space: +Z forward, +X the car's left, driver at x .37).
const IN55_DASH={
 Holden:{screen:[-.12,.80,.618],tilt:12,w:.24,h:.135,logo:[-.12,.907,.80],logoTilt:82,logoW:.19},
 Ford:{screen:[-.12,.885,.545],tilt:33,w:.22,h:.124,logo:[-.12,.942,.72],logoTilt:84,logoW:.19}
};
const IN55_YAW=-10; // degrees, turns the screen toward the driver's seat

// The old screen meshes stay hidden; the new unit is added by the sc25Car wrapper below.
rf44CentreDash=function(E,car){
 for(const root of car.userData.dc35Chassis)root.traverse(o=>{if(o.isMesh&&['screen','screen2','led'].includes(o.userData.dc35Bucket))o.visible=false;});
 car.userData.rf44DashBelowWindscreen=true;
};

function in55LogoSource(make,key,team){
 if(team&&(team.id===0||/triple eight/i.test(team.name||'')))return {holden:true};
 const data=typeof RF43_LOGO_DATA!=='undefined'?RF43_LOGO_DATA:{},base=key==='freightzb'?'freight':key;
 const hit=data['RF43 Boot '+make+'_'+base]||data['RF43 Boot Ford_'+base]||data['RF43 Boot Holden_'+base];
 return hit?{src:hit.data}:null;
}

// A muted, satin print: colours pulled toward grey, near-black ink lifted so it reads on dark plastic.
function in55LogoTexture(E,make,key,team,brand){
 E.in55Logos||={};const id=make+'_'+key+'_'+(team?.id??'');if(E.in55Logos[id])return E.in55Logos[id];
 const c=document.createElement('canvas');c.width=1024;c.height=320;const x=c.getContext('2d'),tex=new THREE.CanvasTexture(c);
 tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;E.in55Logos[id]=tex;
 const finish=()=>{const img=x.getImageData(0,0,c.width,c.height),d=img.data;let opaque=0,dark=0,light=0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<40)continue;const l=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;opaque++;if(l<.22)dark++;else if(l>.75)light++;}
  const boxed=dark>opaque*.45&&light>opaque*.08; // light lettering on a dark plate: drop the plate
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const l=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;
   if(l<.22){if(boxed){d[i+3]=0;continue;}d[i]=d[i+1]=d[i+2]=158;continue;}
   for(let k=0;k<3;k++)d[i+k]=Math.round(l*255*.6+d[i+k]*.4);}
  x.putImageData(img,0,0);tex.needsUpdate=true;};
 const fit=(img,left,top,w,h)=>{const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;x.drawImage(img,left+(w-dw)/2,top+(h-dh)/2,dw,dh);};
 const source=in55LogoSource(make,key,team);
 const text=label=>{x.fillStyle='#b9bec2';x.font='800 150px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(label,512,165,980);finish();};
 if(source?.holden){const lion=new Image();lion.onload=()=>{fit(lion,40,20,280,280);x.fillStyle='#c4c9cc';x.font='700 170px Arial';x.textAlign='left';x.textBaseline='middle';x.fillText('Holden',345,170,640);finish();};lion.onerror=()=>text('HOLDEN');lion.src=RF43_LOGO_DATA?.['Holden Lion']?.data||'assets/img/299b51591e.png';}
 else if(source?.src){const img=new Image();img.onload=()=>{fit(img,20,10,984,300);finish();};img.onerror=()=>text(String(brand||'').toUpperCase());img.src=source.src;}
 else text(String(brand||'').toUpperCase());
 return tex;
}

function in55Interior(E,car,team,driver){
 const T=THREE,make=car.userData.make,spec=IN55_DASH[make];if(!spec||!E.dc35DashTex)return;
 const skin=sc27LiveryProfile(team,driver),logo=in55LogoTexture(E,make,skin.key,team,skin.brand),rad=Math.PI/180;
 E.in55Mats||={
  housing:new T.MeshStandardMaterial({color:'#0b0d0f',roughness:.3,metalness:.15}),
  bezel:new T.MeshStandardMaterial({color:'#020304',roughness:.12,metalness:.05}),
  screen:new T.MeshBasicMaterial({map:E.dc35DashTex,color:'#d9dee0',toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})
 };
 const M=E.in55Mats,logoMat=new T.MeshBasicMaterial({map:logo,color:'#9aa0a4',transparent:true,opacity:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
 for(const root of car.userData.dc35Chassis){
  const g=new T.Group();g.name='IN55 centre screen';g.position.set(...spec.screen);g.rotation.set(spec.tilt*rad,IN55_YAW*rad,0,'YXZ');
  const housing=new T.Mesh(new T.BoxGeometry(spec.w+.034,spec.h+.034,.075),M.housing);housing.position.z=.0395;
  const bezel=new T.Mesh(new T.PlaneGeometry(spec.w+.012,spec.h+.012),M.bezel);bezel.rotation.y=Math.PI;bezel.position.z=-.001;
  const screen=new T.Mesh(new T.PlaneGeometry(spec.w,spec.h),M.screen);screen.rotation.y=Math.PI;screen.position.z=-.0025;
  g.add(housing,bezel,screen);
  const badge=new T.Mesh(new T.PlaneGeometry(spec.logoW,spec.logoW*320/1024),logoMat);badge.name='IN55 dash sponsor';
  badge.position.set(...spec.logo);badge.rotation.set(-spec.logoTilt*rad,Math.PI,0,'YXZ');
  for(const m of [housing,bezel,screen,badge])m.userData.in55=true;
  root.add(g,badge);
 }
}

const in55Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=in55Car(E,team,driver);
 if(driver?.id===D?.pid&&car?.userData?.dc35Chassis)try{in55Interior(E,car,team,driver);}catch(e){console.warn('IN55 interior',e);}
 return car;
};

// Screen artwork, redrawn about eleven times a second.
function in55RoundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
dc36DrawDash=function(W,L){
 if(!W.dc35DashTex||W.clock-(W.dc36DashAt??-1)<.09)return;W.dc36DashAt=W.clock;
 const p=L.player,c=W.dc35DashTex.image.getContext('2d'),w=c.canvas.width,h=c.canvas.height,speed=Math.round(p.speed),gear=dcGear(p),
  low=[0,0,65,108,151,196,246][+gear||1],hi=[0,65,108,151,196,246,320][+gear||1],rpm=clamp((speed-low)/(hi-low),0,1),d=dcDistances();
 const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0a1116');bg.addColorStop(1,'#030608');c.fillStyle=bg;c.fillRect(0,0,w,h);
 // Shift lights
 const n=15,gap=6,lw=(w-48-gap*(n-1))/n;for(let i=0;i<n;i++){const on=rpm*n>i+.2,col=i<6?'#3ddc84':i<11?'#ffcc33':'#ff3b3b';c.fillStyle=on?(rpm>.93&&Math.floor(W.clock*10)%2?'#5aa9ff':col):'#152129';in55RoundRect(c,24+i*(lw+gap),16,lw,14,4);c.fill();}
 c.textBaseline='alphabetic';
 // Speed
 c.textAlign='left';c.fillStyle='#7f96a1';c.font='700 22px Arial';c.fillText('KM/H',36,74);
 c.fillStyle='#f2f7f8';c.font='800 118px Arial';c.fillText(String(speed),30,186);
 // Gear
 in55RoundRect(c,w/2-70,52,140,150,16);c.fillStyle='#0f1b22';c.fill();c.strokeStyle=rpm>.88?'#ff3b3b':'#2c434e';c.lineWidth=3;c.stroke();
 c.textAlign='center';c.fillStyle=gear==='N'?'#9fb3bb':'#ffc95c';c.font='900 124px Arial';c.fillText(gear,w/2,177);
 // Race info
 const order=typeof dcLiveOrder==='function'?dcLiveOrder():[],pos=order.indexOf(p)+1;
 c.textAlign='right';c.fillStyle='#7f96a1';c.font='700 22px Arial';c.fillText(L.stage==='race'?'POSITION':'SESSION',w-36,74);
 c.fillStyle='#f2f7f8';c.font='800 64px Arial';c.fillText(pos?'P'+pos:'—',w-36,136);
 c.fillStyle='#9fb3bb';c.font='700 26px Arial';c.fillText(p.pitStage?(p.dc33PitLimited?'PIT LIMITER':'PIT LANE'):'LAP '+Math.max(1,Math.floor(p.progress)+1),w-36,182);
 // Tiles
 const tiles=[['FUEL',p.fuel.toFixed(1)+' L','#cfe3e6'],['TYRES',Math.round(p.rdWear)+'%',p.rdWear>60?'#ffb15c':'#cfe3e6'],['DAMAGE',Math.round(p.bodyDamage)+'%',p.bodyDamage>20?'#ff8a5c':'#6fe0b6'],['TYRE TEMP',Math.round(p.tyreTemp||34)+'°',(p.tyreTemp||34)>105?'#ff8a5c':'#cfe3e6']];
 const tw=(w-48-3*10)/4;tiles.forEach(([k,v,col],i)=>{const x=24+i*(tw+10);in55RoundRect(c,x,222,tw,92,10);c.fillStyle='#0d171d';c.fill();c.textAlign='left';c.fillStyle='#6f8792';c.font='700 18px Arial';c.fillText(k,x+14,250);c.fillStyle=col;c.font='800 36px Arial';c.fillText(v,x+14,296,tw-24);});
 // Gaps
 c.fillStyle='#0d171d';in55RoundRect(c,24,328,w-48,48,10);c.fill();c.font='700 22px Arial';c.textAlign='left';c.fillStyle='#8aa2ad';c.fillText('AHEAD  '+d.ahead,40,360,(w-96)/2);c.textAlign='right';c.fillText('BEHIND  '+d.behind,w-40,360,(w-96)/2);
 // Flag strip
 c.fillStyle=L.scTrain?'#f2c230':p.pitStage?'#5aa9ff':'#1f3a44';c.fillRect(24,h-38,w-48,8);
 // Glass sheen
 const sh=c.createLinearGradient(0,0,w,h);sh.addColorStop(0,'rgba(255,255,255,.07)');sh.addColorStop(.35,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(255,255,255,.02)');c.fillStyle=sh;c.fillRect(0,0,w,h);
 W.dc35DashTex.needsUpdate=true;
};

// T / controller View button: hide or show the on-screen speed HUD (the in-car screen stays).
const in55Style=document.createElement('style');
in55Style.textContent='body.in55-hud-off .dc-dash,body.in55-hud-off .dc-rpm{display:none!important}'+
 '.in55-toast{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:60;padding:9px 16px;border-radius:9px;background:#07101ae6;border:1px solid #9fb3c33a;color:#dce7ec;font:600 12px/1.3 Arial,sans-serif;letter-spacing:.06em;pointer-events:none;opacity:0;transition:opacity .25s}'+
 '.in55-toast.on{opacity:1}';
document.head.appendChild(in55Style);
function in55ApplyHud(){document.body.classList.toggle('in55-hud-off',!!(live?.dc&&D?.settings?.in55HudHidden));}
function in55ToggleHud(){
 if(!live?.dc||live.paused||!D)return;D.settings.in55HudHidden=!D.settings.in55HudHidden;in55ApplyHud();
 let t=document.querySelector('.in55-toast');if(!t){t=document.createElement('div');t.className='in55-toast';document.body.appendChild(t);}
 t.textContent=D.settings.in55HudHidden?'SPEED HUD HIDDEN · PRESS T TO SHOW':'SPEED HUD SHOWN · PRESS T TO HIDE';t.classList.add('on');clearTimeout(t.in55Timer);t.in55Timer=setTimeout(()=>t.classList.remove('on'),1600);
 try{dcSave();}catch(_){}
}
document.addEventListener('keydown',e=>{if(e.code!=='KeyT'||e.repeat||!live?.dc||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;e.preventDefault();in55ToggleHud();});
let in55PadView=false;
setInterval(()=>{in55ApplyHud();let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch(_){}
 const down=!!pad?.buttons[8]?.pressed;if(down&&!in55PadView)in55ToggleHud();in55PadView=down;},50);
const in55Markup=dcDriveMarkup;
dcDriveMarkup=function(){return in55Markup().replace('Z LEADERBOARD SIZE / HIDE','Z LEADERBOARD SIZE / HIDE<br>T / VIEW BUTTON · HIDE SPEED HUD');};
