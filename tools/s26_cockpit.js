/* s26c Supercars 26 cockpit: a right-hand-drive Gen3 Supercar cabin for the Camaro, Mustang and Supra.
   The Gen3 bodies were carrying the Supercars 18 interior mirrored across, clipped wherever it poked
   through the new roofs, so from the seat you looked at a half-missing dash, the back of the livery
   through the gaps, and an info screen still turned toward the left-hand seat.
   For the cars that get a cockpit (the player, and player 2 in Co-Op) the old interior is hidden and a
   Gen3 cabin is built inside the body instead:
     - a carbon dash that runs up to the base of the windscreen, with a hooded binnacle over the driver's
       display and the centre screen set into it, turned toward the right-hand seat;
     - door cards fitted to the inside of each body (measured from the body's own panels), a firewall,
       floor, transmission tunnel, rear bulkhead and parcel shelf, so no paint is visible from inside;
     - a fitted chrome-moly roll cage (main hoop, A-pillar bars, roof bars and X, NASCAR door bars);
     - a carbon race seat, a centre switch panel with lit keys, a sequential shifter on the driver's left.
   The onboard eye also sits a little lower (S26C_EYE_DROP). Built by tools/build_s26_cockpit.py. */
(function(){
'use strict';
// Installs after the Supercars 26 layer, whichever order the two scripts end up in the page.
function install(){
if(install.done||typeof sc25Car!=='function'||!window.S26)return;install.done=true;
const T=THREE,rad=Math.PI/180;
// Per body, in car space (+X car's left, +Z forward, metres). The driver sits at x -.37.
//  ws: windscreen base at the centre, lip: the dash's rear edge, belt: the bottom of the side glass,
//  roof: the underside of the roof over the seat, hoop: main hoop z, rear: rear bulkhead z.
const S26C={
 camaro:{hdr:.40,ws:[.935,.97],lip:[.905,.72],belt:.925,roof:1.235,hoop:-.6,rear:-1.05,shelf:.93},
 mustang:{hdr:.30,ws:[.935,.92],lip:[.905,.70],belt:.94,roof:1.28,hoop:-.6,rear:-1.0,shelf:.98},
 supra:{hdr:.26,ws:[.905,.80],lip:[.875,.66],belt:.88,roof:1.19,hoop:-.58,rear:-1.05,shelf:.9}
};
window.S26C=S26C;
window.S26C_EYE_DROP=window.S26C_EYE_DROP??.03;

/* ---------- materials ---------- */
function carbonTex(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle='#0d0e10';x.fillRect(0,0,256,256);
 // 2x2 twill: diagonal bands of tows, each tow a little lighter along its weave direction
 const n=16,s=256/n;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){
  const warp=((i+j)>>1)%2===0,g=x.createLinearGradient(i*s,j*s,warp?i*s+s:i*s,warp?j*s:j*s+s);
  const a=warp?'#1d2024':'#15171a',b=warp?'#2a2e33':'#1f2226';g.addColorStop(0,a);g.addColorStop(.5,b);g.addColorStop(1,a);
  x.fillStyle=g;x.fillRect(i*s+.5,j*s+.5,s-1,s-1);
 }
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
function mats(){
 if(mats.m)return mats.m;
 const cf=carbonTex();
 const M=mats.m={
  carbon:new T.MeshStandardMaterial({map:cf,color:'#ffffff',roughness:.38,metalness:.25}),
  satin:new T.MeshStandardMaterial({map:cf,color:'#8a8d92',roughness:.7,metalness:.1}),
  black:new T.MeshStandardMaterial({color:'#0c0d0f',roughness:.85,metalness:0}),
  floor:new T.MeshStandardMaterial({color:'#1a1b1d',roughness:.95,metalness:0}),
  cage:new T.MeshStandardMaterial({color:'#a9adb2',roughness:.5,metalness:.5}),
  pad:new T.MeshStandardMaterial({color:'#161719',roughness:.95,metalness:0}),
  alloy:new T.MeshStandardMaterial({color:'#9aa0a6',roughness:.3,metalness:.85}),
  red:new T.MeshStandardMaterial({color:'#d32026',roughness:.45,metalness:.1}),
  keys:['#d8282b','#f0b51c','#2fbf5b','#2a7de1','#e8e8e8','#1b1c1e'].map(c=>new T.MeshStandardMaterial({color:'#202225',roughness:.4,emissive:c,emissiveIntensity:c==='#1b1c1e'?0:.9})),
  label:new T.MeshBasicMaterial({color:'#d9dde0',toneMapped:false})
 };
 for(const m of [M.carbon,M.satin,M.black,M.floor,M.pad])m.side=T.DoubleSide;
 return M;
}

/* ---------- geometry helpers ---------- */
// Box-projected UVs (5 cm of weave per 0.1 of texture), so the carbon reads at the same scale everywhere.
function boxUV(g,k=4){
 g=g.index?g.toNonIndexed():g;g.computeVertexNormals();
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));let u,v;
  if(ax>=ay&&ax>=az){u=p.getZ(i);v=p.getY(i);}else if(ay>=az){u=p.getX(i);v=p.getZ(i);}else{u=p.getX(i);v=p.getY(i);}
  uv[i*2]=u*k;uv[i*2+1]=v*k;}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));return g;
}
// A quad strip surface from a grid of points [rows][cols] of [x,y,z].
function sheet(grid){
 const R=grid.length,C=grid[0].length,pos=[],idx=[];
 for(const r of grid)for(const p of r)pos.push(...p);
 for(let i=0;i<R-1;i++)for(let j=0;j<C-1;j++){const a=i*C+j,b=a+1,c=a+C,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);return boxUV(g);
}
// A tube between two points.
function tube(a,b,r){
 const A=new T.Vector3(...a),B=new T.Vector3(...b),len=A.distanceTo(B),g=new T.CylinderGeometry(r,r,len,14,1,true);
 const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),B.clone().sub(A).normalize());
 g.applyQuaternion(q);const m=A.clone().add(B).multiplyScalar(.5);g.translate(m.x,m.y,m.z);return g;
}
function merge(list){
 const geos=list.map(g=>{g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!g.attributes.normal)g.computeVertexNormals();return g;});
 let n=0;for(const g of geos)n+=g.attributes.position.count;
 const out=new T.BufferGeometry();
 for(const [k,s] of [['position',3],['normal',3],['uv',2]]){const a=new Float32Array(n*s);let o=0;for(const g of geos){a.set(g.attributes[k].array,o);o+=g.attributes[k].array.length;}out.setAttribute(k,new T.BufferAttribute(a,s));}
 return out;
}

