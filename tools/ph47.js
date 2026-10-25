/* PH47 driving physics. The player car runs on a tyre-force model with weight transfer,
   per-wheel surfaces, rigid-body wall impacts and rollovers. Cosmetic layer: skid marks,
   tyre smoke, grass spray, sparks, camera shake, tyre/scrape audio and controller rumble.
   Settings → Handling switches assists or restores the classic model. Saves are untouched:
   all new state lives in x.ph47, which is not a snapshot key. */
const PH47={g:9.81,a:1.36,b:1.46,h:.46,track:1.62,width:1.0,height:.66,power:380000,drive:9500,brake:30000,bias:.66,mu:1.95,cd:.62,cl:.55,peakF:.115,peakR:.11,relax:.45,rollFront:.58,sub:3};
const PH47_UP=new THREE.Vector3(0,1,0),PH47_TMP={yaw:new THREE.Quaternion(),tilt:new THREE.Quaternion(),roll:new THREE.Quaternion(),fwd:new THREE.Vector3()};
const PH47_ASSISTS={
 full:{label:'Full',tc:.94,abs:true,steer:1.05,counter:.8,align:1,esc:7,cut:true},
 standard:{label:'Standard',tc:1,abs:true,steer:1.3,counter:.45,align:.9,esc:3},
 off:{label:'Off',tc:0,abs:false,steer:0,counter:0,align:.7,esc:1}
};
function ph47Assist(){return PH47_ASSISTS[D?.settings?.ph47Assist]||PH47_ASSISTS.standard;}
function ph47State(x){return x.ph47||(x.ph47={r:0,delta:0,fyf:0,fyr:0,ax:0,ay:0,af:0,ar:0,lockF:0,lockR:0,spin:0,slideF:0,slideR:0,phi:0,phiV:0,tumble:0,rest:0,shake:0,wall:0,scrape:0,kerb:0,grass:0,hop:0,hopV:0,wheels:[],tilt:null});}
function ph47MF(alpha,peak,shape){const B=Math.tan(Math.PI/(2*shape))/peak;return Math.sin(shape*Math.atan(B*alpha));}

// Grass verges are drawn 12 cm under the tarmac; physics and wheel contact now use them
// instead of the terrain 43 cm further down, so cars no longer tip into the grass.
const ph47Ribbon=SC25World.prototype.ribbon;
SC25World.prototype.ribbon=function(samples,offset,width,mat,lift=0,...rest){
 const mesh=ph47Ribbon.call(this,samples,offset,width,mat,lift,...rest);
 if(samples===this.samples&&Math.abs(Math.abs(offset)-10.5)<.01&&Math.abs(width-7)<.01&&lift<0)(this.ph47Verges||=[]).push(mesh);
 return mesh;
};
function ph47VergeIndex(W){
 if(W.ph47VergeIndex)return W.ph47VergeIndex;const grid=new Map(),cell=18;
 for(const mesh of W.ph47Verges||[]){const g=mesh.geometry,p=g.attributes.position,ix=g.index;if(!ix)continue;for(let j=0;j<ix.count;j+=3){const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(j)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(j+1)),c=new THREE.Vector3().fromBufferAttribute(p,ix.getX(j+2)),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(normal.y<0)normal.negate();const tri={a,b,c,den,normal};for(let x=Math.floor(Math.min(a.x,b.x,c.x)/cell);x<=Math.floor(Math.max(a.x,b.x,c.x)/cell);x++)for(let z=Math.floor(Math.min(a.z,b.z,c.z)/cell);z<=Math.floor(Math.max(a.z,b.z,c.z)/cell);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(tri);}}}
 return W.ph47VergeIndex={grid,cell};
}
function ph47VergeAt(W,x,z,y){
 if(!W.ph47Verges?.length)return null;const index=ph47VergeIndex(W),rows=index.grid.get(Math.floor(x/index.cell)+','+Math.floor(z/index.cell));if(!rows)return null;let best=null,score=Infinity;
 for(const t of rows){const {a,b,c,den}=t,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;const h=u*a.y+v*b.y+w*c.y,s=Math.abs(h-y);if(s<score){score=s;best={y:h+.01,normal:t.normal,route:'verge'};}}
 return best;
}
const ph47BaseSurface=gr27Surface;
gr27Surface=function(W,x,z,y=0,pit=false,terrain=true){
 const s=ph47BaseSurface(W,x,z,y,pit,false);if(s)return s;const v=ph47VergeAt(W,x,z,y);if(v)return v;
 return terrain?{y:gr26SceneryGround(W,x,z)+.12,normal:PH47_UP,route:'terrain'}:null;
};
function ph47Kerbs(W){
 if(W.ph47Kerbs)return W.ph47Kerbs;const N=W.N,k=new Uint8Array(N+2);
 for(let i=0;i<N;i++){const e=i-(i%2),t=Math.acos(clamp(W.samples[(e+8)%N].v.dot(W.samples[(e-8+N)%N].v),-1,1));k[i]=t>.12?1:0;}
 return W.ph47Kerbs=k;
}
// Grip, rolling drag and bump for one wheel. Lane is metres from the centreline.
function ph47WheelSurface(W,L,x,lane,ground,pit){
 const wet=L.weather!=='Dry',extreme=L.weather==='Extremely Wet',abs=Math.abs(lane);
 if(pit||ground.route==='pit')return{kind:'road',mu:1,drag:0,bump:0};
 if(ground.route==='track'&&abs<7.15)return{kind:'road',mu:1,drag:0,bump:0};
 if(abs<8.35&&ph47Kerbs(W)[x.idx||0])return{kind:'kerb',mu:wet?.74:.93,drag:.006,bump:1};
 if(ground.route==='track')return{kind:'road',mu:.97,drag:0,bump:0};
 return{kind:'grass',mu:extreme?.36:wet?.44:.58,drag:.075,bump:.45};
}

