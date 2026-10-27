/* SK66 Skyscrapers: makes the street-circuit cities (Gold Coast, Adelaide, Townsville,
   Homebush) read like real high-rise skylines.
   - Landmarks at the Gold Coast: Q1 with its crown and spire, Soul's wave balconies, the three
     Jewel towers with their white ribbons, the Hilton twins with their blade crowns and Circle
     on Cavill, standing south of the circuit where Surfers Paradise's skyline really is.
   - Glass: every pane looks into a real room (interior mapping: back wall, side walls, floor,
     ceiling, furniture, lights), with curtains and blinds kept from the facade texture. Each
     pane reflects at its own slight angle and strength, like real curtain walls. At night a
     random mix of rooms is lit, warm and cool; the reflection of the day sky fades out.
   - Facades get depth: slab edges at every floor and vertical mullions on the glass towers.
   - Rooftops: window-cleaning cranes, antennas, water tanks and red aviation beacons.
   - Street level: street lights along every street (lamps glow at night), shop signs lit at
     night.
   - Weathering: rain streaks under each floor and broad colour variation on walls.
   - Atmosphere: distance haze on the city so the skyline has depth.
   - Detail levels: the added facade detail is binned in 200 m cells and only drawn within
     about 320 m of the camera; everything else stays as one mesh per material per tile. */
const SK66={lod:320,cell:200,haze:.00055};

// ---------- Kit: detail bins with their own LOD cells, random facade offsets ----------
const sk66KitBegin=CT48GcKit.prototype.begin;
CT48GcKit.prototype.begin=function(f){sk66KitBegin.call(this,f);this.dtile=Math.floor(f.x/SK66.cell)+','+Math.floor(f.z/SK66.cell);};
CT48GcKit.prototype.bin=function(m){const key=m.uuid+'|'+(this.detail?'d'+this.dtile:this.tile);let b=this.bins.get(key);if(!b)this.bins.set(key,b={m,p:[],n:[],uv:[],c:[],ix:[],detail:!!this.detail});return b;};
// Prisms start their facade at a random whole number of texture repeats (144 m fits every
// facade texture), so no two buildings show the same rooms behind the same windows.
CT48GcKit.prototype.prism=function(m,f,plan,y0,y1,top,bottom){const n=plan.length;let u=144*Math.floor(ct48Hash(f.x+y0,f.z-y1,7)*48);
 for(let i=0;i<n;i++){const [ax,az]=plan[i],[bx,bz]=plan[(i+1)%n],l=Math.hypot(bx-ax,bz-az);
  this.lquad(m,f,[[ax,y0,az],[bx,y0,bz],[bx,y1,bz],[ax,y1,az]],[bz-az,0,-(bx-ax)],[u,y0,u+l,y0,u+l,y1,u,y1]);u+=l;}
 const tris=THREE.ShapeUtils.triangulateShape(plan.map(([x,z])=>new THREE.Vector2(x,z)),[]);
 for(const [cap,y,up] of [[top,y1,1],[bottom,y0,-1]]){if(!cap)continue;for(const t of tris)this.tri(cap,f,t.map(k=>[plan[k][0],y,plan[k][1]]),[0,up,0]);}};
