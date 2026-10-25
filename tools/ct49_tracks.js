
/* CT49: Queensland Raceway, Sydney Motorsport Park, The Bend and Taupo, built with the Bathurst
   system (ct48). Each circuit gets terrain shaped like the real place (flat paddocks, rolling
   pasture), ground colours from a regional palette laid out as farm paddocks, a horizon of hills,
   bush of the right kind (gums, mallee scrub, pine plantations), and a small set of real-looking
   buildings: the pit complex over the garages, roofed grandstands, venue sheds placed on the
   OpenStreetMap footprints, farmsteads, and an industrial estate and suburb at Sydney. */
const CT49={
 ipswich:{
  pit:{name:'QUEENSLAND RACEWAY',floors:1,signColour:'#7a1f24'},
  relief:{amp:2.2,scale:420,fine:.35,far:22,farFrom:900},
  palette:{verge:'#8e8c58',rough:'#9d9463',bare:'#a88e6e',far:'#8a8b66',fields:['#ada26f','#a19e66','#b5a675','#9d9a63','#a8966c'],bareAmt:.5},
  fields:{w:260,h:190,angle:.32},
  horizon:{base:22,ranges:[{a:3.6,w:.7,h:140,r:6500},{a:5.2,w:.35,h:90,r:5200}]},
  stands:2,mounds:3,campers:260,farms:9,venue:true,
  forest:{gum:{n:60000,dens:(c)=>.012+(c.edge<7&&c.belt?.9:0)+ct48Smooth((c.clump-.28)/.2)*.6+ct48Smooth((c.d-800)/700)*.4,h:[10,24]},shrub:{n:9000,dens:(c)=>.18+ct48Smooth((c.clump-.1)/.3)*.4,h:[.9,2.2]}},
 },
 sydney:{
  pit:{name:'SYDNEY MOTORSPORT PARK',floors:2,signColour:'#0e2f57'},
  relief:{amp:5.5,scale:380,fine:.5,far:45,farFrom:800},
  palette:{verge:'#7a7f4e',rough:'#8c8a5a',bare:'#9e8a6a',far:'#7f8058',fields:['#8c8a5a'],bareAmt:.4},
  fields:null,
  horizon:{base:35,ranges:[{a:3.3,w:.9,h:320,r:7200},{a:2.2,w:.5,h:110,r:5600}]},
  stands:3,mounds:2,campers:0,farms:0,venue:true,lights:true,
  industrial:{a:.6,dist:330,cols:4,rows:3},suburb:{a:3.9,dist:420,cols:8,rows:5,types:['brick','modern','brick','modern','federation']},
  forest:{gum:{n:52000,dens:(c)=>.03+ct48Smooth((c.clump-.12)/.22)*.75+ct48Smooth((c.d-900)/600)*.35,h:[11,26]},shrub:{n:12000,dens:(c)=>.25+ct48Smooth((c.clump-.05)/.3)*.5,h:[1,2.4]}},
 },
 bend:{
  pit:{name:'THE BEND MOTORSPORT PARK',floors:2,signColour:'#1d1d1f',hotel:true},
  relief:{amp:1.1,scale:520,fine:.25,far:6,farFrom:1000},
  palette:{verge:'#a0996a',rough:'#b3a177',bare:'#bf9f7a',far:'#a49773',fields:['#c2ad7c','#b7a072','#c8b483','#ae9a6e','#bba579'],bareAmt:.7},
  fields:{w:340,h:240,angle:-.18},
  horizon:{base:5,ranges:[]},
  stands:2,mounds:2,campers:420,farms:10,venue:true,
  forest:{mallee:{n:110000,dens:(c)=>.05+ct48Smooth((c.clump-.1)/.2)*.75+(c.edge<6&&c.belt?.5:0)+ct48Smooth((c.d-900)/600)*.3,h:[4,8.5]},gum:{n:40000,dens:(c)=>.008+(c.edge<7&&c.belt?.9:0),h:[9,17]},shrub:{n:16000,dens:(c)=>.35+ct48Smooth((c.clump+.1)/.3)*.4,h:[.6,1.4],tint:'#b9b9a1'}},
 },
 taupo:{
  pit:{name:'TAUPŌ INTERNATIONAL MOTORSPORT PARK',floors:1,signColour:'#123a2c'},
  relief:{amp:9,scale:340,fine:.7,far:70,farFrom:700},
  palette:{verge:'#6c8146',rough:'#74854d',bare:'#948b62',far:'#5c7044',pine:'#4a4a33',fields:['#6f8a47','#66843f','#7d9150','#8a8d58','#6b8845'],bareAmt:.2},
  fields:{w:230,h:170,angle:.6},pines:{thr:.12,minD:150},
  horizon:{base:70,ranges:[{a:.55,w:.22,h:900,r:7000},{a:1.4,w:.8,h:260,r:6200},{a:4.4,w:.9,h:200,r:6800}]},
  stands:2,mounds:4,campers:0,farms:6,venue:true,
  forest:{pine:{n:0,h:[18,30]},gum:{n:40000,dens:(c)=>.01+(c.edge<6&&c.belt?.7:0)+ct48Smooth((c.clump-.25)/.2)*.5,h:[9,18],tint:'#9fb08f'},shrub:{n:9000,dens:(c)=>.2,h:[.8,2]}},
 },
};
function ct49C(W){return CT49[W?.e?.key]||null;}

