
/* CT50: Adelaide (East Parklands) and Townsville (Reid Park) on the Gold Coast street-circuit
   system: straight concrete street walls with escape roads, asphalt run-off, worn city asphalt
   and walls in the physics (all from ct48-goldcoast). The cities are their own:
   Adelaide: the circuit sits in parkland (lawns, paths, big gums and plane trees), Victoria
   Park's heritage grandstand, sandstone-and-iron-lace terraces and villas on the Kent Town side,
   the CBD towers out to the west and the Mount Lofty Ranges on the eastern horizon.
   Townsville: a low tropical city: Queenslanders on stilts, motels, shops, warehouses toward
   the port, a few mid-rise blocks and a modest CBD, palms and flowering poincianas, the
   granite bulk of Castle Hill and the ranges behind. */
const CT50={
 adelaide:{
  pit:{name:'ADELAIDE 500  ·  VICTORIA PARK',floors:2,signColour:'#7a1230'},
  stands:[[.985,0,64,'red','Adelaide 500'],[.03,0,50,'blue','Repco'],[.16,1,44,'orange','Supercheap Auto'],[.36,-1,40,'green','Dunlop'],[.6,1,44,'red','Shell'],[.82,-1,40,'blue','Penrite']],
  park:{r:190,trees:.9},cbd:{a:Math.PI,from:420,H:[38,135],keep:.85},
  suburb:{mix:[['terrace',.3],['house',.42],['shops',.12],['render',.1],['motel',0],['warehouse',0],['office',.06]],houses:['federation','brick','federation','modern'],H:[9,24]},
  trees:'gum',palms:.02,horizon:{base:25,ranges:[{a:0,w:.9,h:560,r:7200},{a:.7,w:.5,h:380,r:6400},{a:-.6,w:.5,h:330,r:6600}]},
  heritage:true,
 },
 townsville:{
  pit:{name:'TOWNSVILLE 500  ·  REID PARK',floors:1,signColour:'#0e4f6e'},
  stands:[[.985,0,56,'blue','Townsville 500'],[.03,0,44,'red','Repco'],[.25,1,40,'orange','Supercheap Auto'],[.55,-1,40,'green','Dunlop'],[.78,1,40,'red','Shell']],
  park:{r:120,trees:.6},vacant:.38,cbd:{a:-2.7,from:380,H:[24,88],keep:.6},
  suburb:{mix:[['house',.5],['motel',.12],['shops',.12],['render',.08],['warehouse',.12],['office',.06]],houses:['queenslander','queenslander','modern','queenslander','brick'],H:[9,21]},
  industrial:{a:.3},trees:'tropical',palms:.35,horizon:{base:30,ranges:[{a:1.4,w:.6,h:560,r:7000},{a:2.1,w:.4,h:420,r:6200},{a:-.4,w:.3,h:260,r:6800}]},
  castleHill:true,
 },
};
function ct50C(W){return CT50[W?.e?.key]||null;}

// The Gold Coast machinery runs for these two circuits as well.
const ct50GcBase=ct48Gc;
ct48Gc=function(W){return ct50GcBase(W)||!!ct50C(W);};
// No beach: the land runs to the edge of the map.
const ct50BeachBase=ct48GcBeachZ;
ct48GcBeachZ=function(W){return ct50C(W)?-(W.span+2400)/2-4:ct50BeachBase(W);};

// ---------- Ground: the Gold Coast block shader, with no streets through the parkland ----------
function ct50GroundMaterial(W){
 const m=ct48GcGroundMaterial(W),prev=m.onBeforeCompile;
 m.onBeforeCompile=sh=>{prev(sh);sh.fragmentShader=sh.fragmentShader.replace('col=mix(col,vec3(.74,.73,.70)*mv,kb);','float gcStreet=step(.5,blk.a);road*=gcStreet;kb*=gcStreet;dash*=gcStreet;foot*=gcStreet;col=mix(inner*mv,pav*mv*1.04,foot);col=mix(col,vec3(.74,.73,.70)*mv,kb);');};
 m.customProgramCacheKey=()=> 'ct50Ground1';return m;
}
function ct50Park(W,bi,bj,park){const B=ct48GcBlockMap(W),i=bi+64,j=bj+64;if(i<0||j<0||i>=B.S||j>=B.S)return;const k=(j*B.S+i)*4;B.data[k]=park?0:B.data[k];B.data[k+3]=park?0:255;B.tex.needsUpdate=true;}

