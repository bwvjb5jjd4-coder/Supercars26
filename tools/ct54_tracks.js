
/* CT54: eight more circuits, all from real map data (tools/newtracks: OpenStreetMap raceways,
   the TUMFTM racing-line database, the real streets for the two street circuits, Overture
   buildings and water, and SRTM elevation along the lap).
   - Winton (Benalla): flat Victorian farmland, river red gums, cypress windbreaks, the Warby Ranges.
   - Phillip Island: coastal grassland on the cliffs over Bass Strait (the real coastline), windbreaks.
   - Lakeside (Kurwongbah): eucalypt bush on the hill, Lake Kurwongbah, the D'Aguilar Range.
   - Circuit of the Americas: Texas grassland and live oaks, the 77 m observation tower, the Turn 1 hill.
   - Yas Marina (2009-2020 layout, as raced in 2012): sand, palms, the marina, the hotel over the track.
   - Bahrain (Grand Prix circuit): open desert, a few palms, the Sakhir tower.
   - Newcastle and Canberra: street circuits on the Gold Coast/Adelaide street system, with the
     harbour at Newcastle and Lake Burley Griffin, Parliament House and Black Mountain at Canberra.
   Track elevation comes from the real terrain for the six permanent circuits (the street circuits
   stay on the flat city system). Venue buildings sit on the real Overture footprints. */
