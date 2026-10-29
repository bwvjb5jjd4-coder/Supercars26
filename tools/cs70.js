/* cs70: driver career contracts that are always open, and session simulation straight from the weekend menu. */
(function(){
const ir=()=>typeof IR!=='undefined'&&IR.active;
const quiet=fn=>{const r=dcRender,t=dcToast;dcRender=()=>{};dcToast=()=>{};try{return fn();}finally{dcRender=r;dcToast=t;}};
const busy=()=>!!(live||D?.activeSession);

/* ---------- Weekend: Drive / Simulate any time, plus whole-weekend simulation ---------- */
// Moves the calendar forward (salary, mail, forecast as normal) until the next session is open.
function reach(){
 if(!D||live||!dcEvent())return false;
 const open=()=>{const w=D.weekend;return !!(w&&w.phase<4&&D.day>=dcPhaseDay());};
 quiet(()=>{for(let n=0;n<160&&!open();n++){const day=D.day;dcAdvance();if(D.day===day||!dcEvent())break;}});
 return open();
}
function skip(){const before=JSON.stringify([D.round,D.weekend?.phase,D.weekend?.race]);dcSkipPhase();return JSON.stringify([D.round,D.weekend?.phase,D.weekend?.race])!==before;}
function done(){dcTab=dcEvent()&&D.weekend?'Race Weekend':dcTab;dcSave();dcRender();}
const CS={
 drive(){if(busy())return;if(!reach()){dcRender();dcToast('No session to drive right now.');return;}dcRender();dcLaunch(false);},
 sim(){if(busy())return;if(!reach()){dcRender();dcToast('No session to simulate right now.');return;}const race=D.weekend.phase===3;skip();if(!race)done();},
 // to = 'race': simulate practice, qualifying and the shootout, stopping at the grid. to = 'all': the whole weekend.
 run(to){if(busy())return;const round=D.round;let raced=false;
  for(let n=0;n<16;n++){
   if(D.round!==round||!reach())break;
   const w=D.weekend;if(to==='race'&&w.phase===3)break;
   if(w.phase===3){raced=true;quiet(()=>{const r=dcShowResult;dcShowResult=()=>{};try{skip();}finally{dcShowResult=r;}});continue;}
   if(!quiet(skip))break;
  }
  if(raced&&D.lastClassification){dcTab=D.weekend?'Race Weekend':'Championship';dcSave();dcRender();dcShowResult(D.lastClassification);}
  else{done();dcToast(to==='race'?'Sessions simulated. The grid is set.':'Weekend simulated.');}
 }
};
window.CS70=CS;

const skipPrev=dcSkipPhase;
// Practice and qualifying can be simulated without driving a lap (the earlier layer blocked it).
dcSkipPhase=function(){return ir()?skipPrev():dcSkipPhaseBase();};

const weekendPrev=dcWeekendPage;
dcWeekendPage=function(){
 const html=weekendPrev();if(ir()||!D||!dcEvent())return html;
 const e=dcEvent(),w=D.weekend,phase=w?.phase||0,races=Math.min(2,e.races);let i=0;
 let out=html.replace(/(<div class="dc-session[^"]*">[\s\S]*?<div class="dc-actions">)([\s\S]*?)(<\/div><\/div>)/g,(m,a,b,c)=>{
  const k=i++,index=k<3?k:3,isDone=w&&(index<phase||k>=3&&k-3<w.race),active=w?index===phase&&(k<3||k-3===w.race):k===0;
  if(isDone||!active)return m;
  return a+`<button class="dc-btn primary" onclick="CS70.drive()">Drive</button><button class="dc-btn" onclick="CS70.sim()">Simulate</button>`+c;});
 const ahead=!w||D.day<dcPhaseDay()?`<p class="dc-note" style="margin:6px 0 12px">Drive or Simulate skips ahead to the session day.</p>`:'';
 const bar=`<div class="dc-actions" style="margin:12px 0 4px;flex-wrap:wrap">${phase<3||!w?'<button class="dc-btn" onclick="CS70.run(\'race\')">Simulate to the race</button>':''}<button class="dc-btn" onclick="CS70.run('all')">Simulate whole weekend</button></div>${ahead}`;
 return out.replace('<h3>Your weekend programme</h3>','<h3>Your weekend programme</h3>'+bar);
};

/* ---------- Contracts: every team, every week ---------- */
const avg=t=>t.drivers.reduce((n,d)=>n+d.ovr,0)/t.drivers.length;
function offers(){
 const p=dcPlayer();
 return D.world.teams.map(t=>{
  const a=avg(t),own=t.id===D.team,needOvr=a-3,needRep=35+Math.max(0,a-75)*1.5,keen=own||p.ovr>=needOvr&&D.reputation>=needRep;
  const seat=own?t.drivers.findIndex(d=>d.id===D.pid):t.drivers.reduce((best,d,i)=>d.ovr<t.drivers[best].ovr?i:best,0);
  return {team:t.id,seat,number:dcSeatNumber(t,seat),salary:Math.round((170000+(p.ovr-65)*22000)*(t.base/80)*(D.reputation/80+.4)/10000)*10000,years:own?2:2+(t.id%2),target:clamp(Math.round((95-t.base)*.7+2),1,20),keen,needOvr,needRep};
 }).sort((x,y)=>(y.team===D.team)-(x.team===D.team)||y.keen-x.keen||D.world.teams[y.team].base-D.world.teams[x.team].base);
}
// Mid-weekend moves would scramble the grid, so joining now waits for the weekend to finish.
const midWeekend=()=>!!(D.activeSession||D.weekend&&(D.weekend.phase>0||D.weekend.race>0));
function join(o,now){
 const t=D.world.teams.find(t=>t.id===o.team),seat=dcOfferSeat(o);if(!t||seat<0)return;
 if(!now||!dcEvent()){D.signed={...o,seat,number:dcSeatNumber(t,seat)};delete D.signed.keen;delete D.signed.needOvr;delete D.signed.needRep;D.offers=[];
  dcMsg('Driver manager','Contract signed · car #'+D.signed.number,`You will drive car #${D.signed.number} for ${t.name} from ${D.year+1} on a ${o.years}-season deal worth ${dcMoney(o.salary)} a year.`);
  dcSave();dcRender();dcToast('Car #'+D.signed.number+' is confirmed for '+(D.year+1)+'.');return;}
 if(midWeekend()){dcToast('Finish this race weekend first, then you can join straight away.');return;}
 const old=dcTeam(),p=dcPlayer(),oldSeat=old.drivers.findIndex(d=>d.id===p.id),number=dcSeatNumber(t,seat);
 if(t.id!==old.id||seat!==oldSeat){const replaced=t.drivers[seat],oldNumber=dcSeatNumber(old,oldSeat);
  old.drivers[oldSeat]={...replaced,number:oldNumber,originalNumber:oldNumber};t.drivers[seat]={...p,number,originalNumber:number};D.team=t.id;}
 D.contract={from:D.year,until:D.year+o.years-1,salary:o.salary,bonus:12000,seat,number};delete D.signed;D.offers=[];D.target=dcTarget();
 dcBindWorld();dcMsg('Driver manager','Welcome to '+t.name,`You drive car #${number} for ${t.name} from the next round, on a ${o.years}-season deal worth ${dcMoney(o.salary)} a year.`);
 dcSave();dcRender();dcToast('You now drive car #'+number+' for '+t.name+'.');
}
CS.accept=(team,now)=>{const o=offers().find(o=>o.team===team&&o.keen);if(o)join(o,now);};
CS.release=()=>{delete D.signed;dcSave();dcRender();dcToast('Next-season deal cancelled.');};

const contractsPrev=dcContracts;
dcContracts=function(){
 if(ir())return contractsPrev();
 const list=offers(),season=!!dcEvent(),hold=midWeekend(),s=D.signed,st=s&&D.world.teams[s.team];
 const card=o=>{const t=D.world.teams[o.team],own=o.team===D.team,signed=s&&s.team===o.team;
  return `<section class="dc-card" style="${o.keen?'':'opacity:.6'}"><div class="dc-eyebrow">${own?'RENEWAL':o.keen?'CONTRACT OFFER':'NOT INTERESTED YET'}</div><h3 style="margin-top:14px">${esc(t.name)}</h3><p><span class="dc-tag orange">CAR #${o.number}</span></p>`+
  (o.keen?`<div class="dc-value">${dcMoney(o.salary)}</div><p>${o.years} seasons · typical target P${o.target}</p><div class="dc-actions" style="flex-wrap:wrap">`+
   (season&&!own?`<button class="dc-btn primary" ${hold?'disabled':''} onclick="CS70.accept(${o.team},true)">Join now →</button>`:'')+
   (signed?'<span class="dc-tag">SIGNED FOR '+(D.year+1)+'</span>':`<button class="dc-btn${season&&!own?'':' primary'}" onclick="CS70.accept(${o.team},false)">${own?'Extend':'Sign'} from ${D.year+1}</button>`)+`</div>`
  :`<p>Needs OVR ${o.needOvr.toFixed(1)} (you ${dcPlayer().ovr.toFixed(1)}) and reputation ${Math.round(o.needRep)} (you ${Math.round(D.reputation)}).</p>`)+`</section>`;};
 return `<h1 class="dc-title">Your seat on the grid</h1><p class="dc-sub">Every team’s offer is open all season. Join now to switch from the next round, or sign for ${D.year+1}. Interest depends on your OVR and reputation.</p>`+
 `<section class="dc-hero"><div><div class="dc-eyebrow">CURRENT CONTRACT</div><h2>${esc(dcTeam().name)}</h2><span class="dc-tag orange">CAR #${dcPlayer().number}</span><p>${D.contract.from} — ${D.contract.until} · ${dcMoney(D.contract.salary)} per year · ${dcMoney(D.contract.bonus)} target bonus</p><span class="dc-tag orange">REPUTATION ${Math.round(D.reputation)} / 100</span></div><div>${dcCarArt(dcTeam().livery.secondary,dcPlayer().number)}</div></section>`+
 (s?`<section class="dc-card"><div class="dc-eyebrow">SIGNED FOR NEXT SEASON</div><h3>${esc(st.name)}</h3><p><span class="dc-tag orange">CAR #${dcSeatNumber(st,dcOfferSeat(s))}</span> ${s.years} seasons from ${D.year+1} · ${dcMoney(s.salary)} per year</p><div class="dc-actions"><button class="dc-btn" onclick="CS70.release()">Cancel this deal</button></div></section>`:'')+
 (hold&&season?`<div class="dc-inline-note">You are mid-weekend. Join now opens again once this round's racing is done.</div>`:'')+
 `<div class="dc-grid">${list.map(card).join('')}</div>`;
};
})();