// ---------- Buildings ----------
// Two-storey terrace row: sandstone or brick fronts, iron-lace verandahs on both floors,
// party-wall parapets and chimneys, a corrugated roof behind.
function ct50Terraces(K,W,f,len,M,MB,seed){
 const h=k=>ct48Hash(seed,k),n=Math.max(2,Math.floor(len/6.2)),u=len/n,d=11,H=7;K.begin(f);
 const walls=[[.93,.84,.68],[.88,.72,.56],[.78,.62,.52],[.95,.9,.8],[.7,.55,.45]];
 for(let i=0;i<n;i++){const z=-len/2+u*(i+.5),t=ct48GcPick(walls,h(i+1));K.tint=t;K.box(f,d/2,H/2,z,d,H,u-.05,{side:M.punched,top:null});
  K.tint=[.95,.95,.93];K.box(f,-.05,H+.6,z-u/2+.15,.3,1.2,.3,M.plain);K.tint=t.map(v=>v*.92);K.box(f,0,H+.5,z,.25,1.0,u-.3,M.plain);
  // Verandah: floor, posts, lace frieze, balustrade, bull-nosed roof.
  K.tint=[.25,.3,.28];K.box(f,-1.25,3.4,z,2.5,.18,u-.2,M.plain);for(const s of [-1,1])K.box(f,-2.4,1.7,z+s*(u/2-.25),.12,3.4,.12,M.metal);
  K.tint=[.95,.95,.92];K.lquad(M.railBar,f,[[-2.45,3.5,z-u/2+.2],[-2.45,3.5,z+u/2-.2],[-2.45,4.5,z+u/2-.2],[-2.45,4.5,z-u/2+.2]],[-1,0,0],[0,0,u,0,u,1,0,1]);
  K.tint=[.3,.35,.33];K.lquad(MB.roof,f,[[-2.6,H-.2,z-u/2],[-2.6,H-.2,z+u/2],[0,H+.3,z+u/2],[0,H+.3,z-u/2]],[0,1,0]);
  K.tint=[.95,.95,.92];K.box(f,-2.45,3.05,z,.06,.5,u-.3,M.railBar);
  if(h(i+20)<.5){K.tint=t.map(v=>v*.85);K.box(f,d*.6,H+1.6,z,.8,2.2,.8,M.plain);}}
 K.tint=ct48GcPick([[.42,.45,.47],[.6,.2,.18],[.75,.75,.72]],h(40));K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,H,-d/2,len,d,2.2,MB.roof,M.plain,.2);K.tint=[1,1,1];
}
// Heritage grandstand: Victoria Park's 1880s stand with a pitched iron roof, timber posts
// and a central gable.
function ct50Heritage(K,W,f,len,MB,M){
 const depth=14,H=7.5;ct48Plinth(K,W,f,depth,len,MB);K.begin(f);K.tint=[1,1,1];
 K.lquad(MB.seats.green,f,[[.6,1.2,-len/2],[depth-2,H-1,-len/2],[depth-2,H-1,len/2],[.6,1.2,len/2]],[-1,1,0],[0,0,0,depth,len,depth,len,0]);
 K.tint=[.93,.88,.78];K.box(f,.3,.6,0,.6,1.2,len,M.plain);K.box(f,depth-1,(H+2)/2,0,2,H+2,len,{side:M.punched,top:null});for(const s of [-1,1])K.box(f,depth/2,(H+2)/2,s*len/2,depth,H+2,.4,M.plain);
 K.tint=[.9,.9,.86];for(let z=-len/2+2;z<=len/2-2;z+=4)K.box(f,.6,(H+3)/2,z,.2,H+3,.2,M.metal);
 K.tint=[.62,.2,.18];K.lquad(MB.roof,f,[[-.6,H+3,-len/2-.6],[depth+.4,H+5.5,-len/2-.6],[depth+.4,H+5.5,len/2+.6],[-.6,H+3,len/2+.6]],[0,1,0]);K.lquad(MB.underside,f,[[-.6,H+2.95,len/2+.6],[depth+.4,H+5.45,len/2+.6],[depth+.4,H+5.45,-len/2-.6],[-.6,H+2.95,-len/2-.6]],[0,-1,0]);
 K.tint=[.95,.95,.92];K.lquad(M.railBar,f,[[-.62,H+2.2,-len/2],[-.62,H+2.2,len/2],[-.62,H+3,len/2],[-.62,H+3,-len/2]],[-1,0,0],[0,0,len,0,len,.8,0,.8]);
 K.tint=[.62,.2,.18];K.gable(f,depth/2,H+5,0,depth+1,8,3,MB.roof,M.plain,.3);K.tint=[1,1,1];
 W.signPlane(W.sign('VICTORIA PARK','#1d3b2a',1024,128),8,1.1,new THREE.Vector3(...K.at(f,-.65,H+5.2,0)),Math.atan2(-f.ax.x,-f.ax.z));
 ct48Reserve(W,f,depth+2,len+4,H+8,'heritage grandstand');W.ct48GcLots.push({x:f.x+f.ax.x*depth/2,z:f.z+f.ax.z*depth/2,ax:f.ax,az:f.az,w:depth+2,d:len+4,stand:true});
}
// Office block: banded windows over a glazed ground floor, a sun-shade grid on one face.
function ct50Office(K,W,f,w,d,H,seed,M){
 const h=k=>ct48Hash(seed,k),plan=ct48GcCCW(ct48GcPlan(h(1)<.6?'rect':'chamfer',w,d,seed));K.tint=[1,1,1];K.prism(M.shop,f,plan,0,4.2,null,null);
 K.tint=ct48GcPick(CT48_GC_TINT.render,h(2));K.prism(h(3)<.5?M.punched:M.glass,f,plan,4.2,H,null,null);
 if(h(4)<.6){K.tint=ct48GcPick(CT48_GC_TINT.render,h(5));for(let y=7.6;y<H-1;y+=3.4)K.box(f,-w/2-.4,y,0,.8,.18,d*.96,M.plain);}
 ct48GcCrown(K,f,plan,H,seed,M,ct48GcPick(['plain','frame','plain'],h(6)));
}
// Pick a building for a lot by the city's mix and the lot's distance from the track.
// Houses and warehouses run the Bathurst clearance test (track, pit, reserved spots); far-off
// city lots have already passed ct50FarClear, so skip it there.
const ct50ClearBase=ct48Clear;
ct48Clear=function(W,...a){return W.ct50Far?true:ct50ClearBase(W,...a);};
function ct50FarClear(W,f,w,d){
 const bz=ct48GcBeachZ(W),half=(W.span+2400)/2-60;
 for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const x=f.x+f.ax.x*a*(w/2+1)+f.az.x*b*(d/2+1),z=f.z+f.ax.z*a*(w/2+1)+f.az.z*b*(d/2+1);if(z<bz+24||Math.abs(x)>half||Math.abs(z)>half)return false;}
 return true;
}
function ct50Lot(K,W,f,w,d,seed,M,MB,people,near,zone){
 const C=ct50C(W),h=k=>ct48Hash(seed,k);(W.ct48GcLots||=[]).push({x:f.x,z:f.z,ax:f.ax,az:f.az,w,d});K.begin(f);f.y=0;K.tint=[1,1,1];
 const st=W.ct48GcStats.types||(W.ct48GcStats.types={}),r=h(90),tall=(lo,hi)=>lo+(hi-lo)*Math.pow(h(91),1.4);let type;
 if(zone==='cbd'){const H=tall(...C.cbd.H);type=r<.45?'glass':r<.75?'office':r<.9?'render':'balcony';
  if(type==='glass')ct48GcGlassTower(K,W,f,w,d,H,seed,M);else if(type==='office')ct50Office(K,W,f,w,d,H,seed,M);else if(type==='render')ct48GcRenderBlock(K,W,f,w,d,Math.round(H*.5/3)*3+4.5,seed,M,people,false);else ct48GcBalconyTower(K,W,f,w,d,H*.8,seed,M,people,false);}
 else{let acc=0;type=C.suburb.mix.find(([,p])=>(acc+=p)>r)?.[0]||'house';
  if(type==='house'){const g={...f,x:f.x-f.ax.x*(d/2),z:f.z-f.ax.z*(d/2)};K.tint=[1,1,1];if(!ct48House(K,W,g,C.suburb.houses[Math.floor(h(5)*C.suburb.houses.length)],seed,MB))type='none';}
  else if(type==='terrace')ct50Terraces(K,W,{...f,x:f.x-f.ax.x*5.5,z:f.z-f.ax.z*5.5},Math.min(d,40),M,MB,seed);
  else if(type==='shops')ct48GcShops(K,W,f,w,d,seed,M);
  else if(type==='motel')ct48GcMotel(K,W,f,w,d,seed,M);
  else if(type==='render')ct48GcRenderBlock(K,W,f,w,d,Math.round(tall(...C.suburb.H)/3)*3+4.5,seed,M,people,near);
  else if(type==='office')ct50Office(K,W,f,w,d,tall(...C.suburb.H),seed,M);
  else if(type==='warehouse'){const g={...f,x:f.x-f.ax.x*(d/2+6),z:f.z-f.ax.z*(d/2+6),ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}};if(!ct49Warehouse(K,W,g,Math.min(d,60),Math.min(w,40),MB,seed))type='none';}}
 st[type]=(st[type]||0)+1;K.tint=[1,1,1];
}

