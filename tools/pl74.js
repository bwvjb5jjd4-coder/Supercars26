/* pl74 · Pit lane rules, strategy and consequences.
   - Pit window: compulsory stops (Settings / Instant Race "stops") must be made inside a lap window.
     A stop counts only with four new tyres and, at enduros and long races, fuel added (minimum drop
     time). A stop outside the window does not count. Miss the window and it is a black flag.
   - Penalties are served in the lane: drive-throughs (speeding, unsafe release) and stop-gos (big
     speeding). Serve within 3 laps (laps behind the safety car do not count) or it is a black flag.
     Too late in the race to serve and it becomes the time it would have cost.
   - Driving through another team's pit box is a drive-through every time, even with penalties off.
   - Strategy: AI cars pick early, normal or late stops, cover a rival's undercut, and most of them
     dive in when the safety car comes out. Teammates double-stack and the second car queues.
     Far-away AI cars lose time on cold tyres after a stop, like the cars near you.
   - Pit wall: the race MFD shows the window, the rule for this race, any penalty to serve and where
     you would rejoin if you boxed now, and the engineer calls undercuts and safety car decisions.
   - Crew mistakes: a stuck wheel nut, a slipping jack, a hanging fuel rig or a loose wheel. Lower
     rated teams make more of them.
   - Driver: leaving the box needs about half throttle. Floor it and the wheels spin, barely touch it
     and the engine stalls. */
