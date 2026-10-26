const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const tex=process.argv[2],out=process.argv[3];
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');
await p.waitForFunction(()=>{try{return DC35_ASSETS.cars.Holden.levels&&window.THREE}catch(e){return false}},null,{timeout:90000});
const data='data:image/jpeg;base64,'+fs.readFileSync(tex).toString('base64');
const r=await p.evaluate(async(data)=>{
 const T=THREE;const img=new Image();img.src=data;await img.decode();
 const tx=new T.Texture(img);tx.flipY=false;tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8;tx.needsUpdate=true;
 const sc=new T.Scene();sc.background=new T.Color('#d9dde2');
 sc.add(new T.HemisphereLight(0xffffff,0x667788,1.6));const dl=new T.DirectionalLight(0xffffff,2.2);dl.position.set(3,6,4);sc.add(dl);
 const g=dc35MakeGeometry('Holden','0',true);
 for(const x of g){if(!x.g)continue;const tex=(x.bucket==='paint'||x.bucket==='hood');
  const m=new T.MeshStandardMaterial({color:tex?0xffffff:(x.bucket==='glass'?0x1a2028:x.colour||0x333333),map:tex?tx:null,roughness:tex?0.35:0.6,metalness:0.0,side:T.DoubleSide});
  const mesh=new T.Mesh(x.g,m);if(x.pivot)mesh.position.set(0,0,0);sc.add(mesh);}
 const ren=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});ren.setSize(1200,620);ren.outputColorSpace=T.SRGBColorSpace;
 const cam=new T.PerspectiveCamera(30,1200/620,.1,100);const shots=[];
 for(const [px,py,pz] of [[-6.2,2.0,4.2],[5.4,2.6,-5.6],[2.2,6.5,6.5]]){cam.position.set(px,py,pz);cam.lookAt(0,0.55,0);ren.render(sc,cam);shots.push(ren.domElement.toDataURL('image/jpeg',.9));}
 return shots;},data);
r.forEach((s,i)=>fs.writeFileSync(out+i+'.jpg',Buffer.from(s.split(',')[1],'base64')));await b.close();})();
