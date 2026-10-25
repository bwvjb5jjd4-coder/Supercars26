/* CT53: circuit QA fixes for every circuit except Homebush (no glitches, nothing on the racing surface or pit lane).
   Reid Park: the mapped centreline ran out along one road to a dead end and came straight
   back down the same road, so the walls and catch fence of one direction stood across the
   other. The return leg is now its own street, ~45 m north of the outbound one, joined by a
   hairpin at the western end, giving a proper closed street loop; the little hook
   just before the start line is smoothed into one gentle bend. */
SC25_DATA.townsville.points=[[341.0,-26.7],[342.6,-13.0],[341.2,-1.5],[336.0,9.5],[267.89,99.33],[243.57,130.67],[235.84,141.16],[231.37,149.99],[228.4,159.96],[227.92,169.38],[229.0,179.11],[231.34,187.92],[253.45,236.13],[255.89,240.65],[258.75,243.5],[262.82,245.62],[267.82,246.74],[271.88,247.0],[275.91,245.65],[280.23,241.9],[284.76,234.75],[324.65,158.33],[390.95,27.95],[397.84,12.71],[402.48,-1.93],[404.63,-13.51],[405.84,-26.45],[405.85,-34.14],[405.53,-40.78],[403.99,-53.3],[402.27,-61.63],[399.82,-69.34],[362.96,-145.06],[358.94,-152.51],[355.4,-156.73],[351.99,-159.69],[347.26,-161.98],[309.02,-178.61],[302.5,-181.07],[297.28,-182.13],[292.89,-181.85],[288.88,-180.68],[286.01,-178.5],[282.21,-174.12],[266.08,-150.98],[262.13,-146.95],[257.47,-144.96],[252.26,-144.29],[246.43,-144.94],[168.54,-161.12],[135.07,-169.42],[101.13,-181.0],[13.88,-217.01],[6.92,-219.09],[1.25,-219.91],[-4.32,-218.63],[-9.61,-216.18],[-86.93,-171.77],[-95.85,-167.5],[-104.22,-165.44],[-110.94,-165.12],[-117.46,-165.69],[-124.44,-167.18],[-131.36,-169.66],[-165.38,-184.16],[-168.39,-185.44],[-235.21,-214.85],[-245.33,-219.39],[-251.05,-221.5],[-257.62,-223.42],[-264.21,-224.88],[-271.53,-225.71],[-323.2,-229.2],[-333.74,-229.91],[-342.31,-230.44],[-351.17,-231.56],[-359.65,-233.1],[-370.71,-236.08],[-391.76,-242.91],[-405.85,-247.0],[-424.0,-233.0],[-423.0,-212.0],[-406.0,-201.0],[-375.0,-192.5],[-326.0,-184.5],[-275.0,-181.0],[-253.0,-174.0],[-186.0,-144.5],[-149.0,-128.5],[-124.0,-121.5],[-111.0,-120.0],[-97.0,-121.0],[-80.0,-125.5],[-30.0,-153.0],[2.0,-170.0],[30.0,-164.0],[85.0,-139.0],[122.0,-126.0],[159.0,-117.0],[238.0,-101.0],[262.0,-99.0],[290.0,-102.0],[316.0,-92.0],[332.0,-74.0],[339.0,-50.0]];

