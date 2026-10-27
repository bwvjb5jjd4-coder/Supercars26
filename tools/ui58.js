/* ui58: Supercars 26 presentation in the style of a modern F1 game.
   Title screen, tile main menu, Career HQ tabs, broadcast race graphics, compact HUD with
   shift lights and a D-pad MFD, pre-race presentation, shared styling and menu sounds.
   Display only: no physics, save data or engine functions change behaviour. */
(()=>{'use strict';
const ASSET=/*UI58_ASSET*/{},TRACK_ART=/*UI58_TRACK*/{};
const portal=document.getElementById('ui26-portal'),root=document.getElementById('root');
if(!portal||!root||!window.UI26)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const L=()=>typeof live!=='undefined'?live:null;
const hasCareer=()=>typeof D!=='undefined'&&!!D;
const menuOpen=()=>!L()||L().paused;
const GEAR_TOP=[0,65,108,151,196,246,300],RPM_MAX=7500,RPM_IDLE=1050;
document.body.classList.add('u58');

/* ---------- Shared style ---------- */
const css=document.createElement('style');css.id='ui58-style';css.textContent=`
:root{--u58-red:#ff1e3c;--u58-red2:#b3001f;--u58-ink:#f4f6fa;--u58-dim:#9aa3b5;--u58-bg:#06070b;--u58-panel:#0d1018e8;--u58-line:#ffffff1f;--u58-purple:#b14cff;--u58-green:#19e07a;--u58-yellow:#ffd21e}
.u58 :focus{outline:none}
.u58 :focus-visible,.u58 .ui26-pad-focus{outline:3px solid #fff!important;outline-offset:3px!important;box-shadow:0 0 0 6px #ff1e3c88,0 0 26px #ff1e3c66!important;position:relative;z-index:3}
.u58 .ui26-pad-focus:not(input){transform:translateY(-2px)}
.u58 .dc-btn,.u58 .ui26-start,.u58 .ui26-link{font-family:'UI Rajdhani',sans-serif!important;letter-spacing:.06em;text-transform:uppercase}
.u58 .dc-btn{border-radius:2px!important}
.u58 .dc-btn.primary,.u58 .dc-btn.red{background:linear-gradient(100deg,var(--u58-red),var(--u58-red2))!important;border-color:transparent!important}
.u58 .dc-card,.u58 .dc-hero,.u58 .ui26-option,.u58 .ui26-collection-tile,.u58 .ui26-time-tile{border-radius:3px!important;background-image:linear-gradient(135deg,#ffffff0a,transparent 40%)!important}
.u58 .dc-card,.u58 .dc-hero{border-top:2px solid var(--u58-red)!important}
.u58 h1,.u58 h2,.u58 .dc-title{font-family:'UI Rajdhani',sans-serif!important;font-style:italic;letter-spacing:.01em}
.u58 .ui26-pad-b,.u58 .u58-btn{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:11px;font:700 11px 'UI Rajdhani',sans-serif;font-style:normal;background:#fff;color:#000;vertical-align:middle}
.u58-btn.a{background:#16c464;color:#fff}.u58-btn.b{background:#e8243c;color:#fff}.u58-btn.x{background:#1d7cf2;color:#fff}.u58-btn.y{background:#f2b705;color:#000}.u58-btn.bump{border-radius:4px;min-width:30px;background:#e9ecf2}
.u58-keys{display:flex;gap:18px;align-items:center;font:600 12px 'UI Inter',sans-serif;color:var(--u58-dim)}.u58-keys span{display:flex;gap:7px;align-items:center}
/* Title screen */
#ui26-portal.u58-on{background:var(--u58-bg)!important}
#ui26-portal.u58-on>header,#ui26-portal.u58-on>section.ui26-stage,#ui26-portal.u58-on>footer{display:none!important}
.u58-title,.u58-menu{position:fixed;inset:0;overflow:hidden;color:var(--u58-ink);font-family:'UI Inter',sans-serif;background:radial-gradient(ellipse 70% 55% at 62% 62%,#2a0d16 0,#0b0c12 55%,#040407 100%)}
.u58-garage{position:absolute;inset:0;perspective:1400px}
.u58-garage:before{content:'';position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(180deg,#0000,#0e1016 30%,#050507);border-top:1px solid #ffffff10}
.u58-garage:after{content:'';position:absolute;left:30%;top:-20%;width:60%;height:120%;background:conic-gradient(from 180deg at 50% 0,#0000 0 170deg,#ffffff14 176deg,#ffffff22 180deg,#ffffff14 184deg,#0000 190deg);filter:blur(6px);animation:u58beam 9s ease-in-out infinite alternate}
@keyframes u58beam{from{transform:translateX(-14%) rotate(-4deg)}to{transform:translateX(14%) rotate(4deg)}}
.u58-floorlight{position:absolute;left:28%;right:4%;bottom:14%;height:20%;background:radial-gradient(ellipse at 50% 50%,#ff1e3c40,#ff1e3c10 45%,#0000 70%);filter:blur(10px);animation:u58pulse 4s ease-in-out infinite}
@keyframes u58pulse{50%{opacity:.6}}
.u58-turntable{position:absolute;left:17%;right:-38%;bottom:-8%;display:grid;place-items:center;transform-style:preserve-3d;animation:u58turn 14s ease-in-out infinite}
@keyframes u58turn{0%{transform:rotateY(-11deg) translateX(-2%)}50%{transform:rotateY(11deg) translateX(2%)}100%{transform:rotateY(-11deg) translateX(-2%)}}
.u58-turntable img{width:100%;-webkit-box-reflect:below -6px linear-gradient(#0000 65%,#ffffff1c);filter:drop-shadow(0 40px 40px #000c) contrast(1.06)}
.u58-sweep{position:absolute;inset:0;background:linear-gradient(105deg,#0000 35%,#ffffff12 45%,#0000 55%);background-size:300% 100%;animation:u58sweep 7s linear infinite;mix-blend-mode:screen;pointer-events:none}
@keyframes u58sweep{from{background-position:120% 0}to{background-position:-120% 0}}
.u58-word{position:absolute;left:6vw;top:13vh;z-index:2}
.u58-word img{height:64px;display:block;margin-bottom:22px}
.u58-word h1{margin:0;font:700 clamp(64px,10.5vw,176px)/.82 'UI Rajdhani',sans-serif!important;font-style:italic!important;letter-spacing:-.01em;text-transform:uppercase;text-shadow:0 8px 40px #000}
.u58-word h1 b{display:block;color:var(--u58-red);font-size:1.2em}
.u58-word p{margin:20px 0 0;max-width:420px;color:var(--u58-dim);font-size:14px;line-height:1.6}
.u58-press{position:absolute;left:50%;bottom:9vh;transform:translateX(-50%);z-index:3;display:flex!important;align-items:center;gap:14px;padding:16px 34px!important;background:#000a!important;border:1px solid #ffffff2a!important;border-radius:2px!important;color:#fff!important;font:700 20px 'UI Rajdhani',sans-serif!important;letter-spacing:.32em;text-transform:uppercase;cursor:pointer}
.u58-press:not([disabled]){animation:u58blink 1.6s ease-in-out infinite}
.u58-press[disabled]{opacity:.65;cursor:wait;animation:none}
@keyframes u58blink{50%{opacity:.45}}
.u58-load{position:absolute;left:50%;bottom:5vh;transform:translateX(-50%);width:min(420px,70vw);z-index:3;font:600 10px 'UI Inter',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--u58-dim)}
.u58-load .ui26-loadline{height:2px;background:#ffffff18;margin-bottom:8px}.u58-load .ui26-loadline i{display:block;height:100%;background:var(--u58-red);transition:width .3s}
.u58-load>div{display:flex;justify-content:space-between}
.u58-load.done{opacity:0;transition:opacity .6s}
.u58-fan{position:absolute;right:28px;top:26px;z-index:3;font:700 10px 'UI Inter',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--u58-dim);border:1px solid #ffffff22;padding:7px 11px}
/* Tile main menu */
.u58-menu{display:flex;flex-direction:column;padding:28px 4vw 22px;background:radial-gradient(ellipse 60% 50% at 75% 40%,#2b0c16,#08090e 60%,#040407)}
.u58-menu:before{content:'26';position:absolute;right:-2vw;bottom:-14vh;font:700 54vw/1 'UI Rajdhani',sans-serif;font-style:italic;color:#ffffff05;pointer-events:none}
.u58-top{display:flex;align-items:center;gap:22px;position:relative;z-index:2}
.u58-top img{height:44px}.u58-top h2{margin:0;font:700 30px 'UI Rajdhani',sans-serif!important;font-style:italic!important;letter-spacing:.04em}.u58-top h2 b{color:var(--u58-red)}
.u58-tabs{display:flex;align-items:center;gap:6px;margin-left:34px}
.u58-tabs span.t{font:700 15px 'UI Rajdhani',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--u58-dim);padding:6px 14px;border-bottom:3px solid transparent}
.u58-tabs span.t.on{color:#fff;border-color:var(--u58-red)}
.u58-profile{margin-left:auto;display:flex;align-items:center;gap:12px;background:#ffffff0c;border:1px solid var(--u58-line);padding:8px 14px 8px 8px}
.u58-profile b{display:grid;place-items:center;width:38px;height:38px;background:var(--u58-red);font:700 20px 'UI Rajdhani',sans-serif;font-style:italic}
.u58-profile small{display:block;color:var(--u58-dim);font-size:11px}.u58-profile strong{font:700 15px 'UI Rajdhani',sans-serif;letter-spacing:.05em;text-transform:uppercase}
.u58-rail{position:relative;z-index:2;flex:1;display:flex;align-items:center;gap:18px;padding:3vh 1vw 0}
.u58-tile{position:relative;flex:1 1 0;min-width:0;height:min(58vh,560px);display:flex;flex-direction:column;justify-content:flex-end;padding:24px 22px!important;text-align:left;border:1px solid #ffffff1c!important;border-radius:0!important;background:linear-gradient(180deg,#151925 0,#0b0d14 100%)!important;color:#fff!important;cursor:pointer;overflow:hidden;transform:skewX(-6deg);transition:flex-grow .35s cubic-bezier(.2,.8,.2,1),border-color .2s,transform .2s;opacity:0;animation:u58in .55s cubic-bezier(.2,.8,.2,1) forwards}
.u58-tile:nth-child(2){animation-delay:.05s}.u58-tile:nth-child(3){animation-delay:.1s}.u58-tile:nth-child(4){animation-delay:.15s}.u58-tile:nth-child(5){animation-delay:.2s}.u58-tile:nth-child(6){animation-delay:.25s}
@keyframes u58in{from{opacity:0;transform:skewX(-6deg) translateX(60px)}to{opacity:1;transform:skewX(-6deg)}}
.u58-tile>*{transform:skewX(6deg)}
.u58-tile.big{flex-grow:1.8}
.u58-tile:focus,.u58-tile.ui26-pad-focus,.u58-tile:hover{flex-grow:2.3;border-color:#fff!important}
.u58 .u58-tile:focus-visible,.u58 .u58-tile.ui26-pad-focus{outline:0!important;box-shadow:inset 0 0 0 3px #fff,0 0 34px #ff1e3c88!important;transform:skewX(-6deg) translateY(-6px)}
.u58-tile .art{position:absolute;inset:0;transform:skewX(6deg) scale(1.15);background-size:cover;background-position:center 60%;opacity:.42;transition:opacity .3s,transform .6s}
.u58-tile:focus .art,.u58-tile.ui26-pad-focus .art,.u58-tile:hover .art{opacity:.9;transform:skewX(6deg) scale(1.22)}
.u58-tile .art.car{background-size:auto 46%;background-repeat:no-repeat;background-position:60% 42%;opacity:.55}
.u58-tile:focus .art.car,.u58-tile.ui26-pad-focus .art.car{background-size:auto 56%;opacity:1}
.u58-tile .shade{position:absolute;inset:0;background:linear-gradient(180deg,#0000 35%,#000d 92%);transform:none}
.u58-tile .num{position:absolute;top:18px;left:22px;font:700 13px 'UI Rajdhani',sans-serif;letter-spacing:.2em;color:var(--u58-red)}
.u58-tile .ico{position:absolute;top:50px;left:22px;width:46px;height:46px;color:#fff;opacity:.8}
.u58-tile strong{position:relative;display:block;font:700 clamp(19px,1.9vw,36px)/.95 'UI Rajdhani',sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:.01em;overflow-wrap:anywhere}
.u58-rail:has(.u58-tile:nth-child(7)) .u58-tile strong{font-size:clamp(14px,1.3vw,32px);overflow-wrap:normal}
.u58-tile small{position:relative;display:block;margin-top:8px;color:#cfd4df;font-size:12px;line-height:1.45;max-height:0;opacity:0;overflow:hidden;transition:max-height .3s,opacity .3s}
.u58-tile:focus small,.u58-tile.ui26-pad-focus small,.u58-tile:hover small{max-height:60px;opacity:1}
.u58-tile:after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--u58-red);transform:skewX(6deg) scaleX(0);transform-origin:left;transition:transform .3s}
.u58-tile:focus:after,.u58-tile.ui26-pad-focus:after,.u58-tile:hover:after{transform:skewX(6deg) scaleX(1)}
.u58-sub{position:relative;z-index:2;display:flex;gap:12px;padding:18px 1vw 0}
.u58-sub button{background:#ffffff0d!important;border:1px solid var(--u58-line)!important;color:#fff!important;padding:11px 18px!important;font:700 13px 'UI Rajdhani',sans-serif!important;letter-spacing:.14em;text-transform:uppercase;border-radius:0!important;cursor:pointer}
.u58-foot{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid var(--u58-line);margin-top:16px;font-size:11px;color:var(--u58-dim)}
@media(max-width:900px){.u58-rail{flex-direction:column;align-items:stretch;overflow:auto}.u58-tile{height:120px;flex:none!important;transform:none;animation:none;opacity:1}.u58-tile>*,.u58-tile .art{transform:none}.u58-tabs{display:none}}
/* Career HQ: tabs across the top, bumpers switch */
.u58 .dc-shell{display:block!important;padding-top:86px}
.u58 .dc-side{position:sticky!important;top:86px;z-index:60;width:auto!important;height:auto!important;inset:auto!important;display:flex!important;flex-direction:row!important;align-items:center;gap:10px;padding:0 4vw!important;background:#07080ded!important;border-bottom:1px solid var(--u58-line);backdrop-filter:blur(12px);box-shadow:none!important}
.u58 .dc-side>.dc-wordmark,.u58 .dc-side>.dc-footer{display:none!important}
.u58 .dc-side nav{display:flex!important;flex-direction:row!important;gap:2px!important;margin:0!important;padding:0!important;overflow-x:auto;scrollbar-width:none;flex:1}
.u58 .dc-side nav button{flex-shrink:0;white-space:nowrap;padding:16px 15px 13px!important;background:transparent!important;border:0!important;border-bottom:3px solid transparent!important;border-radius:0!important;color:var(--u58-dim)!important;font:700 14px 'UI Rajdhani',sans-serif!important;letter-spacing:.12em;text-transform:uppercase;box-shadow:none!important}
.u58 .dc-side nav button>span{display:none!important}
.u58 .dc-side nav button.on{color:#fff!important;border-bottom-color:var(--u58-red)!important;background:linear-gradient(0deg,#ff1e3c22,transparent)!important}
.u58 .dc-side .u58-btn.bump{flex-shrink:0}
.u58 .dc-main{padding:26px 4vw 60px!important;max-width:none!important}
.u58 .dc-hero{position:relative;overflow:hidden}
.u58 .dc-hero:before{content:'';position:absolute;inset:0;background:linear-gradient(100deg,var(--u58-team,#ff1e3c)33 0,transparent 55%);pointer-events:none}
/* Pause menu tabs */
.u58 .dc-pause-tabs button.on{background:var(--u58-red)!important;color:#fff!important}
.u58 .dc-pause-tabs{align-items:center}
/* Fallback pickers for any native select the tile adapter does not cover */
.u58-step{display:flex;align-items:stretch;gap:0;background:#0b0e16;border:1px solid #ffffff26;max-width:340px}
.u58-step button{background:transparent;border:0;color:#fff;font:700 18px 'UI Rajdhani',sans-serif;padding:6px 12px;cursor:pointer}
.u58-step .v{flex:1;font:600 12px 'UI Inter',sans-serif;text-align:center;padding:9px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
select.u58-hidden{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
/* ---------- Race: broadcast graphics ---------- */
.u58 .dc-live-order{top:96px!important;left:18px!important;width:236px!important;background:#000000b8!important;border:0!important;border-top:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:blur(6px)}
.u58 .dc-live-order .dc-live-head{background:linear-gradient(100deg,var(--u58-red),var(--u58-red2))!important;padding:7px 10px!important;display:flex;justify-content:space-between;align-items:center}
.u58 .dc-live-order .dc-live-round,.u58 .dc-live-order .dc-live-laps{font:700 15px 'UI Rajdhani',sans-serif!important;font-style:italic;letter-spacing:.06em;color:#fff!important}
.u58 .dc-live-order .dc-live-columns{display:none!important}
.u58 .dc-live-order .dc-live-row{background:transparent!important;border:0!important;border-bottom:1px solid #ffffff10!important;border-radius:0!important}
.u58 .dc-live-order .dc-live-row:nth-child(-n+3) .dc-live-pos{background:#fff;color:#000}
.u58 .dc-live-order .dc-live-row.mine{background:linear-gradient(90deg,#ffffff30,#ffffff08)!important;box-shadow:inset 3px 0 #fff}
.u58 .dc-live-order .dc-live-pos{font:700 13px 'UI Rajdhani',sans-serif!important;min-width:22px;text-align:center}
.u58 .dc-live-order .dc-live-name{font:700 13px 'UI Rajdhani',sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase}
.u58 .dc-live-order .dc-live-gap{font:600 12px 'UI Rajdhani',sans-serif!important;color:#d9dde6!important}
.u58 .dc-live-order .dc-live-foot{display:none!important}
#u58-bc{position:fixed;left:50%;top:158px;transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.u58-ban{display:flex;align-items:stretch;min-width:300px;background:#000000d0;color:#fff;font:700 15px 'UI Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase;animation:u58ban .35s cubic-bezier(.2,.8,.2,1);box-shadow:0 8px 30px #0008}
.u58-ban.out{animation:u58banout .3s forwards}
.u58-ban>b{display:grid;place-items:center;padding:0 12px;background:var(--u58-red);font-style:italic}
.u58-ban>span{padding:8px 14px;flex:1;white-space:nowrap}
.u58-ban>i{font-style:normal;padding:8px 14px;font-variant-numeric:tabular-nums}
.u58-ban.purple>b,.u58-ban.purple>i{background:var(--u58-purple)}.u58-ban.green>i{background:#0f8f4f}.u58-ban.yellow>b{background:var(--u58-yellow);color:#000}.u58-ban.rc>b{background:#1d2333}.u58-ban.sc>b,.u58-ban.sc>span{background:var(--u58-yellow);color:#000}.u58-ban.clear>b{background:var(--u58-green);color:#000}
@keyframes u58ban{from{opacity:0;transform:translateY(-14px) scaleX(.85)}}
@keyframes u58banout{to{opacity:0;transform:translateY(-10px)}}
#u58-lights{position:fixed;left:50%;top:22vh;transform:translateX(-50%);z-index:41;display:none;gap:14px;padding:14px 18px;background:#000c;border-radius:6px;pointer-events:none}
#u58-lights.on{display:flex}
#u58-lights i{width:46px;height:46px;border-radius:50%;background:#2a0005;box-shadow:inset 0 0 0 4px #111}
#u58-lights i.lit{background:radial-gradient(circle at 40% 35%,#ff8a8a,#ff1020 45%,#8a0010);box-shadow:0 0 26px #ff1020,inset 0 0 0 4px #111}
#u58-lights.go{background:transparent}#u58-lights.go i{display:none}
#u58-lights.go:after{content:'LIGHTS OUT';font:700 54px 'UI Rajdhani',sans-serif;font-style:italic;letter-spacing:.08em;color:#fff;text-shadow:0 4px 30px #000}
/* Compact HUD */
.u58 .dc-driving .dc-dash,.u58 .dc-driving .dc-rpm{display:none!important}
#u58-hud{position:fixed;right:26px;bottom:24px;z-index:30;display:grid;grid-template-columns:auto auto;gap:6px 14px;align-items:end;color:#fff;pointer-events:none;font-family:'UI Rajdhani',sans-serif}
#u58-hud .rev{grid-column:1/3;display:flex;gap:3px;justify-content:flex-end}
#u58-hud .rev i{width:15px;height:9px;transform:skewX(-14deg);background:#ffffff1c}
#u58-hud .rev i.g.on{background:#19e07a;box-shadow:0 0 10px #19e07a}#u58-hud .rev i.r.on{background:#ff2a3c;box-shadow:0 0 10px #ff2a3c}#u58-hud .rev i.b.on{background:#3b8cff;box-shadow:0 0 10px #3b8cff}
#u58-hud.shift .rev i.on{animation:u58flash .12s steps(2) infinite}
@keyframes u58flash{50%{opacity:.2}}
#u58-hud .gear{grid-row:2;font:700 86px/.8 'UI Rajdhani',sans-serif;font-style:italic;text-align:center;min-width:56px;text-shadow:0 4px 18px #000a}
#u58-hud .spd{grid-row:2;text-align:right;line-height:.85}
#u58-hud .spd b{display:block;font:700 54px/.85 'UI Rajdhani',sans-serif;font-style:italic;font-variant-numeric:tabular-nums;text-shadow:0 4px 18px #000a}
#u58-hud .spd small{font:600 11px 'UI Inter',sans-serif;letter-spacing:.2em;color:#cdd2dc}
#u58-hud .icons{grid-column:1/3;display:flex;gap:10px;justify-content:flex-end;font:700 12px 'UI Rajdhani',sans-serif;letter-spacing:.06em}
#u58-hud .icons span{display:flex;align-items:center;gap:5px;background:#000a;padding:4px 8px}
#u58-hud .icons svg{width:16px;height:16px}
#u58-hud .warn{color:#ffc043}
#u58-mfd{position:fixed;right:26px;bottom:178px;z-index:30;width:250px;background:#000000c4;color:#fff;font-family:'UI Rajdhani',sans-serif;pointer-events:none;backdrop-filter:blur(6px)}
#u58-mfd.off{display:none}
#u58-mfd .hd{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:linear-gradient(100deg,var(--u58-red),var(--u58-red2));font:700 13px 'UI Rajdhani',sans-serif;letter-spacing:.14em}
#u58-mfd .hd small{font:600 10px 'UI Inter',sans-serif;letter-spacing:.06em;opacity:.85}
#u58-mfd .rows{padding:6px 10px 8px}
#u58-mfd .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #ffffff12;font:600 14px 'UI Rajdhani',sans-serif;letter-spacing:.05em}
#u58-mfd .row:last-child{border:0}#u58-mfd .row span{color:#aab2c2}
.u58 .dc-driving .dc-minimap{top:136px!important;bottom:auto!important;right:18px!important;left:auto!important;width:230px!important;height:130px!important}
.u58 .dc-driving .dc-controls{right:auto!important;left:18px!important;bottom:14px!important;text-align:left!important;opacity:.7;font-size:9px!important;max-width:300px}
.u58-intro-on #u58-hud,.u58-intro-on #u58-mfd,.u58-intro-on .dc-live-order,.u58-intro-on .dc-statusbar,.u58-intro-on .dc-racehead,.u58-intro-on .dc-minimap,.u58-intro-on .dc-controls,.u58-intro-on .dc-radio{visibility:hidden!important}
.in55-hud-off #u58-hud,.in55-hud-off #u58-mfd{display:none!important}
/* Pre-race presentation */
#u58-intro{position:fixed;inset:0;z-index:45;pointer-events:none;background:linear-gradient(90deg,#000d 0,#0008 30%,#0000 55%),linear-gradient(0deg,#000a,#0000 30%);animation:u58fade .6s}
#u58-intro.out{animation:u58fadeout .6s forwards}
@keyframes u58fade{from{opacity:0}}@keyframes u58fadeout{to{opacity:0}}
#u58-intro .u58-card{position:absolute;left:5vw;top:16vh;width:min(440px,80vw);color:#fff;animation:u58slide .7s cubic-bezier(.2,.8,.2,1)}
@keyframes u58slide{from{opacity:0;transform:translateX(-60px)}}
#u58-intro .kick{display:inline-block;background:var(--u58-red);padding:5px 12px;font:700 13px 'UI Rajdhani',sans-serif;letter-spacing:.2em;text-transform:uppercase}
#u58-intro h1{margin:12px 0 4px;font:700 clamp(38px,4.6vw,66px)/.9 'UI Rajdhani',sans-serif!important;font-style:italic!important;text-transform:uppercase}
#u58-intro .loc{font:600 13px 'UI Inter',sans-serif;color:#cfd4df;letter-spacing:.08em;text-transform:uppercase}
#u58-intro svg.map{display:block;width:100%;max-width:330px;margin:20px 0 10px;color:#fff;filter:drop-shadow(0 0 12px #ff1e3c88)}
#u58-intro svg.map path{stroke-dasharray:900;stroke-dashoffset:900;animation:u58draw 2.6s .3s ease-out forwards}
@keyframes u58draw{to{stroke-dashoffset:0}}
#u58-intro .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#ffffff22;margin-top:8px}
#u58-intro .facts div{background:#000b;padding:10px 12px}
#u58-intro .facts small{display:block;font:600 10px 'UI Inter',sans-serif;letter-spacing:.16em;color:#aab2c2;text-transform:uppercase}
#u58-intro .facts b{font:700 22px 'UI Rajdhani',sans-serif;font-style:italic}
#u58-intro .skip{position:absolute;right:4vw;bottom:5vh;font:600 12px 'UI Inter',sans-serif;color:#dfe3ea;display:flex;gap:8px;align-items:center}
`;document.head.appendChild(css);

/* ---------- Menu sounds ---------- */
let actx=null,lastNav=0;
function sfx(kind){try{if(!actx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;actx=new A();}if(actx.state==='suspended')actx.resume();const vol=(hasCareer()?Number(D.settings?.volume??.35):.35)*.5;if(!(vol>0))return;const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain(),f=actx.createBiquadFilter();f.type='lowpass';f.frequency.value=4200;o.connect(f);f.connect(g);g.connect(actx.destination);
 const spec={move:['triangle',1320,1180,.045,.16],confirm:['square',880,1760,.11,.12],back:['triangle',660,330,.12,.16],tab:['triangle',990,1320,.07,.14]}[kind]||['triangle',1000,1000,.05,.1];
 o.type=spec[0];o.frequency.setValueAtTime(spec[1],t);o.frequency.exponentialRampToValueAtTime(spec[2],t+spec[3]);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*spec[4],t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+spec[3]+.04);o.start(t);o.stop(t+spec[3]+.06);}catch(_){}}
document.addEventListener('focusin',e=>{if(menuOpen()&&performance.now()-lastNav<220&&e.target.matches?.('button,input,summary,[tabindex]'))sfx('move');},true);
document.addEventListener('click',e=>{if(menuOpen()&&e.target.closest?.('button,summary'))sfx('confirm');},true);

/* ---------- Title screen and tile main menu ---------- */
const ICON={career:'<path d="M8 40V8m0 2c10-7 18 7 30 0v20c-12 7-20-7-30 0"/>',instant:'<path d="M27 4 10 27h13l-3 17 18-24H25z"/>',coop:'<circle cx="16" cy="15" r="6"/><circle cx="32" cy="15" r="6"/><path d="M5 40c0-8 5-13 11-13s11 5 11 13M21 40c0-8 5-13 11-13s11 5 11 13"/>',test:'<circle cx="24" cy="26" r="15"/><path d="M24 26l8-7M24 6v5M18 4h12"/>',garage:'<path d="M5 20 24 7l19 13v21H5z"/><path d="M13 41V27h22v14M13 33h22"/>',champ:'<path d="M15 6h18v9a9 9 0 0 1-18 0zM15 9H8a6 6 0 0 0 7 8m18-8h7a6 6 0 0 1-7 8M24 24v8m-8 9h16l-2-9H18z"/>',settings:'<circle cx="24" cy="24" r="6"/><path d="M24 4v6m0 28v6M4 24h6m28 0h6M10 10l4 4m20 20 4 4M10 38l4-4m20-20 4-4"/>'};
const icon=k=>`<svg class="ico" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
function profile(){try{if(!hasCareer())return null;const p=dcPlayer(),t=dcTeam();return {name:p.name,number:p.number,team:t.name,year:D.year,colour:t.livery?.primary};}catch(_){return null;}}
function carArt(n){return ASSET.cars?.[String(n)]||ASSET.car;}
function padHint(){return document.body.classList.contains('ui26-has-pad');}
function renderTitle(){portal.classList.add('u58-on');const was=$('ui26-enter'),ready=UI26.ready;
 const wrap=document.createElement('div');wrap.className='u58-title';wrap.dataset.u58='splash';
 wrap.innerHTML=`<div class="u58-garage"><div class="u58-floorlight"></div><div class="u58-turntable"><img src="${ASSET.car}" alt="Supercars 26 race car"></div><div class="u58-sweep"></div></div><span class="u58-fan">Unofficial fan project</span><div class="u58-word"><img src="${ASSET.logo}" alt="Supercars Championship"><h1>Supercars<b>26</b></h1><p>Your career. Your weekend. Touring car racing from the grid to the chequered flag.</p></div><button id="ui26-enter" class="u58-press" onclick="UI26.hub()" ${ready?'':'disabled'}><span>${ready?'Press start':'Preparing the paddock'}</span></button><div class="u58-load ${ready?'done':''}"><div class="ui26-loadline"><i id="ui26-progress" style="width:${was?.disabled===false?100:8}%"></i></div><div><span id="ui26-status">Loading vehicle library</span><span id="ui26-count"></span></div></div>`;
 portal.appendChild(wrap);}
function tiles(){const p=profile(),me=p?carArt(p.number):ASSET.car,list=[];
 list.push({k:'career',big:true,title:p?'Continue career':'Driver career',sub:p?`${p.name} · #${p.number} · ${p.team} · Season ${p.year}`:'Make your name, choose your seat and build a career.',art:me,car:true,go:()=>UI26.play('career')});
 list.push({k:'instant',title:'Instant race',sub:'Any car, any circuit, your conditions.',art:carArt(88),car:true,go:()=>UI26.play('instant')});
 list.push({k:'coop',title:'Co-Op',sub:'Split-screen race for two controllers. Shootout, then straight to the grid.',art:carArt(888),car:true,go:()=>window.CO63?.open()});
 if(p){list.push({k:'test',title:'Test day',sub:'Private running at the Test Centre. Learn the circuit.',go:()=>{UI26.close();dcNav('Test Centre');}});
  list.push({k:'garage',title:'Garage',sub:'Car management, upgrades and setup.',art:me,car:true,go:()=>{UI26.close();dcNav('Car Management');}});
  list.push({k:'champ',title:'Standings',sub:'Championship standings, results and the calendar.',go:()=>{UI26.close();dcNav('Championship');}});}
 list.push({k:'settings',title:'Settings',sub:p?'Handling, difficulty, audio, graphics and penalties.':'Start a career to unlock settings.',go:()=>p?UI26.play('settings'):UI26.about()});
 return list;}
