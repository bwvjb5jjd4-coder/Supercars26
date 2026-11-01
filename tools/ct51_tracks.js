
/* CT51: Albert Park, Symmons Plains, Wanneroo, Hidden Valley and Sandown on the Bathurst system
   (ct48 + the ct49 track builder). Each gets ground, bush and buildings that match the real place:
   - Albert Park: parkland around a lake, elms and palms, sports ovals, boathouses, the CBD skyline;
   - Symmons Plains: Tasmanian sheep paddocks with cypress windbreaks, Ben Lomond on the horizon;
   - Wanneroo: grey-white sand, banksia woodland, grass trees, the Gnangara pines;
   - Hidden Valley: red dirt, dry-season spear grass, burnt patches, savanna gums, pandanus, termite mounds, the drag strip;
   - Sandown: the turf racecourse inside the circuit, its members' grandstand, suburbs, the Pakenham line. */
Object.assign(CT49,{
 albert:{
  pit:{name:'ALBERT PARK',floors:2,signColour:'#0f2a4a'},
  relief:{amp:.7,scale:420,fine:.2,far:4,farFrom:1100},
  palette:{verge:'#64824a',rough:'#6b834d',bare:'#8b8a6a',far:'#62744c',fields:['#6b834d'],bareAmt:.1},
  fields:null,
  horizon:{base:6,ranges:[{a:-1.2,w:1.1,h:40,r:7000}]},
  stands:6,mounds:0,campers:0,farms:0,venue:false,
  forest:{},
  extra:{elm:{n:42000,dens:c=>c.lake?0:.05+ct48Smooth((c.clump+.05)/.3)*.55+(c.d<70?.25:0),h:[13,22]},gum:{n:9000,dens:c=>c.lake?0:.25,h:[14,24]},palm:{n:2600,dens:c=>c.lake||c.d>140?0:.5,h:[9,14]}},
 },
 symmons:{
  pit:{name:'SYMMONS PLAINS RACEWAY',floors:1,signColour:'#1b3b22'},
  relief:{amp:1.4,scale:480,fine:.3,far:14,farFrom:1000},
  palette:{verge:'#6b804b',rough:'#74854f',bare:'#8d8460',far:'#66744d',fields:['#788a4f','#6a7f48','#9b9562','#839052','#a59a66','#71844b'],bareAmt:.15},
  fields:{w:300,h:210,angle:.15},
  horizon:{base:18,ranges:[{a:-.25,w:.45,h:1050,r:7600},{a:-.75,w:.35,h:420,r:6600},{a:2.95,w:.9,h:700,r:8000},{a:1.7,w:.6,h:180,r:6000}]},
  stands:2,mounds:3,campers:300,farms:10,venue:true,
  forest:{gum:{n:40000,dens:c=>.03+ct48Smooth((c.clump-.3)/.15)*.45+(c.edge<6&&!c.belt?.12:0),h:[12,24]},shrub:{n:5000,dens:c=>.12,h:[.8,1.8]}},
  extra:{cypress:{n:500000,edge:4,dens:c=>c.d>60?.9:0,h:[11,17]}},
  sheep:true,homestead:true,
 },
 perth:{
  pit:{name:'WANNEROO RACEWAY',floors:2,signColour:'#14325a'},
  relief:{amp:6,scale:300,fine:.6,far:18,farFrom:700},
  palette:{verge:'#879060',rough:'#a09c76',bare:'#d6cfb8',far:'#7c8061',pine:'#3f4a33',fields:['#9a9674','#8e8e6c','#a7a17d'],bareAmt:.85},
  fields:null,pines:{thr:.3,minD:420},
  horizon:{base:14,ranges:[{a:.1,w:1.1,h:230,r:8000}]},
  stands:2,mounds:3,campers:0,farms:0,venue:true,
  forest:{pine:{n:0,h:[16,26]},gum:{n:12000,dens:c=>.05+ct48Smooth((c.clump-.2)/.3)*.3,h:[12,22],tint:'#a7ae98'},shrub:{n:22000,dens:c=>.45,h:[.6,1.6],tint:'#b0b39a'}},
  extra:{banksia:{n:150000,dens:c=>.18+ct48Smooth((c.clump+.2)/.3)*.75+ct48Smooth((c.d-400)/400)*.3,h:[4,9]},grasstree:{n:9000,dens:c=>c.d<260?.75:.25,h:[1.4,3.2]}},
 },
 darwin:{
  pit:{name:'HIDDEN VALLEY',floors:1,signColour:'#7a2c16'},
  relief:{amp:1.6,scale:420,fine:.3,far:10,farFrom:1000},
  palette:{verge:'#8f8a55',rough:'#a3955c',bare:'#a2603f',far:'#7d7a4f',fields:['#918d58','#878552','#9c935c'],bareAmt:.45},
  fields:null,
  horizon:{base:10,ranges:[{a:2.2,w:.8,h:90,r:7000}]},
  stands:2,mounds:3,campers:0,farms:0,venue:true,
  forest:{shrub:{n:16000,dens:c=>.4,h:[.7,1.6],tint:'#c6b57f'}},
  extra:{savanna:{n:110000,dens:c=>.2+ct48Smooth((c.clump+.15)/.3)*.65+ct48Smooth((c.d-400)/500)*.3,h:[11,22]},pandanus:{n:9000,dens:c=>.35,h:[3.5,7]},palm:{n:900,dens:c=>c.d<160?.6:0,h:[8,13]},speargrass:{n:26000,dens:c=>c.burnt?.05:.7,h:[1.2,2.2]}},
  termites:true,burnt:true,dragstrip:true,
 },
 sandown:{
  pit:{name:'SANDOWN RACEWAY',floors:2,signColour:'#123d2b'},
  relief:{amp:.8,scale:420,fine:.2,far:8,farFrom:1100},
  palette:{verge:'#6f8152',rough:'#78845a',bare:'#918a6b',far:'#6a7652',fields:['#78845a'],bareAmt:.15},
  fields:null,
  horizon:{base:10,ranges:[{a:-.85,w:.55,h:520,r:7600},{a:-.2,w:.4,h:220,r:7000}]},
  stands:3,mounds:0,campers:0,farms:0,venue:false,
  suburb:null,
  forest:{gum:{n:14000,dens:c=>c.course?0:.08+ct48Smooth((c.clump-.1)/.25)*.45,h:[12,22]},shrub:{n:6000,dens:c=>c.course?0:.25,h:[.8,1.8]}},
  extra:{elm:{n:9000,dens:c=>c.course?0:.2,h:[10,17]},cypress:{n:3000,dens:c=>c.course?0:.12,h:[9,14]}},
  racecourse:true,railway:true,
 },
});

