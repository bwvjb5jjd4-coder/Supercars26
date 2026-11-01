/* ui72: interface polish on top of ui58.
   Standings row and car fix, Settings sub-tabs, main menu tile art, tidier inbox,
   richer Career Home hero, broadcast-style race results, context button prompts
   and hold Y to restart a session from the pause menu.
   Display only, apart from the inbox auto-archive (old mail is marked read). */
(()=>{'use strict';
const ASSET=/*UI72_ASSET*/{},TRACK_ART=/*UI72_TRACK*/{};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=()=>typeof live!=='undefined'?live:null;
const hasCareer=()=>typeof D!=='undefined'&&!!D;
const carArt=n=>ASSET.cars?.[String(n)]||ASSET.car;
const svgUrl=s=>`url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const btn=(k,t)=>`<i class="u58-btn ${k}">${t}</i>`;
const UI72=window.UI72={};

/* ---------- Shared style ---------- */
const css=document.createElement('style');css.id='ui72-style';css.textContent=`
/* 1. Standings: readable player row */
.u58 .dc-table tr.mine{background:linear-gradient(90deg,#ff1e3c55,#ff1e3c10)!important}.u58 .dc-table tr.mine td{background:transparent!important;color:#fff!important;opacity:1!important}
.u58 .dc-table tr.mine td:first-child{box-shadow:inset 4px 0 var(--u58-red)}
.u58 .dc-table tr.mine td small,.u58 .dc-table tr.mine td .dc-muted{color:#f1c9d0!important}
.u72-you{display:inline-block;margin-left:8px;padding:2px 6px;background:var(--u58-red);color:#fff;font:700 9px 'UI Inter',sans-serif;letter-spacing:.12em;vertical-align:middle}
/* 2. Settings sub-tabs */
.u72-stabs{display:flex;align-items:center;gap:6px;margin:-4px 0 18px;padding-bottom:12px;border-bottom:1px solid #ffffff18;flex-wrap:wrap}
.u72-stabs button{border:0!important;background:transparent!important;color:var(--u58-dim,#9aa3b5)!important;font:700 14px 'UI Rajdhani',sans-serif!important;letter-spacing:.16em;text-transform:uppercase;padding:9px 16px!important;border-bottom:3px solid transparent!important;border-radius:0!important}
.u72-stabs button.on{color:#fff!important;border-bottom-color:var(--u58-red,#ff1e3c)!important}
.u72-stabs .u58-btn{margin:0 4px}
.u72-spane[hidden]{display:none!important}
.u72-spane>.dc-field:first-child{margin-top:0}
.u72-pad{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 22px;margin-top:6px}
.u72-pad div{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #ffffff10;font-size:13px;color:#dfe4ec}
.u72-pad .u58-btn{flex:none;min-width:34px}
.u72-pad .u58-btn.stick{background:#2b303c;color:#fff}
.dc-pause-box .u72-pad div{color:inherit}
/* 3. Main menu tile art */
.u58-tile .art.u72-svg{background-size:78% auto!important;background-repeat:no-repeat;background-position:50% 44%!important;opacity:.55}
.u58-tile .art.u72-svg.low{background-position:50% 70%!important}
.u58-tile:focus .art.u72-svg,.u58-tile.ui26-pad-focus .art.u72-svg,.u58-tile:hover .art.u72-svg{opacity:1;background-size:84% auto!important}
.u58-tile .art.u72-duo{background-size:auto 34%,auto 34%!important;background-position:30% 34%,78% 52%!important;background-repeat:no-repeat!important}
.u58-tile:focus .art.u72-duo,.u58-tile.ui26-pad-focus .art.u72-duo,.u58-tile:hover .art.u72-duo{background-size:auto 42%,auto 42%!important}
.u72-tilestat{position:absolute!important;left:22px;right:18px;top:120px;font:700 46px/.9 'UI Rajdhani',sans-serif;font-style:italic;color:#fff;text-shadow:0 4px 18px #000}
.u72-tilestat small{display:block!important;max-height:none!important;opacity:1!important;margin-top:6px!important;font:600 11px 'UI Inter',sans-serif!important;font-style:normal!important;letter-spacing:.14em;text-transform:uppercase;color:#cfd4df}
/* 4. Inbox */
.u72-inhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.u72-inhead .dc-btn.on{background:var(--u58-red,#ff1e3c)!important;color:#fff!important;border-color:transparent!important}
.u72-inhead .sp{flex:1}
.u72-group{margin-top:18px}
.u72-group>h4{margin:0 0 4px;font:700 12px 'UI Rajdhani',sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--u58-dim,#9aa3b5)}
.u72-mail{display:grid!important;grid-template-columns:14px 1fr auto;gap:4px 14px;align-items:start;width:100%;padding:16px 4px!important;border:0;border-bottom:1px solid #ffffff12;background:transparent;text-align:left;color:inherit}
.u72-mail .dot{width:9px;height:9px;border-radius:50%;margin-top:6px;background:transparent}
.u72-mail.unread .dot{background:var(--u58-red,#ff1e3c);box-shadow:0 0 10px var(--u58-red,#ff1e3c)}
.u72-mail h3{margin:0;font-size:16px}
.u72-mail:not(.unread) h3{color:#b9c0cc;font-weight:600}
.u72-mail .meta{font-size:11px;color:var(--u58-dim,#9aa3b5);letter-spacing:.06em;text-transform:uppercase;margin-top:5px}
.u72-mail p{grid-column:2/4;margin:4px 0 0;line-height:1.6;color:#aeb6c3;max-height:0;overflow:hidden;transition:max-height .25s}
.u72-mail.open p{max-height:400px}
.u72-tag{font:700 9px 'UI Inter',sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:3px 7px;border:1px solid #ffffff2a;color:#cfd4df;white-space:nowrap}
.u72-tag.imp{background:var(--u58-red,#ff1e3c);border-color:transparent;color:#fff}
.u72-tag.x{border-color:#ffd21e66;color:#ffd21e}
.u72-archive{margin-top:22px}
/* 5. Career Home hero */
.u72-strip{display:grid;grid-template-columns:120px 1fr 1fr;gap:14px;margin:6px 0 22px;max-width:640px}
.u72-strip>div{background:#ffffff08;border:1px solid #ffffff14;padding:12px 14px;min-width:0}
.u72-strip small{display:block;font:700 9px 'UI Inter',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--u58-dim,#9aa3b5);margin-bottom:8px}
.u72-strip svg{width:100%;height:70px;color:var(--u58-red,#ff1e3c);filter:drop-shadow(0 0 6px #ff1e3c88)}
.u72-fc{display:flex;gap:10px;justify-content:space-between}
.u72-fc div{text-align:center;font-size:11px;color:#cfd4df}
.u72-fc b{display:block;font:700 20px 'UI Rajdhani',sans-serif;color:#fff}
.u72-fc i{display:block;font-style:normal;color:#7fc4ff;font-size:10px;margin-top:2px}
.u72-last b{font:700 34px/1 'UI Rajdhani',sans-serif;font-style:italic;color:#fff}
.u72-last span{display:block;font-size:11px;color:#cfd4df;margin-top:6px;line-height:1.4}
/* 6. Results */
.dc-modal .u72-res{width:min(1100px,100%)!important;padding:30px 34px!important;background:linear-gradient(160deg,#151925,#07080d)!important;color:#f4f6fa!important;border:1px solid #ffffff1c!important;border-top:3px solid var(--u58-red,#ff1e3c)!important}
.u72-res .head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.u72-res .head h2{margin:6px 0 0!important;font:700 44px/1 'UI Rajdhani',sans-serif!important;font-style:italic!important}
.u72-res .dc-eyebrow{color:var(--u58-red,#ff1e3c)!important}
.u72-flag{width:54px;height:36px;background:conic-gradient(#fff 25%,#000 0 50%,#fff 0 75%,#000 0) 0 0/18px 18px;border:1px solid #fff4;animation:u72wave 1.4s ease-in-out infinite alternate}
@keyframes u72wave{from{transform:skewY(-4deg)}to{transform:skewY(4deg)}}
.u72-podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:14px;margin:26px 0 8px}
.u72-step{text-align:center;opacity:0;animation:u72up .6s cubic-bezier(.2,.8,.2,1) forwards}
.u72-step:nth-child(1){animation-delay:.25s}.u72-step:nth-child(2){animation-delay:.05s}.u72-step:nth-child(3){animation-delay:.45s}
@keyframes u72up{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.u72-step img{width:100%;max-width:300px;height:150px;object-fit:contain;filter:drop-shadow(0 18px 18px #000c)}
.u72-step .name{font:700 17px 'UI Rajdhani',sans-serif;text-transform:uppercase;letter-spacing:.04em;margin:6px 0 8px}
.u72-step .name small{display:block;font:500 11px 'UI Inter',sans-serif;color:var(--u58-dim,#9aa3b5);text-transform:none;letter-spacing:0;margin-top:2px}
.u72-step .block{display:grid;place-items:center;font:700 52px 'UI Rajdhani',sans-serif;font-style:italic;background:linear-gradient(180deg,#262b38,#11141c);border:1px solid #ffffff1c;border-top:3px solid #c0c6d0}
.u72-step.p1 .block{height:130px;border-top-color:#ffd21e;color:#ffd21e}.u72-step.p2 .block{height:96px}.u72-step.p3 .block{height:74px;border-top-color:#cd7f32}
.u72-step.me .name{color:var(--u58-red,#ff1e3c)}
.u72-you3{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 6px}
.u72-you3>div{background:#ffffff08;border:1px solid #ffffff14;padding:14px 16px}
.u72-you3 small{display:block;font:700 9px 'UI Inter',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--u58-dim,#9aa3b5)}
.u72-you3 b{display:block;font:700 34px/1.1 'UI Rajdhani',sans-serif;font-style:italic;margin-top:6px}
.u72-you3 em{font-style:normal;font-size:17px;font-weight:700;margin-left:6px}
.u72-up{color:#19e07a}.u72-down{color:#ff4d64}.u72-same{color:#9aa3b5}
.u72-res details{margin-top:14px}
.u72-res summary{cursor:pointer;font:700 12px 'UI Rajdhani',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--u58-dim,#9aa3b5);padding:8px 0}
.u72-res .dc-table{max-height:36vh}
.u72-res .dc-table td,.u72-res .dc-table th{color:#e8ebf1;border-color:#ffffff12}
.u72-res tr.mine td{background:#ff1e3c30!important}
/* 7. Context prompts and hold-to-restart */
#ui26-pad-hints.u72 i.u58-btn{margin-right:2px}
#ui26-pad-hints.u72{font-family:'UI Inter',sans-serif;font-size:11px;letter-spacing:.04em;background:#07080ded;border-color:#ffffff22}
#u72-hold{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30000;display:grid;place-items:center;width:150px;height:150px;border-radius:50%;background:#07080dde;color:#fff;font:700 13px 'UI Rajdhani',sans-serif;letter-spacing:.18em;text-transform:uppercase;text-align:center;pointer-events:none}
#u72-hold[hidden]{display:none}
#u72-hold svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
#u72-hold circle{fill:none;stroke-width:6}
@media(max-width:900px){.u72-strip{grid-template-columns:1fr}.u72-you3{grid-template-columns:1fr 1fr}.u72-podium{gap:6px}.u72-step img{height:70px}}
`;document.head.appendChild(css);

/* ---------- Car body by livery (BJR #8 races a ZB) ---------- */
function makeOf(team,driver){try{const m=window.RF49_KEY_MAKE?.[sc27LiveryProfile(team,driver)?.key];if(m&&MFG[m])return m;}catch(_){}return team.manufacturer;}
UI72.makeOf=makeOf;

/* ---------- 1. Championship standings ---------- */
if(typeof dcChampionship==='function'){const base=dcChampionship;dcChampionship=function(){
 let html=base.apply(this,arguments);
 try{const rows=dcDrivers().map((x,i)=>{const mk=makeOf(x.team,x.d),m=MFG[mk]||MFG[x.team.manufacturer];const me=x.d.id===D.pid;
  return `<tr class="${me?'mine':''}"><td>${i+1}</td><td><b>#${x.d.number} ${esc(x.d.name)}</b>${me?'<span class="u72-you">You</span>':''}<br><small class="dc-muted">${x.d.age} years · ${esc(x.d.home)}</small></td><td style="border-left:3px solid ${m.colour}">${m.car}<br><small class="dc-muted">${esc(x.team.name)}</small></td><td>${x.d.ovr.toFixed(1)}</td><td>${x.d.pot.toFixed(1)}</td><td><b>${x.d.pts}</b></td><td>${x.d.wins}</td></tr>`;}).join('');
  html=html.replace(/<tbody>[\s\S]*?<\/tbody>/,`<tbody>${rows}</tbody>`);}catch(_){}
 return html;};}

/* ---------- 2. Settings sub-tabs ---------- */
const SET_CATS=[['gameplay','Gameplay'],['controls','Controls'],['audio','Audio'],['graphics','Graphics']];
let setTab='gameplay';
function catOf(el){const t=(el.textContent||'').toLowerCase().replace(/\s+/g,' ').slice(0,260);
 if(/sound mix|^ *volume/.test(t))return 'audio';
 if(/cockpit suspension/.test(t))return 'graphics';
 if(/cycles cockpit|steering sensitivity|deadzone|driving assists|classic handling|^ *handling/.test(t))return 'controls';
 if(/graphics|cinematic|motion blur|cockpit suspension|balanced and high|frame runs/.test(t))return 'graphics';
 return 'gameplay';}
function padMap(){const rows=[['a','A','Change camera'],['b','B','Request pit stop'],['x','X','Wipers off / low / high'],['y','Y','Headlights'],['bump','RT','Throttle'],['bump','LT','Brake'],['stick','LS','Steer'],['bump','LB','Reverse (hold)'],['bump','RB','Pit limiter'],['bump','☰','Pause'],['bump','⧉','Hide the speed HUD'],['bump','◂ ▸','Cycle the MFD page']];
 return `<div class="dc-card u72-padmap" style="margin-top:18px"><h3>Controller layout</h3><div class="u72-pad">${rows.map(([k,b,t])=>`<div>${btn(k,b)}<span>${t}</span></div>`).join('')}</div><p class="dc-note" style="margin-top:12px">In menus: D-pad or left stick to move, A to select, B to go back, LB/RB to switch tabs, LT/RT to switch settings sections. While paused, hold Y to restart the session.</p></div>`;}
function organizeSettings(){
 for(const mark of document.querySelectorAll('i[data-u72s]')){const host=mark.parentElement;if(!host)continue;
  let set=host.querySelector(':scope>.u72-set');
  if(!set){if(!SET_CATS.some(([k])=>k===setTab))setTab='gameplay';
   set=document.createElement('div');set.className='u72-set';
   set.innerHTML=`<div class="u72-stabs">${btn('bump','LT')}${SET_CATS.map(([k,l])=>`<button type="button" class="${k===setTab?'on':''}" data-u72cat="${k}" onclick="UI72.setTab('${k}')">${l}</button>`).join('')}${btn('bump','RT')}</div>${SET_CATS.map(([k])=>`<div class="u72-spane" data-cat="${k}" ${k===setTab?'':'hidden'}></div>`).join('')}`;
   mark.after(set);set.querySelector('[data-cat="controls"]').dataset.tail='1';set.querySelector('[data-cat="controls"]').insertAdjacentHTML('beforeend',padMap());}
  const pane=k=>set.querySelector(`.u72-spane[data-cat="${k}"]`);
  const take=n=>{if(n===mark||n===set)return;if(n.nodeType===3){if(!n.textContent.trim()){n.remove();return;}const p=document.createElement('p');p.className='dc-note';p.textContent=n.textContent.trim();n.replaceWith(p);n=p;}if(n.nodeType!==1)return;
   if(n.matches('.dc-grid.two')){[...n.children].forEach(col=>[...col.childNodes].forEach(take));n.remove();return;}
   const camText='Camera: A on the controller (C on the keyboard) cycles cockpit, follow, bonnet and orbit views.';
   if(/C cycles cockpit/.test(n.textContent)){if(!n.querySelector('input,select,button')){n.textContent=camText;n.className='dc-note';}else{const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let x;while((x=w.nextNode()))if(/C cycles cockpit/.test(x.textContent))x.textContent=camText;}}
   const k=catOf(n),dest=pane(k),tail=dest.querySelector(':scope>.u72-padmap');if(tail)dest.insertBefore(n,tail);else dest.appendChild(n);};
  let n=mark.nextSibling;const stray=[];while(n){if(n!==set)stray.push(n);n=n.nextSibling;}
  stray.forEach(take);}}
UI72.organize=organizeSettings;
UI72.setTab=k=>{setTab=k;document.querySelectorAll('.u72-set').forEach(s=>{s.querySelectorAll('[data-u72cat]').forEach(b=>b.classList.toggle('on',b.dataset.u72cat===k));s.querySelectorAll('.u72-spane').forEach(p=>p.hidden=p.dataset.cat!==k);});
 const b=document.querySelector(`.u72-set [data-u72cat="${k}"]`);if(b&&document.body.classList.contains('ui26-controller-active')){document.querySelector('.ui26-pad-focus')?.classList.remove('ui26-pad-focus');b.focus({preventScroll:true});b.classList.add('ui26-pad-focus');}};
UI72.stepTab=s=>{const i=SET_CATS.findIndex(([k])=>k===setTab);UI72.setTab(SET_CATS[(i+s+SET_CATS.length)%SET_CATS.length][0]);};
if(typeof dcSettingsFields==='function'){const base=dcSettingsFields;dcSettingsFields=function(...args){return '<i data-u72s hidden></i>'+base.apply(this,args);};}
setInterval(organizeSettings,250);
if(typeof dcSettings==='function'){const base=dcSettings;dcSettings=function(){let html=base.apply(this,arguments);
 html=html.replace('Tune steering, difficulty, audio and graphics. Settings are also available while paused.','Gameplay, controls, audio and graphics. Use LT and RT (or [ and ]) to switch sections. Settings are also available while paused.');
 html=html.replace(/<section class="dc-card"><h3>Controls<\/h3>[\s\S]*?<\/section>/,`<section class="dc-card"><h3>Keyboard</h3><p>WASD or arrows: drive and steer. C: camera. R: wipers. H: lights. P: pit request. Space: brake. Esc: pause. T: hide the HUD. M: MFD page.</p><p class="dc-note">The full controller layout is under Settings → Controls.</p><button class="dc-btn ghost" onclick="dcNewCareerPrompt()">Start another career</button></section>`);
 return html;};}

/* ---------- 3. Main menu tile art ---------- */
const GEAR_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#ff1e3c"/><stop offset="1" stop-color="#5a0614"/></radialGradient></defs><g fill="none" stroke="url(#g)" stroke-width="7"><path d="M100 28l10 2 4 16 11 5 14-9 14 14-9 14 5 11 16 4 2 10-2 10-16 4-5 11 9 14-14 14-14-9-11 5-4 16-10 2-10-2-4-16-11-5-14 9-14-14 9-14-5-11-16-4-2-10 2-10 16-4 5-11-9-14 14-14 14 9 11-5 4-16z"/><circle cx="100" cy="100" r="30"/></g><g stroke="#ffffff55" stroke-width="3" fill="none"><path d="M40 176h120M58 188h84"/></g></svg>`;
const TROPHY_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#8a6a10"/><stop offset=".45" stop-color="#ffe27a"/><stop offset="1" stop-color="#9c7412"/></linearGradient></defs><path d="M62 30h76v34c0 30-17 50-38 50S62 94 62 64z" fill="url(#t)"/><path d="M62 42H38c0 26 12 38 28 40M138 42h24c0 26-12 38-28 40" fill="none" stroke="url(#t)" stroke-width="7"/><path d="M92 112h16v30H92z" fill="url(#t)"/><path d="M70 142h60l6 20H64z" fill="url(#t)"/><path d="M58 162h84v14H58z" fill="#1b1e27" stroke="#ffe27a66"/><path d="M86 44l6 18h-14z" fill="#ffffff55"/></svg>`;
const CAL_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="34" y="44" width="132" height="120" rx="10" fill="#1b1e27" stroke="#ffffff55" stroke-width="3"/><path d="M34 54a10 10 0 0 1 10-10h112a10 10 0 0 1 10 10v20H34z" fill="#ff1e3c"/><path d="M66 30v26M134 30v26" stroke="#fff" stroke-width="8" stroke-linecap="round"/><g fill="#ffffff44">${[0,1,2,3].map(r=>[0,1,2,3].map(c=>`<rect x="${50+c*27}" y="${86+r*19}" width="20" height="12" rx="2"/>`).join('')).join('')}</g><rect x="77" y="105" width="20" height="12" rx="2" fill="#ff1e3c"/></svg>`;
function trackSvg(id){const d=TRACK_ART[String(id)];if(!d)return null;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><path d="${d}" fill="none" stroke="#ff1e3c" stroke-opacity=".35" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;}
function testTrackId(){try{if(typeof dcTestTrack==='function'){const e=dcTestTrack();if(e)return e.id;}}catch(_){}try{return dcEvent()?.id??0;}catch(_){return 0;}}
function decorateTiles(){const rail=document.querySelector('#ui26-portal .u58-rail');if(!rail||rail.dataset.u72)return;rail.dataset.u72='1';
 for(const t of rail.querySelectorAll('.u58-tile')){const title=(t.querySelector('strong')?.textContent||'').toLowerCase(),art=t.querySelector('.art');if(!art)continue;
  if(title==='instant race'){art.style.backgroundImage=`url('${carArt(19)}')`;}
  else if(title==='co-op'){art.classList.add('u72-duo');art.style.backgroundImage=`url('${carArt(18)}'),url('${carArt(888)}')`;}
  else if(title==='test day'){const s=trackSvg(testTrackId());if(s){art.classList.add('u72-svg');art.style.backgroundImage=svgUrl(s);}}
  else if(title==='standings'){art.classList.add('u72-svg','low');art.style.backgroundImage=svgUrl(TROPHY_SVG);
   try{const list=dcDrivers(),i=list.findIndex(x=>x.d.id===D.pid);if(i>=0){const s=document.createElement('span');s.className='u72-tilestat';s.innerHTML=`P${i+1}<small>${list[i].d.pts} pts · leader ${list[0].d.pts}</small>`;t.appendChild(s);}}catch(_){}}
  else if(title==='calendar'){art.classList.add('u72-svg','low');art.style.backgroundImage=svgUrl(CAL_SVG);
   try{const s=document.createElement('span');s.className='u72-tilestat';s.innerHTML=`${D.year+1}<small>${window.CL73?CL73.next().length:16} rounds · tap a round to swap it</small>`;t.appendChild(s);}catch(_){}}
  else if(title==='settings'){art.classList.add('u72-svg');art.style.backgroundImage=svgUrl(GEAR_SVG);}}}
{const portal=$('ui26-portal');if(portal)new MutationObserver(()=>queueMicrotask(decorateTiles)).observe(portal,{childList:true,subtree:true});}

/* ---------- 4. Inbox ---------- */
const ARCHIVE_DAYS=14;let inFilter='all',showArchive=false;
const openMail=new Set();
function mailAge(m){return (D.year-(m.year||D.year))*365+(D.day-(m.day||0));}
function mailKind(m){const f=String(m.from||''),t=String(m.title||'');let ceo='';try{ceo=dcTeam().ceo||'';}catch(_){}
 if(/driver manager/i.test(f)||/contract|offer|seat|season complete|bonus/i.test(t))return 'important';
 if(ceo&&f===ceo)return /^(P\d+|DNF)/.test(t)?'team':'important';
 if(/engineer|coach/i.test(f))return 'engineer';
 if(/travel/i.test(f))return 'travel';
 return 'series';}
const KIND_LABEL={important:'Important',team:'Team',engineer:'Engineer',travel:'Travel',series:'Series'};
function autoArchive(){if(!hasCareer()||!Array.isArray(D.mail))return;let changed=false;for(const m of D.mail)if(m.unread&&mailAge(m)>ARCHIVE_DAYS){m.unread=false;changed=true;}
 // Repeated weekly mails (same title and sender): only the newest stays unread.
 const seen=new Set();for(const m of D.mail){const k=m.from+'|'+m.title;if(seen.has(k)&&m.unread){m.unread=false;changed=true;}seen.add(k);}
 return changed;}
function mailRow(m,dup){const kind=mailKind(m),open=openMail.has(m.id);
 return `<button type="button" class="u72-mail ${m.unread?'unread':''} ${open?'open':''}" data-mail="${m.id}" onclick="UI72.mail(${m.id},this)"><span class="dot"></span><span><h3>${esc(m.title)}</h3><div class="meta">${esc(m.from)} · ${esc(dcDateLabel(m.day))}</div></span><span>${kind==='important'?'<span class="u72-tag imp">Important</span>':`<span class="u72-tag">${KIND_LABEL[kind]}</span>`}${dup>1?` <span class="u72-tag x">×${dup}</span>`:''}</span><p>${esc(m.body)}</p></button>`;}
if(typeof dcInbox==='function'){dcInbox=function(){
 const list=[],dupes={};for(const m of D.mail){const k=m.from+'|'+m.title;if(dupes[k]){dupes[k].n++;continue;}dupes[k]={m,n:1};list.push(m);}
 const n=m=>dupes[m.from+'|'+m.title].n;
 const pass=m=>inFilter==='all'||(inFilter==='unread'?m.unread:inFilter==='important'?mailKind(m)==='important':mailKind(m)===inFilter);
 const fresh=list.filter(m=>mailAge(m)<=ARCHIVE_DAYS&&pass(m)),old=list.filter(m=>mailAge(m)>ARCHIVE_DAYS&&pass(m));
 const attention=fresh.filter(m=>m.unread&&mailKind(m)==='important'),week=fresh.filter(m=>!attention.includes(m)&&mailAge(m)<=7),earlier=fresh.filter(m=>!attention.includes(m)&&mailAge(m)>7);
 const unread=D.mail.filter(m=>m.unread).length;
 const group=(title,arr)=>arr.length?`<div class="u72-group"><h4>${title}</h4>${arr.map(m=>mailRow(m,n(m))).join('')}</div>`:'';
 const filters=[['all','All'],['unread','Unread'],['important','Important'],['engineer','Engineer'],['team','Team'],['series','Series']];
 return `<h1 class="dc-title">Your inbox</h1><p class="dc-sub">${unread?`${unread} unread`:'All caught up'} · Mail older than two weeks moves to the archive and repeated weekly mail is grouped.</p><section class="dc-card"><div class="u72-inhead">${filters.map(([k,l])=>`<button type="button" class="dc-btn ${inFilter===k?'on':''}" onclick="UI72.filter('${k}')">${l}</button>`).join('')}<span class="sp"></span><button type="button" class="dc-btn" onclick="UI72.readAll()">${btn('x','X')} Mark all read</button></div>
 ${group('Needs your attention',attention)}${group('This week',week)}${group('Earlier',earlier)}${!fresh.length?'<p class="dc-note" style="margin-top:18px">Nothing new here.</p>':''}
 ${old.length?`<div class="u72-archive"><button type="button" class="dc-btn ghost" onclick="UI72.archive()">${showArchive?'Hide':'Show'} archive (${old.length})</button>${showArchive?group('Archive',old):''}</div>`:''}</section>`;};}
UI72.mail=(id,el)=>{const m=D.mail.find(x=>x.id===id);if(!m)return;const wasUnread=m.unread;
 // Opening one mail of a repeated group marks the whole group read.
 for(const x of D.mail)if(x.from===m.from&&x.title===m.title)x.unread=false;
 if(openMail.has(id))openMail.delete(id);else openMail.add(id);el.classList.toggle('open',openMail.has(id));el.classList.remove('unread');
 if(wasUnread){try{dcSave();}catch(_){}refreshBadge();}};
UI72.filter=k=>{inFilter=k;dcRender();};
UI72.archive=()=>{showArchive=!showArchive;dcRender();};
UI72.readAll=()=>{if(!hasCareer())return;D.mail.forEach(m=>m.unread=false);try{dcSave();}catch(_){}dcRender();try{dcToast('Inbox marked as read');}catch(_){}};
function refreshBadge(){const u=D.mail.filter(m=>m.unread).length;document.querySelectorAll('.dc-side nav button').forEach(b=>{if(/Inbox/.test(b.textContent)){const s=b.querySelector('b');if(s){if(u)s.textContent=u;else s.remove();}}});
 document.querySelectorAll('.u58-ctabs button,.u58-chq-tabs button,[data-u58tab]').forEach(b=>{if(/^\s*Inbox/i.test(b.textContent)){const s=b.querySelector('b,em,.n');if(s){if(u)s.textContent=u;else s.remove();}}});}
if(typeof dcRender==='function'){const base=dcRender;dcRender=function(){if(!L()&&autoArchive()){try{dcSave();}catch(_){}}const out=base.apply(this,arguments);organizeSettings();return out;};try{if(typeof render!=='undefined'&&render===base)render=dcRender;}catch(_){}}

/* ---------- 5. Career Home hero ---------- */
const WX={Dry:'☀',Wet:'☂','Extremely Wet':'⛈'};
function heroStrip(){let e;try{e=dcEvent();}catch(_){}if(!e)return '';
 const map=TRACK_ART[String(e.id)]?`<svg viewBox="0 0 120 100"><path d="${TRACK_ART[String(e.id)]}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`:'<span class="dc-muted">Map unavailable</span>';
 const fc=D.weekend&&D.weekend.event===e.id&&Array.isArray(D.weekend.forecast)?D.weekend.forecast:null;
 const fcHtml=fc?`<div class="u72-fc">${fc.map(f=>`<div>${esc(String(f.day).slice(0,3))}<b>${WX[f.weather]||'☀'} ${Math.round(f.temp)}°</b><i>${Math.round(f.rain)}% rain</i></div>`).join('')}</div>`:'<span style="font-size:12px;color:#cfd4df">Forecast arrives in race week.</span>';
 const last=[...(D.history||[])].reverse().find(r=>r.year===D.year)||D.history?.[D.history.length-1];
 const lastHtml=last?`<div class="u72-last"><b>${last.retired?'DNF':'P'+last.position}</b><span>${esc(last.circuit)} · Race ${last.race+1}<br>+${last.points} pts${last.simulated?' · simulated':''}</span></div>`:'<div class="u72-last"><span>Your first result is waiting.</span></div>';
 return `<div class="u72-strip"><div><small>Circuit</small>${map}</div><div><small>Weekend forecast</small>${fcHtml}</div><div><small>Last result</small>${lastHtml}</div></div>`;}
if(typeof dcHome==='function'){const base=dcHome;dcHome=function(){const html=base.apply(this,arguments);try{const i=html.indexOf('<section class="dc-hero">');if(i<0)return html;const j=html.indexOf('<div class="dc-actions">',i);if(j<0)return html;return html.slice(0,j)+heroStrip()+html.slice(j);}catch(_){return html;}};}

/* ---------- 6. Race results ---------- */
let pre=null;
if(typeof dcCommitRace==='function'){const base=dcCommitRace;dcCommitRace=function(Lr){
 if(Lr&&!Lr.committed&&Lr.stage==='race'){try{const list=dcDrivers(),i=list.findIndex(x=>x.d.id===D.pid);pre={grid:Lr.entrants.map(x=>x.d.number),rank:i+1,pts:list[i]?.d.pts??0,instant:typeof IR!=='undefined'&&!!IR.active};}catch(_){pre=null;}}
 return base.apply(this,arguments);};}
function resultsHtml(r,label){
 const order=r.order||[],me=order.find(x=>x.position===r.position)||{},pos=r.position;
 const podium=[order[1],order[0],order[2]].map((x,k)=>x?`<div class="u72-step p${[2,1,3][k]} ${x.number===me.number?'me':''}"><img src="${esc(carArt(x.number))}" alt=""><div class="name">#${x.number} ${esc(x.name)}<small>${x.retired?'DNF':x.points+' pts'}</small></div><div class="block">${[2,1,3][k]}</div></div>`:'<div></div>').join('');
 const gi=pre?.grid?.indexOf(me.number),start=gi>=0?gi+1:null,gained=start&&!r.retired?start-pos:null;
 const delta=v=>v>0?`<em class="u72-up">▲ ${v}</em>`:v<0?`<em class="u72-down">▼ ${-v}</em>`:'<em class="u72-same">● 0</em>';
 let champ='';if(pre&&!pre.instant){try{const i=dcDrivers().findIndex(x=>x.d.id===D.pid)+1;champ=`<div><small>Championship</small><b>P${i} ${delta(pre.rank-i)}</b></div>`;}catch(_){}}
 return `<div class="dc-card u72-res"><div class="head"><div><div class="dc-eyebrow">Chequered flag / ${esc(r.circuit)} · Race ${(r.race||0)+1}${r.simulated?' · simulated':''}</div><h2>${r.retired?'Race retired':'You finished P'+pos}</h2></div><div class="u72-flag"></div></div>
 <div class="u72-podium">${podium}</div>
 <div class="u72-you3"><div><small>Finish</small><b>${r.retired?'DNF':'P'+pos}</b></div><div><small>Started</small><b>${start?'P'+start:'—'} ${gained!=null?delta(gained):''}</b></div><div><small>Points</small><b>+<span id="u72-pts" data-to="${r.points}">0</span></b></div>${champ||`<div><small>Conditions</small><b style="font-size:24px">${esc(r.weather||'')}</b></div>`}</div>
 <details><summary>Full classification</summary><div class="dc-table"><table><thead><tr><th>Pos</th><th>Driver</th><th>Status</th><th>Points</th></tr></thead><tbody>${order.map(x=>`<tr class="${x.number===me.number?'mine':''}"><td>${x.position}</td><td>#${x.number} ${esc(x.name)}</td><td>${x.retired?'DNF':'Finished'}</td><td>${x.points}</td></tr>`).join('')}</tbody></table></div></details>
 <button class="dc-btn primary" style="margin-top:20px" onclick="dcOverlay='';dcRender()">${esc(label)} →</button></div>`;}
function countUp(){const el=$('u72-pts');if(!el||el.dataset.done)return;el.dataset.done='1';const to=+el.dataset.to||0,t0=performance.now();const step=t=>{const k=Math.min(1,(t-t0)/1100);el.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1&&el.isConnected)requestAnimationFrame(step);};requestAnimationFrame(step);}
if(typeof dcShowResult==='function'){const base=dcShowResult;dcShowResult=function(r){base.apply(this,arguments);
 try{if(!r||!Array.isArray(r.order)||!r.order.length)return;const label=typeof IR!=='undefined'&&IR.active?'Return to instant weekend':'Return to your career';
  dcOverlay=`<div class="dc-modal">${resultsHtml(r,label)}</div>`;dcRender();setTimeout(countUp,350);}catch(e){console.warn('ui72 results',e);}};}

/* ---------- 7. Restart, context prompts, extra pad buttons ---------- */
function canRestart(){const x=L();if(!x||!x.dc||!x.paused||x.coop||x.committed||x.cd66Off)return false;try{if(typeof dcSimBusy!=='undefined'&&dcSimBusy)return false;if(typeof CO!=='undefined'&&CO.race)return false;}catch(_){}return !x.player?.finished;}
UI72.restart=()=>{if(!canRestart())return;const test=!!L().test;try{dcEndSession(false);dcLaunch(test);try{dcToast(test?'Test session restarted':'Session restarted');}catch(_){}}catch(e){console.warn('ui72 restart',e);try{dcRender();}catch(_){}}};
if(typeof dcPauseRender==='function'){const base=dcPauseRender;dcPauseRender=function(){const out=base.apply(this,arguments);
 try{if(dcPauseTab==='Options'&&canRestart()){const host=$('dc-pause-host'),btns=host?.querySelectorAll('.dc-btn');const leave=[...(btns||[])].find(b=>/return to career|End test|Return to/i.test(b.textContent));if(leave&&!host.querySelector('[data-u72r]')){leave.insertAdjacentHTML('afterend',`<button class="dc-btn" data-u72r style="margin-top:10px;display:flex;width:fit-content" onclick="UI72.restart()">Restart session · hold ${btn('y','Y')}</button>`);}}}catch(_){}
 organizeSettings();
 return out;};}
const hold=document.createElement('div');hold.id='u72-hold';hold.hidden=true;hold.innerHTML='<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="68" stroke="#ffffff22"/><circle id="u72-ring" cx="75" cy="75" r="68" stroke="#f2b705" stroke-dasharray="427" stroke-dashoffset="427"/></svg><span>Restarting<br>session</span>';document.body.appendChild(hold);
function context(){const x=L(),portal=$('ui26-portal');
 if(document.querySelector('#ui26-picker:not([hidden])'))return 'picker';
 if(x&&x.paused)return 'pause';if(x)return 'drive';
 if(portal&&!portal.hidden)return 'hub';
 if(document.querySelector('.dc-modal'))return 'modal';
 if(hasCareer()&&typeof dcTab!=='undefined')return 'career';return 'other';}
function hintsFor(c){const sel=`<span>${btn('a','A')} Select</span>`,bump=`<span>${btn('bump','LB')}${btn('bump','RB')} Tabs</span>`;
 const sets=!!document.querySelector('.u72-set')?`<span>${btn('bump','LT')}${btn('bump','RT')} Sections</span>`:'';
 if(c==='picker')return `<span>${btn('a','A')} Choose</span><span>${btn('b','B')} Cancel</span>`;
 if(c==='modal')return `<span>${btn('a','A')} Continue</span><span>${btn('b','B')} Close</span>`;
 if(c==='pause')return `${sel}<span>${btn('b','B')} Resume</span>${bump}${sets}${canRestart()?`<span>Hold ${btn('y','Y')} Restart</span>`:''}`;
 if(c==='hub')return `${sel}<span>${btn('b','B')} Back</span><span>${btn('bump','LB')}${btn('bump','RB')} Switch</span>`;
 if(c==='career'){const home=dcTab==='Home';return `${sel}<span>${btn('b','B')} ${home?'Main menu':'Home'}</span>${bump}${sets}${dcTab==='Inbox'?`<span>${btn('x','X')} Mark all read</span>`:''}`;}
 return `${sel}<span>${btn('b','B')} Back</span>`;}
let lastHint='',padPrev={},holdStart=0;
function tick(){
 const ph=$('ui26-pad-hints');const c=context();
 if(ph&&c!=='drive'){const h=hintsFor(c);if(h!==lastHint){lastHint=h;ph.classList.add('u72');ph.innerHTML=h;}}
 let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch(_){}
 if(!pad){padPrev={};holdStart=0;hold.hidden=true;return;}
 const down=i=>i>=6&&i<=7?(pad.buttons[i]?.value||0)>.5:!!pad.buttons[i]?.pressed,edge=i=>down(i)&&!padPrev[i];
 const menu=c!=='drive';
 if(menu&&document.querySelector('.u72-set')&&c!=='picker'&&c!=='modal'){if(edge(6))UI72.stepTab(-1);if(edge(7))UI72.stepTab(1);}
 if(c==='career'&&dcTab==='Inbox'&&edge(2))UI72.readAll();
 if(c==='pause'&&canRestart()&&down(3)){if(!holdStart)holdStart=performance.now();const k=Math.min(1,(performance.now()-holdStart)/1200);hold.hidden=false;const ring=$('u72-ring');if(ring)ring.setAttribute('stroke-dashoffset',String(427*(1-k)));if(k>=1){holdStart=0;hold.hidden=true;UI72.restart();}}
 else{holdStart=0;hold.hidden=true;}
 for(const i of [2,3,6,7])padPrev[i]=down(i);}
setInterval(tick,50);
document.addEventListener('keydown',e=>{if(L()&&!L().paused)return;if(!document.querySelector('.u72-set')||/INPUT|TEXTAREA/.test(document.activeElement?.tagName||'')&&document.activeElement.type!=='range')return;if(e.code==='BracketLeft'){UI72.stepTab(-1);e.preventDefault();}else if(e.code==='BracketRight'){UI72.stepTab(1);e.preventDefault();}});
})();