let tileList=[];
function renderMenu(){portal.classList.add('u58-on');const p=profile();tileList=tiles();
 const wrap=document.createElement('div');wrap.className='u58-menu';wrap.dataset.u58='hub';
 wrap.innerHTML=`<div class="u58-top"><img src="${ASSET.logo}" alt="Supercars Championship"><h2>SUPERCARS <b>26</b></h2><div class="u58-tabs"><i class="u58-btn bump">LB</i><span class="t on">Play</span><span class="t">${p?'Career HQ':'Career'}</span><span class="t">Garage</span><span class="t">Settings</span><i class="u58-btn bump">RB</i></div>${p?`<div class="u58-profile"><b>${esc(p.number)}</b><div><strong>${esc(p.name)}</strong><small>${esc(p.team)}</small></div></div>`:'<span class="u58-fan" style="position:static;margin-left:auto">Unofficial fan project</span>'}</div>
 <div class="u58-rail">${tileList.map((t,i)=>`<button type="button" class="u58-tile ${t.big?'big':''}" data-i="${i}"><span class="art ${t.car?'car':''}" style="${t.art?`background-image:url('${esc(t.art)}')`:''}"></span><span class="shade"></span><span class="num">0${i+1}</span>${icon(t.k)}<strong>${esc(t.title)}</strong><small>${esc(t.sub)}</small></button>`).join('')}</div>
 <div class="u58-sub">${p?'<button type="button" data-act="new">Start a new career</button>':''}<button type="button" data-act="about">Controls &amp; credits</button></div>
 <div class="u58-foot"><div class="u58-keys"><span><i class="u58-btn a">A</i>Select</span><span><i class="u58-btn b">B</i>Back</span><span><i class="u58-btn bump">LB</i><i class="u58-btn bump">RB</i>Switch</span></div><span>Fan-made touring car racing · Not affiliated with Supercars, Repco, EA SPORTS or Formula 1</span></div>`;
 portal.appendChild(wrap);
 wrap.querySelectorAll('.u58-tile').forEach(b=>b.addEventListener('click',()=>tileList[+b.dataset.i]?.go()));
 wrap.querySelector('[data-act="new"]')?.addEventListener('click',()=>UI26.play('new'));
 wrap.querySelector('[data-act="about"]')?.addEventListener('click',()=>UI26.about());
 requestAnimationFrame(()=>{const first=wrap.querySelector('.u58-tile');if(first&&!wrap.contains(document.activeElement))first.focus({preventScroll:true});});}
