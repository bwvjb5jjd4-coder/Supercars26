
/* CT52 Homebush: the Sydney Olympic Park street circuit (2009–2016), the season finale.
   Anticlockwise: Australia Avenue is the pit straight (pit lane on the left, grid on the
   right), T1 into Kevin Coombs Avenue, the T2-3-4 chicane at Olympic Boulevard, T5 onto
   Edwin Flack Avenue past the stadium, the T6-7 chicane, T8 (the fastest corner) onto Dawn
   Fraser Avenue, T9-10 through Showground Road onto Murray Rose Avenue, the T11-12
   right-left across Park Street beside the station and T13 back onto Australia Avenue.
   Street rules as at the Gold Coast (ct48_goldcoast.js, whose helpers this reuses): asphalt
   from the white line to the concrete walls, walls straight along each street with escape
   roads straight on at every corner, walls along the pit lane. Australia Avenue is the
   widest straight in Australian racing, Edwin Flack Avenue one of the narrowest.
   The layout is traced from the Wikipedia track map (tools/homebush_layout.py) and the world
   keeps that map's orientation; everything below is placed in map pixels through ct52Q.
   Precinct: ANZ Stadium with its arched roof trusses, the Showground stadium, the Dome and
   exhibition halls (the paddock), the arena, Olympic Boulevard's light towers and
   merchandise alley, the station, hotels, a few apartment towers, offices, car parks and
   the warehouses around the park. */
const CT52_HB={lane:9.4,wide:13.5,narrow:8.6,escape:30,tol:8,px:3.3165};
// Map pixel (on the 500x345 track map) to layout metres.
function ct52Q(px,py){return[(px-235)*CT52_HB.px,(py-168)*CT52_HB.px];}
function ct52Hb(W){return W?.e?.key==='homebush';}
CT48_STREET.push('homebush');
DC36_CLIMATE.homebush={grass:'#6f8053',gravel:'#b5a38c'};
DC37_EVENT_BRANDS.homebush='Dunlop';DC37_REGION_BRANDS.homebush=['Destination NSW Partner Page Lockup'];

// ---------- Street walls (the Gold Coast method, with a width per street) ----------
function ct52Width(s){
 const mx=(s.a.x+s.b.x)/2,mz=(s.a.z+s.b.z)/2,ns=Math.abs(s.vz)>.8;
 if(ns&&s.l>200&&mx>400)return CT52_HB.wide;    // Australia Avenue
 if(ns&&s.l>200&&mx<-400)return CT52_HB.narrow; // Edwin Flack Avenue
 return CT52_HB.lane;
}
function ct52Streets(W){
 const N=W.N,S=W.samples,P=S.slice(0,N).map(s=>s.p),tol=CT52_HB.tol;
 let start=0,sharp=0;for(let i=0;i<N;i++){const t=Math.abs(ct48Turn(W,i));if(t>sharp){sharp=t;start=i;}}
 const Q=[];for(let k=0;k<=N;k++)Q.push(P[(start+k)%N]);let far=0,fd=0;for(let k=0;k<N;k++){const d=Math.hypot(Q[k].x-Q[0].x,Q[k].z-Q[0].z);if(d>fd){fd=d;far=k;}}
 const keep=[0,far];ct48GcDP(Q,0,far,tol,keep);ct48GcDP(Q,far,N,tol,keep);keep.push(N);keep.sort((a,b)=>a-b);
 const idx=keep.map(k=>(start+k)%N),M=idx.length-1,segs=[];
 for(let k=0;k<M;k++){const a=Q[keep[k]],b=Q[keep[k+1]],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),vx=dx/l,vz=dz/l,nx=-vz,nz=vx,s={a,b,vx,vz,nx,nz,l,i0:idx[k],i1:idx[k+1]},B=ct52Width(s),off={1:B,'-1':B};
  for(let j=keep[k]-3;j<=keep[k+1]+3;j++){const p=Q[((j%N)+N)%N],u=(p.x-a.x)*vx+(p.z-a.z)*vz;if(u<-2||u>l+2)continue;const lat=clamp((p.x-a.x)*nx+(p.z-a.z)*nz,-tol-3,tol+3);off[1]=Math.max(off[1],lat+B);off['-1']=Math.max(off['-1'],-lat+B);}
  s.off=off;s.B=B;segs.push(s);}
 return segs;
}
function ct52Walls(W){
 if(W.ct48GcWallData)return W.ct48GcWallData;
 const N=W.N,S=W.samples,E=CT52_HB.escape,streets=ct52Streets(W),M=streets.length,out={lane:{},lines:{},streets};
 for(const side of [-1,1]){const pts=[];
  const line=(s)=>({x:s.a.x+s.nx*side*s.off[side],z:s.a.z+s.nz*side*s.off[side],vx:s.vx,vz:s.vz,l:s.l});
  for(let k=0;k<M;k++){const s0=streets[(k-1+M)%M],s1=streets[k],A=line(s0),C=line(s1),den=A.vx*C.vz-A.vz*C.vx,vx=s1.a.x,vz=s1.a.z,B=Math.max(s0.B,s1.B);
   if(Math.abs(den)<.06){const t0=((vx-A.x)*A.vx+(vz-A.z)*A.vz),t1=((vx-C.x)*C.vx+(vz-C.z)*C.vz);pts.push({x:A.x+A.vx*t0,z:A.z+A.vz*t0},{x:C.x+C.vx*t1,z:C.z+C.vz*t1});continue;}
   const t=((C.x-A.x)*C.vz-(C.z-A.z)*C.vx)/den,X={x:A.x+A.vx*t,z:A.z+A.vz*t},reach=Math.hypot(X.x-vx,X.z-vz);
   const turn=s0.vx*s1.vz-s0.vz*s1.vx,inside=Math.sign(turn)===side;
   if(inside&&reach>1.5*Math.max(s0.off[side],s1.off[side]))pts.push({x:vx+s0.nx*side*s0.off[side],z:vz+s0.nz*side*s0.off[side]},{x:vx+s1.nx*side*s1.off[side],z:vz+s1.nz*side*s1.off[side]});
   else if(reach<=E+B)pts.push(X);
   else pts.push({x:vx+s0.nx*side*s0.off[side]+s0.vx*E,z:vz+s0.nz*side*s0.off[side]+s0.vz*E},{x:vx+s1.nx*side*s1.off[side]-s1.vx*E,z:vz+s1.nz*side*s1.off[side]-s1.vz*E});
  }
  const dense=[];for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length],l=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(l/3));for(let j=0;j<n;j++)dense.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n,corner:j===0});}
  // Never closer than 8.2 m to the centreline: the racing surface stays clear at every apex.
  for(const p of dense){const n=W.nearest(p);if(n.distance<8.2){const q=S[n.i%N];p.x=q.p.x+q.n.x*side*8.2;p.z=q.p.z+q.n.z*side*8.2;}}
  for(const p of dense){p.cut=false;if(W.pit?.samples){const q=dc32PitNear(W,p);if(dc32PitPaved(W,q,.5)||W.pitDistance(p.x,p.z)<4.7)p.cut=true;}}
  out.lines[side]=dense;}
 out.pitLines=[];
 if(W.pit?.samples){const pit=W.pit,gs=pit.bays?.[0]?.side||pit.side;
  for(const s of [-1,1]){let run=[];const flush=()=>{if(run.length>1)out.pitLines.push(run);run=[];};
   for(let k=0;k<=480;k++){const f=k/480;if(s===gs&&f>.18&&f<.82){flush();continue;}const q=dc32PitAt(W,f),x=q.p.x+q.n.x*s*4.6,z=q.p.z+q.n.z*s*4.6;
    if(W.nearest({x,z}).distance<8.4){flush();continue;}run.push({x,z,ox:q.n.x*s,oz:q.n.z*s});}
   flush();}}
 W.ct48GcWallData=out;W.ct48GcSeg=null;const segs=ct48GcSegments(W,out);
 for(const side of [-1,1]){const L=new Float32Array(N);
  for(let i=0;i<N;i++){const s=S[i],rx=s.n.x*side,rz=s.n.z*side;let best=Infinity;
   for(const g of segs.segs){if(g.side!==side)continue;const ex=g.bx-g.ax,ez=g.bz-g.az,den=rx*ez-rz*ex;if(Math.abs(den)<1e-6)continue;const qx=g.ax-s.p.x,qz=g.az-s.p.z,t=(qx*ez-qz*ex)/den,u=(qx*rz-qz*rx)/den;if(t>0&&u>=-.01&&u<=1.01&&t<best)best=t;}
   L[i]=Number.isFinite(best)&&best<E+CT52_HB.wide+12?best:CT52_HB.lane;}
  out.lane[side]=L;}
 return out;
}

