/* tl54: Falcon FG X and Commodore ZB tail lamps and grille backing.
   The model's 'tail' bucket was one flat ruby-red emissive surface, and braking pushed
   its emissive to 3.8, which ACES tone mapping washes out to pink-white. The lamps are
   now dark smoked lenses with unlit light guides, chrome and clear reverse sections
   drawn in the shader, and only the red elements glow, at a level that stays red. */
(function(){
const T=THREE;

// Per-vertex lamp coordinates: s runs along the lamp from the wrap-around side end (0)
// to the inboard end by the boot (1); v runs bottom (0) to top (1) of the lens at that s.
// Vertices near the centreline belong to the high-mount stop light (s=-1).
function tl54LampCoords(g){
 if(g.attributes.tl54Lamp)return;
 const p=g.attributes.position,n=p.count,out=new Float32Array(n*2);
 let xo=0,zmin=1e9;for(let i=0;i<n;i++){const ax=Math.abs(p.getX(i));if(ax>.2){xo=Math.max(xo,ax);zmin=Math.min(zmin,p.getZ(i));}}
 const s=new Float32Array(n);let smin=1e9,smax=-1e9;
 for(let i=0;i<n;i++){if(Math.abs(p.getX(i))<=.2)continue;s[i]=(xo-Math.abs(p.getX(i)))-(p.getZ(i)-zmin);smin=Math.min(smin,s[i]);smax=Math.max(smax,s[i]);}
 const bins=24,lo=new Float32Array(bins).fill(1e9),hi=new Float32Array(bins).fill(-1e9),bin=i=>Math.min(bins-1,Math.max(0,Math.floor((s[i]-smin)/(smax-smin)*bins)));
 for(let i=0;i<n;i++){if(Math.abs(p.getX(i))<=.2)continue;const b=bin(i),y=p.getY(i);lo[b]=Math.min(lo[b],y);hi[b]=Math.max(hi[b],y);}
 for(let b=1;b<bins;b++)if(lo[b]>hi[b]){lo[b]=lo[b-1];hi[b]=hi[b-1];}
 for(let i=0;i<n;i++){
  if(Math.abs(p.getX(i))<=.2){out[i*2]=-1;out[i*2+1]=0;continue;}
  const b=bin(i);out[i*2]=(s[i]-smin)/(smax-smin);out[i*2+1]=hi[b]>lo[b]?(p.getY(i)-lo[b])/(hi[b]-lo[b]):.5;
 }
 g.setAttribute('tl54Lamp',new T.BufferAttribute(out,2));
}

const TL54_PATTERN={
 // Commodore ZB: smoked lens, a full-length upper light guide, a shorter lower guide
 // on the inboard half and a clear reverse lamp with a chrome strip below it.
 Holden:`
  float top=tl54Band(lv,.73,.075)*smoothstep(.05,.14,ls);
  float low=tl54Band(lv,.47,.06)*smoothstep(.36,.44,ls)*(1.0-smoothstep(.97,1.0,ls));
  float hook=tl54Band(ls,.40+lv*.05,.035)*step(.47,lv)*step(lv,.73);
  guide=max(top,max(low,hook));
  clear=smoothstep(.64,.68,ls)*(1.0-smoothstep(.34,.38,lv));
  chrome=(tl54Band(lv,.38,.016)+tl54Band(lv,.17,.014))*smoothstep(.64,.68,ls);
  lens=1.0-clear;`,
 // Falcon FG X: deep red outer lens with a faceted reflector, then a clear inboard
 // section split by a chrome bar with a thin red guide above it.
 Ford:`
  float split=ls+(lv-.5)*.10;float inner=smoothstep(.60,.63,split);
  float facets=.5+.5*sin(lv*58.0);
  float reflector=(1.0-inner)*smoothstep(.22,.32,lv)*(1.0-smoothstep(.72,.82,lv))*smoothstep(.06,.16,ls);
  guide=max(reflector*(.55+.45*facets),inner*tl54Band(lv,.80,.06)*(1.0-smoothstep(.96,1.0,ls)));
  chrome=inner*tl54Band(lv,.64,.045)+tl54Band(split,.615,.012);
  clear=inner*(1.0-smoothstep(.58,.62,lv));
  lens=1.0-clear;`
};

function tl54Material(m,make){
 if(m.userData.tl54)return;m.userData.tl54={brake:{value:0},tail:{value:0}};
 const u=m.userData.tl54;m.color.set('#ffffff');m.emissive.set('#000000');m.emissiveIntensity=0;m.roughness=.16;m.metalness=.05;
 m.onBeforeCompile=sh=>{
  sh.uniforms.tl54Brake=u.brake;sh.uniforms.tl54Tail=u.tail;
  sh.vertexShader='attribute vec2 tl54Lamp;\nvarying vec2 tl54L;\nvarying vec3 tl54P;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntl54L=tl54Lamp;tl54P=position;');
  sh.fragmentShader='uniform float tl54Brake;\nuniform float tl54Tail;\nvarying vec2 tl54L;\nvarying vec3 tl54P;\nfloat tl54Band(float x,float c,float w){return 1.0-smoothstep(w*.5,w*.5+.012,abs(x-c));}\n'+sh.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
  float ls=tl54L.x,lv=tl54L.y,guide=0.0,clear=0.0,chrome=0.0,lens=1.0,glow=0.0;
  if(ls<-.5){
   // High-mount stop light: dark housing with an LED dot matrix.
   vec2 cell=fract(vec2(tl54P.x*95.0,tl54P.y*85.0))-.5;guide=1.0-smoothstep(.22,.32,length(cell));
   diffuseColor.rgb=mix(vec3(.035,.006,.008),vec3(.20,.015,.02),guide);glow=guide*tl54Brake*2.4;
  }else{
   ${TL54_PATTERN[make]}
   float edge=smoothstep(.0,.06,lv)*smoothstep(1.0,.94,lv);
   vec3 c=vec3(.065,.006,.010)*(.65+.35*edge);
   c=mix(c,vec3(.24,.016,.024),guide);
   c=mix(c,vec3(.07,.064,.068),clear);
   c=mix(c,vec3(.50,.52,.54),clamp(chrome,0.0,1.0));
   diffuseColor.rgb=c;
   glow=(guide*(tl54Brake*1.35+tl54Tail*.45)+lens*(1.0-guide)*(tl54Brake*.16+tl54Tail*.05))*(1.0-clamp(chrome,0.0,1.0));
  }`)
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=vec3(1.0,.025,.035)*glow;')
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.6,clamp(chrome,0.0,1.0));');
 };
 m.customProgramCacheKey=()=>'tl54Tail'+make;m.needsUpdate=true;
}

// A matte black panel behind each grille so the slats no longer show daylight.
function tl54GrilleBacking(car,make){
 const shape=new T.Shape();
 if(make==='Holden'){shape.moveTo(-.47,.635);shape.quadraticCurveTo(0,.655,.47,.635);shape.quadraticCurveTo(.49,.48,.40,.33);shape.quadraticCurveTo(0,.30,-.40,.33);shape.quadraticCurveTo(-.49,.48,-.47,.635);}
 else{shape.moveTo(-.50,.63);shape.quadraticCurveTo(0,.69,.50,.63);shape.lineTo(.44,.33);shape.quadraticCurveTo(0,.25,-.44,.33);shape.closePath();}
 const geo=new T.ShapeGeometry(shape,10),mat=new T.MeshStandardMaterial({color:'#07090b',roughness:.9,metalness:.05,side:T.DoubleSide});
 const z=make==='Holden'?2.385:2.355;
 // Baked into the geometry (identity transform) so the ph47 crumple shader folds it with the nose.
 geo.translate(0,0,z);(car.userData.dc35Chassis||[]).forEach(level=>{const panel=new T.Mesh(geo,mat);panel.name='Grille backing';level.add(panel);});
}

const tl54Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=tl54Car(E,team,driver),make=car.userData.make,m=car.userData.dc35Mats?.tail;
 if(!car.userData.dc35Car||!['Ford','Holden'].includes(make)||!m)return car;
 car.traverse(o=>{if(o.isMesh&&o.userData.dc35Bucket==='tail')tl54LampCoords(o.geometry);});
 tl54Material(m,make);tl54GrilleBacking(car,make);
 return car;
};

// rf39Lighting decides braking/headlights each frame; turn that into lamp levels,
// with a short ramp so the LEDs don't flicker on tiny decelerations.
const tl54Render=dcRenderWorld;
dcRenderWorld=function(W,L,dt){
 tl54Render(W,L,dt);
 for(const x of L.entrants){const car=W.carNodes.get(x.d.id),u=car?.userData.dc35Mats?.tail?.userData.tl54;if(!u)continue;
  const st=car.userData.rf39LightState||{},k=Math.min(1,(dt||1/60)*28);
  u.brake.value+=((st.braking?1:0)-u.brake.value)*k;u.tail.value=st.headlights?1:0;
  car.userData.dc35Mats.tail.emissiveIntensity=0;
  if(car.userData.rf39LightState)car.userData.rf39LightState.tailIntensity=u.brake.value*1.35+u.tail.value*.45;}
};
})();
