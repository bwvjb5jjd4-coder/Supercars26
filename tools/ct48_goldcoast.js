
/* CT48 Gold Coast: Surfers Paradise as a real street circuit.
   Streets: asphalt runs from the white line to the concrete walls; there is no grass or gravel.
   Where the track bends or jinks through a chicane, the walls keep running straight along the
   street, so a car that misses its braking point goes straight on down an escape road; the
   end of every escape road is closed by a crash-barrier wall. Physics uses the same walls.
   City: high-rise hotels and apartments (every one generated differently: glass towers,
   balcony towers with people watching, slender residential spires, older render blocks,
   low-rise motels and shops), palm-lined footpaths, street markets, the esplanade, the beach
   and the Pacific Ocean beyond the back straight. */
const CT48_GC={lane:9.6,escape:30,tol:8};
function ct48Gc(W){return W?.e?.key==='goldcoast';}

// ---------- Street walls ----------
// The streets are straight: the centreline is simplified to straight street axes (chicane
// wiggles and gentle bends fall inside one street). Each street is as wide as the track
// needs plus the run-off, the walls are the street edges, and where two streets meet the
// outside walls carry on to their intersection, which leaves an escape road straight ahead
// at every corner. Very sharp corners close the escape road with a barrier wall.
function ct48GcDP(P,a,b,tol,keep){let best=0,at=-1;const ax=P[a].x,az=P[a].z,dx=P[b].x-ax,dz=P[b].z-az,l=Math.hypot(dx,dz)||1;
 for(let i=a+1;i<b;i++){const d=Math.abs((P[i].x-ax)*dz-(P[i].z-az)*dx)/l;if(d>best){best=d;at=i;}}
 if(best>tol){ct48GcDP(P,a,at,tol,keep);keep.push(at);ct48GcDP(P,at,b,tol,keep);}}
function ct48GcStreets(W){
 const N=W.N,S=W.samples,P=S.slice(0,N).map(s=>s.p),{lane:B,escape:E}=CT48_GC;
 // Start the simplification at the sharpest corner so the loop's seam is a real corner.
 let start=0,sharp=0;for(let i=0;i<N;i++){const t=Math.abs(ct48Turn(W,i));if(t>sharp){sharp=t;start=i;}}
 const Q=[];for(let k=0;k<=N;k++)Q.push(P[(start+k)%N]);let far=0,fd=0;for(let k=0;k<N;k++){const d=Math.hypot(Q[k].x-Q[0].x,Q[k].z-Q[0].z);if(d>fd){fd=d;far=k;}}
 const keep=[0,far];ct48GcDP(Q,0,far,CT48_GC.tol,keep);ct48GcDP(Q,far,N,CT48_GC.tol,keep);keep.push(N);keep.sort((a,b)=>a-b);
 const idx=keep.map(k=>(start+k)%N),M=idx.length-1,segs=[];
 for(let k=0;k<M;k++){const a=Q[keep[k]],b=Q[keep[k+1]],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),vx=dx/l,vz=dz/l,nx=-vz,nz=vx,off={1:B,'-1':B};
  // Width: every sample that projects onto this street, both sides, plus the run-off.
  for(let j=keep[k]-3;j<=keep[k+1]+3;j++){const p=Q[((j%N)+N)%N],u=(p.x-a.x)*vx+(p.z-a.z)*vz;if(u<-2||u>l+2)continue;const lat=clamp((p.x-a.x)*nx+(p.z-a.z)*nz,-CT48_GC.tol-3,CT48_GC.tol+3);off[1]=Math.max(off[1],lat+B);off['-1']=Math.max(off['-1'],-lat+B);}
  segs.push({a,b,vx,vz,nx,nz,l,off,i0:idx[k],i1:idx[k+1]});}
 return segs;
}
function ct48GcWalls(W){
 if(W.ct48GcWallData)return W.ct48GcWallData;
 const N=W.N,S=W.samples,{lane:B,escape:E}=CT48_GC,streets=ct48GcStreets(W),M=streets.length,out={lane:{},lines:{},streets};
 for(const side of [-1,1]){const pts=[];
  const line=(s)=>({x:s.a.x+s.nx*side*s.off[side],z:s.a.z+s.nz*side*s.off[side],vx:s.vx,vz:s.vz,l:s.l});
  for(let k=0;k<M;k++){const s0=streets[(k-1+M)%M],s1=streets[k],A=line(s0),C=line(s1),den=A.vx*C.vz-A.vz*C.vx;
   // Corner between street k-1 and street k.
   const vx=s1.a.x,vz=s1.a.z;
   if(Math.abs(den)<.06){// Nearly straight on: a short step between the two street edges.
    const t0=((vx-A.x)*A.vx+(vz-A.z)*A.vz),p0={x:A.x+A.vx*t0,z:A.z+A.vz*t0},t1=((vx-C.x)*C.vx+(vz-C.z)*C.vz),p1={x:C.x+C.vx*t1,z:C.z+C.vz*t1};pts.push(p0,p1);continue;}
   const t=((C.x-A.x)*C.vz-(C.z-A.z)*C.vx)/den,X={x:A.x+A.vx*t,z:A.z+A.vz*t},reach=Math.hypot(X.x-vx,X.z-vz);
   const turn=s0.vx*s1.vz-s0.vz*s1.vx,inside=Math.sign(turn)===side;
   if(inside&&reach>1.5*Math.max(s0.off[side],s1.off[side])){// Sharp inside corner: cut across at the apex.
    pts.push({x:vx+s0.nx*side*s0.off[side],z:vz+s0.nz*side*s0.off[side]},{x:vx+s1.nx*side*s1.off[side],z:vz+s1.nz*side*s1.off[side]});}
   else if(reach<=E+B)pts.push(X);
   else{// Too far: run each street on by the escape length and close it off.
    const e=E,p0={x:vx+s0.nx*side*s0.off[side]+s0.vx*e,z:vz+s0.nz*side*s0.off[side]+s0.vz*e},p1={x:vx+s1.nx*side*s1.off[side]-s1.vx*e,z:vz+s1.nz*side*s1.off[side]-s1.vz*e};pts.push(p0,p1);}
  }
  // Densify to ≤3 m pieces so walls can be cut at the pit roads and indexed for physics.
  const dense=[];for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length],l=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(l/3));for(let j=0;j<n;j++)dense.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n,corner:j===0});}
  for(const p of dense){p.cut=false;if(W.pit?.samples){const q=dc32PitNear(W,p);if(dc32PitPaved(W,q,2.5)||W.pitDistance(p.x,p.z)<7)p.cut=true;}}
  const c2=dense.map(p=>p.cut);for(let i=0;i<dense.length;i++)if(dense[i].cut)for(let k=-1;k<=1;k++)c2[(i+k+dense.length)%dense.length]=true;dense.forEach((p,i)=>p.cut=c2[i]);
  out.lines[side]=dense;}
 // Lane of the wall straight out from every sample (for run-off checks and scenery).
 const segs=ct48GcSegments(W,out);
 for(const side of [-1,1]){const L=new Float32Array(N);
  for(let i=0;i<N;i++){const s=S[i],rx=s.n.x*side,rz=s.n.z*side;let best=Infinity;
   for(const g of segs.segs){if(g.side!==side)continue;const ex=g.bx-g.ax,ez=g.bz-g.az,den=rx*ez-rz*ex;if(Math.abs(den)<1e-6)continue;const qx=g.ax-s.p.x,qz=g.az-s.p.z,t=(qx*ez-qz*ex)/den,u=(qx*rz-qz*rx)/den;if(t>0&&u>=-.01&&u<=1.01&&t<best)best=t;}
   L[i]=Number.isFinite(best)&&best<E+B+12?best:B;}
  out.lane[side]=L;}
 return W.ct48GcWallData=out;
}
// Wall segments with (ox,oz) the unit normal pointing into the wall, indexed on a 20 m grid.
function ct48GcSegments(W,data){
 if(W.ct48GcSeg)return W.ct48GcSeg;const d=data||ct48GcWalls(W),segs=[],grid=new Map(),cell=20;
 for(const side of [-1,1]){const P=d.lines[side],n=P.length;
  for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n];if(a.cut||b.cut)continue;const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.05)continue;
   const ox=side>0?-dz/l:dz/l,oz=side>0?dx/l:-dx/l,near=W.nearest({x:(a.x+b.x)/2,z:(a.z+b.z)/2}),v=W.samples[near.i%W.N].v,cross=Math.abs(dx/l*v.x+dz/l*v.z)<.55&&near.distance>CT48_GC.lane+2;
   segs.push({ax:a.x,az:a.z,bx:b.x,bz:b.z,ox,oz,l,side,cross});}}
 segs.forEach((s,k)=>{for(let x=Math.floor((Math.min(s.ax,s.bx)-3)/cell);x<=Math.floor((Math.max(s.ax,s.bx)+3)/cell);x++)for(let z=Math.floor((Math.min(s.az,s.bz)-3)/cell);z<=Math.floor((Math.max(s.az,s.bz)+3)/cell);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(k);}});
 return W.ct48GcSeg={segs,grid,cell};
}
function ct48GcInside(W,x,z,margin=0){const n=W.nearest({x,z}),d=ct48GcWalls(W),s=W.samples[n.i%W.N],lat=(x-s.p.x)*s.n.x+(z-s.p.z)*s.n.z,side=lat>=0?1:-1;return Math.abs(lat)<d.lane[side][n.i%W.N]+margin;}

// Rigid-body contact against the real wall segments (same impulse model as every circuit).
const ct48GcWallsBase=ph47Walls;
ph47Walls=function(W,L,x,s,near,mass,Iz,dt){
 if(!ct48Gc(W))return ct48GcWallsBase(W,L,x,s,near,mass,Iz,dt);
 s.scrape=Math.max(0,s.scrape-dt*4);if(near.pit)return;
 const G=ct48GcSegments(W),l=DC33_HALF_LENGTH[x.team?.manufacturer]||2.45,w=PH47.width,fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),gx=Math.cos(x.yaw),gz=-Math.sin(x.yaw);
 const ids=new Set();for(const a of [-1,0,1])for(const b of [-1,0,1])for(const k of G.grid.get((Math.floor(x.pos.x/G.cell)+a)+','+(Math.floor(x.pos.z/G.cell)+b))||[])ids.add(k);
 let pen=0,rx=0,rz=0,cl=0,cw=0,ox=0,oz=0;
 for(const k of ids){const g=G.segs[k];
  // The car's centre must still be on the road side of this wall.
  const cc=(x.pos.x-g.ax)*g.ox+(x.pos.z-g.az)*g.oz;if(cc>.3)continue;
  for(const a of [l,-l])for(const b of [w,-w]){const px=fx*a+gx*b,pz=fz*a+gz*b,X=x.pos.x+px,Z=x.pos.z+pz,u=((X-g.ax)*(g.bx-g.ax)+(Z-g.az)*(g.bz-g.az))/(g.l*g.l);if(u<-.02||u>1.02)continue;
   const p=(X-g.ax)*g.ox+(Z-g.az)*g.oz;if(p>pen&&p<2.2){pen=p;rx=px;rz=pz;cl=a;cw=b;ox=g.ox;oz=g.oz;}}}
 if(pen<=0)return;
 x.pos.x-=ox*pen;x.pos.z-=oz*pen;const side=Math.sign(near.lane)||1;x.lane-=side*pen*Math.abs(ox*near.n.x+oz*near.n.z);
 let Vx=fx*x.v+gx*x.latV,Vz=fz*x.v+gz*x.latV,r=s.r;
 const vn=(Vx+r*rz)*ox+(Vz-r*rx)*oz;
 if(vn>0){
  const e=.26,cross=rz*ox-rx*oz,j=(1+e)*vn/(1/mass+cross*cross/Iz);
  Vx-=ox*j/mass;Vz-=oz*j/mass;r-=cross*j/Iz;
  const tx=-oz,tz=ox,crossT=rz*tx-rx*tz,vt=(Vx+r*rz)*tx+(Vz-r*rx)*tz,jt=clamp(-vt/(1/mass+crossT*crossT/Iz),-.5*j,.5*j);
  Vx+=tx*jt/mass;Vz+=tz*jt/mass;r+=crossT*jt/Iz;
  const hit=vn;x.v=Vx*fx+Vz*fz;x.latV=Vx*gx+Vz*gz;s.r=clamp(r,-6,6);
  if(hit>2.5){const amount=clamp((hit-2.5)*1.5,1,60);dcDamage(x,amount,Math.sign(cw)||1,Math.sign(cl)||1);ph47Impact(L,x,x.pos.x+rx,x.pos.y+.35,x.pos.z+rz,hit,ox,oz);
   if(hit>24&&Math.abs(ox*gx+oz*gz)>.75&&!s.tumble)ph47StartTumble(x,s,(ox*gx+oz*gz)*Math.min(9,hit*.2));}
 }else{const vt=Math.abs((Vx+r*rz)*-oz+(Vz-r*rx)*ox);if(vt>6){s.scrape=Math.min(1,vt/30);x.v*=Math.exp(-dt*.35);if(Math.random()<dt*14)ph47Sparks(sc25Engine,x.pos.x+rx,x.pos.y+.3,x.pos.z+rz,Vx*.6,Vz*.6,4);}}
};
const ct48GcWallLane=ph47WallLane;
ph47WallLane=function(W,L,x,near){if(!ct48Gc(W))return ct48GcWallLane(W,L,x,near);const d=ct48GcWalls(W),side=Math.sign(near.lane)||1;return d.lane[side][(x.idx||0)%W.N];};

