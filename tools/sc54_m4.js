/* sc54: BMW M4 CSL safety car. Chrome body, Safety Car script, Supercars S + Repco, roof lightbar.
   Geometry comes from assets/safetycar_m4.gz.bin (built by tools/build_m4.py from Riley's OBJ). */
const SC54_FILE='assets/safetycar_m4.gz.bin',SC54_DECALS='assets/img/sc_m4_decals.png';
let SC54_DATA=null,SC54_FALLBACK_ENV=null;
const SC54_READY=(async()=>{
 const res=await fetch(SC54_FILE);if(!res.ok)throw Error('Safety car model failed to load ('+res.status+')');
 const buf=await new Response(new Blob([await res.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const hlen=new DataView(buf).getUint32(0,true),head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hlen))),base=4+hlen;
 for(const p of head.parts){p.position=new Float32Array(buf,base+p.pos,p.vcount*3);p.normal=new Int8Array(buf,base+p.nor,p.vcount*3);p.index=new Uint16Array(buf,base+p.idx,p.icount);if(p.uv!==undefined)p.uvs=new Float32Array(buf,base+p.uv,p.vcount*2);}
 const img=new Image();img.src=SC54_DECALS;await img.decode().catch(()=>{});head.decalImage=img;
 SC54_DATA=head;return head;
})();
SC54_READY.catch(e=>console.warn(e));

