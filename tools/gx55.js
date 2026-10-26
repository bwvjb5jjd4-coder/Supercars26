// GX55: graphics upgrade. HDR post-processing (sun and lamp glow, ACES colour grade, soft
// ambient occlusion, camera motion blur, heat haze, 4x MSAA), clear-coat paint, tyre and carbon
// detail, asphalt aggregate with wet patches and rain ripples, a rubbered-in racing line, skid
// marks for every car, rain spray, dynamic resolution and far-scenery culling.
// Built into index.html by tools/build_gx55.py as the last script. Everything wraps existing
// globals, so it works in any order relative to the circuit, physics, lamp and render layers.
// fx52 rule: mirrors and wet reflections still render every frame; nothing here throttles them.
const GX55={scale:1,fixedScale:0,ema:16.7,lastAt:0,checkAt:0,holdUntil:0,time:{value:0},maskOn:{value:0},frame:0};
function gx55Level(){return sc25Quality==='high'?2:sc25Quality==='performance'?0:1;}
function gx55PostWanted(W){return gx55Level()>0&&D?.settings?.gx55Post!==false&&!W.gx55Failed;}

// --- Shared GLSL ----------------------------------------------------------------------
const GX55_QUAD='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const GX55_HASH='float gxHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float gxNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(gxHash(i),gxHash(i+vec2(1,0)),f.x),mix(gxHash(i+vec2(0,1)),gxHash(i+vec2(1)),f.x),f.y);}';

function gx55Pass(frag,uniforms,extra={}){
 return new THREE.ShaderMaterial({vertexShader:GX55_QUAD,fragmentShader:frag,uniforms,depthTest:false,depthWrite:false,...extra});
}

