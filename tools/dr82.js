/* dr82: your career driver in 3D, a My Driver creator in Career HQ, and four cut scenes.
   Riley: "how could we make it so you can make and edit a character in career mode ... so we can make
   3d cut scenes of lifting a trophy etc". Riley picked "Driver + all 4 scenes".
   - My Driver (Career HQ, under Personal): name, nationality, age, hometown; skin tone, build, hair,
     hair colour, facial hair; helmet design (pattern, three colours, visor); race suit (team colours or
     your own). A live 3D preview turns on a stand, helmet on or off. Everything saves in the career
     (D.dr82) and can be changed any time. Existing saves get a default driver in their team colours.
   - Cut scenes (each one can be turned off on the My Driver page, and A / Enter / Esc skips):
     1. Pre-race walk-in: before each race, during the circuit intro, you walk to your car and climb in.
     2. Win celebration: win a race, park in your bay on the cool-down lap, press A: you climb onto the
        roof, punch the air and take your helmet off.
     3. Podium: finish in the top three: the top three walk out, lift their trophies and spray champagne.
     4. Championship: win the title at the last round: trophy lift with confetti and fireworks.
   - Your helmet design is also what you see on the driver inside your car.
   Embedded last by tools/build_dr82.py. Everything is wrapped so a cut scene problem never blocks a race. */
(()=>{
'use strict';
if(typeof THREE!=='object')return;
const T=THREE;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,k)=>a+(b-a)*k;
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const seg=(t,a,b)=>ease((t-a)/(b-a));
const DR={busy:false,seek:null};window.DR82=DR;
const hasCareer=()=>typeof D!=='undefined'&&D&&D.world&&!(typeof IR!=='undefined'&&IR.active);

/* ---------- Options ---------- */
const PALETTE=['#e10600','#ff6a00','#ffc400','#f5f5f0','#c9ccd1','#6b7178','#16181c','#0a2a6b','#1f6fe0','#29b6f6','#00897b','#1fa64a','#8bc34a','#6a1b9a','#e91e8c','#8d5a2b'];
const SKIN=['#f3d3bd','#e6b896','#c99a7c','#a8714f','#7d4f33','#4f3020'];
const HAIRC=['#1b1410','#3b2617','#6b4423','#a8743c','#d9b56a','#b5452a','#8c8c8c','#eeeeee'];
const HAIR=['Short','Buzz cut','Swept back','Long','Curly','Bald'];
const BEARD=['Clean shaven','Stubble','Moustache','Goatee','Full beard'];
const PATTERN=['Stripes','Halo','Flames','Chequered','Split','Stars','Arrows'];
const VISOR=[['Smoke','#15181c',.55],['Iridium blue','#1d5fd8',.85],['Gold','#d8a42a',.9],['Clear','#8fa2ad',.2]];
const BUILD=['Slim','Regular','Strong'];
const NATIONS=[['AUS','Australia'],['NZL','New Zealand'],['GBR','Great Britain'],['IRL','Ireland'],['USA','United States'],['CAN','Canada'],['DEU','Germany'],['FRA','France'],['ITA','Italy'],['NLD','Netherlands'],['BEL','Belgium'],['ESP','Spain'],['JPN','Japan'],['BRA','Brazil'],['ZAF','South Africa'],['SWE','Sweden']];
const SCENES=[['walk','Pre-race walk-in'],['win','Win celebration'],['podium','Podium'],['champ','Championship']];

/* ---------- Flags (canvas, so they look the same in Edge on Xbox, which has no flag emoji) ---------- */
function star(g,cx,cy,r,n=5,inner=.42){g.beginPath();for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,q=i%2?r*inner:r;g.lineTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q);}g.closePath();g.fill();}
function unionJack(g,x,y,w,h){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle='#012169';g.fillRect(x,y,w,h);
 const line=(c,lw,pts)=>{g.strokeStyle=c;g.lineWidth=lw;g.beginPath();g.moveTo(pts[0],pts[1]);g.lineTo(pts[2],pts[3]);g.stroke();};
 line('#fff',h*.2,[x,y,x+w,y+h]);line('#fff',h*.2,[x+w,y,x,y+h]);line('#c8102e',h*.07,[x,y,x+w,y+h]);line('#c8102e',h*.07,[x+w,y,x,y+h]);
 g.fillStyle='#fff';g.fillRect(x+w/2-h*.17,y,h*.34,h);g.fillRect(x,y+h/2-h*.17,w,h*.34);g.fillStyle='#c8102e';g.fillRect(x+w/2-h*.1,y,h*.2,h);g.fillRect(x,y+h/2-h*.1,w,h*.2);g.restore();}
function bands(g,x,y,w,h,cols,vertical){cols.forEach((c,i)=>{g.fillStyle=c;if(vertical)g.fillRect(x+w*i/cols.length,y,w/cols.length+1,h);else g.fillRect(x,y+h*i/cols.length,w,h/cols.length+1);});}
function drawFlag(g,code,x,y,w,h){
 g.save();
 switch(code){
 case 'AUS':g.fillStyle='#012169';g.fillRect(x,y,w,h);unionJack(g,x,y,w/2,h/2);g.fillStyle='#fff';star(g,x+w*.25,y+h*.75,h*.13,7,.5);
  [[.75,.25],[.62,.5],[.88,.43],[.75,.84],[.81,.6]].forEach(([a,b],i)=>star(g,x+w*a,y+h*b,h*(i===4?.04:.07),i===4?5:7,.5));break;
 case 'NZL':g.fillStyle='#012169';g.fillRect(x,y,w,h);unionJack(g,x,y,w/2,h/2);[[.75,.22],[.64,.47],[.86,.42],[.75,.82]].forEach(([a,b])=>{g.fillStyle='#fff';star(g,x+w*a,y+h*b,h*.09);g.fillStyle='#c8102e';star(g,x+w*a,y+h*b,h*.06);});break;
 case 'GBR':unionJack(g,x,y,w,h);break;
 case 'IRL':bands(g,x,y,w,h,['#169b62','#fff','#ff883e'],true);break;
 case 'USA':for(let i=0;i<13;i++){g.fillStyle=i%2?'#fff':'#b22234';g.fillRect(x,y+h*i/13,w,h/13+1);}g.fillStyle='#3c3b6e';g.fillRect(x,y,w*.42,h*7/13);g.fillStyle='#fff';for(let r=0;r<4;r++)for(let c=0;c<5;c++)star(g,x+w*.05+c*w*.08,y+h*.08+r*h*.12,h*.035);break;
 case 'CAN':bands(g,x,y,w,h,['#d52b1e','#fff','#fff','#d52b1e'],true);g.fillStyle='#d52b1e';star(g,x+w/2,y+h*.5,h*.3,7,.55);g.fillRect(x+w/2-h*.02,y+h*.6,h*.04,h*.2);break;
 case 'DEU':bands(g,x,y,w,h,['#000','#dd0000','#ffce00']);break;
 case 'FRA':bands(g,x,y,w,h,['#0055a4','#fff','#ef4135'],true);break;
 case 'ITA':bands(g,x,y,w,h,['#009246','#fff','#ce2b37'],true);break;
 case 'NLD':bands(g,x,y,w,h,['#ae1c28','#fff','#21468b']);break;
 case 'BEL':bands(g,x,y,w,h,['#000','#fdda24','#ef3340'],true);break;
 case 'ESP':bands(g,x,y,w,h,['#aa151b','#f1bf00','#f1bf00','#aa151b']);break;
 case 'JPN':g.fillStyle='#fff';g.fillRect(x,y,w,h);g.fillStyle='#bc002d';g.beginPath();g.arc(x+w/2,y+h/2,h*.3,0,7);g.fill();break;
 case 'BRA':g.fillStyle='#009c3b';g.fillRect(x,y,w,h);g.fillStyle='#ffdf00';g.beginPath();g.moveTo(x+w*.08,y+h/2);g.lineTo(x+w/2,y+h*.1);g.lineTo(x+w*.92,y+h/2);g.lineTo(x+w/2,y+h*.9);g.fill();g.fillStyle='#002776';g.beginPath();g.arc(x+w/2,y+h/2,h*.22,0,7);g.fill();break;
 case 'ZAF':bands(g,x,y,w,h,['#e03c31','#e03c31','#001489','#001489']);g.fillStyle='#fff';g.fillRect(x,y+h*.36,w,h*.28);g.fillStyle='#007749';g.fillRect(x,y+h*.42,w,h*.16);g.fillStyle='#fff';g.beginPath();g.moveTo(x,y);g.lineTo(x+w*.42,y+h/2);g.lineTo(x,y+h);g.fill();g.fillStyle='#007749';g.beginPath();g.moveTo(x,y+h*.08);g.lineTo(x+w*.34,y+h/2);g.lineTo(x,y+h*.92);g.fill();g.fillStyle='#ffb612';g.beginPath();g.moveTo(x,y+h*.22);g.lineTo(x+w*.22,y+h/2);g.lineTo(x,y+h*.78);g.fill();g.fillStyle='#000';g.beginPath();g.moveTo(x,y+h*.3);g.lineTo(x+w*.16,y+h/2);g.lineTo(x,y+h*.7);g.fill();break;
 case 'SWE':g.fillStyle='#006aa7';g.fillRect(x,y,w,h);g.fillStyle='#fecc00';g.fillRect(x+w*.31,y,h*.2,h);g.fillRect(x,y+h*.4,w,h*.2);break;
 default:g.fillStyle='#888';g.fillRect(x,y,w,h);}
 g.restore();}
const flagCache={};
function flagUrl(code){if(flagCache[code])return flagCache[code];const c=document.createElement('canvas');c.width=60;c.height=36;const g=c.getContext('2d');drawFlag(g,code,0,0,60,36);g.strokeStyle='#0005';g.lineWidth=2;g.strokeRect(1,1,58,34);return flagCache[code]=c.toDataURL();}
const flagImg=(code,h=18)=>`<img class="dr82-flag" src="${flagUrl(code)}" alt="${esc(code)}" style="height:${h}px;width:${h*5/3}px">`;

/* ---------- The career driver's look ---------- */
function teamOf(d){try{return D.world.teams.find(t=>t.drivers.some(x=>x.id===d.id))||null;}catch(_){return null;}}
function teamCols(t){const l=t?.livery||{};return {main:l.primary||'#1f2a44',accent:l.secondary||'#e10600',third:l.tertiary||'#f5f5f0'};}
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function defaults(p,t){const c=teamCols(t),parts=String(p?.name||'Driver').trim().split(/\s+/),h=hash(p?.id??p?.name);
 return {first:parts.slice(0,-1).join(' ')||parts[0],last:parts.length>1?parts[parts.length-1]:'',nation:'AUS',skin:h%4,build:1,hair:h%3,hairColor:(h>>3)%4,beard:0,
  helmet:{pattern:(h>>5)%PATTERN.length,base:c.third,a1:c.accent,a2:c.main,visor:0},suit:{mode:'team',main:c.main,accent:c.accent,gloves:'#16181c'},scenes:{walk:true,win:true,podium:true,champ:true}};}
function me(){if(!hasCareer())return null;const p=dcPlayer(),t=dcTeam();if(!D.dr82)D.dr82=defaults(p,t);
 const d=D.dr82,def=defaults(p,t);for(const k in def)if(d[k]===undefined)d[k]=def[k];for(const k of ['helmet','suit','scenes'])for(const j in def[k])if(d[k][j]===undefined)d[k][j]=def[k][j];return d;}
