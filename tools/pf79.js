/* PF79: cockpit frame rate. Riley saw 15-17 FPS in the cockpit view. Measured in headless Chromium
   (Albert Park, Balanced, formation lap and on the grid) with a per-draw breakdown, the cockpit costs
   on top of every other camera:
   - Transparent double-sided materials (every car's glass, the racing line) were drawn twice by
     three.js, once per face, and each pass flagged the material as changed, so three rebuilt its
     program key and re-sent every uniform twice a frame for 19 materials. From inside the car the
     windscreen glass covers the whole view, so it was also two full-screen blended layers.
     They now draw in a single pass (the glass is one sheet, so the result looks the same).
   - The rear view mirror is a second full scene render every frame: 80-120 draw calls and
     400-570k triangles for a 576x180 picture, plus another full scene-graph update.
     Cars behind now use their low-detail model from 15 m (was 45 m), the pit clutter and crew are
     left out unless you are in the pit lane, and the mirror reuses the matrices the frame already
     computed.
   - The in-car screens (centre screen and column display) redrew and re-uploaded two canvases about
     11 times a second even in the chase and TV views, where nobody can see them.
   - Auto frame-rate boost (Settings > Graphics, on by default): when the game runs below ~50 FPS
     while driving, it steps down, one notch every few seconds, the things that cost GPU time without
     changing the scene: mirror refresh every 2nd frame, then the internal 3D resolution in steps
     to 62%. It climbs back when there is headroom. The F overlay shows the current step.
   Embedded by tools/build_pf79.py as the last script. */