Object.assign(CT49,{
 winton:{
  pit:{name:'WINTON MOTOR RACEWAY',floors:1,signColour:'#1d3a5f'},
  relief:{amp:1.2,scale:520,fine:.3,far:10,farFrom:1000},
  palette:{verge:'#7f8a52',rough:'#8c8d5a',bare:'#a39271',far:'#7f8459',fields:['#9d9a62','#8e955a','#b0a46e','#86904f','#a59b67'],bareAmt:.3},
  fields:{w:320,h:230,angle:-.62},
  horizon:{base:14,ranges:[{a:5.6,w:.35,h:420,r:7400},{a:5.95,w:.25,h:300,r:6800},{a:.75,w:.3,h:950,r:8200}]},
  stands:2,mounds:3,campers:260,farms:9,venue:false,maxVenue:90,
  forest:{},
  extra:{gum:{n:42000,dens:c=>.012+(c.edge<7&&c.belt?.5:0)+ct48Smooth((c.clump-.3)/.2)*.45,h:[12,24]},shrub:{n:6000,dens:c=>.12,h:[.8,1.8]},cypress:{n:260000,edge:4,dens:c=>c.d>70?.55:0,h:[10,16]}},
 },
 phillip:{
  pit:{name:'PHILLIP ISLAND GRAND PRIX CIRCUIT',floors:2,signColour:'#0d2f4f'},
  relief:{amp:3,scale:420,fine:.4,far:12,farFrom:900},
  palette:{verge:'#6f8a4c',rough:'#7d9154',bare:'#a39a73',far:'#6d8350',fields:['#7c9752','#6f8c4a','#8a9b5a','#93a061'],bareAmt:.18},
  fields:{w:300,h:220,angle:.1},
  horizon:{base:10,ranges:[{a:4.35,w:.5,h:260,r:8000},{a:5.2,w:.45,h:420,r:8400},{a:3.6,w:.3,h:120,r:7000}]},
  stands:2,mounds:4,campers:320,farms:6,venue:false,maxVenue:60,
  forest:{},
  extra:{cypress:{n:340000,edge:4,dens:c=>c.d>60?.8:0,h:[9,15]},shrub:{n:26000,dens:c=>.35+ct48Smooth((c.clump+.1)/.3)*.3,h:[.7,1.8],tint:'#a7ad8c'},gum:{n:5000,dens:c=>c.d>220?.2:.02,h:[8,14]}},
 },
 lakeside:{
  pit:{name:'LAKESIDE PARK',floors:1,signColour:'#7a1f24'},
  relief:{amp:9,scale:300,fine:.7,far:40,farFrom:600},
  palette:{verge:'#7d8a52',rough:'#8a8c5a',bare:'#a28769',far:'#6b7a4c',fields:['#8a8c5a'],bareAmt:.35},
  fields:null,
  horizon:{base:40,ranges:[{a:3.1,w:.7,h:520,r:7600},{a:3.8,w:.4,h:380,r:7000}]},
  stands:2,mounds:4,campers:0,farms:2,venue:false,maxVenue:60,
  forest:{},
  extra:{gum:{n:150000,dens:c=>.18+ct48Smooth((c.clump+.15)/.3)*.65+ct48Smooth((c.d-200)/300)*.25,h:[13,26]},shrub:{n:22000,dens:c=>.4,h:[.9,2.2]},grasstree:{n:4000,dens:c=>c.d<200?.4:.15,h:[1.4,2.8]}},
 },
 cota:{
  pit:{name:'CIRCUIT OF THE AMERICAS',floors:3,signColour:'#1f2a44'},
  relief:{amp:3,scale:480,fine:.4,far:16,farFrom:1000},
  palette:{verge:'#86894f',rough:'#9a9560',bare:'#b49f78',far:'#8a8a5a',fields:['#a29d63','#94955a','#b0a66e','#8b8f55'],bareAmt:.35},
  fields:{w:360,h:260,angle:.05},
  horizon:{base:16,ranges:[{a:3.3,w:.8,h:110,r:7600}]},
  stands:4,mounds:2,campers:0,farms:5,venue:false,maxVenue:120,
  forest:{},
  extra:{elm:{n:26000,dens:c=>.03+ct48Smooth((c.clump-.15)/.25)*.5,h:[8,14],tint:'#8e9670'},shrub:{n:20000,dens:c=>.3,h:[1,2.6],tint:'#a8a57f'}},
 },
 yas:{
  pit:{name:'YAS MARINA CIRCUIT',floors:3,signColour:'#3b2a5c'},
  relief:{amp:.6,scale:420,fine:.2,far:2,farFrom:1200},
  palette:{verge:'#c9b186',rough:'#cdb58a',bare:'#d6c196',far:'#cbb68d',fields:['#cdb58a'],bareAmt:.9},
  fields:null,
  horizon:{base:2,ranges:[]},
  stands:4,mounds:0,campers:0,farms:0,venue:false,maxVenue:140,desert:true,
  forest:{},
  extra:{palm:{n:6000,dens:c=>c.d<320?.55:.06,h:[8,13],tint:'#b3bb9a'},shrub:{n:9000,dens:c=>c.d<200?.35:.1,h:[.6,1.6],tint:'#9fa77d'}},
 },
 bahrain:{
  pit:{name:'BAHRAIN INTERNATIONAL CIRCUIT',floors:3,signColour:'#7a1626'},
  relief:{amp:2,scale:380,fine:.5,far:10,farFrom:900},
  palette:{verge:'#c8b085',rough:'#cfb68b',bare:'#d9c39a',far:'#c9b38a',fields:['#cfb68b'],bareAmt:.95},
  fields:null,
  horizon:{base:6,ranges:[{a:1.2,w:.6,h:60,r:7000}]},
  stands:3,mounds:0,campers:0,farms:0,venue:false,maxVenue:110,desert:true,
  forest:{},
  extra:{palm:{n:1400,dens:c=>c.d<240?.3:0,h:[7,11],tint:'#b0b393'},shrub:{n:7000,dens:c=>.2,h:[.4,1.1],tint:'#b9ad86'}},
 },
});
CT51_KEYS.push('winton','phillip','lakeside','cota','yas','bahrain');
Object.assign(CT50,{
 newcastle:{
  pit:{name:'NEWCASTLE 500  ·  FORESHORE PARK',floors:2,signColour:'#0e3b5c'},
  stands:[[.985,0,60,'blue','Newcastle 500'],[.03,0,44,'red','Repco'],[.2,1,40,'orange','Supercheap Auto'],[.42,-1,40,'green','Dunlop'],[.62,1,44,'red','Shell'],[.85,-1,40,'blue','Penrite']],
  park:{r:90,trees:.55},vacant:.18,cbd:{a:Math.PI,from:260,H:[24,72],keep:.8},
  suburb:{mix:[['terrace',.42],['house',.16],['shops',.14],['render',.16],['office',.12]],houses:['federation','brick','federation'],H:[9,24]},
  trees:'tropical',palms:.12,horizon:{base:20,ranges:[{a:Math.PI,w:.8,h:260,r:7600},{a:3.8,w:.4,h:180,r:7000}]},
  harbour:true,
 },
 canberra:{
  pit:{name:'CANBERRA 400  ·  PARLIAMENTARY TRIANGLE',floors:2,signColour:'#1e3a2a'},
  stands:[[.985,0,64,'blue','Canberra 400'],[.04,0,44,'red','Repco'],[.18,1,44,'green','Supercheap Auto'],[.4,-1,40,'orange','Dunlop'],[.62,1,44,'red','Shell'],[.8,-1,40,'blue','Penrite']],
  park:{r:240,trees:1},vacant:.25,cbd:{a:-Math.PI/2,from:5000,H:[14,32],keep:0},
  suburb:{mix:[['house',.5],['office',.22],['render',.18],['shops',.1]],houses:['modern','brick','modern','federation'],H:[9,18]},
  trees:'gum',palms:0,horizon:{base:40,ranges:[{a:3.98,w:.1,h:220,r:4000},{a:4.6,w:.35,h:200,r:6200},{a:2.4,w:.6,h:380,r:7600},{a:.4,w:.5,h:260,r:7200}]},
  lake:true,
 },
});
CT48_STREET.push('newcastle','canberra');
Object.assign(DC36_CLIMATE,{winton:{grass:'#87885a',gravel:'#b4a68b'},phillip:{grass:'#6f8551',gravel:'#b0a891'},lakeside:{grass:'#7e8653',gravel:'#b19f86'},
 cota:{grass:'#8d8b58',gravel:'#bba584'},yas:{grass:'#b9ab86',gravel:'#d4c29a'},bahrain:{grass:'#bba47f',gravel:'#d2bc93'},newcastle:{grass:'#748453',gravel:'#b5a38c'},canberra:{grass:'#7b8956',gravel:'#b2a48c'}});
