/* sv85 — career save safety (2026-11-01).
   1. Every time the career moves to a new round, the previous save is kept as a dated copy in the
      browser (last 6 rounds), so one bad save or reset can't wipe the whole career.
   2. Settings → "Earlier saves" lists those copies with a Restore button.
   3. If the browser refuses to save (storage full, private window), a red banner says so and offers
      Export, instead of the career silently not saving.
   4. The build also patches dc36Boot: the built-in starter career is only loaded when this browser
      has no career data at all. An unreadable save is copied aside instead of being written over. */
(function(){
'use strict';
const KEY=typeof DC_KEY==='string'?DC_KEY:'supercars_driver_career_v1';
const HIST=KEY+'_round_',UNDO=KEY+'_undo',KEEP=6;
const LS=(()=>{try{return window.localStorage;}catch(_){return null;}})();
if(!LS)return;
const proto=Object.getPrototypeOf(LS),rawSet=proto.setItem,rawGet=proto.getItem,rawRemove=proto.removeItem;
const get=k=>{try{return rawGet.call(LS,k);}catch(_){return null;}};
const parse=s=>{try{const n=JSON.parse(s);return n&&n.version===1&&n.world&&Array.isArray(n.world.teams)&&n.pid?n:null;}catch(_){return null;}};
const stamp=n=>(n.year||0)*1000+(n.round||0);
function histKeys(){const out=[];try{for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&k.startsWith(HIST))out.push(k);}}catch(_){}
 return out.sort((a,b)=>(+a.slice(HIST.length).split('_')[0]||0)-(+b.slice(HIST.length).split('_')[0]||0));}
function prune(n){const ks=histKeys();while(ks.length>n){try{rawRemove.call(LS,ks.shift());}catch(_){break;}}}
function keepCopy(old,raw){
 const k=HIST+stamp(old)+'_'+Date.now();
 let s=raw;try{if(old.activeSession){const c={...old};delete c.activeSession;s=JSON.stringify(c);}}catch(_){}
 const meta=JSON.stringify({t:Date.now(),year:old.year,round:old.round,day:old.day,label:label(old)});
 for(let i=0;i<3;i++){try{prune(KEEP-1);rawSet.call(LS,k,meta+'\n'+s);return true;}catch(e){prune(Math.max(0,histKeys().length-1));}}
 return false;
}
function label(n){try{const ev=(typeof EVENTS!=='undefined'&&EVENTS[n.round])||null;const t=n.world.teams.find(t=>t.drivers.some(d=>d.id===n.pid));const d=t&&t.drivers.find(d=>d.id===n.pid);
 return (ev?ev.name:'Round '+((n.round||0)+1))+' · '+(n.year||'')+(d?' · '+d.name:'')+(t?' ('+t.name+')':'');}catch(_){return 'Round '+((n.round||0)+1);}}
// --- 1 + 3: watch career writes ---------------------------------------------------------
let lastOldRaw=null,banner=null;
proto.setItem=function(k,v){
 if(this!==LS||(k!==KEY&&k!==KEY+'_backup'))return rawSet.apply(this,arguments);
 if(k===KEY){const oldRaw=get(KEY);
  if(oldRaw&&oldRaw!==lastOldRaw&&oldRaw!==v){const old=parse(oldRaw),nw=parse(v);
   if(old&&nw&&(stamp(old)!==stamp(nw)||old.pid!==nw.pid))keepCopy(old,oldRaw);}
  lastOldRaw=null;}
 try{const r=rawSet.apply(this,arguments);if(banner){banner.remove();banner=null;}return r;}
 catch(e){showBanner(e);throw e;}
};
function showBanner(e){try{if(banner)return;banner=document.createElement('div');banner.id='sv85-banner';
 banner.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100000;background:#b3261e;color:#fff;font:600 15px system-ui;padding:12px 18px;border-radius:10px;box-shadow:0 6px 24px #0008;display:flex;gap:14px;align-items:center;max-width:92vw';
 banner.innerHTML='<span>Your career is NOT being saved: the browser refused ('+String(e&&e.name||'storage error')+'). Export it now so you don\'t lose progress.</span>';
 const b=document.createElement('button');b.textContent='Export career';b.style.cssText='font:700 14px system-ui;padding:8px 12px;border-radius:8px;border:0;background:#fff;color:#b3261e;cursor:pointer';
 b.onclick=()=>{try{dcExport();}catch(_){}};banner.appendChild(b);
 const x=document.createElement('button');x.textContent='×';x.style.cssText='font:700 18px system-ui;background:none;border:0;color:#fff;cursor:pointer';x.onclick=()=>{banner.remove();banner=null;};banner.appendChild(x);
 document.body.appendChild(banner);}catch(_){}}
