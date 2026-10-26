/* ic59 · Race incidents.
   - The pit button (Xbox B / P) opens an incident MFD: Request pit, Report incident, Tyre choice, Cancel.
     D-pad up/down moves, A selects, B closes (keyboard: P, 1-4, Enter, arrows while open).
   - Report incident: safety car out, you are taken to your pit box, repaired, held until the train
     passes pit exit and lose a lap. At 100% damage it retires the car (DNF).
   - Wrecks never block the track: retired AI cars are recovered almost at once, and an AI car that
     stays stopped on the circuit is put back on a clear line and ghosts through traffic for a moment.
   - Safety car: it waits on the start line, the field queues behind it in race order, then it leads
     at least one lap at a slower pace, pits once the track is clear and racing resumes at the line. */
(()=>{
'use strict';
const SC_PACE=24,FORM_PACE=44,QUEUE_HEAD=8,QUEUE_GAP=12,TYRES=['Soft','Hard','Wet'];
const OPTS=[{k:'pit',t:'Request pit'},{k:'incident',t:'Report incident'},{k:'tyre',t:'Tyre choice'},{k:'cancel',t:'Cancel'}];
const M={open:false,sel:0,el:null,masked:new Set()};
const lenM=L=>L.e.lengthKm*1000,frac=p=>((p%1)+1)%1;
const toLine=(L,x)=>{const f=frac(x.progress);return (f<1e-6?0:1-f)*lenM(L);};
const running=L=>L.entrants.filter(x=>!x.retired&&!x.finished&&!x.garage&&!x.pitStage&&x.pos);
const isAI=(L,x)=>x!==L.player||L.dc33Auto;
function place(x){const W=sc25Engine,q=W.at(x.progress);x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};x.yaw=Math.atan2(q.v.x,q.v.z);x.idx=Math.round(q.t*W.N)%W.N;}
function calm(x){x.dc33ImpactX=x.dc33ImpactZ=x.dc33Angular=x.dc33YawOffset=0;x.latV=0;x.aiError=0;x.rf40Incident=null;x.dc32Pass=undefined;if(x.ph47){x.ph47=null;}}

/* ---------- Safety car ---------- */
function peelFrac(W){const f=frac(W.pit.start);return f>.6?f:.98;}
function deploy(L,msg){
 const lead=running(L).sort((a,b)=>b.progress-a.progress)[0];if(!lead)return;
 const sc=L.ic59Sc={phase:'lineup',line:Math.ceil(lead.progress+1e-6),prog:0,v:0,t0:L.elapsed,laps:0,lapsDone:0};sc.prog=sc.line;
 for(const x of L.entrants){x.ic59Through=!!x.pos&&!x.pitStage&&toLine(L,x)<(x.v||0)**2/16+10;}
 L.scTrain={progress:sc.prog,ic59:true,phase:'lineup'};L.safetyLeft=1;L.safetyStart=1e9;
 dcRadio('Race control','SAFETY CAR. '+(msg||'')+' Safety car waiting on the start line. Form up behind it in order, no overtaking.');
}
const baseSafety=dcSafety;
dcSafety=function(msg){const L=live;if(!L?.dc)return baseSafety(msg);if(L.stage!=='race'||!L.started)return;if(L.ic59Sc){L.ic59Sc.clearAt=null;return;}deploy(L,msg);};
function trackClear(L){return !L.entrants.some(x=>x.retired&&!x.garage&&x!==L.player)&&!(L.ic59Repair&&!L.player.retired);}
function queueSlots(L){const cars=running(L).filter(x=>!x.ic59Through&&!(x===L.player&&L.ic59Repair)).sort((a,b)=>toLine(L,a)-toLine(L,b));const m=new Map();cars.forEach((x,i)=>m.set(x,QUEUE_HEAD+QUEUE_GAP*i));return {cars,m};}
function lineupDone(L,q){
 const tooLong=L.elapsed-L.ic59Sc.t0>lenM(L)/FORM_PACE*1.25+25;if(tooLong)return true;
 if(L.entrants.some(x=>x.ic59Through&&!x.retired&&!x.finished))return false;
 return q.cars.every(x=>{const d=toLine(L,x),s=q.m.get(x);return x===L.player&&!L.dc33Auto?(x.v<2.5&&d<s+60):x.v<.6&&d<s+20;});
}
function reshuffle(L,q){
 const order=[...q.cars].sort((a,b)=>b.progress-a.progress),W=sc25Engine;
 order.forEach((x,i)=>{const line=Math.ceil(x.progress-1e-6),d=QUEUE_HEAD+QUEUE_GAP*i;x.progress=line-d/lenM(L);x.lane=0;x.v=x.speed=0;calm(x);place(x);if(x===L.player){x.rf40Reverse=false;}});
}
function scTick(L,dt){
 const sc=L.ic59Sc;if(!sc)return;const W=sc25Engine;L.safetyStart=1e9;
 if(L.stage!=='race'||L.finished){L.ic59Sc=null;L.scTrain=null;return;}
 if(!L.scTrain)L.scTrain={ic59:true};
 for(const x of L.entrants)if(x.ic59Through&&toLine(L,x)>lenM(L)*.5)x.ic59Through=false;
 if(sc.phase==='lineup'){const q=queueSlots(L);if(lineupDone(L,q)){reshuffle(L,q);sc.phase='lead';sc.start=sc.prog;dcRadio('Race control','Field formed. Safety car moving off. Minimum one lap.');}}
 else if(sc.phase==='lead'){
  const s=W.at(sc.prog),want=Math.min(SC_PACE,Math.max(14,s.speed*.85));sc.v+=clamp(want-sc.v,-6*dt,3.2*dt);const prev=sc.prog;sc.prog+=sc.v/Math.max(5,s.speed)/L.e.realLap*dt;
  const peel=Math.floor(prev)+peelFrac(W);if(prev<peel&&sc.prog>=peel){if(trackClear(L)||sc.prog-sc.start>3.5){sc.phase='in';sc.pitU=0;dcRadio('Race control','Safety car in this lap. Racing resumes from the start line.');}else dcRadio('Race control','Track not yet clear. Safety car stays out another lap.');}
 }else if(sc.phase==='in'){sc.pitU=Math.min(1,sc.pitU+16*dt/W.pit.length);
  const lead=running(L).sort((a,b)=>b.progress-a.progress)[0];if(!lead||lead.progress>=Math.floor(sc.prog)+1){L.ic59Sc=null;L.scTrain=null;L.safety=0;L.safetyLeft=0;for(const x of L.entrants)x.ic59Through=false;L.nextIncident=L.elapsed+120;dcRadio('Race control','GREEN FLAG. Racing resumes.');return;}}
 L.scTrain.progress=sc.prog;L.scTrain.phase=sc.phase==='in'?'returning':'train';L.safetyLeft=sc.phase==='lineup'?1:Math.max(0,1-(sc.prog-(sc.start??sc.prog)));
}
// After each AI step: queue at the line, keep behind the safety car, single file.
function aiCaution(L,x,dt){
 const sc=L.ic59Sc;if(!sc||x.pitStage||x.retired||x.finished)return;const W=sc25Engine;
 if(sc.phase==='lineup'){if(x.ic59Through)return;const q=L.ic59Q||queueSlots(L),slot=q.m.get(x);if(slot===undefined)return;const d=toLine(L,x);
  if(d<slot){x.progress-= (slot-d)/lenM(L);x.v=0;}else x.v=Math.min(x.v,Math.sqrt(2*6*(d-slot)));
  if(d-slot<450)x.lane+=clamp(-x.lane,-1.2*dt,1.2*dt);x.speed=x.v*3.6;place(x);}
 else if(sc.phase==='lead'){const behind=(frac(sc.prog)-frac(x.progress)+1)%1*lenM(L);if(behind<50){const first=!running(L).some(y=>y!==x&&((frac(sc.prog)-frac(y.progress)+1)%1*lenM(L))<behind);if(first){if(behind<14)x.progress-=(14-behind)/lenM(L);x.v=Math.min(x.v,sc.v+(behind-14)*.4);x.speed=x.v*3.6;place(x);}}x.lane+=clamp(-x.lane,-.8*dt,.8*dt);}
}

/* ---------- Report incident ---------- */
function toBox(L,p,loseLap){
 const W=sc25Engine,bay=W.pit.bays[p.team.id],at=dc32PitAt(W,bay.f),ph=W.pit.start+(W.pit.end-W.pit.start)*bay.f;
 let base=Math.floor(p.progress-ph);if(loseLap&&L.ic59Sc)base=Math.min(base,Math.round(L.ic59Sc.line-1-ph));
 calm(p);p.v=p.speed=0;p.rf40Reverse=false;p.steer=0;p.pitStage='manual';p.pitBase=base;p.dc32Serviced=false;p.dc32Servicing=false;p.pitNow=false;
 p.pitDistance=bay.f*W.pit.length;p.pitLane=W.pit.side*8.1;p.lane=p.pitLane;p.progress=base+ph;
 p.pos={x:at.p.x+at.n.x*p.pitLane,y:at.p.y+.042,z:at.p.z+at.n.z*p.pitLane};p.yaw=Math.atan2(at.v.x,at.v.z);p.dc33Previous=null;p.dc33PitCommitted=true;
}
function reportIncident(){
 const L=live,p=L?.player;if(!p||!sc25Engine)return;
 if(p.retired||p.finished){dcRadio('Race engineer','The car is already out.');return;}
 if((p.bodyDamage||0)>=99.5){p.retired=true;p.v=p.speed=0;dcRadio('Race engineer','Damage is terminal. We are retiring the car. That is a DNF.');return;}
 if(p.pitStage){dcRadio('Race engineer','You are already in the pit lane. Stop in the box for repairs.');return;}
 const race=L.stage==='race'&&L.started;
 if(race&&!L.ic59Sc)deploy(L,'Car #'+p.d.number+' has reported an incident.');
 toBox(L,p,race);L.ic59Repair=race?{t0:L.elapsed}:null;L.pitPlan.repair=true;
 dcRadio('Crew chief',race?'We have you in the box. Repairs under way. You will lose a lap; we release you behind the safety car train.':'Car recovered to the garage. Repairs under way.');
}
function holdPlayer(L,p){
 const r=L.ic59Repair;if(!r)return false;const W=sc25Engine;if(p.retired||p.finished){L.ic59Repair=null;return false;}
 if(!p.dc32Serviced)return false;const sc=L.ic59Sc,exitF=frac(W.pit.end);
 const passed=!sc||sc.phase!=='lineup'&&running(L).every(x=>x===p||((frac(x.progress)-exitF+1)%1)<.4);
 if(passed||L.elapsed-r.t0>420){L.ic59Repair=null;dcRadio('Crew chief','Repairs done. Pit exit is open. Go, go, go!');return false;}
 if(!r.told){r.told=true;dcRadio('Crew chief','Work done. Hold there until the safety car train has passed pit exit.');}return true;
}

/* ---------- Wreck clearing ---------- */
function clearWrecks(L,dt){
 const W=sc25Engine,racing=L.stage==='race'&&L.phase==='racing',lineup=L.ic59Sc?.phase==='lineup';
 for(const x of L.entrants){
  if(x.ic59Ghost>0)x.ic59Ghost=Math.max(0,x.ic59Ghost-dt);
  if(x===L.player&&!L.dc33Auto)continue;
  if(x.retired&&!x.garage&&!x.finished){x.ic59Out=(x.ic59Out||0)+dt;if(x.ic59Out>.8){x.garage=true;x.v=x.speed=0;}continue;}
  if(!racing||x.retired||x.finished||x.pitStage||x.outlapHold||(x.releaseDelay||0)>0||lineup&&!x.ic59Through){x.ic59Stuck=0;continue;}
  if((x.v||0)<2.5)x.ic59Stuck=(x.ic59Stuck||0)+dt;else x.ic59Stuck=0;
  if(x.ic59Stuck>1.6){x.ic59Stuck=0;
   if((x.bodyDamage||0)>=70){x.retired=true;x.garage=true;x.v=x.speed=0;dcRadio('Race control','Car #'+x.d.number+' retired and recovered.');continue;}
   calm(x);const lanes=[0,-3,3,-5.5,5.5];x.lane=lanes.find(l=>dc32LaneClear(x,l))??0;x.progress+=4/lenM(L);x.v=Math.max(x.v,L.scTrain?10:16);place(x);x.ic59Ghost=4;x.dc33Previous=null;
  }
 }
}

/* ---------- Hooks ---------- */
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){
 const L=live;if(!L?.dc)return basePhysics(dt,input,auto);
 if(L.scTrain&&!L.scTrain.ic59&&L.stage==='race'&&L.started){L.scTrain=null;deploy(L,'');}
 if(L.ic59Sc)L.safetyStart=1e9;
 L.ic59Q=L.ic59Sc?.phase==='lineup'?queueSlots(L):null;
 const ghosts=L.entrants.filter(x=>x.ic59Ghost>0&&!x.garage);for(const x of ghosts)x.garage=true;
 try{basePhysics(dt,input,auto);}finally{for(const x of ghosts)x.garage=false;}
 if(live!==L)return;
 clearWrecks(L,dt);scTick(L,dt);L.ic59Q=null;
};
const baseAI=dcAIStep;
dcAIStep=function(x,dt){const L0=live,sc=L0?.ic59Sc;if(sc?.phase==='lineup'&&!x.pitStage&&!x.ic59Through&&L0.ic59Q?.m.has(x)&&toLine(L0,x)-L0.ic59Q.m.get(x)>350){const tr=L0.scTrain,ph=L0.phase,ft=x.formationTarget;L0.scTrain=null;L0.phase='formation';x.formationTarget=undefined;try{baseAI(x,dt);}finally{L0.scTrain=tr;L0.phase=ph;x.formationTarget=ft;x.outlapHold=false;}x.v=Math.min(x.v,FORM_PACE);x.speed=x.v*3.6;aiCaution(L0,x,dt);return;}baseAI(x,dt);const L=live;if(L?.dc&&L.ic59Sc)aiCaution(L,x,dt);};
const baseManual=dcManualStep;
dcManualStep=function(x,dt,input){const L=live;if(!L?.dc||x!==L.player)return baseManual(x,dt,input);
 if(holdPlayer(L,x)){const pos={...x.pos},yaw=x.yaw;baseManual(x,dt,{...input,throttle:0,brake:1});x.pos=pos;x.yaw=yaw;x.v=x.speed=0;x.latV=0;return;}
 return baseManual(x,dt,input);};
