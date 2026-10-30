/* RV74: a real interior rear view mirror for the Falcon and the ZB Commodore.
   The old mirror was a flat slab floating in front of the windscreen (on the ZB it read as a
   black box, and on the Falcon it sat behind the roll-cage bar where it couldn't be seen).
   It is replaced by a mirror that hangs from the top of the windscreen: a bonded mounting
   pad on the glass, a short stem, a ball joint and a wide race-car housing with a bevelled
   edge. The glass shows the live rear camera as a true flat mirror would: each point reflects
   the driver's line of sight off the glass's actual angle, and the view is framed by the
   car's own rear window, headliner and C-pillars.
   Drag the mirror with the mouse (or a finger) in the cockpit view to aim it. The angle is
   kept per car make. */

// Car space (+Z forward, +X the car's left, driver at x .37). pad: mounting pad on the windscreen,
// padTilt: degrees the windscreen leans back at the pad, joint: ball joint the mirror turns on.
// rear: the rear window as a sloped plane from its top edge [y,z] to its bottom edge [y,z],
// with half-widths at the top and bottom. old: box around the old mirror housing in the trim mesh
// (the Falcon's old mirror is a bare plane).
const RV74_SPEC={
 Holden:{pad:[.10,1.284,.472],padTilt:64,joint:[.10,1.214,.528],w:.255,h:.066,
  rear:{top:[1.27,-.72],bottom:[1.03,-1.60],half:[.6,.64]},
  old:{x:.13,y0:1.12,y1:1.215,z0:.5,z1:.7}},
 Ford:{pad:[.10,1.246,.497],padTilt:66,joint:[.10,1.19,.522],w:.25,h:.062,
  rear:{top:[1.25,-.80],bottom:[1.05,-1.62],half:[.6,.64]},
  old:null}
};
const RV74_LIMIT={yaw:.38,pitch:.26}; // how far the ball joint turns, radians
const RV74_GRID=[48,12];               // glass mesh resolution, for an accurate reflection

function rv74Load(){try{return JSON.parse(localStorage.getItem('sc26.rv74')||'{}')||{};}catch(_){return {};}}
function rv74Save(all){try{localStorage.setItem('sc26.rv74',JSON.stringify(all));}catch(_){}}

function rv74Mats(E){
 const T=THREE;
 return E.rv74Mats||={
  shell:new T.MeshStandardMaterial({color:'#141618',roughness:.55,metalness:.08}),
  pad:new T.MeshStandardMaterial({color:'#0c0d0e',roughness:.8,metalness:0}),
  metal:new T.MeshStandardMaterial({color:'#5d6469',roughness:.35,metalness:.7}),
  idle:new T.MeshStandardMaterial({color:'#1b2328',roughness:.05,metalness:1,envMapIntensity:1.2})
 };
}

// Rounded rectangle outline, centred on the origin.
function rv74Shape(w,h,r){
 const s=new THREE.Shape(),x=w/2,y=h/2;
 s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);
 s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);return s;
}

// Flat glass as a fine grid, with the corners pulled in onto a rounded outline.
function rv74GlassGeometry(w,h,r){
 const T=THREE,[nx,ny]=RV74_GRID,g=new T.PlaneGeometry(w,h,nx,ny),p=g.attributes.position,cx=w/2-r,cy=h/2-r;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),dx=Math.abs(x)-cx,dy=Math.abs(y)-cy;
  if(dx>0&&dy>0){const k=r/Math.hypot(dx,dy);if(k<1)p.setXY(i,Math.sign(x)*(cx+dx*k),Math.sign(y)*(cy+dy*k));}
 }
 g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(p.count*3).fill(1),3));
 return g;
}

