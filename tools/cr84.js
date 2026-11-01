/* cr84 · Crashes always bring out the safety car, wrecks pull aside and are recovered to the pits.
   - Whenever an AI car crashes (a heavy hit: 15% or more damage in one incident, or 40% total, or a
     car the old code would have retired on the spot) race control calls the safety car straight
     away. There is no minimum: every crash, every time. sc83's rolling safety car is what comes out.
   - The crashed car is never left in anyone's way: it ghosts at once (no second impacts), slows down
     and pulls off to the nearer side of the road, then stops there and waits for the marshals.
   - After a short wait it is lifted back to the pits. Over 70% damage it is ruled out of the race
     there (DNF); otherwise it is put at the pit entry behind where it crashed, drives down the lane
     and its crew repairs it, so it loses a big chunk of time but rejoins.
   - Pit repairs (every car, the player too): a car that comes in with more than 50% damage can only
     be patched back to 25%. Damage of 50% or less is still fully repaired.
   - Fewer accidents: an AI car closing fast on a slower car right in front (same lane) eases off
     instead of driving into the back of it. */
(()=>{
'use strict';
const CR={hit:15,hitV:12,total:40,out:70,repairFrom:50,repairTo:25,decel:7,wait:8,sideV:3,ghost:4};
const S={log:[]};window.CR84=Object.assign(S,{cfg:CR});
const lenM=L=>L.e.lengthKm*1000,frac=p=>((p%1)+1)%1;
const human=(L,x)=>x===L.player||!!(window.CO63?.race&&window.CO63.pl?.[1]?.x===x);
const racing=L=>L.stage==='race'&&L.phase==='racing'&&L.started!==false&&!L.finished;
const radio=m=>{try{dcRadio('Race control',m);}catch(_){}};
function bounds(W,x){const R=W.ai68;if(!R||typeof ai68Index!=='function')return[-6,6];const i=ai68Index(W,x.progress).i;return[R.lo[i],R.hi[i]];}
function place(W,x,yawOff=0){const q=W.at(x.progress);x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};x.yaw=Math.atan2(q.v.x,q.v.z)+yawOff;x.idx=Math.round(q.t*W.N)%W.N;}
function calm(x){x.dc33ImpactX=x.dc33ImpactZ=x.dc33Angular=x.dc33YawOffset=0;x.latV=0;x.aiError=0;x.rf40Incident=null;x.dc32Pass=undefined;x.ph47=null;x.dc33Previous=null;x.st69Glide=null;x.st69Tow=null;x.st69Trail=null;x.st69Still=0;x.ai68Slip=0;x.pitNow=false;}

/* ---------- Crash: safety car, pull aside ---------- */
function crash(L,x,why){
 const W=sc25Engine;if(x.ai62&&typeof ai62Leave==='function')ai62Leave(x);
 const wasOut=!!x.retired;x.retired=false;x.ic59Out=0;calm(x);
 const [lo,hi]=bounds(W,x),lane=clamp(x.lane||0,lo-3,hi+3),side=(lane-lo)<(hi-lane)?-1:1;
 x.cr84={phase:'pull',t:0,side,to:side<0?lo-1.6:hi+1.6,from:lane,dmg:x.bodyDamage||0,at:L.elapsed,out:wasOut};
 x.lane=lane;x.pitStage='cr84';x.ic59Ghost=CR.ghost;x.v=Math.max(0,Math.min(x.v||0,70));
 S.log.push(['crash',x.d.number,+L.elapsed.toFixed(1),Math.round(x.bodyDamage||0),why,!!L.ic59Sc]);
 const msg='Car #'+x.d.number+' has crashed.';
 if(!L.ic59Sc)dcSafety(msg);else radio(msg+' Safety car stays out. The car is pulling off the circuit.');
}
function recover(L,x,dt){
 const W=sc25Engine,c=x.cr84,len=lenM(L);c.t+=dt;x.ic59Ghost=Math.max(x.ic59Ghost||0,1);x.st69Trail=null;x.st69Still=0;
 if(c.phase==='pull'){
  x.v=Math.max(0,(x.v||0)-CR.decel*dt);const d=c.to-x.lane,step=Math.min(Math.abs(d),CR.sideV*dt*Math.min(1,.35+(x.v||0)/12));x.lane+=Math.sign(d)*step;
  x.progress+=x.v*dt/len;const yawOff=x.v>.5?Math.atan2(Math.sign(d)*step/dt,Math.max(1,x.v))*.8:0;place(W,x,yawOff);
  if(x.v<=0&&Math.abs(c.to-x.lane)<.05){c.phase='wait';c.t=0;radio('Car #'+x.d.number+' has stopped off the circuit. Marshals are on their way.');}
  else if(c.t>12){x.lane=c.to;x.v=0;place(W,x);c.phase='wait';c.t=0;}
 }else{x.v=0;place(W,x);if(c.t>=CR.wait)toPits(L,x);}
 x.speed=x.v*3.6;
}
// Lift the car back to the pits: ruled out above 70% damage, otherwise it rejoins through the pit lane.
function toPits(L,x){
 const W=sc25Engine,c=x.cr84;x.cr84=null;x.pitStage=null;calm(x);
 if((x.bodyDamage||0)>CR.out||c.out){x.retired=true;x.garage=true;x.v=x.speed=0;S.log.push(['out',x.d.number,+L.elapsed.toFixed(1),Math.round(x.bodyDamage||0)]);
  radio('Car #'+x.d.number+' has been recovered to the pits. Damage is too heavy ('+Math.round(x.bodyDamage||0)+'%): the car is ruled out of the race.');return;}
 const ps=frac(W.pit.start),before=50/lenM(L);let p=Math.floor(x.progress-ps)+ps-before;if(p>x.progress)p-=1;
 x.progress=Math.max(p,(x.progress||0)-1);x.lane=(W.pit.side||1)*3.5;x.v=22;x.speed=x.v*3.6;place(W,x);
 x.pitNow=true;x.cr84Pit={at:L.elapsed,p:x.progress};x.ic59Ghost=4;x.pitPlan=Object.assign({tyre:L.weather==='Dry'?'Hard':'Wet',fuel:40,aero:x.aero},x.pitPlan||{},{repair:true});
 S.log.push(['pits',x.d.number,+L.elapsed.toFixed(1),Math.round(x.bodyDamage||0)]);
 radio('Car #'+x.d.number+' has been recovered to the pits for repairs.');
}

/* ---------- Detection ---------- */
function watch(L){
 const on=racing(L);
 for(const x of L.entrants){
  const dmg=x.bodyDamage||0,d=dmg-(x.cr84Dmg??dmg);x.cr84Dmg=dmg;
  if(d>0){const h=x.cr84Hit;x.cr84Hit=h&&L.elapsed-h.at<1.2?{at:L.elapsed,sum:h.sum+d,v:Math.max(h.v,x.cr84V||0)}:{at:L.elapsed,sum:d,v:x.cr84V||0};}
  x.cr84V=Math.abs(x.v||0);
  if(!on||x.cr84||human(L,x)||x.finished||x.garage||(x.pitStage&&x.pitStage!=='cr84')||!x.pos)continue;
  if(x.cr84Pit){if(L.elapsed-x.cr84Pit.at<120)continue;x.cr84Pit=null;}
  const h=x.cr84Hit,fresh=h&&L.elapsed-h.at<1.5;
  if(x.retired){if(dmg>=95&&fresh)crash(L,x,'wreck');continue;}
  if(fresh&&h.sum>=CR.hit&&h.v>=CR.hitV)crash(L,x,'hit');
  else if(fresh&&dmg>=CR.total)crash(L,x,'total');
 }
}

/* ---------- Pit repairs: over 50% only back down to 25% ---------- */
function repairs(L){
 for(const x of L.entrants){
  const dmg=x.bodyDamage||0,inPit=!!x.pitStage&&x.pitStage!=='cr84',m=x.cr84Mem;
  if(m&&(inPit||m.pit)&&m.dmg>CR.repairFrom&&dmg<CR.repairTo&&m.dmg-dmg>10){
   x.bodyDamage=CR.repairTo;x.damage=CR.repairTo/100;x.cr84Dmg=CR.repairTo;
   const k=CR.repairTo/m.dmg;x.sc30Dents=(m.dents||[]).map(t=>({...t,strength:(t.strength||0)*k*1.4}));
   if(m.crumple)x.rf41Crumple=m.crumple*k;x.sc30DamageRevision=(x.sc30DamageRevision||0)+1;
   S.log.push(['repair',x.d.number,+L.elapsed.toFixed(1),Math.round(m.dmg)]);
   if(x===L.player)try{dcRadio('Crew chief','That damage was too heavy to fix completely in the box. We have patched it up to 25%. The car is driveable but down on pace.');}catch(_){}
   x.cr84Mem={dmg:CR.repairTo,pit:inPit,dents:x.sc30Dents,crumple:x.rf41Crumple};continue;
  }
  x.cr84Mem={dmg,pit:inPit,dents:x.sc30Dents,crumple:x.rf41Crumple};
 }
}

/* ---------- Fewer accidents ---------- */
// Path cars only (physics cars brake on their own): never close in on a much slower car just ahead in the same lane.
function careful(L,x){
 if(x.ai62||x.pitStage||human(L,x)||!x.pos||L.ic59Sc)return;const W=sc25Engine,len=lenM(L);
 for(const y of L.entrants){if(y===x||y.garage||y.retired||y.finished||y.pitStage||!y.pos||y.ic59Ghost>0)continue;
  const gap=frac(y.progress-x.progress)*len;if(gap<=0||gap>45||Math.abs((y.lane||0)-(x.lane||0))>2.4)continue;
  const dv=(x.v||0)-(y.v||0);if(dv<=4)continue;const cap=Math.sqrt(Math.max(0,(y.v||0)**2+2*9*Math.max(0,gap-7)));
  if(x.v>cap){x.v=cap;x.speed=x.v*3.6;}}
}

/* ---------- Hooks ---------- */
const baseAI=dcAIStep;
dcAIStep=function(x,dt){const L=live;if(L?.dc&&x.cr84)return;const r=baseAI.apply(this,arguments);if(L?.dc&&racing(L))careful(L,x);return r;};
const basePit=dcPitStep;
dcPitStep=function(x){if(x?.cr84&&live?.dc)return;return basePit.apply(this,arguments);};
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){
 const L=live;if(!L?.dc)return basePhysics(dt,input,auto);
 for(const x of L.entrants)if(x.cr84){x.ic59Ghost=Math.max(x.ic59Ghost||0,1);x.st69Trail=null;}
 const r=basePhysics(dt,input,auto);if(live!==L)return r;
 for(const x of L.entrants)if(x.cr84){if(L.stage!=='race'||L.finished){x.cr84=null;x.pitStage=null;continue;}recover(L,x,dt);}
 watch(L);repairs(L);return r;
};
const baseLaunch=dcLaunch;
dcLaunch=function(...args){const r=baseLaunch(...args),L=live;if(L?.dc)for(const x of L.entrants){x.cr84=null;x.cr84Hit=null;x.cr84Dmg=undefined;x.cr84Mem=null;x.cr84Pit=null;if(x.pitStage==='cr84')x.pitStage=null;}return r;};
})();