// ---------- Shared prep: centre, corners (stands and spectator mounds), field grid ----------
function ct49Prep(W){
 if(W.ct49P)return W.ct49P;const C=ct49C(W),S=W.samples,N=W.N;let cx=0,cz=0;for(const s of S){cx+=s.p.x;cz+=s.p.z;}cx/=N;cz/=N;let R=0;for(const s of S)R=Math.max(R,Math.hypot(s.p.x-cx,s.p.z-cz));
 // Corners: sharpest turns, spread out, away from the pit straight.
 const turn=[];for(let i=0;i<N;i+=4)turn.push([i,Math.abs(ct48Turn(W,i))]);turn.sort((a,b)=>b[1]-a[1]);
 const corners=[];for(const [i] of turn){const ph=W.times[i];if(corners.some(c=>Math.min(Math.abs(c.ph-ph),1-Math.abs(c.ph-ph))<.07))continue;if(ph<.06||ph>.94)continue;
  const s=S[i],ahead=S[(i+18)%N].p,side=[-1,1].sort((a,b)=>{const pa=s.p.clone().addScaledVector(s.n,a*40),pb=s.p.clone().addScaledVector(s.n,b*40);return pb.distanceTo(ahead)-pa.distanceTo(ahead);})[0];
  corners.push({i,ph,side});if(corners.length>=8)break;}
 // Spectator banks outside the corners that do not get a grandstand.
 const mounds=[];corners.slice(C.stands,C.stands+C.mounds).forEach(c=>{for(let k=-10;k<=10;k+=2){const s=S[(c.i+k+N)%N],L=40+Math.abs(k)*.4;mounds.push({x:s.p.x+s.n.x*c.side*L,z:s.p.z+s.n.z*c.side*L,r:26,h:3.2});}});
 return W.ct49P={cx,cz,R,corners,mounds};
}
function ct49Field(W,x,z){
 const F=ct49C(W).fields;if(!F)return null;const co=Math.cos(F.angle),si=Math.sin(F.angle),wx=x+ct48Fbm(x/300,z/300,41)*28,wz=z+ct48Fbm(x/300,z/300,43)*28,u=(wx*co-wz*si)/F.w,v=(wx*si+wz*co)/F.h,iu=Math.floor(u),iv=Math.floor(v);
 const edge=Math.min(u-iu,1-(u-iu))*F.w,edge2=Math.min(v-iv,1-(v-iv))*F.h;return{id:ct48Hash(iu,iv,47),edge:Math.min(edge,edge2),belt:ct48Hash(iu+(edge<edge2?.5:0),iv+(edge<edge2?0:.5),49)<.45};
}
function ct49PineZone(W,x,z,d){const P=ct49C(W)?.pines;return !!P&&d>P.minD&&ct48Fbm(x/520,z/520,51)>P.thr;}

