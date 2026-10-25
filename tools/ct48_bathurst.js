
/* CT48 Bathurst: Mount Panorama as the template circuit.
   Terrain: a real mountain (the circuit climbs its flank; the summit sits inside the loop,
   the far side of Skyline falls away, rolling hills on the horizon) on a 4x finer grid.
   Mountain section: concrete walls with debris fencing close to the road, like the real
   track, and the physics barrier line moved in to match.
   Buildings: pit complex with corporate suites, race control, roofed grandstands, Brock's
   Skyline, campers at McPhillamy and Reid Park, houses, the motor museum and the town. */
const CT48_B={wallFrom:.197,wallTo:.668,wallLane:10.6,summit:{x:-390,z:430,h:188,r:300}};

function ct48Hash(x,z,s=0){const n=Math.sin(x*127.1+z*311.7+s*74.7)*43758.5453;return n-Math.floor(n);}
function ct48Noise(x,z,s=0){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),a=ct48Hash(ix,iz,s),b=ct48Hash(ix+1,iz,s),c=ct48Hash(ix,iz+1,s),d=ct48Hash(ix+1,iz+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function ct48Fbm(x,z,s=0){let t=0,a=.5,f=1;for(let o=0;o<4;o++){t+=a*(ct48Noise(x*f,z*f,s+o)*2-1);a*=.5;f*=2.03;}return t;}
function ct48Inside(W,x,z){if(!W.ct48Poly)W.ct48Poly=W.samples.filter((_,i)=>i%4===0).map(s=>[s.p.x,s.p.z]);const P=W.ct48Poly;let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,zi]=P[i],[xj,zj]=P[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;}

// The mountain, before the road cut: an inverse-distance blend of the road heights, a summit
// inside the loop, slopes falling away outside, noise and distant ridges.
function ct48BathurstHeight(W,x,z){
 const n=W.nearest({x,z}),d=n.distance,S=W.samples;let sw=0,sh=0;
 for(let i=0;i<W.N;i+=5){const p=S[i].p,dd=(p.x-x)**2+(p.z-z)**2,w=1/Math.pow(dd+2500,1.5);sw+=w;sh+=w*p.y;}
 let h=sh/sw;const inside=ct48Inside(W,x,z),S0=CT48_B.summit;
 if(inside){const r=Math.hypot(x-S0.x,z-S0.z)/S0.r;h=Math.max(h,h+(S0.h-h)*Math.exp(-r*r*1.6));}
 else h-=Math.min(h*.7,Math.max(0,d-70)*.11);
 h+=ct48Fbm(x/140,z/140,3)*(2+12*ct48Smooth((d-40)/420));
 h+=ct48Smooth((d-1100)/900)*(70+60*ct48Fbm(x/600,z/600,9));
 return n.y-.42+(h-(n.y-.42))*ct48Smooth((d-13)/62);
}
function ct48BathurstTerrain(W){
 const N=256,size=W.span+2400,p=[],uv=[],colors=[],ix=[];
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=(i/N-.5)*size,z=(j/N-.5)*size,y=ct48BathurstHeight(W,x,z);p.push(x,y,z);uv.push(i/N,j/N);}
 // Road clearance as before: grid corners around the road go under it.
 for(const s of W.samples)for(const lane of [-7.7,0,7.7]){const x=s.p.x+s.n.x*lane,z=s.p.z+s.n.z*lane,gx=clamp(Math.floor((x/size+.5)*N),0,N-1),gz=clamp(Math.floor((z/size+.5)*N),0,N-1);for(const k of [gz*(N+1)+gx,gz*(N+1)+gx+1,(gz+1)*(N+1)+gx,(gz+1)*(N+1)+gx+1])p[k*3+1]=Math.min(p[k*3+1],s.p.y-.55);}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;ix.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
 // Colour: summer-dry grass on exposed slopes, greener gullies, bare patches near the top.
 const nor=g.attributes.normal;
 for(let k=0;k<=N*(N+1)+N;k++){const x=p[k*3],y=p[k*3+1],z=p[k*3+2],steep=1-nor.getY(k),dry=clamp(.35+ct48Fbm(x/90,z/90,5)*.7+steep*1.6+(y-60)/400,0,1),bare=clamp((steep-.16)*4+ct48Fbm(x/35,z/35,7)*.4,0,1)*.6;
  const r=.82+dry*.24,gg=.98-dry*.04,b=.80-dry*.14;colors.push(r+(1.02-r)*bare,gg+(.88-gg)*bare,b+(.72-b)*bare);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 W.sc26Terrain={positions:p,N,size,colors};return g;
}
function ct48TerrainColour(W,x,z){
 const d=W.sc26Terrain;if(!d?.colors)return null;const {N,size,colors:c}=d,gx=(x/size+.5)*N,gz=(z/size+.5)*N;if(gx<0||gz<0||gx>=N||gz>=N)return null;
 const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,k=j*(N+1)+i,out=[0,0,0];
 for(let ch=0;ch<3;ch++){const h=o=>c[(k+o)*3+ch];out[ch]=u+v<=1?h(0)*(1-u-v)+h(1)*u+h(N+1)*v:h(N+2)*(u+v-1)+h(N+1)*(1-u)+h(1)*(1-v);}return out;
}
// Height lookups made before the mesh exists use the analytic mountain.
const ct48TerrainHeight=SC25World.prototype.terrainHeight;
SC25World.prototype.terrainHeight=function(x,z){
 if(this.e.key!=='bathurst'||!this.samples)return ct48TerrainHeight.call(this,x,z);
 return this.sc26Terrain?.colors?gr26SceneryGround(this,x,z):ct48BathurstHeight(this,x,z);
};

// Shoulders blend into the terrain colour as well as its height.
const ct48ShouldersBase=ct48Shoulders;
ct48Shoulders=function(W){
 const mesh=ct48ShouldersBase(W);if(!mesh||!W.sc26Terrain?.colors)return mesh;
 const P=mesh.geometry.attributes.position,C=mesh.geometry.attributes.color,M=CT48_LANES.length;
 for(let v=0;v<P.count;v++){const k=v%M;if(k<3)continue;const t=ct48TerrainColour(W,P.getX(v),P.getZ(v));if(!t)continue;const w=ct48Smooth((k-2)/(M-3));C.setXYZ(v,C.getX(v)+(t[0]-C.getX(v))*w,C.getY(v)+(t[1]-C.getY(v))*w,C.getZ(v)+(t[2]-C.getZ(v))*w);}
 C.needsUpdate=true;return mesh;
};

// ---------- Mountain walls ----------
function ct48WallAt(W,i,side){
 if(W.e.key!=='bathurst')return 16;const t=W.times[((i%W.N)+W.N)%W.N],{wallFrom:a,wallTo:b,wallLane:l}=CT48_B,ramp=.006;
 const k=ct48Smooth((t-a)/ramp)*ct48Smooth((b-t)/ramp);return 16+(l-16)*k;
}
const ct48WallLaneBase=ph47WallLane;
ph47WallLane=function(W,L,x,near){if(W.e.key!=='bathurst')return ct48WallLaneBase(W,L,x,near);return ct48WallAt(W,x.idx||0,Math.sign(near.lane)||1);};
const ct48Zones=ct48GravelZones;
ct48GravelZones=function(W){const z=ct48Zones(W);if(W.e.key==='bathurst')for(const side of ['-1','1'])for(let i=0;i<W.N;i++)if(ct48WallAt(W,i,+side)<14)z[side][i]=0;return z;};

function ct48WallMaterials(W){
 if(W.ct48WallMats)return W.ct48WallMats;
 const conc=W.texture(256,128,(c,w,h)=>{c.fillStyle='#d9d8d1';c.fillRect(0,0,w,h);for(let i=0;i<5000;i++){c.fillStyle=W.rnd()<.5?'rgba(90,90,85,.08)':'rgba(255,255,255,.10)';c.fillRect(W.rnd()*w,W.rnd()*h,1+W.rnd()*3,1+W.rnd()*3);}
  // Panel joints every 4 m, tyre marks low on the face, grime at the foot.
  c.fillStyle='rgba(70,70,66,.55)';c.fillRect(0,0,2,h);for(let i=0;i<9;i++){c.fillStyle=`rgba(25,25,25,${.08+W.rnd()*.2})`;c.fillRect(W.rnd()*w,h*.62+W.rnd()*h*.18,30+W.rnd()*90,2+W.rnd()*5);}
  const g=c.createLinearGradient(0,h*.75,0,h);g.addColorStop(0,'rgba(80,70,55,0)');g.addColorStop(1,'rgba(80,70,55,.45)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 conc.wrapS=conc.wrapT=THREE.RepeatWrapping;conc.anisotropy=4;
 const mesh=W.texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#c4ccd0';c.lineWidth=2.2;c.beginPath();for(let x=-128;x<=256;x+=26){c.moveTo(x,0);c.lineTo(x+128,128);c.moveTo(x,0);c.lineTo(x-128,128);}c.stroke();});
 mesh.wrapS=mesh.wrapT=THREE.RepeatWrapping;mesh.anisotropy=2;
 return W.ct48WallMats={concrete:new THREE.MeshStandardMaterial({map:conc,roughness:.9,side:THREE.DoubleSide}),fence:new THREE.MeshStandardMaterial({map:mesh,alphaTest:.3,side:THREE.DoubleSide,roughness:.6,metalness:.4,color:'#c9d1d5'}),post:W.mat('#8c989f',.5,.55)};
}
// F-shape concrete barrier facing the road, 1 m high, debris fence 3 m above it.
function ct48MountainWalls(W){
 const M=ct48WallMaterials(W),N=W.N,S=W.samples,profile=[[0,0],[.06,.08],[.2,.34],[.27,.98],[.52,.98],[.62,-.25]],wall={p:[],uv:[],ix:[]},fence={p:[],uv:[],ix:[]},posts=[];
 for(const side of [-1,1]){
  let i=0;while(i<N){if(ct48WallAt(W,i,side)>15.5){i++;continue;}let j=i;while(j<N&&ct48WallAt(W,j,side)<=15.5)j++;
   const bw=wall.p.length/3,bf=fence.p.length/3;let dist=0;
   for(let k=i;k<=j;k++){const s=S[k%N],L=ct48WallAt(W,k,side);if(k>i)dist+=s.p.distanceTo(S[(k-1)%N].p);
    const ground=(gr27Surface(W,s.p.x+s.n.x*side*L,s.p.z+s.n.z*side*L,s.p.y,false)?.y??s.p.y)-.06;
    profile.forEach(([o,h],m)=>{const l=L+o;wall.p.push(s.p.x+s.n.x*side*l,ground+h,s.p.z+s.n.z*side*l);wall.uv.push(dist/8,m===0?0:clamp(h/1,0,1)*.5+(m>3?.5:0));});
    const fl=L+.4;for(const h of [.98,3.95]){fence.p.push(s.p.x+s.n.x*side*fl,ground+h,s.p.z+s.n.z*side*fl);fence.uv.push(dist/.5,h/.5);}
    if(k%2===0)posts.push([s.p.x+s.n.x*side*(L+.42),ground+2.45,s.p.z+s.n.z*side*(L+.42)]);}
   const P=profile.length;for(let r=0;r<j-i;r++){for(let m=0;m<P-1;m++){const a=bw+r*P+m,b=a+P;if(side>0)wall.ix.push(a,a+1,b,a+1,b+1,b);else wall.ix.push(a,b,a+1,a+1,b,b+1);}const a=bf+r*2,b=a+2;fence.ix.push(a,b,a+1,a+1,b,b+1);}
   i=j;}
 }
 const make=(d,m,name)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(d.uv,2));g.setIndex(d.ix);g.computeVertexNormals();const o=W.mesh(g,m);o.name=name;o.receiveShadow=true;return o;};
 if(wall.ix.length){const w=make(wall,M.concrete,'Mountain concrete walls');w.castShadow=true;make(fence,M.fence,'Mountain debris fence');}
 const post=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,2.97,.09),M.post,posts.length),d=new THREE.Object3D();
 posts.forEach((q,k)=>{d.position.set(...q);d.updateMatrix();post.setMatrixAt(k,d.matrix);});post.name='Debris fence posts';W.world.add(post);
}

