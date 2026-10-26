const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
await p.goto('http://localhost:8765/index.html');
await p.waitForFunction(()=>{try{return DC35_ASSETS.cars.Holden.levels}catch(e){return false}},null,{timeout:60000});
const r=await p.evaluate(()=>{const g=dc35MakeGeometry('Holden','0',true);
 return g.map(x=>{const G=x.g,a=G.attributes;return {group:x.group,bucket:x.bucket,n:a.position.count,uv:!!a.uv,idx:!!G.index,
  pos:(x.bucket==='paint'||/paint|hood|body|livery/.test(x.bucket))&&a.uv?Array.from(a.position.array):null,
  uvs:(x.bucket==='paint'||/paint|hood|body|livery/.test(x.bucket))&&a.uv?Array.from(a.uv.array):null,
  index:(x.bucket==='paint'||/paint|hood|body|livery/.test(x.bucket))&&G.index?Array.from(G.index.array):null}})});
r.forEach(x=>console.log(x.group,x.bucket,x.n,x.uv,x.idx));
fs.writeFileSync('geo.json',JSON.stringify(r.filter(x=>x.pos)));await b.close();})();
