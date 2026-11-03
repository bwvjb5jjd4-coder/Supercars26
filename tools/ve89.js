/* ve89 road cars: four VE Commodores from Riley's model pack (SS-V sedan, SS ute, SS-V Sportwagon and the
   2012 VE V8 Supercar), playable in Instant Race. The car picker gets two tabs: "Supercars" (the grid)
   and "Road Cars" (the BMW M4 CSL safety car and the four VEs).
   Geometry: assets/roadcars/ve_<key>.gz.bin, built by tools/roadcars/build_ve.py (about 105k triangles
   per car, down from 0.8-1.2 million, plus a 3k triangle shadow proxy). Only the car you pick is loaded.
   Like the sc54 safety car, the chosen seat's car node keeps driving physics, cameras and lights; its own
   meshes move to a hidden layer and the VE rides on its chassis. */
(function(){
'use strict';
const T=THREE;
const CARS={
 sedan:{name:'Commodore SS-V',sub:'VE sedan · 6.0 L V8',file:'assets/roadcars/ve_sedan.gz.bin',paint:'redhot',road:true},
 ute:{name:'Commodore SS ute',sub:'VE ute · 6.0 L V8',file:'assets/roadcars/ve_ute.gz.bin',paint:'sizzle',road:true},
 wagon:{name:'Commodore SS-V Sportwagon',sub:'VE Sportwagon · 6.0 L V8',file:'assets/roadcars/ve_wagon.gz.bin',paint:'nitrate',road:true},
 v8:{name:'VE V8 Supercar',sub:'2012 Commodore race car · 5.0 L V8',file:'assets/roadcars/ve_v8.gz.bin',paint:'heron',road:false}
};
// Holden's VE colour chart. Metallic colours get flake in the base coat under a clear coat.
const PAINTS={
 redhot:{name:'Red Hot',hex:'#a3060c',metal:.15,rough:.42},
 sizzle:{name:'Sizzle',hex:'#d2520e',metal:.55,rough:.36},
 heron:{name:'Heron White',hex:'#e9e9e4',metal:0,rough:.42},
 phantom:{name:'Phantom',hex:'#08090b',metal:.6,rough:.3},
 nitrate:{name:'Nitrate',hex:'#9da2a8',metal:.85,rough:.3},
 voodoo:{name:'Voodoo Blue',hex:'#123c86',metal:.75,rough:.3},
 karma:{name:'Karma',hex:'#3d0b2a',metal:.7,rough:.3},
 atomic:{name:'Atomic',hex:'#e7bd12',metal:.25,rough:.38},
 mysterious:{name:'Mysterious',hex:'#1b3a2c',metal:.7,rough:.3}
};
const ROAD=['m4','sedan','ute','wagon','v8'];
const VE89={CARS,PAINTS,ROAD,data:{},loading:{},art:{m4:'assets/img/ve89_m4.webp',sedan:'assets/img/ve89_sedan.webp',ute:'assets/img/ve89_ute.webp',wagon:'assets/img/ve89_wagon.webp',v8:'assets/img/ve89_v8.webp'}};
window.VE89=VE89;

function load(key){
 if(VE89.loading[key])return VE89.loading[key];
 return VE89.loading[key]=(async()=>{
  const res=await fetch(CARS[key].file);if(!res.ok)throw Error('VE model failed to load ('+res.status+')');
  const buf=await new Response(new Blob([await res.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const hlen=new DataView(buf).getUint32(0,true),head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hlen))),base=4+hlen;
  for(const p of head.parts){p.position=new Float32Array(buf,base+p.pos,p.vcount*3);p.normal=new Int8Array(buf,base+p.nor,p.vcount*3);p.index=new Uint16Array(buf,base+p.idx,p.icount);
   if(p.ao!==undefined){const a=new Uint8Array(buf,base+p.ao,p.vcount),c=new Uint8Array(p.vcount*3);for(let i=0;i<p.vcount;i++)c[i*3]=c[i*3+1]=c[i*3+2]=a[i];p.color=c;}}
  VE89.data[key]=head;return head;
 })();
}
VE89.load=load;

/* ---------- materials ---------- */
// Small GLSL helpers shared by the paint, lens and plastic shaders. Everything is procedural in object space
// (the pack has no UVs worth using), so nothing extra is downloaded.
const NOISE=`
float ve89H(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
vec3 ve89H3(vec3 p){return vec3(ve89H(p),ve89H(p+19.19),ve89H(p+47.53));}
float ve89N(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(ve89H(i),ve89H(i+vec3(1,0,0)),f.x),mix(ve89H(i+vec3(0,1,0)),ve89H(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(ve89H(i+vec3(0,0,1)),ve89H(i+vec3(1,0,1)),f.x),mix(ve89H(i+vec3(0,1,1)),ve89H(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
function objPos(sh){
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vVeP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvVeP=position;');
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vVeP;'+NOISE);
}
// Metallic paint: flake sparkles in the base coat, the clear coat on top stays mirror smooth
// (three's clear coat normal starts from the unperturbed normal). A faint orange peel ripples the clear coat.
function paintMaterial(p){
 const m=new T.MeshPhysicalMaterial({color:p.hex,metalness:p.metal,roughness:p.rough,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.15});
 m.userData.flake=p.metal;
 m.onBeforeCompile=sh=>{objPos(sh);sh.uniforms.ve89Flake={value:p.metal};
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float ve89Flake;')
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  { float px=length(fwidth(vVeP))*1400.;float fade=clamp(1.6-px,0.,1.);
    vec3 fl=ve89H3(floor(vVeP*1400.))-.5;
    normal=normalize(normal+fl*(.55*ve89Flake*fade)); }`)
  .replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
  { float peel=ve89N(vVeP*260.)-.5; clearcoatNormal=normalize(clearcoatNormal+vec3(peel,peel*.7,-peel)*.012); }`);
 };
 m.customProgramCacheKey=()=>'ve89paint';
 return m;
}
// Grained black plastic (bumpers, mirror caps, sills) and a light leather grain inside.
function grainMaterial(color,rough,scale,amount){
 const m=new T.MeshStandardMaterial({color,roughness:rough,metalness:0,envMapIntensity:.6});
 m.onBeforeCompile=sh=>{objPos(sh);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float gr=ve89N(vVeP*${scale.toFixed(1)});roughnessFactor=clamp(roughnessFactor+(gr-.5)*${amount.toFixed(3)},0.,1.);
  diffuseColor.rgb*=.92+.16*gr;`);};
 m.customProgramCacheKey=()=>'ve89grain'+scale;
 return m;
}
// Lamp lenses: polycarbonate with fine fluted optics. `kind` 0 tail (red), 1 reverse (clear), 2 head (clear).
// The flutes bend the reflections the way a real moulded lens does, and the glow comes through them in bands.
function lensMaterial(kind){
 const tail=kind===0;
 const m=new T.MeshPhysicalMaterial({color:tail?'#8c0610':'#ffffff',metalness:0,roughness:.04,transparent:true,opacity:tail?.8:.16,
  depthWrite:false,envMapIntensity:tail?.8:1.4,clearcoat:tail?.6:1,clearcoatRoughness:.02,emissive:tail?'#ff0600':kind===1?'#ffffff':'#fff2dc',emissiveIntensity:0,side:T.FrontSide});
 m.onBeforeCompile=sh=>{objPos(sh);
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  { float f=sin(vVeP.y*${tail?'2100.':'1500.'})*.5+.5; float g=sin(vVeP.x*${tail?'900.':'1300.'})*.5+.5;
    normal=normalize(normal+vec3(0.,(f-.5)*.16,0.)+vec3((g-.5)*.08,0.,0.)); }`)
  .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  { float band=.8+.2*sin(vVeP.y*2100.); totalEmissiveRadiance*=band; }`);};
 m.customProgramCacheKey=()=>'ve89lens'+kind;
 return m;
}
// Headlamp bowls: chrome, lit from the bulb outwards when the headlights are on (warm halogen white).
// Bulb positions come from the lens outlines in the model header (two bowls a side on the VE).
function reflectorMaterial(){
 const m=new T.MeshStandardMaterial({color:'#d8dde2',metalness:1,roughness:.12,envMapIntensity:1.2,emissive:'#fff1d6',emissiveIntensity:0});
 m.userData.bulbs={value:[new T.Vector4(),new T.Vector4(),new T.Vector4(),new T.Vector4()]};
 m.onBeforeCompile=sh=>{objPos(sh);sh.uniforms.ve89Bulbs=m.userData.bulbs;
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 ve89Bulbs[4];')
  .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
  { float w=.06; for(int i=0;i<4;i++){ vec2 d=(vVeP.xy-ve89Bulbs[i].xy)/ve89Bulbs[i].w; w+=1.6*exp(-dot(d,d)); }
    if(vVeP.z<0.) w=.25; totalEmissiveRadiance*=w; }`);};
 m.customProgramCacheKey=()=>'ve89reflector';
 return m;
}
function plateTexture(text){
 const c=document.createElement('canvas');c.width=1024;c.height=216;const x=c.getContext('2d');
 // NSW-style black on yellow, with a pressed rim and the state name along the top.
 const r=26;x.fillStyle='#111';x.beginPath();x.roundRect(0,0,1024,216,r);x.fill();
 const g=x.createLinearGradient(0,0,0,216);g.addColorStop(0,'#ffd935');g.addColorStop(1,'#f0bd10');x.fillStyle=g;x.beginPath();x.roundRect(9,9,1006,198,r-6);x.fill();
 x.strokeStyle='#1a1a1a';x.lineWidth=5;x.beginPath();x.roundRect(20,20,984,176,r-10);x.stroke();
 x.fillStyle='#141414';x.textAlign='center';x.textBaseline='middle';
 x.font='700 26px Arial, sans-serif';x.fillText('N S W',512,40);
 x.font='700 132px "Arial Narrow", Arial, sans-serif';x.save();x.translate(512,124);x.scale(.92,1);x.fillText(text,0,0);x.restore();
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
const PLATES={sedan:'VE·SSV',ute:'SS·UTE',wagon:'SV·WGN'};
// Black leather: fine grain plus the pleated inserts and stitch lines of the SS-V seats.
function leatherMaterial(color){
 const m=new T.MeshStandardMaterial({color,roughness:.55,metalness:0,envMapIntensity:.7});
 m.onBeforeCompile=sh=>{objPos(sh);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
  float gr=ve89N(vVeP*1800.);float ins=step(abs(fract(abs(vVeP.x)*16.+.5)-.5),.035);
  roughnessFactor=clamp(roughnessFactor+(gr-.5)*.25+ins*.2,0.,1.);diffuseColor.rgb*=(.9+.2*gr)*(1.-ins*.45);`);};
 m.customProgramCacheKey=()=>'ve89leather';
 return m;
}
function materials(key,paintKey){
 const P=PAINTS[paintKey]||PAINTS[CARS[key].paint],std=o=>new T.MeshStandardMaterial(o);
 const M={
  paint:paintMaterial(P),
  trim:grainMaterial('#0d0e10',.62,900,.22),
  interior:grainMaterial('#1c1d20',.78,600,.18),
  dash:grainMaterial('#16171a',.72,1100,.22),
  door:grainMaterial('#151619',.66,900,.2),
  seat:leatherMaterial('#121214'),
  headliner:grainMaterial('#1b1b1d',.95,1600,.1),
  carpet:grainMaterial('#0f1011',.98,2400,.1),
  glass:new T.MeshStandardMaterial({color:'#0b1214',metalness:.15,roughness:.08,transparent:true,opacity:.58,depthWrite:false,envMapIntensity:1.3}),
  chrome:std({color:'#e6e9ec',metalness:1,roughness:.08,envMapIntensity:1.3}),
  reflector:reflectorMaterial(),
  lens:lensMaterial(2),reverse:lensMaterial(1),tail:lensMaterial(0),
  amber:new T.MeshPhysicalMaterial({color:'#d86f0c',roughness:.06,transparent:true,opacity:.7,depthWrite:false,clearcoat:1,emissive:'#ff8a10',emissiveIntensity:0}),
  mirror:std({color:'#c9d0d4',metalness:1,roughness:.02,envMapIntensity:1.6}),
  metal:std({color:'#2d2f33',metalness:.7,roughness:.55}),
  rotor:std({color:'#6f7274',metalness:.85,roughness:.42}),
  rubber:grainMaterial('#141516',.88,320,.12),
  rim:std({color:key==='v8'?'#1d1f22':'#c8ccd1',metalness:1,roughness:key==='v8'?.38:.22,envMapIntensity:1.1}),
  red:std({color:'#b40d14',metalness:.2,roughness:.4}),
  plate:std({color:'#f2f0e4',roughness:.45}),
  plateink:std({color:'#14161c',roughness:.5}),
  shadow:new T.MeshBasicMaterial({colorWrite:false,depthWrite:false})
 };
 for(const k in M)if(k!=='shadow')M[k].vertexColors=true;
 return M;
}
VE89.materials=materials;