// ---------- Ground: city paving at street level, the esplanade, beach and ocean ----------
function ct48GcBeachZ(W){return W.bounds.minZ-46;}
const ct48GcTerrainH=SC25World.prototype.terrainHeight;
SC25World.prototype.terrainHeight=function(x,z){if(!ct48Gc(this)||!this.bounds)return ct48GcTerrainH.call(this,x,z);return z<ct48GcBeachZ(this)-4?-1.6:0;};
const ct48GcTerrainGeo=SC25World.prototype.makeTerrainGeometry;
SC25World.prototype.makeTerrainGeometry=function(){
 if(!ct48Gc(this))return ct48GcTerrainGeo.call(this);
 // Land stops at the sea wall; one flat plane, 19 cm under the road surface.
 const size=this.span+2400,bz=ct48GcBeachZ(this),M=16,pos=[],uv=[],ix=[];
 for(let j=0;j<=M;j++)for(let i=0;i<=M;i++){const x=(i/M-.5)*size,z=bz-4+(size/2-bz+4)*j/M;pos.push(x,0,z);uv.push(x/size+.5,z/size+.5);}
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){const a=j*(M+1)+i;ix.push(a,a+M+1,a+1,a+1,a+M+1,a+M+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 g.computeVertexNormals();this.sc26Terrain=null;this.ct48GcGround=g;return g;
};

function ct48GcGroundMaterial(W){
 // Concrete footpath pavers with stains; the city's street grid (asphalt, kerbs, centre lines)
 // is drawn in the shader once the grid is known. World-space so nothing smears.
 const tex=W.texture(512,512,(c,w,h)=>{c.fillStyle='#a9a69e';c.fillRect(0,0,w,h);const r=()=>W.rnd();
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=138+Math.round((r()-.5)*22);c.fillStyle=`rgb(${v},${v-3},${v-10})`;c.fillRect(x*64+1,y*64+1,62,62);}
  for(let i=0;i<9000;i++){const v=r()<.5?60:240;c.fillStyle=`rgba(${v},${v},${v},${.04+r()*.05})`;c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}
  for(let i=0;i<22;i++){const g=c.createRadialGradient(0,0,0,0,0,10+r()*30),x=r()*w,y=r()*h;g.addColorStop(0,'rgba(70,64,56,.18)');g.addColorStop(1,'rgba(70,64,56,0)');c.save();c.translate(x,y);c.fillStyle=g;c.fillRect(-40,-40,80,80);c.restore();}});
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;
 W.ct48GcGridU={value:new THREE.Vector4(0,0,1,0)};
 const m=new THREE.MeshStandardMaterial({map:tex,roughness:.9,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4});
 m.onBeforeCompile=sh=>{sh.uniforms.gcGrid=W.ct48GcGridU;sh.uniforms.gcAsph={value:ct48GcAsphaltTexture(W)};
  sh.vertexShader='varying vec3 vGcW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGcW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform vec4 gcGrid;uniform sampler2D gcAsph;varying vec3 vGcW;\n'+sh.fragmentShader.replace('#include <map_fragment>',`float gcDist=distance(vGcW,cameraPosition);
  vec4 sampledDiffuseColor=texture2D(map,vGcW.xz/9.0);vec3 base=mix(sampledDiffuseColor.rgb,texture2D(map,vGcW.xz/97.0).rgb,clamp(gcDist/420.0,0.0,.7));
  vec2 rel=vGcW.xz-gcGrid.xy,A=gcGrid.zw,Bz=vec2(A.y,-A.x);float u=dot(rel,A),v=dot(rel,Bz),du=abs(mod(u,56.0)-28.0),dv=abs(mod(v,52.0)-26.0),aa=.05+gcDist*.002;
  float roadU=1.0-smoothstep(6.3-aa,6.3+aa,du),roadV=1.0-smoothstep(6.3-aa,6.3+aa,dv),road=max(roadU,roadV);
  float kerb=max((1.0-smoothstep(6.9-aa,6.9+aa,du))*(1.0-roadU),(1.0-smoothstep(6.9-aa,6.9+aa,dv))*(1.0-roadV));
  vec3 asph=texture2D(gcAsph,vGcW.xz/6.0).rgb*texture2D(gcAsph,vGcW.xz/41.0).rgb*1.9;asph=mix(asph,vec3(.27,.28,.29),clamp(gcDist/600.0,0.0,.8));
  float dash=(1.0-smoothstep(.09,.09+aa,du))*step(mod(v,7.0),3.5)*(1.0-roadV)+(1.0-smoothstep(.09,.09+aa,dv))*step(mod(u,7.0),3.5)*(1.0-roadU);
  vec3 col=mix(base,vec3(.80,.79,.76),kerb);col=mix(col,asph,road);col=mix(col,vec3(.92,.92,.88),dash*road);
  diffuseColor*=vec4(col,1.0);`);};
 m.customProgramCacheKey=()=> 'ct48GcGround2';return m;
}

