/* CT48 circuits. One continuous drivable ground around every road course, so the
   surface the car feels is exactly the surface you see:
   - kerbs are flush, 4.5 cm crowned ribbons that belong to the track surface;
   - grass shoulders run from the white line out to the terrain with a gentle crossfall,
     replacing the 7 m verge strip and its 40 cm drop onto the coarse terrain;
   - gravel traps sit on the outside of corners and slow the car;
   - Bathurst gets a real mountain, finer terrain and its own buildings (ct48-bathurst).
   Physics reads the same meshes through gr27Surface / ph47VergeAt. */
const CT48_STREET=['goldcoast','adelaide','townsville'];
const CT48_LANES=[7.0,8.45,10,12,14,16.5,19.5,24];
const CT48_DROP=[-.025,-.045,-.07,-.1,-.14,-.2];
function ct48Street(W){return CT48_STREET.includes(W.e.key);}
function ct48Smooth(t){t=clamp(t,0,1);return t*t*(3-2*t);}
// Ground ribbons must face up; flip the winding if a strip came out upside down.
function ct48Upright(g){g.computeVertexNormals();const n=g.attributes.normal;let y=0;for(let i=0;i<n.count;i++)y+=n.getY(i);if(y<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}g.index.needsUpdate=true;g.computeVertexNormals();}return g;}

// Corners: signed heading change over ±8 samples (the same test the kerbs always used).
function ct48Turn(W,i){const N=W.N,a=W.samples[((i-8)%N+N)%N].v,b=W.samples[((i+8)%N+N)%N].v;return Math.atan2(a.x*b.z-a.z*b.x,clamp(a.x*b.x+a.z*b.z,-1,1));}

// Gravel traps: outside of corners that turn more than ~25°, from turn-in to past the exit.
function ct48GravelZones(W){
 if(W.ct48Gravel)return W.ct48Gravel;const N=W.N,out={'-1':new Uint8Array(N+2),'1':new Uint8Array(N+2)};
 if(ct48Street(W))return W.ct48Gravel=out;
 for(let i=0;i<N;i++){let sum=0;for(let j=-14;j<=14;j+=2)sum+=ct48Turn(W,i+j)/15;if(Math.abs(sum)<.30)continue;
  // n is the left normal; a positive heading change turns left, so the outside is the right (-1).
  const outside=sum>0?-1:1;for(let j=-5;j<=16;j++)out[outside][((i+j)%N+N)%N]=1;}
 for(const side of ['-1','1']){const z=out[side];for(let i=0;i<N;i++)if(W.isWater(W.samples[i].p.x,W.samples[i].p.z))z[i]=0;}
 return W.ct48Gravel=out;
}

// How far out a shoulder can reach before it would fold over its own corner or another
// part of the circuit. Measured, then eroded and smoothed so the edge stays clean.
function ct48Reach(W){
 const N=W.N,S=W.samples,res={};
 for(const side of [-1,1]){const raw=new Float32Array(N);
  for(let i=0;i<N;i++){const s=S[i];let reach=CT48_LANES[1];
   for(const L of [10,12,14,16.5,19.5,24]){const x=s.p.x+s.n.x*side*L,z=s.p.z+s.n.z*side*L,n=W.nearest({x,z});if(n.distance<L-1.2)break;reach=L;}
   raw[i]=reach;}
  const eroded=new Float32Array(N),smooth=new Float32Array(N);
  for(let i=0;i<N;i++){let m=99;for(let j=-6;j<=6;j++)m=Math.min(m,raw[((i+j)%N+N)%N]);eroded[i]=m;}
  for(let i=0;i<N;i++){let m=0;for(let j=-4;j<=4;j++)m+=eroded[((i+j)%N+N)%N];smooth[i]=m/9;}
  res[side]=smooth;}
 return res;
}

