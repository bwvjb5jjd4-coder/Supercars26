const {chromium}=require('playwright');const fs=require('fs');
const only=process.argv[2]?process.argv[2].split(','):null, view=JSON.parse(process.argv[3]||'{}');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1400,height:850}});
if(view.livery)await p.addInitScript(l=>localStorage.setItem('lv78Liveries',l),JSON.stringify(view.livery));   // lv78 livery choice, e.g. {"redbull":"bathurst"}
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');
await p.waitForFunction(()=>{const e=document.getElementById('ui26-enter');return e&&!e.disabled},null,{timeout:120000});
await p.keyboard.press('Enter');await p.waitForTimeout(1000);
await p.evaluate(()=>{irOpen();});await p.waitForTimeout(500);
await p.evaluate(()=>{const s=document.getElementById('ir-car');s.value='0:0';irStart(s.closest('form'));D.settings.graphics='high';});
await p.waitForTimeout(500);
await p.evaluate(()=>dcLaunch(false));
await p.waitForFunction(()=>typeof sc25Engine!=='undefined'&&sc25Engine&&sc25Engine.carNodes&&sc25Engine.carNodes.size>0,null,{timeout:120000});
await p.waitForTimeout(12000);
const shots=await p.evaluate(async([only,view])=>{
 const W=sc25Engine,T=THREE;cancelAnimationFrame(W.raf);W.dead=true;
 const R=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
 const w=view.w||1800,h=view.h||1040;R.setSize(w,h);R.setClearColor(0,0);R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=view.exp||1.0;
 R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
 const sc=new T.Scene();
 const env=W.scene.environment;sc.environment=env||null;
 sc.add(new T.HemisphereLight(0xffffff,0x8a9099,view.hemi??1.1));
 const dl=new T.DirectionalLight(0xffffff,view.sun??2.6);dl.position.set(4,9,3);dl.castShadow=true;dl.shadow.mapSize.set(2048,2048);
 Object.assign(dl.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:30});dl.shadow.radius=8;dl.shadow.blurSamples=16;sc.add(dl);const fill=new T.DirectionalLight(0xffffff,view.fill??1.2);fill.position.set(-6,4,8);sc.add(fill);
 const ground=new T.Mesh(new T.PlaneGeometry(40,40),new T.ShadowMaterial({opacity:.45}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;sc.add(ground);
 const cam=new T.PerspectiveCamera(view.fov||24,w/h,.1,200);
 const out={};
 for(const [id,o] of W.carNodes){const num=String(o.userData.number);if(only&&!only.includes(num))continue;
  const par=o.parent;sc.add(o);o.position.set(0,0,0);o.rotation.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);o.updateMatrixWorld(true);
  o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.frustumCulled=false;} if(c.isLOD){c.autoUpdate=true;}});
  // ground the car
  const bb=new T.Box3().setFromObject(o);ground.position.y=bb.min.y;
  const cx=view.tx??0,cz=view.tz??0,cy=bb.min.y;   // tx/tz aim the camera at a point on the car
  const yaw=view.yaw??0.85,pitch=view.pitch??0.2,dist=view.dist??10.5;
  cam.position.set(cx+Math.sin(yaw)*Math.cos(pitch)*dist,cy+Math.sin(pitch)*dist+0.55,cz+Math.cos(yaw)*Math.cos(pitch)*dist);cam.lookAt(cx,cy+(view.ly??0.55),cz);
  R.render(sc,cam);R.render(sc,cam);
  out[num]=R.domElement.toDataURL('image/png');out[num+'_bb']=[bb.min.toArray(),bb.max.toArray()];
  sc.remove(o);
 }
 return out;},[only,view]);
for(const [k,v] of Object.entries(shots)){if(k.endsWith('_bb')){console.log(k,JSON.stringify(v));continue;}fs.writeFileSync('car_'+k+'.png',Buffer.from(v.split(',')[1],'base64'));}
await b.close();})();
