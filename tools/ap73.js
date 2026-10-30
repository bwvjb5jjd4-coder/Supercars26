/* ap73: safety car autopilot.
   While the safety car is out a small AUTOPILOT button appears on the race HUD (click it,
   press O, or click the left stick, LS). The race AI then drives your car on the same tyre
   physics the AI cars use: it forms up in the queue, follows the train and keeps going until
   you press the button again. Nothing else changes: it is your car, your damage, your fuel.
   In pit lane the car is yours (the button shows paused) and autopilot carries on once you rejoin.
   How: each step the race AI plans for your car (where it wants to be and how fast), the car
   is put back exactly as it was, and the AI62 driver turns that plan into steering, throttle and
   brake for your normal physics step. */
(()=>{'use strict';
const AP=window.AP73={};
const $=id=>document.getElementById(id);
// Autopilot can be switched on while the safety car is out; once on it stays on until turned off.
function offered(L){const p=L?.player;return !!(L?.dc&&!L.coop&&L.stage==='race'&&L.started&&p&&!p.retired&&!p.finished&&!p.cd66&&!D.settings.ph47Classic&&(L.ic59Sc||L.scTrain||L.ap73));}
function drives(L,x){return offered(L)&&L.ap73&&x===L.player&&!L.dc33Auto&&!dcSimBusy&&!x.pitStage&&!x.outlapHold&&!(x.releaseDelay>0)&&x.pos;}

AP.toggle=function(){const L=live;if(!L?.dc||L.paused)return;
 if(L.ap73){L.ap73=null;if(L.player)L.player.ap73=null;dcRadio('Race engineer','Autopilot off. You have the car.');paint();return;}
 if(!offered(L))return;L.ap73={t0:L.elapsed};L.player.ap73=null;
 dcRadio('Race engineer','Autopilot on. We will bring it round behind the safety car. Press again to take it back.');paint();};

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

const baseManual=dcManualStep;
dcManualStep=function(x,dt,input){const L=live;
 if(!input||!drives(L,x)){if(x&&x.ap73&&!L?.ap73)x.ap73=null;return baseManual(x,dt,input);}
 if(!x.ap73)x.ap73={assist:AI62.assist,rear:1,target:x.v,lastT:x.v,lane:clamp(x.lane,-7.2,7.2)};
 const st=x.ap73,p=plan(L,x,dt);if(!p)return baseManual(x,dt,input);
 st.lane=p.lane;
 // The AI driver reads its own state from x.ai62 and the planner's target from x.ai62Target;
 // both are only lent to the car for this step.
 const had=x.ai62,tgt=x.ai62Target;x.ai62=st;x.ai62Target=p.target;
 try{const a=ai62Drive(L,x,{lane:p.lane,v:p.v},dt);
  return baseManual(x,dt,{...input,steer:a.steer,throttle:a.throttle,brake:a.brake,reverse:false});}
 finally{x.ai62=had;x.ai62Target=tgt;}
};

/* ---------- Button ---------- */
const css=document.createElement('style');css.id='ap73-style';css.textContent=`
#ap73{position:absolute;right:22px;top:38%;z-index:8;pointer-events:none}
#ap73 button{pointer-events:auto;display:flex;align-items:center;gap:10px;border:0;border-left:5px solid #f2b705;border-radius:6px;background:rgba(8,10,14,.86);color:#fff;font:inherit;font-weight:900;font-size:15px;font-style:italic;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px 8px 10px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#ap73 button small{display:block;font-size:11px;font-style:normal;font-weight:600;letter-spacing:.04em;color:#c5ccd6;text-transform:none}
#ap73 button .k{font-style:normal;display:grid;place-items:center;min-width:30px;height:24px;padding:0 5px;border-radius:12px;background:#2b303c;color:#fff;font-size:11px}
#ap73 button.on{border-left-color:#2fb24c;background:rgba(14,40,22,.9)}
#ap73 button.on .dot{width:9px;height:9px;border-radius:50%;background:#2fb24c;box-shadow:0 0 8px #2fb24c;animation:ap73p 1s ease-in-out infinite}
@keyframes ap73p{50%{opacity:.35}}`;
document.head.appendChild(css);

function card(L){const on=!!L.ap73,pit=on&&L.player.pitStage;
 const sub=!on?'AI drives behind the safety car':pit?'Paused in pit lane, you drive':'AI is driving · press to take over';
 return `<button type="button" class="${on?'on':''}" onclick="AP73.toggle()">${on?'<i class="dot"></i>':''}<span>Autopilot ${on?'on':''}<small>${sub}</small></span><i class="k">LS</i><i class="k">O</i></button>`;}
function paint(){const L=live,host=document.querySelector('.dc-driving');
 if(!host||!offered(L)){$('ap73')?.remove();return;}
 let el=$('ap73');if(!el||el.parentNode!==host){el?.remove();el=document.createElement('div');el.id='ap73';host.appendChild(el);}
 const h=card(L);if(el.ap73!==h){el.ap73=h;el.innerHTML=h;}}
AP.paint=paint;

document.addEventListener('keydown',e=>{if(e.code!=='KeyO'||e.repeat||!live?.dc||live.paused||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(offered(live)){e.preventDefault();AP.toggle();}});
let padPrev=false;
setInterval(()=>{let pad=null;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);}catch(_){}
 const down=!!pad?.buttons?.[10]?.pressed;if(down&&!padPrev&&offered(live))AP.toggle();padPrev=down;
 try{paint();}catch(_){}},80);
})();
