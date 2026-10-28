/* AI62: AI cars drive the same PH47 tyre model as the player. The existing race AI still
   makes every decision (racing line, overtakes, braking targets, pit calls, safety car,
   damage limits); it runs as a planner each frame, then an AI driver turns its plan into
   steering, throttle and brake for the real car physics. Cars far from the player (and
   fast-forwarded sessions) keep the light path model so frame time stays low. */
const AI62={near:340,far:420,look:.36,track:1,sharp:.9,preview:.1,kh:.6,ke:2,tdamp:.2,gain:.004,damp:.05,trail:1,react:.5,use:.96,dec:.62,tgain:.5,bgain:.18,pace:1,assist:{...PH47_ASSISTS.standard,label:'AI'},loose:{...PH47_ASSISTS.off,label:'AI loose'},lock:{...PH47_ASSISTS.standard,abs:false,label:'AI lock'}};
function ai62Wanted(L,x){
 if(D.settings.ph47Classic||D.settings.ai62Off||dcSimBusy||L.simulated||!L.dc)return false;
 if(x===L.player||x.retired||x.finished||x.garage||x.pitStage||x.outlapHold||x.sc3Crash||!x.pos||(x.releaseDelay||0)>0)return false;
 if(L.stage==='race'&&!L.started)return false;
 // Pick a car up only once it is on the racing surface (not while merging from the pit exit).
 if(!x.ai62&&(Math.abs(x.lane)>7.4||x.dc32PitMerge==='out'))return false;
 const p=L.player?.pos;if(!p)return true;const d=Math.hypot(x.pos.x-p.x,x.pos.z-p.z);
 return d<(x.ai62?AI62.far:AI62.near);
}
function ai62Enter(L,x){
 const W=sc25Engine,q=W.at(x.progress),k=dcTrackCurvature(W,x.progress);
 x.ai62={assist:AI62.assist,rear:1,target:x.v,lastT:x.v,lane:clamp(x.lane,-7.2,7.2)};x.dc33YawOffset=0;x.dc33Angular=0;x.dc33ImpactX=x.dc33ImpactZ=0;x.latV=0;
 const s=ph47State(x);s.r=clamp(x.v*k,-2,2);s.delta=Math.atan(2.82*k);s.af=s.ar=0;s.ax=s.ay=0;x.yaw=Math.atan2(q.v.x,q.v.z)+(x.ai68Slip||0);
}
function ai62Leave(x){x.ai62=null;x.ph47On=false;x.latV=0;x.v=Math.max(0,x.v);if(x.ph47){x.ph47.r=0;x.ph47.tumble=0;x.ph47.phi=0;}dc33Sync(x);}
// Fastest speed the tyre model can carry (scaled by the difficulty's corner pace) through the corners ahead, looking at least one full
// braking distance down the road so fast approaches start braking in time.
function ai62CornerCap(L,x){
 const W=sc25Engine,P=PH47,len=L.e.lengthKm*1000,grip=dcTyreGrip(x),mass=1335+(x.fuel||0)*.75,aero=x.aero??50,kd=P.cl*(1+aero/100*.9)*(1-clamp(((x.bodyDamage||0)-15)/85,0,1)*.35);
 const skill=clamp(dcPerformance(x)/(window.hd64Pace?.()||1),.72,1.14),use=AI62.use+(skill-.9)*.3,mu=P.mu*grip*use,decel=Math.max(4,mu*P.g*AI62.dec);let cap=99;
 const reach=Math.max(130,x.v*x.v/(2*decel)+x.v*.5+30),off=x.ai62&&ai68Off(W,x.progress,x.ai62.lane);for(let m=0;m<=reach;m+=13){const f=x.progress+m/len,k=Math.max(ai68CapCurv(W,f),Math.abs(ai68Curv(W,f,true))*AI62.sharp,off?Math.abs(dcTrackCurvature(W,f)):0);if(k<1e-5)continue;const den=k-mu*kd/mass;const v2=den>1e-6?mu*P.g/den:1e4;cap=Math.min(cap,Math.sqrt(v2+2*decel*Math.max(0,m-x.v*AI62.react)));}
 return cap*AI62.pace;
}
// The planner's own target with no traffic or race-control limits (same formula as dcAIStep).
function ai62FreeTarget(L,x){
 const W=sc25Engine,s=W.at(x.progress),grip=dcTyreGrip(x),skill=clamp(dcPerformance(x),.72,1.14),aero=1+x.aero/100*x.v*x.v/4000*.65,k=Math.abs(ai68Curv(W,x.progress)),brake=Math.max(3,11*grip);
 let target=Math.min(s.speed,W.at(x.progress+.002).speed)*Math.sqrt(clamp(grip/1.02,.28,1.15))*skill*(1-Math.max(0,x.rdWear-55)*.0035)*(1-x.fuel*.00022)*(x.bodyDamage>20?Math.max(.45,1-(x.bodyDamage-20)*.004):1);
 for(let metres=12;metres<=150;metres+=18){const ck=Math.abs(ai68Curv(W,x.progress+metres/(L.e.lengthKm*1000))),limit=ck>.00001?Math.sqrt(19*grip*aero/ck):88;target=Math.min(target,Math.sqrt(limit*limit+2*brake*metres));}
 target=Math.min(target,(318-x.aero*.36)/3.6);if(k>.00001)target=Math.min(target,Math.sqrt(20*grip*aero/k));return target;
}
// Pure pursuit on the planner's lane (carried along the racing line to the look-ahead point):
// body-frame aim means the AI countersteers on its own when the rear steps out and the nose
// swings past the target.
function ai62Drive(L,x,plan,dt){
 const W=sc25Engine,P=PH47,s=ph47State(x),len=L.e.lengthKm*1000,a=x.ai62,vx=x.v||0,vy=x.latV||0,sp=Math.hypot(vx,vy);
 const look=clamp(6+Math.abs(vx)*AI62.look,7,42),q=W.at(x.progress+look/len),lane=plan.lane,aim=ai68Aim(W,x.progress+look/len,x.progress,lane),tx=q.p.x+q.n.x*aim-x.pos.x,tz=q.p.z+q.n.z*aim-x.pos.z;
 const fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),lx=tx*fx+tz*fz,ly=tx*Math.cos(x.yaw)-tz*Math.sin(x.yaw);
 let steer;const dmax=.58/(1+Math.abs(vx)*.11);
 if(lx<1){steer=Math.sign(ly||1);}else{const kappa=2*ly/(lx*lx+ly*ly),delta=Math.atan((P.a+P.b)*kappa)*(1+Math.abs(vx)*AI62.gain)-(s.r-Math.abs(vx)*kappa)*AI62.damp;steer=clamp(delta/dmax,-1,1);}
 // On the line at speed, track it closely instead: the line's own curvature as feed-forward plus
 // heading and front-axle offset corrections (Stanley). Pure pursuit turns in early by half its
 // look-ahead, which on a full-width line means an early apex and running out of road on exit.
 const tr=vx>8&&AI62.track?ai62Track(W,x,plan,vx,s,len):null;if(tr&&Math.abs(tr.ey)<3&&Math.abs(tr.eh)<.45)steer=clamp(tr.delta/dmax,-1,1);
 // Speed: the planner's target, capped by what the tyres can do, with braking feed-forward.
 // The race AI's speed targets come from a reference speed trace that the path model rescales
 // to the real lap time, so on the tyre model the free target is what the tyres can carry.
 // Anything that pulls the planner below its own free target (traffic, safety car, pit
 // approach, formation, a driver error, damage limits) still applies as an absolute speed.
 const base=Number.isFinite(x.ai62Target)?x.ai62Target:plan.v,free=ai62FreeTarget(L,x);let target=Math.min(ai62CornerCap(L,x),(318-(x.aero??50)*.36)/3.6);
 if(base<free-.5)target=Math.min(target,base);if(plan.v<Math.min(base,vx)-.6)target=Math.min(target,plan.v);
 const lost=lx<1||Math.abs(Math.atan2(ly,lx))>1.1;if(lost)target=Math.min(target,7);
 if(s.grass>=2)target=Math.min(target,Math.max(14,vx-4));
 // Lift when the fronts are at the limit and the car is still running wide of the line.
 // Not while pointing away from the line at low speed (after a spin): that is full lock by
 // design, and lifting there left the car parked on the brakes.
 const wide=Math.abs(lane-x.lane)>1.2&&Math.sign(ly)===Math.sign(steer);if(!lost&&vx>8&&(Math.abs(steer)>.92&&wide||s.slideF>.03))target=Math.min(target,Math.max(6,vx-1.5-Math.abs(lane-x.lane)*.6));
 const slope=(target-a.lastT)/Math.max(dt,1e-3);a.lastT=target;
 const err=target-vx;let throttle=0,brake=0;
 if(err>-.4)throttle=clamp(.3+err*AI62.tgain,0,1);
 if(err<-.8)brake=clamp((-err-.8)*AI62.bgain+(slope<-1?-slope/22:0),0,1);
 if(Math.abs(vy)>3.5&&sp>8)throttle*=.55;
 // Trail braking inside the friction circle: release the brake as cornering load builds, and
 // come off the pedals when the rear is past its peak slip, so turn-in does not spin the car.
 if(AI62.trail&&sp>6){const lat=Math.abs(s.ay)/(P.mu*dcTyreGrip(x)*P.g),over=Math.abs(s.ar)>P.peakR*1.05;brake*=clamp(1+AI62.trail*(.35-lat),.25,1);if(over){brake=Math.min(brake,.25);throttle*=.5;}}
 return{steer,throttle,brake,ai:true};
}
function ai62Track(W,x,plan,vx,s,len){
 const P=PH47,pre=vx*AI62.preview,at=f=>{const q=W.at(f),l=ai68Aim(W,f,x.progress,plan.lane);return{x:q.p.x+q.n.x*l,z:q.p.z+q.n.z*l};};
 const fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),ax=x.pos.x+fx*(P.a+pre),az=x.pos.z+fz*(P.a+pre);
 // Project the preview point onto the track: off-centre through a corner the car covers less (or
 // more) road than the centreline, and a fixed phase step made it turn in early on the inside.
 let ph=x.progress+(P.a+pre)/len;for(let n=0;n<2;n++){const q=W.at(ph);ph+=((ax-q.p.x)*q.v.x+(az-q.p.z)*q.v.z)/len;}
 const c=at(ph),a=at(ph-2/len),b=at(ph+2/len),hp=Math.atan2(b.x-a.x,b.z-a.z);
 const ey=(c.x-ax)*Math.cos(x.yaw)-(c.z-az)*Math.sin(x.yaw),eh=dcWrapAngle(hp-x.yaw),k=ai68Off(W,x.progress,plan.lane)?dcTrackCurvature(W,ph):ai68Curv(W,ph);
 const delta=Math.atan((P.a+P.b)*k)*(1+vx*AI62.gain)+eh*AI62.kh+Math.atan(AI62.ke*ey/(vx+3))-(s.r-vx*k)*AI62.tdamp;
 return{delta,ey,eh};
}
// Race-control mistakes play out in the tyre model instead of a scripted slide.
function ai62Mistake(L,x,incident,input,dt){
 const a=x.ai62;incident.age+=dt;const t=incident.age;
 // Severity varies per mistake: most are a big slide that gets caught, the worst become a spin.
 const sev=incident.ai62Sev??(incident.ai62Sev=.45+.55*(Math.sin((x.seed||1)*12.9898+(x.rf40Mistakes||0)*78.233)*.5+.5));
 if(incident.type==='wall'){const low=1-.42*sev;a.assist=t<2.2?AI62.loose:AI62.assist;a.rear=t<.3?1-(1-low)*t/.3:t<.4+sev?low:Math.min(1,low+(t-.4-sev)*.8);if(t<.35+.6*sev){input.throttle=1;input.brake=0;input.steer*=1-.6*sev;}}
 else{a.assist=t<1.4?AI62.lock:AI62.assist;a.rear=1;if(t<.4+.5*sev){input.brake=1;input.throttle=0;}}
 if(t>7){delete x.rf40Incident;x.rf40AILateral=0;x.aiError=0;a.assist=AI62.assist;a.rear=1;}
}
// The solver asks for the nearest track pose at the start and end of each step; for AI cars the
// end-of-step answer is reused next frame when nothing has moved the car in between.
const ai62Near=dcNearestPose;
dcNearestPose=function(x){
 const a=x?.ai62;if(!a||!x.pos)return ai62Near(x);const c=a.near;if(c&&c.x===x.pos.x&&c.z===x.pos.z&&c.yaw===x.yaw)return c.q;
 const q=ai62Near(x);a.near={x:x.pos.x,z:x.pos.z,yaw:x.yaw,q};return q;
};
const ai62AI=dcAIStep;
dcAIStep=function(x,dt){
 const L=live;if(!L||!sc25Engine)return ai62AI(x,dt);
 if(!ai62Wanted(L,x)){if(x.ai62)ai62Leave(x);return ai62AI(x,dt);}
 if(!x.ai62)ai62Enter(L,x);
 const keep={progress:x.progress,lane:x.lane,pos:{...x.pos},yaw:x.yaw,v:x.v,idx:x.idx,steer:x.steer,latV:x.latV,loadTransfer:x.loadTransfer},incident=x.rf40Incident;
 // Plan: run the race AI on the car's real state, read where it wants to go, then put the car back.
 // The planner keeps its own lane (where it wants the car), so a car pushed wide is steered back.
 x.rf40Incident=null;x.ai62Target=undefined;x.v=Math.max(0,keep.v);const planLane=x.ai62.lane??keep.lane;x.lane=planLane;
 ai62AI(x,dt);
 if(incident&&!x.rf40Incident)x.rf40Incident=incident;
 x.ai62.lane=ai68Clamp(sc25Engine,x.progress,x.lane);const plan={lane:x.ai62.lane,v:x.v},len=L.e.lengthKm*1000,jump=Math.abs(x.progress-keep.progress)*len>Math.max(6,Math.abs(keep.v)*dt*3+4)||Math.abs(x.lane-planLane)>3;
 if(x.pitStage||x.outlapHold||x.retired||x.finished||jump){ai62Leave(x);return;}
 Object.assign(x,keep);x.pos=keep.pos;x.v=keep.v;
 const input=ai62Drive(L,x,plan,dt);if(x.rf40Incident)ai62Mistake(L,x,x.rf40Incident,input,dt);
 dc32FreeDrive(x,dt,input);
 if(!x.ph47On){ai62Leave(x);return;}
 x.speed=Math.hypot(x.v,x.latV||0)*3.6;x.idx=Math.round(sc25Engine.at(x.progress).t*sc25Engine.N)%sc25Engine.N;
};
// Settings: AI physics on (default), or the light path model for slower machines.
const ai62Settings=dcSettingsFields;
dcSettingsFields=function(...args){
 return ai62Settings(...args)+`<div class="dc-card" style="margin-top:18px"><h3>AI cars</h3><label class="dc-checkbox"><input type="checkbox" ${D.settings.ai62Off?'':'checked'} onchange="D.settings.ai62Off=!this.checked;dcSave()">AI cars drive the full car physics near you</label><p class="dc-muted">Rivals within about 350 m use the same tyre model as your car, so they slide, lock up, spin and react to contact like you do. Untick on a slow machine to put them back on the lighter path model.</p></div>`;
};
// Quasi-steady lap on the tyre model along the racing line (corner limits, then power and
// braking passes). The path model's pace is scaled to it, so cars far away lap at the same speed the physics allows.
function ai62LapEstimate(W,e){
 const P=PH47,len=e.lengthKm*1000,N=Math.max(200,Math.round(len/4)),ds=len/N*(W.ai68?.ratio||1),mass=1365,aero=50,kd=P.cl*(1+aero/100*.9),cd=P.cd*(1+aero*.009),mu=P.mu*(AI62.use+.03),top=(318-aero*.36)/3.6,v=new Float64Array(N);
 for(let i=0;i<N;i++){const k=Math.abs(ai68Curv(W,i/N)),den=k-mu*kd/mass;v[i]=Math.min(top,k<1e-5||den<=1e-6?top:Math.sqrt(mu*P.g/den));}
 for(let pass=0;pass<2;pass++){for(let i=0;i<2*N;i++){const a=i%N,b=(i+1)%N,u=v[a],acc=Math.min(P.drive,P.power/Math.max(4,u))/mass-cd*u*u/mass-.12;v[b]=Math.min(v[b],Math.sqrt(Math.max(0,u*u+2*acc*ds)));}
  for(let i=2*N;i>0;i--){const a=i%N,b=(i-1+N)%N,u=v[a],dec=mu*P.g*.85+(kd*mu*.85+cd)*u*u/mass;v[b]=Math.min(v[b],Math.sqrt(u*u+2*dec*ds));}}
 let t=0;for(let i=0;i<N;i++)t+=ds/Math.max(1,v[i]);return t;
}
const ai62Launch=dcLaunch;
dcLaunch=function(...args){const r=ai62Launch(...args),L=live,W=sc25Engine;if(!L?.dc||!W)return r;for(const x of L.entrants)if(x.ai62)x.ai62=null;
 const cache=W.ai62Lap||(W.ai62Lap={});if(!cache[L.e.key])cache[L.e.key]=ai62LapEstimate(W,L.e);L.ai62Pace=D.settings.ph47Classic||D.settings.ai62Off?1:clamp(cache[L.e.key]/L.e.realLap,.9,1.25);return r;};