// ---------- Lake (Albert Park) and racecourse (Sandown) ----------
function ct51Lake(W,x,z,d=W.nearest({x,z}).distance){
 if(W.e.key!=='albert'||!W.samples)return 0;if(!ct48Inside(W,x,z))return 0;
 const edge=58+ct48Fbm(x/160,z/160,81)*26;return ct48Smooth((d-edge)/28);
}
const ct51IsWater=SC25World.prototype.isWater;
SC25World.prototype.isWater=function(x,z){if(this.e.key==='albert'&&this.samples)return ct51Lake(this,x,z)>.5;return ct51IsWater.call(this,x,z);};
// The racecourse: the largest oval that fits inside the circuit with 40 m to spare, along its long axis.
function ct51Course(W){
 if(W.ct51CourseShape!==undefined)return W.ct51CourseShape;if(W.e.key!=='sandown')return W.ct51CourseShape=null;
 let cx=0,cz=0;for(const s of W.samples){cx+=s.p.x;cz+=s.p.z;}cx/=W.N;cz/=W.N;
 let xx=0,zz=0,xz=0;for(const s of W.samples){const dx=s.p.x-cx,dz=s.p.z-cz;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;}const ang=.5*Math.atan2(2*xz,xx-zz),co=Math.cos(ang),si=Math.sin(ang);
 const fits=(a,b)=>{for(let k=0;k<64;k++){const t=k/64*Math.PI*2,u=Math.cos(t)*a,v=Math.sin(t)*b,x=cx+u*co-v*si,z=cz+u*si+v*co;if(!ct48Inside(W,x,z)||W.nearest({x,z}).distance<34)return false;}return true;};
 let s=1;const A=Math.sqrt(xx/W.N)*1.6,B=Math.sqrt(zz/W.N)*1.6,ra=Math.max(A,B),rb=Math.min(A,B);while(s>.2&&!fits(ra*s,rb*s))s-=.02;
 return W.ct51CourseShape={cx,cz,co,si,a:ra*s,b:rb*s};
}
// Signed distance (metres, roughly) from the racecourse centreline ring; inside the oval is negative.
function ct51CourseAt(W,x,z){const C=ct51Course(W);if(!C)return null;const dx=x-C.cx,dz=z-C.cz,u=dx*C.co+dz*C.si,v=-dx*C.si+dz*C.co,q=Math.hypot(u/C.a,v/C.b);return{ring:(q-1)*Math.min(C.a,C.b),q,u,v};}

const ct51Height=ct49Height;
ct49Height=function(W,x,z,n=W.nearest({x,z})){
 let h=ct51Height(W,x,z,n);const lake=ct51Lake(W,x,z,n.distance);
 if(lake>0){const level=W.ct51Level??(W.ct51Level=Math.min(...W.samples.map(s=>s.p.y))-1.7);h=h+(level-2.4-h)*lake;}
 return h;
};
const ct51Colour=ct49Colour;
ct49Colour=function(W,x,y,z,steep,d){
 const c=ct51Colour(W,x,y,z,steep,d),C=ct49C(W),base=W.ct49Lin.base;
 const paint=(hex,t)=>{if(t<=0)return;const l=ct49Lin(hex);for(let i=0;i<3;i++)c[i]+=(l[i]/base[i]-c[i])*clamp(t,0,1);};
 const k=W.e.key;
 if(k==='albert'){const lake=ct51Lake(W,x,z,d);paint('#7b7a62',ct48Smooth((lake-.02)/.3)*(1-ct48Smooth((lake-.6)/.3)));paint('#4c5a40',ct48Smooth((lake-.6)/.3));
  for(const o of ct51Ovals(W)){const q=Math.hypot((x-o.x)/o.a,(z-o.z)/o.b);if(q<1.08){paint('#5d9a43',ct48Smooth((1.08-q)/.04));if(q<1&&Math.floor((x*o.co+z*o.si)/9)%2===0)paint('#6aa84c',.6);}}}
 if(k==='darwin'){paint('#4a443b',ct51BurntAmt(W,x,z,d)*.6);paint('#b06a45',ct48Smooth((ct48Fbm(x/40,z/40,83)-.35)/.2)*.35*ct48Smooth((d-40)/40));}
 if(k==='perth'){paint('#ddd6c2',ct48Smooth((ct48Fbm(x/70,z/70,85)-.2)/.25)*.55*ct48Smooth((d-30)/40));}
 if(k==='sandown'){const r=ct51CourseAt(W,x,z);if(r){const a=Math.abs(r.ring);paint('#4f8f3a',ct48Smooth((13-a)/2));if(Math.abs(a)<13&&Math.floor((r.u+r.v)/7)%2)paint('#5d9e45',.5);if(r.ring<-15)paint('#71894f',.4);}}
 return c;
};
function ct51BurntAmt(W,x,z,d){return ct48Smooth((d-60)/40)*ct48Smooth((ct48Fbm(x/150,z/150,87)-.33)/.06);}
function ct51Burnt(W,x,z,d){return ct51BurntAmt(W,x,z,d)>.5;}
// Sports ovals in the park, away from the lake and the track.
function ct51Ovals(W){
 if(W.ct51OvalList)return W.ct51OvalList;const out=[];if(W.e.key!=='albert')return W.ct51OvalList=out;
 const size=W.span+2400;for(let t=0;t<400&&out.length<9;t++){const x=(ct48Hash(t,1,91)-.5)*size*.6,z=(ct48Hash(t,2,91)-.5)*size*.6,a=70+ct48Hash(t,3,91)*25,b=a*.8,ang=ct48Hash(t,4,91)*3;
  let ok=true;for(let k=0;k<12&&ok;k++){const th=k/12*Math.PI*2,px=x+Math.cos(th)*a*1.15,pz=z+Math.sin(th)*b*1.15;if(W.nearest({x:px,z:pz}).distance<45||ct51Lake(W,px,pz)>0)ok=false;}
  if(ok&&!out.some(o=>Math.hypot(o.x-x,o.z-z)<o.a+a+30))out.push({x,z,a,b,co:Math.cos(ang),si:Math.sin(ang)});}
 return W.ct51OvalList=out;
}