function sync(){if(portal.hidden){portal.classList.remove('u58-on');return;}const page=UI26.page;if(page!=='splash'&&page!=='hub'){portal.classList.remove('u58-on');portal.querySelector('[data-u58]')?.remove();return;}
 const cur=portal.querySelector('[data-u58]');if(cur?.dataset.u58===page)return;cur?.remove();
 // UI26 owns the ids its loader updates; hide its copy so only ours is live.
 if(page==='splash'){const old=portal.querySelector('.ui26-stage #ui26-enter');old?.removeAttribute('id');portal.querySelector('#ui26-progress')?.removeAttribute('id');portal.querySelector('#ui26-status')?.removeAttribute('id');portal.querySelector('#ui26-count')?.removeAttribute('id');renderTitle();}
 else renderMenu();}
new MutationObserver(()=>queueMicrotask(sync)).observe(portal,{childList:true,attributes:true,attributeFilter:['hidden']});sync();
setInterval(()=>{const b=document.querySelector('.u58-title #ui26-enter');if(!b)return;const ready=!b.disabled;b.querySelector('span').innerHTML=ready?(padHint()?'Press <i class="u58-btn a">A</i> to start':'Press Enter to start'):'Preparing the paddock';document.querySelector('.u58-load')?.classList.toggle('done',ready);},250);
function moveTile(step){const t=[...portal.querySelectorAll('.u58-tile')];if(!t.length)return false;let i=t.indexOf(document.activeElement);i=i<0?0:(i+step+t.length)%t.length;lastNav=performance.now();t[i].focus({preventScroll:true});if(document.body.classList.contains('ui26-controller-active')){document.querySelector('.ui26-pad-focus')?.classList.remove('ui26-pad-focus');t[i].classList.add('ui26-pad-focus');}return true;}

