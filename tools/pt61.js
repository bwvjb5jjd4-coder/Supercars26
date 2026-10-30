/* pt61 · Realistic pit stops and Bathurst co-drivers.
   - Pit limiter: Xbox RB / L key. It is no longer automatic. Cross the 60 km/h line above 61 km/h in a race
     and race control hands out a time penalty. It switches itself off once you rejoin the circuit.
   - Solid white pit entry and exit lines: cutting into the lane late or leaving it early is a penalty.
   - Hit your marks: a lollipop man waves you in, the HUD shows the distance to your box, and stopping off
     the marks costs time while the crew drags the car back.
   - Animated crew (two instanced meshes, matrices only, no per-frame allocations): wheel guns, front and
     rear jacks lift the car, fuel man with a dump can, extinguisher man, lollipop man.
   - Rules: fuel first with the car on the ground (minimum fuel drop time), then jack up and all four tyres.
     A stop only counts as the compulsory tyre stop when all four tyres are changed.
   - Lollipop release: red until the work is done and the lane behind is clear. Leaving on red into
     traffic is an unsafe release penalty.
   - Pit wall radio through ui58 banners: box box, limiter warnings, traffic, stop and lane times, rivals.
   - Bathurst: every car has a co-driver (24 extra drivers). Order a swap on the race MFD. The co-driver
     must complete 20% of the race laps (rounded up), the timing tower dot is lit while they drive,
     and AI teams swap too. */