// --- Post pipeline -----------------------------------------------------------------------
function gx55Post(W){
 const T=THREE,r=W.renderer,lvl=gx55Level(),buf=r.getDrawingBufferSize(new T.Vector2());
 let P=W.gx55P;
 if(!P){
  if(!r.capabilities.isWebGL2||!(r.extensions.has('EXT_color_buffer_float')||r.extensions.has('EXT_color_buffer_half_float'))){W.gx55Failed=true;return null;}
  const quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;const scene=new T.Scene();scene.add(quad);
  P=W.gx55P={quad,scene,cam:new T.OrthographicCamera(-1,1,1,-1,0,1),w:0,h:0,lvl:-1,prevVP:new T.Matrix4(),prevEye:new T.Vector3(1e9,0,0),bloom:[],mats:gx55Materials()};
 }
 // Cap the internal 3D resolution (High ~0.75x 1080p, Balanced ~0.45x of 1080p pixels) before the dynamic scale.
 const cap=Math.min(1,Math.sqrt((lvl===2?1.5e6:9e5)/Math.max(1,buf.x*buf.y))),s=(GX55.fixedScale||GX55.scale)*cap,w=Math.max(16,Math.round(buf.x*s)),h=Math.max(16,Math.round(buf.y*s));
 if(P.w!==w||P.h!==h||P.lvl!==lvl){
  P.rt?.dispose();P.rt?.depthTexture?.dispose();P.ao?.dispose();for(const b of P.bloom)b.dispose();P.bloom=[];
  const samples=lvl===2?Math.min(2,r.capabilities.maxSamples||0):0,half=T.HalfFloatType;
  P.rt=new T.WebGLRenderTarget(w,h,{type:half,samples,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
  P.rt.depthTexture=new T.DepthTexture(w,h);P.rt.depthTexture.type=T.UnsignedIntType;
  P.ao=lvl===2?new T.WebGLRenderTarget(w>>1,h>>1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false}):null;
  let bw=w>>1,bh=h>>1;for(let i=0;i<4&&bw>=4&&bh>=4;i++){P.bloom.push(new T.WebGLRenderTarget(bw,bh,{type:half,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false}));bw>>=1;bh>>=1;}
  P.w=w;P.h=h;P.lvl=lvl;
 }
 return P;
}

function gx55Materials(){
 const T=THREE,v2=()=>new T.Vector2();
 const prefilter=gx55Pass(`varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 texel;uniform float threshold0;uniform float gain;
  vec3 pick(vec2 o){vec3 c=texture2D(tSrc,vUv+o*texel).rgb*gain;float l=max(c.r,max(c.g,c.b));if(!(l<1e4)||!(min(c.r,min(c.g,c.b))>=0.0))return vec3(0.0);c=min(c,vec3(60.0));l=min(l,60.0);float sat=(l-min(c.r,min(c.g,c.b)))/max(l,1e-4);float threshold=threshold0*mix(1.0,.42,sat*sat);float knee=threshold*.5;float soft=clamp(l-threshold+knee,0.0,2.0*knee);soft=soft*soft/(4.0*knee+1e-4);return c*max(soft,l-threshold)/max(l,1e-4);}
  float karis(vec3 c){return 1.0/(1.0+dot(c,vec3(.2126,.7152,.0722)));}
  void main(){vec3 a=pick(vec2(-1,-1)),b=pick(vec2(1,-1)),c=pick(vec2(-1,1)),d=pick(vec2(1,1));float wa=karis(a),wb=karis(b),wc=karis(c),wd=karis(d);gl_FragColor=vec4((a*wa+b*wb+c*wc+d*wd)/(wa+wb+wc+wd),1.0);}`,
  {tSrc:{value:null},texel:{value:v2()},threshold0:{value:3.2},gain:{value:1}});
 const down=gx55Pass(`varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 texel;void main(){vec3 c=texture2D(tSrc,vUv).rgb*4.0;c+=texture2D(tSrc,vUv+texel*vec2(-1,-1)).rgb+texture2D(tSrc,vUv+texel*vec2(1,-1)).rgb+texture2D(tSrc,vUv+texel*vec2(-1,1)).rgb+texture2D(tSrc,vUv+texel*vec2(1,1)).rgb;gl_FragColor=vec4(c/8.0,1.0);}`,
  {tSrc:{value:null},texel:{value:v2()}});
 const up=gx55Pass(`varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 texel;uniform float weight;void main(){vec3 c=vec3(0);
  c+=texture2D(tSrc,vUv+texel*vec2(-2,0)).rgb+texture2D(tSrc,vUv+texel*vec2(2,0)).rgb+texture2D(tSrc,vUv+texel*vec2(0,-2)).rgb+texture2D(tSrc,vUv+texel*vec2(0,2)).rgb;
  c+=(texture2D(tSrc,vUv+texel*vec2(-1,-1)).rgb+texture2D(tSrc,vUv+texel*vec2(1,-1)).rgb+texture2D(tSrc,vUv+texel*vec2(-1,1)).rgb+texture2D(tSrc,vUv+texel*vec2(1,1)).rgb)*2.0;
  gl_FragColor=vec4(c/12.0*weight,1.0);}`,
  {tSrc:{value:null},texel:{value:v2()},weight:{value:1}},{blending:T.AdditiveBlending,transparent:true});
 // Screen-space ambient occlusion at half resolution: contact shading under cars, in corners,
 // where walls meet the ground and between buildings.
 const ao=gx55Pass(`varying vec2 vUv;uniform sampler2D tDepth;uniform mat4 invProj;uniform float projScale;uniform vec2 texel;${GX55_HASH}
  vec3 viewAt(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 p=invProj*vec4(uv*2.0-1.0,d*2.0-1.0,1.0);return p.xyz/p.w;}
  void main(){float d=texture2D(tDepth,vUv).x;if(d>=.99999){gl_FragColor=vec4(1);return;}
   vec3 p=viewAt(vUv);float dist=-p.z;if(dist>180.0){gl_FragColor=vec4(1);return;}
   vec3 n=normalize(cross(viewAt(vUv+vec2(texel.x,0))-p,viewAt(vUv+vec2(0,texel.y))-p));
   float radius=mix(.55,2.4,smoothstep(4.0,60.0,dist));float rs=clamp(radius*projScale/dist,texel.x*3.0,.12);
   float ang=gxHash(gl_FragCoord.xy)*6.2831853,occ=0.0;
   for(int i=0;i<6;i++){float f=(float(i)+.5)/6.0;float a=ang+float(i)*2.39996;vec2 o=vec2(cos(a),sin(a))*rs*sqrt(f);vec3 q=viewAt(vUv+o)-p;float l=length(q);
    occ+=max(0.0,dot(n,q/max(l,1e-4))-.28)*step(dist*.004,l)*(1.0-smoothstep(radius*.6,radius*1.6,l));}
   occ=clamp(1.0-occ/6.0*2.4,0.0,1.0);gl_FragColor=vec4(vec3(mix(occ,1.0,smoothstep(110.0,180.0,dist))),1.0);}`,
  {tDepth:{value:null},invProj:{value:new T.Matrix4()},projScale:{value:1},texel:{value:v2()}});
 // Final composite: heat haze, camera motion blur, AO, bloom, ACES tone mapping, colour grade.
 const composite=gx55Pass(`varying vec2 vUv;uniform sampler2D tScene;uniform sampler2D tDepth;uniform sampler2D tBloom;uniform sampler2D tAO;
  uniform mat4 invViewProj;uniform mat4 prevViewProj;uniform mat4 invProj;uniform float exposure;uniform float bloom;uniform float blur;uniform float haze;uniform float time;uniform float useAO;uniform float dbg;
  uniform vec2 texel;uniform vec2 aoTexel;uniform float saturation;uniform float contrast;uniform float vignette;uniform vec3 lift;uniform vec3 gain;${GX55_HASH}
  vec3 gxRRT(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
  vec3 gxAces(vec3 c){const mat3 I=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));const mat3 O=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));c*=exposure/.6;return clamp(O*gxRRT(I*c),0.0,1.0);}
  vec3 toSRGB(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-.055,step(.0031308,c));}
  void main(){vec2 uv=vUv;float d=texture2D(tDepth,vUv).x;vec4 vp=invProj*vec4(vUv*2.0-1.0,d*2.0-1.0,1.0);float dist=-vp.z/vp.w;bool sky=d>=.99999;
   if(haze>0.0&&!sky){float m=smoothstep(35.0,130.0,dist)*(1.0-smoothstep(400.0,900.0,dist));vec2 q=vUv*vec2(90.0,160.0);uv+=(vec2(gxNoise(q+vec2(0.0,time*2.2)),gxNoise(q*1.3-vec2(time*1.7,0.0)))-.5)*haze*m*.0028;}
   vec4 base=texture2D(tScene,uv);if(!(dot(base.rgb,vec3(1.0))<1e5))base.rgb=vec3(0.0);vec3 col=base.rgb;
   if(dbg>3.5){gl_FragColor=vec4(dbg<4.5?toSRGB(gxAces(col)):dbg<5.5?toSRGB(texture2D(tAO,vUv).rrr):toSRGB(gxAces(col*texture2D(tAO,vUv).r)),1.0);return;}
   if(blur>0.0){float dd=min(d,.99995);vec4 wp=invViewProj*vec4(vUv*2.0-1.0,dd*2.0-1.0,1.0);wp/=wp.w;vec4 pp=prevViewProj*wp;vec2 puv=pp.xy/max(pp.w,1e-4)*.5+.5;vec2 vel=(vUv-puv)*blur;
    float lv=length(vel);if(lv>.035)vel*=.035/lv;vel*=smoothstep(.2,.45,base.a)*smoothstep(2.5,7.0,dist);
    if(dot(vel,vel)>texel.x*texel.x*.25){vec3 acc=col;float wsum=1.0;float j=gxHash(gl_FragCoord.xy+time)-.5;for(int i=1;i<6;i++){float t=(float(i)+j)/5.0-.5;vec4 s=texture2D(tScene,uv+vel*t);float w=smoothstep(.2,.45,s.a)*step(dot(s.rgb,vec3(1.0)),1e5);s.rgb*=w;acc+=s.rgb*w;wsum+=w;}col=acc/wsum;}}
   if(useAO>0.0){float a=0.0;for(int i=0;i<8;i++){float t=float(i)*.785398+.39;a+=texture2D(tAO,vUv+aoTexel*vec2(cos(t),sin(t))*(1.5+mod(float(i),2.0)*1.5)).r;}a=a/8.0*.75+texture2D(tAO,vUv).r*.25;col*=mix(1.0,a,useAO);}
   col+=texture2D(tBloom,vUv).rgb*bloom;
   col=gxAces(col);
   float l=dot(col,vec3(.2126,.7152,.0722));col=max(vec3(0.0),mix(vec3(l),col,saturation));
   col=col*gain+lift*(1.0-col);
   col=toSRGB(col);col=mix(col,col*col*(3.0-2.0*col),contrast);
   vec2 v=vUv-.5;v.x*=texel.y/texel.x;col*=1.0-vignette*smoothstep(.25,1.05,length(v)*1.25);
   col+=(gxHash(gl_FragCoord.xy+fract(time))-.5)/255.0;
   if(dbg>0.5){gl_FragColor=dbg<1.5?vec4(vec3(fract(log2(max(dist,.01)))),1.0):dbg<2.5?vec4(vec3(base.a),1.0):vec4(vec3(texture2D(tAO,vUv).r),1.0);return;}
   gl_FragColor=vec4(col,1.0);}`,
  {tScene:{value:null},tDepth:{value:null},tBloom:{value:null},tAO:{value:null},invViewProj:{value:new T.Matrix4()},prevViewProj:{value:new T.Matrix4()},invProj:{value:new T.Matrix4()},exposure:{value:1},bloom:{value:.06},blur:{value:0},haze:{value:0},time:{value:0},useAO:{value:0},dbg:{value:0},texel:{value:v2()},aoTexel:{value:v2()},saturation:{value:1.08},contrast:{value:.10},vignette:{value:.16},lift:{value:new T.Vector3()},gain:{value:new T.Vector3(1,1,1)}});
 return {prefilter,down,up,ao,composite};
}

function gx55Run(W,P,mat){P.quad.material=mat;W.renderer.render(P.scene,P.cam);}

function gx55Composite(W,L,P){
 const T=THREE,r=W.renderer,M=P.mats,cam=W.camera,lvl=P.lvl,auto=r.autoClear;
 r.autoClear=false;
 try{
  // Glow: threshold the HDR frame, blur it down a mip chain, then add the levels back up.
  const B=P.bloom;
  M.prefilter.uniforms.tSrc.value=P.rt.texture;M.prefilter.uniforms.texel.value.set(1/P.w,1/P.h);M.prefilter.uniforms.gain.value=r.toneMappingExposure/.6;
  r.setRenderTarget(B[0]);gx55Run(W,P,M.prefilter);
  for(let i=1;i<B.length;i++){M.down.uniforms.tSrc.value=B[i-1].texture;M.down.uniforms.texel.value.set(.5/B[i-1].width,.5/B[i-1].height);r.setRenderTarget(B[i]);gx55Run(W,P,M.down);}
  for(let i=B.length-1;i>0;i--){M.up.uniforms.tSrc.value=B[i].texture;M.up.uniforms.texel.value.set(.5/B[i].width,.5/B[i].height);M.up.uniforms.weight.value=1;r.setRenderTarget(B[i-1]);gx55Run(W,P,M.up);}
  cam.updateMatrixWorld();
  if(P.ao){M.ao.uniforms.tDepth.value=P.rt.depthTexture;M.ao.uniforms.invProj.value.copy(cam.projectionMatrixInverse);M.ao.uniforms.projScale.value=cam.projectionMatrix.elements[5]*.5;M.ao.uniforms.texel.value.set(1/P.ao.width,1/P.ao.height);r.setRenderTarget(P.ao);gx55Run(W,P,M.ao);}
  const u=M.composite.uniforms,vp=new T.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),eye=cam.getWorldPosition(new T.Vector3());
  const cut=eye.distanceTo(P.prevEye)>12||L.paused||dcSimBusy||W.gx55LastCam!==sc25Camera;
  if(cut)P.prevVP.copy(vp);
  u.tScene.value=P.rt.texture;u.tDepth.value=P.rt.depthTexture;u.tBloom.value=B[0].texture;u.tAO.value=P.ao?.texture||null;u.useAO.value=P.ao?(L.weather==='Dry'?.85:.65):0;
  u.invViewProj.value.copy(vp).invert();u.prevViewProj.value.copy(P.prevVP);u.invProj.value.copy(cam.projectionMatrixInverse);
  u.exposure.value=r.toneMappingExposure;u.time.value=W.clock||0;u.texel.value.set(1/P.w,1/P.h);u.aoTexel.value.set(P.ao?1/P.ao.width:0,P.ao?1/P.ao.height:0);
  u.bloom.value=(lvl===2?.075:.065)/Math.max(1,B.length*.5);
  u.blur.value=D?.settings?.gx55Blur===false?0:lvl===2?.55:.45;
  const g=gx55Grade(W,L);u.haze.value=g.haze;u.saturation.value=g.sat;u.contrast.value=g.contrast;u.vignette.value=g.vignette;u.lift.value.copy(g.lift);u.gain.value.copy(g.gain);
  u.dbg.value=GX55.debug||0;r.setRenderTarget(null);gx55Run(W,P,M.composite);
  P.prevVP.copy(vp);P.prevEye.copy(eye);W.gx55LastCam=sc25Camera;
 }finally{r.autoClear=auto;}
}

