/* tw67: track evolution and tyres.
   Track: every car lays rubber in the lanes it actually drives (a 0.5 m grid across the track at
   every centreline sample). The rubbered line grips better, rubber shed by wearing tyres collects
   off line as marbles, and a track left damp by an earlier wet session dries first where the cars
   run. The rubber level carries through the weekend (D.weekend.tw67) and the asphalt shows it.
   Tyres: each corner has its own temperature and wear. Temperature rises with load, sliding and
   speed and falls with airflow, so tyres are cold out of the garage, after a stop and behind the
   safety car. Grip is lower out of the working window (cold or overheated) and falls as a tyre
   wears, gently and then over a cliff. Softs warm faster and grip more but wear quicker; hards
   wear slowly and need more heat. Player and AI cars share the model (ai62 cars per wheel, the
   path-model cars through dcTyreGrip). x.rdWear and x.tyreTemp stay the averages, so strategy,
   pit calls and the HUD keep working. Built into index.html by tools/build_tw67.py. */
(function(){
const B=30,BW=.5,HALF=B*BW/2,P0=70,MK=260,CAP=160,KH=3.9,BASE=.00065;
const COMP={
 Soft:{lo:82,hi:104,heat:1.08,wear:1,deg:.045,cliff:70,cliffK:.15,cold:.13},
 Hard:{lo:87,hi:113,heat:.92,wear:.57,deg:.025,cliff:80,cliffK:.12,cold:.15},
 Wet:{lo:45,hi:78,heat:1,wear:.5,deg:.03,cliff:76,cliffK:.12,cold:.09}};
const TW={on:()=>!D?.settings?.tw67Off};
const clampN=(v,a,b)=>v<a?a:v>b?b:v;
const comp=x=>COMP[x.tyre]||COMP.Soft;

// --- Session track state -------------------------------------------------------------------
function twAir(L){const w=D?.weekend,day=Math.min(2,[0,1,1,2][w?.phase??3]??2);return +(w?.forecast?.[day]?.temp??22);}
function twTrackTemp(L){const air=twAir(L);return L.weather==='Dry'?air+10:air+1;}
function twInit(L,W){
 const N=W.N,w=D?.weekend,st=w&&w.tw67&&w.tw67.event===w.event?w.tw67:null,phase=L.stage==='test'?1:(w?.phase??3);
 const floor=[.12,.3,.36,.48][phase]??.4,R=clampN(Math.max(st?.r??0,floor),0,.96),wet=L.weather!=='Dry';
 const T=L.tw67={N,rub:new Float32Array(N*B),pass:new Uint16Array(N*B),rmax:new Float32Array(N),M:(st?.m||0)*.35,t:0,
  D0:!wet&&st?.wet?(st.wet==='Extremely Wet'?.95:.78):0,wet,amb:twTrackTemp(L),R,laps:0,save:0,radio:{}};
 T.cw=new Float32Array(N);T.k=new Float32Array(N);for(let i=0;i<N;i++){const a=W.samples[(i+8)%N].v,c=W.samples[(i-8+N)%N].v,t=Math.acos(clampN(a.x*c.x+a.y*c.y+a.z*c.z,-1,1));T.cw[i]=clampN(t/.28,.12,1);T.k[i]=t/Math.max(1,a.distanceTo?W.samples[(i+8)%N].p.distanceTo(W.samples[(i-8+N)%N].p):16);}
 // Seed the bins around the ideal line from the weekend's rubber level.
 const line=W.racingLine||[];
 for(let i=0;i<N;i++){const l=line[i]||0;let m=0;for(let b=0;b<B;b++){const lane=-HALF+(b+.5)*BW,d=Math.min(Math.abs(lane-l-.81),Math.abs(lane-l+.81)),g=Math.exp(-d*d/(2*1.15*1.15)),r=R*g;T.rub[i*B+b]=r;if(r>m)m=r;}T.rmax[i]=m;}
 return T;
}
function twBin(lane){return clampN(Math.floor((lane+HALF)/BW),0,B-1);}
function twRub(T,i,b){return T.rub[i*B+b];}
// Marbles gather off line where cars corner hard; straights stay fairly clean.
function twMarb(T,i,b){const m=T.rmax[i];if(T.M<.01||m<.08)return 0;const off=clampN(1-T.rub[i*B+b]/m*2.4,0,1);return T.M*off*clampN(m*3,0,1)*T.cw[i];}
function twDamp(T,i,b){return T.D0?clampN(T.D0-T.t/1300-T.pass[i*B+b]*.02,0,1):0;}
// Grip multiplier for a contact patch at (sample, lane) on the racing surface.
function twTrackMu(L,x,i,lane,kerb){
 const T=L.tw67;if(!T)return 1;i=((i|0)%T.N+T.N)%T.N;const b=twBin(lane),r=kerb?0:twRub(T,i,b);let f;
 if(T.wet)f=1-.07*r;
 else{f=(.985+.028*r)*(1-.14*(kerb?0:twMarb(T,i,b)));const d=twDamp(T,i,b);if(d>0)f*=x.tyre==='Wet'?1+.13*d:1-.40*d;}
 return f;
}
// Lay rubber along the samples a car covered this step, under both tyre tracks.
function twDeposit(T,x,i0,i1,lane){
 if(Math.abs(lane)>HALF)return;const N=T.N;let n=(i1-i0+N)%N;if(n>N/2||n===0)return;n=Math.min(n,400);
 const b1=twBin(lane-.81),b2=twBin(lane+.81),k=1/P0,bins=[];
 // Each tyre track lays most rubber in its own 0.5 m strip and some either side.
 for(const c of b1===b2?[b1]:[b1,b2])for(const [b,wt] of [[c,1],[c-1,.5],[c+1,.5]])if(b>=0&&b<B)bins.push(b,wt);
 for(let j=1;j<=n;j++){const i=(i0+j)%N,o=i*B;for(let q=0;q<bins.length;q+=2){const b=bins[q],wt=bins[q+1],r=T.rub[o+b]+(1-T.rub[o+b])*k*wt;T.rub[o+b]=r;if(r>T.rmax[i])T.rmax[i]=r;if(T.pass[o+b]<65000)T.pass[o+b]+=wt>.9?2:1;}}
}

// --- Tyre state -----------------------------------------------------------------------------
function twTyres(x,L){
 if(x.tw67&&x.tw67.L===L)return x.tw67;const t0=(L.tw67?.amb??30)+3,w=x.rdWear||0;
 return x.tw67={L,t:[t0,t0,t0,t0],w:[w,w,w,w],g:[1,1,1,1],rel:[1,1,1,1],mean:1,pick:0,pickF:1,mz:[0,0,0,0],vPrev:Math.abs(x.v||0),idx:x.idx|0,tyre:x.tyre,hot:0};
}
function twTempGrip(c,t){if(t<c.lo)return 1-c.cold*Math.pow(clampN((c.lo-t)/(c.lo-25),0,1),1.15);if(t>c.hi)return 1-.10*clampN((t-c.hi)/25,0,1.6);return 1;}
function twWearGrip(c,w){return 1-c.deg*w/100-c.cliffK*Math.pow(Math.max(0,(w-c.cliff)/(100-c.cliff)),2);}
function twFresh(Ty,L){const t0=(L.tw67?.amb??30)+3;Ty.t=[t0,t0,t0,t0];Ty.w=[0,0,0,0];Ty.hot=0;}
function twStepTyres(W,L,x,dt,metres){
 const Ty=twTyres(x,L),c=comp(x),v=Math.abs(x.v||0),T=L.tw67,amb=T?.amb??30,wetCool=L.weather==='Extremely Wet'?2.4:L.weather!=='Dry'?1.8:1;
 let ay=0,ax=0,sF=0,sR=0,lF=0,lR=0,sp=0,sided=false;
 if(x.ph47On&&x.ph47){const s=x.ph47;ay=s.ay||0;ax=s.ax||0;sF=s.slideF||0;sR=s.slideR||0;lF=s.lockF||0;lR=s.lockR||0;sp=s.spin||0;sided=true;}
 else{ay=x.pitStage||!T?0:v*v*T.k[((x.idx|0)%T.N+T.N)%T.N];ax=dt>0?clampN((v-Ty.vPrev)/dt,-30,15):0;}
 Ty.vPrev=v;const g=9.81,gl=Math.min(3,Math.abs(ay)/g),gb=Math.max(0,-ax/g),ga=Math.max(0,ax/g),cool=(1+v/25)*wetCool,a=Math.exp(-cool/CAP*dt);
 let sum=0;
 for(let i=0;i<4;i++){
  const side=i%2?-1:1,front=i<2,lat=sided?clampN(1-side*ay/g*.32,.2,1.8):1;
  const work=.3+.95*gl*lat*(front?1.06:.94)+gb*(front?.85:.35)+ga*(front?0:.7)+(front?sF*7+lF*1.4:sR*7+lR*1.4+sp*1.8);
  const eq=amb+KH*c.heat*v*work/cool;Ty.t[i]=eq+(Ty.t[i]-eq)*a;
  if(metres>0)Ty.w[i]=Math.min(100,Ty.w[i]+metres*BASE*c.wear*(work/1.1)*(1+.06*Math.max(0,Ty.t[i]-c.hi)));
  Ty.g[i]=twTempGrip(c,Ty.t[i])*twWearGrip(c,Ty.w[i]);sum+=Ty.g[i];
 }
 Ty.mean=sum/4;for(let i=0;i<4;i++)Ty.rel[i]=Ty.g[i]/Ty.mean;
 // Marbles and dirt picked up on the tyres take a few seconds to scrub off.
 const mz=Math.max(Ty.mz[0],Ty.mz[1],Ty.mz[2],Ty.mz[3]);if(v>12&&mz>0)Ty.pick+=dt*mz*.6;Ty.pick*=Math.exp(-dt/7);Ty.mz.fill(0);Ty.pickF=1-.06*Math.min(1,Ty.pick);
 x.rdWear=(Ty.w[0]+Ty.w[1]+Ty.w[2]+Ty.w[3])/4;x.tyreTemp=(Ty.t[0]+Ty.t[1]+Ty.t[2]+Ty.t[3])/4;
 return Ty;
}

// --- Radio ----------------------------------------------------------------------------------
function twRadio(L,x,Ty,dt){
 if(x!==L.player||typeof dcRadio!=='function'||L.paused||x.pitStage)return;const T=L.tw67,R=T.radio,c=comp(x),now=T.t;
 const cold=x.tyreTemp<c.lo-25&&Math.abs(x.v)>20;
 if(cold&&!R.cold&&now>4){R.cold=now;dcRadio('Race engineer','Tyres are cold. Build the temperature before you lean on them.');}
 if(!cold&&x.tyreTemp>c.lo-6)R.cold=0;
 const front=Math.max(Ty.t[0],Ty.t[1]);Ty.hot=front>c.hi+8?Ty.hot+dt:Math.max(0,Ty.hot-dt*2);
 if(Ty.hot>5&&now-(R.hot||-999)>240){R.hot=now;dcRadio('Race engineer',(Ty.t[0]>Ty.t[1]?'Front left':'Front right')+' is overheating. Stop sliding it, look after the tyres.');}
 if(T.D0&&!R.dry&&now>30){const i=x.idx|0,b=twBin(x.lane||0);if(twDamp(T,i,b)<.2&&T.D0-T.t/1300>.45){R.dry=1;dcRadio('Race engineer','A dry line is coming in. Stay on it, off line is still damp.');}}
}

// --- Asphalt overlay: rubber line, marbles and damp patches ----------------------------------
function twOverlay(W,L){
 const T=L.tw67;if(!T||!W.scene||!W.samples)return;
 if(W.tw67Mesh?.userData.N!==T.N||!W.tw67Mesh.parent){
  try{W.tw67Mesh?.parent?.remove(W.tw67Mesh);}catch(e){}
  const N=T.N,step=N>4000?2:1,rows=Math.ceil(N/step),data=new Uint8Array(B*rows*4),tex=new THREE.DataTexture(data,B,rows,THREE.RGBAFormat);
  tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.wrapS=THREE.ClampToEdgeWrapping;tex.wrapT=THREE.RepeatWrapping;tex.needsUpdate=true;
  const pos=[],uv=[],ix=[];for(let i=0;i<=N;i++){const s=W.samples[i%N];for(const lane of [-7.1,7.1]){pos.push(s.p.x+s.n.x*lane,s.p.y+.017,s.p.z+s.n.z*lane);uv.push((lane+HALF)/(B*BW),(i/step+.5)/rows);}}
  for(let i=0;i<N;i++){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeBoundingSphere();
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4,
   uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{tMap:{value:null},uRub:{value:1}}]),
   vertexShader:`varying vec2 vUv;varying vec3 vW;varying float vD;
    #include <fog_pars_vertex>
    void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mvPosition=viewMatrix*w;vD=-mvPosition.z;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
   fragmentShader:`uniform sampler2D tMap;uniform float uRub;varying vec2 vUv;varying vec3 vW;varying float vD;
    #include <fog_pars_fragment>
    float h2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    void main(){vec4 m=texture2D(tMap,vUv);float rub=m.r,mar=m.g,dmp=m.b;
     float streak=.72+.28*h2(vec2(floor(vUv.x*240.0),floor(vUv.y*9.0)));
     float aR=rub*.42*streak*uRub;
     vec2 g=vW.xz*16.0,c=floor(g),o=vec2(h2(c+3.1),h2(c+7.7))*.6+.2;
     float near=1.0-smoothstep(20.0,60.0,vD),dots=step(.84,h2(c))*(1.0-smoothstep(.13,.22,length(fract(g)-o)));
     float aM=mar*mix(.14,.06+.85*dots,near);
     float aD=dmp*.62;
     float a=1.0-(1.0-aR)*(1.0-aM)*(1.0-aD);if(a<.003)discard;
     vec3 col=(vec3(.018,.018,.02)*(aR+aM)+vec3(.03,.034,.04)*aD)/max(aR+aM+aD,1e-3);
     gl_FragColor=vec4(col,a);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
     #include <fog_fragment>
    }`});
  mat.uniforms.tMap.value=tex;
  const mesh=new THREE.Mesh(geo,mat);mesh.name='Track evolution';mesh.renderOrder=1;mesh.frustumCulled=false;mesh.userData={N:T.N,tex,step,rows};
  W.scene.add(mesh);W.tw67Mesh=mesh;W.tw67PaintAt=-99;
 }
 if(T.t-(W.tw67PaintAt??-99)<1.5&&W.tw67PaintL===L)return;W.tw67PaintAt=T.t;W.tw67PaintL=L;
 const u=W.tw67Mesh.userData,d=u.tex.image.data;
 for(let r=0;r<u.rows;r++){const i=Math.min(T.N-1,r*u.step);for(let b=0;b<B;b++){const o=(r*B+b)*4;d[o]=Math.round(T.rub[i*B+b]*255);d[o+1]=Math.round(twMarb(T,i,b)*255);d[o+2]=Math.round(twDamp(T,i,b)*255);d[o+3]=255;}}
 u.tex.needsUpdate=true;W.tw67Mesh.visible=TW.on();
}

// --- Hooks ----------------------------------------------------------------------------------
function twInstall(){
 if(window.TW67)return;window.TW67=TW;
 // Grip: the old wear/temperature terms are neutralised and replaced by the per-corner model.
 if(typeof dcTyreGrip==='function'){const tg=dcTyreGrip;dcTyreGrip=function(x){
  const L=live,Ty=x?.tw67;if(!TW.on()||!L||!Ty||Ty.L!==L)return tg.apply(this,arguments);
  const w=x.rdWear,t=x.tyreTemp;x.rdWear=0;x.tyreTemp=84;let g;try{g=tg.apply(this,arguments);}finally{x.rdWear=w;x.tyreTemp=t;}
  let f=Ty.mean*Ty.pickF;if(!x.ph47On&&L.tw67&&!x.pitStage)f*=twTrackMu(L,x,x.idx,x.lane||0,false);
  return g*f;};}
 // Per wheel: rubber, marbles and damp under the contact patch, and that corner's tyre.
 if(typeof dc32FreeDrive==='function'){const fd=dc32FreeDrive;dc32FreeDrive=function(x){if(x)x.tw67i=0;return fd.apply(this,arguments);};}
 if(typeof ph47WheelSurface==='function'){const wsf=ph47WheelSurface;ph47WheelSurface=function(W,L,x,lane,ground,pit){
  const s=wsf.apply(this,arguments),i=(x.tw67i=(x.tw67i||0)+1)-1;
  if(!TW.on()||!s||!L?.tw67||!x.tw67||x.tw67.L!==L||i>3)return s;const Ty=x.tw67;
  if(s.kind==='grass'){Ty.mz[i]=Math.max(Ty.mz[i],.5);s.mu*=Ty.rel[i];return s;}
  if(pit||ground?.route==='pit'){s.mu*=Ty.rel[i];return s;}
  const kerb=s.kind==='kerb';s.mu*=twTrackMu(L,x,x.idx,lane,kerb)*Ty.rel[i];
  if(!kerb&&L.tw67.M>.05){const T=L.tw67,ii=((x.idx|0)%T.N+T.N)%T.N;Ty.mz[i]=Math.max(Ty.mz[i],twMarb(T,ii,twBin(lane)));}
  return s;};}
 // Physics step: track and tyre state for every car.
 if(typeof dcPhysics==='function'){const ph=dcPhysics;dcPhysics=function(dt){
  const L=live,W=sc25Engine;if(!TW.on()||!L||!W||!W.N||!L.entrants)return ph.apply(this,arguments);
  if(!L.tw67||L.tw67.N!==W.N)twInit(L,W);const T=L.tw67;
  const pre=L.entrants.map(x=>{twTyres(x,L);return {p:x.progress,w:x.rdWear,tyre:x.tyre,idx:x.idx|0};});
  const r=ph.apply(this,arguments);if(live!==L)return r;
  const step=Math.max(0,+dt||0);T.t+=step;let laps=0;
  L.entrants.forEach((x,k)=>{
   const p=pre[k],Ty=x.tw67;if(!Ty||Ty.L!==L)return;
   if(x.tyre!==p.tyre||x.rdWear<p.w-.5){twFresh(Ty,L);Ty.tyre=x.tyre;}
   const moved=Math.max(0,(x.progress||0)-(p.p||0)),metres=moved*L.e.lengthKm*1000;
   if(x.retired)return;
   twStepTyres(W,L,x,step,moved<.2?metres:0);
   if(!x.pitStage&&moved>0&&moved<.2){laps+=moved;if(!T.wet)twDeposit(T,x,p.idx,x.idx|0,x.lane||0);}
   if(x===L.player)twRadio(L,x,Ty,step);
  });
  T.laps+=laps;if(!T.wet)T.M+=laps*(1-T.M)/MK*(L.stage==='race'?1:.5);
  if(T.t-T.save>2){T.save=T.t;let s=0;for(let i=0;i<T.N;i++)s+=T.rmax[i];T.R=s/T.N;const w=D?.weekend;
   if(w&&L.stage!=='test'){const damp=T.D0?clampN(T.D0-T.t/1300,0,1):0;w.tw67={event:w.event,r:T.wet?T.R*.75:T.R,m:T.M,wet:T.wet?L.weather:damp>.3?'Wet':null};}}
  return r;};}
 // Draw the overlay with the world.
 if(typeof dcRenderWorld==='function'){const rw=dcRenderWorld;dcRenderWorld=function(){const L=live,W=sc25Engine;if(L?.tw67&&W){try{twOverlay(W,L);}catch(e){console.warn('tw67 overlay',e);}}else if(W?.tw67Mesh)W.tw67Mesh.visible=false;return rw.apply(this,arguments);};}
 // MFD and cockpit screen.
 if(typeof dcPaintHUD==='function'){const ph=dcPaintHUD;dcPaintHUD=function(){const r=ph.apply(this,arguments);try{twMfd();}catch(e){console.warn('tw67 mfd',e);}return r;};}
 if(typeof dc36DrawDash==='function'){const dd=dc36DrawDash;dc36DrawDash=function(W,L){const at=W?.dc36DashAt;const r=dd.apply(this,arguments);try{if(W&&W.dc36DashAt!==at&&L?.player?.tw67&&TW.on())twDash(W,L);}catch(e){console.warn('tw67 dash',e);}return r;};}
 // Settings switch (on by default).
 if(typeof dcSettingsFields==='function'){const sf=dcSettingsFields;dcSettingsFields=function(...args){return sf.apply(this,args)+`<div class="dc-card" style="margin-top:18px"><h3>Tyres and track</h3><label class="dc-checkbox"><input type="checkbox" ${TW.on()?'checked':''} onchange="D.settings.tw67Off=!this.checked;dcSave()">Tyre temperature, tyre wear and track evolution</label><p class="dc-muted">Cold tyres grip less until they warm up and overheated tyres slide. Tyres lose grip as they wear, softs faster than hards. The racing line rubbers in over the weekend, marbles build up off line and a damp track dries on the line first.</p></div>`;};}
}

// --- Displays -------------------------------------------------------------------------------
function twCol(c,t){return t<c.lo-15?'#4f9dff':t<c.lo?'#8fd0ff':t>c.hi+10?'#ff5a4a':t>c.hi?'#ffa24a':'#5fe0a8';}
function twTrackText(L){const T=L.tw67;if(!T)return['—','—'];const R=T.R,state=T.wet?'Wet':T.D0&&T.D0-T.t/1300>.05?'Damp, drying':'Dry',grip=R<.3?'Green':R<.6?'Rubbering in':'Rubbered in';return [state,grip+' '+Math.round(R*100)+'%'];}
function twMfd(){
 const L=live,m=document.getElementById('u58-mfd'),p=L?.player,Ty=p?.tw67;if(!m||!Ty||!TW.on())return;
 const hd=m.querySelector('.hd')?.firstChild?.textContent||'',page=hd==='CAR'?1:hd==='CONDITIONS'?2:0;let el=m.querySelector('.tw67');
 if(page!==1&&page!==2){el?.remove();return;}
 if(!el){el=document.createElement('div');el.className='tw67';el.style.cssText='padding:0 10px 9px;font:600 13px "UI Rajdhani",sans-serif;letter-spacing:.05em';m.appendChild(el);el.tw67Sig='';}
 const c=comp(p),T=L.tw67;let html;
 if(page===1){const cell=i=>`<div style="background:#ffffff0d;border-left:3px solid ${twCol(c,Ty.t[i])};padding:3px 6px"><b style="color:${twCol(c,Ty.t[i])};font-size:16px">${Math.round(Ty.t[i])}°</b><span style="float:right;color:#aab2c2">${Math.round(100-Ty.w[i])}%</span></div>`;
  html=`<div style="display:flex;justify-content:space-between;color:#aab2c2;padding:2px 0 4px"><span>TYRES ${String(p.tyre||'').toUpperCase()}</span><span>TEMP · LIFE</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${[0,1,2,3].map(cell).join('')}</div>`;}
 else{const [state,grip]=twTrackText(L);html=`<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid #ffffff12"><span style="color:#aab2c2">Track</span><b>${state}</b></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#aab2c2">Grip</span><b>${grip}</b></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:#aab2c2">Track temp</span><b>${Math.round(T.amb)}°</b></div>`;}
 if(el.tw67Sig!==html){el.tw67Sig=html;el.innerHTML=html;}
}
function twRR(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
// Cockpit centre screen: fuel and damage share a row, the tyre block shows each corner.
function twDash(W,L){
 const p=L.player,Ty=p.tw67,cmp=comp(p),c=W.dc35DashTex?.image?.getContext?.('2d');if(!c)return;const w=c.canvas.width,tx=290,tw=w-tx-24;
 c.fillStyle='#060c10';c.fillRect(tx-2,126,tw+4,194);
 const fuel=p.fuel??0,dmg=Math.round(p.bodyDamage||0);twRR(c,tx,128,tw,52,10);c.fillStyle='#0d171d';c.fill();
 c.textBaseline='alphabetic';c.textAlign='left';c.fillStyle='#6f8792';c.font='700 18px Arial';c.fillText('FUEL',tx+14,161);c.fillText('DMG',tx+tw/2+10,161);
 c.textAlign='right';c.font='800 32px Arial';c.fillStyle=fuel<8?'#ff8a5c':'#cfe3e6';c.fillText(fuel.toFixed(1)+' L',tx+tw/2-12,166);c.fillStyle=dmg>40?'#ff5a4a':dmg>20?'#ff8a5c':'#6fe0b6';c.fillText(dmg+'%',tx+tw-14,166);
 twRR(c,tx,188,tw,130,10);c.fillStyle='#0d171d';c.fill();
 c.textAlign='left';c.fillStyle='#6f8792';c.font='700 18px Arial';c.fillText('TYRES · '+String(p.tyre||'').toUpperCase(),tx+14,210);
 const [,grip]=twTrackText(L);c.textAlign='right';c.fillText('TRACK '+grip.toUpperCase(),tx+tw-14,210,tw/2);
 const cw=(tw-36)/2,ch=46;for(let i=0;i<4;i++){const x0=tx+12+(i%2)*(cw+12),y0=218+(i>1?ch+4:0),t=Ty.t[i],col=twCol(cmp,t),life=clampN(1-Ty.w[i]/100,0,1);
  twRR(c,x0,y0,cw,ch,7);c.fillStyle='#152229';c.fill();c.fillStyle=col;c.fillRect(x0,y0+6,5,ch-12);
  c.textAlign='left';c.font='800 30px Arial';c.fillText(Math.round(t)+'°',x0+14,y0+33);
  c.textAlign='right';c.fillStyle='#9fb3bb';c.font='700 18px Arial';c.fillText(Math.round(life*100)+'%',x0+cw-10,y0+24);
  c.fillStyle='#22343d';c.fillRect(x0+cw-74,y0+32,64,5);c.fillStyle=life<.25?'#ff8a5c':'#cfe3e6';c.fillRect(x0+cw-74,y0+32,64*life,5);}
 W.dc35DashTex.needsUpdate=true;
}

window.TW67_API={twTrackMu,twMarb,twDamp,twRub,twBin,COMP};
if(document.readyState==='complete')twInstall();else window.addEventListener('load',twInstall);
})();