// Run-off: asphalt from under the white line out to the wall on both sides, part of the
// drivable track surface. Old street lane lines show faintly through it.
function ct48GcRunoff(W){
 const d=ct48GcWalls(W),N=W.N,S=W.samples,pos=[],uv=[],ix=[];
 for(const side of [-1,1]){const base=pos.length/3,lane=d.lane[side];
  for(let i=0;i<=N;i++){const s=S[i%N],L=lane[i%N];for(const l of [6.9,L+.35]){const x=s.p.x+s.n.x*side*l,z=s.p.z+s.n.z*side*l;pos.push(x,s.p.y+.004,z);uv.push(x,z);}}
  for(let i=0;i<N;i++){const a=base+i*2,b=a+2;if(side>0)ix.push(a,b,a+1,a+1,b,b+1);else ix.push(a,a+1,b,a+1,b+1,b);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 const mesh=W.mesh(g,ct48GcAsphalt(W));mesh.name='Street run-off';mesh.receiveShadow=true;
 (W.gr27Pavement||=[]).push({mesh,route:'track'});W.gr27SurfaceIndex=null;return mesh;
}
function ct48GcAsphaltTexture(W){
 if(W.ct48GcAsphaltTex)return W.ct48GcAsphaltTex;const r=()=>W.rnd();
 // 1024² of worn city asphalt (covers 6 m): aggregate, binder, fine cracks, oil and rubber.
 const t=W.texture(1024,1024,(c,w,h)=>{c.fillStyle='#45484a';c.fillRect(0,0,w,h);
  for(let i=0;i<90000;i++){const v=40+Math.floor(r()*120),a=.10+r()*.22;c.fillStyle=`rgba(${v},${v},${v+3},${a})`;const s=r()<.9?1+r()*1.6:2+r()*3;c.fillRect(r()*w,r()*h,s,s);}
  for(let i=0;i<5000;i++){c.fillStyle=`rgba(205,200,190,${.12+r()*.2})`;c.fillRect(r()*w,r()*h,1.2,1.2);}
  for(let i=0;i<14;i++){c.strokeStyle=`rgba(20,20,22,${.25+r()*.25})`;c.lineWidth=1+r();c.beginPath();let x=r()*w,y=r()*h;c.moveTo(x,y);for(let k=0;k<12;k++){x+=(r()-.5)*40;y+=(r()-.5)*40;c.lineTo(x,y);}c.stroke();}
  for(let i=0;i<10;i++){const g=c.createRadialGradient(0,0,0,0,0,30+r()*70),x=r()*w,y=r()*h;g.addColorStop(0,'rgba(15,15,18,.20)');g.addColorStop(1,'rgba(15,15,18,0)');c.save();c.translate(x,y);c.scale(1,.6+r());c.fillStyle=g;c.fillRect(-110,-110,220,220);c.restore();}});
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return W.ct48GcAsphaltTex=t;
}
function ct48GcAsphalt(W){
 if(W.ct48GcRunoffMat)return W.ct48GcRunoffMat;
 const m=new THREE.MeshStandardMaterial({map:ct48GcAsphaltTexture(W),color:'#d8d8d6',roughness:.93,metalness:0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
 m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`vec4 sampledDiffuseColor=texture2D(map,vMapUv/6.0);vec3 gcFar=texture2D(map,vMapUv/41.0).rgb;
  diffuseColor*=vec4(sampledDiffuseColor.rgb*mix(vec3(1.0),gcFar*1.9,.35),1.0);`);};
 m.customProgramCacheKey=()=> 'ct48GcAsphalt1';return W.ct48GcRunoffMat=m;
}

// Racing surface: the same worn city asphalt as the run-off, in world space at 6 m and 41 m
// scales, a rubbered racing line, dust toward the edges and ghosts of the street's own lane
// markings painted out for the race.
function ct48GcRoad(W){
 const m=W.roadMaterial;if(!m||m.userData.ct48Gc)return;m.userData.ct48Gc=true;const N=W.N,rl=W.racingLine||[];
 W.world.traverse(o=>{if(!o.isMesh||o.material!==m)return;const p=o.geometry.attributes.position;if(p.count!==(N+1)*2)return;const lane=[],line=[];
  for(let i=0;i<=N;i++){const r=(rl[i%N]||0)*2.2;lane.push(-7,7);line.push(r,r);}o.geometry.setAttribute('gcLane',new THREE.Float32BufferAttribute(lane,1));o.geometry.setAttribute('gcRL',new THREE.Float32BufferAttribute(line,1));});
 m.map=ct48GcAsphaltTexture(W);m.color.set('#e2e2e0');m.roughness=.9;
 m.onBeforeCompile=sh=>{sh.vertexShader='attribute float gcLane;attribute float gcRL;varying float vGcLane;varying float vGcRL;varying vec3 vGcW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGcLane=gcLane;vGcRL=gcRL;vGcW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='varying float vGcLane;varying float vGcRL;varying vec3 vGcW;\n'+sh.fragmentShader.replace('#include <map_fragment>',`float gcD=distance(vGcW,cameraPosition);
  vec4 sampledDiffuseColor=texture2D(map,vGcW.xz/6.0);vec3 gcMid=texture2D(map,vGcW.xz/41.0).rgb*1.9;vec3 col=sampledDiffuseColor.rgb*mix(vec3(1.0),gcMid,.35);
  float rub=exp(-pow((vGcLane-vGcRL)/2.1,2.0));col*=1.0-rub*.28;
  float dust=smoothstep(4.8,6.8,abs(vGcLane));col=mix(col,col*1.18+vec3(.03,.025,.015),dust*.6);
  float ghost=(1.0-smoothstep(.06,.14,abs(abs(vGcLane)-3.5)))*step(mod(vGcW.x*.7+vGcW.z*.7,9.0),3.0);col=mix(col,col*.78,ghost*.6*clamp(1.0-gcD/200.0,0.0,1.0));
  col=mix(col,vec3(.30,.31,.32),clamp(gcD/700.0,0.0,.6));diffuseColor*=vec4(col,1.0);`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(.82,1.06,dot(texture2D(map,vGcW.xz/6.0).rgb,vec3(.33)))*(1.0-exp(-pow((vGcLane-vGcRL)/2.1,2.0))*.12);');};
 m.customProgramCacheKey=()=> 'ct48GcRoad1';m.needsUpdate=true;
}

// Walls: precast concrete blocks with a debris fence above; escape roads end in a wall of
// red, white and blue crash-barrier modules.
function ct48GcWallMeshes(W){
 const d=ct48GcWalls(W),G=ct48GcSegments(W),M=ct48WallMaterials(W),N=W.N,S=W.samples,y0=S[0].p.y-.2;
 const prof=[[0,0],[.05,.07],[.17,.32],[.24,1.12],[.62,1.12],[.62,-.2]],wall={p:[],uv:[],ix:[]},fence={p:[],uv:[],ix:[]},posts=[],tec=[];
 const add=(D,quad,u)=>{const k=D.p.length/3;D.p.push(...quad.flat());D.uv.push(...u);D.ix.push(k,k+1,k+2,k,k+2,k+3);};
 let along=0;
 for(const g of G.segs){const dx=(g.bx-g.ax)/g.l,dz=(g.bz-g.az)/g.l,cross=g.cross;
  if(cross){// Crash-barrier modules across the end of an escape road.
   for(let u=.9;u<g.l;u+=1.8)tec.push([g.ax+dx*u+g.ox*.6,y0,g.az+dz*u+g.oz*.6,Math.atan2(dx,dz)]);}
  const e=.06,ax=g.ax-dx*e,az=g.az-dz*e,bx=g.bx+dx*e,bz=g.bz+dz*e,u0=along/4,u1=(along+g.l)/4;along+=g.l;
  for(let m=0;m<prof.length-1;m++){const [o0,h0]=prof[m],[o1,h1]=prof[m+1],q=[[ax+g.ox*o0,y0+h0,az+g.oz*o0],[ax+g.ox*o1,y0+h1,az+g.oz*o1],[bx+g.ox*o1,y0+h1,bz+g.oz*o1],[bx+g.ox*o0,y0+h0,bz+g.oz*o0]];
   // Wind each face toward the road (or up, on the top).
   const n=[(q[1][1]-q[0][1])*(q[3][2]-q[0][2])-(q[1][2]-q[0][2])*(q[3][1]-q[0][1]),0,(q[1][0]-q[0][0])*(q[3][1]-q[0][1])-(q[1][1]-q[0][1])*(q[3][0]-q[0][0])];
   const want=m<3?-1:m===3?0:1,top=m===3;let flip;if(top){const ny=(q[1][2]-q[0][2])*(q[3][0]-q[0][0])-(q[1][0]-q[0][0])*(q[3][2]-q[0][2]);flip=ny<0;}else flip=(n[0]*g.ox+n[2]*g.oz)*want<0;
   const v0=Math.max(0,h0)/1.12*.5+(m>3?.5:0),v1=Math.max(0,h1)/1.12*.5+(m>3?.5:0);
   if(flip)add(wall,[q[0],q[3],q[2],q[1]],[u0,v0,u1,v0,u1,v1,u0,v1]);else add(wall,q,[u0,v0,u0,v1,u1,v1,u1,v0]);}
  if(!cross){const fo=.45,q=[[ax+g.ox*fo,y0+1.1,az+g.oz*fo],[bx+g.ox*fo,y0+1.1,bz+g.oz*fo],[bx+g.ox*fo,y0+4.3,bz+g.oz*fo],[ax+g.ox*fo,y0+4.3,az+g.oz*fo]];add(fence,q,[u0*8,0,u1*8,0,u1*8,6.4,u0*8,6.4]);
   for(let u=0;u<g.l;u+=4.2)if(((along-g.l+u)%8.4)<4.2)posts.push([g.ax+dx*u+g.ox*.5,y0+2.7,g.az+dz*u+g.oz*.5]);}
 }
 const make=(D,m,name)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(D.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(D.uv,2));g.setIndex(D.ix);g.computeVertexNormals();const o=W.mesh(g,m);o.name=name;return o;};
 const wm=make(wall,M.concrete,'Street concrete walls');wm.castShadow=true;make(fence,M.fence,'Street debris fence');
 const post=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,3.3,.1),M.post,posts.length),dm=new THREE.Object3D();posts.forEach((q,k)=>{dm.position.set(...q);dm.rotation.set(0,0,0);dm.updateMatrix();post.setMatrixAt(k,dm.matrix);});post.name='Debris fence posts';W.world.add(post);
 if(tec.length){const geo=new THREE.BoxGeometry(1.2,1.2,1.75);geo.translate(0,.6,0);const tm=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({roughness:.6}),tec.length),col=new THREE.Color();
  tec.forEach(([x,y,z,yaw],k)=>{dm.position.set(x,y,z);dm.rotation.set(0,yaw,0);dm.updateMatrix();tm.setMatrixAt(k,dm.matrix);tm.setColorAt(k,col.set(['#c8232c','#f2f2ee','#1f4fa0'][k%3]));});tm.name='Escape road barrier modules';tm.castShadow=true;W.world.add(tm);}
 W.ct48GcStats={...(W.ct48GcStats||{}),wallSegments:G.segs.length,escapeModules:tec.length};
}

// ---------- Hooks ----------
const ct48GcMakeTrack=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){
 ct48GcMakeTrack.call(this);if(!ct48Gc(this))return;
 // Paving instead of grass, and no grass verge strips.
 const ground=this.ct48GcGround;this.world.traverse(o=>{if(o.isMesh&&o.geometry===ground){o.material=ct48GcGroundMaterial(this);o.name='City ground';}});
 for(const o of this.ph47Verges||[]){o.removeFromParent();o.geometry.dispose();}this.ph47Verges=[];this.ph47VergeIndex=null;
 ct48GcRunoff(this);ct48GcRoad(this);
};
const ct48GcBuilding=SC25World.prototype.building;
SC25World.prototype.building=function(...a){if(ct48Gc(this))return false;return ct48GcBuilding.apply(this,a);};
const ct48GcStand=SC25World.prototype.grandstand;
SC25World.prototype.grandstand=function(...a){if(ct48Gc(this))return false;return ct48GcStand.apply(this,a);};
const ct48GcScenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 if(!ct48Gc(this))return ct48GcScenery.call(this);
 // The street walls replace the generic wall line and the catch fences built from it.
 if(this.batches.wall)this.batches.wall.rows=[];
 const out=ct48GcScenery.call(this);
 // The old flat sea, sand and surf boxes give way to the new beach and ocean.
 const old=[];this.world.traverse(o=>{if(o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material?.color&&['357e95','d6c9a8','93c6c3','c1ded7'].includes(o.material.color.getHexString()))old.push(o);});for(const o of old){o.removeFromParent();o.geometry.dispose();}
 ct48GcWallMeshes(this);ct48BuildGoldCoast(this);
 return out;
};
const ct48GcFlush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 if(ct48Gc(this)){
  for(const key of Object.keys(this.batches))if(/^(tree-|palm-|shrub-|fence-post|fence-wire|lightpole|floodlights|spectator-|fans-cap|canopy|vendor)/.test(key))delete this.batches[key];
  // Nothing loose may stand inside the walls (escape roads stay clear).
  for(const [key,b] of Object.entries(this.batches))if(!/kerb|pit|garage/.test(key))b.rows=b.rows.filter(r=>!ct48GcInside(this,r[0],r[2],1.2));
 }
 return ct48GcFlush.call(this);
};

// Trackside boards sit on the street walls; big billboards stand just behind them.
function ct48GcWallNear(W,x,z,r=1.5){const G=ct48GcSegments(W);for(const k of G.grid.get(Math.floor(x/G.cell)+','+Math.floor(z/G.cell))||[]){const g=G.segs[k],u=clamp(((x-g.ax)*(g.bx-g.ax)+(z-g.az)*(g.bz-g.az))/(g.l*g.l),0,1);if(Math.hypot(g.ax+(g.bx-g.ax)*u-x,g.az+(g.bz-g.az)*u-z)<r&&!g.cross)return true;}return false;}
const ct48GcBoard=dc37AddBoard;
dc37AddBoard=function(W,rows,p,normal,width,height,brand,type){
 if(ct48Gc(W)&&type==='billboard'){const n=W.nearest(p),i=n.i%W.N,s=W.samples[i],side=((p.x-s.p.x)*s.n.x+(p.z-s.p.z)*s.n.z)>=0?1:-1,L=ct48GcWalls(W).lane[side][i];
  const o=L+3.4,x=s.p.x+s.n.x*side*o,z=s.p.z+s.n.z*side*o;if(!ct48GcWallNear(W,s.p.x+s.n.x*side*L,s.p.z+s.n.z*side*L,1.2))return;
  p.set(x,p.y,z);normal.copy(s.n).multiplyScalar(-side);if(type==='billboard')normal.addScaledVector(s.v,-.4).normalize();}
 return ct48GcBoard(W,rows,p,normal,width,height,brand,type);
};

// ---------- City kit: CT48Kit with vertex tints and 300 m tiles for culling ----------
class CT48GcKit extends CT48Kit{
 constructor(W){super(W);this.tint=[1,1,1];this.tile='0';}
 begin(f){this.tile=Math.floor(f.x/520)+','+Math.floor(f.z/520);}
 bin(m){const key=m.uuid+'|'+this.tile;let b=this.bins.get(key);if(!b)this.bins.set(key,b={m,p:[],n:[],uv:[],c:[],ix:[]});return b;}
 quad(m,a,b,c,d,uv){super.quad(m,a,b,c,d,uv);const B=this.bin(m),t=this.tint;B.c.push(...t,...t,...t,...t);}
 tri(m,f,pts,out){const B=this.bin(m),n0=B.p.length;super.tri(m,f,pts,out);const t=this.tint;for(let i=n0;i<B.p.length;i+=3)B.c.push(...t);}
 // Vertical prism over a plan polygon (local x,z, counter-clockwise seen from above).
 prism(m,f,plan,y0,y1,top,bottom){const n=plan.length;let u=0;
  for(let i=0;i<n;i++){const [ax,az]=plan[i],[bx,bz]=plan[(i+1)%n],l=Math.hypot(bx-ax,bz-az),mx=(ax+bx)/2,mz=(az+bz)/2;
   this.lquad(m,f,[[ax,y0,az],[bx,y0,bz],[bx,y1,bz],[ax,y1,az]],[bz-az,0,-(bx-ax)],[u,y0,u+l,y0,u+l,y1,u,y1]);u+=l;}
  const tris=THREE.ShapeUtils.triangulateShape(plan.map(([x,z])=>new THREE.Vector2(x,z)),[]);
  for(const [cap,y,up] of [[top,y1,1],[bottom,y0,-1]]){if(!cap)continue;for(const t of tris)this.tri(cap,f,t.map(k=>[plan[k][0],y,plan[k][1]]),[0,up,0]);}}
 // Thin band around a plan (balustrades, fascias): outward-facing quads only.
 band(m,f,plan,y0,y1,closed=true){const n=plan.length;let u=0;for(let i=0;i<(closed?n:n-1);i++){const [ax,az]=plan[i],[bx,bz]=plan[(i+1)%n],l=Math.hypot(bx-ax,bz-az);this.lquad(m,f,[[ax,y0,az],[bx,y0,bz],[bx,y1,bz],[ax,y1,az]],[bz-az,0,-(bx-ax)],[u,0,u+l,0,u+l,y1-y0,u,y1-y0]);u+=l;}}
 flush(name,shadows=true){for(const [,B] of this.bins){if(!B.ix.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(B.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(B.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(B.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(B.c,3));g.setIndex(B.ix);g.computeBoundingSphere();
  const o=new THREE.Mesh(g,B.m);o.name=name;o.castShadow=shadows&&!B.m.transparent;o.receiveShadow=true;o.matrixAutoUpdate=false;o.updateMatrix();this.W.world.add(o);}this.bins.clear();}
}
function ct48GcPlan(kind,w,d,seed){
 const h=k=>ct48Hash(seed,k),hw=w/2,hd=d/2;
 if(kind==='chamfer'){const c=Math.min(w,d)*(.15+h(1)*.15);return[[-hw+c,-hd],[hw-c,-hd],[hw,-hd+c],[hw,hd-c],[hw-c,hd],[-hw+c,hd],[-hw,hd-c],[-hw,-hd+c]];}
 if(kind==='round'){const r=Math.min(w,d)*(.2+h(2)*.2),pts=[];for(const [cx,cz,a0] of [[hw-r,-hd+r,-Math.PI/2],[hw-r,hd-r,0],[-hw+r,hd-r,Math.PI/2],[-hw+r,-hd+r,Math.PI]])for(let k=0;k<=3;k++){const a=a0+k/3*Math.PI/2;pts.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r]);}return pts;}
 if(kind==='ellipse'){const pts=[];for(let k=0;k<16;k++){const a=-k/16*Math.PI*2;pts.push([Math.cos(a)*hw,Math.sin(a)*hd]);}return pts.reverse();}
 if(kind==='bow'){const pts=[[hw,-hd],[hw,hd]],bulge=w*.18;for(let k=0;k<=6;k++){const t=k/6;pts.push([-hw-bulge*Math.sin(Math.PI*t),hd-t*d]);}return pts;}
 if(kind==='L'){const cw=w*(.45+h(3)*.15),cd=d*(.45+h(4)*.15);return[[-hw,-hd],[hw,-hd],[hw,hd],[hw-cw,hd],[hw-cw,-hd+cd],[-hw,-hd+cd]];}
 return[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]];
}
// Plans are counter-clockwise seen from above in a frame whose x is away from the track
// and z along it; this makes sure of it.
function ct48GcCCW(plan){let a=0;for(let i=0;i<plan.length;i++){const [x0,z0]=plan[i],[x1,z1]=plan[(i+1)%plan.length];a+=x0*z1-x1*z0;}return a<0?plan.slice().reverse():plan;}
function ct48GcGrow(plan,o){// Offset a convex-ish plan outward by o.
 const n=plan.length,c=ct48GcCCW(plan),out=[];for(let i=0;i<n;i++){const p=c[(i-1+n)%n],q=c[i],r=c[(i+1)%n],e1=[q[0]-p[0],q[1]-p[1]],e2=[r[0]-q[0],r[1]-q[1]],l1=Math.hypot(...e1)||1,l2=Math.hypot(...e2)||1,n1=[e1[1]/l1,-e1[0]/l1],n2=[e2[1]/l2,-e2[0]/l2],m=[n1[0]+n2[0],n1[1]+n2[1]],ml=Math.hypot(...m)||1,k=o/Math.max(.35,(m[0]*n1[0]+m[1]*n1[1])/ml);out.push([q[0]+m[0]/ml*k,q[1]+m[1]/ml*k]);}
 return out;
}

// ---------- City materials (white-based textures, tinted per building by vertex colour) ----------
function ct48GcMaterials(W){
 if(W.ct48GcMats)return W.ct48GcMats;const r=()=>W.rnd(),std=o=>new THREE.MeshStandardMaterial({vertexColors:true,...o});
 const tex=(w,h,draw,mx,my)=>{const t=ct48Tex(W,w,h,draw,mx,my);t.anisotropy=8;return t;};
 // Curtain wall: 1.6 m panes, one floor (3.3 m) per tile row, spandrel at the slab, sky gradient.
 const glass=tex(256,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,w*.3,h);g.addColorStop(0,'#c9d6dd');g.addColorStop(.45,'#8fa3ae');g.addColorStop(1,'#b8c6cc');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let k=0;k<4;k++){const y=k*h/2;c.fillStyle='rgba(255,255,255,.10)';c.beginPath();c.moveTo(r()*w,y);c.lineTo(w,y+h*.2);c.lineTo(w,y+h*.32);c.lineTo(0,y+h*.1);c.fill();}
  for(let fl=0;fl<2;fl++){const y=fl*h/2;c.fillStyle='#5d666b';c.fillRect(0,y,w,h*.06);c.fillStyle='rgba(30,40,45,.35)';c.fillRect(0,y+h*.06,w,h*.04);for(let x=0;x<w;x+=w/2){c.fillStyle='#6e777c';c.fillRect(x,y,4,h/2);}
   for(let x=0;x<w;x+=w/2)if(r()<.35){c.fillStyle=`rgba(${r()<.5?'240,236,226':'60,60,62'},.35)`;c.fillRect(x+5,y+h*.11,w/2-8,h*.36);}}},3.2,6.6);
 // Apartment balcony wall: floor-to-ceiling sliding doors with frames, curtains, dark interiors.
 const doors=tex(512,256,(c,w,h)=>{c.fillStyle='#f1efe9';c.fillRect(0,0,w,h);const bays=4,bw=w/bays;
  for(let i=0;i<bays;i++){const x=i*bw;c.fillStyle='#e9e7e0';c.fillRect(x,0,bw,h);const g=c.createLinearGradient(0,h*.1,0,h*.92);g.addColorStop(0,'#3b4a52');g.addColorStop(1,'#6d828c');c.fillStyle=g;c.fillRect(x+bw*.06,h*.12,bw*.88,h*.80);
   c.fillStyle='rgba(255,255,255,.14)';c.fillRect(x+bw*.1,h*.14,bw*.2,h*.76);c.fillStyle='#d8dadb';c.fillRect(x+bw*.49,h*.12,bw*.03,h*.8);c.fillRect(x+bw*.06,h*.12,bw*.88,h*.025);
   const cur=r();if(cur<.55){c.fillStyle=['rgba(236,226,206,.85)','rgba(210,214,216,.85)','rgba(196,170,140,.8)','rgba(245,245,240,.9)'][Math.floor(r()*4)];const cw=bw*(.12+r()*.3);c.fillRect(x+bw*.08,h*.13,cw,h*.78);if(r()<.6)c.fillRect(x+bw*.92-cw*.8,h*.13,cw*.8,h*.78);}}
  c.fillStyle='#cfccc4';c.fillRect(0,h*.93,w,h*.07);},14.4,3.2);
 // Punched windows in render (older hotels, motels, side walls): 3.6 m bays, 3.0 m floors.
 const punched=tex(256,256,(c,w,h)=>{c.fillStyle='#f3f1ec';c.fillRect(0,0,w,h);for(let i=0;i<1600;i++){c.fillStyle=`rgba(0,0,0,${r()*.04})`;c.fillRect(r()*w,r()*h,2,2);}
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){const x=col*w/2+w*.09,y=row*h/2+h*.12,ww=w*.32,hh=h*.28;c.fillStyle='#d6d3cb';c.fillRect(x-3,y-3,ww+6,hh+8);const g=c.createLinearGradient(0,y,0,y+hh);g.addColorStop(0,'#2f3d45');g.addColorStop(1,'#5d727c');c.fillStyle=g;c.fillRect(x,y,ww,hh);c.fillStyle='#e6e4de';c.fillRect(x+ww/2-1.5,y,3,hh);if(r()<.5){c.fillStyle='rgba(235,225,200,.7)';c.fillRect(x+2,y+2,ww*.3,hh-4);}}},7.2,6.0);
 // Shopfronts: 4.5 m tall, signage band, glazing, doors, columns.
 const shop=tex(512,128,(c,w,h)=>{c.fillStyle='#e9e6df';c.fillRect(0,0,w,h);const n=4,sw=w/n;
  for(let i=0;i<n;i++){const x=i*sw,col=['#c3262f','#1f5f9e','#e0a020','#2f7d4f','#7a3e8e','#e86c2a','#203040','#d94f7a'][Math.floor(r()*8)];c.fillStyle=col;c.fillRect(x+4,4,sw-8,h*.2);c.fillStyle='rgba(255,255,255,.85)';for(let k=0;k<5;k++)c.fillRect(x+12+k*(sw-24)/5,10,(sw-24)/5-6,h*.08);
   const g=c.createLinearGradient(0,h*.3,0,h);g.addColorStop(0,'#3a4850');g.addColorStop(1,'#8a9ba3');c.fillStyle=g;c.fillRect(x+6,h*.3,sw-12,h*.7);c.fillStyle='rgba(255,240,210,.35)';c.fillRect(x+10,h*.55,sw-20,h*.2);c.fillStyle='#bfc4c6';c.fillRect(x+sw/2-2,h*.3,4,h*.7);c.fillStyle='#9a9fa2';c.fillRect(x,0,6,h);}},16,4.5);
 const plain=tex(64,64,(c,w,h)=>{c.fillStyle='#f4f2ee';c.fillRect(0,0,w,h);for(let i=0;i<500;i++){c.fillStyle=`rgba(0,0,0,${r()*.05})`;c.fillRect(r()*w,r()*h,2,2);}},3,3);
 const awning=tex(64,64,(c,w,h)=>{for(let x=0;x<w;x+=16){c.fillStyle='#f4f4f0';c.fillRect(x,0,8,h);c.fillStyle='#c9c9c4';c.fillRect(x+8,0,8,h);}},1.2,1.2);
 const pool=tex(128,128,(c,w,h)=>{c.fillStyle='#3fb2c8';c.fillRect(0,0,w,h);for(let i=0;i<60;i++){c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1.5;c.beginPath();const x=r()*w,y=r()*h;c.moveTo(x,y);c.quadraticCurveTo(x+8,y-6,x+16,y);c.stroke();}},4,4);
 const rail=tex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='rgba(200,215,220,.55)';c.fillRect(0,6,w,h-6);c.fillStyle='#e8eaea';c.fillRect(0,0,w,6);for(let x=0;x<w;x+=32)c.fillRect(x,0,3,h);},1.2,1.1);
 const pickets=tex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#f0f0ec';c.fillRect(0,0,w,6);c.fillRect(0,h-5,w,5);for(let x=0;x<w;x+=8)c.fillRect(x,0,3,h);},.8,1.1);
 const M={
  glass:ct48Night(W,std({map:glass,roughness:.08,metalness:.6,envMapIntensity:1.2})),
  doors:ct48Night(W,std({map:doors,roughness:.35,metalness:.15})),
  punched:ct48Night(W,std({map:punched,roughness:.8})),
  shop:ct48Night(W,std({map:shop,roughness:.45,metalness:.1})),
  plain:std({map:plain,roughness:.85}),
  metal:std({color:'#ffffff',roughness:.4,metalness:.6}),
  awning:std({map:awning,roughness:.8,side:THREE.DoubleSide}),
  pool:std({map:pool,roughness:.1,metalness:.1}),
  railGlass:std({map:rail,transparent:true,depthWrite:false,roughness:.1,metalness:.2,side:THREE.DoubleSide}),
  railBar:std({map:pickets,alphaTest:.4,roughness:.5,metalness:.4,side:THREE.DoubleSide}),
  roof:std({map:plain,roughness:.95}),
 };
 return W.ct48GcMats=M;
}
// Colour palettes for tints (multiplied with the near-white textures).
const CT48_GC_TINT={
 glass:[[.62,.80,.92],[.55,.72,.70],[.72,.78,.82],[.80,.70,.55],[.45,.55,.62],[.66,.86,.84],[.85,.86,.88],[.50,.62,.78]],
 render:[[1,1,.98],[.98,.93,.84],[.96,.86,.80],[.84,.92,.93],[.93,.90,.82],[.98,.82,.72],[.85,.88,.80],[.90,.90,.92],[.98,.96,.88]],
 accent:[[.15,.35,.6],[.75,.25,.2],[.2,.55,.55],[.9,.6,.2],[.3,.3,.32],[.95,.95,.95],[.55,.75,.85]],
};
function ct48GcPick(list,v){return list[Math.floor(v*list.length)%list.length];}

// ---------- Buildings: frame f is centred on the footprint, x away from the track ----------
const CT48_GC_NAMES=['OCEAN SANDS','PARADISE TOWERS','SURF ROYALE','PACIFIC CREST','CORAL REEF RESORT','SEAVIEW','AQUA VISTA','SANDCASTLE','GOLDEN BREAKERS','THE ESPLANADE','SUNSET PALMS','BREAKWATER','SKYPOINT','MARINER','CAVILL SUITES','OCEANA','LAGUNA','HORIZON'];
function ct48GcPodium(K,f,w,d,seed,M,floors){
 const h=k=>ct48Hash(seed,k),plan=ct48GcPlan('rect',w,d,seed);K.tint=[1,1,1];K.prism(M.shop,f,plan,0,4.5,null,null);
 let y=4.5;for(let i=1;i<floors;i++){K.tint=ct48GcPick(CT48_GC_TINT.render,h(40+i));K.prism(h(41)<.5?M.glass:M.punched,f,plan,y,y+4,null,null);y+=4;}
 K.tint=[.9,.9,.88];K.prism(M.roof,f,ct48GcGrow(plan,.25),y,y+.35,M.roof,null);
 // Street awning along the front.
 K.tint=ct48GcPick(CT48_GC_TINT.accent,h(43));K.lquad(M.awning,f,[[-w/2-2.6,3.4,-d/2+.5],[-w/2-2.6,3.4,d/2-.5],[-w/2,3.9,d/2-.5],[-w/2,3.9,-d/2+.5]],[0,1,0],[0,0,d,0,d,2.6,0,2.6]);
 K.tint=[.8,.82,.84];for(let z=-d/2+1;z<d/2;z+=6)K.box(f,-w/2-2.45,1.7,z,.1,3.4,.1,M.metal);
 return y+.35;
}
function ct48GcCrown(K,f,plan,y,seed,M,kind){
 const h=k=>ct48Hash(seed,k),xs=plan.map(p=>p[0]),zs=plan.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);
 K.tint=[.86,.86,.84];K.prism(M.roof,f,plan,y,y+.3,M.roof,null);
 // Parapet band, rooftop plant, sometimes a lift overrun with a mast or a crown frame.
 K.tint=ct48GcPick(CT48_GC_TINT.render,h(50));K.band(M.plain,f,ct48GcGrow(plan,.05),y,y+1.3);
 K.tint=[.7,.72,.72];K.box(f,w*.1,y+1.4,-d*.15,Math.min(8,w*.35),2.2,Math.min(6,d*.3),{side:M.metal,top:M.roof});
 if(kind==='spire'){K.tint=[.92,.93,.94];K.cyl(f,0,y+18,0,.45,36,M.metal,8);K.cyl(f,0,y+3,0,2.2,6,M.plain,10);}
 else if(kind==='frame'){K.tint=ct48GcPick(CT48_GC_TINT.render,h(51));const g=ct48GcGrow(plan,.1);K.band(M.plain,f,g,y+5,y+7);for(const [x,z] of g)K.box(f,x,y+3.5,z,.5,7,.5,M.plain);}
 else if(kind==='slope'){K.tint=ct48GcPick(CT48_GC_TINT.glass,h(52));K.lquad(M.glass,f,[[-w/2,y,-d/2],[-w/2,y,d/2],[w/2,y+w*.45,d/2],[w/2,y+w*.45,-d/2]],[-1,1,0],[0,0,d,0,d,w,0,w]);for(const s of [-1,1])K.tri(M.glass,f,[[-w/2,y,s*d/2],[w/2,y,s*d/2],[w/2,y+w*.45,s*d/2]],[0,0,s]);K.lquad(M.plain,f,[[w/2,y,-d/2],[w/2,y,d/2],[w/2,y+w*.45,d/2],[w/2,y+w*.45,-d/2]],[1,0,0]);}
 else if(kind==='helipad'){K.tint=[.35,.37,.38];K.cyl(f,0,y+3.2,0,Math.min(w,d)*.38,.4,M.roof,12);K.tint=[.9,.9,.9];K.prism(M.roof,f,ct48GcPlan('ellipse',Math.min(w,d)*.76,Math.min(w,d)*.76,1),y+3.4,y+3.45,M.roof,null);for(const s of [-1,1])K.box(f,s*w*.2,y+1.7,0,.4,3.2,.4,M.metal);}
 else if(kind==='setback'){const p2=ct48GcGrow(plan,-Math.min(w,d)*.18);K.tint=ct48GcPick(CT48_GC_TINT.glass,h(53));K.prism(M.glass,f,p2,y+.3,y+7,null,null);K.tint=[.86,.86,.84];K.prism(M.roof,f,p2,y+7,y+7.3,M.roof,null);}
}
// Glass tower: tinted curtain wall over a shop podium, varied plan, bands, fins and crown.
function ct48GcGlassTower(K,W,f,w,d,H,seed,M){
 const h=k=>ct48Hash(seed,k),y0=ct48GcPodium(K,f,w,d,seed,M,1+Math.floor(h(1)*3)),kind=ct48GcPick(['rect','chamfer','round','ellipse','bow','L','rect'],h(2)),tw=w*(.62+h(3)*.22),td=d*(.62+h(4)*.25);
 const plan=ct48GcCCW(ct48GcPlan(kind,tw,td,seed));K.tint=ct48GcPick(CT48_GC_TINT.glass,h(5));K.prism(M.glass,f,plan,y0,H,null,null);
 if(h(6)<.5){K.tint=ct48GcPick(CT48_GC_TINT.render,h(7));const every=(2+Math.floor(h(8)*4))*3.3;for(let y=y0+every;y<H-2;y+=every)K.band(M.plain,f,ct48GcGrow(plan,.18),y,y+.7);}
 if(kind==='rect'&&h(9)<.6){K.tint=ct48GcPick(CT48_GC_TINT.render,h(10));for(let z=-td/2;z<=td/2+.01;z+=td/(4+Math.floor(h(11)*5)))K.box(f,-tw/2-.25,(y0+H)/2,z,.5,H-y0,.35,M.plain);}
 ct48GcCrown(K,f,plan,H,seed,M,ct48GcPick(['spire','frame','slope','helipad','setback','plain'],h(12)));
}
// Balcony tower: sliding-door walls behind continuous balconies, glass or bar balustrades.
function ct48GcBalconyTower(K,W,f,w,d,H,seed,M,people,watch){
 const h=k=>ct48Hash(seed,k),y0=ct48GcPodium(K,f,w,d,seed,M,1+Math.floor(h(1)*2)),kind=ct48GcPick(['rect','rect','chamfer','round','bow'],h(2)),bd=1.6+h(3)*1.0,tw=w*(.62+h(4)*.18),td=d*(.65+h(5)*.25);
 const plan=ct48GcCCW(ct48GcPlan(kind,tw,td,seed)),style=kind==='bow'?'wrap':ct48GcPick(['wrap','wrap','front','alternate','frontback'],h(6)),fh=3.1+h(7)*.3,slab=ct48GcPick(CT48_GC_TINT.render,h(8)),rail=h(9)<.65?M.railGlass:M.railBar,wall=h(10)<.5?[1,1,1]:ct48GcPick(CT48_GC_TINT.render,h(11));
 K.tint=wall;K.prism(M.doors,f,plan,y0,H,null,null);
 const grown=ct48GcGrow(plan,bd),front=[[-tw/2-bd,-td/2],[-tw/2,-td/2],[-tw/2,td/2],[-tw/2-bd,td/2]],back=front.map(([x,z])=>[-x,z]).reverse();
 let floor=0;
 for(let y=y0+fh;y<H-1;y+=fh,floor++){const wrap=style==='wrap'||(style==='alternate'&&floor%2===0);
  const parts=wrap?[grown]:style==='frontback'?[front,back]:[front];
  for(const pl of parts){K.tint=slab;K.prism(M.plain,f,ct48GcCCW(pl),y-.24,y,M.plain,M.plain);K.tint=[1,1,1];
   if(pl===grown)K.band(rail,f,pl,y,y+1.1);else{const [a,b,c,e]=pl[0][0]<0?[pl[0],pl[1],pl[2],pl[3]]:[pl[3],pl[2],pl[1],pl[0]];const outer=pl[0][0]<0?-1:1,x=outer<0?-tw/2-bd:tw/2+bd;
    K.lquad(rail,f,[[x,y,-td/2],[x,y,td/2],[x,y+1.1,td/2],[x,y+1.1,-td/2]],[outer,0,0],[0,0,td,0,td,1.1,0,1.1]);for(const s of [-1,1])K.lquad(rail,f,[[x,y,s*td/2],[outer<0?-tw/2:tw/2,y,s*td/2],[outer<0?-tw/2:tw/2,y+1.1,s*td/2],[x,y+1.1,s*td/2]],[0,0,s],[0,0,bd,0,bd,1.1,0,1.1]);}}
  // People out on the balconies facing the track (race weekend).
  if(watch&&floor<22&&(wrap||style!=='frontback'||true))for(let z=-td/2+1;z<td/2-.8;z+=1.9)if(ct48Hash(seed+floor*13,z*7)<.24){const p=K.at(f,-tw/2-bd*.45,y,z);people.push([p[0],p[1],p[2],Math.atan2(-f.ax.x,-f.ax.z)+(ct48Hash(z,floor)-.5)*.8,ct48Hash(seed,floor+z)]);}
 }
 ct48GcCrown(K,f,plan,H,seed,M,ct48GcPick(['frame','plain','slope','spire','setback'],h(12)));
}
// Slender residential spire: elliptical glass shaft ringed by balconies, tall mast.
function ct48GcSlender(K,W,f,w,d,H,seed,M,people,watch){
 const h=k=>ct48Hash(seed,k),y0=ct48GcPodium(K,f,w,d,seed,M,2),tw=Math.min(w,d)*(.55+h(1)*.15),td=Math.min(w,d)*(.75+h(2)*.2),plan=ct48GcCCW(ct48GcPlan('ellipse',tw,td,seed)),ring=ct48GcGrow(plan,1.5);
 K.tint=ct48GcPick(CT48_GC_TINT.glass,h(3));K.prism(M.glass,f,plan,y0,H,null,null);
 let floor=0;for(let y=y0+3.3;y<H-6;y+=3.3,floor++){K.tint=[.97,.97,.96];K.prism(M.plain,f,ring,y-.22,y,M.plain,M.plain);K.tint=[1,1,1];K.band(M.railGlass,f,ring,y,y+1.05);
  if(watch&&floor<16&&ct48Hash(seed,floor)<.5){const p=K.at(f,-tw/2-.8,y,(ct48Hash(floor,seed)-.5)*td*.6);people.push([p[0],p[1],p[2],Math.atan2(-f.ax.x,-f.ax.z),ct48Hash(seed,floor*3)]);}}
 K.tint=[.95,.95,.95];K.prism(M.roof,f,plan,H,H+.3,M.roof,null);K.cyl(f,0,H+H*.12,0,.6,H*.24,M.metal,8);K.cyl(f,0,H+2,0,tw*.3,4,M.glass,12);
}
// Older render hotel: punched windows, front balconies with bar rails, rooftop name.
function ct48GcRenderBlock(K,W,f,w,d,H,seed,M,people,watch){
 const h=k=>ct48Hash(seed,k),plan=ct48GcCCW(ct48GcPlan(h(1)<.7?'rect':'chamfer',w,d,seed)),tint=ct48GcPick(CT48_GC_TINT.render,h(2)),fh=3;
 K.tint=[1,1,1];K.prism(M.shop,f,plan,0,4.5,null,null);K.tint=tint;K.prism(M.punched,f,plan,4.5,H,null,null);
 const bd=1.4+h(3)*.6,deck=ct48GcPick(CT48_GC_TINT.accent,h(4));let floor=0;
 for(let y=4.5+fh;y<H-1;y+=fh,floor++){K.tint=deck.map(v=>.6+v*.4);K.box(f,-w/2-bd/2,y-.12,0,bd,.24,d*.86,M.plain);K.tint=[1,1,1];K.lquad(M.railBar,f,[[-w/2-bd,y,-d*.43],[-w/2-bd,y,d*.43],[-w/2-bd,y+1.05,d*.43],[-w/2-bd,y+1.05,-d*.43]],[-1,0,0],[0,0,d*.86,0,d*.86,1.05,0,1.05]);
  if(watch&&floor<14)for(let z=-d*.4;z<d*.4;z+=2.1)if(ct48Hash(seed+floor,z)<.22){const p=K.at(f,-w/2-bd*.5,y,z);people.push([p[0],p[1],p[2],Math.atan2(-f.ax.x,-f.ax.z),ct48Hash(z,seed+floor)]);}}
 ct48GcCrown(K,f,plan,H,seed,M,'plain');
 if(h(5)<.5)(W.ct48GcSigns||=[]).push({f,x:-w/2-.2,y:H+2.6,w:Math.min(d*.8,22),text:ct48GcPick(CT48_GC_NAMES,h(6))});
}
// Low-rise motel: external walkways, coloured doors, a pool in front, hipped roof.
function ct48GcMotel(K,W,f,w,d,seed,M){
 const h=k=>ct48Hash(seed,k),floors=2+Math.floor(h(1)*2),fh=3,H=floors*fh,bw=w*.55,x0=w/2-bw;
 K.tint=ct48GcPick(CT48_GC_TINT.render,h(2));K.box(f,x0+bw/2,H/2,0,bw,H,d,{side:M.punched,top:null});
 K.tint=ct48GcPick([[.75,.35,.28],[.4,.42,.45],[.6,.55,.5],[.3,.4,.5]],h(3));K.hip(f,x0+bw/2,H,0,bw,d,2.2,M.roof,.6);
 for(let k=1;k<=floors;k++){const y=k*fh-fh+.0;if(k>1){K.tint=[.92,.92,.9];K.box(f,x0-.9,y-.12,0,1.8,.24,d,M.plain);K.tint=[1,1,1];K.lquad(M.railBar,f,[[x0-1.8,y,-d/2],[x0-1.8,y,d/2],[x0-1.8,y+1,d/2],[x0-1.8,y+1,-d/2]],[-1,0,0],[0,0,d,0,d,1,0,1]);}}
 for(let z=-d/2+1;z<d/2;z+=4)K.box(f,x0-1.8,H/2,z,.15,H,.15,M.metal);
 // Pool and deck in the forecourt.
 K.tint=[.95,.93,.88];K.box(f,-w/2+(w-bw)/2,.08,0,(w-bw)*.9,.16,d*.8,M.plain);K.tint=[1,1,1];K.box(f,-w/2+(w-bw)/2,.12,0,(w-bw)*.55,.1,d*.45,{side:M.plain,top:M.pool});
 (W.ct48GcSigns||=[]).push({f,x:-w/2+.5,y:5.5,w:6,pole:true,text:ct48GcPick(['MOTEL','MOTOR INN','HOLIDAY UNITS','BEACH MOTEL','NO VACANCY'],h(4))});
 (W.ct48GcPalmSpots||=[]).push(K.at(f,-w/2+1.5,0,d/2-1.5),K.at(f,-w/2+1.5,0,-d/2+1.5));
}
// Shops: one or two floors, shopfronts, striped awning, parapet.
function ct48GcShops(K,W,f,w,d,seed,M){
 const h=k=>ct48Hash(seed,k),H=h(1)<.5?4.5:8.5,plan=ct48GcPlan('rect',w,d,seed);K.tint=[1,1,1];K.prism(M.shop,f,plan,0,4.5,null,null);
 if(H>5){K.tint=ct48GcPick(CT48_GC_TINT.render,h(2));K.prism(M.punched,f,plan,4.5,H,null,null);}
 ct48GcCrown(K,f,plan,H,seed,M,'plain');K.tint=ct48GcPick(CT48_GC_TINT.accent,h(3));K.lquad(M.awning,f,[[-w/2-2.2,3.2,-d/2],[-w/2-2.2,3.2,d/2],[-w/2,3.8,d/2],[-w/2,3.8,-d/2]],[0,1,0],[0,0,d,0,d,2.2,0,2.2]);
}

// ---------- People, palms, markets ----------
function ct48GcPeopleMeshes(W,list,name){
 if(!list.length)return;const T=THREE,parts=[],col=[];
 const add=(g,c)=>{g=g.toNonIndexed();const n=g.attributes.position.count;for(let i=0;i<n;i++)col.push(...c);parts.push(g);};
 const legs=new T.BoxGeometry(.32,.82,.2);legs.translate(0,.41,0);add(legs,[.35,.35,.4]);
 const torso=new T.BoxGeometry(.44,.6,.25);torso.translate(0,1.13,0);add(torso,[1,1,1]);
  const g=new T.BufferGeometry(),pos=[],nor=[];for(const p of parts){pos.push(...p.attributes.position.array);nor.push(...p.attributes.normal.array);}
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));
 const head=new T.IcosahedronGeometry(.12,0);head.translate(0,1.58,0);
 const body=new T.InstancedMesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.8}),list.length),heads=new T.InstancedMesh(head,new T.MeshStandardMaterial({roughness:.7}),list.length),d=new T.Object3D(),c=new T.Color();
 const shirts=['#e8e6df','#1c2a44','#c3262f','#f1c232','#2e5d9b','#3a3a3a','#1f6b3a','#e57b1f','#f2a7b8','#5bc0de','#ffffff','#7a3e8e'],skin=['#e2b48f','#c58e66','#8a5c3f','#f0c9a6','#d9a77c'];
 list.forEach(([x,y,z,yaw,v],i)=>{d.position.set(x,y,z);d.rotation.set(0,yaw,0);const s=.92+ct48Hash(x,z)*.16;d.scale.set(s,s,s);d.updateMatrix();body.setMatrixAt(i,d.matrix);heads.setMatrixAt(i,d.matrix);body.setColorAt(i,c.set(shirts[Math.floor(v*shirts.length)%shirts.length]));heads.setColorAt(i,c.set(skin[Math.floor(ct48Hash(z,x)*skin.length)]));});
 for(const m of [body,heads]){m.name=name;m.castShadow=false;m.receiveShadow=false;m.computeBoundingSphere();W.world.add(m);}
}
function ct48GcPalmTex(W){
 if(W.ct48GcPalmTex)return W.ct48GcPalmTex;const r=()=>W.rnd();
 // One frond: arched midrib with drooping leaflets, transparent background.
 const t=W.texture(256,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#6b7a3a';c.lineWidth=3;c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  for(let x=6;x<w-4;x+=4){const len=(h*.48)*Math.sin(Math.PI*Math.min(1,x/w*1.15))*(.8+r()*.3);for(const s of [-1,1]){c.strokeStyle=['#3f6b2c','#4d7a33','#5c8a3c','#36602a'][Math.floor(r()*4)];c.lineWidth=2.2;c.beginPath();c.moveTo(x,h/2);c.quadraticCurveTo(x+6,h/2+s*len*.5,x+10,h/2+s*len);c.stroke();}}});
 t.anisotropy=4;return W.ct48GcPalmTex=t;
}
function ct48GcPalms(W,spots){
 if(!spots.length)return;const T=THREE,tex=ct48GcPalmTex(W);
 // Trunk: gently curved, tapering, ringed bark (vertex colour bands).
 const tp=[],tc=[],ti=[],seg=6,sides=5;for(let k=0;k<=seg;k++){const t=k/seg,y=t*10,bend=t*t*.9,r=.24-.08*t,shade=(k%2?.82:1);for(let s=0;s<=sides;s++){const a=s/sides*Math.PI*2;tp.push(bend+Math.cos(a)*r,y,Math.sin(a)*r);tc.push(.62*shade,.55*shade,.45*shade);}}
 for(let k=0;k<seg;k++)for(let s=0;s<sides;s++){const a=k*(sides+1)+s,b=a+sides+1;ti.push(a,b,a+1,a+1,b,b+1);}
 const trunk=new T.BufferGeometry();trunk.setAttribute('position',new T.Float32BufferAttribute(tp,3));trunk.setAttribute('color',new T.Float32BufferAttribute(tc,3));trunk.setIndex(ti);trunk.computeVertexNormals();
 // Crown: 11 arched fronds (3 segments each) radiating from the top of the trunk.
 const fp=[],fu=[],fn=[],fi=[],top=[.9,10,0];
 for(let k=0;k<11;k++){const a=k/11*Math.PI*2+(k%2)*.2,dx=Math.cos(a),dz=Math.sin(a),px=-dz,pz=dx,lift=k%3===0?.6:k%3===1?.15:-.25,L=4.2+(k%4)*.35,base=fp.length/3;
  for(let j=0;j<=3;j++){const t=j/3,dist=t*L,y=top[1]+lift*dist*.6-dist*dist*.09,cx=top[0]+dx*dist,cz=top[2]+dz*dist,wd=.95*(1-t*.35);for(const s of [-1,1]){fp.push(cx+px*s*wd,y-(1-Math.abs(s))*.0-.08,cz+pz*s*wd);fu.push(t,s<0?0:1);fn.push(0,1,0);}}
  for(let j=0;j<3;j++){const q=base+j*2;fi.push(q,q+2,q+1,q+1,q+2,q+3);}}
 const crown=new T.BufferGeometry();crown.setAttribute('position',new T.Float32BufferAttribute(fp,3));crown.setAttribute('uv',new T.Float32BufferAttribute(fu,2));crown.setAttribute('normal',new T.Float32BufferAttribute(fn,3));crown.setIndex(fi);
 const mt=new T.InstancedMesh(trunk,new T.MeshStandardMaterial({vertexColors:true,roughness:.95}),spots.length),mc=new T.InstancedMesh(crown,new T.MeshStandardMaterial({map:tex,alphaTest:.4,side:T.DoubleSide,roughness:.8}),spots.length),d=new T.Object3D(),c=new T.Color();
 spots.forEach(([x,y,z],i)=>{const s=.75+ct48Hash(x,z,2)*.6;d.position.set(x,y,z);d.rotation.set(0,ct48Hash(x,z,3)*6.28,0);d.scale.set(s,s*(.9+ct48Hash(z,x)*.3),s);d.updateMatrix();mt.setMatrixAt(i,d.matrix);mc.setMatrixAt(i,d.matrix);const g=.85+ct48Hash(x,z,4)*.25;mc.setColorAt(i,c.setRGB(g,g,g*.9));});
 mt.name='Gold Coast palm trunks';mc.name='Gold Coast palm crowns';mt.castShadow=true;mc.castShadow=false;for(const m of [mt,mc]){m.computeBoundingSphere();m.receiveShadow=false;W.world.add(m);}
 W.ct48GcStats.palms=spots.length;
}
// Street market: rows of gazebo stalls with tables of goods and shoppers between them.
function ct48GcMarket(K,W,f,len,rows,M,people){
 const T=THREE,list=W.ct48GcStalls||=[];
 for(let r=0;r<rows;r++)for(let z=-len/2+2;z<len/2-1;z+=3.4){const x=r*7.5+(r%2?2.4:0),face=r%2?1:-1,p=K.at(f,x,0,z);list.push([p[0],p[2],Math.atan2(f.ax.x*face,f.ax.z*face),ct48Hash(p[0],p[2])]);
  if(ct48Hash(z,r)<.7){const q=K.at(f,x-face*2.4+(ct48Hash(r,z)-.5),0,z+(ct48Hash(z,r,1)-.5)*2);people.push([q[0],0,q[2],Math.atan2(f.ax.x*face,f.ax.z*face)+Math.PI,ct48Hash(q[0],q[2],7)]);}}
 // Paved market strip with a few benches and bins.
 K.tint=[.93,.9,.84];K.box(f,rows*3.75-1.5,.03,0,rows*7.5+3,.06,len+4,{side:M.plain,top:M.plain});
}
function ct48GcStallMeshes(W){
 const list=W.ct48GcStalls||[];if(!list.length)return;const T=THREE,d=new T.Object3D(),c=new T.Color();
 const roof=new T.ConeGeometry(2.25,.8,4,1);roof.rotateY(Math.PI/4);roof.translate(0,2.75,0);
 const legs=ct48Merge([-1,1].flatMap(s=>[-1,1].map(t=>{const l=new T.CylinderGeometry(.035,.035,2.35,4);l.translate(s*1.45,1.17,t*1.45);return l;})));
 const table=new T.BoxGeometry(2.6,.8,.9);table.translate(0,.4,-.9);const goods=new T.BoxGeometry(2.4,.22,.7);goods.translate(0,.91,-.9);
 const mk=(g,m,name,colour)=>{const im=new T.InstancedMesh(g,m,list.length);list.forEach(([x,z,yaw,v],i)=>{d.position.set(x,0,z);d.rotation.set(0,yaw,0);d.updateMatrix();im.setMatrixAt(i,d.matrix);if(colour)im.setColorAt(i,c.set(colour(v)));});im.name=name;im.computeBoundingSphere();W.world.add(im);return im;};
 mk(roof,new T.MeshStandardMaterial({roughness:.8,side:T.DoubleSide}),'Market stall canopies',v=>['#f4f4f0','#c3262f','#1f5f9e','#2f7d4f','#e0a020','#f4f4f0','#e86c2a'][Math.floor(v*7)]).castShadow=true;
 mk(legs,new T.MeshStandardMaterial({color:'#b9bfc2',metalness:.6,roughness:.4}),'Market stall legs');
 mk(table,new T.MeshStandardMaterial({color:'#e8e4da',roughness:.8}),'Market tables');
 mk(goods,new T.MeshStandardMaterial({roughness:.7}),'Market goods',v=>['#d24a3a','#f2c230','#7fb04a','#e57b1f','#8a5c3f','#4b7bb5','#e9a3b5','#f2efe6'][Math.floor(v*97)%8]);
 W.ct48GcStats.stalls=list.length;
}

// ---------- Beach, esplanade and ocean ----------
function ct48GcOcean(W){
 const T=THREE,bz=ct48GcBeachZ(W),size=W.span+2400;W.ct48GcTime||={value:0};
 // Sea wall: sandstone blocks from the esplanade down to the sand.
 const wallTex=ct48Tex(W,256,128,(c,w,h)=>{c.fillStyle='#cdb98f';c.fillRect(0,0,w,h);for(let row=0;row<3;row++)for(let k=-1;k<5;k++){const x=k*w/4+(row%2)*w/8,v=190+Math.round((W.rnd()-.5)*40);c.fillStyle=`rgb(${v},${v-14},${v-46})`;c.fillRect(x+2,row*h/3+2,w/4-4,h/3-4);}},4,1.5);
 const sea=new T.Mesh(new T.PlaneGeometry(size,1.1,1,1).rotateX(0),new T.MeshStandardMaterial({map:wallTex,roughness:.9}));sea.position.set(0,-.55,bz-4);W.world.add(sea);sea.name='Sea wall';
 // Sand: dry and pale at the top, darker and wet near the water, with footprints and ripples.
 const sandTex=W.texture(512,512,(c,w,h)=>{c.fillStyle='#e6d6b0';c.fillRect(0,0,w,h);for(let i=0;i<30000;i++){const v=W.rnd();c.fillStyle=v<.5?'rgba(170,150,110,.18)':'rgba(255,250,235,.25)';c.fillRect(W.rnd()*w,W.rnd()*h,1+W.rnd()*1.5,1+W.rnd()*1.5);}
  for(let i=0;i<260;i++){c.fillStyle='rgba(150,130,95,.18)';c.beginPath();c.ellipse(W.rnd()*w,W.rnd()*h,3,5,W.rnd()*3,0,7);c.fill();}});
 sandTex.wrapS=sandTex.wrapT=T.RepeatWrapping;sandTex.repeat.set(size/14,90/14);sandTex.anisotropy=8;
 const sg=new T.PlaneGeometry(size,90,4,12);sg.rotateX(-Math.PI/2);const sp=sg.attributes.position,cols=[];
 for(let k=0;k<sp.count;k++){const t=(sp.getZ(k)+45)/90;sp.setY(k,-1.05-(1-t)*.95);sp.setZ(k,bz-4-(1-t)*90);const wet=clamp((.32-t)/.25,0,1);cols.push(1-wet*.32,1-wet*.36,1-wet*.42);}
 sg.setAttribute('color',new T.Float32BufferAttribute(cols,3));sg.computeVertexNormals();const sand=new T.Mesh(sg,new T.MeshStandardMaterial({map:sandTex,vertexColors:true,roughness:.95}));sand.receiveShadow=true;sand.name='Surfers Paradise beach';W.world.add(sand);
 // Ocean: Gerstner-like swell in the normals, turquoise over the sandbar to deep blue offshore,
 // and lines of breaking surf rolling in.
 const og=new T.PlaneGeometry(size+9000,8000,1,1);og.rotateX(-Math.PI/2);og.translate(0,-1.75,bz-60-4000);
 const om=new T.MeshStandardMaterial({color:'#2a7f99',roughness:.12,metalness:.25,envMapIntensity:1.2});const shore=bz-60;
 om.onBeforeCompile=sh=>{sh.uniforms.gcTime=W.ct48GcTime;sh.vertexShader='varying vec3 vGcW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGcW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform float gcTime;varying vec3 vGcW;\n'+sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec2 gp=vGcW.xz;float tt=gcTime;vec2 g=vec2(0.0);
  g+=vec2(.0,1.0)*cos(dot(gp,vec2(.02,.11))+tt*1.3)*.22;g+=vec2(.6,.8)*cos(dot(gp,vec2(.17,.21))+tt*2.1)*.10;g+=vec2(-.7,.7)*cos(dot(gp,vec2(-.31,.27))+tt*2.9)*.06;g+=vec2(.9,.4)*cos(dot(gp,vec2(.63,.29))+tt*3.7)*.035;
  float fade=clamp(1.0-distance(vGcW,cameraPosition)/2500.0,.15,1.0);normal=normalize(normal+(viewMatrix*vec4(-g.x*fade,0.0,-g.y*fade,0.0)).xyz);`).replace('#include <color_fragment>',`#include <color_fragment>
  float off=${shore.toFixed(1)}-vGcW.z;vec3 shallow=vec3(.30,.78,.78),deep=vec3(.06,.27,.42);diffuseColor.rgb=mix(shallow,deep,smoothstep(20.0,420.0,off));
  float surf=0.0;for(int i=0;i<3;i++){float d=off-(20.0+float(i)*28.0)-sin(vGcW.x*.013+float(i))*6.0;surf+=smoothstep(3.5,0.0,abs(d+mod(gcTime*3.0,28.0)-14.0))*smoothstep(150.0,30.0,off);}
  surf+=smoothstep(10.0,0.0,off)*.8;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.96,.98,.98),clamp(surf,0.0,1.0)*.85);`);};
 om.customProgramCacheKey=()=> 'ct48GcOcean1';
 const ocean=new T.Mesh(og,om);ocean.name='Pacific Ocean';ocean.receiveShadow=false;W.world.add(ocean);
 return {bz};
}
const ct48GcAnimate=SC25World.prototype.animate;
SC25World.prototype.animate=function(now){if(this.ct48GcTime)this.ct48GcTime.value=(now||0)/1000;return ct48GcAnimate.call(this,now);};

// ---------- Placement ----------
function ct48GcRectHit(a,b){// Separating-axis test for two footprints {x,z,ax,az,w,d}.
 for(const r of [a,b])for(const [ux,uz] of [[r.ax.x,r.ax.z],[r.az.x,r.az.z]]){const pr=(q)=>Math.abs(q.ax.x*ux+q.ax.z*uz)*q.w/2+Math.abs(q.az.x*ux+q.az.z*uz)*q.d/2,dist=Math.abs((b.x-a.x)*ux+(b.z-a.z)*uz);if(dist>pr(a)+pr(b))return false;}return true;}
function ct48GcLotClear(W,f,w,d,gap=3){
 const bz=ct48GcBeachZ(W),half=(W.span+2400)/2-60,me={x:f.x,z:f.z,ax:f.ax,az:f.az,w:w+gap*2,d:d+gap*2};
 for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const lx=(a/4-.5)*(w+2),lz=(b/4-.5)*(d+2),x=f.x+f.ax.x*lx+f.az.x*lz,z=f.z+f.ax.z*lx+f.az.z*lz;
  if(z<bz+24||Math.abs(x)>half||Math.abs(z)>half)return false;const n=W.nearest({x,z});if(n.distance<13||ct48GcInside(W,x,z,4))return false;
  if(W.pit?.samples&&(W.pitDistance(x,z)<18||ct48PitFloor(W,x,z,8)!==null))return false;for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r)return false;}
 for(const o of W.ct48GcLots||[])if(Math.hypot(o.x-me.x,o.z-me.z)<(o.w+o.d+me.w+me.d)*.6&&ct48GcRectHit(o,me))return false;
 return true;
}
function ct48GcBuild(K,W,f,w,d,seed,M,people,near,far){
 const h=k=>ct48Hash(seed,k),bz=ct48GcBeachZ(W),beach=clamp(1-(f.z-bz)/900,.35,1),r=h(90);
 (W.ct48GcLots||=[]).push({x:f.x,z:f.z,ax:f.ax,az:f.az,w,d});K.begin(f);f.y=0;const st=W.ct48GcStats.types||(W.ct48GcStats.types={});
 const tall=(lo,hi)=>lo+(hi-lo)*Math.pow(h(91),1.6)*beach;let type;
 if(far){// Distant blocks: plain shafts with a crown, no balconies or podium detail.
  const H=tall(30,160),plan=ct48GcCCW(ct48GcPlan(ct48GcPick(['rect','chamfer','rect','round'],h(2)),w*.8,d*.8,seed)),glass=h(3)<.5;K.tint=glass?ct48GcPick(CT48_GC_TINT.glass,h(4)):ct48GcPick(CT48_GC_TINT.render,h(4));K.prism(glass?M.glass:M.punched,f,plan,0,H,null,null);K.tint=[.86,.86,.84];K.prism(M.roof,f,plan,H,H+.4,M.roof,null);st.far=(st.far||0)+1;return;}
 if(near&&r<.08||!near&&r<.03){type='shops';ct48GcShops(K,W,f,w,d,seed,M);}
 else if(r<(near?.17:.10)){type='motel';ct48GcMotel(K,W,f,w,d,seed,M);}
 else if(r<(near?.34:.30)){type='render';ct48GcRenderBlock(K,W,f,w,d,Math.round(tall(18,58)/3)*3+4.5,seed,M,people,near);}
 else if(r<(near?.70:.62)){type='balcony';ct48GcBalconyTower(K,W,f,w,d,tall(40,150),seed,M,people,near);}
 else if(r<.93){type='glass';ct48GcGlassTower(K,W,f,w,d,tall(45,175),seed,M);}
 else{type='slender';ct48GcSlender(K,W,f,w,d,tall(110,215),seed,M,people,near);}
 st[type]=(st[type]||0)+1;
}

