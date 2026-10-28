/* ST69 · Stuck cars.
   Cause found (Symmons Plains hairpin): far-away AI cars run on the path model, and after any contact
   the collision code re-read their track position from the nearest centreline sample within about
   60 m. On the inside of a hairpin that is the other leg of the hairpin, so the car's lane flipped
   between +11 m and -2 m and its progress was pulled back every frame. Cars piled up off the road,
   kept moving at 5-15 m/s on the spot, and the old rescue (only cars under 2.5 m/s) never fired.
   - Path-model AI cars now re-read their position along their own stretch of road (a projection
     from their current progress, never more than 30 m away), and a path car that ends up beyond the
     usable road is steered back onto it.
   - A car is stuck when it covers less than 6 m in 5 s while racing (not when queued behind a car
     that is moving, not in the first 12 s after the start, not in the pits, the safety car queue or
     the grid). That catches cars wriggling on the spot as well as stopped ones.
   - Stuck after a real impact (damage taken just before it stopped, or heavy damage): race control
     sends the safety car, marshals recover the car, and it rejoins (or retires if the damage is
     terminal). Stuck with no impact (a glitch): the game steps in at once and drives the car back
     onto a clear piece of the racing line over a second or two, passing through other cars while it
     does, instead of the old instant teleport. Restarts from the safety car queue get the same
     12 s grace as the race start. */