/* ---------- Career HQ tabs and LB/RB ---------- */
function decorateCareer(){const side=root.querySelector('.dc-side');if(!side||side.querySelector('.u58-btn.bump'))return;const lb=document.createElement('i'),rb=document.createElement('i');lb.className=rb.className='u58-btn bump';lb.textContent='LB';rb.textContent='RB';side.prepend(lb);side.append(rb);const p=profile();if(p?.colour)root.querySelector('.dc-shell')?.style.setProperty('--u58-team',p.colour);}
new MutationObserver(()=>queueMicrotask(decorateCareer)).observe(root,{childList:true});
const PAUSE_TABS=['Options','Settings','Simulation','Leaderboard','Pit Options'];
function bumper(step){
 if(!menuOpen())return;lastNav=performance.now();
 const picker=$('ui26-picker');if(picker&&!picker.hidden)return;
 if(!portal.hidden){if(UI26.page==='hub'&&moveTile(step))sfx('tab');return;}
 const x=L();if(x?.paused&&typeof dcPauseTab!=='undefined'){const i=PAUSE_TABS.indexOf(dcPauseTab);dcPauseTab=PAUSE_TABS[(Math.max(0,i)+step+PAUSE_TABS.length)%PAUSE_TABS.length];dcPauseRender();sfx('tab');return;}
 if(root.querySelector('.dc-modal'))return;
 const TABS=['Home','Race Weekend','Car Management','Test Centre','Championship','Inbox','Personal','Contracts','Settings'],label=b=>[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),nav=[...root.querySelectorAll('.dc-side nav button')].filter(b=>TABS.includes(label(b)));if(!nav.length||typeof dcNav!=='function')return;
 let i=nav.findIndex(b=>b.classList.contains('on'));i=(Math.max(0,i)+step+nav.length)%nav.length;const target=label(nav[i]);{dcNav(target);sfx('tab');requestAnimationFrame(()=>{const on=root.querySelector('.dc-side nav button.on');if(on&&document.body.classList.contains('ui26-controller-active')){on.focus({preventScroll:true});}});}}
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))lastNav=performance.now();
 if(e.code==='Escape'&&menuOpen())sfx('back');
 if(!portal.hidden&&UI26.page==='hub'&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();moveTile(e.code==='ArrowRight'?1:-1);return;}
 if(!L()||L().paused){if(e.code==='KeyQ'){e.preventDefault();bumper(-1);}else if(e.code==='KeyE'){e.preventDefault();bumper(1);}}
 else if(e.code==='KeyM'&&!e.repeat){e.preventDefault();cycleMfd(1);}});