// ---------- Terrain ----------
function ct49Height(W,x,z,n=W.nearest({x,z})){
 const C=ct49C(W),P=ct49Prep(W),d=n.distance,S=W.samples,r=C.relief;let sw=0,sh=0;
 for(let i=0;i<W.N;i+=7){const p=S[i].p,dd=(p.x-x)**2+(p.z-z)**2,w=1/Math.pow(dd+2500,1.5);sw+=w;sh+=w*p.y;}
 let h=sh/sw;
 h+=ct48Fbm(x/r.scale,z/r.scale,21)*r.amp*ct48Smooth((d-30)/220);
 h+=ct48Fbm(x/70,z/70,23)*r.fine*ct48Smooth((d-18)/60);
 h+=ct48Smooth((d-r.farFrom)/900)*r.far*(.55+.45*ct48Fbm(x/700,z/700,25));
 for(const m of P.mounds){const q=((x-m.x)**2+(z-m.z)**2)/(m.r*m.r);if(q<1)h+=m.h*(1-q)*(1-q);}
 return n.y-.42+(h-(n.y-.42))*ct48Smooth((d-13)/62);
}
function ct49Lin(hex){const c=new THREE.Color(hex);return[c.r,c.g,c.b];}
function ct49Colour(W,x,y,z,steep,d){
 const C=ct49C(W),P=C.palette,L=W.ct49Lin||(W.ct49Lin={verge:ct49Lin(P.verge),rough:ct49Lin(P.rough),bare:ct49Lin(P.bare),far:ct49Lin(P.far),pine:P.pine?ct49Lin(P.pine):null,fields:P.fields.map(ct49Lin),base:ct49Lin(W.dc36Climate?.grass||'#8d8963')});
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);let c=mix(L.verge,L.rough,ct48Smooth((d-45)/120));
 const F=ct49Field(W,x,z);if(F&&d>130){const fc=L.fields[Math.floor(F.id*L.fields.length)];c=mix(c,fc,ct48Smooth((d-130)/90)*(F.edge<5?.45:1));}
 c=mix(c,L.far,ct48Smooth((d-1300)/700)*.6);
 if(L.pine&&ct49PineZone(W,x,z,d))c=mix(c,L.pine,.85);
 const bare=clamp((ct48Fbm(x/48,z/48,7)-.22)*2.4+steep*3,0,1)*P.bareAmt*ct48Smooth((d-20)/50);c=mix(c,L.bare,bare);
 const v=1+ct48Fbm(x/55,z/55,9)*.09;return c.map((q,i)=>q*v/L.base[i]);
}
function ct49Terrain(W){
 const N=256,size=W.span+2400,p=[],uv=[],colors=[],ix=[],dist=[];ct49Prep(W);
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=(i/N-.5)*size,z=(j/N-.5)*size,n=W.nearest({x,z});p.push(x,ct49Height(W,x,z,n),z);uv.push(i/N,j/N);dist.push(n.distance);}
 for(const s of W.samples)for(const lane of [-7.7,0,7.7]){const x=s.p.x+s.n.x*lane,z=s.p.z+s.n.z*lane,gx=clamp(Math.floor((x/size+.5)*N),0,N-1),gz=clamp(Math.floor((z/size+.5)*N),0,N-1);for(const k of [gz*(N+1)+gx,gz*(N+1)+gx+1,(gz+1)*(N+1)+gx,(gz+1)*(N+1)+gx+1])p[k*3+1]=Math.min(p[k*3+1],s.p.y-.55);}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;ix.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
 const nor=g.attributes.normal;for(let k=0;k<(N+1)*(N+1);k++)colors.push(...ct49Colour(W,p[k*3],p[k*3+1],p[k*3+2],1-nor.getY(k),dist[k]));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));W.sc26Terrain={positions:p,N,size,colors};return g;
}
const ct49CustomBase=ct48CustomTerrain;
ct48CustomTerrain=function(W){return ct49C(W)?ct49Terrain(W):ct49CustomBase(W);};
const ct49TerrainHeight=SC25World.prototype.terrainHeight;
SC25World.prototype.terrainHeight=function(x,z){
 if(!ct49C(this)||!this.samples)return ct49TerrainHeight.call(this,x,z);
 return this.sc26Terrain?.colors?gr26SceneryGround(this,x,z):ct49Height(this,x,z);
};

// Hills on the horizon: a ring from just inside the terrain edge out to 8.5 km, so the land
// never ends in a hard edge, with the named ranges and peaks rising out of it.
function ct49Horizon(W){
 const C=ct49C(W),H=C.horizon,P=ct49Prep(W),size=W.sc26Terrain.size,R0=size*.47,R1=8600,A=160,RR=[0,.04,.1,.2,.35,.5,.7,1],p=[],col=[],ix=[];
 const far=ct49Lin(C.palette.far),edge=gr26SceneryGround(W,P.cx+R0,P.cz);
 for(let a=0;a<=A;a++){const t=a/A*Math.PI*2;for(const f of RR){const r=R0+(R1-R0)*f,x=P.cx+Math.cos(t)*r,z=P.cz+Math.sin(t)*r;
  let h=H.base*ct48Smooth(f/.2)*(.6+.4*ct48Fbm(Math.cos(t)*3+f*4,Math.sin(t)*3,61));
  for(const g of H.ranges){let da=Math.abs(t-g.a);da=Math.min(da,Math.PI*2-da);h+=g.h*Math.exp(-((da/g.w)**2))*Math.exp(-(((r-g.r)/2200)**2))*(.75+.25*ct48Fbm(t*9,r/900,63));}
  const rim=gr26SceneryGround(W,clamp(x,-size/2+1,size/2-1),clamp(z,-size/2+1,size/2-1))-1.5,y=f===0?rim-3:rim+(edge-2+h-rim)*ct48Smooth(f/.3);p.push(x,y,z);
  const k=.8+.2*ct48Fbm(t*12,f*6,65);col.push(far[0]*k,far[1]*k,far[2]*k);}}
 const M=RR.length;for(let a=0;a<A;a++)for(let k=0;k<M-1;k++){const i=a*M+k,j=i+M;ix.push(i,i+1,j,i+1,j+1,j);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(ix);ct48Upright(g);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));m.name='Horizon hills';m.receiveShadow=false;W.world.add(m);
}

