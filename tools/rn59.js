// rn59: heavy rain. A dense downpour around the camera (animated on the GPU, one draw call),
// refracting beads, running streaks and a water film on the windscreen (cockpit) or lens
// (bonnet, chase) that the wiper clears, mist that swallows distant cars, heavier spray, rain
// noise, ultra-low grip in heavy rain and aquaplaning in standing water.
// Built into index.html by tools/build_rn59.py. Hooks install on window load, so the order
// relative to gx55/ph47/au56 doesn't matter. Nothing here recompiles shaders mid-drive or
// allocates per frame: every buffer, target and material is made once and reused.
(function(){
const RN={I:0,mode:'',lastAngle:-1.53,lastAt:0,v1:null,v2:null,cc:null};
const RN_A=1024/576,RN_FW=64,RN_FH=36,RN_D=900,RN_TR=900;
function rnRain(L){return !L||L.weather==='Dry'?0:L.weather==='Extremely Wet'?1:.42;}
function rnLevel(){return typeof gx55Level==='function'?gx55Level():1;}
function rnPostOn(W){return typeof gx55PostWanted==='function'&&gx55PostWanted(W)&&!!W.gx55P;}

// --- Standing water --------------------------------------------------------------------
// The same field drives the dark puddles on the asphalt and the aquaplaning in the physics.
function rnPool(x,z){const f=Math.sin(x*.043+Math.sin(z*.031)*1.9)*Math.sin(z*.047+Math.sin(x*.029)*2.3),g=Math.sin(x*.13+z*.09)*.5+.5,t=Math.min(1,Math.max(0,(f*.8+g*.25-.63)/.25));return t*t*(3-2*t);}
const RN_POOL_GLSL='float rnPool(vec2 p){float f=sin(p.x*.043+sin(p.y*.031)*1.9)*sin(p.y*.047+sin(p.x*.029)*2.3);float g=sin(p.x*.13+p.y*.09)*.5+.5;return smoothstep(.63,.88,f*.8+g*.25);}';
const RN_HASH='float rnHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float rnNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(rnHash(i),rnHash(i+vec2(1,0)),f.x),mix(rnHash(i+vec2(0,1)),rnHash(i+vec2(1)),f.x),f.y);}';

// --- Downpour ----------------------------------------------------------------------------
// Streaks live in a box that follows the camera; the vertex shader wraps and stretches them by
// the speed of the rain relative to the car, so at 250 km/h it rushes at the screen.
function rnStreaks(W){
 if(W.rn59Streaks)return W.rn59Streaks;const T=THREE,N=15000,g=new T.InstancedBufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([0,-1,0,1,-1,0,0,1,0,1,1,0],3));g.setIndex([0,1,2,1,3,2]);
 const seed=new Float32Array(N*4);let s=7331;for(let i=0;i<N*4;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;seed[i]=s/4294967296;}
 g.setAttribute('aSeed',new T.InstancedBufferAttribute(seed,4));g.instanceCount=0;
 const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uCam:{value:new T.Vector3()},uCentre:{value:new T.Vector3()},uTime:{value:0},uBox:{value:new T.Vector3(46,30,46)},uFall:{value:new T.Vector3(-2.4,-15,1.1)},uRel:{value:new T.Vector3()},uPx:{value:.002},uNear:{value:1},uAlpha:{value:.3},uColor:{value:new T.Color()}},
  vertexShader:`attribute vec4 aSeed;uniform vec3 uCam;uniform vec3 uCentre;uniform float uTime;uniform vec3 uBox;uniform vec3 uFall;uniform vec3 uRel;uniform float uPx;uniform float uNear;uniform float uAlpha;varying float vA;varying vec2 vQ;
   void main(){float sp=.82+aSeed.w*.36;vec3 p=aSeed.xyz*uBox+uFall*sp*uTime;p=uCentre+mod(p-uCentre+uBox*.5,uBox)-uBox*.5;
    vec3 vel=uFall*sp-uRel;float len=clamp(length(vel)*.05,.35,2.8);vec3 dir=vel/max(length(vel),1e-3);
    vec3 head=(viewMatrix*vec4(p,1.0)).xyz,tail=(viewMatrix*vec4(p-dir*len,1.0)).xyz;vec3 a=mix(head,tail,position.x);float dist=-a.z;
    vec3 c=cross(tail-head,a);vec3 side=c*inversesqrt(max(dot(c,c),1e-12));a+=side*max(.004,dist*uPx)*position.y;
    vA=uAlpha*(.5+.5*aSeed.w)*smoothstep(uNear,uNear+1.4,dist)*(1.0-smoothstep(17.0,25.0,dist));vQ=position.xy;
    gl_Position=projectionMatrix*vec4(a,1.0);}`,
  fragmentShader:`uniform vec3 uColor;varying float vA;varying vec2 vQ;void main(){gl_FragColor=vec4(uColor,vA*(1.0-vQ.y*vQ.y)*(1.0-vQ.x*.55));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});
 const mesh=new T.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name='Heavy rain streaks';mesh.layers.set(2);W.camera.layers.enable(2);W.scene.add(mesh);
 return W.rn59Streaks={mesh,N};
}
function rnUpdateStreaks(W,L,I){
 const S=rnStreaks(W),u=S.mesh.material.uniforms,cam=W.camera,p=L.player,lvl=rnLevel();
 S.mesh.visible=I>0;if(!I)return;
 S.mesh.geometry.instanceCount=Math.round([5200,9000,15000][lvl]*(I>=1?1:.42));
 cam.getWorldPosition(u.uCam.value);cam.getWorldDirection(RN.v1);RN.v1.y=0;RN.v1.normalize();
 u.uCentre.value.copy(u.uCam.value).addScaledVector(RN.v1,13);
 u.uTime.value=(L.elapsed||0)%600;
 const v=p?.v||0,lat=p?.latV||0,yaw=p?.yaw||0;u.uRel.value.set(Math.sin(yaw)*v+Math.cos(yaw)*lat,0,Math.cos(yaw)*v-Math.sin(yaw)*lat);
 u.uFall.value.set(-2.4,I>=1?-16:-11,1.1);
 u.uPx.value=1.15*2*Math.tan(cam.fov*Math.PI/360)/Math.max(200,W.renderer.domElement.height);
 u.uNear.value=sc25Camera==='onboard'?1.5:.5;u.uAlpha.value=I>=1?.36:.22;
 const f=W.scene.fog?.color;if(f)u.uColor.value.copy(f).multiplyScalar(1.3).addScalar(.03);
}

// --- Water on the glass ------------------------------------------------------------------
// A drop simulation in glass (or lens) UV space: beads land, merge, and once they are heavy
// enough run down under gravity or up and outward in the airflow, leaving wet trails. A water
// film builds up between wiper strokes and fills with fine beads. Everything is drawn into a
// 1024x576 map: RG = refraction offset, B = bead thickness, A = film.
function rnSim(){
 if(RN.sim)return RN.sim;const F=RN_FW*RN_FH;
 return RN.sim={x:new Float32Array(RN_D),y:new Float32Array(RN_D),r:new Float32Array(RN_D),vx:new Float32Array(RN_D),vy:new Float32Array(RN_D),ax:new Float32Array(RN_D),ay:new Float32Array(RN_D),on:new Uint8Array(RN_D),mv:new Uint8Array(RN_D),n:0,acc:0,
  t:new Float32Array(RN_TR*5),tl:new Float32Array(RN_TR),tm:new Float32Array(RN_TR),tn:0,film:new Float32Array(F),filmB:new Uint8Array(F),polar:new Float32Array(F),rad:new Float32Array(F),
  head:new Int16Array(64*36),next:new Int16Array(RN_D),seed:918273645,mode:'',polarKey:null};
}
function rnRnd(S){let x=S.seed;x^=x<<13;x^=x>>>17;x^=x<<5;S.seed=x>>>0;return S.seed/4294967296;}
function rnReset(S){S.on.fill(0);S.tl.fill(0);S.film.fill(0);S.acc=0;}
const RN_MODES={
 glass:{spawn:240,rMin:.0015,rRange:.0044,slide:.0058,air:1,film:1.55,radial:0},
 bonnet:{spawn:210,rMin:.0019,rRange:.0056,slide:.0068,air:.8,film:1.25,radial:0},
 lens:{spawn:34,rMin:.0022,rRange:.0065,slide:.009,air:0,film:0,radial:1}
};
// Wiper sweep table: blade angle and distance from the pivot for every film cell.
function rnPolarGlass(W,S){
 const pl=W.sc30RainPlane,mount=W.sc30Wiper?.parent,g=pl?.geometry,pos=g?.attributes.position;if(!mount||!pos||pos.count<41*21)return false;
 if(S.polarKey===g)return true;S.polarKey=g;
 W.dc36ScreenRoot?.updateMatrixWorld(true);const T=THREE,m=new T.Matrix4().copy(mount.matrixWorld).invert().multiply(pl.matrixWorld),v=new T.Vector3(),gp=new Float32Array(41*21),gr=new Float32Array(41*21);
 for(let k=0;k<41*21;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);gp[k]=Math.atan2(-v.x,v.y);gr[k]=Math.hypot(v.x,v.y);}
 for(let cy=0;cy<RN_FH;cy++)for(let cx=0;cx<RN_FW;cx++){const U=(cx+.5)/RN_FW,V=(cy+.5)/RN_FH,gi=(1-U)*40,gj=V*20,i0=Math.min(39,gi|0),j0=Math.min(19,gj|0),fi=gi-i0,fj=gj-j0,a=j0*41+i0,b=a+1,c=a+41,d=a+42,k=cy*RN_FW+cx;
  S.polar[k]=(gp[a]*(1-fi)+gp[b]*fi)*(1-fj)+(gp[c]*(1-fi)+gp[d]*fi)*fj;S.rad[k]=(gr[a]*(1-fi)+gr[b]*fi)*(1-fj)+(gr[c]*(1-fi)+gr[d]*fi)*fj;}
 return true;
}
function rnPolarBonnet(S){
 if(S.polarKey==='bonnet')return;S.polarKey='bonnet';
 for(let cy=0;cy<RN_FH;cy++)for(let cx=0;cx<RN_FW;cx++){const x=(cx+.5)/RN_FW-.5,y=(cy+.5)/RN_FH/RN_A+.2,k=cy*RN_FW+cx;S.polar[k]=Math.atan2(-x,y)*.82-.18;S.rad[k]=Math.hypot(x,y)*.6;}
}
function rnCell(S,U,V){const cx=Math.min(RN_FW-1,Math.max(0,U*RN_FW|0)),cy=Math.min(RN_FH-1,Math.max(0,V*RN_FH|0));return cy*RN_FW+cx;}
function rnTrail(S,x0,y0,x1,y1,r,life){const i=S.tn;S.tn=(S.tn+1)%RN_TR;S.t[i*5]=x0;S.t[i*5+1]=y0;S.t[i*5+2]=x1;S.t[i*5+3]=y1;S.t[i*5+4]=r;S.tl[i]=S.tm[i]=life;}
function rnStep(S,P,I,dt,speed,wipe,lo,hi){
 // New beads, faster at speed as the car drives into the rain.
 S.acc+=P.spawn*I*(1+speed/28)*dt;
 while(S.acc>=1){S.acc-=1;const i=S.n;S.n=(S.n+1)%RN_D;S.on[i]=1;S.mv[i]=2;S.x[i]=S.ax[i]=rnRnd(S);S.y[i]=S.ay[i]=rnRnd(S);const q=rnRnd(S);S.r[i]=P.rMin+P.rRange*q*q*q;S.vx[i]=S.vy[i]=0;}
 // Grid for merging.
 S.head.fill(-1);
 for(let i=0;i<RN_D;i++){if(!S.on[i])continue;const c=Math.min(35,Math.max(0,S.y[i]*36|0))*64+Math.min(63,Math.max(0,S.x[i]*64|0));S.next[i]=S.head[c];S.head[c]=i;}
 const up=P.air*(speed/45)*(speed/45),net=up-.55;
 for(let i=0;i<RN_D;i++){
  if(!S.on[i])continue;let x=S.x[i],y=S.y[i],r=S.r[i];
  if(wipe){const k=rnCell(S,x,y),a=S.polar[k],d=S.rad[k];if(d>.3&&d<.93&&a>=lo&&a<=hi){S.on[i]=0;continue;}}
  // Merge with neighbours when freshly landed or running.
  if(S.mv[i]){const cx=x*64|0,cy=y*36|0;for(let gy=Math.max(0,cy-1);gy<=Math.min(35,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(63,cx+1);gx++)for(let j=S.head[gy*64+gx];j>=0;j=S.next[j]){if(j===i||!S.on[j])continue;const dx=S.x[j]-x,dy=(S.y[j]-y)/RN_A,rr=r+S.r[j];if(dx*dx+dy*dy<rr*rr*.7){r=Math.min(.03,Math.sqrt(r*r+S.r[j]*S.r[j]));S.on[j]=0;}}
   if(S.mv[i]===2)S.mv[i]=0;}
  let vx=S.vx[i],vy=S.vy[i];
  if(P.radial){const ox=x-.5,oy=(y-.5)/RN_A,l=Math.hypot(ox,oy)||1,push=speed>10?(speed-10)*.010*(r/P.slide):0;vx=ox/l*push;vy=oy/l*push-(r>P.slide?.05:0);}
  else{const drive=Math.abs(net)*r/P.slide;
   if(drive>.42){const target=Math.sign(net)*Math.min(1.1,(drive-.42)*.9+.06);vy+=(target-vy)*Math.min(1,dt*6);vx+=((x-.5)*up*.35+(rnRnd(S)-.5)*.7)*dt;vx*=Math.exp(-dt*2);}
   else{vx=0;vy=0;}}
  const moving=Math.abs(vx)+Math.abs(vy)>.004;
  if(moving){x+=vx*dt;y+=vy*RN_A*dt;r*=Math.exp(-dt*.16);S.mv[i]=1;
   const dx=x-S.ax[i],dy=(y-S.ay[i])/RN_A;if(dx*dx+dy*dy>r*r*1.6){rnTrail(S,S.ax[i],S.ay[i],x,y,r*.42,1.1+rnRnd(S)*1.6);S.ax[i]=x;S.ay[i]=y;}
   if(r<P.rMin*.7){S.mv[i]=0;vx=vy=0;}}
  else{S.ax[i]=x;S.ay[i]=y;if(S.mv[i]===1)S.mv[i]=0;}
  if(x<-.02||x>1.02||y<-.02||y>1.02){S.on[i]=0;continue;}
  S.x[i]=x;S.y[i]=y;S.r[i]=r;S.vx[i]=vx;S.vy[i]=vy;
 }
 for(let i=0;i<RN_TR;i++){if(S.tl[i]<=0)continue;S.tl[i]-=dt;if(wipe){const k=rnCell(S,S.t[i*5+2],S.t[i*5+3]),a=S.polar[k],d=S.rad[k];if(d>.3&&d<.93&&a>=lo&&a<=hi)S.tl[i]=0;}}
 // Film: builds toward fully wet; the blade leaves a thin smear behind it.
 const rate=P.film*I*(1+speed/90)*dt;
 for(let k=0;k<RN_FW*RN_FH;k++){let f=S.film[k]+(1-S.film[k])*Math.min(1,rate);if(wipe){const a=S.polar[k],d=S.rad[k];if(d>.3&&d<.93&&a>=lo&&a<=hi)f=Math.min(f,.035);}S.film[k]=f;S.filmB[k]=f*255|0;}
}

function rnWater(W){
 if(RN.water)return RN.water;const T=THREE,G=new T.WebGLRenderTarget(1024,576,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
 const filmTex=new T.DataTexture(rnSim().filmB,RN_FW,RN_FH,T.RedFormat,T.UnsignedByteType);filmTex.minFilter=filmTex.magFilter=T.LinearFilter;filmTex.needsUpdate=true;
 const quadGeo=new T.PlaneGeometry(2,2),cam=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const film=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tFilm:{value:filmTex},uFlow:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D tFilm;uniform float uFlow;${RN_HASH}
   void main(){float f=texture2D(tFilm,vUv).r;vec2 off=vec2(0.0);float th=0.0;
    vec2 q=vUv*vec2(46.0,14.0)+vec2(0.0,uFlow);float n0=rnNoise(q),n1=rnNoise(q+vec2(.4,0.0)),n2=rnNoise(q+vec2(0.0,.4));off+=vec2(n1-n0,n2-n0)*.012*f;
    for(int k=0;k<2;k++){vec2 sc=k==0?vec2(150.0,84.375):vec2(270.0,151.875);vec2 c=vUv*sc;vec2 ci=floor(c)+float(k)*41.0;vec2 cf=fract(c)-.5;float h=rnHash(ci);
     if(h<f*1.15-.05){vec2 o=(vec2(rnHash(ci+3.7),rnHash(ci+9.1))-.5)*.44;float rad=.15+.26*rnHash(ci+5.3);vec2 e=(cf-o)/rad;float r2=dot(e,e);if(r2<1.0){off+=-e*rad*2.6/sc;th+=sqrt(1.0-r2)*.75;}}}
    gl_FragColor=vec4(off,th,f);}`});
 const filmQuad=new T.Mesh(quadGeo,film);filmQuad.frustumCulled=false;const filmScene=new T.Scene();filmScene.add(filmQuad);
 const N=RN_D+RN_TR,g=new T.InstancedBufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));g.setIndex([0,1,2,1,3,2]);
 const aSeg=new T.InstancedBufferAttribute(new Float32Array(N*4),4).setUsage(T.DynamicDrawUsage),aRad=new T.InstancedBufferAttribute(new Float32Array(N*2),2).setUsage(T.DynamicDrawUsage);g.setAttribute('aSeg',aSeg);g.setAttribute('aRad',aRad);g.instanceCount=0;
 const drops=new T.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneFactor,blendSrcAlpha:T.OneFactor,blendDstAlpha:T.OneFactor,uniforms:{uA:{value:RN_A}},
  vertexShader:`attribute vec4 aSeg;attribute vec2 aRad;uniform float uA;varying vec2 vP;varying vec2 vP0;varying vec2 vP1;varying float vR;varying float vS;
   void main(){vec2 p0=vec2(aSeg.x,aSeg.y/uA),p1=vec2(aSeg.z,aSeg.w/uA);vec2 mn=min(p0,p1)-aRad.x,mx=max(p0,p1)+aRad.x;vec2 iso=mix(mn,mx,position.xy*.5+.5);
    vP=iso;vP0=p0;vP1=p1;vR=aRad.x;vS=aRad.y;gl_Position=vec4(vec2(iso.x,iso.y*uA)*2.0-1.0,0.0,1.0);}`,
  fragmentShader:`uniform float uA;varying vec2 vP;varying vec2 vP0;varying vec2 vP1;varying float vR;varying float vS;
   void main(){vec2 d=vP1-vP0;float t=clamp(dot(vP-vP0,d)/max(dot(d,d),1e-10),0.0,1.0);vec2 e=(vP-(vP0+d*t))/vR;float r2=dot(e,e);if(r2>1.0)discard;
    float h=sqrt(1.0-r2);vec2 off=-e*vR*2.6*vS*(.35+.65*h);off.y*=uA;gl_FragColor=vec4(off,h*vS,0.0);}`});
 const dropMesh=new T.Mesh(g,drops);dropMesh.frustumCulled=false;const dropScene=new T.Scene();dropScene.add(dropMesh);
 // Performance quality has no post pass: the windscreen shows the water as a milky layer.
 const fallback=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{tG:{value:G.texture},uFog:{value:new T.Color()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D tG;uniform vec3 uFog;void main(){vec4 g=texture2D(tG,vUv);float th=clamp(g.z,0.0,1.0);float a=clamp(g.w*.94+th*.35,0.0,.97);gl_FragColor=vec4(uFog*(1.05+th*.25)-th*.04,a);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`});
 return RN.water={G,filmTex,filmScene,film,dropMesh,dropScene,aSeg,aRad,cam,quadGeo,fallback};
}
function rnDrawWater(W,S){
 const R=rnWater(W),r=W.renderer,sg=R.aSeg.array,sr=R.aRad.array;let k=0;
 for(let i=0;i<RN_D;i++){if(!S.on[i])continue;const x=S.x[i],y=S.y[i],rr=S.r[i],m=S.mv[i]===1;
  sg[k*4]=x;sg[k*4+1]=y;sg[k*4+2]=m?x-S.vx[i]*.03:x;sg[k*4+3]=m?y-S.vy[i]*RN_A*.03:y-rr*RN_A*.35;sr[k*2]=rr;sr[k*2+1]=1;k++;}
 for(let i=0;i<RN_TR;i++){const l=S.tl[i];if(l<=0)continue;const f=l/S.tm[i];sg[k*4]=S.t[i*5];sg[k*4+1]=S.t[i*5+1];sg[k*4+2]=S.t[i*5+2];sg[k*4+3]=S.t[i*5+3];sr[k*2]=S.t[i*5+4]*(.55+.45*f);sr[k*2+1]=.55*f;k++;}
 R.dropMesh.geometry.instanceCount=k;R.aSeg.needsUpdate=R.aRad.needsUpdate=true;R.filmTex.needsUpdate=true;R.film.uniforms.uFlow.value=(performance.now()/1000*.035)%100;
 const prev=r.getRenderTarget(),auto=r.autoClear;r.getClearColor(RN.cc);const ca=r.getClearAlpha();
 try{r.autoClear=false;r.setRenderTarget(R.G);r.setClearColor(0x000000,0);r.clear(true,false,false);r.render(R.filmScene,R.cam);if(k)r.render(R.dropScene,R.cam);}
 finally{r.setRenderTarget(prev);r.autoClear=auto;r.setClearColor(RN.cc,ca);}
}

// Per frame, before the main view is drawn.
function rnFrame(W,L){
 const I=rnRain(L);RN.I=I;if(!I){if(W.rn59Streaks)W.rn59Streaks.mesh.visible=false;return;}
 RN.v1||=new THREE.Vector3();RN.v2||=new THREE.Vector3();RN.cc||=new THREE.Color();
 const now=performance.now(),dt=L.paused||(typeof dcSimBusy!=='undefined'&&dcSimBusy)?0:Math.min(.05,Math.max(0,(now-(RN.lastAt||now))/1000));RN.lastAt=now;
 rnUpdateStreaks(W,L,I);
 if(W.scene.fog&&I>=1)W.scene.fog.density=Math.max(W.scene.fog.density,.0046);
 if(W.rn59Pools)W.rn59Pools.value=I>=1?1:.45;
 const p=L.player,glass=sc25Camera==='onboard'&&!!W.dc36ScreenRoot?.visible&&!!W.sc30RainPlane,mode=glass?'glass':sc25Camera==='bonnet'?'bonnet':'lens',S=rnSim(),P=RN_MODES[mode];
 if(S.mode!==mode){S.mode=mode;S.polarKey=null;rnReset(S);}
 let wipe=false,lo=0,hi=0;const rate=L.wipers===2?5.8:L.wipers===1?2.5:0;
 if(mode==='glass'&&rnPolarGlass(W,S)){const a=W.sc30Wiper.rotation.z;if(rate){wipe=true;lo=Math.min(a,RN.lastAngle)-.03;hi=Math.max(a,RN.lastAngle)+.03;}RN.lastAngle=a;}
 else if(mode==='bonnet'){rnPolarBonnet(S);const a=rate?Math.sin(L.elapsed*rate)*1.03-.18:-1.53;if(rate){wipe=true;lo=Math.min(a,RN.lastAngle)-.03;hi=Math.max(a,RN.lastAngle)+.03;}RN.lastAngle=a;}
 // Water beads only on the windscreen in the cockpit view; bonnet and chase cams keep a clear lens.
 if(glass){if(dt>0)rnStep(S,P,I,dt,Math.abs(p?.v||0),wipe,lo,hi);rnDrawWater(W,S);}
 RN.mode=mode;
 const pl=W.sc30RainPlane;
 if(pl){if(rnPostOn(W)||!glass)pl.visible=false;else{const R=rnWater(W);if(pl.material!==R.fallback){pl.userData.rn59Old=pl.material;pl.material=R.fallback;}R.fallback.uniforms.uFog.value.copy(W.scene.fog?.color||RN.cc);pl.visible=true;}}
}

// --- Post: refraction, blur, mist ---------------------------------------------------------
function rnPostKit(W,P){
 const T=THREE,r=W.renderer;let K=RN.post;
 if(!K){
  const quad=new T.Mesh(new T.PlaneGeometry(2,2));quad.frustumCulled=false;const scene=new T.Scene();scene.add(quad);
  const vq='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const down=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tSrc:{value:null},texel:{value:new T.Vector2()}},vertexShader:vq,
   fragmentShader:'varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 texel;vec3 s(vec2 o){vec3 c=texture2D(tSrc,vUv+o*texel).rgb;return (dot(c,vec3(1.0))<1e4&&min(c.r,min(c.g,c.b))>=0.0)?min(c,vec3(40.0)):vec3(0.0);}void main(){gl_FragColor=vec4((s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1)))*.25,1.0);}'});
  const copy=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tG:{value:null}},vertexShader:vq,fragmentShader:'varying vec2 vUv;uniform sampler2D tG;void main(){gl_FragColor=texture2D(tG,vUv);}'});
  const glassMat=new T.ShaderMaterial({depthTest:false,depthWrite:false,side:T.DoubleSide,uniforms:{tG:{value:null},tDepth:{value:null},uRes:{value:new T.Vector2()},uNear:{value:.05},uFar:{value:2000}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`varying vec2 vUv;uniform sampler2D tG;uniform sampler2D tDepth;uniform vec2 uRes;uniform float uNear;uniform float uFar;
    float lin(float d){return uNear*uFar/(uFar-d*(uFar-uNear));}
    void main(){float sd=texture2D(tDepth,gl_FragCoord.xy/uRes).x;if(lin(sd)<lin(gl_FragCoord.z)-.12)discard;
     vec4 g=texture2D(tG,vUv);vec2 dx=dFdx(vUv),dy=dFdy(vUv);float det=dx.x*dy.y-dy.x*dx.y;
     vec2 pix=abs(det)>1e-14?vec2(dy.y*g.x-dy.x*g.y,dx.x*g.y-dx.y*g.x)/det:vec2(0.0);pix=clamp(pix,vec2(-60.0),vec2(60.0));
     gl_FragColor=vec4(pix/uRes,g.z,g.w);}`});
  const glass=new T.Mesh(new T.BufferGeometry(),glassMat);glass.frustumCulled=false;glass.matrixAutoUpdate=false;glass.matrixWorldAutoUpdate=false;const glassScene=new T.Scene();glassScene.matrixWorldAutoUpdate=false;glassScene.add(glass);
  K=RN.post={quad,scene,down,copy,glass,glassMat,glassScene,cam:new T.OrthographicCamera(-1,1,1,-1,0,1),w:0,h:0,t:[]};
  // Compile the post materials now rather than on the first wet frame.
  try{const warm=new T.Scene();for(const m of [down,copy,glassMat]){const q=new T.Mesh(quad.geometry,m);q.frustumCulled=false;warm.add(q);}r.compile(warm,W.camera);}catch(e){}
 }
 if(K.w!==P.w||K.h!==P.h){for(const t of K.t)t.dispose();const mk=(w,h)=>new T.WebGLRenderTarget(Math.max(4,w),Math.max(4,h),{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
  K.s=mk(P.w>>1,P.h>>1);K.a=mk(P.w>>2,P.h>>2);K.b=mk(P.w>>3,P.h>>3);K.c=mk(P.w>>4,P.h>>4);K.t=[K.s,K.a,K.b,K.c];K.w=P.w;K.h=P.h;}
 return K;
}
function rnPost(W,L,P){
 const r=W.renderer,K=rnPostKit(W,P),R=RN.water,prev=r.getRenderTarget(),auto=r.autoClear;r.getClearColor(RN.cc);const ca=r.getClearAlpha();
 try{
  r.autoClear=false;
  const pass=(src,w,h,dst)=>{K.quad.material=K.down;K.down.uniforms.tSrc.value=src;K.down.uniforms.texel.value.set(1/w,1/h);r.setRenderTarget(dst);r.render(K.scene,K.cam);};
  pass(P.rt.texture,P.w,P.h,K.a);pass(K.a.texture,K.a.width,K.a.height,K.b);pass(K.b.texture,K.b.width,K.b.height,K.c);
  r.setRenderTarget(K.s);r.setClearColor(0x000000,0);r.clear(true,false,false);
  if(RN.mode==='glass'&&R&&W.sc30RainPlane){const pl=W.sc30RainPlane,u=K.glassMat.uniforms;pl.updateWorldMatrix(true,false);K.glass.geometry=pl.geometry;K.glass.matrixWorld.copy(pl.matrixWorld);
   u.tG.value=R.G.texture;u.tDepth.value=P.rt.depthTexture;u.uRes.value.set(K.s.width,K.s.height);u.uNear.value=W.camera.near;u.uFar.value=W.camera.far;r.render(K.glassScene,W.camera);}
 }finally{r.setRenderTarget(prev);r.autoClear=auto;r.setClearColor(RN.cc,ca);}
 const u=P.mats.composite.uniforms,I=RN.I;
 u.rnOn.value=1;u.tWater.value=K.s.texture;u.tBlurA.value=K.a.texture;u.tBlurB.value=K.c.texture;u.rnTexB.value.set(1/K.c.width,1/K.c.height);
 u.rnMist.value=I>=1?.62:.3;u.rnMistK.value=I>=1?.014:.006;u.rnFog.value.copy(W.scene.fog?.color||RN.cc);
}
function rnPatchComposite(m){
 if(!m||m.uniforms.rnOn)return;const T=THREE;
 Object.assign(m.uniforms,{tWater:{value:null},tBlurA:{value:null},tBlurB:{value:null},rnTexB:{value:new T.Vector2()},rnOn:{value:0},rnMist:{value:0},rnMistK:{value:.01},rnFog:{value:new T.Color()}});
 let f=m.fragmentShader;
 f=f.replace('varying vec2 vUv;','varying vec2 vUv;uniform sampler2D tWater;uniform sampler2D tBlurA;uniform sampler2D tBlurB;uniform vec2 rnTexB;uniform float rnOn;uniform float rnMist;uniform float rnMistK;uniform vec3 rnFog;');
 f=f.replace('vec4 base=texture2D(tScene,uv);','vec4 rnW=rnOn>0.5?texture2D(tWater,vUv):vec4(0.0);uv+=rnW.xy;vec4 base=texture2D(tScene,uv);');
 f=f.replace('col+=texture2D(tBloom,vUv).rgb*bloom;',`if(rnOn>0.5){
   vec3 bA=texture2D(tBlurA,uv).rgb;
   vec3 bB=(texture2D(tBlurB,uv+rnTexB*vec2(.7,.4)).rgb+texture2D(tBlurB,uv-rnTexB*vec2(.7,.4)).rgb+texture2D(tBlurB,uv+rnTexB*vec2(-.4,.7)).rgb+texture2D(tBlurB,uv-rnTexB*vec2(-.4,.7)).rgb)*.25;
   // Mist: the downpour scatters light, so distant cars and scenery lose detail and contrast.
   float mist=sky?rnMist*.85:rnMist*(1.0-exp(-max(dist-3.0,0.0)*rnMistK));
   col=mix(col,mix(bA,rnFog,.5),mist);
   // Water on the glass: a sheet blurs and goes milky; beads refract with dark rims and a glint.
   float f=clamp(rnW.w,0.0,1.0),th=clamp(rnW.z,0.0,1.5);
   vec3 soft=mix(bA,bB,smoothstep(.2,.85,f));
   col=mix(col,soft,clamp(smoothstep(.0,.8,f)+th*.25,0.0,1.0));
   float lum=dot(soft,vec3(.2126,.7152,.0722));
   col=mix(col,vec3(lum)*.85+rnFog*.4,f*f*.62);
   float rim=smoothstep(.0,.22,th)*(1.0-smoothstep(.3,.75,th));
   vec2 dir=rnW.xy/max(length(rnW.xy),1e-6);
   col*=1.0-rim*.32;col+=rnFog*pow(max(0.0,dot(dir,vec2(.45,-.89))),10.0)*rim*.3;
  }
  col+=texture2D(tBloom,vUv).rgb*bloom;`);
 if(!f.includes('rnW.w')){console.warn('rn59: composite patch did not apply');return;}
 m.fragmentShader=f;m.needsUpdate=true;
}

// --- Sound ----------------------------------------------------------------------------------
// Rain roar and the patter on the roof, louder from the cockpit.
function rnSound(){
 const a=typeof dcAudio!=='undefined'?dcAudio:null;if(!a?.ctx||!a.noise?.buffer)return null;if(RN.snd)return RN.snd;
 const c=a.ctx,src=c.createBufferSource(),lp=c.createBiquadFilter(),bp=c.createBiquadFilter(),g1=c.createGain(),g2=c.createGain();
 src.buffer=a.noise.buffer;src.loop=true;lp.type='lowpass';lp.frequency.value=700;bp.type='bandpass';bp.frequency.value=3400;bp.Q.value=.6;g1.gain.value=0;g2.gain.value=0;
 src.connect(lp);lp.connect(g1);src.connect(bp);bp.connect(g2);g1.connect(c.destination);g2.connect(c.destination);src.start();
 return RN.snd={g1,g2,c};
}
function rnSoundUpdate(){
 const L=live;if(!L?.player)return;const I=rnRain(L),s=I||RN.snd?rnSound():null;if(!s)return;
 const vol=L.paused||(typeof dcSimBusy!=='undefined'&&dcSimBusy)?0:(D.settings.volume||0),inside=sc25Camera==='onboard',t=s.c.currentTime;
 s.g1.gain.setTargetAtTime(vol*I*(inside?.05:.035),t,.2);s.g2.gain.setTargetAtTime(vol*I*(inside?.045:.03),t,.2);
}

// --- Install ----------------------------------------------------------------------------------
function rnInstall(){
 if(RN.installed)return;RN.installed=true;
 // Main view: update rain and draw the glass water first.
 const main=rf41MainDraw;
 rf41MainDraw=function(W,L){try{if(L?.player)rnFrame(W,L);}catch(e){console.warn('rn59 rain frame',e);RN.I=0;}return main(W,L);};
 // Composite: blur and screen-space water, then gx55's composite with the rain block on.
 if(typeof gx55Materials==='function'){const gm=gx55Materials;gx55Materials=function(){const M=gm();try{rnPatchComposite(M.composite);}catch(e){console.warn('rn59 composite',e);}return M;};}
 if(typeof gx55Composite==='function'){const gc=gx55Composite;gx55Composite=function(W,L,P){const u=P?.mats?.composite?.uniforms;if(u?.rnOn){u.rnOn.value=0;if(RN.I>0&&L?.player){try{rnPost(W,L,P);}catch(e){console.warn('rn59 post',e);u.rnOn.value=0;}}}return gc(W,L,P);};}
 // Legacy canvas beads are replaced by the drop simulation.
 if(typeof dc36Windshield==='function'){const ws=dc36Windshield;dc36Windshield=function(W,L,dt){if(rnRain(L)){W.dc36RainAt=L.elapsed;W.dc36RainWeather=L.weather;}return ws(W,L,dt);};}
 // Standing water on the asphalt.
 if(typeof gx55RoadEdit==='function'){const re=gx55RoadEdit;gx55RoadEdit=function(W){const edit=re(W);return sh=>{edit(sh);sh.uniforms.rn59Pools=W.rn59Pools||(W.rn59Pools={value:0});
  const from='float cavity=1.0-ag.a;';if(sh.fragmentShader.includes(from))sh.fragmentShader='uniform float rn59Pools;\n'+RN_POOL_GLSL+'\n'+sh.fragmentShader.replace(from,'dip=max(dip,rnPool(wp)*rn59Pools);'+from);};};}
 // Heavier spray off every car in heavy rain.
 try{if(typeof gx55Spray==='function'){let src=String(gx55Spray);const swaps=[['rate=Math.min(90,x.v*x.v*.035*wet)','rate=Math.min(90+150*wet*wet,x.v*x.v*(.035+.045*wet*wet)*wet)'],['q.a=.16+wet*.12','q.a=.16+wet*.17'],['q.grow=1.6+x.v*.06','q.grow=1.6+x.v*(.06+.035*wet)']];
  if(swaps.every(([a])=>src.includes(a))){for(const [a,b] of swaps)src=src.replace(a,b);gx55Spray=(0,eval)('('+src+')');}}
  if(typeof gx55SprayPool==='function'){const src=String(gx55SprayPool);if(src.includes('N=[300,500,800][gx55Level()]'))gx55SprayPool=(0,eval)('('+src.replace('N=[300,500,800][gx55Level()]','N=[600,1000,1600][gx55Level()]')+')');}}catch(e){console.warn('rn59 spray',e);}
 // Grip: heavy rain is ultra slippery on every tyre.
 if(typeof dcTyreGrip==='function'){const tg=dcTyreGrip;dcTyreGrip=function(x){const g=tg(x);return live&&live.weather==='Extremely Wet'?g*(x.tyre==='Wet'?.66:.58):g;};}
 // Aquaplaning: each wheel that hits standing water at speed loses most of its grip.
 if(typeof gr27Surface==='function'){const gs=gr27Surface;gr27Surface=function(W,x,z,y,pit,terrain){RN.wx=x;RN.wz=z;return gs.call(this,W,x,z,y,pit,terrain);};}
 if(typeof ph47WheelSurface==='function'){const wsf=ph47WheelSurface;ph47WheelSurface=function(W,L,x,lane,ground,pit){const s=wsf(W,L,x,lane,ground,pit),I=rnRain(L);if(!I||pit||!s||s.kind==='grass'||ground?.route==='pit')return s;
  const depth=rnPool(RN.wx||0,RN.wz||0)*(I>=1?1:.45);if(depth<.02)return s;const v=Math.abs(x.v||0),onset=x.tyre==='Wet'?17:11,aq=Math.min(1,Math.max(0,(v-onset)/19))*depth;
  s.mu*=1-.88*aq;s.drag=(s.drag||0)+depth*.03;s.aqua=aq;if(x===L.player)RN.aqua=Math.max(RN.aqua||0,aq);return s;};}
 if(typeof dcUpdateSound==='function'){const us=dcUpdateSound;dcUpdateSound=function(){const r=us.call(this);try{rnSoundUpdate();}catch(e){}return r;};}
 window.RN59=RN;
}
if(document.readyState==='complete')rnInstall();else window.addEventListener('load',rnInstall);
})();
