/* gb75: Triple Eight (Red Bull) ZB grille as on the 2020 car: the two long chrome bars either side of the
   lion badge are painted gloss black (same geometry), and a painted white Holden script sits on the grille
   under the badge. Only cars wearing the 'redbull' livery (#88 and #888). */
(function(){
const T=THREE;
// The grille chrome (bucket badge_chrome) is one mesh: surround, wing bars, lower plate (+ the badge as its own piece).
// The wing bars are the triangles lying between the badge and the surround, 0.50 < y < 0.607.
function gb75SplitBars(geo){
 if(geo.userData.gb75)return geo.userData.gb75;
 const P=geo.attributes.position,I=geo.index?geo.index.array:null,n=I?I.length:P.count,bars=[],rest=[];
 for(let t=0;t<n;t+=3){const a=I?I[t]:t,b=I?I[t+1]:t+1,c=I?I[t+2]:t+2;
  const x=(P.getX(a)+P.getX(b)+P.getX(c))/3,y0=Math.min(P.getY(a),P.getY(b),P.getY(c)),y1=Math.max(P.getY(a),P.getY(b),P.getY(c));
  (Math.abs(x)>.07&&Math.abs(x)<.475&&y0>.50&&y1<.607?bars:rest).push(a,b,c);}
 const mk=list=>{const g=new T.BufferGeometry();for(const k in geo.attributes)g.setAttribute(k,geo.attributes[k]);g.setIndex(list);g.boundingBox=geo.boundingBox;g.boundingSphere=geo.boundingSphere;return g;};
 return geo.userData.gb75={bars:bars.length?mk(bars):null,rest:mk(rest)};
}
let gb75Mat=null,gb75Script=null;
function gb75Materials(){
 if(gb75Mat)return;
 gb75Mat=new T.MeshPhysicalMaterial({color:'#050607',metalness:0,roughness:.14,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.1,side:T.DoubleSide});
 // Real Holden wordmark artwork (assets/img/6bb14b7642.png), recoloured white on a canvas.
 const c=document.createElement('canvas');c.width=1024;c.height=256;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;
 const img=new Image();img.onload=()=>{const x=c.getContext('2d'),s=Math.min((c.width-16)/img.width,(c.height-16)/img.height),w=img.width*s,h=img.height*s;
  x.clearRect(0,0,c.width,c.height);x.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h);x.globalCompositeOperation='source-in';x.fillStyle='#eceef0';x.fillRect(0,0,c.width,c.height);tex.needsUpdate=true;};
 img.src='assets/img/6bb14b7642.png';
 gb75Script=new T.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.04,depthWrite:false,roughness:.42,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 gb75Script.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float gbSlat;varying float vGbSlat;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGbSlat=gbSlat;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGbSlat;').replace('#include <alphatest_fragment>','diffuseColor.rgb*=mix(.22,1.,smoothstep(.3,.7,vGbSlat));\n#include <alphatest_fragment>');};
 gb75Script.customProgramCacheKey=()=>'gb75slat';
}
// The script is painted onto the grille itself: a finely divided strip is laid onto the frontmost grille surface
// (raycast straight back from the nose at every vertex, 1 mm proud), bowed into a gentle smile, so it follows the slats.
const GB75_W=.30,GB75_H=GB75_W/4,GB75_Y=.462,GB75_K=.45;
function gb75ScriptGeo(level){
 // Rays run straight back (-z) in the car's own frame, so instead of raycasting the whole car (that froze session
 // loading for minutes) the few triangles under the script's patch are gathered once and hit-tested in x/y.
 level.updateMatrixWorld(true);const inv=level.matrixWorld.clone().invert(),m4=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),tri=[];
 const x0=-GB75_W/2-.01,x1=GB75_W/2+.01,y0=GB75_Y-GB75_H/2-.01,y1=GB75_Y+GB75_H/2+GB75_K*(GB75_W/2)**2+.01,zMin=2.0,zMax=3.4;
 level.traverse(o=>{if(!o.isMesh||o.userData.gb75Script||o.material.transparent||!o.visible)return;
  const g=o.geometry,P=g.attributes.position,I=g.index?g.index.array:null,n=I?I.length:P.count;m4.multiplyMatrices(inv,o.matrixWorld);
  for(let t=0;t<n;t+=3){a.fromBufferAttribute(P,I?I[t]:t).applyMatrix4(m4);b.fromBufferAttribute(P,I?I[t+1]:t+1).applyMatrix4(m4);c.fromBufferAttribute(P,I?I[t+2]:t+2).applyMatrix4(m4);
   if(Math.max(a.x,b.x,c.x)<x0||Math.min(a.x,b.x,c.x)>x1||Math.max(a.y,b.y,c.y)<y0||Math.min(a.y,b.y,c.y)>y1||Math.max(a.z,b.z,c.z)<zMin||Math.min(a.z,b.z,c.z)>zMax)continue;
   tri.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);}});
 const front=(x,y)=>{let best=-Infinity;for(let k=0;k<tri.length;k+=9){const ax=tri[k],ay=tri[k+1],bx=tri[k+3],by=tri[k+4],cx=tri[k+6],cy=tri[k+7],d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-12)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,w=1-u-v;if(u<0||v<0||w<0)continue;const z=u*tri[k+2]+v*tri[k+5]+w*tri[k+8];if(z>best&&z<=zMax&&z>=zMin)best=z;}return best;};
 const g=new T.PlaneGeometry(GB75_W,GB75_H,96,60),P=g.attributes.position,Hz=new Float32Array(P.count);
 for(let i=0;i<P.count;i++){
  const x=P.getX(i),y=P.getY(i)+GB75_Y+GB75_K*P.getX(i)**2,h=front(x,y);Hz[i]=h;
  P.setXYZ(i,x,y,h>-Infinity?h+.001:2.533);
 }
 // one smooth skin over the slat faces: each column takes the frontmost slat face in it (the strip follows the grille's
 // sweep without diving into the gaps, which shredded the letters at an angle), then a light sideways smooth
 const C=97,Rw=61,F=[];for(let c=0;c<C;c++){let m=-9;for(let r=0;r<Rw;r++)m=Math.max(m,P.getZ(r*C+c));F.push(m);}
 for(let c=0;c<C;c++){let t=0,n=0;for(let d=-3;d<=3;d++){const k=c+d;if(k>=0&&k<C){t+=F[k];n++;}}for(let r=0;r<Rw;r++)P.setZ(r*C+c,t/n+.0015);}
 // paint only lands on the slat faces: where the grille surface sits more than 2.5 mm behind the nearest slat face (within 1 cm up or down) it's a gap: the paint there sits in the slat's shadow, so the letters read but the slats show through
 const sl=new Float32Array(P.count);for(let r=0;r<Rw;r++)for(let c=0;c<C;c++){const i=r*C+c;let m=-Infinity;for(let d=-8;d<=8;d++){const rr=r+d;if(rr>=0&&rr<Rw)m=Math.max(m,Hz[rr*C+c]);}sl[i]=Hz[i]>-Infinity&&Hz[i]>=m-.0025?1:0;}
 g.setAttribute('gbSlat',new T.BufferAttribute(sl,1));
 g.computeVertexNormals();return g;
}
// The bonnet crumple and dents the painted panels get on the GPU (rf41, also given to trim by dm71), so the bars and
// script move with the grille they sit on.
const GB75_DAMAGE=`float gbBon=smoothstep(1.0,1.5,position.z)*smoothstep(.5,.76,position.y);
 transformed.y+=gbBon*rf41Crumple*(.045*sin(position.x*14.0+position.z*11.0)-.075);
 transformed.z-=gbBon*rf41Crumple*(.035+.025*sin(position.x*9.0));
 float gbDent=max(0.0,1.0-length((position.xz-rf41Dent.xy)*vec2(1.0,.8))/.85)*rf41Dent.z*step(.28,position.y);
 transformed.x-=sign(rf41Dent.x)*gbDent*.12;transformed.y-=gbDent*.035;transformed.z-=sign(rf41Dent.y)*gbDent*.08;`;