// ---------- Buildings ----------
function ct49Cone(K,f,cx,cy,cz,r,h,m,seg=12){for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,mid=(a+b)/2;K.tri(m,f,[[cx+Math.cos(a)*r,cy,cz+Math.sin(a)*r],[cx+Math.cos(b)*r,cy,cz+Math.sin(b)*r],[cx,cy+h,cz]],[Math.cos(mid),.6,Math.sin(mid)]);}}
function ct49Axis(ang){return{ax:{x:Math.cos(ang),z:Math.sin(ang)},az:{x:-Math.sin(ang),z:Math.cos(ang)}};}
// The Bend's pit-lane hotel: five floors of rooms with balconies over the pit exit end.
function ct49Hotel(K,W,M){
 const P=W.ct48PitSpan,pit=W.pit;if(!P)return;const len=46,fb=P.from-21/pit.length,fa=fb-len/pit.length;if(fa<.03)return;const {f}=P.frameAt(fa,fb),floors=5,fh=3.3,w=15;
 if(!ct48Clear(W,{...f,x:f.x+f.ax.x*9,z:f.z+f.ax.z*9},w,len,9,0)){W.ct49HotelBlocked=true;return;}const g=ct48Ground(W,{...f,x:f.x+f.ax.x*16,z:f.z+f.ax.z*16},w,len),b0=g.lo-f.y-.3,top=floors*fh+1.2;
 K.box(f,16.5,(b0+1.2)/2,0,w,1.2-b0,len,{side:M.concrete,top:M.concrete});
 K.box(f,16.5,1.2+floors*fh/2,0,w,floors*fh,len,{front:M.glass,back:M.ribbon,left:M.render.white,right:M.render.white,top:M.concrete,bottom:M.underside});
 for(let l=1;l<=floors;l++){const y=1.2+l*fh-fh+.05;K.box(f,8.3,y,0,1.6,.2,len,{side:M.white,bottom:M.white});K.lquad(M.rail,f,[[7.52,y+.1,-len/2],[7.52,y+.1,len/2],[7.52,y+1.1,len/2],[7.52,y+1.1,-len/2]],[-1,0,0]);}
 for(let z=-len/2+3;z<len/2;z+=6)K.box(f,8.6,1.2+floors*fh/2,z,1.1,floors*fh,.25,M.render.charcoal);
 K.box(f,16.5,1.2+floors*fh+.3,0,w+1.4,.6,len+1.4,{side:M.render.charcoal,top:M.roof});
 const q=K.at(f,7.4,1.2+floors*fh-.8,0);W.signPlane(W.sign('RYDGES PIT LANE HOTEL','#1d1d1f',1024,96),20,1.2,new THREE.Vector3(...q),Math.atan2(-f.ax.x,-f.ax.z));
 ct48Reserve(W,{...f,x:f.x+f.ax.x*8,z:f.z+f.ax.z*8},w+2,len+4,top+2,'hotel');
}
// Tilt-up concrete warehouse with an office at one end, roller doors and a truck apron.
function ct49Warehouse(K,W,f,w,d,M,seed){
 if(!ct48Clear(W,f,d+14,w+4,40,30))return false;ct48Plinth(K,W,f,d+12,w,M);const h=10+ct48Hash(seed,1)*3,roofs=['surfmist','windspray','surfmist','paperbark'];
 K.box(f,12+d/2,h/2,0,d,h,w,{side:M.concreteWarm,top:null});K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,h,-(12+d/2),w,d,1.4,M.colorbond[roofs[Math.floor(ct48Hash(seed,2)*4)]],M.concreteWarm,.4);
 for(let z=-w/2+8;z<w/2-12;z+=9)K.lquad(M.garageDoor,f,[[11.97,0,z-2.2],[11.97,0,z+2.2],[11.97,5.2,z+2.2],[11.97,5.2,z-2.2]],[-1,0,0],[0,0,1.8,0,1.8,2.2,0,2.2]);
 K.box(f,8,3.8,w/2-6,8,7.6,12,{front:M.glass,side:M.render.grey,top:M.concrete});K.box(f,12.8,h-1.6,0,.3,1.4,w*.4,{side:M.colorbond.deepocean});
 K.lquad(M.asphalt,f,[[-2,.04,-w/2],[12,.04,-w/2],[12,.04,w/2],[-2,.04,w/2]],[0,1,0]);ct48Reserve(W,{...f,x:f.x-f.ax.x*2,z:f.z-f.az.z*0},d+16,w+6,h+2,'warehouse');return true;
}
// Grain silos, a windmill and a tank: the farm skyline.
function ct49Silos(K,W,f,M,n=3){for(let i=0;i<n;i++){const z=(i-(n-1)/2)*8.5;K.cyl(f,4,7,z,3.8,14,M.colorbond.surfmist,14);ct49Cone(K,f,4,14,z,3.9,2.6,M.colorbond.surfmist,14);}K.box(f,4,8,(n/2)*8.5+1,.4,16,.4,M.steel);}
function ct49Windmill(K,W,f,M){for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]])K.lquad(M.steel,f,[[a*1.2,0,b*1.2-.05],[a*1.2,0,b*1.2+.05],[a*.2,9,b*.2+.05],[a*.2,9,b*.2-.05]],[a,0,0]);K.cyl({...f,ax:{x:-f.az.x,z:-f.az.z},az:f.ax},0,9.4,0,1.6,.15,M.white,14);K.box(f,0,9.4,-1.2,.1,.6,1.6,M.steel);}
function ct49Farm(K,W,f,M,seed,style){
 const types=style==='nz'?['queenslander','modern','queenslander']:['brick','queenslander','brick','modern'];if(!ct48Clear(W,f,60,70,60,30))return false;
 ct48House(K,W,{...f},types[Math.floor(ct48Hash(seed,3)*types.length)],seed,M);
 const s1={...f,x:f.x+f.ax.x*30+f.az.x*14,z:f.z+f.ax.z*30+f.az.z*14};ct48Shed(K,W,s1,seed+5,M);
 if(ct48Hash(seed,4)<.6){const s2={...f,x:f.x+f.ax.x*30-f.az.x*22,z:f.z+f.ax.z*30-f.az.z*22};s2.y=gr26SceneryGround(W,s2.x,s2.z);if(ct48Clear(W,s2,12,30,40,20)){ct49Silos(K,W,s2,M,2+Math.floor(ct48Hash(seed,5)*3));ct48Reserve(W,s2,10,28,18,'silo');}}
 if(style!=='nz'&&ct48Hash(seed,6)<.7){const s3={...f,x:f.x+f.ax.x*52,z:f.z+f.ax.z*52};s3.y=gr26SceneryGround(W,s3.x,s3.z);ct49Windmill(K,W,s3,M);K.cyl(s3,4,1.2,0,2.2,2.4,M.colorbond.surfmist,12);}
 return true;
}
// Venue buildings on the real OpenStreetMap footprints: workshops and halls, amenity blocks,
// kiosks and toilet blocks, each with doors, windows and a proper roof.
function ct49Venue(K,W,M){
 const list=W.data?.buildings||[],sc=W.scale||1;let n=0;
 for(const [x0,z0,w0,d0] of list){const w=Math.min(110,w0*sc),d=Math.min(110,d0*sc),cx=x0*sc,cz=z0*sc;if(w<5||d<5)continue;
  const long=w>=d,L=long?w:d,D=long?d:w,o=long?ct49Axis(Math.PI/2):ct49Axis(0),f={x:cx-o.ax.x*D/2,y:0,z:cz-o.ax.z*D/2,...o};if(!ct48Clear(W,f,D,L,18,12))continue;ct48Plinth(K,W,f,D,L,M);
  const seed=x0*7+z0,area=L*D;
  if(area>2500){const h=7+ct48Hash(seed,1)*3;K.box(f,D/2,h/2,0,D,h,L,{side:M.colorbond.windspray,top:null});K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,h,-D/2,L,D,1.6,M.colorbond.surfmist,M.colorbond.windspray,.4);for(let z=-L/2+6;z<L/2-4;z+=12)K.lquad(M.garageDoor,f,[[-.03,0,z-2.5],[-.03,0,z+2.5],[-.03,5,z+2.5],[-.03,5,z-2.5]],[-1,0,0],[0,0,2,0,2,2,0,2]);}
  else if(area>250){const h=3.6+(area>900?3.6:0),wall=ct48Hash(seed,2)<.5?M.brick.cream:M.render.sand;K.box(f,D/2,h/2,0,D,h,L,{side:wall,front:M.ribbon,top:M.concrete});K.lquad(M.colorbond.monument,f,[[-1.2,h+.2,-L/2-.6],[D+.6,h+.9,-L/2-.6],[D+.6,h+.9,L/2+.6],[-1.2,h+.2,L/2+.6]],[0,1,0]);K.lquad(M.underside,f,[[-1.2,h+.15,L/2+.6],[D+.6,h+.85,L/2+.6],[D+.6,h+.85,-L/2-.6],[-1.2,h+.15,-L/2-.6]],[0,-1,0]);for(let z=-L/2+3;z<L/2;z+=Math.max(6,L/4))K.lquad(M.door,f,[[-.04,0,z-.5],[-.04,0,z+.5],[-.04,2.2,z+.5],[-.04,2.2,z-.5]],[-1,0,0]);}
  else{K.box(f,D/2,1.5,0,D,3,L,{side:M.brick.blend,top:M.concrete});K.lquad(M.colorbond.woodland,f,[[-.5,3.1,-L/2-.4],[D+.4,3.6,-L/2-.4],[D+.4,3.6,L/2+.4],[-.5,3.1,L/2+.4]],[0,1,0]);K.lquad(M.door,f,[[-.04,0,-.5],[-.04,0,.5],[-.04,2.1,.5],[-.04,2.1,-.5]],[-1,0,0]);}
  ct48Reserve(W,f,D,L,8,'venue building');n++;}
 return n;
}
// A suburb: streets in a grid, houses facing them, street trees.
function ct49Suburb(K,W,M,S){
 const P=ct49Prep(W),o=ct49Axis(S.a),c={x:P.cx+Math.cos(S.a)*(P.R+S.dist),z:P.cz+Math.sin(S.a)*(P.R+S.dist)};let n=0;const lot=32,block=2*34+14;
 for(let r=0;r<S.rows;r++){const sx=(r-(S.rows-1)/2)*block;
  // Street along az through the middle of the block row.
  const street={x:c.x+o.ax.x*sx,y:0,z:c.z+o.ax.z*sx,ax:o.ax,az:o.az},len=S.cols*lot;street.y=gr26SceneryGround(W,street.x,street.z);
  if(W.nearest(street).distance>60){for(let k=0;k<6;k++){const z0=(k/6-.5)*len,z1=((k+1)/6-.5)*len,a={...street,x:street.x+o.az.x*(z0+z1)/2,z:street.z+o.az.z*(z0+z1)/2};a.y=gr26SceneryGround(W,a.x,a.z)+.05;K.lquad(M.asphalt,a,[[-4,0,(z0-z1)/2],[4,0,(z0-z1)/2],[4,0,(z1-z0)/2],[-4,0,(z1-z0)/2]],[0,1,0]);}
   (W.ct48Reserved||=[]).push(...Array.from({length:S.cols},(_,k)=>({x:street.x+o.az.x*((k+.5)/S.cols-.5)*len,z:street.z+o.az.z*((k+.5)/S.cols-.5)*len,r:4})));}
  for(const side of [-1,1])for(let k=0;k<S.cols;k++){const z=((k+.5)/S.cols-.5)*len,ax={x:o.ax.x*side,z:o.ax.z*side},f={x:street.x+ax.x*7.5+o.az.x*z,y:0,z:street.z+ax.z*7.5+o.az.z*z,ax,az:{x:-ax.z,z:ax.x}};
   if(ct48House(K,W,f,S.types[Math.floor(ct48Hash(r*31+k,side,5)*S.types.length)],r*97+k*13+side,M))n++;}}
 return n;
}
function ct49Industrial(K,W,M,S){
 const P=ct49Prep(W),o=ct49Axis(S.a),c={x:P.cx+Math.cos(S.a)*(P.R+S.dist),z:P.cz+Math.sin(S.a)*(P.R+S.dist)};let n=0;
 for(let r=0;r<S.rows;r++)for(let k=0;k<S.cols;k++){const w=70+ct48Hash(r,k,7)*50,d=45+ct48Hash(r,k,8)*25,f={x:c.x+o.ax.x*(r-(S.rows-1)/2)*95+o.az.x*(k-(S.cols-1)/2)*130,y:0,z:c.z+o.ax.z*(r-(S.rows-1)/2)*95+o.az.z*(k-(S.cols-1)/2)*130,...o};
  if(ct49Warehouse(K,W,f,w,d,M,r*10+k))n++;}
 return n;
}
// Floodlight towers at Sydney (it races at night).
function ct49Lights(K,W,M){for(let i=0;i<22;i++){const ph=(i+.5)/22,s=W.at(ph);for(const side of [-1,1]){if((i+side)%2)continue;const f=ct48Frame(W,ph,side,26);f.y=gr26SceneryGround(W,f.x,f.z);if(!ct48Clear(W,f,2,2,22,8))continue;K.box(f,0,11,0,.5,22,.5,M.steel);K.box(f,-.6,22.4,0,.5,1.4,4.2,{side:M.darkSteel,front:M.white});ct48Reserve(W,f,2,5,23,'light tower');}}}