/* ---------- Controller: bumpers in menus, D-pad MFD on track, menu sounds ---------- */
let padPrev={};
function getPad(){try{return Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected)||null;}catch(_){return null;}}
setInterval(()=>{const pad=getPad();if(!pad){padPrev={};return;}const b=i=>!!pad.buttons[i]?.pressed,edge=i=>b(i)&&!padPrev[i];const ax=Math.abs(pad.axes[0]||0)>.55||Math.abs(pad.axes[1]||0)>.55;
 if(menuOpen()){if(ax||b(12)||b(13)||b(14)||b(15))lastNav=performance.now();if(edge(4))bumper(-1);if(edge(5))bumper(1);if(edge(1))sfx('back');}
 else{const x=L();if(x&&!x.paused&&x.dc){if(edge(15))cycleMfd(1);if(edge(14))cycleMfd(-1);}
  if(intro&&(edge(0)||(pad.buttons[7]?.value||0)>.25))endIntro();}
 for(const i of [0,1,4,5,7,12,13,14,15])padPrev[i]=b(i);},32);

/* ---------- Fallback picker for any native select left visible ---------- */
function stepSelect(s,dir){const opts=[...s.options].filter(o=>!o.disabled&&!o.hidden);if(!opts.length)return;let i=opts.findIndex(o=>o.value===s.value);i=(Math.max(0,i)+dir+opts.length)%opts.length;s.value=opts[i].value;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));}
function fixSelects(){for(const s of document.querySelectorAll('select:not(.ui26-native-select):not(.u58-hidden)')){if(!s.getClientRects().length&&!s.dataset.u58)continue;
  let host=s.nextElementSibling?.classList?.contains('u58-step')?s.nextElementSibling:null;
  if(!host){host=document.createElement('div');host.className='u58-step';host.setAttribute('role','group');host.setAttribute('aria-label',s.getAttribute('aria-label')||s.name||'Option');host.innerHTML='<button type="button" aria-label="Previous">‹</button><button type="button" class="v"></button><button type="button" aria-label="Next">›</button>';const [a,v,c]=host.children;a.onclick=()=>stepSelect(s,-1);v.onclick=()=>stepSelect(s,1);c.onclick=()=>stepSelect(s,1);s.after(host);s.dataset.u58='1';}
  s.classList.add('u58-hidden');s.tabIndex=-1;host.querySelector('.v').textContent=s.selectedOptions[0]?.textContent||'';}
 for(const h of document.querySelectorAll('.u58-step')){const s=h.previousElementSibling;if(s?.tagName==='SELECT')h.querySelector('.v').textContent=s.selectedOptions[0]?.textContent||'';else h.remove();}}
