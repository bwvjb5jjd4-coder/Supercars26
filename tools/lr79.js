/* lr79: pit limiter always on in the pit lane + revving on the grid during the start lights.
   1. Pit limiter: whenever the player's car is in the pit lane (up to the exit line), the 60 km/h limiter is
      forced on. RB / L can no longer switch it off there. Coming in too fast, the car brakes itself down to 60
      before the speed line, and ph47 hard-caps it at 60 inside the limited zone, so it can never go faster.
      The limiter switches off by itself past the pit exit line.
   2. Start lights: while the five reds are on, the player's throttle revs the engine (the car stays held on
      the brakes) and every AI car blips and holds revs too, through the au66 engine sound (x.throttle drives
      au66's revs in neutral). The revs you hold in the last half second before lights out set the launch:
      60-85% throttle is a great launch, flat out is wheelspin, no revs bogs down. AI get their own launches. */
(()=>{
'use strict';
const LIM=60/3.6,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const say=(who,t)=>{try{dcRadio(who,t);}catch(_){}};
const near=x=>{try{return x.pitStage&&typeof dc32PitNear==='function'&&sc25Engine?.pit?dc32PitNear(sc25Engine,x.pos):null;}catch(_){return null;}};

/* ---------- 1. Pit limiter always on ---------- */
function forceLimiter(L,x){
 if(!L?.dc||!x||L.dc33Auto)return false;
 if(!x.pitStage){if(L.lr79Pit){L.lr79Pit=false;}return false;}
 const q=near(x);if(q&&q.f>.9)return false;           // past the pit exit line: let pt61 switch it off
 if(!L.pt61)L.pt61={lim:false,visit:null,board:null,boxLap:-1,said:{}};
 if(!L.pt61.lim){L.pt61.lim=true;say('Driver',L.lr79Pit?'Limiter stays on in the pit lane.':'Pit limiter on.');}
 L.lr79Pit=true;return true;
}
const baseManual=dcManualStep,scratch={};
dcManualStep=function(x,dt,input){
 const L=live;
 if(!L?.dc||x!==L.player||!input||!forceLimiter(L,x))return baseManual(x,dt,input);
 // Too fast on entry: brake down to the limit (the speed line is close), never let the throttle push past it.
 Object.assign(scratch,input);const v=x.v||0;
 if(v>LIM+.6){scratch.throttle=0;scratch.brake=Math.max(+scratch.brake||0,cl((v-LIM)/8,.35,1));}
 const r=baseManual(x,dt,scratch);
 const q=near(x);if((x.v||0)>LIM&&(!q||q.f>=.1))x.v=LIM;  // hard cap from the speed line on
 x.speed=Math.hypot(x.v||0,x.latV||0)*3.6;
 return r;
};

/* ---------- 2. Revving on the grid ---------- */
const gridOn=L=>!!(L&&L.stage==='race'&&!L.started&&L.gridReady&&!(L.release>0));
function aiRev(e,R,dt,L){
 let s=R.ai.get(e);if(!s){s={thr:.15,target:.2,next:Math.random()*.6,q:.25+Math.random()*.7,had:Object.prototype.hasOwnProperty.call(e,'throttle'),old:e.throttle};R.ai.set(e,s);}
 s.next-=dt;
 const cd=L.countdown;   // 5 -> 0
 if(cd<1.3){s.target=.6+.25*s.q;}                          // hold launch revs as the last lights come on
 else if(s.next<=0){                                       // blip, blip
  const blip=Math.random()<.55;s.target=blip?.55+Math.random()*.45:.08+Math.random()*.2;s.next=blip?.18+Math.random()*.25:.3+Math.random()*.7;}
 s.thr+=(s.target-s.thr)*Math.min(1,dt*(s.target>s.thr?16:9));
 e.throttle=s.thr;
}
function startGrid(L){
 const R=L.lr79={ai:new Map(),hist:[],q:0,boost:{},done:false,hintShown:false};
 say('Race engineer','Rev it up. Hold the revs around two thirds throttle for the launch.');
 return R;
}
function judge(R){
 const h=R.hist;if(!h.length)return -.4;
 const avg=h.reduce((a,b)=>a+b,0)/h.length,max=Math.max(...h);
 if(avg<.15)return -.45;                     // no revs: bogs down
 if(max>.96&&avg>.9)return .15;              // flat out on the limiter: wheelspin
 if(avg>=.55&&avg<=.88)return 1;            // sweet spot
 if(avg<.55)return cl((avg-.15)/.4,0,1)*.9;
 return cl(1-(avg-.88)/.1,.2,1);
}
const baseGear=dcGear;
dcGear=function(x){const L=live;if(gridOn(L))return'N';return baseGear(x);};

const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto){
 const L=live;
 if(!L?.dc||!(L.stage==='race'))return basePhysics(dt,input,auto);
 const wasGrid=gridOn(L);let R=L.lr79;
 if(wasGrid){
  if(!R||R.done)R=startGrid(L);
  const p=L.player,thr=auto||L.dc33Auto?.55+.2*Math.sin(L.elapsed*9):cl(+input?.throttle||0,0,1);
  if(p){R.pThr=(R.pThr??0)+(thr-(R.pThr??0))*Math.min(1,dt*18);p.throttle=R.pThr;}
  R.hist.push(R.pThr||0);if(R.hist.length>Math.round(.5/Math.max(dt,1e-3)))R.hist.shift();
  for(const e of L.entrants)if(e!==p&&!e.retired)aiRev(e,R,dt,L);
  // Co-Op second player revs with their own throttle when the co63 input is there.
  try{const co=window.CO63;if(co?.race&&L.coop&&co.pl)for(const P of co.pl){if(P.x&&P.x!==p){const t=cl(+P.input?.throttle||0,0,1);P.x.throttle=t;}}}catch(_){}
 }
 const r=basePhysics(dt,input,auto);
 if(wasGrid&&L.started&&R&&!R.done){
  R.done=true;R.q=judge(R);R.t0=L.elapsed;
  // Hand x.throttle back to the physics for AI.
  for(const[e,s]of R.ai){if(!s.had)delete e.throttle;else e.throttle=s.old;R.boost[e.d?.id??e.id]=(s.q-.3)*.9;}
  if(L.player)R.boost.__p=R.q;
  if(!auto&&!L.dc33Auto)say('Race engineer',R.q>=.85?'Mega launch!':R.q>=.5?'Good start.':R.q>0?'Too many revs, wheelspin!':'Bogged down! Get it going!');
 }
 // Launch boost for the first second and a half.
 if(R&&R.done&&L.started&&L.elapsed-R.t0<1.6&&!L.lr79Over){
  const k=1-(L.elapsed-R.t0)/1.6;
  for(const e of L.entrants){if(e.retired||e.pitStage)continue;
   const q=e===L.player?R.boost.__p:R.boost[e.d?.id??e.id];if(q==null)continue;
   if(e===L.player&&!auto&&!L.dc33Auto&&(+input?.throttle||0)<.3)continue;
   const a=(q>=0?2.4*q:3.2*q)*k;   // m/s^2
   e.v=Math.max(0,(e.v||0)+a*dt);}
 }else if(R&&R.done&&L.elapsed-R.t0>=1.6)L.lr79Over=true;
 if(!L.started)L.lr79Over=false;
 paintHud(L,gridOn(L));
 return r;
};

/* ---------- Grid rev HUD ---------- */
let hud=null;
function paintHud(L,on){
 try{
  if(!hud){hud=document.createElement('div');hud.id='lr79-rev';hud.innerHTML='<span>REV FOR LAUNCH</span><div class="bar"><i class="z"></i><i class="f"></i></div><em>Hold 60-85% throttle</em>';document.body.appendChild(hud);
   const s=document.createElement('style');s.textContent='#lr79-rev{position:fixed;left:50%;bottom:16%;transform:translateX(-50%);z-index:60;display:none;flex-direction:column;align-items:center;gap:6px;font:700 13px/1 system-ui,sans-serif;color:#fff;letter-spacing:.12em;text-shadow:0 1px 3px #000;pointer-events:none}#lr79-rev .bar{position:relative;width:260px;height:12px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);border-radius:7px;overflow:hidden}#lr79-rev .z{position:absolute;left:60%;width:25%;top:0;bottom:0;background:rgba(40,220,110,.35)}#lr79-rev .f{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3cf,#ffd23c 70%,#ff3b2f);transition:width 40ms linear}#lr79-rev em{font-style:normal;font-weight:600;font-size:11px;opacity:.8;letter-spacing:.06em}';document.head.appendChild(s);}
  const show=on&&L?.player&&!L.dc33Auto;hud.style.display=show?'flex':'none';
  if(show)hud.querySelector('.f').style.width=Math.round((L.lr79?.pThr||0)*100)+'%';
 }catch(_){}
}
window.LR79={judge,forceLimiter};
})();