const baseRender=dcRenderWorld;
dcRenderWorld=function(W,L,dt){baseRender(W,L,dt);const sc=L?.ic59Sc,m=W?.safetyModel;if(!m||!sc)return;
 if(sc.phase==='in'){if(sc.pitU>.45){m.visible=false;return;}const a=dc32PitAt(W,sc.pitU);m.visible=true;m.position.set(a.p.x,a.p.y,a.p.z);m.rotation.y=Math.atan2(a.v.x,a.v.z);}};

/* ---------- MFD ---------- */
const css=document.createElement('style');css.textContent=`
#ic59-mfd{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;width:min(420px,88vw);background:#05080cdd;color:#fff;font-family:'UI Rajdhani','Arial Narrow',sans-serif;border:1px solid #ffffff22;border-radius:6px;overflow:hidden;box-shadow:0 18px 60px #000a;backdrop-filter:blur(8px)}
#ic59-mfd[hidden]{display:none}
#ic59-mfd .hd{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:linear-gradient(100deg,#e10600,#a30d16);font:700 17px 'UI Rajdhani',sans-serif;letter-spacing:.16em}
#ic59-mfd .hd small{font:600 11px 'UI Inter',sans-serif;letter-spacing:.06em;opacity:.9}
#ic59-mfd button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-bottom:1px solid #ffffff14;font:700 19px 'UI Rajdhani',sans-serif;letter-spacing:.06em;cursor:pointer}
#ic59-mfd button:last-child{border:0}
#ic59-mfd button i{font-style:normal;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#ffffff1a;font:800 14px 'UI Inter',sans-serif}
#ic59-mfd button b{margin-left:auto;font:600 14px 'UI Inter',sans-serif;color:#c9d1dc}
#ic59-mfd button.on{background:linear-gradient(90deg,#e1060055,#e1060010);box-shadow:inset 4px 0 #e10600}
#ic59-mfd .ft{padding:7px 14px;font:600 11px 'UI Inter',sans-serif;color:#9aa6b4;letter-spacing:.05em;background:#ffffff08}`;
document.head.appendChild(css);
function detail(k){const L=live,p=L?.player;if(!p)return'';
 if(k==='pit')return p.pitNow?'BOXING · cancel':'Box this lap';
 if(k==='incident')return (p.bodyDamage||0)>=99.5?'Retire (DNF)':L.stage==='race'&&L.started?'SC + pits · lose a lap':'Back to the pits';
 if(k==='tyre')return (L.pitPlan?.tyre||'—')+' ›';return'Close';}