// ---------- Shared helpers: where can a car actually be? ----------
function ct53Index(W){
 if(W.ct53I)return W.ct53I;const cell=24,grid=new Map(),S=W.samples,N=W.N;
 for(let i=0;i<N;i++){const p=S[i].p,cx=Math.floor(p.x/cell),cz=Math.floor(p.z/cell);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const k=(cx+a)+','+(cz+b);let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(i);}}
 return W.ct53I={cell,grid};
}
// Nearest point on the centreline: sample index, signed lane, height, distance (null when far away).
function ct53Near(W,x,z){
 const I=ct53Index(W),l=I.grid.get(Math.floor(x/I.cell)+','+Math.floor(z/I.cell));if(!l)return null;const S=W.samples,N=W.N;let best=Infinity,res=null;
 for(const i of l){const a=S[i].p,b=S[(i+1)%N].p,dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1),px=a.x+dx*u,pz=a.z+dz*u,d=(px-x)**2+(pz-z)**2;
  if(d<best){best=d;const n=S[i].n;res={i,lane:(x-px)*n.x+(z-pz)*n.z,y:a.y+(b.y-a.y)*u,distance:Math.sqrt(d)};}}
 return res;
}
// Lane of the barrier the physics uses on this side at this sample.
function ct53WallLane(W,i,side){try{return ph47WallLane(W,{e:W.e},{idx:i,pos:W.samples[i].p},{lane:side,n:W.samples[i].n,i});}catch(e){return ct48Street(W)?9:16;}}
function ct53PitZone(W,x,z,margin){if(!W.pit?.samples)return false;const q=dc32PitNear(W,{x,z});return !!q&&dc32PitPaved(W,q,margin);}
// True when a car could reach this point: on the track or run-off inside the barriers, or on the pit road.
// Street circuits: a point is inside when the line from the centreline to it crosses no wall.
function ct53GcInside(W,n,x,z,margin){
 const G=ct48GcSegments(W),s=W.samples[n.i],ax=s.p.x,az=s.p.z,dx=x-ax,dz=z-az,L=Math.hypot(dx,dz)||1,ex=x+dx/L*margin,ez=z+dz/L*margin,ids=new Set();
 for(let cx=Math.floor(Math.min(ax,ex)/G.cell);cx<=Math.floor(Math.max(ax,ex)/G.cell);cx++)for(let cz=Math.floor(Math.min(az,ez)/G.cell);cz<=Math.floor(Math.max(az,ez)/G.cell);cz++)for(const k of G.grid.get(cx+','+cz)||[])ids.add(k);
 for(const k of ids){const g=G.segs[k],rx=ex-ax,rz=ez-az,qx=g.bx-g.ax,qz=g.bz-g.az,den=rx*qz-rz*qx;if(Math.abs(den)<1e-9)continue;const t=((g.ax-ax)*qz-(g.az-az)*qx)/den,u=((g.ax-ax)*rz-(g.az-az)*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return false;}
 return true;
}
function ct53Drivable(W,x,z,margin=.5){
 const n=ct53Near(W,x,z);
 if(n&&n.distance<40&&ct48Gc(W)){if(ct53GcInside(W,n,x,z,margin))return true;}
 else if(n&&n.distance<40){const side=n.lane>=0?1:-1;if(Math.abs(n.lane)<ct53WallLane(W,n.i,side)+margin)return true;}
 if(W.pit?.samples){let close=false;for(let k=0;k<W.pit.samples.length;k+=6){const p=W.pit.samples[k].p;if(Math.abs(p.x-x)<60&&Math.abs(p.z-z)<60){close=true;break;}}if(close&&ct53PitZone(W,x,z,margin))return true;}
 return false;
}
function ct53HideInstance(m,k){const M=new THREE.Matrix4();m.getMatrixAt(k,M);M.scale(new THREE.Vector3(0,0,0));m.setMatrixAt(k,M);m.instanceMatrix.needsUpdate=true;}

// ---------- Batches: tag instanced meshes; footbridge feet outside the barriers; walls in the physics ----------
const ct53Flush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 const W=this,feet=this.batches['dc37-bridge-feet']?.rows,truss=this.batches['dc37-bridge-truss']?.rows;
 // Footbridges stood their legs 12.1 m out, inside the run-off where cars pass straight through them.
 // Each pair of feet now stands just behind that side's barrier and the truss spans between them.
 if(feet&&truss&&this.e.key!=='homebush')for(let b=0;b*2+1<feet.length;b++){const pair=[feet[b*2],feet[b*2+1]];
  for(const r of pair){const n=ct53Near(W,r[0],r[2]);if(!n)continue;const side=n.lane>=0?1:-1,need=Math.min(26,ct53WallLane(W,n.i,side)+1.1);if(Math.abs(n.lane)>=need)continue;const s=W.samples[n.i];r[0]=s.p.x+s.n.x*side*need;r[2]=s.p.z+s.n.z*side*need;}
  const [a,c]=pair,mx=(a[0]+c[0])/2,mz=(a[2]+c[2])/2,span=Math.hypot(a[0]-c[0],a[2]-c[2])+.5;
  for(const r of truss.slice(b*2,b*2+2)){r[0]=mx;r[2]=mz;r[3]=span;}}
 const snap=Object.entries(this.batches),out=ct53Flush.call(this);
 const inst=[];this.world.traverse(o=>{if(o.isInstancedMesh&&!o.name)inst.push(o);});
 for(const [k,b] of snap){const m=inst.find(o=>!o.name&&o.material===b.mat&&o.count===b.rows.length);if(m)m.name='batch:'+k;}
 // Barrier faces that sit a little inside the physics barrier line: the physics wall comes in to
 // meet them, so cars stop at the concrete instead of sinking half a metre into it.
 if(!ct48Gc(this)&&this.e.key!=='homebush'){const N=this.N,vis={'-1':new Float32Array(N).fill(99),'1':new Float32Array(N).fill(99)};
  for(const r of snap.find(([k])=>k==='wall')?.[1].rows||[]){const [x,,z,w,,d,yaw]=r,fx=Math.sin(yaw||0),fz=Math.cos(yaw||0);
   for(let t=-.5;t<=.5;t+=.125){const X=x+fx*d*t,Z=z+fz*d*t,n=ct53Near(this,X,Z);if(!n)continue;const inner=Math.abs(n.lane)-w/2,side=n.lane>=0?1:-1;
    if(this.pit?.samples&&(ct53PitZone(this,X,Z,4)||dc32Mouth(this,{x:X,z:Z})))continue;
    if(inner>7.6&&inner<16)for(let j=-2;j<=2;j++){const i=((n.i+j)%N+N)%N;vis[side][i]=Math.min(vis[side][i],inner+.05);}}}
  this.ct53Vis=vis;}
 return out;
};
const ct53WallLaneBase=ph47WallLane;
ph47WallLane=function(W,L,x,near){const base=ct53WallLaneBase(W,L,x,near),v=W.ct53Vis?.[Math.sign(near.lane)||1]?.[(x.idx||0)%W.N];return v&&v<base?v:base;};