CT48GcKit.prototype.flush=function(name,shadows=true){const W=this.W;
 for(const [,B] of this.bins){if(!B.ix.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(B.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(B.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(B.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(B.c,3));g.setIndex(B.ix);g.computeBoundingSphere();
  const o=new THREE.Mesh(g,B.m);o.name=B.detail?name+' detail':name;o.castShadow=shadows&&!B.m.transparent&&!B.detail;o.receiveShadow=true;o.matrixAutoUpdate=false;o.updateMatrix();W.world.add(o);
  if(B.detail){(W.sk66Lod||=[]).push(o);sk66Hook(W);}}
 this.bins.clear();};
// Detail meshes are shown only near the camera that is rendering (main view, mirrors).
function sk66Hook(W){
 if(W.sk66Hooked||!W.scene)return;W.sk66Hooked=true;const prev=W.scene.onBeforeRender,v=new THREE.Vector3();
 W.scene.onBeforeRender=function(r,s,cam){
  if(cam){cam.getWorldPosition(v);for(const o of W.sk66Lod||[]){const b=o.geometry.boundingSphere;o.visible=v.distanceTo(b.center)<b.radius+SK66.lod;}}
  if(W.sk66Beacon){const t=performance.now()/1000,on=(t%1.5)<.5;W.sk66Beacon.material.color.setRGB(on?3.2:.5,on?.12:.02,on?.08:.02);}
  if(W.sk66LampMat&&W.gr27Night)W.sk66LampMat.emissiveIntensity=.15+W.gr27Night.value*4;
  return prev.apply(this,arguments);};
}

// ---------- Materials: interior rooms, pane reflections, weathering, haze ----------
const SK66_GLSL=`
varying vec3 skW;varying vec3 skNrm;varying vec2 skUv;uniform vec2 skCell;uniform float skShop;uniform float skHazeK;
float skH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float skVN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(skH(i),skH(i+vec2(1.0,0.0)),f.x),mix(skH(i+vec2(0.0,1.0)),skH(i+vec2(1.0,1.0)),f.x),f.y);}
`;
const SK66_ROOM=`
vec2 skId=floor(skUv/skCell),skF=fract(skUv/skCell);vec3 skNw=normalize(skNrm);
vec3 skT0=normalize(vec3(skNw.z,0.0,-skNw.x)+1e-5);vec3 skDp1=dFdx(skW),skDp2=dFdy(skW);vec2 skDu1=dFdx(skUv),skDu2=dFdy(skUv);
vec3 skTd=(skDp1*skDu2.y-skDp2*skDu1.y)*sign(skDu1.x*skDu2.y-skDu2.x*skDu1.y);vec3 skT=dot(skTd,skT0)<0.0?-skT0:skT0;
vec3 skV=normalize(skW-cameraPosition);vec3 skRd=vec3(dot(skV,skT),skV.y,max(-dot(skV,skNw),.05));
if(abs(skRd.x)<1e-4)skRd.x=1e-4;if(abs(skRd.y)<1e-4)skRd.y=1e-4;
float skDepth=skCell.x*1.1+2.6;vec3 skRo=vec3(skF*skCell,0.0);
vec3 skTb=vec3(((skRd.x>0.0?skCell.x:0.0)-skRo.x)/skRd.x,((skRd.y>0.0?skCell.y:0.0)-skRo.y)/skRd.y,skDepth/skRd.z);
float skTt=min(min(skTb.x,skTb.y),skTb.z);vec3 skHp=skRo+skRd*skTt;
float skR1=skH(skId+.37),skR2=skH(skId.yx+3.7),skR3=skH(skId*1.31+9.1);
vec3 skWall=mix(vec3(.80,.75,.66),vec3(.68,.73,.76),skR2)*(.72+.28*skR3),skRoom;
float skLit=step(skR1,.36);vec3 skLc=mix(vec3(1.0,.74,.46),vec3(.86,.92,1.0),step(.62,skR2));
if(skTt==skTb.z){skRoom=skWall;float fx=skHp.x/skCell.x;
 if(skHp.y<.95&&abs(fx-.3-.4*skR3)<.24&&skR1<.75)skRoom=mix(vec3(.16,.14,.13),vec3(.42,.36,.30),skR2);
 if(skHp.y>1.25&&skHp.y<2.05&&abs(fx-.72+.44*skR2)<.11&&skR3>.45)skRoom=mix(vec3(.2,.28,.36),vec3(.6,.45,.3),skR1);}
else if(skTt==skTb.y){skRoom=skRd.y<0.0?mix(vec3(.40,.30,.22),vec3(.52,.50,.47),step(.5,skR3)):vec3(.62,.61,.59)+skLit*.5*smoothstep(.9,.0,length(skHp.xz-vec2(skCell.x*.5,skDepth*.45))/skCell.x);}
else skRoom=skWall*.8;
if(skHp.y<.95&&skTt!=skTb.y&&skR3<.3)skRoom*=.55;
skRoom*=1.0-.5*skHp.z/skDepth;
float skCur=smoothstep(.26,.5,dot(sampledDiffuseColor.rgb,vec3(.3,.59,.11)));
float skG=clamp(gcGlass*1.7,0.0,1.0)*(1.0-skCur);
float skPane=.72+.56*skH(skId+17.0);vec3 skWarp=(vec3(skH(skId+1.0),skH(skId+2.0),skH(skId+3.0))-.5)*.035;
vec3 skSign=diffuseColor.rgb;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.16,skG);
float skGrime=(1.0-skG)*(.11*skH(vec2(floor(skUv.x*2.3),skId.y))*(1.0-skF.y)+.08*skVN(skUv*vec2(.06,.035)));
diffuseColor.rgb*=1.0-skGrime;
vec3 skEm=skRoom*skG*((1.0-gr27Night)*.15*(1.0+.9*skLit)+gr27Night*(skLit*2.3*skLc+.03));
skEm+=skShop*step(.78,skF.y)*skSign*gr27Night*1.5;
`;
const SK66_HAZE=`
#ifdef USE_FOG
{float skD=length(skW-cameraPosition);gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,(1.0-exp(-skD*skHazeK))*.62);}
#endif
#include <fog_fragment>`;
function sk66Vertex(sh){sh.vertexShader='varying vec3 skW;varying vec3 skNrm;varying vec2 skUv;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nskW=(modelMatrix*vec4(transformed,1.0)).xyz;skNrm=normalize(mat3(modelMatrix)*objectNormal);skUv=uv;');}
// Facade materials: interior rooms behind the glass (cell = one room in metres).
function sk66Facade(W,m,cell,shop){
 const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);sk66Vertex(sh);
  Object.assign(sh.uniforms,{skCell:{value:new THREE.Vector2(...cell)},skShop:{value:shop?1:0},skHazeK:{value:SK66.haze}});
  let f=sh.fragmentShader;f=SK66_GLSL+f;
  // ct48Night's whole-facade glow is replaced by lit rooms.
  f=f.replace('totalEmissiveRadiance+=vec3(1.0,.78,.5)*gr27Night*.45*smoothstep(.05,.35,diffuseColor.b-diffuseColor.r*.5);','totalEmissiveRadiance+=skEm;');
  f=f.replace('float gcGlass=metalnessFactor;metalnessFactor*=.12;','float gcGlass=metalnessFactor;metalnessFactor*=.12;\n'+SK66_ROOM);
  f=f.replace('getIBLRadiance(geometryViewDir,geometryNormal,.06)','getIBLRadiance(geometryViewDir,normalize(geometryNormal+skWarp),.06)')
   .replace('envMapIntensity*vec3(.5,.58,.66)','envMapIntensity*vec3(.5,.58,.66)*(1.0-.85*gr27Night)')
   .replace('clamp(gcGlass*1.7,0.0,1.0)*(.3+.55*fr)','clamp(gcGlass*1.7,0.0,1.0)*(1.0-skCur)*skPane*(.3+.55*fr)');
  f=f.replace('#include <fog_fragment>',SK66_HAZE);sh.fragmentShader=f;};
 m.customProgramCacheKey=()=>'sk66Facade1';m.needsUpdate=true;return m;
}
// Other city materials: weathering (walls) and haze.
function sk66Plain(W,m,grime){
 const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);sk66Vertex(sh);Object.assign(sh.uniforms,{skCell:{value:new THREE.Vector2(3,3)},skShop:{value:0},skHazeK:{value:SK66.haze}});
  let f=SK66_GLSL+sh.fragmentShader;
  if(grime)f=f.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.0-.09*skVN(skW.xz*.05+skW.y*.03)-.06*skVN(vec2(skW.x+skW.z,skW.y*.08)*.9);');
  sh.fragmentShader=f.replace('#include <fog_fragment>',SK66_HAZE);};
 m.customProgramCacheKey=()=>'sk66Plain'+(grime?1:0)+(prev?'p':'');m.needsUpdate=true;return m;
}
const sk66MatsBase=ct48GcMaterials;
ct48GcMaterials=function(W){
 if(W.ct48GcMats)return W.ct48GcMats;const M=sk66MatsBase(W);
 sk66Facade(W,M.glass,[1.6,3.3]);sk66Facade(W,M.doors,[3.6,3.2]);sk66Facade(W,M.punched,[3.6,3.0]);sk66Facade(W,M.shop,[4,4.5],true);
 sk66Plain(W,M.plain,true);sk66Plain(W,M.roof,true);for(const k of ['metal','awning','railBar'])sk66Plain(W,M[k],false);
 return M;
};

