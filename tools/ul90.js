/* UL90 · Ultimate difficulty ("beast mode"), one tier above Hard.
   Rivals get a car that is genuinely quicker than yours (more tyre grip and engine power, so the
   tyre-model driver and the physics agree and they stay on the road), brake later, carry more
   corner speed, almost never make a mistake, defend hard and change lanes quickly. Qualifying
   times and the far-away AI pace are scaled to match, and pit crews are sharper. */
const UL90={grip:1.07,power:1.09,brake:1.06,mistakeRate:.01,qual:.972,defendRate:2.2,defendGap:60};
HD64.tiers.Ultimate={...HD64.tiers.Hard,pace:1.11,mistakes:0,block:1,rate:2.2,target:-6};
if(typeof QS66!=='undefined')QS66.tier.Ultimate=UL90.qual;
if(typeof AI76!=='undefined')AI76.rate.Ultimate=UL90.mistakeRate;
function ul90On(){return D?.settings?.difficulty==='Ultimate';}
function ul90Human(x){const L=live;if(!L||!x)return true;if(x===L.player)return true;return typeof hd64Humans==='function'&&hd64Humans(L).includes(x);}
// Rival cars: more grip (planner and physics both read dcTyreGrip, so they stay consistent).
const ul90Grip=dcTyreGrip;
dcTyreGrip=function(x){const g=ul90Grip.apply(this,arguments);return ul90On()&&live?.dc&&x&&!ul90Human(x)?g*UL90.grip:g;};
// Rival cars: more engine power and brake force while their physics step runs.
const ul90Drive=dc32FreeDrive;
dc32FreeDrive=function(x){
 if(!ul90On()||!live?.dc||ul90Human(x))return ul90Drive.apply(this,arguments);
 const P=PH47,p=P.power,d=P.drive,b=P.brake;P.power=p*UL90.power;P.drive=d*UL90.power;P.brake=b*UL90.brake;
 try{return ul90Drive.apply(this,arguments);}finally{P.power=p;P.drive=d;P.brake=b;}
};
// Defending: the hd64 block also runs on Ultimate; here it reacts sooner and moves across faster.
const ul90AI=dcAIStep;
dcAIStep=function(x){const r=ul90AI.apply(this,arguments);if(ul90On()&&x?.hd64Def)x.hd64Rate=UL90.defendRate;return r;};
// Sharper pit crews for rivals (stationary time about 12% shorter).
if(typeof dcPitStep==='function'){const ul90Pit=dcPitStep;dcPitStep=function(x,dt){return ul90Pit.call(this,x,ul90On()&&x&&!ul90Human(x)&&x.pitStage==='stop'?dt*1.12:dt,...[].slice.call(arguments,2));};}