// ---------- Ground-hugging strips: roads, the drag strip, ballast and rails ----------
function ct51Strip(W,pts,width,mat,lift=.06,name='strip'){
 const pos=[],uv=[],ix=[];let dist=0;
 for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[Math.min(pts.length-1,i+1)],o=pts[Math.max(0,i-1)];let vx=q[0]-o[0],vz=q[1]-o[1];const l=Math.hypot(vx,vz)||1;vx/=l;vz/=l;if(i)dist+=Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1]);
  for(const s of [-1,0,1]){const x=p[0]-vz*s*width/2,z=p[1]+vx*s*width/2;pos.push(x,gr26SceneryGround(W,x,z)+lift,z);uv.push((s+1)/2*width,dist);}}
 for(let i=0;i<pts.length-1;i++)for(let k=0;k<2;k++){const a=i*3+k,b=a+3;ix.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;m.castShadow=false;W.world.add(m);return m;
}
function ct51Line(x0,z0,x1,z1,step=10){const n=Math.max(1,Math.round(Math.hypot(x1-x0,z1-z0)/step)),p=[];for(let i=0;i<=n;i++)p.push([x0+(x1-x0)*i/n,z0+(z1-z0)*i/n]);return p;}
function ct51StripClear(W,pts,m){return pts.every(([x,z])=>W.nearest({x,z}).distance>m&&!(W.pit?.samples&&W.pitDistance(x,z)<m));}

