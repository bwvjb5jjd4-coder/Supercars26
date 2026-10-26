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
const LIMIT=60,FLOW=4.2,TOL=61.2,MAXB=300,MAXC=26,MAXCARS=4;
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
 if(!human&&L.stage==='race'&&Number.isFinite(fuelNeed(x)))litres=Math.min(litres,fuelNeed(x));
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
function penalise(x,sec,msg){const L=live;if(!racing(L))return false;if(window.pn57Ok?.()===false)return false;x.penalty=(x.penalty||0)+sec;dcRadio('Race control',msg+' '+sec+' second time penalty for car #'+x.d.number+'.');return true;}

/* ---------- Service (replaces rf41's version, same effects) ---------- */
dc32Service=function(x,dt,box){
 const L=live,W=sc25Engine,player=x===L.player,human=player&&!L.dc33Auto,plan=planOf(x),q=dc32PitNear(W,x.pos),long=(q.f-box.f)*W.pit.length,lat=q.lane*W.pit.side-8.1,half=box.halfLength-1;
 const inside=long>-Math.min(3.5,half)&&long<Math.min(human?7.5:3.5,half)&&Math.abs(lat)<(human?2.6:1.9);
 if(inside&&Math.abs(x.v)<.45&&!x.dc32Serviced){
  if(L.entrants.some(y=>y!==x&&y.dc32Servicing&&y.team.id===x.team.id))return;
  if(!x.dc32Servicing){
   x.dc32Servicing=true;x.rf41ServiceInitialDamage=x.bodyDamage;const e=estimate(x,plan,human?{long,lat}:null);
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
dcManualStep=function(x,dt,input){const L=live;if(!L?.dc||x!==L.player||L.dc33Auto||!L.pt61?.lim||!input)return baseManual(x,dt,input);
 const lim=LIMIT/3.6;Object.assign(scratch,input);if(x.v>lim+.15)scratch.throttle=0;else if(x.v>lim-.5)scratch.throttle=Math.min(scratch.throttle||0,.3);
 baseManual(x,dt,scratch);if(x.v>lim&&x.v<lim+1.2){x.v=lim;x.speed=Math.hypot(x.v,x.latV||0)*3.6;}};

/* ---------- Per-step rules ---------- */
function laneTraffic(x){const L=live,my=x.pitDistance||0;for(const y of L.entrants){if(y===x||!y.pitStage||y.garage||!y.pos||(y.v||0)<2||y.dc32Servicing)continue;if(Math.abs(y.pitLane||0)>3.6)continue;const d=my-(y.pitDistance||0);if(d>-4&&d<48)return y;}return null;}
function playerRules(L,dt){
 const W=sc25Engine,x=L.player,S=st();if(!x||!W?.pit||x.retired||x.finished)return;
 const auto=L.dc33Auto,stage=x.pitStage,q=stage?dc32PitNear(W,x.pos):null,kmh=(x.v||0)*3.6,moved=S.lastPos?Math.hypot(x.pos.x-S.lastPos.x,x.pos.z-S.lastPos.z):0;
 if(stage&&!S.wasStage&&!auto){const tele=moved>15||L.ic59Repair;S.visit={t0:L.elapsed,f0:q.f,tele,speeding:0,penalised:false,warned:false,serviced:false};
  if(!tele&&q.f>.22&&q.f<.5&&penalise(x,5,'Crossed the solid pit entry line.'))S.visit.penalised=true;}
 if(stage&&S.visit){const v=S.visit;v.lastF=q.f;if(x.dc32Serviced)v.serviced=true;
  if(!auto&&!S.lim&&!v.warned&&x.dc33PitCommitted&&q.f<.12&&kmh>72){v.warned=true;say('Race engineer','Limiter! Limiter! Speed line coming up.',{cls:'warn',tag:'PIT LIMITER',text:'Press RB / L now',ms:2600});}
  if(!auto&&x.dc33PitCommitted&&q.f>=.12&&q.f<=.86&&kmh>TOL){v.speeding+=dt;v.top=Math.max(v.top||0,kmh);}else v.speeding=0;
  if(v.speeding>.25&&!v.speedPen){v.speedPen=true;const over=v.top-LIMIT;if(!penalise(x,over>10?10:5,`Pit lane speeding, ${Math.round(v.top)} km/h.`)&&!racing(L))say('Race control',`Pit lane speeding, ${Math.round(v.top)} km/h. Use the limiter (RB / L).`);}
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
  else if(x.dc32Serviced&&x.pt61Mark&&!x.pt61Released){const traffic=laneTraffic(x),hold=!!traffic||!!L.ic59Repair;S.board=hold?'hold':'go';
   if(S.board!==S.lastBoard)say('Crew chief',hold?(traffic?'Hold, hold. Car coming down the lane.':'Hold there.'):'Clear. Go, go, go!',hold?null:{cls:'go',tag:'RELEASE',text:'Go go go',ms:1800});
   if(Math.hypot(x.pos.x-x.pt61Mark.x,x.pos.z-x.pt61Mark.z)>1.6){x.pt61Released=true;if(traffic&&!L.ic59Repair)penalise(x,5,'Unsafe release.');}}
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
  if(race&&x!==p&&x.pitStage&&!x.pt61Was&&!x.retired){order||=dc32Order(L);const i=order.indexOf(p),j=order.indexOf(x);if(Math.abs(i-j)===1&&!p.pitStage)say('Race engineer',`${surname(x.d.name)} ${j<i?'ahead':'behind'} has boxed.`);}
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
 const side=W.pit.side,white=W.mat('#f4f3ea',.6),N=W.pit.samples.length-1;
 // Solid lines you may not cross, on the track side of pit entry and exit.
 W.ribbon(W.pit.samples.slice(0,Math.round(N*.2)),-side*3.95,.34,white,.088);
 W.ribbon(W.pit.samples.slice(Math.round(N*.78)),-side*3.95,.34,white,.088);
 // Speed limit lines across the lane.
 for(const f of [.12,.86]){const q=dc32PitAt(W,f);for(const k of [-.5,.5]){const m=W.box(q.p.x+q.v.x*k*.9,q.p.y+.09,q.p.z+q.v.z*k*.9,7.5,.02,.32,k<0?white:W.mat('#e8bd45',.6));m.rotation.y=Math.atan2(q.v.x,q.v.z);}}
 // Box frames for the crew.
 const boxes=W.pit.bays.map(b=>{const q=dc32PitAt(W,b.f);return{x:b.p.x,y:b.p.y,z:b.p.z,fx:q.v.x,fz:q.v.z,gx:q.n.x*side,gz:q.n.z*side};});
 const mat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.72,metalness:.05});
 const crew=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat,MAXB),cyl=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,16),mat.clone(),MAXC);
 for(const m of [crew,cyl]){m.name='pt61 pit crew';m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(m.count*3),3);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;m.count=0;W.scene.add(m);}
 const cols=new Map();for(const t of S.teams)cols.set(t.id,new T.Color(t.livery?.primary||'#c33'));
 W.pt61={boxes,crew,cyl,cols,c:{skin:new T.Color('#2a2d33'),helmet:new T.Color('#16181c'),gun:new T.Color('#3b4046'),can:new T.Color('#c8ccd0'),ext:new T.Color('#d4201c'),jack:new T.Color('#e8bd45'),tyre:new T.Color('#141414'),red:new T.Color('#e01e1e'),green:new T.Color('#1fd060'),white:new T.Color('#eeeeee')}};
};
const baseDispose=SC25World.prototype.dispose;
SC25World.prototype.dispose=function(){const P=this.pt61;if(P){for(const m of [P.crew,P.cyl]){m.removeFromParent();m.geometry.dispose();m.material.dispose();}this.pt61=null;}return baseDispose.call(this);};
const basePose=SC25World.prototype.pose;
SC25World.prototype.pose=function(x){const r=basePose.call(this,x);if(x?.pt61Lift)r.p.y+=x.pt61Lift;return r;};

