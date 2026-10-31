/* fs81: formation lap / start watchdog.
   Riley: "the formation lap and start is not working, the cars don't move, the light sequence does not
   start, the game is just stuck". The five red lights only start once EVERY car has reached its grid
   box (dcSetGrid waits for x.outlapHold || x.retired on all entrants). One car that never gets there
   (held in the pit lane by a release rule, parked in a garage, stuck on a kerb, pushed past its box,
   a resumed save in a half-way state) holds the whole field and the lights forever.
   This layer guarantees the start always happens:
   - Nobody moving: no car above walking pace for 8 s during the formation lap (after the crew
     release) -> every car is put in its grid box and the lights start.
   - Field waiting on stragglers: once you are in your box, the rest get 20 s, then any car still out
     is put in its box.
   - Formation taking far too long (a lap at formation pace plus 90 s) -> everyone into their boxes.
   - You stopped within 25 m short of your box for 2 s -> you count as in the box.
   - Grid phase with no countdown running (old save, NaN countdown) -> lights restart from five.
   Embedded last by tools/build_fs81.py. */
(()=>{
'use strict';
const S={t:0,still:0,heldAt:null,near:0,cd:null,cdStuck:0,lastPhase:null};
window.FS81=S;
function snap(L,W,x){
 if(x.outlapHold||x.retired)return;
 if(!Number.isFinite(x.formationTarget))return;
 x.pitStage=null;x.garage=false;x.progress=x.formationTarget;x.lane=Number.isFinite(x.formationLane)?x.formationLane:0;
 x.v=x.speed=0;x.latV=0;x.outlapHold=true;x.releaseDelay=0;
 try{const q=W.at(x.progress);x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};x.idx=Math.round(q.t*W.N)%W.N;x.yaw=Math.atan2(q.v.x,q.v.z);if(x.ph47)x.ph47.r=0;}catch(_){}
}
function formGrid(L,W,why){
 for(const x of L.entrants){
  if(!x.outlapHold&&!x.retired&&!Number.isFinite(x.formationTarget)){x.retired=false;x.outlapHold=true;}
  snap(L,W,x);}
 try{console.warn('fs81: grid formed by watchdog ('+why+')');}catch(_){}
 try{dcSetGrid();}catch(e){console.warn('fs81 dcSetGrid',e);}
 if(L.phase==='formation'){ // dcSetGrid refused or threw: form it here.
  L.phase='grid';L.started=false;L.countdown=5;L.gridReady=true;
  try{dcRadio('Race engineer','Cars are in their grid boxes. Five red lights.');}catch(_){}
  if(W)W.cameraCut=true;}
 S.t=0;S.still=0;S.heldAt=null;S.near=0;
}
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto){
 const r=basePhysics.apply(this,arguments);
 try{
  const L=live,W=sc25Engine;
  if(!L?.dc||!W||L.stage!=='race'||L.started||dcSimBusy){S.lastPhase=L?.phase;return r;}
  if(L.phase!==S.lastPhase){S.t=0;S.still=0;S.heldAt=null;S.near=0;S.cdStuck=0;S.cd=null;S.lastPhase=L.phase;}
  if(L.phase==='formation'){
   if(L.release>0)return r;
   S.t+=dt;
   const p=L.player,len=L.e.lengthKm*1000;
   // You stopped just short of your box.
   if(p&&!p.outlapHold&&!p.retired&&Number.isFinite(p.formationTarget)){
    const rem=(p.formationTarget-p.progress)*len;
    if(rem>=0&&rem<25&&(p.v||0)<1&&!p.pitStage){S.near+=dt;if(S.near>2){snap(L,W,p);S.near=0;}}else S.near=0;}
   const moving=L.entrants.some(x=>!x.retired&&!x.outlapHold&&(x.v||0)>1.5);
   S.still=moving?0:S.still+dt;
   if(p?.outlapHold){if(S.heldAt==null)S.heldAt=S.t;}else S.heldAt=null;
   const all=L.entrants.every(x=>x.outlapHold||x.retired);
   if(all){try{dcSetGrid();}catch(_){} if(L.phase==='formation')formGrid(L,W,'all in boxes');return r;}
   const maxT=len/25+90;
   if(S.still>8)formGrid(L,W,'nobody moving');
   else if(S.heldAt!=null&&S.t-S.heldAt>20)formGrid(L,W,'stragglers');
   else if(S.t>maxT)formGrid(L,W,'formation too long');
  }else if(L.phase==='grid'){
   if(!L.gridReady||!Number.isFinite(L.countdown)){L.gridReady=true;L.countdown=5;}
   if(S.cd!=null&&L.countdown>=S.cd)S.cdStuck+=dt;else S.cdStuck=0;S.cd=L.countdown;
   if(S.cdStuck>3)S.force=true;
   if(S.force){L.countdown=Math.min(L.countdown,5)-dt;S.cd=L.countdown;S.cdStuck=0;
    if(L.countdown<=0){S.force=false;L.started=true;L.phase='racing';L.elapsed=0;L.entrants.forEach(x=>{x.lapStart=0;x.outlapHold=false;});
     try{dcRadio('Race engineer','Lights out! Go go go!');}catch(_){}}}
  }
 }catch(e){try{console.warn('fs81',e);}catch(_){}}
 return r;
};
})();