(()=>{
'use strict';
const CLEAR=2.3,LIMIT=60,FLOW=4.2,TOL=61.2,MAXB=440,MAXC=140,MAXL=380,MAXS=520,MAXCARS=4;
const T=THREE;
/* ---------- Co-drivers (team id → [seat 0, seat 1]) ---------- */
const CO_NAMES={
 0:[['Craig Lowndes',84,52],['Jamie Whincup',86,43]],1:[['Lee Holdsworth',80,43],['Zak Best',74,24]],
 2:[['Mark Winterbottom',82,45],['Jett Johnson',70,21]],3:[['Garth Tander',84,49],['Russell Ingall',76,62]],
 4:[['Fabian Coulthard',80,44],['Will Davison',83,44]],5:[['Scott Pye',79,36],['Brad Vaughan',71,22]],
 6:[['Tim Slade',80,40],['Nick Percat',80,38]],7:[['James Courtney',80,46],['Aaron Love',72,23]],
 8:[['Greg Murphy',77,54],['Tyler Everingham',70,25]],9:[['Rick Kelly',77,43],['Nash Morris',71,24]],
 10:[['Kody Garland',70,25],['Ben Bargwanna',71,24]],11:[['Jack Perkins',75,40],['Lachlan Dalton',69,22]]};
function coDriver(x){const r=CO_NAMES[x.team?.id]?.[Math.max(0,x.team.drivers.indexOf(x.d))];if(!r)return null;return x.pt61CoD||(x.pt61CoD={id:'co-'+x.d.id,name:r[0],ovr:r[1],age:r[2],number:x.d.number});}
const surname=n=>String(n||'').trim().split(/\s+/).at(-1);
const isBathurstRace=L=>!!L?.dc&&L.stage==='race'&&L.e?.key==='bathurst';
const coReq=L=>Math.ceil(.2*(L.laps||0));
const racing=L=>L?.stage==='race'&&L.started&&L.phase==='racing';
const lenM=L=>L.e.lengthKm*1000;
window.PT61_CODRIVERS=CO_NAMES;

/* ---------- Plans and estimates ---------- */
function planOf(x){const L=live;return x===L.player?L.pitPlan:(x.pitPlan||={tyre:L.weather==='Dry'?'Hard':'Wet',fuel:75,aero:x.aero,repair:true});}
function fuelNeed(x){const L=live;if(!L||!x||L.stage!=='race')return NaN;const left=Math.max(0,(L.laps||0)-Math.max(0,x.progress));return Math.max(0,Math.ceil((left*lenM(L)*(.00073+(x.aero||0)/100*.00013)+2.5-(x.fuel||0))/5)*5);}
function laneLoss(L){const W=sc25Engine;if(!W?.pit)return 0;const avg=lenM(L)/Math.max(30,L.e.realLap||90);return W.pit.length/(LIMIT/3.6)-W.pit.length/avg+4;}
function swapAllowed(x){const L=live;return isBathurstRace(L)&&!!coDriver(x);}
function estimate(x,plan,marks){
 const L=live;if(!x||!L)return null;plan=plan||planOf(x);const human=x===L.player&&!L.dc33Auto;
 let litres=clamp(+plan.fuel||0,0,Math.max(0,110-(x.fuel||0)));
 if(!human&&L.stage==='race'&&Number.isFinite(fuelNeed(x)))litres=Math.min(litres,Math.max(fuelNeed(x),window.PL74?.minLitres?.(x)||0));
 const tyres=!!plan.tyre&&plan.tyre!=='None',endurance=['bathurst','sandown'].includes(L.e?.key),minDrop=endurance?8:5;
 const tFuel=litres>0?Math.max(minDrop,litres/FLOW):0,tTyre=tyres?(human?3.4:3.1+Math.abs(Math.sin((x.seed||1)*7.3))*.7):0;
 const d=x.bodyDamage||0,tRep=plan.repair!==false&&d>.5?(d>60?10+(d-60)/40*5:1.5+d/60*4.5):0;
 const swap=!!plan.swap&&swapAllowed(x),tSwap=swap?7:0;
 let extra=0;if(marks){const o=Math.max(0,Math.abs(marks.long)-.9),l=Math.max(0,Math.abs(marks.lat)-.8);if(o>0||l>0)extra=Math.min(6,1+o*.6+l*.8);}
 const work=Math.max(tFuel+tTyre,tRep,tSwap),total=Math.max(2.2,work)+extra;
 const order=[swap?'SWAP':'',litres>0?'FUEL':'',tyres?'TYRES':'',tRep?'REPAIR':''].filter(Boolean).join(' › ')||'CHECK';
 return{litres,tFuel,tTyre,tRep,tSwap,extra,total,lane:laneLoss(L)+total,order,tyres,repair:tRep>0,swap,minDrop};
}

/* ---------- Radio ---------- */
function say(from,msg,banner){dcRadio(from,msg);if(banner)try{window.UI58?.banner?.('pt61 '+(banner.cls||''),banner.tag||'PIT WALL',banner.text||msg,banner.value||'',banner.ms||4200);}catch(_){}}
// kind 'DT' / 'SG': pl74 makes it a drive-through or stop-go served in the lane.
function penalise(x,sec,msg,kind){const L=live;if(!racing(L))return false;if(kind&&window.PL74)return window.PL74.issue(x,kind,msg,false);if(window.pn57Ok?.()===false)return false;x.penalty=(x.penalty||0)+sec;dcRadio('Race control',msg+' '+sec+' second time penalty for car #'+x.d.number+'.');return true;}

/* ---------- Service (replaces rf41's version, same effects) ---------- */
dc32Service=function(x,dt,box){
 const L=live,W=sc25Engine,player=x===L.player,human=player&&!L.dc33Auto,plan=planOf(x),q=dc32PitNear(W,x.pos),long=(q.f-box.f)*W.pit.length,lat=q.lane*W.pit.side-8.1,half=box.halfLength-1;
 const inside=long>-Math.min(3.5,half)&&long<Math.min(human?7.5:3.5,half)&&Math.abs(lat)<(human?2.6:1.9);
 if(inside&&Math.abs(x.v)<.45&&!x.dc32Serviced){
  if(L.entrants.some(y=>y!==x&&y.dc32Servicing&&y.team.id===x.team.id))return;
  if(!x.dc32Servicing){
   x.dc32Servicing=true;x.rf41ServiceInitialDamage=x.bodyDamage;const e=estimate(x,plan,human?{long,lat}:null);
   // Crew mistakes (both the player's crew and AI crews) are rolled by pl74 once the stop starts.
   x.pt61Svc={t0:L.elapsed,litres:e.litres,tFuel:e.tFuel,tTyre:e.tTyre,tRep:e.tRep,tSwap:e.tSwap,extra:e.extra,total:e.total,tyres:e.tyres,repair:e.repair,swap:e.swap,done:false,doneAt:0};
   x.rf41ServiceDuration=x.pitClock=e.total;x.pt61Lift=0;
   if(human){const m=e.extra?`Off the marks by ${Math.abs(long).toFixed(1)} metres, crew dragging you back. `:'Good stop on the marks. ';
    say('Crew chief',m+`Brakes on. ${e.order.toLowerCase().replace(/ › /g,', ')}, ${e.total.toFixed(1)} seconds.`,{tag:'PIT STOP',text:e.order,value:e.total.toFixed(1)+' s',ms:3600});}
  }
  x.v=x.speed=0;x.pitClock=Math.max(0,x.pitClock-dt);if(x.pitClock<1e-6)x.pitClock=0;x.rf41ServiceProgress=1-x.pitClock/x.rf41ServiceDuration;
  const s=x.pt61Svc;if(s){const t=L.elapsed-s.t0-s.extra-s.tFuel;x.pt61Lift=s.tTyre&&t>0&&t<s.tTyre?.075*Math.min(1,t/.3,(s.tTyre-t)/.3):0;}
  if(x.pitClock<=0)finishService(x,plan,L);
 }else if(x.dc32Servicing){x.dc32Servicing=false;x.pitClock=0;x.rf41ServiceProgress=0;x.pt61Svc=null;x.pt61Lift=0;}
};
function finishService(x,plan,L){
 const s=x.pt61Svc||{litres:+plan.fuel||0,tyres:plan.tyre!=='None',repair:plan.repair!==false,swap:false},player=x===L.player,human=player&&!L.dc33Auto;
 x.fuel=Math.min(110,(x.fuel||0)+s.litres);if(s.tyres){x.tyre=plan.tyre;x.rdWear=0;x.tyreTemp=55;}x.aero=plan.aero??x.aero;x.pits++;
 if(racing(L)){rf41InitStop(x,L);if(s.tyres)x.rf41ValidStops++;else if(player)say('Race engineer','No tyres fitted, so that stop does not count as the compulsory tyre stop.');}
 if(s.repair){x.bodyDamage=x.damage=0;x.sc30BonnetLost=false;x.sc30Dents=[];x.rf41Crumple=0;x.rf41Wheel=null;x.rf41FrontLost=x.rf41RearLost=x.rf41BonnetDetached=false;x.sc30DamageRevision++;}
 if(s.swap){x.pt61Co=!x.pt61Co;const co=coDriver(x);if(player){L.pitPlan.swap=false;
   if(x.pt61Co)say('Crew chief',`${co.name} is in and belted up. He drives this stint and needs ${coReq(L)} laps. Order a swap on the MFD to get back in.`,{cls:'co',tag:'DRIVER CHANGE',text:co.name+' in',value:'#'+x.d.number});
   else say('Crew chief',`You are back in the car. ${co.name} did ${x.pt61CoLaps||0} laps.`,{cls:'co',tag:'DRIVER CHANGE',text:x.d.name+' in',value:'#'+x.d.number});}
  else if(x.pitPlan)x.pitPlan.swap=false;}
 x.dc32Serviced=true;x.dc32Servicing=false;x.pitNow=false;x.warnFuel=x.warnWear=x.warnDamage=false;x.pt61Lift=0;
 if(x.pt61Svc){x.pt61Svc.done=true;x.pt61Svc.doneAt=L.elapsed;}x.pt61Mark={x:x.pos.x,z:x.pos.z};x.pt61Released=false;
 if(human)L.pt61.stopTime=L.elapsed-(x.pt61Svc?.t0??L.elapsed);
}

/* ---------- Limiter ---------- */
const st=()=>live?.pt61||(live&&(live.pt61={lim:false,visit:null,board:null,boxLap:-1,said:{}}));
function toggleLimiter(force){const L=live;if(!L?.dc||L.paused||L.dc33Auto)return;const S=st();S.lim=force===undefined?!S.lim:force;
 say('Driver',S.lim?'Pit limiter on.':'Pit limiter off.');paintHud(true);}
const baseNear=dcNearestPose;
dcNearestPose=function(x){const q=baseNear(x),L=live;if(q?.pit&&q.pitLimited&&L?.dc&&x===L.player&&!L.dc33Auto&&!L.pt61?.lim)q.pitLimited=false;return q;};
const scratch={};
const baseManual=dcManualStep;
dcManualStep=function(x,dt,input){const L=live;if(!L?.dc||x!==L.player||L.dc33Auto||!input)return baseManual(x,dt,input);
 if(x.pitStage&&x.dc32Serviced&&!x.pt61Released&&crewClearing(x)){Object.assign(scratch,input);scratch.throttle=0;scratch.brake=1;scratch.steer=0;baseManual(x,dt,scratch);x.v=x.speed=0;return;}
 if(!L.pt61?.lim)return baseManual(x,dt,input);
 const lim=LIMIT/3.6;Object.assign(scratch,input);if(x.v>lim+.15)scratch.throttle=0;else if(x.v>lim-.5)scratch.throttle=Math.min(scratch.throttle||0,.3);
 baseManual(x,dt,scratch);if(x.v>lim&&x.v<lim+1.2){x.v=lim;x.speed=Math.hypot(x.v,x.latV||0)*3.6;}};

/* ---------- Per-step rules ---------- */
// The crew step back to the wall after the work; the car stays on the brakes until they are clear.
function crewClearing(x){const s=x.pt61Svc;return !!s?.done&&live.elapsed-s.doneAt<CLEAR;}
function laneTraffic(x){const L=live,my=x.pitDistance||0;for(const y of L.entrants){if(y===x||!y.pitStage||y.garage||!y.pos||(y.v||0)<2||y.dc32Servicing)continue;if(Math.abs(y.pitLane||0)>3.6)continue;const d=my-(y.pitDistance||0);if(d>-4&&d<48)return y;}return null;}
function playerRules(L,dt){
 const W=sc25Engine,x=L.player,S=st();if(!x||!W?.pit||x.retired||x.finished)return;
 const auto=L.dc33Auto,stage=x.pitStage,q=stage?dc32PitNear(W,x.pos):null,kmh=(x.v||0)*3.6,moved=S.lastPos?Math.hypot(x.pos.x-S.lastPos.x,x.pos.z-S.lastPos.z):0;
 if(stage&&!S.wasStage&&!auto){const tele=moved>15||L.ic59Repair;S.visit={t0:L.elapsed,f0:q.f,tele,speeding:0,penalised:false,warned:false,serviced:false};
  if(!tele&&q.f>.22&&q.f<.5&&penalise(x,5,'Crossed the solid pit entry line.'))S.visit.penalised=true;}
 if(stage&&S.visit){const v=S.visit;v.lastF=q.f;if(x.dc32Serviced)v.serviced=true;
  if(!auto&&!S.lim&&!v.warned&&x.dc33PitCommitted&&q.f<.12&&kmh>72){v.warned=true;say('Race engineer','Limiter! Limiter! Speed line coming up.',{cls:'warn',tag:'PIT LIMITER',text:'Press RB / L now',ms:2600});}
  if(!auto&&x.dc33PitCommitted&&q.f>=.12&&q.f<=.86&&kmh>TOL){v.speeding+=dt;v.top=Math.max(v.top||0,kmh);}else v.speeding=0;
  if(v.speeding>.25&&!v.speedPen){v.speedPen=true;const over=v.top-LIMIT;if(!penalise(x,over>10?10:5,`Pit lane speeding, ${Math.round(v.top)} km/h.`,over>10?'SG':'DT')&&!racing(L))say('Race control',`Pit lane speeding, ${Math.round(v.top)} km/h. Use the limiter (RB / L).`);}
 }
 if(!stage&&S.wasStage){const v=S.visit;S.visit=null;
  if(v&&!auto&&!v.tele&&v.lastF>.6&&v.lastF<.86&&moved<15)penalise(x,5,'Crossed the solid pit exit line.');
  if(S.lim){S.lim=false;if(!auto)say('Race engineer','Pit exit. Limiter off, push.');}
  if(v?.serviced&&racing(L)){const order=dc32Order(L),i=order.indexOf(x),ahead=order[i-1],gap=ahead&&!ahead.retired?Math.max(0,(ahead.progress-x.progress)*L.e.realLap):0;
   say('Race engineer',`Stationary ${(S.stopTime||0).toFixed(1)}, pit lane ${(L.elapsed-v.t0).toFixed(1)} seconds. You rejoin P${i+1}${ahead?`, ${gap.toFixed(1)} behind ${surname(ahead.d.name)}`:''}.`,{tag:'PIT STOP',text:`Rejoin P${i+1}`,value:(S.stopTime||0).toFixed(1)+' s stationary',ms:5000});}}
 // Lollipop and release.
 S.board=null;
 if(stage&&!auto){const box=W.pit.bays[x.team.id],long=(q.f-box.f)*W.pit.length;
  if(x.dc32Servicing)S.board='stop';
  else if(x.dc32Serviced&&x.pt61Mark&&!x.pt61Released){const clearing=crewClearing(x),traffic=clearing?null:laneTraffic(x),hold=clearing||!!traffic||!!L.ic59Repair;S.board=hold?(clearing?'crew':'hold'):'go';S.hold=traffic?'traffic':clearing?'crew':L.ic59Repair?'sc':null;
   if(S.board==='go'&&S.lastBoard!=='go')x.pt61GoAt=L.elapsed;
   if(S.board!==S.lastBoard&&S.board!=='crew')say('Crew chief',hold?(traffic?'Hold, hold. Car coming down the lane.':'Hold there.'):'Lollipop up. Go, go, go!',hold?null:{cls:'go',tag:'RELEASE',text:'Go go go',ms:1800});
   if(Math.hypot(x.pos.x-x.pt61Mark.x,x.pos.z-x.pt61Mark.z)>1.6){x.pt61Released=true;if(traffic&&!L.ic59Repair)penalise(x,5,'Unsafe release.','DT');}}
  else if(!x.dc32Serviced&&(x.pitNow||L.stage==='race'))S.board=Math.abs(long)<60?'in':null;
 }
 S.lastBoard=S.board;
 // Box box.
 if(racing(L)&&!auto&&x.pitNow&&!stage){const ph=((x.progress%1)+1)%1,to=((W.pit.start-ph+1)%1)*lenM(L),lap=Math.floor(x.progress);
  if(to<700&&to>150&&S.boxLap!==lap){S.boxLap=lap;say('Race engineer',`Box, box, box. ${S.lim?'':'Limiter on before the line. '}Your box is marked green.`,{tag:'BOX BOX',text:'Pit this lap',value:'60 km/h',ms:3600});}}
 if(!stage&&S.lim&&L.stage==='race'&&!S.wasStage&&L.phase==='racing'&&!S.raceOff){S.raceOff=true;S.lim=false;}
 S.wasStage=!!stage;S.lastPos={x:x.pos.x,z:x.pos.z};
}
function rivalsAndCodrivers(L,dt){
 const p=L.player,race=racing(L),bath=isBathurstRace(L)&&L.started;let order=null;
 for(const x of L.entrants){
  if(race&&x!==p&&x.pitStage&&!x.pt61Was&&!x.retired){order||=dc32Order(L);const i=order.indexOf(p),j=order.indexOf(x);if(Math.abs(i-j)===1&&!p.pitStage&&!window.PL74)say('Race engineer',`${surname(x.d.name)} ${j<i?'ahead':'behind'} has boxed.`);}
  x.pt61Was=!!x.pitStage;
  if(!bath)continue;
  const lap=Math.floor(x.progress);if(x.pt61Lap===undefined)x.pt61Lap=lap;else if(lap>x.pt61Lap){if(x.pt61Co&&x.progress>0)x.pt61CoLaps=(x.pt61CoLaps||0)+(lap-x.pt61Lap);x.pt61Lap=lap;}
 }
 if(!bath||!race)return;
 L.pt61Ai=(L.pt61Ai||0)+dt;if(L.pt61Ai<1)return;L.pt61Ai=0;const req=coReq(L);
 for(const x of L.entrants){if(x===p&&!L.dc33Auto||x.retired||x.finished||x.pitStage||!coDriver(x))continue;const plan=x===p?L.pitPlan:planOf(x),left=(L.laps||0)-x.progress,done=x.pt61CoLaps||0;
  if(!x.pt61Co&&done<req){plan.swap=true;if(left<req+1.6)x.pitNow=true;}
  else if(x.pt61Co&&done>=req&&left>1.4&&x!==p){plan.swap=true;x.pitNow=true;}
  else if(x!==p)plan.swap=false;}
}

/* ---------- AI release: the lollipop holds them while a car comes down the lane ---------- */
const basePitStep=dcPitStep;
dcPitStep=function(x,dt,input){const L=live;
 if(L?.dc&&(x!==L.player||L.dc33Auto)&&x.dc32Serviced&&x.pt61Mark&&!x.pt61Released&&x.pt61Svc?.done){
  const wait=crewClearing(x)||!!laneTraffic(x);if(x.pt61AiHold&&!wait)x.pt61GoAt=L.elapsed;x.pt61AiHold=wait;
  if(wait){x.v=x.speed=0;x.braking=true;return;}
  if(Math.hypot(x.pos.x-x.pt61Mark.x,x.pos.z-x.pt61Mark.z)>1.6)x.pt61Released=true;}
 return basePitStep(x,dt,input);};

/* ---------- Hooks ---------- */
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){const L=live;if(!L?.dc)return basePhysics(dt,input,auto);st();
 const co=isBathurstRace(L)&&!!L.player?.pt61Co;basePhysics(dt,input,auto||co);if(live!==L)return;
 playerRules(L,dt);rivalsAndCodrivers(L,dt);};
const baseLaunch=dcLaunch;
dcLaunch=function(...args){baseLaunch(...args);const L=live;if(!L?.dc)return;L.pt61={lim:!!L.player?.pitStage&&!args[1],visit:null,board:null,boxLap:-1,said:{},wasStage:!!L.player?.pitStage};if(L.pitPlan){L.pitPlan.swap=false;if(!Number.isFinite(+L.pitPlan.fuel))L.pitPlan.fuel=45;}};
const basePerf=dcPerformance;
dcPerformance=function(x,stage){const r=basePerf(x,stage);if(!x?.pt61Co)return r;const co=coDriver(x);return co?r*(1+(co.ovr-(x.d.ovr||80))*.003):r;};
const baseCommit=dcCommitRace;
dcCommitRace=function(L){if(!L.committed&&isBathurstRace(L)&&!L.pt61CoPen){L.pt61CoPen=true;const req=coReq(L);
 for(const x of L.entrants){if(x.retired||!coDriver(x))continue;const miss=Math.max(0,req-(x.pt61CoLaps||0));if(!miss||window.pn57Ok?.()===false)continue;const pen=60+miss*10;x.pt61CoPenalty=pen;x.penalty=(x.penalty||0)+pen;if(Number.isFinite(x.finishTime))x.finishTime+=pen;}
 const p=L.player;if(p?.pt61CoPenalty)dcRadio('Race control',`Car #${p.d.number}: co-driver did ${p.pt61CoLaps||0} of the required ${req} laps. ${p.pt61CoPenalty} second penalty.`);}
 return baseCommit(L);};
DC_SNAPSHOT_KEYS.push('pt61Co','pt61CoLaps','pt61Lap');

/* ---------- Timing tower: green dot lit while the co-driver drives (Bathurst) ---------- */
const baseBoard=dc32BoardCanvas;
dc32BoardCanvas=function(W,L){baseBoard(W,L);if(!W?.dc32BoardTexture||!isBathurstRace(L))return;const c=W.dc32BoardTexture.image.getContext('2d'),order=dc32Order(L),row=67;
 for(let i=0;i<24;i++){const x=order[i];if(!x)continue;const y=78+i*row+row/2;c.beginPath();c.arc(570,y,13.5,0,Math.PI*2);c.fillStyle=x===L.player?'#4d0f17':'#08090b';c.fill();
  c.beginPath();c.arc(570,y,12,0,Math.PI*2);c.strokeStyle=x.retired?'#697078':'#28ca84';c.lineWidth=3;c.stroke();if(x.pt61Co){c.fillStyle='#28ca84';c.fill();}}
 W.dc32BoardTexture.needsUpdate=true;};

/* ---------- Pit markings and crew meshes ---------- */
const baseMakePit=SC25World.prototype.makePit;
SC25World.prototype.makePit=function(){baseMakePit.call(this);const W=this;if(!W.pit?.dc32)return;
 // The old static crew blocks at each box are replaced by the animated crew below.
 for(const k of Object.keys(W.batches||{}))if(k.startsWith('dc32-crew-')||k.startsWith('pit-crew-'))delete W.batches[k];
 const side=W.pit.side,white=W.mat('#f4f3ea',.6),N=W.pit.samples.length-1;
 // Solid lines you may not cross, on the track side of pit entry and exit.
 W.ribbon(W.pit.samples.slice(0,Math.round(N*.2)),-side*3.95,.34,white,.088);
 W.ribbon(W.pit.samples.slice(Math.round(N*.78)),-side*3.95,.34,white,.088);
 // Speed limit lines across the lane.
 for(const f of [.12,.86]){const q=dc32PitAt(W,f);for(const k of [-.5,.5]){const m=W.box(q.p.x+q.v.x*k*.9,q.p.y+.09,q.p.z+q.v.z*k*.9,7.5,.02,.32,k<0?white:W.mat('#e8bd45',.6));m.rotation.y=Math.atan2(q.v.x,q.v.z);}}
 // Box frames for the crew.
 const boxes=W.pit.bays.map((b,i)=>{const q=dc32PitAt(W,b.f);return{x:b.p.x,y:b.p.y,z:b.p.z,fx:q.v.x,fz:q.v.z,gx:q.n.x*side,gz:q.n.z*side,hl:b.halfLength,team:i};});
 const mat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.72,metalness:.05});
 const suitMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.62,metalness:0});
 const crew=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat,MAXB),cyl=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,16),mat.clone(),MAXC);
 const limb=new T.InstancedMesh(new T.CylinderGeometry(1,.82,1,10,1),suitMat,MAXL),sph=new T.InstancedMesh(new T.SphereGeometry(1,12,9),suitMat.clone(),MAXS);
 for(const m of [crew,cyl,limb,sph]){m.name='pt61 pit crew';m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(m.count*3),3);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;m.count=0;W.scene.add(m);}
 const cols=new Map(),helm=new Map(),legs=new Map();for(const t of S.teams){const c=new T.Color(t.livery?.primary||'#c33');cols.set(t.id,c);helm.set(t.id,new T.Color(t.livery?.secondary||'#eeeeee'));legs.set(t.id,c.clone().multiplyScalar(.32));}
 W.pt61={boxes,crew,cyl,limb,sph,cols,helm,legs,c:{belt:new T.Color('#141619'),patch:new T.Color('#f2f2f2'),balac:new T.Color('#101113'),hose:new T.Color('#1d2024'),fuelHose:new T.Color('#2b2f35'),skin:new T.Color('#c99a7c'),boot:new T.Color('#121316'),glove:new T.Color('#1b1c20'),visor:new T.Color('#0a0c10'),helmet:new T.Color('#16181c'),gun:new T.Color('#3b4046'),can:new T.Color('#c8ccd0'),ext:new T.Color('#d4201c'),jack:new T.Color('#e8bd45'),tyre:new T.Color('#141414'),red:new T.Color('#e01e1e'),green:new T.Color('#1fd060'),white:new T.Color('#eeeeee')}};
 try{W.pt61.clutter=clutter(W,W.pt61,boxes);}catch(e){console.warn('pt61 clutter',e);}
};
const baseUpdateCrews=SC25World.prototype.updateCrews;
SC25World.prototype.updateCrews=function(dt){if(this.pt61){if(this.crewMeshes&&!this.pt61OldHidden){for(const o of Object.values(this.crewMeshes))o.visible=false;this.pt61OldHidden=true;}return;}return baseUpdateCrews?.call(this,dt);};
const baseDispose=SC25World.prototype.dispose;
SC25World.prototype.dispose=function(){const P=this.pt61;if(P){for(const m of [P.crew,P.cyl,P.limb,P.sph,...(P.clutter||[])]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.pt61=null;}return baseDispose.call(this);};
const basePose=SC25World.prototype.pose;
SC25World.prototype.pose=function(x){const r=basePose.call(this,x);if(x?.pt61Lift)r.p.y+=x.pt61Lift;return r;};

/* ---------- Crew animation ----------
   Each crew member is a small rig: tapered limbs (thigh, shin, upper arm, forearm, torso) on one instanced
   mesh, spheres (head, helmet, joints, gloves) on another, boxes for boots, visor and tools. Poses are
   blended from a run cycle and per-job work poses. Everything is written into preallocated instance
   buffers each frame; nothing is allocated. */
const E=new T.Euler(),Q=new T.Quaternion(),P=new T.Vector3(),SC=new T.Vector3(),MX=new T.Matrix4();
let nb=0,nc=0,nl=0,ns=0,MESH=null,CYL=null,LIMB=null,SPH=null,WX=0,WZ=0,HX=0,HY=0,HZ=0,GX=0,GY=0,GZ=0;
function put(m,i,x,y,z,pitch,yaw,roll,sx,sy,sz,col){E.set(pitch,yaw,roll,'YXZ');Q.setFromEuler(E);P.set(x,y,z);SC.set(sx,sy,sz);MX.compose(P,Q,SC);m.setMatrixAt(i,MX);m.setColorAt(i,col);}
let CB=MAXB,CC=MAXC,CL=MAXL,CS=MAXS;
function bx(x,y,z,pitch,yaw,roll,sx,sy,sz,col){if(nb<CB)put(MESH,nb++,x,y,z,pitch,yaw,roll,sx,sy,sz,col);}
function cy(x,y,z,pitch,yaw,roll,r,h,col){if(nc<CC)put(CYL,nc++,x,y,z,pitch,yaw,roll,r,h,r,col);}
function sp(x,y,z,rx,ry,rz,col){if(ns<CS)put(SPH,ns++,x,y,z,0,QYAW,0,rx,ry,rz,col);}
// A straight piece of hose (cylinder) between two points.
function tube(x1,y1,z1,x2,y2,z2,r,col){const dx=x2-x1,dy=y2-y1,dz=z2-z1,l=Math.hypot(dx,dy,dz);if(l<.01||nc>=CC)return;put(CYL,nc++,(x1+x2)/2,(y1+y2)/2,(z1+z2)/2,Math.atan2(Math.hypot(dx,dz),dy),Math.atan2(dx,dz),0,r,l,r,col);}
// A hose that sags between two points, in three pieces.
function hose(x1,y1,z1,x2,y2,z2,sag,r,col){const p=[0,1/3,2/3,1].map(k=>[x1+(x2-x1)*k,y1+(y2-y1)*k-sag*4*k*(1-k),z1+(z2-z1)*k]);for(let i=0;i<3;i++)tube(p[i][0],Math.max(.03,p[i][1]),p[i][2],p[i+1][0],Math.max(.03,p[i+1][1]),p[i+1][2],r,col);}
// Person frame: origin at the feet, +z forward, rotated by QYAW about y.
let QX=0,QY=0,QZ=0,QC=1,QS=0,QYAW=0,LX=0,LY=0,LZ=0,PLEG=null,PTRIM=null;
const wx=(lx,lz)=>QX+lx*QC+lz*QS,wz=(lx,lz)=>QZ-lx*QS+lz*QC;
// A tapered segment from local (x,y,z) along pitch p (0 = straight down, -PI/2 = forward). Leaves its end in LX/LY/LZ.
function seg(x,y,z,p,len,r,rz,col){const dy=-Math.cos(p)*len,dz=-Math.sin(p)*len;if(nl<CL)put(LIMB,nl++,wx(x,z+dz/2),QY+y+dy/2,wz(x,z+dz/2),p,QYAW,0,r,len,rz||r,col);LX=x;LY=y+dy;LZ=z+dz;}
const POSE=new Float32Array(10),TMP=new Float32Array(10);
// lean, thighL, kneeL, thighR, kneeR, armL, elbowL, armR, elbowR, spread
const P_STAND=[.04,0,.06,0,.06,.08,-.18,.08,-.18,.1],P_READY=[.32,-.55,.9,-.25,.45,-.5,-.6,-.5,-.6,.14],
 P_KNEEL=[.42,-1.42,1.45,0,1.62,-1.15,-.35,-1.25,-.3,.12],P_SQUAT=[.55,-1.1,1.75,-.9,1.5,-.95,-.15,-.95,-.15,.12],
 P_FUEL=[.1,0,.06,-.15,.2,-1.75,-.5,-1.95,-.35,.08],P_EXT=[.12,0,.1,-.2,.25,-1.05,-.45,-.7,-.6,.1];
function blendPose(a,b,k){for(let i=0;i<10;i++)POSE[i]=a[i]+(b[i]-a[i])*k;}
function runPose(phase,amp){const s=Math.sin(phase),c=Math.cos(phase);
 TMP[0]=.04+.2*amp;TMP[1]=-.62*amp*s;TMP[3]=.62*amp*s;TMP[2]=.1+amp*(.35+.85*Math.max(0,c));TMP[4]=.1+amp*(.35+.85*Math.max(0,-c));
 TMP[5]=.7*amp*s;TMP[7]=-.7*amp*s;TMP[6]=-.35-.9*amp;TMP[8]=-.35-.9*amp;TMP[9]=.1;return TMP;}
function person(px,py,pz,yaw,suit,helmet,C){
 QX=px;QY=py;QZ=pz;QC=Math.cos(yaw);QS=Math.sin(yaw);QYAW=yaw;const p=POSE,lean=p[0],sp_=p[9];
 // Pelvis height puts the lowest foot or knee on the ground.
 let hip=0;for(let i=1;i<=3;i+=2){const t=p[i],k=p[i+1];hip=Math.max(hip,.44*Math.cos(t)+.07,.44*Math.cos(t)+.44*Math.cos(t+k)+.085);}
 const pz0=Math.max(0,-Math.sin(p[1])*.08,-Math.sin(p[3])*.08)*.5;
 const legs=PLEG||suit,trim=PTRIM||helmet;
 sp(wx(0,pz0),py+hip+.02,wz(0,pz0),.17,.12,.12,legs);
 bx(wx(0,pz0+.01),py+hip+.1,wz(0,pz0+.01),lean*.5,yaw,0,.36,.075,.25,C.belt);
 // Legs and boots.
 for(let s=-1;s<=1;s+=2){const t=s<0?p[1]:p[3],k=s<0?p[2]:p[4],hx=s*.1;
  seg(hx,hip,pz0,t,.44,.088,.095,legs);const kx=LX,ky=LY,kz=LZ;sp(wx(kx,kz),py+ky,wz(kx,kz),.075,.075,.075,legs);
  seg(kx,ky,kz,t+k,.43,.068,.072,legs);const ay=Math.max(.045,LY);bx(wx(LX,LZ+.06),py+ay-.02,wz(LX,LZ+.06),0,yaw,0,.11,.08,.27,C.boot);}
 // Torso, shoulders, head.
 const sy=hip+.56*Math.cos(lean),sz=pz0+.56*Math.sin(lean);
 seg(0,sy,sz,lean,.56,.215,.14,suit);
 // Chest band in the team's second colour, and a sponsor patch on the back.
 const by=hip+.4*Math.cos(lean),bz=pz0+.4*Math.sin(lean);bx(wx(0,bz),py+by,wz(0,bz),lean,yaw,0,.44,.075,.29,trim);
 const ky2=hip+.3*Math.cos(lean),kz2=pz0+.3*Math.sin(lean)-.14;bx(wx(0,kz2),py+ky2,wz(0,kz2),lean,yaw,0,.2,.13,.02,C.patch);
 const hy=sy+.2,hz=sz+.06*Math.sin(lean)+.02;
 sp(wx(0,hz),py+hy-.08,wz(0,hz),.07,.075,.07,C.balac);
 sp(wx(0,hz+.02),py+hy+.04,wz(0,hz+.02),.115,.125,.12,C.skin);
 sp(wx(0,hz-.005),py+hy+.075,wz(0,hz-.005),.14,.135,.155,helmet);
 bx(wx(0,hz+.125),py+hy+.06,wz(0,hz+.125),0,yaw,0,.2,.07,.03,C.visor);
 bx(wx(0,hz-.01),py+hy+.205,wz(0,hz-.01),0,yaw,0,.055,.02,.27,suit);
 // Arms and gloves. The right glove ends in HX/HY/HZ, the left in GX/GY/GZ.
 for(let s=-1;s<=1;s+=2){const a=s<0?p[5]:p[7],e=s<0?p[6]:p[8],shx=s*(.2+sp_*.15);
  sp(wx(shx,sz),py+sy-.03,wz(shx,sz),.085,.08,.085,suit);
  seg(shx,sy-.04,sz,a,.29,.066,.066,suit);const ex=LX,ey=LY,ez=LZ;sp(wx(ex,ez),py+ey,wz(ex,ez),.058,.058,.058,suit);
  seg(ex,ey,ez,a+e,.27,.055,.055,suit);sp(wx(LX,LZ),py+LY,wz(LX,LZ),.055,.06,.055,C.glove);
  if(s>0){HX=wx(LX,LZ);HY=py+LY;HZ=wz(LX,LZ);}else{GX=wx(LX,LZ);GY=py+LY;GZ=wz(LX,LZ);}}
}
const lerp=(a,b,k)=>a+(b-a)*k,ease=k=>k*k*(3-2*k);
function angLerp(a,b,k){let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*k;}
function carPt(x,cx,cz){const c=Math.cos(x.yaw),s=Math.sin(x.yaw);WX=x.pos.x+cx*c+cz*s;WZ=x.pos.z-cx*s+cz*c;}
function boxPt(B,along,out){WX=B.x+B.fx*along+B.gx*out;WZ=B.z+B.fz*along+B.gz*out;}
// Work spot: box frame while the car is still arriving, car frame once it is stopped (it may be off its marks).
let RG=1,RX=null,RB=null,RCAR=0,RNOW=0,RT0=0,RBACK=-1,RSUIT=null,RHELM=null,RC=null,RWAIT=0,RPX=0,RPZ=0,RYAW=0,RRUN=0,RARR=0;
function spot(cx,cz){const bxYaw=Math.atan2(RB.fx,RB.fz),c=Math.cos(bxYaw),s=Math.sin(bxYaw);const bxX=RB.x+cx*c+cz*s,bxZ=RB.z-cx*s+cz*c;if(RCAR>0){carPt(RX,cx,cz);WX=lerp(bxX,WX,RCAR);WZ=lerp(bxZ,WZ,RCAR);}else{WX=bxX;WZ=bxZ;}}
// Moves crew member i from the waiting line to its spot (running) and back (walking). Sets RPX/RPZ/RYAW,
// RARR (0..1 settled at the spot) and leaves the run pose in TMP with RRUN as its weight.
// Crew on the far side of the car go round its nose or tail instead of through it.
function travel(i,cx,cz,workYaw){
 boxPt(RB,(i-4)*.9,4.6);const ax=WX,az=WZ;spot(cx,cz);const kx=WX,kz=WZ;let mx=kx,mz=kz;
 if(cx*RG<-.5){spot(cx,Math.sign(cz)*3.3);mx=WX;mz=WZ;}
 const d1=Math.hypot(mx-ax,mz-az),d2=Math.hypot(kx-mx,kz-mz),dist=d1+d2;
 const delay=i*.06+(i===6||i===7?.25:0),dur=Math.max(.4,dist/4.2),t=RT0>0?RNOW-RT0-delay:-1;
 let k=0,yaw=RWAIT,amp=0,phase=0,arr=0,back=false;
 if(t>0){k=Math.min(1,t/dur);amp=clamp(t/.18,0,1)*clamp((dur-t)/.2+.15,0,1);phase=dist*k/1.15*Math.PI;arr=clamp((t-dur)/.35,0,1);}
 if(RBACK>=0){const tb=RNOW-RBACK-delay*.5,bd=Math.max(.6,dist/4.4);if(tb>0){const kb=Math.min(1,tb/bd);k=1-kb;arr=0;back=true;amp=.85*clamp(tb/.15,0,1)*clamp((bd-tb)/.2+.1,0,1);phase=dist*kb/1.1*Math.PI;}}
 const u=ease(k)*dist;let px,pz,hx,hz;
 if(u<d1||d2<.01){const f=d1>.01?u/d1:1;px=lerp(ax,mx,f);pz=lerp(az,mz,f);hx=mx-ax;hz=mz-az;}else{const f=(u-d1)/d2;px=lerp(mx,kx,f);pz=lerp(mz,kz,f);hx=kx-mx;hz=kz-mz;}
 // Face the way they move (turning smoothly at the corner), the job at the spot and the lane at the wall.
 let head=Math.atan2(hx,hz);if(d2>.01){const c=clamp((u-d1+.6)/1.2,0,1),h1=Math.atan2(mx-ax,mz-az),h2=Math.atan2(kx-mx,kz-mz);head=angLerp(h1,h2,c);}
 if(back)head+=Math.PI;
 if(t>0||back){const settle=back?clamp(k*4,0,1):clamp(k>=1?arr*2:0,0,1),start=back?clamp((1-k)*6,0,1):clamp(t/.22,0,1);yaw=angLerp(angLerp(back?workYaw:RWAIT,head,start),back?RWAIT:workYaw,back?1-settle:settle);if(back&&k<.02)yaw=RWAIT;}
 RPX=px;RPZ=pz;RYAW=yaw;RARR=arr;RRUN=amp;runPose(phase,amp);
}
// Final pose: run cycle while moving, otherwise standing at the wall or the job pose at the spot.
function pose(job){if(RRUN>.01){for(let i=0;i<10;i++)POSE[i]=lerp(P_STAND[i],TMP[i],Math.min(1,RRUN*1.4));return;}blendPose(P_STAND,job,RARR);}
const PICK=[null,null,null,null],PD=[0,0,0,0];
/* ---------- Pit lane clutter: every team's box, built once (static instanced meshes) ---------- */
function clutter(W,Pc,boxes){
 const side=W.pit.side,C=Pc.c,col=h=>new T.Color(h),G={grey:col('#8d969d'),steel:col('#c3c9ce'),dark:col('#1c2126'),black:col('#0d0e10'),orange:col('#ff6a13'),yellow:col('#f1c40f'),white:col('#f2f2f2'),blue:col('#2459a8'),red:col('#c8161d'),screen:col('#3a8fd8'),wall:col('#b9b6ad'),wallTop:col('#d8d5cc'),pad:col('#8a8d8f'),rubber:col('#121212'),hose:col('#202326'),case:col('#5d666e'),cone:col('#ff5a10')};
 const sb=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:'#ffffff',roughness:.7,metalness:.15}),4200);
 const sc=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,14),new T.MeshStandardMaterial({color:'#ffffff',roughness:.6,metalness:.2}),2600);
 const sk=new T.InstancedMesh(new T.ConeGeometry(1,1,10),new T.MeshStandardMaterial({color:'#ffffff',roughness:.6}),120);
 const sl=new T.InstancedMesh(new T.CylinderGeometry(1,.82,1,8,1),new T.MeshStandardMaterial({color:'#ffffff',roughness:.62}),1400);
 const ss=new T.InstancedMesh(new T.SphereGeometry(1,10,7),new T.MeshStandardMaterial({color:'#ffffff',roughness:.62}),2000);
 for(const m of [sb,sc,sk,sl,ss]){m.name='pt61 pit clutter';m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(m.count*3),3);m.castShadow=false;m.receiveShadow=true;W.scene.add(m);}
 // Write the static set through the same helpers the animated crew use.
 const keep=[MESH,CYL,LIMB,SPH,nb,nc,nl,ns,CB,CC,CL,CS];MESH=sb;CYL=sc;LIMB=sl;SPH=ss;nb=nc=nl=ns=0;CB=sb.count;CC=sc.count;CL=sl.count;CS=ss.count;let nk=0;
 const cone=(x,y,z,r,h,c)=>{if(nk<sk.count)put(sk,nk++,x,y,z,0,0,0,r,h,r,c);};
 const street=['goldcoast','adelaide','townsville','homebush','newcastle','canberra'].includes(W.e?.key);
 for(const B of boxes){
  const yawB=Math.atan2(B.fx,B.fz),H=B.hl,y0=B.y,team=B.team,prim=Pc.cols.get(team)||C.red,sec=Pc.helm.get(team)||C.white;
  // Box frame: a along the lane, u out from the lane centre (the car sits at u 8.1, the garage opens at 14.6).
  const at=(a,u)=>{WX=B.x+B.fx*a+B.gx*(u-8.1);WZ=B.z+B.fz*a+B.gz*(u-8.1);};
  const box=(a,u,y,w,h,d,c,pitch=0,yawOff=0)=>{at(a,u);bx(WX,y0+y,WZ,pitch,yawB+yawOff,0,w,h,d,c);};
  const can=(a,u,y,r,h,c)=>{at(a,u);cy(WX,y0+y,WZ,0,yawB,0,r,h,c);};
  // Boom over the box: post at the garage front, arm out over the car, lights and hose reels.
  box(0,14.2,1.8,.2,3.6,.2,prim);box(0,11.2,3.62,.2,.2,6.4,prim,0,Math.PI/2);box(0,9.2,3.48,.9,.08,.3,G.white,0,Math.PI/2);
  box(0,13.9,.15,.7,.3,.7,G.dark);for(const k of [-1,1]){at(k*.28,10.4);cy(WX,y0+3.62,WZ,Math.PI/2,yawB,0,.2,.12,G.dark);}
  at(0,8.6);B.boom={x:WX,y:y0+3.45,z:WZ};
  // Fuel rig: tank on a frame, hose and dead-man valve.
  const ra=H-1.7;box(ra,13.9,.06,1.1,.12,1.1,G.dark);for(const i of [-1,1])for(const j of [-1,1])box(ra+i*.42,13.9+j*.42,1.1,.07,2.1,.07,prim);
  can(ra,13.9,1.85,.4,1.35,G.steel);can(ra,13.9,2.6,.18,.18,G.red);box(ra,13.9,.7,.85,.06,.85,prim);at(ra,13.4);B.rig={x:WX,y:y0+1.15,z:WZ};
  for(let i=0;i<3;i++)can(ra-1.1-i*.3,14.25,.73,.11,1.45,i<2?G.blue:G.grey);
  // Tyre sets staged for the stop (Soft yellow / Hard white sidewall stripe), stacks of four.
  for(let k=0;k<3;k++)for(let t=0;t<4;t++){const a=-H+1.1+k*.82,u=13.35+(k%2)*.12;can(a,u,.15+t*.29,.34,.27,G.rubber);can(a,u,.15+t*.29,.343,.035,k===2?G.white:G.yellow);}
  // Tyre trolley with a used set.
  box(-H+3.9,13.6,.12,.9,.06,1.6,G.grey);for(let t=0;t<2;t++)can(-H+3.5+t*.8,13.6,.33,.33,.27,G.rubber);
  // Roll cabinets: team colour and black, drawers facing the lane.
  for(const [a,c] of [[1.15,prim],[-.15,G.dark]]){box(a,14.0,.55,.6,1.0,1.1,c);for(let d=0;d<4;d++)box(a,13.69,.25+d*.2,.02,.04,.95,G.steel);box(a,14.0,1.1,.64,.08,1.14,G.black);}
  // Timing monitor on a stand, flight cases, extinguishers, cones, spare panels and cables.
  box(2.9,14.1,.8,.06,1.6,.06,G.dark);box(2.9,14.0,1.75,.9,.55,.06,G.black,0,Math.PI/2);box(2.9,13.96,1.75,.8,.46,.02,G.screen,0,Math.PI/2);
  box(H-.6,14.0,.32,.8,.6,.6,G.case);box(H-.6,14.0,.9,.7,.5,.55,G.case);box(H-3.6,14.1,.3,.6,.55,.5,G.case);
  can(-H+.55,13.05,.3,.1,.55,G.red);can(H-.4,13.05,.3,.1,.55,G.red);
  for(const a of [-H+.35,H-.35]){at(a,12.85);cone(WX,y0+.24,WZ,.16,.46,G.cone);}
  box(-1.6,14.45,.6,1.7,1.05,.05,prim,-.28,Math.PI/2);box(-1.6,13.95,.07,1.9,.08,.55,G.black,0,Math.PI/2);
  for(const [a,ang] of [[.5,.3],[-2.3,-.2],[3.6,.1]])box(a,13.2,.012,.05,.02,2.6,a<0?G.yellow:G.hose,0,ang);
  // Crew who are not on the stop: two at the garage front.
  PLEG=Pc.legs.get(team)||null;PTRIM=sec;
  for(const [a,u,face] of [[H-2.6,14.3,0],[-H+2.8,14.25,.5]]){at(a,u);blendPose(P_STAND,P_STAND,0);POSE[5]=-.35;POSE[6]=-1.1;POSE[7]=-.3;POSE[8]=-1.2;person(WX,y0+.04,WZ,Math.atan2(-B.gx,-B.gz)+face,prim,sec,C);}
  // Team stand on the pit wall side: desk, canopy, monitors and two engineers on headsets.
  // Concrete pit wall between the lane and the track, with the team stand on a pad behind it.
  // Street circuits already have their own pit wall and fence; elsewhere skip it where the track runs close.
  at(0,-6.6);const room=W.nearest(new T.Vector3(WX,y0,WZ)).distance;
  if(!street&&room>13.5){const span=W.pit.length*.46/12+.06;box(0,-4.55,.55,.38,1.1,span,G.wall);box(0,-4.55,1.13,.46,.06,span,G.wallTop);box(0,-6.3,.03,2.6,.06,span*.9,G.pad);
  const pu=-6.1;box(0,pu,.55,1.0,1.1,2.8,G.dark);box(0,pu,1.12,1.1,.06,2.9,G.grey);box(0,pu,2.75,1.8,.09,3.2,prim);
  for(const k of [-1,1])box(k*1.45,pu-.75,1.4,.07,2.75,.07,G.steel);
  for(let k=-1;k<=1;k++){box(k*.9,pu+.2,1.45,.7,.45,.05,G.black,-.15,Math.PI/2);box(k*.9,pu+.17,1.45,.6,.36,.02,G.screen,-.15,Math.PI/2);}
  for(const k of [-.8,.8]){at(k,pu-.8);blendPose(P_STAND,P_STAND,0);POSE[5]=-.9;POSE[6]=-.9;POSE[7]=-.9;POSE[8]=-.9;POSE[0]=.18;person(WX,y0+.04,WZ,Math.atan2(B.gx,B.gz),prim,sec,C);sp(HX,HY+.25,HZ,.05,.05,.05,G.black);}}
 }
 sb.count=nb;sc.count=nc;sk.count=nk;sl.count=nl;ss.count=ns;for(const m of [sb,sc,sk,sl,ss]){m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.computeBoundingSphere?.();}
 [MESH,CYL,LIMB,SPH,nb,nc,nl,ns,CB,CC,CL,CS]=keep;PLEG=PTRIM=null;
 return [sb,sc,sk,sl,ss];
}
function crewFrame(W,L){
 const Pc=W.pt61;if(!Pc)return;MESH=Pc.crew;CYL=Pc.cyl;LIMB=Pc.limb;SPH=Pc.sph;nb=nc=nl=ns=0;const cam=W.camera.position,C=Pc.c,now=L.elapsed;
 for(let i=0;i<MAXCARS;i++){PICK[i]=null;PD[i]=Infinity;}
 for(const x of L.entrants){
  if(!x.pitStage||x.garage||!x.pos||x.retired){x.pt61CrewT0=0;continue;}const B=Pc.boxes[x.team.id];if(!B)continue;
  const dx=x.pos.x-B.x,dz=x.pos.z-B.z,d2=dx*dx+dz*dz,s=x.pt61Svc,recent=s?.done&&now-s.doneAt<7;
  const coming=!x.dc32Serviced&&(x.pitStage==='entry'||x===L.player);
  if(x.pt61CrewT0&&coming&&!x.dc32Servicing&&(x.pos.x-B.x)*B.fx+(x.pos.z-B.z)*B.fz>9)x.pt61CrewT0=0;
  if(!x.pt61CrewT0&&(coming&&d2<28*28||x.dc32Servicing))x.pt61CrewT0=now;
  const wanted=x.dc32Servicing||recent||coming&&d2<130*130;
  if(!wanted)continue;const cd=(cam.x-B.x)**2+(cam.z-B.z)**2;if(cd>240*240)continue;
  let k=-1;for(let i=0;i<MAXCARS;i++)if(cd<PD[i]){k=i;break;}if(k<0)continue;
  for(let i=MAXCARS-1;i>k;i--){PICK[i]=PICK[i-1];PD[i]=PD[i-1];}PICK[k]=x;PD[k]=cd;
 }
 for(let i=0;i<MAXCARS;i++){const x=PICK[i];if(x)crewFor(W,L,x,Pc,C,now);}
 const was=MESH.count+CYL.count+LIMB.count+SPH.count;MESH.count=nb;CYL.count=nc;LIMB.count=nl;SPH.count=ns;
 if(nb||nc||nl||ns||was)for(const m of [MESH,CYL,LIMB,SPH]){m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}
}
function crewFor(W,L,x,Pc,C,now){
 const B=Pc.boxes[x.team.id],suit=Pc.cols.get(x.team.id)||C.red,helm=Pc.helm.get(x.team.id)||C.white,s0=x.pt61Svc,s=s0&&(x.dc32Servicing||s0.done&&now-s0.doneAt<7)?s0:null,waitYaw=Math.atan2(-B.gx,-B.gz);
 const t=s?now-s.t0-s.extra:-1,fuelOn=s&&!s.done&&t>=0&&t<s.tFuel,tyreT=s?t-s.tFuel:-1,tyreOn=s&&!s.done&&s.tTyre&&tyreT>=0&&tyreT<s.tTyre;
 const yaw=x.yaw,c=Math.cos(yaw),sn=Math.sin(yaw),g=Math.sign(c*B.gx-sn*B.gz)||1,carOn=s&&(x.dc32Servicing||s.done);
 PLEG=Pc.legs.get(x.team.id)||null;PTRIM=helm;const bm=B.boom;
 RX=x;RB=B;RG=g;RNOW=now;RT0=x.pt61CrewT0||0;RBACK=s?.done?s.doneAt+.15:-1;RCAR=carOn?clamp((now-s.t0)/.5,0,1):0;RSUIT=suit;RHELM=helm;RC=C;RWAIT=waitYaw;
 const H=Math.PI/2,midT=s&&s.tTyre?s.tTyre*.55:0;
 // Wheel gunners, each rolling a fresh tyre out beside them.
 for(let w=0;w<4;w++){const sx=w&1?-1:1,az=w<2?1.42:-1.36,wy=yaw+(sx>0?-H:H);travel(w,sx*1.32,az,wy);
  pose(tyreOn||s&&!s.done&&RARR>0&&t>=s.tFuel-.6?P_KNEEL:P_READY);person(RPX,B.y+.04,RPZ,RYAW,suit,helm,C);
  bx(HX,HY,HZ,0,RYAW,0,.09,.11,.3,C.gun);
  // Air line from the wheel gun up to the boom over the box.
  if(bm)hose(HX,HY,HZ,bm.x+B.fx*(w<2?.5:-.5),bm.y,bm.z+B.fz*(w<2?.5:-.5),.9,.022,C.hose);
  if(s?.tyres||!s){const roll=RRUN>.01||RARR<1;if(roll||!(tyreT>midT)){const ox=Math.cos(RYAW)*.5,oz=-Math.sin(RYAW)*.5;
     if(roll)cy(RPX+ox*(sx>0?1:-1),B.y+.38,RPZ+oz*(sx>0?1:-1),now*6,RYAW,H,.34,.3,C.tyre);else{carPt(x,sx*1.85,az+.15);cy(WX,B.y+.38,WZ,0,yaw,H,.34,.3,C.tyre);}}
   else{carPt(x,sx*2.2,az+.8);cy(WX,B.y+.17,WZ,0,yaw,0,.34,.3,C.tyre);}}}
 // Jack men run the trolley jacks in under the nose and tail.
 for(let j=0;j<2;j++){const dir=j?-1:1,jy=yaw+(j?0:Math.PI);travel(4+j,0,dir*3.45,jy);pose(P_SQUAT);person(RPX,B.y+.04,RPZ,RYAW,suit,helm,C);
  const lift=x.pt61Lift||0,cr=Math.cos(RYAW),sr=Math.sin(RYAW);let jx=RPX+sr*.85,jz=RPZ+cr*.85;
  if(RARR>0){carPt(x,0,dir*2.62);jx=lerp(jx,WX,RARR);jz=lerp(jz,WZ,RARR);}
  bx(jx,B.y+.1+lift*.6,jz,0,RYAW,0,.34,.13,1.05,C.jack);bx((jx+HX)/2,(B.y+.25+HY)/2,(jz+HZ)/2,Math.atan2(Math.hypot(HX-jx,HZ-jz),HY-B.y-.25)*-1,RYAW,0,.05,Math.hypot(HX-jx,HY-B.y-.25,HZ-jz),.05,C.jack);}
 // Fuel man with the dump can; extinguisher man stands by during refuelling.
 travel(6,g*1.45,-1.05,yaw+(g>0?-H:H));pose(fuelOn?P_FUEL:P_STAND);person(RPX,B.y+.04,RPZ,RYAW,suit,helm,C);
 // The fuel hose runs back to the team's rig at the front of the garage.
 let cx_=(HX+GX)/2,cy_=(HY+GY)/2-.05,cz_=(HZ+GZ)/2;if(fuelOn&&RARR>.5){carPt(x,g*1.02,-1.05);cx_=WX;cy_=B.y+1.05;cz_=WZ;}
 bx(cx_,cy_,cz_,0,RYAW,0,.14,.14,.26,C.can);if(B.rig)hose(cx_,cy_,cz_,B.rig.x,B.rig.y,B.rig.z,.55,.05,C.fuelHose);
 travel(7,g*1.95,-2.15,yaw+(g>0?-H-.5:H+.5));pose(fuelOn?P_EXT:P_STAND);person(RPX,B.y+.04,RPZ,RYAW,suit,helm,C);bx(HX,HY-.12,HZ,0,RYAW,0,.16,.46,.16,C.ext);
 // Lollipop man in front of the box: waves the car in, board red until release, raised green on go.
 const go=s?.done&&(x!==L.player||L.dc33Auto?!x.pt61AiHold&&!crewClearing(x):L.pt61?.board==='go'||x.pt61Released),stopped=x.dc32Servicing||s?.done&&!go;
 const away=go&&x.pt61GoAt?clamp((now-x.pt61GoAt-.35)/.9,0,1):0;
 const approach=!x.dc32Servicing&&!s?.done,wave=approach?Math.sin(now*6)*.5:0,arm=go?-3.0:stopped?-1.5:-2.4+wave;
 boxPt(B,4.2,0);const l0x=WX,l0z=WZ;boxPt(B,4.2,4.4);const lpx=lerp(l0x,WX,ease(away)),lpz=lerp(l0z,WZ,ease(away));WX=lpx;WZ=lpz;
 const ly=away>0&&away<1?Math.atan2(B.gx,B.gz):Math.atan2(-B.fx,-B.fz);if(away>0&&away<1){runPose(away*9,.5);blendPose(P_STAND,TMP,1);}else blendPose(P_STAND,P_STAND,0);POSE[7]=away>=1?.1:arm;POSE[8]=-.05;POSE[5]=approach?-2.2-wave:.1;POSE[6]=-.3;person(WX,B.y+.04,WZ,ly,suit,helm,C);
 const cl=Math.cos(ly),sl=Math.sin(ly),ph=.75,oy=-ph*Math.cos(arm),oz=-ph*Math.sin(arm);
 bx(HX+oz*sl/2,HY+oy/2,HZ+oz*cl/2,arm,ly,0,.035,ph,.035,C.white);
 cy(HX+oz*sl,HY+oy,HZ+oz*cl,Math.PI/2,ly,0,.3,.035,go?C.green:C.red);
}
const baseRender=dcRenderWorld;
dcRenderWorld=function(W,L,dt){try{if(L?.dc&&W?.pt61)crewFrame(W,L);}catch(e){if(!W.pt61Err){W.pt61Err=1;console.warn('pt61 crew',e);}}return baseRender(W,L,dt);};

