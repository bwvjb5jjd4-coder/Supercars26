/* PF61: measured smoothness pass (cockpit, pit lane, heavy rain) and an F-key frame-time overlay.
   Measured in headless Chromium with renderer.info and a per-draw breakdown (Albert Park pit box,
   cockpit camera, Balanced). Fixes, biggest first:
   - Wet weather: the road reflection called gl.checkFramebufferStatus every frame. That call makes
     the CPU wait until the GPU has finished all queued work, so every wet frame lost CPU/GPU overlap.
     The status is now checked once per render target.
   - Shadows: every car cast its shadow from the full-detail model (ZB 191k triangles, plus the shared
     wheel/brake/trim instances), 600-800k triangles in the pit lane. The shadow pass now draws the
     far LOD (13k) for other cars and the middle LOD for the player's car.
   - Other cars used the 191k-triangle ZB model out to 42 m and the 63k model to 135 m; now 24 m / 100 m.
   - 121 separate see-through "bedded tyre rubber" / "asphalt repair" decals are merged into one mesh
     per material (about 85 fewer draw calls in the pit lane, in the main view, mirror and reflection).
   - The mirror target no longer reallocates when the driver's head moves (a GPU reallocation hitch).
   - Frosted-glass (backdrop-filter) HUD panels re-blur the 3D view every frame; they are flat while
     driving. Menus and the pause screen keep the frosted look.
   - The canvas no longer carries its own 4x MSAA buffer when the HDR post pipeline (which has its
     own MSAA) draws the picture; Performance quality, which has no post pipeline, keeps it.
   - Autosave runs in idle time instead of inside a frame.
   - Rain spray sprites are capped in size (see pfSprayInstall).
   F (or the controller's right stick click) toggles the overlay: FPS, average and worst frame time,
   game JS time per frame, draw calls, triangles and the 3D resolution, with a frame-time graph. */