// ---------- Facade depth on glass towers ----------
// Slab edges at every floor and vertical mullions every 3.2 m (and at every corner).
function sk66Mullions(K,f,plan,y0,H,M,tint,fins){
 const was=K.detail;K.detail=true;K.tint=tint;
 for(let y=y0+3.3;y<H-1;y+=3.3)K.band(M.plain,f,ct48GcGrow(plan,.09),y-.16,y+.1);
 if(fins){const n=plan.length,c=ct48GcCCW(plan);
  for(let i=0;i<n;i++){const [ax,az]=c[i],[bx,bz]=c[(i+1)%n],l=Math.hypot(bx-ax,bz-az);if(l<.5)continue;const tx=(bx-ax)/l,tz=(bz-az)/l,nx=tz,nz=-tx;
   const steps=Math.max(1,Math.round(l/3.2));for(let k=0;k<steps;k++){const t=k/steps*l,px=ax+tx*t+nx*.08,pz=az+tz*t+nz*.08,p=K.at(f,px,0,pz);
    const fe={x:p[0],y:f.y,z:p[2],ax:{x:f.ax.x*nx+f.az.x*nz,z:f.ax.z*nx+f.az.z*nz},az:{x:f.ax.x*tx+f.az.x*tz,z:f.ax.z*tx+f.az.z*tz}};K.box(fe,0,(y0+H)/2,0,.16,H-y0,.12,{side:M.plain,top:null});}}}
 K.detail=was;
}
const sk66GlassBase=ct48GcGlassTower;
ct48GcGlassTower=function(K,W,f,w,d,H,seed,M){
 sk66GlassBase.apply(this,arguments);
 const h=k=>ct48Hash(seed,k),kind=ct48GcPick(['rect','chamfer','round','ellipse','bow','L','rect'],h(2)),tw=w*(.62+h(3)*.22),td=d*(.62+h(4)*.25),plan=ct48GcCCW(ct48GcPlan(kind,tw,td,seed)),y0=4.5+4*Math.floor(h(1)*3)+.35;
 const glass=ct48GcPick(CT48_GC_TINT.glass,h(5));sk66Mullions(K,f,plan,y0,H,M,glass.map(v=>v*.55),!(kind==='rect'&&h(9)<.6));
};
const sk66SlenderBase=ct48GcSlender;
ct48GcSlender=function(K,W,f,w,d,H,seed,M,people,watch){sk66SlenderBase.apply(this,arguments);(W.sk66Beacons||=[]).push(K.at(f,0,H+H*.24,0));};