// A look for anyone on the grid: you get your own, everyone else a fixed one from their team colours.
function lookFor(d,team){
 if(hasCareer()&&d&&d.id===D.pid){const m=me(),c=teamCols(team||dcTeam());return {...m,suitCols:m.suit.mode==='team'?{main:c.main,accent:c.accent,gloves:m.suit.gloves}:m.suit,number:dcPlayer().number,me:true};}
 const t=team||teamOf(d),c=teamCols(t),h=hash(d?.id??d?.name);
 return {first:'',last:String(d?.name||'').split(/\s+/).pop(),nation:'AUS',skin:h%5,build:h%3,hair:(h>>2)%6,hairColor:(h>>5)%7,beard:(h>>8)%5,
  helmet:{pattern:(h>>11)%PATTERN.length,base:[c.third,c.accent,'#f5f5f0'][(h>>14)%3],a1:c.main,a2:c.accent,visor:(h>>16)%4},suitCols:{main:c.main,accent:c.accent,gloves:'#16181c'},number:d?.number,me:false};}

/* ---------- Textures ---------- */
function tex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
// Helmet canvas is the sphere's UV: front of the helmet at x = w/4, back at 3w/4, crown at the top.
function helmetTex(L){const H=L.helmet;return tex(1024,512,(g,w,h)=>{
 g.fillStyle=H.base;g.fillRect(0,0,w,h);const F=w/4,B=3*w/4;
 const both=(fn)=>{fn(0);fn(w);fn(-w);};
 switch(PATTERN[H.pattern]){
 case 'Stripes':for(const cx of [F,B])both(o=>{g.fillStyle=H.a1;g.fillRect(o+cx-46,0,92,330);g.fillStyle=H.a2;g.fillRect(o+cx-14,0,28,330);});break;
 case 'Halo':g.fillStyle=H.a1;g.fillRect(0,120,w,70);g.fillStyle=H.a2;g.fillRect(0,196,w,16);g.fillRect(0,0,w,44);break;
 case 'Flames':{g.fillStyle=H.a2;g.fillRect(0,300,w,212);for(const dir of [1,-1])for(let i=0;i<9;i++){const s0=i/9;both(o=>{const x0=o+F+dir*s0*512;g.fillStyle=i%2?H.a1:H.a2;g.beginPath();g.moveTo(x0,320);g.quadraticCurveTo(x0+dir*30,250-i*6,x0+dir*90,170+(i%3)*30);g.quadraticCurveTo(x0+dir*60,250,x0+dir*110,320);g.closePath();g.fill();});}
  g.fillStyle=H.a1;g.fillRect(0,300,w,18);break;}
 case 'Chequered':for(let y=110;y<230;y+=40)for(let x=0;x<w;x+=40)if(((x+y)/40)%2<1){g.fillStyle=H.a1;g.fillRect(x,y,40,40);}g.fillStyle=H.a2;g.fillRect(0,230,w,14);g.fillRect(0,96,w,14);break;
 case 'Split':g.fillStyle=H.a1;g.fillRect(F,0,B-F,h);g.fillStyle=H.a2;g.fillRect(0,0,w,56);g.fillRect(F-8,0,16,h);g.fillRect(B-8,0,16,h);break;
 case 'Stars':{const r=n=>((hash(n+H.a1)%1000)/1000);for(let i=0;i<26;i++){const x=r('x'+i)*w,y=20+r('y'+i)*250,s=14+r('s'+i)*20;g.fillStyle=H.a2;star(g,x,y,s*1.25);g.fillStyle=H.a1;star(g,x,y,s);}break;}
 case 'Arrows':for(let i=0;i<4;i++)for(const cx of [F])both(o=>{g.fillStyle=i%2?H.a2:H.a1;g.beginPath();const y=40+i*62;g.moveTo(o+cx,y);g.lineTo(o+cx+180,y+70);g.lineTo(o+cx+180,y+104);g.lineTo(o+cx,y+34);g.lineTo(o+cx-180,y+104);g.lineTo(o+cx-180,y+70);g.closePath();g.fill();});break;}
 // Brim stripe, the race number on the back, the surname on both sides.
 g.fillStyle=H.a2;g.fillRect(0,330,w,10);g.fillStyle='#111';g.fillRect(0,340,w,172);
 g.font='900 64px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=8;g.strokeStyle='#000a';g.fillStyle='#fff';
 if(L.number!=null){g.strokeText('#'+L.number,B,270);g.fillText('#'+L.number,B,270);}
 const name=String(L.last||'').toUpperCase().slice(0,12);g.font='800 34px Arial, sans-serif';g.lineWidth=6;
 for(const x of [w/2,0,w]){g.strokeText(name,x,300);g.fillText(name,x,300);}
});}
// Torso: the capsule is turned so its UV seam sits at the back; front = w/2, right side = w/4, left = 3w/4.
function torsoTex(L){const c=L.suitCols;return tex(512,256,(g,w,h)=>{
 g.fillStyle=c.main;g.fillRect(0,0,w,h);
 g.fillStyle=c.accent;g.fillRect(0,0,w,44);g.fillRect(w/4-26,0,52,h);g.fillRect(3*w/4-26,0,52,h);
 g.fillStyle='#ffffffcc';g.fillRect(0,44,w,4);g.fillRect(w/4-30,0,4,h);g.fillRect(w/4+26,0,4,h);g.fillRect(3*w/4-30,0,4,h);g.fillRect(3*w/4+26,0,4,h);
 // Chest sponsor patch and a flag on the left chest.
 g.fillStyle='#fff';g.fillRect(w/2-40,96,80,30);g.fillStyle=c.main;g.font='900 20px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(String(L.number??'').slice(0,4),w/2,112);
 drawFlag(g,L.nation||'AUS',w/2+50,64,34,20);
 g.fillStyle='#fff';g.font='900 26px Arial';const n=String(L.last||'').toUpperCase().slice(0,12);g.fillText(n,0,90);g.fillText(n,w,90);
 g.fillStyle='#0004';g.fillRect(0,h-26,w,26);});}
function limbTex(L,cuff){const c=L.suitCols;return tex(128,128,(g,w,h)=>{g.fillStyle=c.main;g.fillRect(0,0,w,h);g.fillStyle=c.accent;
 if(cuff){g.fillRect(0,h-22,w,22);g.fillRect(3*w/4-8,0,16,h);}else{g.fillRect(w/4-9,0,18,h);g.fillRect(3*w/4-9,0,18,h);}g.fillStyle='#fff9';g.fillRect(w/4-12,0,3,h);g.fillRect(3*w/4+9,0,3,h);});}
function stdMat(color,o={}){return new T.MeshStandardMaterial(Object.assign({color,roughness:.62,metalness:0},o));}