// Colour grade follows the conditions: warm and punchy in the sun, softer and cooler in rain,
// golden at dawn/dusk, blue and deep at night.
function gx55Grade(W,L){
 const T=THREE,wet=L.weather==='Dry'?0:L.weather==='Extremely Wet'?1:.7,sun=typeof irSunState==='function'&&IR?.active?irSunState(L):{day:1,dusk:0,night:0};
 const day=sun.day*(1-wet),dusk=sun.dusk*sun.day,night=sun.night;
 return {
  haze:day*(1-dusk)*(L.weather==='Dry'?1:0),
  sat:1.07+day*.05-wet*.09-night*.06,
  contrast:.03+day*.03-wet*.02,
  vignette:.14+night*.08+wet*.04,
  lift:new T.Vector3(.004,.005,.009+night*.006).multiplyScalar(1+wet*.5),
  gain:new T.Vector3(1+day*.018+dusk*.05,1+day*.006+dusk*.008,1-day*.012-dusk*.05-wet*.0+night*.0).add(new T.Vector3(-wet*.012,-wet*.004,wet*.01))
 };
}

// Main view: draw into the HDR multisampled target, then composite to the screen.
const gx55MainBase=rf41MainDraw;
rf41MainDraw=function(W,L){
 gx55Frame(W,L);
 const P=gx55PostWanted(W)?gx55Post(W):null;
 if(!P)return gx55MainBase(W,L);
 const r=W.renderer,prev=r.getRenderTarget();
 try{GX55.maskOn.value=1;r.setRenderTarget(P.rt);gx55MainBase(W,L);}
 catch(e){console.error('GX55 post disabled',e);W.gx55Failed=true;r.setRenderTarget(prev);return gx55MainBase(W,L);}
 finally{GX55.maskOn.value=0;}
 try{gx55Composite(W,L,P);}catch(e){console.error('GX55 composite failed',e);W.gx55Failed=true;r.setRenderTarget(null);gx55MainBase(W,L);}
};

