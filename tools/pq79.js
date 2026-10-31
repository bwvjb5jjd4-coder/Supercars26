/* PQ79 · AI cars never get stuck in the pit lane (every circuit).
   What was found (headless test races, Taupo first, then every circuit):
   - Race start: AI cars leave their garages one at a time, and each car's own start delay only
     began counting once the car in front of it had driven 24 m past its box. The delays stacked
     up, so with a full grid the last car sat in its garage for about 3.5 minutes while the rest
     of the field waited on the grid.
   - Pit stops: after service the lollipop held an AI car while any moving car was within 48 m
     behind it in the lane. When lots of cars box together (safety car, end of the pit window,
     double stacks) there is always a car coming, so cars sat in their boxes for 30 to 40 s and
     their teammates queued behind them. The same thing happened again when a released car tried
     to merge into the fast lane: it waited for a gap of over 20 m, which a stream never leaves.
   Fixes:
   - Start: a car's start delay counts down while it waits, and it can go as soon as the car ahead
     of it in the queue has driven past its box, so the grid streams out of the lane in order.
   - Lollipop: after the crew is clear the AI waits up to 2.5 s for a clean gap, then goes into
     the first gap that is safe for the car coming (it can stop behind the car pulling out).
   - Merge: the same rule when joining the fast lane. If the lane never clears (the whole field
     boxing behind the safety car), the next car coming down the lane gives way and stops about
     10 m short, so the waiting car can pull out.
   - Double stacks: the second car now waits inside the back of its own box (7.5 m behind the
     marks) instead of 12 m back in the next team's box, where it blocked that team's car pulling
     out. A car pulling out also no longer treats cars parked in the boxes ahead as traffic.
   - Watchdog: an AI car in the pit lane that has been crawling (under 1.5 m/s) for 8 s, and is not
     being serviced, held by the lollipop, queued behind its teammate's stop, waiting to start or
     held for the formation, rolls on through for 3 s as a ghost (it cannot shove other cars). That clears two
     cars that were each waiting for the other. Nothing is skipped: cars still get their stop. */
