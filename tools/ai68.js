/* AI68 racing line. The old line sat within 2.4 m of the centreline and every car wandered
   around it, so the field drove down the middle of the road. This builds a minimum-curvature
   line for each circuit inside the real track edges: wide on entry, clipping the apex, wide
   on exit, riding the kerbs where a circuit has them (chicanes get straightened over the
   kerbs) and keeping off walls on street tracks. The race AI steers along it and plans its
   speed from the line's own curvature, which is much gentler than the centreline's, so cars
   carry corner speed close to what the tyres allow. The far-away path model uses the same
   line and lap estimate, so cars out of sight lap at the matching pace. */
const AI68={follow:1.2,kink:.5,tightGap:3.6,tightK:1.2,far:1.06,farTrack:{sydney:.969,albert:.963,taupo:.954,symmons:.903,perth:.983,darwin:.951,townsville:.971,ipswich:.959,bend:.977,bathurst:.982,goldcoast:.894,sandown:.949,adelaide:.966,homebush:.958},road:7.0,kerb:8.0,margin:.3,wall:1.2,passes:[[48,40],[24,50],[12,60],[6,70],[3,80],[1,30]]};
// Usable half-width for the car's centre on each side of every centreline sample.
function ai68Bounds(W){
 const N=W.N,w=PH47.width,lo=new Float32Array(N),hi=new Float32Array(N),wl=new Float32Array(N).fill(99),wh=new Float32Array(N).fill(99),kerbs=ph47Kerbs(W),L={e:W.e};
 for(let i=0;i<N;i++){
  // Kerbs flag corners over ±8 samples; let the car put two wheels on them.
  const k=kerbs[i]||kerbs[(i+2)%N]||kerbs[(i-2+N)%N],edge=(k?AI68.kerb:AI68.road)-w-AI68.margin;let a=edge,b=edge;
  try{const wa=ph47WallLane(W,L,{idx:i},{lane:-1}),wb=ph47WallLane(W,L,{idx:i},{lane:1});if(Number.isFinite(wa)){wl[i]=wa;a=Math.min(a,wa-w-AI68.wall);}if(Number.isFinite(wb)){wh[i]=wb;b=Math.min(b,wb-w-AI68.wall);}}catch(e){}
  lo[i]=-Math.max(.5,a);hi[i]=Math.max(.5,b);
 }
 // On the inside of a kink much tighter than the road is wide (Gold Coast's beach chicane) lane
 // offsets fold up and the inside wall sits almost on the apex, so stay within half the radius.
 for(let i=0;i<N;i++){const a=W.samples[(i-4+N)%N],b=W.samples[(i+4)%N],d=a.p.distanceTo(b.p),k=d>.5?dcWrapAngle(Math.atan2(b.v.x,b.v.z)-Math.atan2(a.v.x,a.v.z))/d:0;if(Math.abs(k)<1/30)continue;
  const lim=Math.max(.5,AI68.kink/Math.abs(k));if(k>0)lo[i]=Math.max(lo[i],-lim);else hi[i]=Math.min(hi[i],lim);}
 // Where another part of the circuit runs close by (tight chicanes, hairpins), stay nearer our own
 // centreline than the other road's, or the car's track position would snap onto the other part.
 const S=W.samples,far=Math.max(30,Math.round(60/(W.e.lengthKm*1000/N)));
 for(let i=0;i<N;i++){const p=S[i].p,n=S[i].n,v=S[i].v;
  for(let j=0;j<N;j++){const d=Math.abs(i-j),gap=Math.min(d,N-d);if(gap<far)continue;const dx=S[j].p.x-p.x,dz=S[j].p.z-p.z,al=dx*v.x+dz*v.z;if(Math.abs(al)>10)continue;
   const l=dx*n.x+dz*n.z,lim=Math.max(.5,Math.abs(l)/2-w-.9);if(Math.abs(l)>40)continue;if(l>0)hi[i]=Math.min(hi[i],lim);else lo[i]=Math.max(lo[i],-lim);}}
 return{lo,hi,wl,wh};
}
// K1999-style relaxation (Remi Coulom): each point moves along its normal until its curvature is
// the average of its neighbours' curvatures. That spreads every corner over the most road it can,
// which is what gives the wide entry, apex clip and wide exit. Coarse strides first so the solve
// reaches across whole corners, then fine strides to smooth it.
function ai68Curv3(ax,az,bx,bz,cx,cz){const x1=bx-ax,z1=bz-az,x2=cx-bx,z2=cz-bz,d=Math.hypot(x1,z1)*Math.hypot(x2,z2)*Math.hypot(cx-ax,cz-az);return d>1e-9?2*(x1*z2-z1*x2)/d:0;}
function ai68Solve(W,lo,hi){
 const N=W.N,S=W.samples,o=new Float32Array(N),px=new Float64Array(N),pz=new Float64Array(N),nx=new Float64Array(N),nz=new Float64Array(N);
 for(let i=0;i<N;i++){px[i]=S[i].p.x;pz[i]=S[i].p.z;const l=Math.hypot(S[i].n.x,S[i].n.z)||1;nx[i]=S[i].n.x/l;nz[i]=S[i].n.z/l;}
 const X=i=>px[i]+nx[i]*o[i],Z=i=>pz[i]+nz[i]*o[i],K=(a,b,c)=>ai68Curv3(X(a),Z(a),X(b),Z(b),X(c),Z(c));
 for(const [h,iters] of AI68.passes)for(let it=0;it<iters;it++)for(let i=0;i<N;i++){
  const a=(i-h+N)%N,b=(i+h)%N,aa=(i-2*h+2*N)%N,bb=(i+2*h)%N,target=(K(aa,a,i)+K(i,b,bb))*.5;
  const c0=K(a,i,b),keep=o[i];o[i]=keep+.05;const c1=K(a,i,b);o[i]=keep;const slope=(c1-c0)/.05;
  if(Math.abs(slope)>1e-9)o[i]=clamp(keep+(target-c0)/slope*.9,lo[i],hi[i]);
 }
 // The stride-3 pass runs as three interleaved chains; on long straights with no curvature to
 // anchor them they can settle at different offsets and leave a zig-zag (seen on Newcastle's
 // 1.9 m samples). Wherever the line jumps between neighbouring samples, smooth it locally,
 // within the same road bounds, until it is continuous again.
 for(let pass=0;pass<60;pass++){const mark=new Uint8Array(N);let bad=0;
  for(let i=0;i<N;i++)if(Math.abs(o[i]-o[(i+N-1)%N])>.45){bad++;for(let j=-14;j<=14;j++)mark[(i+j+N)%N]=1;}
  if(!bad)break;const q=Float32Array.from(o);
  for(let i=0;i<N;i++)if(mark[i]){let s=0;for(let j=-3;j<=3;j++)s+=o[(i+j+N)%N];q[i]=clamp(s/7,lo[i],hi[i]);}
  o.set(q);}
 return o;
}
// Signed curvature and segment length of the racing line itself.
function ai68Shape(W,o){
 const N=W.N,S=W.samples,P=i=>{const s=S[(i+N)%N],j=(i+N)%N;return[s.p.x+s.n.x*o[j],s.p.z+s.n.z*o[j]];},k=new Float32Array(N),ds=new Float32Array(N),m=3;
 for(let i=0;i<N;i++){
  const a=P(i-m),c=P(i),b=P(i+m),d=P(i+1),h1=Math.atan2(c[0]-a[0],c[1]-a[1]),h2=Math.atan2(b[0]-c[0],b[1]-c[1]),len=Math.hypot(c[0]-a[0],c[1]-a[1])+Math.hypot(b[0]-c[0],b[1]-c[1]);
  k[i]=len>1?dcWrapAngle(h2-h1)/(len*.5):0;ds[i]=Math.hypot(d[0]-c[0],d[1]-c[1]);
 }
 // Light smoothing for corner speeds (one noisy sample must not set a corner speed); the raw
 // curvature is kept for the sharper corner-speed check.
 const out=new Float32Array(N);for(let i=0;i<N;i++){let n=0;for(let j=-2;j<=2;j++)n+=k[(i+j+N)%N];out[i]=n/5;}
 return{k:out,raw:k,ds};
}
function ai68Build(W){
 if(!W?.samples||!W.N)return;const {lo,hi,wl,wh}=ai68Bounds(W),N=W.N,step=W.e.lengthKm*1000/N;let o=ai68Solve(W,lo,hi);
 // Next to a wall, a car crossing the road at an angle swings its front corner out by its
 // half-length times the sine of that angle: take that off the wall side and solve again.
 const half=2.45,w=PH47.width;let again=false;
 for(let i=0;i<N;i++){const sl=(o[(i+2)%N]-o[(i-2+N)%N])/(4*step),c=1/Math.sqrt(1+sl*sl),reach=w*c+half*Math.abs(sl)*c+AI68.wall*1.5;
  if(wl[i]<90&&-wl[i]+reach>lo[i]){lo[i]=Math.min(-.5,-wl[i]+reach);again=true;}if(wh[i]<90&&wh[i]-reach<hi[i]){hi[i]=Math.max(.5,wh[i]-reach);again=true;}}
 if(again)o=ai68Solve(W,lo,hi);const {k,raw,ds}=ai68Shape(W,o);
 // Where the line runs within a few metres of a wall the AI takes a little speed off, so a car
 // that slides a metre wide (street chicanes) brushes the kerb instead of the concrete.
 const near=new Uint8Array(N),tight=new Uint8Array(N);for(let i=0;i<N;i++){const gap=o[i]<0?wl[i]+o[i]:wh[i]-o[i];if(gap<AI68.tightGap)near[i]=1;}
 for(let i=0;i<N;i++)if(near[i])for(let j=-12;j<=4;j++)tight[(i+j+N)%N]=1;
 const S=W.samples;let centre=0;for(let i=0;i<W.N;i++)centre+=S[i].p.distanceTo(S[(i+1)%W.N].p);const len=ds.reduce((a,b)=>a+b,0);
 W.ai68={line:o,lo,hi,wl,wh,k,raw,ds,tight,len,ratio:len/Math.max(1,centre)};W.racingLine=Array.from(o);W.racingCorridor=.6;W.ai62Lap=null;W.hd64Lap=null;
}
function ai68Index(W,phase){const f=((W.at(phase).t%1)+1)%1*W.N,i=Math.floor(f)%W.N;return{i,j:(i+1)%W.N,u:f-Math.floor(f)};}
function ai68Line(W,phase){const R=W.ai68;if(!R)return 0;const {i,j,u}=ai68Index(W,phase);return R.line[i]+(R.line[j]-R.line[i])*u;}
// Corner-speed curvature: as ai68Curv, raised where the line runs close to a wall.
function ai68CapCurv(W,phase){const R=W.ai68,k=Math.abs(ai68Curv(W,phase));if(!R)return k;return R.tight[ai68Index(W,phase).i]?k*AI68.tightK:k;}
// Racing-line curvature at a lap phase (same sign convention as dcTrackCurvature); raw skips the smoothing.
function ai68Curv(W,phase,raw){const R=W.ai68;if(!R)return dcTrackCurvature(W,phase);const {i,j,u}=ai68Index(W,phase),k=raw?R.raw:R.k;return k[i]+(k[j]-k[i])*u;}
// Keep a planned lane (overtakes, defending, the field bunched into turn 1) on usable road: the
// line's own bounds, which already stay off walls and kerb edges.
function ai68Clamp(W,phase,lane){const R=W?.ai68;if(!R)return clamp(lane,-6,6);const {i}=ai68Index(W,phase);return clamp(lane,R.lo[i],R.hi[i]);}
// Where the driver aims at a lap phase ahead. Close to the line, the planner's small offset
// (each driver's own variation) is carried along the line. Further off it the planner is
// placing the car (overtaking, defending, following traffic) and its lane is held as it is,
// as the old AI did; carrying that offset round a corner put the target off the road.
function ai68Off(W,progress,lane){return Math.abs(lane-ai68Line(W,progress))>AI68.follow;}
function ai68Aim(W,phase,progress,lane){return ai68Clamp(W,phase,ai68Off(W,progress,lane)?lane:lane+ai68Line(W,phase)-ai68Line(W,progress));}
// How far the line moves sideways over the next step, so the planner's lane-change rate limit
// (meant for overtakes) does not stop a car following the line from wide entry to apex. The
// step is in the planner's own progress units (reference-lap phase, not metres): a metres-based
// guess was so loose that cars swung across the road at up to 19 m/s.
function ai68Drift(W,x,dt){const R=W.ai68;if(!R||!live)return 0;const s=W.at(x.progress),step=Math.max(0,x.v||0)/Math.max(5,s.speed)/live.e.realLap*dt;return ai68Line(W,x.progress+step)-ai68Line(W,x.progress);}
// Each driver keeps a slightly different line on the straights; at the apex they all clip it.
const ai68Lane=dcRacingLane;
dcRacingLane=function(W,phase,x){
 if(x?.hd64Def||!W?.ai68)return ai68Lane(W,phase,x);
 const base=ai68Line(W,phase),{i}=ai68Index(W,phase),room=Math.max(0,1-Math.abs(base)/Math.max(.5,base<0?-W.ai68.lo[i]:W.ai68.hi[i])),lap=((phase%1)+1)%1;
 return base+Math.sin((x?.seed||0)+lap*Math.PI*6)*.45*room;
};
// The path model's lap is scaled to the line's quasi-steady lap, times a factor per circuit
// measured against the tyre-model AI (Hard, test day, two laps each), so cars out of sight lap
// within about half a second of the ones around you. Wider clamp than before: some street
// circuits are well off their real lap times on this geometry.
// Some circuits only know where their visible concrete is once the scenery has been built, after
// the track (and its line) was made. Rebuild the line then, with the ideal-line and rubber meshes.
function ai68Refresh(W){
 const R=W?.ai68;if(!R)return;const L={e:W.e};let moved=false;
 try{for(let i=0;i<W.N&&!moved;i++){const a=ph47WallLane(W,L,{idx:i},{lane:-1}),b=ph47WallLane(W,L,{idx:i},{lane:1});moved=Math.abs((Number.isFinite(a)?a:99)-R.wl[i])>.3||Math.abs((Number.isFinite(b)?b:99)-R.wh[i])>.3;}}catch(e){return;}
 if(!moved)return;ai68Build(W);
 if(W.dcIdealRacingLine){W.dcIdealRacingLine.removeFromParent();W.dcIdealRacingLine.geometry?.dispose();W.dcIdealRacingLine=null;dcBuildIdealRacingLine(W);}
 if(W.gx55Line&&typeof gx55UpgradeWorld==='function')gx55UpgradeWorld(W);
}
const ai68Launch=dcLaunch;
dcLaunch=function(...args){
 const r=ai68Launch(...args),L=live,W=sc25Engine;if(L?.dc)ai68Refresh(W);
 if(L?.dc&&W?.ai68&&!(D.settings.ph47Classic||D.settings.ai62Off)){const cache=W.hd64Lap||(W.hd64Lap={}),key=L.e.key+':'+AI62.use;if(!cache[key])cache[key]=ai62LapEstimate(W,L.e);L.ai62Pace=clamp(cache[key]*AI68.far*(AI68.farTrack[L.e.key]||1)/L.e.realLap,.85,1.45);}
 return r;
};
// Path-model cars (far away, formation lap, physics turned off) are placed at a lane offset with
// the centreline's heading. With the full-width line their lane sweeps across the road, so they
// crabbed sideways. Point them where they are actually going: the centreline heading plus the
// angle of their sideways motion, smoothed so it does not twitch.
const ai68Step=dcAIStep;
dcAIStep=function(x,dt){
 const was=x.pos?{x:x.pos.x,z:x.pos.z}:null,r=ai68Step.apply(this,arguments),W=sc25Engine;
 if(x.ai62||x.pitStage||x.garage||!x.pos||!was||!W||!(dt>0))return r;
 const dx=x.pos.x-was.x,dz=x.pos.z-was.z,d=Math.hypot(dx,dz),q=W.at(x.progress),base=Math.atan2(q.v.x,q.v.z);
 const slip=d>.02&&d<Math.max(3,(x.v||0)*dt*3)?clamp(dcWrapAngle(Math.atan2(dx,dz)-base),-.6,.6):0;
 x.ai68Slip=(x.ai68Slip||0)+(slip-(x.ai68Slip||0))*Math.min(1,dt*10);x.yaw=base+x.ai68Slip;
 return r;
};
// Difficulty on the racing line. Hard runs the tyre-model AI at the limit the driver can hold
// (more corner speed than this slid off on Bathurst's mountain in testing);
// the lower tiers give up corner speed and brake earlier.
Object.assign(HD64.tiers.Easy,{corner:.87,dec:.5});
Object.assign(HD64.tiers.Intermediate,{corner:.92,dec:.56});
Object.assign(HD64.tiers.Hard,{corner:.96,dec:.62});