// --- Per-frame bookkeeping: dynamic resolution, world upgrades, spray, AI skid marks ---------
function gx55Frame(W,L){
 const now=performance.now(),dt=GX55.lastAt?Math.min(100,now-GX55.lastAt):16.7;GX55.lastAt=now;GX55.frame++;
 if(!L.paused&&!dcSimBusy)GX55.ema+=(dt-GX55.ema)*.06;
 GX55.time.value=W.clock||0;
 // Hold 60 fps on Xbox: render the 3D view at a lower internal resolution when frames run long,
 // and climb back once there is headroom. The HUD and the final image stay full resolution.
 if(!GX55.fixedScale&&now>GX55.checkAt&&!L.paused){GX55.checkAt=now+500;
  if(GX55.ema>18.2&&GX55.scale>.5){GX55.scale=Math.max(.5,GX55.scale-.1);GX55.holdUntil=now+4000;}
  else if(GX55.ema<17.0&&GX55.scale<1&&now>GX55.holdUntil){GX55.scale=Math.min(1,GX55.scale+.04);GX55.holdUntil=now+1500;}}
 if(W.gx55World!==W.world){W.gx55World=W.world;gx55UpgradeWorld(W);}
 gx55UpgradeCars(W);
 const dt60=L.paused||dcSimBusy?0:Math.min(.06,dt/1000);
 gx55Spray(W,L,dt60);gx55AIMarks(W,L,dt60);
 if(GX55.frame%12===0)gx55Cull(W);
 gx55Track(W,L);
}

