/* lv78 livery switcher. Car Management gets a "Liveries" card where any livery with alternatives can be
   switched. Triple Eight (#88/#888, key 'redbull'): Default = 2020 Red Bull Holden, Bathurst = the same design in pink,
   Gold Coast = ocean blue/turquoise/sand with a sunset roof, surf and the Surfers Paradise skyline,
   ADF = Auscam camo, khaki and olive, Australian flag on the roof, Red Bull marks toned into the camo.
   The choice is saved in the career (D.settings.lv78) and in localStorage, so Instant Race uses it too.
   The profile key stays 'redbull', so gb75's grille bars and script keep working; only the texture and skirt change. */
const LV78_SETS={
 redbull:{team:0,label:'Triple Eight Race Engineering',cars:'#88 / #888',options:[
  {id:'default',name:'Default',desc:'2020 Red Bull Holden',art:{'88':'assets/img/3e2908e5ce.webp','888':'assets/img/d4e3cdf7b7.webp'}},
  {id:'bathurst',name:'Bathurst',desc:'Pink and white Red Bull Holden',tex:'redbullpink',skirt:'#ff3d9e',art:{'88':'assets/img/50ac8d3fdc.webp','888':'assets/img/16ba412ee1.webp'}},
  {id:'goldcoast',name:'Gold Coast',desc:'Surf, sand and sunset Red Bull Holden',tex:'redbullgc',skirt:'#0f9fb4',art:{'88':'assets/img/68d73a4a4e.webp','888':'assets/img/466aa2ef26.webp'}},
  {id:'adf',name:'ADF',desc:'Auscam camo, supporting the Australian Defence Force',tex:'redbulladf',skirt:'#4b5530',art:{'88':'assets/img/9b3f1fa9d5.webp','888':'assets/img/c786137fec.webp'}}]}
};
// Menu tile pictures of the Triple Eight cars (old 2018 art), swapped for the chosen livery's render of that car.
const LV78_TILE_ART={redbull:{'assets/img/8766614c66.webp':'88','assets/img/8ae6eb1ce3.webp':'888'}};
function lv78Saved(){try{return JSON.parse(localStorage.getItem('lv78Liveries')||'{}')||{}}catch(e){return {}}}
function lv78Choice(key){
 let v;try{v=D?.settings?.lv78?.[key]}catch(e){}
 v||=lv78Saved()[key];
 return LV78_SETS[key]?.options.find(o=>o.id===v)||LV78_SETS[key]?.options[0]||null;
}
function lv78Set(key,id){
 if(!LV78_SETS[key]?.options.some(o=>o.id===id))return;
 const all=lv78Saved();all[key]=id;try{localStorage.setItem('lv78Liveries',JSON.stringify(all))}catch(e){}
 try{if(D){(D.settings.lv78||={})[key]=id;dcSave();}}catch(e){}
 if(typeof dcRender==='function')dcRender();
 lv78Tiles();
}
window.lv78Set=lv78Set;window.lv78Choice=lv78Choice;

// Texture: the chosen option's texture replaces the team texture on every car wearing that key.
const lv78Wrap=dc35Wrap;
dc35Wrap=function(E,t,d,s){
 const o=lv78Choice(s?.key);
 if(o?.tex){const k=t.manufacturer+'_'+o.tex,tex=RF41_TEXTURES.get(k);if(tex){(E.dc35Textures||={})['rf41_'+k]=tex;return tex;}}
 return lv78Wrap(E,t,d,s);
};
// Lower skirt colour follows the livery.
const lv78Car=sc25Car;
sc25Car=function(E,team,driver){
 const car=lv78Car(E,team,driver);
 try{const key=car.userData.liveryIdentity?.key,o=lv78Choice(key),st=car.userData.dc35State;
  if(o?.skirt&&st?.rf42SkirtColor){st.rf41WhiteSkirt.value=1;st.rf42SkirtColor.value.set(o.skirt);}
  if(o&&car.userData.liveryIdentity)car.userData.liveryIdentity.variant=o.id;}catch(e){}
 return car;
};

function lv78Card(){
 const rows=Object.entries(LV78_SETS).map(([key,set])=>{
  const cur=lv78Choice(key),team=(typeof D!=='undefined'&&D?.world?.teams||[]).find(t=>t.id===set.team);
  return `<div class="lv78-row"><div class="lv78-team"><b>${esc(team?.name||set.label)}</b><small>${set.cars}</small></div><div class="lv78-opts">${set.options.map(o=>
   `<button class="lv78-opt${o.id===cur.id?' on':''}" onclick="lv78Set('${key}','${o.id}')"><img src="${Object.values(o.art)[0]}" alt=""><span><b>${esc(o.name)}</b><small>${esc(o.desc)}</small></span>${o.id===cur.id?'<i>Selected</i>':''}</button>`).join('')}</div></div>`;
 }).join('');
 return `<section class="dc-card lv78-card" style="margin-top:20px"><h3>Liveries</h3><p>Pick the livery each car wears. Applies from the next session.</p>${rows}</section>`;
}
// The card goes straight under the car/setup panels, above the long paddock table.
const lv78Page=dcCarPage;
dcCarPage=function(){const h=lv78Page(),i=h.indexOf('<section class="dc-card" style="margin-top:20px"><h3>Paddock');return i<0?h+lv78Card():h.slice(0,i)+lv78Card()+h.slice(i);};

// Menu tiles: show the chosen livery's render of the Triple Eight cars.
function lv78Tiles(root=document){
 for(const [key,olds]of Object.entries(LV78_TILE_ART)){
  const art=lv78Choice(key)?.art;if(!art)continue;
  root.querySelectorAll?.('img').forEach(im=>{const src=im.getAttribute('src')||'';
   let num=im.dataset.lv78n||Object.entries(olds).find(([o])=>src.endsWith(o))?.[1];
   if(!num||im.closest('.lv78-card'))return;
   im.dataset.lv78n=num;const want=art[num];if(want&&src!==want)im.setAttribute('src',want);});
 }
}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1){if(n.tagName==='IMG')lv78Tiles(n.parentNode||document);else lv78Tiles(n);}})
 .observe(document.documentElement,{childList:true,subtree:true});
lv78Tiles();

(()=>{const st=document.createElement('style');st.textContent=`
.lv78-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:12px 0;border-top:1px solid #ffffff1a}
.lv78-team{min-width:200px;display:flex;flex-direction:column;gap:3px}.lv78-team small{opacity:.65}
.lv78-opts{display:flex;flex-wrap:wrap;gap:12px;flex:1}
.lv78-opt{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:6px;width:230px;padding:8px;border-radius:10px;border:2px solid #ffffff22;background:#ffffff0d;color:inherit;font:inherit;text-align:left;cursor:pointer}
.lv78-opt img{width:100%;aspect-ratio:900/520;object-fit:contain;background:radial-gradient(#ffffff14,#0000 70%)}
.lv78-opt span{display:flex;flex-direction:column;gap:2px}.lv78-opt small{opacity:.65}
.lv78-opt.on{border-color:#e10600;background:#e1060018}
.lv78-opt i{position:absolute;top:8px;right:8px;font-style:normal;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;background:#e10600;color:#fff}
.lv78-opt:focus-visible,.lv78-opt:hover{border-color:#fff}`;document.head.appendChild(st);})();