/* ---------- model ---------- */
const DONE=new WeakSet();
function fill(g,data,key,paintKey,E){
 const M=materials(key,paintKey),body=new T.Group(),wheels=[];g.add(body);body.name='VE body';
 for(let i=0;i<4;i++){const c=data.wheels[i],hub=new T.Group(),steer=new T.Group(),spin=new T.Group();hub.position.set(c[0],c[1],c[2]);hub.add(steer);steer.add(spin);g.add(hub);spin.userData.radius=c[3];wheels.push({hub,steer,spin,front:i<2});}
 // Scenes without a captured environment (menus, art renders) borrow the safety car's studio sky for reflections.
 const envOn=function(r,scene,cam,geo,mat){if(!scene.environment&&!mat.envMap&&typeof sc54FallbackEnv==='function'){mat.envMap=sc54FallbackEnv(r);mat.userData.ve89Env=true;}};
 const envOff=function(r,scene,cam,geo,mat){if(mat.userData.ve89Env){mat.envMap=null;mat.userData.ve89Env=false;}};
 for(const p of data.parts){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p.position,3));geo.setAttribute('normal',new T.BufferAttribute(p.normal,3,true));
  geo.setIndex(new T.BufferAttribute(p.index,1));geo.computeBoundingSphere();
  // Baked ambient occlusion rides in the vertex colour (it multiplies the diffuse colour).
  if(p.color)geo.setAttribute('color',new T.BufferAttribute(p.color,3,true));
  const m=new T.Mesh(geo,M[p.mat]||M.trim);m.userData.ve89Part=p.mat;m.name='VE '+p.mat;
  if(p.mat==='shadow'){m.castShadow=true;m.receiveShadow=false;m.renderOrder=-1;}
  else{m.castShadow=false;m.receiveShadow=p.mat==='paint'||p.mat==='trim';m.onBeforeRender=envOn;m.onAfterRender=envOff;}
  if(M[p.mat]?.transparent)m.renderOrder=p.mat==='glass'?3:2;
  (p.wheel>=0?wheels[p.wheel].spin:body).add(m);
 }
 if(data.plates?.length&&PLATES[key]){
  const pm=new T.MeshStandardMaterial({map:plateTexture(PLATES[key]),roughness:.38,metalness:.05,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  for(const p of data.plates){const geo=new T.PlaneGeometry(p.w*.98,p.h*.98),m=new T.Mesh(geo,pm),r=new T.Vector3(...p.r),u=new T.Vector3(...p.u),n=new T.Vector3(...p.n);
   m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(r,u,n));m.position.set(...p.c);m.name='VE plate';m.userData.ve89Part='plate';body.add(m);}
 }
 const heads=data.lamps?.lens||[];let bi=0;
 for(const l of heads){const [x0,y0]=l.lo,[x1,y1]=l.hi,w=x1-x0,h=y1-y0;for(const f of [.3,.72])if(bi<4)M.reflector.userData.bulbs.value[bi++].set(x0+w*f,y0+h*.56,0,.055);}
 // Glow sprites in front of each headlamp and a light pool on the road, using the game's own textures when present.
 const lights=new T.Group();lights.name='VE headlights';lights.visible=false;g.add(lights);
 const [lo,hi]=data.bounds,front=hi[2],headY=data.key==='v8'?.66:.74;
 if(E&&typeof sc28LightTexture==='function'){
  for(const side of [-1,1]){
   const glow=new T.Sprite(new T.SpriteMaterial({map:sc28LightTexture(E),color:'#fff3df',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.85}));glow.position.set(side*.66,headY,front+.06);glow.scale.set(.5,.3,1);lights.add(glow);
   const pool=new T.Mesh(new T.PlaneGeometry(2.2,8),new T.MeshBasicMaterial({map:sc28LightTexture(E,true),color:'#fff1df',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.45,polygonOffset:true,polygonOffsetFactor:-2}));pool.rotation.x=-Math.PI/2;pool.position.set(side*.66,.035,front+3.6);lights.add(pool);
  }
 }
 const cabin=buildCabin(g,data,key,body);
 g.userData.ve89={M,wheels,lights,body,cabin,brake:0,reverse:0,head:0};
 g.userData.ve89Built=true;
}
function makeCar(key,paintKey,E){
 const g=new T.Group();g.name='VE '+key;g.userData.make='Holden';g.userData.ve89Key=key;g.userData.ve89Paint=paintKey;
 if(VE89.data[key])fill(g,VE89.data[key],key,paintKey,E);else load(key).then(d=>{if(!g.userData.ve89Dead)fill(g,d,key,paintKey,E);}).catch(e=>console.warn(e));
 return g;
}
VE89.makeCar=makeCar;
// Lamps: tail lamps are smoked red at rest, glow deep red when the tail lights are on and bright red on the
// brakes (never washing out to white), reversing lamps light white in reverse, headlamps warm halogen white.
function lamps(g,st,dt){
 const V=g.userData.ve89;if(!V)return;const k=Math.min(1,(dt||1/60)*24);
 V.brake+=((st.braking?1:0)-V.brake)*k;V.reverse+=((st.reverse?1:0)-V.reverse)*k;V.head=st.headlights?1:0;
 V.M.tail.emissiveIntensity=.07+V.brake*1.05+V.head*.3;V.M.tail.opacity=.8+V.brake*.15;
 V.M.reverse.emissiveIntensity=V.reverse*1.6;V.M.reverse.opacity=.16+V.reverse*.5;
 V.M.lens.emissiveIntensity=V.head*.55;V.M.reflector.emissiveIntensity=V.head*1.1;
 V.lights.visible=!!st.headlights;
}
VE89.lamps=lamps;
function roll(g,x,dt){
 const V=g.userData.ve89;if(!V)return;const v=(x?.v||0)*(dt||1/60),steer=Math.max(-.6,Math.min(.6,(x?.steer||0)*4));
 for(const w of V.wheels){w.spin.rotation.x=(w.spin.rotation.x+v/w.spin.userData.radius)%(Math.PI*2);if(w.front)w.steer.rotation.y+=(steer-w.steer.rotation.y)*Math.min(1,(dt||1/60)*14);}
}