// Rigid-body contact against the street walls (the same impulse model as the Gold Coast).
const ct52WallsBase=ph47Walls;
ph47Walls=function(W,L,x,s,near,mass,Iz,dt){
 if(!ct52Hb(W))return ct52WallsBase(W,L,x,s,near,mass,Iz,dt);
 s.scrape=Math.max(0,s.scrape-dt*4);if(near.pit)return;
 const G=ct48GcSegments(W),l=DC33_HALF_LENGTH[x.team?.manufacturer]||2.45,w=PH47.width,fx=Math.sin(x.yaw),fz=Math.cos(x.yaw),gx=Math.cos(x.yaw),gz=-Math.sin(x.yaw);
 const ids=new Set();for(const a of [-1,0,1])for(const b of [-1,0,1])for(const k of G.grid.get((Math.floor(x.pos.x/G.cell)+a)+','+(Math.floor(x.pos.z/G.cell)+b))||[])ids.add(k);
 let pen=0,rx=0,rz=0,cl=0,cw=0,ox=0,oz=0;
 for(const k of ids){const g=G.segs[k];const cc=(x.pos.x-g.ax)*g.ox+(x.pos.z-g.az)*g.oz;if(cc>.3)continue;
  for(const a of [l,-l])for(const b of [w,-w]){const px=fx*a+gx*b,pz=fz*a+gz*b,X=x.pos.x+px,Z=x.pos.z+pz,u=((X-g.ax)*(g.bx-g.ax)+(Z-g.az)*(g.bz-g.az))/(g.l*g.l);if(u<-.02||u>1.02)continue;
   const p=(X-g.ax)*g.ox+(Z-g.az)*g.oz;if(p>pen&&p<2.2){pen=p;rx=px;rz=pz;cl=a;cw=b;ox=g.ox;oz=g.oz;}}}
 if(pen<=0)return;
 x.pos.x-=ox*pen;x.pos.z-=oz*pen;const side=Math.sign(near.lane)||1;x.lane-=side*pen*Math.abs(ox*near.n.x+oz*near.n.z);
 let Vx=fx*x.v+gx*x.latV,Vz=fz*x.v+gz*x.latV,r=s.r;const vn=(Vx+r*rz)*ox+(Vz-r*rx)*oz;
 if(vn>0){const e=.26,cross=rz*ox-rx*oz,j=(1+e)*vn/(1/mass+cross*cross/Iz);Vx-=ox*j/mass;Vz-=oz*j/mass;r-=cross*j/Iz;
  const tx=-oz,tz=ox,crossT=rz*tx-rx*tz,vt=(Vx+r*rz)*tx+(Vz-r*rx)*tz,jt=clamp(-vt/(1/mass+crossT*crossT/Iz),-.5*j,.5*j);Vx+=tx*jt/mass;Vz+=tz*jt/mass;r+=crossT*jt/Iz;
  const hit=vn;x.v=Vx*fx+Vz*fz;x.latV=Vx*gx+Vz*gz;s.r=clamp(r,-6,6);
  if(hit>2.5){const amount=clamp((hit-2.5)*1.5,1,60);dcDamage(x,amount,Math.sign(cw)||1,Math.sign(cl)||1);ph47Impact(L,x,x.pos.x+rx,x.pos.y+.35,x.pos.z+rz,hit,ox,oz);
   if(hit>24&&Math.abs(ox*gx+oz*gz)>.75&&!s.tumble)ph47StartTumble(x,s,(ox*gx+oz*gz)*Math.min(9,hit*.2));}
 }else{const vt=Math.abs((Vx+r*rz)*-oz+(Vz-r*rx)*ox);if(vt>6){s.scrape=Math.min(1,vt/30);x.v*=Math.exp(-dt*.35);if(Math.random()<dt*14)ph47Sparks(sc25Engine,x.pos.x+rx,x.pos.y+.3,x.pos.z+rz,Vx*.6,Vz*.6,4);}}
};
const ct52WallLane=ph47WallLane;
ph47WallLane=function(W,L,x,near){if(!ct52Hb(W))return ct52WallLane(W,L,x,near);const d=ct52Walls(W),side=Math.sign(near.lane)||1;return d.lane[side][(x.idx||0)%W.N];};