const ph47Classic=dc32FreeDrive;
dc32FreeDrive=function(x,dt,input){
 const W=sc25Engine,L=live;if(!L||!W||x.outlapHold)return;
 if(D.settings.ph47Classic||(x.releaseDelay||0)>0||x.rf40Reverse||x!==L.player){x.ph47On=false;if(x.ph47){x.ph47.r=0;x.ph47.tumble=0;x.ph47.phi=0;}return ph47Classic(x,dt,input);}
 x.ph47On=true;const P=PH47,A=ph47Assist(),s=ph47State(x),near=dcNearestPose(x),wet=L.weather!=='Dry';
 let throttle=clamp(+input.throttle||0,0,1),brake=clamp(+input.brake||0,0,1),steerIn=clamp(+input.steer||0,-1,1);
 if(L.pad)steerIn=Math.sign(steerIn)*Math.pow(Math.abs(steerIn),1.35);
 if(L.stage==='race'&&L.phase==='formation'&&Number.isFinite(x.formationTarget)){const remaining=Math.max(0,(x.formationTarget-x.progress)*L.e.lengthKm*1000),cap=Math.sqrt(Math.max(0,2*2.7*remaining));if(x.v>cap+1){throttle=0;brake=Math.max(brake,.8);}}
 if(s.tumble){throttle=0;brake=0;steerIn=0;}
 x.braking=brake>.1;x.throttle=throttle;
 const mass=1335+(x.fuel||0)*.75,Iz=mass*P.a*P.b*.95,Lw=P.a+P.b,dmg=x.bodyDamage||0,engine=dmg>20?1-(dmg-20)*.006:1,aeroLoss=1-clamp((dmg-15)/85,0,1)*.35,aero=x.aero??50;
 const grip=dcTyreGrip(x),kd=P.cl*(1+aero/100*.9)*aeroLoss,cd=P.cd*(1+aero*.009)*(1+dmg*.002),shape=L.weather==='Extremely Wet'?1.62:wet?1.55:1.45;
 const grade=gr27Grade(W,x,near),slope=Math.sin(Math.atan(grade));
 // Surfaces under the four contact patches: FL, FR, RL, RR (+lat is the car's left).
 const yaw0=x.yaw,fx0=Math.sin(yaw0),fz0=Math.cos(yaw0),gx0=Math.cos(yaw0),gz0=-Math.sin(yaw0),half=P.track/2,wheels=s.wheels;
 for(let i=0;i<4;i++){const lon=i<2?P.a:-P.b,lat=i%2?-half:half,X=x.pos.x+fx0*lon+gx0*lat,Z=x.pos.z+fz0*lon+gz0*lat,lane=near.lane+(X-x.pos.x)*near.n.x+(Z-x.pos.z)*near.n.z,ground=gr27Surface(W,X,Z,x.pos.y,!!near.pit),surf=ph47WheelSurface(W,L,x,lane,ground,!!near.pit);wheels[i]={lon,lat,x:X,z:Z,y:ground.y,lane,...surf};}
 s.kerb=wheels.filter(w=>w.kind==='kerb').length;s.grass=wheels.filter(w=>w.kind==='grass').length;
 let vx=x.v||0,vy=x.latV||0,r=s.r||0;const h=dt/P.sub;let lockF=0,lockR=0,spin=0,tc=0;
 const fault=x.rf41Wheel?(x.rf41Wheel.name.endsWith('L')?1:-1)*.012*(1+x.rf41Wheel.toe*2):0;
 for(let step=0;step<P.sub;step++){
  const sp=Math.abs(vx),sgn=vx>=0?1:-1,v2=vx*vx+vy*vy,den=Math.max(2.5,sp);
  // Steering: speed-sensitive lock, self-aligning wheels when released, assisted countersteer.
  const dmax=.58/(1+sp*.11),betaF=Math.atan2(vy+P.a*r,den)*sgn,betaR=Math.atan2(vy-P.b*r,den)*sgn,free=1-Math.min(1,Math.abs(steerIn)*1.6);
  let target=steerIn*dmax*(D.settings.sensitivity||1)+free*betaF*A.align+fault;
  if(A.counter&&Math.abs(betaR)>P.peakR*.6)target+=A.counter*(betaR-Math.sign(betaR)*P.peakR*.6);
  if(A.steer&&sp>4){const lim=A.steer*P.peakF;target=clamp(target,betaF-lim,betaF+lim);}
  s.delta+=(clamp(target,-.62,.62)-s.delta)*(1-Math.exp(-h*(L.pad?12:8)));const delta=s.delta,sinD=Math.sin(delta),cosD=Math.cos(delta);
  // Normal loads: static split, downforce, lagged pitch and roll transfer.
  const down=kd*v2,FzF=mass*P.g*P.b/Lw+down*.45-mass*s.ax*P.h/Lw,FzR=mass*P.g*P.a/Lw+down*.55+mass*s.ax*P.h/Lw,lat=mass*s.ay*P.h/P.track,nom=(mass*P.g+down)/4;
  const Fz=[FzF/2-lat*P.rollFront,FzF/2+lat*P.rollFront,FzR/2-lat*(1-P.rollFront),FzR/2+lat*(1-P.rollFront)];let Df=0,Dr=0,drag=0,yawDrag=0;
  for(let i=0;i<4;i++){const z=Math.max(0,Fz[i]),w=wheels[i],mu=P.mu*grip*w.mu*clamp(1-.10*(z/nom-1),.55,1.12),d=mu*z;if(i<2)Df+=d;else Dr+=d;if(w.drag){const f=w.drag*z*(1+sp*.02)*sgn;drag+=f;yawDrag+=w.lat*f;}}
  // Longitudinal: rear drive, front-biased brakes, engine braking. Assists cap at the tyre limit.
  const drive=throttle*Math.min(P.drive,P.power/Math.max(4,sp))*engine*(x.fuel>0?1:0),engineBrake=throttle<.05&&sp>4?(700+sp*14):0,brakeF=brake*P.brake;
  let Fxf=-brakeF*P.bias*sgn,Fxr=drive-(brakeF*(1-P.bias)+engineBrake)*sgn;
  if(sp<.6&&brake>.1&&throttle<.05){Fxf=0;Fxr=0;vx*=Math.exp(-h*25);}
  // Assists budget the friction circle: they keep a share of grip for the cornering force in use.
  const keepF=Df*Math.cos(clamp(Math.abs(s.af)/P.peakF,0,1)*1.3),keepR=Dr*Math.cos(clamp(Math.abs(s.ar)/P.peakR,0,1.15)*1.3)*.97;
  if(A.abs&&Math.abs(Fxf)>keepF*.97)Fxf=Math.sign(Fxf)*keepF*.97;else if(Math.abs(Fxf)>Df*.98){lockF=1;Fxf=Math.sign(Fxf)*Df*.8;}
  if(A.tc&&Fxr>keepR*A.tc){Fxr=keepR*A.tc;tc=1;}else if(Fxr>Dr*.98){spin=Math.min(1,(Fxr-Dr)/Dr*2+.35);Fxr=Dr*.84;}
  else if(A.abs&&Fxr<-keepR*.97)Fxr=-keepR*.97;else if(Fxr<-Dr*.98){lockR=1;Fxr=-Dr*.8;}
  if(A.cut&&Math.abs(betaR)>P.peakR*1.1&&throttle>.2){const cut=clamp((Math.abs(betaR)-P.peakR*1.1)*4,0,.7);Fxr=Math.min(Fxr,Math.max(0,drive*(1-cut)));}
  const Dyf=Math.sqrt(Math.max(0,Df*Df-Fxf*Fxf))*(lockF?.28:1),Dyr=Math.sqrt(Math.max(0,Dr*Dr-Fxr*Fxr))*(lockR?.28:1)*(1-.45*spin);
  // Lateral: magic-formula curve with relaxation length; grip peaks then falls away as it slides.
  const aF=Math.atan2(vy+P.a*r,den)-delta*sgn,aR=Math.atan2(vy-P.b*r,den),relax=Math.min(1,(sp+2)*h/P.relax);s.af+=(aF-s.af)*relax;s.ar+=(aR-s.ar)*relax;
  const Fyf=-Dyf*ph47MF(s.af,P.peakF,shape),Fyr=-Dyr*ph47MF(s.ar,P.peakR,shape);s.fyf=Fyf;s.fyr=Fyr;const speed=Math.sqrt(v2)||1,aeroDrag=cd*speed,roll=sp>.3?mass*P.g*.012*sgn:0;
  let Fx=Fxf*cosD-Fyf*sinD+Fxr-aeroDrag*vx-roll-drag-mass*P.g*slope,Fy=Fxf*sinD+Fyf*cosD+Fyr-aeroDrag*vy;
  let Mz=P.a*(Fxf*sinD+Fyf*cosD)-P.b*Fyr+yawDrag;
  // Stability: a yaw moment toward the steered yaw rate once the rear lets go (brake-based ESC).
  if(A.esc&&vx>6){const rmax=P.mu*grip*P.g*1.05/sp,rref=clamp(sp*Math.tan(delta)/(Lw*(1+.0016*sp*sp)),-rmax,rmax),err=r-rref;if(err*Math.sign(r)>.03||Math.abs(Math.atan2(vy,sp))>.08)Mz-=A.esc*err*Iz;}
  if(s.tumble&&Math.abs(s.phi)>.35){const mu=.55,k=mu*mass*P.g/Math.max(.5,speed);Fx=-k*vx-mass*P.g*slope;Fy=-k*vy;Mz=-r*Iz*1.4;}
  vx+=(Fx/mass+r*vy)*h;vy+=(Fy/mass-r*vx)*h;r+=Mz/Iz*h;
  // Below walking pace blend to the kinematic model so the car parks cleanly.
  if(v2<16&&!s.tumble){const k=clamp((Math.sqrt(v2)-1)/3,0,1),rk=vx*Math.tan(delta)/Lw;r=rk+(r-rk)*k;vy*=k+(1-k)*Math.exp(-h*12);}
  r=clamp(r,-6,6);
  s.ax+=(Fx/mass-s.ax)*(1-Math.exp(-h*7));s.ay+=(Fy/mass-s.ay)*(1-Math.exp(-h*9));
  x.yaw+=r*h;const fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),gx=Math.cos(x.yaw),gz=-Math.sin(x.yaw);x.pos.x+=(fx*vx+gx*vy)*h;x.pos.z+=(fz*vx+gz*vy)*h;
 }
 const top=near.pit&&near.pitLimited!==false?60/3.6:(318-aero*.36)/3.6;if(vx>top)vx=top;if(x.fuel<=0&&vx>0)vx=Math.max(0,vx-2*dt);
 s.r=r;s.lockF=lockF;s.lockR=lockR;s.spin=spin;s.tc=tc;s.slideF=Math.max(0,Math.abs(s.af)-P.peakF*1.25);s.slideR=Math.max(0,Math.abs(s.ar)-P.peakR*1.25);
 x.v=vx;x.latV=vy;x.steer=-s.delta;x.loadTransfer=clamp(Math.abs(s.ay)/9.81*.085,0,.16);
 const after=dcNearestPose(x);let delta=after.t-(((x.progress%1)+1)%1);if(delta<-.5)delta++;if(delta>.5)delta--;if(Math.abs(delta)<.05)x.progress+=delta;x.lane=after.lane;
 const ground=after.pit||Math.abs(after.lane)<7.1?after.p.y:gr27Surface(W,x.pos.x,x.pos.z,x.pos.y,false).y;x.pos.y=Math.abs(ground-x.pos.y)>1.5?ground:x.pos.y+(ground-x.pos.y)*Math.min(1,dt*14);
 if(!after.pit&&Math.abs(after.lane)>7.5&&Math.abs(x.v)>10&&L.elapsed-(x.cutAt||-20)>8){x.cutAt=L.elapsed;x.penalty+=2;dcRadio('Race control','Track limits. Two seconds added to this lap.');}
 ph47Walls(W,L,x,s,after,mass,Iz,dt);ph47Tumble(W,L,x,s,dt,mass);
 x.speed=Math.hypot(x.v,x.latV)*3.6;
 if(!after.pit&&L.stage==='race'&&L.phase==='formation'&&x.progress>=x.formationTarget){x.progress=x.formationTarget;x.v=x.speed=0;x.latV=0;s.r=0;x.outlapHold=true;const q=W.at(x.progress);x.lane=x.formationLane;x.pos={x:q.p.x+q.n.x*x.lane,y:q.p.y,z:q.p.z+q.n.z*x.lane};x.yaw=Math.atan2(q.v.x,q.v.z);}
 ph47Feedback(L,x,s);
};