/* ---------- measuring the body ---------- */
// Inner half width of the body side over (y, z), from its paint panels: door cards follow it 2.5 cm inside.
function sideProfile(key){
 const d=S26.data[key];if(!d)return null;if(sideProfile[key])return sideProfile[key];
 const Z0=-1.25,Z1=1.0,Y0=.1,Y1=1.05,st=.05,nz=Math.round((Z1-Z0)/st)+1,ny=Math.round((Y1-Y0)/st)+1,m=Array.from({length:ny},()=>new Float32Array(nz).fill(9));
 const belt=new Float32Array(nz).fill(9);
 for(const r of d.levels[0]){
  if(!r.s26||!['wing','hood','glass'].includes(r.role)||!r.q)continue;
  const b=atob(r.p),u8=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u8[i]=b.charCodeAt(i);const p=new Int16Array(u8.buffer);
  if(r.role==='glass'){for(let i=0;i<p.length;i+=3){const x=Math.abs(p[i]/1e4),y=p[i+1]/1e4,z=p[i+2]/1e4,iz=Math.round((z-Z0)/st);if(x>.55&&x<.82&&y>.75&&iz>=0&&iz<nz&&y<belt[iz])belt[iz]=y;}continue;}
  for(let i=0;i<p.length;i+=3){const x=Math.abs(p[i]/1e4),y=p[i+1]/1e4,z=p[i+2]/1e4;if(x<.5)continue;
   const iy=Math.round((y-Y0)/st),iz=Math.round((z-Z0)/st);if(iy<0||iy>=ny||iz<0||iz>=nz)continue;if(x<m[iy][iz])m[iy][iz]=x;}
 }
 // fill holes from the nearest measured cell in the same row, then keep it smooth and inside sane limits
 for(const row of m){for(let j=0;j<nz;j++)if(row[j]>8){let k=1;while(k<nz){const a=row[j-k],b=row[j+k];if(a!==undefined&&a<8){row[j]=a;break;}if(b!==undefined&&b<8){row[j]=b;break;}k++;}if(row[j]>8)row[j]=.75;}}
 for(let iy=0;iy<ny;iy++)if(m[iy].every(v=>v===.75)&&iy)m[iy].set(m[iy-1]);
 const sm=m.map((row,iy)=>row.map((v,iz)=>{let lo=v;for(let a=-1;a<=1;a++)for(let b=-2;b<=2;b++){const w=m[iy+a]?.[iz+b];if(w!==undefined&&w<lo)lo=w;}return Math.min(.86,Math.max(.6,lo));}));
 // the glass line, median filtered and eased so the door tops run straight
 const med=Array.from(belt,(v,i)=>{const a=[];for(let k=-3;k<=3;k++){const u=belt[i+k];if(u!==undefined&&u<8)a.push(u);}a.sort((p,q)=>p-q);return a.length?a[a.length>>1]:9;});
 const bl=Array.from(med,(v,i)=>{let n=0,t=0;for(let k=-2;k<=2;k++){const u=med[i+k];if(u!==undefined&&u<8){n++;t+=u;}}return n?t/n:9;});
 return sideProfile[key]={belt(z,def){const fz=Math.min(nz-1.001,Math.max(0,(z-Z0)/st)),i=fz|0,t=fz-i,a=bl[i],b=bl[i+1];const v=a>8?b:b>8?a:a*(1-t)+b*t;return v>8?def:Math.min(def+.05,Math.max(def-.03,v-.008));},at(y,z){const fy=Math.min(ny-1.001,Math.max(0,(y-Y0)/st)),fz=Math.min(nz-1.001,Math.max(0,(z-Z0)/st)),iy=fy|0,iz=fz|0,ty=fy-iy,tz=fz-iz;
  return (sm[iy][iz]*(1-tz)+sm[iy][iz+1]*tz)*(1-ty)+(sm[iy+1][iz]*(1-tz)+sm[iy+1][iz+1]*tz)*ty;}};
}

