/* AI76: race craft, real mistakes and tyre warm-up weaving.
   - Line discipline: a car only leaves the racing line to pass when it is genuinely quicker and
     close enough to make a move (the old rule pulled any car within 70 m of another onto a fixed
     side lane, so most of the field drove 2-3 m off the line). Moves go to the inside of the next
     corner, or alongside on a straight.
   - Smooth heading: far-away (path model) cars point where they are going. They used to take the
     centreline's heading, which spun them on the spot at sharp centreline kinks (Albert T13), and
     snapped round when they changed between the path model and the full physics.
   - Pace: the gap between the best and worst driver/car is halved, so the field laps close together.
   - Mistakes: drivers now make real errors on the tyre model: braking too late and locking up,
     carrying too much speed into a corner, or snapping the rear on the exit. A car that makes one
     is switched to the full physics wherever it is on the circuit, so what happens next (a save, a
     trip through the gravel, a spin or a wall) is decided by the car, and a real crash brings the
     safety car out (st69).
   - Weaving: on the formation lap and behind the safety car every AI car swerves left and right on
     the straights to build tyre temperature, like real drivers. */
const AI76={spread:.5,formV:31,pass:{close:1.2,near:16,reach:35,off:3.3,hold:4},
 rate:{Easy:.075,Intermediate:.06,Hard:.045},types:[['late',.4],['hot',.3],['snap',.3]],
 weave:{amp:1.2,per:1.9,fade:.9,kmax:1/110,gap:9},log:[]};
const ai76Hash=(x,k=1)=>{const s=Math.sin(((x?.seed||0)+1)*12.9898*k+(x?.d?.number||0)*78.233)*43758.5453;return s-Math.floor(s);};
function ai76Tier(){const d=D?.settings?.difficulty;return AI76.rate[d]?d:'Intermediate';}

// --- Pace spread --------------------------------------------------------------------------------
function ai76DriverCar(x){return 1+((x.d?.ovr??82)-82)*.003+((x.team?.base??78)-78)*.0018;}
const ai76Perf=dcPerformance;
dcPerformance=function(x,stage){
 const r=ai76Perf.apply(this,arguments);if(!x?.d||x.d.id===D?.pid||typeof CO!=='undefined'&&CO.race&&CO.pl?.[1]?.x===x)return r;
 const m=live?.ai76Mean;if(!m)return r;const dc=ai76DriverCar(x);return r/dc*(m+(dc-m)*AI76.spread);
};

// --- Corners of the racing line -----------------------------------------------------------------
// Apexes along the line (lap phase, curvature, which side the line runs at the apex), for passing
// to the inside and for picking where a mistake happens.
function ai76Corners(W,L){
 if(W.ai76C&&W.ai76C.key===L.e.key&&W.ai76C.ai68===W.ai68)return W.ai76C;
 const len=L.e.lengthKm*1000,n=Math.max(100,Math.round(len/4)),k=new Float32Array(n);for(let i=0;i<n;i++)k[i]=Math.abs(ai68Curv(W,i/n));
 const list=[],gap=Math.round(70/(len/n));
 for(let i=0;i<n;i++){const v=k[i];if(v<1/170)continue;let top=true;for(let j=-gap;j<=gap&&top;j++)if(j&&k[(i+j+n)%n]>v)top=false;if(top)list.push({f:i/n,k:v,side:Math.sign(ai68Line(W,i/n))||1});}
 return W.ai76C={key:L.e.key,ai68:W.ai68,list};
}
function ai76NextCorner(W,L,progress,from=0){const C=ai76Corners(W,L).list,len=L.e.lengthKm*1000,ph=((progress%1)+1)%1;let best=null,bd=1e9;for(const c of C){let d=(c.f-ph+1)%1*len;if(d<from)d+=len;if(d<bd){bd=d;best=c;}}return best?{c:best,d:bd}:null;}