// The model's old mirror: hide its glass and fold its housing triangles away (they are
// separate triangles inside the trim mesh, so nothing around them changes).
function rv74HideOld(car,box){
 const inBox=(p,i)=>Math.abs(p.getX(i))<box.x&&p.getY(i)>box.y0&&p.getY(i)<box.y1&&p.getZ(i)>box.z0&&p.getZ(i)<box.z1;
 for(const root of car.userData.dc35Chassis||[])root.traverse(o=>{
  if(!o.isMesh)return;const b=o.userData.dc35Bucket;
  if(b==='rearview'){o.visible=false;return;}
  if(!box||b!=='trim'||o.geometry.userData.rv74Folded)return;
  const g=o.geometry,p=g.attributes.position,idx=g.index;if(!idx)return;let n=0;
  for(let t=0;t<idx.count;t+=3){const a=idx.getX(t),b2=idx.getX(t+1),c=idx.getX(t+2);if(inBox(p,a)&&inBox(p,b2)&&inBox(p,c)){idx.setXYZ(t,a,a,a);n++;}}
  if(n){idx.needsUpdate=true;}g.userData.rv74Folded=true;
 });
}

// Base aim: like a driver would set it, straight back through the middle of the rear window
// from the normal seat position.
function rv74BaseQuat(make,joint){
 const T=THREE,eye=new T.Vector3(...(make==='Ford'?(typeof CP65_EYE!=='undefined'&&CP65_EYE.Ford)||[.37,1.105,.10]:[.37,DC37_EYE_HEIGHT.Holden||1.15,.045]));
 const d=joint.clone().sub(eye).normalize(),aim=new T.Vector3(0,-.03,-1).normalize(),n=aim.sub(d).normalize();
 return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(n,new T.Vector3(),new T.Vector3(0,1,0)));
}

function rv74Build(E,car){
 const T=THREE,make=car.userData.make,spec=RV74_SPEC[make],M=rv74Mats(E),rad=Math.PI/180,root=car.userData.dc35Chassis?.[0];
 if(!root)return;
 rv74HideOld(car,spec.old);
 const g=new T.Group();g.name='RV74 rear view mirror';
 // Mounting pad bonded to the glass, lying along the windscreen.
 const pad=new T.Mesh(new T.ExtrudeGeometry(rv74Shape(.05,.07,.012),{depth:.008,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:3,curveSegments:8}),M.pad);
 pad.position.set(...spec.pad);pad.rotation.set((180-spec.padTilt)*rad,0,0);g.add(pad);
 // Stem from the pad down to the ball joint.
 const top=new T.Vector3(...spec.pad).add(new T.Vector3(0,-.008,.004)),joint=new T.Vector3(...spec.joint),len=top.distanceTo(joint);
 const stem=new T.Mesh(new T.CylinderGeometry(.0065,.008,len,20),M.metal);stem.position.copy(top).add(joint).multiplyScalar(.5);
 stem.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),top.clone().sub(joint).normalize());g.add(stem);
 const ball=new T.Mesh(new T.SphereGeometry(.0115,24,16),M.metal);ball.position.copy(joint);g.add(ball);
 // The mirror turns on the ball joint. Pivot space: the glass faces +Z (the driver), X along its width.
 const pivot=new T.Group();pivot.name='RV74 mirror pivot';pivot.position.copy(joint);
 const base=rv74BaseQuat(make,joint);pivot.userData.rv74Base=base;g.add(pivot);
 const w=spec.w,h=spec.h,depth=.026,r=.02;
 const shell=new T.Mesh(new T.ExtrudeGeometry(rv74Shape(w,h,r),{depth,bevelEnabled:true,bevelThickness:.006,bevelSize:.005,bevelSegments:5,curveSegments:14}),M.shell);
 // The housing hangs just below and in front of the joint.
 const hang=new T.Vector3(0,-.022,.026);shell.position.set(hang.x,hang.y,hang.z-depth/2);pivot.add(shell);
 const neck=new T.Mesh(new T.CylinderGeometry(.0075,.0075,.016,16),M.shell);neck.rotation.x=Math.PI/2;neck.position.set(0,-.01,.004);pivot.add(neck);
 const glassMat=new T.MeshBasicMaterial({color:'#e9eef0',toneMapped:false,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const glass=new T.Mesh(rv74GlassGeometry(w-.012,h-.012,r-.006),glassMat);glass.position.set(hang.x,hang.y,hang.z+depth/2+.0062);
 glass.userData.rv74=true;glass.userData.rv74Live=glassMat;glass.castShadow=glass.receiveShadow=false;pivot.add(glass);
 g.traverse(o=>{if(o.isMesh&&o!==glass){o.castShadow=false;o.receiveShadow=true;}});
 root.add(g);
 const saved=rv74Load()[make]||{};
 car.userData.rv74={make,group:g,pivot,glass,yaw:+saved.yaw||0,pitch:+saved.pitch||0,spec};
 rv74Aim(car);
 car.userData.fx52Glass=(car.userData.fx52Glass||[]).filter(o=>o.userData.dc35Bucket!=='rearview').concat(glass);
 car.userData.fx52Eye=null;
}

function rv74Aim(car){
 const m=car.userData.rv74;if(!m)return;
 m.yaw=clamp(m.yaw,-RV74_LIMIT.yaw,RV74_LIMIT.yaw);m.pitch=clamp(m.pitch,-RV74_LIMIT.pitch,RV74_LIMIT.pitch);
 m.pivot.quaternion.copy(m.pivot.userData.rv74Base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(m.pitch,m.yaw,0,'YXZ')));
 m.pivot.updateMatrixWorld(true);car.userData.fx52Eye=null;
}