// ---------- Rooftops ----------
const sk66CrownBase=ct48GcCrown;
ct48GcCrown=function(K,f,plan,y,seed,M,kind){
 sk66CrownBase.apply(this,arguments);if(y<20)return;
 const h=k=>ct48Hash(seed,k+60),xs=plan.map(p=>p[0]),zs=plan.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);let top=y+2;
 const roofY=kind==='setback'?y+7.3:kind==='helipad'?y+3.45:y+.3,flat=kind!=='slope'&&kind!=='helipad';
 // Window-cleaning crane (BMU): base, mast, jib.
 if(y>60&&flat){K.tint=[.9,.9,.88];const bx=w*.12,bz=-d*.22,jl=Math.min(w*.5,14);K.box(f,bx,roofY+.9,bz,2.2,1.6,2.2,M.metal);K.box(f,bx,roofY+3.4,bz,.45,3.6,.45,M.metal);K.box(f,bx-jl/2+1,roofY+5.3,bz,jl,.45,.45,M.metal);K.box(f,bx-jl+1.3,roofY+4.2,bz,.15,2,.15,M.metal);top=Math.max(top,roofY+5.6);}
 // Antennas and comms masts.
 const n=Math.floor(h(1)*4);K.tint=[.75,.77,.78];for(let i=0;i<n;i++){const L=3+h(2+i)*8,x=(h(6+i)-.5)*w*.5,z=(h(10+i)-.5)*d*.5;K.cyl(f,x,roofY+L/2,z,.07+.05*h(14+i),L,M.metal,5);if(L>7)K.box(f,x,roofY+L*.7,z,.9,.6,.12,M.metal);top=Math.max(top,roofY+L);}
 // Water tank or cooling towers on mid-rise roofs.
 if(y<75&&flat&&h(20)<.55){K.tint=ct48GcPick([[.82,.82,.8],[.55,.6,.62],[.7,.66,.6]],h(21));const r=1.2+h(22);K.cyl(f,-w*.22,roofY+1.3,d*.2,r,2.6,M.metal,10);K.prism(M.roof,f,ct48GcPlan('ellipse',r*2,r*2,1),roofY+2.6,roofY+2.7,M.roof,null);}
 if(kind==='spire')top=y+36;
 if(y>45)(K.W.sk66Beacons||=[]).push(K.at(f,0,top+.3,0));
};

