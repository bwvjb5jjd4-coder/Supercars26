// pn57: Settings slider for how often time penalties are handed out (Off / Rare / Some / Most / Full).
const PN57_LEVELS=['Off','Rare','Some','Most','Full'],PN57_CHANCE=[0,.2,.45,.75,1];
function pn57Level(){const v=D?.settings?.penaltyLevel;return Number.isInteger(v)&&v>=0&&v<=4?v:4}
function pn57Ok(){const c=PN57_CHANCE[pn57Level()];return c>=1?true:Math.random()<c}
const pn57Settings=dcSettingsFields;
dcSettingsFields=function(...args){const lv=pn57Level();return pn57Settings(...args)+`<div class="dc-field" style="margin-top:18px"><label>Time penalties · ${PN57_LEVELS[lv]}</label><input type="range" min="0" max="4" step="1" value="${lv}" oninput="D.settings.penaltyLevel=+this.value;this.previousElementSibling.textContent='Time penalties · '+PN57_LEVELS[this.value]" onchange="dcSave()"><p class="dc-note">How often race control hands out time penalties (track limits, contact, missed stops). Full is the original behaviour.</p></div>`};