// Castle Hill: a granite monolith, steep pink-orange faces, scrub in the gullies.
function ct50CastleHill(W){
 const P=ct50Prep(W),cx=W.bounds.minX-1250,cz=W.bounds.minZ-650,N=72,R=720,p=[],col=[],ix=[];
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=(i/N-.5)*2,v=(j/N-.5)*2,x=cx+u*R*1.25,z=cz+v*R*.8,r=Math.hypot(u,v);
  const ridge=Math.max(0,1-r)**.7,rock=ct48Fbm(x/90,z/90,81)*.18+ct48Fbm(x/30,z/30,83)*.05,h=286*ridge*(.85+rock)+(r<1?ct48Fbm(x/200,z/200,85)*12:0)-3;p.push(x,Math.max(-3,h),z);
  const steep=ridge>.15&&ridge<.8,green=clamp(.5+ct48Fbm(x/70,z/70,87)*1.4-(steep?.35:0),0,1);col.push(.78+(.42-.78)*green,.56+(.5-.56)*green,.44+(.3-.44)*green);}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;ix.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ix);ct48Upright(g);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}));m.name='Castle Hill';W.world.add(m);
}
// Horizon: a ring of low country with the named ranges, from the edge of the map to 8.6 km.
function ct50Horizon(W){
 const C=ct50C(W),H=C.horizon,P=ct50Prep(W),size=W.span+2400,R0=size*.49,R1=8600,A=160,RR=[0,.05,.12,.25,.45,.7,1],p=[],col=[],ix=[],far=W.e.key==='adelaide'?[.42,.47,.40]:[.40,.47,.36];
 for(let a=0;a<=A;a++){const t=a/A*Math.PI*2;for(const f of RR){const r=R0+(R1-R0)*f;let h=f===0?-2:H.base*ct48Smooth(f/.25)*(.6+.4*ct48Fbm(Math.cos(t)*3+f*4,Math.sin(t)*3,61));
  for(const g of H.ranges){let da=Math.abs(t-((g.a%(Math.PI*2))+Math.PI*2)%(Math.PI*2));da=Math.min(da,Math.PI*2-da);h+=g.h*Math.exp(-((da/g.w)**2))*Math.exp(-(((r-g.r)/2200)**2))*(.75+.25*ct48Fbm(t*9,r/900,63));}
  p.push(P.cx+Math.cos(t)*r,h,P.cz+Math.sin(t)*r);const k=.85+.15*ct48Fbm(t*12,f*6,65);col.push(far[0]*k,far[1]*k,far[2]*k);}}
 const M=RR.length;for(let a=0;a<A;a++)for(let k=0;k<M-1;k++){const i=a*M+k,j=i+M;ix.push(i,i+1,j,i+1,j+1,j);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ix);ct48Upright(g);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));m.name='Horizon ranges';W.world.add(m);
}
function ct50Prep(W){if(W.ct50P)return W.ct50P;let cx=0,cz=0;for(const s of W.samples){cx+=s.p.x;cz+=s.p.z;}cx/=W.N;cz/=W.N;let R=0;for(const s of W.samples)R=Math.max(R,Math.hypot(s.p.x-cx,s.p.z-cz));return W.ct50P={cx,cz,R};}
// Big parkland gums for Adelaide (the Bathurst atlas), lit evenly from both sides.
function ct50Gums(W,list){
 if(!list.length)return;const T=THREE,tex=ct48TreeAtlas(W).tree,mat=ct49Foliage(new T.MeshStandardMaterial({map:tex,color:'#a9b29a',alphaTest:.45,side:T.DoubleSide,roughness:.95})),d=new T.Object3D(),c=new T.Color(),rows=[[],[],[],[]];
 list.forEach(([x,z,h])=>rows[Math.floor(ct48Hash(x,z,3)*4)].push([x,z,h]));
 rows.forEach((items,v)=>{if(!items.length)return;const m=new T.InstancedMesh(ct48Billboard(v/4+.002,(v+1)/4-.002),mat,items.length);m.name='Parkland gums '+v;
  items.forEach(([x,z,h],i)=>{const r=ct48Hash(z,x,5);d.position.set(x,-.05,z);d.rotation.set(0,r*Math.PI,0);d.scale.set(h*(.7+r*.25),h,h*(.7+r*.25));d.updateMatrix();m.setMatrixAt(i,d.matrix);const s=.82+ct48Hash(x,z,7)*.3;m.setColorAt(i,c.setRGB(s,s,s*.96));});
  m.computeBoundingSphere();W.world.add(m);});
}