// ---------- Gold Coast landmarks ----------
// Frames: local x toward the beach (east, -z), local z south (+x).
function sk66Frame(x,z){return{x,y:0,z,ax:{x:0,z:-1},az:{x:1,z:0}};}
function sk66Lens(w,d,n=28,sharp=.3){const pts=[];for(let k=0;k<n;k++){const a=k/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);pts.push([c*w/2,s*d/2*(1-sharp*c*c)]);}return ct48GcCCW(pts);}
function sk66Scale(plan,s){return plan.map(([x,z])=>[x*s,z*s]);}
function sk66Podium(K,f,w,d,M,floors=3){const plan=ct48GcPlan('rect',w,d,1);K.tint=[1,1,1];K.prism(M.shop,f,plan,0,4.5,null,null);K.tint=[.62,.7,.76];K.prism(M.glass,f,plan,4.5,4.5+floors*4,null,null);K.tint=[.88,.88,.86];K.prism(M.roof,f,ct48GcGrow(plan,.3),4.5+floors*4,4.9+floors*4,M.roof,null);return 4.9+floors*4;}
// Q1: 78 levels, 245 m roof, lattice crown and spire to 322.5 m; bronze-gold glass, white spines.
function sk66Q1(K,W,f,M){
 const y0=sk66Podium(K,f,62,56,M,2),plan=sk66Lens(30,52,32,.35),H=232;
 K.tint=[.95,.82,.58];K.prism(M.glass,f,plan,y0,H,null,null);sk66Mullions(K,f,plan,y0,H,M,[.5,.44,.34],true);
 // White structural spines up both narrow ends and the sky deck band.
 K.tint=[.96,.96,.95];for(const s of [-1,1])K.box(f,0,(y0+H)/2+6,s*26.4,3.2,H-y0+12,2.4,M.plain);
 K.tint=[.6,.72,.8];K.prism(M.glass,f,sk66Scale(plan,.97),H,H+12,null,null);K.tint=[.96,.96,.95];K.band(M.plain,f,ct48GcGrow(plan,.1),H-.6,H+.6);K.band(M.plain,f,ct48GcGrow(sk66Scale(plan,.97),.1),H+11.4,H+12.6);
 // Crown: shrinking lattice rings and a glass sail.
 let y=H+12;for(let i=0;i<12;i++){const s=.92*(1-i/13);K.tint=[.94,.94,.93];K.band(M.metal,f,sk66Scale(plan,s),y+i*3.4,y+i*3.4+.35);}
 K.tint=[.86,.78,.6];K.prism(M.glass,f,sk66Scale(plan,.42),y,y+26,null,null);
 for(const [px,pz] of sk66Scale(plan,.9).filter((p,i)=>i%4===0)){K.box({...f,...(()=>{const p=K.at(f,px*.7,0,pz*.7);return{x:p[0],z:p[2]};})()},0,y+18,0,.35,36,.35,M.metal);}
 // Spire.
 K.tint=[.94,.94,.95];const sy=y+40;[[1.8,sy-8,10],[1.3,sy+8,22],[.8,sy+28,18],[.4,sy+44,14],[.22,sy+56,10]].forEach(([r,cy,hh])=>K.cyl(f,0,cy,0,r,hh,M.metal,10));
 (W.sk66Beacons||=[]).push(K.at(f,0,322.5,0),K.at(f,0,H+12.8,26*.97),K.at(f,0,H+12.8,-26*.97));
}
// Soul: 77 levels, 243 m; white wave balconies wrapping the tower.
function sk66Soul(K,W,f,M){
 const y0=sk66Podium(K,f,58,40,M,2),plan=sk66Lens(24,50,32,.05),H=228,n=plan.length;
 K.tint=[1,1,1];K.prism(M.doors,f,plan,y0,H,null,null);
 let fl=0;for(let y=y0+3.1;y<H-1;y+=3.1,fl++){const ring=plan.map(([x,z],k)=>{const a=k/n*Math.PI*2,o=1.3+1.25*Math.sin(y*.075+a*2.0),l=Math.hypot(x/12,z/25)||1,nx=x/144,nz=z/625,nl=Math.hypot(nx,nz)||1;return[x+nx/nl*o,z+nz/nl*o];});
  K.tint=[.98,.98,.97];K.prism(M.plain,f,ring,y-.28,y,M.plain,M.plain);K.tint=[1,1,1];K.band(M.railGlass,f,ring,y,y+1.1);}
 K.tint=[.62,.74,.82];K.prism(M.glass,f,sk66Scale(plan,.8),H,H+10,null,null);K.tint=[.98,.98,.97];K.band(M.plain,f,ct48GcGrow(plan,.4),H,H+2.2);
 for(const [px,pz] of plan.filter((p,i)=>i%2===0))K.box({...f,...(()=>{const p=K.at(f,px,0,pz);return{x:p[0],z:p[2]};})()},0,H+7.5,0,.5,15,.5,M.plain);
 K.prism(M.roof,f,sk66Scale(plan,.8),H+10,H+10.3,M.roof,null);(W.sk66Beacons||=[]).push(K.at(f,0,H+15.3,0));
}
// Jewel: glass towers with white ribbons sweeping down the ocean faces.
function sk66Jewel(K,W,f,M,H,seed){
 const y0=sk66Podium(K,f,44,34,M,2),plan=ct48GcCCW(ct48GcPlan('round',24,38,seed));K.tint=[.6,.8,.86];K.prism(M.glass,f,plan,y0,H,null,null);sk66Mullions(K,f,plan,y0,H,M,[.86,.9,.92],false);
 K.tint=[.98,.98,.97];for(let k=0;k<5;k++)for(let y=y0;y<H;y+=6){const z0=-15+k*7.5,za=z0+2.4*Math.sin(y/34+k*1.3),zb=z0+2.4*Math.sin((y+6)/34+k*1.3);
  for(const s of [-1,1]){const x=s*12.35;K.lquad(M.plain,f,[[x,y,za-.5],[x,y,za+.5],[x,y+6,zb+.5],[x,y+6,zb-.5]],[s,0,0],[0,y,1,y,1,y+6,0,y+6]);
   K.lquad(M.plain,f,[[x,y,za+.5],[x+s*.6,y,za+.5],[x+s*.6,y+6,zb+.5],[x,y+6,zb+.5]],[0,0,1]);K.lquad(M.plain,f,[[x,y,za-.5],[x+s*.6,y,za-.5],[x+s*.6,y+6,zb-.5],[x,y+6,zb-.5]],[0,0,-1]);
   K.lquad(M.plain,f,[[x+s*.6,y,za-.5],[x+s*.6,y,za+.5],[x+s*.6,y+6,zb+.5],[x+s*.6,y+6,zb-.5]],[s,0,0]);}}
 ct48GcCrown(K,f,plan,H,seed,M,'slope');
}
// Hilton Surfers Paradise: twin glass towers crowned with tall white blades.
function sk66Hilton(K,W,f,M,H,seed){
 const y0=sk66Podium(K,f,40,40,M,3),plan=ct48GcCCW(ct48GcPlan('chamfer',30,30,seed));K.tint=[.55,.66,.76];K.prism(M.glass,f,plan,y0,H,null,null);sk66Mullions(K,f,plan,y0,H,M,[.85,.87,.9],true);
 K.tint=[.86,.86,.84];K.prism(M.roof,f,plan,H,H+.3,M.roof,null);K.tint=[.97,.97,.97];
 const ring=ct48GcGrow(plan,.3);ring.forEach(([x,z],i)=>{const [x2,z2]=ring[(i+1)%ring.length];for(let k=0;k<3;k++){const t=(k+.5)/3,px=x+(x2-x)*t,pz=z+(z2-z)*t,bh=10+14*Math.cos((i*3+k)/(ring.length*3)*Math.PI*2)**2;const p=K.at(f,px,0,pz);K.box({...f,x:p[0],z:p[2]},0,H+bh/2,0,.5,bh,.5,M.plain);}});
 (W.sk66Beacons||=[]).push(K.at(f,0,H+25,0));
}
// Circle on Cavill: elliptical towers ringed by white balconies, open crown ring.
function sk66Circle(K,W,f,M,H,seed){
 const y0=sk66Podium(K,f,40,36,M,2),plan=ct48GcCCW(ct48GcPlan('ellipse',26,32,seed)),ring=ct48GcGrow(plan,1.6);K.tint=[.66,.8,.84];K.prism(M.glass,f,plan,y0,H,null,null);
 for(let y=y0+3.2;y<H-1;y+=3.2){K.tint=[.98,.98,.97];K.prism(M.plain,f,ring,y-.24,y,M.plain,M.plain);K.tint=[1,1,1];K.band(M.railGlass,f,ring,y,y+1.05);}
 K.tint=[.97,.97,.97];K.prism(M.roof,f,plan,H,H+.3,M.roof,null);const cr=ct48GcGrow(plan,2.2);K.band(M.plain,f,cr,H+7,H+9.5);cr.filter((p,i)=>i%2===0).forEach(([x,z])=>{const p=K.at(f,x,0,z);K.box({...f,x:p[0],z:p[2]},0,H+4.6,0,.5,9.2,.5,M.plain);});
 (W.sk66Beacons||=[]).push(K.at(f,0,H+10,0));
}
const SK66_GC_LANDMARKS=[
 {name:'Q1',x:900,z:-250,r:44,build:(K,W,f,M)=>sk66Q1(K,W,f,M)},
 {name:'Soul',x:985,z:-385,r:38,build:(K,W,f,M)=>sk66Soul(K,W,f,M)},
 {name:'Jewel 1',x:640,z:-392,r:28,build:(K,W,f,M)=>sk66Jewel(K,W,f,M,183,3)},
 {name:'Jewel 2',x:700,z:-392,r:28,build:(K,W,f,M)=>sk66Jewel(K,W,f,M,169,4)},
 {name:'Jewel 3',x:760,z:-392,r:28,build:(K,W,f,M)=>sk66Jewel(K,W,f,M,160,5)},
 {name:'Hilton Orchid',x:835,z:-120,r:30,build:(K,W,f,M)=>sk66Hilton(K,W,f,M,169,6)},
 {name:'Hilton',x:880,z:-70,r:30,build:(K,W,f,M)=>sk66Hilton(K,W,f,M,155,7)},
 {name:'Circle on Cavill N',x:1010,z:-175,r:28,build:(K,W,f,M)=>sk66Circle(K,W,f,M,158,8)},
 {name:'Circle on Cavill S',x:1050,z:-120,r:28,build:(K,W,f,M)=>sk66Circle(K,W,f,M,126,9)},
];