/* ---------- the cabin ---------- */
function build(body,key){
 const S=S26C[body],P=sideProfile(key);if(!S||!P)return null;
 const M=mats(),g=new T.Group();g.name='S26C cockpit';
 const add=(geo,mat,name)=>{const m=new T.Mesh(geo,mat);if(name)m.name=name;m.userData.s26c=true;g.add(m);return m;};
 const [wsY,wsZ]=S.ws,[lipY,lipZ]=S.lip,inset=.025;
 const w=(y,z)=>P.at(y,z)-inset;

 // Dash: top runs from the windscreen base back to the lip; face drops to the knee bolster; closes down to the
 // firewall. Built as a sheet across x, each column clipped to the body's width.
 const xs=[];for(let i=0;i<=24;i++)xs.push(-1+i/12);
 const prof=[[wsY+.012,wsZ+.08],[wsY-.004,wsZ-.02],[lipY+.02,(wsZ+lipZ)/2],[lipY,lipZ+.01],[lipY-.035,lipZ-.012],[lipY-.11,lipZ],[.62,lipZ+.05],[.46,lipZ+.12],[.3,lipZ+.2],[.13,lipZ+.26]];
 const dash=prof.map(([y,z])=>xs.map(x=>{const lim=w(Math.min(y,.95),z);return [Math.max(-lim,Math.min(lim,x*lim)),y,z];}));
 add(sheet(dash),M.carbon,'S26C dash');
 // firewall: from the dash's front edge down to the floor
 const fz=wsZ+.08;add(sheet([[wsY+.012,fz],[.5,fz+.02],[.13,lipZ+.28]].map(([y,z])=>xs.map(x=>{const lim=w(Math.min(y,.95),z);return [x*lim,y,z];}))),M.black);
 // the driver's binnacle: a thin carbon hood arching over the column display
 {const hx=-.37,hw=.13,hz=lipZ-.07,hy=lipY-.055,t=.01,shape=new T.Shape();
  shape.moveTo(-hw,0);shape.quadraticCurveTo(-hw,.075,0,.08);shape.quadraticCurveTo(hw,.075,hw,0);
  shape.lineTo(hw-t,0);shape.quadraticCurveTo(hw-t,.065,0,.07);shape.quadraticCurveTo(-hw+t,.065,-hw+t,0);shape.lineTo(-hw,0);
  const hood=new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:false,curveSegments:12});hood.translate(hx,hy,hz);
  add(boxUV(hood),M.carbon,'S26C binnacle');
  add(boxUV(new T.BoxGeometry(2*hw,.075,.01).translate(hx,hy+.035,hz+.14)),M.black);}
 // floor, transmission tunnel
 const fl=[];for(const z of [lipZ+.3,lipZ,0,-.4,S.rear])fl.push(xs.map(x=>{const lim=w(.2,z);return [x*lim,.135,z];}));add(sheet(fl),M.floor);
 add(boxUV(new T.BoxGeometry(.25,.25,lipZ+.25-S.rear).translate(.0,.255,(lipZ+.25+S.rear)/2)),M.carbon,'S26C tunnel');

 // Door cards and window sills on both sides
 for(const sd of [-1,1]){
  const zs=[];for(let z=lipZ+.28;z>=S.rear-.01;z-=.05)zs.push(z);const fr=[0,.1,.25,.4,.55,.7,.85,1];
  const top=z=>P.belt(z,S.belt-.02);
  add(sheet(fr.map(f=>zs.map(z=>{const y=.13+(top(z)-.13)*f;return [sd*w(Math.min(y,S.belt),z),y,z];}))),M.satin,'S26C door card');
  // sill cap: a narrow ledge from the card in toward the cabin under the glass
  add(sheet([0,1].map(k=>zs.map(z=>[sd*(w(Math.min(top(z),S.belt),z)-k*.07),top(z)-k*.01,z]))),M.carbon);
  // door pull: a red strap on the door card
  if(sd<0||true){const z=.05,y=.62,x=sd*(w(y,z)-.012);add(new T.BoxGeometry(.012,.03,.26).translate(x,y,z),M.red);}
 }
 // Rear bulkhead and parcel shelf behind the cage
 add(sheet([.13,.4,.7,S.shelf].map(y=>xs.map(x=>{const lim=w(Math.min(y,.9),S.rear);return [x*lim,y,S.rear];}))),M.black);
 const shelf=[];for(const z of [S.rear,S.rear-.35,S.rear-.7,S.rear-1.05])shelf.push(xs.map(x=>{const lim=w(Math.min(S.shelf,.9),Math.max(z,-1.25));return [x*lim,S.shelf,z];}));add(sheet(shelf),M.carbon);

 // Roll cage (4.5 cm tube): main hoop, A-pillar bars, roof rails and X, door bars both sides, hoop diagonal, rear stays
 {const r=.0225,c=[],yt=S.roof-.04,hz=S.hoop,az=S.hdr;
  const side=(y,z)=>w(y,z)-.035,top=(z)=>Math.min(side(yt,z),.58);
  for(const sd of [-1,1]){
   const h0=[sd*side(.14,hz),.14,hz],h1=[sd*side(S.belt,hz),S.belt,hz],h2=[sd*top(hz),yt,hz];
   const a0=[sd*side(.2,wsZ-.06),.2,wsZ-.06],a1=[sd*side(S.belt-.02,wsZ-.16),S.belt-.02,wsZ-.16],a2=[sd*top(az),yt,az];
   c.push(tube(h0,h1,r),tube(h1,h2,r),tube(a0,a1,r),tube(a1,a2,r),tube(a2,h2,r));
   // NASCAR-style door bars: two rails and an X between the A-pillar foot and the hoop
   const d=(y,z)=>[sd*(side(y,z)-.02),y,z];
   c.push(tube(d(.42,wsZ-.1),d(.42,hz),r*.9),tube(d(.72,wsZ-.14),d(.72,hz),r*.9),tube(d(.42,wsZ-.1),d(.72,hz),r*.9),tube(d(.72,wsZ-.14),d(.42,hz),r*.9));
   // rear stays down to the rear bulkhead
   c.push(tube(h2,[sd*.5,.6,S.rear+.02],r*.9));
  }
  c.push(tube([-top(hz),yt,hz],[top(hz),yt,hz],r),tube([-top(az),yt,az],[top(az),yt,az],r),
         tube([side(.16,hz),.16,hz],[-top(hz),yt,hz],r*.9),
         // dash bar behind the dash, and the steering column support
         tube([-side(.7,lipZ+.12),.7,lipZ+.12],[side(.7,lipZ+.12),.7,lipZ+.12],r));
  for(const p of [[-1,yt,hz],[1,yt,hz],[-1,yt,az],[1,yt,az]]){const s=new T.SphereGeometry(r*1.25,12,8);s.translate(p[0]*top(p[2]),p[1],p[2]);c.push(s);}
  add(merge(c),M.cage,'S26C cage');
  // padding on the driver's side of the cage where the helmet would strike it
  add(merge([tube([-top(az),yt,az],[-top(hz),yt,hz],r*1.7),tube([-side(S.belt-.02,wsZ-.16),S.belt-.02,wsZ-.16],[-top(az),yt,az],r*1.7)]),M.pad);
 }

 // Carbon race seat, right-hand seat
 {const sx=-.37,c=[];
  const base=new T.BoxGeometry(.42,.06,.46);base.translate(0,.19,-.2);c.push(base);
  const back=new T.BoxGeometry(.44,.72,.06);back.translate(0,.36,0);back.rotateX(-16*rad);back.translate(0,.17,-.47);c.push(back);
  for(const s of [-1,1]){const b=new T.BoxGeometry(.05,.5,.36);b.translate(s*.225,.38,-.28);b.rotateY(-s*8*rad);c.push(b);
   const head=new T.BoxGeometry(.04,.18,.22);head.translate(s*.15,.92,-.62);c.push(head);
   const thigh=new T.BoxGeometry(.05,.1,.36);thigh.translate(s*.2,.26,-.02);c.push(thigh);}
  const g2=merge(c);g2.translate(sx,0,.02);add(boxUV(g2),M.carbon,'S26C seat');}
 // Sequential shifter on the driver's left, on the tunnel
 {const bx=-.15,by=.38,bz=.12,c=[];
  const gate=new T.BoxGeometry(.05,.04,.12);gate.translate(bx,by,bz);c.push(gate);
  c.push(tube([bx,by,bz],[bx-.02,by+.27,bz+.06],.009));
  add(merge(c),M.alloy,'S26C shifter');
  add(new T.SphereGeometry(.024,16,12).scale(1,1.3,1).translate(bx-.02,by+.29,bz+.065),M.black);}
 // Centre switch panel: a carbon plate angled up from the tunnel toward the driver, 3 x 4 lit keys
 {const px=-.03,py=.52,pz=lipZ+.02,pan=new T.Group();pan.position.set(px,py,pz);pan.rotation.set(-35*rad,-18*rad,0,'YXZ');
  const plate=new T.Mesh(boxUV(new T.BoxGeometry(.2,.15,.012)),M.carbon);pan.add(plate);
  for(let i=0;i<3;i++)for(let j=0;j<4;j++){const k=new T.Mesh(new T.BoxGeometry(.028,.024,.01),M.keys[(i*4+j)%6]);k.position.set(-.066+j*.044,.04-i*.04,-.009);pan.add(k);}
  pan.traverse(o=>o.userData.s26c=true);g.add(pan);
  // a big red ignition/fire key on the dash face beside the screen
  add(new T.CylinderGeometry(.016,.016,.012,20).rotateX(Math.PI/2).translate(-.2,lipY-.07,lipZ-.008),M.red);}
 return g;
}