(()=>{
'use strict';
const ST={win:5,move:6,guard:12,hit:6,hitV:18,hitAge:10,tow:7,ghost:3};
window.ST69=ST;
const lenM=L=>L.e.lengthKm*1000;
const human=(L,x)=>x===L.player&&!L.dc33Auto||!!(window.CO63?.race&&window.CO63.pl?.[1]?.x===x);
const pathCar=(L,x)=>!x.ai62&&!x.pitStage&&!human(L,x);

/* ---------- Track position for path-model cars ---------- */
// Project the car onto the centreline starting from its own progress (Newton steps along the
// tangent), so it can never snap to another part of the circuit that happens to be closer.
function project(W,L,x){
 const len=lenM(L);let ph=x.progress;
 for(let n=0;n<4;n++){const q=W.at(ph);ph+=((x.pos.x-q.p.x)*q.v.x+(x.pos.z-q.p.z)*q.v.z)/len;}
 const q=W.at(ph),nl=q.n.x*q.n.x+q.n.z*q.n.z||1,dx=x.pos.x-q.p.x,dz=x.pos.z-q.p.z,lane=(dx*q.n.x+dz*q.n.z)/nl,ox=dx-q.n.x*lane,oz=dz-q.n.z*lane;
 return{ph,lane,q,miss:Math.hypot(ox,oz)};
}
const baseSync=dc33Sync;
dc33Sync=function(x){
 const W=sc25Engine,L=live;if(!W||!L?.dc||!x?.pos||!pathCar(L,x))return baseSync(x);
 const r=project(W,L,x);if(!(Math.abs(r.ph-x.progress)*lenM(L)<30&&r.miss<1.5&&Math.abs(r.lane)<14))return baseSync(x);
 x.progress=r.ph;x.lane=r.lane;x.idx=Math.round(r.q.t*W.N)%W.N;x.dc32NearAt=-Infinity;x.pos.y=r.q.p.y;
};

/* ---------- Recovery ---------- */
// While being recovered a car stays on the path model.
const baseWanted=ai62Wanted;
ai62Wanted=function(L,x){return x.st69Glide||x.st69Tow?false:baseWanted(L,x);};
function bounds(W,x){const R=W.ai68;if(!R)return[-6,6];const i=ai68Index(W,x.progress).i;return[R.lo[i],R.hi[i]];}
function glide(L,x){
 const W=sc25Engine;if(x.ai62)ai62Leave(x);
 x.rf40Incident=null;x.aiError=0;x.dc32Pass=undefined;x.dc33ImpactX=x.dc33ImpactZ=x.dc33Angular=x.dc33YawOffset=0;x.latV=0;x.ph47=null;
 const [lo,hi]=bounds(W,x),line=typeof ai68Line==='function'?ai68Line(W,x.progress):0,from=clamp(x.lane,-14,14);
 const lanes=[line,line-3,line+3,line-5.5,line+5.5,0].map(l=>clamp(l,lo,hi)).sort((a,b)=>Math.abs(a-from)*.15+Math.abs(a-line)-(Math.abs(b-from)*.15+Math.abs(b-line)));
 const to=lanes.find(l=>dc32LaneClear(x,l))??clamp(line,lo,hi),q=W.at(x.progress),yaw=dcWrapAngle(x.yaw-Math.atan2(q.v.x,q.v.z));
 x.st69Glide={t:0,dur:clamp(Math.abs(to-from)/4+Math.abs(yaw)*.5,1.2,3),from,to,yaw};x.lane=from;x.v=Math.max(0,x.v||0);
 x.ic59Ghost=x.st69Glide.dur+ST.ghost;x.dc33Previous=null;x.ai68Slip=0;
}
const baseStep=dcAIStep;
dcAIStep=function(x,dt){
 const L=live,W=sc25Engine;if(!L?.dc||!W)return baseStep(x,dt);
 if(x.st69Tow){x.v=x.speed=0;x.ic59Ghost=Math.max(x.ic59Ghost||0,1);return;}
 const r=baseStep(x,dt),g=x.st69Glide;
 if(g&&!x.pitStage&&x.pos){
  g.t+=dt;const u=clamp(g.t/g.dur,0,1),s=u*u*(3-2*u),q=W.at(x.progress);
  x.lane=g.from+(g.to-g.from)*s;x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};
  x.yaw=Math.atan2(q.v.x,q.v.z)+g.yaw*(1-s);x.v=Math.max(x.v,Math.min(12,4+g.t*6));x.speed=x.v*3.6;
  if(u>=1)x.st69Glide=null;
 }else if(g)x.st69Glide=null;
 // A path car pushed beyond the usable road (contact, an old save) is steered back onto it.
 else if(pathCar(L,x)&&x.pos&&!x.retired&&!x.finished&&!x.outlapHold&&W.ai68){
  const [lo,hi]=bounds(W,x),want=clamp(x.lane,lo-.5,hi+.5);
  if(want!==x.lane){x.lane+=clamp(want-x.lane,-4*dt,4*dt);const q=W.at(x.progress);x.pos.x=q.p.x+q.n.x*x.lane;x.pos.z=q.p.z+q.n.z*x.lane;}
 }
 return r;
};

/* ---------- Detection ---------- */
function moved(x,t){const h=x.st69Trail;if(!h?.length||t-h[0].t<ST.win-.01)return Infinity;let i=h.length-1;while(i>0&&t-h[i].t<ST.win)i--;return h[h.length-1].d-h[i].d;}
// Waiting behind a car that is itself still moving (a queue into a hairpin) is not stuck. Cars being
// recovered, and cars stuck for a long time, do not hold anyone up.
function queued(L,x){const W=sc25Engine,q=W.at(x.progress);return L.entrants.some(y=>{if(y===x||y.garage||y.retired||y.pitStage||!y.pos||y.ic59Ghost>0||y.st69Glide||y.st69Tow||(y.st69Still||0)>ST.win+3)return false;const dx=y.pos.x-q.p.x,dz=y.pos.z-q.p.z,along=dx*q.v.x+dz*q.v.z,side=dx*q.n.x+dz*q.n.z-(x.lane||0);return along>0&&along<14&&Math.abs(side)<3.2;});}
// A real impact: damage taken at speed (a car shuffling against others in a jam does not count).
function crashed(L,x){const h=x.st69Hit;return (x.bodyDamage||0)>=70||!!h&&L.elapsed-h.at<ST.hitAge&&h.sum>=ST.hit&&h.v>=ST.hitV;}
function check(L,dt){
 const racing=L.stage==='race'&&L.phase==='racing'&&L.started!==false,sc=L.ic59Sc,len=lenM(L),t=L.elapsed;
 const go=racing?(L.st69Go??=t):(L.st69Go=undefined);if(sc?.phase==='lineup')L.st69Lineup=t;
 // The field pulling away from the safety car queue is another standing start: same grace period.
 const restart=t-(L.st69Lineup??-1e9)<ST.guard;
 for(const x of L.entrants){
  if(x.st69Tow){const w=x.st69Tow;w.t+=dt;if(w.t<ST.tow||L.stage!=='race')continue;x.st69Tow=null;
   if((x.bodyDamage||0)>=70){x.retired=true;x.garage=true;x.v=x.speed=0;dcRadio('Race control','Car #'+x.d.number+' is out of the race. The car has been recovered.');continue;}
   glide(L,x);dcRadio('Race control','Car #'+x.d.number+' has been recovered by the marshals and rejoins.');continue;}
  const skip=!racing||human(L,x)||x.retired||x.finished||x.garage||x.pitStage||x.outlapHold||(x.releaseDelay||0)>0||!x.pos||x.st69Glide||sc?.phase==='lineup'&&!x.ic59Through;
  if(skip){x.st69Trail=null;x.st69Still=0;continue;}
  const h=x.st69Trail||(x.st69Trail=[]),d=x.progress*len;if(!h.length||t-h[h.length-1].t>=.25)h.push({t,d});while(h.length&&t-h[0].t>ST.win+1)h.shift();
  if(t-go<ST.guard||restart&&!x.ic59Through||moved(x,t)>=ST.move){x.st69Still=0;continue;}
  x.st69Still=(x.st69Still||0)+dt;if(queued(L,x))continue;
  x.st69Trail=null;x.st69Still=0;
  if(crashed(L,x)){
   if(x.ai62)ai62Leave(x);x.st69Tow={t:0};x.v=x.speed=0;x.ic59Ghost=ST.tow+1;
   dcSafety('Car #'+x.d.number+' has crashed and is stranded on the circuit.');
  }else glide(L,x);
 }
}
// Damage taken in the last moments, so a stopped car can be told apart from a glitched one.
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){
 const L=live;if(!L?.dc)return basePhysics(dt,input,auto);
 const r=basePhysics(dt,input,auto);if(live!==L)return r;
 for(const x of L.entrants){const dmg=x.bodyDamage||0,d=dmg-(x.st69Dmg??dmg);if(d>0){const h=x.st69Hit;x.st69Hit=h&&L.elapsed-h.at<1?{at:L.elapsed,sum:h.sum+d,v:h.v}:{at:L.elapsed,sum:d,v:x.st69V||0};}x.st69Dmg=dmg;x.st69V=Math.abs(x.v||0);}
 check(L,dt);return r;
};
const baseLaunch=dcLaunch;
dcLaunch=function(...args){const r=baseLaunch(...args),L=live;if(L?.dc){L.st69Go=undefined;for(const x of L.entrants){x.st69Trail=null;x.st69Still=0;x.st69Glide=null;x.st69Tow=null;x.st69Hit=null;x.st69Dmg=undefined;}L.st69Lineup=undefined;}return r;};
})();