// Pit wall between the pit lane and the apron, with the teams' timing stands behind it.
function ct48GcPitWall(K,W,MB){
 const pit=W.pit;if(!pit?.samples||!pit.bays?.length)return;const side=pit.bays[0].side,seg=70;
 for(let k=0;k<seg;k++){const fa=.2+.6*k/seg,fb=.2+.6*(k+1)/seg,a=dc32PitAt(W,fa),b=dc32PitAt(W,fb),az={x:b.p.x-a.p.x,z:b.p.z-a.p.z},l=Math.hypot(az.x,az.z)||1;az.x/=l;az.z/=l;
  const f={x:(a.p.x+b.p.x)/2-a.n.x*side*4.5,y:a.p.y-.2,z:(a.p.z+b.p.z)/2-a.n.z*side*4.5,ax:{x:-a.n.x*side,z:-a.n.z*side},az};K.begin(f);K.tint=[1,1,1];
  K.box(f,.3,.65,0,.6,1.3,l+.03,{side:MB.concreteWarm,top:MB.concrete});K.lquad(MB.rail,f,[[.05,1.3,-l/2],[.05,1.3,l/2],[.05,3.6,l/2],[.05,3.6,-l/2]],[-1,0,0]);if(k%2===0)K.box(f,.05,2.45,-l/2,.08,2.3,.08,MB.steel);}
 for(const bay of pit.bays){const q=dc32PitAt(W,bay.f),f={x:q.p.x-q.n.x*side*7.2,y:q.p.y-.2,z:q.p.z-q.n.z*side*7.2,ax:{x:-q.n.x*side,z:-q.n.z*side},az:{x:q.v.x,z:q.v.z}};K.begin(f);
  // Timing stand: raised platform, screens bench, stools, shade roof.
  K.box(f,0,.9,0,2.4,.2,4.2,{side:MB.darkSteel,top:MB.concrete});K.box(f,-.9,1.45,0,.5,.9,3.8,{side:MB.black,top:MB.black});for(const z of [-1.5,1.5])for(const x of [-1.1,1.1])K.box(f,x,1.9,z,.1,3.6,.1,MB.steel);K.box(f,0,3.75,0,2.8,.15,4.6,{side:MB.white,top:MB.roof,bottom:MB.underside});K.box(f,1.3,.45,0,.3,.9,1,MB.steel);}
}