/* ---------- fitting it to the player's car ---------- */
// The cockpit car's geometry is built without the mirrored Supercars 18 dash, seats and cage (they are merged
// into the trim mesh, so they have to go before the merge rather than be hidden after it).
const DROP_ROLES=['fabric','cage'];
// The road cars' kits leave a few badge-chrome scraps inside the cabin (a grey strip under the roof): cut them.
const BADGE_BOX=[.62,.3,1.3,-1.3,.75];
// road-car paint left inside the cabin below the windows (the Mustang's tunnel cover)
const paintBox=b=>[.55,.08,S26C[b].belt-.08,S26C[b].rear,S26C[b].lip[1]+.3];
function cabinFree(r,B){
 const id=B.join();r.s26cFree||={};if(r.s26cFree[id])return r.s26cFree[id];if(!r.q)return r;
 const dec=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer;};
 const p=new Int16Array(dec(r.p)),I=r.i16?new Uint16Array(dec(r.i)):new Uint32Array(dec(r.i)),keep=[];
 for(let t=0;t<I.length;t+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=p[I[t+k]*3]/3e4;y+=p[I[t+k]*3+1]/3e4;z+=p[I[t+k]*3+2]/3e4;}
  if(!(Math.abs(x)<B[0]&&y>B[1]&&y<B[2]&&z>B[3]&&z<B[4]))keep.push(I[t],I[t+1],I[t+2]);}
 if(keep.length===I.length)return r.s26cFree[id]=r;
 const out=new (r.i16?Uint16Array:Uint32Array)(keep),u8=new Uint8Array(out.buffer);let bin='';for(let i=0;i<u8.length;i+=8192)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
 return r.s26cFree[id]={...r,i:btoa(bin),triangles:keep.length/3};
}
if(typeof dc35MakeGeometry==='function'){const prevG=dc35MakeGeometry;dc35MakeGeometry=function(make,level,player){
 const d=DC35_ASSETS.cars[make];if(!player||!d?.spec?.s26)return prevG.apply(this,arguments);
 const all=d.levels,lv=all.slice();const body=d.spec.s26.body;lv[level]=all[level].filter(r=>!(r.s26rhd&&DROP_ROLES.includes(r.role))&&r.role!=='glove').map(r=>r.s26&&r.role==='metal'?cabinFree(r,BADGE_BOX):r.s26&&(r.role==='wing'||r.role==='hood')&&S26C[body]?cabinFree(r,paintBox(body)):r);d.levels=lv;
 try{return prevG.apply(this,arguments);}finally{d.levels=all;}};}
