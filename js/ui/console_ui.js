/* MISSY-style shared navigation, animal shortcuts and instrument/voice footer. */
(function(R2){
  'use strict';
  const animals=['🐀','🐂','🐅','🐇','🐉','🐍','🐎','🐐','🐒','🐓','🐕','🐖'];
  const defaults=['roles','technician','quality','sounds','alerts','voice','levels','status','loading','back','sources','downloads'];
  const names={technician:['Technician bench','技术员工作台'],sources:['Sources and credits','来源与致谢'],downloads:['Website download','网站下载'],roles:['Choose role','选择角色'],levels:['Choose level','选择级别'],quality:['Quality manager','质量管理'],sounds:['Sounds','声音'],alerts:['Alert panel','警报面板'],voice:['Microphone settings','麦克风设置'],status:['Computer status','计算机状态'],back:['Go back','返回'],loading:['Back to loading screen','返回加载画面']};
  let shortcuts=defaults.slice(),bar,utility,settings,voiceDialog,timer,previousOpen=new Set();
  const zh=()=>R2.i18n?.language==='zh',t=(en,cn)=>zh()?cn:en, label=id=>names[id]?.[zh()?1:0]||id;
  const top=()=>R2.voiceConsole.topDialog();
  try{const v=JSON.parse(localStorage.getItem('missy-r2-animal-shortcuts-v1'));if(Array.isArray(v)&&v.length===12&&v.every(x=>names[x]))shortcuts=v;}catch{}
  function changeRoute(hash){if(R2.batchRuns?.busy()){R2.voiceConsole.setStatus('Finish or stop the current batch before leaving.');return;}
    R2.voiceConsole.stopRecognition();if(!R2Boot.entered)R2Boot.enter();for(const d of [...document.querySelectorAll('dialog[open]')].reverse())d.close();location.hash=hash;}
  function back(){
    const d=top();if(d){
      const b=d.querySelector('#vi-back,#studio-back,.batch-close,.picker-back,[data-act="close"],[data-console-close],[data-close],#access-hub');
      if(b){if(!b.disabled)b.click();else R2.voiceConsole.setStatus('Finish or stop the current batch before leaving.');return;}
      if(d.id==='r2-transfer-loading'){R2.voiceConsole.setStatus('Wait for the transfer to finish or use its cancel control.');return;}
      if(R2.batchRuns?.busy())return;d.close();return;
    }
    if(document.getElementById('run-leave')?.getClientRects().length&&document.getElementById('run-stage')?.classList.contains('fs')){document.getElementById('run-leave').click();return;}
    if(R2Boot.entered){if(/^#technician\//.test(location.hash))location.hash='technician';else if(!['','#home'].includes(location.hash))location.hash='home';else loading();}
  }
  function loading(){if(R2.batchRuns?.busy()){R2.voiceConsole.setStatus('Finish or stop the current batch before leaving.');return;}for(const d of [...document.querySelectorAll('dialog[open]')].reverse())d.close();R2.voiceConsole.stopRecognition();R2Boot.showLoading();}
  function go(id){if(id==='sources'){window.open('credits.html','_blank');return;}if(id==='downloads'){loading();document.querySelector('[data-download-website]')?.scrollIntoView({block:'center'});return;}if(id==='technician'){changeRoute(R2.techAccess.highest()?'technician/'+R2.techAccess.highest():'technician');return;}if(id==='back')return back();if(id==='sounds')return R2.sound.open();if(id==='alerts')return R2.annunciator.open();if(id==='voice')return voiceSettings();if(id==='status')return statusPanel();if(id==='loading')return loading();changeRoute(id==='levels'?'technician':id==='quality'?'quality':'home');}
  function command(raw,spoken=false){
    if(spoken&&!/^\s*(?:computer|missy)(?=[\s,.:!?，。：！？-]|$)/i.test(String(raw))){R2.voiceConsole.setStatus("Begin spoken commands with Computer or Missy.");return false;}
    const s=String(raw).toLowerCase().replace(/^(?:computer|missy)[,\s:]*/,'').replace(/[.!?。！？]+$/,'').trim();
    const lookup={'go back':'back','back':'back','返回':'back','choose role':'roles','选择角色':'roles','choose level':'levels','选择级别':'levels','quality manager':'quality','质量管理':'quality','sounds':'sounds','声音':'sounds','alerts':'alerts','警报':'alerts','microphone settings':'voice','麦克风设置':'voice','computer status':'status','计算机状态':'status','loading screen':'loading'};
    if(s==='stop'||s==='停止'){R2.voiceConsole.stopRecognition();return true;}if(s==='english'){R2.i18n.set('en');return true;}if(s==='chinese'||s==='中文'){R2.i18n.set('zh');return true;}
    if(lookup[s]){go(lookup[s]);return true;}R2.voiceConsole.setStatus('Command not recognised. Use the buttons.');return false;
  }
  function shortPaint(){const friends=bar.querySelector('.r2-animals');friends.replaceChildren();
    animals.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a;b.title=label(shortcuts[i]);b.setAttribute('aria-label',a+' '+label(shortcuts[i]));b.onclick=()=>{b.classList.remove('is-playing');void b.offsetWidth;b.classList.add('is-playing');go(shortcuts[i]);};friends.append(b);});
    const config=document.createElement('button');config.type='button';config.textContent='⚙';config.title=t('Configure shortcuts','配置快捷方式');config.setAttribute('aria-label',config.title);config.onclick=shortcutSettings;friends.append(config);}
  function makeDialog(id,title){const d=document.createElement('dialog');d.id=id;d.className='r2-utility-dialog';d.dataset.i18nSkip='';d.innerHTML=`<header><h2>${title}</h2><button type="button" data-console-close>${t('Go back','返回')}</button></header><div class="r2-utility-body"></div>`;d.querySelector('[data-console-close]').onclick=()=>d.close();document.body.append(d);return d;}
  function shortcutSettings(){
    if(!settings)settings=makeDialog('r2-animal-settings',t('Animal shortcuts','动物快捷方式'));settings.querySelector('h2').textContent=t('Animal shortcuts','动物快捷方式');settings.querySelector('[data-console-close]').textContent=t('Go back','返回');const body=settings.querySelector('.r2-utility-body');body.replaceChildren();
    const form=document.createElement('form');form.className='r2-shortcut-grid';animals.forEach((a,i)=>{const l=document.createElement('label');l.append(document.createTextNode(a+' '));const select=document.createElement('select');select.setAttribute('aria-label',t('Destination ','目标 ')+(i+1));for(const key of Object.keys(names))select.add(new Option(label(key),key));select.value=shortcuts[i];l.append(select);form.append(l);});
    const reset=document.createElement('button');reset.type='button';reset.textContent=t('Restore defaults','恢复默认');reset.onclick=()=>form.querySelectorAll('select').forEach((s,i)=>s.value=defaults[i]);
    const save=document.createElement('button');save.type='button';save.textContent=t('Save shortcuts','保存快捷方式');save.onclick=()=>{shortcuts=[...form.querySelectorAll('select')].map(s=>s.value);try{localStorage.setItem('missy-r2-animal-shortcuts-v1',JSON.stringify(shortcuts));}catch{}shortPaint();settings.close();};body.append(form,reset,save);if(!settings.open)settings.showModal();
  }
  function metrics(){const runs=R2.session?.runs||[],wells=runs.reduce((n,r)=>n+(r.plate?.filter(w=>w.role!=='empty').length||0),0),thermal=runs.reduce((n,r)=>n+(r.record?.telemetry?.length||0),0),optical=runs.reduce((n,r)=>n+(r.record?.optical?.length||0),0);return {runs:runs.length,wells,thermal,optical,memory:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+' MB':t('Not available','不可用')};}
  function statusPanel(){if(!utility)utility=makeDialog('r2-computer-status',t('Computer status','计算机状态'));utility.querySelector('h2').textContent=t('Computer status','计算机状态');utility.querySelector('[data-console-close]').textContent=t('Go back','返回');paintStatus();if(!utility.open)utility.showModal();}
  function paintStatus(){if(!utility)return;const m=metrics(),rows=[['Current view','当前视图',top()?.querySelector('h1,h2')?.textContent||location.hash||'loading'],['Runs in this session','当前会话运行数',m.runs],['Occupied wells','占用孔数',m.wells],['Thermal records','温度记录数',m.thermal],['Optical records','光学记录数',m.optical],['Browser memory','浏览器内存',m.memory],['Logical processors','逻辑处理器',navigator.hardwareConcurrency||'—'],['Microphone','麦克风',R2.voiceConsole.listening?t('Listening locally','本地聆听中'):t('Stopped','已停止')],['Voice history','语音历史',t('JSON settings only','仅 JSON 设置')]];
    const table=document.createElement('table');for(const [en,cn,v]of rows){const tr=document.createElement('tr');const a=document.createElement('th'),b=document.createElement('td');a.textContent=t(en,cn);b.textContent=v;tr.append(a,b);table.append(tr);}utility.querySelector('.r2-utility-body').replaceChildren(table);}
  function voiceSettings(){
    if(!voiceDialog){voiceDialog=makeDialog('r2-voice-settings',t('Microphone settings','麦克风设置'));voiceDialog.addEventListener('close',()=>{if(!R2.voiceConsole.active)R2.voiceConsole.stopRecognition();else R2.voiceConsole.resumeSession();});}
    voiceDialog.querySelector('h2').textContent=t('Microphone settings','麦克风设置');voiceDialog.querySelector('[data-console-close]').textContent=t('Go back','返回');const body=voiceDialog.querySelector('.r2-utility-body');body.innerHTML=`<p>${t('Recognition stays active for the selected duration, pauses during playback, and resumes automatically. No audio is recorded or saved.','识别在所选时长内持续进行，播放时暂停并在结束后自动恢复。不录制或保存音频。')}</p><div class="r2-session-control"><label for="r2-mic-minutes">min</label><input id="r2-mic-minutes" type="number" min="1" max="120" step="1" value="${R2.voiceConsole.sessionMinutes}" aria-label="${t('Microphone session duration in minutes','麦克风会话时长（分钟）')}"><button type="button" id="r2-duration-apply" disabled class="r2-duration-apply" data-no-sound title="${t('Apply session duration','应用会话时长')}" aria-label="${t('Apply session duration','应用会话时长')}">✓</button></div><label>${t('Recognition language','识别语言')} <select id="r2-pack-lang"><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label><div class="row"><button type="button" id="r2-pack-install">${t('Download / install English pack','下载／安装英语语音包')}</button><button type="button" id="r2-pack-check">${t('Check pack','检查语音包')}</button></div><p data-pack-message role="status"></p><p>${t('Internet is needed only for browser-managed pack installation. Microphone permission is required separately.','仅浏览器管理的语音包安装需要联网，麦克风权限需另行允许。')}</p><p>${t('Outside Audio interview, say: go back, choose role, choose level, quality manager, sounds, alerts, computer status, English or Chinese.','在语音访谈以外可说：go back、choose role、choose level、quality manager、sounds、alerts、computer status、English 或 Chinese。')}</p>`;
    const applyDuration=()=>{const field=body.querySelector('#r2-mic-minutes');if(!R2.voiceConsole.setSessionMinutes(field.value)){field.value=R2.voiceConsole.sessionMinutes;R2.voiceConsole.setStatus('Use 1 to 120 minutes.');}body.querySelector('#r2-duration-apply').disabled=true;};body.querySelector('#r2-mic-minutes').oninput=()=>{body.querySelector('#r2-duration-apply').disabled=Number(body.querySelector('#r2-mic-minutes').value)===R2.voiceConsole.sessionMinutes;};body.querySelector('#r2-duration-apply').onclick=applyDuration;body.querySelector('#r2-mic-minutes').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyDuration();}};
    const lang=body.querySelector('#r2-pack-lang');lang.value=R2.voiceConsole.language;lang.onchange=()=>{const source=document.getElementById('voice-pack-language');source.value=lang.value;source.dispatchEvent(new Event('change'));};
    body.querySelector('#r2-pack-install').onclick=()=>R2.voiceConsole.pack(true);body.querySelector('#r2-pack-check').onclick=()=>R2.voiceConsole.pack(false);
    body.querySelector('[data-pack-message]').textContent=document.getElementById('voice-pack-status').textContent;
    if(!voiceDialog.open)voiceDialog.showModal();
  }
  function paint(){
    if(!bar)return;const m=metrics();bar.querySelector('.r2-session-summary').textContent=zh()?`${m.runs} 次运行 · ${m.wells} 个孔`:`${m.runs} run(s) · ${m.wells} wells`;
    for(const b of document.querySelectorAll('[data-mic-start],#vi-mic')){b.disabled=R2.voiceConsole.sessionActive||R2.voiceConsole.playbackBusy||R2.voiceConsole.listening||R2.voiceConsole.pending||!!R2.batchRuns?.busy();b.setAttribute('aria-pressed',String(R2.voiceConsole.listening));}
    for(const b of document.querySelectorAll('[data-mic-stop],#vi-mic-stop'))b.disabled=!R2.voiceConsole.sessionActive&&!R2.voiceConsole.listening&&!R2.voiceConsole.pending&&!R2.voiceConsole.playbackBusy;
    for(const b of bar.querySelectorAll('[data-mic-start],[data-mic-stop]')){const start=b.hasAttribute('data-mic-start');b.setAttribute('aria-label',t(start?'Start microphone':'Stop microphone',start?'启动麦克风':'停止麦克风'));b.title=b.getAttribute('aria-label');}
    const start=document.getElementById('vi-dialogue-start'),pause=document.getElementById('vi-dialogue-pause'),audioStatus=document.getElementById('vi-audio-status');
    if(start){start.disabled=R2.voiceConsole.speaking||!!R2.batchRuns?.busy();start.textContent=t(R2.voiceConsole.speechOn?'Read current question':'▶ Start spoken interview',R2.voiceConsole.speechOn?'朗读当前问题':'▶ 开始语音访谈');}
    if(pause)pause.disabled=!R2.voiceConsole.speechOn;
    const seconds=R2.voiceConsole.sessionRemaining,clock=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    const sessionText=R2.voiceConsole.sessionActive?t('Microphone session ','麦克风会话 ')+clock:'';
    if(audioStatus)audioStatus.textContent=(R2.i18n?.text(R2.voiceConsole.status)||R2.voiceConsole.status)+(sessionText?' · '+sessionText:'');
    bar.querySelector('.r2-mic-session').textContent=sessionText;
    const failure=document.getElementById('vi-error');if(failure){const message=R2.voiceConsole.status;failure.hidden=!/unavailable|could not|failed|not-allowed|No local speech voice|Install the English|not supported|permission/i.test(message);failure.textContent=failure.hidden?'':(R2.i18n?.text(message)||message);}
    if(utility?.open)paintStatus();
  }
  function modalNavigation(){for(const d of document.querySelectorAll('dialog[open]')){
    if(previousOpen.has(d))continue;
    if(d.id==='r2-transfer-loading')continue;
    // Preserve each screen's own draft-aware back handler. Add one only when absent.
    if(!d.querySelector('#vi-back,#studio-back,.batch-close,.picker-back,[data-act="close"],[data-console-close],[data-close],button[value="cancel"]')){
      const b=document.createElement('button');b.type='button';b.className='r2-modal-back';b.textContent=t('Go back','返回');b.dataset.consoleClose='';b.onclick=()=>d.close();d.prepend(b);
    }
  }previousOpen=new Set(document.querySelectorAll('dialog[open]'));}
  function init(){
    bar=document.getElementById('r2-console-bar');bar.classList.add('r2-missy-console');
    const nav=document.createElement('nav');nav.className='r2-console-nav';nav.setAttribute('aria-label',t('Workbench navigation','工作台导航'));
    nav.innerHTML=`<button type="button" data-nav="back">${t('Go back','返回')}</button><button type="button" data-nav="roles">${t('Choose role','选择角色')}</button><button type="button" data-nav="levels">${t('Choose level','选择级别')}</button>`;nav.onclick=e=>{const id=e.target.closest('[data-nav]')?.dataset.nav;if(id)go(id);};
    const summary=document.createElement('button');summary.type='button';summary.className='r2-session-summary';summary.onclick=statusPanel;
    const tools=document.createElement('div');tools.className='r2-console-tools';tools.innerHTML=`<button type="button" id="r2-animals-toggle" aria-expanded="false">▸ ${t('Animal shortcuts','动物快捷方式')}</button><button type="button" id="r2-sounds-open">▸ ${t('Sounds','声音')}</button><button type="button" id="r2-microphone-open">${t('Microphone','麦克风')}</button><button type="button" data-mic-start title="${t('Start microphone','启动麦克风')}" aria-label="${t('Start microphone','启动麦克风')}">▶</button><button type="button" data-mic-stop title="${t('Stop microphone','停止麦克风')}" aria-label="${t('Stop microphone','停止麦克风')}">■</button><span class="r2-mic-meter" data-r2-mic-meter role="meter" aria-label="${t('Microphone level','麦克风电平')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></span>`;
    const friends=document.createElement('div');friends.className='r2-animals';friends.hidden=true;friends.setAttribute('aria-label',t('Animal shortcuts','动物快捷方式'));const session=document.createElement('span');session.className='r2-mic-session';tools.append(session);bar.prepend(nav,summary);bar.append(tools,friends);
    tools.querySelector('#r2-animals-toggle').onclick=e=>{friends.hidden=!friends.hidden;e.currentTarget.setAttribute('aria-expanded',String(!friends.hidden));};tools.querySelector('#r2-sounds-open').onclick=()=>R2.sound.open();tools.querySelector('#r2-microphone-open').onclick=voiceSettings;
    tools.querySelector('[data-mic-start]').onclick=()=>R2.voiceConsole.startMicrophone();tools.querySelector('[data-mic-stop]').onclick=()=>R2.voiceConsole.stopMicrophone();
    const language=document.body.querySelector(':scope>.r2-language');if(language)bar.prepend(language);
    const ro=new ResizeObserver(()=>{const h=Math.ceil(bar.getBoundingClientRect().height);document.documentElement.style.setProperty('--r2-footer-height',h+'px');});ro.observe(bar);
    new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches('dialog')||n.querySelector?.('dialog')))))modalNavigation();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    document.addEventListener('r2-voice-state',paint);document.addEventListener('r2-language',()=>{if(voiceDialog?.open)voiceSettings();if(settings?.open){settings.querySelector('h2').textContent=t('Animal shortcuts','动物快捷方式');settings.querySelector('[data-console-close]').textContent=t('Go back','返回');for(const o of settings.querySelectorAll('option'))o.textContent=label(o.value);}if(utility?.open){utility.querySelector('h2').textContent=t('Computer status','计算机状态');utility.querySelector('[data-console-close]').textContent=t('Go back','返回');}shortPaint();for(const b of nav.querySelectorAll('[data-nav]'))b.textContent=label(b.dataset.nav);tools.querySelector('#r2-sounds-open').textContent='▸ '+t('Sounds','声音');tools.querySelector('#r2-animals-toggle').textContent='▸ '+t('Animal shortcuts','动物快捷方式');tools.querySelector('#r2-microphone-open').textContent=t('Microphone','麦克风');paint();});
    timer=setInterval(paint,1000);shortPaint();paint();modalNavigation();window.addEventListener('pagehide',()=>clearInterval(timer));
  }
  R2.consoleUi={back,go,loading,voiceSettings,command,statusPanel};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window.R2);