/* ---------- The 3D driver ---------- */
const HIPY=.98;
function buildDriver(L){
 const bw=[.92,1,1.1][L.build??1],root=new T.Group(),J={sh:{},el:{},wr:{},hip:{},knee:{},ank:{},grip:{}},mats=[],geos=[],texs=[];
 const keep=(m)=>{mats.push(m);if(m.map)texs.push(m.map);return m;};
 const mesh=(geo,mat,parent,x=0,y=0,z=0)=>{geos.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const cap=(r,l)=>new T.CapsuleGeometry(r,l,6,14);
 const sc=L.suitCols,suit=keep(stdMat('#fff',{map:torsoTex(L),roughness:.7})),legM=keep(stdMat('#fff',{map:limbTex(L,false),roughness:.72})),armM=keep(stdMat('#fff',{map:limbTex(L,true),roughness:.72}));
 const glove=keep(stdMat(sc.gloves||'#16181c',{roughness:.8})),boot=keep(stdMat('#121316',{roughness:.5})),bootTrim=keep(stdMat(sc.accent,{roughness:.5})),skin=keep(stdMat(SKIN[L.skin]||SKIN[2],{roughness:.55})),
  hairM=keep(stdMat(HAIRC[L.hairColor]||HAIRC[1],{roughness:.85})),dark=keep(stdMat('#1a1c20',{roughness:.6})),white=keep(stdMat('#f4f4f2',{roughness:.4})),accent=keep(stdMat(sc.accent,{roughness:.6})),balaclava=keep(stdMat('#22252a',{roughness:.9}));
 const hips=new T.Group();hips.position.y=HIPY;root.add(hips);J.hips=hips;
 const plain=keep(stdMat(sc.main,{roughness:.72}));mesh(new T.SphereGeometry(.16,18,12),plain,hips).scale.set(1.05*bw,.62,.72);
 const belt=mesh(new T.CylinderGeometry(.165,.165,.05,20),accent,hips,0,.07,0);belt.scale.set(1.08*bw,1,.72);
 const spine=new T.Group();spine.position.y=.06;hips.add(spine);J.spine=spine;
 const prof=[[0,-.08],[.13,-.07],[.145,0],[.15,.1],[.163,.22],[.178,.33],[.176,.42],[.155,.48],[.1,.53],[.04,.545],[0,.55]].map(([x,y])=>new T.Vector2(x,y));
 const torso=mesh(new T.LatheGeometry(prof,28),suit,spine,0,0,0);torso.scale.set(1.12*bw,1,.66);torso.rotation.y=Math.PI;
 const chest=new T.Group();chest.position.y=.44;spine.add(chest);J.chest=chest;
 mesh(new T.CylinderGeometry(.068,.075,.06,16),accent,chest,0,.035,0);
 const neck=new T.Group();neck.position.y=.06;chest.add(neck);J.neck=neck;
 const neckMesh=mesh(new T.CylinderGeometry(.048,.052,.11,12),skin,neck,0,.04,0);
 const head=new T.Group();head.position.y=.1;neck.add(head);J.head=head;
 // Face and hair (seen once the helmet comes off).
 const face=new T.Group();head.add(face);J.face=face;
 mesh(new T.SphereGeometry(.1,24,18),skin,face,0,.06,0).scale.set(.88,1.14,.98);
 mesh(new T.SphereGeometry(.07,16,10),skin,face,0,.018,.012).scale.set(1,.9,1); // jaw
 for(const s of [-1,1]){mesh(new T.SphereGeometry(.022,8,6),skin,face,s*.088,.06,-.005).scale.set(.5,1,.8);
  mesh(new T.SphereGeometry(.012,10,8),white,face,s*.033,.075,.083).scale.set(1.15,.8,.6);mesh(new T.SphereGeometry(.0065,8,6),dark,face,s*.033,.074,.089);
  const brow=mesh(new T.BoxGeometry(.034,.007,.01),hairM,face,s*.035,.098,.09);brow.rotation.z=s*.12;}
 mesh(new T.ConeGeometry(.014,.04,8),skin,face,0,.052,.1).rotation.x=Math.PI/2;
 const mouth=mesh(new T.BoxGeometry(.036,.005,.008),keep(stdMat('#8a4a44')),face,0,.018,.088);mouth.scale.y=1.2;
 const hairStyle=HAIR[L.hair]||'Short';
 if(hairStyle!=='Bald'){const k=hairStyle==='Buzz cut'?.004:.012;
  const capG=new T.SphereGeometry(.1+k,24,14,0,Math.PI*2,0,Math.PI*.42);const cp=mesh(capG,hairM,face,0,.072,-.006);cp.scale.set(.93,1.12,1.04);cp.rotation.x=-.22;
  if(hairStyle==='Swept back'){mesh(new T.SphereGeometry(.07,14,10),hairM,face,0,.15,-.03).scale.set(1.25,.6,1.4);}
  if(hairStyle==='Long'){mesh(new T.SphereGeometry(.1,16,12),hairM,face,0,.02,-.045).scale.set(.98,1.25,.62);}
  if(hairStyle==='Curly'){const g=new T.SphereGeometry(.03,8,6);for(let i=0;i<34;i++){const a=i*2.399,y=.13-(i/34)*.09,r=.07+(i/34)*.025;const m=mesh(g,hairM,face,Math.cos(a)*r,y+.03,Math.sin(a)*r*.9-.015);m.scale.setScalar(.9+(i%3)*.15);}geos.pop();geos.push(g);}}
 const beard=BEARD[L.beard]||'Clean shaven';
 if(beard==='Stubble'){mesh(new T.SphereGeometry(.071,16,10,0,Math.PI*2,Math.PI*.45,Math.PI*.55),keep(stdMat(HAIRC[L.hairColor]||'#333',{transparent:true,opacity:.35,roughness:1})),face,0,.003,.026).scale.set(1.02,.82,1.07);}
 if(beard==='Full beard'){mesh(new T.SphereGeometry(.073,16,10,0,Math.PI*2,Math.PI*.42,Math.PI*.58),hairM,face,0,.004,.026).scale.set(1.03,.88,1.08);}
 if(beard==='Moustache'||beard==='Goatee'||beard==='Full beard')mesh(new T.BoxGeometry(.05,.012,.014),hairM,face,0,.032,.092);
 if(beard==='Goatee')mesh(new T.SphereGeometry(.022,10,8),hairM,face,0,-.04,.07).scale.set(1,1.3,.8);
 // Helmet.
 const helmet=new T.Group();head.add(helmet);J.helmet=helmet;
 const hTex=helmetTex(L),shell=keep(stdMat('#fff',{map:hTex,roughness:.22,metalness:.12}));
 mesh(new T.SphereGeometry(.135,32,22),shell,helmet,0,.07,0).scale.set(1,1.07,1.12);
 const [vn,vc,vm]=VISOR[L.helmet.visor]||VISOR[0],visor=keep(stdMat(vc,{roughness:.08,metalness:vm,envMapIntensity:1.6}));
 mesh(new T.SphereGeometry(.139,28,12,Math.PI/2-.82,1.64,Math.PI*.36,Math.PI*.17),visor,helmet,0,.07,0).scale.set(1,1.07,1.12);
 mesh(new T.CylinderGeometry(.11,.118,.05,20),keep(stdMat('#111',{roughness:.5})),helmet,0,-.05,-.005).scale.set(1,1,1.08);
 mesh(new T.BoxGeometry(.11,.025,.03),keep(stdMat(L.helmet.a2,{roughness:.3})),helmet,0,.205,-.11).rotation.x=.5; // spoiler
 J.balaclava=balaclava;J.neckMesh=neckMesh;J.skin=skin;
 // Arms: Euler XZY so a shoulder can twist (y) before it swings out (z) and forward (x).
 for(const s of ['L','R']){const sx=s==='L'?1:-1;
  const sh=new T.Group();sh.rotation.order='XZY';sh.position.set(sx*.19*bw,-.01,0);chest.add(sh);J.sh[s]=sh;
  mesh(new T.SphereGeometry(.068*bw,12,10),armM,sh).scale.set(1,.9,.9);
  mesh(cap(.056*bw,.2),armM,sh,0,-.15,0).rotation.y=Math.PI;
  const el=new T.Group();el.position.y=-.29;sh.add(el);J.el[s]=el;mesh(new T.SphereGeometry(.05*bw,10,8),armM,el);
  mesh(cap(.05*bw,.19),armM,el,0,-.13,0).rotation.y=Math.PI;
  const wr=new T.Group();wr.position.y=-.26;el.add(wr);J.wr[s]=wr;
  mesh(new T.SphereGeometry(.05,12,10),glove,wr,0,-.045,.005).scale.set(.85,1.15,.68);
  mesh(new T.SphereGeometry(.02,8,6),glove,wr,sx*-.035,-.03,.03); // thumb
  const grip=new T.Group();grip.position.set(0,-.06,.01);wr.add(grip);J.grip[s]=grip;
  // Legs.
  const hp=new T.Group();hp.position.set(sx*.095*bw,-.04,0);hips.add(hp);J.hip[s]=hp;
  mesh(cap(.075*bw,.3),legM,hp,0,-.21,0).rotation.y=Math.PI;
  const kn=new T.Group();kn.position.y=-.44;hp.add(kn);J.knee[s]=kn;mesh(new T.SphereGeometry(.064*bw,12,8),plain,kn);
  mesh(cap(.058*bw,.32),legM,kn,0,-.21,0).rotation.y=Math.PI;
  const an=new T.Group();an.position.y=-.43;kn.add(an);J.ank[s]=an;
  mesh(new T.BoxGeometry(.1,.075,.26),boot,an,0,-.032,.045);mesh(new T.BoxGeometry(.102,.02,.262),bootTrim,an,0,-.002,.045);}
 root.scale.setScalar(.97);
 const D82={root,J,L,helmetOn:true,
  setHelmet(on){this.helmetOn=on;helmet.visible=on;face.visible=!on;neckMesh.material=on?balaclava:skin;},
  dispose(){root.removeFromParent();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());texs.forEach(t=>t.dispose());}};
 D82.setHelmet(true);return D82;}

/* ---------- Poses ---------- */
// Angles in radians. af = arm forward (pi = straight up), ao = arm out to the side, tw = upper-arm twist,
// e = elbow bend, lf = leg forward, k = knee bend, f = ankle. L/R mirrored automatically.
function setPose(F,P){const J=F.J;
 J.hips.position.y=HIPY+(P.bob||0);J.hips.position.x=P.hxp||0;J.hips.position.z=P.hzp||0;J.hips.rotation.set(P.hx||0,P.hy||0,P.hz||0);
 J.spine.rotation.set(P.sx||0,P.sy||0,P.sz||0);J.neck.rotation.set(P.nx||0,P.ny||0,P.nz||0);
 for(const s of ['L','R']){const m=s==='L'?1:-1;
  J.sh[s].rotation.set(-(P[s+'af']||0),-m*(P[s+'tw']||0),m*(P[s+'ao']??.06));J.el[s].rotation.set(-(P[s+'e']??.18),0,0);J.wr[s].rotation.set(P[s+'w']||0,0,0);
  J.hip[s].rotation.set(-(P[s+'lf']||0),0,m*(P[s+'lo']??.03));J.knee[s].rotation.x=P[s+'k']||0;J.ank[s].rotation.x=P[s+'f']||0;}}
function mixPose(a,b,k){const o={};for(const key of new Set([...Object.keys(a),...Object.keys(b)]))o[key]=lerp(a[key]??(key.endsWith('ao')?.08:key.endsWith('e')?.18:0),b[key]??(key.endsWith('ao')?.08:key.endsWith('e')?.18:0),k);return o;}
const P={
 idle:t=>({bob:Math.sin(t*1.7)*.004,sx:.02,nx:Math.sin(t*.6)*.04,ny:Math.sin(t*.37)*.12,Lao:.12,Rao:.12,Le:.22,Re:.22,Laf:.04+Math.sin(t*1.7)*.02,Raf:.04-Math.sin(t*1.7)*.02}),
 walk:(t,f=1.8)=>{const w=t*Math.PI*2*f*.5,s=Math.sin(w),c=Math.cos(w);
  return {bob:-Math.abs(c)*.035+.01,hy:s*.08,sx:.06,sy:-s*.06,nx:-.03,Llf:s*.42,Rlf:-s*.42,Lk:Math.max(0,-c)*.95+.08,Rk:Math.max(0,c)*.95+.08,Lf:Math.max(0,s)*.2,Rf:Math.max(0,-s)*.2,
   Laf:-s*.38,Raf:s*.38,Le:.35,Re:.35,Lao:.1,Rao:.1};},
 hold:()=>({sx:.04,Laf:.95,Raf:.95,Ltw:1.25,Rtw:1.25,Le:1.35,Re:1.35,Lao:.12,Rao:.12,nx:.1}),
 lift:t=>({bob:.01,sx:-.12,nx:-.32,Laf:2.75,Raf:2.75,Ltw:1.45,Rtw:1.45,Lao:.3,Rao:.3,Le:.95+Math.sin(t*5)*.12,Re:.95+Math.sin(t*5)*.12}),
 spray:t=>({sx:.04,sy:-.2+Math.sin(t*2.1)*.35,ny:-.2+Math.sin(t*2.1)*.35,Raf:1.45+Math.sin(t*14)*.07,Rao:-.05,Re:.15,Rw:-.25,Laf:2.6,Lao:.35,Le:.9+Math.sin(t*7)*.4,Ltw:1.4}),
 shake:t=>({sx:.06,Raf:.75+Math.sin(t*26)*.3,Re:1.1,Rtw:.6,Laf:.6,Le:1.2,Ltw:.9,Lao:.2}),
 fist:t=>{const k=(Math.sin(t*7)+1)/2;return {bob:k*.02,sx:-.06,nx:-.22,Raf:2.55,Rao:.25,Rtw:1.5,Re:.25+k*1.35,Laf:.25,Lao:.35,Le:.5};},
 both:t=>{const k=(Math.sin(t*5)+1)/2;return {bob:k*.03,sx:-.1,nx:-.3,Laf:2.65,Raf:2.65,Lao:.55,Rao:.55,Ltw:1.5,Rtw:1.5,Le:.25+k*.6,Re:.25+k*.6};},
 wave:t=>({nx:-.1,Raf:2.4,Rao:.55,Rtw:1.4,Re:.6+Math.sin(t*8)*.35,Lao:.12,Le:.25}),
 crouch:()=>({bob:-.42,hx:.2,sx:.55,nx:-.4,Llf:1.5,Rlf:1.5,Lk:2.1,Rk:2.1,Lf:-.5,Rf:-.5,Laf:.9,Raf:.9,Le:.8,Re:.8}),
 sit:()=>({bob:-.5,sx:-.15,Llf:1.45,Rlf:1.45,Lk:1.2,Rk:1.2,Laf:.75,Raf:.75,Le:.7,Re:.7})};

/* ---------- Props ---------- */
let envTex=null;
function environment(renderer){if(envTex)return envTex;try{const pm=new T.PMREMGenerator(renderer),s=new T.Scene(),g=new T.SphereGeometry(10,32,16),cols=[];
 const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i)/10,c=new T.Color().setHSL(.6,.25,clamp(.18+y*.55,.05,.95));cols.push(c.r,c.g,c.b);}g.setAttribute('color',new T.Float32BufferAttribute(cols,3));
 s.add(new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide})));
 for(const [x,y,z,w,h] of [[0,8,0,8,1],[6,3,-4,2,4],[-6,3,4,2,4],[0,2,8,6,2]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:'#fff',side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);s.add(m);}
 envTex=pm.fromScene(s,.03).texture;pm.dispose();}catch(e){console.warn('dr82 env',e);}return envTex;}
