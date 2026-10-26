const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [svg,out,W,col,vb]=process.argv.slice(2);let s=fs.readFileSync(svg,'utf8').replace('<svg','<svg fill="'+col+'"');
if(vb)s=s.replace(/viewBox="[^"]*"/,'viewBox="'+vb+'"');
const [x,y,w,h]=s.match(/viewBox="([^"]*)"/)[1].split(/[ ,]+/).map(Number);const H=Math.round(W*h/w);
s=s.replace('<svg','<svg width="'+W+'" height="'+H+'"');
const b=await chromium.launch();const p=await b.newPage({viewport:{width:+W,height:H}});
await p.setContent('<html><body style="margin:0;background:transparent">'+s+'</body></html>');
await p.screenshot({path:out,omitBackground:true,clip:{x:0,y:0,width:+W,height:H}});await b.close();})();