Object.assign(DC37_EVENT_BRANDS,{winton:'Supercheap Auto',phillip:'Repco',lakeside:'Penrite',cota:'Shell',yas:'Shell',bahrain:'Repco',newcastle:'Coates',canberra:'Supercheap Auto'});
for(const k of ['winton','phillip','lakeside','cota','yas','bahrain','newcastle','canberra'])DC37_REGION_BRANDS[k]||=[];
const CT54_KEYS=['winton','phillip','lakeside','cota','yas','bahrain','newcastle','canberra'];
function ct54(W){return CT54_KEYS.includes(W?.e?.key);}

// ---------- Real elevation along the lap (permanent circuits) ----------
const ct54Height=SC25World.prototype.height;
SC25World.prototype.height=function(t){
 const E=ct54Elev(this);if(!E)return ct54Height.call(this,t);
 // Catmull-Rom through the samples: the slope carries on through each sample, so the road has no steps.
 const n=E.length,a=(((t%1)+1)%1)*n,i=Math.floor(a)%n,u=a-Math.floor(a),p0=E[(i+n-1)%n],p1=E[i],p2=E[(i+1)%n],p3=E[(i+2)%n];
 return p1+.5*u*(p2-p0+u*(2*p0-5*p1+4*p2-p3+u*(3*(p1-p2)+p3-p0)));
};
// Elevation profiles come from a terrain model that also catches buildings, bridges and grandstands
// beside the road. Smooth them over a real road's length scale; the flat reclaimed and desert
// venues get a longer window and a flatter profile.
const CT54_ELEV={yas:{sigma:160,scale:.45},bahrain:{sigma:110,scale:.8},cota:{sigma:70},phillip:{sigma:60}};
function ct54Elev(W){
 const d=W.data,E=d?.elev;if(!E||!ct49C(W))return null;if(d.ct54Elev)return d.ct54Elev;
 const c=CT54_ELEV[W.e.key]||{},n=E.length,step=(d.mappedLength||n*10)/n,sg=Math.max(1,(c.sigma||50)/step),R=Math.ceil(sg*3),w=[];
 for(let k=-R;k<=R;k++)w.push(Math.exp(-k*k/(2*sg*sg)));const ws=w.reduce((a,b)=>a+b,0);
 let out=E.map((_,i)=>{let v=0;for(let k=-R;k<=R;k++)v+=E[((i+k)%n+n)%n]*w[k+R];return v/ws;});
 const mean=out.reduce((a,b)=>a+b,0)/n;out=out.map(v=>mean+(v-mean)*(c.scale??1));
 return d.ct54Elev=out;}

