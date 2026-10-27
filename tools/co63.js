/* co63 · Co-Op: two-player split-screen instant race.
   Main menu tile → pair two controllers → pick the circuit → each player picks a car (both at once)
   → Top Ten Shootout with just the two players on track → grid → race → results.
   Player 1 is the game's normal player (L.player). Player 2 is a second entrant driven by its own pad:
   whenever P2 is stepped or rendered, the player context (L.player, camera mode, lights, pad state,
   pad mask) is swapped to P2, so every layer's "x===L.player" logic applies to P2 too.
   Split screen: the 3D view is the top half; P2's view is rendered first each frame and copied into
   a 2D canvas on the bottom half, then P1's view is rendered to the WebGL canvas. */
(()=>{'use strict';
const CO={active:false,race:false,screen:'',players:[null,null],cfg:null};
window.CO63=CO;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $id=id=>document.getElementById(id);
const COLORS=['#e3263a','#2f8cff'];
const WEATHER=[['Dry','Dry'],['Wet','Wet'],['Extremely Wet','Heavy rain']];
const LAPS=[3,5,8,12,20];
const TIMES=[['14:00','Afternoon'],['17:40','Sunset'],['21:00','Night'],['09:00','Morning']];
const LEVELS=['Easy','Intermediate','Hard'];

/* ---------- Gamepads ----------
   While a Co-Op screen is open every other layer sees no pads (so the normal menu code can't act
   behind the overlay). In a Co-Op session the other layers only see the pad of the player whose
   context is active (P1 by default), so their "first connected pad" logic follows that player. */
const rawPads=navigator.getGamepads?navigator.getGamepads.bind(navigator):()=>[];
CO.mask=null;
try{navigator.getGamepads=function(){const pads=rawPads();if(CO.mask===null)return pads;const out=[];for(let i=0;i<pads.length;i++){const p=pads[i];out.push(p&&p.index===CO.mask?p:null);}return out;};}catch(_){}
function padList(){try{return Array.from(rawPads()||[]).filter(p=>p&&p.connected);}catch(_){return [];}}
function padByIndex(i){return padList().find(p=>p.index===i)||null;}
function padName(p){const id=String(p?.id||'');return /xbox|xinput|045e/i.test(id)?'Xbox controller':/dualsense|dualshock|054c/i.test(id)?'PlayStation controller':'Controller';}

/* ---------- Car and circuit data ---------- */
function asset(){return window.UI58?.asset||{cars:{}};}
function trackArt(){return window.UI58?.track||{};}
function cars(){const out=[];RAW.forEach((t,team)=>[0,1].forEach(seat=>{const key=RF41_TEAM_KEYS?.[team]?.[seat],make=window.RF49_KEY_MAKE?.[key]||t[1];out.push({team,seat,number:t[7+seat],teamName:t[0],model:MFG[make]?.car||make,driver:t[2+seat]});}));return out;}
function events(){return EVENTS.map(e=>({id:e.id,name:e.circuit,km:e.lengthKm,event:e.name||e[0]}));}

/* ---------- Overlay screens ---------- */
const css=document.createElement('style');css.textContent=`
#co63{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(120% 90% at 80% 0%,#2a0d14 0%,#0b0e14 55%,#06080c 100%);color:#fff;font-family:inherit;overflow:hidden;display:flex;flex-direction:column;user-select:none}
#co63 .k{display:flex;align-items:center;gap:14px;padding:3.2vh 4vw 0;font-size:13px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;color:#d8dce4}
#co63 .k:before{content:'';width:42px;height:4px;background:#e3263a;border-radius:2px}
#co63 h1{margin:.6vh 4vw 0;font-size:clamp(34px,6vh,72px);font-style:italic;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;line-height:1}
#co63 .sub{margin:1vh 4vw 0;color:#aab1bd;font-size:15px}
#co63 .body{flex:1;min-height:0;padding:2.4vh 4vw 0;display:flex;flex-direction:column}
#co63 .foot{display:flex;gap:26px;align-items:center;padding:1.6vh 4vw 2.4vh;color:#c7ccd5;font-size:14px;font-weight:600}
#co63 .foot span{display:flex;align-items:center;gap:8px}
#co63 .btn{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;font-size:12px;font-weight:900;font-style:normal;color:#111;background:#fff}
#co63 .btn.a{background:#5dc12f;color:#fff}#co63 .btn.b{background:#e3263a;color:#fff}#co63 .btn.x{background:#2f8cff;color:#fff}#co63 .btn.y{background:#f2c200;color:#111}
#co63 .slots{display:grid;grid-template-columns:1fr 1fr;gap:3vw;flex:1;max-height:56vh;margin-top:2vh}
#co63 .slot{border:2px solid #2a303b;border-radius:14px;background:linear-gradient(180deg,#141922,#0d1017);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;position:relative;transition:border-color .2s,transform .2s}
#co63 .slot.on{border-color:var(--c);box-shadow:0 0 0 1px var(--c),0 18px 60px -20px var(--c)}
#co63 .slot .tag{position:absolute;top:18px;left:22px;font-weight:900;font-size:28px;font-style:italic;color:var(--c)}
#co63 .slot svg{width:min(18vw,190px);height:auto;opacity:.35}
#co63 .slot.on svg{opacity:1;color:var(--c)}
#co63 .slot strong{font-size:22px;font-weight:800}
#co63 .slot small{color:#aab1bd;font-size:15px}
#co63 .chk{display:grid;grid-template-columns:auto 160px;gap:6px 10px;align-items:center;font-size:12px;color:#aab1bd;margin-top:4px}#co63 .chk i{position:relative;height:8px;border-radius:4px;background:#232934;overflow:hidden}#co63 .chk b{position:absolute;top:0;bottom:0;background:var(--c)}
#co63 .pulse{animation:co63p 1.2s ease-in-out infinite}
@keyframes co63p{50%{opacity:.35}}
#co63 .tracks{display:grid;grid-template-columns:repeat(5,1fr);gap:1.2vh 1vw;flex:1;min-height:0;align-content:start}
#co63 .t{border:2px solid #232934;border-radius:10px;background:#10141c;padding:1vh .8vw;display:flex;flex-direction:column;align-items:center;min-height:0}
#co63 .t svg{width:100%;height:9.5vh;color:#cfd5de}
#co63 .t b{font-size:clamp(11px,1.6vh,15px);text-align:center;line-height:1.15;margin-top:.4vh}
#co63 .t small{color:#8d95a3;font-size:12px}
#co63 .sel{border-color:#e3263a;background:#1d1219;box-shadow:0 0 0 1px #e3263a}
#co63 .sel svg{color:#fff}
#co63 .opts{display:grid;grid-template-columns:repeat(4,1fr);gap:1vw;margin-top:1.6vh}
#co63 .o{border:2px solid #232934;border-radius:10px;background:#10141c;padding:1.1vh 1vw;display:flex;justify-content:space-between;align-items:center}
#co63 .o small{color:#8d95a3;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800}
#co63 .o b{font-size:17px}
#co63 .o i{font-style:normal;color:#6c7480;font-weight:900;padding:0 6px}
#co63 .o.sel i{color:#fff}
#co63 .cars{display:grid;grid-template-columns:repeat(6,1fr);gap:1vh .8vw;flex:1;min-height:0;align-content:start}
#co63 .c{position:relative;border:2px solid #232934;border-radius:10px;background:#10141c;padding:.6vh .5vw .8vh;display:flex;flex-direction:column;align-items:center;min-height:0}
#co63 .c img{width:100%;height:8.6vh;object-fit:contain}
#co63 .c b{font-size:clamp(14px,2.2vh,22px);font-weight:900;font-style:italic;line-height:1}
#co63 .c small{color:#9aa2ae;font-size:clamp(9px,1.25vh,12px);text-align:center;line-height:1.2;letter-spacing:.04em;text-transform:uppercase}
#co63 .c.p0{border-color:#e3263a}#co63 .c.p1{border-color:#2f8cff}#co63 .c.p0.p1{border-color:#e3263a #2f8cff #2f8cff #e3263a}
#co63 .c .who{position:absolute;top:5px;display:flex;gap:4px;left:6px}
#co63 .c .who i{font-style:normal;font-size:11px;font-weight:900;padding:2px 6px;border-radius:4px}
#co63 .c.lk0{background:linear-gradient(180deg,#3a0f17,#10141c)}#co63 .c.lk1{background:linear-gradient(180deg,#0f2440,#10141c)}
#co63 .c.taken{opacity:.35}
#co63 .ready{display:grid;grid-template-columns:1fr 1fr;gap:2vw;margin-top:1.4vh}
#co63 .ready div{border-left:5px solid var(--c);background:#10141c;border-radius:8px;padding:1vh 1vw;display:flex;justify-content:space-between;align-items:center;font-size:16px}
#co63 .ready b{font-size:15px;letter-spacing:.1em}
#co63 .res{flex:1;min-height:0;display:grid;grid-template-columns:1.1fr 1fr;gap:3vw}
#co63 .table{display:flex;flex-direction:column;gap:.5vh;min-height:0;overflow:hidden}
#co63 .row{display:grid;grid-template-columns:52px 64px 1fr 120px;align-items:center;background:#10141c;border-radius:6px;padding:.55vh 12px;font-size:clamp(12px,1.8vh,16px)}
#co63 .row b{font-weight:900}
#co63 .row.me{background:linear-gradient(90deg,var(--c) 0 6px,#1b2130 6px)}
#co63 .big{display:flex;flex-direction:column;justify-content:center;gap:2vh}
#co63 .big .pl{border-left:6px solid var(--c);background:#10141c;border-radius:10px;padding:2vh 1.6vw}
#co63 .big .pl small{color:#aab1bd;letter-spacing:.2em;font-weight:800;font-size:12px}
#co63 .big .pl b{display:block;font-size:clamp(36px,8vh,84px);font-style:italic;font-weight:900;line-height:1}
#co63 .big .pl span{color:#d0d5dd;font-size:16px}
#co63 .winner{font-size:clamp(20px,3.4vh,34px);font-weight:900;font-style:italic;text-transform:uppercase}
/* Split screen */
body.co63-race .dc-world{bottom:50%!important;height:50%!important}
#co63-split{position:absolute;left:0;right:0;bottom:0;height:50%;z-index:1;pointer-events:none;background:#000}
#co63-split canvas{width:100%;height:100%;display:block}
#co63-line{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;z-index:6;background:#06080c;pointer-events:none}
body.co63-race .dc-driving>:not(.dc-world):not(#dc-pause-host):not(#co63-split):not(#co63-line):not(.co63-hud){display:none!important}
body.co63-race #ui58-hud,body.co63-race #pt61-hud,body.co63-race .ui58-hud,body.co63-race .u58-hud,body.co63-race .u58-broadcast,body.co63-race #pf61-fps{display:none!important}
.co63-hud{position:absolute;left:0;right:0;height:50%;z-index:5;pointer-events:none;color:#fff;font-family:inherit}
.co63-hud.h0{top:0}.co63-hud.h1{bottom:0}
.co63-hud .tag{position:absolute;left:18px;top:14px;display:flex;align-items:stretch;border-radius:6px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.co63-hud .tag i{font-style:normal;background:var(--c);font-weight:900;font-style:italic;font-size:22px;padding:4px 12px}
.co63-hud .tag span{background:rgba(8,10,14,.82);padding:4px 12px;display:flex;flex-direction:column;justify-content:center;font-size:12px;line-height:1.15}
.co63-hud .tag span b{font-size:15px}
.co63-hud .pos{position:absolute;left:18px;top:64px;background:rgba(8,10,14,.82);border-radius:6px;padding:6px 12px;display:flex;gap:16px;align-items:baseline}
.co63-hud .pos b{font-size:30px;font-weight:900;font-style:italic}
.co63-hud .pos small{color:#aab1bd;font-size:12px;font-weight:800;letter-spacing:.12em}
.co63-hud .pos em{font-style:normal;font-size:18px;font-weight:800}
.co63-hud .gap{position:absolute;left:18px;top:118px;background:rgba(8,10,14,.7);border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700}
.co63-hud .gap:empty{display:none}
.co63-hud .dash{position:absolute;right:20px;bottom:16px;display:flex;align-items:flex-end;gap:12px;background:rgba(8,10,14,.78);border-radius:10px;padding:8px 14px}
.co63-hud .dash .sp{font-size:40px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;min-width:76px;text-align:right}
.co63-hud .dash small{color:#aab1bd;font-size:11px;font-weight:800;display:block;text-align:right}
.co63-hud .dash .g{font-size:46px;font-weight:900;line-height:1;width:34px;text-align:center;color:var(--c)}
.co63-hud .rpm{position:absolute;right:20px;bottom:88px;display:flex;gap:3px}
.co63-hud .rpm i{width:13px;height:7px;border-radius:2px;background:rgba(255,255,255,.18)}
.co63-hud .rpm i.on{background:#5dc12f}.co63-hud .rpm i.on.r{background:#e3263a}.co63-hud .rpm i.on.b{background:#2f8cff}
.co63-hud .msg{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:clamp(18px,3.6vh,34px);font-weight:900;font-style:italic;text-transform:uppercase;text-shadow:0 3px 14px rgba(0,0,0,.7);text-align:center;white-space:nowrap}
.co63-hud .lights{position:absolute;left:50%;top:22%;transform:translateX(-50%);display:flex;gap:10px;background:rgba(5,6,8,.85);padding:10px 14px;border-radius:10px}
.co63-hud .lights:empty{display:none}
.co63-hud .lights i{width:26px;height:26px;border-radius:50%;background:#2a0e10}
.co63-hud .mm{position:absolute;right:18px;top:14px;width:200px;height:140px;background:rgba(8,10,14,.62);border-radius:8px}
.co63-hud .lights i.on{background:#ff2433;box-shadow:0 0 16px #ff2433}
.co63-hud .lights.go i{background:#33e05a;box-shadow:0 0 16px #33e05a}
#co63-pause{position:absolute;inset:0;display:grid;place-items:center;background:rgba(4,6,10,.72);z-index:20}
#co63-pause .dc-pause-box{background:#0f131b;border:1px solid #2a303b;border-radius:14px;padding:28px 34px;min-width:min(440px,90vw);display:flex;flex-direction:column;gap:12px}
#co63-pause h2{margin:0 0 8px;font-style:italic;font-weight:900;text-transform:uppercase}
`;document.head.appendChild(css);

function overlay(){let el=$id('co63');if(!el){el=document.createElement('div');el.id='co63';document.body.appendChild(el);}return el;}
function hideMenus(on){const root=$id('root'),chrome=document.querySelector('.ui26-chrome');CO.menu=on;CO.mask=on?-1:(CO.race?CO.maskFor(0):null);if(on){try{document.activeElement?.blur?.();}catch(_){}}if(root)root.style.visibility=on?'hidden':'';if(chrome)chrome.style.visibility=on?'hidden':'';}
function foot(keys){return `<div class="foot">${keys.map(([b,t])=>`<span><i class="btn ${b.toLowerCase()}">${b}</i>${t}</span>`).join('')}<span style="margin-left:auto;color:#6c7480;font-size:12px">Unofficial fan project</span></div>`;}
function head(k,h,sub){return `<div class="k">${esc(k)}</div><h1>${esc(h)}</h1>${sub?`<div class="sub">${sub}</div>`:''}`;}
const PAD_SVG='<svg viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M30 14h60c14 0 22 10 25 26l3 18c2 12-9 20-18 12l-12-12H32L20 70c-9 8-20 0-18-12l3-18C8 24 16 14 30 14z"/><path d="M30 32v16M22 40h16"/><circle cx="84" cy="34" r="4"/><circle cx="94" cy="44" r="4"/></svg>';

/* Pairing ------------------------------------------------------------------ */
function open(){if(typeof live!=='undefined'&&live)return;CO.screen='pair';CO.players=[null,null];CO.cfg=CO.cfg||{event:EVENTS[1]?.id??0,weather:'Dry',laps:5,time:'14:00',difficulty:'Intermediate',cars:[null,null]};CO.cursor={track:Math.max(0,EVENTS.findIndex(e=>e.id===CO.cfg.event)),opt:-1,cars:[0,1],locked:[false,false]};CO.edge={};hideMenus(true);try{UI26.close?.();}catch(_){}render();startPoll();}
function close(toHub=true){CO.screen='';$id('co63')?.remove();hideMenus(false);if(toHub){try{UI26.hub();}catch(_){}}}
CO.open=open;
function renderPair(){const pl=CO.players,el=overlay();
 el.innerHTML=head('Co-Op · Split screen','Pair controllers','Each player presses <i class="btn a">A</i> on their own controller. Keyboard: press Enter.')+
 `<div class="body"><div class="slots">${[0,1].map(i=>{const p=pl[i];return `<div class="slot ${p?'on':''}" style="--c:${COLORS[i]}"><div class="tag">P${i+1}</div>${PAD_SVG}${p?`<strong>${esc(p.name)}</strong><small>${p.dev==='kb'?'Keyboard · WASD / arrows':'Paired · controller slot '+(p.dev+1)+' · press B to unpair'}</small><div class="chk" data-p="${i}"><span>Steer</span><i class="st"><b></b></i><span>Throttle</span><i class="th"><b></b></i></div>`:`<strong class="pulse">Press A</strong><small>${i?'on a second controller':'on any controller'}</small>`}</div>`;}).join('')}</div>
 <div class="sub" style="margin:2.4vh 0 0;text-align:center">${pl[0]&&pl[1]?'Both players paired. Check the bars, then press A to continue.':padList().length<2?`${padList().length} controller${padList().length===1?'':'s'} connected. Connect two controllers (or use the keyboard for one player).`:'Two controllers detected.'}${CO.twinNote?'<br><b style="color:#f2c200">That looks like the same controller showing up twice. Player 2: press A on the other controller.</b>':''}${pl[0]&&pl[1]?'':'<br>Test it: each player\'s steering and throttle bar should move only with their own controller.'}</div></div>`+
 foot([['A',pl[0]&&pl[1]?'Continue':'Pair'],['B','Unpair / back']]);
 }
function mirrors(a,b){if(!a||!b||a.id!==b.id)return false;for(let i=0;i<Math.min(a.buttons.length,b.buttons.length);i++)if(!!a.buttons[i]?.pressed!==!!b.buttons[i]?.pressed)return false;for(let i=0;i<Math.min(a.axes.length,b.axes.length);i++)if(Math.abs((a.axes[i]||0)-(b.axes[i]||0))>.02)return false;return true;}
function pairPress(dev,button){const pl=CO.players,slot=pl.findIndex(p=>p&&p.dev===dev);
 if(button==='a'){if(slot>=0){if(pl[0]&&pl[1]){CO.twinNote=false;CO.screen='track';render();}return;}const free=pl.findIndex(p=>!p);if(free<0)return;const pad=dev==='kb'?null:padByIndex(dev);if(pad&&pl.some(p=>p&&p.dev!=='kb'&&mirrors(padByIndex(p.dev),pad))){CO.twinNote=true;render();return;}pl[free]={dev,name:dev==='kb'?'Keyboard':padName(pad)+' '+(dev+1)};try{pad?.vibrationActuator?.playEffect?.('dual-rumble',{duration:160,strongMagnitude:.5,weakMagnitude:.5})?.catch?.(()=>{});}catch(_){}render();}
 else if(button==='b'){if(slot>=0){pl[slot]=null;if(slot===0&&pl[1]){pl[0]=pl[1];pl[1]=null;}render();}else if(!pl[0]&&!pl[1])close();}}

/* Circuit + race options ---------------------------------------------------- */
function optRows(){const c=CO.cfg;return [
 ['Weather',WEATHER.find(w=>w[0]===c.weather)?.[1]||c.weather,d=>{const i=WEATHER.findIndex(w=>w[0]===c.weather);c.weather=WEATHER[(i+d+WEATHER.length)%WEATHER.length][0];}],
 ['Race laps',c.laps+' laps',d=>{const i=LAPS.indexOf(c.laps);c.laps=LAPS[clamp((i<0?1:i)+d,0,LAPS.length-1)];}],
 ['Time of day',TIMES.find(t=>t[0]===c.time)?.[1]||c.time,d=>{const i=TIMES.findIndex(t=>t[0]===c.time);c.time=TIMES[(i+d+TIMES.length)%TIMES.length][0];}],
 ['AI difficulty',c.difficulty,d=>{const i=LEVELS.indexOf(c.difficulty);c.difficulty=LEVELS[clamp(i+d,0,2)];}]];}
function renderTrack(){const el=overlay(),art=trackArt(),cur=CO.cursor;
 el.innerHTML=head('Co-Op · Split screen','Pick the circuit','Top Ten Shootout first, then straight to the grid.')+
 `<div class="body"><div class="tracks">${events().map((e,i)=>`<div class="t ${cur.opt<0&&cur.track===i?'sel':''}">${art[String(e.id)]?`<svg viewBox="0 0 120 100"><path d="${art[String(e.id)]}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`:'<svg viewBox="0 0 120 100"></svg>'}<b>${esc(e.name)}</b><small>${e.km.toFixed(2)} km</small></div>`).join('')}</div>
 <div class="opts">${optRows().map((o,i)=>`<div class="o ${cur.opt===i?'sel':''}"><small>${o[0]}</small><span><i>‹</i><b>${esc(o[1])}</b><i>›</i></span></div>`).join('')}</div></div>`+
 foot([['A','Choose circuit'],['B','Back'],['X','Weather'],['Y','Laps']]);
 el.querySelector('.t.sel')?.scrollIntoView?.({block:'nearest'});}
function trackMove(dir){const cur=CO.cursor,n=EVENTS.length,cols=5;
 if(cur.opt>=0){if(dir==='left'||dir==='right'){optRows()[cur.opt][2](dir==='right'?1:-1);}else if(dir==='up'){cur.opt=-1;}else if(dir==='down'){}render();return;}
 let i=cur.track;if(dir==='left')i=(i-1+n)%n;else if(dir==='right')i=(i+1)%n;else if(dir==='up')i=i-cols>=0?i-cols:i;else if(dir==='down'){if(i+cols<n)i+=cols;else{cur.opt=Math.min(3,Math.floor((i%cols)*4/cols));render();return;}}
 cur.track=i;render();}
function trackPress(dev,button){const cur=CO.cursor;
 if(button==='a'){if(cur.opt>=0){optRows()[cur.opt][2](1);render();return;}CO.cfg.event=EVENTS[cur.track].id;CO.screen='cars';CO.cursor.locked=[false,false];render();}
 else if(button==='b'){if(cur.opt>=0){cur.opt=-1;render();return;}CO.screen='pair';render();}
 else if(button==='x'){optRows()[0][2](1);render();}
 else if(button==='y'){optRows()[1][2](1);render();}}

/* Car pick (both players at once) ------------------------------------------- */
function renderCars(){const el=overlay(),list=cars(),art=asset().cars||{},cur=CO.cursor,cols=6;
 el.innerHTML=head('Co-Op · '+(EVENTS.find(e=>e.id===CO.cfg.event)?.circuit||''),'Pick your cars','Both players choose at the same time. <i class="btn a">A</i> locks in, <i class="btn b">B</i> changes your mind.')+
 `<div class="body"><div class="cars">${list.map((c,i)=>{const on=[0,1].filter(p=>cur.cars[p]===i),locked=[0,1].filter(p=>cur.locked[p]&&cur.cars[p]===i);return `<div class="c ${on.map(p=>'p'+p).join(' ')} ${locked.map(p=>'lk'+p).join(' ')}" data-i="${i}"><span class="who">${on.map(p=>`<i style="background:${COLORS[p]}">P${p+1}${cur.locked[p]?' ✓':''}</i>`).join('')}</span>${art[String(c.number)]?`<img src="${esc(art[String(c.number)])}" alt="">`:'<div style="height:8.6vh"></div>'}<b>#${esc(c.number)}</b><small>${esc(c.teamName)}<br>${esc(c.model)}</small></div>`;}).join('')}</div>
 <div class="ready">${[0,1].map(p=>{const c=list[cur.cars[p]];return `<div style="--c:${COLORS[p]}"><span><b style="color:${COLORS[p]}">P${p+1}</b> &nbsp;#${esc(c?.number)} ${esc(c?.driver||'')} · ${esc(c?.teamName||'')}</span><b>${cur.locked[p]?'READY':'CHOOSING'}</b></div>`;}).join('')}</div></div>`+
 foot([['A','Lock in'],['B','Change / back']]);
 if(cur.locked[0]&&cur.locked[1]){clearTimeout(CO.goT);CO.goT=setTimeout(()=>{if(CO.screen==='cars'&&cur.locked[0]&&cur.locked[1])begin();},700);}}
function carMove(p,dir){const cur=CO.cursor;if(cur.locked[p])return;const n=cars().length,cols=6;let i=cur.cars[p];
 if(dir==='left')i=(i-1+n)%n;else if(dir==='right')i=(i+1)%n;else if(dir==='up')i=i-cols>=0?i-cols:i;else if(dir==='down')i=i+cols<n?i+cols:i;cur.cars[p]=i;render();}
function carPress(p,button){const cur=CO.cursor;
 if(button==='a'){if(cur.locked[p])return;if(cur.locked[1-p]&&cur.cars[1-p]===cur.cars[p]){flash(p);return;}cur.locked[p]=true;render();}
 else if(button==='b'){if(cur.locked[p]){cur.locked[p]=false;clearTimeout(CO.goT);render();}else if(!cur.locked[1-p]){CO.screen='track';render();}}}
function flash(p){const el=document.querySelector(`#co63 .c[data-i="${CO.cursor.cars[p]}"]`);if(el){el.classList.add('taken');setTimeout(()=>el.classList.remove('taken'),300);}}

function render(){if(CO.screen==='pair')renderPair();else if(CO.screen==='track')renderTrack();else if(CO.screen==='cars')renderCars();else if(CO.screen==='shootout')renderShootout();else if(CO.screen==='results')renderResults();}

/* Input polling for the overlay screens: every pad separately, plus the keyboard. */
const DIRS=[[12,'up'],[13,'down'],[14,'left'],[15,'right']];
function startPoll(){if(CO.poll)return;CO.poll=setInterval(pollMenus,30);}
function stopPoll(){clearInterval(CO.poll);CO.poll=null;}
function devPlayer(dev){return CO.players.findIndex(p=>p&&p.dev===dev);}
function dispatch(dev,kind,value){
 if(CO.screen==='pair'){if(kind==='btn')pairPress(dev,value);return;}
 const p=devPlayer(dev);
 if(CO.screen==='track'){if(p<0)return;if(kind==='dir')trackMove(value);else trackPress(dev,value);return;}
 if(CO.screen==='cars'){if(p<0)return;if(kind==='dir')carMove(p,value);else carPress(p,value);return;}
 if(CO.screen==='shootout'){if(kind==='btn'&&value==='a')CO.shootoutGo?.();return;}
 if(CO.screen==='results'){if(kind==='btn')resultsPress(value);return;}}
function pollMenus(){if(!CO.screen){stopPoll();return;}const now=performance.now(),pads=padList();
 // One physical controller can show up twice in the browser (two gamepad slots that mirror each other).
 // A button press that lands on two slots at once is one controller: only the first slot (or the one
 // already paired) takes it, so a single controller can never pair as both players.
 const downA=pads.filter(p=>p.buttons[0]?.pressed).map(p=>p.index);
 for(const pad of pads){const st=CO.edge[pad.index]||(CO.edge[pad.index]={b:{},dir:'',rep:0});const pr=i=>!!pad.buttons[i]?.pressed;
  if(CO.screen==='pair'&&pr(0)&&!st.b[0]&&downA.length>1){const paired=downA.find(i=>devPlayer(i)>=0);if(paired!==undefined?paired!==pad.index:downA[0]!==pad.index){st.b[0]=true;st.twin=now;}}
  if(CO.screen==='pair'&&st.twin&&now-st.twin<400&&pr(0)){st.b[0]=true;}
  for(const [i,name]of [[0,'a'],[1,'b'],[2,'x'],[3,'y']]){const d=pr(i);if(d&&!st.b[i])dispatch(pad.index,'btn',name);st.b[i]=d;}
  const ax=Number(pad.axes[0])||0,ay=Number(pad.axes[1])||0;let dir='';for(const [i,n]of DIRS)if(pr(i))dir=n;if(!dir&&Math.max(Math.abs(ax),Math.abs(ay))>.6)dir=Math.abs(ax)>Math.abs(ay)?(ax>0?'right':'left'):(ay>0?'down':'up');
  if(dir&&(dir!==st.dir||now>=st.rep)){dispatch(pad.index,'dir',dir);st.rep=now+(dir===st.dir?140:380);}st.dir=dir;}
 if(CO.screen==='pair')for(const el of document.querySelectorAll('#co63 .chk')){const p=CO.players[+el.dataset.p],pad=p&&p.dev!=='kb'?padByIndex(p.dev):null;const ax=Number(pad?.axes[0])||0,th=Number(pad?.buttons[7]?.value)||0;el.querySelector('.st b').style.cssText=`left:${50+Math.min(0,ax)*50}%;width:${Math.abs(ax)*50}%`;el.querySelector('.th b').style.cssText=`left:0;width:${th*100}%`;}}
document.addEventListener('keydown',e=>{if(!CO.screen)return;const map={Enter:['btn','a'],Space:['btn','a'],Escape:['btn','b'],Backspace:['btn','b'],KeyX:['btn','x'],KeyY:['btn','y'],ArrowUp:['dir','up'],ArrowDown:['dir','down'],ArrowLeft:['dir','left'],ArrowRight:['dir','right'],KeyW:['dir','up'],KeyS:['dir','down'],KeyA:['dir','left'],KeyD:['dir','right']}[e.code];
 e.preventDefault();e.stopImmediatePropagation();if(!map||e.repeat&&map[0]==='btn')return;dispatch('kb',map[0],map[1]);},true);

/* ---------- Session setup ---------- */
function makeDriver(cfg){const list=cars(),c1=list[CO.cursor.cars[0]],c2=list[CO.cursor.cars[1]],event=EVENTS.find(e=>e.id===cfg.event);
 const prev=CO.career?.settings||{},settings={...prev,graphics:prev.graphics||'balanced',sensitivity:prev.sensitivity||1,volume:prev.volume??.35,deadzone:prev.deadzone??.12,difficulty:cfg.difficulty,camera:'onboard',raceDistance:1,rf41Stops:{default:0,circuits:{},cars:{}},gx55Blur:false};
 const world={teams:teamsInit(),me:c1.team,year:2026,week:1,records:[],personal:{},settings:{},weather:cfg.weather};
 const p1=world.teams[c1.team].drivers[c1.seat],p2=world.teams[c2.team].drivers[c2.seat];
 D={version:1,year:2026,day:1,round:EVENTS.indexOf(event),team:c1.team,pid:p1.id,world,settings,setup:{tyre:cfg.weather==='Dry'?'Soft':'Wet',aero:50,fuel:85},contract:{from:2026,until:2027,salary:0,bonus:0},personal:{cash:0,investments:0,houseValue:0,mortgage:0,living:0},mail:[],history:[],offers:[],reputation:55,seasons:0,titles:0,careerPoints:0,target:12,practiceBonus:0};
 S=world;sc25Normalize();ensurePermanentNumbers();D.day=dcSunday(event);
 D.world.teams.forEach(t=>t.drivers.forEach(d=>{d.recent=[];d.ratingHistory=[];d.pts=d.wins=d.podiums=0;d.dcBase=d.ovr;}));
 const laps=Math.max(3,cfg.laps),base=event.raceLaps?.[0]||laps;D.settings.raceDistance=laps/base;
 D.weekend={event:event.id,phase:2,race:0,grid:[p1.id,p2.id],times:{},results:[],weather:cfg.weather,forecast:['Friday','Saturday','Sunday'].map(day=>({day,weather:cfg.weather,temp:22,rain:cfg.weather==='Dry'?0:cfg.weather==='Wet'?70:100}))};
 CO.ids=[p1.id,p2.id];CO.carPick=[c1,c2];}
let savedCo=null;
function begin(){
 const cfg={...CO.cfg};CO.cfg.cars=[CO.cursor.cars[0],CO.cursor.cars[1]];
 if(!CO.active){
  // Keep the career and any saved instant weekend exactly as they are.
  try{if(D)irCareerWrite();}catch(_){}
  CO.career=D;CO.careerWorld=S;CO.careerTab=typeof dcTab!=='undefined'?dcTab:'Home';CO.careerCamera=sc25Camera;CO.careerQuality=sc25Quality;
  CO.ir={active:IR.active,screen:IR.screen,config:IR.config,complete:IR.complete,career:IR.career,careerWorld:IR.careerWorld};
  // No co-drivers in Co-Op, even at Bathurst.
  if(window.PT61_CODRIVERS&&!savedCo){savedCo={...window.PT61_CODRIVERS};for(const k of Object.keys(window.PT61_CODRIVERS))delete window.PT61_CODRIVERS[k];}
 }
 CO.active=true;
 IR.active=true;IR.complete=false;IR.screen='weekend';IR.config={car:'0:0',event:cfg.event,weather:cfg.weather,time:cfg.time,distance:1,difficulty:cfg.difficulty,stops:0};
 makeDriver(cfg);dcOverlay='';dcBindWorld();
 launch('shootout');}
CO.begin=begin;
function exitCoop(){
 CO.race=false;CO.active=false;CO.screen='';stopPoll();teardownSplit();
 if(typeof live!=='undefined'&&live){CO.ending=true;try{dcEndSession(false);}finally{CO.ending=false;}}
 if(savedCo&&window.PT61_CODRIVERS){Object.assign(window.PT61_CODRIVERS,savedCo);savedCo=null;}
 const ir=CO.ir||{};IR.active=!!ir.active;IR.screen=ir.screen||'';IR.config=ir.config||IR.config;IR.complete=!!ir.complete;IR.career=ir.career;IR.careerWorld=ir.careerWorld;
 D=CO.career;S=CO.careerWorld;try{dcTab=CO.careerTab||'Home';}catch(_){}sc25Camera=CO.careerCamera||'onboard';sc25Quality=CO.careerQuality||'balanced';
 CO.career=null;dcOverlay='';if(D)dcBindWorld();$id('co63')?.remove();hideMenus(false);CO.mask=null;
 try{dcRender();}catch(_){}try{UI26.hub();}catch(_){}}
CO.exit=exitCoop;

function launch(stage){
 const w=D.weekend;CO.stage=stage;CO.screen='';stopPoll();$id('co63')?.remove();hideMenus(false);
 if(stage==='shootout'){w.phase=2;w.grid=[...CO.ids];}else{w.phase=3;}
 CO.mask=CO.maskFor(0);
 dcLaunch(false);
 const L=live;if(!L?.dc){exitCoop();return;}
 setupSession(L);}
CO.maskFor=i=>{const p=CO.players[i];return p&&p.dev!=='kb'?p.dev:-1;};

/* ---------- Per-player context ---------- */
const CTX={L:['lights','wipers','padLast','gr27PadIdentity','gr27Neutral','pad','pitPlan']};
function newState(L,x){return {x,cam:'onboard',L:{lights:L.lights||0,wipers:L.wipers||0,padLast:{},gr27PadIdentity:null,gr27Neutral:true,pad:false,pitPlan:{...(L.pitPlan||{})}},camPos:null,camUp:null,cut:true,input:{steer:0,throttle:0,brake:0}};}
let depth=0;
function withCtx(i,fn){
 const L=live,W=sc25Engine;if(!L||!CO.race||i===CO.primary||depth)return fn();
 const me=CO.pl[i],save={player:L.player,cam:sc25Camera,sel:sc25Selected,pid:D.pid,mask:CO.mask,cut:W?.cameraCut,ml:W?.mouseLook,L:{}};
 for(const k of CTX.L){save.L[k]=L[k];L[k]=me.L[k];}
 L.player=me.x;sc25Camera=me.cam;sc25Selected=me.x.d.id;D.pid=me.x.d.id;CO.mask=CO.paused?CO.mask:CO.maskFor(i);if(W){W.cameraCut=false;W.mouseLook=null;}
 depth++;CO.ctx=i;
 try{return fn();}finally{depth--;CO.ctx=null;
  for(const k of CTX.L){me.L[k]=L[k];L[k]=save.L[k];}me.cam=sc25Camera;
  if(W){if(W.cameraCut)me.cut=true;W.cameraCut=save.cut;W.mouseLook=save.ml;}
  if(live===L){L.player=save.player;}sc25Camera=save.cam;sc25Selected=save.sel;D.pid=save.pid;CO.mask=save.mask;}}
function setupSession(L){
 const W=sc25Engine,p1=L.entrants.find(x=>x.d.id===CO.ids[0]),p2=L.entrants.find(x=>x.d.id===CO.ids[1]);
 L.coop=true;L.player=p1;CO.primary=0;
 CO.pl=[newState(L,p1),newState(L,p2)];CO.pl[0].cam=sc25Camera;CO.pl[1].cam=sc25Camera;
 // P2 looks like an on-solver AI car to the collision code outside its own context.
 const fake={assist:null,rear:1,target:0,lastT:0,lane:0,near:null};
 if(!CO.debugAI)Object.defineProperty(p2,'ai62',{configurable:true,get(){return CO.race&&live?.player!==p2?(fake.assist||=window.ph47Assist?.()||{align:1},fake):null;},set(_){}});
 CO.race=true;
 if(L.stage==='shootout'){
  // Both players leave from their garages together; P2's car gets the same garage start as P1.
  for(const x of [p1,p2]){x.releaseDelay=x===p1?0:1.2;}
  withCtx(1,()=>{p2.pitStage='manual';p2.dc33PitCommitted=true;});
  L.release=3;
 }else{
  // Straight to the grid: no formation lap.
  for(const x of L.entrants){x.outlapHold=true;x.releaseDelay=0;}
  dcSetGrid();L.release=0;
  for(const x of L.entrants)x.dc33PitCommitted=false;
 }
 try{window.UI58?.endIntro?.();}catch(_){}
 setupSplit(L);
 dcRadio('Race control',L.stage==='shootout'?'Co-Op Top Ten Shootout. One flying lap each.':'Co-Op race. Grid formed — five red lights.');}

// P2's car is built as a player car (cockpit interior, live mirrors, steering wheel).
const baseCar=sc25Car;
sc25Car=function(E,team,driver){if(!CO.active||!CO.ids||driver?.id!==CO.ids[1]||!D)return baseCar.apply(this,arguments);const pid=D.pid;D.pid=driver.id;try{return baseCar.apply(this,arguments);}finally{D.pid=pid;}};

/* ---------- Physics hooks ---------- */
function p2Input(){const me=CO.pl[1];return withCtx(1,()=>{const i=dcInput();me.input=i;return i;});}
const basePhysics=dcPhysics;
dcPhysics=function(dt,input,auto=false){
 const L=live;if(!CO.race||!L?.coop)return basePhysics.apply(this,arguments);
 const [a,b]=CO.pl,done=x=>x.finished||x.retired;
 const want=done(a.x)&&!done(b.x)?1:0;
 if(want!==CO.primary)swapPrimary(want);
 if(CO.primary===0){CO.in2=p2Input();b.x.ic59Stuck=-1e9;/* not an AI car to the stuck-car recovery */return basePhysics(dt,input,auto);}
 // P1 is finished: P2 is the game's player for the rest of the session.
 return basePhysics(dt,CO.in2=input,auto);};
// Keyboard keys only drive the player who paired the keyboard.
const baseInput=dcInput;
dcInput=function(){if(!CO.race||!live?.coop)return baseInput.apply(this,arguments);const who=CO.ctx??CO.primary;if(CO.players[who]?.dev==='kb')return baseInput.apply(this,arguments);const k=dcKeys,tmp={};dcKeys=tmp;try{return baseInput.apply(this,arguments);}finally{if(dcKeys===tmp)dcKeys=k;}};
function swapPrimary(to){const L=live,from=CO.primary,me=CO.pl[to],old=CO.pl[from];
 for(const k of CTX.L){old.L[k]=L[k];L[k]=me.L[k];}old.cam=sc25Camera;sc25Camera=me.cam;L.player=me.x;sc25Selected=me.x.d.id;D.pid=me.x.d.id;CO.primary=to;CO.mask=CO.maskFor(to);
 if(to===1){Object.defineProperty(me.x,'ai62',{configurable:true,writable:true,value:null});}}
const baseAI=dcAIStep;
dcAIStep=function(x,dt){if(CO.race&&!CO.debugAI&&live?.coop&&CO.primary===0&&x===CO.pl[1].x)return withCtx(1,()=>dcManualStep(x,dt,CO.in2||{steer:0,throttle:0,brake:0}));return baseAI.apply(this,arguments);};
const basePit=dcPitStep;
dcPitStep=function(x,dt,input){if(CO.race&&!CO.debugAI&&live?.coop&&CO.primary===0&&x===CO.pl[1].x)return withCtx(1,()=>basePit(x,dt,CO.in2||{steer:0,throttle:0,brake:0}));return basePit.apply(this,arguments);};
// The pit limiter button (RB) for P2.
let rb2=false;setInterval(()=>{if(!CO.race||!live?.coop||live.paused||CO.primary!==0)return;const p=CO.players[1];if(!p||p.dev==='kb'){rb2=false;return;}const pad=padByIndex(p.dev),d=!!pad?.buttons[5]?.pressed;if(d&&!rb2)withCtx(1,()=>window.PT61?.toggleLimiter?.());rb2=d;},32);
// Pause: either Start button; the player who paused drives the pause menu.
const basePause=dcPause;
dcPause=function(){const r=basePause.apply(this,arguments);if(CO.race&&live?.coop){CO.paused=!!live.paused;if(live.paused){CO.pauser=CO.ctx??CO.primary;CO.mask=CO.maskFor(CO.pauser);}else CO.mask=CO.maskFor(CO.primary);}return r;};
const basePauseRender=dcPauseRender;
dcPauseRender=function(){const L=live;if(!CO.race||!L?.coop)return basePauseRender.apply(this,arguments);const host=$id('dc-pause-host');if(!host)return;if(!L.paused){host.innerHTML='';return;}
 host.innerHTML=`<div id="co63-pause"><div class="dc-pause-box"><div class="dc-eyebrow">CO-OP · ${L.stage==='race'?'RACE':'SHOOTOUT'} PAUSED</div><h2>${esc(L.e.circuit)}</h2><button class="dc-btn primary" onclick="dcPause()">Resume</button><button class="dc-btn" onclick="CO63.restart()">Restart ${L.stage==='race'?'race':'shootout'}</button><button class="dc-btn" onclick="CO63.rechoose()">Change cars or circuit</button><button class="dc-btn" onclick="CO63.exit()">Quit to main menu</button></div></div>`;
 requestAnimationFrame(()=>host.querySelector('.dc-btn.primary')?.focus({preventScroll:true}));};
CO.restart=()=>{const stage=live?.stage==='race'?'race':'shootout';CO.race=false;teardownSplit();CO.ending=true;try{dcEndSession(false);}finally{CO.ending=false;}if(stage==='race'){D.weekend.grid=CO.grid||D.weekend.grid;}else{makeDriver(CO.cfg);dcBindWorld();}launch(stage);};
CO.rechoose=()=>{CO.race=false;teardownSplit();CO.ending=true;try{dcEndSession(false);}finally{CO.ending=false;}CO.screen='cars';CO.cursor.locked=[false,false];hideMenus(true);render();startPoll();};
const baseLeave=dcLeaveSession;
dcLeaveSession=function(){if(CO.active)return exitCoop();return baseLeave.apply(this,arguments);};
// Nothing in a Co-Op session is saved over the career or the instant weekend.
const baseIrSave=irSave;irSave=function(){if(CO.active)return;return baseIrSave.apply(this,arguments);};
const baseSnap=dcSnapshot;dcSnapshot=function(){if(CO.active)return;return baseSnap.apply(this,arguments);};
const baseEnd=dcEndSession;dcEndSession=function(){if(CO.race&&!CO.ending){CO.race=false;teardownSplit();}return baseEnd.apply(this,arguments);};

/* ---------- Shootout → grid ---------- */
const baseFinish=dcFinishTimed;
dcFinishTimed=function(simulated){const L=live;if(!CO.active||!L?.coop||L.stage!=='shootout')return baseFinish.apply(this,arguments);
 const [a,b]=CO.pl.map(s=>s.x);if(!((a.finished||a.retired)&&(b.finished||b.retired)))return;
 // The other eight shootout runners come from a simulated qualifying; their shootout laps are simulated too.
 const quali=dcSimTimes('qualifying').filter(r=>!CO.ids.includes(r.id)),shoot=dcSimTimes('shootout'),top=quali.slice(0,8);
 const rows=top.map(r=>({id:r.id,d:r.d,team:r.team,time:shoot.find(s=>s.id===r.id)?.time??r.time}));
 for(const x of [a,b])rows.push({id:x.d.id,d:x.d,team:x.team,time:Number.isFinite(x.best)?x.best:Infinity,me:CO.ids.indexOf(x.d.id)});
 rows.sort((p,q)=>p.time-q.time);
 CO.shoot=rows;CO.grid=[...rows.map(r=>r.id),...quali.slice(8).map(r=>r.id)];D.weekend.grid=[...CO.grid];
 CO.race=false;teardownSplit();CO.ending=true;try{dcEndSession(false);}finally{CO.ending=false;}
 CO.screen='shootout';hideMenus(true);render();startPoll();
 clearTimeout(CO.shootT);CO.shootT=setTimeout(()=>CO.shootoutGo?.(),12000);};
CO.shootoutGo=()=>{if(CO.screen!=='shootout')return;clearTimeout(CO.shootT);launch('race');};
function lap(t){return Number.isFinite(t)?dcLapTime(t):'NO TIME';}
function renderShootout(){const el=overlay(),rows=CO.shoot||[];
 el.innerHTML=head('Co-Op · '+(EVENTS.find(e=>e.id===CO.cfg.event)?.circuit||''),'Shootout result','Grid set. Positions 11–24 come from qualifying.')+
 `<div class="body"><div class="res"><div class="table">${rows.map((r,i)=>`<div class="row ${r.me!==undefined?'me':''}" style="--c:${COLORS[r.me]||'#333'}"><b>${i+1}</b><b>#${esc(r.d.number)}</b><span>${esc(r.d.name)}${r.me!==undefined?` <b style="color:${COLORS[r.me]}">P${r.me+1}</b>`:''}</span><b style="text-align:right">${lap(r.time)}</b></div>`).join('')}</div>
 <div class="big">${[0,1].map(p=>{const i=rows.findIndex(r=>r.me===p);return `<div class="pl" style="--c:${COLORS[p]}"><small>PLAYER ${p+1} · GRID</small><b>P${i+1}</b><span>#${esc(rows[i]?.d.number)} ${esc(rows[i]?.d.name)} · ${lap(rows[i]?.time)}</span></div>`;}).join('')}</div></div></div>`+
 foot([['A','Go to the grid']]);}

/* ---------- Race result ---------- */
const baseCommit=dcCommitRace;
dcCommitRace=function(L){if(!CO.active||!L?.coop)return baseCommit.apply(this,arguments);if(L.committed)return;L.committed=true;try{rf41Penalties(L);}catch(_){}
 const order=[...L.entrants].sort((a,b)=>rf41Classify(a,b,L));
 CO.result=order.map((x,i)=>({pos:i+1,d:x.d,team:x.team,retired:x.retired,me:CO.ids.indexOf(x.d.id),time:x.finishTime,gap:i&&!x.retired&&Number.isFinite(x.finishTime)&&Number.isFinite(order[0].finishTime)?x.finishTime-order[0].finishTime:null,best:x.best}));
 CO.race=false;teardownSplit();CO.ending=true;try{dcEndSession(false);}finally{CO.ending=false;}
 CO.screen='results';hideMenus(true);render();startPoll();};
function renderResults(){const el=overlay(),rows=CO.result||[],me=[0,1].map(p=>rows.find(r=>r.me===p)),win=me[0]&&me[1]?(me[0].retired&&me[1].retired?-1:me[1].retired||(!me[0].retired&&me[0].pos<me[1].pos)?0:1):-1;
 el.innerHTML=head('Co-Op · '+(EVENTS.find(e=>e.id===CO.cfg.event)?.circuit||''),'Race result',win>=0?`<span class="winner" style="color:${COLORS[win]}">Player ${win+1} takes the bragging rights</span>`:'')+
 `<div class="body"><div class="res"><div class="table">${rows.slice(0,12).map(r=>`<div class="row ${r.me>=0?'me':''}" style="--c:${COLORS[r.me]||'#333'}"><b>${r.retired?'DNF':r.pos}</b><b>#${esc(r.d.number)}</b><span>${esc(r.d.name)}${r.me>=0?` <b style="color:${COLORS[r.me]}">P${r.me+1}</b>`:''}</span><b style="text-align:right">${r.retired?'OUT':r.pos===1?'WINNER':r.gap!=null?'+'+r.gap.toFixed(3):''}</b></div>`).join('')}</div>
 <div class="big">${[0,1].map(p=>{const r=me[p];return `<div class="pl" style="--c:${COLORS[p]}"><small>PLAYER ${p+1} · FINISHED</small><b>${r?.retired?'DNF':'P'+r?.pos}</b><span>#${esc(r?.d.number)} ${esc(r?.d.name)} · ${esc(r?.team.name)}</span></div>`;}).join('')}</div></div></div>`+
 foot([['A','Rematch'],['X','Change cars or circuit'],['B','Main menu']]);}
function resultsPress(b){if(b==='a'){makeDriver(CO.cfg);dcBindWorld();launch('shootout');}else if(b==='x'){CO.screen='cars';CO.cursor.locked=[false,false];render();}else if(b==='b')exitCoop();}

/* ---------- Split-screen rendering ---------- */
function setupSplit(L){const host=document.querySelector('.dc-driving');if(!host)return;document.body.classList.add('co63-race');
 const wrap=document.createElement('div');wrap.id='co63-split';const c=document.createElement('canvas');wrap.appendChild(c);host.appendChild(wrap);
 const line=document.createElement('div');line.id='co63-line';host.appendChild(line);
 CO.view=c;CO.ctx2d=c.getContext('2d',{alpha:false,desynchronized:true});
 for(const i of [0,1]){const h=document.createElement('div');h.className='co63-hud h'+i;h.style.setProperty('--c',COLORS[i]);h.innerHTML=`<div class="tag"><i>P${i+1}</i><span><b class="nm"></b><small class="tm"></small></span></div><div class="pos"><span><small>POS</small> <b class="ps">–</b></span><span><small class="lpl">LAP</small> <em class="lp">–</em></span></div><div class="gap"></div><div class="lights"></div><div class="msg"></div><div class="rpm">${'<i></i>'.repeat(12)}</div><div class="dash"><div><div class="sp">0</div><small>KM/H</small></div><div class="g">N</div></div><canvas class="mm" width="200" height="140"></canvas>`;host.appendChild(h);CO.pl[i].hud={root:h,nm:h.querySelector('.nm'),tm:h.querySelector('.tm'),ps:h.querySelector('.ps'),lp:h.querySelector('.lp'),lpl:h.querySelector('.lpl'),gap:h.querySelector('.gap'),lights:h.querySelector('.lights'),msg:h.querySelector('.msg'),sp:h.querySelector('.sp'),g:h.querySelector('.g'),rpm:[...h.querySelectorAll('.rpm i')],mm:h.querySelector('.mm').getContext('2d'),last:{}};}
 sc25Engine?.resize?.();}
function teardownSplit(){document.body.classList.remove('co63-race');$id('co63-split')?.remove();$id('co63-line')?.remove();document.querySelectorAll('.co63-hud').forEach(e=>e.remove());CO.view=null;CO.ctx2d=null;}
// gr27Camera smooths the chase camera with dt; P2's pass runs with dt 0 (so nothing else steps twice) and uses the real frame dt here.
const baseCam=gr27Camera;
gr27Camera=function(W,L,dt){return baseCam.call(this,W,L,CO.camDt!=null?CO.camDt:dt);};
function camSave(s,W){(s.camPos||=new THREE.Vector3()).copy(W.camera.position);}
function camLoad(s,W){if(s.camPos)W.camera.position.copy(s.camPos);if(s.cut){W.cameraCut=true;s.cut=false;}}
const baseRender=dcRenderWorld;
dcRenderWorld=function(W,L,dt){
 if(!CO.race||!L?.coop||!CO.view)return baseRender.apply(this,arguments);
 if(W.cameraCut){CO.pl[0].cut=CO.pl[1].cut=true;W.cameraCut=false;}
 const other=1-CO.primary,ps=CO.pl[CO.primary],os=CO.pl[other];
 // Second view first (dt 0: lamps, crews, debris and rain only advance once per frame).
 const canvas=W.renderer.domElement;
 withCtx(other,()=>{camLoad(os,W);CO.camDt=dt;try{baseRender(W,L,0);}finally{CO.camDt=null;}camSave(os,W);});
 const view=CO.view,cw=canvas.width,ch=canvas.height;if(view.width!==cw||view.height!==ch){view.width=cw;view.height=ch;}
 // P2 always shows on the bottom half; when P2 is the primary (P1 finished), the bottom half gets the primary view instead.
 if(other===1)CO.ctx2d.drawImage(canvas,0,0);
 camLoad(ps,W);const r=baseRender(W,L,dt);camSave(ps,W);
 if(other===0){CO.ctx2d.drawImage(canvas,0,0);withCtx(0,()=>{camLoad(os,W);baseRender(W,L,0);camSave(os,W);});}
 paintHud(L,W);return r;};

/* ---------- HUD ---------- */
function setText(h,k,v){if(h.last[k]!==v){h.last[k]=v;h[k].textContent=v;}}
function setHtml(h,k,v){if(h.last[k]!==v){h.last[k]=v;h[k].innerHTML=v;}}
function raceOrder(L){return [...L.entrants].sort((a,b)=>Number(a.retired)-Number(b.retired)||(a.finished&&b.finished?a.finishTime-b.finishTime:Number(b.finished)-Number(a.finished)||b.progress-a.progress));}
let hudAt=0,mapAt=0,mapBase=null;
// Mini maps: the circuit outline is drawn once to an offscreen canvas, then each map is a blit plus one dot per car (~20 Hz).
function mapFit(W,w,h){const b=W.bounds,sc=Math.min((w-24)/(b.maxX-b.minX),(h-24)/(b.maxZ-b.minZ)),ox=(w-(b.maxX-b.minX)*sc)/2,oy=(h-(b.maxZ-b.minZ)*sc)/2;return {X:x=>ox+(x-b.minX)*sc,Y:z=>oy+(z-b.minZ)*sc};}
function paintMaps(L,W){if(!W?.samples?.length||!W.bounds)return;const w=200,h=140;
 if(!mapBase||mapBase.src!==W.samples){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),f=mapFit(W,w,h);g.lineJoin='round';g.lineCap='round';
  const path=()=>{g.beginPath();W.samples.forEach((s,i)=>{if(i%4)return;i?g.lineTo(f.X(s.p.x),f.Y(s.p.z)):g.moveTo(f.X(s.p.x),f.Y(s.p.z));});g.closePath();};
  path();g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=7;g.stroke();path();g.strokeStyle='#c9d3dc';g.lineWidth=3.5;g.stroke();
  const s0=W.samples[0]?.p;if(s0){g.fillStyle='#fff';g.fillRect(f.X(s0.x)-3,f.Y(s0.z)-3,6,6);}
  mapBase={src:W.samples,c,f};}
 const f=mapBase.f;
 for(const i of [0,1]){const s=CO.pl[i],g=s.hud?.mm;if(!g)continue;g.clearRect(0,0,w,h);g.drawImage(mapBase.c,0,0);
  for(const x of L.entrants){if(!x.pos||x.garage||x===CO.pl[0].x||x===CO.pl[1].x)continue;g.fillStyle=x.retired?'#6a6f78':'#e8edf2';g.beginPath();g.arc(f.X(x.pos.x),f.Y(x.pos.z),2.6,0,6.283);g.fill();}
  // The other player in their colour, then this screen's player on top, larger with a white ring.
  for(const j of [1-i,i]){const x=CO.pl[j].x;if(!x?.pos)continue;const r=j===i?6:4.2;g.beginPath();g.arc(f.X(x.pos.x),f.Y(x.pos.z),r,0,6.283);g.fillStyle=COLORS[j];g.fill();if(j===i){g.lineWidth=2;g.strokeStyle='#fff';g.stroke();}}}}
function paintHud(L,W){const now=performance.now(),slow=now-hudAt>110;if(slow)hudAt=now;if(now-mapAt>48){mapAt=now;paintMaps(L,W);}const order=slow&&L.stage==='race'?raceOrder(L):null;
 for(const i of [0,1]){const s=CO.pl[i],h=s.hud,x=s.x;if(!h)continue;
  setText(h,'sp',String(Math.round(Math.abs(x.speed||x.v*3.6||0))));setText(h,'g',String(dcGear(x)));
  const rpm=x.ph47?.rpm??x.rpm,frac=Number.isFinite(rpm)?clamp((rpm-3000)/4600,0,1):clamp((Math.abs(x.v)%22)/22,0,1),lit=Math.round(frac*12);if(h.last.rpm!==lit){h.last.rpm=lit;h.rpm.forEach((e,k)=>{e.className=k<lit?('on'+(k>=9?' b':k>=6?' r':'')):'';});}
  if(!slow)continue;
  setText(h,'nm','#'+x.d.number+' '+x.d.name.trim().split(/\s+/).at(-1).toUpperCase());setText(h,'tm',x.team.name);
  let msg='';
  if(L.stage==='race'){const pos=order.indexOf(x)+1;setText(h,'ps',x.retired?'OUT':pos+'/'+order.length);setText(h,'lpl','LAP');setText(h,'lp',Math.min(L.laps,Math.max(1,Math.floor(x.progress)+1))+'/'+L.laps);
   const o=CO.pl[1-i].x,diff=(x.progress-o.progress)*L.e.realLap;setText(h,'gap',x.finished||o.finished||x.retired||o.retired||!L.started?'':(diff>=0?'Ahead of':'Behind')+' P'+(2-i)+' by '+Math.abs(diff).toFixed(1)+'s');
   if(!L.started){const n=L.gridReady?clamp(Math.ceil(5-L.countdown),0,5):0;setHtml(h,'lights',L.gridReady&&L.release<=0?'<i></i><i></i><i></i><i></i><i></i>':'');h.lights.classList.remove('go');h.lights.querySelectorAll('i').forEach((e,k)=>e.classList.toggle('on',k<n));msg=L.release>0||!L.gridReady?'Get ready':'';}
   else if(L.elapsed<1.2){setHtml(h,'lights','<i></i><i></i><i></i><i></i><i></i>');h.lights.classList.add('go');msg='Go go go!';}else setHtml(h,'lights','');
   if(x.finished)msg=pos===1?'Winner!':'Finished P'+pos;else if(x.retired)msg='Retired';else if(CO.pl[1-i].x.finished&&!x.finished)msg='';
  }else{setText(h,'lpl','SHOOTOUT');const run=x.finished?'DONE':x.releaseDelay>0||x.pitStage?'PIT LANE':x.timing?'FLYING LAP':'OUT LAP';setText(h,'lp',run);
   const t=x.finished?lap(x.best):x.timing?dcLapTime(Math.max(0,L.elapsed-x.lapStart)):'—';setText(h,'ps',t);setText(h,'gap','');setHtml(h,'lights','');
   if(x.finished)msg=CO.pl[1-i].x.finished?'':'Lap done · '+lap(x.best)+' · waiting for P'+(2-i);else if(L.release>0)msg='Shootout · one flying lap';}
  setText(h,'msg',msg);}}

/* ---------- Menu tile hook ---------- */
CO.available=()=>!(typeof live!=='undefined'&&live);
})();