// --- Car materials ---------------------------------------------------------------------
// Clear coat with orange peel and metallic flake, a tread and sidewall on the tyres, real carbon
// weave on the black trim. Every car material also writes alpha 0 into the HDR target, which the
// motion blur reads as "moving with the camera" so cars stay sharp while the world streaks past.
function gx55Chain(m,key,edit){
 if(!m||m.userData.gx55===key)return;m.userData.gx55=key;const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey;
 m.onBeforeCompile=function(sh,r){prev?.call(this,sh,r);edit(sh);};
 m.customProgramCacheKey=function(){return (prevKey?prevKey.call(this):'')+'|'+key;};m.needsUpdate=true;
}
function gx55Mask(sh){
 sh.uniforms.gx55MaskOn=GX55.maskOn;
 sh.fragmentShader='uniform float gx55MaskOn;\n'+sh.fragmentShader.replace(/}\s*$/,'if(gx55MaskOn>.5)gl_FragColor.a=0.0;\n}');
}
function gx55Local(sh){
 if(!sh.vertexShader.includes('varying vec3 gx55Local'))sh.vertexShader='varying vec3 gx55Local;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngx55Local=position;');
 sh.fragmentShader='varying vec3 gx55Local;\n'+GX55_HASH+'\n'+sh.fragmentShader;
}
function gx55Paint(sh){
 gx55Local(sh);gx55Mask(sh);
 // Orange peel on the clear coat, flake sparkle in the base coat; both fade out with distance
 // so they never shimmer.
 sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_fragment>',`{vec3 lp=gx55Local*95.0;float fade=1.0-smoothstep(.15,.9,length(fwidth(lp)));
  vec2 peel=vec2(gxNoise(gx55Local.xz*38.0+gx55Local.y*11.0),gxNoise(gx55Local.zy*38.0+gx55Local.x*13.0))-.5;
  #ifdef USE_CLEARCOAT
  clearcoatNormal=normalize(clearcoatNormal+vec3(peel*.022*fade,0.0));
  #endif
  vec3 cell=floor(gx55Local*420.0);float flake=gxHash(cell.xy+cell.z*.37);vec3 fn=vec3(gxHash(cell.yz)-.5,gxHash(cell.zx)-.5,0.0);
  normal=normalize(normal+fn*.06*step(.55,flake)*fade*fade);}
  #include <lights_physical_fragment>`);
}
function gx55Rubber(sh){
 gx55Mask(sh);
 // Worn tread is a slightly polished grey-black; sidewalls stay matte black.
 if(sh.fragmentShader.includes('dc35TyreLocal'))sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_fragment>',`{float rad=length(dc35TyreLocal.yz);float tread=smoothstep(.35,.37,rad)*(1.0-smoothstep(.13,.155,abs(dc35TyreLocal.x)));
  float side=1.0-tread;diffuseColor.rgb=mix(diffuseColor.rgb*.82,diffuseColor.rgb*1.18+.006,tread);
  roughnessFactor=mix(.97,.68,tread);float ring=step(.355,rad)*step(rad,.362)*side;diffuseColor.rgb+=ring*.018;}
  #include <lights_physical_fragment>`).replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>');
}
function gx55Carbon(sh){
 gx55Local(sh);gx55Mask(sh);
 // 2x2 twill weave with anisotropic sheen; only on dark trim so seats and harness keep their look.
 sh.fragmentShader=sh.fragmentShader.replace('#include <lights_physical_fragment>',`{vec3 c=diffuseColor.rgb;float dark=1.0-smoothstep(.06,.16,max(c.r,max(c.g,c.b)));
  vec2 w=(abs(normal.y)>.7?gx55Local.xz:gx55Local.zy)*260.0;float fade=1.0-smoothstep(.3,1.2,length(fwidth(w)));
  float tw=step(.5,fract((floor(w.x)+floor(w.y))*.25));float sheen=mix(sin(fract(w.x)*3.14159),sin(fract(w.y)*3.14159),tw);
  diffuseColor.rgb=mix(c,c*(.75+sheen*.55),dark*fade);roughnessFactor=mix(roughnessFactor,.30+tw*.12,dark*fade);}
  #include <lights_physical_fragment>`);
}
function gx55UpgradeCars(W){
 for(const car of W.carNodes?.values()||[]){
  if(!car.userData.dc35Car||car.userData.gx55Done)continue;car.userData.gx55Done=true;
  car.traverse(o=>{if(!o.isMesh||!o.material)return;const b=o.userData.dc35Bucket,m=o.material;
   if(b==='paint'||b==='hood'){if(m.isMeshPhysicalMaterial&&!m.userData.gx55Tuned){m.userData.gx55Tuned=true;m.clearcoat=1;m.clearcoatRoughness=.075;m.roughness=Math.min(m.roughness,.30);m.envMapIntensity=1.35;m.specularIntensity=.75;}gx55Chain(m,'gx55paint1',gx55Paint);}
   else if(b==='rubber')gx55Chain(m,'gx55rubber1',gx55Rubber);
   else if(b==='trim')gx55Chain(m,'gx55carbon1',gx55Carbon);
   else if((m.isMeshStandardMaterial||m.isMeshBasicMaterial)&&!m.transparent)gx55Chain(m,'gx55mask1',gx55Mask);});
 }
 // rf41 batches trim/wheel parts of all cars into shared meshes each frame.
 for(const b of W.rf41CarBatches?.values()||[]){const m=b.mesh?.material;if(m&&!m.userData.gx55&&!m.transparent)gx55Chain(m,'gx55mask1',gx55Mask);}
}

// --- Sky ---------------------------------------------------------------------------------
// A bright HDR sun disc with a forward-scattering halo and a hazier horizon. The car
// reflections are captured from this sky, so the paint picks it up too.
const gx55SkyBase=dc35Sky;
dc35Sky=function(W){
 gx55SkyBase(W);const m=W.dc35Sky?.mesh?.material;if(!m)return;
 const sun=m.fragmentShader.includes('irSunDirection')?'normalize(irSunDirection)':'normalize(vec3(-.48,.80,-.34))',i=m.fragmentShader.lastIndexOf('gl_FragColor=vec4(col,1.0);');if(i<0)return;
 const night=m.fragmentShader.includes('irNight')?'(1.0-irNight)':'1.0';
 m.fragmentShader=m.fragmentShader.slice(0,i)+`{vec3 sd=${sun};float mu=max(0.0,dot(d,sd));float clear=(1.0-wet)*${night};
  col=mix(col,col*vec3(1.04,1.02,1.0)+vec3(.05,.045,.04),pow(1.0-h,6.0)*clear*.6);
  col+=vec3(1.0,.82,.58)*(pow(mu,8.0)*.22+pow(mu,64.0)*.55)*clear;
  col+=vec3(1.0,.93,.80)*smoothstep(.99955,.99985,mu)*26.0*clear;
  col+=vec3(.9,.92,.95)*pow(mu,6.0)*.10*wet;}
  `+m.fragmentShader.slice(i);m.needsUpdate=true;
};

