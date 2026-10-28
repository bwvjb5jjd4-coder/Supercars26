/* CD66: cool-down lap after the chequered flag.
   - A car that takes the flag no longer stops dead on the line. It keeps driving: AI cars ease off
     to a cool-down pace, steer into pit entry, roll down the lane at 60 and park in their team bay.
   - You (and Player 2 in Co-Op) keep full control. Drive the lap, enter the pit lane, stop in your
     bay, then press A (or Enter, or click) on the End Race prompt to go to the results.
   - The classification is frozen at the flag: nothing on the cool-down lap (contact, penalties,
     fuel, pit lane) can change it. Once the leader has the flag, every other car is flagged the
     next time it crosses the line, lapped cars included (classified a lap down per lap behind).
   - Simulating the rest of the race from the pause menu still ends the race straight away.
   The trick: during each physics step, cars on their cool-down lap are shown to the race code
   as "not finished" so every existing layer (tyre model, AI driver, pit lane, crews, Co-Op)
   drives them as normal, then their flag state and finishing time are put back. */
(()=>{
'use strict';
const CD={guard:false,committing:false,want:false};window.CD66=CD;
const coop=L=>!!(L?.coop&&window.CO63?.race&&window.CO63.pl);
function humans(L){return coop(L)?window.CO63.pl.map(s=>s.x).filter(Boolean):[L.player].filter(Boolean);}
function humanIndex(L,x){return coop(L)?window.CO63.pl.findIndex(s=>s.x===x):0;}
// Cool-down needs a live, human-driven race with at least one human still running.
function enabled(L,auto){return !!(L?.dc&&L.stage==='race'&&L.started&&!L.test&&!auto&&!dcSimBusy&&!L.cd66Off&&humans(L).some(h=>!h.retired));}
const cooling=x=>!!x.cd66;
function freeze(L,x){x.cd66={finishTime:x.finishTime,penalty:x.penalty||0,park:null,still:0,ready:false,done:false,at:L.elapsed};
 x.pitNow=true;x.aiError=0;x.rf40Incident=null;}

/* ---------- Pit bay geometry ---------- */
function bayInfo(x){const W=sc25Engine;if(!W?.pit?.bays||!x.pos)return null;const box=W.pit.bays[x.team.id];if(!box)return null;
 const q=dc32PitNear(W,x.pos),long=(q.f-box.f)*W.pit.length,lat=q.lane*W.pit.side;return{box,q,long,lat};}
function inBay(x){if(!x.pitStage)return false;const b=bayInfo(x);if(!b)return false;
 return Math.abs(b.long)<b.box.halfLength+1.5&&Math.abs(b.lat-8.1)<3.4;}
// Parking slots are the garage-start spots either side of the box centre.
function slotPose(L,x){const W=sc25Engine,box=W.pit.bays[x.team.id],seat=x.team.drivers.indexOf(x.d);let off=seat?3.2:-3.2;
 // If a human is already sitting on that spot, take the other one.
 const mate=L.entrants.find(y=>y!==x&&y.team===x.team&&y.pos&&y.pitStage&&!y.cd66?.park);
 if(mate){const b=bayInfo(mate);if(b&&Math.abs(b.long-off)<3.6)off=-off;}
 const f=box.f+off/W.pit.length,q=dc32PitAt(W,f),lane=W.pit.side*8.1;
 return{x:q.p.x+q.n.x*lane,y:q.p.y+.042,z:q.p.z+q.n.z*lane,yaw:Math.atan2(q.v.x,q.v.z),dist:f*W.pit.length,lane};}
function park(L,x){const c=x.cd66,to=slotPose(L,x);c.park={from:{...x.pos},yaw0:x.yaw,to,t:0};
 if(x.ai62){x.ai62=null;x.ph47On=false;}x.v=x.speed=0;x.latV=0;x.steer=0;x.braking=true;x.dc32Servicing=false;x.pitNow=false;x.pitDistance=to.dist;x.pitLane=to.lane;}
function parkStep(x,dt){const p=x.cd66.park;if(p.t>=1)return;p.t=Math.min(1,p.t+dt/1.8);const e=p.t*p.t*(3-2*p.t),a=p.from,b=p.to;
 x.pos={x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:a.z+(b.z-a.z)*e};x.yaw=p.yaw0+dcWrapAngle(b.yaw-p.yaw0)*e;x.v=x.speed=0;}

/* ---------- Pit service is skipped on the cool-down lap ---------- */
const baseService=dc32Service;
dc32Service=function(x,dt,box){const L=live;if(L?.cd66Q&&x===L.player){x.dc32Servicing=false;return;}if(!L||!cooling(x))return baseService.apply(this,arguments);
 x.dc32Servicing=false;if(x===L.player||humans(L).includes(x))return;
 const b=bayInfo(x);if(b&&Math.abs(b.long)<Math.min(3.5,box.halfLength-1)&&Math.abs(b.lat-8.1)<1.9&&x.v<.45)park(L,x);};

/* ---------- No penalties or lap calls once you have the flag ---------- */
const basePn=window.pn57Ok;
window.pn57Ok=function(){const L=live;if(!CD.committing&&L?.dc&&L.stage==='race'&&humans(L).some(cooling))return false;return basePn?basePn.apply(this,arguments):true;};
const baseRadio=dcRadio;
dcRadio=function(who,text){const L=live;if(CD.guard&&L&&cooling(L.player)&&/^(Lap \d|Final laps|Box this lap|Pit limiter 60|Fuel depleted)/.test(String(text)))return;return baseRadio.apply(this,arguments);};

/* ---------- The race result waits for End Race ---------- */
const baseCommit=dcCommitRace;
dcCommitRace=function(L){if(CD.guard)return;return baseCommit.apply(this,arguments);};
function restore(x){const c=x.cd66;x.finished=true;x.retired=false;x.finishTime=c.finishTime;x.penalty=c.penalty;}
function endRace(L){
 CD.want=false;$id('cd66')?.remove();
 for(const x of L.entrants){if(cooling(x)){restore(x);x.cd66=null;continue;}
  if(!x.finished&&!x.retired){x.finishTime=L.elapsed+Math.max(0,L.laps-x.progress)*L.e.realLap;x.progress=L.laps;x.finished=true;}}
 L.cd66Off=true;CD.committing=true;try{dcCommitRace(L);}finally{CD.committing=false;}}
CD.end=function(i){const L=live;if(!L?.dc||!L.cd66Flag)return;const hs=humans(L);
 const who=i==null?hs:[hs[i]].filter(Boolean);for(const h of who)if(h.cd66?.ready)h.cd66.done=true;
 if(hs.every(h=>h.retired||h.cd66?.done))CD.want=true;paint(L);};
function readyHuman(L){const x=L.player;return x?.cd66?.ready&&!x.cd66.done?x:null;}
// A (the camera button) on the End Race prompt ends the race instead of changing the camera.
const baseAction=dcAction;
dcAction=function(action){const L=live;if(action==='camera'&&L?.dc&&!L.paused&&L.cd66Q?.ready&&!L.cd66Q.done){CD.endQ();return;}if(action==='camera'&&L?.dc&&!L.paused){const x=readyHuman(L);if(x){CD.end(humanIndex(L,x));return;}}return baseAction.apply(this,arguments);};
addEventListener('keydown',e=>{if(e.code!=='Enter'&&e.code!=='NumpadEnter')return;const L=live;if(L?.dc&&!L.paused&&L.cd66Q?.ready&&!L.cd66Q.done){e.preventDefault();CD.endQ();return;}if(!L?.dc||L.paused||!L.cd66Flag)return;
 let i=null;if(coop(L)){i=window.CO63.players.findIndex(p=>p?.dev==='kb');if(i<0)return;}
 const hs=humans(L),x=i==null?hs.find(h=>h.cd66?.ready&&!h.cd66.done):hs[i];if(!x?.cd66?.ready)return;e.preventDefault();CD.end(i==null?humanIndex(L,x):i);},true);

/* ---------- Physics ---------- */
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){
 const L=live;if(L?.dc&&L.cd66Q)return inLap(L,dt,input,auto,arguments);
 if(L?.dc&&L.stage==='shootout'&&L.player?.finished&&!auto&&timedOk(L)){L.cd66Q={best:L.player.best,laps:L.player.timedLaps,ready:false,done:false,want:false};return inLap(L,dt,input,auto,arguments);}
 if(!L?.dc||L.stage!=='race')return basePhysics.apply(this,arguments);
 if(!enabled(L,auto)){
  // Simulating, or no human left running: finish the old way, from the frozen classification.
  if(L.cd66Flag&&!L.cd66Off){L.cd66Off=true;for(const x of L.entrants)if(cooling(x)){restore(x);x.cd66=null;}$id('cd66')?.remove();}
  return basePhysics.apply(this,arguments);}
 if(CD.want){endRace(L);return;}
 const prev=new Map(),flip=[];
 for(const x of L.entrants){prev.set(x,x.progress);
  if(x.finished&&!x.retired&&!x.cd66&&!x.garage){freeze(L,x);
   if(!L.cd66Flag){L.cd66Flag=true;if(L.ic59Sc||L.scTrain){L.ic59Sc=null;L.scTrain=null;L.safety=0;L.safetyLeft=0;}}}
  const c=x.cd66;if(!c)continue;
  if(c.park){parkStep(x,dt);continue;}
  if(x.garage)continue;
  x.finished=false;x.fuel=Math.max(x.fuel||0,4);flip.push(x);
  if(!humans(L).includes(x)){x.pitNow=true;x.aiError=Math.max(x.aiError||0,dt*2);}}
 L.afterFinish=-1e9;
 CD.guard=true;try{basePhysics.apply(this,arguments);}finally{CD.guard=false;
  for(const x of flip){if(!x.cd66)continue;const wasRetired=x.retired;restore(x);if(wasRetired&&!x.garage)x.v=0;x.speed=Math.abs(x.v||0)*3.6;}}
 if(live!==L)return;
 // After the leader's flag, every car is flagged the next time it crosses the line.
 if(L.cd66Flag)for(const x of L.entrants){if(x.finished||x.retired)continue;const was=prev.get(x),k=Math.floor(x.progress);
  if(k>Math.floor(was)&&x.progress>0){x.finished=true;x.finishTime=L.elapsed+Math.max(0,L.laps-k)*L.e.realLap+(x.penalty||0);
   if(humans(L).includes(x))baseRadio('Race engineer','Chequered flag! Bring it back.');}}
 for(const x of flip){const c=x.cd66;if(!c||c.park)continue;
  if(humans(L).includes(x)){c.ready=inBay(x)&&Math.abs(x.v||0)<.9;if(!c.ready)c.done=false;continue;}
  // AI: park in the box, or wherever it stopped close to the box (teammate in the way, overshot).
  if(x.retired||x.garage){continue;}
  if(x.pitStage){const b=bayInfo(x);if(!b)continue;const near=b.long>-26&&b.long<12;c.still=(x.v<.5&&near)?c.still+dt:0;if(c.still>.6||b.long>6||x.pitStage==='out'&&b.long>-4)park(L,x);}}
 if(humans(L).every(h=>h.retired||h.cd66?.done))CD.want=true;
 paint(L);
};

/* ---------- Practice, qualifying and shootout: in-lap back to the pits ---------- */
// When the session ends (time up and you cross the line, or your shootout lap is done) you drive
// back to your bay instead of the session cutting straight to the times. Your times are frozen.
function timedOk(L){return !!(L?.dc&&['practice','qualifying','shootout'].includes(L.stage)&&!L.test&&!coop(L)&&!dcSimBusy&&L.player&&!L.player.retired);}
const baseFinish=dcFinishTimed;
dcFinishTimed=function(simulated){const L=live;
 if(simulated||!timedOk(L)||L.cd66Q?.done)return baseFinish.apply(this,arguments);
 if(!L.cd66Q){const p=L.player;L.cd66Q={best:p.best,laps:p.timedLaps,ready:false,done:false,want:false};
  baseRadio('Race engineer',L.stage==='shootout'?'That is your lap. Cool it down and bring it back to the box.':'Chequered flag, session over. In-lap, bring it back to the box.');}
 return;};
function inLap(L,dt,input,auto,args){const Q=L.cd66Q,p=L.player;
 if(auto||dcSimBusy||Q.done){Q.done=true;$id('cd66')?.remove();return basePhysics.apply(this,args);}
 if(Q.want){Q.done=true;$id('cd66')?.remove();p.best=Q.best;p.timedLaps=Q.laps;dcFinishTimed(false);return;}
 const shoot=L.stage==='shootout',fin=p.finished,v=p.v;if(shoot){p.finished=false;p.outlapHold=false;}
 CD.guard=true;try{basePhysics.apply(this,args);}finally{CD.guard=false;}
 if(live!==L)return;
 p.best=Q.best;p.timedLaps=Q.laps;if(shoot){p.finished=fin;if(p.outlapHold){p.outlapHold=false;p.v=v;}}
 Q.ready=inBay(p)&&Math.abs(p.v||0)<.9;paintQ(L);}
function cardQ(L){const Q=L.cd66Q,p=L.player,best=Number.isFinite(Q.best)?dcLapTime(Q.best):'No time';
 if(Q.ready)return `<div class="cd66-p cd66-solo go"><div class="fl"></div><div class="tx"><b>Session over · ${best}</b><small>Parked in your bay</small></div><button onclick="CD66.endQ()"><i>A</i>End session</button></div>`;
 const b=p.pitStage?bayInfo(p):null;
 if(b)return `<div class="cd66-p cd66-solo"><div class="fl"></div><div class="tx"><b>Pit lane · ${best}</b><small>${b.long<-2?'Your bay is '+Math.round(-b.long)+' m ahead, stop on your marks':b.long>4?'You passed your bay':'Stop in your bay'}</small></div></div>`;
 return `<div class="cd66-p cd66-solo"><div class="fl"></div><div class="tx"><b>In-lap · best ${best}</b><small>Session over. Drive back to pit lane and park in your bay</small></div></div>`;}
function paintQ(L){ensureCss();const host=document.querySelector('.dc-driving');if(!host)return;let el=$id('cd66');if(!el){el=document.createElement('div');el.id='cd66';host.appendChild(el);}const h=cardQ(L);if(el.cd66!==h){el.cd66=h;el.innerHTML=h;}}
CD.endQ=function(){const L=live;if(L?.cd66Q?.ready)L.cd66Q.want=true;};

/* ---------- Prompt ---------- */
const CSS=`#cd66{position:absolute;inset:0;pointer-events:none;z-index:7}
.cd66-p{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:rgba(8,10,14,.86);color:#fff;border-radius:8px;padding:10px 18px 10px 0;box-shadow:0 10px 30px rgba(0,0,0,.45);border-left:6px solid #e10600;font-family:inherit;white-space:nowrap;transition:opacity .25s}
.cd66-p .fl{align-self:stretch;width:46px;margin-left:0;background:repeating-conic-gradient(#fff 0 25%,#111 0 50%) 0 0/14px 14px;border-radius:0 4px 4px 0;opacity:.9}
.cd66-p .tx{display:flex;flex-direction:column;line-height:1.15}
.cd66-p .tx b{font-size:20px;font-weight:900;font-style:italic;letter-spacing:.04em;text-transform:uppercase}
.cd66-p .tx small{font-size:13px;color:#c5ccd6;font-weight:600}
.cd66-p button{pointer-events:auto;display:flex;align-items:center;gap:10px;border:0;border-radius:6px;background:#fff;color:#0b0d11;font:inherit;font-weight:900;font-size:18px;letter-spacing:.06em;padding:8px 16px 8px 8px;cursor:pointer;text-transform:uppercase}
.cd66-p button i{font-style:normal;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#2fb24c;color:#fff;font-size:17px;font-weight:900}
.cd66-p.go{border-left-color:#2fb24c}
.cd66-p.wait{border-left-color:#8a93a0}
.cd66-solo{bottom:23%}
.co63-hud .cd66-p{bottom:26%}`;
function ensureCss(){if($id('cd66-css'))return;const s=document.createElement('style');s.id='cd66-css';s.textContent=CSS;document.head.appendChild(s);}
function position(L,x){const o=[...L.entrants].sort((a,b)=>rf41Classify(a,b,L));return o.indexOf(x)+1;}
function card(L,x,i){const c=x.cd66;if(!c)return'';const pos=position(L,x),who=coop(L)?'P'+(i+1)+' · ':'';
 if(c.done){const left=humans(L).filter(h=>!h.retired&&!h.cd66?.done).map(h=>'Player '+(humanIndex(L,h)+1));return `<div class="cd66-p wait"><div class="fl"></div><div class="tx"><b>${who}Parked</b><small>Waiting for ${left.join(' and ')||'results'}</small></div></div>`;}
 if(c.ready)return `<div class="cd66-p go"><div class="fl"></div><div class="tx"><b>${who}Finished P${pos}</b><small>Parked in your bay</small></div><button onclick="CD66.end(${coop(L)?i:'null'})"><i>A</i>End race</button></div>`;
 const b=x.pitStage?bayInfo(x):null;
 if(b)return `<div class="cd66-p"><div class="fl"></div><div class="tx"><b>${who}Pit lane</b><small>${b.long<-2?'Your bay is '+Math.round(-b.long)+' m ahead, stop on your marks':b.long>4?'You passed your bay':'Stop in your bay'}</small></div></div>`;
 return `<div class="cd66-p"><div class="fl"></div><div class="tx"><b>${who}Cool-down lap · P${pos}</b><small>Drive back to pit lane and park in your bay</small></div></div>`;}
function paint(L){
 const hs=humans(L);if(!hs.some(cooling)){$id('cd66')?.remove();return;}ensureCss();
 if(coop(L)){$id('cd66')?.remove();window.CO63.pl.forEach((s,i)=>{const root=s.hud?.root;if(!root)return;let el=root.querySelector('.cd66-w');if(!el){el=document.createElement('div');el.className='cd66-w';root.appendChild(el);}const h=card(L,s.x,i);if(el.cd66!==h){el.cd66=h;el.innerHTML=h;}});return;}
 const host=document.querySelector('.dc-driving');if(!host)return;let el=$id('cd66');if(!el){el=document.createElement('div');el.id='cd66';host.appendChild(el);}
 const h=card(L,hs[0],0).replace('class="cd66-p','class="cd66-p cd66-solo');if(el.cd66!==h){el.cd66=h;el.innerHTML=h;}}
function $id(id){return document.getElementById(id);}
})();
