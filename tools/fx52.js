// FX52: live mirrors, cheaper wet reflections, sharper shadows and fewer scenery draw calls.
// Built into index.html by tools/build_fx52.py. Everything here wraps existing functions,
// so the layer works in any order relative to the circuit (ct48) and physics (ph47) layers.
const FX52={mirrorFov:null,cell:500};

// --- Scenery batching -------------------------------------------------------------
// flushBatches makes one InstancedMesh per colour per 180 m tile (~1,900 meshes per track).
// Each one is a draw call in the main view, the shadow map, the wet reflection and the mirror.
// Plain colour batches that share geometry and material settings are merged into one mesh per
// cell, with the colour moved to a per-instance colour, which renders identically.
function fx52GeometryKey(g){
 if(g.parameters)return g.type+JSON.stringify(g.parameters);
 const p=g.attributes.position;if(!p)return g.uuid;let s=0;for(let i=0;i<Math.min(p.array.length,60);i++)s+=p.array[i]*(i+1);
 return g.type+':'+p.count+':'+(g.index?g.index.count:0)+':'+s.toFixed(4)+':'+!!g.attributes.color;
}
function fx52MaterialKey(m){
 if(!m||!m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.map||m.transparent||m.alphaMap||m.emissiveMap||m.normalMap)return null;
 if(m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return null;
 return [m.roughness,m.metalness,m.vertexColors,m.side,m.alphaTest,m.emissive.getHex(),m.emissiveIntensity,m.envMapIntensity,m.bumpMap?.uuid||'',m.bumpScale,m.flatShading,m.fog,m.wireframe].join('|');
}
function fx52MergeScenery(W){
 if(W.fx52Merged)return;W.fx52Merged=true;const T=THREE,root=W.world;if(!root)return;
 const groups=new Map(),m4=new T.Matrix4(),v=new T.Vector3(),c=new T.Color();let before=0;
 for(const o of [...root.children]){
  if(!o.isInstancedMesh||o.name||o.instanceColor||o.morphTexture||o.count<1||!o.visible||o.children.length)continue;
  const mk=fx52MaterialKey(o.material);if(mk===null)continue;
  if(!o.matrix.equals(m4.identity()))continue;
  const gk=fx52GeometryKey(o.geometry),base=gk+'#'+mk+'#'+o.castShadow+o.receiveShadow+o.frustumCulled+o.renderOrder;before++;
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);v.setFromMatrixPosition(m4);const key=base+'@'+Math.floor(v.x/FX52.cell)+','+Math.floor(v.z/FX52.cell);
   let g=groups.get(key);if(!g)groups.set(key,g={src:o,rows:[]});g.rows.push([m4.clone(),o.material.color]);}
  o.userData.fx52Source=true;
 }
 if(!before)return;
 const keep=new Set(),mats=new Map();let after=0;
 for(const g of groups.values()){
  const s=g.src,mk=fx52MaterialKey(s.material);let mat=mats.get(mk);if(!mat){mat=s.material.clone();mat.color.set('#ffffff');mats.set(mk,mat);}
  const m=new T.InstancedMesh(s.geometry,mat,g.rows.length);keep.add(s.geometry);
  g.rows.forEach(([mx,col],i)=>{m.setMatrixAt(i,mx);m.setColorAt(i,c.copy(col));});
  m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.castShadow=s.castShadow;m.receiveShadow=s.receiveShadow;m.frustumCulled=s.frustumCulled;m.renderOrder=s.renderOrder;
  m.computeBoundingSphere();m.userData.fx52Merged=true;root.add(m);after++;
 }
 for(const o of [...root.children])if(o.userData.fx52Source){o.removeFromParent();if(!keep.has(o.geometry))o.geometry.dispose();o.dispose?.();}
 W.fx52Batching={before,after};
}