// Rigid-body wall contact on the deepest corner: restitution, wall friction and a yaw kick.
// Lane of the barrier line (metres from the centreline). Circuits with their own walls override it.
function ph47WallLane(W,L,x,near){return ['goldcoast','adelaide','townsville','homebush'].includes(L.e.key)?9:16;}
function ph47Walls(W,L,x,s,near,mass,Iz,dt){
 s.scrape=Math.max(0,s.scrape-dt*4);if(near.pit||dc32Mouth(W,x.pos))return;
 const wall=ph47WallLane(W,L,x,near);if(Math.abs(near.lane)<wall-3.2)return;
 const side=Math.sign(near.lane)||1,ox=near.n.x*side,oz=near.n.z*side,l=DC33_HALF_LENGTH[x.team?.manufacturer]||2.45,w=PH47.width,fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),gx=Math.cos(x.yaw),gz=-Math.sin(x.yaw);
 let pen=0,rx=0,rz=0,cl=0,cw=0;
 for(const a of [l,-l])for(const b of [w,-w]){const px=fx*a+gx*b,pz=fz*a+gz*b,p=(near.lane+px*near.n.x+pz*near.n.z)*side-wall;if(p>pen){pen=p;rx=px;rz=pz;cl=a;cw=b;}}
 if(pen<=0)return;
 x.pos.x-=ox*pen;x.pos.z-=oz*pen;x.lane-=side*pen;
 let Vx=fx*x.v+gx*x.latV,Vz=fz*x.v+gz*x.latV,r=s.r;
 const vn=(Vx+r*rz)*ox+(Vz-r*rx)*oz;
 if(vn>0){
  const street=wall<10,e=street?.26:.32,cross=rz*ox-rx*oz,j=(1+e)*vn/(1/mass+cross*cross/Iz);
  Vx-=ox*j/mass;Vz-=oz*j/mass;r-=cross*j/Iz;
  const tx=-oz,tz=ox,crossT=rz*tx-rx*tz,vt=(Vx+r*rz)*tx+(Vz-r*rx)*tz,jt=clamp(-vt/(1/mass+crossT*crossT/Iz),-.5*j,.5*j);
  Vx+=tx*jt/mass;Vz+=tz*jt/mass;r+=crossT*jt/Iz;
  const hit=vn;x.v=Vx*fx+Vz*fz;x.latV=Vx*gx+Vz*gz;s.r=clamp(r,-6,6);
  if(hit>2.5){const amount=clamp((hit-2.5)*1.5,1,60);dcDamage(x,amount,Math.sign(cw)||1,Math.sign(cl)||1);ph47Impact(L,x,x.pos.x+rx,x.pos.y+.35,x.pos.z+rz,hit,ox,oz);
   if(hit>24&&Math.abs(ox*gx+oz*gz)>.75&&!s.tumble)ph47StartTumble(x,s,(ox*gx+oz*gz)*Math.min(9,hit*.2));}
 }else{const vt=Math.abs((Vx+r*rz)*-oz+(Vz-r*rx)*ox);if(vt>6){s.scrape=Math.min(1,vt/30);x.v*=Math.exp(-dt*.35);if(Math.random()<dt*14)ph47Sparks(sc25Engine,x.pos.x+rx,x.pos.y+.3,x.pos.z+rz,Vx*.6,Vz*.6,4);}}
}
// Rollover: the body rolls about its long axis over the edges of a box; settles upright,
// on its side or on the roof. Marshals right a stranded car after three seconds.
function ph47StartTumble(x,s,omega){s.tumble=1;s.phiV=omega;s.rest=0;s.hopV=Math.min(4.5,Math.abs(omega)*.55);s.lastFace=0;if(x===live?.player)dcRadio('Race engineer','Big roll! Are you OK?');}
function ph47Tumble(W,L,x,s,dt,mass){
 const P=PH47;
 if(!s.tumble){if(s.grass>=3&&Math.abs(x.latV)>23&&Math.abs(x.latV)>Math.abs(x.v)*.85)ph47StartTumble(x,s,Math.sign(x.latV)*(Math.abs(x.latV)-16)*.5);s.hop=Math.max(0,s.hop+s.hopV*dt);s.hopV=s.hop>0?s.hopV-9.81*dt:0;return;}
 const w=P.width,hb=P.height,R2=w*w+hb*hb;let left=dt;
 while(left>1e-6){const h=Math.min(1/240,left);left-=h;const ph=s.phi,sn=Math.sin(ph),cs=Math.cos(ph),dH=w*cs*Math.sign(sn||1)-hb*sn*Math.sign(cs||1);s.phiV+=(-P.g*dH/(R2*1.25)-s.phiV*.9)*h;s.phi+=s.phiV*h;
  const face=Math.round(s.phi/(Math.PI/2));if(face!==s.lastFace){s.lastFace=face;if(Math.abs(s.phiV)>1.2){dcDamage(x,clamp(8+Math.abs(s.phiV)*5,8,35),Math.sign(s.phiV)||1,0);ph47Impact(L,x,x.pos.x,x.pos.y+.2,x.pos.z,Math.abs(s.phiV)*4,0,0);}}}
 s.hop=Math.max(0,s.hop+s.hopV*dt);s.hopV=s.hop>0?s.hopV-9.81*dt:0;
 if(Math.abs(s.phiV)<.35&&Math.abs(x.v)<3){const face=Math.round(s.phi/(Math.PI/2)),q=((face%4)+4)%4;
  if(q===0&&Math.abs(s.phi-face*Math.PI/2)<.12){s.tumble=0;s.phi=0;s.phiV=0;}
  else{s.rest+=dt;s.phi+=(face*Math.PI/2-s.phi)*Math.min(1,dt*6);if(s.rest>3&&!x.retired){s.tumble=0;s.phi=0;s.phiV=0;s.rest=0;x.latV=0;x.v=0;s.r=0;}}}
}
function ph47Feedback(L,x,s){
 const now=performance.now();if(now-(s.rumbleAt||0)<110)return;let strong=Math.min(1,s.shake*.9),weak=Math.min(1,s.kerb*.12+s.grass*.08+(s.lockF||s.lockR||s.spin?.25:0)+s.slideR*1.5+s.scrape*.4);
 if(Math.abs(x.v)<3)weak*=.3;if(strong<.02&&weak<.04)return;s.rumbleAt=now;
 try{const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);pad?.vibrationActuator?.playEffect?.('dual-rumble',{duration:130,strongMagnitude:strong,weakMagnitude:weak})?.catch?.(()=>{});}catch(_){}
}