// ---------- Buildings ----------
// CBD and St Kilda Road towers on the horizon to the north of Albert Park.
function ct51Skyline(K,W,M){
 const P=ct49Prep(W),r=(a,b)=>a+W.rnd()*(b-a);let n=0;
 const walls=[M.glass,M.ribbon,M.glass,M.render.grey||M.ribbon];
 const tower=(x,z,w,d,h,ang)=>{const f={x,y:0,z,...ct49Axis(ang)};f.y=gr26SceneryGround(W,clamp(x,-(W.sc26Terrain.size/2)+5,W.sc26Terrain.size/2-5),clamp(z,-(W.sc26Terrain.size/2)+5,W.sc26Terrain.size/2-5))-4;
  const wall=walls[Math.floor(W.rnd()*walls.length)];K.box(f,0,h/2,0,w,h,d,{side:wall,top:M.concrete});
  if(h>120){K.box(f,0,h+3,0,w*.7,6,d*.7,{side:M.darkSteel,top:M.concrete});if(W.rnd()<.4)K.box(f,0,h+12,0,.6,14,.6,M.steel);}
  if(W.rnd()<.5){const sh=h*r(.2,.45);K.box(f,w*.45,sh/2,0,w*.5,sh,d*1.2,{side:walls[(walls.indexOf(wall)+1)%walls.length],top:M.concrete});}n++;};
 // The CBD: a dense cluster 3.4-4.4 km away; the tallest near its middle.
 for(let i=0;i<70;i++){const a=-Math.PI/2+.12+r(-.16,.16),dist=P.R+r(1900,2700),x=P.cx+Math.cos(a)*dist,z=P.cz+Math.sin(a)*dist,mid=1-Math.abs(a+Math.PI/2-.12)/.16;tower(x,z,r(24,45),r(24,45),r(60,140)+mid*r(40,190),a+r(-.2,.2));}
 // St Kilda Road offices, a lower line nearer the park.
 for(let i=0;i<34;i++){const t=r(0,1),a=-Math.PI/2+.45+r(-.05,.05),dist=P.R+400+t*1500,x=P.cx+Math.cos(a)*dist,z=P.cz+Math.sin(a)*dist;tower(x,z,r(26,40),r(20,34),r(35,85),a);}
 // Apartment blocks around the park edge at St Kilda and South Melbourne.
 for(let i=0;i<40;i++){const a=r(0,Math.PI*2),dist=P.R+r(450,1000),x=P.cx+Math.cos(a)*dist,z=P.cz+Math.sin(a)*dist;if(W.nearest({x,z}).distance<200)continue;tower(x,z,r(20,36),r(16,28),r(12,42),a);}
 return n;
}
// Rowing boathouses and a jetty on the lake shore; yachts on the water.
function ct51Lakeside(K,W,M){
 if(W.e.key!=='albert')return;const level=W.ct51Level,sail=W.mat('#f3f3ee',.6),hull=W.mat('#e9ecef',.4);let houses=0;
 for(let t=0;t<300&&houses<5;t++){const s=W.at(ct48Hash(t,9,93)),x0=s.p.x,z0=s.p.z;for(const side of [-1,1]){let L=40;while(L<140&&ct51Lake(W,s.p.x+s.n.x*side*L,s.p.z+s.n.z*side*L)<.05)L+=4;if(L>=140||L<45)continue;
   const f={x:s.p.x+s.n.x*side*(L-24),y:0,z:s.p.z+s.n.z*side*(L-24),ax:{x:s.n.x*side,z:s.n.z*side},az:{x:s.v.x,z:s.v.z}};f.y=gr26SceneryGround(W,f.x,f.z);if(!ct48Clear(W,f,16,26,30,10))continue;
   ct48Plinth(K,W,f,16,26,M);K.box(f,8,3.2,0,16,6.4,26,{side:M.weatherboard.white||M.white,front:M.garageDoor,top:null});K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,6.4,-8,26,16,2.6,M.colorbond.manor,M.white,.6);
   const j={...f,x:f.x+f.ax.x*16,z:f.z+f.ax.z*16,y:level+.5};K.box(j,10,0,0,22,.3,3,M.concreteWarm);for(let k=0;k<5;k++)K.box(j,1+k*4.6,-1,1.3,.3,2.4,.3,M.darkSteel);
   ct48Reserve(W,f,18,28,8,'boathouse');houses++;break;}}
 W.ct51Stats.boathouses=houses;
 // Yachts: a hull and a sail, scattered over open water.
 let boats=0;const size=W.sc26Terrain.size;for(let t=0;t<2000&&boats<26;t++){const x=(ct48Hash(t,1,95)-.5)*size*.5,z=(ct48Hash(t,2,95)-.5)*size*.5;if(ct51Lake(W,x,z)<.98)continue;
  const f={x,y:level+.05,z,...ct49Axis(ct48Hash(t,3,95)*6)};K.box(f,0,.25,0,1.6,.5,5,hull);K.tri(sail,f,[[0,.5,-1.6],[0,6.5,-1.2],[0,.5,1.4]],[1,0,0]);K.tri(sail,f,[[0,.5,-1.6],[0,.5,1.4],[0,6.5,-1.2]],[-1,0,0]);boats++;}
}
function ct51Water(W){
 // Water only over the lake bed: one quad per terrain cell that dips toward the lake.
 if(W.e.key!=='albert'&&!(typeof ct54WaterGrid==='function'&&ct54WaterGrid(W)))return;const T=W.sc26Terrain,N=T.N,size=T.size,cell=size/N,y=W.ct51Level,pos=[],uv=[],ix=[];
 const wet=new Uint8Array((N+1)*(N+1));for(let j=0;j<=N;j++)for(let i=0;i<=N;i++)wet[j*(N+1)+i]=ct51Lake(W,(i/N-.5)*size,(j/N-.5)*size)>.02?1:0;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*(N+1)+i;if(!(wet[k]||wet[k+1]||wet[k+N+1]||wet[k+N+2]))continue;const x=(i/N-.5)*size,z=(j/N-.5)*size,b=pos.length/3;
  pos.push(x,y,z,x+cell,y,z,x+cell,y,z+cell,x,y,z+cell);uv.push(x/40,z/40,(x+cell)/40,z/40,(x+cell)/40,(z+cell)/40,x/40,(z+cell)/40);ix.push(b,b+2,b+1,b,b+3,b+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);ct48Upright(g);
 const tex=W.texture(256,256,(c,w,h)=>{c.fillStyle='#4f7486';c.fillRect(0,0,w,h);for(let i=0;i<1400;i++){c.fillStyle=W.rnd()<.5?'rgba(255,255,255,.07)':'rgba(10,30,40,.08)';c.fillRect(W.rnd()*w,W.rnd()*h,4+W.rnd()*14,1);}});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tex,color:'#9fb9c4',roughness:.12,metalness:.35}));m.name=W.e.key==='albert'?'Albert Park Lake':W.e.name+' water';m.receiveShadow=true;W.world.add(m);
}
// Park pavilions next to each oval: brick change rooms with a skillion roof and a small stand.
function ct51Pavilions(K,W,M){
 for(const o of ct51Ovals(W)){const ang=Math.atan2(o.si,o.co),f={x:o.x+o.co*(o.a+14),y:0,z:o.z+o.si*(o.a+14),...ct49Axis(ang)};f.y=gr26SceneryGround(W,f.x,f.z);if(!ct48Clear(W,f,10,30,25,10))continue;
  ct48Plinth(K,W,f,10,30,M);K.box(f,5,1.8,0,10,3.6,30,{side:M.brick.red||M.concrete,top:M.concrete});K.lquad(M.colorbond.monument||M.roof,f,[[-2.5,3.7,-15.6],[10.6,4.6,-15.6],[10.6,4.6,15.6],[-2.5,3.7,15.6]],[0,1,0]);
  for(let z=-12;z<=12;z+=6)K.lquad(M.door,f,[[-.04,0,z-.5],[-.04,0,z+.5],[-.04,2.2,z+.5],[-.04,2.2,z-.5]],[-1,0,0]);ct48Reserve(W,f,10,30,5,'pavilion');
  // Goal posts at each end.
  for(const s of [-1,1]){const g={x:o.x+o.co*s*o.a*.97,y:gr26SceneryGround(W,o.x+o.co*s*o.a*.97,o.z+o.si*s*o.a*.97),z:o.z+o.si*s*o.a*.97,...ct49Axis(ang)};for(const z of [-9.6,-3.2,3.2,9.6])K.box(g,0,Math.abs(z)>5?4:6.5,z,.25,Math.abs(z)>5?8:13,.25,M.white);}}
}
// Termite mounds: fluted red-clay spires, from knee height to over 3 m.
function ct51Termites(K,W){
 const clay=new THREE.MeshStandardMaterial({color:'#a95c35',roughness:1});const size=W.sc26Terrain.size;let n=0;
 for(let t=0;t<9000&&n<700;t++){const near=t%2===0,s=W.at(ct48Hash(t,1,97)),side=ct48Hash(t,2,97)<.5?-1:1,L=26+ct48Hash(t,3,97)*(near?140:600),x=near?s.p.x+s.n.x*side*L:(ct48Hash(t,4,97)-.5)*size*.9,z=near?s.p.z+s.n.z*side*L:(ct48Hash(t,5,97)-.5)*size*.9;
  if(W.nearest({x,z}).distance<24||(W.pit?.samples&&W.pitDistance(x,z)<30))continue;let bad=false;for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+2){bad=true;break;}if(bad)continue;
  const f={x,y:gr26SceneryGround(W,x,z)-.2,z,...ct49Axis(ct48Hash(t,6,97)*6)},h=.8+Math.pow(ct48Hash(t,7,97),2)*3.2,r=.35+h*.22;
  ct49Cone(K,f,0,0,0,r,h,clay,7);if(h>1.8){ct49Cone(K,f,r*.55,0,.2,r*.55,h*.7,clay,6);ct49Cone(K,f,-r*.4,0,-r*.5,r*.5,h*.55,clay,6);}n++;}
 return n;
}
// Hidden Valley's drag strip: a long straight parallel to the circuit with walls, a tower and a stand.
function ct51DragStrip(K,W,M){
 const P=ct49Prep(W),C={x:P.cx,z:P.cz};let best=null;
 for(const ang of [0,Math.PI/2,Math.PI/4,-Math.PI/4])for(const off of [140,200,260,330,420])for(const sg of [-1,1]){const ax={x:Math.cos(ang),z:Math.sin(ang)},nx={x:-ax.z*sg,z:ax.x*sg},cx=C.x+nx.x*(P.R*.6+off),cz=C.z+nx.z*(P.R*.6+off);
  const pts=ct51Line(cx-ax.x*260,cz-ax.z*260,cx+ax.x*260,cz+ax.z*260,10);if(ct51StripClear(W,pts,60)&&pts.every(([x,z])=>Math.abs(x)<W.sc26Terrain.size*.45&&Math.abs(z)<W.sc26Terrain.size*.45)){best={pts,ax,nx,cx,cz};break;}if(best)break;}
 if(!best)return false;const {pts,ax,nx,cx,cz}=best;ct51Strip(W,pts,16,M.asphalt,.07,'Drag strip');
 for(const s of [-1,1]){for(let i=0;i<pts.length-1;i+=1){const [x0,z0]=pts[i],[x1,z1]=pts[i+1],mx=(x0+x1)/2+nx.x*s*9,mz=(z0+z1)/2+nx.z*s*9,f={x:mx,y:gr26SceneryGround(W,mx,mz),z:mz,ax:nx,az:ax};K.box(f,0,.25,0,.6,1.5,10.05,M.concrete);}}
 const t={x:cx-ax.x*250+nx.x*20,z:cz-ax.z*250+nx.z*20,y:0,ax:nx,az:ax};t.y=gr26SceneryGround(W,t.x,t.z);K.box(t,3,5,0,6,10,6,{side:M.render.white||M.white,front:M.glass,top:M.concrete});
 const g={x:cx-ax.x*150+nx.x*14,z:cz-ax.z*150+nx.z*14,y:0,ax:nx,az:ax};g.y=gr26SceneryGround(W,g.x,g.z);if(ct48Clear(W,g,17,50,20,8))ct48Grandstand(K,W,g,50,M,M.seats.orange,'Betr');
 for(const p of pts)(W.ct48Reserved||=[]).push({x:p[0],z:p[1],r:14});return true;
}
// Sandown: the turf racecourse with white running rails, and the members' grandstand.
function ct51Racecourse(K,W,M){
 const C=ct51Course(W);if(!C)return;const ring=(off,n=180)=>{const p=[];for(let k=0;k<=n;k++){const t=k/n*Math.PI*2,a=C.a+off,b=C.b+off,u=Math.cos(t)*a,v=Math.sin(t)*b;p.push([C.cx+u*C.co-v*C.si,C.cz+u*C.si+v*C.co]);}return p;};
 const rail=W.mat('#f4f4f0',.5);
 for(const off of [-13,13]){const p=ring(off);for(let k=0;k<p.length-1;k++){const [x0,z0]=p[k],[x1,z1]=p[k+1],l=Math.hypot(x1-x0,z1-z0),f={x:(x0+x1)/2,y:gr26SceneryGround(W,(x0+x1)/2,(z0+z1)/2),z:(z0+z1)/2,ax:{x:-(z1-z0)/l,z:(x1-x0)/l},az:{x:(x1-x0)/l,z:(z1-z0)/l}};
  K.box(f,0,1.05,0,.12,.12,l+.05,rail);if(k%2===0)K.box(f,0,.52,0,.1,1.05,.1,rail);}}
 // Inner sand training track.
 ct51Strip(W,ring(-24,140),6,new THREE.MeshStandardMaterial({color:'#b9a27d',roughness:1}),.05,'Training track');
 // Members' grandstand on the outside of the long side nearest the pit straight, facing in.
 const pitS=W.pit?.samples?.[Math.floor(W.pit.samples.length/2)]?.p||W.at(0).p;let best=null;
 for(const sg of [-1,1]){const u=0,v=sg*(C.b+60),x=C.cx+u*C.co-v*C.si,z=C.cz+u*C.si+v*C.co,dd=Math.hypot(x-pitS.x,z-pitS.z);if(!best||dd<best.dd)best={sg,dd};}
 for(const sg of [best.sg,-best.sg]){for(let o=95;o<=200;o+=15){const v=sg*(C.b+o),x=C.cx-v*C.si,z=C.cz+v*C.co,inward={x:C.si*sg,z:-C.co*sg},f={x,y:0,z,ax:{x:-inward.x,z:-inward.z},az:{x:C.co,z:C.si}};
   // Front at x=0 faces the racecourse; the footprint runs back from it.
   if(!ct48Clear(W,f,30,130,26,12))continue;ct51Members(K,W,f,M);return true;}}
 return false;
}
function ct51Members(K,W,f,M){
 const len=130,dep=30;ct48Plinth(K,W,f,dep,len,M);
 // Three levels of concrete and glass, tiered seats in front, a cantilevered roof.
 K.box(f,dep*.62,7,0,dep*.76,14,len,{front:M.glass,back:M.concreteWarm,side:M.concreteWarm,top:M.concrete});
 for(let l=1;l<=3;l++)K.box(f,dep*.24-.2,l*4.4,0,1,.35,len,{side:M.white,top:M.concrete});
 for(let r=0;r<9;r++)K.box(f,1+r*.9,.4+r*.55,0,.95,.8+r*1.1,len-2,{side:M.seats.green,top:M.seats.green,front:M.seats.green});
 K.lquad(M.roof,f,[[-3,18.6,-len/2-1],[dep+1,16.2,-len/2-1],[dep+1,16.2,len/2+1],[-3,18.6,len/2+1]],[0,1,0]);K.lquad(M.underside,f,[[-3,18.5,len/2+1],[dep+1,16.1,len/2+1],[dep+1,16.1,-len/2-1],[-3,18.5,-len/2-1]],[0,-1,0]);
 for(let z=-len/2+6;z<=len/2-6;z+=17)K.box(f,dep*.66,9.3,z,.6,18.6,.6,M.steel);
 const q=K.at(f,-.3,15.4,0);W.signPlane(W.sign('SANDOWN','#123d2b',1024,128),26,3.2,new THREE.Vector3(...q),Math.atan2(-f.ax.x,-f.ax.z));
 ct48Reserve(W,f,dep+4,len+4,19,'members grandstand');
}
// The Pakenham line beside Sandown: ballast, two tracks, overhead wiring masts and a train.
function ct51Railway(K,W,M){
 const P=ct49Prep(W);let best=null;const C=ct51Course(W),ang=C?Math.atan2(C.si,C.co):0,ax={x:Math.cos(ang),z:Math.sin(ang)};
 for(const sg of [-1,1])for(let off=P.R*.35;off<P.R*1.2&&!best;off+=20){const nx={x:-ax.z*sg,z:ax.x*sg},cx=P.cx+nx.x*off,cz=P.cz+nx.z*off,pts=ct51Line(cx-ax.x*1500,cz-ax.z*1500,cx+ax.x*1500,cz+ax.z*1500,12);
  if(ct51StripClear(W,pts,70))best={pts,nx,cx,cz};}
 if(!best)return false;const {pts,nx}=best;const ballast=new THREE.MeshStandardMaterial({color:'#6f6a62',roughness:1}),steel=W.mat('#6b6660',.4,.7);
 ct51Strip(W,pts,11,ballast,.12,'Railway ballast');
 for(const o of [-2.6,2.6])for(const g of [-.72,.72]){const p=pts.map(([x,z])=>[x+nx.x*(o+g),z+nx.z*(o+g)]);ct51Strip(W,p,.12,steel,.3,'Rail');}
 for(let i=0;i<pts.length;i+=5){const [x,z]=pts[i],f={x:x+nx.x*6.2,y:0,z:z+nx.z*6.2,ax:{x:-nx.x,z:-nx.z},az:ax};f.y=gr26SceneryGround(W,f.x,f.z);K.box(f,0,3.5,0,.3,7,.3,M.steel);K.box(f,3,6.8,0,6.4,.18,.18,M.steel);}
 // A six-car suburban train in blue and white.
 const body=W.mat('#e8ecef',.45,.2),stripe=W.mat('#1d5aa8',.5),glassM=M.glass,mid=Math.floor(pts.length*.4);
 for(let c=0;c<6;c++){const [x,z]=pts[mid+c*2],f={x:x+nx.x*-2.6,y:gr26SceneryGround(W,x,z)+.4,z:z+nx.z*-2.6,ax:nx,az:ax};K.box(f,0,2.1,0,3,3.4,23.2,{side:body,top:W.mat('#a7aeb4',.5)});K.box(f,0,1.2,0,3.04,.4,23.2,stripe);K.box(f,0,2.6,0,3.06,1,22,glassM);}
 for(const p of pts.filter((_,i)=>i%2===0))(W.ct48Reserved||=[]).push({x:p[0],z:p[1],r:10});return true;
}
// Sandown's own footprints from OpenStreetMap: houses for the small ones, sheds and halls for the rest.
function ct51SandownHouses(K,W,M){
 const list=W.data?.buildings||[],sc=W.scale||1,big=[];let n=0;
 for(const b of list){const [x0,z0,w0,d0]=b,w=w0*sc,d=d0*sc,x=x0*sc,z=z0*sc;if(w*d>320){big.push(b);continue;}
  const q=W.nearest({x,z}),s=W.samples[q.i],ax={x:x-s.p.x,z:z-s.p.z},l=Math.hypot(ax.x,ax.z)||1;ax.x/=l;ax.z/=l;const f={x:x-ax.x*7,y:0,z:z-ax.z*7,ax,az:{x:-ax.z,z:ax.x}};
  if(ct51CourseAt(W,x,z)?.q<1.15)continue;if(ct48House(K,W,f,['brick','modern','brick','federation'][n%4],x0*13+z0,M))n++;}
 const keep=W.data.buildings;W.data.buildings=big;const v=ct49Venue(K,W,M);W.data.buildings=keep;return n+v;
}
// Symmons Plains homestead: a two-storey Georgian brick house with a hipped roof and verandah.
function ct51Homestead(K,W,M){
 const P=ct49Prep(W);for(let t=0;t<60;t++){const a=ct48Hash(t,1,99)*Math.PI*2,r=P.R+160+ct48Hash(t,2,99)*300,f={x:P.cx+Math.cos(a)*r,y:0,z:P.cz+Math.sin(a)*r,...ct49Axis(a)};f.y=gr26SceneryGround(W,f.x,f.z);
  if(!ct48Clear(W,f,40,50,60,30))continue;ct48Plinth(K,W,f,14,22,M);const wall=M.brick.red||M.concrete;
  K.box(f,7,3.6,0,14,7.2,22,{side:wall,front:M.ribbon,top:null});K.hip(f,7,7.2,0,14,22,3,M.colorbond.jasper,.4);
  K.box(f,-1.2,2.9,0,.1,.1,22,M.white);K.lquad(M.colorbond.woodland||M.roof,f,[[-3,3,-11],[0,3.4,-11],[0,3.4,11],[-3,3,11]],[0,1,0]);for(let z=-10;z<=10;z+=2.5)K.box(f,-2.9,1.5,z,.15,3,.15,M.white);
  for(const z of [-6,6])K.box(f,7,8.8,z,1,3.2,1,wall);
  ct48Reserve(W,f,14,22,11,'homestead');(W.ct48Garden||=[]).push(...[[-8,-14],[-8,14],[20,-16],[22,14],[-14,0]].map(([lx,lz])=>[f.x+f.ax.x*lx+f.az.x*lz,f.z+f.ax.z*lx+f.az.z*lz,'tree']));return true;}
 return false;
}
// Merino sheep in some of the paddocks: one instanced body and head each.
function ct51Sheep(W){
 const T=THREE,body=new T.SphereGeometry(.5,8,6);body.scale(1,.75,1.5);const wool=new T.MeshStandardMaterial({color:'#e9e4d6',roughness:1}),m=new T.InstancedMesh(body,wool,1600),d=new T.Object3D();let n=0;const size=W.sc26Terrain.size;
 for(let t=0;t<40000&&n<1600;t++){const x=(ct48Hash(t,1,101)-.5)*size*.9,z=(ct48Hash(t,2,101)-.5)*size*.9,F=ct49Field(W,x,z);if(!F||F.id>.3||F.edge<8)continue;const dist=W.nearest({x,z}).distance;if(dist<80)continue;let bad=false;for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+3){bad=true;break;}if(bad)continue;
  d.position.set(x,gr26SceneryGround(W,x,z)+.55,z);d.rotation.set(0,ct48Hash(t,3,101)*6,0);d.scale.setScalar(.9+ct48Hash(t,4,101)*.3);d.updateMatrix();m.setMatrixAt(n++,d.matrix);}
 m.count=n;m.computeBoundingSphere();m.castShadow=false;m.name='Sheep';W.world.add(m);return n;
}