// --- Auxiliary view detail -----------------------------------------------------------
// Mirror and wet reflection passes draw cars at a low LOD, skip far scenery and skip flat
// ground layers that a road-plane reflection cannot show.
const FX52_FLAT=/^(Grass shoulders|Verge grass|Flush kerbs|Gravel traps|Gravel runoff|Ideal racing line|Bedded tyre rubber|City ground)/;
function fx52AuxDetail(W,cam,opts,draw){
 const saved=[],T=THREE,eye=cam.getWorldPosition(new T.Vector3()),s=new T.Sphere();
 const hide=o=>{if(o&&o.visible){saved.push([o,true]);o.visible=false;}};
 try{
  for(const car of W.carNodes.values()){const lod=car.userData.dc35LOD;if(!lod||!car.visible)continue;const near=opts.nearLod!=null&&car.position.distanceTo(eye)<45,at=near?opts.nearLod:2;
   lod.levels.forEach((l,i)=>{saved.push([l.object,l.object.visible]);l.object.visible=i===at;});}
  for(const o of W.world?.children||[]){
   if(!o.visible)continue;
   if(opts.flat&&FX52_FLAT.test(o.name)){hide(o);continue;}
   if(opts.range&&o.isInstancedMesh&&o.frustumCulled){if(!o.boundingSphere)o.computeBoundingSphere();s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);if(s.distanceToPoint(eye)>opts.range)hide(o);}
  }
  for(const o of [W.rain,W.particles,W.dcAtmos?.points,W.sc30Cockpit,W.puddles])hide(o);
  return draw();
 }finally{for(let i=saved.length-1;i>=0;i--)saved[i][0].visible=saved[i][1];}
}
// The wet reflection keeps its own oblique camera; only the content it draws changes.
gr27ReflectionDetail=function(W,draw){return fx52AuxDetail(W,W.dc35ReflectionCamera,{flat:true,range:sc25Quality==='high'?230:170},draw);};

// --- Wet road reflection: refresh every frame ---------------------------------------
// The base pass refreshed every 2nd (high) or 4th (balanced) frame, so reflections stuttered.
const fx52ReflectionBase=dc35Reflection;
dc35Reflection=function(W,L){const f=W.dc35Frame;W.dc35Frame=0;try{return fx52ReflectionBase(W,L);}finally{W.dc35Frame=f;}};