function paint(){if(!M.el)return;M.el.innerHTML=`<div class="hd">RACE MFD<small>${live?.player?.pitNow?'PIT REQUESTED':'B / P CLOSE'}</small></div>${OPTS.map((o,i)=>`<button type="button" data-i="${i}" class="${i===M.sel?'on':''}"><i>${'ABCD'[i]}</i>${o.t}<b>${esc(detail(o.k))}</b></button>`).join('')}<div class="ft">D-pad ▲▼ select · A confirm · B close · keys 1-4</div>`;
 M.el.querySelectorAll('button').forEach(b=>b.onclick=()=>{M.sel=+b.dataset.i;choose();});}
function host(){const h=document.querySelector('.dc-driving')||document.body;if(!M.el||!M.el.isConnected){M.el=document.createElement('div');M.el.id='ic59-mfd';M.el.hidden=true;M.el.setAttribute('role','menu');M.el.setAttribute('aria-label','Race MFD');h.appendChild(M.el);}return M.el;}
function openMfd(){if(!live?.dc||live.paused)return;host();M.open=true;M.sel=0;M.el.hidden=false;paint();maskHeld();}
function closeMfd(){M.open=false;if(M.el)M.el.hidden=true;maskHeld();}
window.ic59MfdOpen=()=>M.open;
function choose(){const k=OPTS[M.sel].k,L=live;if(!L)return;
 if(k==='pit'){closeMfd();baseAction('pit');return;}
 if(k==='incident'){closeMfd();reportIncident();return;}
 if(k==='tyre'){const t=TYRES[(TYRES.indexOf(L.pitPlan.tyre)+1)%TYRES.length];L.pitPlan.tyre=t;dcRadio('Race engineer',t+' tyres ready for the next stop.');paint();return;}
 closeMfd();}