function ct49Build(W){
 const C=ct49C(W),K=new CT48Kit(W),M=ct48Materials(W),P=ct49Prep(W);
 W.ct48PitOpts=C.pit;ct48PitComplex(K,W,M);if(C.pit.hotel)ct49Hotel(K,W,M);
 const outside=(ph)=>{const s=W.at(ph);for(const side of [-1,1]){const x=s.p.x+s.n.x*side*60,z=s.p.z+s.n.z*side*60;if(!ct48Inside(W,x,z))return side;}return 1;};
 const awayFromPit=ph=>{const s=W.at(ph),q=W.pit?.samples?dc32PitNear(W,s.p):null;if(!q||q.distance>80)return outside(ph);return (q.p.x-s.p.x)*s.n.x+(q.p.z-s.p.z)*s.n.z>0?-1:1;};
 // Main straight stands face the pits; corner stands sit on the outside of the sharpest turns.
 const brands=['Repco','Supercheap Auto','Penrite','Shell','Dunlop','Castrol'],seats=['red','blue','orange','green'];W.ct48Stands=0;
 for(const [k,ph] of [[0,.985],[1,.02]]){const f=ct48Find(W,ph,awayFromPit(ph),22,19,(k?44:60)+4,15);if(f){ct48Grandstand(K,W,f,k?44:60,M,M.seats[seats[k]],brands[k]);W.ct48Stands++;}}
 P.corners.slice(0,C.stands).forEach((c,k)=>{const f=ct48Find(W,c.ph,c.side,26,19,44,15);if(f){ct48Grandstand(K,W,f,40,M,M.seats[seats[(k+2)%4]],brands[(k+2)%6]);W.ct48Stands++;}});
 // Hospitality marquees behind the main straight stands.
 for(const ph of [.97,.035]){const f=ct48Find(W,ph,awayFromPit(ph),48,12,30,30);if(f)ct48Marquee(K,W,f,30,12,M);}
 W.ct49Venue=C.venue?ct49Venue(K,W,M):0;
 if(C.lights)ct49Lights(K,W,M);
 if(C.industrial)W.ct49Warehouses=ct49Industrial(K,W,M,C.industrial);
 if(C.suburb)W.ct49Houses=ct49Suburb(K,W,M,C.suburb);
 // Farmsteads out in the paddocks.
 let farms=0;for(let t=0;t<C.farms*8&&farms<C.farms;t++){const a=ct48Hash(t,W.N,71)*Math.PI*2,r=P.R+220+ct48Hash(t,3,73)*900,ang=(C.fields?.angle||0)+(ct48Hash(t,5,75)<.5?0:Math.PI/2),f={x:P.cx+Math.cos(a)*r,y:0,z:P.cz+Math.sin(a)*r,...ct49Axis(ang)};f.y=gr26SceneryGround(W,f.x,f.z);if(ct49Farm(K,W,f,M,t*13+7,W.e.key==='taupo'?'nz':'au'))farms++;}
 W.ct49Farms=farms;K.flush(W.e.name+' buildings');
 if(C.campers){const zones=P.corners.slice(C.stands,C.stands+2).map(c=>[c.ph-.03,c.ph+.03,c.side,34,130,Math.round(C.campers/2)]);ct48Camping(W,zones,M);}
}