// Rear-view, debris and contact damage stay in their existing layers; this keeps the
// solver's velocity and yaw rate in step with car-to-car impulses.
const ph47Collisions=dcCollisions;
dcCollisions=function(dt){
 ph47Collisions(dt);const L=live,p=L?.player;if(!p?.ph47On||L.dc33Auto)return;
 const ix=p.dc33ImpactX||0,iz=p.dc33ImpactZ||0,w=p.dc33Angular||0;if(Math.abs(ix)+Math.abs(iz)+Math.abs(w)<1e-6)return;
 const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw),gx=Math.cos(p.yaw),gz=-Math.sin(p.yaw),Vx=fx*p.v+gx*(p.latV||0)+ix,Vz=fz*p.v+gz*(p.latV||0)+iz;
 p.v=Vx*fx+Vz*fz;p.latV=Vx*gx+Vz*gz;ph47State(p).r=clamp((p.ph47.r||0)+w,-6,6);p.dc33ImpactX=p.dc33ImpactZ=p.dc33Angular=0;
};
const ph47Resolve=dc33Resolve;
dc33Resolve=function(a,b,hit,damage){
 const va=dc33Velocity(a.x),vb=dc33Velocity(b.x);ph47Resolve(a,b,hit,damage);const na=dc33Velocity(a.x),change=Math.hypot(na.x-va.x,na.z-va.z)+Math.hypot(dc33Velocity(b.x).x-vb.x,dc33Velocity(b.x).z-vb.z);
 if(change>2.2&&live){const c=dc33Closest(a,b.px,b.pz),y=(a.x.pos.y+b.x.pos.y)/2+.35,player=live.player;if(a.x===player||b.x===player)ph47Impact(live,player,c.x,y,c.z,change*.8,hit.nx,hit.nz);else ph47Sparks(sc25Engine,c.x,y,c.z,(va.x+vb.x)/2,(va.z+vb.z)/2,Math.min(14,change*2));}
};
const ph47Damage=dcDamage;
dcDamage=function(x,amount,side=1,z=1){
 const L=live,before=x.bodyDamage;ph47Damage(x,amount,side,z);
 if(L&&x!==L.player&&x.bodyDamage>before&&amount>=8&&x.pos)ph47Sparks(sc25Engine,x.pos.x+Math.cos(x.yaw)*side,x.pos.y+.35,x.pos.z-Math.sin(x.yaw)*side,Math.sin(x.yaw)*x.v*.6,Math.cos(x.yaw)*x.v*.6,Math.min(26,amount*1.2));
};
function ph47Impact(L,x,X,Y,Z,hit,nx,nz){
 const W=sc25Engine,s=ph47State(x);s.shake=Math.min(1.6,s.shake+hit*.045);ph47Sparks(W,X,Y,Z,Math.sin(x.yaw)*x.v*.5-nx*hit*.3,Math.cos(x.yaw)*x.v*.5-nz*hit*.3,Math.min(46,8+hit*1.6));
 if(hit>9)ph47Puff(W,X,Y,Z,Math.min(16,hit*.5),'#b9b4aa');ph47Crunch(hit);
}