const HIDE_BUCKETS=['fabric','cage','screen','screen2','led'];
function fit(car){
 const s=car.userData.s26;if(!s||car.userData.s26c)return;
 let cockpit=false;car.traverse(o=>{if(o.name==='IN55 centre screen')cockpit=true;});if(!cockpit)return;
 const proto=build(s.body,s.key);if(!proto)return;car.userData.s26c=true;
 const S=S26C[s.body];
 for(const root of car.userData.dc35Chassis||[]){
  root.traverse(o=>{if(o.isMesh&&HIDE_BUCKETS.includes(o.userData.dc35Bucket))o.visible=false;});
  root.add(proto.clone());
 }
 // Small left-hand-drive leftovers that other layers hang on the old dash (a column shroud beside the passenger):
 // anything wholly inside the passenger-side dash zone that is not part of this cockpit goes.
 car.updateWorldMatrix(true,true);const inv=car.userData.dc35Chassis[0].matrixWorld.clone().invert(),bb=new T.Box3();
 car.traverse(o=>{if(!o.isMesh||o.userData.s26c||!o.geometry?.attributes?.position)return;let keep=false;o.traverseAncestors(a=>{if(/^(IN55|CP65|S26C)/.test(a.name)||a.userData?.dc35Wheel||(car.userData.dc35Steering||[]).includes(a))keep=true;});if(keep||/^(IN55|CP65)/.test(o.name))return;
  if(o.geometry.attributes.position.count>4000)return;bb.setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));
  if(bb.min.x>.1&&bb.max.x<.75&&bb.min.y>.55&&bb.max.y<1.12&&bb.min.z>.25&&bb.max.z<1.05)o.visible=false;});
 // The centre screen and dash sponsor: into the new dash, screen turned toward the right-hand seat.
 car.traverse(o=>{
  if(o.name==='IN55 centre screen'){o.position.set(-.03,S.lip[0]-.105,S.lip[1]-.032);o.rotation.set(12*rad,20*rad,0,'YXZ');}
  else if(o.name==='IN55 dash sponsor'){const ty=Math.atan2(S.ws[0]-S.lip[0],S.ws[1]-S.lip[1]);o.position.set(.12,(S.ws[0]+S.lip[0])/2+.016,(S.ws[1]+S.lip[1])/2);o.rotation.set(-(90*rad-ty),Math.PI,0,'YXZ');}
  else if(o.name==='CP65 column display'){o.position.set(-.37,S.lip[0]-.02,S.lip[1]+.05);o.rotation.set(-14*rad,0,0,'YXZ');}
 });
}
S26.cockpit=fit;S26.cockpitBuild=build;
{const prev=sc25Car;sc25Car=function(E,team,driver){const car=prev.apply(this,arguments);try{fit(car);}catch(e){console.warn('s26 cockpit',e);}return car;};}

// A touch lower in the seat.
if(typeof gr27Camera==='function'){const prev=gr27Camera;gr27Camera=function(W,L,dt){const r=prev.apply(this,arguments);try{
 if(sc25Camera==='onboard'&&L?.player){const car=W.carNodes?.get(L.player.d.id);if(car?.userData.s26){
  const body=D.settings.cameraMotion!==false?car.userData.dc35Chassis[0]:car;body.updateWorldMatrix(true,false);
  W.camera.position.addScaledVector(new T.Vector3(0,1,0).transformDirection(body.matrixWorld),-window.S26C_EYE_DROP);W.camera.updateMatrixWorld();}}
}catch(e){}return r;};}
}
if(window.S26)install();else document.addEventListener('DOMContentLoaded',install);
})();
