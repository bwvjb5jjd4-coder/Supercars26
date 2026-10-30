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
 const c=document.createElement('canvas');c.width=1024;c.height=256;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
 const img=new Image();img.onload=()=>{const x=c.getContext('2d'),s=Math.min((c.width-16)/img.width,(c.height-16)/img.height),w=img.width*s,h=img.height*s;
  x.clearRect(0,0,c.width,c.height);x.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h);x.globalCompositeOperation='source-in';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);tex.needsUpdate=true;};
 img.src='assets/img/6bb14b7642.png';
 gb75Script=new T.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.04,depthWrite:false,roughness:.3,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
}
function gb75ScriptGeo(){
 // 0.25 m wide script under the badge, just proud of the slats (z 2.526); baked offset keeps the ph47 crumple working
 const w=.25,h=w/4,g=new T.PlaneGeometry(w,h);g.translate(0,.466,2.533);return g;
}
let gb75Geo=null;
const gb75Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=gb75Car(E,team,driver),u=car.userData;
 if(!u.dc35Car||u.make!=='Holden')return car;
 let key='';try{key=sc27LiveryProfile(team,driver)?.key||'';}catch(e){}
 if(key!=='redbull')return car;
 gb75Materials();gb75Geo||=gb75ScriptGeo();
 (u.dc35Chassis||[]).forEach((level,i)=>{
  const chrome=[];level.traverse(o=>{if(o.isMesh&&o.userData.dc35Bucket==='badge_chrome')chrome.push(o);});
  for(const o of chrome){const s=gb75SplitBars(o.geometry);if(!s.bars)continue;o.geometry=s.rest;
   const bars=new T.Mesh(s.bars,gb75Mat);bars.name='Gloss black grille bars';bars.castShadow=false;bars.receiveShadow=true;bars.userData.dc35Bucket='badge_black';o.parent.add(bars);}
  if(i<2){const m=new T.Mesh(gb75Geo,gb75Script);m.name='Painted Holden grille script';m.renderOrder=2;m.castShadow=false;level.add(m);}
 });
 return car;
};
})();