// Beach life: umbrellas, towels, swimmers' gear, beachgoers and the lifesavers' flags and tower.
function ct48GcBeachLife(W,people){
 const T=THREE,bz=ct48GcBeachZ(W),size=W.span+2400,um=[],tw=[],d=new T.Object3D(),c=new T.Color();
 for(let i=0;i<520;i++){const x=(ct48Hash(i,1)-.5)*size*.6,t=ct48Hash(i,2),z=bz-12-t*40,y=-1.05-(t*40+8)/90*.95;if(ct48Hash(i,3)<.45)um.push([x,y,z,ct48Hash(i,4)]);tw.push([x+1.5,y+.02,z+.8,ct48Hash(i,5)]);
  for(let k=0;k<1+Math.floor(ct48Hash(i,6)*2);k++)people.push([x+(ct48Hash(i,k+7)-.5)*4,y,z+(ct48Hash(k,i)-.5)*4,ct48Hash(i,k)*6.28,ct48Hash(k,i,3)]);}
 // Swimmers standing in the shallows between the flags.
 for(let i=0;i<90;i++)people.push([(ct48Hash(i,9)-.5)*260+80,-2.6,bz-62-ct48Hash(i,10)*14,ct48Hash(i,11)*6.28,ct48Hash(i,12)]);
 const cone=new T.ConeGeometry(1.25,.5,10,1,true);cone.translate(0,2.1,0);const pole=new T.CylinderGeometry(.025,.025,2.2,4);pole.translate(0,1.1,0);const towel=new T.BoxGeometry(.8,.02,1.8);
 const mk=(g,list,mat,cols,name)=>{const m=new T.InstancedMesh(g,mat,list.length);list.forEach(([x,y,z,v],i)=>{d.position.set(x,y,z);d.rotation.set(0,v*6.28,0);d.updateMatrix();m.setMatrixAt(i,d.matrix);if(cols)m.setColorAt(i,c.set(cols[Math.floor(v*97)%cols.length]));});m.name=name;m.computeBoundingSphere();W.world.add(m);return m;};
 mk(cone,um,new T.MeshStandardMaterial({roughness:.8,side:T.DoubleSide}),['#f4f4f0','#c3262f','#1f5f9e','#f2c230','#2f9d8f','#e86c2a','#d94f7a'],'Beach umbrellas').castShadow=true;
 mk(pole,um,new T.MeshStandardMaterial({color:'#dcdcd6',roughness:.5}),null,'Beach umbrella poles');
 mk(towel,tw,new T.MeshStandardMaterial({roughness:.9}),['#e94b3c','#3a78c3','#f5d547','#50b36a','#ffffff','#f28cb1','#7e57c2'],'Beach towels');
 // Red and yellow flags and the lifesavers' tower.
 const flag=W.texture(64,64,(cx,w,h)=>{cx.fillStyle='#d8262c';cx.fillRect(0,0,w,h/2);cx.fillStyle='#f6cf1f';cx.fillRect(0,h/2,w,h/2);});
 for(const fx of [-50,210]){const y=-1.75;const p=new T.Mesh(new T.CylinderGeometry(.04,.04,4,5),W.mat('#d0d0d0',.5,.4));p.position.set(fx,y+2,bz-55);W.world.add(p);const fl=new T.Mesh(new T.PlaneGeometry(1.4,1),new T.MeshStandardMaterial({map:flag,side:T.DoubleSide}));fl.position.set(fx+.7,y+3.4,bz-55);W.world.add(fl);}
 const tower=new T.Group();tower.position.set(80,-1.3,bz-30);W.world.add(tower);for(const [x,z] of [[-1.2,-1.2],[1.2,-1.2],[-1.2,1.2],[1.2,1.2]]){const l=new T.Mesh(new T.CylinderGeometry(.08,.08,3.2,5),W.mat('#e8e8e2'));l.position.set(x,1.6,z);tower.add(l);}
 const cab=new T.Mesh(new T.BoxGeometry(3,2.2,3),new T.MeshStandardMaterial({color:'#f6cf1f',roughness:.6}));cab.position.y=4.3;tower.add(cab);const rf=new T.Mesh(new T.BoxGeometry(3.6,.2,3.6),W.mat('#d8262c'));rf.position.y=5.5;tower.add(rf);
 W.ct48GcStats.beach={umbrellas:um.length,towels:tw.length};
}
function ct48BuildGoldCoast(W){
 const K=new CT48GcKit(W),M=ct48GcMaterials(W),MB=ct48Materials(W),people=[],palms=[],bz=ct48GcBeachZ(W),walls=ct48GcWalls(W),streets=walls.streets;
 W.ct48GcStats={...(W.ct48GcStats||{})};W.ct48GcLots=[];W.ct48GcSigns=[];W.ct48GcPalmSpots=[];
 // Pit building with suites over the garages, and race control.
 K.tint=[1,1,1];K.begin({x:W.pit?.samples?.[120]?.p.x||0,z:W.pit?.samples?.[120]?.p.z||0});
 const sign=W.sign;W.sign=function(t,...a){return sign.call(this,t==='MOUNT PANORAMA  ·  BATHURST'?'GOLD COAST 500  ·  SURFERS PARADISE':t,...a);};
 try{ct48PitComplex(K,W,MB);}finally{W.sign=sign;}
 ct48GcPitWall(K,W,MB);
 // Grandstands behind the walls: the pit straight, the first chicane, the hairpin and the beach.
 const standAt=(ph,side,len,seat,brand)=>{const i=Math.floor(W.at(ph).t*W.N)%W.N,L=walls.lane[side][i];const f=ct48Find(W,ph,side,L+3.5,19,len+4,L+2,6,5);if(f){K.begin(f);ct48Grandstand(K,W,f,len,MB,MB.seats[seat],brand);W.ct48GcStats.stands=(W.ct48GcStats.stands||0)+1;}};
 const pitSide=W.pit?.side||-1;
 standAt(.985,-pitSide,60,'blue','Boost Mobile');standAt(.03,-pitSide,48,'red','Gold Coast 500');standAt(.10,1,44,'orange','Repco');standAt(.24,-1,40,'green','Supercheap Auto');standAt(.38,1,44,'blue','Dunlop');standAt(.62,1,40,'red','Shell');standAt(.80,-1,44,'orange','Penrite');
 // Markets: the beachfront esplanade and a closed street behind the back straight.
 const mkt=(x,z,yaw,len,rows)=>{const f={x,y:0,z,ax:{x:Math.sin(yaw),z:Math.cos(yaw)},az:{x:Math.cos(yaw),z:-Math.sin(yaw)}};K.begin(f);ct48GcMarket(K,W,f,len,rows,M,people);(W.ct48Reserved||=[]).push({x:x+f.ax.x*rows*3.7,z:z+f.ax.z*rows*3.7,r:len/2+6});};
 mkt(W.bounds.maxX-160,bz+8,0,150,2);mkt(W.bounds.maxX-420,bz+8,0,120,2);
 {const s=streets.reduce((a,b)=>b.l>a.l?b:a);const side=1,o=s.off[side]+9,c={x:(s.a.x+s.b.x)/2+s.nx*side*o,z:(s.a.z+s.b.z)/2+s.nz*side*o};const yaw=Math.atan2(s.nx*side,s.nz*side);mkt(c.x,c.z,yaw,90,2);}
 // Frontage: hotels and apartments along both sides of every street, footpath and palms in front.
 let seed=11;
 for(const s of streets)for(const side of [-1,1]){const o=s.off[side];let u=4;
  while(u<s.l-6){const d=22+ct48Hash(seed,1)*24,w=20+ct48Hash(seed,2)*16;let placed=false;
   for(const extra of [0,8,18]){const c=u+d/2,lane=o+7+extra+w/2,f={x:s.a.x+s.vx*c+s.nx*side*lane,y:0,z:s.a.z+s.vz*c+s.nz*side*lane,ax:{x:s.nx*side,z:s.nz*side},az:{x:s.vx,z:s.vz}};
    if(ct48GcLotClear(W,f,w,d)){ct48GcBuild(K,W,f,w,d,seed,M,people,true);placed=true;break;}}
   // Palm in front of each lot on the footpath.
   const pc=u+d*.5,pl=o+3.3,px=s.a.x+s.vx*pc+s.nx*side*pl,pz=s.a.z+s.vz*pc+s.nz*side*pl;if(ct48Hash(seed,5)<.75)palms.push([px,0,pz]);
   u+=d+(placed?2+ct48Hash(seed,3)*6:4);seed++;}}
 // The rest of the city on a grid aligned with the main streets; taller toward the beach.
 const main=streets.reduce((a,b)=>b.l>a.l?b:a),ax={x:main.nx,z:main.nz},az={x:main.vx,z:main.vz},R=Math.max(W.bounds.maxX-W.bounds.minX,W.bounds.maxZ-W.bounds.minZ)/2+600,cx=(W.bounds.minX+W.bounds.maxX)/2,cz=(W.bounds.minZ+W.bounds.maxZ)/2;
 W.ct48GcGrid={cx,cz,ax,az,su:56,sv:52};W.ct48GcGridU?.value.set(cx,cz,ax.x,ax.z);const parks=[];
 for(let i=-Math.ceil(R/56)*56;i<=R;i+=56)for(let j=-Math.ceil(R/52)*52;j<=R;j+=52){const jx=(ct48Hash(i,j)-.5)*5,jz=(ct48Hash(j,i)-.5)*5,x=cx+ax.x*(i+jx)+az.x*(j+jz),z=cz+ax.z*(i+jx)+az.z*(j+jz),w=20+ct48Hash(i,j,3)*14,d=22+ct48Hash(i,j,2)*14;
  const f={x,y:0,z,ax,az},dist=W.nearest({x,z}).distance;if(dist>620||dist>330&&ct48Hash(i,j,5)<.55)continue;
  if(ct48Hash(i,j,4)<.11){const p={x:cx+ax.x*i+az.x*j,y:0,z:cz+ax.z*i+az.z*j,ax,az};if(ct48GcLotClear(W,p,40,36,0))parks.push(p);continue;}
  if(ct48GcLotClear(W,f,w,d,4))ct48GcBuild(K,W,f,w,d,seed++,M,people,false,dist>330);}
 // Parks: lawn, paths, palms and a few people in the empty blocks.
 for(const p of parks){K.begin(p);K.tint=[.55,.72,.42];K.lquad(M.plain,p,[[-21,.03,-19],[21,.03,-19],[21,.03,19],[-21,.03,19]],[0,1,0],[0,0,42,0,42,38,0,38]);K.tint=[.92,.88,.8];K.lquad(M.plain,p,[[-1.5,.05,-19],[1.5,.05,-19],[1.5,.05,19],[-1.5,.05,19]],[0,1,0]);
  for(let k=0;k<7;k++)palms.push(K.at(p,(ct48Hash(p.x,k)-.5)*36,0,(ct48Hash(p.z,k)-.5)*32));for(let k=0;k<5;k++){const q=K.at(p,(ct48Hash(k,p.x)-.5)*30,0,(ct48Hash(k,p.z)-.5)*30);people.push([q[0],0,q[2],ct48Hash(q[0],q[2])*6.28,ct48Hash(q[2],q[0])]);}}
 W.ct48GcStats.parks=parks.length;
 // Esplanade: a row of palms along the sea wall and down the streets to the beach.
 for(let x=-R;x<R;x+=13)if(ct48Hash(x,3)<.85)palms.push([x+(ct48Hash(x,4)-.5)*3,0,bz+3+(ct48Hash(x,5)-.5)*1.5]);
 for(const p of W.ct48GcPalmSpots)palms.push(p);
 const okPalm=p=>!ct48GcInside(W,p[0],p[2],1.5)&&W.nearest({x:p[0],z:p[2]}).distance>11&&!(W.pit?.samples&&W.pitDistance(p[0],p[2])<12)&&!(W.ct48GcLots.some(o=>Math.abs((p[0]-o.x)*o.ax.x+(p[2]-o.z)*o.ax.z)<o.w/2+1.5&&Math.abs((p[0]-o.x)*o.az.x+(p[2]-o.z)*o.az.z)<o.d/2+1.5));
 ct48GcBeachLife(W,people);
 K.flush('Gold Coast city');
 ct48GcPalms(W,palms.filter(okPalm));ct48GcPeopleMeshes(W,people,'Gold Coast spectators');ct48GcStallMeshes(W);
 W.ct48GcStats.people=people.length;W.ct48GcStats.buildings=W.ct48GcLots.length;
 // Hotel names on rooftops and motel pole signs.
 for(const s of W.ct48GcSigns.slice(0,16)){const tex=W.sign(s.text,'#123247',1024,128),p=K.at(s.f,s.x,s.y,0);W.signPlane(tex,s.w,s.w/8,new THREE.Vector3(...p),Math.atan2(-s.f.ax.x,-s.f.ax.z));if(s.pole){const q=K.at(s.f,s.x,0,0),pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,s.y,6),MB.steel);pole.position.set(q[0],s.y/2-.4,q[2]);W.world.add(pole);}}
 ct48GcOcean(W);
}