// Terrain under the shoulders is pushed below them so it never pokes through the grass.
function ct48LowerTerrain(W,g){
 const d=W.sc26Terrain;if(!d||ct48Street(W))return;const p=g.attributes.position,N=d.N,size=d.size,cell=size/N,reach=CT48_LANES[CT48_LANES.length-1]+cell*.75;
 const seen=new Set();
 for(const s of W.samples)for(let lane=-reach;lane<=reach;lane+=cell*.5){
  const x=s.p.x+s.n.x*lane,z=s.p.z+s.n.z*lane,gx=Math.round((x/size+.5)*N),gz=Math.round((z/size+.5)*N);if(gx<0||gz<0||gx>N||gz>N)continue;const k=gz*(N+1)+gx;if(seen.has(k))continue;seen.add(k);
  const vx=p.getX(k),vz=p.getZ(k),n=W.nearest({x:vx,z:vz});if(n.distance>CT48_LANES[5]+1)continue;
  const limit=n.y-.34;if(p.getY(k)>limit)p.setY(k,limit);
 }
 d.positions=Array.from(p.array);p.needsUpdate=true;g.computeVertexNormals();
}
const ct48Terrain=SC25World.prototype.makeTerrainGeometry;
SC25World.prototype.makeTerrainGeometry=function(){
 const g=this.e.key==='bathurst'&&typeof ct48BathurstTerrain==='function'?ct48BathurstTerrain(this):ct48Terrain.call(this);
 ct48LowerTerrain(this,g);this.ct48TerrainGeometry=g;return g;
};