const rv74Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=rv74Car(E,team,driver),make=car?.userData?.make;
 if(!RV74_SPEC[make]||!car.userData.fx52Glass)return car;
 try{rv74Build(E,car);}catch(e){console.warn('RV74 mirror',e);}
 return car;
};

// Mirror UVs. fx52 aims every glass at a fixed angle; the new mirror is reflected off the angle
// it is actually set to, and darkened where the reflected line of sight meets the cabin rather
// than the rear window.
const rv74BaseUVs=fx52MirrorUVs;
fx52MirrorUVs=function(car,eye,make){
 const m=car.userData.rv74,all=car.userData.fx52Glass||[];
 if(!m)return rv74BaseUVs(car,eye,make);
 car.userData.fx52Glass=all.filter(o=>o!==m.glass);
 let fov;try{fov=rv74BaseUVs(car,eye,make);}finally{car.userData.fx52Glass=all;}
 const T=THREE,mount=fx52MirrorMount(make),o=m.glass,geo=o.geometry,p=geo.attributes.position,col=geo.attributes.color,uv=geo.attributes.uv;
 car.updateMatrixWorld(true);
 const toCar=new T.Matrix4().copy(car.matrixWorld).invert().multiply(o.matrixWorld),n=new T.Vector3(0,0,1).transformDirection(toCar);
 const R=m.spec.rear,top=new T.Vector3(0,R.top[0],R.top[1]),bot=new T.Vector3(0,R.bottom[0],R.bottom[1]),along=bot.clone().sub(top),span=along.length();along.normalize();
 const plane=new T.Vector3(0,along.z,-along.y).normalize(); // rear window normal (in the YZ plane)
 const list=[],P=new T.Vector3(),d=new T.Vector3(),q=new T.Vector3(),hit=new T.Vector3();let tx=fov.tx,ty=fov.ty;
 const soft=(v,edge,width)=>clamp((edge-v)/width+.5,0,1); // 1 inside, 0 outside, soft over width
 for(let i=0;i<p.count;i++){
  P.fromBufferAttribute(p,i).applyMatrix4(toCar);d.copy(P).sub(eye).normalize();d.sub(n.clone().multiplyScalar(2*d.dot(n)));
  q.copy(P).addScaledVector(d,28).sub(mount);let x=q.x,y=q.y,z=-q.z;if(z<.5)z=.5;x/=z;y/=z;list.push([x,y]);
  tx=Math.max(tx,Math.abs(x)*1.04);ty=Math.max(ty,Math.abs(y)*1.04);
  // Rear window frame
  let light=.16;const den=d.dot(plane);
  if(den<-1e-4||den>1e-4){const t=top.clone().sub(P).dot(plane)/den;if(t>0){hit.copy(P).addScaledVector(d,t);const s=hit.clone().sub(top).dot(along)/span,half=R.half[0]+(R.half[1]-R.half[0])*clamp(s,0,1);
   light=Math.max(light,soft(-s,0,.16)*soft(s,1,.16)*soft(Math.abs(hit.x),half,.14));}}
  const k=.16+.84*light;col.setXYZ(i,k,k,k*1.02);
 }
 // Rescale the other glasses if the new mirror needs a wider view.
 if(tx>fov.tx||ty>fov.ty)for(const g of all){if(g===o)continue;const u=g.geometry.attributes.uv;for(let i=0;i<u.count;i++)u.setXY(i,.5+(u.getX(i)-.5)*fov.tx/tx,.5+(u.getY(i)-.5)*fov.ty/ty);u.needsUpdate=true;}
 list.forEach(([x,y],i)=>uv.setXY(i,.5+x/(2*tx),.5+y/(2*ty)));uv.needsUpdate=true;col.needsUpdate=true;
 return{tx,ty};
};