(function(){
const PF={on:false,jsAcc:0,el:null,graph:null,ctx:null,times:new Float32Array(240),js:new Float32Array(240),i:0,n:0,last:0,textAt:0,calls:0,tris:0,hitches:[]};
window.PF61=PF;

// --- Reflection sync stall ---------------------------------------------------------------
function pfGL(W){
 const gl=W?.renderer?.getContext?.();if(!gl||gl.pf61)return;gl.pf61=true;
 const real=gl.checkFramebufferStatus.bind(gl),ok=new WeakSet();
 gl.checkFramebufferStatus=function(t){const rt=W.renderer.getRenderTarget();if(rt&&ok.has(rt))return gl.FRAMEBUFFER_COMPLETE;const s=real(t);if(rt&&s===gl.FRAMEBUFFER_COMPLETE)ok.add(rt);return s;};
}

// --- Shadow pass: low-detail car casters -----------------------------------------------
function pfShadows(W,L){
 const sm=W.renderer.shadowMap;if(sm.pf61)return;sm.pf61=true;const base=sm.render;
 sm.render=function(lights,scene,camera){
  if(!this.enabled||(!this.autoUpdate&&!this.needsUpdate)||scene!==W.scene)return base.apply(this,arguments);
  const saved=[],set=(o,v)=>{if(o.visible!==v){saved.push(o);o.visible=v;}};
  try{
   // Shared component instances hold full-detail wheels/brakes/trim; show their sources instead,
   // so each car casts from whichever level is switched on below.
   for(const b of W.rf41CarBatches?.values()||[]){if(b.mesh.visible){set(b.mesh,false);for(const o of b.sources)set(o,true);}}
   const me=W.carNodes.get(live?.player?.d?.id);
   for(const car of W.carNodes.values()){const lod=car.userData.dc35LOD;if(!lod||!car.visible||lod.levels.length<3)continue;
    const cur=lod.levels.findIndex(l=>l.object.visible),at=Math.max(cur,car===me?1:2);
    lod.levels.forEach((l,i)=>set(l.object,i===at));}
   return base.apply(this,arguments);
  }finally{for(let i=saved.length-1;i>=0;i--)saved[i].visible=!saved[i].visible;}
 };
}

// --- Car LOD distances (other cars only) -----------------------------------------------
function pfLods(W,L){
 const me=L?.player?.d?.id;
 for(const [id,car] of W.carNodes){const lod=car.userData.dc35LOD;if(!lod||lod.levels.length<3)continue;const key=id===me?'me':'ai';if(lod.pf61===key)continue;
  if(!lod.pf61Base)lod.pf61Base=lod.levels.map(l=>l.distance);
  lod.levels.forEach((l,i)=>l.distance=key==='me'?lod.pf61Base[i]:i===1?Math.min(24,lod.pf61Base[1]):i===2?Math.min(100,lod.pf61Base[2]):lod.pf61Base[i]);lod.pf61=key;}
}

// --- Merge static track decals ----------------------------------------------------------
const PF_DECALS=/^(Bedded tyre rubber|Asphalt repair)/;
function pfMergeDecals(W){
 if(W.pf61Decals||!W.world)return;W.pf61Decals=true;const T=THREE,groups=new Map();
 for(const o of W.world.children){if(!o.isMesh||o.isInstancedMesh||!PF_DECALS.test(o.name)||!o.geometry.index||o.morphTargetInfluences)continue;
  const g=o.geometry,key=o.material.uuid+'|'+o.name.match(PF_DECALS)[1]+'|'+Object.keys(g.attributes).sort().join(',')+'|'+o.visible+o.renderOrder+o.castShadow+o.receiveShadow;
  (groups.get(key)||groups.set(key,[]).get(key)).push(o);}
 W.world.updateMatrixWorld(true);const inv=new T.Matrix4().copy(W.world.matrixWorld).invert(),m=new T.Matrix4(),nm=new T.Matrix3();
 for(const list of groups.values()){if(list.length<2)continue;
  const names=Object.keys(list[0].geometry.attributes);let verts=0,idx=0;for(const o of list){verts+=o.geometry.attributes.position.count;idx+=o.geometry.index.count;}
  const out=new T.BufferGeometry(),arrs={};for(const n of names){const a=list[0].geometry.attributes[n];arrs[n]=new Float32Array(verts*a.itemSize);}
  const index=verts>65535?new Uint32Array(idx):new Uint16Array(idx);let vo=0,io=0,ok=true;
  for(const o of list){const g=o.geometry;m.multiplyMatrices(inv,o.matrixWorld);nm.getNormalMatrix(m);const n0=g.attributes.position.count;
   for(const n of names){const a=g.attributes[n],dst=arrs[n],k=a.itemSize;if(!a||a.isInterleavedBufferAttribute){ok=false;break;}
    for(let i=0;i<n0;i++){let x=a.getX(i),y=k>1?a.getY(i):0,z=k>2?a.getZ(i):0;
     if(n==='position'){const e=m.elements,w=1;const X=e[0]*x+e[4]*y+e[8]*z+e[12],Y=e[1]*x+e[5]*y+e[9]*z+e[13],Z=e[2]*x+e[6]*y+e[10]*z+e[14];x=X;y=Y;z=Z;}
     else if(n==='normal'){const e=nm.elements;const X=e[0]*x+e[3]*y+e[6]*z,Y=e[1]*x+e[4]*y+e[7]*z,Z=e[2]*x+e[5]*y+e[8]*z,l=Math.hypot(X,Y,Z)||1;x=X/l;y=Y/l;z=Z/l;}
     const j=(vo+i)*k;dst[j]=x;if(k>1)dst[j+1]=y;if(k>2)dst[j+2]=z;if(k>3)dst[j+3]=a.getW(i);}}
   if(!ok)break;const ia=g.index.array;for(let i=0;i<ia.length;i++)index[io+i]=ia[i]+vo;vo+=n0;io+=ia.length;}
  if(!ok)continue;
  for(const n of names)out.setAttribute(n,new T.BufferAttribute(arrs[n],list[0].geometry.attributes[n].itemSize,list[0].geometry.attributes[n].normalized));
  out.setIndex(new T.BufferAttribute(index,1));out.computeBoundingSphere();out.computeBoundingBox();
  const s=list[0],mesh=new T.Mesh(out,s.material);mesh.name=s.name;mesh.renderOrder=s.renderOrder;mesh.castShadow=s.castShadow;mesh.receiveShadow=s.receiveShadow;mesh.visible=s.visible;mesh.userData.pf61Merged=list.length;
  mesh.matrixAutoUpdate=false;mesh.updateMatrix();W.world.add(mesh);for(const o of list)o.removeFromParent();
 }
}

// --- Rain spray: no screen-filling sprites ----------------------------------------------
// Spray sprites near the camera grew to 700 px each (up to 1,600 of them in heavy rain), many
// full-screen layers of blended HDR overdraw when following a car. Sprites now fade out as they
// pass ~250 px and are never bigger than 380 px, so the plume reads the same from a car length back.
function pfSprayInstall(){
 if(typeof gx55SprayPool!=='function'||gx55SprayPool.pf61)return;const base=gx55SprayPool;
 gx55SprayPool=function(W){const had=!!W.gx55Spray,S=base.apply(this,arguments);if(!had&&S?.pts?.material){const m=S.pts.material,from='gl_PointSize=min(700.0,size*scale/max(.2,-mv.z));vA=alpha*smoothstep(.5,3.0,-mv.z);';
   if(m.vertexShader.includes(from)){m.vertexShader=m.vertexShader.replace(from,'float ps=size*scale/max(.2,-mv.z);vA=alpha*smoothstep(.5,3.0,-mv.z)*(1.0-smoothstep(250.0,380.0,ps));gl_PointSize=vA>.002?min(380.0,ps):0.0;');m.needsUpdate=true;}}
  return S;};
 gx55SprayPool.pf61=true;
}
if(document.readyState==='complete')pfSprayInstall();else addEventListener('load',pfSprayInstall);

// --- Mirror and wet-reflection content ---------------------------------------------------
// The 256x144 wet reflection drew ~770 draw calls a frame in the pit lane (every car on the
// circuit plus every garage part and fence panel), which is CPU time every wet frame. Both aux
// views now skip cars and static circuit pieces that are too far away to matter in them.
const PF_AUX={reflect:{car:75,world:140},mirror:{car:150,world:200}};
function pfSphere(W,o){const m=W.pf61Spheres||(W.pf61Spheres=new WeakMap());let s=m.get(o);if(!s){const b=new THREE.Box3().setFromObject(o);s=b.isEmpty()?null:b.getBoundingSphere(new THREE.Sphere());m.set(o,s||false);}return s||null;}
function pfAuxInstall(){
 if(typeof fx52AuxDetail!=='function'||fx52AuxDetail.pf61)return;const base=fx52AuxDetail;
 fx52AuxDetail=function(W,cam,opts,draw){
  const lim=opts?.flat?PF_AUX.reflect:PF_AUX.mirror,eye=cam.getWorldPosition(new THREE.Vector3()),hidden=[];
  try{
   for(const car of W.carNodes?.values()||[])if(car.visible&&car.position.distanceTo(eye)>lim.car){car.visible=false;hidden.push(car);}
   for(const o of W.world?.children||[]){if(!o.visible||o.isInstancedMesh||o.userData.pf61Merged)continue;const s=pfSphere(W,o);if(s&&s.radius<60&&s.distanceToPoint(eye)>lim.world){o.visible=false;hidden.push(o);}}
   return base.call(this,W,cam,opts,draw);
  }finally{for(const o of hidden)o.visible=true;}
 };
 fx52AuxDetail.pf61=true;
}
pfAuxInstall();

// --- Mirror target: keep its size while the head moves ---------------------------------
function pfMirror(W){
 const rt=W.dc35MirrorRT;if(!rt||rt.pf61)return;rt.pf61=true;const base=rt.setSize.bind(rt);
 rt.setSize=function(w,h,d){if(this.pf61W===w)return;this.pf61W=w;return base(w,h,d);};
}

// --- Canvas MSAA only when nothing else antialiases ---------------------------------------
if(typeof THREE==='object'&&THREE.WebGLRenderer&&!THREE.WebGLRenderer.pf61){
 const Base=THREE.WebGLRenderer;
 const R=function(p={}){const post=typeof sc25Quality!=='undefined'&&sc25Quality!=='performance'&&D?.settings?.gx55Post!==false&&live?.dc;
  return new Base(post?{...p,antialias:false}:p);};
 R.prototype=Base.prototype;R.pf61=true;Object.setPrototypeOf(R,Base);
 try{THREE.WebGLRenderer=R;}catch(_){}
}

// --- Flat HUD panels while driving -------------------------------------------------------
const css=document.createElement('style');
css.textContent=`body.pf61-race *,body.pf61-race *::before,body.pf61-race *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
body.pf61-race .dc-pause,body.pf61-race .dc-pause *,body.pf61-race .dc-modal,body.pf61-race .dc-modal *{backdrop-filter:revert!important;-webkit-backdrop-filter:revert!important}
#pf61-stats{position:fixed;left:10px;top:10px;z-index:99999;background:#000000c8;color:#e9f1f4;font:600 12px/1.35 ui-monospace,Menlo,Consolas,monospace;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre}
#pf61-stats canvas{display:block;margin-top:6px}
#pf61-stats b{font-size:18px}#pf61-stats .bad{color:#ff6b5c}#pf61-stats .ok{color:#7fe08a}#pf61-stats .meh{color:#ffd35c}`;
document.head.appendChild(css);

// --- Autosave off the frame --------------------------------------------------------------
if(typeof dcSave==='function'){
 const base=dcSave;let queued=false;
 dcSave=function(){
  if(typeof live!=='undefined'&&live?.dc&&!live.paused&&typeof requestIdleCallback==='function'){
   if(!queued){queued=true;requestIdleCallback(()=>{queued=false;base();},{timeout:2500});}return;}
  return base.apply(this,arguments);
 };
}

// --- Per-frame hook -----------------------------------------------------------------------
if(typeof dcRenderWorld==='function'){
 const base=dcRenderWorld;
 dcRenderWorld=function(W,L,dt){
  try{if(W&&L?.player){pfGL(W);pfShadows(W,L);pfLods(W,L);pfMergeDecals(W);pfMirror(W);}}catch(e){console.warn('pf61',e);}
  return base.apply(this,arguments);
 };
}
// Frame JS time: every requestAnimationFrame callback is timed while the overlay is on (the
// drive loop re-queues itself directly, so wrapping dcDriveFrame would miss it).
{const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=function(cb){if(!PF.on||typeof cb!=='function')return raf(cb);return raf(t=>{const a=performance.now();try{return cb(t);}finally{PF.jsAcc+=performance.now()-a;}});};}

// --- Overlay ---------------------------------------------------------------------------
function pfToggle(){
 PF.on=!PF.on;
 if(PF.on){PF.el=document.createElement('div');PF.el.id='pf61-stats';PF.txt=document.createElement('div');PF.graph=document.createElement('canvas');PF.graph.width=240;PF.graph.height=48;PF.ctx=PF.graph.getContext('2d');PF.el.append(PF.txt,PF.graph);document.body.appendChild(PF.el);PF.n=0;PF.last=0;PF.hitches=[];}
 else{PF.el?.remove();PF.el=null;const info=sc25Engine?.renderer?.info;if(info)info.autoReset=true;}
}
function pfTick(now){
 requestAnimationFrame(pfTick);
 const W=typeof sc25Engine!=='undefined'?sc25Engine:null,L=typeof live!=='undefined'?live:null;
 const race=!!(L?.dc&&!L.paused);if(document.body.classList.contains('pf61-race')!==race)document.body.classList.toggle('pf61-race',race);
 if(!PF.on){PF.last=now;return;}
 const info=W?.renderer?.info;if(info){PF.calls=info.render.calls;PF.tris=info.render.triangles;info.autoReset=false;info.reset();}
 const dt=PF.last?now-PF.last:16.7;PF.last=now;const i=PF.i=(PF.i+1)%PF.times.length;PF.times[i]=dt;PF.js[i]=PF.jsAcc;PF.jsAcc=0;PF.n=Math.min(PF.n+1,PF.times.length);
 if(dt>34)PF.hitches.push(now);while(PF.hitches.length&&now-PF.hitches[0]>10000)PF.hitches.shift();
 // Graph: one bar per frame, 16.7 ms line.
 const c=PF.ctx,w=240,h=48;c.clearRect(0,0,w,h);c.fillStyle='#ffffff18';c.fillRect(0,h-16.7*1.2,w,1);c.fillRect(0,h-33.3*1.2,w,1);
 for(let k=0;k<PF.n;k++){const v=PF.times[(i-k+PF.times.length)%PF.times.length],x=w-1-k;if(x<0)break;c.fillStyle=v>34?'#ff6b5c':v>20?'#ffd35c':'#7fe08a';const bh=Math.min(h,v*1.2);c.fillRect(x,h-bh,1,bh);}
 if(now-PF.textAt<250)return;PF.textAt=now;
 const m=Math.min(PF.n,120);let sum=0,worst=0,js=0;for(let k=0;k<m;k++){const j=(i-k+PF.times.length)%PF.times.length;sum+=PF.times[j];worst=Math.max(worst,PF.times[j]);js+=PF.js[j];}
 const avg=sum/Math.max(1,m),fps=1000/Math.max(1,avg),cls=fps>=55?'ok':fps>=40?'meh':'bad';
 const P=W?.gx55P,res=P?.w?`${P.w}×${P.h}`:W?.renderer?`${W.renderer.domElement.width}×${W.renderer.domElement.height}`:'-';
 PF.txt.innerHTML=`<b class="${cls}">${fps.toFixed(0)} FPS</b>  ${avg.toFixed(1)} ms avg · worst ${worst.toFixed(0)} ms\n`+
  `hitches >34 ms (10 s): <span class="${PF.hitches.length?'bad':'ok'}">${PF.hitches.length}</span>\n`+
  `JS ${(js/Math.max(1,m)).toFixed(1)} ms/frame\n`+
  `${PF.calls.toLocaleString()} draws · ${(PF.tris/1e6).toFixed(2)}M tris\n`+
  `3D ${res} · ${typeof sc25Quality!=='undefined'?sc25Quality:''}${L?.weather?' · '+L.weather:''}${typeof sc25Camera!=='undefined'?' · '+sc25Camera:''}`;
}
requestAnimationFrame(pfTick);
addEventListener('keydown',e=>{if(e.code!=='KeyF'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||''))return;pfToggle();});
// Right stick click (button 11) toggles it from a controller.
let padPrev=false;setInterval(()=>{let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch(_){}const b=!!pad?.buttons?.[11]?.pressed;if(b&&!padPrev)pfToggle();padPrev=b;},100);
})();