function ct48KerbMaterial(W){
 if(W.ct48KerbMat)return W.ct48KerbMat;
 const tex=W.texture(64,256,(c,w,h)=>{
  c.fillStyle='#c1262c';c.fillRect(0,0,w,h/2);c.fillStyle='#ecebe4';c.fillRect(0,h/2,w,h/2);
  // Rubber and grit along the racing side, slightly worn paint on the crown.
  for(let i=0;i<1600;i++){c.fillStyle=W.rnd()<.6?'rgba(30,30,30,.10)':'rgba(255,255,255,.06)';c.fillRect(W.rnd()*w*(W.rnd()<.6?.45:1),W.rnd()*h,1+W.rnd()*3,1+W.rnd()*3);}
  c.fillStyle='rgba(0,0,0,.18)';c.fillRect(0,0,w*.12,h);
 });
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
 return W.ct48KerbMat=new THREE.MeshStandardMaterial({map:tex,roughness:.62,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
}

// Flush kerbs: four strips across, highest 4.5 cm on the crown, outer lip back to road level.
function ct48Kerbs(W){
 const flags=ph47Kerbs(W),N=W.N,S=W.samples,lanes=[7.0,7.18,7.55,8.15,8.45],rise=[.012,.03,.045,.045,.004],pos=[],uv=[],ix=[];
 for(const side of [-1,1]){let i=0;
  while(i<N){if(!flags[i]){i++;continue;}let j=i;while(j<N&&flags[j])j++;
   const run=[];for(let k=Math.max(0,i-1);k<=Math.min(N,j+1);k++)run.push(S[k%N]);
   let dist=0;const base=pos.length/3;
   for(let r=0;r<run.length;r++){const s=run[r];if(r)dist+=s.p.distanceTo(run[r-1].p);
    // Kerbs tilt with the track; they never stick up as blocks.
    lanes.forEach((L,k)=>{pos.push(s.p.x+s.n.x*side*L,s.p.y+.01+rise[k],s.p.z+s.n.z*side*L);uv.push(k/(lanes.length-1),dist/3.2);});}
   const M=lanes.length;for(let r=0;r<run.length-1;r++)for(let k=0;k<M-1;k++){const a=base+r*M+k,b=a+M;if(side>0)ix.push(a,b,a+1,a+1,b,b+1);else ix.push(a,a+1,b,a+1,b+1,b);}
   i=j;}
 }
 if(!ix.length)return null;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 const mesh=W.mesh(g,ct48KerbMaterial(W));mesh.name='Flush kerbs';mesh.castShadow=false;mesh.receiveShadow=true;
 (W.gr27Pavement||=[]).push({mesh,route:'track'});W.gr27SurfaceIndex=null;return mesh;
}


// Pit lane and garage floors (garages run 9.5–19.5 m from the pit centreline, the pit
// building's rear block to 23.5 m). Ground inside them must stay under the floor.
function ct48PitFloor(W,x,z,margin=1.5){
 if(!W.pit?.samples)return null;const q=dc32PitNear(W,{x,z});if(!q)return null;
 if(dc32PitPaved(W,q,margin))return q.p.y;const side=q.lane*W.pit.side;
 return q.f>.17&&q.f<.83&&side>-4-margin&&side<23.5+margin&&q.distance<24+margin?q.p.y:null;
}
// The pit lane and garages sit on a level pad; the terrain eases down to it over 35 m, so
// no grass or hillside can come up through the garage floors. Runs once the pit exists.
function ct48FlattenPit(W){
 const g=W.ct48TerrainGeometry,d=W.sc26Terrain;if(!g||!d||!W.pit?.samples)return;const p=g.attributes.position,pit=W.pit,xs=pit.samples.map(s=>s.p.x),zs=pit.samples.map(s=>s.p.z),pad=70;
 const x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,z0=Math.min(...zs)-pad,z1=Math.max(...zs)+pad;let changed=0;
 for(let k=0;k<p.count;k++){const x=p.getX(k),z=p.getZ(k);if(x<x0||x>x1||z<z0||z>z1)continue;const q=dc32PitNear(W,{x,z});if(!q)continue;
  const side=q.lane*pit.side,bay=q.f>.17&&q.f<.83,lo=bay?-6:-5,hi=bay?25:5,lat=side<lo?lo-side:side>hi?side-hi:0,along=Math.max(0,(bay?Math.max(.17-q.f,q.f-.83):0))*pit.length,out=Math.hypot(lat,along)+(q.distance>Math.max(Math.abs(side),0)+1?q.distance-Math.abs(side):0);
  const target=q.p.y-.3,y=p.getY(k);if(y<=target)continue;const w=ct48Smooth(out/35),ny=target+(y-target)*w;if(ny<y-.001){p.setY(k,ny);changed++;}}
 if(changed){d.positions=Array.from(p.array);p.needsUpdate=true;g.computeVertexNormals();}W.ct48PitFlattened=changed;
}
function ct48TerrainMesh(W){let found=null;W.world.traverse(o=>{if(!found&&o.isMesh&&o.geometry===W.ct48TerrainGeometry)found=o;});return found;}

// Grass shoulders, both sides, white line to terrain. Same UV mapping and material as the
// terrain so the join is invisible; heights come from the road edge, then ease into the
// rendered terrain. Gravel is laid on top as its own ribbon.
function ct48Shoulders(W){
 if(ct48Street(W))return null;
 const N=W.N,S=W.samples,M=CT48_LANES.length,reach=ct48Reach(W),terrain=ct48TerrainMesh(W),size=W.sc26Terrain?.size||W.span+2400,pos=[],uv=[],col=[],ix=[];
 const pitY=(x,z)=>ct48PitFloor(W,x,z);
 for(const side of [-1,1]){const base=pos.length/3;
  for(let i=0;i<=N;i++){const s=S[i%N],r=reach[side][i%N],f=clamp((r-CT48_LANES[1])/(CT48_LANES[M-1]-CT48_LANES[1]),.04,1),road=s.p.y+.01;
   for(let k=0;k<M;k++){const L=k<2?CT48_LANES[k]:CT48_LANES[1]+(CT48_LANES[k]-CT48_LANES[1])*f,x=s.p.x+s.n.x*side*L,z=s.p.z+s.n.z*side*L,T=gr26SceneryGround(W,x,z);
    let y=k<6?road+CT48_DROP[k]:k===6?road-.26+(T-(road-.26))*.45:T;
    if(k>=5&&k<M-1)y=Math.max(y,T+.04);
    // When a corner pinches the shoulder, the far edge still meets the terrain.
    if(k>=2&&f<1)y+=(T-y)*ct48Smooth((k-1)/(M-2))*(1-f);
    const py=pitY(x,z);if(py!==null)y=Math.min(y,py-.06);
    pos.push(x,y,z);uv.push(x/size+.5,z/size+.5);const shade=k<2?.9:1;col.push(.87*shade,shade,.84*shade);}
  }
  for(let i=0;i<N;i++)for(let k=0;k<M-1;k++){const a=base+i*M+k,b=a+M;if(side>0)ix.push(a,b,a+1,a+1,b,b+1);else ix.push(a,a+1,b,a+1,b+1,b);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ix);ct48Upright(g);
 const mat=terrain?.material||new THREE.MeshStandardMaterial({color:'#6e7a4b',roughness:1});
 const mesh=W.mesh(g,mat);mesh.name='Grass shoulders';mesh.receiveShadow=true;mesh.castShadow=false;
 return mesh;
}

function ct48GravelMaterial(W){
 if(W.ct48GravelMat)return W.ct48GravelMat;const climate=W.dc36Climate||{gravel:'#b5a38c'};
 const tex=W.texture(256,256,(c,w,h)=>{c.fillStyle=climate.gravel;c.fillRect(0,0,w,h);
  for(let i=0;i<22000;i++){const r=W.rnd();c.fillStyle=r<.4?'rgba(232,224,206,.55)':r<.75?'rgba(92,84,72,.45)':'rgba(160,140,110,.5)';const s=.6+W.rnd()*2.2;c.fillRect(W.rnd()*w,W.rnd()*h,s,s*(.6+W.rnd()*.8));}});
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
 // Soft edges: alpha fades over the first and last 18% across the trap.
 const edge=W.texture(64,4,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.18,'#fff');g.addColorStop(.82,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 const m=new THREE.MeshStandardMaterial({map:tex,color:'#efe7d6',roughness:1,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
 m.onBeforeCompile=sh=>{sh.uniforms.ct48Edge={value:edge};sh.vertexShader='attribute vec2 ct48Across;varying vec2 vCt48;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCt48=ct48Across;');
  sh.fragmentShader='uniform sampler2D ct48Edge;varying vec2 vCt48;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.a*=texture2D(ct48Edge,vec2(vCt48.x,.5)).a*vCt48.y;');};
 m.customProgramCacheKey=()=> 'ct48Gravel1';
 return W.ct48GravelMat=m;
}
// Gravel ribbons follow the shoulder surface 1.5 cm above it, lane 9.4 to the wall line.
function ct48Gravel(W,shoulder){
 if(!shoulder)return null;const zones=ct48GravelZones(W),N=W.N,M=CT48_LANES.length,P=shoulder.geometry.attributes.position,pos=[],uv=[],across=[],ix=[],cols=6;
 const surface=(side,i,L)=>{const base=(side>0?(N+1)*M:0)+i*M;let k=1;const o=W.samples[i%N],lane=j=>Math.abs((P.getX(base+j)-o.p.x)*o.n.x+(P.getZ(base+j)-o.p.z)*o.n.z);
  while(k<M-2&&lane(k+1)<L)k++;const a=lane(k),b=lane(k+1),t=b>a?clamp((L-a)/(b-a),0,1):0,va=base+k,vb=base+k+1;
  return[P.getX(va)+(P.getX(vb)-P.getX(va))*t,P.getY(va)+(P.getY(vb)-P.getY(va))*t+.015,P.getZ(va)+(P.getZ(vb)-P.getZ(va))*t,b];};
 for(const side of [-1,1]){const z=zones[side];let i=0;
  while(i<N){if(!z[i]){i++;continue;}let j=i;while(j<N&&z[j])j++;const base=pos.length/3,len=j-i+1;
   for(let r=0;r<=len;r++){const s=Math.min(N,i+r),fade=Math.min(1,Math.min(r,len-r)/4);
    const outer=Math.min(16.8,surface(side,s,99)[3]-.4);
    for(let c=0;c<cols;c++){const L=9.4+(Math.max(9.6,outer)-9.4)*c/(cols-1),[x,y,zz]=surface(side,s,L);pos.push(x,y,zz);uv.push(x/7,zz/7);across.push(c/(cols-1),fade);}}
   for(let r=0;r<len;r++)for(let c=0;c<cols-1;c++){const a=base+r*cols+c,b=a+cols;if(side>0)ix.push(a,b,a+1,a+1,b,b+1);else ix.push(a,a+1,b,a+1,b+1,b);}
   i=j;}
 }
 if(!ix.length)return null;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('ct48Across',new THREE.Float32BufferAttribute(across,2));g.setIndex(ix);ct48Upright(g);
 const mesh=W.mesh(g,ct48GravelMaterial(W));mesh.name='Gravel traps';mesh.receiveShadow=true;mesh.renderOrder=1;return mesh;
}

const ct48MakeTrack=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){
 ct48MakeTrack.call(this);
 ct48FlattenPit(this);
 ct48Kerbs(this);
 if(ct48Street(this))return;
 // The old verge strips and sunken gravel ribbons are replaced by the shoulders.
 const old=[];this.world.traverse(o=>{if(o.isMesh&&(o.name==='Gravel runoff'||(this.ph47Verges||[]).includes(o)))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 const shoulder=ct48Shoulders(this);this.ct48Shoulder=shoulder;this.ph47Verges=shoulder?[shoulder]:[];this.ph47VergeIndex=null;
 this.ct48GravelMesh=ct48Gravel(this,shoulder);
};

// Raised kerb blocks from the original layout are no longer drawn.
const ct48Flush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 for(const key of ['kerb-red','kerb-white'])delete this.batches[key];
 return ct48Flush.call(this);
};

// Gravel: much less grip and heavy rolling drag. Grass stays as before.
const ct48WheelSurface=ph47WheelSurface;
ph47WheelSurface=function(W,L,x,lane,ground,pit){
 const s=ct48WheelSurface(W,L,x,lane,ground,pit);
 if(s.kind==='grass'&&!pit){const abs=Math.abs(lane),side=lane>=0?1:-1,z=ct48GravelZones(W)[side];
  if(abs>9.4&&abs<17&&z&&z[x.idx||0])return{kind:'grass',gravel:true,mu:L.weather!=='Dry'?.38:.46,drag:.17,bump:.7};}
 return s;
};

// Close-up grass: two layers of world-space detail on the terrain and shoulders, fading
// out with distance, so the ground reads as grass rather than a smeared 57 m texture tile.
function ct48GrassDetail(W,m){
 if(!m||m.userData.ct48Detail)return;m.userData.ct48Detail=true;
 const tex=W.texture(256,256,(c,w,h)=>{c.fillStyle='#808080';c.fillRect(0,0,w,h);
  for(let i=0;i<9000;i++){const v=W.rnd()<.5?40+W.rnd()*60:150+W.rnd()*90;c.strokeStyle=`rgba(${v},${v},${v},.35)`;c.lineWidth=1;const x=W.rnd()*w,y=W.rnd()*h,a=-Math.PI/2+(W.rnd()-.5)*.9,l=3+W.rnd()*7;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.stroke();}
  for(let i=0;i<40;i++){const g=c.createRadialGradient(0,0,0,0,0,20+W.rnd()*30),x=W.rnd()*w,y=W.rnd()*h,v=W.rnd()<.5?95:165;g.addColorStop(0,`rgba(${v},${v},${v},.35)`);g.addColorStop(1,'rgba(128,128,128,0)');c.save();c.translate(x,y);c.fillStyle=g;c.fillRect(-50,-50,100,100);c.restore();}});
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;
 const prev=m.onBeforeCompile,key=m.customProgramCacheKey?.bind(m);
 m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);sh.uniforms.ct48Detail={value:tex};
  sh.vertexShader='varying vec3 vCt48World;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCt48World=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform sampler2D ct48Detail;varying vec3 vCt48World;\n'+sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  float ct48Fade=clamp(1.0-distance(vCt48World,cameraPosition)/260.0,0.0,1.0);
  vec3 ct48Fine=texture2D(ct48Detail,vCt48World.xz/2.6).rgb*2.0,ct48Mid=texture2D(ct48Detail,vCt48World.xz/19.0).rgb*2.0;
  diffuseColor.rgb*=mix(vec3(1.0),ct48Fine,.55*ct48Fade)*mix(vec3(1.0),ct48Mid,.35);`);};
 m.customProgramCacheKey=()=> (key?key():'')+'ct48Grass1';m.needsUpdate=true;
}
const ct48MakeTrackDetail=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){ct48MakeTrackDetail.call(this);ct48GrassDetail(this,ct48TerrainMesh(this)?.material);};

// Trackside walls were placed at road height; with the new shoulders the ground under them
// can fall away. Each wall block now reaches from below the ground at its lowest end to its
// own height above the ground at its highest end, before the catch fences are built on top.
function ct48SeatWalls(W){
 const rows=W.batches.wall?.rows;if(!rows)return;
 for(const r of rows){const [x,y,z,w,h,d,yaw]=r,fx=Math.sin(yaw||0),fz=Math.cos(yaw||0);let lo=Infinity,hi=-Infinity;
  for(const t of [-.5,-.25,0,.25,.5]){const X=x+fx*d*t,Z=z+fz*d*t,g=gr27Surface(W,X,Z,y-h/2,false);if(!g)continue;lo=Math.min(lo,g.y);hi=Math.max(hi,g.y);}
  if(!Number.isFinite(lo))continue;const bottom=lo-.3,top=hi+(ct48Street(W)?1.1:.85);r[1]=(top+bottom)/2;r[4]=top-bottom;}
}
const ct48SceneryWalls=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){ct48SeatWalls(this);return ct48SceneryWalls.call(this);};