// Pooled effects: one draw call each for skid marks, smoke/dust points and spark lines.
function ph47Fx(W){
 if(W.ph47Fx)return W.ph47Fx;const T=THREE,MARKS=1400,SMOKE=220,SPARKS=180;
 const mg=new T.BufferGeometry(),mp=new Float32Array(MARKS*12),mc=new Float32Array(MARKS*16),mi=new Uint32Array(MARKS*6);
 for(let i=0;i<MARKS;i++){const a=i*4;mi.set([a,a+1,a+2,a+1,a+3,a+2],i*6);}
 mg.setAttribute('position',new T.BufferAttribute(mp,3).setUsage(T.DynamicDrawUsage));mg.setAttribute('color',new T.BufferAttribute(mc,4).setUsage(T.DynamicDrawUsage));mg.setIndex(new T.BufferAttribute(mi,1));
 const marks=new T.Mesh(mg,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));marks.frustumCulled=false;marks.renderOrder=1;
 const sg=new T.BufferGeometry(),sp=new Float32Array(SMOKE*3),ss=new Float32Array(SMOKE),sa=new Float32Array(SMOKE),sc=new Float32Array(SMOKE*3);
 sg.setAttribute('position',new T.BufferAttribute(sp,3).setUsage(T.DynamicDrawUsage));sg.setAttribute('size',new T.BufferAttribute(ss,1).setUsage(T.DynamicDrawUsage));sg.setAttribute('alpha',new T.BufferAttribute(sa,1).setUsage(T.DynamicDrawUsage));sg.setAttribute('tint',new T.BufferAttribute(sc,3).setUsage(T.DynamicDrawUsage));
 const smokeMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{scale:{value:400}},
  vertexShader:'attribute float size;attribute float alpha;attribute vec3 tint;varying float vA;varying vec3 vC;uniform float scale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(512.,size*scale/max(.1,-mv.z));vA=alpha;vC=tint;}',
  fragmentShader:'varying float vA;varying vec3 vC;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.;if(r>1.)discard;gl_FragColor=vec4(vC,vA*(1.-r)*(1.-r));}'});
 const smoke=new T.Points(sg,smokeMat);smoke.frustumCulled=false;smoke.renderOrder=3;
 const kg=new T.BufferGeometry(),kp=new Float32Array(SPARKS*6),kc=new Float32Array(SPARKS*6);kg.setAttribute('position',new T.BufferAttribute(kp,3).setUsage(T.DynamicDrawUsage));kg.setAttribute('color',new T.BufferAttribute(kc,3).setUsage(T.DynamicDrawUsage));
 const sparks=new T.LineSegments(kg,new T.LineBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));sparks.frustumCulled=false;sparks.renderOrder=4;
 W.scene.add(marks,smoke,sparks);
 return W.ph47Fx={marks,smoke,sparks,MARKS,SMOKE,SPARKS,markAt:0,markCount:0,dirty:false,puffs:Array.from({length:SMOKE},()=>({life:0})),puffAt:0,bits:Array.from({length:SPARKS},()=>({life:0})),bitAt:0,last:[null,null,null,null]};
}
function ph47Mark(F,a,b,width,color,alpha){
 const i=F.markAt;F.markAt=(F.markAt+1)%F.MARKS;F.markCount=Math.min(F.MARKS,F.markCount+1);const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,sx=-dz/len*width/2,sz=dx/len*width/2,p=F.marks.geometry.attributes.position.array,c=F.marks.geometry.attributes.color.array,o=i*12;
 p.set([a.x+sx,a.y,a.z+sz,a.x-sx,a.y,a.z-sz,b.x+sx,b.y,b.z+sz,b.x-sx,b.y,b.z-sz],o);for(let k=0;k<4;k++)c.set([color[0],color[1],color[2],alpha*(k<2?a.f:1)],i*16+k*4);F.dirty=true;
}
function ph47Puff(W,X,Y,Z,count,color,vx=0,vz=0,size=1){
 if(!W)return;const F=ph47Fx(W),c=new THREE.Color(color);for(let n=0;n<count;n++){const q=F.puffs[F.puffAt];F.puffAt=(F.puffAt+1)%F.SMOKE;Object.assign(q,{x:X+(Math.random()-.5)*.5,y:Y,z:Z+(Math.random()-.5)*.5,vx:vx*.25+(Math.random()-.5)*1.6,vy:.5+Math.random()*1.1,vz:vz*.25+(Math.random()-.5)*1.6,life:1.4+Math.random()*1.4,max:2.8,size:(.8+Math.random()*.7)*size,r:c.r,g:c.g,b:c.b});q.max=q.life;}
}
function ph47Sparks(W,X,Y,Z,vx,vz,count){
 if(!W)return;const F=ph47Fx(W);for(let n=0;n<count;n++){const q=F.bits[F.bitAt];F.bitAt=(F.bitAt+1)%F.SPARKS;const a=Math.random()*Math.PI*2,s=2+Math.random()*7;Object.assign(q,{x:X,y:Y,z:Z,vx:vx+Math.cos(a)*s,vy:1+Math.random()*4.5,vz:vz+Math.sin(a)*s,life:.25+Math.random()*.55});q.max=q.life;}
}
function ph47FxStep(W,L,dt){
 const F=ph47Fx(W),p=L.player,s=p?.ph47;
 if(s&&p.ph47On&&dt>0&&!p.garage){
  const speed=Math.hypot(p.v,p.latV||0),wet=L.weather!=='Dry';
  for(let i=0;i<4;i++){const w=s.wheels[i];if(!w)continue;const front=i<2,slide=front?s.slideF*6+s.lockF:s.slideR*6+Math.max(s.lockR,s.spin),onRoad=w.kind==='road'||w.kind==='kerb',now={x:w.x,y:w.y+.012,z:w.z,f:1};
   let mark=null;if(s.tumble&&Math.abs(s.phi)>.35)mark=null;else if(onRoad&&slide>.18&&speed>3)mark={c:[.03,.03,.03],a:clamp(slide*.55,.15,.62),wd:.27};else if(w.kind==='grass'&&speed>4)mark={c:[.19,.15,.09],a:clamp(speed/40,.15,.55),wd:.3};
   const last=F.last[i];if(mark&&last&&Math.hypot(now.x-last.x,now.z-last.z)<4){if(Math.hypot(now.x-last.x,now.z-last.z)>.35){ph47Mark(F,last,now,mark.wd,mark.c,mark.a);F.last[i]=now;}}else F.last[i]=mark?now:null;
   if(onRoad&&slide>.25&&speed>4&&!wet&&Math.random()<dt*clamp(slide*40,0,60))ph47Puff(W,w.x,w.y+.25,w.z,1,'#e9e8e4',p.v*Math.sin(p.yaw),p.v*Math.cos(p.yaw),1.2+slide*.8);
   if(onRoad&&wet&&speed>12&&Math.random()<dt*speed*.4)ph47Puff(W,w.x,w.y+.2,w.z,1,'#d4dbde',0,0,.7);
   if(w.kind==='grass'&&speed>5&&Math.random()<dt*speed*.9)ph47Puff(W,w.x,w.y+.2,w.z,1,i%2?'#7d6a4c':'#8a7a55',p.v*Math.sin(p.yaw),p.v*Math.cos(p.yaw),.9);
  }
  if(s.tumble&&Math.abs(s.phi)>.6&&speed>3&&Math.random()<dt*30)ph47Sparks(W,p.pos.x,p.pos.y+.1,p.pos.z,p.v*Math.sin(p.yaw)*.7,p.v*Math.cos(p.yaw)*.7,3);
 }
 if(F.dirty){const g=F.marks.geometry;g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;F.dirty=false;}
 // Smoke and dust drift and fade.
 const sg=F.smoke.geometry,sp=sg.attributes.position.array,ss=sg.attributes.size.array,sa=sg.attributes.alpha.array,sc=sg.attributes.tint.array;
 for(let i=0;i<F.SMOKE;i++){const q=F.puffs[i];if(q.life>0&&dt>0){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vx*=Math.exp(-dt*1.4);q.vz*=Math.exp(-dt*1.4);q.vy*=Math.exp(-dt*.8);}
  const live=q.life>0,t=live?1-q.life/q.max:1;sp[i*3]=q.x||0;sp[i*3+1]=live?q.y:-9999;sp[i*3+2]=q.z||0;ss[i]=live?q.size*(1+t*3.2):0;sa[i]=live?.55*(1-t)*Math.min(1,t*8+.2):0;sc[i*3]=q.r||1;sc[i*3+1]=q.g||1;sc[i*3+2]=q.b||1;}
 sg.attributes.position.needsUpdate=sg.attributes.size.needsUpdate=sg.attributes.alpha.needsUpdate=sg.attributes.tint.needsUpdate=true;
 F.smoke.material.uniforms.scale.value=W.renderer.domElement.height/(2*Math.tan(THREE.MathUtils.degToRad(W.camera.fov)/2));
 const kg=F.sparks.geometry,kp=kg.attributes.position.array,kc=kg.attributes.color.array;
 for(let i=0;i<F.SPARKS;i++){const q=F.bits[i];if(q.life>0&&dt>0){q.life-=dt;q.vy-=9.81*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;if(q.y<(p?.pos.y??0)+.02&&q.vy<0){q.vy*=-.35;q.vx*=.7;q.vz*=.7;}}
  const o=i*6;if(q.life>0){const k=q.life/q.max;kp.set([q.x,q.y,q.z,q.x-q.vx*.035,q.y-q.vy*.035,q.z-q.vz*.035],o);kc.set([1.6*k+.4,.9*k+.2,.35*k,.9*k,.3*k,.05*k],o);}else{kp.fill(0,o,o+6);kc.fill(0,o,o+6);}}
 kg.attributes.position.needsUpdate=kg.attributes.color.needsUpdate=true;
 for(const o of [F.marks,F.smoke,F.sparks])o.updateMatrixWorld(true);
}
const ph47Dispose=SC25World.prototype.dispose;
SC25World.prototype.dispose=function(){const F=this.ph47Fx;if(F)for(const o of [F.marks,F.smoke,F.sparks]){o.removeFromParent();o.geometry.dispose();o.material.dispose();}this.ph47Fx=null;return ph47Dispose.call(this);};

