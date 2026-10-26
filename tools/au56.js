// au56 sound polish: engine pitch from real RPM and gears, tonal tyre squeal, layered crash sounds.
// Replaces the two older engine voices with one V8 (inline six for the BMW) and adds to the ph47 squeal/scrape.
(function(){
const AU56_TOP=[0,65,108,151,196,246,300],AU56_LIMIT=7500,AU56_IDLE=1050;
function au56Audio(){
 const a=dcAudio;if(!a?.ctx||!a.noise?.buffer)return null;if(a.au56)return a.au56;
 const c=a.ctx,out=c.createGain();out.gain.value=1;out.connect(c.destination);
 // Retire the old engine voices; the gearbox whine and road noise stay.
 try{a.gain.disconnect();}catch(e){}try{a.dc35?.eg.disconnect();}catch(e){}
 const osc=(type,detune=0)=>{const o=c.createOscillator();o.type=type;o.detune.value=detune;o.start();return o;};
 const curve=new Float32Array(1024);for(let i=0;i<1024;i++){const v=i/511.5-1;curve[i]=Math.tanh(v*2.4)/Math.tanh(2.4);}
 const fire=osc('sawtooth'),sub=osc('square'),hi=osc('sawtooth',7),mix=c.createGain(),subG=c.createGain(),hiG=c.createGain(),shape=c.createWaveShaper(),body=c.createBiquadFilter(),res=c.createBiquadFilter(),eng=c.createGain();
 subG.gain.value=.55;hiG.gain.value=.28;fire.connect(mix);sub.connect(subG);subG.connect(mix);hi.connect(hiG);hiG.connect(mix);
 shape.curve=curve;shape.oversample='2x';body.type='lowpass';body.Q.value=1.4;res.type='peaking';res.Q.value=2.2;res.gain.value=6;
 mix.connect(shape);shape.connect(body);body.connect(res);res.connect(eng);eng.gain.value=0;eng.connect(out);
 // Intake roar: noise tuned to the engine order, opens with throttle.
 const ns=c.createBufferSource(),nf=c.createBiquadFilter(),ng=c.createGain();ns.buffer=a.noise.buffer;ns.loop=true;nf.type='bandpass';nf.Q.value=3;ng.gain.value=0;ns.connect(nf);nf.connect(ng);ng.connect(out);ns.start();
 // Tonal tyre squeal with a wobble, sits on top of the ph47 noise squeal.
 const sq1=osc('triangle'),sq2=osc('sine'),lfo=osc('sine'),lfoG=c.createGain(),sqG=c.createGain(),sqF=c.createBiquadFilter();
 lfo.frequency.value=7.5;lfoG.gain.value=28;lfo.connect(lfoG);lfoG.connect(sq1.frequency);lfoG.connect(sq2.frequency);
 sq1.frequency.value=820;sq2.frequency.value=1240;sqF.type='bandpass';sqF.frequency.value=1000;sqF.Q.value=1.2;sq1.connect(sqF);sq2.connect(sqF);sqF.connect(sqG);sqG.gain.value=0;sqG.connect(out);
 return a.au56={out,fire,sub,hi,body,res,eng,nf,ng,sq1,sq2,sqG,lfo,rpm:AU56_IDLE,gear:1,shiftAt:-9,limitPhase:0,popAt:0,lastCrash:-9,lastHit:0};
}
function au56Rpm(x,s,dt){
 const g=dcGear(x),speed=Math.abs(x.speed||0),thr=x.throttle||0;let target;
 if(g==='N'||g==='R'){target=g==='R'?AU56_IDLE+speed/25*AU56_LIMIT*.8:AU56_IDLE+thr*5200;}
 else{const n=+g||1;target=speed/AU56_TOP[n]*(AU56_LIMIT-150);if(n===1&&speed<30)target=Math.max(target,AU56_IDLE+thr*(3600-speed*40));}
 target=clamp(Math.max(target,AU56_IDLE),AU56_IDLE,AU56_LIMIT);
 const rate=target>s.rpm?9:14;s.rpm+=(target-s.rpm)*Math.min(1,dt*rate);return g;
}
function au56Pop(s,c,vol,big){
 const t=c.currentTime,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=dcAudio.noise.buffer;
 f.type='bandpass';f.frequency.value=big?260:420+Math.random()*500;f.Q.value=.9;g.gain.setValueAtTime(vol*(big?.11:.05),t);g.gain.exponentialRampToValueAtTime(.0001,t+(big?.12:.05));
 src.connect(f);f.connect(g);g.connect(s.out);src.start(t,Math.random()*1.5);src.stop(t+.14);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
}
let au56Last=0;
const au56Sound=dcUpdateSound;
dcUpdateSound=function(){
 au56Sound();const L=live,x=L?.player,s=au56Audio();if(!s||!x)return;
 const c=dcAudio.ctx,t=c.currentTime,now=performance.now(),dt=clamp((now-(au56Last||now))/1000,0,.1);au56Last=now;
 const muted=L.paused||dcSimBusy||x.retired,vol=muted?0:D.settings.volume||0,thr=clamp(x.throttle||0,0,1),g=au56Rpm(x,s,dt);
 const n=+g||0;if(n&&n!==s.gear){if(n>s.gear){s.shiftAt=t;au56Pop(s,c,vol,true);}s.gear=n;}
 const order=x.team?.manufacturer==='BMW'?3:4,cut=t-s.shiftAt<.08?.18:1;
 let limit=1;if(s.rpm>AU56_LIMIT-120&&thr>.8){s.limitPhase+=dt*22;limit=Math.sin(s.limitPhase*Math.PI)>0?1:.35;}
 const f=s.rpm/60*order,load=.35+thr*.65;
 s.fire.frequency.setTargetAtTime(f,t,.02);s.sub.frequency.setTargetAtTime(f/2,t,.02);s.hi.frequency.setTargetAtTime(f*2,t,.02);
 s.body.frequency.setTargetAtTime(380+thr*2600+s.rpm*.22,t,.05);s.res.frequency.setTargetAtTime(f*2.5,t,.05);
 s.eng.gain.setTargetAtTime(vol*(.022+load*.05)*cut*limit,t,.018);
 s.nf.frequency.setTargetAtTime(f*3,t,.04);s.ng.gain.setTargetAtTime(vol*thr*(.012+s.rpm/AU56_LIMIT*.03)*cut,t,.04);
 // Overrun crackle when lifting at high revs.
 if(vol&&thr<.08&&s.rpm>3800&&now>s.popAt){s.popAt=now+60+Math.random()*220;if(Math.random()<.55)au56Pop(s,c,vol,false);}
 // Tonal squeal follows the same slide measure as ph47, falls back to sideways speed on classic handling.
 const p=x.ph47,speed=Math.hypot(x.v||0,x.latV||0),road=p?p.wheels.some(w=>w.kind!=='grass'):true;
 const slide=p&&x.ph47On?clamp(p.slideF*4+p.slideR*5+(p.lockF||p.lockR?.55:0)+p.spin*.6,0,1):clamp(Math.abs(x.latV||0)/6,0,1);
 const sq=road&&speed>5&&L.weather==='Dry'?Math.pow(slide,1.4):0,lock=p&&(p.lockF||p.lockR)?1:0;
 s.sq1.frequency.setTargetAtTime(760+sq*220+lock*260+speed*2,t,.06);s.sq2.frequency.setTargetAtTime(1180+sq*300+lock*420,t,.06);
 s.lfo.frequency.setTargetAtTime(6+sq*5,t,.1);s.sqG.gain.setTargetAtTime(vol*sq*.028,t,.04);
};
// Crash: low body thud, metal clang and a debris burst, scaled by impact size.
function au56Crash(hit){
 const a=dcAudio,s=au56Audio();if(!s||a.ctx.state!=='running'||!D.settings.volume||hit<3)return;
 const c=a.ctx,t=c.currentTime;if(t-s.lastCrash<.09&&hit<=s.lastHit*1.3)return;s.lastCrash=t;s.lastHit=hit;
 const v=D.settings.volume,k=clamp(hit/40,0,1),end=[];
 const thud=c.createOscillator(),tg=c.createGain();thud.type='sine';thud.frequency.setValueAtTime(95+k*30,t);thud.frequency.exponentialRampToValueAtTime(32,t+.3+k*.2);
 tg.gain.setValueAtTime(v*(.12+k*.28),t);tg.gain.exponentialRampToValueAtTime(.0001,t+.35+k*.3);thud.connect(tg);tg.connect(s.out);end.push(thud,tg);
 if(hit>=8)for(const r of [1,2.76,5.4,8.9]){const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=(210+Math.random()*90)*r;
  g.gain.setValueAtTime(v*(.012+k*.03)/r,t);g.gain.exponentialRampToValueAtTime(.0001,t+.12+k*.45/r);o.connect(g);g.connect(s.out);o.start(t);o.stop(t+.7);end.push(o,g);}
 const n=c.createBufferSource(),nf=c.createBiquadFilter(),ng=c.createGain();n.buffer=a.noise.buffer;nf.type='highpass';nf.frequency.value=900+k*1500;
 ng.gain.setValueAtTime(v*(.05+k*.12),t);ng.gain.exponentialRampToValueAtTime(.0001,t+.25+k*.5);n.connect(nf);nf.connect(ng);ng.connect(s.out);end.push(n,nf,ng);
 // Rattle of loose panels after a big one.
 if(hit>=18)for(let i=0;i<5;i++){const d=t+.12+i*(.05+Math.random()*.07),b=c.createBufferSource(),bf=c.createBiquadFilter(),bg=c.createGain();b.buffer=a.noise.buffer;bf.type='bandpass';bf.frequency.value=1800+Math.random()*2500;bf.Q.value=4;
  bg.gain.setValueAtTime(0,t);bg.gain.setValueAtTime(v*.05*(1-i/6),d);bg.gain.exponentialRampToValueAtTime(.0001,d+.06);b.connect(bf);bf.connect(bg);bg.connect(s.out);b.start(d,Math.random());b.stop(d+.08);end.push(b,bf,bg);}
 thud.start(t);thud.stop(t+.8);n.start(t,Math.random()*1.2);n.stop(t+.8);
 setTimeout(()=>end.forEach(o=>{try{o.disconnect();}catch(e){}}),1600);
}
if(typeof ph47Crunch==='function')ph47Crunch=function(hit){if(hit>=6)au56Crash(hit);};
const au56Impact=rf41ImpactSound;
rf41ImpactSound=function(amount){au56Impact(amount);au56Crash(amount);};
window.au56Crash=au56Crash;
})();
