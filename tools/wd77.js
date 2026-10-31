/* wd77: wheels take the hit too. A hard knock bends the wheel on that corner (tipped camber, toe kicked out,
   pushed back into the arch), scuffs the tyre and rim, and can puncture the tyre so it sits squashed and low.
   A really hard head-on tears the wheel off: it bounces and rolls away down the road, the car sags onto that
   corner and limps (rf41's locked-wheel fault). Everything is put back when the car is repaired in the pits. */
(()=>{
const T=THREE,WD77_R=.34,WD77_NAMES=['FRL','FRR','RRL','RRR'];

// Damage per corner, stored on the entrant so it survives rewinds: {bend, flat, scuff, off, seed}
const wd77Hit=dcDamage;
dcDamage=function(x,amount,side=1,z=1){
 const before=x.bodyDamage||0;wd77Hit(x,amount,side,z);if(!(x.bodyDamage>before)||amount<8)return;
 const S={...(x.wd77W||{})},sgn=Math.sign(side)||1,end=Math.abs(z)>=.8,raw=Math.min(1.2,(amount-8)/30);
 for(const name of WD77_NAMES){
  const front=name[0]==='F',same=(name.endsWith('L')?-1:1)===sgn;let w;
  if(end){if(front!==(z>0))continue;w=same?1:.6;}
  else{if(!same)continue;w=z>.3?(front?1:.35):z<-.3?(front?.35:1):.8;}
  const k=raw*w;if(k<.05)continue;
  const o={bend:0,flat:0,scuff:0,seed:Math.random(),...S[name]};
  o.bend=Math.min(1,o.bend+k*.9);o.scuff=Math.min(1,o.scuff+k*1.6);
  if(k>.3&&Math.random()<k)o.flat=Math.min(1,o.flat+.5+k*.5);
  // Really hard end-on hits rip the wheel off: the corner that took it at 30+, both at 37+.
  if(end&&x.bodyDamage>40&&(amount>=37||amount>=30&&same))o.off=true;
  S[name]=o;
 }
 x.wd77W=S;
 const off=WD77_NAMES.find(n=>S[n]?.off),flat=WD77_NAMES.filter(n=>S[n]?.flat>.4).sort((a,b)=>S[b].flat-S[a].flat)[0];
 if(off)x.rf41Wheel={name:off,toe:.48,locked:true,angle:0};
 else if(flat&&!x.rf41Wheel)x.rf41Wheel={name:flat,toe:.12+.2*S[flat].flat,locked:false,angle:0};
};
if(Array.isArray(DC_SNAPSHOT_KEYS))DC_SNAPSHOT_KEYS.push('wd77W');

// Toe has to go on after the roll, which sets the steering angle afresh each call.
const wd77Roll=sc30RollWheels;
sc30RollWheels=function(car,distance,steering,curve){
 wd77Roll(car,distance,steering,curve);const S=car.userData.rf41Entry?.wd77W;if(!S||!car.userData.dc35Wheels)return;
 for(const w of car.userData.dc35Wheels){const s=S[w.pivot.name];if(s)w.pivot.rotation.y+=(w.x<0?-1:1)*s.bend*(.08+.14*s.seed);}
};

// Scuffed tyre and rim: the wheel's own copies of its materials, dulled and dirtied.
const WD77_DIRT=new T.Color('#5d554c');
function wd77Scuff(w,amount){
 const q=Math.round(amount*10)/10;if(w.wd77Scuff===q)return;w.wd77Scuff=q;
 w.pivot.traverse(m=>{if(!m.isMesh||!m.material||Array.isArray(m.material))return;
  const orig=m.userData.wd77Mat||(m.userData.wd77Mat=m.material);
  if(m.material===orig){const c=orig.clone();c.onBeforeCompile=orig.onBeforeCompile;c.customProgramCacheKey=orig.customProgramCacheKey;c.userData={};m.material=c;}
  const c=m.material,rubber=m.userData.dc35Bucket==='rubber';
  if(c.color&&orig.color)c.color.copy(orig.color).lerp(WD77_DIRT,rubber?.28*q:.4*q).multiplyScalar(rubber?1:1-.3*q);
  if('roughness' in c)c.roughness=Math.min(1,orig.roughness+(rubber?.25:.45)*q);
  if('metalness' in c)c.metalness=orig.metalness*(1-.45*q);
  if('clearcoat' in c)c.clearcoat=(orig.clearcoat||0)*(1-q);});
}
function wd77Clean(w){w.wd77Scuff=null;w.pivot.traverse(m=>{if(m.userData.wd77Mat){if(m.material!==m.userData.wd77Mat)m.material.dispose();m.material=m.userData.wd77Mat;delete m.userData.wd77Mat;}});}

function wd77Pose(W,car,x){
 const u=car.userData,S=x.wd77W;if(!u.dc35Wheels)return;
 if(!S&&!u.wd77On)return;u.wd77On=!!S;if(!S)u.wd77Dropped={};
 let roll=0,pitch=0,cx=0,cz=0,sum=0;
 for(const w of u.dc35Wheels){
  const p=w.pivot,s=S?.[p.name],off=p.userData.wd77Off||(p.userData.wd77Off=new T.Vector3()),dir=w.x<0?-1:1;
  p.position.sub(off);off.set(0,0,0);
  if(!s){p.rotation.z=0;p.scale.set(1,1,1);p.visible=true;if(w.wd77Scuff!=null)wd77Clean(w);continue;}
  // top of the wheel folds in, the wheel is shoved back into the arch, a puncture squashes it onto the rim
  p.rotation.z=dir*s.bend*(.14+.12*s.seed);
  off.set(-dir*s.bend*.035,-WD77_R*.15*s.flat-s.bend*.015,(w.front?-1:1)*s.bend*(.05+.06*s.seed));
  p.scale.set(1+.05*s.flat,1-.15*s.flat,1+.03*s.flat);p.position.add(off);p.visible=!s.off;
  if(s.scuff>.05)wd77Scuff(w,s.scuff);
  if(s.off&&!(u.wd77Dropped||={})[p.name]){u.wd77Dropped[p.name]=true;wd77Drop(W,car,w,x);}
 }
 // The car sags onto a missing or flat corner, pivoting about the opposite one.
 if(S)for(const name of WD77_NAMES){const s=S[name];if(!s)continue;const drop=s.off?.17:.05*s.flat;if(drop<.005)continue;const sx=name.endsWith('L')?-1:1,sz=name[0]==='F'?1:-1;
  roll+=-sx*drop/1.6;pitch+=sz*drop/2.8;cx-=sx*.8*drop;cz-=sz*1.4*drop;sum+=drop;}
 const c=sum?new T.Vector3(cx/sum,0,cz/sum):null;
 for(const level of u.dc35LOD?.levels||[]){const root=level.object;
  if(!c){if(root.userData.wd77Tilt){root.rotation.x=root.rotation.z=0;root.position.set(0,0,0);root.userData.wd77Tilt=false;}continue;}
  root.rotation.set(pitch,0,roll);root.updateMatrix();root.position.copy(c).sub(c.clone().applyEuler(root.rotation));root.userData.wd77Tilt=true;}
}

// A torn-off wheel: a copy of the detailed wheel that bounces, rolls on and falls over.
function wd77Drop(W,car,w,x){
 W.wd77Debris||=[];if(W.wd77Debris.length>=8||!W.scene)return;
 car.updateMatrixWorld(true);const lead=car.userData.dc35Wheels.find(v=>v.pivot.name===w.pivot.name)||w,p=lead.pivot;
 const o=new T.Group(),inv=p.matrixWorld.clone().invert(),scale=new T.Vector3();
 p.traverse(m=>{if(!m.isMesh)return;const k=new T.Mesh(m.geometry,m.material);k.matrixAutoUpdate=false;k.matrix.multiplyMatrices(inv,m.matrixWorld);k.castShadow=true;k.receiveShadow=true;o.add(k);});
 p.matrixWorld.decompose(o.position,o.quaternion,scale);W.scene.add(o);
 const fwd=new T.Vector3(Math.sin(x.yaw||0),0,Math.cos(x.yaw||0)),out=new T.Vector3(fwd.z,0,-fwd.x).multiplyScalar(w.x<0?1:-1),v=fwd.clone().multiplyScalar((x.v||0)*.55).addScaledVector(out,2.5+Math.random()*2);v.y=3+Math.random()*1.5;
 W.wd77Debris.push({o,v,age:0,roll:0,spin:new T.Vector3((Math.random()-.5)*4,(Math.random()-.5)*3,(Math.random()-.5)*2),fall:0,side:w.x<0?1:-1});
}
const WD77_AXLE=new T.Vector3(1,0,0),WD77_UP=new T.Vector3(0,1,0);
function wd77DebrisStep(W,dt){
 if(!dt||!W.wd77Debris?.length)return;
 for(let i=W.wd77Debris.length-1;i>=0;i--){const d=W.wd77Debris[i],o=d.o;d.age+=dt;let left=Math.min(dt,.25);
  while(left>1e-7){const h=Math.min(.016,left);left-=h;
   d.v.y-=9.81*h;o.position.addScaledVector(d.v,h);
   const surface=typeof gr27Surface==='function'?gr27Surface(W,o.position.x,o.position.z,o.position.y,false,false):null,
    floor=surface?surface.y:typeof gr26SceneryGround==='function'?gr26SceneryGround(W,o.position.x,o.position.z):0,sp=Math.hypot(d.v.x,d.v.z);
   const rest=floor+WD77_R+(.13-WD77_R)*d.fall;
   if(o.position.y<=rest){o.position.y=rest;d.v.y=d.v.y<-1.2?-d.v.y*.38:0;d.ground=true;
    const drag=d.fall>0?4:.55;d.v.x*=Math.exp(-h*drag);d.v.z*=Math.exp(-h*drag);d.spin.multiplyScalar(Math.exp(-h*6));
    // rolling on its tread until it slows, then it wobbles over flat
    if(sp<4||d.age>6)d.fall=Math.min(1,d.fall+h*(1.5+d.fall*3));
   }else d.ground=false;
   const axle=WD77_AXLE.clone().applyQuaternion(o.quaternion);
   if(d.fall>0){const target=new T.Quaternion().setFromUnitVectors(axle,WD77_UP.clone().multiplyScalar(d.side)).multiply(o.quaternion);o.quaternion.slerp(target,Math.min(1,h*4*d.fall));}
   else{
    // keep it upright and steer the axle across the direction of travel, so it rolls the way it is going
    if(sp>.5){const head=new T.Vector3(d.v.x,0,d.v.z).normalize(),want=new T.Vector3(head.z,0,-head.x);if(want.dot(axle)<0)want.negate();o.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(axle,axle.clone().lerp(want,Math.min(1,h*3)).normalize()));}
    o.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(WD77_AXLE.clone().applyQuaternion(o.quaternion),sp*h/WD77_R*(d.side)));
    if(!d.ground){const ang=d.spin.length()*h;if(ang>0)o.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(d.spin.clone().normalize(),ang));}
   }
  }
  if(d.age>45){o.removeFromParent();W.wd77Debris.splice(i,1);}
 }
}

const wd77Present=dc35Present;
dc35Present=function(W,L,dt){
 wd77Present(W,L,dt);
 for(const x of L.entrants){const car=W.carNodes.get(x.d.id);if(!car?.userData.dc35Car)continue;
  if(x.wd77W&&!x.bodyDamage)x.wd77W=null;
  wd77Pose(W,car,x);}
 if(!L.paused)wd77DebrisStep(W,dt);
};
})();