/* ---------- HUD ---------- */
const css=document.createElement('style');css.textContent=`
#pt61-hud{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);z-index:58;display:flex;gap:6px;align-items:stretch;font-family:'UI Rajdhani','Arial Narrow',sans-serif;pointer-events:none}
#pt61-hud[hidden]{display:none}
#pt61-hud>div{background:#05080cdd;color:#fff;border:1px solid #ffffff22;border-radius:4px;padding:5px 11px;font:700 14px 'UI Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;display:flex;align-items:center;gap:8px}
#pt61-hud .lim{background:#1546c9;border-color:#5f8bff;animation:pt61b 1s steps(2) infinite}
#pt61-hud .off{background:#b3121b;border-color:#ff6a6a;animation:pt61b .5s steps(2) infinite}
#pt61-hud .ok{background:#0f8f4f}
#pt61-hud .lp{width:18px;height:18px;border-radius:50%;background:#e01e1e;box-shadow:0 0 12px #e01e1e}
#pt61-hud .lp.go{background:#1fd060;box-shadow:0 0 14px #1fd060}
#pt61-hud b{color:#ffd23f;font-variant-numeric:tabular-nums}
#pt61-hud .co{background:#0f5b38}
@keyframes pt61b{50%{filter:brightness(1.45)}}
.u58-ban.pt61>b{background:#1546c9}.u58-ban.pt61.warn>b{background:#b3121b}.u58-ban.pt61.go>b{background:#0f8f4f}.u58-ban.pt61.co>b{background:#0f5b38}`;
document.head.appendChild(css);
let hud=null,last='';
// Arrow toward the marks from the driver's seat (car-local +x is the driver's left).
function arrow(x,lat){const B=sc25Engine?.pt61?.boxes[x.team.id];if(!B)return'';const left=Math.cos(x.yaw)*B.gx-Math.sin(x.yaw)*B.gz>0;return (lat<0)===left?'◀':'▶';}
function paintHud(force){
 const L=live;if(!hud||!hud.isConnected){hud=document.createElement('div');hud.id='pt61-hud';hud.hidden=true;document.body.appendChild(hud);last='';}
 if(!L?.dc||L.paused||!L.player||!sc25Engine?.pit){if(!hud.hidden)hud.hidden=true;return;}
 const x=L.player,S=L.pt61||{},parts=[],W=sc25Engine,auto=L.dc33Auto;
 if(S.lim&&!auto)parts.push(`<div class="lim">Pit limiter <b>${Math.min(LIMIT,Math.round((x.v||0)*3.6))}</b></div>`);
 else if(x.pitStage&&x.dc33PitCommitted&&!auto&&!x.dc32Servicing)parts.push(`<div class="off">Limiter off · RB / L</div>`);
 if(x.pitStage&&!auto){const box=W.pit.bays[x.team.id],q=dc32PitNear(W,x.pos),long=(box.f-q.f)*W.pit.length,lat=q.lane*W.pit.side-8.1;
  if(x.dc32Servicing&&x.pt61Svc){const s=x.pt61Svc,t=L.elapsed-s.t0,ph=t<s.extra?'Back on marks':t<s.extra+s.tFuel?'Fuel '+Math.round(s.litres)+' L':t<s.extra+s.tFuel+s.tTyre?'Tyres':s.tSwap&&t<s.tSwap?'Driver change':s.tRep?'Repairs':'Checks';parts.push(`<div><span class="lp"></span>${ph} <b>${Math.max(0,x.pitClock||0).toFixed(1)}</b></div>`);}
  else if(S.board==='hold'||S.board==='go'||S.board==='crew')parts.push(`<div class="${S.board==='go'?'ok':''}"><span class="lp ${S.board==='go'?'go':''}"></span>${S.board==='go'?'Lollipop up · go':S.board==='crew'?'Crew clearing · hold':'Hold · car coming'}</div>`);
  else if(S.board==='in'||!x.dc32Serviced&&Math.abs(long)<80){const on=Math.abs(long)<.9&&Math.abs(lat)<.8;parts.push(`<div class="${on?'ok':''}">${on?'On the marks · stop':`Box <b>${long>0?long.toFixed(long<10?1:0)+' m':'over '+(-long).toFixed(1)+' m'}</b>${Math.abs(lat)>.8&&Math.abs(long)<25?` · ${arrow(x,lat)} ${Math.abs(lat).toFixed(1)} m`:''}`}</div>`);}
 }
 if(isBathurstRace(L)&&L.started){const co=coDriver(x);if(co){const req=coReq(L),done=x.pt61CoLaps||0;parts.push(`<div class="${x.pt61Co?'co':''}">${x.pt61Co?surname(co.name)+' driving':'Co-driver '+surname(co.name)} <b>${done}/${req}</b>${L.pitPlan?.swap?' · swap next stop':''}</div>`);}}
 try{for(const h of window.PL74?.hud?.()||[])parts.push(h);}catch(_){}
 const html=parts.join('');if(html!==last||force){last=html;hud.innerHTML=html;}hud.hidden=!html;
}
setInterval(paintHud,100);

