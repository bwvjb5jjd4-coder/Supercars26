/* s26 Supercars 26: the 2026 Gen3 grid (Ford Mustang GT, Chevrolet Camaro ZL1, Toyota GR Supra) as an Instant Race
   car set. The picker tabs become "Supercars 18" (the existing grid), "Road Cars" and "Supercars 26".
   The three bodies come from Riley's meshes, built by tools/s26/build_bodies.py into assets/s26/<body>_<make>.json.gz.bin
   in the same row format as the game's own asset pack. While a Supercars 26 car is being built, its body data stands in
   for the stock Falcon / Commodore data inside the normal car builder, so every Supercars 18 system (LODs, crumple and
   dent damage, bonnet loss, bumper and wheel damage, lamps, cockpit screens and mirrors, pit stops, AI, sound, physics)
   runs on it unchanged. Mustangs use the Ford chassis, Camaros and Supras the Holden chassis (the #96 Supra in the
   SCT/BJR seat rides on the Ford one). The race interior is copied in mirrored, so the driver sits on the right and the
   onboard camera moves across with him. Liveries: assets/s26/liveries (tools/s26/paint_liveries.py), loaded only when
   a Supercars 26 weekend starts. */
(function(){
'use strict';
const S26=window.S26={on:false,data:{},loading:{},tex:{},texLoading:{}};
const FILES={mustang_ford:'assets/s26/mustang_ford.json.gz.bin',camaro_holden:'assets/s26/camaro_holden.json.gz.bin',supra_holden:'assets/s26/supra_holden.json.gz.bin',supra_ford:'assets/s26/supra_ford.json.gz.bin'};
const MODEL={mustang:'Mustang GT',camaro:'Camaro ZL1',supra:'GR Supra'};
const BRAND={mustang:'Ford',camaro:'Chevrolet',supra:'Toyota'};
// RAW team index -> manufacturer the game runs it as (the chassis), and each seat's body, number and livery.
const MAKE={0:'Ford',1:'Ford',2:'Ford',3:'Holden',4:'Ford',5:'Holden',6:'Holden',7:'Holden',8:'Holden',9:'Holden',10:'Ford',11:'Ford'};
const ROSTER=/*S26_ROSTER*/{};
const LIVERY=/*S26_LIVERIES*/{};
S26.ROSTER=ROSTER;S26.LIVERY=LIVERY;S26.MAKE=MAKE;S26.MODEL=MODEL;

function active(){return typeof IR!=='undefined'&&IR.active&&!!IR.config?.s26;}
S26.active=active;
function seatOf(team,driver){const list=team?.drivers||[];const i=list.findIndex(d=>d.id===driver?.id);return i<0?-1:i;}
function entry(team,driver){if(!active()||!team)return null;const s=seatOf(team,driver);return s<0?null:ROSTER[team.id]?.[s]||null;}
S26.entry=entry;
function bodyKey(e,make){return e.body+'_'+String(make).toLowerCase();}

/* ---------- loading ---------- */
async function gunzipJSON(url){const res=await fetch(url);if(!res.ok)throw Error(url+' failed to load ('+res.status+')');
 return JSON.parse(await new Response(new Blob([await res.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).text());}
function loadBody(k){return S26.loading[k]||=gunzipJSON(FILES[k]).then(d=>{S26.data[k]=d;return d;});}
function liveryFiles(key){return{dds:'assets/s26/liveries/'+key+'.dds.gz.bin',webp:'assets/s26/liveries/'+key+'.webp'};}
let compressed=null;
function canDXT(){if(compressed!==null)return compressed;const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');compressed=!!g?.getExtension('WEBGL_compressed_texture_s3tc')&&!!g?.getExtension('WEBGL_compressed_texture_s3tc_srgb');g?.getExtension('WEBGL_lose_context')?.loseContext();return compressed;}
async function loadLivery(key){
 const f=liveryFiles(key);let tex;
 if(canDXT()){
  const raw=await (await fetch(f.dds)).arrayBuffer(),buf=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),h=new DataView(buf),mips=[];
  let w=h.getUint32(16,true),height=h.getUint32(12,true),off=128;
  for(let i=0;i<h.getUint32(28,true);i++){const size=Math.max(1,Math.ceil(w/4))*Math.max(1,Math.ceil(height/4))*8;mips.push({data:new Uint8Array(buf,off,size),width:w,height});off+=size;w=Math.max(1,w>>1);height=Math.max(1,height>>1);}
  tex=new THREE.CompressedTexture(mips,mips[0].width,mips[0].height,THREE.RGBA_S3TC_DXT1_Format);tex.generateMipmaps=false;tex.flipY=false;
 }else{
  const blob=await (await fetch(f.webp)).blob(),bm=await createImageBitmap(blob,{imageOrientation:'none'});const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);bm.close?.();
  tex=new THREE.CanvasTexture(c);tex.flipY=false;
 }
 tex.colorSpace=THREE.SRGBColorSpace;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.anisotropy=8;tex.needsUpdate=true;tex.name='s26_'+key;
 return tex;
}
// Everything a Supercars 26 weekend needs: the bodies on the grid and every livery.
function needed(){
 const bodies=new Set(),liveries=new Set();
 for(const t of (D?.world?.teams||[]))for(let s=0;s<2;s++){const e=ROSTER[t.id]?.[s];if(!e)continue;bodies.add(bodyKey(e,MAKE[t.id]));liveries.add(e.livery);}
 return{bodies:[...bodies],liveries:[...liveries]};
}
S26.ready=function(){const n=needed();return n.bodies.every(k=>S26.data[k])&&n.liveries.every(k=>S26.tex[k]);};
S26.prepare=function(){
 const n=needed();
 const jobs=n.bodies.map(loadBody).concat(n.liveries.map(k=>S26.texLoading[k]||=loadLivery(k).then(t=>{S26.tex[k]=t;register(k);return t;}).catch(e=>{console.warn('s26 livery',k,e);S26.tex[k]=placeholder(k);register(k);})));
 return Promise.all(jobs);
};
function placeholder(key){const L=LIVERY[key],c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=L?.paint?.[0]||'#888';x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;return t;}
// dc35Wrap finds liveries as RF41_TEXTURES[make+'_'+key]; register under both chassis.
function register(key){for(const m of ['Ford','Holden'])RF41_TEXTURES.set(m+'_s26'+key,S26.tex[key]);}

/* ---------- liveries as game profiles ---------- */
// The dash badge shows the car's own main sponsor (the stock code hard-wires Triple Eight to the Holden lion).
if(typeof in55LogoSource==='function'){const prev=in55LogoSource;in55LogoSource=function(make,key,team){
 if(typeof key==='string'&&key.startsWith('s26')){const L=LIVERY[key.slice(3)];return L?.logo?{src:L.logo}:null;}
 return prev.apply(this,arguments);};}
for(const [key,L] of Object.entries(LIVERY)){
 RF41_PROFILES['s26'+key]={brand:L.brand,hood:L.hood||L.brand,wing:L.wing||L.brand,paint:L.paint,partners:L.partners||[],year:2026};
 if(Array.isArray(window.RF49_BAKED)&&!RF49_BAKED.includes('s26'+key))RF49_BAKED.push('s26'+key);
}
try{if(typeof RF49_BAKED!=='undefined')for(const key of Object.keys(LIVERY))if(!RF49_BAKED.includes('s26'+key))RF49_BAKED.push('s26'+key);}catch(e){}
if(typeof sc27LiveryProfile==='function'){const prev=sc27LiveryProfile;sc27LiveryProfile=function(team,driver){
 const e=entry(team,driver);if(!e)return prev.apply(this,arguments);const L=LIVERY[e.livery]||{},p=L.paint||['#222','#ddd','#e10600'];
 return{key:'s26'+e.livery,brand:L.brand||'',hoodBrand:L.hood||L.brand,wingBrand:L.wing||L.brand,partners:[...(L.partners||[])],paint:{primary:p[0],secondary:p[1],tertiary:p[2]},seat:seatOf(team,driver),logoMake:team.manufacturer,year:2026,s26:true};};}

/* ---------- the 2026 grid ---------- */
const MFG_STOCK={};
function applyGrid(){
 const on=active();
 if(typeof MFG==='object'){
  for(const m of ['Ford','Holden']){if(!(m in MFG_STOCK))MFG_STOCK[m]=MFG[m]?.car;}
  if(MFG.Ford)MFG.Ford.car=on?'Mustang GT':MFG_STOCK.Ford;if(MFG.Holden)MFG.Holden.car=on?'Camaro ZL1':MFG_STOCK.Holden;
 }
 if(!on)return;
 for(const t of (D?.world?.teams||[])){
  const m=MAKE[t.id];if(!m)continue;if(t.manufacturer!==m)t.manufacturer=m;
  const r=ROSTER[t.id];if(!r)continue;
  t.carNumbers||={};t.carNumbers.main||=[];
  t.drivers.forEach((d,i)=>{const e=r[i];if(!e)return;if(d.number!==e.number){d.number=e.number;d.originalNumber=e.number;}t.carNumbers.main[i]=e.number;if(e.name&&d.name!==e.name)d.name=e.name;});
  const L=LIVERY[r[0]?.livery];if(L){t.customLivery=false;t.livery={primary:L.paint[0],secondary:L.paint[1],tertiary:L.paint[2]};}
 }
}
S26.applyGrid=applyGrid;
if(typeof sc25Normalize==='function'){const prev=sc25Normalize;sc25Normalize=function(){const r=prev.apply(this,arguments);try{applyGrid();}catch(e){console.warn(e);}return r;};}
if(typeof dcBindWorld==='function'){const prev=dcBindWorld;dcBindWorld=function(){const r=prev.apply(this,arguments);try{applyGrid();}catch(e){console.warn(e);}return r;};}

/* ---------- building a car on a Supercars 26 body ---------- */
// DC35_GEOMETRY caches merged geometry by make:level:player; while a Gen3 body is built the cache is keyed by body.
let building=null;
{const M=DC35_GEOMETRY,get=M.get.bind(M),has=M.has.bind(M),set=M.set.bind(M);
 M.get=k=>get(building?'s26:'+building+':'+k:k);M.has=k=>has(building?'s26:'+building+':'+k:k);M.set=function(k,v){return set(building?'s26:'+building+':'+k:k,v);};}
{const M=RF43_SURFACES,get=M.get.bind(M),has=M.has.bind(M),set=M.set.bind(M);
 M.get=k=>get(building?'s26:'+building+':'+k:k);M.has=k=>has(building?'s26:'+building+':'+k:k);M.set=function(k,v){return set(building?'s26:'+building+':'+k:k,v);};}
function withBody(make,key,fn){
 const stock=DC35_ASSETS.cars[make],body=S26.data[key];if(!body)return fn();
 const prevB=building;DC35_ASSETS.cars[make]={...stock,spec:body.spec,levels:body.levels,source:body.source};building=key;
 try{return fn();}finally{DC35_ASSETS.cars[make]=stock;building=prevB;}
}
S26.withBody=withBody;
// Right-hand drive: the cockpit pieces the later layers place for the left-hand seat move across.
const RHD_NAMES=['CP65 column display','IN55 centre screen','IN55 dash sponsor'];
function rhd(car){
 for(const p of car.userData.dc35Steering||[])if(p.position.x>0)p.position.x=-p.position.x;
 car.traverse(o=>{if(RHD_NAMES.includes(o.name)&&!o.userData.s26Rhd){o.position.x=-o.position.x;o.userData.s26Rhd=true;}});
}
S26.rhd=rhd;
if(typeof sc25Car==='function'){const prev=sc25Car;sc25Car=function(E,team,driver){
 const e=entry(team,driver);if(!e)return prev.apply(this,arguments);
 const key=bodyKey(e,team.manufacturer);if(!S26.data[key]){loadBody(key);return prev.apply(this,arguments);}
 if(!S26.tex[e.livery]){S26.tex[e.livery]=placeholder(e.livery);register(e.livery);}
 const car=withBody(team.manufacturer,key,()=>prev.apply(this,arguments));
 try{
  car.userData.s26={body:e.body,key,livery:e.livery};car.name=BRAND[e.body]+' '+MODEL[e.body]+' #'+driver.number;
  rhd(car);
 }catch(err){console.warn('s26 car',err);}
 return car;};}
// When a livery arrives after the cars were built, swap it into their paint.
S26.refreshLiveries=function(W){for(const car of W?.carNodes?.values()||[]){const s=car.userData.s26;if(!s)continue;const t=S26.tex[s.livery];car.traverse(o=>{const m=o.material;if(m&&m.map&&m.map!==t&&m.map.name!==t.name&&(o.userData.dc35Bucket==='paint'||o.userData.dc35Bucket==='hood')){m.map=t;m.needsUpdate=true;}});}};

// Driver's eye: the onboard camera sits in the right-hand seat (the stock eye is in the left).
const EYE_DY={supra:-.075,camaro:-.035,mustang:0};
if(typeof gr27Camera==='function'){const prev=gr27Camera;gr27Camera=function(W,L,dt){const r=prev.apply(this,arguments);try{
 if(typeof sc25Camera!=='undefined'&&sc25Camera==='onboard'&&L?.player){const car=W.carNodes?.get(L.player.d.id);if(car?.userData.s26){
  const body=D.settings.cameraMotion!==false?car.userData.dc35Chassis[0]:car;body.updateWorldMatrix(true,false);
  const ax=new THREE.Vector3(1,0,0).transformDirection(body.matrixWorld);W.camera.position.addScaledVector(ax,-2*(window.S26_EYE_X??.37));
  // the Supra and Camaro roofs sit lower over the seat than the stock Holden eye height
  const dy=EYE_DY[car.userData.s26.body]||0;if(dy){const ay=new THREE.Vector3(0,1,0).transformDirection(body.matrixWorld);W.camera.position.addScaledVector(ay,dy);}W.camera.updateMatrixWorld();}}
}catch(e){console.warn(e);}return r;};}

/* ---------- Instant Race ---------- */
function esc3(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function s26Options(sel){
 return `<optgroup label="Supercars 26">`+RAW.map((t,team)=>[0,1].map(seat=>{const e=ROSTER[team]?.[seat];if(!e)return '';const L=LIVERY[e.livery]||{};
  return `<option value="s26:${team}:${seat}" ${sel===team+':'+seat?'selected':''}>#${e.number} · ${esc3(L.brand||'')} · ${BRAND[e.body]} ${MODEL[e.body]}</option>`;}).join('')).join('')+`</optgroup>`;
}
if(typeof irCarOptions==='function'){const prev=irCarOptions;irCarOptions=function(selected){
 const on=!!IR.config?.s26&&!IR.config?.sc54&&!IR.config?.ve89;let html=prev.apply(this,arguments);
 if(on)html=html.replace(/(<option value="\d+:\d+") selected/,'$1');
 return html+s26Options(on?IR.config.car:null);};}
if(typeof irStart==='function'){const prev=irStart;irStart=function(form){
 const sel=form?.elements?.namedItem('car'),v=sel?.value||'',m=/^s26:(\d+):(\d+)$/.exec(v);
 if(m&&sel){const val=m[1]+':'+m[2];if(sel.tagName==='SELECT'){if(![...sel.options].some(o=>o.value===val)){const o=document.createElement('option');o.value=val;sel.appendChild(o);}}sel.value=val;}
 const r=prev.apply(this,arguments);
 if(IR.active&&IR.config){IR.config.s26=!!m;if(m){IR.config.sc54=false;IR.config.ve89=null;}applyGrid();if(m){S26.prepare().catch(e=>console.warn(e));}irSave();if(typeof irRender==='function')irRender();}
 return r;};}
if(typeof irResume==='function'){const prev=irResume;irResume=function(){const r=prev.apply(this,arguments);try{applyGrid();if(active())S26.prepare().catch(e=>console.warn(e));}catch(e){}return r;};}
if(typeof irExit==='function'){const prev=irExit;irExit=function(){const r=prev.apply(this,arguments);try{applyGrid();}catch(e){}return r;};}
// Hold the green light until the Gen3 bodies and liveries are in memory (a second or two on the first weekend).
if(typeof dcLaunch==='function'){const prev=dcLaunch;dcLaunch=function(){
 if(active()&&!S26.ready()){const args=arguments,self=this;if(typeof toast==='function')toast('Loading the Supercars 26 cars…');S26.prepare().then(()=>prev.apply(self,args)).catch(e=>{console.warn(e);prev.apply(self,args);});return;}
 return prev.apply(this,arguments);};}

/* ---------- picker tiles ---------- */
const ART=k=>'assets/img/s26_'+k+'.webp';
function tile(b){
 const v=b.dataset.value||'',m=/^s26:(\d+):(\d+)$/.exec(v);if(!m)return;if(b.dataset.s26===v)return;b.dataset.s26=v;
 const e=ROSTER[m[1]]?.[m[2]];if(!e)return;const L=LIVERY[e.livery]||{};
 const check=b.querySelector('.ui26-option-check')?.outerHTML||'',act=b.querySelector('.ui26-collection-action')?.outerHTML||'';
 b.innerHTML=`<img class="ui26-tile-car s26-tile-car" src="${ART(e.livery+'_'+e.number)}" onerror="this.onerror=null;this.src='${ART(e.livery)}'" alt="" loading="lazy"><span class="ui26-tile-copy"><small>#${e.number} · ${BRAND[e.body]} ${MODEL[e.body]}</small><strong>${esc3(L.brand||'')}</strong><span>${esc3(e.name||RAW[m[1]][2+ +m[2]])} · ${esc3(RAW[m[1]][0])}</span></span>`+check+act;
}
function onDom(){for(const b of document.querySelectorAll('.ui26-option[data-value^="s26:"],.ui26-collection-tile[data-value^="s26:"]'))tile(b);}
let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{onDom();}catch(e){console.warn(e);}});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-value']});

// A saved Supercars 26 weekend starts loading its cars as soon as the page is up.
setTimeout(()=>{try{if(active())S26.prepare().catch(()=>{});}catch(e){}},1500);
})();