function ct50BuildCity(W){
 const C=ct50C(W),K=new CT48GcKit(W),M=ct48GcMaterials(W),MB=ct48Materials(W),people=[],palms=[],walls=ct48GcWalls(W),streets=walls.streets,P=ct50Prep(W);
 W.ct48GcStats={...(W.ct48GcStats||{})};W.ct48GcLots=[];W.ct48GcSigns=[];W.ct48GcPalmSpots=[];W.ct48Garden=[];
 // Pit building and the timing stands on the pit wall.
 K.tint=[1,1,1];K.begin({x:W.pit?.samples?.[120]?.p.x||0,z:W.pit?.samples?.[120]?.p.z||0});W.ct48PitOpts=C.pit;ct48PitComplex(K,W,MB);ct48GcPitWall(K,W,MB);
 // Grandstands behind the walls (0: the side away from the pits).
 const pitSide=W.pit?.side||-1;
 for(const [ph,s,len,seat,brand] of C.stands){const side=s||-pitSide,i=Math.floor(W.at(ph).t*W.N)%W.N,L=walls.lane[side][i],f=ct48Find(W,ph,side,L+3.5,19,len+4,L+2,6,5);
  if(f){K.begin(f);ct48Grandstand(K,W,f,len,MB,MB.seats[seat],brand);W.ct48GcLots.push({x:f.x+f.ax.x*9.5,z:f.z+f.ax.z*9.5,ax:f.ax,az:f.az,w:21,d:len+6,stand:true});W.ct48GcStats.stands=(W.ct48GcStats.stands||0)+1;}}
 if(C.heritage){for(const ph of [.5,.45,.55,.3,.7]){const i=Math.floor(W.at(ph).t*W.N)%W.N;let done=false;for(const side of [-1,1]){const L=walls.lane[side][i],f=ct48Find(W,ph,side,L+6,16,64,L+4,6,6);if(f){ct50Heritage(K,W,f,58,MB,M);done=true;break;}}if(done)break;}}
 // City grid aligned with the longest street.
 const main=streets.reduce((a,b)=>b.l>a.l?b:a),ax={x:main.nx,z:main.nz},az={x:main.vx,z:main.vz},Bz={x:ax.z,z:-ax.x},cx=P.cx,cz=P.cz,R=(W.span+2400)/2-80;
 W.ct48GcGrid={cx,cz,ax,az,su:56,sv:52};W.ct48GcGridU?.value.set(cx,cz,ax.x,ax.z);
 const blockAt=(bi,bj,lu,lv)=>({x:cx+ax.x*(bi*56+lu)+Bz.x*(bj*52+lv),z:cz+ax.z*(bi*56+lu)+Bz.z*(bj*52+lv)});
 const cbdDir={x:Math.cos(C.cbd.a),z:Math.sin(C.cbd.a)},zoneOf=(x,z,dist)=>{const along=(x-cx)*cbdDir.x+(z-cz)*cbdDir.z,lat=Math.abs(-(x-cx)*cbdDir.z+(z-cz)*cbdDir.x);
  if(ct48Inside(W,x,z)||dist<C.park.r)return 'park';if(along>P.R+C.cbd.from-200&&lat<650)return along>P.R+C.cbd.from?'cbd':'edge';return 'suburb';};
 const nb=Math.ceil(R/52),trees=[],gums=[],cars=[],B=ct48GcBlockMap(W);let seed=101;
 for(let bi=-nb;bi<=nb;bi++)for(let bj=-nb;bj<=nb;bj++){const c=blockAt(bi,bj,0,0);if(Math.abs(c.x)>R||Math.abs(c.z)>R)continue;const dist=W.nearest(c).distance,zone=zoneOf(c.x,c.z,dist),h=k=>ct48Hash(bi*7+k,bj*13-k,9);
  if(zone==='park'){ct50Park(W,bi,bj,true);
   // Parkland: scattered big trees with open lawns between, none inside the walls.
   const clump=ct48Hash(Math.floor(bi/2),Math.floor(bj/2),31),n=Math.round((clump<.5?h(1)*2.4:clump<.8?3+h(1)*4:7+h(1)*7)*C.park.trees);for(let k=0;k<n;k++){const q=blockAt(bi,bj,(h(k+20)-.5)*54,(h(k+40)-.5)*50);if(ct48GcInside(W,q.x,q.z,3)||W.nearest(q).distance<CT48_GC.lane+5||(W.pit?.samples&&(W.pitDistance(q.x,q.z)<16||ct48PitFloor(W,q.x,q.z,6)!==null))||(W.ct48Reserved||[]).some(o=>Math.hypot(o.x-q.x,o.z-q.z)<o.r+3)||W.ct48GcLots.some(o=>Math.abs((q.x-o.x)*o.ax.x+(q.z-o.z)*o.ax.z)<o.w/2+3&&Math.abs((q.x-o.x)*o.az.x+(q.z-o.z)*o.az.z)<o.d/2+3))continue;
    if(C.trees==='gum')gums.push([q.x,q.z,10+h(k+60)**1.5*22]);else if(h(k+70)<C.palms)palms.push([q.x,0,q.z]);else trees.push([q.x,q.z,9+h(k+60)*7]);}
   continue;}
  ct50Park(W,bi,bj,false);
  // Built blocks: two to four lots around the block, footpath trees.
  const cbd=zone==='cbd';if(cbd&&h(2)>C.cbd.keep)continue;
  // Blocks well clear of the circuit only need the city-edge test: lots never cross a street, so
  // checking them against every other lot (and the track, pit and stands) is wasted work there.
  const far=dist>240,l0=W.ct48GcLots.length;
  const lots=cbd?[[0,0,34,40]]:[[-13,-12,22,22],[13,-12,22,22],[-13,12,22,22],[13,12,22,22]];
  for(const [lu,lv,w0,d0] of lots){const w=w0*(.8+h(lu+lv+3)*.2),d=d0*(.8+h(lu-lv+4)*.2),q=blockAt(bi,bj,lu,lv),f={x:q.x,y:0,z:q.z,ax:lu<0||cbd?{x:-ax.x,z:-ax.z}:ax,az:lu<0||cbd?{x:-az.x,z:-az.z}:az};
   if(!cbd&&h(lu*3+lv)<(C.vacant||.12))continue;if(far?ct50FarClear(W,f,w,d):ct48GcLotClear(W,f,w,d,2)){W.ct50Far=far;try{ct50Lot(K,W,f,w,d,seed++,M,MB,people,dist<160,cbd?'cbd':'suburb');}finally{W.ct50Far=false;}}}
  if(dist<700)for(const [su,sv,len] of [[1,0,52],[-1,0,52],[0,1,56],[0,-1,56]])for(let t=-len/2+5;t<len/2-4;t+=11+h(len+t)*5){if(h(t*3+su+sv*2)>.55)continue;const lu=su?su*24.6:t,lv=sv?sv*22.6:t,q=blockAt(bi,bj,lu,lv);
   if(!far&&(ct48GcInside(W,q.x,q.z,2)||W.nearest(q).distance<CT48_GC.lane+4)||(far?W.ct48GcLots.slice(l0):W.ct48GcLots).some(o=>Math.abs((q.x-o.x)*o.ax.x+(q.z-o.z)*o.ax.z)<o.w/2+2&&Math.abs((q.x-o.x)*o.az.x+(q.z-o.z)*o.az.z)<o.d/2+2))continue;
   if(h(t+5)<C.palms)palms.push([q.x,0,q.z]);else if(C.trees==='gum')gums.push([q.x,q.z,9+h(t+7)*5]);else trees.push([q.x,q.z,8+h(t+7)*5]);}}
 for(const [x,z,k] of W.ct48Garden)if(k==='tree')(C.trees==='gum'?gums.push([x,z,7+ct48Hash(x,z)*5]):trees.push([x,z,7+ct48Hash(x,z)*4]));
 K.flush(W.e.name+' city');
 ct48GcPalms(W,palms);ct48GcTrees(W,trees);ct50Gums(W,gums);ct48GcPeopleMeshes(W,people,W.e.name+' spectators');
 W.ct48GcStats.trees=trees.length+gums.length;W.ct48GcStats.palms=palms.length;W.ct48GcStats.buildings=W.ct48GcLots.filter(o=>!o.stand).length;
 for(const s of W.ct48GcSigns.slice(0,10)){const tex=W.sign(s.text,'#123247',1024,128),p=K.at(s.f,s.x,s.y,0);W.signPlane(tex,s.w,s.w/8,new THREE.Vector3(...p),Math.atan2(-s.f.ax.x,-s.f.ax.z));if(s.pole){const q=K.at(s.f,s.x,0,0),pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,s.y,6),MB.steel);pole.position.set(q[0],s.y/2-.4,q[2]);W.world.add(pole);}}
 if(C.castleHill)ct50CastleHill(W);ct50Horizon(W);
}
const ct50BuildBase=ct48BuildGoldCoast;
ct48BuildGoldCoast=function(W){return ct50C(W)?ct50BuildCity(W):ct50BuildBase(W);};