const baseHud=dcPaintHUD;
dcPaintHUD=function(...a){const r=baseHud.apply(this,a);try{const L=live,x=L?.player,el=document.getElementById('dc-status');if(L?.dc&&x?.pitStage&&el&&!L.dc33Auto){const S=L.pt61||{},s=x.pt61Svc;
 el.textContent=x.dc32Servicing?'PIT STOP · '+Math.ceil(x.pitClock||0)+'s · HOLD BRAKE':x.dc32Serviced&&!x.pt61Released?(S.board==='crew'?'CREW CLEARING · WAIT FOR THE LOLLIPOP':S.board==='hold'?'LOLLIPOP DOWN · CAR COMING · HOLD':'LOLLIPOP UP · GO · FOLLOW PIT EXIT'):(S.lim?'PIT LIMITER ON':'PIT LIMITER OFF · RB / L')+' · '+(x.dc32Serviced?'FOLLOW PIT EXIT':'STOP ON YOUR MARKS');}}catch(_){}return r;};

/* ---------- Input: RB / L toggles the limiter ---------- */
let prevRB=false;
setInterval(()=>{let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected)||null;}catch(_){}
 const down=!!pad?.buttons[5]?.pressed;if(down&&!prevRB&&live?.dc&&!live.paused)toggleLimiter();prevRB=down;},32);
window.addEventListener('keydown',e=>{if(e.code!=='KeyL'||e.repeat||!live?.dc||live.paused)return;if(e.target?.matches?.('input,textarea'))return;toggleLimiter();});

window.PT61={_crew:crewFrame,estimate:x=>{const L=live;if(!x||!L)return null;return estimate(x,planOf(x),null);},fuelNeed,toggleLimiter,coDriver,
 swapAvailable:()=>isBathurstRace(live)&&!!coDriver(live.player),
 swapText:()=>{const L=live,x=L?.player,co=x&&coDriver(x);if(!co)return'';const who=x.pt61Co?surname(x.d.name)+' back in':surname(co.name)+' in';return (L.pitPlan?.swap?'‹ '+who+' ›':'‹ No swap ›')+' · '+(x.pt61CoLaps||0)+'/'+coReq(L);},
 toggleSwap:()=>{const L=live;if(!L?.pitPlan)return;L.pitPlan.swap=!L.pitPlan.swap;},state:()=>live?.pt61};
})();