/* ---------- cabin: a right-hand-drive VE Series 2 SS-V interior ----------
   The pack's cabin is a left-hand-drive placeholder, so its wheel is dropped at build time and the driver's
   side is rebuilt from Riley's photos: twin red-lit dials under a hood, the black centre stack with the red
   display pod, vents, hazard switch, Blaupunkt head unit and climate knobs, a three-spoke leather wheel with
   the lion badge, column stalks, the auto shifter, handbrake, alloy pedals and the rear-view mirror.
   Positions are measured on the sedan and shifted by each body's dash position. */
const CABIN={dials:'assets/roadcars/cabin/dials.webp',stack:'assets/roadcars/cabin/stack.webp',pod:'assets/roadcars/cabin/pod.webp',badge:'assets/roadcars/cabin/badge.webp'};
const TEX={};
function tex(k){if(TEX[k])return TEX[k];const t=new T.TextureLoader().load(CABIN[k]);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.userData.ve89Keep=true;return TEX[k]=t;}
const STACK_Z=[[.40,.582],[.5,.59],[.55,.6],[.6,.611],[.65,.623],[.7,.635],[.75,.651],[.8,.673],[.84,.73],[.88,.79]];
function stackZ(y){for(let i=1;i<STACK_Z.length;i++)if(y<=STACK_Z[i][0]){const[a,p]=STACK_Z[i-1],[b,q]=STACK_Z[i];return p+(q-p)*(y-a)/(b-a);}return STACK_Z[STACK_Z.length-1][1];}
function cabinMats(){
 const std=o=>new T.MeshStandardMaterial(o);
 return{
  black:std({color:'#121315',roughness:.6}),
  gloss:std({color:'#0c0c0d',roughness:.12,metalness:.1,envMapIntensity:.9}),
  silver:std({color:'#a9adb3',roughness:.3,metalness:.9,envMapIntensity:1}),
  chrome:std({color:'#dfe3e8',roughness:.08,metalness:1,envMapIntensity:1.3}),
  leather:leatherMaterial('#151517'),
  alloy:std({color:'#b9bcc0',roughness:.35,metalness:.95}),
  rubber:std({color:'#0d0d0e',roughness:.9}),
  needle:new T.MeshBasicMaterial({color:'#ff3a1c'}),
  stack:std({map:tex('stack'),emissiveMap:tex('stack'),emissive:'#ff3426',emissiveIntensity:.32,roughness:.42,metalness:.05}),
  pod:std({map:tex('pod'),emissiveMap:tex('pod'),emissive:'#ff3020',emissiveIntensity:.9,roughness:.25}),
  dials:std({map:tex('dials'),emissiveMap:tex('dials'),emissive:'#ffffff',emissiveIntensity:.55,roughness:.35}),
  badge:std({map:tex('badge'),transparent:true,roughness:.2,metalness:.6,envMapIntensity:1.2}),
  glass:new T.MeshPhysicalMaterial({color:'#0a0a0b',roughness:.05,transparent:true,opacity:.35,depthWrite:false,clearcoat:1}),
  mirror:std({color:'#5d6166',roughness:.06,metalness:1,envMapIntensity:.8})
 };
}
function buildCabin(g,data,key,body){
 if(key==='v8'||!data.cabin?.dash)return null;
 const C=cabinMats(),dz=data.cabin.dash[0][2]-.579,dy=data.cabin.dash[0][1]-.46,cab=new T.Group();cab.name='VE cabin';cab.position.set(0,dy,dz);body.add(cab);
 const add=(geo,mat,x,y,z,parent=cab)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;};
 // Centre stack: a face that follows the dash's own curve, then the display pod on top.
 {const W=.235,y0=.40,y1=.88,rows=24,geo=new T.PlaneGeometry(W,y1-y0,1,rows);geo.rotateY(Math.PI);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const y=y0+(p.getY(i)+(y1-y0)/2);p.setY(i,y);p.setZ(i,stackZ(y)-.007);}
  geo.computeVertexNormals();add(geo,C.stack,0,0,0);
  const pod=new T.Group();pod.position.set(0,.905,.80);cab.add(pod);
  // A low rounded binnacle that grows out of the dash top, its screen tipped back towards the driver.
  pod.position.y-=.02;pod.rotation.x=-.18;
  add(new T.BoxGeometry(.22,.06,.09),C.black,0,.0,.035,pod);
  const hood=add(new T.CylinderGeometry(.055,.055,.225,20,1,false,0,Math.PI),C.black,0,.012,.035,pod);hood.rotation.z=Math.PI/2;hood.scale.set(1,1,.9);
  const face=add(new T.PlaneGeometry(.19,.045),C.pod,0,.004,-.0165,pod);face.rotation.y=Math.PI;}
 // Instrument cluster: backing, dial face, hood, needles.
 const cl=new T.Group();cl.position.set(-.40,.875,.745);cab.add(cl);cl.rotation.x=-.12;
 const CW=.33,CH=CW/2;
 add(new T.BoxGeometry(CW+.03,CH+.02,.06),C.black,0,0,.032,cl);
 {const f=add(new T.PlaneGeometry(CW,CH),C.dials,0,0,0,cl);f.rotation.y=Math.PI;}
 {const s=new T.Shape();s.absarc(0,0,.215,0,Math.PI,false);s.lineTo(-.19,0);s.absarc(0,0,.19,Math.PI,0,true);s.lineTo(.215,0);
  const hood=new T.Mesh(new T.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false,curveSegments:28}),C.black);hood.scale.set(1,.5,1);hood.position.set(0,.035,-.07);cl.add(hood);
  const lens=add(new T.PlaneGeometry(CW+.01,CH+.01),C.glass,0,0,-.012,cl);lens.rotation.y=Math.PI;}
 const needles=[];
 for(const [u,maxv] of [[.2246,7],[.7754,260]]){const piv=new T.Group();piv.position.set(-(u-.5)*CW,0,-.004);piv.rotation.y=Math.PI;cl.add(piv);
  const nd=new T.Mesh(new T.PlaneGeometry(.0035,CW*.2),C.needle);nd.position.y=CW*.075;const arm=new T.Group();arm.add(nd);piv.add(arm);
  add(new T.CircleGeometry(.007,16),C.gloss,0,0,-.001,piv).rotation.y=Math.PI;
  needles.push({arm,maxv});}
 // Steering wheel: column, three spokes (silver lower V), leather rim, airbag pad with the lion badge.
 const wh=new T.Group();wh.position.set(-.40,.75,.49);wh.rotation.x=.36;cab.add(wh);
 const col=add(new T.CylinderGeometry(.04,.05,.26,20),C.black,0,0,.15,wh);col.rotation.x=Math.PI/2;
 add(new T.BoxGeometry(.13,.09,.16),C.black,0,-.01,.21,wh);
 for(const sx of [-1,1]){const st=add(new T.CylinderGeometry(.007,.006,.16,8),C.black,sx*.1,.0,.14,wh);st.rotation.z=Math.PI/2;st.rotation.y=sx*.25;}
 const spin=new T.Group();wh.add(spin);
 add(new T.TorusGeometry(.183,.0175,14,80),C.leather,0,0,0,spin);
 {const hub=add(new T.CylinderGeometry(.07,.078,.05,32),C.black,0,-.008,-.018,spin);hub.rotation.x=Math.PI/2;hub.scale.set(1.25,1,1);
  const b=add(new T.CircleGeometry(.024,32),C.badge,0,.0,-.0445,spin);b.rotation.y=Math.PI;}
 for(const sx of [-1,1]){const sp=add(new T.BoxGeometry(.1,.04,.022),C.black,sx*.125,-.012,-.006,spin);sp.rotation.z=sx*-.08;
  const btn=add(new T.BoxGeometry(.03,.022,.006),C.gloss,sx*.115,-.004,-.02,spin);
  const ins=add(new T.BoxGeometry(.07,.006,.012),C.silver,sx*.13,-.034,-.012,spin);ins.rotation.z=sx*-.08;}
 for(const sx of [-1,1]){const lv=add(new T.BoxGeometry(.026,.13,.018),C.silver,sx*.04,-.115,-.004,spin);lv.rotation.z=sx*.32;}
 // Auto shifter on a silver surround, handbrake on the driver's side, console box.
 add(new T.BoxGeometry(.2,.2,.9),C.black,0,.43,.12);
 add(new T.BoxGeometry(.16,.008,.26),C.silver,0,.535,.2);
 {const boot=add(new T.CylinderGeometry(.02,.035,.05,16),C.leather,0,.56,.22);
  const lever=add(new T.CylinderGeometry(.011,.011,.1,10),C.alloy,0,.6,.22);
  const knob=add(new T.SphereGeometry(.03,20,14),C.gloss,0,.655,.22);knob.scale.set(.8,1.25,1.1);}
 {const hb=new T.Group();hb.position.set(-.075,.54,-.02);hb.rotation.x=.25;cab.add(hb);
  add(new T.BoxGeometry(.03,.03,.24),C.black,0,.015,.1,hb);add(new T.BoxGeometry(.034,.034,.07),C.silver,0,.02,.22,hb);}
 // Alloy pedals and the dead pedal.
 for(const [x,w,h,y] of [[-.47,.085,.06,.33],[-.36,.05,.11,.34],[-.6,.05,.12,.28]]){const pd=add(new T.BoxGeometry(w,h,.01),C.alloy,x,y,.82);pd.rotation.x=-.5;}
 // Rear-view mirror glass under the pack's housing.
 {const mg=add(new T.PlaneGeometry(.24,.06),C.mirror,0,1.287-dy,.238);mg.rotation.y=Math.PI;mg.rotation.x=-.12;}
 return {cab,spin,needles,mats:C};
}
VE89.buildCabin=buildCabin;
function cabinUpdate(V,x,dt){
 const K=V?.cabin;if(!K)return;
 K.spin.rotation.z=-(x?.steer||0)*6;
 const kmh=Math.abs(x?.speed??(x?.v||0)*3.6),g=kmh<65?1:kmh<108?2:kmh<151?3:kmh<196?4:kmh<246?5:6,TOP=[0,65,108,151,196,246,300];
 const rpm=kmh<2?850:Math.min(7350,Math.max(1500,kmh/TOP[g]*6200));
 const vals=[rpm/1000,kmh];
 K.needles.forEach((n,i)=>{const v=Math.min(n.maxv,vals[i]),a=(225-270*v/n.maxv)*Math.PI/180-Math.PI/2;n.arm.rotation.z+=(a-n.arm.rotation.z)*Math.min(1,(dt||1/60)*10);});
}
VE89.cabinUpdate=cabinUpdate;