// ---------- Extra bush: park trees, cypress windbreaks, banksia, grass trees, savanna ----------
function ct51Atlas(W){
 if(W.ct51Atlas)return W.ct51Atlas;const r=()=>W.rnd(),pick=a=>a[Math.floor(r()*a.length)];
 const blobs=(c,cx,cy,rx,ry,n,cols,sz=[6,10])=>{for(let k=0;k<n;k++){const a=r()*Math.PI*2,q=Math.sqrt(r()),x=cx+Math.cos(a)*q*rx,y=cy+Math.sin(a)*q*ry;c.fillStyle=y>cy+ry*.25?cols[0]:pick(cols.slice(1));c.beginPath();c.ellipse(x,y,sz[0]+r()*sz[1],sz[0]*.7+r()*sz[1]*.6,r()*3,0,7);c.fill();}};
 const trunk=(c,cx,h,top,w,col)=>{c.strokeStyle=col;c.lineCap='round';c.lineWidth=w;c.beginPath();c.moveTo(cx,h);c.lineTo(cx+(r()-.5)*6,top);c.stroke();};
 // English elm / plane tree: dark trunk, big dense rounded crown.
 const elm=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;trunk(c,cx,h,h*.45,9,'#4b3f33');c.lineWidth=4;for(let b=0;b<3;b++){const s=r()<.5?-1:1;c.beginPath();c.moveTo(cx,h*.6);c.quadraticCurveTo(cx+s*20,h*.45,cx+s*36,h*.32);c.stroke();}
  blobs(c,cx,h*.36,56,h*.3,120,[['#2f4a26','#3f5d30','#557a3c','#476b34'],['#2c4423','#3b5a2e','#4f7239','#62843f']][v%2]);}});
 // Monterey cypress windbreak: dense, dark, wide at the base.
 const cypress=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;trunk(c,cx,h,h*.6,7,'#3d3229');for(let k=0;k<140;k++){const t=r(),y=h*(.05+t*.82),wid=(18+t*42)*(.8+r()*.3),x=cx+(r()-.5)*2*wid;c.fillStyle=pick(['#1e3322','#27402a','#2f4b31','#223a26']);c.beginPath();c.ellipse(x,y,7+r()*9,5+r()*6,r()*3,0,7);c.fill();}}});
 // Banksia: crooked grey trunks, irregular serrated crown, a few yellow cones.
 const banksia=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;c.strokeStyle='#4e4740';c.lineCap='round';for(let s=0;s<3;s++){c.lineWidth=4+r()*3;c.beginPath();c.moveTo(cx+(r()-.5)*12,h);c.quadraticCurveTo(cx+(r()-.5)*40,h*.65,cx+(r()-.5)*70,h*.35);c.stroke();}
  blobs(c,cx,h*.34,58,h*.24,110,['#4f5a3c','#6a7450','#7c8660','#5c6846'],[4,8]);for(let k=0;k<10;k++){c.fillStyle='#d9b244';c.fillRect(cx+(r()-.5)*90,h*(.2+r()*.3),3,6);}}});
 // Grass tree: black trunk, a skirt of dead fronds and a fountain of fine green needles.
 const grasstree=W.texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<2;v++){const cx=v*128+64,top=h*(.42+r()*.1);c.fillStyle='#1d1b18';c.fillRect(cx-7,top,14,h-top);
  for(let k=0;k<170;k++){const a=-Math.PI/2+(r()-.5)*2.9,l=30+r()*40,dead=r()<.3;c.strokeStyle=dead?'#8a7a55':pick(['#6f8a3a','#87a248','#5d7a33']);c.lineWidth=1.3;c.beginPath();c.moveTo(cx,top);c.quadraticCurveTo(cx+Math.cos(a)*l*.6,top+Math.sin(a)*l*.6,cx+Math.cos(a)*l,top+Math.sin(a)*l+(dead?l*.9:l*.35));c.stroke();}
  if(r()<.6){c.strokeStyle='#6a5a3c';c.lineWidth=3;c.beginPath();c.moveTo(cx,top);c.lineTo(cx+(r()-.5)*6,4);c.stroke();}}});
 // Northern savanna gum (Darwin woollybutt): tall, slim, pale or dark trunk, small open crown.
 const savanna=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64,dark=v%2;c.strokeStyle=dark?'#3a332c':'#d7cfbf';c.lineCap='round';c.lineWidth=6;c.beginPath();c.moveTo(cx,h);c.quadraticCurveTo(cx+(r()-.5)*16,h*.5,cx+(r()-.5)*10,h*.18);c.stroke();
  if(dark){c.strokeStyle='#d7cfbf';c.lineWidth=4;c.beginPath();c.moveTo(cx,h*.55);c.lineTo(cx,h*.2);c.stroke();}
  c.lineWidth=2.5;for(let b=0;b<4;b++){const s=r()<.5?-1:1,y=h*(.22+r()*.2);c.beginPath();c.moveTo(cx,y);c.lineTo(cx+s*(18+r()*20),y-14-r()*18);c.stroke();}
  for(let k=0;k<4;k++)blobs(c,cx+(r()-.5)*60,h*(.12+r()*.16),18,14,20,['#5c6a3a','#748248','#879456'],[4,6]);}});
 // Pandanus: several leaning stems, spiky tufts at the ends, prop roots.
 const pandanus=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64;for(let s=0;s<3;s++){const tx=cx+(r()-.5)*80,ty=h*(.25+r()*.25);c.strokeStyle='#6b5d4a';c.lineWidth=4;c.beginPath();c.moveTo(cx+(r()-.5)*8,h);c.quadraticCurveTo(cx,h*.6,tx,ty);c.stroke();
   for(let k=0;k<26;k++){const a=-Math.PI/2+(r()-.5)*3.6,l=16+r()*18;c.strokeStyle=pick(['#4e6b3a','#668548','#7b9655']);c.lineWidth=2.2;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+Math.cos(a)*l,ty+Math.sin(a)*l+6);c.stroke();}}
  c.strokeStyle='#6b5d4a';c.lineWidth=1.5;for(let k=0;k<5;k++){c.beginPath();c.moveTo(cx,h*.78);c.lineTo(cx+(r()-.5)*30,h);c.stroke();}}});
 // Palms: Canary Island date palm (park) / coconut (Top End).
 const palm=W.texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<4;v++){const cx=v*128+64,lean=(r()-.5)*14,top=h*.16;c.strokeStyle='#7a6650';c.lineWidth=v<2?11:7;c.lineCap='round';c.beginPath();c.moveTo(cx,h);c.quadraticCurveTo(cx+lean,h*.5,cx+lean,top);c.stroke();
  for(let k=0;k<22;k++){const a=-Math.PI/2+(k/22-.5)*Math.PI*2.2,l=34+r()*18,ex=cx+lean+Math.cos(a)*l,ey=top+Math.sin(a)*l*.55+l*.35;c.strokeStyle=pick(['#3f6a35','#4f7a3e','#5f8a45']);c.lineWidth=3;c.beginPath();c.moveTo(cx+lean,top);c.quadraticCurveTo(cx+lean+Math.cos(a)*l*.6,top+Math.sin(a)*l*.4-6,ex,ey);c.stroke();
   for(let j=0;j<8;j++){const t=j/8,px=cx+lean+(ex-cx-lean)*t,py=top+(ey-top)*t-4*Math.sin(t*3);c.lineWidth=1;c.beginPath();c.moveTo(px,py);c.lineTo(px+(r()-.5)*8,py+6+r()*4);c.stroke();}}}});
 // Spear grass: golden dry-season tussocks with seed heads.
 const speargrass=W.texture(256,128,(c,w,h)=>{c.clearRect(0,0,w,h);for(let v=0;v<2;v++){const cx=v*128+64;for(let k=0;k<160;k++){const a=-Math.PI/2+(r()-.5)*1.5,l=h*(.4+r()*.55),x=cx+(r()-.5)*40;c.strokeStyle=pick(['#c9a95e','#b8964d','#d9bc74','#a58646']);c.lineWidth=1.2;c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+Math.cos(a)*l*.5,h+Math.sin(a)*l*.5,x+Math.cos(a)*l,h+Math.sin(a)*l);c.stroke();}}});
 return W.ct51Atlas={elm,cypress,banksia,grasstree,savanna,pandanus,palm,speargrass};
}
const CT51_KINDS={elm:{v:4,wr:[.85,1.05]},cypress:{v:4,wr:[.7,.9]},banksia:{v:4,wr:[1.0,1.3]},grasstree:{v:2,wr:[1.1,1.4]},savanna:{v:4,wr:[.45,.6]},pandanus:{v:4,wr:[1.1,1.4]},palm:{v:4,wr:[.55,.7]},speargrass:{v:2,wr:[1.6,2.2]},
 gum:{v:4,wr:[.62,.82],atlas:'tree'},shrub:{v:2,wr:[1.5,1.9],atlas:'shrub'}};