setInterval(()=>{fixSelects();const tabs=document.querySelector('.dc-pause-tabs');if(tabs&&!tabs.querySelector('.u58-btn')){tabs.insertAdjacentHTML('afterbegin','<i class="u58-btn bump">LB</i>');tabs.insertAdjacentHTML('beforeend','<i class="u58-btn bump">RB</i>');}},400);document.addEventListener('change',e=>{if(e.target.tagName==='SELECT')queueMicrotask(fixSelects);});

/* ---------- Race: HUD, MFD, broadcast banners, start lights, intro ---------- */
const MFD_PAGES=['TIMING','CAR','CONDITIONS','OFF'];
function mfdPage(){const v=hasCareer()?D.settings.ui58Mfd:0;return Number.isInteger(v)&&v>=0&&v<MFD_PAGES.length?v:0;}
function cycleMfd(dir){if(!hasCareer())return;D.settings.ui58Mfd=(mfdPage()+dir+MFD_PAGES.length)%MFD_PAGES.length;mfdSig='';paint(true);}
let hud=null,mfd=null,bc=null,lights=null,state=null,mfdSig='';
function ensureRaceDom(){const drive=root.querySelector('.dc-driving');if(!drive)return false;if(hud?.isConnected)return true;
 hud=document.createElement('div');hud.id='u58-hud';hud.innerHTML=`<div class="rev">${Array.from({length:15},(_,i)=>`<i class="${i<5?'g':i<10?'r':'b'}"></i>`).join('')}</div><div class="gear">N</div><div class="spd"><b>0</b><small>KM/H</small></div><div class="icons"><span class="tyre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg><em>—</em></span><span class="fuel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M15 9h2l2 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg><em>—</em></span><span class="dmg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 2 20h20zM12 10v4m0 3v.5"/></svg><em>—</em></span></div>`;
 mfd=document.createElement('div');mfd.id='u58-mfd';bc=document.createElement('div');bc.id='u58-bc';lights=document.createElement('div');lights.id='u58-lights';lights.innerHTML='<i></i><i></i><i></i><i></i><i></i>';
 drive.append(hud,mfd,bc,lights);mfdSig='';return true;}
