// au66 sound overhaul: recorded-style V8 engine loops built from real firing orders, exhaust pops,
// straight-cut gear whine, tyre squeal/scrub, kerbs, gravel, wind, crashes, opponents you can hear
// around you (distance, panning, Doppler) and a mixer with a limiter. Replaces au56 and the older
// engine, whine, road-noise, squeal, scrape and rumble voices.
(function(){
'use strict';
const TAU=Math.PI*2,IDLE=1050,LIMIT=7500,TOP=[0,65,108,151,196,246,300];
const PTS=[900,1100,1350,1650,2000,2450,3000,3650,4450,5400,6550,7900];
const MIX_DEFAULT={engine:1,opp:1,fx:1};
const cl=(v,a,b)=>v<a?a:v>b?b:v;
function rng(seed){let s=seed>>>0||1;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- Offline DSP helpers (used to pre-render loops once per session) ---------- */
function biquad(type,f,q,gainDb,sr){
 const w=TAU*Math.min(f,sr*.45)/sr,cs=Math.cos(w),sn=Math.sin(w),al=sn/(2*q),A=Math.pow(10,(gainDb||0)/40);let b0,b1,b2,a0,a1,a2;
 if(type==='lp'){b0=(1-cs)/2;b1=1-cs;b2=b0;a0=1+al;a1=-2*cs;a2=1-al;}
 else if(type==='hp'){b0=(1+cs)/2;b1=-(1+cs);b2=b0;a0=1+al;a1=-2*cs;a2=1-al;}
 else if(type==='bp'){b0=al;b1=0;b2=-al;a0=1+al;a1=-2*cs;a2=1-al;}
 else{b0=1+al*A;b1=-2*cs;b2=1-al*A;a0=1+al/A;a1=-2*cs;a2=1-al/A;}
 b0/=a0;b1/=a0;b2/=a0;a1/=a0;a2/=a0;let x1=0,x2=0,y1=0,y2=0;
 return x=>{const y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
}
// Run a stateful filter round a loop several times so its output wraps seamlessly.
function circ(src,fn,passes=2){const L=src.length,out=new Float32Array(L);for(let p=0;p<passes;p++){const last=p===passes-1;for(let n=0;n<L;n++){const v=fn(src[n]);if(last)out[n]=v;}}return out;}
// Exhaust pipe: a delay-line waveguide with a damped, inverting open-end reflection.
function pipe(D,refl,damp){const h=new Float32Array(D);let i=0,z=0;return x=>{z+=damp*(h[i]-z);const y=x+refl*z;h[i]=y;i=++i%D;return y;};}
function rms(a){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*a[i];return Math.sqrt(s/a.length)||1e-9;}
function scale(a,k){for(let i=0;i<a.length;i++)a[i]*=k;return a;}

/* ---------- Engine voices ----------
   Supercars Gen3: Ford 5.4 DOHC (Coyote family), Chevrolet 5.7 pushrod (ZB/Camaro), Toyota 5.0 DOHC,
   all cross-plane V8s. Firing order decides which bank each pulse goes down: the uneven
   per-bank spacing is where the V8 burble comes from. */
const PROFILES={
 Ford:{cyl:8,order:[1,0,1,0,0,1,0,1],pipes:[1.95,2.12],tau:.30,drive:2.0,intake:.34,intakeF:190,mech:.05,low:[105,3],mid:[1450,3.5],seed:11},
 Holden:{cyl:8,order:[0,1,0,1,1,0,1,0],pipes:[2.25,2.4],tau:.40,drive:1.7,intake:.26,intakeF:150,mech:.028,low:[88,5],mid:[1150,2.5],seed:23},
 Toyota:{cyl:8,order:[1,0,1,0,0,1,0,1],pipes:[1.78,1.9],tau:.28,drive:2.1,intake:.36,intakeF:210,mech:.045,low:[115,2.5],mid:[1700,4],seed:37},
 BMW:{cyl:6,order:[0,0,0,0,0,0],pipes:[2.05,2.05],tau:.24,drive:2.3,intake:.4,intakeF:240,mech:.06,low:[130,2],mid:[2100,4],seed:41}
};
PROFILES.Chevrolet=PROFILES.Holden;
function profileOf(x){const m=x?.team?.manufacturer;return PROFILES[m]?m==='Chevrolet'?'Holden':m:'Ford';}
function renderEngine(P,rpm,on,sr){
 const R=rng(P.seed*977+rpm*(on?3:7)|0),ev=P.cyl,cyc=120/rpm,N=Math.max(3,Math.round(.7/cyc)),L=Math.round(N*cyc*sr),rpmA=120*N*sr/L;
 const ex=[new Float32Array(L),new Float32Array(L)],ind=new Float32Array(L);
 const lowRev=cl(1-(rpm-900)/2600,0,1),lump=(on?.07:.32)+.22*lowRev;
 const tau=P.tau*sr/1000*(on?1:1.7)*(1+.5*lowRev),klen=Math.ceil(tau*16),nf=on?.32:.58;
 const bias=[];{const B=rng(P.seed);for(let k=0;k<ev;k++)bias.push(1+(B()*2-1)*.07);}
 for(let c=0;c<N;c++)for(let k=0;k<ev;k++){
  const start=Math.floor((c*ev+k)*L/(N*ev)),bank=P.order[k];let amp=bias[k]*(1+(R()*2-1)*lump)*(on?1:.42);if(!on&&R()<.1)amp*=.25;
  const e=ex[bank];
  for(let j=0;j<klen;j++){const t=j/tau,s=t*Math.exp(1-t),n=(R()*2-1)*Math.exp(-t*.6),i=(start+j)%L;e[i]+=amp*(s*(1-nf)+n*nf);ind[i]+=amp*(R()*2-1)*Math.exp(-j/(tau*3.5));}
 }
 const banks=ex.map((e,b)=>{
  const D=Math.max(8,Math.round(2*P.pipes[b]/520*sr)),H=Math.max(4,Math.round(2*.72/520*sr)),p1=pipe(D,-.58,.42),p2=pipe(H,.32,.6);
  return circ(e,x=>p1(p2(x)),3);
 });
 const sum=new Float32Array(L);for(let n=0;n<L;n++)sum[n]=banks[0][n]+banks[1][n]*.92;
 // Open-pipe radiation (rising with frequency), body and presence colour.
 let prev=sum[L-1];const rad=new Float32Array(L);for(let n=0;n<L;n++){rad[n]=sum[n]-.82*prev;prev=sum[n];}
 const lowF=biquad('pk',P.low[0],1,P.low[1]+(on?0:2),sr),midF=biquad('pk',P.mid[0],1.2,on?P.mid[1]:-2,sr),top=biquad('lp',on?7200:4200,.7,0,sr);
 const ex1=circ(rad,x=>top(midF(lowF(x))),2);
 // Induction roar: airbox resonance plus an order-tracked band, much stronger on throttle.
 const fire=rpm/60*ev/2,hb=biquad('bp',P.intakeF,1.6,0,sr),ob=biquad('bp',fire*2,2.2,0,sr);
 const intake=circ(ind,x=>hb(x)+ob(x)*.6,2);
 // Valve train chatter, ticking at the valve events.
 const vr=rng(P.seed+5),mhp=biquad('hp',3200,.7,0,sr),mn=new Float32Array(L);for(let n=0;n<L;n++)mn[n]=vr()*2-1;
 const mech=circ(mn,mhp,2);
 const ke=rms(ex1),ki=rms(intake)*(1/(P.intake*(on?1:.35)+1e-6)),km=rms(mech)/P.mech;
 const out=new Float32Array(L),vt=16*N/L;
 for(let n=0;n<L;n++){const tick=Math.pow(.5+.5*Math.cos(TAU*n*vt),6);out[n]=ex1[n]/ke+intake[n]/ki+mech[n]/km*tick;}
 const pre=.38/rms(out),dr=P.drive*(on?1:.6),td=Math.tanh(dr);for(let n=0;n<L;n++)out[n]=Math.tanh(out[n]*pre*dr)/td;
 const dc=biquad('hp',25,.7,0,sr),fin=circ(out,dc,2);scale(fin,.25/rms(fin));
 return{buf:fin,rpm:rpmA};
}

/* ---------- One-shots and effect loops ---------- */
function renderPop(sr,seed,big){
 const R=rng(seed),L=Math.round(sr*(big?.34:.22)),o=new Float32Array(L),f0=70+R()*60,bp=biquad('bp',500+R()*500,.8,0,sr);
 for(let n=0;n<L;n++){const t=n/sr;o[n]=(R()*2-1)*Math.exp(-t/.0009)*1.2+Math.sin(TAU*f0*t)*Math.exp(-t/(big?.05:.03))*(big?1:.6);}
 const crackles=big?14:7;for(let k=0;k<crackles;k++){const at=Math.floor((.004+R()*R()*(big?.2:.12))*sr),a=(1-k/crackles)*(.5+R()*.6);for(let j=0;j<sr*.0015&&at+j<L;j++)o[at+j]+=(R()*2-1)*a*Math.exp(-j/(sr*.0004));}
 for(let n=0;n<L;n++){o[n]=Math.tanh((o[n]+bp(o[n])*1.5)*2.6);}
 return o;
}
function renderClunk(sr){const L=Math.round(sr*.09),o=new Float32Array(L),R=rng(3),bp=biquad('bp',2600,3,0,sr);for(let n=0;n<L;n++){const t=n/sr;o[n]=Math.sin(TAU*62*t)*Math.exp(-t/.018)*.8+bp((R()*2-1))*Math.exp(-t/.006)*3;}return o;}
function renderSqueal(sr){
 // 4 s seamless loop: narrow tyre resonances with slowly wandering pitch and flutter.
 const L=sr*4,R=rng(77),src=new Float32Array(L);for(let n=0;n<L;n++)src[n]=R()*2-1;
 const modes=[[880,1],[1330,.7],[2140,.35],[640,.4]],out=new Float32Array(L);
 for(const[f,a]of modes){const st={y1:0,y2:0},rr=.9993;
  for(let p=0;p<2;p++)for(let n=0;n<L;n++){const t=n/sr,fm=f*(1+.035*Math.sin(TAU*.75*t+f)+.012*Math.sin(TAU*3.25*t)),w=TAU*fm/sr,y=src[n]*(1-rr)*6+2*rr*Math.cos(w)*st.y1-rr*rr*st.y2;st.y2=st.y1;st.y1=y;if(p)out[n]+=y*a;}}
 for(let n=0;n<L;n++){const t=n/sr;out[n]*=.72+.28*Math.sin(TAU*11*t+Math.sin(TAU*1.5*t)*2);}
 return scale(out,.3/rms(out));
}
function renderNoiseLoop(sr,secs,seed,filters,shape){
 const L=Math.round(sr*secs),R=rng(seed),src=new Float32Array(L);for(let n=0;n<L;n++)src[n]=(R()*2-1)*(shape?shape(n,L,R):1);
 const fs=filters.map(f=>biquad(f[0],f[1],f[2],f[3]||0,sr));const out=circ(src,x=>fs.reduce((v,f)=>f(v),x),2);return scale(out,.3/rms(out));
}
function renderKerb(sr){
 // 24 thumps in one second: played at rate v/24 m/s, so one thump per metre of kerb.
 const L=sr,o=new Float32Array(L),R=rng(9);for(let k=0;k<24;k++){const at=Math.floor(k*L/24),a=.8+R()*.3;for(let j=0;j<sr*.035;j++){const t=j/sr,i=(at+j)%L;o[i]+=a*(Math.sin(TAU*74*t)*Math.exp(-t/.011)+(R()*2-1)*Math.exp(-t/.0015)*.5);}}
 return scale(o,.3/rms(o));
}
function renderGravel(sr){const L=sr*2,R=rng(19),o=new Float32Array(L),lp=biquad('lp',380,.7,0,sr);for(let n=0;n<L;n++)o[n]=lp(R()*2-1)*2;
 for(let k=0;k<900;k++){const at=Math.floor(R()*L),a=R()*.9;for(let j=0;j<sr*.002;j++)o[(at+j)%L]+=(R()*2-1)*a*Math.exp(-j/(sr*.0005));}return scale(o,.3/rms(o));}
function renderScrape(sr){const L=sr*2,R=rng(29),src=new Float32Array(L);for(let n=0;n<L;n++)src[n]=(R()*2-1)*(R()<.04?3:1);
 const f=[biquad('bp',1900,6,0,sr),biquad('bp',3100,8,0,sr),biquad('bp',4700,7,0,sr),biquad('bp',900,3,0,sr)];const out=circ(src,x=>f[0](x)+f[1](x)*.8+f[2](x)*.5+f[3](x)*.6,2);
 for(let n=0;n<L;n++)out[n]*=.6+.4*Math.abs(Math.sin(TAU*17*n/sr+Math.sin(TAU*n/L)*3));return scale(out,.3/rms(out));}
function renderCrash(sr,tier,seed){
 const R=rng(seed),dur=[.35,.7,1.3][tier],L=Math.round(sr*dur),o=new Float32Array(L);
 // Low body thump.
 const tf=95+R()*35,tt=[.07,.13,.2][tier];let ph=0;for(let n=0;n<L;n++){const t=n/sr,f=35+(tf-35)*Math.exp(-t/.08);ph+=TAU*f/sr;o[n]+=Math.sin(ph)*Math.exp(-t/tt)*[.7,1,1.2][tier];}
 // Bent metal: inharmonic panel modes.
 const modes=[8,16,26][tier];for(let m=0;m<modes;m++){const f=170*(1+Math.pow(m*(.6+R()*.8),1.25)),d=cl(.35/(1+f/900),.025,.4)*(tier?1:.5),a=(.25+R()*.75)/(1+m*.12),p0=R()*TAU;
  for(let n=0;n<L;n++){const t=n/sr,e=Math.exp(-t/d);if(e<.001)break;o[n]+=Math.sin(TAU*f*t+p0)*e*a*.18;}}
 // Crunch: dense grains of tearing body work.
 const grains=[25,90,220][tier],span=[.1,.3,.6][tier];for(let g=0;g<grains;g++){const at=Math.floor(Math.pow(R(),1.8)*span*sr),len=Math.floor(sr*(.001+R()*.004)),a=(.3+R()*.7)*(1-at/L);const bp=biquad('bp',900+R()*4500,1.5+R()*3,0,sr);
  for(let j=0;j<len&&at+j<L;j++)o[at+j]+=bp(R()*2-1)*a*2.2*Math.sin(Math.PI*j/len);}
 // Debris and glass on the big ones.
 if(tier===2)for(let k=0;k<30;k++){const at=Math.floor((.08+R()*.9)*sr),f=2800+R()*5000,d=.01+R()*.04,a=.15*R();for(let j=0;j<d*5*sr&&at+j<L;j++){const t=j/sr;o[at+j]+=Math.sin(TAU*f*t)*Math.exp(-t/d)*a;}}
 for(let n=0;n<L;n++)o[n]=Math.tanh(o[n]*1.4);
 const fade=Math.floor(sr*.02);for(let n=0;n<fade;n++)o[L-1-n]*=n/fade;
 return o;
}

/* ---------- Audio graph ---------- */
const S={ready:false,banks:{},queue:[],L:null,voices:new Map(),close:[],last:0,frame:0};
window.AU66=S;
const rawConnect=AudioNode.prototype.connect;
// Everything the older layers send straight to the speakers goes through our limiter instead.
AudioNode.prototype.connect=function(dest,...rest){
 if(dest&&typeof AudioDestinationNode!=='undefined'&&dest instanceof AudioDestinationNode&&!this.__au66raw){const b=bus(dest.context);if(b&&this!==b.limiter)return rawConnect.call(this,b.legacy,...rest);}
 return rawConnect.call(this,dest,...rest);
};
function bus(c){
 if(c.__au66)return c.__au66;
 try{
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=10;limiter.ratio.value=6;limiter.attack.value=.004;limiter.release.value=.22;
  limiter.__au66raw=true;rawConnect.call(limiter,c.destination);
  const master=c.createGain();rawConnect.call(master,limiter);
  const mk=()=>{const g=c.createGain();g.gain.value=0;rawConnect.call(g,master);return g;};
  const legacy=c.createGain();rawConnect.call(legacy,master);
  return c.__au66={c,limiter,master,legacy,engine:mk(),opp:mk(),fx:mk()};
 }catch(e){return null;}
}
function makeBuf(c,data){const b=c.createBuffer(1,data.length,c.sampleRate);b.getChannelData(0).set(data);return b;}

// Pre-render off the main thread in a worker (falls back to small slices if workers are unavailable).
const FX_JOBS=()=>[['pop',0],['pop',1],['pop',2],['pop',3],['pop',4],['pop',5],['clunk'],['squeal'],['scrub'],['kerb'],['gravel'],['scrape'],['wind'],['road'],['spray'],...[0,1,2].flatMap(t=>[0,1,2].map(v=>['crash',t,v]))];
function renderJob(j,sr){
 if(j.make)return renderEngine(PROFILES[j.make],PTS[j.i],j.on,sr).buf;const[k,a,b]=j.fx;
 return k==='pop'?renderPop(sr,100+a,a<2):k==='clunk'?renderClunk(sr):k==='squeal'?renderSqueal(sr):k==='scrub'?renderNoiseLoop(sr,3,5,[['bp',520,.9],['lp',1400,.7]]):k==='kerb'?renderKerb(sr):k==='gravel'?renderGravel(sr):k==='scrape'?renderScrape(sr)
 :k==='wind'?renderNoiseLoop(sr,3,7,[['bp',650,.45],['lp',2600,.7]],(n,L)=>.8+.2*Math.sin(TAU*3*n/L)+.1*Math.sin(TAU*7*n/L)):k==='road'?renderNoiseLoop(sr,3,13,[['lp',260,.8],['pk',90,1,4]]):k==='spray'?renderNoiseLoop(sr,3,17,[['hp',2200,.7],['lp',7000,.7]]):renderCrash(sr,a,300+a*10+b);
}
function engineRpm(make,i,on,sr){const cyc=120/PTS[i],N=Math.max(3,Math.round(.7/cyc)),L=Math.round(N*cyc*sr);return 120*N*sr/L;}
let worker=null,pending=0;
function startWorker(c){
 if(worker!==null)return worker;worker=false;
 try{const code='const cl='+String(cl)+';\n'+[rng,biquad,circ,pipe,rms,scale,renderEngine,renderPop,renderClunk,renderSqueal,renderNoiseLoop,renderKerb,renderGravel,renderScrape,renderCrash,renderJob].map(String).join('\n')
   +'\nconst TAU=Math.PI*2,PTS='+JSON.stringify(PTS)+',PROFILES='+JSON.stringify(PROFILES)+';onmessage=e=>{const j=e.data,b=renderJob(j,j.sr);postMessage({j,b},[b.buffer]);};';
  const w=new Worker(URL.createObjectURL(new Blob([code],{type:'text/javascript'})));
  w.onmessage=e=>{pending--;store(c,e.data.j,e.data.b);};w.onerror=()=>{worker=false;pending=0;};worker=w;
 }catch(e){worker=false;}
 return worker;
}
function store(c,j,data){
 if(j.make){const B=S.banks[j.make];(j.on?B.on:B.off)[j.i]={buf:makeBuf(c,data),rpm:engineRpm(j.make,j.i,j.on,c.sampleRate)};B.done++;return;}
 const F=S.fxParts||(S.fxParts={pops:[],crash:[[],[],[]],n:0}),[k,a,b]=j.fx,buf=makeBuf(c,data);
 if(k==='pop')F.pops[a]=buf;else if(k==='crash')F.crash[a][b]=buf;else F[k]=buf;
 if(++F.n===FX_JOBS().length)S.fx=F;
}
function want(make){if(S.banks[make])return;S.banks[make]={on:[],off:[],done:0};for(let i=PTS.length-1;i>=0;i--)for(const on of [true,false])S.queue.push({make,i,on});
 if(!S.fxQueued){S.fxQueued=true;for(const fx of FX_JOBS())S.queue.push({fx});}}
function pump(c){
 const w=startWorker(c);
 if(w){while(S.queue.length&&pending<4){const j=S.queue.shift();j.sr=c.sampleRate;pending++;w.postMessage(j);}return;}
 const t0=performance.now();while(S.queue.length&&performance.now()-t0<8){const j=S.queue.shift();store(c,j,renderJob(j,c.sampleRate));}
}
function bankReady(make){const B=S.banks[make];return B&&B.done===PTS.length*2;}

/* A car's engine: crossfades between the two nearest RPM loops, on- and off-throttle sets. */
function Voice(c,out,player){
 this.c=c;this.g=c.createGain();this.g.gain.value=0;this.am=c.createGain();this.lp=c.createBiquadFilter();this.lp.type='lowpass';this.lp.frequency.value=12000;this.lp.Q.value=.6;
 this.pan=c.createStereoPanner?c.createStereoPanner():c.createGain();rawConnect.call(this.g,this.am);rawConnect.call(this.am,this.lp);rawConnect.call(this.lp,this.pan);rawConnect.call(this.pan,out);
 this.slots=new Map();this.rpm=IDLE;this.thr=0;this.gear=0;this.out=out;this.player=player;
 if(player){this.lfo=c.createOscillator();this.lfo.type='square';this.lfo.frequency.value=16;this.depth=c.createGain();this.depth.gain.value=0;rawConnect.call(this.lfo,this.depth);rawConnect.call(this.depth,this.am.gain);this.lfo.start();}
}
Voice.prototype.update=function(make,rpm,thr,level,rate,t){
 const B=S.banks[make];if(!B||B.done<PTS.length*2)return;this.make=make;
 let i=0;while(i<PTS.length-2&&rpm>PTS[i+1])i++;const w=cl(Math.log(rpm/PTS[i])/Math.log(PTS[i+1]/PTS[i]),0,1),on=Math.pow(cl(thr,0,1),.7);
 const want=new Map(),add=(set,k,g)=>{if(g>.002)want.set(set+k,{set,k,g});};
 add('on',i,Math.cos(w*Math.PI/2)*Math.sqrt(on));add('on',i+1,Math.sin(w*Math.PI/2)*Math.sqrt(on));add('off',i,Math.cos(w*Math.PI/2)*Math.sqrt(1-on));add('off',i+1,Math.sin(w*Math.PI/2)*Math.sqrt(1-on));
 for(const[key,s]of this.slots)if(!want.has(key)||s.make!==make){s.g.gain.setTargetAtTime(0,t,.02);if(!s.end){s.end=t+.2;try{s.src.stop(t+.2);}catch(e){}}if(t>s.end+.1){this.slots.delete(key);}}
 for(const[key,w2]of want){let s=this.slots.get(key);if(s&&s.end){this.slots.delete(key);s=null;}
  const L=B[w2.set][w2.k];
  if(!s){const src=this.c.createBufferSource(),g=this.c.createGain();src.buffer=L.buf;src.loop=true;g.gain.value=0;rawConnect.call(src,g);rawConnect.call(g,this.g);src.playbackRate.value=rpm/L.rpm*rate;src.start(t,Math.random()*L.buf.duration);src.onended=()=>{src.disconnect();g.disconnect();};s={src,g,make};this.slots.set(key,s);}
  s.src.playbackRate.setTargetAtTime(rpm/L.rpm*rate,t,.012);s.g.gain.setTargetAtTime(w2.g,t,.02);}
 this.g.gain.setTargetAtTime(level,t,.025);
};
Voice.prototype.oneShot=function(buf,gain,rate){const c=this.c,t=c.currentTime,src=c.createBufferSource(),g=c.createGain();src.buffer=buf;src.playbackRate.value=rate||1;g.gain.value=gain;rawConnect.call(src,g);rawConnect.call(g,this.lp);src.start(t);src.onended=()=>{src.disconnect();g.disconnect();};};
Voice.prototype.cut=function(t,len){const a=this.am.gain;a.cancelScheduledValues(t);a.setTargetAtTime(.1,t,.005);a.setTargetAtTime(1,t+len,.012);};
Voice.prototype.kill=function(){const t=this.c.currentTime;this.g.gain.setTargetAtTime(0,t,.05);for(const s of this.slots.values()){try{s.src.stop(t+.3);}catch(e){}}this.slots.clear();if(this.lfo)try{this.lfo.stop(t+.3);}catch(e){}setTimeout(()=>{try{this.pan.disconnect();}catch(e){}},600);};

function loopSrc(c,buf,out){const src=c.createBufferSource(),g=c.createGain();src.buffer=buf;src.loop=true;g.gain.value=0;rawConnect.call(src,g);rawConnect.call(g,out);src.start(0,Math.random()*buf.duration);return{src,g};}
function fxSet(c,b){
 if(S.loops)return S.loops;const F=S.fx,m=b=>loopSrc(c,b,S.B.fx);
 const wf=c.createBiquadFilter();wf.type='lowpass';wf.frequency.value=8000;rawConnect.call(wf,S.B.fx);
 const wind=loopSrc(c,F.wind,wf);
 // Straight-cut gearbox whine: one tone tracks the engine, one the final drive (road speed).
 const pw=c.createPeriodicWave(new Float32Array([0,1,.35,.2,.08]),new Float32Array(5));
 const w1=c.createOscillator(),w2=c.createOscillator(),wg=c.createGain(),wbp=c.createBiquadFilter();w1.setPeriodicWave(pw);w2.setPeriodicWave(pw);wbp.type='bandpass';wbp.frequency.value=1800;wbp.Q.value=.7;wg.gain.value=0;
 const w2g=c.createGain();w2g.gain.value=.6;rawConnect.call(w1,wbp);rawConnect.call(w2,w2g);rawConnect.call(w2g,wbp);rawConnect.call(wbp,wg);rawConnect.call(wg,S.B.engine);w1.start();w2.start();
 return S.loops={squeal:m(F.squeal),lock:m(F.squeal),scrub:m(F.scrub),kerb:m(F.kerb),gravel:m(F.gravel),scrape:m(F.scrape),road:m(F.road),spray:m(F.spray),wind,wf,w1,w2,wg};
}

/* ---------- Car state ---------- */
function rpmFor(x,st,dt){
 const g=dcGear(x),speed=Math.abs(x.speed||0),thr=cl(st.thr,0,1);let target;
 if(g==='N'||g==='R'){target=g==='R'?IDLE+speed/25*LIMIT*.8:IDLE+thr*5600;}
 else{const n=+g||1;target=speed/TOP[n]*(LIMIT-150);if(n===1&&speed<30)target=Math.max(target,IDLE+thr*(3800-speed*40));
  const p=x.ph47;if(p&&x.ph47On&&thr>.3)target+=cl((p.slideR||0)*5,0,1)*1800*thr;}
 target=cl(Math.max(target,IDLE),IDLE,LIMIT+60);
 const rate=st.blip>0?24:target>st.rpm?10:15;st.blip=Math.max(0,(st.blip||0)-dt);st.rpm+=(target-st.rpm)*Math.min(1,dt*rate);return g;
}
function carState(x,dt){
 let st=x.__au66;if(!st)st=x.__au66={rpm:IDLE,thr:0,gear:0,v:x.v||0,popUntil:0,popAt:0,dist:null,dop:1};
 let thr=typeof x.throttle==='number'?x.throttle:null;
 if(thr===null){const acc=((x.v||0)-st.v)/Math.max(dt,1e-3);thr=x.v>.5?cl(.55+acc/5,0,1):0;}
 st.v=x.v||0;st.thr+=(thr-st.thr)*Math.min(1,dt*(thr>st.thr?14:9));
 return st;
}
function pops(v,st,now,vol,n){for(let k=0;k<n;k++)setTimeout(()=>v.oneShot(S.fx.pops[2+Math.floor(Math.random()*4)],vol*(.35+Math.random()*.4),.85+Math.random()*.35),k*(40+Math.random()*90));}
function camInfo(W){
 const cam=W?.camera;if(!cam)return null;cam.updateMatrixWorld?.();const e=cam.matrixWorld.elements;
 return{x:e[12],y:e[13],z:e[14],rx:e[0],ry:e[1],rz:e[2],fx:-e[8],fy:-e[9],fz:-e[10]};
}
function spatial(ci,x){const dx=x.pos.x-ci.x,dy=(x.pos.y||0)-ci.y+.6,dz=x.pos.z-ci.z,d=Math.hypot(dx,dy,dz)||.01;return{d,pan:cl((dx*ci.rx+dy*ci.ry+dz*ci.rz)/(d+3),-1,1)*.85,front:(dx*ci.fx+dy*ci.fy+dz*ci.fz)/d};}
function mix(){const m=D.settings.au66Mix;return m&&typeof m==='object'?m:(D.settings.au66Mix={...MIX_DEFAULT});}

/* ---------- Per-frame update ---------- */
const CLOSE_CAMS={onboard:1,bonnet:1,chase:1};
function frame(){
 requestAnimationFrame(frame);
 const a=typeof dcAudio!=='undefined'?dcAudio:null,c=a?.ctx;if(!c||c.state!=='running')return;
 const B=S.B=bus(c);if(!B)return;
 const now=performance.now(),dt=cl((now-(S.last||now))/1000,0,.1);S.last=now;const t=c.currentTime;
 retireOld(a);
 const L=typeof live!=='undefined'?live:null,x=L?.player;
 if(L!==S.L){for(const v of S.voices.values())v.kill();S.voices.clear();for(const v of S.close)v&&v.kill();S.close=[];S.L=L;}
 if(!L||!x){for(const k of ['engine','opp','fx'])B[k].gain.setTargetAtTime(0,t,.05);return;}
 if(S.queue.length||!S.fx||pending){want(profileOf(x));for(const e of L.entrants)want(profileOf(e));pump(c);}
 const muted=L.paused||(typeof dcSimBusy!=='undefined'&&dcSimBusy),vol=muted?0:+D.settings.volume||0,M=mix();
 B.engine.gain.setTargetAtTime(vol*.62*(M.engine??1),t,.04);B.opp.gain.setTargetAtTime(vol*.62*(M.opp??1),t,.04);B.fx.gain.setTargetAtTime(vol*.62*(M.fx??1),t,.04);
 if(!S.fx||muted)return;
 const W=sc25Engine,ci=camInfo(W),cam=typeof sc25Camera!=='undefined'?sc25Camera:'chase',close=!!CLOSE_CAMS[cam],inside=cam==='onboard'||cam==='bonnet';
 // Players (two in Co-Op split screen).
 const co=window.CO63,players=[x];if(co?.race&&L.coop&&co.pl){const o=co.pl.map(p=>p.x).find(p=>p&&p!==x);if(o)players.push(o);}
 players.forEach((p,k)=>{
  const v=S.close[k]||(S.close[k]=new Voice(c,B.engine,true));v.lfo&&(v.lfo.frequency.value=16);
  const st=carState(p,dt),gStr=rpmFor(p,st,dt),n=+gStr||0,make=profileOf(p),thr=st.thr;
  if(p.retired){v.g.gain.setTargetAtTime(0,t,.1);return;}
  // Shifts: ignition-cut bark on the way up, auto-blip and crackle on the way down.
  if(n&&st.gear&&n!==st.gear){if(n>st.gear){v.cut(t,.065);if(Math.random()<.7)v.oneShot(S.fx.pops[Math.random()<.5?0:1],.55,.9+Math.random()*.2);}else{st.blip=.12;pops(v,st,now,.8,1+Math.floor(Math.random()*2));}v.oneShot(S.fx.clunk,inside?.9:.35,.9+Math.random()*.2);}
  if(n)st.gear=n;
  // Rev limiter and pit limiter stutter.
  const pitLim=k===0&&L.pt61?.lim&&p.speed>52&&thr>.25,revLim=st.rpm>LIMIT-90&&thr>.75;
  v.depth.gain.setTargetAtTime(pitLim?.85:revLim?.6:0,t,.01);v.lfo.frequency.setTargetAtTime(pitLim?11:19,t,.02);
  if(pitLim&&now>st.popAt){st.popAt=now+90+Math.random()*200;if(Math.random()<.6)v.oneShot(S.fx.pops[2+Math.floor(Math.random()*4)],.5,1);}
  // Overrun crackle for a second or so after lifting at high revs.
  if(thr>.5)st.popUntil=0;else if(thr<.1&&st.rpm>4300&&!st.popUntil)st.popUntil=now+700+Math.random()*900;
  if(st.popUntil>now&&now>st.popAt&&st.rpm>3000){st.popAt=now+45+Math.random()*190;if(Math.random()<.65)v.oneShot(S.fx.pops[2+Math.floor(Math.random()*4)],.3+Math.random()*.35,.85+Math.random()*.4);}
  const load=.32+.68*thr,revs=.5+.5*st.rpm/LIMIT;let level=load*revs*(k?.7:1),rate=1;
  if(close&&k===0){v.lp.frequency.setTargetAtTime(cam==='onboard'?3600:cam==='bonnet'?6500:13000,t,.05);if(v.pan.pan)v.pan.pan.setTargetAtTime(0,t,.05);}
  else if(ci){const sp=spatial(ci,p);level*=k&&close?.8:1/(1+Math.pow(sp.d/9,1.25));v.lp.frequency.setTargetAtTime(cl(16000/(1+sp.d/45),900,13000),t,.05);if(v.pan.pan)v.pan.pan.setTargetAtTime(k&&close?0:sp.pan,t,.05);}
  v.update(make,st.rpm,thr,level,rate,t);
 });
 opponents(c,B,L,x,players,ci,inside,dt,now,t);
 effects(c,B,L,x,players[0].__au66,inside,cam,t);
}
// Opponents: the nearest cars get their own engine, panned, distance-filtered and Doppler-shifted.
function opponents(c,B,L,x,players,ci,inside,dt,now,t){
 if(!ci)return;const MAX=6,cand=[];
 for(const e of L.entrants){if(players.includes(e)||e.retired||!e.pos)continue;const sp=spatial(ci,e);if(sp.d<240)cand.push([sp.d,e,sp]);}
 cand.sort((p,q)=>p[0]-q[0]);const keep=new Set(cand.slice(0,MAX).map(r=>r[1]));
 for(const[e,v]of S.voices)if(!keep.has(e)){v.kill();S.voices.delete(e);}
 for(const[d,e,sp]of cand.slice(0,MAX)){
  let v=S.voices.get(e);if(!v){v=new Voice(c,B.opp,false);S.voices.set(e,v);}
  const st=carState(e,dt),n=+rpmFor(e,st,dt)||0,make=profileOf(e);
  if(n&&st.gear&&n>st.gear&&d<35&&Math.random()<.5)v.oneShot(S.fx.pops[Math.random()<.5?0:1],.5,1);if(n)st.gear=n;
  // Doppler from how fast the gap to the camera is closing.
  if(st.dist!=null&&dt>0){const vr=cl((st.dist-d)/dt,-90,90);st.dop+=(343/(343-vr)-st.dop)*Math.min(1,dt*6);}st.dist=d;
  let level=(.32+.68*st.thr)*(.5+.5*st.rpm/LIMIT)/(1+Math.pow(d/9,1.25));if(inside)level*=.55;if(sp.front<-.2&&inside)level*=.8;
  v.lp.frequency.setTargetAtTime(cl(16000/(1+d/40),700,14000)*(inside?.3:1),t,.05);if(v.pan.pan)v.pan.pan.setTargetAtTime(sp.pan,t,.05);
  v.update(make,st.rpm,st.thr,level,cl(st.dop,.8,1.25),t);
 }
}
function effects(c,B,L,x,st,inside,cam,t){
 const F=fxSet(c,B),p=x.ph47,speed=Math.hypot(x.v||0,x.latV||0),dry=L.weather==='Dry';
 const wheels=p?.wheels||[],onRoad=wheels.length?wheels.filter(w=>w.kind!=='grass').length/wheels.length:1,offRoad=1-onRoad;
 const slide=p&&x.ph47On?cl(p.slideF*4+p.slideR*5+p.spin*.6,0,1):cl(Math.abs(x.latV||0)/6,0,1),lock=p&&(p.lockF||p.lockR)?1:0,mv=cl(speed/6,0,1);
 const sq=dry?Math.pow(slide,1.3)*onRoad*mv:0,lk=dry?lock*onRoad*mv:0;
 F.squeal.g.gain.setTargetAtTime(sq*.55,t,.04);F.squeal.src.playbackRate.setTargetAtTime(.9+slide*.18+speed*.0015,t,.08);
 F.lock.g.gain.setTargetAtTime(lk*.5,t,.03);F.lock.src.playbackRate.setTargetAtTime(1.32+speed*.002,t,.08);
 F.scrub.g.gain.setTargetAtTime(Math.pow(slide,.8)*onRoad*mv*(dry?.35:.18),t,.05);F.scrub.src.playbackRate.setTargetAtTime(.8+speed*.006,t,.1);
 const kerb=cl(p?.kerb||0,0,1);F.kerb.g.gain.setTargetAtTime(kerb*cl(speed/12,0,1)*.6,t,.03);F.kerb.src.playbackRate.setTargetAtTime(cl(speed/24,.15,3),t,.05);
 const grass=cl(Math.max(p?.grass||0,offRoad),0,1);F.gravel.g.gain.setTargetAtTime(grass*cl(speed/10,0,1)*.55,t,.05);F.gravel.src.playbackRate.setTargetAtTime(cl(.6+speed/50,.5,1.6),t,.1);
 F.scrape.g.gain.setTargetAtTime(cl(p?.scrape||0,0,1)*.6,t,.04);F.scrape.src.playbackRate.setTargetAtTime(cl(.7+speed/40,.6,1.5),t,.08);
 F.road.g.gain.setTargetAtTime(cl(speed/70,0,1)*(inside?.32:.22),t,.08);F.road.src.playbackRate.setTargetAtTime(cl(.7+speed/90,.7,1.5),t,.1);
 F.spray.g.gain.setTargetAtTime(dry?0:cl(speed/60,0,1)*(L.weather==='Extremely Wet'?.42:.28),t,.1);
 F.wind.g.gain.setTargetAtTime(Math.pow(cl(speed/75,0,1.2),2)*(inside?.22:.4),t,.08);F.wind.src.playbackRate.setTargetAtTime(cl(.8+speed/160,.8,1.4),t,.1);F.wf.frequency.setTargetAtTime(inside?2200:7000,t,.1);
 // Gear whine: loudest on the overrun and inside the car.
 const rpm=st?.rpm||IDLE,thr=st?.thr||0;F.w1.frequency.setTargetAtTime(rpm/60*17,t,.015);F.w2.frequency.setTargetAtTime(Math.max(20,Math.abs(x.v||0)*38),t,.02);
 F.wg.gain.setTargetAtTime(x.retired?0:cl(speed/25,0,1)*(.5+.5*(1-thr))*(inside?.045:cam==='chase'?.016:.006),t,.04);
}

/* ---------- Retire the older voices ---------- */
function retireOld(a){
 if(a.__au66done===3)return;let done=0;
 if(!a.__au66g){try{a.gain.disconnect();}catch(e){}try{a.noiseGain.disconnect();}catch(e){}a.__au66g=1;}done++;
 if(a.dc35){if(!a.__au66d){try{a.dc35.eg.disconnect();}catch(e){}try{a.dc35.wg.disconnect();}catch(e){}a.__au66d=1;}done++;}
 if(a.ph47){if(!a.__au66p){for(const k of ['squeal','squeal2','scrape','rumble'])try{a.ph47[k].g.disconnect();}catch(e){}a.__au66p=1;}done++;}
 a.__au66done=done;
}

/* ---------- Crashes ---------- */
let lastCrash=-9,lastHit=0;
function crash(hit){
 const a=dcAudio,c=a?.ctx;if(!c||c.state!=='running'||!S.fx||!S.B||!D.settings.volume||!(hit>=3))return;
 const t=c.currentTime;if(t-lastCrash<.12&&hit<=lastHit*1.3)return;lastCrash=t;lastHit=hit;
 const tier=hit<10?0:hit<24?1:2,buf=S.fx.crash[tier][Math.floor(Math.random()*3)],src=c.createBufferSource(),g=c.createGain();
 src.buffer=buf;src.playbackRate.value=.9+Math.random()*.2;g.gain.value=cl(.35+hit/40,.3,1.25);rawConnect.call(src,g);rawConnect.call(g,S.B.fx);src.start(t);src.onended=()=>{src.disconnect();g.disconnect();};
}
if(typeof ph47Crunch==='function')ph47Crunch=function(hit){if(hit>=6)crash(hit);};
if(typeof rf41ImpactSound==='function')rf41ImpactSound=function(amount){crash(amount);};
window.au56Crash=window.au66Crash=crash;

/* ---------- Settings: sound mix ---------- */
const baseSettings=dcSettingsFields;
dcSettingsFields=function(...args){
 const M=mix(),row=(k,label)=>`<div class="dc-field"><label>${label} · <span>${Math.round((M[k]??1)*100)}%</span></label><input type="range" min="0" max="1.5" step=".05" value="${M[k]??1}" oninput="AU66.setMix('${k}',+this.value);this.previousElementSibling.lastElementChild.textContent=Math.round(this.value*100)+'%'"></div>`;
 return baseSettings(...args)+`<div class="dc-card" style="margin-top:18px"><h3>Sound mix</h3>${row('engine','Your engine')}${row('opp','Other cars')}${row('fx','Tyres, kerbs, wind & crashes')}<p class="dc-muted">Overall loudness is the Volume slider above.</p></div>`;
};
S.setMix=(k,v)=>{mix()[k]=v;try{dcSave();}catch(e){}};
requestAnimationFrame(frame);
})();