/* ---------- Crew animation ---------- */
const E=new T.Euler(),Q=new T.Quaternion(),P=new T.Vector3(),SC=new T.Vector3(),MX=new T.Matrix4();
let nb=0,nc=0,MESH=null,CYL=null,WX=0,WZ=0,HX=0,HY=0,HZ=0;
function bx(x,y,z,pitch,yaw,roll,sx,sy,sz,col){if(nb>=MAXB)return;E.set(pitch,yaw,roll,'YXZ');Q.setFromEuler(E);P.set(x,y,z);SC.set(sx,sy,sz);MX.compose(P,Q,SC);MESH.setMatrixAt(nb,MX);MESH.setColorAt(nb,col);nb++;}
function cy(x,y,z,pitch,yaw,roll,r,h,col){if(nc>=MAXC)return;E.set(pitch,yaw,roll,'YXZ');Q.setFromEuler(E);P.set(x,y,z);SC.set(r,h,r);MX.compose(P,Q,SC);CYL.setMatrixAt(nc,MX);CYL.setColorAt(nc,col);nc++;}
// One crew member: legs, torso, helmet, two arms. Leaves the right hand position in HX/HY/HZ.
let QX=0,QY=0,QZ=0,QC=1,QS=0,QYAW=0;
function lp(lx,ly,lz,pitch,sx,sy,sz,col){bx(QX+lx*QC+lz*QS,QY+ly,QZ-lx*QS+lz*QC,pitch,QYAW,0,sx,sy,sz,col);}
function person(px,py,pz,yaw,crouch,aL,aR,suit,C){
 const c=Math.cos(yaw),s=Math.sin(yaw),legH=.84-.4*crouch,lean=crouch*.42;QX=px;QY=py;QZ=pz;QC=c;QS=s;QYAW=yaw;
 lp(-.11,legH/2,crouch*.12,0,.15,legH,.17,suit);lp(.11,legH/2,crouch*.12,0,.15,legH,.17,suit);
 lp(0,legH+.29,crouch*.14,lean,.42,.6,.25,suit);lp(0,legH+.71,crouch*.36,0,.25,.27,.27,C.helmet);
 const sy=legH+.53,sz=crouch*.24;
 lp(-.29,sy-.29*Math.cos(aL),sz-.29*Math.sin(aL),aL,.11,.58,.11,suit);lp(.29,sy-.29*Math.cos(aR),sz-.29*Math.sin(aR),aR,.11,.58,.11,suit);
 const hy=sy-.6*Math.cos(aR),hz=sz-.6*Math.sin(aR);HX=px+.29*c+hz*s;HY=py+hy;HZ=pz-.29*s+hz*c;
}
const lerp=(a,b,k)=>a+(b-a)*k;
let RX=null,RB=null,RK=0,RSUIT=null,RC=null,RNOW=0,RWAIT=0;
// A crew member runs from the waiting line by the garage (box frame) to a work spot (car frame).
function role(i,cx,cz,lyaw,crouch,aL,aR){const k=RK;boxPt(RB,(i-4)*.95,4.4);const wx=WX,wz=WZ;carPt(RX,cx,cz);const px=lerp(wx,WX,k),pz=lerp(wz,WZ,k),swing=k>0&&k<1?Math.sin(RNOW*14+i)*.7:0;
 person(px,RB.y+.04,pz,k>.5?RX.yaw+lyaw:RWAIT,k>.5?crouch:0,(k>.5?aL:-.15)+swing,(k>.5?aR:-.15)-swing,RSUIT,RC);}