/* ---------- the player's body swap (mirrors sc54PlayerBody) ---------- */
const HIDDEN_LAYER=31,HIDDEN_MASK=(1<<31)>>>0;
function want(){return typeof IR!=='undefined'&&IR.active&&IR.config&&CARS[IR.config.ve89]?IR.config.ve89:null;}
function playerBody(W,L,dt){
 const key=want(),x=L.player,car=W.carNodes?.get(x?.d?.id);if(!car)return;
 let ve=car.userData.ve89Body;
 if(ve&&(ve.userData.ve89Key!==key||ve.userData.ve89Paint!==(IR.config?.ve89Paint||CARS[key]?.paint))){drop(W,car);ve=null;}
 if(key&&!ve){
  const host=car.userData.dc35Chassis?.[0]||car,paint=IR.config.ve89Paint||CARS[key].paint;ve=makeCar(key,paint,W);ve.name='VE '+key+' (player)';ve.userData.own=[];
  if(host!==car){ve.position.copy(host.position).negate();ve.quaternion.copy(host.quaternion).invert();ve.position.applyQuaternion(ve.quaternion);}
  host.add(ve);car.userData.ve89Body=ve;
 }
 if(!ve)return;
 const own=ve.userData.own;own.length=0;const walk=o=>{if(o===ve||o===car.userData.sc54Body)return;if(o.isMesh||o.isSprite||o.isPoints||o.isLine)own.push(o);for(const c of o.children)walk(c);};walk(car);
 if(W.sc30HiddenCar!==car)for(const o of own)if(o.layers.mask!==HIDDEN_MASK)o.layers.set(HIDDEN_LAYER);
 const st=car.userData.rf39LightState||{};lamps(ve,{braking:st.braking,headlights:st.headlights,reverse:(x.v||0)<-.4},dt);roll(ve,x,dt);cabinUpdate(ve.userData.ve89,x,dt);
}
function drop(W,car){
 const ve=car.userData.ve89Body;if(!ve)return;
 for(const o of ve.userData.own||[])if(o.layers.mask===HIDDEN_MASK)o.layers.set(0);
 ve.userData.ve89Dead=true;ve.parent?.remove(ve);W.disposeTree?.(ve);delete car.userData.ve89Body;
}
if(typeof dcRenderWorld==='function'){const prev=dcRenderWorld;dcRenderWorld=function(W,L,dt){try{if(L?.player)playerBody(W,L,dt);}catch(e){console.warn(e);}return prev.apply(this,arguments);};}
// Driver's seat: in the VE road cars the onboard camera sits in the right-hand seat of the VE cabin and the
// game's Supercar cockpit is hidden. The V8 keeps the race cockpit.
const EYE=[-.40,1.115,-.13];
function cabinActive(W,L){const key=want();if(!key||key==='v8'||typeof sc25Camera==='undefined'||sc25Camera!=='onboard')return null;const car=W.carNodes?.get(L?.player?.d?.id),ve=car?.userData.ve89Body;return ve?.userData.ve89?.cabin?{car,ve}:null;}
if(typeof SC25World==='function'&&SC25World.prototype.onboardPose){const prev=SC25World.prototype.onboardPose;SC25World.prototype.onboardPose=function(x){
 const o=this.carNodes?.get(x?.d?.id),ve=o?.userData.ve89Body,key=want();
 if(ve&&key&&key!=='v8'&&x===globalThis.live?.player&&ve.userData.ve89?.cabin){const c=ve.userData.ve89.cabin.cab,host=ve.parent||o;host.updateWorldMatrix(true,true);
  const e=new THREE.Vector3(EYE[0],EYE[1]+c.position.y,EYE[2]+c.position.z),l=new THREE.Vector3(EYE[0],EYE[1]+c.position.y-.03,80);
  return{position:ve.localToWorld(e),look:ve.localToWorld(l)};}
 return prev.apply(this,arguments);};}
