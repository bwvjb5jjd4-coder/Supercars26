/* ap73: Simulate (autopilot) for the whole session, with driving styles.
   Press S (tap) or click the left stick (LS) to open the Simulate panel, then O (or A on the pad
   while the panel is open) to hand your car to the race AI. It drives your car on screen, on the
   same tyre physics as the AI cars, until you press O again. It is your car: your damage, tyres,
   fuel and position.
   Styles, switchable while it drives (1 / 2 / 3, D-pad left/right, or click):
     Aggressive  pushes harder in the corners, closes up on the car ahead and goes for passes.
     Neutral     the race AI's normal pace: holds the gap.
     Defensive   a few per cent off the limit, no passing moves, keeps a safe distance to the car
                 ahead, covers the car behind when it pulls out to pass, smooth on the pedals.
   Pit stops stay yours: call them on the MFD (B / P) as usual. When you have boxed, the autopilot
   takes the pit entry, puts the limiter on, stops in your box (or drives through for a
   drive-through), waits for the crew and rejoins.
   How: each step the race AI plans for your car (where it wants to be and how fast), the car is
   put back exactly as it was, the style adjusts the plan, and the AI62 driver turns it into
   steering, throttle and brake for your normal physics step. */
(()=>{'use strict';
const AP=window.AP73={};
const $=id=>document.getElementById(id);
const STY={
 aggressive:{name:'Aggressive',key:'1',use:.025,pace:1,tgain:1.1,desc:'Pushes the limit, closes the gap ahead and goes for the pass'},
 neutral:{name:'Neutral',key:'2',use:0,pace:1,tgain:1,desc:'Normal race pace, holds the gap'},
 defensive:{name:'Defensive',key:'3',use:-.06,pace:.985,tgain:.75,desc:'Safe and steady: no risky moves, covers the car behind, avoids damage'}};
const ORDER=['aggressive','neutral','defensive'];
const UI={open:false,style:'neutral'};
try{const s=localStorage.getItem('ap73Style');if(STY[s])UI.style=s;}catch(_){}
AP.state=UI;

function stageOk(L){return ['race','qualifying','shootout','practice','test'].includes(L.stage);}
function offered(L){const p=L?.player;return !!(L?.dc&&!L.coop&&stageOk(L)&&p&&!p.retired&&!p.finished&&!p.cd66&&!D.settings.ph47Classic);}
function drives(L,x){return offered(L)&&L.ap73&&x===L.player&&!L.dc33Auto&&!dcSimBusy&&(L.stage!=='race'||L.started||L.phase==='formation')&&!x.outlapHold&&!(x.releaseDelay>0)&&x.pos;}
function scOut(L){return !!(L.scTrain||L.ic59Sc);}
function racing(L){return L.stage==='race'&&L.started&&L.phase!=='formation'&&!scOut(L);}
AP.offered=()=>offered(live);

function say(t){try{dcRadio('Race engineer',t);}catch(_){}}
AP.toggle=function(){const L=live;if(!L?.dc||L.paused)return;
 if(L.ap73){L.ap73=null;if(L.player)L.player.ap73=null;say('Simulation off. You have the car.');paint();return;}
 if(!offered(L))return;L.ap73={t0:L.elapsed};L.player.ap73=null;
 say(scOut(L)?'Simulating. We will bring it round behind the safety car. Press O to take it back.':`Simulating, ${STY[UI.style].name.toLowerCase()}. Pit calls are still yours. Press O to take it back.`);paint();};
AP.style=function(s){if(!STY[s])return;const was=UI.style;UI.style=s;try{localStorage.setItem('ap73Style',s);}catch(_){}
 if(was!==s&&live?.ap73)say({aggressive:'Copy, aggressive. Go get the car ahead.',neutral:'Copy, neutral. Hold the gap.',defensive:'Copy, defensive. Bring it home clean, watch the mirrors.'}[s]);paint();};
AP.step=d=>AP.style(ORDER[(ORDER.indexOf(UI.style)+d+3)%3]);
AP.panel=function(open){UI.open=open===undefined?!UI.open:!!open;paint();};

// The race AI's plan for the player's car: run the planner on the car's real state, read the
// lane and speed it wants, then put every field back so nothing it did sticks.
function plan(L,x,dt){
 const W=sc25Engine,st=x.ap73,keep=Object.assign({},x),pos={...x.pos};let out=null;
 try{x.rf40Incident=null;x.ai62Target=undefined;x.v=Math.max(0,x.v||0);x.lane=st.lane??x.lane;
  ai62AI(x,dt);
  out={lane:ai68Clamp(W,x.progress,x.lane),v:x.v,target:x.ai62Target};}
 catch(e){out=null;}
 finally{for(const k of Object.keys(x))if(!(k in keep))delete x[k];Object.assign(x,keep);x.pos=pos;}
 return out;}

/* ---------- Gaps (on the road, for the styles and the panel) ---------- */
function running(L,x){return L.entrants.filter(y=>y!==x&&y.pos&&!y.retired&&!y.finished&&!y.pitStage&&!y.garage);}
function neighbours(L,x){let f=null,b=null;for(const y of running(L,x)){const d=y.progress-x.progress;if(d>0&&(!f||d<f.progress-x.progress))f=y;if(d<0&&(!b||d>b.progress-x.progress))b=y;}
 const len=L.e.lengthKm*1000;return{f,b,gf:f?(f.progress-x.progress)*len:Infinity,gb:b?(x.progress-b.progress)*len:Infinity,sf:f?(f.progress-x.progress)*L.e.realLap:null,sb:b?(x.progress-b.progress)*L.e.realLap:null};}
function laneClear(x,lane){try{return typeof dc32LaneClear==='function'?dc32LaneClear(x,lane):true;}catch(_){return true;}}

// Each style reshapes the planner's lane and speed in traffic. Pace in the corners is handled
// by lending the AI driver a different grip use (see the manual step).
function shape(L,x,p,st){
 if(!racing(L)||x.pitNow||x.pitStage)return p;
 const W=sc25Engine,n=neighbours(L,x),s=UI.style,f=n.f,len=L.e.lengthKm*1000;
 if(s==='aggressive'&&f&&n.gf<75){
  if(st.pass&&(L.elapsed>st.pass.until||st.pass.f!==f))st.pass=null;
  if(!st.pass&&n.gf>3){const pref=(f.lane||0)>=0?-1:1;for(const side of [pref,-pref]){const lane=ai68Clamp(W,x.progress,(f.lane||0)+side*3.3);if(Math.abs(lane-(f.lane||0))>2.6&&laneClear(x,lane)){st.pass={side,f,until:L.elapsed+4.5};break;}}}
  if(st.pass)p.lane=ai68Clamp(W,x.progress,(f.lane||0)+st.pass.side*3.3);
  const beside=Math.abs(x.lane-(f.lane||0))>2.3;
  // Alongside: no traffic limit at all. Behind: close right up into the tow.
  if(beside){p.target=undefined;p.v=99;}
  else{const v=Math.max(p.target??p.v,(f.v||0)+clamp((n.gf-7)*.35,0,6));p.target=v;p.v=v;}
 }
 if(s==='defensive'){
  if(f&&n.gf<45){if(n.gf<32&&Math.abs(p.lane-(f.lane||0))>2.5)p.lane=ai68Clamp(W,x.progress,f.lane||0);
   const cap=(f.v||0)+(n.gf-20)*.3;p.target=Math.min(p.target??p.v,cap);p.v=Math.min(p.v,cap);}
  // Cover the car behind once when it pulls out to pass, then settle back on the line.
  const b=n.b;if(st.cover&&L.elapsed>st.cover.until)st.cover=null;
  if(!st.cover&&b&&n.gb<22&&L.elapsed>(st.coverNext||0)&&(b.v||0)>(x.v||0)-1){const d=(b.lane||0)-x.lane;if(Math.abs(d)>1.4){st.cover={lane:ai68Clamp(W,x.progress,x.lane+Math.sign(d)*Math.min(2.2,Math.abs(d))),until:L.elapsed+2.4};st.coverNext=L.elapsed+7;}}
  if(st.cover)p.lane=st.cover.lane;
 }
 return p;}

/* ---------- Pit lane pilot (only once you have called the stop) ---------- */
function steerTo(x,tx,tz){const P=window.PH47||{a:1.4,b:1.42},dx=tx-x.pos.x,dz=tz-x.pos.z,lx=dx*Math.sin(x.yaw)+dz*Math.cos(x.yaw),ly=dx*Math.cos(x.yaw)-dz*Math.sin(x.yaw);
 const dmax=.58/(1+Math.abs(x.v||0)*.11);if(lx<.5)return Math.sign(ly||1);const k=2*ly/(lx*lx+ly*ly);return clamp(Math.atan((P.a+P.b)*k)/dmax,-1,1);}
function pedals(x,vt){const v=x.v||0,e=vt-v;return e>=-.2?{throttle:clamp(.12+e*.35,0,1),brake:0}:{throttle:0,brake:clamp(-e*.3,0,1)};}
function pitPilot(L,x,st,dt){
 const W=sc25Engine;if(!W?.pit?.dc32||!W.pit.samples)return null;const pit=W.pit,len=L.e.lengthKm*1000,v=x.v||0,look=clamp(4+v*.55,5,14);
 if(!x.pitStage){
  if(!x.pitNow){st.appr=false;return null;}
  // The lane starts a little past the pit entry marker: drive the track on the pit side, slowing
  // to the limit, until the start of the lane is close, then follow the lane itself.
  const frac=((x.progress%1)+1)%1,toEntry=((pit.start-frac)%1+1)%1*len,q=dc32PitNear(W,x.pos);
  if(!st.appr){if(toEntry<260)st.appr=true;else return null;}
  if(q.distance>420){st.appr=false;return null;}
  if(q.f<.002&&q.distance>look+10)return{track:true,lane:pit.side*3,vcap:Math.sqrt(16.2**2+2*6.5*Math.max(0,q.distance-14))};
  st.box=true;const a=dc32PitAt(W,clamp(q.f+look/pit.length,0,1));
  return{steer:steerTo(x,a.p.x,a.p.z),...pedals(x,16.2)};}
 // In the lane: limiter on, box (or drive through), then out.
 const q=dc32PitNear(W,x.pos);if(L.pt61)L.pt61.lim=q.f<.86;
 const box=pit.bays[x.team.id],half=box?.halfLength||6,dt74=x.pl74Pen?.[0]?.kind==='DT';
 if(x.dc32Serviced||dt74)st.box=false;
 const stop=st.box&&box&&!x.dc32Serviced,d=box?(box.f-q.f)*pit.length:-99;
 const latAt=dist=>stop&&dist<=half+2&&dist>-half?8.1:0;
 const fa=clamp(q.f+look/pit.length,0,1),aim=dc32PitAt(W,fa),lat=latAt(d-look)*pit.side;
 let vt=16.2;if(stop){vt=d>0?Math.min(16.2,Math.sqrt(2*2.4*Math.max(0,d-.4))+.3):0;}
 // Cars ahead in the lane.
 for(const y of L.entrants){if(y===x||!y.pitStage||!y.pos)continue;const g=((y.pitDistance||0)-(x.pitDistance||0));if(g>0&&g<16&&Math.abs(y.pitLane||0)<4.5&&!y.dc32Servicing&&Math.abs((y.pitLane||0)-(x.pitLane||0))<3)vt=Math.min(vt,Math.max(0,(g-8)*.8));}
 if(x.dc32Servicing||stop&&d<.6)return{steer:0,throttle:0,brake:1};
 return{steer:steerTo(x,aim.p.x+aim.n.x*lat,aim.p.z+aim.n.z*lat),...pedals(x,vt)};}

const baseManual=dcManualStep;
dcManualStep=function(x,dt,input){const L=live;
 // The pit entry and exit roads read as off track until the lane proper starts, so driving the
 // pit road gave a track limits penalty. Keep the player clear of it there.
 try{if(L?.dc&&x===L.player&&(x.pitStage||Math.abs(x.lane||0)>6.5)&&typeof dc32Mouth==='function'&&sc25Engine?.pit?.dc32&&dc32Mouth(sc25Engine,x.pos))x.cutAt=L.elapsed;}catch(_){}
 if(!input||!drives(L,x)){if(x&&x.ap73&&!L?.ap73)x.ap73=null;return baseManual(x,dt,input);}
 if(!x.ap73)x.ap73={assist:AI62.assist,rear:1,target:x.v,lastT:x.v,lane:clamp(x.lane,-7.2,7.2)};
 const st=x.ap73;
 if(x.pitNow&&!x.pitStage)st.box=true;
 const pp=pitPilot(L,x,st,dt);if(pp&&!pp.track){st.lastT=x.v;st.lane=clamp(x.lane,-7.2,7.2);return baseManual(x,dt,{...input,...pp,reverse:false});}
 if(x.pitStage){return baseManual(x,dt,input);}
 const p0=plan(L,x,dt);if(!p0)return baseManual(x,dt,input);
 st.lane=p0.lane;const p=shape(L,x,{...p0},st);
 if(pp?.track){p.lane=ai68Clamp(sc25Engine,x.progress,pp.lane);p.target=Math.min(p.target??p.v,pp.vcap);p.v=Math.min(p.v,pp.vcap);}
 // The AI driver reads its own state from x.ai62 and the planner's target from x.ai62Target;
 // both are only lent to the car for this step, along with the style's grip use.
 const had=x.ai62,tgt=x.ai62Target,sty=racing(L)||L.stage!=='race'?STY[UI.style]:STY.neutral,keep={use:AI62.use,pace:AI62.pace,tgain:AI62.tgain};
 x.ai62=st;x.ai62Target=p.target;AI62.use+=sty.use;AI62.pace*=sty.pace;AI62.tgain*=sty.tgain;
 try{const a=ai62Drive(L,x,{lane:p.lane,v:p.v},dt);
  return baseManual(x,dt,{...input,steer:a.steer,throttle:a.throttle,brake:a.brake,reverse:false});}
 finally{x.ai62=had;x.ai62Target=tgt;Object.assign(AI62,keep);}
};

/* ---------- Gap trend for the panel ---------- */
const trend={t:0,f:[],b:[]};
function sampleGaps(L){const x=L.player;if(!x||L.elapsed-trend.t<2)return;trend.t=L.elapsed;const n=neighbours(L,x);
 const push=(a,who,g)=>{if(!who||g==null||a.who!==who){a.length=0;a.who=who;}if(g!=null)a.push(g);if(a.length>16)a.shift();};
 push(trend.f,n.f,n.sf);push(trend.b,n.b,n.sb);}
function trendTxt(a,ahead){if(a.length<4)return '';const d=a[a.length-1]-a[0];if(Math.abs(d)<.05)return '<em class="hold">holding</em>';
 const good=ahead?d<0:d>0;return `<em class="${good?'good':'bad'}">${d<0?'▼':'▲'} ${Math.abs(d).toFixed(1)}s / ${Math.round((a.length-1)*2)}s</em>`;}

/* ---------- Panel and HUD pill ---------- */
const css=document.createElement('style');css.id='ap73-style';css.textContent=`
#ap73{position:absolute;right:22px;top:30%;z-index:8;pointer-events:none;font-style:normal}
#ap73 .pill{pointer-events:auto;display:flex;align-items:center;gap:10px;border:0;border-left:5px solid #f2b705;border-radius:6px;background:rgba(8,10,14,.86);color:#fff;font:inherit;font-weight:900;font-size:14px;font-style:italic;letter-spacing:.06em;text-transform:uppercase;padding:7px 12px 7px 10px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#ap73 .pill small{display:block;font-size:11px;font-style:normal;font-weight:600;letter-spacing:.04em;color:#c5ccd6;text-transform:none}
#ap73 .k{font-style:normal;display:inline-grid;place-items:center;min-width:26px;height:22px;padding:0 5px;border-radius:11px;background:#2b303c;color:#fff;font-size:11px;font-weight:800}
#ap73 .on{border-left-color:#2fb24c;background:rgba(14,40,22,.9)}
#ap73 .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2fb24c;box-shadow:0 0 8px #2fb24c;animation:ap73p 1s ease-in-out infinite}
#ap73 .panel{pointer-events:auto;width:300px;border-radius:8px;background:rgba(8,10,14,.92);color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden;border-top:4px solid #f2b705}
#ap73 .panel.live{border-top-color:#2fb24c}
#ap73 .hd{display:flex;justify-content:space-between;align-items:center;padding:10px 12px 6px;font-weight:900;font-style:italic;letter-spacing:.08em;text-transform:uppercase;font-size:15px}
#ap73 .hd small{font-style:normal;font-weight:600;letter-spacing:.02em;text-transform:none;color:#c5ccd6;font-size:11px}
#ap73 .go{margin:4px 12px 10px;width:calc(100% - 24px);display:flex;justify-content:space-between;align-items:center;border:0;border-radius:6px;padding:9px 12px;font:inherit;font-weight:900;font-size:14px;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;background:#f2b705;color:#111}
#ap73 .go.stop{background:#2fb24c;color:#fff}
#ap73 .go .k{background:rgba(0,0,0,.25)}
#ap73 .sty{display:grid;gap:5px;padding:0 12px 10px}
#ap73 .sty button{display:grid;grid-template-columns:24px 1fr;gap:2px 8px;align-items:center;text-align:left;border:1px solid #2b303c;border-radius:6px;background:#141820;color:#fff;font:inherit;padding:6px 8px;cursor:pointer}
#ap73 .sty button b{font-size:13px;letter-spacing:.04em;text-transform:uppercase}
#ap73 .sty button span{grid-column:2;font-size:11px;color:#aab3c0;line-height:1.25}
#ap73 .sty button.sel{border-color:#f2b705;background:#2a2410}
#ap73 .sty button.sel.aggressive{border-color:#e5484d;background:#2c1214}
#ap73 .sty button.sel.defensive{border-color:#3b82f6;background:#0f1a2e}
#ap73 .sty button .k{grid-row:1/3}
#ap73 .gaps{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;padding:8px 12px;border-top:1px solid #222834;font-size:12px;color:#c5ccd6}
#ap73 .gaps b{color:#fff;font-variant-numeric:tabular-nums}
#ap73 .gaps em{font-style:normal;font-size:11px;font-weight:700}
#ap73 em.good{color:#46d36a}#ap73 em.bad{color:#ff6b6b}#ap73 em.hold{color:#c5ccd6}
#ap73 .ft{padding:7px 12px 9px;border-top:1px solid #222834;font-size:11px;color:#aab3c0;line-height:1.35}
@keyframes ap73p{50%{opacity:.35}}`;
document.head.appendChild(css);

function who(y){return y?`#${y.d?.number??''} ${y.d?.name?.split(' ').slice(-1)[0]||''}`:'';}
function status(L){const x=L.player;if(!L.ap73)return 'Off · you are driving';if(L.stage==='race'&&!L.started&&L.phase!=='formation')return 'Starts with the lights';
 if(x.pitStage)return x.dc32Servicing?'In the box · crew working':'Pit lane · limiter on';if(x.pitNow)return 'Boxing this lap';if(scOut(L))return 'Safety car · holding the queue';return `AI driving · ${STY[UI.style].name}`;}
function panelHtml(L){const on=!!L.ap73,x=L.player,n=neighbours(L,x);
 const st=ORDER.map(k=>{const s=STY[k];return `<button type="button" class="${k}${UI.style===k?' sel':''}" onclick="AP73.style('${k}')"><i class="k">${s.key}</i><b>${s.name}</b><span>${s.desc}</span></button>`;}).join('');
 const gap=(lab,y,s,a,ahead)=>y?`<span>${lab}</span><b>${who(y)} ${ahead?'+':'-'}${s.toFixed(1)}s</b>${trendTxt(a,ahead)}`:`<span>${lab}</span><b>clear</b><span></span>`;
 return `<div class="panel${on?' live':''}"><div class="hd"><span>${on?'<i class="dot"></i> ':''}Simulate</span><small>${status(L)}</small></div>
 <button type="button" class="go${on?' stop':''}" onclick="AP73.toggle()"><span>${on?'Take the car back':'Start simulating'}</span><span><i class="k">O</i> <i class="k">A</i></span></button>
 <div class="sty">${st}</div>
 <div class="gaps">${gap('Ahead',n.f,n.sf,trend.f,true)}${gap('Behind',n.b,n.sb,trend.b,false)}</div>
 <div class="ft">Pit stops are yours: call them on the MFD (B / P) and the car boxes itself. Style: 1 2 3 or D-pad. Close: S or LS.</div></div>`;}
function pillHtml(L){const on=!!L.ap73;return `<button type="button" class="pill${on?' on':''}" onclick="AP73.panel(true)">${on?'<i class="dot"></i>':''}<span>${on?'Simulating':'Simulate'}<small>${on?status(L):'Let the AI drive behind the safety car'}</small></span><i class="k">S</i><i class="k">LS</i></button>`;}
function paint(){const L=live,host=document.querySelector('.dc-driving');
 if(!host||!offered(L)){$('ap73')?.remove();if(!L?.dc)UI.open=false;return;}
 sampleGaps(L);
 const h=UI.open?panelHtml(L):L.ap73||scOut(L)?pillHtml(L):'';
 let el=$('ap73');if(!h){el?.remove();return;}
 if(!el||el.parentNode!==host){el?.remove();el=document.createElement('div');el.id='ap73';host.appendChild(el);}
 if(el.ap73!==h){el.ap73=h;el.innerHTML=h;}}
AP.paint=paint;

/* ---------- Keys and pad ---------- */
// S is also the brake on WASD, so a quick tap opens the panel and holding it just brakes.
let sDown=0;
const typing=e=>/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||'');
document.addEventListener('keydown',e=>{const L=live;if(!L?.dc||L.paused||typing(e)||!offered(L))return;
 if(e.code==='KeyS'&&!e.repeat){sDown=performance.now();return;}
 if(e.code==='KeyO'&&!e.repeat){e.preventDefault();AP.toggle();return;}
 if(UI.open&&!window.IC59?.state?.open){const k={Digit1:'aggressive',Digit2:'neutral',Digit3:'defensive',Numpad1:'aggressive',Numpad2:'neutral',Numpad3:'defensive'}[e.code];if(k){e.preventDefault();AP.style(k);}}});
document.addEventListener('keyup',e=>{if(e.code!=='KeyS'||!sDown)return;const held=performance.now()-sDown;sDown=0;const L=live;if(!L?.dc||L.paused||typing(e)||!offered(L))return;if(held<280)AP.panel();});

// While the panel is open (and the MFD is not), A and D-pad left/right belong to the panel.
const prevGet=navigator.getGamepads?.bind(navigator);const masked=new Set();
const getPad=()=>{try{return Array.from(prevGet?.()||[]).find(p=>p?.connected)||null;}catch(_){return null;}};
if(prevGet)try{navigator.getGamepads=function(){const pads=prevGet();if(!masked.size)return pads;const off={pressed:false,touched:false,value:0};return Array.from(pads,p=>{if(!p)return p;return{id:p.id,index:p.index,connected:p.connected,mapping:p.mapping,timestamp:p.timestamp,axes:p.axes,vibrationActuator:p.vibrationActuator,hapticActuators:p.hapticActuators,buttons:Array.from(p.buttons,(b,i)=>masked.has(i)?off:b)};});};}catch(_){}
let prev={};
setInterval(()=>{const L=live,pad=getPad();
 if(pad&&L?.dc&&!L.paused&&offered(L)){const b=i=>!!pad.buttons[i]?.pressed,edge=i=>b(i)&&!prev[i];
  const mine=UI.open&&!window.IC59?.state?.open;
  if(edge(10))AP.panel();
  if(mine){if(edge(0))AP.toggle();if(edge(14))AP.step(-1);if(edge(15))AP.step(1);}
  for(const i of [0,14,15]){if(mine&&b(i))masked.add(i);else if(!b(i))masked.delete(i);}
  for(const i of [0,10,14,15])prev[i]=b(i);}
 else{if(pad)for(const i of [...masked])if(!pad.buttons[i]?.pressed)masked.delete(i);prev={};}
 try{paint();}catch(_){}},60);
})();