// --- Mirrors -----------------------------------------------------------------------
// One wide rear view per frame feeds the interior mirror and both door mirrors. Each glass
// samples the part of that view it would physically reflect from the driver's eye.
const fx52Bucket=dc35Bucket;
dc35Bucket=function(role,level,player){if(player&&role==='mirror'&&level<2)return{group:'body',bucket:'sidemirror',colour:'#ffffff'};return fx52Bucket(role,level,player);};
const fx52Car=sc25Car;
sc25Car=function(E,team,driver){
 const g=fx52Car(E,team,driver);if(!g?.userData?.dc35Car||driver.id!==D?.pid||!E.dc35MirrorRT)return g;const T=THREE;
 E.fx52MirrorLive||=new T.MeshBasicMaterial({map:E.dc35MirrorRT.texture,toneMapped:false,side:T.DoubleSide});
 E.fx52MirrorIdle||=new T.MeshStandardMaterial({color:'#1b2328',roughness:.05,metalness:1,envMapIntensity:1.2,side:T.DoubleSide});
 g.userData.fx52Glass=[];
 g.traverse(o=>{if(!o.isMesh)return;const b=o.userData.dc35Bucket;if(b==='sidemirror'){o.material=E.fx52MirrorIdle;o.castShadow=false;o.receiveShadow=false;g.userData.fx52Glass.push(o);}else if(b==='rearview')g.userData.fx52Glass.push(o);});
 g.userData.fx52Eye=null;return g;
};
// Rear camera mount in car space (matches the base mirror camera).
function fx52MirrorMount(make){return make==='Holden'?new THREE.Vector3(0,1.165,.575):new THREE.Vector3(0,1.35,-2.35);}
// Reflect the driver's line of sight off each glass and project it through the rear camera
// to get that vertex's UV. Also returns the field of view the camera needs to cover them all.
function fx52MirrorUVs(car,eye,make){
 const T=THREE,mount=fx52MirrorMount(make),glass=car.userData.fx52Glass,dirs=[];let tx=.2,ty=.12;
 for(const o of glass){
  const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,list=[];
  // Each glass reflects as one flat mirror per side of the car.
  const sides={};for(let i=0;i<p.count;i++){const side=o.userData.dc35Bucket==='rearview'?0:Math.sign(p.getX(i))||1,s=sides[side]||={n:new T.Vector3(),c:new T.Vector3(),k:0};s.n.x+=n.getX(i);s.n.y+=n.getY(i);s.n.z+=n.getZ(i);s.c.x+=p.getX(i);s.c.y+=p.getY(i);s.c.z+=p.getZ(i);s.k++;}
  // Aim each glass like a driver would set it: the centre of the door mirrors looks back and a
  // little outward, the interior mirror straight back through the rear window.
  for(const [side,s] of Object.entries(sides)){s.c.multiplyScalar(1/s.k);const k=+side,aim=new T.Vector3(k*.26,-.035,-1).normalize(),d=s.c.clone().sub(eye).normalize();s.n.copy(aim).sub(d).normalize();}
  for(let i=0;i<p.count;i++){
   const side=o.userData.dc35Bucket==='rearview'?0:Math.sign(p.getX(i))||1,nn=sides[side].n,P=new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)),d=P.clone().sub(eye).normalize(),r=d.sub(nn.clone().multiplyScalar(2*d.dot(nn)));
   const q=P.clone().addScaledVector(r,28).sub(mount);let x=q.x,y=q.y,z=-q.z;if(z<.5)z=.5;// unrotated camera looking along the car's -Z
   x/=z;y/=z;list.push([x,y]);tx=Math.max(tx,Math.abs(x));ty=Math.max(ty,Math.abs(y));
  }
  dirs.push([o,list]);
 }
 tx*=1.04;ty*=1.04;
 for(const [o,list] of dirs){const uv=o.geometry.attributes.uv;list.forEach(([x,y],i)=>uv.setXY(i,.5+x/(2*tx),.5+y/(2*ty)));uv.needsUpdate=true;}
 return{tx,ty};
}
function fx52MirrorSize(){const q=sc25Quality;return q==='high'?[768,240]:q==='performance'?[384,120]:[576,180];}
dc35RearView=function(W,L){
 fx52MergeScenery(W);fx52ShadowFocus(W,L);
 const T=THREE,p=L.player,car=W.carNodes.get(p.d.id);if(!W.dc35MirrorRT||!car)return;
 const onboard=sc25Camera==='onboard',glass=car.userData.fx52Glass||[];
 for(const o of glass)if(o.userData.dc35Bucket==='sidemirror')o.material=onboard?W.fx52MirrorLive:W.fx52MirrorIdle;
 if(!onboard)return;
 const make=p.team.manufacturer,eye=car.worldToLocal(W.camera.getWorldPosition(new T.Vector3()));
 if(!car.userData.fx52Eye||car.userData.fx52Eye.distanceTo(eye)>.12){car.userData.fx52Eye=eye;car.userData.fx52Fov=fx52MirrorUVs(car,eye,make);}
 const {tx,ty}=car.userData.fx52Fov,[w,h0]=fx52MirrorSize(),h=Math.max(64,Math.min(h0*1.6,Math.round(w*ty/tx)));
 if(W.dc35MirrorRT.width!==w||W.dc35MirrorRT.height!==h)W.dc35MirrorRT.setSize(w,h);
 const cam=W.dc35RearCamera;cam.fov=2*Math.atan(ty)*180/Math.PI;cam.aspect=tx/ty;cam.near=.12;cam.far=sc25Quality==='high'?340:260;cam.updateProjectionMatrix();
 cam.position.copy(fx52MirrorMount(make));car.localToWorld(cam.position);
 const back=new T.Vector3(0,0,-60);car.localToWorld(back);cam.up.set(0,1,0);cam.lookAt(back);cam.updateMatrixWorld();
 const visible=car.visible;
 try{car.visible=false;rf46AuxRender(W,()=>fx52AuxDetail(W,cam,{nearLod:1,range:cam.far+40},()=>{W.renderer.setRenderTarget(W.dc35MirrorRT);W.renderer.clear();W.renderer.render(W.scene,cam);}));W.dc35MirrorReady=true;}
 catch(_){W.dc35MirrorReady=false;}finally{car.visible=visible;}
};

// --- Shadows -----------------------------------------------------------------------
// Sharper sun shadows: a tighter, higher resolution map centred ahead of the camera (the
// old box was centred on the car, so half of it covered road already behind the driver),
// with a depth range that fits the scene instead of 1.5 km.
function fx52ShadowSetup(W){
 const q=sc25Quality,high=q==='high',size=high?3072:2048,r=high?54:62,s=W.sun.shadow,c=s.camera;if(q==='performance')return;
 if(s.mapSize.x!==size){s.mapSize.set(size,size);s.map?.dispose();s.map=null;}
 c.left=c.bottom=-r;c.right=c.top=r;c.near=60;c.far=560;c.updateProjectionMatrix();s.bias=-.00025;s.normalBias=.018;s.radius=2;W.fx52ShadowReach=r;
}
const fx52Quality=SC25World.prototype.quality;
SC25World.prototype.quality=function(){fx52Quality.call(this);if(this.sun)fx52ShadowSetup(this);};
function fx52ShadowFocus(W,L){
 if(!W.renderer.shadowMap.enabled||!W.fx52ShadowReach)return;const T=THREE,d=W.camera.getWorldDirection(new T.Vector3());d.y=0;if(d.lengthSq()<1e-4)return;d.normalize().multiplyScalar(W.fx52ShadowReach*.55);
 W.sun.target.position.add(d);W.sun.position.add(d);W.sun.target.updateMatrixWorld();
}
