/* SW60: cockpit steering wheel clean-up for the ZB and the Falcon.
   The white glove meshes are no longer drawn. Only the wheel rim, spokes and hub turn:
   the ZB model's column and shroud stay fixed to the dash, and the ZB wheel now turns
   about its own tilted column axis instead of the car's forward axis.
   The steering direction is flipped where it is applied (dc35, ph47) so steering left
   turns the wheel anticlockwise from the driver's seat. */

// Car space (+Z forward). rim: the Falcon's rim was cut where the gloves gripped it, so a full rim ring [radius, tube, z] is added.
// Car space (+Z forward). keepMaxZ: parts of the steering model that end nearer the driver than this turn.
const SW60_WHEEL={
 Holden:{centre:[.399,.8715,.454],tilt:Math.asin(.503),keepMaxZ:.575},
 Ford:{centre:[.37,.91,.56],tilt:0,keepMaxZ:9,rim:[.1645,.0225,0]}
};

const sw60Bucket=dc35Bucket;
dc35Bucket=function(role,level,player){return role==='glove'?null:sw60Bucket(role,level,player);};

function sw60Split(geo,oldPivot,spec){
 const p=geo.attributes.position,ix=geo.index.array,n=p.count,par=new Int32Array(n);for(let i=0;i<n;i++)par[i]=i;
 const find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};
 for(let t=0;t<ix.length;t+=3){const a=find(ix[t]),b=find(ix[t+1]),c=find(ix[t+2]);par[b]=a;par[find(c)]=a;}
 const maxZ=new Map();for(let i=0;i<n;i++){const r=find(i),z=p.getZ(i)+oldPivot[2];maxZ.set(r,Math.max(maxZ.get(r)??-9,z));}
 const turns=i=>maxZ.get(find(i))<spec.keepMaxZ;
 const T=THREE,cos=Math.cos(-spec.tilt),sin=Math.sin(-spec.tilt),c=spec.centre;
 function build(tris,local){
  const map=new Map(),pos=[],nor=[],uv=[],col=[],ids=[],N=geo.attributes.normal,U=geo.attributes.uv,C=geo.attributes.color;
  for(const v of tris){if(!map.has(v)){map.set(v,map.size);let x=p.getX(v)+oldPivot[0],y=p.getY(v)+oldPivot[1],z=p.getZ(v)+oldPivot[2],nx=N.getX(v),ny=N.getY(v),nz=N.getZ(v);
    if(local){x-=c[0];y-=c[1];z-=c[2];[y,z]=[y*cos-z*sin,y*sin+z*cos];[ny,nz]=[ny*cos-nz*sin,ny*sin+nz*cos];}
    pos.push(x,y,z);nor.push(nx,ny,nz);uv.push(U?U.getX(v):0,U?U.getY(v):0);col.push(C?C.getX(v):1,C?C.getY(v):1,C?C.getZ(v):1);}
   ids.push(map.get(v));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(ids);g.computeBoundingSphere();return g;}
 const wheel=[],fixed=[];for(let t=0;t<ix.length;t+=3){const list=turns(ix[t])?wheel:fixed;list.push(ix[t],ix[t+1],ix[t+2]);}
 return{wheel:wheel.length?build(wheel,true):null,fixed:fixed.length?build(fixed,false):null};
}

const sw60MakeGeometry=dc35MakeGeometry;
dc35MakeGeometry=function(make,level,player){
 const key=make+':'+level+':'+player;if(DC35_GEOMETRY.has(key))return DC35_GEOMETRY.get(key);
 const out=sw60MakeGeometry(make,level,player),spec=SW60_WHEEL[make];if(!spec)return out;
 const result=[];
 for(const row of out){
  if(row.group!=='steering'){result.push(row);continue;}
  const parts=sw60Split(row.g,row.pivot,spec);row.g.dispose();
  if(parts.wheel)result.push({...row,pivot:[...spec.centre],g:parts.wheel});
  if(spec.rim){const ring=new THREE.TorusGeometry(spec.rim[0],spec.rim[1],10,64);ring.translate(0,0,spec.rim[2]);const c=new THREE.Color(DC35_ROLE_COLOURS.steering),n=ring.attributes.position.count;ring.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:n*3},(_,i)=>[c.r,c.g,c.b][i%3]),3));result.push({...row,pivot:[...spec.centre],g:ring});}
  if(parts.fixed)result.push({...row,group:'body',pivot:null,g:parts.fixed});
 }
 DC35_GEOMETRY.set(key,result);return result;
};

const sw60Car=sc25Car;
sc25Car=function(E,team,driver){
 const g=sw60Car(E,team,driver),spec=SW60_WHEEL[g?.userData?.make];
 if(spec)for(const pivot of g.userData.dc35Steering||[])pivot.rotation.x=spec.tilt;
 return g;
};