// Presentation: smoothed ground tilt for every car; the player's body pitches and rolls
// from the solver's real accelerations, kerbs shake the chassis and rollovers lift it.
const ph47Present=dc35Present;
dc35Present=function(W,L,dt){
 ph47Present(W,L,dt);const T=THREE;
 for(const x of L.entrants){const car=W.carNodes.get(x.d.id);if(!car?.userData.dc35Car||!x.pos)continue;
  const yawQ=PH47_TMP.yaw.setFromAxisAngle(PH47_UP,x.yaw+(x.sc3Crash?.yaw||0)),tilt=PH47_TMP.tilt.copy(yawQ).invert().premultiply(car.quaternion);
  const u=car.userData;if(!u.ph47Tilt||dt>.5||W.cameraCut)u.ph47Tilt=tilt.clone();else u.ph47Tilt.slerp(tilt,1-Math.exp(-dt*14));
  if(!u.ph47Y||Math.abs(u.ph47Y-car.position.y)>1)u.ph47Y=car.position.y;else u.ph47Y+=(car.position.y-u.ph47Y)*(1-Math.exp(-dt*20));
  car.quaternion.copy(u.ph47Tilt).multiply(yawQ);car.position.y=u.ph47Y;
  const s=x.ph47;
  if(s&&x.ph47On){
   const pitch=clamp(s.ax*.0042,-.045,.04),roll=clamp(s.ay*.0036,-.06,.06),bump=s.kerb&&Math.abs(x.v)>5?Math.sin(L.elapsed*61)*.012*s.kerb/2:0,grassBump=s.grass&&Math.abs(x.v)>4?Math.sin(L.elapsed*23+1.3)*.01*s.grass/2:0;
   const m=u.dc35Motion;if(m){m.pitch+=(pitch-m.pitch)*(1-Math.exp(-dt*10));m.roll+=(roll-m.roll)*(1-Math.exp(-dt*10));}
   for(const body of u.dc35Chassis||[]){body.rotation.x=m?m.pitch:pitch;body.rotation.z=(m?m.roll:roll)+bump*.6;body.position.y=(m?.heave||0)+bump+grassBump;}
   for(const wheel of u.dc35Steering||[])wheel.rotation.z=clamp(s.delta*9,-2.7,2.7);
   if(s.tumble||s.hop){const lift=s.tumble?PH47.width*Math.abs(Math.sin(s.phi))+PH47.height*Math.abs(Math.cos(s.phi))-PH47.height:0,forward=PH47_TMP.fwd.set(Math.sin(x.yaw),0,Math.cos(x.yaw));car.quaternion.premultiply(PH47_TMP.roll.setFromAxisAngle(forward,-s.phi));car.position.y+=lift+s.hop;}
  }
  car.updateMatrixWorld(true);
 }
 ph47FxStep(W,L,dt);
};
const ph47Camera=dc36Camera;
dc36Camera=function(W,L,dt){
 const p=L.player,s=p?.ph47,car=W.carNodes.get(p?.d.id);let saved=null,mode=sc25Camera;
 if(s?.tumble&&car){saved={q:car.quaternion.clone(),y:car.position.y};car.quaternion.setFromAxisAngle(PH47_UP,p.yaw);car.position.y=p.pos.y;car.updateMatrixWorld(true);if(sc25Camera!=='chase'&&sc25Camera!=='orbit')sc25Camera='chase';}
 try{ph47Camera(W,L,dt);}finally{sc25Camera=mode;if(saved){car.quaternion.copy(saved.q);car.position.y=saved.y;car.updateMatrixWorld(true);}}
 if(!s||L.paused)return;const kerb=s.kerb&&Math.abs(p.v)>8?.008*s.kerb:0,amp=s.shake+kerb+(s.grass&&Math.abs(p.v)>6?.006*s.grass:0);s.shake*=Math.exp(-Math.max(0,dt)*6);
 if(amp>.002&&D.settings.cameraMotion!==false){const k=sc25Camera==='chase'?1:.3,c=W.camera;c.position.x+=(Math.random()-.5)*amp*.5*k;c.position.y+=(Math.random()-.5)*amp*.4*k;c.position.z+=(Math.random()-.5)*amp*.5*k;c.rotateZ((Math.random()-.5)*amp*.05);c.rotateX((Math.random()-.5)*amp*.03);c.updateMatrixWorld();}
};

