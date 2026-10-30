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
}
// The script is painted onto the grille itself: a finely divided strip is laid onto the frontmost grille surface
// (raycast straight back from the nose at every vertex, 1 mm proud), bowed into a gentle smile, so it follows the slats.
const GB75_W=.30,GB75_H=GB75_W/4,GB75_Y=.462,GB75_K=.45;
function gb75ScriptGeo(level){
 level.updateMatrixWorld(true);const inv=level.matrixWorld.clone().invert(),hits=[];
 level.traverse(o=>{if(o.isMesh&&!o.userData.gb75Script&&!o.material.transparent&&o.visible)hits.push(o);});
 const g=new T.PlaneGeometry(GB75_W,GB75_H,96,24),P=g.attributes.position,rc=new T.Raycaster(),o=new T.Vector3(),d=new T.Vector3(0,0,-1).transformDirection(level.matrixWorld),v=new T.Vector3();
 for(let i=0;i<P.count;i++){
  const x=P.getX(i),y=P.getY(i)+GB75_Y+GB75_K*P.getX(i)**2;
  o.set(x,y,3.4).applyMatrix4(level.matrixWorld);rc.set(o,d);rc.far=1.4;
  const h=rc.intersectObjects(hits,false)[0];let z=2.533;
  if(h){v.copy(h.point).applyMatrix4(inv);z=v.z+.001;}
  P.setXYZ(i,x,y,z);
 }
 // one smooth skin over the slat faces: each column takes the frontmost slat face in it (the strip follows the grille's
 // sweep without diving into the gaps, which shredded the letters at an angle), then a light sideways smooth
 const C=97,Rw=25,F=[];for(let c=0;c<C;c++){let m=-9;for(let r=0;r<Rw;r++)m=Math.max(m,P.getZ(r*C+c));F.push(m);}
 for(let c=0;c<C;c++){let t=0,n=0;for(let d=-3;d<=3;d++){const k=c+d;if(k>=0&&k<C){t+=F[k];n++;}}for(let r=0;r<Rw;r++)P.setZ(r*C+c,t/n+.0015);}
 g.computeVertexNormals();return g;
}
const gb75Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=gb75Car(E,team,driver),u=car.userData;
 if(!u.dc35Car||u.make!=='Holden')return car;
 let key='';try{key=sc27LiveryProfile(team,driver)?.key||'';}catch(e){}
 if(key!=='redbull')return car;
 gb75Materials();
 (u.dc35Chassis||[]).forEach((level,i)=>{
  const chrome=[];level.traverse(o=>{if(o.isMesh&&o.userData.dc35Bucket==='badge_chrome')chrome.push(o);});
  for(const o of chrome){const s=gb75SplitBars(o.geometry);if(!s.bars)continue;o.geometry=s.rest;
   const bars=new T.Mesh(s.bars,gb75Mat);bars.name='Gloss black grille bars';bars.castShadow=false;bars.receiveShadow=true;bars.userData.dc35Bucket='badge_black';o.parent.add(bars);}
  if(i<2){const g=gb75ScriptGeo(level);if(g.attributes.position.count){const m=new T.Mesh(g,gb75Script);m.name='Painted Holden grille script';m.userData.gb75Script=true;m.renderOrder=2;m.castShadow=false;m.receiveShadow=true;level.add(m);}}
 });
 return car;
};
})();
