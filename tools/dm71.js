// dm71: crash damage moves every body part together, so the black under-bonnet trim
// never pokes through a dented bonnet and the car keeps its own livery when crumpled.
// The bonnet crumple and dents (rf41 GPU, dc36 CPU) only moved the painted panels; the
// trim, lamps and inner bonnet stayed put. Now they get the same deformation, and the
// inner bonnet panel goes with the bonnet when it is torn off.
(()=>{
const DM71_GLSL=`float dm71Bon=smoothstep(1.0,1.5,position.z)*smoothstep(.5,.76,position.y);
 transformed.y+=dm71Bon*rf41Crumple*(.045*sin(position.x*14.0+position.z*11.0)-.075);
 transformed.z-=dm71Bon*rf41Crumple*(.035+.025*sin(position.x*9.0));
 float dm71Dent=max(0.0,1.0-length((position.xz-rf41Dent.xy)*vec2(1.0,.8))/.85)*rf41Dent.z*step(.28,position.y);
 transformed.x-=sign(rf41Dent.x)*dm71Dent*.12;transformed.y-=dm71Dent*.035;transformed.z-=sign(rf41Dent.y)*dm71Dent*.08;`;

// Materials that already carry the painted-panel deformation are left alone.
const dm71Paint=dc35PaintShader;
dc35PaintShader=function(mat,state){dm71Paint(mat,state);mat.userData.dm71=true;};

function dm71Patch(mat,state){
 if(!mat||mat.userData.dm71||!state.crumple||!state.dent)return;mat.userData.dm71=true;
 const before=mat.onBeforeCompile,key=mat.customProgramCacheKey();
 mat.onBeforeCompile=function(sh,r){before?.call(this,sh,r);if(sh.vertexShader.includes('uniform float rf41Crumple'))return;
  sh.uniforms.rf41Crumple=state.crumple;sh.uniforms.rf41Dent=state.dent;
  sh.vertexShader='uniform float rf41Crumple;uniform vec4 rf41Dent;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+DM71_GLSL);};
 mat.customProgramCacheKey=()=>key+'|dm71';mat.needsUpdate=true;
}

// Inner bonnet trim: black panels under the bonnet skin. Split them off so they leave with the bonnet.
const dm71Geometry=dc35MakeGeometry;
dc35MakeGeometry=function(make,level,player){
 const rows=dm71Geometry(make,level,player);if(rows.dm71Split)return rows;
 const out=[];
 for(const row of rows){
  if(row.bucket!=='trim'||row.group!=='body'){out.push(row);continue;}
  const p=row.g.attributes.position,index=row.g.index?.array||Uint32Array.from({length:p.count},(_,i)=>i),bins=[[],[]];
  for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2],x=Math.max(Math.abs(p.getX(a)),Math.abs(p.getX(b)),Math.abs(p.getX(c))),y=Math.min(p.getY(a),p.getY(b),p.getY(c)),z=Math.min(p.getZ(a),p.getZ(b),p.getZ(c)),z2=Math.max(p.getZ(a),p.getZ(b),p.getZ(c));
   bins[x<.78&&y>.6&&z>1.12&&z2<2.3?1:0].push(a,b,c);}
  if(!bins[1].length){out.push(row);continue;}
  for(let k=0;k<2;k++)if(bins[k].length){const g=new THREE.BufferGeometry();for(const [n,a]of Object.entries(row.g.attributes))g.setAttribute(n,a);g.setIndex(bins[k]);g.userData.dc35Shared=true;g.computeBoundingSphere();out.push({...row,g,dm71Hood:k===1});}
 }
 rows.splice(0,rows.length,...out);rows.dm71Split=true;return rows;
};

const dm71Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=dm71Car(E,team,driver),u=car.userData;if(!u.dc35Car)return car;
 for(const [bucket,m]of Object.entries(u.dc35Mats||{}))if(!['paint','hood','glass'].includes(bucket))dm71Patch(m,u.dc35State);
 for(let level=0;level<3;level++){
  const rows=dc35MakeGeometry(team.manufacturer,level,driver.id===D?.pid);
  u.dc35Chassis?.[level]?.traverse(o=>{if(!o.isMesh)return;const row=rows.find(r=>r.g===o.geometry);if(row?.dm71Hood&&!u.dc35Hoods.includes(o))u.dc35Hoods.push(o);});
 }
 return car;
};

// Dents pressed into the painted panels (dc36, on the CPU) are applied to the trim and lamps too.
const dm71Running=SC25World.prototype.applyRunningDamage;
SC25World.prototype.applyRunningDamage=function(car,x){
 dm71Running.call(this,car,x);const u=car?.userData;if(!u?.dc35Car||x.retired)return;
 const rev=x.sc30DamageRevision||0;if(u.dm71Rev===rev)return;u.dm71Rev=rev;
 const dents=x.sc30Dents||[];if(!dents.length&&!u.dm71Own)return;
 for(const chassis of u.dc35Chassis||[])chassis.traverse(m=>{
  if(!m.isMesh||m.parent!==chassis||['paint','hood'].includes(m.userData.dc35Bucket)||m.material?.transparent)return;
  if(!m.userData.dm71Base){if(!dents.length)return;m.geometry=m.geometry.clone();m.geometry.userData.dc35Shared=false;m.userData.dm71Base=m.geometry.attributes.position.array.slice();u.dm71Own=true;}
  const p=m.geometry.attributes.position,base=m.userData.dm71Base;p.array.set(base);
  for(const d of dents)for(let i=0;i<p.count;i++){const xx=base[i*3],yy=base[i*3+1],zz=base[i*3+2],f=Math.max(0,1-Math.hypot((xx-d.x)*.9,(yy-.65)*.65,(zz-d.z)*.8)/.95)*d.strength;if(yy>.28)p.setXYZ(i,xx-Math.sign(d.x||1)*f*.16,yy-f*.045,zz-Math.sign(d.z||1)*f*.08);}
  p.needsUpdate=true;m.geometry.computeBoundingSphere();});
};
})();