function carPt(x,cx,cz){const c=Math.cos(x.yaw),s=Math.sin(x.yaw);WX=x.pos.x+cx*c+cz*s;WZ=x.pos.z-cx*s+cz*c;}
function boxPt(B,along,out){WX=B.x+B.fx*along+B.gx*out;WZ=B.z+B.fz*along+B.gz*out;}
const PICK=[null,null,null,null],PD=[0,0,0,0];
function crewFrame(W,L){
 const Pc=W.pt61;if(!Pc)return;MESH=Pc.crew;CYL=Pc.cyl;nb=nc=0;const cam=W.camera.position,C=Pc.c,now=L.elapsed;
 for(let i=0;i<MAXCARS;i++){PICK[i]=null;PD[i]=Infinity;}
 for(const x of L.entrants){
  if(!x.pitStage||x.garage||!x.pos||x.retired)continue;const B=Pc.boxes[x.team.id];if(!B)continue;
  const dx=x.pos.x-B.x,dz=x.pos.z-B.z,d2=dx*dx+dz*dz,s=x.pt61Svc,recent=s?.done&&now-s.doneAt<4;
  const wanted=x.dc32Servicing||recent||(!x.dc32Serviced&&(x.pitStage==='entry'||x===L.player&&(x.pitNow||L.stage==='race'))&&d2<110*110);
  if(!wanted)continue;const cd=(cam.x-B.x)**2+(cam.z-B.z)**2;if(cd>240*240)continue;
  let k=-1;for(let i=0;i<MAXCARS;i++)if(cd<PD[i]){k=i;break;}if(k<0)continue;
  for(let i=MAXCARS-1;i>k;i--){PICK[i]=PICK[i-1];PD[i]=PD[i-1];}PICK[k]=x;PD[k]=cd;
 }
 for(let i=0;i<MAXCARS;i++){const x=PICK[i];if(x)crewFor(W,L,x,Pc,C,now);}
 const was=MESH.count+CYL.count;MESH.count=nb;CYL.count=nc;
 if(nb||nc||was){MESH.instanceMatrix.needsUpdate=true;MESH.instanceColor.needsUpdate=true;CYL.instanceMatrix.needsUpdate=true;CYL.instanceColor.needsUpdate=true;}
}
function crewFor(W,L,x,Pc,C,now){
 const B=Pc.boxes[x.team.id],suit=Pc.cols.get(x.team.id)||C.red,s=x.pt61Svc,boxYaw=Math.atan2(B.fx,B.fz),waitYaw=Math.atan2(-B.gx,-B.gz);
 let k=0;if(x.dc32Servicing&&s)k=clamp((now-s.t0)/.5,0,1);else if(s?.done)k=1-clamp((now-s.doneAt)/.9,0,1);
 const t=s?now-s.t0-s.extra:-1,fuelOn=s&&t>=0&&t<s.tFuel,tyreT=s?t-s.tFuel:-1,tyreOn=s&&s.tTyre&&tyreT>=0&&tyreT<s.tTyre;
 const yaw=x.yaw,c=Math.cos(yaw),sn=Math.sin(yaw),g=Math.sign(c*B.gx-sn*B.gz)||1;
 RX=x;RB=B;RK=k;RSUIT=suit;RC=C;RNOW=now;RWAIT=waitYaw;
 // Wheel gunners and tyres.
 const midT=s&&s.tTyre?s.tTyre*.55:0;
 for(let w=0;w<4;w++){const sx=w&1?-1:1,az=w<2?1.42:-1.36;role(w,sx*1.3,az,sx>0?-Math.PI/2:Math.PI/2,tyreOn?1:.35,-1.35,-1.45);
  if(k>.5&&x.dc32Servicing)bx(HX,HY,HZ,0,yaw+(sx>0?-Math.PI/2:Math.PI/2),0,.1,.1,.34,C.gun);
  if(s?.tyres&&k>.5){carPt(x,sx*1.8,az);if(!(tyreT>midT))cy(WX,B.y+.36,WZ,0,yaw,Math.PI/2,.34,.3,C.tyre);else{carPt(x,sx*2.15,az+.75);cy(WX,B.y+.16,WZ,0,yaw,0,.34,.3,C.tyre);}}}
 // Jacks: front and rear.
 for(const j of [0,1]){const dir=j?-1:1;role(4+j,0,dir*3.35,j?0:Math.PI,.5,-1.0,-1.0);
  if(k>.5){carPt(x,0,dir*2.6);bx(WX,B.y+.09+(x.pt61Lift||0)*.6,WZ,0,yaw,0,.32,.14,1.15,C.jack);carPt(x,0,dir*3.05);bx(WX,B.y+.32,WZ,dir*.9,yaw,0,.06,.06,.95,C.jack);}}
 // Fuel man and extinguisher.
 role(6,g*1.45,-1.05,g>0?-Math.PI/2:Math.PI/2,0,fuelOn?-2.0:-.3,fuelOn?-2.0:-.3);
 if(k>.5){if(fuelOn){carPt(x,g*1.02,-1.05);bx(WX,B.y+1.18,WZ,0,yaw,-g*.85,.27,.8,.27,C.can);}else{bx(HX,HY-.25,HZ,0,yaw,0,.25,.7,.25,C.can);}}
 role(7,g*1.95,-2.15,g>0?-Math.PI/2-.5:Math.PI/2+.5,0,-.5,fuelOn?-1.3:-.4);if(k>.5)bx(HX,HY-.12,HZ,0,yaw,0,.17,.48,.17,C.ext);
 // Lollipop man in front of the box: waves the car in, board red until release, raised green on go.
 const go=s?.done&&(x!==L.player||L.dc33Auto||L.pt61?.board==='go'||x.pt61Released),stopped=x.dc32Servicing||s?.done&&!go;
 const approach=!x.dc32Servicing&&!s?.done,wave=approach?Math.sin(now*7)*.55:0;
 boxPt(B,4.1,0);const lx=WX,lz=WZ,ly=Math.atan2(-B.fx,-B.fz);person(lx,B.y+.04,lz,ly,0,-.2,go?-3.0:stopped?-1.55:-2.5+wave,suit,C);
 const pole=go?-2.95:stopped?-1.5:-2.5+wave,cl=Math.cos(ly),sl=Math.sin(ly),ph=.7,ox=0,oy=-ph*Math.cos(pole),oz=-ph*Math.sin(pole);
 bx(HX+oz*sl/2,HY+oy/2,HZ+oz*cl/2,pole,ly,0,.04,ph*1.05,.04,C.white);
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
  else if(S.board==='hold'||S.board==='go')parts.push(`<div class="${S.board==='go'?'ok':''}"><span class="lp ${S.board==='go'?'go':''}"></span>${S.board==='go'?'Go go go':'Hold · traffic'}</div>`);
  else if(S.board==='in'||!x.dc32Serviced&&Math.abs(long)<80){const on=Math.abs(long)<.9&&Math.abs(lat)<.8;parts.push(`<div class="${on?'ok':''}">${on?'On the marks · stop':`Box <b>${long>0?long.toFixed(long<10?1:0)+' m':'over '+(-long).toFixed(1)+' m'}</b>${Math.abs(lat)>.8&&Math.abs(long)<25?` · ${arrow(x,lat)} ${Math.abs(lat).toFixed(1)} m`:''}`}</div>`);}
 }
 if(isBathurstRace(L)&&L.started){const co=coDriver(x);if(co){const req=coReq(L),done=x.pt61CoLaps||0;parts.push(`<div class="${x.pt61Co?'co':''}">${x.pt61Co?surname(co.name)+' driving':'Co-driver '+surname(co.name)} <b>${done}/${req}</b>${L.pitPlan?.swap?' · swap next stop':''}</div>`);}}
 const html=parts.join('');if(html!==last||force){last=html;hud.innerHTML=html;}hud.hidden=!html;
}
setInterval(paintHud,100);

