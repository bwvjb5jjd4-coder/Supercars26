/* cl73: season calendars and the Calendar page.
   EVENTS holds the season being raced: the 14 rounds of 2026, then a 16-round calendar for
   every later year. Instant Race and Co-Op (and the menus before a career exists) get every
   circuit. The Calendar page (main-menu tile and career sidebar) edits next season: pick a
   round and swap its circuit for any circuit not already on the calendar. Choices live in
   D.calendars[year] and are frozen once that season starts. */
(()=>{'use strict';
const ALL=EVENTS.slice();
const BASE=new Map(ALL.map(e=>[e.id,{week:e.week,date:e.date,type:e.type}]));
const byId=id=>ALL.find(e=>e.id===id);
const ROUNDS=16;
// The 2026 season exactly as it was before calendars existed.
const Y2026=ALL.filter(e=>BASE.get(e.id).week<50).map(e=>e.id);
// 2027 baseline: Phillip Island returns as a finals round, Winton comes back mid-year.
const BASELINE=[0,1,2,4,7,5,6,15,8,12,9,10,11,16,13,14];
// Race weekends (Sunday week numbers) for a 16-round season; a swapped circuit takes the slot's date.
const SLOTS=[8,13,16,20,22,25,28,31,33,35,37,41,43,45,48,49];
const ENDURO=[9,10];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ok=list=>Array.isArray(list)&&list.length>=8&&new Set(list).size===list.length&&list.every(id=>byId(id));

// Lookups by id or key still work for circuits that are off this season's calendar
// (race history, saved instant races, team test tracks).
Object.defineProperty(EVENTS,'find',{configurable:true,writable:true,value(f,t){return Array.prototype.find.call(this,f,t)??Array.prototype.find.call(ALL,f,t);}});

function full(){
 if(typeof D==='undefined'||!D)return true;
 if(typeof IR!=='undefined'&&(IR.active||IR.screen))return true;
 const C=window.CO63;return !!(C&&(C.active||C.race||C.screen));}
function sunday(year,week){const ref=new Date(Date.UTC(year,0,4));return new Date(ref.getTime()+(week*7-ref.getUTCDay())*864e5);}
function label(year,week){const sun=sunday(year,week),fri=new Date(sun.getTime()-2*864e5),m=d=>d.toLocaleDateString('en-AU',{month:'long',timeZone:'UTC'});
 return m(fri)===m(sun)?`${m(fri)} ${fri.getUTCDate()}–${sun.getUTCDate()}`:`${m(fri)} ${fri.getUTCDate()}–${m(sun)} ${sun.getUTCDate()}`;}
const short=(year,week)=>sunday(year,week).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
const weeksFor=ids=>ids.length===ROUNDS?SLOTS:ids.map(id=>BASE.get(id).week);
const typeOf=(id,i,n)=>ENDURO.includes(id)?'enduro':i>=n-4?'finals':'sprint';

// The calendar a season starts with when the player has not picked one.
function fallback(year){const prev=D.calendars?.[year-1];return prev&&prev.length===ROUNDS&&ok(prev)?prev.slice():BASELINE.slice();}
// Freeze the running season's calendar so later edits only ever touch next year.
function ensure(){
 if(D.year<=2026)return;
 const legacy=!D.calendars;D.calendars||={};
 if(ok(D.calendars[D.year]))return;
 // Careers already part-way through a later season keep the calendar they started on.
 D.calendars[D.year]=legacy&&(D.round>0||D.weekend)?Y2026.slice():fallback(D.year);}
function season(){if(D.year<=2026)return Y2026;ensure();return D.calendars[D.year];}
function apply(list,year){
 for(const e of ALL){const b=BASE.get(e.id);e.week=list?-100:b.week;e.date=b.date;e.type=b.type;}
 const events=list?list.map(byId):ALL;
 if(list&&year>2026){const w=weeksFor(list);events.forEach((e,i)=>{e.week=w[i];e.date=label(year,w[i]);e.type=typeOf(e.id,i,events.length);});}
 else if(list)events.forEach(e=>{const b=BASE.get(e.id);e.week=b.week;});
 if(EVENTS.length!==events.length||events.some((e,i)=>EVENTS[i]!==e))EVENTS.splice(0,EVENTS.length,...events);}
function sync(){try{if(full())apply(null);else apply(season(),D.year);}catch(err){console.warn('cl73 calendar',err);}}

// Next season, as it stands.
function next(){const y=D.year+1,c=D.calendars?.[y];return c&&c.length===ROUNDS&&ok(c)?c.slice():fallback(y);}
function store(list){D.calendars||={};D.calendars[D.year+1]=list;try{dcSave();}catch(_){}}

/* ---------- Page ---------- */
const css=document.createElement('style');css.id='cl73-style';css.textContent=`
.cl73-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.cl73-round{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-height:150px;padding:12px 12px 10px;text-align:left;cursor:pointer;color:inherit;font:inherit;background:#ffffff0c;border:1px solid #ffffff1f;border-radius:4px;overflow:hidden}
.cl73-round:hover,.cl73-round:focus,.cl73-round.ui26-pad-focus{outline:none;border-color:var(--u58-red,#ff1e3c);background:#ff1e3c1c}
.cl73-round small{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.cl73-round b{font-size:15px;line-height:1.15;margin-top:auto}
.cl73-round span{font-size:12px;opacity:.7}
.cl73-round svg{position:absolute;right:8px;top:24px;width:74px;height:62px;opacity:.55}
.cl73-round:hover svg,.cl73-round:focus svg,.cl73-round.ui26-pad-focus svg{opacity:1}
.cl73-round em{position:absolute;right:8px;top:8px;font-style:normal;font-size:10px;font-weight:700;letter-spacing:.12em;padding:2px 6px;border-radius:2px;background:#ffffff22}
.cl73-round.finals em{background:var(--u58-red,#ff1e3c);color:#fff}.cl73-round.enduro em{background:#f2c230;color:#111}
.cl73-round.new{box-shadow:inset 3px 0 #2fd27a}
.cl73-round.past{opacity:.45}.cl73-round.now{border-color:#f2c230}
.cl73-chips{display:flex;flex-wrap:wrap;gap:8px}.cl73-chips span{padding:6px 10px;border:1px dashed #ffffff33;border-radius:3px;font-size:13px}
.cl73-modal .dc-card{width:min(1000px,100%)!important}
`;document.head.appendChild(css);

function art(id){const d=window.UI58?.track?.[String(id)];return d?`<svg viewBox="0 0 120 100" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/></svg>`:'';}
const TAG={enduro:'ENDURO',finals:'FINALS',sprint:''};
function tile(e,i,n,year,week,extra=''){const type=typeOf(e.id,i,n);
 return `<small>R${i+1} · ${esc(short(year,week))}</small>${art(e.id)}${TAG[type]?`<em>${TAG[type]}</em>`:''}<b>${esc(e.circuit)}</b><span>${esc(e.name)}${extra}</span>`;}
function page(){
 const y=D.year+1,list=next(),w=weeksFor(list),now=season(),wNow=D.year<=2026?now.map(id=>BASE.get(id).week):weeksFor(now);
 const fresh=new Set(list.filter(id=>!now.includes(id)));
 const off=ALL.filter(e=>!list.includes(e.id));
 const changed=list.join()!==BASELINE.join();
 return `<h1 class="dc-title">Calendar</h1><p class="dc-sub">Build the ${y} season. Pick any round to swap its circuit for one that isn't on the calendar. The new circuit keeps that round's date. Changes save straight away and lock in when the ${y} season starts.</p>
 <div class="dc-actions" style="margin:0 0 16px"><button class="dc-btn primary" onclick="CL73.pick(0)">Change a round</button><button class="dc-btn" onclick="CL73.reset()" ${changed?'':'disabled'}>Reset to the 2027 baseline</button><button class="dc-btn" onclick="dcNav('Home')">Back</button></div>
 <section class="dc-card"><h3>${y} season · ${list.length} rounds</h3><div class="cl73-grid">${list.map((id,i)=>`<button type="button" class="cl73-round ${typeOf(id,i,list.length)} ${fresh.has(id)?'new':''}" onclick="CL73.pick(${i})">${tile(byId(id),i,list.length,y,w[i],fresh.has(id)?' · new':'')}</button>`).join('')}</div></section>
 <section class="dc-card" style="margin-top:20px"><h3>Not on the ${y} calendar</h3><div class="cl73-chips">${off.map(e=>`<span>${esc(e.circuit)}</span>`).join('')||'<span>Every circuit is in use.</span>'}</div></section>
 <section class="dc-card" style="margin-top:20px"><h3>${D.year} season · now racing</h3><div class="cl73-grid">${now.map((id,i)=>`<button type="button" class="cl73-round ${typeOf(id,i,now.length)} ${i<D.round?'past':i===D.round?'now':''}" onclick="dcNav('Championship')">${tile(byId(id),i,now.length,D.year,wNow[i],i<D.round?' · done':i===D.round?' · next':'')}</button>`).join('')}</div></section>`;}
function pick(i){if(!D)return;const y=D.year+1,list=next(),w=weeksFor(list),cur=byId(list[i]);if(!cur)return;
 const off=ALL.filter(e=>!list.includes(e.id));
 dcOverlay=`<div class="dc-modal cl73-modal"><div class="dc-card"><h3>Round ${i+1} · ${esc(label(y,w[i]))}</h3><p>Replace <b>${esc(cur.circuit)}</b> with a circuit that isn't on the ${y} calendar.</p>
 <div class="cl73-grid">${off.map(e=>`<button type="button" class="cl73-round" onclick="CL73.set(${i},${e.id})">${tile(e,i,list.length,y,w[i])}</button>`).join('')||'<p>Every circuit is already on the calendar.</p>'}</div>
 <div class="dc-actions" style="margin-top:16px"><button class="dc-btn" onclick="CL73.pick(${(i+list.length-1)%list.length})">‹ Previous round</button><button class="dc-btn" onclick="CL73.pick(${(i+1)%list.length})">Next round ›</button><button class="dc-btn primary" onclick="CL73.cancel()">Cancel</button></div></div></div>`;
 dcRender();requestAnimationFrame(()=>document.querySelector('.cl73-modal .cl73-round')?.focus({preventScroll:true}));}
function set(i,id){if(!D)return;const list=next();if(!byId(id)||list.includes(id))return;const old=byId(list[i]);list[i]=id;store(list);dcOverlay='';dcRender();
 try{dcToast(`Round ${i+1}: ${byId(id).circuit} replaces ${old.circuit}.`);}catch(_){}
 requestAnimationFrame(()=>document.querySelectorAll('.cl73-grid')[0]?.children[i]?.focus({preventScroll:true}));}
function reset(){if(!D)return;store(BASELINE.slice());dcRender();try{dcToast(`${D.year+1} calendar reset to the 2027 baseline.`);}catch(_){}}
function cancel(){dcOverlay='';dcRender();}

/* ---------- Hooks ---------- */
{const base=dcBindWorld;dcBindWorld=function(){sync();return base.apply(this,arguments);};}
{const base=dcRender;dcRender=function(){sync();return base.apply(this,arguments);};try{if(typeof render!=='undefined'&&render===base)render=dcRender;}catch(_){}}
if(typeof irRender==='function'){const base=irRender;irRender=function(){sync();return base.apply(this,arguments);};}
if(typeof irStart==='function'){const base=irStart;irStart=function(){sync();return base.apply(this,arguments);};}
if(typeof irResume==='function'){const base=irResume;irResume=function(){const out=base.apply(this,arguments);sync();return out;};}
// A saved instant race can be on any circuit, whatever the career season holds.
if(typeof irStored==='function'){const base=irStored;irStored=function(){const keep=EVENTS.slice();if(!full())EVENTS.splice(0,EVENTS.length,...ALL);try{return base.apply(this,arguments);}finally{if(keep.length!==EVENTS.length||keep.some((e,i)=>EVENTS[i]!==e))EVENTS.splice(0,EVENTS.length,...keep);}};}
if(window.CO63?.open){const base=CO63.open;CO63.open=function(){const out=base.apply(this,arguments);sync();return out;};}
if(window.UI26?.play){const base=UI26.play;UI26.play=function(mode){if(mode!=='instant'&&typeof IR!=='undefined'&&!IR.active&&IR.screen==='setup')IR.screen='';return base.apply(this,arguments);};}
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&document.querySelector('.cl73-modal')){e.preventDefault();e.stopPropagation();cancel();}},true);
window.CL73={page,pick,set,reset,cancel,next,sync,all:ALL,baseline:BASELINE,slots:SLOTS};
sync();
})();
