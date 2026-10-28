const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const a of process.argv.slice(2)){const [f,out,W]=a.split('::');let s=fs.readFileSync(f,'utf8').replace(/<\?xml[^>]*>/,'').replace(/<!DOCTYPE[^>]*>/,'');
 await p.setViewportSize({width:+W,height:+W});
 await p.setContent(`<html><body style="margin:0;background:transparent"><div id=d style="width:${W}px">${s}</div></body></html>`);
 await p.evaluate(W=>{const v=document.querySelector('svg');v.removeAttribute('width');v.removeAttribute('height');v.style.width=W+'px';v.style.height='auto';v.style.display='block';},+W);
 const bb=await p.evaluate(()=>{const r=document.querySelector('svg').getBoundingClientRect();return [r.width,r.height]});
 await p.setViewportSize({width:+W,height:Math.ceil(bb[1])});
 await p.screenshot({path:out,omitBackground:true,clip:{x:0,y:0,width:+W,height:Math.ceil(bb[1])}});}
await b.close();})();