// The game's onboard camera (gr27Camera) puts the eye in the Supercar's left-hand seat. In a VE it moves
// across to the right-hand driver's seat, keeping the look direction, head shake and mouse/stick look.
if(typeof gr27Camera==='function'){const prev=gr27Camera;gr27Camera=function(W,L,dt){const r=prev.apply(this,arguments);try{
 const A=cabinActive(W,L);if(!A)return r;const p=L.player,spec=DC35_ASSETS?.cars[p.team.manufacturer]?.spec,T=THREE;
 const body=D.settings.cameraMotion!==false?A.car.userData.dc35Chassis[0]:A.car;body.updateWorldMatrix(true,false);A.ve.updateWorldMatrix(true,false);
 const base=body.localToWorld(new T.Vector3(.37,DC37_EYE_HEIGHT?.[p.team.manufacturer]??(spec?spec.H-.17:1.15),.045));
 const c=A.ve.userData.ve89.cabin.cab,eye=A.ve.localToWorld(new T.Vector3(EYE[0],EYE[1]+c.position.y,EYE[2]+c.position.z));
 const cp=CP65_EYE?.[A.car.userData?.make];if(cp){base.copy(body.localToWorld(new T.Vector3(cp[0],cp[1],cp[2])));}
 W.camera.position.add(eye.sub(base));W.camera.updateMatrixWorld();
 }catch(e){console.warn(e);}return r;};}