(()=>{
'use strict';
const SER_LAPS=3,COLD={Soft:82,Hard:87,Wet:45};
const racing=L=>!!L?.dc&&L.stage==='race'&&L.started&&L.phase==='racing';
const lenM=L=>L.e.lengthKm*1000;
const lapNo=x=>Math.floor(Math.max(0,x.progress||0))+1;
const surname=n=>String(n||'').trim().split(/\s+/).at(-1);
const rnd=(a,b)=>a+Math.random()*(b-a);
const underSc=L=>!!(L.ic59Sc||L.scTrain);
const human=(L,x)=>x===L.player&&!L.dc33Auto;
const humans=L=>{const s=new Set([L.player]);try{if(window.CO63?.pl&&L.co63)for(const p of window.CO63.pl)if(p?.x)s.add(p.x);}catch(_){}return s;};
const st=L=>L.pl74||(L.pl74={visit:null,visits:0,intr:0,sc:false,said:{},spin:0,stall:0,goSeen:false,launchDone:false,prevV:0});
function banner(cls,tag,text,value,ms){try{window.UI58?.banner?.('pt61 '+(cls||''),tag,text,value||'',ms||4200);}catch(_){}}
function say(from,msg,b){dcRadio(from,msg);if(b)banner(b.cls,b.tag,b.text,b.value,b.ms);}

/* ---------- Rules for this race ---------- */
function rules(L){
 if(L.pl74R&&L.pl74R.laps===L.laps)return L.pl74R;
 const p=L.player;if(p)rf41InitStop(p,L);
 const n=p?.rf41MinStops||0,laps=L.laps||0,endu=['bathurst','sandown'].includes(L.e.key)||L.e.type==='enduro',km=laps*L.e.lengthKm;
 const open=Math.max(2,Math.ceil(laps*.18)),close=Math.min(laps-1,Math.max(open+2,laps-Math.max(2,Math.ceil(laps*.15))));
 return L.pl74R={on:L.stage==='race'&&n>0&&laps>=5,n,laps,open,close,fuel:endu||km>=150,minDrop:endu?8:5};
}
const minLitres=x=>{const L=live;if(!L?.dc||L.stage!=='race')return 0;const R=rules(L);return R.on&&R.fuel&&(x.rf41MinStops||0)>(x.rf41ValidStops||0)?10:0;};
function ruleText(R){return R.fuel?`4 tyres + fuel · ${R.minDrop}s min drop`:'4 new tyres';}

/* ---------- Pit wall prediction ---------- */
function laneTime(L,sc){const W=sc25Engine;if(!W?.pit)return 20;const lapT=sc?lenM(L)/24:L.e.realLap||90;return W.pit.length/(60/3.6)-W.pit.length/(lenM(L)/lapT);}
function predict(L,x,sc){
 const W=sc25Engine;if(!W?.pit||!x||L.stage!=='race'||!L.started)return null;sc=sc??underSc(L);
 const e=window.PT61?.estimate?.(x),stop=e?e.total:6,lapT=sc?lenM(L)/24:(L.e.realLap||90),cold=sc?0:L.weather==='Dry'?1.6:1;
 const loss=Math.max(2,laneTime(L,sc)+stop+cold),order=dc32Order(L).filter(y=>!y.retired),now=order.indexOf(x)+1;
 let pos=1,ahead=null,ag=Infinity,behind=null,bg=Infinity,traffic=null;
 const rejoin=x.progress-loss/lapT;
 for(const y of order){if(y===x)continue;const d=((y.progress||0)-(x.progress||0))*lapT+loss;
  if(d>0){pos++;if(d<ag){ag=d;ahead=y;}}else if(-d<bg){bg=-d;behind=y;}
  // Anyone on the road just ahead of where you come out, whatever lap they are on.
  const ph=(((y.progress-rejoin)%1)+1)%1*lapT;if(!y.pitStage&&ph<1.3&&(!traffic||ph<traffic.g))traffic={y,g:ph};}
 return{pos,now,loss,ahead,ag,behind,bg,traffic,sc};
}
function predictText(p){if(!p)return'';const a=p.ahead?`${p.ag.toFixed(1)}s behind #${p.ahead.d.number}`:'leading';const t=p.traffic?' · traffic':(p.behind&&p.bg<1)?` · #${p.behind.d.number} close behind`:'';return `P${p.pos} · ${a}${t}`;}

/* ---------- Penalties served in the lane ---------- */
const PEN_NAME={DT:'Drive-through',SG:'10 second stop-go'};
function pending(x){return x?.pl74Pen?.[0]||null;}
function issue(x,kind,why,always){
 const L=live;if(!racing(L)||!x||x.finished||x.cd66)return false;if(!always&&window.pn57Ok?.()===false)return false;
 if(!humans(L).has(x)||(x===L.player&&L.dc33Auto)){x.penalty=(x.penalty||0)+Math.round(laneTime(L,false)+(kind==='SG'?12:2));return true;}
 const left=(L.laps||0)-lapNo(x);
 if(left<SER_LAPS){const sec=Math.round(laneTime(L,false)+(kind==='SG'?12:2));x.penalty=(x.penalty||0)+sec;
  say('Race control',`${why} ${PEN_NAME[kind]} for car #${x.d.number}. Too late to serve, so ${sec} seconds are added.`,{cls:'warn',tag:'RACE CONTROL',text:'+'+sec+' s',value:PEN_NAME[kind],ms:5000});return true;}
 const S=st(L);(x.pl74Pen||=[]).push({kind,why,laps:0,lap:lapNo(x),visit:x.pitStage?S.visits:-1});
 say('Race control',`${why} ${PEN_NAME[kind]} for car #${x.d.number}. Serve it within ${SER_LAPS} laps.`,{cls:'warn',tag:'PENALTY',text:PEN_NAME[kind],value:'Serve in '+SER_LAPS+' laps',ms:5200});
 if(x===L.player)setTimeout(()=>{if(live===L&&pending(x))dcRadio('Race engineer',kind==='DT'?'Drive-through. Come down the lane at the limit and do not stop.':'Stop-go. Stop in our box, ten seconds, no work on the car.');},2600);
 return true;
}
function dsq(L,x,why){
 if(x.pl74Dsq||x.retired)return;x.pl74Dsq=why;x.pl74Pen=[];x.retired=true;x.v=x.speed=0;x.pitNow=false;
 say('Race control',`Black flag, car #${x.d.number}. ${why}. Disqualified.`,{cls:'warn',tag:'BLACK FLAG',text:'Disqualified',value:'#'+x.d.number,ms:7000});
}
function eligible(L,x){const p=pending(x);return p&&p.visit!==st(L).visits?p:null;}

/* ---------- Service: penalties in the box, stop rules, crew mistakes ---------- */
function inBox(W,x){const box=W.pit.bays[x.team.id],q=dc32PitNear(W,x.pos),long=(q.f-box.f)*W.pit.length,lat=q.lane*W.pit.side-8.1;return long>-Math.min(3.5,box.halfLength-1)&&long<Math.min(7.5,box.halfLength-1)&&Math.abs(lat)<2.6;}
const baseService=dc32Service;
dc32Service=function(x,dt,box){
 const L=live,W=sc25Engine;if(!L?.dc||!W?.pit)return baseService.apply(this,arguments);
 const S=st(L),pen=human(L,x)&&racing(L)?eligible(L,x):null;
 if(pen&&!x.dc32Serviced){
  if(pen.kind==='DT'){if(inBox(W,x)&&Math.abs(x.v)<.45&&!S.said.dtStop){S.said.dtStop=1;say('Race engineer','Do not stop, it is a drive-through. Keep going.');}return;}
  if(inBox(W,x)&&Math.abs(x.v)<.45){const v=S.visit;if(v){if(!v.sgT){v.sgT=0;say('Crew chief','Stop-go. Ten seconds, hands off the car.',{cls:'warn',tag:'STOP-GO',text:'Hold 10 s',ms:3000});}
    v.sgT+=dt;x.pl74Hold=true;x.v=x.speed=0;
    if(v.sgT>=10){v.sgDone=true;x.pl74Hold=false;x.dc32Serviced=true;x.pitNow=false;x.pt61Svc={t0:L.elapsed-10,done:true,doneAt:L.elapsed-3,litres:0,tFuel:0,tTyre:0,tRep:0,tSwap:0,extra:0,total:10,tyres:false};x.pt61Mark={x:x.pos.x,z:x.pos.z};x.pt61Released=false;if(L.pt61)L.pt61.stopTime=10;}}
   return;}
  return;
 }
 const was=x.dc32Servicing,before=x.rf41ValidStops||0;
 if(human(L,x)&&inBox(W,x)&&!x.dc32Serviced&&Math.abs(x.v)<.45&&L.entrants.some(y=>y!==x&&y.team.id===x.team.id&&y.dc32Servicing)&&!S.said.stack){S.said.stack=L.elapsed;const m=L.entrants.find(y=>y!==x&&y.team.id===x.team.id);say('Crew chief',`Double stack. Hold there, #${m.d.number} is still on the jacks.`,{tag:'DOUBLE STACK',text:'Wait for #'+m.d.number,ms:3000});}
 const r=baseService.apply(this,arguments);
 if(x.dc32Servicing&&!was)startStop(L,x);
 if(x.dc32Serviced&&x.pt61Svc&&!x.pt61Svc.pl74Done){x.pt61Svc.pl74Done=1;finishStop(L,x,before);}
 return r;
};
function startStop(L,x){
 const s=x.pt61Svc;if(!s||s.pl74)return;s.pl74=1;const me=human(L,x);
 const base=+x.team.base||78,p=clamp(.05+(84-base)*.006,.03,.14)*(underSc(L)?1.25:1);
 if(Math.random()>=p)return;
 const opts=[];if(s.tyres)opts.push('nut','nut','jack','loose');if(s.litres>0)opts.push('fuel','fuel');if(!opts.length)return;
 const k=opts[Math.floor(Math.random()*opts.length)],corner=['Front left','Front right','Rear left','Rear right'][Math.floor(Math.random()*4)];let d=0,msg='';
 if(k==='nut'){d=rnd(1.2,3.8);s.tTyre+=d;msg=`${corner} wheel nut is stuck.`;}
 else if(k==='jack'){d=rnd(1.4,3.2);s.tTyre+=d;msg='Rear jack slipped and dropped the car. Lifting it again.';}
 else if(k==='fuel'){d=rnd(1.5,4.5);s.tFuel+=d;msg='Fuel rig is hanging on, it will not disconnect.';}
 else{x.pl74Loose={corner,m:0,off:false,said:false};}
 s.total+=d;x.pitClock=(x.pitClock||0)+d;x.rf41ServiceDuration=(x.rf41ServiceDuration||0)+d;s.pl74Err=k;
 if(me&&msg)say('Crew chief',msg+' Hold the brake.',{cls:'warn',tag:'PIT STOP',text:'Problem',value:'+'+d.toFixed(1)+' s',ms:3400});
}
function finishStop(L,x,before){
 const s=x.pt61Svc,me=human(L,x),R=rules(L);
 if(s.tyres&&!s.pl74Err&&x.pl74Loose)x.pl74Loose=null;
 if(s.tyres&&s.pl74Err!=='loose')x.pl74Loose=null;
 if((x.rf41ValidStops||0)>before&&R.on&&racing(L)){const lap=lapNo(x),inWin=lap>=R.open&&lap<=R.close,fuelOk=!R.fuel||(s.litres||0)>=1;
  if(!inWin||!fuelOk){x.rf41ValidStops--;if(me)say('Race engineer',!inWin?`That stop was outside the window, laps ${R.open} to ${R.close}. It does not count.`:'No fuel went in, so that does not count as the compulsory stop.',{cls:'warn',tag:'PIT WINDOW',text:'Stop not counted',ms:4200});}
  else if(me){const left=(x.rf41MinStops||0)-x.rf41ValidStops;if(left<=0)say('Race engineer','That is the compulsory stop done.');else say('Race engineer',`Stop counted. ${left} more to go.`);}}
}

/* ---------- Driver: hold, stall and wheelspin ---------- */
const scratch={};
const baseManual=dcManualStep;
dcManualStep=function(x,dt,input){const L=live;if(!L?.dc||x!==L.player||L.dc33Auto||!input)return baseManual(x,dt,input);const S=st(L);
 if(x.pl74Hold||S.stall>0){if(S.stall>0)S.stall=Math.max(0,S.stall-dt);Object.assign(scratch,input);scratch.throttle=0;scratch.brake=1;scratch.steer=0;baseManual(x,dt,scratch);x.v=x.speed=0;return;}
 const v0=x.v||0,r=baseManual(x,dt,input);
 if(S.spin>0){S.spin=Math.max(0,S.spin-dt);if(x.v>v0+dt*2.4){x.v=v0+dt*2.4;x.speed=Math.abs(x.v)*3.6;}}
 if(x.pl74Loose?.off&&!x.pitStage&&x.v>19.5){x.v=19.5;x.speed=x.v*3.6;}
 return r;};
function launch(L,input,dt){
 const x=L.player,S=st(L);if(!x||L.dc33Auto)return;
 const waiting=x.pitStage&&x.dc32Serviced&&x.pt61Mark&&!x.pt61Released;if(!waiting){S.goSeen=false;S.launchDone=false;S.launchT=undefined;return;}
 if(L.pt61?.board!=='go'||S.launchDone)return;if(!S.goSeen){S.goSeen=true;S.goAt=L.elapsed;}
 const thr=+input?.throttle||0;if(thr<.04&&S.launchT===undefined){if(L.elapsed-S.goAt>3&&!S.said.slow){S.said.slow=1;dcRadio('Crew chief','Go, go! You are clear!');}return;}
 // Judge the launch on the first quarter second of throttle (a trigger takes a moment to squeeze).
 if(S.launchT===undefined){S.launchT=0;S.launchMax=0;}S.launchT+=dt;S.launchMax=Math.max(S.launchMax,thr);if(S.launchT<.25)return;
 S.launchDone=true;const pad=(()=>{try{return Array.from(navigator.getGamepads?.()||[]).some(p=>p?.connected);}catch(_){return false;}})();const m=S.launchMax;S.launchT=undefined;
 if(!pad)return;
 if(m>.95){S.spin=1.2;say('Driver','Too much wheelspin.',{cls:'warn',tag:'PIT EXIT',text:'Wheelspin',ms:1800});}
 else if(m<.22&&Math.random()<.6){S.stall=2.4;say('Crew chief','Stalled! Clutch in, we are restarting it.',{cls:'warn',tag:'PIT EXIT',text:'Stalled',value:'+2.4 s',ms:2600});}
}

/* ---------- Grip: loose and lost wheels ---------- */
const baseGrip=dcTyreGrip;
dcTyreGrip=function(x){const g=baseGrip.apply(this,arguments),l=x?.pl74Loose;return l?g*(l.off?.5:.9):g;};

/* ---------- AI: strategy, covering, safety car ---------- */
function setupStrategies(L){
 const R=rules(L),H=humans(L);if(!R.on)return;
 for(const x of L.entrants){if(H.has(x))continue;rf41InitStop(x,L);if(x.rf41MinStops!==1)continue;
  const r=Math.random(),style=r<.3?'early':r<.75?'normal':'late';x.pl74Style=style;
  let lap=style==='early'?R.open+1+Math.floor(Math.random()*3):style==='late'?R.close-1-Math.floor(Math.random()*3):x.rf45StopLap;
  x.rf45StopLap=clamp(Math.round(lap||R.open+2),R.open+1,Math.max(R.open+1,R.close-1));}
}
function needsStop(x){return (x.rf41MinStops||0)>(x.rf41ValidStops||0);}
function onPitEntry(L,y){
 const R=rules(L),H=humans(L),p=L.player;if(underSc(L))return;
 const order=dc32Order(L).filter(z=>!z.retired),i=order.indexOf(y),lapT=L.e.realLap||90;
 for(const [j,chance] of [[i-1,.6],[i+1,.28]]){const x=order[j];if(!x||H.has(x)||x.pitStage||x.pitNow||x.retired)continue;
  const gap=Math.abs((x.progress-y.progress)*lapT),lap=lapNo(x);
  if(gap<2.6&&R.on&&needsStop(x)&&lap>=R.open&&lap<R.close&&Math.random()<chance){x.pitNow=true;x.pl74Cover=true;x.pitPlan||={tyre:L.weather==='Dry'?'Hard':'Wet',fuel:75,aero:x.aero,repair:true};}}
 // The engineer calls it when a car next to you on the road boxes.
 if(y!==p&&!H.has(y)&&p&&!p.pitStage&&!p.retired){const a=order.indexOf(p),gap=(y.progress-p.progress)*lapT;
  if(Math.abs(a-i)===1&&Math.abs(gap)<4.5){const pr=predict(L,p,false),need=R.on&&needsStop(p),win=R.on&&lapNo(p)>=R.open&&lapNo(p)<=R.close;
   const call=gap>0?(need||!R.on?`Box this lap to cover the undercut, you would come out ${predictText(pr)}.`:'We have already stopped, stay out.'):(need&&win?'Stay out and push. Overcut them on fresh air.':'Stay out.');
   say('Race engineer',`${surname(y.d.name)} ${gap>0?'ahead':'behind'} has boxed, ${Math.abs(gap).toFixed(1)} seconds ${gap>0?'up the road':'back'}. ${call}`,{tag:'PIT WALL',text:(gap>0?'Car ahead':'Car behind')+' boxed',value:'#'+y.d.number,ms:4200});}}
}
function onSafetyCar(L){
 const R=rules(L),H=humans(L),p=L.player;let boxing=0;
 for(const x of L.entrants){if(H.has(x)||x.pitStage||x.retired||x.finished)continue;const lap=lapNo(x),win=!R.on||lap>=R.open-1&&lap<=R.close,need=R.on&&needsStop(x),w=x.rdWear||0;
  const chance=need&&win?.85:w>40?.6:w>20?.3:.08;if(L.laps-lap<2)continue;
  if(Math.random()<chance){x.pitNow=true;x.pl74ScStop=true;boxing++;x.pitPlan||={tyre:L.weather==='Dry'?'Hard':'Wet',fuel:75,aero:x.aero,repair:true};}}
 if(p&&!p.retired&&!p.pitStage&&!L.dc33Auto){const pr=predict(L,p,true),stay=dc32Order(L).filter(z=>!z.retired).indexOf(p)+1,need=R.on&&needsStop(p);
  say('Race engineer',`Safety car. ${boxing} cars are coming in. Box now and you rejoin ${predictText(pr)}, stay out and you hold P${stay}${need?' but still owe the stop':''}. Your call.`,{tag:'SAFETY CAR',text:'Box or stay out?',value:'Box → P'+(pr?.pos||'?'),ms:6500});}
}
// Far-away AI cars (path model) also lose time while new tyres are cold.
const baseAI=dcAIStep;
dcAIStep=function(x,dt){const p0=x.progress,r=baseAI.apply(this,arguments),L=live;
 if(L?.dc&&!x.ai62&&!x.pitStage&&racing(L)&&!underSc(L)&&Number.isFinite(p0)){const d=x.progress-p0;if(d>0&&d<.05){const lo=COLD[x.tyre]||82,t=x.tyreTemp??lo,cold=t<lo?.13*Math.pow(clamp((lo-t)/(lo-25),0,1),1.15):0,loose=x.pl74Loose?(x.pl74Loose.off?.55:.93):1,f=(1-cold*.55)*loose;if(f<1)x.progress=p0+d*f;}}
 return r;};

/* ---------- Per step ---------- */
function step(L,dt,input){
 const S=st(L),W=sc25Engine,x=L.player,R=rules(L),H=humans(L);if(!W?.pit)return;
 if(racing(L)&&!S.setup){S.setup=true;setupStrategies(L);
  if(R.on&&x&&!L.dc33Auto)say('Race engineer',`Pit window is laps ${R.open} to ${R.close}. ${R.n>1?R.n+' stops':'One stop'}, ${ruleText(R)}. Miss it and it is a black flag.`,{tag:'PIT WINDOW',text:`Laps ${R.open}–${R.close}`,value:ruleText(R),ms:5200});}
 // Pit entries for strategy calls.
 for(const y of L.entrants){if(y.pitStage&&!y.pl74In&&racing(L)&&!y.retired)onPitEntry(L,y);y.pl74In=!!y.pitStage;}
 // Safety car decisions.
 const sc=!!L.ic59Sc;if(sc&&!S.sc&&racing(L))onSafetyCar(L);S.sc=sc;
 if(!x||x.retired||x.finished)return;
 // Visits to the pit lane (serving penalties).
 const q=x.pitStage?dc32PitNear(W,x.pos):null;
 if(x.pitStage&&!S.visit){S.visits++;S.visit={id:S.visits,lastF:q.f,stopped:false};S.said.dtStop=0;S.said.stack=0;S.said.slow=0;S.intr=0;}
 if(x.pitStage&&S.visit){S.visit.lastF=q.f;if(x.dc32Servicing)S.visit.serviced=true;}
 if(!x.pitStage&&S.visit){const v=S.visit,p=pending(x);S.visit=null;x.pl74Hold=false;
  if(p&&p.visit!==v.id&&v.lastF>.85&&racing(L)){
   if(p.kind==='DT'&&!v.serviced){x.pl74Pen.shift();say('Race control',`Car #${x.d.number} has served the drive-through.`,{cls:'go',tag:'PENALTY',text:'Served',ms:2600});}
   else if(p.kind==='SG'&&v.sgDone){x.pl74Pen.shift();say('Race control',`Car #${x.d.number} has served the stop-go.`,{cls:'go',tag:'PENALTY',text:'Served',ms:2600});}}}
 // Penalty laps (not behind the safety car).
 const lap=lapNo(x);if(S.lap===undefined)S.lap=lap;
 if(lap>S.lap){S.lap=lap;if(racing(L)&&!underSc(L)&&!x.pitStage)for(const p of x.pl74Pen||[]){p.laps++;
   if(p.laps>=SER_LAPS&&!L.dc33Auto){if(window.pn57Ok?.()!==false||p.always)dsq(L,x,`${PEN_NAME[p.kind]} not served`);else{x.pl74Pen=[];}break;}
   if(p.laps===SER_LAPS-1)say('Race engineer',`Last lap to serve the ${PEN_NAME[p.kind].toLowerCase()}. Box this lap.`,{cls:'warn',tag:'PENALTY',text:'Serve this lap',ms:3600});}}
 // Pit window.
 if(R.on&&racing(L)){
  for(const y of L.entrants){if(y.retired||y.finished||!needsStop(y))continue;const l=lapNo(y);
   if(H.has(y)&&y===x&&!L.dc33Auto){
    if(l===R.close-2&&S.said.win!==l){S.said.win=l;say('Race engineer',`Pit window closes in two laps. We still owe ${(y.rf41MinStops||0)-(y.rf41ValidStops||0)} stop.`,{cls:'warn',tag:'PIT WINDOW',text:'Closes in 2 laps',ms:3600});}
    if(l===R.close&&S.said.win!==l){S.said.win=l;say('Race engineer','Box this lap! Last lap of the window!',{cls:'warn',tag:'BOX BOX',text:'Last lap of window',ms:4200});y.pitNow=true;}
    if(l>R.close&&!y.pitStage&&!y.pl74Missed){y.pl74Missed=true;if(window.pn57Ok?.()!==false)dsq(L,y,'Compulsory pit stop not made inside the window');else say('Race control','Compulsory stop missed. Penalties are off, so no action.');}}
   else if(!H.has(y)&&l>=R.close-1-((y.rf41MinStops||0)-(y.rf41ValidStops||0))&&!y.pitStage)y.pitNow=true;}}
 // Driving through another team's box: always a drive-through.
 if(x.pitStage&&q&&!L.dc33Auto&&!x.cd66){const u=q.lane*W.pit.side,own=W.pit.bays[x.team.id];let other=-1;
  if(u>6.6&&Math.abs((q.f-own.f)*W.pit.length)>own.halfLength+2.5)for(let i=0;i<W.pit.bays.length;i++){const b=W.pit.bays[i];if(b!==own&&Math.abs((q.f-b.f)*W.pit.length)<b.halfLength-2){other=i;break;}}
  S.inOther=other>=0?other:null;if(other<0)S.intr=0;
  if(other>=0&&Math.abs(x.v)>.8){S.intr+=Math.abs(x.v)*dt;if(S.intr>6&&S.intrVisit!==S.visits){S.intrVisit=S.visits;const t=L.entrants.find(e=>e.team?.id===other)?.team.name||'another team';
    if(racing(L)){const ok=issue(x,'DT',`Drove through the ${t} pit box.`,true);if(ok){const p=x.pl74Pen?.at(-1);if(p)p.always=true;}}
    else say('Race control',`You drove through the ${t} box. In a race that is a drive-through.`,{cls:'warn',tag:'PIT LANE',text:'Not your box',ms:3200});}}}
 else S.inOther=null;
 // Loose wheel after a bad stop.
 for(const y of L.entrants){const l=y.pl74Loose;if(!l||y.pitStage||y.retired)continue;l.m+=Math.max(0,(y.progress-(l.p??y.progress)))*lenM(L);l.p=y.progress;
  if(!l.said&&l.m>250){l.said=true;if(human(L,y))say('Race engineer',`${l.corner} wheel is loose! Box this lap, box this lap!`,{cls:'warn',tag:'LOOSE WHEEL',text:l.corner,value:'Box now',ms:5200});y.pitNow=true;y.pitPlan||={tyre:L.weather==='Dry'?'Hard':'Wet',fuel:0,aero:y.aero,repair:true};}
  if(!l.off&&l.m>2600){l.off=true;if(human(L,y))say('Race engineer','The wheel has come off! Bring it back slowly.',{cls:'warn',tag:'WHEEL OFF',text:l.corner,ms:5200});else if(Math.random()<.25)try{dcSafety('Car #'+y.d.number+' lost a wheel.');}catch(_){}}}
 // Exit speed line: the limiter is still on.
 if(x.pitStage&&q&&L.pt61?.lim&&q.f>.9&&!S.said.limOff&&!L.dc33Auto){S.said.limOff=1;say('Race engineer','Limiter off! You are past the line.');}
 if(!x.pitStage)S.said.limOff=0;
 launch(L,input,dt);
}

/* ---------- Hooks ---------- */
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){const L=live;if(!L?.dc)return basePhysics.apply(this,arguments);
 const r=basePhysics.apply(this,arguments);if(live!==L)return r;try{step(L,dt,input);}catch(e){if(!L.pl74Err){L.pl74Err=1;console.warn('pl74',e);}}return r;};
const baseHud=dcPaintHUD;
dcPaintHUD=function(...a){const r=baseHud.apply(this,a);try{const L=live,el=document.getElementById('dc-status');if(L?.dc&&L.player?.pl74Dsq&&el)el.textContent='DISQUALIFIED · '+L.player.pl74Dsq.toUpperCase()+' · ESC TO SIMULATE';}catch(_){}return r;};
DC_SNAPSHOT_KEYS.push('pl74Pen','pl74Dsq','pl74Loose','pl74Style');

/* ---------- MFD and HUD text ---------- */
const css=document.createElement('style');css.textContent=`
#ic59-mfd .pl74{display:flex;justify-content:space-between;gap:8px;padding:3px 9px;font:700 10.5px 'UI Rajdhani',sans-serif;letter-spacing:.05em;color:#c9d1dc;background:#ffffff08;border-top:1px solid #ffffff10;white-space:nowrap}
#ic59-mfd .pl74 b{color:#fff;font-variant-numeric:tabular-nums}
#ic59-mfd .pl74.open b{color:#55e39a}#ic59-mfd .pl74.due b{color:#ffd23f}#ic59-mfd .pl74.pen{background:#b3121b55}#ic59-mfd .pl74.pen b{color:#ffd0d0}
#pt61-hud .pen{background:#b3121b;border-color:#ff6a6a}#pt61-hud .nb{background:#b3121b;border-color:#ff6a6a;animation:pt61b .4s steps(2) infinite}`;
document.head.appendChild(css);
function mfd(){
 const L=live,x=L?.player;if(!L?.dc||!x||L.stage!=='race')return'';const R=rules(L),out=[];
 if(R.on){const lap=lapNo(x),done=x.rf41ValidStops||0,n=x.rf41MinStops||0,cls=done>=n?'':lap>=R.open?(lap>=R.close-2?'due':'open'):'';
  out.push(`<div class="pl74 ${cls}"><span>WINDOW L${R.open}–${R.close} · ${ruleText(R).toUpperCase()}</span><b>${done>=n?'DONE':lap<R.open?'OPENS L'+R.open:lap>R.close?'CLOSED':'OPEN'} · ${done}/${n}</b></div>`);}
 const p=pending(x);if(p)out.push(`<div class="pl74 pen"><span>${PEN_NAME[p.kind].toUpperCase()}</span><b>${Math.max(0,SER_LAPS-p.laps)} LAP${SER_LAPS-p.laps===1?'':'S'} TO SERVE</b></div>`);
 if(L.started&&!x.pitStage&&!x.retired){const pr=predict(L,x);if(pr)out.push(`<div class="pl74"><span>BOX NOW${pr.sc?' (SC)':''} · LOSE ${pr.loss.toFixed(0)}s</span><b>${predictText(pr)}</b></div>`);}
 return out.join('');
}
function hud(){
 const L=live,x=L?.player,out=[];if(!L?.dc||!x||L.dc33Auto)return out;const S=L.pl74||{},p=pending(x);
 if(S.inOther!=null&&x.pitStage)out.push(`<div class="nb">Not your box!</div>`);
 if(x.pl74Hold&&S.visit?.sgT!==undefined)out.push(`<div class="pen">Stop-go <b>${Math.max(0,10-S.visit.sgT).toFixed(1)}</b></div>`);
 else if(p)out.push(`<div class="pen">${PEN_NAME[p.kind]} · <b>${Math.max(0,SER_LAPS-p.laps)}</b> laps</div>`);
 if(S.stall>0)out.push(`<div class="pen">Stalled <b>${S.stall.toFixed(1)}</b></div>`);
 else if(x.pitStage&&x.dc32Serviced&&!x.pt61Released&&L.pt61?.board==='go'&&!S.launchDone)out.push(`<div class="ok">Launch · half throttle</div>`);
 if(x.pl74Loose?.said)out.push(`<div class="nb">${x.pl74Loose.off?'Wheel off':'Loose wheel'} · box</div>`);
 return out;
}
window.PL74={rules,predict,predictText,issue,mfd,hud,minLitres,pending:()=>pending(live?.player),dsq,state:()=>live?.pl74};
})();