function trophy(scale=1,gold='#e0b04a'){const g=new T.Group(),m=stdMat(gold,{metalness:1,roughness:.22}),base=stdMat('#141518',{roughness:.3,metalness:.2});
 const prof=[[0,0],[.055,0],[.06,.015],[.02,.03],[.016,.09],[.03,.11],[.07,.16],[.085,.22],[.088,.26],[.08,.262],[.074,.22],[.06,.17],[0,.165]].map(([x,y])=>new T.Vector2(x,y));
 const cup=new T.Mesh(new T.LatheGeometry(prof,28),m);cup.position.y=.07;g.add(cup);
 const b=new T.Mesh(new T.CylinderGeometry(.06,.07,.07,24),base);b.position.y=.035;g.add(b);
 for(const s of [-1,1]){const h=new T.Mesh(new T.TorusGeometry(.04,.008,8,16,Math.PI),m);h.position.set(s*.088,.29,0);h.rotation.z=s>0?-Math.PI/2:Math.PI/2;g.add(h);}
 g.scale.setScalar(scale);return g;}
function bottle(){const g=new T.Group(),glass=stdMat('#163d1e',{roughness:.12,metalness:.3}),foil=stdMat('#d9b44a',{metalness:.9,roughness:.3}),label=stdMat('#f1ead2',{roughness:.6});
 const prof=[[0,0],[.038,0],[.04,.02],[.04,.17],[.03,.22],[.016,.26],[.015,.31],[0,.31]].map(([x,y])=>new T.Vector2(x,y));
 const b=new T.Mesh(new T.LatheGeometry(prof,18),glass);g.add(b);const f=new T.Mesh(new T.CylinderGeometry(.017,.02,.08,12),foil);f.position.y=.28;g.add(f);
 const l=new T.Mesh(new T.CylinderGeometry(.0405,.0405,.07,18,1,true),label);l.position.y=.1;g.add(l);
 const tip=new T.Object3D();tip.position.y=.33;g.add(tip);g.tip=tip;return g;}