/* ---------- Input: RB / L toggles the limiter ---------- */
let prevRB=false;
setInterval(()=>{let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected)||null;}catch(_){}
 const down=!!pad?.buttons[5]?.pressed;if(down&&!prevRB&&live?.dc&&!live.paused)toggleLimiter();prevRB=down;},32);
window.addEventListener('keydown',e=>{if(e.code!=='KeyL'||e.repeat||!live?.dc||live.paused)return;if(e.target?.matches?.('input,textarea'))return;toggleLimiter();});

window.PT61={estimate:x=>{const L=live;if(!x||!L)return null;return estimate(x,planOf(x),null);},fuelNeed,toggleLimiter,coDriver,
 swapAvailable:()=>isBathurstRace(live)&&!!coDriver(live.player),
 swapText:()=>{const L=live,x=L?.player,co=x&&coDriver(x);if(!co)return'';const who=x.pt61Co?surname(x.d.name)+' back in':surname(co.name)+' in';return (L.pitPlan?.swap?'‹ '+who+' ›':'‹ No swap ›')+' · '+(x.pt61CoLaps||0)+'/'+coReq(L);},
 toggleSwap:()=>{const L=live;if(!L?.pitPlan)return;L.pitPlan.swap=!L.pitPlan.swap;},state:()=>live?.pt61};
})();