// ---------- Bush ----------
function ct49Atlas(W){
 if(W.ct49Atlas)return W.ct49Atlas;const r=()=>W.rnd();
 // Radiata pine: straight dark trunk, dense layered crown, rounded top.
 const pine=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;c.fillStyle='#4a3b2c';c.fillRect(cx-3,h*.25,6,h*.75);
  for(let k=0;k<110;k++){const t=r(),y=h*(.05+t*.7),wid=(8+t*40)*(.8+r()*.4),x=cx+(r()-.5)*2*wid;c.fillStyle=['#1f3324','#2a4430','#36523a','#243a2a'][Math.floor(r()*4)];c.beginPath();c.ellipse(x,y,6+r()*9,4+r()*6,r()*3,0,7);c.fill();}}});
 // Mallee: several thin stems from the ground, a flat, wide grey-green canopy.
 const mallee=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;c.strokeStyle='#b7a88f';c.lineCap='round';
  for(let s=0;s<5;s++){const tx=cx+(r()-.5)*70;c.lineWidth=2.5+r()*2;c.beginPath();c.moveTo(cx+(r()-.5)*10,h);c.quadraticCurveTo(cx+(tx-cx)*.4,h*.7,tx,h*.38);c.stroke();}
  for(let k=0;k<90;k++){const x=cx+(r()-.5)*118,y=h*(.18+r()*.28);c.fillStyle=['#6d7457','#7f8466','#5d6650','#8e9273'][Math.floor(r()*4)];c.beginPath();c.ellipse(x,y,6+r()*10,4+r()*6,r()*3,0,7);c.fill();}}});
 return W.ct49Atlas={pine,mallee};
}
// Billboard foliage is lit as if facing the sky from both sides, so no half of a crossed tree
// goes black when seen from behind.
function ct49Foliage(m){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz);');};m.customProgramCacheKey=()=> 'ct49Foliage1';return m;}
function ct49Forest(W){
 const C=ct49C(W),T=THREE,P=ct49Prep(W),size=W.sc26Terrain?.size||W.span+2400,A=ct48TreeAtlas(W),B=ct49Atlas(W);
 const kinds={gum:{tex:A.tree,v:4,wr:[.62,.82]},shrub:{tex:A.shrub,v:2,wr:[1.5,1.9]},pine:{tex:B.pine,v:4,wr:[.4,.5]},mallee:{tex:B.mallee,v:4,wr:[1.0,1.3]}},rows={};
 const blocked=(x,z,r)=>{for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+r)return true;return false;};
 const nearPit=(x,z,m)=>W.pit?.samples&&(W.pitDistance(x,z)<m||ct48PitFloor(W,x,z,8)!==null);
 const add=(kind,x,z,h)=>{const K=kinds[kind];(rows[kind]||=Array.from({length:K.v},()=>[]));const v=Math.floor(W.rnd()*K.v),y=gr26SceneryGround(W,x,z)-.15;rows[kind][v].push([x,y,z,h*(K.wr[0]+W.rnd()*(K.wr[1]-K.wr[0])),h,W.rnd()*Math.PI,.82+W.rnd()*.3]);};
 for(const [kind,cfg] of Object.entries(C.forest)){if(!cfg.n)continue;const small=kind==='shrub';
  for(let i=0;i<cfg.n;i++){let x,z;if(small||i%3===0){const s=W.at(W.rnd()),side=W.rnd()<.5?-1:1,l=24+Math.pow(W.rnd(),1.5)*(small?260:420);x=s.p.x+s.n.x*side*l+(W.rnd()-.5)*20;z=s.p.z+s.n.z*side*l+(W.rnd()-.5)*20;}else{x=(W.rnd()-.5)*size*.97;z=(W.rnd()-.5)*size*.97;}
   const d=W.nearest({x,z}).distance;if(d<(small?23:27))continue;const F=ct49Field(W,x,z)||{edge:99,belt:false};
   const c={d,edge:F.edge,belt:F.belt,clump:ct48Fbm(x/360,z/360,11)};if(W.rnd()>clamp(cfg.dens(c),0,1))continue;if(ct49PineZone(W,x,z,d))continue;
   if(nearPit(x,z,small?25:30)||blocked(x,z,small?1.5:4))continue;add(kind,x,z,cfg.h[0]+W.rnd()*(cfg.h[1]-cfg.h[0]));}}
 // Pine plantations: planted rows, 7 m apart, with a ragged edge.
 if(C.pines){const step=7,F=C.fields?.angle||0,co=Math.cos(F),si=Math.sin(F),h=C.forest.pine.h;
  for(let u=-size/2;u<size/2;u+=step)for(let v=-size/2;v<size/2;v+=step){const x=u*co-v*si+(W.rnd()-.5)*2.5,z=u*si+v*co+(W.rnd()-.5)*2.5;if(Math.abs(x)>size*.48||Math.abs(z)>size*.48)continue;
   const d=W.nearest({x,z}).distance;if(!ct49PineZone(W,x,z,d)||W.rnd()<.08||blocked(x,z,3))continue;add('pine',x,z,h[0]+W.rnd()*(h[1]-h[0]));}}
 for(const [x,z,k] of W.ct48Garden||[])k==='tree'?add('gum',x,z,7+W.rnd()*5):add('shrub',x,z,1.0+W.rnd()*.8);
 const dummy=new T.Object3D(),col=new T.Color(),out={};
 for(const [kind,list] of Object.entries(rows)){const K=kinds[kind],tint=C.forest[kind]?.tint||(kind==='pine'?'#b4bfa6':'#a3ab95'),mat=ct49Foliage(new T.MeshStandardMaterial({map:K.tex,color:tint,alphaTest:.45,side:T.DoubleSide,roughness:.95}));out[kind]=0;
  list.forEach((items,v)=>{if(!items.length)return;const g=ct48Billboard(v/K.v+.002,(v+1)/K.v-.002),m=new T.InstancedMesh(g,mat,items.length);m.name=`${W.e.name} ${kind} ${v}`;
   items.forEach(([x,y,z,w,h,yaw,shade],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(w,h,w);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,col.setRGB(shade,shade,shade*.96));});
   m.computeBoundingSphere();m.castShadow=false;m.receiveShadow=false;W.world.add(m);out[kind]+=items.length;});}
 W.ct49Bush=out;
}

// ---------- Hooks ----------
const ct49Building=SC25World.prototype.building;
SC25World.prototype.building=function(...a){if(ct49C(this))return false;return ct49Building.apply(this,a);};
const ct49Stand=SC25World.prototype.grandstand;
SC25World.prototype.grandstand=function(...a){if(ct49C(this))return false;return ct49Stand.apply(this,a);};
const ct49Scenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 if(!ct49C(this))return ct49Scenery.call(this);
 ct49Build(this);const out=ct49Scenery.call(this);ct49Horizon(this);ct49Forest(this);return out;
};
const ct49Flush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 if(ct49C(this)){
  // The generic round trees and campers give way to the regional bush and camping above.
  for(const key of Object.keys(this.batches))if(/^tree-|^shrub|^camp-/.test(key))delete this.batches[key];
  if(!ct49C(this).lights)for(const key of ['lightpole','floodlights'])delete this.batches[key];
 }
 return ct49Flush.call(this);
};