let dotTex=null;const dot=()=>dotTex||(dotTex=tex(32,32,(g,w)=>{const gr=g.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#fffc');gr.addColorStop(1,'#fff0');g.fillStyle=gr;g.fillRect(0,0,w,w);}));
// Confetti or champagne: one points cloud, simple ballistic motion.
function particles(n,size,colors,additive){const geo=new T.BufferGeometry(),p=new Float32Array(n*3),c=new Float32Array(n*3);
 for(let i=0;i<n;i++){p[i*3+1]=-999;const col=new T.Color(colors[i%colors.length]);c.set([col.r,col.g,col.b],i*3);}
 geo.setAttribute('position',new T.BufferAttribute(p,3));geo.setAttribute('color',new T.BufferAttribute(c,3));
 const mat=new T.PointsMaterial({size,vertexColors:true,transparent:true,opacity:.95,depthWrite:false,map:dot(),alphaTest:.05,blending:additive?T.AdditiveBlending:T.NormalBlending,sizeAttenuation:true});
 const pts=new T.Points(geo,mat);pts.frustumCulled=false;const v=new Float32Array(n*3),life=new Float32Array(n);let next=0;
 return {pts,emit(o,dir,spread,speed,count,ttl=2.5){for(let k=0;k<count;k++){const i=next++%n;p.set([o.x,o.y,o.z],i*3);
   v[i*3]=dir.x*speed+(Math.random()-.5)*spread;v[i*3+1]=dir.y*speed+(Math.random()-.5)*spread;v[i*3+2]=dir.z*speed+(Math.random()-.5)*spread;life[i]=ttl*(.6+Math.random()*.4);}},
  update(dt,grav=-9.8,drag=0){for(let i=0;i<n;i++){if(life[i]<=0)continue;life[i]-=dt;if(life[i]<=0){p[i*3+1]=-999;continue;}
   v[i*3+1]+=grav*dt;if(drag){const k=Math.max(0,1-drag*dt);v[i*3]*=k;v[i*3+1]*=k;v[i*3+2]*=k;v[i*3]+=Math.sin(life[i]*9+i)*.05;}p[i*3]+=v[i*3]*dt;p[i*3+1]+=v[i*3+1]*dt;p[i*3+2]+=v[i*3+2]*dt;}
   geo.attributes.position.needsUpdate=true;},
  dispose(){geo.dispose();mat.dispose();}};}

/* ---------- One shared renderer for the preview and the stage scenes ---------- */
let R=null;
function renderer(){if(R)return R;R=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});R.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
 R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.05;R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.domElement.className='dr82-canvas';return R;}

/* ---------- Pad / keyboard skip ---------- */
function skipper(onSkip){let armed=false,done=false;const t0=performance.now();
 const key=e=>{if(['Enter','Space','Escape','NumpadEnter'].includes(e.code)&&performance.now()-t0>400){e.preventDefault();e.stopPropagation();fire();}};
 const fire=()=>{if(done)return;done=true;onSkip();};
 addEventListener('keydown',key,true);
 return {poll(){const pads=navigator.getGamepads?[...navigator.getGamepads()].filter(Boolean):[];const a=pads.some(p=>p.buttons[0]?.pressed||p.buttons[1]?.pressed);
   if(!a)armed=true;else if(armed&&performance.now()-t0>400)fire();},
  off(){removeEventListener('keydown',key,true);done=true;}};}

const CSS=`
.dr82-ov{position:fixed;inset:0;z-index:9500;background:#000;overflow:hidden;animation:dr82in .5s}
.dr82-ov canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
.dr82-ov.out{animation:dr82out .6s forwards}
@keyframes dr82in{from{opacity:0}to{opacity:1}}@keyframes dr82out{to{opacity:0}}
.dr82-bars:before,.dr82-bars:after{content:'';position:absolute;left:0;right:0;height:7vh;background:#000;z-index:2}.dr82-bars:before{top:0}.dr82-bars:after{bottom:0}
.dr82-cap{position:absolute;left:5vw;bottom:12vh;z-index:3;color:#fff;font-family:'UI Rajdhani',Rajdhani,sans-serif;text-transform:uppercase;opacity:0;transform:translateX(-30px);transition:all .6s cubic-bezier(.2,.8,.2,1)}
.dr82-cap.on{opacity:1;transform:none}
.dr82-cap .k{display:inline-block;background:#e10600;padding:4px 12px;font-weight:700;letter-spacing:.2em;font-size:14px}
.dr82-cap h1{margin:8px 0 2px;font-size:clamp(34px,5vw,72px);line-height:.92;font-style:italic;font-weight:700;display:flex;align-items:center;gap:14px;text-shadow:0 4px 24px #000a}
.dr82-cap p{margin:0;font:600 14px 'UI Inter',Inter,sans-serif;letter-spacing:.12em;color:#d7dbe2}
.dr82-skip{position:absolute;right:4vw;bottom:9vh;z-index:3;color:#e8ebf0;font:600 12px 'UI Inter',Inter,sans-serif;display:flex;gap:8px;align-items:center;letter-spacing:.06em}
.dr82-skip i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#16c464;color:#fff;font:700 11px 'UI Rajdhani',sans-serif;font-style:normal}
.dr82-flag{display:inline-block;vertical-align:middle;border-radius:2px;box-shadow:0 0 0 1px #0006}
.dr82-world-skip{position:fixed;right:4vw;bottom:6vh;z-index:60}
.dr82-page{display:grid;grid-template-columns:minmax(280px,420px) 1fr;gap:18px;align-items:start}
.dr82-view{position:sticky;top:12px}
.dr82-stage{position:relative;height:min(62vh,560px);border-radius:3px;overflow:hidden;background:radial-gradient(ellipse at 50% 85%,#3a404c 0,#14171d 55%,#08090c 100%);border-top:2px solid #e10600}
.dr82-stage canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
.dr82-stage .nm{position:absolute;left:14px;top:12px;z-index:2;color:#fff;font:700 24px 'UI Rajdhani',sans-serif;font-style:italic;text-transform:uppercase;display:flex;gap:10px;align-items:center;text-shadow:0 2px 10px #000}
.dr82-stage .nm small{display:block;font:600 11px 'UI Inter',sans-serif;font-style:normal;letter-spacing:.14em;color:#b9c0cc}
.dr82-panel .dc-card{margin-bottom:14px}
.dr82-row{display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:center;padding:7px 0;border-bottom:1px solid #ffffff10}
.dr82-row:last-child{border-bottom:0}
.dr82-row>label{font:600 12px 'UI Inter',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#aab3c2}
.dr82-step{display:flex;align-items:center;gap:6px}
.dr82-step b{min-width:160px;text-align:center;font:700 16px 'UI Rajdhani',sans-serif;text-transform:uppercase;letter-spacing:.06em;display:flex;gap:8px;align-items:center;justify-content:center}
.dr82-step button,.dr82-sw button,.dr82-tog{min-width:34px;height:34px;border-radius:2px;border:1px solid #ffffff2a;background:#ffffff0d;color:#fff;font:700 18px 'UI Rajdhani',sans-serif;cursor:pointer}
.dr82-sw{display:flex;flex-wrap:wrap;gap:6px}
.dr82-sw button{width:30px;min-width:30px;height:30px;padding:0}
.dr82-sw button.on,.dr82-tog.on{outline:3px solid #fff;outline-offset:1px}
.dr82-step button:focus,.dr82-sw button:focus,.dr82-tog:focus,.dr82-panel input:focus{outline:3px solid #ffc400!important;outline-offset:2px}
.dr82-panel input{width:100%;max-width:320px;height:36px;border-radius:2px;border:1px solid #ffffff2a;background:#0008;color:#fff;font:600 16px 'UI Inter',sans-serif;padding:0 10px}
.dr82-tog{padding:0 14px;font-size:14px;letter-spacing:.1em;text-transform:uppercase}
.dr82-tog.on{background:#16c46433;border-color:#16c464}
@media(max-width:900px){.dr82-page{grid-template-columns:1fr}.dr82-view{position:static}.dr82-row{grid-template-columns:1fr}}`;
function ensureCss(){if(document.getElementById('dr82-css'))return;const s=document.createElement('style');s.id='dr82-css';s.textContent=CSS;document.head.appendChild(s);}

/* ---------- Stage scenes (podium, championship, creator stand) ---------- */
function wallTex(lines,doors){return tex(2048,1024,(g,w,h)=>{
 const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#16070a');gr.addColorStop(.55,'#4a0b12');gr.addColorStop(1,'#12060a');g.fillStyle=gr;g.fillRect(0,0,w,h);
 g.save();g.globalAlpha=.09;g.fillStyle='#fff';g.font='italic 900 64px Arial';for(let y=40;y<h;y+=120)for(let x=(y/120%2)*240-240;x<w;x+=680)g.fillText('SUPERCARS 26',x,y);g.restore();
 g.fillStyle='#e10600';g.fillRect(0,96,w,10);g.fillRect(0,h-150,w,8);
 g.textAlign='center';g.fillStyle='#fff';g.font='italic 900 112px Arial';g.fillText(lines[0],w/2,300);g.font='700 50px Arial';g.fillStyle='#ffd7d9';g.fillText(lines[1]||'',w/2,370);
 g.font='600 26px Arial';g.fillStyle='#ffffff77';g.textAlign='right';g.fillText('UNOFFICIAL FAN GAME',w-60,150);g.textAlign='center';
 g.globalCompositeOperation='destination-out';for(const [x,y,dw,dh] of doors)g.fillRect(x,y,dw,dh);});}
function blockTex(n){return tex(256,256,(g,w,h)=>{g.fillStyle='#f2f3f5';g.fillRect(0,0,w,h);g.fillStyle='#e10600';g.fillRect(0,0,w,18);g.fillStyle='#14161a';g.font='italic 900 150px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),w/2,h/2+12);});}
function podiumSet(scene,{lines,steps,renderer:r}){
 const kill=[];const add=o=>{scene.add(o);kill.push(o);return o;};
 scene.background=new T.Color('#05060a');scene.fog=new T.Fog('#05060a',14,34);scene.environment=environment(r);
 add(new T.HemisphereLight('#c9d6ff','#2a1a1a',.55));
 const key=new T.SpotLight('#fff4e6',95,30,.55,.5,1.4);key.position.set(2.5,7,7);key.target.position.set(0,1.2,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0004;add(key);add(key.target);
 const rim=new T.SpotLight('#ff3040',70,20,.7,.6,1.5);rim.position.set(-4,5,-3);rim.target.position.set(0,1,0);add(rim);add(rim.target);
 const rim2=new T.SpotLight('#5fa8ff',50,20,.7,.6,1.5);rim2.position.set(4,5,-3);rim2.target.position.set(0,1,0);add(rim2);add(rim2.target);
 const floor=add(new T.Mesh(new T.PlaneGeometry(40,30),stdMat('#1b1d22',{roughness:.35,metalness:.2})));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
 // Stage deck in front of the wall; the crowd stands lower, in front of it.
 const deck=add(new T.Mesh(new T.BoxGeometry(9,.3,3.2),stdMat('#22252c',{roughness:.5})));deck.position.set(0,-.15,-.4);deck.receiveShadow=true;
 const front=add(new T.Mesh(new T.PlaneGeometry(9,1.6),new T.MeshStandardMaterial({map:tex(1024,180,(g,w,h)=>{g.fillStyle='#0c0d10';g.fillRect(0,0,w,h);g.fillStyle='#e10600';g.fillRect(0,0,w,10);g.fillStyle='#fff';g.font='italic 900 80px Arial';g.textAlign='center';g.fillText('SUPERCARS 26',w/2,120);}),roughness:.6})));front.position.set(0,-.8,1.2);
 add(new T.Mesh(new T.BoxGeometry(9,1.3,.1),stdMat('#0c0d10'))).position.set(0,-.95,1.15);
 const doors=steps.map(s=>{const x=(s.x/12+.5)*2048,y=(1-(s.h+2.0)/5.2)*1024;return [x-100,y,200,(2.0/5.2)*1024];});
 const wall=add(new T.Mesh(new T.PlaneGeometry(12,5.2),new T.MeshStandardMaterial({map:wallTex(lines,doors),alphaTest:.5,roughness:.8,side:T.DoubleSide})));wall.position.set(0,2.6,-1.6);wall.receiveShadow=true;
 const back=add(new T.Mesh(new T.BoxGeometry(12,6,3),stdMat('#020203',{side:T.BackSide})));back.position.set(0,3,-3.2);
 for(const s of steps){const m=new T.MeshStandardMaterial({color:'#fff',roughness:.45});const side=stdMat('#e9eaee',{roughness:.45});
  const b=add(new T.Mesh(new T.BoxGeometry(1.4,s.h,2.1),[side,side,stdMat('#2a2d34',{roughness:.6}),side,s.n?new T.MeshStandardMaterial({map:blockTex(s.n),roughness:.45}):side,side]));b.position.set(s.x,s.h/2,-.55);b.castShadow=b.receiveShadow=true;
  const bridge=add(new T.Mesh(new T.BoxGeometry(1.2,s.h,1.4),stdMat('#2a2d34')));bridge.position.set(s.x,s.h/2,-2.3);}
 // Crowd: two instanced meshes (bodies and heads) bouncing.
 const N=160,bodyG=new T.BoxGeometry(.42,.62,.26),headG=new T.SphereGeometry(.11,10,8),bodies=new T.InstancedMesh(bodyG,stdMat('#fff',{roughness:.9}),N),heads=new T.InstancedMesh(headG,stdMat('#fff',{roughness:.8}),N);
 const crowd=[],shirt=['#e10600','#1f6fe0','#f5f5f0','#16181c','#ffc400','#0a2a6b','#ff6a00','#1fa64a'],sk=SKIN;
 for(let i=0;i<N;i++){const row=Math.floor(i/32),x=-6.4+(i%32)*.4+(row%2)*.2+(Math.random()-.5)*.1,z=2.0+row*.62;crowd.push({x,z,y:-1.6+row*.12,ph:Math.random()*7,amp:.04+Math.random()*.1});
  bodies.setColorAt(i,new T.Color(shirt[(i*7+row)%shirt.length]));heads.setColorAt(i,new T.Color(sk[(i*3)%sk.length]));}
 add(bodies);add(heads);const fl=add(new T.Mesh(new T.PlaneGeometry(16,6),stdMat('#0b0c0f')));fl.rotation.x=-Math.PI/2;fl.position.set(0,-1.62,4);
 const mtx=new T.Matrix4();
 return {kill,crowd(t,hype){for(let i=0;i<N;i++){const c=crowd[i],j=Math.max(0,Math.sin(t*(5+hype*3)+c.ph))*c.amp*(1+hype*2);mtx.makeTranslation(c.x,c.y+.31+j,c.z);bodies.setMatrixAt(i,mtx);mtx.makeTranslation(c.x,c.y+.75+j,c.z);heads.setMatrixAt(i,mtx);}
  bodies.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=true;},
  dispose(){for(const o of kill){scene.remove(o);o.traverse?.(m=>{m.geometry?.dispose();const mm=Array.isArray(m.material)?m.material:[m.material];mm.forEach(x=>{if(!x)return;x.map?.dispose();x.dispose();});});}}};}

let stageBusy=false;
// Runs a cut scene on a full-screen overlay. build(scene,camera,api) returns {update(t,dt), duration}.
function runStage(build,cap){return new Promise(resolve=>{
 if(stageBusy){resolve();return;}stageBusy=true;ensureCss();
 let ov,r,scene,cam,sk,raf=0,ctl,finished=false,last=performance.now(),t=0;
 const finish=()=>{if(finished)return;finished=true;cancelAnimationFrame(raf);sk?.off();try{ctl?.dispose?.();}catch(e){console.warn('dr82',e);}
  if(ov){ov.classList.add('out');setTimeout(()=>{ov.remove();},620);}stageBusy=false;try{removeEventListener('resize',size);}catch(_){}resolve();};
 const size=()=>{const w=innerWidth,h=innerHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();};
 try{
  r=renderer();ov=document.createElement('div');ov.className='dr82-ov dr82-bars';ov.innerHTML=`<div class="dr82-cap">${cap||''}</div><div class="dr82-skip"><i>A</i> / Enter · Skip</div>`;ov.prepend(r.domElement);document.body.appendChild(ov);
  scene=new T.Scene();cam=new T.PerspectiveCamera(38,1,.05,80);size();addEventListener('resize',size);
  ctl=build(scene,cam,{renderer:r,caption:on=>ov.querySelector('.dr82-cap')?.classList.toggle('on',on)});
  sk=skipper(finish);
  const loop=now=>{if(finished)return;let dt=Math.min(.05,(now-last)/1000);last=now;if(DR.seek!=null){dt=Math.max(0,DR.seek-t);t=DR.seek;}else t+=dt;sk.poll();
   try{ctl.update(t,dt);r.render(scene,cam);}catch(e){console.warn('dr82 stage',e);finish();return;}
   if(t>=ctl.duration){finish();return;}if(t>=ctl.duration-.6)ov.classList.add('out');raf=requestAnimationFrame(loop);};
  raf=requestAnimationFrame(loop);
 }catch(e){console.warn('dr82 stage start',e);finish();}
});}
// Camera shots: [t0,t1,from pos,to pos,from look,to look,fov]
function shots(cam,list,t){const s=list.find(x=>t<x[1])||list[list.length-1],k=ease((t-s[0])/(s[1]-s[0]));
 cam.position.set(lerp(s[2][0],s[3][0],k),lerp(s[2][1],s[3][1],k),lerp(s[2][2],s[3][2],k));cam.lookAt(lerp(s[4][0],s[5][0],k),lerp(s[4][1],s[5][1],k),lerp(s[4][2],s[5][2],k));
 if(s[6]&&cam.fov!==s[6]){cam.fov=s[6];cam.updateProjectionMatrix();}}
const wp=new T.Vector3(),wq=new T.Vector3();
// Puts a two-handed prop between the hands (in world space).
function between(F,o,up=.05,fwd=.02){F.J.grip.L.getWorldPosition(wp);F.J.grip.R.getWorldPosition(wq);o.position.copy(wp).add(wq).multiplyScalar(.5);o.position.y+=up;
 const yaw=F.root.rotation.y;o.position.x+=Math.sin(yaw)*fwd;o.position.z+=Math.cos(yaw)*fwd;o.rotation.y=yaw;}

/* ---------- 3. Podium ---------- */
function podiumScene(r,opts={}){
 const order=(r.order||[]).slice(0,3);if(order.length<3)return Promise.resolve();
 const teams=hasCareer()?D.world.teams:[];
 const who=order.map(x=>{const t=teams.find(t=>t.drivers.some(d=>d.number===x.number));const d=t?.drivers.find(d=>d.number===x.number)||{name:x.name,number:x.number,id:x.number};return {x,t,d};});
 const myPos=who.findIndex(w=>hasCareer()&&w.d.id===D.pid);
 const L0=lookFor(who[myPos>=0?myPos:0].d,who[myPos>=0?myPos:0].t);
 const cap=`<span class="k">${esc(opts.kick||('Podium · '+(r.circuit||'')+(r.race!=null?' · Race '+((r.race||0)+1):'')))}</span><h1>${myPos>=0?'P'+(myPos+1)+' ':''}${flagImg(L0.nation||'AUS',34)}${esc(myPos>=0?(L0.first+' '+L0.last):who[0].d.name)}</h1><p>${esc(who[myPos>=0?myPos:0].t?.name||'')}</p>`;
 return runStage((scene,cam,api)=>{
  const stepX=[0,-1.55,1.55],stepH=[.9,.62,.4];
  const set=podiumSet(scene,{lines:[opts.title||'PODIUM',opts.sub||String(r.circuit||'').toUpperCase()],steps:[0,1,2].map(i=>({x:stepX[i],h:stepH[i],n:i+1})),renderer:api.renderer});
  const figs=who.map((w,i)=>{const F=buildDriver(lookFor(w.d,w.t));F.setHelmet(false);scene.add(F.root);F.i=i;F.x=stepX[i];F.h=stepH[i];F.root.position.set(F.x,F.h,-2.3);F.trophy=trophy(i===0?1.15:.95);F.trophy.scale.multiplyScalar(.001);scene.add(F.trophy);
   F.bottle=bottle();F.bottle.visible=false;F.J.grip.R.add(F.bottle);F.bottle.rotation.x=Math.PI;F.spray=particles(900,.06,['#fff6d0','#ffe9a8','#ffffff'],false);scene.add(F.spray.pts);
   const sh=new T.Mesh(new T.CircleGeometry(.32,20),new T.MeshBasicMaterial({color:'#000',transparent:true,opacity:.35,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.set(F.x,F.h+.003,-.15);scene.add(sh);F.shadow=sh;return F;});
  const conf=particles(1600,.075,['#e10600','#ffffff','#ffc400','#1f6fe0','#16c464'],false);scene.add(conf.pts);
  const hero=figs[myPos>=0?myPos:0],hx=hero.x,hh=hero.h;let confT=0;
  const list=[[0,2.8,[0,1.6,8.6],[0,1.9,7.0],[0,1.3,0],[0,1.5,0],36],[2.8,4.8,[hx+1.3,hh+1.55,2.6],[hx+.7,hh+1.5,2.0],[hx,hh+1.2,-.2],[hx,hh+1.25,-.2],34],
   [4.8,7.2,[hx-.9,hh+.55,2.3],[hx-.4,hh+.45,2.0],[hx,hh+1.7,-.2],[hx,hh+2.0,-.2],40],[7.2,12,[5.2,2.4,4.4],[-4.6,2.5,4.8],[.3,1.5,-.2],[-.3,1.6,-.2],40],
   [12,15,[0,2.2,6.5],[0,2.6,8.8],[0,1.5,0],[0,1.6,0],40]];
  return {duration:15,update(t,dt){
   set.crowd(t,t>7?1:t>4.8?.6:.2);
   if(t>1.2)api.caption(t<12.5);
   for(const F of figs){const start=[1.0,.5,0][F.i],wk=clamp((t-start)/1.8,0,1);
    if(wk<1){F.root.position.set(F.x,F.h,lerp(-2.3,-.15,wk));F.root.rotation.y=0;setPose(F,P.walk(t));F.shadow.visible=wk>.6;continue;}
    F.root.position.set(F.x,F.h,-.15);F.shadow.visible=true;
    const lt=F.i===myPos||myPos<0&&F.i===0?4.9:5.6,give=2.9+F.i*.25;
    let pose=P.idle(t+F.i);
    if(t>give)F.trophy.scale.setScalar((F.i===0?1.15:.95)*Math.min(1,(t-give)/.35+.001));
    if(t>give&&t<7.2){pose=mixPose(P.idle(t),P.hold(),seg(t,give,give+.4));if(t>lt)pose=mixPose(P.hold(),P.lift(t),seg(t,lt,lt+.6));between(F,F.trophy,-.02,.04);
     if(t>lt+.3&&t<7){F.trophy.rotation.z=Math.sin(t*5)*.06;}}
    if(t>=7.2){F.trophy.position.set(F.x+.35,F.h,.25);F.trophy.rotation.set(0,0,0);F.bottle.visible=true;
     if(t<7.8)pose=P.shake(t);else if(t<12){pose=P.spray(t+F.i);const tip=F.bottle.tip;tip.getWorldPosition(wp);F.bottle.getWorldDirection(wq);
      const d=new T.Vector3(0,1,0).applyQuaternion(F.bottle.getWorldQuaternion(new T.Quaternion()));F.spray.emit(wp,d,1.1,5.5,9,1.3);}
     else pose=F.i===myPos||myPos<0&&F.i===0?P.fist(t):P.wave(t+F.i);}
    setPose(F,pose);F.spray.update(dt,-6,.8);}
   if(t>7.8&&confT<4){confT+=dt;for(const s of [-1,1])conf.emit(new T.Vector3(s*4.2,.3,.4),new T.Vector3(-s*.35,1,0).normalize(),2.2,9,14,4.5);}
   conf.update(dt,-2.2,1.6);shots(cam,list,t);},
   dispose(){figs.forEach(F=>{F.dispose();F.trophy.removeFromParent();F.spray.pts.removeFromParent();F.spray.dispose();F.shadow.removeFromParent();});conf.pts.removeFromParent();conf.dispose();set.dispose();}};
 },cap);}

/* ---------- 4. Championship ---------- */
function champScene(opts={}){
 if(!hasCareer())return Promise.resolve();
 const L0=lookFor(dcPlayer(),dcTeam()),year=opts.year||D.year;
 const cap=`<span class="k">${esc(year)} Supercars Champion</span><h1>${flagImg(L0.nation||'AUS',34)}${esc(L0.first+' '+L0.last)}</h1><p>${esc(dcTeam().name)} · Car #${esc(L0.number)}</p>`;
 return runStage((scene,cam,api)=>{
  const set=podiumSet(scene,{lines:[year+' CHAMPION',(L0.first+' '+L0.last).toUpperCase()],steps:[{x:0,h:.9,n:1}],renderer:api.renderer});
  const F=buildDriver(L0);F.setHelmet(false);scene.add(F.root);
  const big=trophy(1.9,'#f0c75a');scene.add(big);
  const ped=new T.Mesh(new T.CylinderGeometry(.16,.2,.75,24),stdMat('#121317',{roughness:.3,metalness:.4}));ped.position.set(.55,.9+.375,-.05);ped.castShadow=true;scene.add(ped);
  const conf=particles(2200,.055,['#e10600','#ffffff','#ffc400','#f0c75a'],false),spark=particles(900,.06,['#ffd36a','#fff1b8','#ff9b3d'],true);scene.add(conf.pts,spark.pts);
  const list=[[0,3.2,[0,2.3,9],[0,2.0,6.4],[0,1.9,0],[0,1.8,0],36],[3.2,5,[1.7,2.3,3.4],[1.2,2.2,2.9],[.1,2.0,-.2],[0,2.1,-.2],34],[5,9.5,[-2.6,1.0,3.4],[2.6,1.1,3.2],[0,2.4,0],[0,2.4,0],42],[9.5,14,[0,2.4,5.5],[0,2.9,8.6],[0,1.8,0],[0,1.9,0],40]];
  return {duration:14,update(t,dt){
   set.crowd(t,t>5?1.2:.4);if(t>1)api.caption(t<13);
   let pose;
   const PED=new T.Vector3(.55,.9+.75,-.05);
   if(t<2.6){const k=clamp(t/2.6,0,1);F.root.position.set(0,.9,lerp(-2.3,-.2,k));setPose(F,P.walk(t));big.position.copy(PED);}
   else{F.root.position.set(0,.9,-.2);
    if(t<3.4){pose=mixPose({...P.idle(t),ny:-.5,sy:-.25},P.hold(),seg(t,2.6,3.4));big.position.copy(PED);}
    else if(t<4.4){pose=mixPose(P.hold(),P.lift(t),seg(t,3.5,4.4));}
    else if(t<10){pose=P.lift(t);}
    else pose=mixPose(P.lift(t),{...P.lift(t),sy:Math.sin(t*1.5)*.35},seg(t,10,11));
    setPose(F,pose);if(t>=3.3){const from=big.position.clone();between(F,big,-.02,.05);if(t<3.8)big.position.lerpVectors(PED,big.position,seg(t,3.3,3.8));}}
   if(t>4.4&&t<11){for(const s of [-1,1])conf.emit(new T.Vector3(s*4.5,.3,.6),new T.Vector3(-s*.3,1,0).normalize(),2.6,10,16,5);
    for(const s of [-1,1])spark.emit(new T.Vector3(s*2.6,.95,.4),new T.Vector3(0,1,0),1.2,6.5,8,1.1);}
   conf.update(dt,-2.2,1.5);spark.update(dt,-7);shots(cam,list,t);},
   dispose(){F.dispose();[big,ped,conf.pts,spark.pts].forEach(o=>o.removeFromParent());conf.dispose();spark.dispose();set.dispose();}};
 },cap);}

/* ---------- In-world scenes (walk-in, win celebration) on the live race camera ---------- */
let world=null; // {cam:{pos,look,fov}}
const baseCamera=typeof dc36Camera==='function'?dc36Camera:null;
if(baseCamera){dc36Camera=function(W,L,dt){const r=baseCamera.apply(this,arguments);try{if(world?.cam&&W?.camera){const c=world.cam;W.camera.position.copy(c.pos);W.camera.lookAt(c.look);if(c.fov&&W.camera.fov!==c.fov){W.camera.fov=c.fov;W.camera.updateProjectionMatrix();}}}catch(_){}return r;};}
function carOf(L){const W=typeof sc25Engine!=='undefined'?sc25Engine:null;return W&&L?.player?W.carNodes?.get(L.player.d.id):null;}
// Car-local point to world (the car model's +Z is its nose).
function carPt(car,x,y,z,out=new T.Vector3()){return out.set(x,y,z).applyMatrix4(car.matrixWorld);}
function carYaw(car){const f=new T.Vector3(0,0,1).transformDirection(car.matrixWorld);return Math.atan2(f.x,f.z);}
// Which side the driver sits: the steering wheel's side (+1 = car-local +X). Supercars are right-hand drive.
function driverSide(car){let s=0;const w=new T.Vector3(),inv=new T.Matrix4().copy(car.matrixWorld).invert();
 car.traverse(o=>{if(!s&&/^steering$/i.test(o.name)){o.getWorldPosition(w);w.applyMatrix4(inv);if(Math.abs(w.x)>.15)s=Math.sign(w.x);}});return s||1;}
// The car models carry a plain white helmet inside the merged trim mesh (vertex colour #e5e8e7). Your
// car gets its own copy of that mesh with the white helmet folded away and your helmet put in its place.
const HELMET_RGB=new T.Color('#e5e8e7');
function dressCar(L){try{const car=carOf(L);if(!car||car.dr82)return;car.dr82=true;const look=lookFor(L.player.d,L.player.team),done=new Map();
 car.updateMatrixWorld(true);const carQ=car.getWorldQuaternion(new T.Quaternion());
 car.traverse(m=>{const c=m.isMesh&&m.geometry?.attributes?.color;if(!c||c.count<1000)return;
  let g=done.get(m.geometry);
  if(!g){const idx=[];for(let i=0;i<c.count;i++)if(Math.abs(c.getX(i)-HELMET_RGB.r)<.012&&Math.abs(c.getY(i)-HELMET_RGB.g)<.012&&Math.abs(c.getZ(i)-HELMET_RGB.b)<.012)idx.push(i);
   if(idx.length<60){done.set(m.geometry,null);return;}
   g=m.geometry.clone();const p=g.attributes.position,box=new T.Box3(),v=new T.Vector3();for(const i of idx)box.expandByPoint(v.fromBufferAttribute(p,i));
   const ctr=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());for(const i of idx)p.setXYZ(i,ctr.x,ctr.y,ctr.z);p.needsUpdate=true;g.computeBoundingSphere();
   g.dr82={ctr,size};done.set(m.geometry,g);}
  if(!g)return;m.geometry=g;
  const F=buildDriver(look),h=F.J.helmet;h.removeFromParent();h.position.copy(g.dr82.ctr);const d=Math.max(g.dr82.size.x,g.dr82.size.z);h.scale.setScalar(clamp(d/.3,.6,1.6));h.position.y-=.07*h.scale.y;
  h.quaternion.copy(m.getWorldQuaternion(new T.Quaternion()).invert().multiply(carQ));m.add(h);(car.dr82Helmets||=[]).push(h);});
 }catch(e){console.warn('dr82 helmet',e);}}
const seatedHelmet=(car,on)=>car?.dr82Helmets?.forEach(h=>h.visible=on);
const CINE_CSS=`.dr82-cine .dc-driving>*:not(#dc-world):not(#u58-intro),.dr82-cine #cd66,.dr82-cine .cd66-p{visibility:hidden!important}`;
function runWorld(kind,L){return new Promise(resolve=>{
 const car=carOf(L),W=sc25Engine;if(!car||!W?.scene){resolve();return;}ensureCss();
 if(!document.getElementById('dr82-cine-css')){const s=document.createElement('style');s.id='dr82-cine-css';s.textContent=CINE_CSS;document.head.appendChild(s);}
 car.updateMatrixWorld(true);dressCar(L);
 const look=lookFor(L.player.d,L.player.team),F=buildDriver(look);F.root.visible=false;W.scene.add(F.root);
 let done=false,t=0,last=performance.now(),raf=0;
 const inv=new T.Matrix4().copy(car.matrixWorld).invert(),lb=new T.Box3().setFromObject(car).applyMatrix4(inv),roof=clamp(lb.max.y*.86,1.05,1.4),halfW=clamp(Math.max(Math.abs(lb.min.x),Math.abs(lb.max.x)),.85,1.1);
 // The seat: where the in-car helmet sits (its car-space x also tells the driver's side).
 let sd=driverSide(car),sx=.42,sz=-.1;const hs=car.dr82Helmets?.[0];if(hs){const w=hs.getWorldPosition(new T.Vector3()).applyMatrix4(inv);if(Math.abs(w.x)>.12){sd=Math.sign(w.x);sx=Math.abs(w.x);}if(Math.abs(w.z)<1.6)sz=w.z;}
 const tip=document.createElement('div');tip.className='dr82-skip dr82-world-skip';tip.innerHTML='<i>A</i> / Enter · Skip';document.body.appendChild(tip);document.body.classList.add('dr82-cine');
 const end=()=>{if(done)return;done=true;cancelAnimationFrame(raf);sk.off();tip.remove();document.body.classList.remove('dr82-cine');world=null;seatedHelmet(car,true);F.dispose();try{W.cameraCut=true;}catch(_){}resolve();};
 const sk=skipper(end);
 const v=new T.Vector3(),q=new T.Vector3();
 // x is mirrored onto the driver's side; a = facing angle in car space (0 = towards the nose).
 const place=(x,y,z,a)=>{carPt(car,sd*x,y,z,v);F.root.position.copy(v);F.root.rotation.y=carYaw(car)+sd*a;F.root.visible=true;};
 world={cam:{pos:new T.Vector3(),look:new T.Vector3(),fov:45}};
 const camLocal=(px,py,pz,lx,ly,lz,fov=45)=>{carPt(car,sd*px,py,pz,world.cam.pos);carPt(car,sd*lx,ly,lz,world.cam.look);world.cam.fov=fov;};
 const dur=kind==='walk'?5.6:8.2;
 const step=now=>{if(done)return;let dt=Math.min(.05,(now-last)/1000);last=now;if(DR.seek!=null){dt=Math.max(0,DR.seek-t);t=DR.seek;}else t+=dt;sk.poll();
  try{
   if(!live||live!==L||!carOf(L)){end();return;}
   car.updateMatrixWorld();
   if(kind==='walk'){
    if(typeof L.release==='number'&&L.release>0)L.release=Math.max(L.release,1.2);
    seatedHelmet(car,t>4.4);
    const S=[3.1,sz+3.2],E=[halfW+.32,sz-.05],head=Math.atan2(E[0]-S[0],E[1]-S[1]);
    if(t<3){const k=t/3;place(lerp(S[0],E[0],k),0,lerp(S[1],E[1],k),head);setPose(F,P.walk(t,1.9));}
    else if(t<3.45){place(E[0],0,E[1],lerp(head,-Math.PI/2,seg(t,3,3.45)));setPose(F,mixPose(P.walk(t),P.idle(t),seg(t,3,3.45)));}
    else if(t<4.4){const k=seg(t,3.45,4.4);place(lerp(E[0],sx,k),lerp(0,.12,k),lerp(E[1],sz-.05,k),-Math.PI/2);setPose(F,mixPose(P.idle(t),P.crouch(),Math.min(1,k*1.6)));F.root.visible=k<.92;}
    else F.root.visible=false;
    if(t<3.2){F.root.getWorldPosition(q);carPt(car,sd*5.2,1.35,sz+lerp(-2.6,.4,t/3.2),world.cam.pos);world.cam.look.copy(q).setY(q.y+1.05);world.cam.fov=40;}
    else camLocal(2.7,1.45,sz+2.0,.6,.95,sz-.1,40);
   }else{
    seatedHelmet(car,t<.2);
    const X=halfW+.3;
    if(t<.9){const k=seg(t,0,.9);place(lerp(sx,X,k),lerp(.1,0,k),sz,Math.PI/2);setPose(F,mixPose(P.crouch(),P.idle(t),k));}
    else if(t<1.8){const k=seg(t,.9,1.8);place(lerp(X,.15,k),roof*k+Math.sin(k*Math.PI)*.35,lerp(sz,sz-.3,k),Math.PI/2);setPose(F,mixPose(P.crouch(),P.idle(t),Math.abs(k-.5)*2));}
    else{place(.15,roof,sz-.3,Math.PI/2);
     let pose=t<3.8?P.fist(t):t<4.6?P.both(t):t<5.6?mixPose(P.idle(t),{Laf:2.4,Lao:.3,Le:1.9,Ltw:1.4,nx:.1},seg(t,4.6,5.1)):t<7?P.wave(t):P.both(t);
     if(t>5.2&&F.helmetOn){F.setHelmet(false);const hp=F.J.helmet;F.J.grip.L.add(hp);hp.visible=true;hp.position.set(0,-.1,.06);hp.rotation.set(Math.PI,0,0);}
     if(t>=5.6&&t<7)pose={...pose,Laf:.5,Lao:.4,Le:.6};
     setPose(F,pose);}
    const a=1.2+t*.2,rad=5.6;F.root.getWorldPosition(q);camLocal(Math.sin(a)*rad,lerp(.9,1.9,clamp(t/6,0,1)),Math.cos(a)*rad-.3,0,0,0,42);
    world.cam.look.copy(q).setY(q.y+.95);
   }
  }catch(e){console.warn('dr82 world',e);end();return;}
  if(t>=dur){end();return;}raf=requestAnimationFrame(step);};
 raf=requestAnimationFrame(step);
});}

/* ---------- Triggers ---------- */
const want=k=>{const m=me();return !!(m&&m.scenes[k]!==false);};
// 1. Walk-in: during the circuit intro before a race.
let walkedFor=null;
setInterval(()=>{try{const L=typeof live!=='undefined'?live:null;if(!L?.dc){walkedFor=null;return;}
 dressCar(L);
 if(walkedFor===L||!hasCareer()||L.stage!=='race'||L.started||L.test||L.coop||(typeof CO63!=='undefined'&&CO63.race))return;
 if(L.rf41Loading||L.paused||!(L.phase==='formation'||L.phase==='grid')||!(L.release>0||window.UI58?.intro))return;walkedFor=L;if(!want('walk'))return;
 DR.busy=true;runWorld('walk',L).finally(()=>{DR.busy=false;});}catch(e){console.warn('dr82 walk',e);}},150);
// 2. Win celebration: on the End Race prompt after a win, before the results.
function wrapCD(){const CD=window.CD66;if(!CD||CD.dr82)return;CD.dr82=true;const base=CD.end;
 CD.end=function(i){const L=live;try{
  if(!DR.busy&&hasCareer()&&L?.dc&&L.player?.cd66?.ready&&!L.player.cd66.done&&!L.coop&&want('win')){
   const order=[...L.entrants].sort((a,b)=>rf41Classify(a,b,L));
   if(order[0]===L.player){DR.busy=true;document.getElementById('cd66')?.style.setProperty('visibility','hidden');
    runWorld('win',L).finally(()=>{DR.busy=false;document.getElementById('cd66')?.style.removeProperty('visibility');base.call(CD,i);});return;}}
 }catch(e){console.warn('dr82 win',e);}
  if(DR.busy)return;return base.apply(this,arguments);};}
wrapCD();setTimeout(wrapCD,0);
// 3 + 4. Podium after a top-three race result; championship after the title is won.
if(typeof dcShowResult==='function'){const base=dcShowResult;dcShowResult=function(r){const out=base.apply(this,arguments);
 try{if(!hasCareer()||!r||!Array.isArray(r.order)||r.order.length<3||r.retired)return out;
  const pos=r.position,champ=champion();
  const go=async()=>{if(pos>=1&&pos<=3&&want('podium'))await podiumScene(r);if(champ&&want('champ')){D.dr82.champShown=champ;dcSave();await champScene({year:champ});}};
  if((pos>=1&&pos<=3&&want('podium'))||champ)setTimeout(go,60);}catch(e){console.warn('dr82 podium',e);}
 return out;};}
// The season is over (no event left, or the last round's last race is done) and you lead the points.
function champion(){try{const m=me();if(!m)return null;const over=!dcEvent();
 const lead=dcDrivers()[0]?.d?.id===D.pid;const year=D.year;if(!over||!lead||m.champShown===year)return null;return year;}catch(_){return null;}}

/* ---------- My Driver page ---------- */
let prevF=null,prevLoop=0,prevHelmet=true,prevYaw=0,prevScene=null,prevCam=null,prevSet=null;
function stepper(k,label,text,list){return `<div class="dr82-row"><label>${esc(label)}</label><div class="dr82-step"><button data-k="${k}" data-d="-1" onclick="DR82.step('${k}',-1)" aria-label="Previous">‹</button><b>${text}</b><button data-k="${k}" data-d="1" onclick="DR82.step('${k}',1)" aria-label="Next">›</button></div></div>`;}
function swatch(k,label,cols,cur){return `<div class="dr82-row"><label>${esc(label)}</label><div class="dr82-sw">${cols.map((c,i)=>`<button data-k="${k}" data-v="${i}" class="${String(cur).toLowerCase()===String(c).toLowerCase()||cur===i?'on':''}" style="background:${c}" onclick="DR82.pick('${k}',${i})" aria-label="${esc(c)}"></button>`).join('')}</div></div>`;}
function input(k,label,v,max=24){return `<div class="dr82-row"><label>${esc(label)}</label><input data-k="${k}" maxlength="${max}" value="${esc(v)}" onchange="DR82.text('${k}',this.value)"></div>`;}
function panelHtml(){const m=me(),p=dcPlayer(),n=NATIONS.find(x=>x[0]===m.nation)||NATIONS[0],H=m.helmet,S=m.suit;
 return `<section class="dc-card"><div class="dc-eyebrow">PROFILE</div>${input('first','First name',m.first)}${input('last','Last name',m.last)}${stepper('nation','Nationality',flagImg(n[0])+' '+esc(n[1]))}${stepper('age','Age',String(p.age))}${input('home','Hometown',p.home||'',30)}</section>
 <section class="dc-card"><div class="dc-eyebrow">APPEARANCE</div>${swatch('skin','Skin tone',SKIN,m.skin)}${stepper('build','Build',BUILD[m.build])}${stepper('hair','Hair style',HAIR[m.hair])}${swatch('hairColor','Hair colour',HAIRC,m.hairColor)}${stepper('beard','Facial hair',BEARD[m.beard])}</section>
 <section class="dc-card"><div class="dc-eyebrow">HELMET</div>${stepper('pattern','Design',PATTERN[H.pattern])}${swatch('base','Main colour',PALETTE,H.base)}${swatch('a1','Accent 1',PALETTE,H.a1)}${swatch('a2','Accent 2',PALETTE,H.a2)}${stepper('visor','Visor',VISOR[H.visor][0])}<div class="dr82-row"><label></label><div><button class="dc-btn" data-k="rand" onclick="DR82.random()">Random helmet</button></div></div></section>
 <section class="dc-card"><div class="dc-eyebrow">RACE SUIT</div>${stepper('suit','Colours',S.mode==='team'?'Team colours':'My own')}${S.mode==='team'?'':swatch('smain','Suit main',PALETTE,S.main)+swatch('saccent','Suit accent',PALETTE,S.accent)}${swatch('gloves','Gloves',PALETTE,S.gloves)}</section>
 <section class="dc-card"><div class="dc-eyebrow">CUT SCENES</div><div class="dr82-row"><label>Play</label><div class="dr82-sw">${SCENES.map(([k,l])=>`<button class="dr82-tog ${m.scenes[k]!==false?'on':''}" data-k="sc-${k}" onclick="DR82.toggle('${k}')">${esc(l)}</button>`).join('')}</div></div>
 <div class="dr82-row"><label>Watch now</label><div class="dc-actions" style="flex-wrap:wrap;margin:0"><button class="dc-btn" data-k="w-pod" onclick="DR82.watch('podium')">Podium</button><button class="dc-btn" data-k="w-champ" onclick="DR82.watch('champ')">Championship</button></div></div>
 <p class="dc-note" style="margin:8px 0 0">The walk-in plays before each race, and the win celebration when you park in your bay after a win and press A.</p></section>`;}
function pageHtml(){const m=me(),p=dcPlayer();
 return `<h1 class="dc-title">My Driver</h1><p class="dc-sub">Make your driver and change them any time. This is who walks to the car, celebrates on the roof and lifts the trophies.</p>
 <div class="dr82-page"><div class="dr82-view"><div class="dr82-stage" id="dr82-stage"><div class="nm">${flagImg(m.nation,22)}<div>${esc(p.name)}<small>#${esc(p.number)} · ${esc(dcTeam().name)}</small></div></div></div>
 <div class="dc-actions" style="margin-top:10px;flex-wrap:wrap"><button class="dc-btn" data-k="hm" onclick="DR82.helmet()">${prevHelmet?'Take helmet off':'Put helmet on'}</button><button class="dc-btn" data-k="rl" onclick="DR82.turn(-1)">⟲ Turn</button><button class="dc-btn" data-k="rr" onclick="DR82.turn(1)">Turn ⟳</button></div></div>
 <div class="dr82-panel" id="dr82-panel">${panelHtml()}</div></div>`;}
function mountPreview(){const host=document.getElementById('dr82-stage');if(!host)return;ensureCss();const r=renderer();host.prepend(r.domElement);
 if(!prevScene){prevScene=new T.Scene();prevScene.background=tex(64,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#0b0d12');gr.addColorStop(.6,'#262b35');gr.addColorStop(1,'#101217');g.fillStyle=gr;g.fillRect(0,0,w,h);});prevCam=new T.PerspectiveCamera(30,1,.05,40);prevScene.environment=environment(r);
  prevScene.add(new T.HemisphereLight('#dfe8ff','#30261f',.9));const k=new T.DirectionalLight('#fff',2.4);k.position.set(2,4,3);k.castShadow=true;k.shadow.mapSize.set(1024,1024);prevScene.add(k);
  const rim=new T.DirectionalLight('#ff4050',1.4);rim.position.set(-3,2,-3);prevScene.add(rim);const rim2=new T.DirectionalLight('#6ab0ff',1.1);rim2.position.set(3,2,-3);prevScene.add(rim2);
  const plat=new T.Mesh(new T.CylinderGeometry(.7,.75,.08,40),stdMat('#1d2027',{roughness:.3,metalness:.4}));plat.position.y=-.04;plat.receiveShadow=true;prevScene.add(plat);
  const ring=new T.Mesh(new T.TorusGeometry(.72,.008,8,60),new T.MeshBasicMaterial({color:'#e10600'}));ring.rotation.x=Math.PI/2;prevScene.add(ring);}
 rebuildPreview();
 if(!prevLoop){let last=performance.now(),t=0;const loop=now=>{const host=document.getElementById('dr82-stage');if(!host||(typeof live!=='undefined'&&live)||stageBusy){prevLoop=0;return;}
  if(R.domElement.parentNode!==host)host.prepend(R.domElement);const w=host.clientWidth,h=host.clientHeight;if(w&&h){const s=R.getSize(new T.Vector2());if(s.x!==w||s.y!==h){R.setSize(w,h,false);prevCam.aspect=w/h;prevCam.updateProjectionMatrix();}}
  const dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;prevYaw+=dt*.35;
  if(prevF){prevF.root.rotation.y=prevYaw;setPose(prevF,(DR.poseTest&&P[DR.poseTest]||P.idle)(t));}
  const close=!prevHelmet;prevCam.position.set(0,close?1.55:1.15,close?2.2:4.1);prevCam.lookAt(0,close?1.45:.92,0);
  R.render(prevScene,prevCam);prevLoop=requestAnimationFrame(loop);};prevLoop=requestAnimationFrame(loop);}}
function rebuildPreview(){if(!prevScene)return;prevF?.dispose();prevF=buildDriver(lookFor(dcPlayer(),dcTeam()));prevF.setHelmet(prevHelmet);prevScene.add(prevF.root);}
function refresh(focusKey){const panel=document.getElementById('dr82-panel');if(!panel)return;panel.innerHTML=panelHtml();rebuildPreview();
 const nm=document.querySelector('#dr82-stage .nm');if(nm){const m=me(),p=dcPlayer();nm.innerHTML=`${flagImg(m.nation,22)}<div>${esc(p.name)}<small>#${esc(p.number)} · ${esc(dcTeam().name)}</small></div>`;}
 if(focusKey){const el=document.querySelector(`#dr82-panel [data-k="${focusKey}"]`);el?.focus({preventScroll:true});}}
function save(){try{dcSave();}catch(_){}}
const cycle=(v,n,d)=>(v+d+n)%n;
Object.assign(DR,{
 step(k,d){const m=me(),p=dcPlayer();
  if(k==='nation'){const i=NATIONS.findIndex(x=>x[0]===m.nation);m.nation=NATIONS[cycle(Math.max(0,i),NATIONS.length,d)][0];}
  else if(k==='age')p.age=clamp((+p.age||24)+d,16,60);
  else if(k==='build')m.build=cycle(m.build,BUILD.length,d);else if(k==='hair')m.hair=cycle(m.hair,HAIR.length,d);else if(k==='beard')m.beard=cycle(m.beard,BEARD.length,d);
  else if(k==='pattern')m.helmet.pattern=cycle(m.helmet.pattern,PATTERN.length,d);else if(k==='visor')m.helmet.visor=cycle(m.helmet.visor,VISOR.length,d);
  else if(k==='suit'){m.suit.mode=m.suit.mode==='team'?'custom':'team';}
  save();refresh(document.activeElement?.dataset?.k===k?k:null);if(document.activeElement===document.body||!document.activeElement)document.querySelector(`#dr82-panel [data-k="${k}"][data-d="${d}"]`)?.focus();
  else{const el=document.querySelector(`#dr82-panel [data-k="${k}"][data-d="${d}"]`);el?.focus({preventScroll:true});}},
 pick(k,i){const m=me();
  if(k==='skin')m.skin=i;else if(k==='hairColor')m.hairColor=i;else if(k==='base')m.helmet.base=PALETTE[i];else if(k==='a1')m.helmet.a1=PALETTE[i];else if(k==='a2')m.helmet.a2=PALETTE[i];
  else if(k==='smain')m.suit.main=PALETTE[i];else if(k==='saccent')m.suit.accent=PALETTE[i];else if(k==='gloves')m.suit.gloves=PALETTE[i];
  save();refresh();document.querySelector(`#dr82-panel [data-k="${k}"][data-v="${i}"]`)?.focus({preventScroll:true});},
 text(k,v){const m=me(),p=dcPlayer();v=String(v).replace(/[<>]/g,'').trim();
  if(k==='first'&&v)m.first=v;if(k==='last')m.last=v;if(k==='home'){p.home=v;if(D.personal)D.personal.hometown=v;}
  if(k==='first'||k==='last'){const name=[m.first,m.last].filter(Boolean).join(' ').trim();if(name)p.name=name;}
  save();refresh();},
 random(){const m=me(),r=n=>Math.floor(Math.random()*n);m.helmet={...m.helmet,pattern:r(PATTERN.length),base:PALETTE[r(16)],a1:PALETTE[r(16)],a2:PALETTE[r(16)]};save();refresh('rand');},
 toggle(k){const m=me();m.scenes[k]=m.scenes[k]===false;save();refresh('sc-'+k);},
 helmet(){prevHelmet=!prevHelmet;prevF?.setHelmet(prevHelmet);const b=document.querySelector('[data-k="hm"]');if(b)b.textContent=prevHelmet?'Take helmet off':'Put helmet on';},
 turn(d){prevYaw+=d*.9;},
 watch(k){if(k==='podium'){const p=dcPlayer(),list=dcDrivers().map(x=>x.d).filter(d=>d.id!==p.id),order=[{number:p.number,name:p.name,position:1},...list.slice(0,2).map((d,i)=>({number:d.number,name:d.name,position:i+2}))];
   const e=dcEvent()||EVENTS[EVENTS.length-1];podiumScene({order,position:1,circuit:e?.circuit||e?.name||'',race:0},{kick:'Podium preview'}).then(()=>{mountPreview();});}
  else champScene({year:D.year}).then(()=>{mountPreview();});},
 podium:podiumScene,champ:champScene,world:runWorld,build:buildDriver,look:lookFor,me});

if(typeof dcHome==='function'){const base=dcHome;dcHome=function(){if(typeof dcTab!=='undefined'&&dcTab==='My Driver'&&hasCareer()){try{return pageHtml();}catch(e){console.warn('dr82 page',e);}}return base.apply(this,arguments);};}
if(typeof dcHeader==='function'){const base=dcHeader;dcHeader=function(){const html=base.apply(this,arguments);try{if(html.includes("dcNav('My Driver')"))return html;
 const on=typeof dcTab!=='undefined'&&dcTab==='My Driver';const b=`<button class="${on?'on':''}" onclick="dcNav('My Driver')"><span>☺</span>My Driver</button>`;
 const m=html.match(/<button class="[^"]*" onclick="dcNav\('Personal'\)">[\s\S]*?<\/button>/);return m?html.replace(m[0],m[0]+b):html;}catch(_){return html;}};}
if(typeof dcRender==='function'){const base=dcRender;dcRender=function(){const out=base.apply(this,arguments);try{if(typeof dcTab!=='undefined'&&dcTab==='My Driver'&&hasCareer()&&!(typeof live!=='undefined'&&live)){ensureCss();mountPreview();}}catch(e){console.warn('dr82 mount',e);}return out;};}
// A brand-new career opens My Driver first.
if(typeof dcCreate==='function'){const base=dcCreate;dcCreate=function(){const out=base.apply(this,arguments);try{if(hasCareer()){me();dcTab='My Driver';dcSave();dcRender();}}catch(e){console.warn('dr82 create',e);}return out;};}
ensureCss();
})();