// --- Track surface -----------------------------------------------------------------------
// Tileable aggregate: stones (height, albedo) baked into a mip-mapped texture so the asphalt
// has grain up close without the shimmer of procedural noise further away.
function gx55AsphaltTexture(W){
 if(W.gx55Asphalt)return W.gx55Asphalt;const T=THREE,N=512,G=48,cell=N/G,data=new Uint8Array(N*N*4),hgt=new Float32Array(N*N);let seed=9127;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
 const pts=[];for(let j=0;j<G;j++)for(let i=0;i<G;i++)for(let k=0;k<2;k++)pts.push([(i+rnd())*cell,(j+rnd())*cell,.55+rnd()*.9,.35+rnd()*.65]);
 const at=(i,j)=>pts.slice((((j+G)%G)*G+((i+G)%G))*2,(((j+G)%G)*G+((i+G)%G))*2+2);
 const alb=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const ci=Math.floor(x/cell),cj=Math.floor(y/cell);let best=1e9,b2=1e9,tone=.5,size=1;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)for(const p of at(ci+di,cj+dj)){const px=p[0]+((ci+di<0)?-N:(ci+di>=G)?N:0),py=p[1]+((cj+dj<0)?-N:(cj+dj>=G)?N:0),dd=Math.hypot(x-px,y-py)/(cell*.62*p[2]);if(dd<best){b2=best;best=dd;tone=p[3];size=p[2];}else if(dd<b2)b2=dd;}
  const stone=Math.max(0,1-best*best),edge=Math.min(1,(b2-best)*3);hgt[y*N+x]=stone*edge*size;alb[y*N+x]=stone>0?.75+tone*.5:.62+rnd()*.12;}
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,hx=hgt[y*N+(x+1)%N]-hgt[y*N+(x+N-1)%N],hy=hgt[((y+1)%N)*N+x]-hgt[((y+N-1)%N)*N+x];
  data[i*4]=Math.max(0,Math.min(255,alb[i]*200));data[i*4+1]=Math.max(0,Math.min(255,128-hx*90));data[i*4+2]=Math.max(0,Math.min(255,128-hy*90));data[i*4+3]=Math.max(0,Math.min(255,255-hgt[i]*255));}
 const t=new T.DataTexture(data,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=Math.min(8,W.renderer.capabilities.getMaxAnisotropy());t.colorSpace=T.NoColorSpace;t.needsUpdate=true;
 return W.gx55Asphalt=t;
}
function gx55RoadEdit(W){
 const tex=gx55AsphaltTexture(W);
 return sh=>{
  sh.uniforms.gx55Asphalt={value:tex};sh.uniforms.gx55Time=GX55.time;sh.uniforms.gx55Rain=W.gx55Rain||(W.gx55Rain={value:0});
  const world=sh.fragmentShader.includes('dc35RoadWorld');
  if(!world)sh.vertexShader='varying vec3 dc35RoadWorld;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndc35RoadWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  const wet=sh.fragmentShader.includes('dc35RoadWet')?'dc35RoadWet':'0.0';
  sh.fragmentShader=(world?'':'varying vec3 dc35RoadWorld;\n')+'uniform sampler2D gx55Asphalt;uniform float gx55Time;uniform float gx55Rain;\n'+GX55_HASH+'\n'+sh.fragmentShader.replace('#include <lights_physical_fragment>',`{
   vec2 wp=dc35RoadWorld.xz;float camDist=length(vViewPosition);float near=1.0-smoothstep(18.0,70.0,camDist);float wetness=${wet};
   vec4 ag=texture2D(gx55Asphalt,wp/1.7);vec4 ag2=texture2D(gx55Asphalt,wp/6.1+.37);
   float macro=gxNoise(wp*.045)*.6+gxNoise(wp*.19)*.4;
   diffuseColor.rgb*=mix(1.0,(ag.r*1.275)*1.08+.08,.55+near*.25)*(.93+ag2.r*1.275*.12)*(.95+macro*.10)*1.09;
   vec3 tW=normalize((viewMatrix*vec4(1.0,0.0,0.0,0.0)).xyz),bW=normalize((viewMatrix*vec4(0.0,0.0,1.0,0.0)).xyz);
   vec2 nd=(ag.gb-.5)*near*1.3+(ag2.gb-.5)*.3;
   // Standing water collects in shallow dips: these patches go dark, glassy and flat, with rain
   // ripples when it is still raining. Between them the surface is just damp.
   float dip=smoothstep(.52,.78,macro+gxNoise(wp*.6)*.18-.06)*smoothstep(.0,.35,wetness);
   float cavity=1.0-ag.a;
   diffuseColor.rgb*=1.0-dip*.28-wetness*cavity*.10;
   roughnessFactor=mix(roughnessFactor,.025,dip*.9);
   vec2 rip=vec2(0.0);
   if(gx55Rain>0.0&&dip>.01){vec2 g=wp*1.6;for(int k=0;k<2;k++){vec2 c=floor(g),f=fract(g)-.5;float h=gxHash(c+float(k)*17.0);vec2 o=vec2(gxHash(c+3.1),gxHash(c+7.7))-.5;vec2 dd=f-o*.6;float t=fract(gx55Time*(.7+h*.5)+h);float r=length(dd);float ring=sin((r-t*.55)*42.0)*smoothstep(.0,.06,t*.55-r+.06)*smoothstep(.12,.0,abs(r-t*.55))*(1.0-t);rip+=dd/max(r,1e-3)*ring*.5;g=g*1.7+11.0;}rip*=gx55Rain*near;}
   nd=mix(nd,rip,dip);
   normal=normalize(normal+tW*nd.x+bW*nd.y);
   #ifdef USE_CLEARCOAT
   clearcoatNormal=normalize(clearcoatNormal+(tW*rip.x+bW*rip.y)*dip);
   #endif
  }
  #include <lights_physical_fragment>`);
 };
}
function gx55UpgradeWorld(W){
 const T=THREE;
 for(const m of [W.roadMaterial,W.pitMaterial])if(m?.isMeshStandardMaterial)gx55Chain(m,'gx55road1',gx55RoadEdit(W));
 // Rubbered-in racing line: two dark tyre bands along the whole lap, heaviest in braking zones
 // and through corners. The corner-only "Bedded tyre rubber" strips stay on top.
 W.gx55Line?.removeFromParent();W.gx55Line=null;
 if(W.samples&&W.racingLine&&W.N>20){
  const N=W.N,pos=[],col=[],uv=[],ix=[],ds=(W.e?.lengthKm||3)*1000/N,lift=.014,half=1.25;
  for(let i=0;i<=N;i++){const j=i%N,s=W.samples[j],off=W.racingLine[j]||0,a=W.samples[(j-6+N)%N].v,b=W.samples[(j+6)%N].v,turn=Math.acos(clamp(a.dot(b),-1,1));
   let drop=0;for(let k=2;k<Math.max(6,Math.round(90/ds));k+=2)drop=Math.max(drop,s.speed-W.samples[(j+k)%N].speed);
   const alpha=clamp(.10+turn*1.6+drop*.012,.08,.42);
   for(const side of [-1,1]){pos.push(s.p.x+s.n.x*(off+side*half),s.p.y+lift,s.p.z+s.n.z*(off+side*half));col.push(1,1,1,alpha);uv.push(side<0?0:1,i*.5);}}
  for(let i=0;i<N;i++){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,4));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  const c=document.createElement('canvas');c.width=128;c.height=4;const x=c.getContext('2d'),gr=x.createLinearGradient(0,0,128,0);
  for(const [p,v] of [[0,0],[.10,0],[.22,.85],[.32,1],[.42,.55],[.5,.25],[.58,.55],[.68,1],[.78,.85],[.9,0],[1,0]])gr.addColorStop(p,`rgb(${v*255|0},${v*255|0},${v*255|0})`);x.fillStyle=gr;x.fillRect(0,0,128,4);
  const am=new T.CanvasTexture(c);am.colorSpace=T.NoColorSpace;
  const mat=new T.MeshStandardMaterial({color:'#0d1012',roughness:.78,metalness:0,transparent:true,vertexColors:true,alphaMap:am,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  const mesh=new T.Mesh(g,mat);mesh.name='Rubbered racing line';mesh.receiveShadow=true;mesh.renderOrder=1;mesh.frustumCulled=false;(W.world||W.scene).add(mesh);W.gx55Line=mesh;
 }
}
function gx55Track(W,L){
 const wet=L.weather==='Dry'?0:L.weather==='Extremely Wet'?1:.75;
 if(W.gx55Rain)W.gx55Rain.value=wet;
 const m=W.gx55Line?.material;if(m){m.roughness=wet?.32:.78;m.opacity=wet?.7:1;}
}

// --- Skid marks from every car ----------------------------------------------------------
// The physics layer marks the player's slides. AI cars lay faint lock-up and braking lines, so
// braking zones build up dark rubber through a session like the real thing.
function gx55MarksPool(W){
 if(W.gx55Marks)return W.gx55Marks;const T=THREE,MARKS=2600,g=new T.BufferGeometry(),p=new Float32Array(MARKS*12),c=new Float32Array(MARKS*16),ix=new Uint32Array(MARKS*6);
 for(let i=0;i<MARKS;i++){const a=i*4;ix.set([a,a+1,a+2,a+1,a+3,a+2],i*6);}
 g.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(c,4).setUsage(T.DynamicDrawUsage));g.setIndex(new T.BufferAttribute(ix,1));
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));mesh.frustumCulled=false;mesh.renderOrder=1;mesh.name='AI skid marks';W.scene.add(mesh);
 return W.gx55Marks={mesh,MARKS,at:0,dirty:false,last:new Map()};
}
function gx55AIMarks(W,L,dt){
 if(!dt||gx55Level()===0)return;const M=gx55MarksPool(W),eye=W.camera.position,T=THREE,v=new T.Vector3();
 for(const x of L.entrants){if(x===L.player||x.garage||x.retired||x.pitStage)continue;const car=W.carNodes.get(x.d.id);if(!car?.visible||car.position.distanceToSquared(eye)>260*260){M.last.delete(x);continue;}
  const decel=x.gx55V!=null?(x.gx55V-x.v)/dt:0;x.gx55V=x.v;const lock=x.braking&&decel>9&&x.v>18,slide=Math.abs(x.latV||0)>2.2&&x.v>12;
  const wheels=car.userData.dc35Wheels;if(!wheels?.length||!(lock||slide)){M.last.delete(x);continue;}
  const prev=M.last.get(x)||[],now=[];car.updateMatrixWorld();
  for(let i=0;i<wheels.length;i++){const w=wheels[i];if(lock&&!slide&&!w.front)continue;w.pivot.getWorldPosition(v);const q={x:v.x,y:car.position.y+.016,z:v.z,f:1};now[i]=q;const a=prev[i];
   if(a&&Math.hypot(q.x-a.x,q.z-a.z)<5&&Math.hypot(q.x-a.x,q.z-a.z)>.4){gx55Mark(M,a,q,.25,slide?.30:.13);}else if(a){now[i]=a;}}
  M.last.set(x,now.map((q,i)=>q&&prev[i]&&Math.hypot(q.x-prev[i].x,q.z-prev[i].z)<=.4?prev[i]:q));
 }
 if(M.dirty){const g=M.mesh.geometry;g.attributes.position.needsUpdate=g.attributes.color.needsUpdate=true;M.dirty=false;}
}
function gx55Mark(M,a,b,width,alpha){
 const i=M.at;M.at=(M.at+1)%M.MARKS;const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,sx=-dz/len*width/2,sz=dx/len*width/2,p=M.mesh.geometry.attributes.position.array,c=M.mesh.geometry.attributes.color.array;
 p.set([a.x+sx,a.y,a.z+sz,a.x-sx,a.y,a.z-sz,b.x+sx,b.y,b.z+sz,b.x-sx,b.y,b.z-sz],i*12);for(let k=0;k<4;k++)c.set([.025,.025,.025,alpha],i*16+k*4);M.dirty=true;
}