function ct51Trees(W){
 const C=ct49C(W);if(!C?.extra)return;const T=THREE,size=W.sc26Terrain?.size||W.span+2400,A=ct51Atlas(W),B=ct48TreeAtlas(W),rows={};
 const blocked=(x,z,r)=>{for(const q of W.ct48Reserved||[])if(Math.hypot(q.x-x,q.z-z)<q.r+r)return true;return false;};
 for(const [kind,cfg] of Object.entries(C.extra)){const K=CT51_KINDS[kind],small=['grasstree','speargrass','shrub'].includes(kind),list=rows[kind]=Array.from({length:K.v},()=>[]);
  for(let i=0;i<cfg.n;i++){let x,z;if(small||i%3===0){const s=W.at(W.rnd()),side=W.rnd()<.5?-1:1,l=24+Math.pow(W.rnd(),1.5)*(small?300:460);x=s.p.x+s.n.x*side*l+(W.rnd()-.5)*20;z=s.p.z+s.n.z*side*l+(W.rnd()-.5)*20;}else{x=(W.rnd()-.5)*size*.97;z=(W.rnd()-.5)*size*.97;}
   const F=ct49Field(W,x,z)||{edge:99,belt:false};if(cfg.edge&&(F.edge>cfg.edge||!F.belt))continue;
   const d=W.nearest({x,z}).distance;if(d<(small?22:27))continue;const course=ct51CourseAt(W,x,z);
   const c={d,x,z,edge:F.edge,belt:F.belt,clump:ct48Fbm(x/360,z/360,11),lake:ct51Lake(W,x,z,d)>0||W.isWater(x,z),burnt:W.e.key==='darwin'&&ct51Burnt(W,x,z,d),course:!!course&&course.q<1.12};
   if(c.lake||W.rnd()>clamp(cfg.dens(c),0,1))continue;if(ct49PineZone(W,x,z,d))continue;if(ct51Ovals(W).some(o=>Math.hypot((x-o.x)/o.a,(z-o.z)/o.b)<1.12))continue;
   if((W.pit?.samples&&(W.pitDistance(x,z)<(small?25:30)||ct48PitFloor(W,x,z,8)!==null))||blocked(x,z,small?1.5:4))continue;
   const h=cfg.h[0]+W.rnd()*(cfg.h[1]-cfg.h[0]);list[Math.floor(W.rnd()*K.v)].push([x,gr26SceneryGround(W,x,z)-.15,z,h*(K.wr[0]+W.rnd()*(K.wr[1]-K.wr[0])),h,W.rnd()*Math.PI,.82+W.rnd()*.3]);}}
 const dummy=new T.Object3D(),col=new T.Color(),out={};
 for(const [kind,list] of Object.entries(rows)){const K=CT51_KINDS[kind],tex=K.atlas?B[K.atlas]:A[kind],tint=C.extra[kind].tint||'#a9b19b',mat=ct49Foliage(new T.MeshStandardMaterial({map:tex,color:tint,alphaTest:.45,side:T.DoubleSide,roughness:.95}));out[kind]=0;
  list.forEach((items,v)=>{if(!items.length)return;const g=ct48Billboard(v/K.v+.002,(v+1)/K.v-.002),m=new T.InstancedMesh(g,mat,items.length);m.name=`${W.e.name} ${kind} ${v}`;
   items.forEach(([x,y,z,w,h,yaw,shade],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(w,h,w);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,col.setRGB(shade,shade,shade*.96));});
   m.computeBoundingSphere();m.castShadow=false;m.receiveShadow=false;W.world.add(m);out[kind]+=items.length;});}
 W.ct51Bush=out;
}

