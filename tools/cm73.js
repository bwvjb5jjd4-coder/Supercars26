/* cm73 · Camera look that never freezes.
   Every session reuses one shared 3D canvas, but the old mouse-look, orbit-drag and double-click
   handlers were bound to that canvas once, on the first session of the page, and kept pointing at
   that first (now disposed) world. From the second session on, dragging moved a dead camera, so
   look-around stopped working until the page was reloaded. This layer replaces dcBindMouseLook with
   one set of handlers that always act on the live world (sc25Engine), and also:
   - ends the pre-race orbit intro when you click the view, instead of ignoring the drag
   - drops a drag whose button-up was missed (mouse released outside the window, focus lost)
   - stops the old circuit-preview handlers on the shared canvas from flipping the camera to orbit
   - adds right-stick look on a controller: cockpit, follow and bonnet views spring back to the
     front when the stick is released; the orbit view stays where you leave it. */
(()=>{'use strict';
if(typeof dcBindMouseLook!=='function')return;
const world=()=>{const W=typeof sc25Engine!=='undefined'?sc25Engine:null;return W&&!W.dead?W:null;};
const driving=()=>!!(typeof live!=='undefined'&&live?.dc);
const orbitCam=()=>typeof sc25Camera!=='undefined'&&sc25Camera==='orbit';
const look=W=>W.mouseLook||(W.mouseLook={yaw:0,pitch:0});
const orbit=W=>typeof irOrbit==='function'?irOrbit(W):W.orbit;
const saveOrbit=W=>{if(W.dead||!D?.settings)return;D.settings.orbit={...orbit(W)};dcSave();};
const wrapYaw=y=>((y%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
let drag=null;

function turn(W,dx,dy){
 if(orbitCam()){const o=orbit(W);o.yaw=wrapYaw(o.yaw-dx*.006);o.pitch=clamp(o.pitch+dy*.005,.04,1.43);return;}
 const m=look(W);m.yaw=clamp(m.yaw+dx*.004,-Math.PI,Math.PI);m.pitch=clamp(m.pitch-dy*.004,-1.2,1.2);
}
function endDrag(c,e){const d=drag;drag=null;try{if(e&&c.hasPointerCapture?.(e.pointerId))c.releasePointerCapture(e.pointerId);}catch(_){}
 if(d?.orbit&&d.W===world())saveOrbit(d.W);}

function bind(c){
 if(!c||c.__cm73)return;c.__cm73=true;
 // Capture listeners on the canvas run before every older listener, so in a session they own the view.
 const mine=e=>{const W=world();if(!driving()||!W||W.renderer.domElement!==c)return null;e.stopImmediatePropagation();return W;};
 c.addEventListener('pointerdown',e=>{const W=mine(e);if(!W||e.button!==0)return;e.preventDefault();
  if(window.UI58?.intro)UI58.endIntro();
  try{c.setPointerCapture(e.pointerId);}catch(_){}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,W,orbit:orbitCam()};},{capture:true});
 c.addEventListener('pointermove',e=>{const W=mine(e);if(!W||!drag||drag.id!==e.pointerId)return;
  if(drag.W!==W||(e.pointerType==='mouse'&&!(e.buttons&1))){endDrag(c,e);return;}
  e.preventDefault();turn(W,e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;},{capture:true});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])
  c.addEventListener(type,e=>{if(driving())e.stopImmediatePropagation();if(drag&&drag.id===e.pointerId)endDrag(c,type==='lostpointercapture'?null:e);},{capture:true});
 c.addEventListener('wheel',e=>{const W=mine(e);if(!W)return;e.preventDefault();if(!orbitCam())return;
  const o=orbit(W);o.distance=clamp(o.distance*Math.exp(clamp(e.deltaY,-300,300)*.0015),2.8,35);
  clearTimeout(W.irOrbitSave);W.irOrbitSave=setTimeout(()=>saveOrbit(W),180);},{capture:true,passive:false});
 c.addEventListener('dblclick',e=>{const W=mine(e);if(!W)return;e.preventDefault();
  if(orbitCam()){W.irOrbit={yaw:Math.PI+.6,pitch:.28,distance:8};saveOrbit(W);}else W.mouseLook={yaw:0,pitch:0};},{capture:true});
}

dcBindMouseLook=function(W){if(!W?.renderer)return;W.mouseLook={yaw:0,pitch:0};W.__dcDrag=null;W.irOrbitDrag=null;stick.W=null;bind(W.renderer.domElement);};
window.addEventListener('blur',()=>{drag=null;});

/* Right stick look. The stick's share of the look angle is tracked separately, so letting go returns
   the view to wherever the mouse left it. */
const stick={W:null,yaw:0,pitch:0,t:0};
function pad(){try{return Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.axes?.length>=4)||null;}catch(_){return null;}}
const dz=v=>{v=Number(v)||0;const a=Math.abs(v);return a<.18?0:Math.sign(v)*(a-.18)/.82;};
(function tick(now){requestAnimationFrame(tick);
 const dt=Math.min(.1,Math.max(0,(now-(stick.t||now))/1000));stick.t=now;
 const W=world();if(!W||!driving()){stick.W=null;return;}
 if(stick.W!==W){stick.W=W;stick.yaw=stick.pitch=0;}
 const L=live,p=(L.paused||window.CO63?.race||window.UI58?.intro)?null:pad();
 const x=p?dz(p.axes[2]):0,y=p?dz(p.axes[3]):0;
 if(orbitCam()){if(x||y){const o=orbit(W);o.yaw=wrapYaw(o.yaw-x*2.6*dt);o.pitch=clamp(o.pitch+y*1.6*dt,.04,1.43);stick.dirty=true;}
  else if(stick.dirty){stick.dirty=false;saveOrbit(W);}
  return;}
 const m=look(W),k=1-Math.exp(-dt*(x||y?10:7)),ty=-x*1.9,tp=-y*.75,ny=stick.yaw+(ty-stick.yaw)*k,np=stick.pitch+(tp-stick.pitch)*k;
 if(Math.abs(ny-stick.yaw)<1e-5&&Math.abs(np-stick.pitch)<1e-5)return;
 m.yaw=clamp(m.yaw+ny-stick.yaw,-Math.PI,Math.PI);m.pitch=clamp(m.pitch+np-stick.pitch,-1.2,1.2);stick.yaw=ny;stick.pitch=np;
})(performance.now());
})();
