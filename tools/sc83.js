/* sc83 · Rolling safety car + Simulate on L.
   - The safety car no longer parks on the start line waiting for the field. The moment it is called
     it pulls out at the line (just ahead of the leader if the leader is right there) and rolls off
     at a slow pace. Every car catches up at a brisk caution pace, slots in single file behind the
     car ahead (no overtaking) and the queue forms on the move. Once the leader is on its bumper the
     safety car speeds up to its normal pace; when the whole field is formed (lapped cars shuffled
     into race order) race control says so and the minimum lap starts. ic59 still runs the rest:
     pace, the pit-in lap, green flag at the line.
   - Simulate panel key: S -> L (S is the brake again, nothing else). The keyboard pit limiter moves
     from L to K; the pad keeps RB for the limiter and LS for Simulate. */
(()=>{
'use strict';
const ROLL_V=12,CATCH_V=60,SC_GAP=14,GAP=12,ACC=7,FORMED_GAP=40,FORMED_GAP_PLAYER=90;
const S={log:[]};window.SC83=S;
const lenM=L=>L.e.lengthKm*1000,frac=p=>((p%1)+1)%1;
const behindSC=(L,x)=>((frac(L.ic59Sc.prog)-frac(x.progress)+1)%1)*lenM(L);
const onTrack=L=>L.entrants.filter(x=>!x.retired&&!x.finished&&!x.garage&&!x.pitStage&&x.pos&&!(x===L.player&&L.ic59Repair));
const manual=(L,x)=>x===L.player&&!L.dc33Auto&&!L.ap73;
function place(x){const W=sc25Engine,q=W.at(x.progress);x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};x.yaw=Math.atan2(q.v.x,q.v.z);x.idx=Math.round(q.t*W.N)%W.N;}
const radio=(m)=>{try{dcRadio('Race control',m);}catch(_){}};
const ROLL_MSG='Safety car rolling from the line. Catch up and form a single queue behind it in race order. No overtaking.';
const baseRadio=dcRadio;dcRadio=function(f,m){if(typeof m==='string')m=m.replace('Safety car waiting on the start line. Form up behind it in order, no overtaking.',ROLL_MSG);return baseRadio.call(this,f,m,...[].slice.call(arguments,2));};

// Queue in track order behind the safety car: who is directly ahead of whom.
// A car is queued when it is within FORMED_GAP of a queued car (or the safety car); the rest catch up.
function queue(L){const cars=onTrack(L).map(x=>({x,b:behindSC(L,x)})).sort((a,b)=>a.b-b.b);const ahead=new Map(),queued=new Set();let chain=true;
 cars.forEach((c,i)=>{ahead.set(c.x,i?cars[i-1].x:null);const g=i?c.b-cars[i-1].b:c.b;chain=chain&&g<FORMED_GAP+(i?0:20);if(chain)queued.add(c.x);});return {cars,ahead,queued};}
function gapTo(L,x,a){return a?((frac(a.progress)-frac(x.progress)+1)%1)*lenM(L):behindSC(L,x);}

function start(L){const sc=L.ic59Sc,lead=onTrack(L).sort((a,b)=>b.progress-a.progress)[0];
 sc.phase='lead';sc.sc83={forming:true,t0:L.elapsed};sc.v=ROLL_V;
 for(const x of L.entrants)x.ic59Through=false;
 if(lead){const need=((lead.v||0)**2/(2*ACC)+40)/lenM(L);if(sc.prog-lead.progress<need)sc.prog=lead.progress+need;}
 sc.start=sc.prog;if(L.scTrain){L.scTrain.progress=sc.prog;L.scTrain.phase='train';}
 S.log.push(['deploy',+L.elapsed.toFixed(1),+(sc.prog-(lead?.progress||0)).toFixed(3)]);
}
function formed(L,q){if(!q.cars.length)return true;
 return q.cars.every((c,i)=>{const g=i?c.b-q.cars[i-1].b:c.b;return g<(manual(L,c.x)?FORMED_GAP_PLAYER:FORMED_GAP);});}
// Lapped cars that sit in the queue ahead of cars on a later lap swap slots into race order.
function raceOrder(L,q){const ai=q.cars.filter(c=>!manual(L,c.x));const want=[...ai].sort((a,b)=>b.x.progress-a.x.progress);let moved=0;
 const slots=ai.map(c=>c.b);want.forEach((c,i)=>{if(c===ai[i])return;const f=frac(L.ic59Sc.prog)-slots[i]/lenM(L);let p=Math.floor(c.x.progress)+frac(f);if(p-c.x.progress>.5)p-=1;if(c.x.progress-p>.5)p+=1;c.x.progress=p;c.x.lane=0;c.x.dc33Previous=null;place(c.x);moved++;});
 for(const c of ai)c.x.v=c.x.speed=Math.min(c.x.v||0,L.ic59Sc.v+2),c.x.speed=c.x.v*3.6;return moved;}

function tick(L){const sc=L.ic59Sc;if(!sc?.sc83?.forming)return;
 const q=queue(L),first=q.cars[0];
 // Slow roll until the leader is on the safety car's bumper, then ic59 brings it up to pace.
 if(!first||first.b>120)sc.v=Math.min(sc.v,ROLL_V);
 sc.start=sc.prog;L.safetyLeft=1;
 const tooLong=L.elapsed-sc.sc83.t0>lenM(L)/(CATCH_V-ROLL_V)+60;
 if(formed(L,q)||tooLong){const moved=raceOrder(L,q);sc.sc83.forming=false;sc.sc83.formedAt=sc.prog;
  radio('Field formed behind the safety car. Minimum one lap.');S.log.push(['formed',+L.elapsed.toFixed(1),+(L.elapsed-sc.sc83.t0).toFixed(1),moved,tooLong]);}
}

/* ---------- Hooks ---------- */
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){const L=live;if(!L?.dc)return basePhysics(dt,input,auto);
 if(L.ic59Sc?.phase==='lineup')start(L);
 const sc=L.ic59Sc;S.q=sc?queue(L):null;
 // Keep ic59 from taking the safety car in while the field is still forming, or less than half a lap after.
 const hold=sc&&sc.phase==='lead'&&(sc.sc83?.forming||sc.prog-(sc.sc83?.formedAt??-9)<.5);
 const rad=dcRadio;if(hold)dcRadio=function(f,m){if(/Safety car in this lap|stays out another lap/.test(m||''))return;return rad.apply(this,arguments);};
 try{basePhysics(dt,input,auto);}finally{dcRadio=rad;S.q=null;}
 if(live!==L)return;const s2=L.ic59Sc;
 if(hold&&s2===sc&&sc.phase==='in'){sc.phase='lead';sc.pitU=0;}
 if(s2?.phase==='lineup')start(L);
 if(L.ic59Sc)tick(L);
};
const baseAI=dcAIStep;
dcAIStep=function(x,dt){const L=live,sc=L?.ic59Sc;
 if(!L?.dc||!sc?.sc83||sc.phase!=='lead'||x.pitStage||x.retired||x.finished||x.garage){return baseAI(x,dt);}
 const q=S.q||queue(L);if(!q.ahead.has(x))return baseAI(x,dt);
 const a=q.ahead.get(x),g0=gapTo(L,x,a);
 if(!q.queued.has(x)&&g0>GAP+4){// not yet in the queue: catch up at a brisk caution pace (the game caps AI to 26 m/s under the safety car)
  const tr=L.scTrain;L.scTrain=null;try{baseAI(x,dt);}finally{L.scTrain=tr;}x.v=Math.min(x.v,CATCH_V);}
 else baseAI(x,dt);
 // Never closer than the queue gap to the car (or safety car) ahead: brake on a smooth curve, no passing.
 const g=gapTo(L,x,a),want=a?GAP:SC_GAP,va=a?(a.v||0):sc.v;
 if(g<want*.6&&g<lenM(L)*.5){x.progress-=(want*.6-g)/lenM(L);place(x);}
 const cap=Math.sqrt(Math.max(0,va*va+2*ACC*Math.max(0,g-want)));
 // Catching up: other layers still slow cars under the safety car, so hold a floor at a caution pace
 // (88% of the racing speed for this part of the track, never above CATCH_V).
 if(!q.queued.has(x)&&!manual(L,x)){const s=sc25Engine.at(x.progress);x.v=Math.max(x.v,Math.min(CATCH_V,(s.speed||30)*.88,cap,(x.v||0)+6*dt));}
 x.v=Math.min(x.v,cap);
 if(g<120)x.lane+=Math.max(-1*dt,Math.min(1*dt,-x.lane));
 x.speed=x.v*3.6;
};

/* ---------- Simulate on L, limiter on K ---------- */
// ap73 listens on document; the limiter listens on window. Stop L reaching window, re-send K as L there.
const typing=e=>/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||'');
document.addEventListener('keydown',e=>{if(e.code==='KeyL'&&!e.sc83)e.stopPropagation();});
document.addEventListener('keydown',e=>{if(e.code!=='KeyK'||e.repeat||typing(e))return;try{window.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{code:'KeyL',key:'l'}),{sc83:true}));}catch(_){}});
})();