// ---------- Real water: sea, lakes and harbour from the map polygons ----------
// Rasterised once per circuit into a depth grid (metres inside the shoreline), then sampled.
function ct54WaterGrid(W){
 if(W.ct54WG!==undefined)return W.ct54WG;const polys=ct49C(W)&&W.data?.water;if(!polys?.length||!W.samples)return W.ct54WG=null;
 const G=384,size=W.span+2400,cell=size/G,sc=W.scale||1,inside=new Uint8Array(G*G);
 for(const w of polys){const r=w.ring.map(([x,z])=>[x*sc,z*sc]);
  for(let j=0;j<G;j++){const z=(j+.5)*cell-size/2,xs=[];for(let k=0;k<r.length;k++){const a=r[k],b=r[(k+1)%r.length];if((a[1]>z)!==(b[1]>z))xs.push(a[0]+(z-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
   xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2){const i0=Math.max(0,Math.ceil((xs[k]+size/2)/cell-.5)),i1=Math.min(G-1,Math.floor((xs[k+1]+size/2)/cell-.5));for(let i=i0;i<=i1;i++)inside[j*G+i]^=1;}}}
 // Keep the circuit and its verges dry whatever the map says (bridges, causeways).
 for(let j=0;j<G;j++)for(let i=0;i<G;i++){const k=j*G+i;if(inside[k]&&W.nearest({x:(i+.5)*cell-size/2,z:(j+.5)*cell-size/2}).distance<40)inside[k]=0;}
 // Two-pass chamfer distance to the shore, for wet cells.
 const D=new Float32Array(G*G);for(let k=0;k<G*G;k++)D[k]=inside[k]?1e9:0;
 const at=(i,j)=>i<0||j<0||i>=G||j>=G?0:D[j*G+i];
 for(let j=0;j<G;j++)for(let i=0;i<G;i++){const k=j*G+i;if(D[k])D[k]=Math.min(D[k],at(i-1,j)+1,at(i,j-1)+1,at(i-1,j-1)+1.41,at(i+1,j-1)+1.41);}
 for(let j=G-1;j>=0;j--)for(let i=G-1;i>=0;i--){const k=j*G+i;if(D[k])D[k]=Math.min(D[k],at(i+1,j)+1,at(i,j+1)+1,at(i+1,j+1)+1.41,at(i-1,j+1)+1.41);}
 let any=false;for(let k=0;k<G*G;k++){D[k]*=cell;if(D[k]>0)any=true;}
 return W.ct54WG=any?{G,size,cell,D}:null;
}
function ct54Depth(W,x,z){const g=ct54WaterGrid(W);if(!g)return 0;const fx=(x+g.size/2)/g.cell-.5,fz=(z+g.size/2)/g.cell-.5,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
 const d=(a,b)=>a<0||b<0||a>=g.G||b>=g.G?0:g.D[b*g.G+a];return d(i,j)*(1-u)*(1-v)+d(i+1,j)*u*(1-v)+d(i,j+1)*(1-u)*v+d(i+1,j+1)*u*v;}
const ct54LakeBase=ct51Lake;
ct51Lake=function(W,x,z,d){if(!ct54(W))return ct54LakeBase(W,x,z,d);if(!ct54WaterGrid(W))return 0;return ct48Smooth((ct54Depth(W,x,z)-2)/22);};
const ct54IsWater=SC25World.prototype.isWater;
SC25World.prototype.isWater=function(x,z){if(ct54(this)&&this.samples&&ct49C(this))return ct51Lake(this,x,z)>.5;return ct54IsWater.call(this,x,z);};
const ct54Colour=ct49Colour;
ct49Colour=function(W,x,y,z,steep,d){
 const c=ct54Colour(W,x,y,z,steep,d);if(!ct54(W))return c;const base=W.ct49Lin.base;
 const paint=(hex,t)=>{if(t<=0)return;const l=ct49Lin(hex);for(let i=0;i<3;i++)c[i]+=(l[i]/base[i]-c[i])*clamp(t,0,1);};
 const C=ct49C(W),lake=ct54WaterGrid(W)?ct51Lake(W,x,z,d):0;
 // Shoreline: sand at the sea, mud and reeds at the lake.
 if(lake>0)paint(W.e.key==='phillip'||C.desert?'#d6c8a2':'#7b7a5e',ct48Smooth((lake-.01)/.25));
 if(C.desert){paint('#e0cfa6',ct48Smooth((ct48Fbm(x/90,z/90,97)-.1)/.3)*.5*ct48Smooth((d-25)/40));paint('#b9a37d',ct48Smooth((ct48Fbm(x/30,z/30,99)-.3)/.2)*.35);}
 return c;
};

// ---------- Venue buildings on the real footprints ----------
function ct54Venue(K,W,M){
 const C=ct49C(W),list=W.data?.venue||[],sc=W.scale||1,desert=!!C.desert;let n=0;
 for(const [x0,z0,w0,d0,ang,h0] of list){if(n>=(C.maxVenue||80))break;
  const w=Math.min(150,w0*sc),d=Math.min(150,d0*sc),cx=x0*sc,cz=z0*sc,e={x:Math.cos(ang),z:-Math.sin(ang)},long=w>=d,L=long?w:d,Dp=long?d:w;
  // az runs along the long side, ax across it (same handedness as ct49Axis).
  const az=long?e:{x:-e.z,z:e.x},ax={x:az.z,z:-az.x},f={x:cx-ax.x*Dp/2,y:0,z:cz-ax.z*Dp/2,ax,az};
  if(W.isWater(cx,cz)||!ct48Clear(W,f,Dp,L,18,12))continue;ct48Plinth(K,W,f,Dp,L,M);
  const seed=x0*7+z0,area=L*Dp,h=k=>ct48Hash(seed,k);let H=h0>0?clamp(h0,3,80):0;
  if(H>13||(!H&&area>900&&h(9)<.25&&desert)){H=H||10+h(1)*14;const wall=desert?M.render.sand:M.render.white;
   K.box(f,Dp/2,H/2,0,Dp,H,L,{side:wall,front:M.glass,back:M.glass,top:M.concrete});for(let y=4;y<H-1;y+=3.6)K.box(f,-.3,y,0,.6,.25,L,M.render.white);K.box(f,Dp/2,H+.5,0,Dp+.8,1,L+.8,{side:M.render.charcoal,top:M.roof});}
  else if(area>2200){const hh=H||7+h(1)*3,roof=desert?M.colorbond.surfmist:[M.colorbond.surfmist,M.colorbond.windspray,M.colorbond.monument][Math.floor(h(3)*3)];
   K.box(f,Dp/2,hh/2,0,Dp,hh,L,{side:desert?M.render.sand:M.colorbond.windspray,top:null});K.gable({...f,ax:f.az,az:{x:-f.ax.x,z:-f.ax.z}},0,hh,-Dp/2,L,Dp,1.6,roof,desert?M.render.sand:M.colorbond.windspray,.4);
   for(let z=-L/2+6;z<L/2-4;z+=12)K.lquad(M.garageDoor,f,[[-.03,0,z-2.5],[-.03,0,z+2.5],[-.03,5,z+2.5],[-.03,5,z-2.5]],[-1,0,0],[0,0,2,0,2,2,0,2]);}
  else if(area>220){const hh=H||3.6+(area>900?3.6:0),wall=desert?M.render.white:h(2)<.5?M.brick.cream:M.render.sand;
   K.box(f,Dp/2,hh/2,0,Dp,hh,L,{side:wall,front:M.ribbon,top:M.concrete});K.lquad(desert?M.render.white:M.colorbond.monument,f,[[-1.2,hh+.2,-L/2-.6],[Dp+.6,hh+.9,-L/2-.6],[Dp+.6,hh+.9,L/2+.6],[-1.2,hh+.2,L/2+.6]],[0,1,0]);
   K.lquad(M.underside,f,[[-1.2,hh+.15,L/2+.6],[Dp+.6,hh+.85,L/2+.6],[Dp+.6,hh+.85,-L/2-.6],[-1.2,hh+.15,-L/2-.6]],[0,-1,0]);
   for(let z=-L/2+3;z<L/2;z+=Math.max(6,L/4))K.lquad(M.door,f,[[-.04,0,z-.5],[-.04,0,z+.5],[-.04,2.2,z+.5],[-.04,2.2,z-.5]],[-1,0,0]);}
  else{K.box(f,Dp/2,1.5,0,Dp,3,L,{side:desert?M.render.white:M.brick.blend,top:M.concrete});K.lquad(desert?M.render.white:M.colorbond.woodland,f,[[-.5,3.1,-L/2-.4],[Dp+.4,3.6,-L/2-.4],[Dp+.4,3.6,L/2+.4],[-.5,3.1,L/2+.4]],[0,1,0]);K.lquad(M.door,f,[[-.04,0,-.5],[-.04,0,.5],[-.04,2.1,.5],[-.04,2.1,-.5]],[-1,0,0]);}
  ct48Reserve(W,f,Dp,L,Math.max(8,H),'venue building');n++;}
 return n;
}
// Local position of a real lat/lon, in the same frame as the centreline.
function ct54Local(W,lat,lon){const o=W.data.origin,sc=W.scale||1;return{x:(lon-o[1])*111320*Math.cos(o[0]*Math.PI/180)*sc,z:-(lat-o[0])*110540*sc};}
// Nearest clear spot to a target point, searching outward in rings.
function ct54Spot(W,p,w,d,road=20){for(let r=0;r<260;r+=12)for(let k=0;k<(r?12:1);k++){const a=k/12*Math.PI*2,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,f={x:x-w/2,y:0,z,ax:{x:1,z:0},az:{x:0,z:1}};if(!W.isWater(x,z)&&ct48Clear(W,f,w,d,road,10)){f.y=gr26SceneryGround(W,x,z);return f;}}return null;}
// COTA's observation tower: a white core, the glass deck at 70 m and the red steel veil.
function ct54CotaTower(K,W,M){
 const f=ct54Spot(W,ct54Local(W,30.1339,-97.6363),46,46,26);if(!f)return 0;const c={...f,x:f.x+23},red=W.mat('#c3202d',.45,.2),H=77;
 K.cyl(c,0,H/2,0,2.4,H,M.render.white,14);K.cyl(c,0,H-4,0,8,4.2,M.glass,24);K.cyl(c,0,H-1.6,0,8.6,.8,M.render.white,24);K.cyl(c,0,H-6.5,0,8.6,.8,M.render.white,24);
 for(let i=0;i<17;i++){const a=i/17*Math.PI*2,b=a+.07,t=[[Math.cos(a)*8.2,H-7,Math.sin(a)*8.2],[Math.cos(b)*8.2,H-7,Math.sin(b)*8.2],[Math.cos(b+.35)*21,0,Math.sin(b+.35)*21],[Math.cos(a+.35)*21,0,Math.sin(a+.35)*21]];
  K.lquad(red,c,t,[Math.cos(a+.2),.2,Math.sin(a+.2)]);K.lquad(red,c,[t[3],t[2],t[1],t[0]],[-Math.cos(a+.2),-.2,-Math.sin(a+.2)]);}
 ct48Reserve(W,{...f,x:f.x,z:f.z},46,46,H,'tower');return 1;
}
// Yas Marina: the hotel's two wings either side of the track, a link bridge over it and the
// diamond gridshell canopy over both.
function ct54YasHotel(K,W,M){
 const q=ct54Local(W,24.4671,54.6036);let best=0,bd=1e9;for(let i=0;i<W.N;i++){const p=W.samples[i].p,dd=(p.x-q.x)**2+(p.z-q.z)**2;if(dd<bd){bd=dd;best=i;}}
 const s=W.samples[best],v={x:s.v.x,z:s.v.z},nn={x:s.n.x,z:s.n.z},len=110,lift=s.p.y;let wings=0;
 const shell=W.texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(225,232,238,.95)';c.lineWidth=5;for(let k=-8;k<16;k++){c.beginPath();c.moveTo(k*32,0);c.lineTo(k*32+h,h);c.stroke();c.beginPath();c.moveTo(k*32,h);c.lineTo(k*32+h,0);c.stroke();}});shell.wrapS=shell.wrapT=THREE.RepeatWrapping;shell.repeat.set(12,6);
 const grid=new THREE.MeshStandardMaterial({map:shell,alphaTest:.4,side:THREE.DoubleSide,roughness:.4,metalness:.6,emissive:'#3a2d6a',emissiveIntensity:.25});
 for(const side of [-1,1]){let f=null;
  // The real wings stand right at the track edge, one of them on the marina: take the first
  // offset that keeps the block off the road and the pit lane.
  for(const off of [22,28,34,42]){const g={x:s.p.x+nn.x*side*off,y:lift,z:s.p.z+nn.z*side*off,ax:{x:nn.x*side,z:nn.z*side},az:{x:-nn.z*side,z:nn.x*side}};let ok=true;
   for(const a of [2,14,26])for(const b of [-len/2,-len/4,0,len/4,len/2]){const x=g.x+g.ax.x*a+g.az.x*b,z=g.z+g.ax.z*a+g.az.z*b;if(W.nearest({x,z}).distance<12||(W.pit?.samples&&W.pitDistance(x,z)<9))ok=false;}
   if(ok){f=g;break;}}
  if(!f)continue;f.y=Math.max(lift-1,gr26SceneryGround(W,f.x+f.ax.x*14,f.z+f.ax.z*14));
  K.box(f,14,13,0,28,26,len,{side:M.render.white,front:M.glass,back:M.glass,top:M.concrete});for(let y=4;y<25;y+=3.6)K.box(f,-.3,y,0,.6,.25,len,M.render.white);
  ct48Reserve(W,{...f},28,len,40,'hotel');wings++;}
 if(wings>=1){const f={x:s.p.x,y:lift,z:s.p.z,ax:nn,az:v};K.box(f,0,19,0,20,5,14,{side:M.glass,top:M.concrete,bottom:M.underside});
  // Gridshell: a shallow vault over both wings and the track.
  const pos=[],uv=[],ix=[],U=24,V=12;for(let j=0;j<=V;j++)for(let i=0;i<=U;i++){const a=(i/U-.5)*96,b=(j/V-.5)*(len+30),r=Math.hypot(a/52,b/((len+30)/1.8)),y=lift+30+16*Math.max(0,1-r*r)*(.9+.1*Math.sin(i*.7));pos.push(s.p.x+nn.x*a+v.x*b,y,s.p.z+nn.z*a+v.z*b);uv.push(i/U,j/V);}
  for(let j=0;j<V;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i;ix.push(a,a+U+1,a+1,a+1,a+U+1,a+U+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  const m=new THREE.Mesh(g,grid);m.name='Yas hotel gridshell';W.world.add(m);}
 return wings;
}
// Sakhir tower: the eight-storey VIP tower behind the pits, wider at the top.
function ct54SakhirTower(K,W,M){
 const f=ct54Spot(W,ct54Local(W,26.0326,50.5106),34,34,30);if(!f)return 0;const c={...f,x:f.x+17};
 K.box(c,0,17,0,16,34,16,{side:M.glass,top:M.concrete});for(let y=4;y<34;y+=4)K.box(c,0,y,0,16.6,.4,16.6,M.render.sand);
 K.box(c,0,38,0,30,8,30,{side:M.glass,top:M.concrete,bottom:M.underside});K.box(c,0,42.6,0,31,1.2,31,{side:M.render.sand,top:M.roof});K.box(c,0,47,0,.4,8,.4,M.steel);
 ct48Reserve(W,f,34,34,48,'tower');return 1;
}
function ct54Landmarks(K,W,M){const k=W.e.key,st=W.ct54Stats;
 if(k==='cota')st.tower=ct54CotaTower(K,W,M);if(k==='yas')st.hotel=ct54YasHotel(K,W,M);if(k==='bahrain')st.tower=ct54SakhirTower(K,W,M);}
const ct54Build=ct49Build;
ct49Build=function(W){
 ct54Build(W);if(!ct54(W))return;const K=new CT48Kit(W),M=ct48Materials(W);W.ct54Stats={...(W.ct54Stats||{})};
 ct54Landmarks(K,W,M);W.ct54Stats.venue=ct54Venue(K,W,M);K.flush(W.e.name+' venue');
};

// ---------- Street circuits ----------
const ct54Names=CT48_GC_NAMES.slice();
const ct54MakeTrack=SC25World.prototype.makeTrack;
SC25World.prototype.makeTrack=function(){
 ct54MakeTrack.call(this);const k=this.e.key;
 // Desert circuits: sand and rock, not the grass texture, under the terrain and shoulder colours.
 if(ct49C(this)?.desert){const m=ct48TerrainMesh(this)?.material;if(m){m.map=null;m.color.setRGB(.5,.44,.36);m.needsUpdate=true;}}
 if(k!=='newcastle'&&k!=='canberra')return;
 CT48_GC_NAMES.length=0;CT48_GC_NAMES.push(...(k==='newcastle'?['NOBBYS','HUNTER','FORT SCRATCHLEY','THE ESPLANADE','HONEYSUCKLE','BOGEY HOLE','PACIFIC','MERCHANTS','THE VIEW','LIGHTHOUSE']:['BURLEY GRIFFIN','KINGSTON','THE BRASSEY','ACTON','CAPITAL HILL','FORREST','MANUKA','YARRALUMLA','THE ENDEAVOUR','PARKES']));
};
// The Gold Coast shore system stands in for the harbour (Newcastle) and the lake (Canberra).
const ct54Beach=ct48GcBeachZ;
ct48GcBeachZ=function(W){const C=ct50C(W);if(C?.harbour)return W.bounds.minZ-70;if(C?.lake)return W.bounds.minZ-40;return ct54Beach(W);};
// Parliament House: the four-legged flagmast over the grass roof on Capital Hill.
function ct54Parliament(K,W,M,P){
 const f={...P,y:0,ax:{x:1,z:0},az:{x:0,z:1}},steel=W.mat('#c9ccce',.35,.7),grass=W.mat('#6f8a4c',1);
 // Grassed roof ramps (a low mound) and the white front.
 const pos=[],col=[],ix=[],N=24,R=150;for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=(i/N-.5)*2,v=(j/N-.5)*2,r=Math.max(Math.abs(u),Math.abs(v)*1.4),y=Math.max(0,1-r*r)*22-.5;pos.push(P.x+u*R,y,P.z+v*R*.7);}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;ix.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);ct48Upright(g);g.computeVertexNormals();const m=new THREE.Mesh(g,grass);m.name='Parliament House roof';m.receiveShadow=true;W.world.add(m);
 K.box({...f,x:P.x-R*.55,z:P.z+R*.55},0,8,0,R*.9,16,6,{side:M.render.white,front:M.glass,top:M.concrete});
 for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const w=1.4;K.lquad(steel,f,[[a*34-w,20,b*34],[a*34+w,20,b*34],[a*2+w,101,b*2],[a*2-w,101,b*2]],[a,0,b]);K.lquad(steel,f,[[a*34-w,20,b*34],[a*2-w,101,b*2],[a*2+w,101,b*2],[a*34+w,20,b*34]],[-a,0,-b]);}
 K.box(f,0,108,0,.4,14,.4,steel);const flag=W.mat('#1c2f7a',.8);K.lquad(flag,f,[[.2,103,0],[13,103,0],[13,109.5,0],[.2,109.5,0]],[0,0,1]);K.lquad(flag,f,[[.2,103,0],[.2,109.5,0],[13,109.5,0],[13,103,0]],[0,0,-1]);
}
// Telstra Tower on Black Mountain, out on the north-west horizon.
function ct54Telstra(W){
 const P=ct50Prep(W),t=3.98,r=4000,x=P.cx+Math.cos(t)*r,z=P.cz+Math.sin(t)*r,K=new CT48Kit(W),f={x,y:205,z,ax:{x:1,z:0},az:{x:0,z:1}},M=ct48Materials(W);
 K.cyl(f,0,-40,0,22,100,M.concrete,12);K.cyl(f,0,60,0,7,130,M.render.white,12);K.cyl(f,0,105,0,17,16,M.glass,16);K.cyl(f,0,114,0,19,2,M.render.white,16);K.cyl(f,0,150,0,1.2,70,M.steel,6);K.flush('Telstra Tower',false);
}
const ct54City=ct48BuildGoldCoast;
ct48BuildGoldCoast=function(W){
 const k=W.e.key;let ph=null;
 if(k==='canberra'){ph=ct54Local(W,-35.3081,149.1244);(W.ct48Reserved||=[]).push({x:ph.x,z:ph.z,r:160});}
 const out=ct54City(W);if(!ph)return out;
 const K=new CT48Kit(W),M=ct48Materials(W);ct54Parliament(K,W,M,ph);
 // Old Parliament House: the long white building between the terraces.
 const o=ct54Local(W,-35.3021,149.1300);if(W.nearest(o).distance>60){K.box({x:o.x,y:0,z:o.z,ax:{x:1,z:0},az:{x:0,z:1}},0,7,0,120,14,60,{side:M.render.white,front:M.window,top:M.concrete});K.box({x:o.x,y:0,z:o.z,ax:{x:1,z:0},az:{x:0,z:1}},0,15,0,30,6,20,{side:M.render.white,top:M.concrete});}
 K.flush('Canberra landmarks');ct54Telstra(W);return out;
};
// Canberra's shore is lake, not surf beach: lawn down to a still, grey-blue lake.
const ct54Scenery=SC25World.prototype.makeScenery;
SC25World.prototype.makeScenery=function(){
 const out=ct54Scenery.call(this);if(this.e.key!=='canberra')return out;
 this.world.traverse(o=>{if(!o.isMesh)return;if(o.name==='Surfers Paradise beach'){o.material=new THREE.MeshStandardMaterial({color:'#7d8c55',vertexColors:false,roughness:1});o.name='Lake Burley Griffin foreshore';}
  else if(o.geometry?.parameters?.width>8000&&o.geometry?.parameters?.height===8000){o.material=new THREE.MeshStandardMaterial({color:'#5d7e8a',roughness:.15,metalness:.3});o.name='Lake Burley Griffin';}});
 return out;
};

