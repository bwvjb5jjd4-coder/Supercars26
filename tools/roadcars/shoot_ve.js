// Studio renders of the road cars, for menu tile art and for checking the models.
//   node tools/roadcars/shoot_ve.js <outdir> <keys,comma> '<views json>'
// Needs the game served at http://localhost:8765/. View: {yaw,pitch,dist,ly,fov,w,h,brake,head,reverse,paint,lx,lz}
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const out=process.argv[2]||'.',keys=(process.argv[3]||'sedan').split(','),views=JSON.parse(process.argv[4]||'[{}]');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1200,height:800}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console',m.text().slice(0,300));});
await p.goto('http://localhost:8765/index.html');
await p.waitForFunction(()=>window.VE89&&window.THREE,null,{timeout:120000});
for(const key of keys){
 if(key!=='m4')await p.evaluate(k=>VE89.load(k),key);else await p.evaluate(()=>SC54_READY);
 for(let vi=0;vi<views.length;vi++){const view=views[vi];
  const url=await p.evaluate(async([key,view])=>{
   const T=THREE,w=view.w||1600,h=view.h||920;
   const R=window.__veR||(window.__veR=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}));
   R.setSize(w,h);R.setClearColor(0,0);R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=view.exp||1;
   R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
   const sc=new T.Scene();if(view.bg)sc.background=new T.Color(view.bg);
   sc.environment=sc54FallbackEnv(R);
   sc.add(new T.HemisphereLight(0xffffff,0x8a9099,view.hemi??.9));
   const dl=new T.DirectionalLight(0xffffff,view.sun??2.4);dl.position.set(4,9,3);dl.castShadow=true;dl.shadow.mapSize.set(2048,2048);
   Object.assign(dl.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:30});sc.add(dl);
   const fill=new T.DirectionalLight(0xffffff,view.fill??1);fill.position.set(-6,4,8);sc.add(fill);
   const ground=new T.Mesh(new T.PlaneGeometry(40,40),view.bg?new T.MeshStandardMaterial({color:'#2a2c30',roughness:.8}):new T.ShadowMaterial({opacity:.45}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;sc.add(ground);
   const E={texture:(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}};
   let car;
   if(key==='m4'){car=sc54SafetyCar(E);car.visible=true;}
   else{car=VE89.makeCar(key,view.paint||VE89.CARS[key].paint,E);VE89.lamps(car,{braking:!!view.brake,headlights:!!view.head,reverse:!!view.reverse},1);}
   if(view.hide)car.traverse(o=>{if(o.isMesh&&view.hide.includes(o.userData.ve89Part))o.visible=false;});
   sc.add(car);car.updateMatrixWorld(true);
   const cam=new T.PerspectiveCamera(view.fov||24,w/h,.05,200);
   const yaw=view.yaw??.85,pitch=view.pitch??.2,dist=view.dist??10.5,lx=view.lx||0,lz=view.lz||0,ly=view.ly??.55;
   if(view.cam){cam.position.set(...view.cam);cam.lookAt(...view.look);}else{cam.position.set(lx+Math.sin(yaw)*Math.cos(pitch)*dist,ly+Math.sin(pitch)*dist,lz+Math.cos(yaw)*Math.cos(pitch)*dist);cam.lookAt(lx,ly,lz);}
   R.render(sc,cam);R.render(sc,cam);const u=R.domElement.toDataURL('image/png');sc.remove(car);return u;
  },[key,view]);
  const f=path.join(out,`${key}_${view.name||vi}.png`);fs.writeFileSync(f,Buffer.from(url.split(',')[1],'base64'));console.log('wrote',f);
 }
}
await b.close();})().catch(e=>{console.error(e);process.exit(1);});
