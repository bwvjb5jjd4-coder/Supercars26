// wx57: choose the weather for driver-career sessions (Forecast keeps the original weekend forecast).
const WX57_OPTS=[['forecast','Forecast · weekend default'],['Dry','Dry'],['Wet','Wet'],['Extremely Wet','Ultra wet']];
const wx57SessionWeather=dcSessionWeather;
dcSessionWeather=function(...args){const v=D?.settings?.careerWeather;return v&&v!=='forecast'?v:wx57SessionWeather(...args)};
const wx57Settings=dcSettingsFields;
dcSettingsFields=function(...args){const cur=D.settings.careerWeather||'forecast';return wx57Settings(...args)+`<div class="dc-field" style="margin-top:18px"><label>Career weather</label><select onchange="D.settings.careerWeather=this.value;dcSave()">${WX57_OPTS.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${l}</option>`).join('')}</select><p class="dc-note">Sets the conditions for every career practice, qualifying and race. Changes apply from the next session.</p></div>`};