// --- Passing ------------------------------------------------------------------------------------
// Called by the race planner in place of its old pass rule (patched in by build_ai76.py). Sets
// x.dc32Pass for the planner while a move is on and returns false so the old rule never runs.
function ai76Pass(x,traffic,blocked){
 const L=live,W=sc25Engine,P=AI76.pass;let M=x.ai76P;const f=traffic?.front,gap=traffic?.gap??1e9;
 const end=()=>{x.ai76P=null;x.dc32Pass=undefined;x.dc32PassUntil=0;};
 if(blocked||!f||!W?.ai68){if(M||x.dc32Pass!==undefined)end();return false;}
 if(M&&(L.elapsed>M.until||M.f!==f||gap>P.reach*1.6)){end();M=null;}
 const close=(x.v||0)-(f.v||0);
 if(!M&&gap>3&&gap<Math.max(P.reach,(x.v||0)*1.1)&&(close>P.close||gap<P.near&&dcPerformance(x)>dcPerformance(f)+.004)){
  const len=L.e.lengthKm*1000,nc=ai76NextCorner(W,L,x.progress,25);let side;
  if(nc&&nc.d<Math.max(160,(x.v||0)*3.2))side=nc.c.side;else side=(f.lane||0)>ai68Line(W,x.progress)?-1:1;
  for(const s of [side,-side]){const lane=ai68Clamp(W,x.progress,(f.lane||0)+s*P.off);if(Math.abs(lane-(f.lane||0))>2.6&&dc32LaneClear(x,lane)){M=x.ai76P={side:s,f,until:L.elapsed+P.hold};break;}}
 }
 if(M){const lane=ai68Clamp(W,x.progress,(f.lane||0)+M.side*P.off);if(Math.abs(lane-(f.lane||0))<2.4){end();return false;}x.dc32Pass=lane||1e-3;x.dc32PassUntil=L.elapsed+.25;}
 else if(x.dc32Pass!==undefined)end();
 return false;
}

// --- Weaving ------------------------------------------------------------------------------------
function ai76WeaveWanted(L,W,x){
 if(L.stage!=='race'||x===L.player||x.pitStage||x.pitNow||x.retired||x.finished||x.garage||x.outlapHold||x.ai76E||x.rf40Incident||x.st69Glide)return false;
 const v=x.v||0,len=L.e.lengthKm*1000;if(v<8||v>36)return false;
 if(L.phase==='formation'){if(!Number.isFinite(x.formationTarget)||(x.formationTarget-x.progress)*len<320)return false;}
 else if(!(L.scTrain&&L.started))return false;
 for(const m of [0,35,70])if(Math.abs(ai68Curv(W,x.progress+m/len))>AI76.weave.kmax)return false;
 // Only a car alongside limits the swerve (cars nose to tail in one column can all weave).
 const q=W.at(x.progress);let room=AI76.weave.amp*1.2;for(const y of L.entrants){if(y===x||!y.pos||y.garage)continue;const dx=y.pos.x-x.pos.x,dz=y.pos.z-x.pos.z,al=dx*q.v.x+dz*q.v.z;if(Math.abs(al)<AI76.weave.gap){const lat=Math.abs(dx*q.n.x+dz*q.n.z);if(lat<2.3&&Math.abs(al)<6.5)return false;if(lat<6)room=Math.min(room,(lat-2.2)/2);}}
 return room>.3?room:false;
}
// Lateral offset of the weave this frame (0 when not weaving). x.ai76Ay is its sideways
// acceleration, which the tyre model turns into heat for path-model cars.
function ai76Weave(L,W,x,dt){
 const on=ai76WeaveWanted(L,W,x),amp=on?Math.min(on,AI76.weave.amp*(.85+.3*ai76Hash(x,2))):0;
 x.ai76Wa=(x.ai76Wa||0)+clamp(amp-(x.ai76Wa||0),-dt*AI76.weave.fade,dt*AI76.weave.fade);
 if(x.ai76Wa<.01){x.ai76Wa=0;x.ai76Ay=0;return 0;}
 const om=2*Math.PI/(AI76.weave.per*(.88+.24*ai76Hash(x,3)));x.ai76Wp=(x.ai76Wp??ai76Hash(x,4)*6.28)+om*dt;
 x.ai76Ay=x.ai76Wa*om*om*Math.sin(x.ai76Wp);
 const w=x.ai76Wa*Math.sin(x.ai76Wp),base=x.lane;return ai68Clamp(W,x.progress,base+w)-base;
}