function banner(cls,tag,text,value,ms=3600){if(!bc?.isConnected)return;const el=document.createElement('div');el.className='u58-ban '+cls;el.innerHTML=`<b>${esc(tag)}</b><span>${esc(text)}</span>${value?`<i>${esc(value)}</i>`:''}`;bc.appendChild(el);while(bc.children.length>3)bc.firstElementChild.remove();setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),320);},ms);}
const fmt=t=>typeof dcLapTime==='function'?dcLapTime(t):t.toFixed(3);
const delta=d=>(d<0?'−':'+')+Math.abs(d).toFixed(3);
const txt=id=>($(id)?.textContent||'—').trim();
function shortName(n){const parts=String(n||'').trim().split(/\s+/);return parts.length>1?parts[0][0]+'. '+parts.slice(1).join(' '):parts[0];}
function rpmOf(x){let g='N';try{g=String(dcGear(x));}catch(_){}const speed=Math.abs(x.speed||0),n=+g;if(!(n>0))return {g,r:RPM_IDLE+(x.throttle||0)*4200};let r=speed/GEAR_TOP[Math.min(n,6)]*(RPM_MAX-150);if(n===1&&speed<30)r=Math.max(r,RPM_IDLE+(x.throttle||0)*(3600-speed*40));return {g,r:Math.max(RPM_IDLE,Math.min(RPM_MAX,r))};}
function paint(force){const x=L();if(!x?.dc||!x.player){state=null;return;}if(!ensureRaceDom())return;const p=x.player;
 if(!state||state.L!==x)state={L:x,lapT0:null,floor:Math.floor(p.progress),sector:0,secT0:null,best:[Infinity,Infinity,Infinity],bestLap:Infinity,fast:Infinity,started:x.started,sc:!!x.scTrain,goAt:0,introDone:false};
 const wear=txt('dc-wear'),fuel=txt('dc-fuel'),dmg=txt('dc-damage');const ic=hud.querySelector('.icons');ic.querySelector('.tyre em').textContent=wear;ic.querySelector('.fuel em').textContent=fuel;ic.querySelector('.dmg em').textContent=dmg;ic.querySelector('.fuel').classList.toggle('warn',(p.fuel??100)<20);ic.querySelector('.dmg').classList.toggle('warn',(p.bodyDamage||0)>20);
 // MFD
 const page=mfdPage(),rows=page===0?[['Car ahead',txt('dc-ahead')],['Car behind',txt('dc-behind')],['Position',txt('dc-position')],['Best lap',state.bestLap<Infinity?fmt(state.bestLap):txt('dc-best')]]:page===1?[['Fuel',fuel],['Tyre wear',wear],['Tyre',p.tyre||'—'],['Damage',dmg],['Pit request',p.pitNow?'BOX THIS LAP':'—']]:page===2?[['Weather',x.weather||'—'],['Session',txt('dc-session-clock')],['Headlights',['Off','Low beam','High beam'][x.lights]||'—'],['Wipers',['Off','Low','High'][x.wipers]||'—']]:[];
 const sig=page+'|'+rows.map(r=>r.join(':')).join('|');if(force||sig!==mfdSig){mfdSig=sig;mfd.classList.toggle('off',page===3);mfd.innerHTML=page===3?'':`<div class="hd">${MFD_PAGES[page]}<small>◀ D-pad ▶ · M</small></div><div class="rows">${rows.map(([k,v])=>`<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;}
 // Tower: F1-style short names
 for(const n of root.querySelectorAll('.dc-live-name:not([data-u58])')){n.dataset.u58='';n.title=n.textContent;n.textContent=shortName(n.textContent);}
 // Safety car
 if(!!x.scTrain!==state.sc){state.sc=!!x.scTrain;state.sc?banner('sc','SC','Safety car deployed','',5000):banner('clear','GREEN','Track clear · racing resumes','',4000);}
 // Fastest lap across the field (timed sessions and race bests)
 const fl=fastest(x);if(fl<state.fast&&x.elapsed>5){const was=state.fast;state.fast=fl;if(was<Infinity){const who=x.entrants.find(e=>e.best===fl);if(who&&who!==p)banner('purple','⏱',`Fastest lap · #${who.d.number} ${shortName(who.d.name)}`,fmt(fl),4200);}}
 }