function move(d){M.sel=(M.sel+d+OPTS.length)%OPTS.length;paint();}
const baseAction=dcAction;let keyCam=0;
dcAction=function(action){const L=live;
 if(L?.dc&&action==='pit'){if(L.paused)return;if(M.open)closeMfd();else openMfd();return;}
 if(M.open&&action==='camera'&&performance.now()-keyCam>80){choose();return;}
 if(action==='pause'&&M.open)closeMfd();
 return baseAction(action);};
// While the MFD is open, A and the D-pad belong to it; the drive poll and the HUD MFD see them released.
const rawPads=navigator.getGamepads?.bind(navigator);
function maskHeld(){M.masked=new Set();const pad=getPad();for(const i of [0,12,13,14,15])if(M.open||pad?.buttons[i]?.pressed)M.masked.add(i);}
function getPad(){try{return Array.from(rawPads?.()||[]).find(p=>p?.connected)||null;}catch(_){return null;}}
if(rawPads)try{navigator.getGamepads=function(){const pads=rawPads();if(!M.masked.size)return pads;return Array.from(pads,p=>{if(!p)return p;const off={pressed:false,touched:false,value:0};return{id:p.id,index:p.index,connected:p.connected,mapping:p.mapping,timestamp:p.timestamp,axes:p.axes,vibrationActuator:p.vibrationActuator,hapticActuators:p.hapticActuators,buttons:Array.from(p.buttons,(b,i)=>M.masked.has(i)?off:b)};});};}catch(_){}
let prev={};
setInterval(()=>{const pad=getPad(),L=live;if(M.open&&(!L?.dc||L.paused||!document.contains(M.el)))closeMfd();
 if(!pad){prev={};return;}const b=i=>!!pad.buttons[i]?.pressed,edge=i=>b(i)&&!prev[i];
 if(M.open){if(edge(12))move(-1);if(edge(13))move(1);if(edge(0))choose();if(edge(14)||edge(15)){if(OPTS[M.sel].k==='tyre')choose();}}
 if(!M.open)for(const i of [...M.masked])if(!b(i))M.masked.delete(i);
 for(const i of [0,12,13,14,15])prev[i]=b(i);},32);
window.addEventListener('keydown',e=>{if(e.code==='KeyC')keyCam=performance.now();if(!M.open)return;
 const n={Digit1:0,Digit2:1,Digit3:2,Digit4:3,Numpad1:0,Numpad2:1,Numpad3:2,Numpad4:3}[e.code];
 if(n!==undefined){M.sel=n;choose();}else if(e.code==='ArrowUp')move(-1);else if(e.code==='ArrowDown')move(1);else if(e.code==='Enter')choose();else if(e.code==='Escape'){closeMfd();}else return;
 e.preventDefault();e.stopImmediatePropagation();},true);
setInterval(()=>{if(M.open)paint();},500);
window.IC59={reportIncident,openMfd,closeMfd,choose,move,state:M};
})();