if(typeof dcCockpit==='function'){const prev=dcCockpit;dcCockpit=function(W,L,dt){const r=prev.apply(this,arguments);try{
 const A=cabinActive(W,L);if(A){if(W.sc30Cockpit)W.sc30Cockpit.visible=false;A.car.visible=!L.player.garage;A.ve.traverse(o=>{if(o.layers.mask!==1)o.layers.set(0);});
  W.ve89CabinOn=true;}else if(W.ve89CabinOn){W.ve89CabinOn=false;}
 }catch(e){console.warn(e);}return r;};}
if(typeof rf41CarBatches==='function'){const prev=rf41CarBatches;rf41CarBatches=function(W,L){const held=[];for(const car of W.carNodes?.values()||[]){const own=car.userData.ve89Body?.userData.own;if(own)for(const o of own)if(o.visible&&o.layers.mask===HIDDEN_MASK){o.visible=false;held.push(o);}}try{return prev.apply(this,arguments);}finally{for(const o of held)o.visible=true;}};}

/* ---------- road car handling ---------- */
// The SS-V, ute and Sportwagon run on road tyres with no downforce and carry 300-400 kg more than a Supercar:
// less grip, a later and softer tyre peak, more body roll, softer brakes, about 270 kW. The 2012 VE V8 Supercar keeps race car values.
const FEEL={
 sedan:{power:.74,mu:.8,cl:.1,cd:.68,brake:.78,h:.55,peakF:.14,peakR:.135,relax:.55,rollFront:.6},
 wagon:{power:.72,mu:.8,cl:.1,cd:.7,brake:.77,h:.56,peakF:.14,peakR:.135,relax:.55,rollFront:.6},
 ute:{power:.74,mu:.78,cl:.06,cd:.72,brake:.76,h:.57,peakF:.145,peakR:.14,relax:.56,rollFront:.63}
};
const SCALE=['power','mu','brake'];
function withFeel(x,fn,self,args){
 const key=want(),f=key&&FEEL[key];if(!f||!x||x!==globalThis.live?.player)return fn.apply(self,args);
 const saved={};for(const k in f)saved[k]=PH47[k];
 for(const k in f)PH47[k]=SCALE.includes(k)?PH47[k]*f[k]:f[k];
 try{return fn.apply(self,args);}finally{Object.assign(PH47,saved);}
}
// Installed now, before mk71 wraps on window load, so the make character is applied first and this sits inside it.
if(typeof dc32FreeDrive==='function'&&typeof PH47==='object'){const fd=dc32FreeDrive;dc32FreeDrive=function(x){return withFeel(x,fd,this,arguments);};}