// ---------- Final pass once the whole circuit exists ----------
function ct53StartGantry(W){
 W.world.traverse(o=>{if(!(o.isGroup&&o.children.length>=4&&!o.ct53Done))return;const c=o.children;
  if(!(c[0].geometry?.parameters?.height===10&&c[0].geometry.parameters.width===.45&&c[1].geometry?.parameters?.height===10))return;o.ct53Done=true;o.updateMatrixWorld(true);
  const lane=xl=>{const p=o.localToWorld(new THREE.Vector3(xl,0,0));return ct53Near(W,p.x,p.z);};
  const n0=lane(0);if(!n0)return;const n1=lane(1),dl=n1.lane-n0.lane;if(Math.abs(dl)<.2)return;
  const xs=[c[0].position.x,c[1].position.x].map(xl=>{const n=lane(xl);if(!n)return xl;
   if(ct48Gc(W)){const dir=Math.sign(xl)||1;let v=xl;for(let k=0;k<30;k++){const p=o.localToWorld(new THREE.Vector3(v,0,0));if(!ct53Drivable(W,p.x,p.z,.8))break;v+=dir*.6;}return v;}const side=n.lane>=0?1:-1,need=Math.min(19,ct53WallLane(W,n.i,side)+1.1);if(Math.abs(n.lane)>=need)return xl;return xl+(side*need-n.lane)/dl;});
  c[0].position.x=xs[0];c[1].position.x=xs[1];
  const beam=c.find(m=>m.geometry?.parameters?.width===22);if(beam){beam.position.x=(xs[0]+xs[1])/2;beam.scale.x=Math.abs(xs[1]-xs[0])/22;}
 });
}
// Pit entry and exit signs: the pole must stand off the track, run-off and pit road.
function ct53PitSigns(W){
 if(!W.pit?.samples)return;const poles=[],planes=[];
 W.world.traverse(o=>{if(!o.isMesh)return;const p=o.geometry?.parameters;if(!p)return;if(o.geometry.type==='BoxGeometry'&&p.width===.13&&p.height===2.9)poles.push(o);else if(o.geometry.type==='PlaneGeometry'&&p.width===5.6&&p.height===1.4)planes.push(o);});
 for(const pole of poles){const sign=planes.find(s=>Math.hypot(s.position.x-pole.position.x,s.position.z-pole.position.z)<.3);if(!sign)continue;
  const ok=(x,z)=>!ct53Drivable(W,x,z,.7)&&!ct53PitZone(W,x,z,1.2);
  if(ok(pole.position.x,pole.position.z))continue;
  const q0=dc32PitNear(W,pole.position),base=q0.f<.5?[.11,.09,.13,.07,.15,.05,.17]:[.88,.9,.86,.92,.84,.94,.82];let placed=false;
  for(const f of base){for(const d of [5.4,6.5,8,10])for(const s of [-1,1]){const q=dc32PitAt(W,f),x=q.p.x+q.n.x*s*W.pit.side*d,z=q.p.z+q.n.z*s*W.pit.side*d;
    if(!ok(x,z))continue;const tn=ct53Near(W,x,z);if(tn&&tn.distance<10)continue;
    const dy=sign.position.y-pole.position.y;pole.position.set(x,q.p.y+1.45,z);sign.position.set(x,q.p.y+1.45+dy,z);sign.rotation.y=Math.atan2(q.v.x,q.v.z)+Math.PI;placed=true;break;}
   if(placed)break;}
  if(!placed){pole.visible=false;sign.visible=false;}}
}
// Trees, shrubs and campsites: nothing growing or parked where a car can drive, and no branches
// hanging low over the racing surface.
const CT53_SOFT=/tree|gum|shrub|palm|foliage|campers|crown|trunk|bush|elm|cypress|banksia|grasstree|savanna|pandanus|speargrass|plant|hedge/i;
function ct53Greenery(W){
 const M=new THREE.Matrix4(),box=new THREE.Box3();let hidden=0;
 W.world.traverse(o=>{if(!o.isInstancedMesh||!(CT53_SOFT.test(o.name)||o.geometry.parameters?.width===2.34)||/verge grass/i.test(o.name))return;const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();o.updateWorldMatrix(true,false);
  for(let k=0;k<o.count;k++){o.getMatrixAt(k,M);if(Math.abs(M.elements[0])+Math.abs(M.elements[5])+Math.abs(M.elements[10])<1e-6)continue;M.premultiply(o.matrixWorld);box.copy(g.boundingBox).applyMatrix4(M);
   const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,n=ct53Near(W,cx,cz);
   let bad=ct53Drivable(W,cx,cz,.4);
   if(!bad&&n&&n.distance<60&&box.min.y<n.y+4.8)for(const [x,z] of [[box.min.x,box.min.z],[box.max.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.max.z]]){const m=ct53Near(W,x,z);if(m&&Math.abs(m.lane)<7.8&&box.min.y<m.y+4.8){bad=true;break;}}
   if(bad){ct53HideInstance(o,k);hidden++;}}});
 W.ct53Greenery=hidden;
}
// The chequered start line was laid at a fixed 27 cm and floated up to 10 cm over the asphalt.
function ct53StartLine(W){
 const M=new THREE.Matrix4(),P=new THREE.Vector3(),Q=new THREE.Quaternion(),S=new THREE.Vector3();
 W.world.traverse(o=>{const p=o.geometry?.parameters;if(!o.isInstancedMesh||o.geometry.type!=='BoxGeometry'||p.width!==1||p.depth!==.5||Math.abs(p.height-.03)>1e-6)return;
  for(let k=0;k<o.count;k++){o.getMatrixAt(k,M);M.decompose(P,Q,S);const g=gr27Surface(W,P.x,P.z,P.y,false,false);if(!g)continue;P.y=g.y+.004+p.height*S.y/2;M.compose(P,Q,S);o.setMatrixAt(k,M);}o.instanceMatrix.needsUpdate=true;});
}
// Sponsor boards: none standing on the racing surface or in the pit lane below head height.
function ct53Boards(W){
 W.world.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.name!=='Official Supercars and event sponsor panels')return;const g=o.geometry,pos=g.attributes.position,ix=g.index;o.updateWorldMatrix(true,false);
  const v=new THREE.Vector3(),cnt=ix?ix.count:pos.count;let n=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let j=0;j<cnt;j+=3){const ids=[0,1,2].map(t=>ix?ix.getX(j+t):j+t);let bad=false;
   a.fromBufferAttribute(pos,ids[0]).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,ids[1]).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,ids[2]).applyMatrix4(o.matrixWorld);
   const pts=[a,b,c,a.clone().add(b).multiplyScalar(.5),b.clone().add(c).multiplyScalar(.5),c.clone().add(a).multiplyScalar(.5),a.clone().add(b).add(c).multiplyScalar(1/3)];
   for(const p of pts){v.copy(p);const m=ct53Near(W,v.x,v.z);if(m&&Math.abs(m.lane)<7.4&&v.y<m.y+4.5&&!(W.pit?.samples&&ct53PitZone(W,v.x,v.z,0))){bad=true;break;}
    if(W.pit?.samples&&v.y<(m?.y??0)+4.5){const q=dc32PitNear(W,v);if(q&&q.distance<4&&Math.abs(q.lane)<3.6&&v.y<q.p.y+3.5){bad=true;break;}}}
   if(bad){for(const id of ids)pos.setXYZ(id,pos.getX(ids[0]),pos.getY(ids[0]),pos.getZ(ids[0]));n++;}}
  if(n){pos.needsUpdate=true;g.computeBoundingSphere();}W.ct53Boards=n;});
}
const ct53Particles=SC25World.prototype.makeParticles;
SC25World.prototype.makeParticles=function(...a){
 if(!this.ct53Done&&this.e.key!=='homebush'){this.ct53Done=true;for(const f of [ct53StartGantry,ct53PitSigns,ct53Greenery,ct53StartLine,ct53Boards])try{f(this);}catch(e){console.warn('ct53',f.name,e);}}
 return ct53Particles.apply(this,a);
};