// Audio: tyre squeal, wall scrape and a heavier crunch for big hits.
function ph47Audio(){
 const a=dcAudio;if(!a?.ctx||!a.noise?.buffer)return null;if(a.ph47)return a.ph47;const c=a.ctx,make=(type,freq,q)=>{const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=a.noise.buffer;s.loop=true;f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.value=0;s.connect(f);f.connect(g);g.connect(c.destination);s.start();return{s,f,g};};
 return a.ph47={squeal:make('bandpass',1250,9),squeal2:make('bandpass',2350,12),scrape:make('highpass',2600,.7),rumble:make('lowpass',160,.8)};
}
function ph47Crunch(hit){
 const a=dcAudio;if(!a?.ctx||a.ctx.state!=='running'||!D.settings.volume||hit<6)return;const c=a.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),v=D.settings.volume*Math.min(.32,.05+hit*.008);
 o.type='triangle';o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(38,t+.35);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.45);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.5);o.onended=()=>{o.disconnect();g.disconnect();};
 rf41ImpactSound(hit*1.5);
}
const ph47Sound=dcUpdateSound;
dcUpdateSound=function(){
 ph47Sound();const L=live,x=L?.player,A=ph47Audio();if(!A||!x)return;const s=x.ph47,t=dcAudio.ctx.currentTime,muted=L.paused||dcSimBusy||x.retired||!x.ph47On||!s,vol=muted?0:D.settings.volume||0,speed=Math.hypot(x.v,x.latV||0),road=s?s.wheels.some(w=>w.kind!=='grass'):true;
 const slide=s?clamp(s.slideF*4+s.slideR*5+(s.lockF||s.lockR?.55:0)+s.spin*.6,0,1):0,squeal=road&&L.weather==='Dry'&&speed>5?slide:0;
 A.squeal.g.gain.setTargetAtTime(vol*squeal*.05,t,.05);A.squeal2.g.gain.setTargetAtTime(vol*squeal*.022,t,.05);A.squeal.f.frequency.setTargetAtTime(1100+squeal*350+speed*3,t,.08);
 A.scrape.g.gain.setTargetAtTime(vol*(s?.scrape||0)*.06,t,.04);A.rumble.g.gain.setTargetAtTime(vol*clamp(((s?.kerb||0)*.5+(s?.grass||0)*.35)*speed/25,0,1)*.09,t,.05);
};

// Settings: assists and the classic handling fallback.
const ph47Settings=dcSettingsFields;
dcSettingsFields=function(...args){
 const level=D.settings.ph47Assist||'standard';
 return ph47Settings(...args)+`<div class="dc-card" style="margin-top:18px"><h3>Handling</h3><div class="dc-field"><label>Driving assists</label><select onchange="D.settings.ph47Assist=this.value;dcSave()">${Object.entries(PH47_ASSISTS).map(([k,v])=>`<option value="${k}" ${k===level?'selected':''}>${v.label}</option>`).join('')}</select><p class="dc-muted">Full: traction and stability control, no lock-ups, steering held at peak grip. Standard: traction control and anti-lock, light countersteer help. Off: wheelspin, lock-ups and slides are all yours.</p></div><label class="dc-checkbox"><input type="checkbox" ${D.settings.ph47Classic?'checked':''} onchange="D.settings.ph47Classic=this.checked;dcSave()">Classic handling (the old on-rails model)</label></div>`;
};