// ---------- Ground: one flat plane at street level, painted from a land-use map ----------
const ct52TerrainH=SC25World.prototype.terrainHeight;
SC25World.prototype.terrainHeight=function(x,z){if(!ct52Hb(this)||!this.bounds)return ct52TerrainH.call(this,x,z);return 0;};
const ct52TerrainGeo=SC25World.prototype.makeTerrainGeometry;
SC25World.prototype.makeTerrainGeometry=function(){
 if(!ct52Hb(this))return ct52TerrainGeo.call(this);
 const size=this.span+2400,M=16,pos=[],uv=[],ix=[];
 for(let j=0;j<=M;j++)for(let i=0;i<=M;i++){const x=(i/M-.5)*size,z=(j/M-.5)*size;pos.push(x,0,z);uv.push(x/size+.5,z/size+.5);}
 for(let j=0;j<M;j++)for(let i=0;i<M;i++){const a=j*(M+1)+i;ix.push(a,a+M+1,a+1,a+1,a+M+1,a+M+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 g.computeVertexNormals();this.sc26Terrain=null;this.ct52Ground=g;return g;
};

// Land use, painted in layout metres (x east, z south, before the circuit's scale): plazas and
// concourses (pavers), car parks (asphalt with bay lines), garden beds and plain roads; lawn
// is whatever is left. Four layers in one RGBA texture, 2.4 m a texel, filtered smoothly.
const CT52_MAP={size:2400,res:1024};
function ct52Plan(){
 const P=(x,y)=>ct52Q(x,y),R=(x0,y0,x1,y1)=>({rect:[...P(x0,y0),...P(x1,y1)]}),E=(x,y,a,b)=>({ell:[...P(x,y),a,b]}),Ln=(pts,w)=>({line:pts.map(([x,y])=>P(x,y)),w});
 return{
  // Olympic Boulevard's concourse, the stadium and Showground forecourts, the paddock behind the
  // pits, the station plaza, hotel and arena forecourts.
  pav:[Ln([[188,40],[193,62],[215,345],[219,420]],46),E(142,205,175,200),E(300,118,120,135),E(240,140,70,70),R(350,182,378,250),R(268,262,352,300),R(160,292,240,312),R(262,300,312,350)],
  car:[R(300,186,348,248),R(10,150,62,272),R(185,5,372,38),R(402,180,470,262),R(90,300,150,300),R(400,300,470,345),R(20,295,60,345)],
  bed:[R(12,215,60,221),R(186,8,370,11),R(404,262,468,266),R(266,302,350,306)],
  road:[Ln([[379,55],[375,-120]],26),Ln([[391,277],[396,520]],26),Ln([[379,55],[600,50]],18),Ln([[169,60],[95,-10],[40,-80]],16),Ln([[87,139],[30,100],[-120,60]],16),
   Ln([[79,280],[76,520]],14),Ln([[79,280],[-200,282]],16),Ln([[261,282],[600,284]],16),Ln([[205,300],[600,296]],12),Ln([[205,175],[385,175]],10),Ln([[262,175],[262,256]],10),
   Ln([[225,97],[385,97]],9),Ln([[250,60],[250,175]],8),Ln([[357,60],[357,175]],8),Ln([[358,256],[386,256]],8),Ln([[-300,-40],[680,-40]],16),Ln([[640,-200],[640,520]],40),Ln([[-300,420],[680,420]],16)],
 };
}
function ct52LandUse(W){
 if(W.ct52Land)return W.ct52Land;const {size,res}=CT52_MAP,sc=W.scale||1,plan=ct52Plan(),layers=['pav','car','bed','road'],data=new Uint8Array(res*res*4);
 for(let li=0;li<4;li++){const c=document.createElement('canvas');c.width=c.height=res;const g=c.getContext('2d'),k=res/size;g.setTransform(k,0,0,k,res/2,res/2);g.fillStyle=g.strokeStyle='#fff';g.lineCap='round';
  for(const s of plan[layers[li]]){if(s.rect){const [x0,z0,x1,z1]=s.rect;g.fillRect(x0*sc,z0*sc,(x1-x0)*sc,(z1-z0)*sc);}else if(s.ell){const [x,z,a,b]=s.ell;g.beginPath();g.ellipse(x*sc,z*sc,a*sc,b*sc,0,0,7);g.fill();}else{g.lineWidth=s.w;g.beginPath();s.line.forEach(([x,z],i)=>i?g.lineTo(x*sc,z*sc):g.moveTo(x*sc,z*sc));g.stroke();}}
  const px=g.getImageData(0,0,res,res).data;for(let i=0;i<res*res;i++)data[i*4+li]=px[i*4];}
 const t=new THREE.DataTexture(data,res,res,THREE.RGBAFormat);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
 const at=(x,z)=>{const i=Math.floor((x/size+.5)*res),j=Math.floor((z/size+.5)*res);if(i<0||j<0||i>=res||j>=res)return[0,0,0,0];const k=(j*res+i)*4;return[data[k]/255,data[k+1]/255,data[k+2]/255,data[k+3]/255];};
 return W.ct52Land={tex:t,at};
}
function ct52GroundMaterial(W){
 const T=ct48GcGroundTextures(W),land=ct52LandUse(W),dir=W.ct52Dir||{x:0,z:1};
 const m=new THREE.MeshStandardMaterial({map:T.pavers,roughness:.92,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:4});
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{hbLand:{value:land.tex},hbAsph:{value:ct48GcAsphaltTexture(W)},hbGrass:{value:T.grass},hbBeds:{value:T.beds},hbNoise:{value:T.noise},hbDir:{value:new THREE.Vector2(dir.x,dir.z)},hbSize:{value:CT52_MAP.size}});
  sh.vertexShader='varying vec3 vHbW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHbW=(modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader='uniform sampler2D hbLand,hbAsph,hbGrass,hbBeds,hbNoise;uniform vec2 hbDir;uniform float hbSize;varying vec3 vHbW;\n'+sh.fragmentShader.replace('#include <map_fragment>',`
  float hbD=distance(vHbW,cameraPosition),aa=.05+hbD*.002;vec4 use=texture2D(hbLand,vHbW.xz/hbSize+.5);
  float macro=texture2D(hbNoise,vHbW.xz/260.0).r*.6+texture2D(hbNoise,vHbW.xz/61.0).g*.4,mv=.84+macro*.32;
  vec3 pav=texture2D(map,vHbW.xz/4.0).rgb;pav=mix(pav,texture2D(map,vHbW.xz/37.0).rgb,clamp(hbD/300.0,0.0,.6));
  vec3 grass=texture2D(hbGrass,vHbW.xz/3.0).rgb*mix(vec3(1.0),texture2D(hbGrass,vHbW.xz/29.0).rgb*1.6,.5);grass=mix(grass,vec3(.36,.46,.25),clamp(hbD/450.0,0.0,.75));grass*=mix(vec3(1.0),vec3(1.16,1.05,.78),smoothstep(.5,.8,macro));
  vec3 asph=texture2D(hbAsph,vHbW.xz/6.0).rgb*texture2D(hbAsph,vHbW.xz/41.0).rgb*1.9;asph=mix(asph,vec3(.27,.28,.29),clamp(hbD/600.0,0.0,.8));
  vec2 lp=vec2(dot(vHbW.xz,vec2(hbDir.y,-hbDir.x)),dot(vHbW.xz,hbDir));float row=mod(lp.y,17.0);
  float bays=(1.0-smoothstep(.06,.06+aa,abs(mod(lp.x,2.6)-1.3)))*step(abs(row-8.5),5.0)*step(2.5,abs(row-8.5))*(1.0-smoothstep(.0,.6,use.a));
  vec3 car=mix(asph*1.05,vec3(.86,.86,.82),bays*.85*clamp(1.0-hbD/260.0,0.0,1.0));
  vec3 beds=mix(texture2D(hbBeds,vHbW.xz/5.0).rgb,grass,.25);
  vec3 col=grass;col=mix(col,beds,use.b);col=mix(col,pav*vec3(1.04,1.0,.94),use.r);col=mix(col,car,use.g*(1.0-use.r));col=mix(col,asph,use.a);
  vec4 sampledDiffuseColor=vec4(col*mv,1.0);diffuseColor*=sampledDiffuseColor;`);};
 m.customProgramCacheKey=()=> 'ct52Ground1';return m;
}

// ---------- Hooks ----------
const ct52MakeTrack=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){
 ct52MakeTrack.call(this);if(!ct52Hb(this))return;
 // Main direction of the street grid (Australia Avenue), for the car-park bays.
 const s=this.samples[0];this.ct52Dir={x:s.v.x,z:s.v.z};
 const ground=this.ct52Ground;this.world.traverse(o=>{if(o.isMesh&&o.geometry===ground){o.material=ct52GroundMaterial(this);o.name='Olympic Park ground';}});
 for(const o of this.ph47Verges||[]){o.removeFromParent();o.geometry.dispose();}this.ph47Verges=[];this.ph47VergeIndex=null;
 ct52Walls(this);ct48GcRunoff(this);ct48GcRoad(this);
};
const ct52MakePit=SC25World.prototype.makePit;
SC25World.prototype.makePit=function(){
 const out=ct52MakePit.call(this);
 // The street walls are cut at the pit roads, so they are worked out again now the pit exists.
 if(ct52Hb(this)){this.ct48GcWallData=null;this.ct48GcSeg=null;ct52Walls(this);}
 return out;
};
const ct52Building=SC25World.prototype.building;
SC25World.prototype.building=function(...a){if(ct52Hb(this))return false;return ct52Building.apply(this,a);};
const ct52Stand=SC25World.prototype.grandstand;
SC25World.prototype.grandstand=function(...a){if(ct52Hb(this))return false;return ct52Stand.apply(this,a);};
const ct52Scenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 if(!ct52Hb(this))return ct52Scenery.call(this);
 if(this.batches.wall)this.batches.wall.rows=[];
 const out=ct52Scenery.call(this);
 ct48GcWallMeshes(this);ct52BuildHomebush(this);
 return out;
};
const ct52Flush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 if(ct52Hb(this)){
  for(const key of Object.keys(this.batches))if(/^(tree-|palm-|shrub-|fence-post|fence-wire|lightpole|floodlights|spectator-|fans-cap|canopy|vendor)/.test(key))delete this.batches[key];
  for(const [key,b] of Object.entries(this.batches))if(!/kerb|pit|garage/.test(key))b.rows=b.rows.filter(r=>!ct48GcInside(this,r[0],r[2],1.2));
 }
 return ct52Flush.call(this);
};
const ct52Board=dc37AddBoard;
dc37AddBoard=function(W,rows,p,normal,width,height,brand,type){
 if(ct52Hb(W)&&type==='billboard'){const n=W.nearest(p),i=n.i%W.N,s=W.samples[i],side=((p.x-s.p.x)*s.n.x+(p.z-s.p.z)*s.n.z)>=0?1:-1,L=ct52Walls(W).lane[side][i];
  const o=L+3.4,x=s.p.x+s.n.x*side*o,z=s.p.z+s.n.z*side*o;if(!ct48GcWallNear(W,s.p.x+s.n.x*side*L,s.p.z+s.n.z*side*L,1.2))return;
  if(W.ct52Lots&&ct52Hit(W,x,z,4))return;
  p.set(x,p.y,z);normal.copy(s.n).multiplyScalar(-side).addScaledVector(s.v,-.4).normalize();}
 return ct52Board(W,rows,p,normal,width,height,brand,type);
};
// Full-face logos on every wall block and banners on the debris fence, along the street walls.
const ct52Boards=ct48WallBoards;
ct48WallBoards=function(W,brand,add){
 if(!ct52Hb(W))return ct52Boards(W,brand,add);
 const d=ct52Walls(W),y0=W.samples[0].p.y-.2,bh=.74,bw=bh*4,H=1.3;let n=0;
 for(const side of [-1,1]){const P=d.lines[side],m=P.length;let run=0,since=0;
  for(let i=0;i<m;i++){const a=P[i],b=P[(i+1)%m];if(a.corner)since=0;if(a.cut||b.cut){run=0;since=0;continue;}
   const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.05)continue;const ox=side>0?-dz/l:dz/l,oz=side>0?dx/l:-dx/l,normal=new THREE.Vector3(-ox,0,-oz);
   const near=W.nearest({x:a.x,z:a.z}),v=W.samples[near.i%W.N].v;if(Math.abs(dx/l*v.x+dz/l*v.z)<.55&&near.distance>CT48_GC.lane+2){run=0;continue;}
   for(let t=0;t<l;t+=.25){run+=.25;since+=.25;
    if(run>=bw+.12){run=0;const x=a.x+dx/l*(t-bw/2-.06)-ox*.14,z=a.z+dz/l*(t-bw/2-.06)-oz*.14;add(new THREE.Vector3(x,y0+.71,z),normal,bw,bh,brand(n++),'barrier');}
    if(since>=H*4+1&&(n%4===1)&&t+.25<l){since=0;const x=a.x+dx/l*(t-H*2)-ox*.38,z=a.z+dz/l*(t-H*2)-oz*.38;add(new THREE.Vector3(x,y0+1.3+H/2,z),normal,H*4,H,brand(n+5),'fence');}}
  }}
};

// ---------- Career saves ----------
// The calendar grew from 13 to 14 rounds. A driver-career save that had already finished its
// 13-round season (round counter 13, no weekend open) stays finished; every other save simply
// has the Sydney Olympic Park round still to come.
const ct52Bind=dcBindWorld;
dcBindWorld=function(...a){
 if(typeof D!=='undefined'&&D&&!D.cal14){const ir=typeof IR!=='undefined'&&IR.active;if(!ir&&D.round>=13&&!D.weekend&&D.lastWeekend)D.round=EVENTS.length;D.cal14=true;}
 return ct52Bind.apply(this,a);
};

// ---------- Placement ----------
function ct52P(W,x,z){const s=W.scale||1;return{x:x*s,z:z*s};}
// Frame at a layout point; yaw turns the local x axis (the building's "away from the street" side).
function ct52F(W,x,z,yaw=0){const p=ct52P(W,x,z);return{x:p.x,y:0,z:p.z,ax:{x:Math.cos(yaw),z:-Math.sin(yaw)},az:{x:Math.sin(yaw),z:Math.cos(yaw)}};}
function ct52Hit(W,x,z,r=0){return (W.ct52Lots||[]).some(o=>Math.abs((x-o.x)*o.ax.x+(z-o.z)*o.ax.z)<o.w/2+r&&Math.abs((x-o.x)*o.az.x+(z-o.z)*o.az.z)<o.d/2+r);}
function ct52Clear(W,f,w,d,road=14,gap=3){
 const half=(W.span+2400)/2-40,me={x:f.x,z:f.z,ax:f.ax,az:f.az,w:w+gap*2,d:d+gap*2};
 for(let a=0;a<=6;a++)for(let b=0;b<=6;b++){const lx=(a/6-.5)*(w+2),lz=(b/6-.5)*(d+2),x=f.x+f.ax.x*lx+f.az.x*lz,z=f.z+f.ax.z*lx+f.az.z*lz;
  if(Math.abs(x)>half||Math.abs(z)>half)return false;if(W.nearest({x,z}).distance<road||ct48GcInside(W,x,z,4))return false;
  if(W.pit?.samples&&(W.pitDistance(x,z)<18||ct48PitFloor(W,x,z,8)!==null))return false;for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r)return false;}
 for(const o of W.ct52Lots||[])if(Math.hypot(o.x-me.x,o.z-me.z)<(o.w+o.d+me.w+me.d)*.6&&ct48GcRectHit(o,me))return false;
 return true;
}
function ct52Lot(W,f,w,d,name){(W.ct52Lots||=[]).push({x:f.x,z:f.z,ax:f.ax,az:f.az,w,d,name});}
// Place a landmark; if its spot is not clear it is reported in the stats rather than drawn.
function ct52Place(W,name,f,w,d,build,road=14,gap=3){if(!ct52Clear(W,f,w,d,road,gap)){(W.ct52Stats.blocked||=[]).push(name);return false;}ct52Lot(W,f,w,d,name);build(f);(W.ct52Stats.placed||=[]).push(name);return true;}
// Square tube between two local points (roof trusses, arches, stair stringers).
function ct52Tube(K,f,a,b,r,m){
 const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d)||1,u=d.map(v=>v/l),p=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
 let e1=[p[1]*u[2]-p[2]*u[1],p[2]*u[0]-p[0]*u[2],p[0]*u[1]-p[1]*u[0]];const l1=Math.hypot(...e1);e1=e1.map(v=>v/l1);const e2=[u[1]*e1[2]-u[2]*e1[1],u[2]*e1[0]-u[0]*e1[2],u[0]*e1[1]-u[1]*e1[0]];
 const off=k=>{const t=k*Math.PI/2+Math.PI/4;return[0,1,2].map(i=>(e1[i]*Math.cos(t)+e2[i]*Math.sin(t))*r);};
 for(let k=0;k<4;k++){const o0=off(k),o1=off(k+1),out=[0,1,2].map(i=>o0[i]+o1[i]);K.lquad(m,f,[a.map((v,i)=>v+o0[i]),b.map((v,i)=>v+o0[i]),b.map((v,i)=>v+o1[i]),a.map((v,i)=>v+o1[i])],out,[0,0,l,0,l,r*2,0,r*2]);}
}
function ct52Sign(W,f,lx,ly,lz,text,w,bg='#123247',facing=-1){const p=K52at(f,lx,ly,lz),yaw=Math.atan2(f.ax.x*facing,f.ax.z*facing);W.signPlane(W.sign(text,bg,1024,128),w,w/8,new THREE.Vector3(...p),yaw);}
function K52at(f,lx,ly,lz){return[f.x+f.ax.x*lx+f.az.x*lz,f.y+ly,f.z+f.ax.z*lx+f.az.z*lz];}

// ---------- Materials for the precinct ----------
function ct52Materials(W){
 if(W.ct52Mats)return W.ct52Mats;const r=()=>W.rnd(),std=o=>new THREE.MeshStandardMaterial({vertexColors:true,...o});
 const tex=(w,h,draw,mx,my)=>{const t=ct48Tex(W,w,h,draw,mx,my);t.anisotropy=8;return t;};
 // Mown pitch: alternating stripes across the field.
 const pitch=tex(256,256,(c,w,h)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#5d8a3a':'#6b9a44';c.fillRect(0,i*h/8,w,h/8);}for(let i=0;i<9000;i++){c.fillStyle=r()<.5?'rgba(30,60,20,.15)':'rgba(200,220,150,.10)';c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}},40,40);
 // Stadium concrete with formwork joints and weathering.
 const conc=tex(256,256,(c,w,h)=>{c.fillStyle='#d4d2cb';c.fillRect(0,0,w,h);for(let i=0;i<7000;i++){c.fillStyle=r()<.5?'rgba(0,0,0,.05)':'rgba(255,255,255,.05)';c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}c.fillStyle='rgba(70,70,70,.25)';for(let y=0;y<h;y+=64)c.fillRect(0,y,w,2);for(let x=0;x<w;x+=128)c.fillRect(x,0,2,h);for(let i=0;i<20;i++){c.fillStyle='rgba(60,60,55,.06)';c.fillRect(r()*w,0,2+r()*4,h);}},8,8);
 // Louvred cladding (the stadium and arena's upper walls), vertical seams every 1.2 m.
 const louvre=tex(256,256,(c,w,h)=>{c.fillStyle='#c9ced1';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=8){c.fillStyle='#a8afb3';c.fillRect(0,y,w,3);c.fillStyle='#e3e6e7';c.fillRect(0,y+3,w,1);}for(let x=0;x<w;x+=64){c.fillStyle='rgba(60,60,60,.3)';c.fillRect(x,0,2,h);}},4,4);
 // Corrugated metal sheeting, white based for tinting.
 const sheet=tex(64,64,(c,w,h)=>{for(let x=0;x<w;x++){const v=210+Math.round(Math.sin(x/w*Math.PI*10)*26);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(x,0,1,h);}for(let i=0;i<200;i++){c.fillStyle='rgba(0,0,0,.04)';c.fillRect(r()*w,r()*h,1,3);}},1.6,1.6);
 // Industrial roller door with its frame.
 const roller=tex(128,128,(c,w,h)=>{c.fillStyle='#d9dbd9';c.fillRect(0,0,w,h);for(let y=8;y<h;y+=5){c.fillStyle='#b2b5b4';c.fillRect(8,y,w-16,2);}c.fillStyle='#4a4f52';c.fillRect(0,0,w,8);c.fillRect(0,0,8,h);c.fillRect(w-8,0,8,h);},5,5);
 // Warehouse office front: ribbon glazing over a concrete sill.
 const office=tex(256,128,(c,w,h)=>{c.fillStyle='#e8e6df';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,h*.2,0,h*.75);g.addColorStop(0,'#2f3d47');g.addColorStop(1,'#6a8594');c.fillStyle=g;c.fillRect(0,h*.2,w,h*.5);c.fillStyle='#c4c9cb';for(let x=0;x<w;x+=32)c.fillRect(x,h*.2,3,h*.5);},8,4);
 const M={pitch:std({map:pitch,roughness:.95}),conc:std({map:conc,roughness:.9}),louvre:std({map:louvre,roughness:.55,metalness:.35}),sheet:std({map:sheet,roughness:.5,metalness:.25}),roller:std({map:roller,roughness:.5,metalness:.3}),office:ct48Night(W,std({map:office,roughness:.3,metalness:.25})),
  steel:std({color:'#ffffff',roughness:.4,metalness:.65}),white:std({color:'#ffffff',roughness:.6}),under:std({color:'#ffffff',emissive:'#6f7378',roughness:.9}),solar:std({color:'#ffffff',roughness:.15,metalness:.6})};
 return W.ct52Mats=M;
}

// ---------- Landmarks ----------
// ANZ Stadium: an elliptical bowl in two tiers, louvred facade, saddle roofs over the east
// and west stands carried by two great arched trusses, four ramp towers and the pitch.
function ct52Stadium(K,W,f,M,MB){
 const a0=118,b0=142,af=64,bf=86,S=56,pt=(t,k,y)=>[Math.cos(t)*a0*k,y,Math.sin(t)*b0*k],kf=af/a0+.05,kc=.66,ku=.97;K.tint=[1,1,1];
 for(let i=0;i<S;i++){const t0=i/S*Math.PI*2,t1=(i+1)/S*Math.PI*2,mid=(t0+t1)/2,out=[Math.cos(mid),0,Math.sin(mid)],arc=Math.hypot(a0*Math.cos(mid),b0*Math.sin(mid))*Math.PI*2/S;
  // Lower tier, concourse, upper tier (seats face the pitch), rim and facade.
  const tier=(k0,y0,k1,y1,m)=>K.lquad(m,f,[pt(t0,k0,y0),pt(t1,k0,y0),pt(t1,k1,y1),pt(t0,k1,y1)],[-out[0],1,-out[2]],[0,0,arc,0,arc,Math.hypot((k1-k0)*a0,y1-y0),0,Math.hypot((k1-k0)*a0,y1-y0)]);
  K.tint=[.55,.72,.55];tier(kf,1.4,kc,15,MB.seats.green);K.tint=[1,1,1];tier(kc,15,kc+.04,15.2,M.conc);
  K.lquad(M.conc,f,[pt(t0,kf,0),pt(t1,kf,0),pt(t1,kf,1.4),pt(t0,kf,1.4)],[-out[0],0,-out[2]],[0,0,arc,0,arc,1.4,0,1.4]);
  K.tint=[.55,.72,.55];tier(kc+.04,17,ku,43,MB.seats.green);K.tint=[1,1,1];K.lquad(M.conc,f,[pt(t0,kc+.04,15.2),pt(t1,kc+.04,15.2),pt(t1,kc+.04,17),pt(t0,kc+.04,17)],[-out[0],0,-out[2]],[0,0,arc,0,arc,1.8,0,1.8]);
  tier(ku,43,1,44.5,M.conc);
  K.lquad(MB.glass,f,[pt(t0,1,0),pt(t1,1,0),pt(t1,1,9),pt(t0,1,9)],out,[0,0,arc,0,arc,9,0,9]);
  K.lquad(M.conc,f,[pt(t0,1,9),pt(t1,1,9),pt(t1,1,13),pt(t0,1,13)],out,[0,0,arc,0,arc,4,0,4]);
  K.lquad(M.louvre,f,[pt(t0,1,13),pt(t1,1,13),pt(t1,1,44.5),pt(t0,1,44.5)],out,[0,0,arc,0,arc,31.5,0,31.5]);
  // Saddle roofs: higher over the middle of each side stand, falling toward the ends.
  for(const c of [0,Math.PI]){const d0=Math.atan2(Math.sin(t0-c),Math.cos(t0-c)),d1=Math.atan2(Math.sin(t1-c),Math.cos(t1-c));if(Math.abs(d0)>1.02||Math.abs(d1)>1.02)continue;
   const y=d=>49+9*Math.cos(d/1.02*Math.PI/2),q=(t,k,yy)=>pt(t,k,yy);
   K.lquad(MB.roof,f,[q(t0,1.02,y(d0)),q(t1,1.02,y(d1)),q(t1,.70,y(d1)-5),q(t0,.70,y(d0)-5)],[0,1,0],[0,0,arc,0,arc,38,0,38]);
   K.lquad(M.under,f,[q(t0,.70,y(d0)-5.3),q(t1,.70,y(d1)-5.3),q(t1,1.02,y(d1)-.3),q(t0,1.02,y(d0)-.3)],[0,-1,0]);
   K.lquad(M.white,f,[q(t0,.70,y(d0)-5.3),q(t1,.70,y(d1)-5.3),q(t1,.70,y(d1)-4.6),q(t0,.70,y(d0)-4.6)],[-out[0],0,-out[2]]);
   // Back-span from the facade top up to the roof.
   K.lquad(M.louvre,f,[pt(t0,1.02,44.5),pt(t1,1.02,44.5),q(t1,1.02,y(d1)),q(t0,1.02,y(d0))],out,[0,0,arc,0,arc,10,0,10]);}
 }
 // Two arched trusses along the roofs, springing from the ends of each stand.
 for(const c of [0,Math.PI]){const P=[];for(let j=0;j<=16;j++){const d=-1.05+2.1*j/16,t=c+d,h=Math.cos(d/1.05*Math.PI/2);P.push([Math.cos(t)*a0*.86,40+h*34,Math.sin(t)*b0*.86]);}
  K.tint=[.92,.93,.94];for(let j=0;j<16;j++){const a=P[j],b=P[j+1],lo=p=>[p[0],p[1]-5.5,p[2]];ct52Tube(K,f,a,b,.7,M.steel);ct52Tube(K,f,lo(a),lo(b),.5,M.steel);ct52Tube(K,f,lo(a),b,.25,M.steel);ct52Tube(K,f,a,lo(a),.25,M.steel);
   if(j%2===0){const d=-1.05+2.1*j/16;if(Math.abs(d)<1.0){const yr=49+9*Math.cos(d/1.02*Math.PI/2)-2.5;if(lo(a)[1]>yr+.5)ct52Tube(K,f,lo(a),[lo(a)[0],yr,lo(a)[2]],.2,M.steel);}}}
  for(const j of [0,16]){const p=P[j];K.tint=[.85,.85,.83];K.box(f,p[0],p[1]/2,p[2],3,p[1],3,{side:M.conc,top:M.conc});}}
 // Ramp towers at the four corners, light banks on the roof edges.
 K.tint=[1,1,1];for(const t of [.7,Math.PI-.7,Math.PI+.7,-.7]){const p=pt(t,1.12,0);K.cyl(f,p[0],18,p[2],11,36,M.conc,16);for(let y=4;y<36;y+=6)K.cyl(f,p[0],y,p[2],11.3,.8,M.white,16);K.cyl(f,p[0],36.4,p[2],11.6,.8,MB.roof,16);}
 K.tint=[.95,.95,.95];for(const c of [0,Math.PI])for(let d=-.8;d<=.81;d+=.2){const p=pt(c+d,.71,49+9*Math.cos(d/1.02*Math.PI/2)-6.2);K.box(f,p[0],p[1],p[2],3,1.4,6,{side:M.white,top:M.steel});}
 // Pitch.
 const plan=[];for(let k=0;k<40;k++){const t=-k/40*Math.PI*2;plan.push([Math.cos(t)*af,Math.sin(t)*bf]);}K.tint=[1,1,1];K.prism(M.pitch,f,ct48GcCCW(plan),.02,.12,M.pitch,null);
 for(const [lx,ang] of [[a0+.4,Math.PI/2],[-a0-.4,-Math.PI/2]]){const p=K52at(f,lx,24,0);W.signPlane(W.sign('ANZ STADIUM','#0f3b27',1024,128),60,7.5,new THREE.Vector3(...p),ang);}
}
// Sydney Showground stadium: oval, main stand on the west, smaller stands, light towers.
function ct52Showground(K,W,f,M,MB){
 const plan=[];for(let k=0;k<36;k++){const t=-k/36*Math.PI*2;plan.push([Math.cos(t)*62,Math.sin(t)*76]);}K.tint=[1,1,1];K.prism(M.pitch,f,ct48GcCCW(plan),.02,.12,M.pitch,null);
 const stand=(lx,lz,yaw,len,seat)=>{const g={x:f.x+f.ax.x*lx+f.az.x*lz,y:0,z:f.z+f.ax.z*lx+f.az.z*lz,ax:{x:Math.cos(yaw),z:-Math.sin(yaw)},az:{x:Math.sin(yaw),z:Math.cos(yaw)}};K.begin(g);ct48Grandstand(K,W,g,len,MB,MB.seats[seat],null);};
 stand(-68,0,Math.PI,110,'orange');stand(68,0,0,80,'orange');stand(0,-84,Math.PI/2,56,'orange');stand(0,84,-Math.PI/2,56,'orange');
 for(const [x,z] of [[-75,-90],[75,-90],[-75,90],[75,90]]){K.tint=[.9,.9,.9];K.box(f,x,22,z,1.6,44,1.6,M.steel);K.box(f,x,45,z,8,4,1.2,{side:M.white,front:M.steel});}
}
// The Dome: a round exhibition hall with a shallow domed roof.
function ct52Dome(K,W,f,M,MB){
 const R=48;K.tint=[1,1,1];K.cyl(f,0,1.5,0,R,3,M.conc,40);K.tint=[1,1,1];K.cyl(f,0,6.5,0,R,7,MB.glass,40);K.tint=[.95,.95,.94];K.cyl(f,0,10.4,0,R+.4,.8,M.white,40);
 const rings=7;for(let k=0;k<rings;k++){const p0=k/rings*Math.PI/2,p1=(k+1)/rings*Math.PI/2,r0=R*Math.cos(p0),r1=R*Math.cos(p1),y0=10.8+14*Math.sin(p0),y1=10.8+14*Math.sin(p1);
  for(let i=0;i<40;i++){const t0=i/40*Math.PI*2,t1=(i+1)/40*Math.PI*2;K.tint=[.93,.94,.95];K.lquad(M.sheet,f,[[Math.cos(t0)*r0,y0,Math.sin(t0)*r0],[Math.cos(t1)*r0,y0,Math.sin(t1)*r0],[Math.cos(t1)*r1,y1,Math.sin(t1)*r1],[Math.cos(t0)*r1,y1,Math.sin(t0)*r1]],[Math.cos(t0),1,Math.sin(t0)],[0,0,R*.16,0,R*.16,6,0,6]);}}
 ct52Sign(W,f,-R-.6,8,0,'THE DOME',30,'#203a4f');
}
// Exhibition hall (the paddock): steel portal shed with a barrel roof, roller doors to the
// pit side, clerestory glazing.
function ct52Hall(K,W,f,w,d,h,M,MB,label){
 K.tint=[.94,.95,.95];K.box(f,w/2,h/2,0,w,h,d,{side:M.sheet,top:null,front:M.sheet});
 for(let z=-d/2+8;z<d/2-6;z+=14){K.tint=[1,1,1];K.lquad(M.roller,f,[[-.05,0,z-3],[-.05,0,z+3],[-.05,6,z+3],[-.05,6,z-3]],[-1,0,0],[0,0,6,0,6,6,0,6]);}
 K.tint=[1,1,1];K.lquad(MB.glass,f,[[-.06,h-3,-d/2+2],[-.06,h-3,d/2-2],[-.06,h-.8,d/2-2],[-.06,h-.8,-d/2+2]],[-1,0,0],[0,0,d,0,d,2.2,0,2.2]);
 const seg=8,rise=w*.12;for(let k=0;k<seg;k++){const x0=k/seg*w,x1=(k+1)/seg*w,y0=h+Math.sin(k/seg*Math.PI)*rise,y1=h+Math.sin((k+1)/seg*Math.PI)*rise;K.tint=[.86,.88,.88];K.lquad(M.sheet,f,[[x0-.4,y0,-d/2-.4],[x1-.4,y1,-d/2-.4],[x1-.4,y1,d/2+.4],[x0-.4,y0,d/2+.4]],[0,1,0],[0,0,w/seg,0,w/seg,d,0,d]);
  for(const s of [-1,1]){K.tint=[.9,.91,.91];K.tri(M.white,f,[[x0,h,s*d/2],[x1,h,s*d/2],[x1,y1,s*d/2]],[0,0,s]);K.tri(M.white,f,[[x0,h,s*d/2],[x1,y1,s*d/2],[x0,y0,s*d/2]],[0,0,s]);}}
 if(label)ct52Sign(W,f,-.2,h-5,0,label,Math.min(d*.5,34),'#1b3d5c');
}
// Allphones Arena: clad box with a curved roof and a full-height glass foyer to the boulevard.
function ct52Arena(K,W,f,M,MB){
 const w=104,d=124,h=24;K.tint=[.9,.92,.94];K.box(f,w/2+14,h/2,0,w,h,d,{side:M.louvre,top:null,front:M.louvre});
 const seg=10;for(let k=0;k<seg;k++){const x0=14+k/seg*w,x1=14+(k+1)/seg*w,y0=h+Math.sin(k/seg*Math.PI)*9,y1=h+Math.sin((k+1)/seg*Math.PI)*9;K.tint=[.82,.84,.86];K.lquad(M.sheet,f,[[x0,y0,-d/2-.6],[x1,y1,-d/2-.6],[x1,y1,d/2+.6],[x0,y0,d/2+.6]],[0,1,0],[0,0,w/seg,0,w/seg,d,0,d]);
  for(const s of [-1,1]){K.tint=[.82,.85,.88];K.tri(M.white,f,[[x0,h,s*d/2],[x1,h,s*d/2],[x1,y1,s*d/2]],[0,0,s]);K.tri(M.white,f,[[x0,h,s*d/2],[x1,y1,s*d/2],[x0,y0,s*d/2]],[0,0,s]);}}
 K.tint=[1,1,1];K.box(f,7,10,0,14,20,d*.8,{side:MB.glass,top:M.white,front:MB.glass});K.tint=[.95,.95,.95];K.box(f,6,20.4,0,16,.8,d*.84,{side:M.white,top:MB.roof});
 ct52Sign(W,f,-.6,16,0,'ALLPHONES ARENA',50,'#5b1e5e');
}
// Olympic Park station: steel arches over the platforms, roof sheeting between them.
function ct52Station(K,W,f,M,MB){
 const len=190,span=36,rise=13,n=8;for(let x=-len/2;x<=len/2+.1;x+=len/19){const P=[];for(let k=0;k<=n;k++){const t=k/n;P.push([x,3+Math.sin(t*Math.PI)*rise,-span/2+span*t]);}K.tint=[.95,.96,.97];for(let k=0;k<n;k++)ct52Tube(K,f,P[k],P[k+1],.35,M.steel);K.box(f,x,1.5,-span/2,.8,3,.8,M.steel);K.box(f,x,1.5,span/2,.8,3,.8,M.steel);}
 for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,z0=-span/2+span*t0,z1=-span/2+span*t1,y0=3.3+Math.sin(t0*Math.PI)*rise,y1=3.3+Math.sin(t1*Math.PI)*rise;K.tint=k===3||k===4?[.8,.9,.95]:[.9,.91,.92];
  K.lquad(k===3||k===4?MB.glass:M.sheet,f,[[-len/2,y0,z0],[len/2,y0,z0],[len/2,y1,z1],[-len/2,y1,z1]],[0,1,0],[0,0,len,0,len,span/n,0,span/n]);K.lquad(M.under,f,[[-len/2,y1-.2,z1],[len/2,y1-.2,z1],[len/2,y0-.2,z0],[-len/2,y0-.2,z0]],[0,-1,0]);}
 K.tint=[.75,.76,.78];K.box(f,0,.6,0,len,1.2,span-4,{side:M.conc,top:M.conc});
 const p=K52at(f,-len/2-1,9,0);W.signPlane(W.sign('OLYMPIC PARK STATION','#0b5aa6',1024,128),28,3.5,new THREE.Vector3(...p),Math.atan2(-f.ax.x,-f.ax.z));
}
// Olympic Boulevard light towers: tall pylons with tilted solar sails and lamp arms.
function ct52LightTower(K,f,M){
 K.tint=[.88,.89,.9];K.box(f,0,14,0,1.1,28,1.1,M.steel);K.box(f,0,.4,0,2.4,.8,2.4,M.conc);
 K.tint=[1,1,1];K.lquad(M.solar,f,[[-3.5,28,-2.2],[-3.5,28,2.2],[3.5,32,2.2],[3.5,32,-2.2]],[-.5,1,0],[0,0,4.4,0,4.4,7,0,7]);K.lquad(M.under,f,[[3.5,31.9,-2.2],[3.5,31.9,2.2],[-3.5,27.9,2.2],[-3.5,27.9,-2.2]],[.5,-1,0]);
 K.tint=[.88,.89,.9];K.box(f,0,24,0,6,.4,.4,M.steel);K.tint=[1,1,1];for(const x of [-2.6,2.6])K.box(f,x,23.4,0,1,.8,1,{side:M.white,bottom:M.white});
}
// Warehouse: tilt-up concrete or clad walls, roller doors, an office at one end, low gable roof.
function ct52Warehouse(K,W,f,w,d,h,seed,M,MB,far){
 K.tint=[.78,.78,.76];K.box(f,-w/2-12,.03,0,24,.06,d,{side:M.conc,top:M.conc});
 const hh=k=>ct48Hash(seed,k),tints=[[.93,.94,.94],[.78,.82,.86],[.85,.84,.80],[.62,.68,.72],[.9,.88,.82],[.7,.74,.7]];K.tint=ct48GcPick(tints,hh(1));
 const wall=hh(2)<.5?M.sheet:M.conc;K.box(f,0,h/2,0,w,h,d,{side:wall,top:null});
 K.tint=ct48GcPick([[.55,.58,.6],[.86,.87,.86],[.42,.46,.5],[.7,.36,.3]],hh(3));K.gable(f,0,h,0,w,d,w*.08,M.sheet,wall,.4);
 if(far)return;
 K.tint=[1,1,1];const doors=Math.max(1,Math.floor((d-16)/12));for(let i=0;i<doors;i++){const z=-d/2+12+i*12;K.lquad(M.roller,f,[[-w/2-.05,0,z-2.5],[-w/2-.05,0,z+2.5],[-w/2-.05,5.5,z+2.5],[-w/2-.05,5.5,z-2.5]],[-1,0,0],[0,0,5,0,5,5.5,0,5.5]);}
 K.tint=[1,1,1];K.box(f,-w/2+6,3.6,d/2-5,12,7.2,10,{side:M.office,top:M.conc});K.tint=ct48GcPick([[.2,.35,.6],[.75,.2,.2],[.15,.5,.4],[.9,.6,.15]],hh(4));K.box(f,-w/2-.1,h-1.2,0,.2,1.4,Math.min(d*.5,24),M.white);
}
// Temporary footbridge over the circuit: deck, glass rails, scaffold stair towers each side.
function ct52Bridge(K,W,MB,M,i,brand){
 const s=W.samples[i],d=ct52Walls(W),Lp=d.lane[1][i],Lm=d.lane[-1][i],f={x:s.p.x,y:0,z:s.p.z,ax:{x:s.n.x,z:s.n.z},az:{x:s.v.x,z:s.v.z}},x0=-Lm-3,x1=Lp+3,len=x1-x0,cx=(x0+x1)/2;
 for(const x of [x0-2.5,x1+2.5]){const p=K52at(f,x,0,0);if(W.pit?.samples&&W.pitDistance(p[0],p[2])<10)return false;}
 K.begin(f);K.tint=[1,1,1];K.box(f,cx,6.6,0,len,.6,3.4,{side:M.white,top:MB.concrete,bottom:M.under});
 for(const z of [-1.7,1.7]){K.lquad(MB.rail,f,[[x0,6.9,z],[x1,6.9,z],[x1,8.1,z],[x0,8.1,z]],[0,0,Math.sign(z)]);K.tint=[.9,.9,.9];K.box(f,cx,8.15,z,len,.1,.1,M.steel);K.tint=[1,1,1];}
 for(const [x,dir] of [[x0-2.5,-1],[x1+2.5,1]]){K.tint=[.75,.77,.78];for(const a of [-1.8,1.8])for(const b of [-3,3])K.box(f,x+a,4,b,.15,8,.15,M.steel);
  for(let y=1.6;y<7;y+=1.8)K.box(f,x,y,0,4,.12,6.4,{side:M.steel,top:MB.concrete});ct52Tube(K,f,[x-1.6,0,-2.6],[x-1.6,6.6,2.6],.25,M.steel);ct52Tube(K,f,[x+1.6,0,-2.6],[x+1.6,6.6,2.6],.25,M.steel);}
 for(const z of [-1.75,1.75]){const p=K52at(f,cx,5.6,z);W.signPlane(W.sign(brand,'#f4f4f4',1024,128),Math.min(len*.7,18),1.4,new THREE.Vector3(...p),Math.atan2(f.az.x*Math.sign(z),f.az.z*Math.sign(z)));}
 for(const x of [x0-2.5,x1+2.5])ct52Lot(W,{...f,x:K52at(f,x,0,0)[0],z:K52at(f,x,0,0)[2]},6,8,'bridge stairs');
 return true;
}

// ---------- The precinct ----------
function ct52Gums(W,list){
 if(!list.length)return;const T=THREE,tex=ct48TreeAtlas(W).tree,m0=new T.MeshStandardMaterial({map:tex,color:'#a3ab95',alphaTest:.45,side:T.DoubleSide,roughness:.95}),mat=typeof ct49Foliage==='function'?ct49Foliage(m0):m0,d=new T.Object3D(),c=new T.Color(),rows=[[],[],[],[]];
 list.forEach(t=>rows[Math.floor(ct48Hash(t[0],t[1],5)*4)].push(t));
 rows.forEach((items,v)=>{if(!items.length)return;const m=new T.InstancedMesh(ct48Billboard(v/4+.002,(v+1)/4-.002),mat,items.length);m.name='Olympic Park gums '+v;
  items.forEach(([x,z,h],i)=>{const r=ct48Hash(z,x,6),w=h*(.62+r*.2);d.position.set(x,-.1,z);d.rotation.set(0,r*Math.PI,0);d.scale.set(w,h,w);d.updateMatrix();m.setMatrixAt(i,d.matrix);const s=.82+ct48Hash(x,z,8)*.28;m.setColorAt(i,c.setRGB(s,s,s*.96));});
  m.computeBoundingSphere();m.castShadow=false;m.receiveShadow=false;W.world.add(m);});
}
function ct52Trucks(K,W,MB){
 const pit=W.pit;if(!pit?.samples||!pit.bays?.length)return;const gs=pit.bays[0].side,teams=(typeof S!=='undefined'&&S?.teams)||[],col=new THREE.Color();let n=0;
 for(let k=0;k<14;k++){const fa=.2+k*.046,q=dc32PitAt(W,fa),f={x:q.p.x+q.n.x*gs*31,y:0,z:q.p.z+q.n.z*gs*31,ax:{x:q.n.x*gs,z:q.n.z*gs},az:{x:q.v.x,z:q.v.z}};
  if(ct52Hit(W,f.x,f.z,3))continue;K.begin(f);const t=teams[k%Math.max(1,teams.length)];col.set(t?.livery?.primary||'#20262c');K.tint=[col.r,col.g,col.b];
  K.box(f,0,2.4,-1.5,2.55,3.6,14.2,{side:MB.white,top:MB.white});K.tint=[.15,.16,.18];K.box(f,0,.55,-1.5,2.4,.9,13.6,MB.darkSteel);
  K.tint=[col.r*.8+.1,col.g*.8+.1,col.b*.8+.1];K.box(f,0,1.9,7.4,2.5,2.9,2.6,{side:MB.white,top:MB.white});K.tint=[1,1,1];K.lquad(MB.glass,f,[[-1.1,2.2,8.71],[1.1,2.2,8.71],[1.1,3.2,8.71],[-1.1,3.2,8.71]],[0,0,1]);
  K.tint=[.1,.1,.1];for(const z of [-6,-4.6,6.8])for(const s of [-1,1])K.box(f,s*1.15,.5,z,.4,1,1,MB.black);ct52Lot(W,f,4,19,'transporter');n++;}
 W.ct52Stats.trucks=n;
}
function ct52BuildHomebush(W){
 const K=new CT48GcKit(W),M=ct48GcMaterials(W),MB=ct48Materials(W),H=ct52Materials(W),walls=ct52Walls(W),land=ct52LandUse(W),people=[],figs=[],gums=[],cars=[],sc=W.scale||1;
 W.ct52Stats={};W.ct48GcStats={...(W.ct48GcStats||{})};W.ct52Lots=[];W.ct48GcLots=[];W.ct48GcSigns=[];W.ct48GcStalls=[];
 const okTree=(x,z,r)=>!ct48GcInside(W,x,z,r+1.5)&&W.nearest({x,z}).distance>CT52_HB.lane+r+3&&!(W.pit?.samples&&(W.pitDistance(x,z)<14||ct48PitFloor(W,x,z,6)!==null))&&!ct52Hit(W,x,z,r)&&!(W.ct48Reserved||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r+r);
 // Pit building with suites over the garages, timing stands, race control.
 W.ct48PitOpts={name:'SYDNEY OLYMPIC PARK',floors:2};const mid=W.pit?.samples?.[120]?.p;K.tint=[1,1,1];K.begin({x:mid?.x||0,z:mid?.z||0});
 ct48PitComplex(K,W,MB);ct48GcPitWall(K,W,MB);
 // The paddock: the Showground's exhibition halls behind the pits, transporters in between.
 if(W.pit?.samples&&W.pit.bays?.length){const gs=W.pit.bays[0].side;let h=1;
  for(const fa of [.12,.3,.48,.66,.84]){const q=dc32PitAt(W,fa),w=56,d=Math.min(108,W.pit.length*.18-10),c={x:q.p.x+q.n.x*gs*(40+w/2),y:0,z:q.p.z+q.n.z*gs*(40+w/2),ax:{x:q.n.x*gs,z:q.n.z*gs},az:{x:q.v.x,z:q.v.z}};
   ct52Place(W,'hall '+h,c,w,d,f=>{K.begin(f);ct52Hall(K,W,{...f,x:f.x-f.ax.x*w/2,z:f.z-f.ax.z*w/2},w,d,13,H,MB,'HALL '+h);},12,2);h++;}
  ct52Trucks(K,W,MB);}
 // Venues, in map pixels (ct52Q): the stadium between Edwin Flack Avenue and Olympic Boulevard,
 // the Showground, Dome and halls inside the circuit, the station beside Murray Rose Avenue,
 // the arena, hotels, Aquatic and Athletic Centres south of Dawn Fraser Avenue.
 const F=(x,y,yaw=0)=>ct52F(W,...ct52Q(x,y),yaw);
 ct52Place(W,'ANZ Stadium',F(142,205),268,320,f=>{K.begin(f);ct52Stadium(K,W,f,H,MB);},20,2);
 ct52Place(W,'Showground stadium',F(300,118),180,210,f=>{K.begin(f);ct52Showground(K,W,f,H,MB);},16,2);
 ct52Place(W,'The Dome',F(238,140),100,100,f=>{K.begin(f);ct52Dome(K,W,f,H,MB);},16,2);
 ct52Place(W,'Arena',F(285,326),120,130,f=>{K.begin(f);ct52Arena(K,W,{...f,x:f.x-f.ax.x*59,z:f.z-f.ax.z*59},H,MB);},16,2);
 ct52Place(W,'Station',F(310,272),196,42,f=>{K.begin(f);ct52Station(K,W,f,H,MB);},16,2);
 // Aquatic Centre: long glazed hall with exterior masts. Athletic Centre: field and main stand.
 ct52Place(W,'Aquatic Centre',F(348,338,-Math.PI/2),100,150,f=>{K.begin(f);K.tint=[1,1,1];K.box(f,0,9,0,100,18,150,{side:H.conc,front:MB.glass,top:null});K.tint=[.9,.92,.93];K.box(f,0,18.4,0,104,.8,154,{side:H.white,top:MB.roof});
  for(let z=-60;z<=60;z+=30){K.tint=[.95,.95,.95];K.box(f,-56,16,z,1.2,32,1.2,H.steel);ct52Tube(K,f,[-56,31,z],[-30,18.8,z],.2,H.steel);ct52Tube(K,f,[-56,31,z],[-52,0,z],.15,H.steel);}
  ct52Sign(W,f,-50.6,13,0,'SYDNEY OLYMPIC PARK AQUATIC CENTRE',60,'#0d4f8b');},16,2);
 ct52Place(W,'Athletic Centre',F(118,338),150,170,f=>{K.begin(f);const plan=[];for(let k=0;k<32;k++){const t=-k/32*Math.PI*2;plan.push([Math.cos(t)*52,Math.sin(t)*72]);}K.tint=[.85,.45,.38];K.prism(H.conc,f,ct48GcCCW(plan),.02,.1,H.conc,null);
  const inner=plan.map(([x,z])=>[x*.72,z*.82]);K.tint=[1,1,1];K.prism(H.pitch,f,ct48GcCCW(inner),.1,.14,H.pitch,null);const g={...f,x:f.x+f.ax.x*58,z:f.z+f.ax.z*58};K.begin(g);ct48Grandstand(K,W,g,90,MB,MB.seats.blue,null);},16,2);
 // Olympic Boulevard: the light towers down the concourse and the merchandise alley.
 let towers=0;for(let k=0;k<17;k++){const y=74+k*12.4,f=F(193+(y-62)*22/283+9,y);if(!ct52Clear(W,f,3,3,12,1))continue;K.begin(f);ct52LightTower(K,f,H);ct52Lot(W,f,3,3,'tower');towers++;}W.ct52Stats.towers=towers;
 {const yaw=-Math.atan2(22,283);for(const [y,len] of [[120,200],[230,140]]){const f=F(193+(y-62)*22/283-4,y,yaw+Math.PI);if(ct52Clear(W,{...f,x:f.x-8*sc,z:f.z},18,len,12,0)){K.begin(f);ct48GcMarket(K,W,f,len,2,M,people);ct52Lot(W,{...f,x:f.x+f.ax.x*7,z:f.z+f.ax.z*7},16,len+4,'market');}}}
 // Hotels by Olympic Boulevard, a few apartment towers, offices around the park.
 const hotel=(name,x,y,w,d,Hh,seed,glass)=>ct52Place(W,name,F(x,y,-Math.PI/2),w,d,f=>{K.begin(f);if(glass)ct48GcGlassTower(K,W,f,w,d,Hh,seed,M);else ct48GcRenderBlock(K,W,f,w,d,Hh,seed,M,people,false);W.ct52Signs.push({f,x:-w/2-.3,y:Hh+2.4,w:Math.min(d*.7,20),text:name});},12,2);
 W.ct52Signs=[];hotel('NOVOTEL',236,301,24,44,46.5,7,false);hotel('IBIS',236,326,20,32,34.5,8,false);hotel('PULLMAN',176,304,28,44,30,9,true);
 const tower=(x,y,yaw,w,d,Hh,seed,kind)=>ct52Place(W,'tower '+seed,F(x,y,yaw),w,d,f=>{K.begin(f);if(kind==='glass')ct48GcGlassTower(K,W,f,w,d,Hh,seed,M);else ct48GcBalconyTower(K,W,f,w,d,Hh,seed,M,people,true);},12,3);
 tower(426,212,0,30,40,74,21,'balcony');tower(448,262,0,28,36,62,22,'balcony');tower(426,318,0,30,42,86,23,'balcony');tower(472,318,0,28,40,68,24,'balcony');tower(120,22,-Math.PI/2,26,36,56,25,'balcony');
 tower(250,22,Math.PI/2,34,48,18,41,'glass');tower(300,22,Math.PI/2,30,44,22,42,'glass');tower(345,22,Math.PI/2,30,40,16,43,'glass');
 tower(430,30,0,40,56,38,31,'glass');tower(482,90,0,36,50,44,32,'glass');tower(485,175,0,34,44,30,33,'glass');
 W.ct48GcSigns=[];
 // Grandstands behind the walls.
 const stand=(ph,side,len,seat,brand)=>{const i=Math.floor(W.at(ph).t*W.N)%W.N,L=walls.lane[side][i];for(let t=0;t<6;t++){const f=ct48Frame(W,ph,side,L+3.5+t*5);const c={...f,x:f.x+f.ax.x*9.5,z:f.z+f.ax.z*9.5};if(!ct48Clear(W,f,19,len+4,L+2,6)||!ct52Clear(W,c,21,len+6,L+2,1))continue;K.begin(f);ct48Grandstand(K,W,f,len,MB,MB.seats[seat],brand);ct52Lot(W,c,21,len+6,'stand');W.ct52Stats.stands=(W.ct52Stats.stands||0)+1;return;}};
 stand(.975,1,64,'blue','Dunlop');stand(.05,1,56,'red','Repco');stand(.125,1,44,'orange','Supercheap Auto');stand(.2,1,50,'green','Shell');stand(.27,1,40,'blue','Penrite');stand(.325,1,52,'red','Bosch');stand(.41,1,40,'orange','Castrol');
 stand(.53,1,50,'blue','Mobil 1');stand(.58,1,44,'green','Pirtek');stand(.65,1,44,'red','Dunlop');stand(.72,1,40,'blue','Coca-Cola');stand(.76,1,48,'orange','Repco');stand(.915,1,44,'green','Shell');
 // Footbridges over the track.
 let bridges=0;for(const [ph,b] of [[.1,'Repco'],[.225,'Dunlop'],[.4,'Supercheap Auto'],[.55,'Penrite'],[.68,'Shell'],[.85,'Repco']]){const i=Math.floor(W.at(ph).t*W.N)%W.N;if(ct52Bridge(K,W,MB,H,i,b))bridges++;}W.ct52Stats.bridges=bridges;
 // Warehouses: Homebush Bay and Silverwater industrial land to the west and north.
 let sheds=0;const shed=(x,z,yaw,seed,far)=>{const w=34+ct48Hash(seed,1)*40,d=44+ct48Hash(seed,2)*60,h=8+ct48Hash(seed,3)*5,f=ct52F(W,x,z,yaw);if(!ct52Clear(W,{...f,x:f.x-f.ax.x*12,z:f.z-f.ax.z*12},w+24,d,30,6))return;K.begin(f);ct52Warehouse(K,W,f,w,d,h,seed,H,MB,far);ct52Lot(W,f,w,d,'warehouse');sheds++;
  // Trucks and staff cars in the yard.
  for(let k=0;k<4;k++){const q=K52at(f,-w/2-9,0,-d/2+6+k*7);if(ct48Hash(seed,k+9)<.6)cars.push([q[0],q[2],Math.atan2(f.ax.x,f.ax.z),Math.floor(ct48Hash(seed,k)*1000)]);}};
 let seed=101;for(let x=-780;x>=-1300;x-=125)for(let z=-1080;z<=700;z+=118){shed(x+(ct48Hash(x,z)-.5)*20,z+(ct48Hash(z,x)-.5)*20,0,seed++,x<-1050);}
 for(let x=-640;x<=900;x+=136)for(const z of [-800,-940,-1080,-1220]){shed(x+(ct48Hash(x,z)-.5)*24,z,Math.PI/2,seed++,z<-1150);}
 for(let x=-760;x>=-1250;x-=150)for(const z of [880,1020])shed(x,z,0,seed++,true);W.ct52Stats.warehouses=sheds;
 K.flush('Olympic Park precinct');
 for(const s of W.ct52Signs){const p=K52at(s.f,s.x,s.y,0);W.signPlane(W.sign(s.text,'#123247',1024,128),s.w,s.w/8,new THREE.Vector3(...p),Math.atan2(-s.f.ax.x,-s.f.ax.z));}
 // Car parks: cars in the painted bays (bays follow Australia Avenue, as the ground does).
 {const dir=W.ct52Dir||{x:0,z:1},e1={x:dir.z,z:-dir.x},plan=ct52Plan();
  for(const s of plan.car){let [x0,z0,x1,z1]=s.rect;x0*=sc;x1*=sc;z0*=sc;z1*=sc;if(W.nearest({x:(x0+x1)/2,z:(z0+z1)/2}).distance>650)continue;const cs=[[x0,z0],[x1,z0],[x0,z1],[x1,z1]],us=cs.map(([x,z])=>x*e1.x+z*e1.z),vs=cs.map(([x,z])=>x*dir.x+z*dir.z);
   for(let v=Math.floor(Math.min(...vs)/17)*17;v<Math.max(...vs);v+=17)for(const rv of [3,14])for(let u=Math.ceil(Math.min(...us)/2.6)*2.6;u<Math.max(...us);u+=2.6){const x=e1.x*u+dir.x*(v+rv),z=e1.z*u+dir.z*(v+rv);
    if(x<x0||x>x1||z<z0||z>z1)continue;const k=Math.floor(ct48Hash(u,v+rv)*1000);if(k%100<50||cars.length>8000)continue;const L=land.at(x,z);if(L[1]<.6||L[0]>.3)continue;if(!okTree(x,z,2.6))continue;cars.push([x,z,Math.atan2(dir.x,dir.z)+(k%2?Math.PI:0),k]);}}}
 W.ct52Stats.cars=cars.length;
 // Spectators along the fences where there is room, facing the track.
 for(let i=0;i<W.N;i+=2)for(const side of [-1,1]){const s=W.samples[i],L=walls.lane[side][i],ph=i/W.N;const busy=(ph>.92||ph<.16||ph>.29&&ph<.36||ph>.58&&ph<.62||ph>.76&&ph<.8)?.7:.25;
  for(let row=0;row<3;row++){if(ct48Hash(i,side*7+row)>busy)continue;const l=L+2.2+row*.9+ct48Hash(i,row)*.4,x=s.p.x+s.n.x*side*l+s.v.x*(ct48Hash(row,i)-.5)*1.5,z=s.p.z+s.n.z*side*l+s.v.z*(ct48Hash(row,i)-.5)*1.5;
   if(ct48GcInside(W,x,z,.6)||ct52Hit(W,x,z,.4)||(W.ct48Reserved||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r)||W.pit?.samples&&(W.pitDistance(x,z)<12||ct48PitFloor(W,x,z,4)!==null))continue;people.push([x,0,z,Math.atan2(-s.n.x*side,-s.n.z*side)+(ct48Hash(i,row,3)-.5)*.6,ct48Hash(i,side,row)]);}}
 // Trees: avenues along the streets, a line outside the walls, parkland and bush beyond.
 const roadTrees=plan=>{for(const s of plan.road){if(s.w>30)continue;for(let k=0;k<s.line.length-1;k++){const [ax,az]=s.line[k],[bx,bz]=s.line[k+1],l=Math.hypot(bx-ax,bz-az),vx=(bx-ax)/l,vz=(bz-az)/l;for(let t=6;t<l;t+=11)for(const sd of [-1,1]){const o=s.w/2+3.5,x=(ax+vx*t-vz*sd*o)*sc,z=(az+vz*t+vx*sd*o)*sc;if(ct48Hash(x,z,2)<.18)continue;if(okTree(x,z,3))(ct48Hash(x,z,3)<.45?figs.push([x,z,9+ct48Hash(z,x)*5]):gums.push([x,z,13+ct48Hash(z,x)*8]));}}}};
 roadTrees(ct52Plan());
 for(let i=0;i<W.N;i+=6)for(const side of [-1,1]){const s=W.samples[i],L=walls.lane[side][i]+11+ct48Hash(i,side)*5,x=s.p.x+s.n.x*side*L,z=s.p.z+s.n.z*side*L;if(ct48Hash(i,side,4)<.45||!okTree(x,z,3.5))continue;const u=land.at(x,z);if(u[0]>.5||u[1]>.5)continue;(ct48Hash(x,z,1)<.5?figs:gums).push([x,z,10+ct48Hash(x,z)*7]);}
 const size=W.span+2400;for(let n=0;n<30000;n++){const x=(W.rnd()-.5)*size*.97,z=(W.rnd()-.5)*size*.97,u=land.at(x,z);if(u[0]+u[1]+u[3]>.25)continue;const d=W.nearest({x,z}).distance,dens=u[2]>.5?.9:clamp(.16+d/1400,.16,.85)*(x>950*sc?1.4:1);if(W.rnd()>dens||!okTree(x,z,4))continue;
  if(d<500&&W.rnd()<.35)figs.push([x,z,9+W.rnd()*6]);else gums.push([x,z,d<400?12+W.rnd()*10:15+W.rnd()*13]);}
 ct48GcTrees(W,figs);ct52Gums(W,gums);ct48GcCars(W,cars);ct48GcPeopleMeshes(W,people,'Olympic Park crowd');ct48GcStallMeshes(W);
 Object.assign(W.ct52Stats,{figs:figs.length,gums:gums.length,people:people.length,lots:W.ct52Lots.length});
}