// ---------- Building kit: merged, metric-UV geometry, one draw call per material ----------
class CT48Kit{
 constructor(W){this.W=W;this.bins=new Map();this.tmp=new THREE.Vector3();}
 bin(m){let b=this.bins.get(m);if(!b)this.bins.set(m,b={p:[],n:[],uv:[],ix:[]});return b;}
 // Local frame: x away from the track (or any chosen axis), z along, y up.
 frame(x,y,z,ax,az){return{x,y,z,ax,az};}
 at(f,lx,ly,lz){return[f.x+f.ax.x*lx+f.az.x*lz,f.y+ly,f.z+f.ax.z*lx+f.az.z*lz];}
 quad(m,a,b,c,d,uv=[0,0,1,0,1,1,0,1]){const B=this.bin(m),k=B.p.length/3,e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];const l=Math.hypot(...n)||1;n=n.map(v=>v/l);
  B.p.push(...a,...b,...c,...d);for(let i=0;i<4;i++)B.n.push(...n);B.uv.push(...uv);B.ix.push(k,k+1,k+2,k,k+2,k+3);}
 // Quad given in local coordinates, wound so its normal faces `out` (local direction).
 lquad(m,f,pts,out,uv){const w=pts.map(p=>this.at(f,...p)),o=[f.ax.x*out[0]+f.az.x*out[2],out[1],f.ax.z*out[0]+f.az.z*out[2]],e1=w[1].map((v,i)=>v-w[0][i]),e2=w[3].map((v,i)=>v-w[0][i]),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
  if(n[0]*o[0]+n[1]*o[1]+n[2]*o[2]<0){this.quad(m,w[0],w[3],w[2],w[1],uv?[uv[0],uv[1],uv[6],uv[7],uv[4],uv[5],uv[2],uv[3]]:undefined);}else this.quad(m,w[0],w[1],w[2],w[3],uv);}
 // Axis-aligned box in a frame. mats: {side,top,bottom,front,back,left,right}; UVs in metres.
 box(f,cx,cy,cz,w,h,d,mats){const m=typeof mats==='object'&&!mats.isMaterial?mats:{side:mats},S=m.side||m.front,x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2,z1=cz+d/2,uo=m.uo||0;
  const face=(mat,pts,out,uw,vh)=>{if(mat)this.lquad(mat,f,pts,out,[uo,0,uo+uw,0,uo+uw,vh,uo,vh]);};
  face(m.front||S,[[x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1]],[-1,0,0],d,h);
  face(m.back||S,[[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],[1,0,0],d,h);
  face(m.left||S,[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[0,0,-1],w,h);
  face(m.right||S,[[x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1]],[0,0,1],w,h);
  if(m.top!==null)face(m.top||S,[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],[0,1,0],w,d);
  if(m.bottom)face(m.bottom,[[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]],[0,-1,0],w,d);}
 // Gable roof along z (ridge along z) or hip roof; overhang o.
 gable(f,cx,y,cz,w,d,rise,roof,gableMat,o=.45){const x0=cx-w/2-o,x1=cx+w/2+o,z0=cz-d/2-o,z1=cz+d/2+o,r=y+rise,sl=Math.hypot(w/2+o,rise);
  this.lquad(roof,f,[[x0,y,z0],[cx,r,z0],[cx,r,z1],[x0,y,z1]],[-1,1,0],[0,0,sl,0,sl,z1-z0,0,z1-z0]);
  this.lquad(roof,f,[[x1,y,z1],[cx,r,z1],[cx,r,z0],[x1,y,z0]],[1,1,0],[0,0,sl,0,sl,z1-z0,0,z1-z0]);
  for(const [z,s] of [[cz-d/2,-1],[cz+d/2,1]])this.tri(gableMat,f,[[cx-w/2,y,z],[cx+w/2,y,z],[cx,r-.05,z]],[0,0,s]);}
 hip(f,cx,y,cz,w,d,rise,roof,o=.5){const x0=cx-w/2-o,x1=cx+w/2+o,z0=cz-d/2-o,z1=cz+d/2+o,ridge=Math.max(0,(d-w)/2),r=y+rise,a=[cx,r,cz-ridge],b=[cx,r,cz+ridge];
  this.lquad(roof,f,[[x0,y,z0],a,b,[x0,y,z1]],[-1,1,0],[0,0,3,0,3,3,0,3]);this.lquad(roof,f,[[x1,y,z1],b,a,[x1,y,z0]],[1,1,0],[0,0,3,0,3,3,0,3]);
  this.tri(roof,f,[[x1,y,z0],[x0,y,z0],a],[0,1,-1]);this.tri(roof,f,[[x0,y,z1],[x1,y,z1],b],[0,1,1]);}
 tri(m,f,pts,out){const w=pts.map(p=>this.at(f,...p)),o=[f.ax.x*out[0]+f.az.x*out[2],out[1],f.ax.z*out[0]+f.az.z*out[2]],e1=w[1].map((v,i)=>v-w[0][i]),e2=w[2].map((v,i)=>v-w[0][i]);let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
  if(n[0]*o[0]+n[1]*o[1]+n[2]*o[2]<0){w.reverse();n=n.map(v=>-v);}const l=Math.hypot(...n)||1,B=this.bin(m),k=B.p.length/3;B.p.push(...w[0],...w[1],...w[2]);for(let i=0;i<3;i++)B.n.push(n[0]/l,n[1]/l,n[2]/l);B.uv.push(0,0,Math.hypot(...e1),0,0,Math.max(.01,Math.abs(w[2][1]-w[0][1])));B.ix.push(k,k+1,k+2);}
 cyl(f,cx,cy,cz,r,h,m,seg=10){for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,p=(t,y)=>[cx+Math.cos(t)*r,y,cz+Math.sin(t)*r],mid=(a+b)/2;this.lquad(m,f,[p(a,cy-h/2),p(b,cy-h/2),p(b,cy+h/2),p(a,cy+h/2)],[Math.cos(mid),0,Math.sin(mid)],[i/seg*r*6.28,0,(i+1)/seg*r*6.28,0,(i+1)/seg*r*6.28,h,i/seg*r*6.28,h]);}}
 flush(name,shadows=true){for(const [m,B]of this.bins){if(!B.ix.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(B.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(B.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(B.uv,2));g.setIndex(B.ix);g.computeBoundingSphere();const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=shadows&&!m.transparent;o.receiveShadow=true;o.matrixAutoUpdate=false;o.updateMatrix();this.W.world.add(o);}this.bins.clear();}
}

// ---------- Materials: canvas textures, metres per tile set through repeat ----------
function ct48Tex(W,w,h,draw,mx,my){const t=W.texture(w,h,draw);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/mx,1/my);t.anisotropy=4;return t;}
function ct48Night(W,m){W.gr27Night||={value:0};m.onBeforeCompile=s=>{s.uniforms.gr27Night=W.gr27Night;s.fragmentShader='uniform float gr27Night;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,.78,.5)*gr27Night*.45*smoothstep(.05,.35,diffuseColor.b-diffuseColor.r*.5);');};m.customProgramCacheKey=()=> 'ct48Night1';return m;}
function ct48Materials(W){
 if(W.ct48Mats)return W.ct48Mats;const r=()=>W.rnd(),T=THREE,std=(o)=>new T.MeshStandardMaterial(o);
 const noise=(c,w,h,n,a)=>{for(let i=0;i<n;i++){c.fillStyle=r()<.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a})`;c.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}};
 // Curtain-wall glass: 1.5 m x 3.6 m panes, mullions, sky reflection toward the top.
 const glass=ct48Tex(W,128,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#33444f');g.addColorStop(.55,'#4f6a79');g.addColorStop(1,'#8fa9b6');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,255,.08)';c.beginPath();c.moveTo(0,h);c.lineTo(w*.7,0);c.lineTo(w,0);c.lineTo(w*.3,h);c.fill();c.fillStyle='#b9c2c6';c.fillRect(0,0,5,h);c.fillRect(0,0,w,7);c.fillStyle='#2b3338';c.fillRect(0,h*.5,w,3);},1.5,3.6);
 // Office ribbon windows: spandrel band, window strip, floor every 3.6 m.
 const ribbon=ct48Tex(W,128,256,(c,w,h)=>{c.fillStyle='#e6e4dc';c.fillRect(0,0,w,h);noise(c,w,h,600,.04);const g=c.createLinearGradient(0,h*.08,0,h*.62);g.addColorStop(0,'#2d3c46');g.addColorStop(1,'#62808f');c.fillStyle=g;c.fillRect(0,h*.08,w,h*.56);c.fillStyle='#c9ced0';c.fillRect(0,h*.08,4,h*.56);c.fillRect(w/2,h*.08,3,h*.56);},2.4,3.6);
 const concrete=ct48Tex(W,128,128,(c,w,h)=>{c.fillStyle='#c9c7bf';c.fillRect(0,0,w,h);noise(c,w,h,2500,.07);c.fillStyle='rgba(60,60,60,.25)';c.fillRect(0,0,w,1);c.fillRect(0,0,1,h);},4,3);
 const corrugated=ct48Tex(W,64,64,(c,w,h)=>{for(let x=0;x<w;x++){const v=200+Math.round(Math.sin(x/w*Math.PI*8)*28);c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(x,0,1,h);}noise(c,w,h,300,.05);},1.5,1.5);
 const brick=ct48Tex(W,128,128,(c,w,h)=>{c.fillStyle='#d8d4cc';c.fillRect(0,0,w,h);const bh=h/14,bw=w/4;for(let row=0;row<14;row++)for(let k=-1;k<5;k++){const x=k*bw+(row%2)*bw/2,v=205+Math.round((r()-.5)*70);c.fillStyle=`rgb(${v},${v-8},${v-14})`;c.fillRect(x+1.5,row*bh+1.5,bw-3,bh-3);}},1.0,1.0);
 const weatherboard=ct48Tex(W,64,128,(c,w,h)=>{c.fillStyle='#f2f1ec';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=h/8){const g=c.createLinearGradient(0,y,0,y+h/8);g.addColorStop(0,'#c9c8c2');g.addColorStop(.2,'#f4f3ee');g.addColorStop(1,'#e2e1db');c.fillStyle=g;c.fillRect(0,y,w,h/8);}},1.2,1.2);
 const render=ct48Tex(W,64,64,(c,w,h)=>{c.fillStyle='#efede6';c.fillRect(0,0,w,h);noise(c,w,h,900,.035);},2,2);
 const tiles=ct48Tex(W,128,128,(c,w,h)=>{for(let row=0;row<8;row++)for(let k=0;k<9;k++){const v=150+Math.round((r()-.5)*40);c.fillStyle=`rgb(${v+40},${v-35},${v-60})`;c.fillRect(k*w/8-(row%2)*w/16,row*h/8,w/8-2,h/8-1);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(k*w/8-(row%2)*w/16,row*h/8+h/8-3,w/8,2);}},1.6,1.6);
 // Grandstand rows: concrete step, coloured seats, spectators in about half of them.
 const seats=(seat)=>ct48Tex(W,256,256,(c,w,h)=>{const rows=4,rh=h/rows,cols=8,cw=w/cols;c.fillStyle='#a9a8a2';c.fillRect(0,0,w,h);
  for(let i=0;i<rows;i++){c.fillStyle='#8d8c86';c.fillRect(0,i*rh+rh*.78,w,rh*.22);for(let k=0;k<cols;k++){const x=k*cw,y=i*rh;c.fillStyle=seat;c.fillRect(x+3,y+rh*.30,cw-6,rh*.42);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x+3,y+rh*.62,cw-6,rh*.1);
   if(r()<.55){const shirt=['#e8e6df','#1c2a44','#c3262f','#f1c232','#2e5d9b','#3a3a3a','#1f6b3a','#e57b1f'][Math.floor(r()*8)];c.fillStyle=shirt;c.fillRect(x+cw*.22,y+rh*.22,cw*.56,rh*.42);c.fillStyle=['#e2b48f','#c58e66','#8a5c3f','#f0c9a6'][Math.floor(r()*4)];c.beginPath();c.arc(x+cw/2,y+rh*.15,cw*.17,0,7);c.fill();if(r()<.4){c.fillStyle=shirt;c.fillRect(x+cw*.3,y+rh*.02,cw*.4,rh*.06);}}}}},3.2,3.4);
 const tent=ct48Tex(W,64,64,(c,w,h)=>{c.fillStyle='#f6f5ef';c.fillRect(0,0,w,h);c.fillStyle='rgba(0,0,0,.05)';for(let x=0;x<w;x+=16)c.fillRect(x,0,2,h);},3,3);
 const asphalt=ct48Tex(W,128,128,(c,w,h)=>{c.fillStyle='#4a4d50';c.fillRect(0,0,w,h);noise(c,w,h,4000,.08);},5,5);
 const M={
  glass:ct48Night(W,std({map:glass,roughness:.12,metalness:.55,envMapIntensity:1.1})),
  ribbon:ct48Night(W,std({map:ribbon,roughness:.35,metalness:.2})),
  concrete:std({map:concrete,roughness:.92}),concreteWarm:std({map:concrete,color:'#efe3cf',roughness:.92}),
  roof:std({map:corrugated,color:'#d9dcdc',roughness:.42,metalness:.12}),
  steel:W.mat('#9aa6ad',.45,.6),underside:std({color:'#8f918f',emissive:'#7b7f84',roughness:.9}),darkSteel:W.mat('#3e464c',.5,.5),white:W.mat('#f2f2ee',.6,.1),black:W.mat('#1c2227',.7,.1),
  rail:std({color:'#bcd2da',roughness:.1,metalness:.2,transparent:true,opacity:.42}),
  tent:std({map:tent,roughness:.85,side:THREE.DoubleSide}),asphalt:std({map:asphalt,roughness:.95}),
  seats:{red:std({map:seats('#b8242d'),roughness:.8}),blue:std({map:seats('#24538e'),roughness:.8}),orange:std({map:seats('#d87a1d'),roughness:.8}),green:std({map:seats('#2f6b45'),roughness:.8})},
  colorbond:{},brick:{},weatherboard:{},render:{},tiles:std({map:tiles,roughness:.8}),
 };
 // Colorbond roof colours and wall tints seen around Bathurst.
 for(const [k,v] of Object.entries({monument:'#3d4146',surfmist:'#e9e8e0',woodland:'#8c9286',manor:'#7a3530',paperbark:'#cbbfa5',windspray:'#9da3a1',deepocean:'#3a4f63',jasper:'#6d5c4f'}))M.colorbond[k]=std({map:corrugated,color:v,roughness:.5,metalness:.1});
 for(const [k,v] of Object.entries({red:'#a5583f',cream:'#e9d6b1',brown:'#8a6a52',blend:'#bf8a63'}))M.brick[k]=std({map:brick,color:v,roughness:.9});
 for(const [k,v] of Object.entries({white:'#f4f2ea',cream:'#efe1bf',sage:'#b8c2a5',blue:'#a9bfcc',heritage:'#d9c79c'}))M.weatherboard[k]=std({map:weatherboard,color:v,roughness:.8});
 for(const [k,v] of Object.entries({white:'#f3f1ea',sand:'#e3d5ba',grey:'#b9bab5',charcoal:'#5d6166'}))M.render[k]=std({map:render,color:v,roughness:.85});
 // A house window: white frame, two sashes, curtains.
 M.window=ct48Night(W,std({map:W.texture(64,64,(c,w,h)=>{c.fillStyle='#f4f4f0';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#5c7584');g.addColorStop(1,'#26343d');c.fillStyle=g;c.fillRect(5,5,w-10,h-10);c.fillStyle='#f4f4f0';c.fillRect(w/2-2,5,4,h-10);c.fillStyle='rgba(235,225,200,.55)';c.fillRect(6,6,9,h-12);c.fillRect(w-15,6,9,h-12);}),roughness:.2,metalness:.3}));
 M.door=W.mat('#6b4a33',.7,.05);M.garageDoor=std({map:ct48Tex(W,64,64,(c,w,h)=>{c.fillStyle='#e7e7e1';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=8){c.fillStyle='#bdbdb7';c.fillRect(0,y,w,2);}},2.4,2.1),roughness:.5,metalness:.3});
 return W.ct48Mats=M;
}

// ---------- Placement helpers ----------
function ct48Frame(W,phase,side,lane,along=0){const s=W.at(phase),ax=s.n.clone().multiplyScalar(side),az=s.v.clone(),x=s.p.x+ax.x*lane+az.x*along,z=s.p.z+ax.z*lane+az.z*along;return{x,y:0,z,ax:{x:ax.x,z:ax.z},az:{x:az.x,z:az.z},s};}
function ct48Ground(W,f,w,d){let lo=Infinity,hi=-Infinity;for(const a of [-.5,0,.5])for(const b of [-.5,0,.5]){const x=f.x+f.ax.x*a*w+f.az.x*b*d,z=f.z+f.ax.z*a*w+f.az.z*b*d,h=gr26SceneryGround(W,x,z);lo=Math.min(lo,h);hi=Math.max(hi,h);}return{lo,hi};}
function ct48Reserve(W,f,w,d,h,kind){const cx=f.x+f.ax.x*w/2,cz=f.z+f.ax.z*w/2;(W.ct48Reserved||=[]).push({x:cx,z:cz,r:Math.hypot(w,d)/2+2});W.registerStructure?.(kind,cx,cz,w,d,Math.atan2(f.az.x,f.az.z),h,f.y);}
// Footprint from x=0 (front, toward the track) to x=w, centred on z.
function ct48Clear(W,f,w,d,road=13,pit=7){for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const lx=a/4*w,lz=(b/4-.5)*d,x=f.x+f.ax.x*lx+f.az.x*lz,z=f.z+f.ax.z*lx+f.az.z*lz;if(W.nearest({x,z}).distance<road)return false;if(W.pit?.samples&&W.pitDistance(x,z)<pit)return false;for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r)return false;}return true;}
// Slide a footprint away from the track until it is clear.
function ct48Find(W,phase,side,lane,w,d,road=13,tries=8,step=6){for(let t=0;t<tries;t++){const f=ct48Frame(W,phase,side,lane+t*step);if(ct48Clear(W,f,w,d,road))return f;}return null;}
// Level platform: a concrete plinth hides any slope under the footprint.
function ct48Plinth(K,W,f,w,d,M){const g=ct48Ground(W,f,w,d);f.y=g.hi;if(g.hi-g.lo>.08)K.box(f,w/2,(g.lo+g.hi)/2-f.y-.3,0,w+.6,g.hi-g.lo+.6,d+.6,{side:M.concrete,top:M.concrete});return f;}

// ---------- Buildings ----------
function ct48Grandstand(K,W,f,len,M,seat,sponsor){
 const depth=17,rise=8.6,front=2.2,roofY=front+rise+5.2;ct48Plinth(K,W,f,depth+1,len,M);
 // Front wall with sponsor band, tiered seating, side walls, back wall, roof on rear columns.
 K.box(f,.2,front/2,0,.4,front,len,{side:M.concreteWarm,top:M.concrete});
 K.lquad(seat,f,[[.4,front,-len/2],[depth-1.6,front+rise,-len/2],[depth-1.6,front+rise,len/2],[.4,front,len/2]],[-1,1,0],[0,0,0,Math.hypot(depth-2,rise),len,Math.hypot(depth-2,rise),len,0]);
 for(let z=-len/2+8;z<len/2-4;z+=14)K.lquad(M.concrete,f,[[.4,front+.03,z-.6],[depth-1.6,front+rise+.03,z-.6],[depth-1.6,front+rise+.03,z+.6],[.4,front+.03,z+.6]],[-1,1,0]);
 for(const s of [-1,1]){K.lquad(M.concreteWarm,f,[[0,0,s*len/2],[depth,0,s*len/2],[depth,front+rise+1.2,s*len/2],[.4,front+.9,s*len/2]],[0,0,s]);}
 K.box(f,depth-.8,(front+rise+1.2)/2,0,1.6,front+rise+1.2,len,{side:M.ribbon,top:M.concrete,front:M.concrete});
 for(let z=-len/2+1;z<=len/2-1;z+=Math.max(10,(len-2)/Math.round((len-2)/12))){K.box(f,depth-.3,roofY/2,z,.45,roofY,.45,M.steel);K.lquad(M.steel,f,[[depth-.3,roofY-.2,z-.12],[1.5,roofY+1.1,z-.12],[1.5,roofY+1.4,z+.12],[depth-.3,roofY+.1,z+.12]],[0,-1,0]);}
 K.lquad(M.roof,f,[[depth+.5,roofY,-len/2-1],[-1.5,roofY+1.4,-len/2-1],[-1.5,roofY+1.4,len/2+1],[depth+.5,roofY,len/2+1]],[0,1,0]);
 K.lquad(M.underside,f,[[depth+.5,roofY-.05,len/2+1],[-1.5,roofY+1.35,len/2+1],[-1.5,roofY+1.35,-len/2-1],[depth+.5,roofY-.05,-len/2-1]],[0,-1,0]);
 K.box(f,-1.5,roofY+.95,0,.25,1.1,len+2,{side:M.white,front:M.darkSteel});
 if(sponsor){const tex=W.sign(sponsor,'#f4f4f4',1024,128),q=K.at(f,-1.68,roofY+.95,0);W.signPlane(tex,Math.min(len*.5,28),1.0,new THREE.Vector3(...q),Math.atan2(-f.ax.x,-f.ax.z));}
 ct48Reserve(W,f,depth+2,len+3,roofY+2,'grandstand');
}
// Bathurst pit complex: two levels of corporate suites over the garages.
function ct48PitComplex(K,W,M){
 const pit=W.pit;if(!pit?.samples||!pit.bays?.length)return;const side=pit.bays[Math.floor(pit.bays.length/2)].side,from=.20,to=.80,chunks=10;
 for(let c=0;c<chunks;c++){const fa=from+(to-from)*c/chunks,fb=from+(to-from)*(c+1)/chunks,a=dc32PitAt(W,fa),b=dc32PitAt(W,fb),mid=dc32PitAt(W,(fa+fb)/2),len=a.p.distanceTo(b.p)+.05;
  const az={x:b.p.x-a.p.x,z:b.p.z-a.p.z},l=Math.hypot(az.x,az.z);az.x/=l;az.z/=l;const ax={x:mid.n.x*side,z:mid.n.z*side},f={x:(a.p.x+b.p.x)/2,y:Math.max(a.p.y,b.p.y),z:(a.p.z+b.p.z)/2,ax,az};
  const y0=5.65,floor=3.7;
  // Suites: glass front, balconies with glass balustrades, rear concrete with ribbon windows.
  K.box(f,15.5,y0+floor,0,12,floor*2,len,{front:M.glass,back:M.ribbon,left:M.concrete,right:M.concrete,top:M.concrete,uo:c*len});
  for(const lvl of [0,1]){const y=y0+lvl*floor;K.box(f,8.8,y+.12,0,1.4,.24,len,{side:M.white});K.lquad(M.rail,f,[[8.12,y+.24,-len/2],[8.12,y+.24,len/2],[8.12,y+1.3,len/2],[8.12,y+1.3,-len/2]],[-1,0,0]);K.box(f,8.12,y+1.32,0,.08,.06,len,M.steel);}
  K.box(f,13.5,y0+floor*2+.35,0,17,.5,len+.02,{side:M.white,top:M.roof});
  if(c===0||c===chunks-1)K.box(f,16,y0+floor+1.5,(c?1:-1)*(len/2-3),6,floor*2+3,6,{side:M.concreteWarm});
 }
 // Name across the fascia, readable from the main straight.
 const m=dc32PitAt(W,.5),q=m.p.clone().addScaledVector(m.n,side*5.0);q.y+=13.35;
 W.signPlane(W.sign('MOUNT PANORAMA  ·  BATHURST','#14324a',1024,96),70,2.0,q,Math.atan2(-m.n.x*side,-m.n.z*side));
 // Race control at the exit end: four floors, wider glass control room, mast.
 const e=dc32PitAt(W,.86),ax={x:e.n.x*side,z:e.n.z*side},az={x:e.v.x,z:e.v.z},f={x:e.p.x+ax.x*13,y:e.p.y,z:e.p.z+ax.z*13,ax,az};
 if(ct48Clear(W,f,10,10,12,0)){K.box(f,5,7,0,8,14,8,{side:M.ribbon,top:M.concrete});K.box(f,4.6,16,0,10.5,4,10,{side:M.glass,top:M.concrete});K.box(f,4.6,18.25,0,11.5,.5,11,{side:M.white,top:M.roof});K.box(f,6,22,2,.18,7,.18,M.steel);K.box(f,6,24.5,2,1.4,.12,.12,M.steel);
  const t=W.sign('RACE CONTROL','#c3262f',512,96),p=K.at(f,-.66,16,0);W.signPlane(t,6,1.1,new THREE.Vector3(...p),Math.atan2(-ax.x,-ax.z));ct48Reserve(W,{...f,x:f.x-ax.x*1,z:f.z-ax.z*1},12,12,20,'race control');}
}
// Houses: four Australian types, each with windows, door, gutters and a yard.
function ct48House(K,W,f,type,seed,M){
 const h=k=>ct48Hash(seed,k),cols=Object.keys(M.colorbond),roof=M.colorbond[cols[Math.floor(h(1)*cols.length)]];
 const w=type==='queenslander'?11:type==='modern'?13:type==='federation'?12:14,d=type==='modern'?10:11,wall=type==='queenslander'?M.weatherboard[['white','cream','sage','blue','heritage'][Math.floor(h(2)*5)]]:type==='modern'?M.render[['white','sand','grey','charcoal'][Math.floor(h(2)*4)]]:M.brick[['red','cream','brown','blend'][Math.floor(h(2)*4)]];
 if(!ct48Clear(W,f,d+14,w+10,16))return false;const yard=ct48Plinth(K,W,{...f,x:f.x+f.ax.x*7,z:f.z+f.ax.z*7},d,w,M);f.y=yard.y;const fx=7;
 const lift=type==='queenslander'?1.6:0,wh=2.8,base=lift;
 if(lift){for(const a of [-1,1])for(const b of [-1,0,1])K.box(f,fx+(a*.45+.5)*d,lift/2,b*(w/2-.2),.25,lift,.25,M.white);K.box(f,fx+d/2,lift/2,0,d-.5,lift,w-.5,{side:M.concrete,top:null});}
 K.box(f,fx+d/2,base+wh/2,0,d,wh,w,{side:wall,top:M.concrete});
 // Windows on the front (facing the road) and the long sides; door; garage on brick homes.
 const win=(lx,lz,ww,wh2,face)=>{if(face==='front')K.lquad(M.window,f,[[fx-.03,base+.9,lz-ww/2],[fx-.03,base+.9,lz+ww/2],[fx-.03,base+.9+wh2,lz+ww/2],[fx-.03,base+.9+wh2,lz-ww/2]],[-1,0,0],[0,0,1,0,1,1,0,1]);else{const s=face==='left'?-1:1,z=s*(w/2+.03);K.lquad(M.window,f,[[lx-ww/2,base+.9,z],[lx+ww/2,base+.9,z],[lx+ww/2,base+.9+wh2,z],[lx-ww/2,base+.9+wh2,z]],[0,0,s],[0,0,1,0,1,1,0,1]);}};
 win(0,-w*.28,1.8,1.3,'front');win(0,w*.28,1.8,1.3,'front');win(fx+d*.3,0,1.4,1.1,'left');win(fx+d*.7,0,1.4,1.1,'right');
 K.lquad(M.door,f,[[fx-.04,base,-.45],[fx-.04,base,.45],[fx-.04,base+2.1,.45],[fx-.04,base+2.1,-.45]],[-1,0,0]);
 if(type==='brick'){K.box(f,fx+d*.45,1.35,w/2+3,d*.9,2.7,6,{side:wall,top:M.concrete});K.lquad(M.garageDoor,f,[[fx+d*.45-d*.45-.03,0,w/2+.4],[fx-.03,0,w/2+5.6],[fx-.03,2.3,w/2+5.6],[fx-.03,2.3,w/2+.4]],[-1,0,0]);K.hip(f,fx+d*.45,2.7,w/2+3,d*.9,6,1.4,roof,.35);
  K.lquad(M.asphalt,f,[[0,.03,w/2+.6],[fx,.03,w/2+.6],[fx,.03,w/2+5.4],[0,.03,w/2+5.4]],[0,1,0]);}
 const top=base+wh;
 if(type==='brick')K.hip(f,fx+d/2,top,0,d,w,2.6,roof);
 else if(type==='federation'){K.hip(f,fx+d/2,top,0,d,w,3.6,M.tiles);K.box(f,fx-1.2,base+wh/2,-w*.25,2.4,wh,w*.4,{side:wall,top:M.concrete});K.gable(f,fx-1.2,top,-w*.25,2.4,w*.4,1.6,M.tiles,wall,.3);K.box(f,fx+d*.6,top+2.2,w*.3,.8,2.4,.8,M.brick.red);}
 else if(type==='queenslander'){K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,top,-(fx+d/2),w,d,3.2,roof,wall,.5);
  // Full-width front verandah with posts, rail and its own skillion roof.
  K.box(f,fx-1.3,base-.1,0,2.6,.2,w,{side:M.white,top:M.concrete});for(let z=-w/2+.2;z<=w/2;z+=w/4)K.box(f,fx-2.5,base+1.3,z,.14,2.6,.14,M.white);K.box(f,fx-2.5,base+.95,0,.08,.08,w,M.white);K.lquad(roof,f,[[fx-2.9,top-.25,-w/2-.2],[fx,top+.25,-w/2-.2],[fx,top+.25,w/2+.2],[fx-2.9,top-.25,w/2+.2]],[0,1,0]);
  K.box(f,fx-2,lift/2,w/2-1,1.4,lift,1.2,{side:M.concrete});}
 else{// modern skillion, two volumes
  K.lquad(roof,f,[[fx-.5,top+.2,-w/2-.4],[fx+d+.5,top+1.1,-w/2-.4],[fx+d+.5,top+1.1,w/2+.4],[fx-.5,top+.2,w/2+.4]],[0,1,0]);K.box(f,fx+d*.35,top+1.6,-w*.25,d*.7,3.2,w*.45,{side:M.render.charcoal,top:roof});K.lquad(M.glass,f,[[fx+d*.35-d*.35-.03,top+.4,-w*.4],[fx-.03,top+.4,-w*.1],[fx-.03,top+2.8,-w*.1],[fx-.03,top+2.8,-w*.4]],[-1,0,0],[0,0,1.5,0,1.5,3.6,0,3.6]);}
 // Water tank, side fence, letterbox.
 if(h(5)<.75)K.cyl(f,fx+d+1.2,1.1,-w/2+1.2,1.0,2.2,M.colorbond[['surfmist','woodland','paperbark'][Math.floor(h(6)*3)]],10);
 for(const s of [-1,1])K.box(f,fx+d/2,.9,s*(w/2+(type==='brick'&&s>0?7:1.5)),d+12,1.8,.06,M.colorbond.woodland);
 K.box(f,.6,.55,-w*.4,.3,1.1,.3,M.brick.red);
 ct48Reserve(W,{...f,x:f.x+f.ax.x*3,z:f.z+f.ax.z*3},d+12,w+10,top+4,'house');return true;
}
// Farm shed and a homestead for the rural edges.
function ct48Shed(K,W,f,seed,M){const w=18+ct48Hash(seed,1)*8,d=12,h=4.5,cols=Object.keys(M.colorbond),c=M.colorbond[cols[Math.floor(ct48Hash(seed,2)*cols.length)]];if(!ct48Clear(W,f,d+2,w+2,18))return false;ct48Plinth(K,W,f,d,w,M);
 K.box(f,d/2,h/2,0,d,h,w,{side:c,top:null});K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,h,-d/2,w,d,1.8,c,c,.3);K.lquad(M.darkSteel,f,[[-.03,0,-w*.3],[-.03,0,w*.05],[-.03,3.8,w*.05],[-.03,3.8,-w*.3]],[-1,0,0]);ct48Reserve(W,f,d,w,7,'shed');return true;}
// A white hospitality marquee with a peaked roof.
function ct48Marquee(K,W,f,w,d,M){ct48Plinth(K,W,f,d,w,M);const h=2.6;K.box(f,d/2,h/2,0,d,h,w,{side:M.tent,top:null});for(let z=-w/2;z<w/2-.1;z+=5){const zz=Math.min(5,w/2-z);K.tri(M.tent,f,[[0,h,z],[0,h,z+zz],[d/2,h+1.6,z+zz/2]],[-1,1,0]);K.tri(M.tent,f,[[d,h,z+zz],[d,h,z],[d/2,h+1.6,z+zz/2]],[1,1,0]);K.tri(M.tent,f,[[d,h,z],[0,h,z],[d/2,h+1.6,z+zz/2]],[0,1,-1]);K.tri(M.tent,f,[[0,h,z+zz],[d,h,z+zz],[d/2,h+1.6,z+zz/2]],[0,1,1]);}ct48Reserve(W,f,d,w,5,'marquee');}

// Campers: dome and A-frame tents, caravans, 4WDs, gazebos and flags, instanced.
function ct48Camping(W,zones,M){
 const T=THREE,rows={dome:[],aframe:[],van:[],car:[],gazebo:[],flag:[],pole:[]},colours=['#2e6db4','#d23b2f','#f2c230','#3d8a4a','#e57b1f','#5b5f66','#1f3f72','#ececec'];
 for(const [p0,p1,side,from,to,count] of zones){for(let i=0;i<count;i++){const ph=p0+(p1-p0)*W.rnd(),lane=from+(to-from)*Math.pow(W.rnd(),.8),f=ct48Frame(W,ph,side,lane,(W.rnd()-.5)*6),x=f.x,z=f.z;
  if(W.nearest({x,z}).distance<from-1||(W.ct48Reserved||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r))continue;const y=gr26SceneryGround(W,x,z),yaw=W.rnd()*6.28,c=colours[Math.floor(W.rnd()*colours.length)],r=W.rnd();
  if(r<.32)rows.dome.push([x,y,z,yaw,c,1+W.rnd()*.5]);else if(r<.45)rows.aframe.push([x,y,z,yaw,c,1]);else if(r<.62)rows.van.push([x,y,z,yaw,'#efede4',1]);else if(r<.8)rows.car.push([x,y,z,yaw,['#f1f1ee','#2b2f33','#8c1d1d','#5d6b77','#c9b48a','#1d3c6e'][Math.floor(W.rnd()*6)],1]);else if(r<.92)rows.gazebo.push([x,y,z,yaw,['#f4f4f0','#2e6db4','#c3262f'][Math.floor(W.rnd()*3)],1]);else{rows.pole.push([x,y,z,0,'#cfd3d4',1]);rows.flag.push([x,y,z,yaw,['#c3262f','#1f3f72','#f2c230','#ffffff','#2e6db4'][Math.floor(W.rnd()*5)],1]);}}}
 const geo={dome:new T.SphereGeometry(1.4,10,5,0,Math.PI*2,0,Math.PI/2).scale(1,.8,1.2),aframe:(()=>{const g=new T.CylinderGeometry(1.2,1.2,2.6,3,1);g.rotateZ(Math.PI/2);g.rotateY(Math.PI/2);g.translate(0,.6,0);return g;})(),
  van:(()=>{const g=new T.BoxGeometry(2.3,2.5,6.0,1,1,1);g.translate(0,1.55,0);return g;})(),car:(()=>{const a=new T.BoxGeometry(1.9,.9,4.9);a.translate(0,.75,0);const b=new T.BoxGeometry(1.8,.75,2.4);b.translate(0,1.55,-.3);return ct48Merge([a,b]);})(),
  gazebo:(()=>{const a=new T.ConeGeometry(2.2,.9,4,1);a.rotateY(Math.PI/4);a.translate(0,2.75,0);const legs=[-1,1].flatMap(s=>[-1,1].map(t=>{const l=new T.CylinderGeometry(.04,.04,2.3,4);l.translate(s*1.45,1.15,t*1.45);return l;}));return ct48Merge([a,...legs]);})(),
  pole:(()=>{const g=new T.CylinderGeometry(.04,.05,7,5);g.translate(0,3.5,0);return g;})(),flag:(()=>{const g=new T.PlaneGeometry(1.8,1.1);g.translate(.95,6.3,0);return g;})()};
 const mats={dome:new T.MeshStandardMaterial({roughness:.8}),aframe:new T.MeshStandardMaterial({roughness:.8}),van:new T.MeshStandardMaterial({roughness:.4,metalness:.2}),car:new T.MeshStandardMaterial({roughness:.35,metalness:.4}),gazebo:new T.MeshStandardMaterial({roughness:.8}),pole:new T.MeshStandardMaterial({roughness:.4,metalness:.6}),flag:new T.MeshStandardMaterial({roughness:.8,side:T.DoubleSide})};
 const dummy=new T.Object3D(),colour=new T.Color();
 for(const [k,list] of Object.entries(rows)){if(!list.length)continue;const m=new T.InstancedMesh(geo[k],mats[k],list.length);m.name='Bathurst campers '+k;
  list.forEach(([x,y,z,yaw,c,s],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(s,s,s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,colour.set(c));});
  m.castShadow=k!=='flag';m.receiveShadow=true;m.computeBoundingSphere();W.world.add(m);}
 // Caravan windows and stripes in one pass of thin boxes.
 if(rows.van.length){const g=new T.BoxGeometry(2.34,.55,3.2);g.translate(0,2.05,.6);const m=new T.InstancedMesh(g,new T.MeshStandardMaterial({color:'#263642',roughness:.15,metalness:.4}),rows.van.length);rows.van.forEach(([x,y,z,yaw],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.computeBoundingSphere();W.world.add(m);}
 W.ct48Campers=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]));
}
function ct48Merge(list){const pos=[],nor=[],ix=[];for(const g0 of list){const g=g0.index?g0:g0;const p=g.attributes.position,n=g.attributes.normal,k=pos.length/3;for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));nor.push(n.getX(i),n.getY(i),n.getZ(i));}if(g.index)for(let i=0;i<g.index.count;i++)ix.push(g.index.getX(i)+k);else for(let i=0;i<p.count;i++)ix.push(i+k);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setIndex(ix);return g;}

// The town on the plain below the mountain: houses, shops, silos and a cathedral spire.
function ct48Town(K,W,M){
 const cx=1500,cz=-1550,types=['brick','brick','queenslander','federation','modern'];let n=0;
 for(let gx=-6;gx<=6;gx++)for(let gz=-5;gz<=5;gz++){const x=cx+gx*44+(ct48Hash(gx,gz)-.5)*10,z=cz+gz*38+(ct48Hash(gz,gx)-.5)*8;if(Math.hypot(gx,gz*1.2)>6.5||ct48Hash(gx,gz,3)<.12)continue;
  const ax={x:0,z:gz%2?1:-1},az={x:1,z:0},f={x,y:0,z,ax,az};f.y=gr26SceneryGround(W,x,z);const t=Math.hypot(gx,gz)<2.2?'shop':types[Math.floor(ct48Hash(gx,gz,4)*types.length)];
  if(t==='shop'){const h=6+ct48Hash(gx,gz,6)*7;K.box(f,7,h/2,0,14,h,20,{side:ct48Hash(gx,gz,7)<.5?M.ribbon:M.brick.red,top:M.concrete});K.box(f,-.6,3.2,0,1.6,.25,19,{side:M.white});}
  else ct48House(K,W,f,t,gx*31+gz,M);n++;}
 // Silos and the cathedral spire on the skyline.
 for(let i=0;i<4;i++){const f={x:cx+380,y:0,z:cz-260+i*9,ax:{x:1,z:0},az:{x:0,z:1}};f.y=gr26SceneryGround(W,f.x,f.z);K.cyl(f,0,13,0,4,26,M.concrete,14);}
 const c={x:cx-90,y:0,z:cz+40,ax:{x:1,z:0},az:{x:0,z:1}};c.y=gr26SceneryGround(W,c.x,c.z);K.box(c,0,7,0,14,14,34,{side:M.concreteWarm,top:null});K.gable(c,0,14,0,14,34,6,M.colorbond.monument,M.concreteWarm,.4);K.box(c,0,16,-19,6,32,6,{side:M.concreteWarm,top:null});
 const sp=new THREE.ConeGeometry(3.6,14,4);sp.rotateY(Math.PI/4);const spire=new THREE.Mesh(sp,M.colorbond.monument);spire.position.set(c.x,c.y+39,c.z-19);W.world.add(spire);
 return n;
}

// National Motor Racing Museum: long low building with a barrel roof.
function ct48Museum(K,W,f,M){const w=46,d=20,h=6;if(!f)return;ct48Plinth(K,W,f,d,w,M);K.box(f,d/2,h/2,0,d,h,w,{front:M.glass,side:M.concreteWarm,top:null});
 const seg=10;for(let i=0;i<seg;i++){const a=i/seg*Math.PI,b=(i+1)/seg*Math.PI,p=(t,z)=>[d/2-Math.cos(t)*(d/2+.4),h+Math.sin(t)*3.2,z];K.lquad(M.roof,f,[p(a,-w/2-.5),p(b,-w/2-.5),p(b,w/2+.5),p(a,w/2+.5)],[-Math.cos((a+b)/2),Math.sin((a+b)/2),0]);}
 for(const s of [-1,1]){const pts=[];for(let i=0;i<=seg;i++){const t=i/seg*Math.PI;pts.push([d/2-Math.cos(t)*(d/2+.4),h+Math.sin(t)*3.2,s*(w/2+.5)]);}for(let i=0;i<seg;i++)K.tri(M.concreteWarm,f,[[d/2,h,s*(w/2+.5)],pts[i],pts[i+1]],[0,0,s]);}
 const t=W.sign('NATIONAL MOTOR RACING MUSEUM','#14324a',1024,96),q=K.at(f,-.05,h-1.2,0);W.signPlane(t,22,1.6,new THREE.Vector3(...q),Math.atan2(-f.ax.x,-f.ax.z));ct48Reserve(W,f,d,w,10,'museum');}

function ct48BuildBathurst(W){
 const K=new CT48Kit(W),M=ct48Materials(W),pitSide=W.pit?.bays?.[6]?.side||1;
 const outside=(ph)=>{const s=W.at(ph);for(const side of [-1,1]){const x=s.p.x+s.n.x*side*60,z=s.p.z+s.n.z*side*60;if(!ct48Inside(W,x,z))return side;}return 1;};
 ct48PitComplex(K,W,M);
 // Grandstands: main straight opposite the pits, Hell Corner, The Chase and Murray's.
 const stands=[[.012,-pitSide,22,64,'red','Repco'],[.032,-pitSide,22,52,'blue','Supercheap Auto'],[.958,outside(.966),26,48,'orange','Bathurst 1000'],[.982,outside(.975),24,44,'red','Shell'],[.061,outside(.06),26,44,'blue','Dunlop'],[.884,outside(.88),30,50,'green','Penrite']];
 W.ct48Stands=0;for(const [ph,side,lane,len,seat,brand] of stands){const f=ct48Find(W,ph,side,lane,19,len+4,15);if(f){ct48Grandstand(K,W,f,len,M,M.seats[seat],brand);W.ct48Stands++;}}
 ct48Museum(K,W,ct48Find(W,.95,outside(.95),58,24,50,30),M);
 // Hospitality: suites behind Murray's, Brock's Skyline marquees and viewing deck.
 const sky=ct48Find(W,.478,outside(.478),16,14,40,13);if(sky){ct48Marquee(K,W,sky,36,12,M);const t=W.sign("BROCK'S SKYLINE",'#111b24',1024,128),q=K.at(sky,-.2,4.6,0);W.signPlane(t,14,1.8,new THREE.Vector3(...q),Math.atan2(-sky.ax.x,-sky.ax.z));}
 const deck=ct48Find(W,.462,outside(.462),15,8,30,13);if(deck){ct48Plinth(K,W,deck,8,30,M);K.box(deck,4,.15,0,8,.3,30,{side:M.concrete});for(let z=-14;z<=14;z+=3.5)K.box(deck,.2,.65,z,.08,1.0,.08,M.steel);K.box(deck,.2,1.15,0,.08,.08,30,M.steel);ct48Reserve(W,deck,8,30,3,'deck');}
 for(const ph of [.965,.89]){const f=ct48Find(W,ph,outside(ph),46,12,30,30);if(f)ct48Marquee(K,W,f,30,12,M);}
 // Houses along Panorama Avenue (Mountain Straight) and the bottom of Conrod; farm sheds.
 const types=['brick','queenslander','federation','modern','brick','queenslander'];let houses=0;
 for(let i=0;i<16;i++){const ph=.098+i*.0058,side=outside(ph),f=ct48Frame(W,ph,side,34+(i%3)*2);if(ct48House(K,W,f,types[i%types.length],i*17+3,M))houses++;}
 for(let i=0;i<9;i++){const ph=.79+i*.0055,side=outside(ph),f=ct48Frame(W,ph,side,36);if(ct48House(K,W,f,types[(i+2)%types.length],i*23+101,M))houses++;}
 for(const [ph,lane] of [[.12,120],[.15,135],[.80,140],[.74,110],[.70,150]]){const f=ct48Frame(W,ph,outside(ph),lane);ct48Shed(K,W,f,ph*1000,M);}
 W.ct48Houses=houses;
 W.ct48TownBuildings=ct48Town(K,W,M);K.flush('Bathurst buildings');
 // Campers: Reid Park, McPhillamy Park and the top of Conrod.
 ct48Camping(W,[[.325,.37,outside(.35),16,95,420],[.385,.44,outside(.41),16,110,560],[.355,.43,-outside(.41),16,70,240],[.69,.72,outside(.70),24,80,160]],M);
}

// Scenery hooks: the generic boxes give way to the buildings above.
const ct48Building=SC25World.prototype.building;
SC25World.prototype.building=function(...a){if(this.e.key==='bathurst')return false;return ct48Building.apply(this,a);};
const ct48Stand=SC25World.prototype.grandstand;
SC25World.prototype.grandstand=function(...a){if(this.e.key==='bathurst')return false;return ct48Stand.apply(this,a);};
const ct48Clearance=SC25World.prototype.clear;
SC25World.prototype.clear=function(x,z,r=0){if(!ct48Clearance.call(this,x,z,r))return false;for(const q of this.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+r)return false;return true;};
const ct48FootprintClear=SC25World.prototype.footprintClear;
SC25World.prototype.footprintClear=function(x,z,w,d,...rest){if(!ct48FootprintClear.call(this,x,z,w,d,...rest))return false;const r=Math.hypot(w,d)/2;for(const q of this.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+r)return false;return true;};

const ct48Scenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 if(this.e.key!=='bathurst')return ct48Scenery.call(this);
 // The mountain's own walls replace the generic wall line (and the fences built from it).
 const wall=this.batches.wall;if(wall)wall.rows=wall.rows.filter(r=>{const n=this.nearest({x:r[0],z:r[2]});return n.distance>24||ct48WallAt(this,n.i,1)>15.5;});
 ct48MountainWalls(this);ct48BuildBathurst(this);
 return ct48Scenery.call(this);
};
const ct48FlushB=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 if(this.e.key==='bathurst'){
  for(const key of ['camp-caravan','camp-glass','lightpole','floodlights'])delete this.batches[key];
  // Gum trees: pale trunks, grey-green crowns.
  if(this.batches['tree-trunk'])this.batches['tree-trunk'].mat=this.mat('#c9bfae');
  ['#5f6d4b','#6f7b56','#526247','#7a8361'].forEach((c,i)=>{const b=this.batches['tree-crown-'+i];if(b)b.mat=this.mat(c);});
 }
 return ct48FlushB.call(this);
};