// Full-face sponsor logos on every wall block and banners on the debris fence, laid along
// the street walls themselves (the generic wall rows are not used at the Gold Coast).
const ct48GcBoards=ct48WallBoards;
ct48WallBoards=function(W,brand,add){
 if(!ct48Gc(W))return ct48GcBoards(W,brand,add);
 const d=ct48GcWalls(W),y0=W.samples[0].p.y-.2,bh=.74,bw=bh*4,H=1.3;let n=0;
 for(const side of [-1,1]){const P=d.lines[side],m=P.length;let run=0,since=0;
  for(let i=0;i<m;i++){const a=P[i],b=P[(i+1)%m];if(a.corner)since=0;if(a.cut||b.cut){run=0;since=0;continue;}
   const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.05)continue;const ox=side>0?-dz/l:dz/l,oz=side>0?dx/l:-dx/l,normal=new THREE.Vector3(-ox,0,-oz);
   const near=W.nearest({x:a.x,z:a.z}),v=W.samples[near.i%W.N].v;if(Math.abs(dx/l*v.x+dz/l*v.z)<.55&&near.distance>CT48_GC.lane+2){run=0;continue;}
   for(let t=0;t<l;t+=.25){run+=.25;since+=.25;
    if(run>=bw+.12){run=0;const x=a.x+dx/l*(t-bw/2-.06)-ox*.14,z=a.z+dz/l*(t-bw/2-.06)-oz*.14;add(new THREE.Vector3(x,y0+.71,z),normal,bw,bh,brand(n++),'barrier');}
    if(since>=H*4+1&&(n%4===1)&&t+.25<l){since=0;const x=a.x+dx/l*(t-H*2)-ox*.38,z=a.z+dz/l*(t-H*2)-oz*.38;add(new THREE.Vector3(x,y0+1.3+H/2,z),normal,H*4,H,brand(n+5),'fence');}}
  }}
};