// ---------- Hooks ----------
const CT51_KEYS=['albert','symmons','perth','darwin','sandown'];
const ct51Build=ct49Build;
ct49Build=function(W){
 ct51Build(W);if(!CT51_KEYS.includes(W.e.key))return;const C=ct49C(W),K=new CT48Kit(W),M=ct48Materials(W),st=W.ct51Stats={};
 if(W.e.key==='albert'){st.towers=ct51Skyline(K,W,M);ct51Lakeside(K,W,M);ct51Pavilions(K,W,M);}
 if(C.racecourse)st.course=ct51Racecourse(K,W,M);
 if(W.e.key==='sandown'){st.houses=ct51SandownHouses(K,W,M);for(const a of [-1.3,-.2,.9,2.1,3.2,4.4])st.houses+=ct49Suburb(K,W,M,{a,dist:170,cols:10,rows:5,types:['brick','brick','modern','federation']});}
 if(C.railway)st.railway=ct51Railway(K,W,M);
 if(C.dragstrip)st.drag=ct51DragStrip(K,W,M);
 if(C.homestead)st.homestead=ct51Homestead(K,W,M);
 if(C.termites)st.termites=ct51Termites(K,W);
 K.flush(W.e.name+' landmarks');
};
const ct51Forest=ct49Forest;
ct49Forest=function(W){ct51Forest(W);if(!CT51_KEYS.includes(W.e.key))return;ct51Trees(W);if(ct49C(W).sheep)W.ct51Stats.sheep=ct51Sheep(W);ct51Water(W);
 // The old placeholder lake slab and racecourse ribbon give way to the lake and turf course above.
 const old=[];W.world.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material?.color&&['537e81','a28d71','8f856c'].includes(o.material.color.getHexString()))old.push(o);});for(const o of old)o.removeFromParent();W.ct51Stats.removed=old.length;
};
// Custom terrain skips the rf41 terrain pass, which is where its wall-clearance tally starts.
const ct51Flush=SC25World.prototype.flushBatches;
SC25World.prototype.flushBatches=function(){
 this.rf41Clearance||={terrainCornersLowered:0,barriersRemoved:0};
 // The placeholder palms lose their trunks with the other generic trees; drop their fronds too.
 if(CT51_KEYS.includes(this.e.key))for(const key of Object.keys(this.batches))if(/^palm-frond/.test(key))delete this.batches[key];
 return ct51Flush.call(this);
};
