/* mk71 car character: the FG X Falcon and the ZB Commodore drive differently on the PH47 tyre model.
   Falcon (quad-cam V8): peaky engine that pulls hardest near the limiter, more weight on the nose,
   more front roll stiffness (steady, a touch of understeer), more downforce and drag, front-biased brakes.
   Commodore (pushrod V8): fat low and mid-range torque that fades up top, lighter nose and looser rear
   (sharper turn-in, livelier on power), slippery body for top speed, more rear brake so it rotates
   on trail braking. Toyota and anything else keep the base PH47 values. The values are swapped into
   PH47 only while that car's physics (or its AI corner planner) runs, then restored, so player and
   AI cars of each make get the same character. Tuned so lap times stay within about a tenth. */
(function(){
'use strict';
const TOP=[0,65,108,151,196,246,300],LIMIT=7350;
// Power multiplier against engine rpm (same speed -> gear -> rpm model as the HUD and engine sound).
const MAKES={
 Ford:{set:{a:1.34,b:1.48,rollFront:.597,bias:.672,cd:.645,cl:.578,drive:9300},
  curve:[[2500,.88],[4400,.92],[5300,.95],[6200,1.02],[6900,1.07],[7400,1.06]]},
 Holden:{set:{a:1.39,b:1.43,rollFront:.565,bias:.642,cd:.596,cl:.53,drive:9900},
  curve:[[2500,1.01],[4400,1.045],[5200,1.05],[6000,1.01],[6800,.955],[7400,.92]]}
};
MAKES.Chevrolet=MAKES.Holden;
const KEYS=['a','b','rollFront','bias','cd','cl','drive','power'],BASE={};for(const k of KEYS)BASE[k]=PH47[k];
const on=()=>!D?.settings?.mk71Off;
function make(x){return on()&&MAKES[x?.team?.manufacturer]||null;}
function rpmOf(x){
 const kmh=Math.abs(x.v||0)*3.6,g=kmh<65?1:kmh<108?2:kmh<151?3:kmh<196?4:kmh<246?5:6;
 return Math.min(LIMIT,Math.max(2500,kmh/TOP[g]*LIMIT));
}
function curveAt(c,r){if(r<=c[0][0])return c[0][1];for(let i=1;i<c.length;i++)if(r<=c[i][0]){const[a,p]=c[i-1],[b,q]=c[i];return p+(q-p)*(r-a)/(b-a);}return c[c.length-1][1];}
// Expose for the HUD/telemetry and testing.
window.mk71Power=x=>{const m=make(x);return m?curveAt(m.curve,rpmOf(x)):1;};
function withCar(x,fn,self,args){
 const m=make(x);if(!m)return fn.apply(self,args);
 const saved={};for(const k of KEYS)saved[k]=PH47[k];
 Object.assign(PH47,m.set);PH47.power=BASE.power*curveAt(m.curve,rpmOf(x));
 try{return fn.apply(self,args);}finally{Object.assign(PH47,saved);}
}
function install(){
 if(window.mk71Installed)return;window.mk71Installed=true;
 const fd=dc32FreeDrive;dc32FreeDrive=function(x){return withCar(x,fd,this,arguments);};
 if(typeof ai62CornerCap==='function'){const cc=ai62CornerCap;ai62CornerCap=function(L,x){return withCar(x,cc,this,arguments);};}
 if(typeof dcSettingsFields==='function'){const sf=dcSettingsFields;dcSettingsFields=function(...args){return sf.apply(this,args)+`<div class="dc-card" style="margin-top:18px"><h3>Car character</h3><label class="dc-checkbox"><input type="checkbox" ${on()?'checked':''} onchange="D.settings.mk71Off=!this.checked;dcSave()">Falcon and Commodore drive differently</label><p class="dc-muted">The Falcon's quad-cam V8 pulls hardest near the limiter, it carries more weight on the nose, turns in steadily and stays planted on the brakes, with a little more downforce for fast corners. The Commodore's pushrod V8 punches out of slow corners but fades up top, its lighter nose turns in sharper, the rear is livelier on power and under trail braking, and its slippery body is quicker down long straights. Lap times stay level.</p></div>`;};}
}
// Install after the window-load hooks of earlier layers so these wrappers sit outermost.
if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0));
})();