// The glass follows the head closely (fx52 only refreshes when the eye moves 12 cm) and goes
// dark-chrome outside the cockpit view, like the door mirrors.
const rv74RearView=dc35RearView;
dc35RearView=function(W,L){
 const car=L?.player&&W.carNodes.get(L.player.d.id),m=car?.userData?.rv74;
 if(m){
  const onboard=sc25Camera==='onboard';m.glass.material=onboard&&W.dc35MirrorRT?m.glass.userData.rv74Live:rv74Mats(W).idle;
  if(m.glass.userData.rv74Live.map!==W.dc35MirrorRT?.texture){m.glass.userData.rv74Live.map=W.dc35MirrorRT?.texture||null;m.glass.userData.rv74Live.needsUpdate=true;}
  if(onboard&&car.userData.fx52Eye){const eye=car.worldToLocal(W.camera.getWorldPosition(new THREE.Vector3()));if(eye.distanceTo(car.userData.fx52Eye)>.025)car.userData.fx52Eye=null;}
  if(onboard)rv74Bind(W);
 }
 return rv74RearView(W,L);
};

// Drag to adjust. Listeners sit on the window in the capture phase so a press on the mirror
// never reaches the camera's mouse-look or orbit handlers.
function rv74Pick(W,e){
 if(sc25Camera!=='onboard'||typeof live==='undefined'||!live?.player)return null;
 const car=W.carNodes.get(live.player.d.id),m=car?.userData?.rv74;if(!m)return null;
 const c=W.renderer.domElement,r=c.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;
 const ray=W.rv74Ray||=new THREE.Raycaster();ray.layers.enableAll();
 ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),W.camera);
 return ray.intersectObject(m.pivot,true).length?car:null;
}
function rv74Bind(W){
 const c=W.renderer.domElement;if(c.rv74Bound)return;c.rv74Bound=true;
 let drag=null,hoverAt=0;
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();e.preventDefault();
  const m=drag.car.userData.rv74,all=rv74Load();all[m.make]={yaw:+m.yaw.toFixed(4),pitch:+m.pitch.toFixed(4)};rv74Save(all);
  drag=null;c.style.cursor='grab';try{c.releasePointerCapture(e.pointerId);}catch(_){}};
 window.addEventListener('pointerdown',e=>{
  if(W.dead||e.button!==0||e.target!==c)return;const car=rv74Pick(W,e);if(!car)return;
  e.stopImmediatePropagation();e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,car};c.style.cursor='grabbing';
  try{c.setPointerCapture(e.pointerId);}catch(_){}
 },true);
 window.addEventListener('pointermove',e=>{
  if(W.dead)return;
  if(drag&&e.pointerId===drag.id){
   e.stopImmediatePropagation();e.preventDefault();const m=drag.car.userData.rv74,k=.0028;
   m.yaw+=(e.clientX-drag.x)*k;m.pitch+=(e.clientY-drag.y)*k;drag.x=e.clientX;drag.y=e.clientY;rv74Aim(drag.car);return;
  }
  if(e.target!==c||e.buttons||e.timeStamp-hoverAt<60)return;hoverAt=e.timeStamp;
  const over=!!rv74Pick(W,e);if(over)c.style.cursor='grab';else if(c.style.cursor==='grab')c.style.cursor='';
 },true);
 window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);
}