(()=>{
'use strict';
const PQ={holdMax:2.5,mergeMax:2.5,still:8,gapMin:7,ahead:6,log:[]};
window.PQ79=PQ;
const human=(L,x)=>x===L.player&&!L.dc33Auto||!!(window.CO63?.race&&window.CO63.pl?.[1]?.x===x);
const note=(L,x,what)=>{if(PQ.log.length<400)PQ.log.push([+(L.elapsed||0).toFixed(1),x.d?.number,what,Math.round(x.pitDistance||0)]);};

// Is there room for x to pull into the fast lane now? Only cars in the fast lane matter. A car
// behind needs room to stop (or to pass if x is still in its box), a car alongside or just ahead
// must have moved on.
function gapOK(x){
 const L=live,my=x.pitDistance||0;
 for(const y of L.entrants){
  if(y===x||!y.pitStage||y.garage||!y.pos||y.retired)continue;
  if(Math.abs(y.pitLane||0)>3.6||y.dc32Servicing)continue;
  const d=my-(y.pitDistance||0),v=Math.max(0,y.v||0);
  if(d>=0&&d<PQ.gapMin+v*v/(2*7.5))return false; // coming from behind: room to stop
  if(d<0&&-d<PQ.ahead&&v<6)return false;          // alongside or just ahead, slow
 }
 return true;
}
PQ.gapOK=gapOK;

// Called from the base pit step when the merge would wait for traffic.
PQ.merge=function(x,dt){
 const L=live;if(!L||human(L,x))return false;if(x.pq79Push>0)return true;
 const now=L.elapsed||0;if(!(now-(x.pq79MergeAt??-9)<.3))x.pq79MergeT=0;x.pq79MergeAt=now;
 x.pq79MergeT=(x.pq79MergeT||0)+(dt||0);
 if(x.pq79MergeT<PQ.mergeMax)return false;
 if(!gapOK(x)){x.pq79WantAt=now;return false;}
 if(!x.pq79MergeSaid){x.pq79MergeSaid=true;note(L,x,'merge');}
 return true;
};

/* ---------- Race start: the queue out of the lane ---------- */
let stepDt=0;
dc32HoldRelease=function(x){
 const L=live;if(L?.phase!=='formation'||x.dc32Released||!x.pitStage)return false;
 const i=L.entrants.indexOf(x),prior=L.entrants[i-1];
 const wait=prior&&!prior.retired&&!prior.finished&&prior.pitStage&&(!prior.dc32Released||(prior.pitDistance||0)<(x.pitDistance||0)+3);
 if(wait){if((x.releaseDelay||0)>0)x.releaseDelay=Math.max(0,x.releaseDelay-stepDt);return true;}
 x.dc32Released=true;return false;
};

/* ---------- Pit stops ---------- */
const basePitStep=dcPitStep;
dcPitStep=function(x,dt,input){
 const L=live;stepDt=dt||0;
 if(!L?.dc||human(L,x)||!x.pitStage)return basePitStep.apply(this,arguments);
 // Lollipop: once the crew is clear, wait a short while for a clean gap, then take a safe one.
 const s=x.pt61Svc;
 if(x.dc32Serviced&&x.pt61Mark&&!x.pt61Released&&s?.done&&x.pt61AiHold){
  const held=(L.elapsed||0)-(s.doneAt||0)-2.3;
  if(held>PQ.holdMax){if(gapOK(x)){x.pt61Released=true;x.pt61AiHold=false;x.pt61GoAt=L.elapsed;note(L,x,'lollipop');}else x.pq79WantAt=L.elapsed;}
 }
 const r=basePitStep.apply(this,arguments);
 watchdog(L,x,dt);
 return r;
};

function watchdog(L,x,dt){
 const calm=()=>{x.pq79Slow=0;};
 if(!x.pitStage||!x.pos||x.dc32Servicing||x.outlapHold||(x.releaseDelay||0)>0)return calm();
 if(L.phase==='formation'&&!x.dc32Released)return calm();
 // Real waits, not a jam: the crew clearing away and the lollipop's short wait for a gap, and the
 // second car of a double stack while its teammate is on the marks.
 const s=x.pt61Svc;if(s?.done&&!x.pt61Released&&(L.elapsed||0)-(s.doneAt||0)<2.3+PQ.holdMax)return calm();
 if(x.pitStage==='entry'&&!x.dc32Serviced&&L.entrants.some(y=>y!==x&&y.team.id===x.team.id&&y.dc32Servicing))return calm();
 if(x.pq79Push>0)return;
 // Slow time builds up while the car is barely moving and drains away once it is rolling, so a car
 // creeping a few centimetres at a time still counts as stuck.
 x.pq79Slow=Math.max(0,(x.pq79Slow||0)+((x.v||0)<1.5?dt:-2*dt));
 if(x.pq79Slow<PQ.still)return;
 // Two cars crossing (one pulling out, one turning in) or a lane full of cars waiting on each other.
 // The stuck one rolls on through as a ghost for a moment and the jam clears.
 x.pq79Slow=0;x.pq79Push=3;if(x.dc32Serviced){x.pt61Released=true;x.pt61AiHold=false;}note(L,x,'roll');
}

// A car pulling out of its box drives past cars parked in the boxes ahead of it (on their marks or
// queued behind a teammate), so those do not count as traffic for it once it is heading out.
const baseTraffic=dc32Traffic,hidden=[];
dc32Traffic=function(x,lane,pit){
 const L=live;let r;
 if(pit&&L&&x.dc32Serviced&&x.pitStage&&!human(L,x)){
  const me=Math.abs(x.pitLane||0),at=x.pitDistance||0;
  for(const y of L.entrants){if(y===x||y.garage||!y.pitStage||!y.pos||(y.v||0)>1)continue;
   const yl=Math.abs(y.pitLane||0);if(yl>6.2&&me<yl-1&&(y.pitDistance||0)-at>6){y.garage=true;hidden.push(y);}}
 }
 try{r=baseTraffic.apply(this,arguments);}finally{while(hidden.length)hidden.pop().garage=false;}
 // Give way: a car in the fast lane eases off for a car that has been waiting to pull out ahead of
 // it, stopping about 10 m short, so a gap always opens even when the whole field is in the lane.
 if(pit&&L&&Math.abs(x.pitLane||0)<3.6){const now=L.elapsed||0,at=x.pitDistance||0;
  for(const y of L.entrants){if(y===x||!y.pitStage||!(now-(y.pq79WantAt??-9)<.3))continue;
   const d=(y.pitDistance||0)-at;if(d>12&&d<45){const v=Math.sqrt(2*6*Math.max(0,d-10));if(v<r.target){r.target=v;r.front=y;r.gap=d;}}}}
 if(pit&&x.pq79Push>0){x.pq79Push=Math.max(0,x.pq79Push-stepDt);if(r.target<6)r.target=6;}
 return r;
};

// While it rolls through, the car is a ghost to the other pit lane cars, so it slides past instead
// of shoving a parked car sideways into its garage.
const baseCollisions=dcCollisions;
dcCollisions=function(dt){
 const L=live;const ghosts=L?.entrants?.filter(x=>x.pq79Push>0&&x.pitStage&&!x.garage)||[];
 for(const x of ghosts)x.garage=true;
 try{return baseCollisions.apply(this,arguments);}finally{for(const x of ghosts)x.garage=false;}
};

if(typeof DC_SNAPSHOT_KEYS!=='undefined')DC_SNAPSHOT_KEYS.push('pq79Push');
})();