// --- Mistakes -----------------------------------------------------------------------------------
function ai76Racing(L){return L?.dc&&L.stage==='race'&&L.started&&L.phase==='racing'&&!L.scTrain&&!L.simulated&&!dcSimBusy;}
function ai76Pick(){let r=Math.random(),acc=0;for(const [t,w] of AI76.types){acc+=w;if(r<acc)return t;}return 'late';}
// Each driver rolls once per corner, 120-320 m before it. The chance per lap depends on the
// difficulty and goes up for weaker drivers, cold tyres, rain, damage, the first lap, and a car
// right behind.
function ai76Schedule(L,W){
 if(!ai76Racing(L)||D.settings.ph47Classic||D.settings.ai62Off||(L.elapsed-(L.ai76Go??=L.elapsed))<4)return;
 const C=ai76Corners(W,L).list;if(!C.length)return;const len=L.e.lengthKm*1000,base=AI76.rate[ai76Tier()]/C.length;
 for(const x of L.entrants){
  if(x===L.player||x.retired||x.finished||x.garage||x.pitStage||x.pitNow||x.outlapHold||x.ai76E||x.rf40Incident||x.st69Glide||(x.v||0)<25)continue;
  if(typeof CO!=='undefined'&&CO.race&&CO.pl?.[1]?.x===x)continue;
  const nc=ai76NextCorner(W,L,x.progress);if(!nc||nc.d<120||nc.d>320||x.ai76Seen===nc.c)continue;x.ai76Seen=nc.c;
  let p=base*clamp(1+(1.06*hd64Pace()-dcPerformance(x))*7,.6,1.8);
  const c=window.TW67_API?.COMP?.[x.tyre];if((x.tyreTemp??90)<(c?.lo??82)-15)p*=2;
  if(L.weather==='Extremely Wet')p*=2.6;else if(L.weather!=='Dry')p*=2;
  if((x.bodyDamage||0)>15)p*=1.4;if(x.progress<1)p*=1.8;
  if(L.entrants.some(y=>y!==x&&!y.pitStage&&!y.retired&&(x.progress-y.progress)*len>0&&(x.progress-y.progress)*len<22))p*=1.4;
  if(Math.random()<p)ai76Start(L,x,ai76Pick(),Math.pow(Math.random(),.7),nc.c);
 }
}
function ai76Start(L,x,type,sev,corner){x.ai76E={type,sev,c:corner,t:0,stage:0,st:0};AI76.log.push({n:x.d.number,type,sev:+sev.toFixed(2),lap:Math.floor(x.progress)+1,at:+corner.f.toFixed(3)});}
function ai76ToCorner(L,x){const len=L.e.lengthKm*1000,ph=((x.progress%1)+1)%1;let d=(x.ai76E.c.f-ph)*len;if(d>len/2)d-=len;if(d<-len/2)d+=len;return d;}
// Too much speed into the corner: the driver's corner speed estimate is optimistic.
const ai76Cap=ai62CornerCap;
ai62CornerCap=function(L,x){const c=ai76Cap.apply(this,arguments),E=x.ai76E;if(E?.type==='hot'){const d=ai76ToCorner(L,x);if(d>-25&&d<260)return c*(1.05+.11*E.sev);}return c;};
function ai76Mistake(L,x,input,dt){
 const E=x.ai76E,a=x.ai62;E.t+=dt;const d=ai76ToCorner(L,x);
 if(E.type==='late'){
  // Brakes late, then stamps on them without ABS: the fronts lock and the car runs on.
  if(E.stage===0&&input.brake>.05&&d>0){E.stage=1;E.st=0;}
  if(E.stage===1){E.st+=dt;input.brake=0;input.throttle=.85;if(E.st>.16+.42*E.sev){E.stage=2;E.st=0;}}
  if(E.stage===2){E.st+=dt;input.brake=1;input.throttle=0;a.assist=AI62.lock;if(E.st>.55+.6*E.sev){E.stage=3;a.assist=AI62.assist;}}
 }else if(E.type==='snap'){
  // Too much throttle too early on the exit with the rear loaded: it steps out.
  if(E.stage===0&&d<-4&&d>-60){E.stage=1;E.st=0;}
  if(E.stage===1){E.st+=dt;a.assist=AI62.loose;a.rear=1-(.18+.3*E.sev)*Math.min(1,E.st/.15);input.throttle=1;input.brake=0;if(E.st>.45+.55*E.sev){E.stage=3;a.assist=AI62.assist;a.rear=1;}}
 }else if(E.type==='hot'){if(d<-5)E.stage=3;}
 if(E.stage===3&&d<-90||E.t>14||d<-300){a.assist=AI62.assist;a.rear=1;x.ai76E=null;x.ai76Hold=L.elapsed+5;}
}
// A car with a mistake on (or still recovering from one) drives the full physics wherever it is.
const ai76Wanted=ai62Wanted;
ai62Wanted=function(L,x){
 if(ai76Wanted(L,x))return true;
 // Stay on the physics until the car is back on the road and up to speed.
 if(x.ai62&&x.ai76Hold&&((x.ph47?.grass||0)>=2||Math.abs(x.lane)>7||(x.v||0)<16))x.ai76Hold=Math.max(x.ai76Hold,L.elapsed+3);
 if(!(x.ai76E||L.elapsed<(x.ai76Hold||0)))return false;
 if(D.settings.ph47Classic||D.settings.ai62Off||dcSimBusy||L.simulated||!L.dc)return false;
 if(x===L.player||x.retired||x.finished||x.garage||x.pitStage||x.outlapHold||x.sc3Crash||!x.pos||(x.releaseDelay||0)>0)return false;
 if(!x.ai62&&(Math.abs(x.lane)>7.4||x.dc32PitMerge==='out'))return false;
 return true;
};
const ai76Drive=ai62Drive;
ai62Drive=function(L,x,plan,dt){
 const W=sc25Engine,w=ai76Weave(L,W,x,dt);if(w)plan={...plan,lane:plan.lane+w};
 const input=ai76Drive.call(this,L,x,plan,dt);if(x.ai76E&&x.ai62)ai76Mistake(L,x,input,dt);return input;
};