// --- Rain spray ---------------------------------------------------------------------------
// Each car throws a plume of mist off its rear tyres that grows with speed, so following in the
// wet really cuts the view. Soft sprites, one draw call; not drawn in mirrors or reflections.
function gx55SprayPool(W){
 if(W.gx55Spray)return W.gx55Spray;const T=THREE,N=[300,500,800][gx55Level()],g=new T.BufferGeometry(),pos=new Float32Array(N*3),size=new Float32Array(N),alpha=new Float32Array(N);
 g.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('size',new T.BufferAttribute(size,1).setUsage(T.DynamicDrawUsage));g.setAttribute('alpha',new T.BufferAttribute(alpha,1).setUsage(T.DynamicDrawUsage));
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:400},tint:{value:new T.Color('#c9d2d6')}},
  vertexShader:'attribute float size;attribute float alpha;varying float vA;uniform float scale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=min(700.0,size*scale/max(.2,-mv.z));vA=alpha*smoothstep(.5,3.0,-mv.z);}',
  fragmentShader:'varying float vA;uniform vec3 tint;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.0;if(r>1.0)discard;float n=fract(sin(dot(floor(gl_PointCoord*6.0),vec2(12.9,78.2)))*43758.5);gl_FragColor=vec4(tint,vA*(1.0-r)*(1.0-r)*(.75+n*.25));}'});
 const pts=new T.Points(g,mat);pts.frustumCulled=false;pts.renderOrder=5;pts.name='Rain spray';pts.layers.set(2);W.camera.layers.enable(2);W.scene.add(pts);
 return W.gx55Spray={pts,N,at:0,p:Array.from({length:N},()=>({life:0})),acc:new Map()};
}
function gx55Spray(W,L,dt){
 const wet=L.weather==='Dry'?0:L.weather==='Extremely Wet'?1:.6;if(!wet&&!W.gx55Spray)return;const S=gx55SprayPool(W),eye=W.camera.position;
 if(dt>0&&wet)for(const x of L.entrants){if(x.garage||x.retired)continue;const car=W.carNodes.get(x.d.id);if(!car?.visible)continue;const d2=car.position.distanceToSquared(eye);if(d2>220*220||x.v<8)continue;
  const rate=Math.min(90,x.v*x.v*.035*wet)*(d2>90*90?.4:1);let acc=(S.acc.get(x)||0)+rate*dt;const sy=Math.sin(x.yaw),cy=Math.cos(x.yaw);
  while(acc>=1){acc-=1;const q=S.p[S.at];S.at=(S.at+1)%S.N;const side=Math.random()<.5?-1:1,back=-2.0-Math.random()*.6;
   q.x=car.position.x+sy*back+cy*side*.8;q.z=car.position.z+cy*back-sy*side*.8;q.y=car.position.y+.25;
   const sp=x.v*(.25+Math.random()*.2);q.vx=sy*(x.v-sp)*.0+(-sy*sp*.35)+cy*side*(.6+Math.random()*1.6);q.vz=cy*(-sp*.35)-sy*side*(.6+Math.random()*1.6);q.vy=.8+Math.random()*1.8;
   q.life=q.max=.7+Math.random()*.8;q.s=.5+Math.random()*.4;q.grow=1.6+x.v*.06;q.a=.16+wet*.12;}
  S.acc.set(x,acc);}
 const g=S.pts.geometry,pos=g.attributes.position.array,size=g.attributes.size.array,al=g.attributes.alpha.array;
 for(let i=0;i<S.N;i++){const q=S.p[i];if(q.life>0&&dt>0){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vx*=Math.exp(-dt*2.2);q.vz*=Math.exp(-dt*2.2);q.vy-=1.2*dt;}
  const live=q.life>0,t=live?1-q.life/q.max:1;pos[i*3]=q.x||0;pos[i*3+1]=live?q.y:-9999;pos[i*3+2]=q.z||0;size[i]=live?q.s*(1+t*q.grow):0;al[i]=live?q.a*(1-t)*Math.min(1,t*6+.25):0;}
 g.attributes.position.needsUpdate=g.attributes.size.needsUpdate=g.attributes.alpha.needsUpdate=true;
 S.pts.material.uniforms.scale.value=W.renderer.domElement.height/(2*Math.tan(THREE.MathUtils.degToRad(W.camera.fov)/2));
 S.pts.material.uniforms.tint.value.copy(W.scene.fog?.color||new THREE.Color('#c9d2d6')).multiplyScalar(1.05);
 S.pts.visible=!!wet;
}