function gb75Damage(mat,state){
 if(!state?.crumple||!state?.dent)return;const before=mat.onBeforeCompile,key=mat.customProgramCacheKey();
 mat.onBeforeCompile=function(sh,r){before?.call(this,sh,r);sh.uniforms.rf41Crumple=state.crumple;sh.uniforms.rf41Dent=state.dent;
  sh.vertexShader='uniform float rf41Crumple;uniform vec4 rf41Dent;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+GB75_DAMAGE);};
 mat.customProgramCacheKey=()=>key+'|gb75dmg';
}
const gb75Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=gb75Car(E,team,driver),u=car.userData;
 if(!u.dc35Car||u.make!=='Holden')return car;
 let key='';try{key=sc27LiveryProfile(team,driver)?.key||'';}catch(e){}
 if(key!=='redbull')return car;
 gb75Materials();
 // Each car gets its own copies: the crash crumple (ph47) binds a material to the first car that wears it, so shared
 // bars and script followed the other Red Bull car's damage and floated off this one's crushed nose.
 const mat=gb75Mat.clone(),script=gb75Script.clone();script.onBeforeCompile=gb75Script.onBeforeCompile;script.customProgramCacheKey=gb75Script.customProgramCacheKey;
 gb75Damage(mat,u.dc35State);gb75Damage(script,u.dc35State);
 // a crumpled grille is coarser than the finely divided script, so give the paint a little more depth bias to stay on top
 script.polygonOffsetFactor=-4;script.polygonOffsetUnits=-8;
 (u.dc35Chassis||[]).forEach((level,i)=>{
  const chrome=[];level.traverse(o=>{if(o.isMesh&&o.userData.dc35Bucket==='badge_chrome')chrome.push(o);});
  for(const o of chrome){const s=gb75SplitBars(o.geometry);if(!s.bars)continue;o.geometry=s.rest;
   const bars=new T.Mesh(s.bars,mat);bars.name='Gloss black grille bars';bars.castShadow=false;bars.receiveShadow=true;bars.userData.dc35Bucket='badge_black';o.parent.add(bars);}
  if(i<2){const g=gb75ScriptGeo(level);if(g.attributes.position.count){const m=new T.Mesh(g,script);m.name='Painted Holden grille script';m.userData.gb75Script=true;m.renderOrder=2;m.castShadow=false;m.receiveShadow=true;level.add(m);}}
 });
 return car;
};
// Dents pressed into the panels on the CPU (dc36, mirrored onto trim by dm71) press the painted script in too;
// dm71 leaves transparent meshes alone, and the script is one.
const gb75Running=SC25World.prototype.applyRunningDamage;
SC25World.prototype.applyRunningDamage=function(car,x){
 gb75Running.call(this,car,x);const u=car?.userData;if(!u?.dc35Car||x.retired||!u.dc35Chassis)return;
 const rev=x.sc30DamageRevision||0;if(u.gb75Rev===rev)return;u.gb75Rev=rev;const dents=x.sc30Dents||[];
 for(const chassis of u.dc35Chassis)for(const m of chassis.children){if(!m.userData.gb75Script)continue;
  const p=m.geometry.attributes.position;if(!m.userData.gb75Base){if(!dents.length)continue;m.userData.gb75Base=p.array.slice();}const base=m.userData.gb75Base;p.array.set(base);
  for(const d of dents)for(let i=0;i<p.count;i++){const xx=base[i*3],yy=base[i*3+1],zz=base[i*3+2],f=Math.max(0,1-Math.hypot((xx-d.x)*.9,(yy-.65)*.65,(zz-d.z)*.8)/.95)*d.strength;if(yy>.28)p.setXYZ(i,xx-Math.sign(d.x||1)*f*.16,yy-f*.045,zz-Math.sign(d.z||1)*f*.08);}
  p.needsUpdate=true;m.geometry.computeBoundingSphere();}
};
})();