// --- Planner wrapper: path-model heading and weave ----------------------------------------------
const ai76Step=dcAIStep;
dcAIStep=function(x,dt){
 const L=live,W=sc25Engine;if(!L?.dc||!W||!x?.pos)return ai76Step.apply(this,arguments);
 const yaw0=x.yaw,px=x.pos.x,pz=x.pos.z,wo=x.ai76Wo||0;if(wo&&!x.ai62)x.lane-=wo;x.ai76Wo=0;
 const r=ai76Step.apply(this,arguments);
 if(x.ai62||x.pitStage||x.garage||x.retired||x.st69Glide||!x.pos||!(dt>0)){x.ai76Vr=undefined;return r;}
 // Formation lap at formation pace (it used to be driven at race speed), easing in on the slot.
 if(L.phase==='formation'&&L.stage==='race'&&!x.outlapHold&&x!==L.player&&(x.v||0)>AI76.formV)x.v=Math.max(AI76.formV,x.v-7*dt);
 if(!x.outlapHold){const w=ai76Weave(L,W,x,dt);if(w){x.lane+=w;x.ai76Wo=w;const q=W.at(x.progress);x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};}}else{x.ai76Wa=0;x.ai76Ay=0;}
 ai76Unfold(W,x);
 const dx=x.pos.x-px,dz=x.pos.z-pz,d=Math.hypot(dx,dz);
 // Path-model speed is in reference-trace units, not metres per second (up to twice the real
 // speed in slow corners), so traffic checks use the speed the car really moves at.
 const vr=d/dt;x.ai76Vr=d<Math.max(3,(x.v||0)*dt*3)?(x.ai76Vr??vr)+(vr-(x.ai76Vr??vr))*Math.min(1,dt*8):undefined;
 const q=W.at(x.progress),fwd=d>.01&&dx*q.v.x+dz*q.v.z>d*.3;
 if(fwd&&d<Math.max(3,(x.v||0)*dt*3)&&Number.isFinite(yaw0))x.yaw=yaw0+dcWrapAngle(Math.atan2(dx,dz)-yaw0)*Math.min(1,dt*12);
 else if(d<Math.max(3,(x.v||0)*dt*3)&&Number.isFinite(yaw0))x.yaw=yaw0;
 return r;
};
// Between two centreline samples that turn sharply (Albert T13 turns 0.5 rad per sample) a lane
// far on the inside folds back on itself, so a path-model car drawn there ran backwards and spun
// on the spot. Draw it no further inside than the fold allows (its lane is left as planned).
function ai76Folds(W){
 if(W.ai76F?.N===W.N)return W.ai76F;const N=W.N,lo=new Float32Array(N).fill(-99),hi=new Float32Array(N).fill(99);
 for(let i=0;i<N;i++){const a=W.samples[i],b=W.samples[(i+1)%N],d=a.p.distanceTo(b.p),t=dcWrapAngle(Math.atan2(b.v.x,b.v.z)-Math.atan2(a.v.x,a.v.z));if(Math.abs(t)<.08||d<.1)continue;
  const lim=Math.max(.5,.5*d/Math.abs(t));for(const j of [(i-1+N)%N,i,(i+1)%N,(i+2)%N])if(t>0)lo[j]=Math.max(lo[j],-lim);else hi[j]=Math.min(hi[j],lim);}
 return W.ai76F={N,lo,hi};
}
function ai76Unfold(W,x){
 const F=ai76Folds(W),{i,j,u}=ai68Index(W,x.progress),lo=Math.max(F.lo[i],F.lo[j]),hi=Math.min(F.hi[i],F.hi[j]);if(x.lane>=lo&&x.lane<=hi)return;
 const q=W.at(x.progress),l=clamp(x.lane,lo,hi);x.pos={x:q.p.x+q.n.x*l,y:q.p.y,z:q.p.z+q.n.z*l};
}
// Traffic: every path-model car is seen (and sees itself) at its real speed; the answer is put
// back into the asking car's own speed units.
const ai76Traffic=dc32Traffic;
dc32Traffic=function(x,lane,pit){
 const L=live;if(pit||!L?.dc||!L.entrants)return ai76Traffic.apply(this,arguments);
 const keep=[];for(const y of L.entrants)if(!y.ai62&&Number.isFinite(y.ai76Vr)&&!y.pitStage&&!y.outlapHold){keep.push([y,y.v]);y.v=y.ai76Vr;}
 let r;try{r=ai76Traffic.apply(this,arguments);}finally{for(const [y,v] of keep)y.v=v;}
 if(!x.ai62&&Number.isFinite(x.ai76Vr)&&x.ai76Vr>2&&Number.isFinite(r.target))r={...r,target:r.target*clamp((x.v||0)/x.ai76Vr,.4,2.5)};
 return r;
};
// Physics take-over keeps the heading the car already shows (no snap).
const ai76Enter=ai62Enter;
ai62Enter=function(L,x){const yaw=x.yaw;ai76Enter.apply(this,arguments);if(Number.isFinite(yaw)&&Math.abs(dcWrapAngle(yaw-x.yaw))<.5)x.yaw=yaw;};

const ai76Physics=dcPhysics;
dcPhysics=function(dt){const L=live,W=sc25Engine;if(L?.dc&&W?.ai68)try{ai76Schedule(L,W);}catch(e){console.warn('ai76',e);}return ai76Physics.apply(this,arguments);};
const ai76Launch=dcLaunch;
dcLaunch=function(...args){
 const r=ai76Launch(...args),L=live;
 if(L?.dc){const ai=L.entrants.filter(x=>x!==L.player);L.ai76Mean=ai.length?ai.reduce((s,x)=>s+ai76DriverCar(x),0)/ai.length:1;L.ai76Go=null;AI76.log=[];for(const x of L.entrants){x.ai76E=null;x.ai76P=null;x.ai76Wa=0;x.ai76Wo=0;x.ai76Ay=0;}
}
 return r;
};