function paintFast(){const x=L();if(!x?.dc||!x.player||!state||state.L!==x||!hud?.isConnected)return;const p=x.player;
 // HUD
 const {g,r}=rpmOf(p),frac=(r-RPM_IDLE)/(RPM_MAX-RPM_IDLE),lit=Math.round(Math.max(0,Math.min(1,(frac-.35)/.6))*15);
 const spd=Math.round(Math.abs(p.speed||0)),c=hud._c||(hud._c={gear:hud.querySelector('.gear'),spd:hud.querySelector('.spd b'),leds:[...hud.querySelectorAll('.rev i')]});
 if(c.g!==g){c.g=g;c.gear.textContent=g;}if(c.s!==spd){c.s=spd;c.spd.textContent=spd;}if(c.l!==lit){c.l=lit;c.leds.forEach((n,i)=>n.classList.toggle('on',i<lit));hud.classList.toggle('shift',lit>=15);}
 // Start lights
 if(x.stage==='race'&&!x.started&&x.gridReady){const on=Math.max(0,Math.min(5,Math.floor(5.0001-x.countdown)+1));lights.className='on';lights.querySelectorAll('i').forEach((n,i)=>n.classList.toggle('lit',i<on));}
 else if(x.started&&!state.started&&x.stage==='race'){state.goAt=performance.now();lights.className='on go';state.lapT0=x.elapsed;state.secT0=x.elapsed;state.sector=0;}
 else if(state.goAt&&performance.now()-state.goAt>1600){lights.className='';state.goAt=0;}
 else if(!state.goAt)lights.className='';
 state.started=x.started;
 // Sectors and laps (player)
 if(!x.paused&&!x.simulated){const f=Math.floor(p.progress),fr=p.progress-f;
  if(f>state.floor){if(state.lapT0!=null&&p.progress>=1){const lap=x.elapsed-state.lapT0;if(lap>15){if(state.secT0!=null&&state.sector===2){const s3=x.elapsed-state.secT0;sectorBanner(2,s3);}const pb=lap<state.bestLap,prev=state.bestLap;state.bestLap=Math.min(state.bestLap,lap);const overall=lap<=fastest(x)+1e-6;banner(overall?'purple':pb?'green':'','LAP '+(f),overall?'Fastest lap':pb?'Personal best':'Lap time',fmt(lap)+(prev<Infinity?'  '+delta(lap-prev):''),3800);}}
   state.lapT0=x.elapsed;state.secT0=x.elapsed;state.sector=0;state.floor=f;}
  else if(f<state.floor)state.floor=f;
  if(state.secT0!=null&&state.lapT0!=null){const want=fr>=2/3?2:fr>=1/3?1:0;if(want===state.sector+1){const t=x.elapsed-state.secT0;sectorBanner(state.sector,t);state.secT0=x.elapsed;state.sector=want;}else if(want>state.sector){state.sector=want;state.secT0=null;}}}
}
function fastest(x){let m=Infinity;for(const e of x.entrants)if(Number.isFinite(e.best)&&e.best>0)m=Math.min(m,e.best);return Math.min(m,state?.bestLap??Infinity);}
function sectorBanner(i,t){if(!(t>2))return;const best=state.best[i],cls=t<best?(best<Infinity?'green':'yellow'):'yellow';const d=best<Infinity?'  '+delta(t-best):'';state.best[i]=Math.min(best,t);banner(cls==='yellow'?'yellow':'green','S'+(i+1),'Sector '+(i+1),fmt(t).replace(/^0:/,'')+d,2600);}
(function fastLoop(){try{paintFast();}catch(e){}requestAnimationFrame(fastLoop);})();
if(typeof dcPaintHUD==='function'){const base=dcPaintHUD;dcPaintHUD=function(){base.apply(this,arguments);try{paint(false);}catch(e){console.warn('ui58 hud',e);}};}
if(typeof dcRadio==='function'){const base=dcRadio;dcRadio=function(from,msg){const out=base.apply(this,arguments);try{if(/race control/i.test(from)&&live?.dc)banner('rc','RACE CONTROL',String(msg).replace(/\.$/,''),'',5200);}catch(_){}return out;};}

/* Pre-race presentation: circuit card and an overhead orbit of the circuit before the session */
let intro=null;
function startIntro(x){const W=typeof sc25Engine!=='undefined'?sc25Engine:null;if(!W?.orbit)return;const e=x.e,stage=x.stage==='race'?`Race ${(D.weekend?.race||0)+1}`:x.test?'Test day':x.stage==='shootout'?'Top ten shootout':x.stage[0].toUpperCase()+x.stage.slice(1);
 const grid=x.stage==='race'?x.entrants.indexOf(x.player)+1:null,round=EVENTS.findIndex(v=>v.id===e.id)+1;
 const el=document.createElement('div');el.id='u58-intro';el.innerHTML=`<div class="u58-card"><span class="kick">${x.test||!round?esc(stage):'Round '+round+' · '+esc(stage)}</span><h1>${esc(e.circuit||e.name)}</h1><div class="loc">${esc(e.name||'')}${e.lengthKm?' · '+e.lengthKm.toFixed(3)+' km':''}</div>${TRACK_ART[String(e.id)]?`<svg class="map" viewBox="0 0 120 100"><path d="${TRACK_ART[String(e.id)]}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>`:''}<div class="facts"><div><small>Weather</small><b>${esc(x.weather==='Extremely Wet'?'Heavy rain':x.weather)}</b></div><div><small>${x.stage==='race'?'Laps':'Timed laps'}</small><b>${x.laps}</b></div><div><small>${grid?'Grid':'Field'}</small><b>${grid?'P'+grid:x.entrants.length}</b></div></div></div><div class="skip"><i class="u58-btn a">A</i> / Enter / RT · Skip</div>`;
 root.querySelector('.dc-driving')?.appendChild(el);document.body.classList.add('u58-intro-on');
 const prev=typeof sc25Camera!=='undefined'?sc25Camera:'onboard',O=typeof irOrbit==='function'?irOrbit(W):W.orbit,o={yaw:O.yaw,pitch:O.pitch,distance:O.distance},t0=performance.now(),dur=window.UI58_INTRO_S||8,ease=k=>1-Math.pow(1-k,3);
 sc25Camera='orbit';W.cameraCut=true;
 // Swoop from a high wide shot down onto the car, circling it, like a grid broadcast.
 intro={el,tick(){const t=(performance.now()-t0)/1000,k=ease(Math.min(1,t/Math.min(dur,7)));O.yaw=o.yaw+(1-k)*2.6+t*.05;O.pitch=.62+(Math.max(.12,o.pitch)-.62)*k;O.distance=34+(Math.max(7,o.distance||8)-34)*k;if(t>dur)endIntro();},end(){sc25Camera=prev;if(hasCareer())D.settings.camera=prev;Object.assign(O,o);W.cameraCut=true;el.classList.add('out');document.body.classList.remove('u58-intro-on');setTimeout(()=>el.remove(),650);}};
 const raf=()=>{if(!intro)return;intro.tick();requestAnimationFrame(raf);};requestAnimationFrame(raf);}
function endIntro(){const i=intro;intro=null;i?.end();}
document.addEventListener('keydown',e=>{if(intro&&['Enter','Space','KeyW','ArrowUp','Escape'].includes(e.code))endIntro();},true);
let introFor=null;
setInterval(()=>{const x=L();if(!x?.dc){introFor=null;if(intro)endIntro();return;}if(introFor===x)return;
 if(x.simulated||x.paused||!root.querySelector('.dc-driving'))return;if(document.querySelector('.ui26-engine-loading'))return;
 const W=typeof sc25Engine!=='undefined'?sc25Engine:null;if(!W?.scene)return;introFor=x;if(x.started&&x.stage==='race'&&x.elapsed>3)return;try{startIntro(x);}catch(e){console.warn('ui58 intro',e);}},200);
window.UI58={asset:ASSET,track:TRACK_ART,banner,cycleMfd,endIntro,paint(){paint(true);paintFast();},get intro(){return !!intro;}};
})();