// Studio-style environment for the chrome wherever the scene has no captured environment.
function sc54FallbackEnv(renderer){
 if(SC54_FALLBACK_ENV)return SC54_FALLBACK_ENV;
 const T=THREE,scene=new T.Scene(),geo=new T.SphereGeometry(50,32,16),col=[],p=geo.attributes.position,c=new T.Color();
 // Blue sky to a bright horizon, then dark ground: the contrast is what reads as chrome.
 for(let i=0;i<p.count;i++){const y=p.getY(i)/50;if(y>.06)c.setRGB(.18+.5*(1-y)**3,.36+.45*(1-y)**3,.72+.24*(1-y)**3);else if(y>-.04)c.setRGB(.95,.95,.92);else c.setRGB(.06+.05*(1+y),.06+.045*(1+y),.055+.04*(1+y));col.push(c.r,c.g,c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(col,3));scene.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide})));
 for(const [x,y,z,w,h] of [[0,30,0,40,6],[30,12,10,6,14],[-30,12,-10,6,14],[10,8,30,18,4]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);scene.add(m);}
 const pm=new T.PMREMGenerator(renderer);SC54_FALLBACK_ENV=pm.fromScene(scene,.02).texture;pm.dispose();geo.dispose();return SC54_FALLBACK_ENV;
}
function sc54Materials(){
 const T=THREE,std=(o)=>new T.MeshStandardMaterial(o);
 return{
  chrome:std({color:'#eef1f4',metalness:1,roughness:.07,envMapIntensity:1.35}),
  carbon:std({color:'#1a1c1f',metalness:.35,roughness:.32}),
  trim:std({color:'#121315',metalness:.2,roughness:.45}),
  glass:std({color:'#10161c',metalness:.6,roughness:.05,transparent:true,opacity:.62,depthWrite:false}),
  under:std({color:'#0c0d0e',roughness:.9}),
  exhaust:std({color:'#8e8478',metalness:.9,roughness:.3}),
  rim:std({color:'#2b2e33',metalness:.85,roughness:.28}),
  rubber:std({color:'#141517',roughness:.9}),
  caliper:std({color:'#c3141d',metalness:.2,roughness:.35}),
  rotor:std({color:'#6f7276',metalness:.8,roughness:.45}),
  interior:std({color:'#1d1f22',roughness:.75}),
  head:std({color:'#f2f6ff',emissive:'#d8e8ff',emissiveIntensity:.45,roughness:.15}),
  drl:std({color:'#f4f8ff',emissive:'#e8f2ff',emissiveIntensity:2.2,roughness:.15}),
  tail:std({color:'#8e0d14',emissive:'#ff1a24',emissiveIntensity:1.1,roughness:.2}),
  amber:std({color:'#d77a10',emissive:'#ff9a1a',emissiveIntensity:1.4,roughness:.2})
 };
}
function sc54Fill(g,data,E){
 const T=THREE,mats=sc54Materials(),bodyParent=new T.Group(),wheels=[];g.add(bodyParent);
 const decalTex=new T.Texture(data.decalImage);decalTex.colorSpace=T.SRGBColorSpace;decalTex.anisotropy=8;decalTex.needsUpdate=true;
 mats.decal=new T.MeshStandardMaterial({map:decalTex,emissiveMap:decalTex,emissive:'#ffffff',emissiveIntensity:.2,transparent:true,metalness:.15,roughness:.35,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,depthWrite:false});
 for(let i=0;i<4;i++){const w=new T.Group(),c=data.wheels[i];w.position.set(c[0],c[1],c[2]);w.userData.radius=c[3];g.add(w);wheels.push(w);}
 // Chrome borrows the scene's captured environment, else a studio sky; cleared after drawing so disposeTree never frees it.
 const envOn=(r,scene)=>{mats.chrome.envMap=scene.environment||sc54FallbackEnv(r);},envOff=()=>{mats.chrome.envMap=null;};
 for(const p of data.parts){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p.position,3));geo.setAttribute('normal',new T.BufferAttribute(p.normal,3,true));
  if(p.uvs)geo.setAttribute('uv',new T.BufferAttribute(p.uvs,2));geo.setIndex(new T.BufferAttribute(p.index,1));geo.computeBoundingSphere();
  const m=new T.Mesh(geo,mats[p.mat]||mats.trim);m.castShadow=p.mat==='chrome'||p.mat==='rubber';m.receiveShadow=false;m.userData.sc54Part=p.mat;
  if(p.mat==='chrome'){m.onBeforeRender=envOn;m.onAfterRender=envOff;}
  if(p.mat==='decal')m.renderOrder=2;
  (p.wheel>=0?wheels[p.wheel]:bodyParent).add(m);
 }
 // Roof lightbar: black bar, amber lenses front and rear, flashing left/right alternately.
 const roofY=data.roof,bar=new T.Group();bar.position.set(0,roofY+.005,-.18);g.add(bar);
 const barMat=new T.MeshStandardMaterial({color:'#0d0e10',metalness:.4,roughness:.35});
 const base=new T.Mesh(new T.BoxGeometry(1.06,.075,.24),barMat);base.position.y=.045;bar.add(base);
 for(const s of [-1,1]){const foot=new T.Mesh(new T.BoxGeometry(.06,.03,.2),barMat);foot.position.set(s*.4,.008,0);bar.add(foot);}
 const lensOn=new T.MeshBasicMaterial({color:'#ffb21e'}),lensOff=new T.MeshStandardMaterial({color:'#6b3a06',metalness:.1,roughness:.2,transparent:true,opacity:.9});
 const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,214,120,1)');gr.addColorStop(.25,'rgba(255,160,30,.7)');gr.addColorStop(1,'rgba(255,120,0,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();
 const banks=[[],[]];
 for(const s of [-1,1])for(let k=0;k<3;k++)for(const face of [1,-1]){
  const lens=new T.Mesh(new T.BoxGeometry(.13,.05,.02),lensOff);lens.position.set(s*(.17+k*.14),.047,face*.122);bar.add(lens);
  const glow=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:'#ffa21a',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.95}));glow.position.set(s*(.17+k*.14),.05,face*.16);glow.scale.set(.42,.3,1);glow.visible=false;bar.add(glow);
  banks[s<0?0:1].push({lens,glow});
 }
 // white centre panel with SAFETY CAR text, both faces
 const label=(()=>{const c=document.createElement('canvas');c.width=256;c.height=48;const x=c.getContext('2d');x.fillStyle='#f4f4f0';x.fillRect(0,0,256,48);x.fillStyle='#111';x.font='bold 30px Arial, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('SAFETY CAR',128,26);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();
 for(const face of [1,-1]){const pl=new T.Mesh(new T.PlaneGeometry(.2,.04),new T.MeshBasicMaterial({map:label}));pl.position.set(0,.047,face*.1215);if(face<0)pl.rotation.y=Math.PI;bar.add(pl);}
 let lastFlash=-1;
 // Double flash left, then double flash right.
 base.onBeforeRender=()=>{const step=Math.floor(performance.now()/1000*9)%8,on=g.userData.sc54LightsOn!==false,lit=!on?-1:step===0||step===2?0:step===4||step===6?1:-1;if(lit===lastFlash)return;lastFlash=lit;
  banks.forEach((b,i)=>{for(const l of b){l.lens.material=lit===i?lensOn:lensOff;l.glow.visible=lit===i;}});};
 // Wheels roll with the distance the car covers.
 const last=new T.Vector3(),now=new T.Vector3(),fwd=new T.Vector3();let primed=false;
 const roller=bodyParent.children.find(m=>m.userData.sc54Part==='chrome')||base;
 const prev=roller.onBeforeRender;
 roller.onBeforeRender=function(r,scene,cam,geo,mat,grp){prev.call(this,r,scene,cam,geo,mat,grp);g.getWorldPosition(now);if(primed){fwd.set(0,0,1).applyQuaternion(g.getWorldQuaternion(new T.Quaternion()));const d=now.clone().sub(last).dot(fwd);if(Math.abs(d)<50)for(const w of wheels)w.rotation.x=(w.rotation.x+d/w.userData.radius)%(Math.PI*2);}last.copy(now);primed=true;};
 g.userData.headlightMaterial=mats.head;
 if(E&&typeof sc28Headlights==='function'){sc28Headlights(E,g,'BMW');const L=g.userData.sc28Lights;if(L)for(const o of L.children){if(o.isSprite){o.position.set(Math.sign(o.position.x)*.6,.61,2.3);o.scale.set(.42,.26,1);}else o.position.z=2.4+3.5;}}
 g.userData.sc54Built=true;
}
function sc54SafetyCar(E){
 const g=new THREE.Group();g.name='BMW M4 CSL safety car';g.userData.beacons=[];g.userData.make='BMW M4 CSL';g.userData.noSpoiler=true;g.userData.safety=true;g.visible=false;
 if(SC54_DATA)sc54Fill(g,SC54_DATA,E);else SC54_READY.then(d=>sc54Fill(g,d,E)).catch(()=>{});
 return g;
}
if(typeof sc26Falcon==='function'){const sc54Falcon=sc26Falcon;sc26Falcon=function(E){try{return sc54SafetyCar(E);}catch(e){console.warn(e);return sc54Falcon(E);}};}

/* Driveable: Instant race can put you in the M4 safety car. Your chosen team's seat, pace and timing stay; only the body changes. */
// The game's own car node keeps driving the cameras, physics and lights; its meshes move to a hidden layer
// and the M4 rides on its chassis. The onboard cockpit swaps layers on the whole car, so the hiding is re-applied each frame.
const SC54_HIDDEN_LAYER=31,SC54_HIDDEN_MASK=(1<<31)>>>0;
function sc54PlayerBody(W,L){
 const want=typeof IR!=='undefined'&&IR.active&&!!IR.config?.sc54,car=W.carNodes?.get(L.player?.d?.id);if(!car)return;
 let m4=car.userData.sc54Body;
 if(want&&!m4){
  const host=car.userData.dc35Chassis?.[0]||car;m4=sc54SafetyCar(W);m4.name='BMW M4 CSL safety car (player)';m4.userData.sc54Own=[];
  if(host!==car){m4.position.copy(host.position).negate();m4.quaternion.copy(host.quaternion).invert();m4.position.applyQuaternion(m4.quaternion);}
  host.add(m4);car.userData.sc54Body=m4;car.userData.sc54Brake=car.userData.brake;
  const hook=()=>{g:for(const o of m4.children)for(const c of o.children||[])if(c.userData.sc54Part==='tail'){car.userData.brake=c;break g;}};if(m4.userData.sc54Built)hook();else SC54_READY.then(()=>setTimeout(hook,0));
 }
 if(!m4)return;
 m4.visible=want;
 // Parts of the game's car can be built after the swap (LOD levels, damage), so collect them every frame.
 if(want){const own=m4.userData.sc54Own;own.length=0;const walk=o=>{if(o===m4)return;if(o.isMesh||o.isSprite||o.isPoints||o.isLine)own.push(o);for(const c of o.children)walk(c);};walk(car);}
 if(want){if(W.sc30HiddenCar!==car)for(const o of m4.userData.sc54Own)if(o.layers.mask!==SC54_HIDDEN_MASK)o.layers.set(SC54_HIDDEN_LAYER);}
 else{for(const o of m4.userData.sc54Own)if(o.layers.mask===SC54_HIDDEN_MASK)o.layers.set(0);m4.parent?.remove(m4);W.disposeTree?.(m4);car.userData.brake=car.userData.sc54Brake;delete car.userData.sc54Body;}
}
// Car-part instancing ignores layers, so keep the hidden parts out of it for the frame.
if(typeof rf41CarBatches==='function'){const sc54Batches=rf41CarBatches;rf41CarBatches=function(W,L){const held=[];for(const car of W.carNodes?.values()||[]){const own=car.userData.sc54Body?.visible&&car.userData.sc54Body.userData.sc54Own;if(own)for(const o of own)if(o.visible&&o.layers.mask===SC54_HIDDEN_MASK){o.visible=false;held.push(o);}}try{return sc54Batches.apply(this,arguments);}finally{for(const o of held)o.visible=true;}};}
if(typeof dcRenderWorld==='function'){const sc54Render=dcRenderWorld;dcRenderWorld=function(W,L,dt){try{if(L?.player)sc54PlayerBody(W,L);}catch(e){console.warn(e);}return sc54Render.apply(this,arguments);};}
if(typeof irSetupPage==='function'){const sc54Setup=irSetupPage;irSetupPage=function(){const html=sc54Setup.apply(this,arguments),on=!!IR.config?.sc54;
 return html.replace('<div class="dc-field"><label for="ir-event">',`<div class="dc-field"><label for="ir-body">Body</label><select id="ir-body" name="sc54body"><option value="race" ${on?'':'selected'}>Race car</option><option value="m4" ${on?'selected':''}>Safety car · BMW M4 CSL</option></select><p class="dc-muted">The safety car keeps your chosen car's seat, pace and timing.</p></div><div class="dc-field"><label for="ir-event">`);};}
if(typeof irStart==='function'){const sc54Start=irStart;irStart=function(form){const on=form?.elements?.namedItem('sc54body')?.value==='m4';sc54Start.apply(this,arguments);if(IR.active&&IR.config){IR.config.sc54=on;irSave();}};}