// ---------- Hooks ----------
// Gold Coast's motel signs and hotel names are beach names; these cities get their own.
const ct50Names=CT48_GC_NAMES.slice();
const ct50MakeTrack=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){
 const C=ct50C(this);if(C){CT48_GC_NAMES.length=0;CT48_GC_NAMES.push(...(this.e.key==='adelaide'?['THE KENT','EAST END SUITES','RUNDLE','TORRENS','VICTORIA','PARKSIDE','THE TERRACE','FREEMASONS','HUTT','PULTENEY']:['STRAND','FLINDERS','CASTLE HILL','REEF','PALMER','ROSS RIVER','TROPICANA','MAGNETIC','HERVEY','SOUTHBANK']));}
 else if(CT48_GC_NAMES[0]!==ct50Names[0]){CT48_GC_NAMES.length=0;CT48_GC_NAMES.push(...ct50Names);}
 ct50MakeTrack.call(this);if(!C)return;
 this.world.traverse(o=>{if(o.isMesh&&o.name==='City ground')o.material=ct50GroundMaterial(this);});
};
const ct50Scenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 const out=ct50Scenery.call(this);if(!ct50C(this))return out;
 // The old cone standing in for Castle Hill.
 const old=[];this.world.traverse(o=>{if(o.isMesh&&o.geometry?.type==='ConeGeometry'&&o.geometry.parameters?.radius>=300)old.push(o);});for(const o of old){o.removeFromParent();o.geometry.dispose();}
 // The start gantry stands 9 m past the line with legs 11 m out; at Reid Park the track jogs
 // there and one leg landed on the racing line. Slide it along until both legs are off the road.
 const metres=this.e.lengthKm*1000;this.world.traverse(o=>{if(o.isGroup&&!o.ct50Moved&&o.children.length===4&&o.children[0].geometry?.parameters?.height===10&&o.children[0].geometry.parameters.width===.45){o.ct50Moved=true;
  for(const d of [9,4,0,-5,-10,-15,-20,-25,-30,14,20]){const a=this.at(((d/metres)%1+1)%1);o.position.copy(a.p);o.rotation.y=Math.atan2(a.v.x,a.v.z);o.updateMatrixWorld(true);
   if([-11,11].every(x=>this.nearest(o.localToWorld(new THREE.Vector3(x,0,0))).distance>9))break;}}});
 return out;
};
// Reid Park's pit lane: the stock lane started 210 m back, before the hairpin onto the main
// straight, so its offset wrapped round the hairpin and folded across the track. The real pit
// lane runs down the main straight only, so it now branches off just before the start line.
function ct50ReidPit(W,raw){
 const N=W.N,metres=W.e.lengthKm*1000,ia=N-Math.round(18/metres*N),ib=Math.round(340/metres*N),a0=ia/N,a1=1+ib/N,off=27,out=[];
 for(let j=0;j<raw.length;j++){const f=j/(raw.length-1),arc=a0+(a1-a0)*f,a=(arc%1)*N,i=Math.min(N-1,Math.floor(a)),s=W.samples[i],p=s.p.clone().lerp(W.samples[(i+1)%N].p,a-i),fade=dc32Smooth(f/.23)*dc32Smooth((1-f)/.23);p.addScaledVector(s.n,W.pit.side*off*fade);out.push(p);}
 out[0]=W.samples[ia].p.clone();out[out.length-1]=W.samples[ib].p.clone();W.pit.start=W.times[ia];W.pit.offset=off;return out;
}
const ct50MakePit=SC25World.prototype.makePit;
SC25World.prototype.makePit=function(){
 if(this.e.key!=='townsville')return ct50MakePit.call(this);
 const W=this,Curve=THREE.CatmullRomCurve3;THREE.CatmullRomCurve3=class extends Curve{constructor(p,...a){super(p?.length===121&&W.pit&&!W.pit.samples?ct50ReidPit(W,p):p,...a);}};
 try{return ct50MakePit.call(this);}finally{THREE.CatmullRomCurve3=Curve;}
};