// --- Far scenery --------------------------------------------------------------------------
// Small instanced props (crowd, cones, crew, posts) are dropped beyond a distance that scales
// with their size; large scenery is never culled. Checked every 12 frames.
function gx55Cull(W){
 const eye=W.camera.position,s=new THREE.Sphere(),lvl=gx55Level(),k=[120,160,200][lvl];
 for(const o of W.world?.children||[]){
  if(!o.isInstancedMesh||!o.frustumCulled)continue;if(o.userData.gx55Size==null){if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();o.userData.gx55Size=o.geometry.boundingSphere.radius;o.userData.gx55Was=o.visible;}
  const size=o.userData.gx55Size;if(size>6)continue;if(!o.boundingSphere)o.computeBoundingSphere();s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);
  const far=s.distanceToPoint(eye)>Math.max(220,size*k);if(far&&o.visible){o.visible=false;o.userData.gx55Hidden=true;}else if(!far&&o.userData.gx55Hidden){o.visible=true;o.userData.gx55Hidden=false;}
 }
}

// --- Settings ----------------------------------------------------------------------------
const gx55Settings=dcSettingsFields;
dcSettingsFields=function(...args){return gx55Settings(...args)+`<div class="dc-field" style="margin-top:18px"><label class="dc-checkbox"><input type="checkbox" ${D.settings.gx55Post!==false?'checked':''} onchange="D.settings.gx55Post=this.checked;dcSave()">Cinematic lighting: glow, colour grading, soft shadows and heat haze</label><label class="dc-checkbox"><input type="checkbox" ${D.settings.gx55Blur!==false?'checked':''} onchange="D.settings.gx55Blur=this.checked;dcSave()">Motion blur at speed</label><p class="dc-muted">Balanced and High only. The 3D view drops its internal resolution briefly if a frame runs long, to stay smooth on Xbox.</p></div>`;};

const gx55Dispose=SC25World.prototype.dispose;
SC25World.prototype.dispose=function(){
 const P=this.gx55P;if(P){P.rt?.dispose();P.rt?.depthTexture?.dispose();P.ao?.dispose();for(const b of P.bloom)b.dispose();for(const m of Object.values(P.mats))m.dispose();P.quad.geometry.dispose();this.gx55P=null;}
 for(const o of [this.gx55Spray?.pts,this.gx55Marks?.mesh,this.gx55Line]){if(!o)continue;o.removeFromParent();o.geometry.dispose();o.material.alphaMap?.dispose();o.material.dispose();}
 this.gx55Spray=this.gx55Marks=this.gx55Line=null;this.gx55Asphalt?.dispose();this.gx55Asphalt=null;
 return gx55Dispose.call(this);
};