// --- 2: Settings list -------------------------------------------------------------------
function list(){return histKeys().reverse().map(k=>{const s=get(k)||'';const i=s.indexOf('\n');let m={};try{m=JSON.parse(s.slice(0,i));}catch(_){}return {key:k,...m};});}
function restore(k){const s=get(k);if(!s)return false;const n=parse(s.slice(s.indexOf('\n')+1));if(!n)return false;
 if(typeof live!=='undefined'&&live)return false;
 try{const cur=get(KEY);if(cur)rawSet.call(LS,UNDO,cur);}catch(_){}
 D=n;try{dcBindWorld();}catch(_){}dcSave();try{dcTab='Home';}catch(_){}dcRender();try{dcToast('Restored: '+label(n));}catch(_){}return true;}
function undo(){const s=get(UNDO);const n=parse(s);if(!n)return false;D=n;try{dcBindWorld();}catch(_){}dcSave();dcRender();return true;}
window.SV85={list,restore,undo,keepNow(){const s=get(KEY),n=parse(s);return n?keepCopy(n,s):false;}};
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function card(){const L=list(),u=parse(get(UNDO));
 const when=t=>{try{return new Date(t).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch(_){return '';}};
 return `<section class="dc-card" id="sv85-card"><h3>Earlier saves</h3><p class="dc-note">The game keeps a copy of your career each time you move on to a new round (last ${KEEP}). Restoring one replaces the current career, which is kept so you can undo.</p>`+
 (L.length?`<div class="dc-list">${L.map(m=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0"><span>${esc(m.label||m.key)}<br><small class="dc-muted">saved ${esc(when(m.t))}</small></span><button class="dc-btn" onclick="SV85.restore('${esc(m.key)}')">Restore</button></div>`).join('')}</div>`:'<p class="dc-muted">No earlier saves yet. One is kept when you move on to the next round.</p>')+
 (u?`<p><button class="dc-btn ghost" onclick="SV85.undo()">Undo last restore</button></p>`:'')+`</section>`;}
if(typeof dcRender==='function'){const base=dcRender;dcRender=function(){const out=base.apply(this,arguments);
 try{if((typeof live==='undefined'||!live)&&typeof dcTab!=='undefined'&&dcTab==='Settings'&&D&&!(typeof IR!=='undefined'&&IR.active)){
  const old=document.getElementById('sv85-card');if(old)old.remove();
  const host=document.querySelector('.dc-main');if(host){const exp=[...host.querySelectorAll('button')].find(b=>/dcExport\(\)/.test(b.getAttribute('onclick')||''));
   const sec=exp?exp.closest('section')||exp.parentElement:null;const w=document.createElement('div');w.innerHTML=card();
   if(sec&&sec.parentElement)sec.parentElement.insertBefore(w.firstElementChild,sec.nextSibling);else host.appendChild(w.firstElementChild);}}}catch(e){console.warn('sv85 card',e);}
 return out;};
 try{if(typeof render!=='undefined'&&render===base)render=dcRender;}catch(_){}}
// Keep one copy of whatever career is loaded right now, so the first round change isn't the first backup.
try{const s=get(KEY),n=parse(s);if(n&&!histKeys().some(k=>k.startsWith(HIST+stamp(n)+'_')))keepCopy(n,s);}catch(_){}
})();