// ---------- Street lights, beacons ----------
function sk66StreetLights(W){
 const T=THREE,walls=ct48GcWalls(W),list=[],lots=W.ct48GcLots||[];
 for(const s of walls.streets||[])for(const side of [-1,1]){const o=s.off[side]+1.7;
  for(let u=12;u<s.l-8;u+=36){const x=s.a.x+s.vx*u+s.nx*side*o,z=s.a.z+s.vz*u+s.nz*side*o;
   if(ct48GcInside(W,x,z,1.2)||W.nearest({x,z}).distance<CT48_GC.lane+2.5)continue;if(W.pit?.samples&&(W.pitDistance(x,z)<12||ct48PitFloor(W,x,z,4)!==null))continue;
   if((W.ct48Reserved||[]).some(q=>Math.hypot(q.x-x,q.z-z)<q.r)||lots.some(q=>Math.abs((x-q.x)*q.ax.x+(z-q.z)*q.ax.z)<q.w/2+.6&&Math.abs((x-q.x)*q.az.x+(z-q.z)*q.az.z)<q.d/2+.6))continue;
   list.push([x,z,Math.atan2(s.nz*side,-s.nx*side)]);}}
 if(!list.length)return;
 const pole=new T.CylinderGeometry(.07,.11,9,6);pole.translate(0,4.5,0);const arm=new T.BoxGeometry(2.6,.1,.1);arm.translate(1.3,8.85,0);const merged=sk66Merge([pole,arm]);
 const head=new T.BoxGeometry(.9,.16,.34);head.translate(2.55,8.78,0);
 const mat=new T.MeshStandardMaterial({color:'#8b9196',roughness:.45,metalness:.6}),lamp=new T.MeshStandardMaterial({color:'#d8d8d0',emissive:'#ffd9a0',emissiveIntensity:.15,roughness:.3});W.sk66LampMat=lamp;
 const d=new T.Object3D(),mk=(g,m,name)=>{const im=new T.InstancedMesh(g,m,list.length);list.forEach(([x,z,yaw],i)=>{d.position.set(x,-.05,z);d.rotation.set(0,yaw,0);d.updateMatrix();im.setMatrixAt(i,d.matrix);});im.name=name;im.computeBoundingSphere();W.world.add(im);return im;};
 mk(merged,mat,'Street lights').castShadow=true;mk(head,lamp,'Street light lamps');W.sk66Stats.streetLights=list.length;sk66Hook(W);
}
function sk66Merge(gs){const p=[],n=[],ix=[];for(const g0 of gs){const g=g0.index?g0:g0;const b=p.length/3;p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);for(const i of g.index.array)ix.push(i+b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(ix);return g;}
function sk66Beacons(W){
 const list=W.sk66Beacons||[];if(!list.length)return;const T=THREE,m=new T.InstancedMesh(new T.SphereGeometry(.45,8,6),new T.MeshBasicMaterial({color:new T.Color(3,.1,.06),toneMapped:false}),list.length),d=new T.Object3D();
 list.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.updateMatrix();m.setMatrixAt(i,d.matrix);});m.name='Aviation beacons';m.computeBoundingSphere();m.castShadow=false;W.world.add(m);W.sk66Beacon=m;W.sk66Stats.beacons=list.length;sk66Hook(W);
}

