/* QS66 qualifying and shootout times. Your real best lap always counts, including when you
   simulate the rest of the session, and the simulated rivals lap at the pace the tyre model
   allows at this circuit (the same quasi-steady lap the AI cars are calibrated to), scaled by
   the difficulty tier. Each driver's time is seeded per weekend and session, so the order is
   driven by driver and car pace rather than dice, and the grid follows the classification. */
const QS66={
 // Average rival relative to the tyre-model lap: Hard rivals drive at the limit (memory: Hard
 // AI ~= the quasi-steady lap), Intermediate and Easy lose time in the corners (hd64 corner scale).
 tier:{Easy:1.035,Intermediate:1.016,Hard:.997},
 stage:{practice:1.006,qualifying:1,shootout:.998},
 spread:.4,noise:.0045,
 // Tyre-model quasi-steady lap per circuit (ai62LapEstimate at AI62.use .89), seconds.
 lap:{sydney:97.81,albert:125.83,taupo:95.6,symmons:65.26,perth:58.16,darwin:77.93,townsville:83.27,ipswich:77.96,bend:122.03,bathurst:139.74,goldcoast:93.87,sandown:82.66,adelaide:83.63,homebush:99.98}
};
function qs66Hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ((h>>>0)%100000)/100000;}
// Standard-normal-ish draw from a stable seed.
function qs66Draw(s){let t=0;for(let i=0;i<4;i++)t+=qs66Hash(s+':'+i);return (t-2)*1.73;}
function qs66Base(e){if(D.settings.ph47Classic||D.settings.ai62Off)return e.realLap;return QS66.lap[e.key]||e.realLap*1.09;}
function qs66Cond(x){const wet=S.weather!=='Dry',tyre=x.tyre||D.setup.tyre;return wet?(tyre==='Wet'?1:tyre==='Hard'?.80:.71):(tyre==='Soft'?1.035:tyre==='Hard'?1:.86);}
function qs66Weather(){return S.weather==='Extremely Wet'?1.13:S.weather!=='Dry'?1.08:1;}
// Driver + car + set-up pace with the tyre and the tier taken out (dcPerformance carries both).
function qs66Skill(x,stage){const p=dcPerformance(x,stage),own=x.d.id===D.pid?1+(D.practiceBonus||0):hd64Pace();return p/own/qs66Cond(x);}
function qs66Times(stage){
 const e=dcEvent(),w=D.weekend||{},Q=qs66Base(e),diff=D.settings.difficulty,T=QS66.tier[diff]||QS66.tier.Intermediate;
 const all=D.world.teams.flatMap(t=>t.drivers.map(d=>{const a=d.id===D.pid?D.setup:dcRivalSetup(t),x={d,team:t,...a};return {x,skill:qs66Skill(x,stage)};}));
 const field=all.reduce((s,r)=>s+r.skill,0)/all.length,seed=[D.season||D.year||'',e.key,w.race||0,stage].join('/');
 const L=live,humans=L?.dc&&L.stage===stage?(typeof hd64Humans==='function'?hd64Humans(L):[L.player]):[];
 return all.map(({x,skill})=>{
  const human=humans.find(h=>h.d?.id===x.d.id),tier=x.d.id===D.pid?QS66.tier.Intermediate:T;
  let time=Q*qs66Weather()*(1.035/qs66Cond(x))*tier*(QS66.stage[stage]||1)*Math.pow(field/skill,QS66.spread)*(1+QS66.noise*qs66Draw(seed+'/'+x.d.id));
  if(human&&isFinite(human.best))time=human.best;
  return {id:x.d.id,time,d:x.d,team:x.team};
 }).sort((a,b)=>a.time-b.time);
}
dcSimTimes=qs66Times;
// Simulating the rest of a session used to drop your lap: qs66Times keeps any human's real best.
// Rivals' live laps on the timing tower can't beat their pace for the session, so the tower and
// the final classification agree.
const qs66Physics=dcPhysics;
dcPhysics=function(dt,input,auto){const L=live,r=qs66Physics.apply(this,arguments);
 if(L&&L.dc&&!L.test&&L.stage!=='race'&&live===L){
  if(!L.qs66Floor||L.qs66Floor.stage!==L.stage){L.qs66Floor={stage:L.stage,t:Object.fromEntries(qs66Times(L.stage).map(r=>[r.id,r.time]))};}
  const humans=typeof hd64Humans==='function'?hd64Humans(L):[L.player];
  for(const x of L.entrants){if(humans.includes(x))continue;const f=L.qs66Floor.t[x.d.id];if(f&&x.best<f)x.best=f;}
 }
 return r;};