/* ---------- Instant Race: Supercars / Road Cars ---------- */
const SEAT_KEY='ve89Seat';
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function currentRoad(){const c=typeof IR!=='undefined'&&IR.config;if(!c)return null;if(c.sc54)return 'm4';return CARS[c.ve89]?c.ve89:null;}
function roadOptions(sel){
 return `<optgroup label="Road cars">`+ROAD.map(k=>`<option value="road:${k}" ${sel===k?'selected':''}>${k==='m4'?'BMW M4 CSL · Safety car':esc2(CARS[k].name)}</option>`).join('')+`</optgroup>`;
}
function esc2(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
if(typeof irCarOptions==='function'){const prev=irCarOptions;irCarOptions=function(selected){
 const road=currentRoad();let html=prev.apply(this,arguments);
 if(road)html=html.replace(/(<option value="\d+:\d+") selected/,'$1');
 return html+roadOptions(road);};}
function paintField(c){
 const key=currentRoad(),cur=c?.ve89Paint||'';
 return `<div class="dc-field ve89-paint-field" ${key&&key!=='m4'?'':'hidden'}><label for="ve89-paint">Paint</label><select id="ve89-paint" name="ve89paint"><option value="vepaint:" ${cur?'':'selected'}>Factory colour</option>${Object.entries(PAINTS).map(([k,p])=>`<option value="vepaint:${k}" ${cur===k?'selected':''}>${esc2(p.name)}</option>`).join('')}</select></div>`;
}
if(typeof irSetupPage==='function'){const prev=irSetupPage;irSetupPage=function(){
 let html=prev.apply(this,arguments);
 // The safety car now lives in the Road Cars tab, so the old Body dropdown goes.
 html=html.replace(/<div class="dc-field"><label for="ir-body">[\s\S]*?<\/p><\/div>/,'');
 return html.replace('<div class="dc-field"><label for="ir-event">',paintField(IR.config)+'<div class="dc-field"><label for="ir-event">');};}
if(typeof irStart==='function'){const prev=irStart;irStart=function(form){
 const sel=form?.elements?.namedItem('car'),v=sel?.value||'',road=v.startsWith('road:')?v.slice(5):null;
 const paint=String(form?.elements?.namedItem('ve89paint')?.value||'').replace('vepaint:','');
 if(road&&sel){const seat=store(SEAT_KEY)||IR.config?.car||'0:0';sel.value=seat;if(sel.value!==seat)sel.value=sel.querySelector('option[value*=":"]:not([value^="road"])')?.value;}
 else if(sel&&/^\d+:\d+$/.test(v))store(SEAT_KEY,v);
 const r=prev.apply(this,arguments);
 if(IR.active&&IR.config){IR.config.sc54=road==='m4';IR.config.ve89=road&&road!=='m4'?road:null;IR.config.ve89Paint=PAINTS[paint]?paint:null;
  if(IR.config.ve89)load(IR.config.ve89).catch(()=>{});irSave();}
 return r;};}
if(typeof irResume==='function'){const prev=irResume;irResume=function(){const r=prev.apply(this,arguments);try{if(IR.config?.ve89)load(IR.config.ve89).catch(()=>{});}catch(e){}return r;};}

// Tiles: the ui26 picker builds a tile per <option>; give road car and paint tiles their own art and words.
function roadTile(b){
 const v=b.dataset.value||'';
 if(v.startsWith('road:')){
  const k=v.slice(5);if(b.dataset.ve89===k)return;b.dataset.ve89=k;
  const name=k==='m4'?'BMW M4 CSL':CARS[k].name,sub=k==='m4'?'Supercars safety car':CARS[k].sub,kick=k==='m4'?'Safety car':k==='v8'?'Race car':'Road car';
  const check=b.querySelector('.ui26-option-check')?.outerHTML||'',act=b.querySelector('.ui26-collection-action')?.outerHTML||'';
  b.innerHTML=`<img class="ui26-tile-car ve89-tile-car" src="${VE89.art[k]}" alt="" loading="lazy"><span class="ui26-tile-copy"><small>${kick}</small><strong>${esc2(name)}</strong><span>${esc2(sub)}</span></span>`+check+act;
 }else if(v.startsWith('vepaint:')){
  const k=v.slice(8),p=PAINTS[k];if(b.dataset.ve89===v)return;b.dataset.ve89=v;
  const check=b.querySelector('.ui26-option-check')?.outerHTML||'',act=b.querySelector('.ui26-collection-action')?.outerHTML||'';
  const sw=p?`background:radial-gradient(circle at 35% 30%,#fff8 0,#fff0 38%),${p.hex}`:'background:conic-gradient(#a3060c,#d2520e,#e7bd12,#1b3a2c,#123c86,#3d0b2a,#a3060c)';
  b.innerHTML=`<span class="ve89-swatch" style="${sw}"></span><span class="ui26-tile-copy"><strong>${p?esc2(p.name):'Factory colour'}</strong><small>${p?(p.metal>.4?'Metallic':'Solid')+' · VE colour chart':'Each car in its launch colour'}</small></span>`+check+act;
 }
}
// Two tabs at the top of the car picker; LB/RB (or Q/E) switch tabs.
let tab=null;
function pickerTabs(){
 const sheet=document.getElementById('ui26-picker'),grid=sheet?.querySelector('.ui26-picker-cars');
 if(!grid||sheet.hidden)return;
 if(!grid.querySelector('[data-value^="road:"]'))return;
 let bar=sheet.querySelector('.ve89-tabs');
 if(!bar){
  bar=document.createElement('div');bar.className='ve89-tabs';bar.setAttribute('role','tablist');
  bar.innerHTML=`<span class="ve89-pad">LB</span><button type="button" role="tab" data-tab="race">Supercars</button><button type="button" role="tab" data-tab="road">Road Cars</button><span class="ve89-pad">RB</span>`;
  grid.before(bar);
  for(const b of bar.querySelectorAll('button'))b.onclick=()=>setTab(b.dataset.tab,true);
  const on=grid.querySelector('[aria-pressed="true"]');tab=on?.dataset.value?.startsWith('road:')?'road':'race';
 }
 setTab(tab||'race',false);
}
function setTab(t,focus){
 tab=t;const sheet=document.getElementById('ui26-picker'),grid=sheet?.querySelector('.ui26-picker-cars'),bar=sheet?.querySelector('.ve89-tabs');if(!grid||!bar)return;
 let n=0,first=null;
 // Only touch the DOM when something differs: the tile observer watches these attributes.
 for(const b of grid.children){const road=(b.dataset.value||'').startsWith('road:'),show=(t==='road')===road;if(b.hidden===show)b.hidden=!show;if(show){n++;if(!first||b.getAttribute('aria-pressed')==='true'&&first.getAttribute('aria-pressed')!=='true')first=b;}}
 for(const b of bar.querySelectorAll('button')){const on=b.dataset.tab===t;if(b.getAttribute('aria-selected')!==String(on))b.setAttribute('aria-selected',String(on));if(b.classList.contains('on')!==on)b.classList.toggle('on',on);}
 const count=sheet.querySelector('.ui26-picker-top p'),txt=`${n} ${t==='road'?'road cars':'Supercars'} · Select a tile to confirm`;if(count&&count.textContent!==txt)count.textContent=txt;
 if(focus&&first){first.focus({preventScroll:true});first.scrollIntoView({block:'nearest'});}
}
function onDom(){
 for(const b of document.querySelectorAll('.ui26-option[data-value^="road:"],.ui26-collection-tile[data-value^="road:"],.ui26-option[data-value^="vepaint:"],.ui26-collection-tile[data-value^="vepaint:"]'))roadTile(b);
 const sheet=document.getElementById('ui26-picker');if(sheet&&!sheet.hidden)pickerTabs();else tab=null;
 // Paint only matters for the VEs.
 const car=document.getElementById('ir-car'),pf=document.querySelector('.ve89-paint-field');
 if(car&&pf){const v=car.value,show=v.startsWith('road:')&&v!=='road:m4';if(pf.hidden===show)pf.hidden=!show;}
}
let queued=false;
new MutationObserver(recs=>{if(recs.every(r=>r.target.closest?.('.ve89-tabs')||r.target.parentElement?.closest?.('.ui26-picker-top')&&r.type==='childList'))return;if(queued)return;queued=true;queueMicrotask(()=>{queued=false;try{onDom();}catch(e){console.warn(e);}});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-pressed','data-value']});
document.addEventListener('change',e=>{if(e.target?.id==='ir-car')onDom();});
document.addEventListener('keydown',e=>{const sheet=document.getElementById('ui26-picker');if(!sheet||sheet.hidden||!sheet.querySelector('.ve89-tabs'))return;
 if(e.key==='q'||e.key==='Q'||e.key==='['){setTab('race',true);e.preventDefault();}else if(e.key==='e'||e.key==='E'||e.key===']'){setTab('road',true);e.preventDefault();}},true);
let padPrev=[false,false];
(function pad(){
 try{const sheet=document.getElementById('ui26-picker');if(sheet&&!sheet.hidden&&sheet.querySelector('.ve89-tabs')){
  const gp=[...(navigator.getGamepads?.()||[])].find(g=>g&&g.connected);
  if(gp){const lb=!!gp.buttons[4]?.pressed,rb=!!gp.buttons[5]?.pressed;if(lb&&!padPrev[0])setTab('race',true);if(rb&&!padPrev[1])setTab('road',true);padPrev=[lb,rb];}}}catch(e){}
 setTimeout(pad,60);
})();
const css=document.createElement('style');css.id='ve89-style';css.textContent=`
.ve89-tabs{display:flex;align-items:center;gap:10px;margin:-8px 0 22px}
.ve89-tabs button{border:1px solid #47546b;border-radius:999px;padding:11px 22px;background:#1c2536;color:#c9d3e2;font:700 13px 'UI Inter',sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.ve89-tabs button.on{background:#e10600;border-color:#e10600;color:#fff}
.ve89-tabs button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.ve89-pad{display:inline-grid;place-items:center;min-width:34px;height:22px;border-radius:6px;background:#2a3446;color:#aab6c8;font:700 10px 'UI Inter',sans-serif}
.ve89-swatch{display:block;width:76px;height:76px;border-radius:50%;margin:0 auto 12px;box-shadow:inset 0 -6px 14px #0006,0 6px 16px #0008;border:2px solid #fff3}
.ui26-picker-grid .ui26-option[hidden]{display:none!important}
.ui26-option[data-ve89] .ui26-tile-copy strong,.ui26-collection-tile[data-ve89] .ui26-tile-copy strong{font-size:clamp(20px,1.9vw,30px);line-height:1.05}
`;document.head.appendChild(css);
})();