(function(){
'use strict';
const PF79={level:0,ema:16.7,last:0,frame:0,changedAt:0,goodSince:0,bounceUntil:0,raisedAt:0,updFrame:-1,mirrorSkipped:0,singlePass:0};
window.PF79=PF79;
const SCALE=[1,1,.9,.82,.75,.68,.62],MIRROR_EVERY=[1,2,2,2,3,3,3],MAX=SCALE.length-1;
const auto=()=>typeof D==='undefined'||D?.settings?.pf79Auto!==false;
const driving=()=>typeof live!=='undefined'&&!!live?.dc&&!live.paused&&!(typeof dcSimBusy!=='undefined'&&dcSimBusy);

// --- 1. Transparent double-sided materials in one pass -----------------------------------
// three r160 renders a transparent DoubleSide material as BackSide then FrontSide and sets
// needsUpdate both times (two program look-ups and full uniform uploads per draw, per view).
function pfSinglePass(W){
 if(PF79.frame-(W.pf79PassAt??-1e9)<90)return;W.pf79PassAt=PF79.frame;
 W.scene.traverse(o=>{const ms=o.material;if(!ms)return;for(const m of Array.isArray(ms)?ms:[ms]){
  if(!m||m.forceSinglePass||!m.transparent||m.side!==THREE.DoubleSide||m.isShaderMaterial||m.isRawShaderMaterial||m.userData?.pf79Keep)continue;
  m.forceSinglePass=true;PF79.singlePass++;}});
}

// A material that gx55 chained twice under different keys (paint and mask) gets its uniform,
// varying and noise helpers injected twice. Program variants compiled before that happened work;
// a new variant (such as the single-pass glass) fails with "redefinition" and does not draw.
// The final GLSL keeps only the first copy of each injected declaration.
function pfOnce(src,chunk){if(!chunk)return src;const i=src.indexOf(chunk);if(i<0)return src;const j=i+chunk.length;const rest=src.slice(j);return rest.includes(chunk)?src.slice(0,j)+rest.split(chunk).join(''):src;}
if(typeof WebGL2RenderingContext!=='undefined'&&!WebGL2RenderingContext.prototype.shaderSource.pf79){
 const base=WebGL2RenderingContext.prototype.shaderSource;
 const f=function(sh,src){if(typeof src==='string'&&src.includes('gx55')){const hash=typeof GX55_HASH==='string'?GX55_HASH:null;
  for(const c of ['uniform float gx55MaskOn;\n','if(gx55MaskOn>.5)gl_FragColor.a=0.0;\n','varying vec3 gx55Local;\n',hash])src=pfOnce(src,c);}
  return base.call(this,sh,src);};
 f.pf79=true;WebGL2RenderingContext.prototype.shaderSource=f;
}

// --- 2. Mirror pass ------------------------------------------------------------------------
const PF79_MIRROR_LOD1=15;
function pfMirrorInstall(){
 if(typeof fx52AuxDetail!=='function'||fx52AuxDetail.pf79)return;const base=fx52AuxDetail;
 fx52AuxDetail=function(W,cam,opts,draw){
  // Only the rear view mirror passes nearLod; the wet road reflection passes flat:true.
  if(!opts||opts.flat||opts.nearLod==null)return base.apply(this,arguments);
  const every=auto()&&driving()?MIRROR_EVERY[PF79.level]:1;
  if(every>1&&W.dc35MirrorReady&&PF79.frame%every!==0){PF79.mirrorSkipped++;return;}
  const T=THREE,eye=cam.getWorldPosition(new T.Vector3()),p=live?.player,inPits=!!(p&&(p.pitStage||p.garage||(p.v||0)<12));
  const nearLod=opts.nearLod;
  return base.call(this,W,cam,{...opts,nearLod:null},()=>{
   const saved=[];
   try{
    // Low-detail cars except right behind (the mirror picture is 576 px wide).
    for(const car of W.carNodes.values()){const lod=car.userData.dc35LOD;if(!lod||!car.visible||lod.levels.length<3)continue;
     if(car.position.distanceTo(eye)<PF79_MIRROR_LOD1)lod.levels.forEach((l,i)=>{saved.push([l.object,l.object.visible]);l.object.visible=i===nearLod;});}
    if(!inPits)for(const o of W.scene.children)if(o.visible&&(o.name==='pt61 pit clutter'||o.name==='pt61 pit crew')){saved.push([o,true]);o.visible=false;}
    // The frame already updated every matrix; the mirror camera has its own update.
    const sc=W.scene,autoUpd=sc.matrixWorldAutoUpdate;if(PF79.updFrame===PF79.frame)sc.matrixWorldAutoUpdate=false;
    try{return draw();}finally{sc.matrixWorldAutoUpdate=autoUpd;}
   }finally{for(let i=saved.length-1;i>=0;i--)saved[i][0].visible=saved[i][1];}
  });
 };
 fx52AuxDetail.pf79=true;
}
pfMirrorInstall();
function pfSceneHook(W){
 const sc=W.scene;if(!sc||sc.pf79)return;sc.pf79=true;const base=sc.updateMatrixWorld;
 sc.updateMatrixWorld=function(){PF79.updFrame=PF79.frame;return base.apply(this,arguments);};
}

// --- 3. In-car screens only when someone can see them --------------------------------------
if(typeof dc36DrawDash==='function'){
 const base=dc36DrawDash;
 dc36DrawDash=function(W,L){if(L&&!L.coop&&typeof sc25Camera!=='undefined'&&sc25Camera!=='onboard')return;return base.apply(this,arguments);};
}

// --- 4. Auto frame-rate boost --------------------------------------------------------------
function pfApply(){
 if(typeof GX55==='object'&&GX55){const s=auto()?SCALE[PF79.level]:1;if(GX55.scale!==s)GX55.scale=s;}
}
function pfGovern(now){
 const dt=PF79.last?now-PF79.last:16.7;PF79.last=now;
 if(!driving()||!auto()||document.visibilityState==='hidden'||dt>250){PF79.goodSince=0;if(!auto()&&PF79.level){PF79.level=0;pfApply();}return;}
 PF79.ema+=(dt-PF79.ema)*.05;
 if(now-PF79.changedAt<2500)return;
 const fps=1000/PF79.ema;
 if(fps<50&&PF79.level<MAX){
  // Dropping again right after a step back up means that step does not fit: stay put longer.
  if(now-PF79.raisedAt<5000)PF79.bounceUntil=now+45000;
  // A resolution step that did not help means the GPU is not what holds the frame rate back
  // (game code is): undo it and stop lowering the picture for a minute.
  if(PF79.level>=2&&PF79.before&&fps<PF79.before*1.04){PF79.level--;PF79.capUntil=now+60000;PF79.changedAt=now;PF79.before=0;pfApply();return;}
  if(PF79.level>=1&&now<(PF79.capUntil||0))return;
  PF79.before=fps;PF79.level++;PF79.changedAt=now;PF79.goodSince=0;pfApply();return;}
 if(fps>=57&&PF79.level>0){
  if(!PF79.goodSince)PF79.goodSince=now;
  if(now-PF79.goodSince>6000&&now>PF79.bounceUntil){PF79.level--;PF79.before=0;PF79.changedAt=PF79.raisedAt=now;PF79.goodSince=0;pfApply();}
 }else PF79.goodSince=0;
}
function pfTick(now){requestAnimationFrame(pfTick);try{pfGovern(now);pfOverlay();}catch(e){}}
requestAnimationFrame(pfTick);

// F overlay (pf61): one extra line for the boost step.
function pfOverlay(){
 const box=window.PF61?.el;if(!box){PF79.line=null;return;}
 if(!PF79.line||!box.contains(PF79.line)){PF79.line=document.createElement('div');box.appendChild(PF79.line);PF79.lineAt=0;}
 const now=performance.now();if(now-(PF79.lineAt||0)<250)return;PF79.lineAt=now;
 const t=!auto()?'auto boost off':PF79.level?`auto boost ${PF79.level}/${MAX} · 3D ${Math.round(SCALE[PF79.level]*100)}% · mirror ${MIRROR_EVERY[PF79.level]>1?'1/'+MIRROR_EVERY[PF79.level]:'every frame'}`:'auto boost ready (not needed)';
 if(PF79.line.textContent!==t)PF79.line.textContent=t;
}

// --- Settings ----------------------------------------------------------------------------
if(typeof dcSettingsFields==='function'){
 const base=dcSettingsFields;
 dcSettingsFields=function(...args){return base.apply(this,args)+`<div class="dc-field" style="margin-top:18px"><label class="dc-checkbox"><input type="checkbox" ${D.settings.pf79Auto!==false?'checked':''} onchange="D.settings.pf79Auto=this.checked;dcSave()">Auto frame-rate boost</label><p class="dc-muted">Graphics: when driving drops below about 50 FPS, the mirror refreshes every 2nd frame and the 3D resolution steps down until it is smooth, then climbs back. Press F while driving to see it.</p></div>`;};
}

// --- Per-frame hook -----------------------------------------------------------------------
if(typeof dcRenderWorld==='function'){
 const base=dcRenderWorld;
 dcRenderWorld=function(W,L,dt){
  PF79.frame++;
  try{if(W?.scene&&L?.player){pfSceneHook(W);pfSinglePass(W);pfApply();}}catch(e){console.warn('pf79',e);}
  return base.apply(this,arguments);
 };
}
})();
