/* HD64 difficulty tiers. Easy is the old Intermediate, Intermediate is the old Hard, and Hard is
   new: rivals drive near the tyre limit (later braking, full use of the grip), defend their
   position against you, and make fewer mistakes. */
const HD64={tiers:{
 Easy:{pace:1,use:.89,corner:.92,dec:.62,tgain:.5,bgain:.6,look:.7,mistakes:2,block:0,rate:1,target:1},
 Intermediate:{pace:1.035,use:.89,corner:.955,dec:.62,tgain:.5,bgain:.6,look:.7,mistakes:2,block:0,rate:1,target:-1},
 Hard:{pace:1.065,use:.89,corner:1,dec:.62,tgain:.5,bgain:.6,look:.7,mistakes:1,block:1,rate:1.6,target:-3}
}};
function hd64Tier(){return HD64.tiers[D?.settings?.difficulty]||HD64.tiers.Intermediate;}
function hd64Pace(){return hd64Tier().pace;}
function hd64TargetShift(){return hd64Tier().target;}
// Tyre-model driver settings follow the tier; the far-away path model is rescaled to match.
const hd64Launch=dcLaunch;
dcLaunch=function(...args){
 const T=hd64Tier();for(const k of ['use','dec','tgain','bgain','look'])AI62[k]=T[k];AI62.pace=T.corner;
 const r=hd64Launch(...args),L=live,W=sc25Engine;
 if(L?.dc&&W&&!(D.settings.ph47Classic||D.settings.ai62Off)){const cache=W.hd64Lap||(W.hd64Lap={}),key=L.e.key+':'+AI62.use;if(!cache[key])cache[key]=ai62LapEstimate(W,L.e);L.ai62Pace=clamp(cache[key]/L.e.realLap,.9,1.25);}
 return r;
};

// Hard: one scripted race mistake instead of two (the tyre model still punishes errors).
const hd64Plan=rf40Plan;
rf40Plan=function(L){const fresh=!L.rf40RaceErrors,p=hd64Plan(L),n=hd64Tier().mistakes;if(fresh&&p.events.length>n)p.events=p.events.filter((e,i)=>i===(p.seed%2?1:0)).slice(0,n);return p;};
// Hard: a rival with you close behind defends. It mirrors your line on the straights and covers
// the inside before braking zones, holding each move for a moment (no weaving every frame).
// Once you have overlap it stops moving across, and the lane-clear check still prevents
// it from driving into a car alongside.
function hd64Humans(L){const h=[L.player];if(typeof CO!=='undefined'&&CO.race&&CO.pl?.[1]?.x)h.push(CO.pl[1].x);return h.filter(Boolean);}
function hd64Defend(L,x){
 x.hd64Rate=1;if(!hd64Tier().block||L.stage!=='race'||!L.started||L.phase!=='racing'||L.scTrain||x.pitStage||x.pitNow||x.rf40Incident||x.retired||x.finished||hd64Humans(L).includes(x)){x.hd64Def=null;return;}
 const W=sc25Engine,len=L.e.lengthKm*1000;let att=null,gap=Infinity;
 for(const h of hd64Humans(L)){if(h.pitStage||h.retired)continue;const g=(x.progress-h.progress)*len;if(g>0&&g<gap){gap=g;att=h;}}
 if(!att||gap>45||gap<5.5){x.hd64Def=null;return;}
 const d=x.hd64Def;if(d&&L.elapsed<d.until&&d.att===att){x.hd64Rate=HD64.tiers.Hard.rate;return;}
 // Inside of the next real corner within braking range, otherwise the attacker's line.
 let kMax=0,apex=0;for(let m=25;m<=Math.max(90,x.v*2.6);m+=12){const f=x.progress+m/len,k=Math.abs(dcTrackCurvature(W,f));if(k>kMax){kMax=k;apex=f;}}
 let lane;if(kMax>1/180){const a=hd64Lane(W,apex,x);lane=(Math.sign(a)||1)*3.3;}else lane=clamp(att.lane||0,-4.5,4.5);
 x.hd64Def={lane,att,until:L.elapsed+1.1};x.hd64Rate=HD64.tiers.Hard.rate;
}
const hd64Lane=dcRacingLane;
dcRacingLane=function(W,phase,x){const d=x?.hd64Def;if(d&&live&&L_ok(x))return d.lane;return hd64Lane(W,phase,x);};
function L_ok(x){return !x.rf40Incident&&!x.pitStage;}
const hd64AI=dcAIStep;
dcAIStep=function(x,dt){const L=live;if(L?.dc)hd64Defend(L,x);return hd64AI.apply(this,arguments);};