// ---------- City builds ----------
const sk66BuildBase=ct48BuildGoldCoast;
ct48BuildGoldCoast=function(W){
 W.sk66Lod=[];W.sk66Beacons=[];W.sk66Hooked=false;W.sk66Stats={};const gc=W.e?.key==='goldcoast';
 const marks=[];if(gc)for(const L of SK66_GC_LANDMARKS){if(W.nearest({x:L.x,z:L.z}).distance<L.r+25)continue;marks.push(L);(W.ct48Reserved||=[]).push({x:L.x,z:L.z,r:L.r});}
 const out=sk66BuildBase.apply(this,arguments);
 if(marks.length){const K=new CT48GcKit(W),M=ct48GcMaterials(W);for(const L of marks){const f=sk66Frame(L.x,L.z);K.begin(f);L.build(K,W,f,M);(W.ct48GcLots||=[]).push({x:L.x,z:L.z,ax:f.ax,az:f.az,w:L.r*1.4,d:L.r*1.4});}K.flush('Gold Coast landmarks');W.sk66Stats.landmarks=marks.map(L=>L.name);}
 sk66StreetLights(W);sk66Beacons(W);
 return out;
};
const sk66HomebushBase=ct52BuildHomebush;
ct52BuildHomebush=function(W){W.sk66Lod=[];W.sk66Beacons=[];W.sk66Hooked=false;W.sk66Stats={};const out=sk66HomebushBase.apply(this,arguments);sk66Beacons(W);return out;};
