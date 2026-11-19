/* MISSY synthesized effect catalogue and settings; no sampled voice assets. */
(/* @r2fn R2-C0054-F00001 */function (R2) {
  'use strict';
  const catalog=R2.INTERFACE_SOUNDS, byId=new Map(catalog.map(/* @r2fn R2-C0054-F00002 */x=>[x.id,x]));
  const nodes=new Set(), releases=new Set(), KEY='missy-r2-interface-sounds-v1';
  let context, dialog, ambientTimer, background='', previewGeneration=0, played=0, lastId='';
  let enabled=true, volume=.55, disabled=new Set();
  try { enabled=localStorage.getItem('missy-r2-sound')!=='off';const v=JSON.parse(localStorage.getItem(KEY)||'null');
    if(v){volume=Number.isFinite(v.volume)?Math.max(0,Math.min(1,v.volume)):.55;disabled=new Set((v.disabled||[]).filter(/* @r2fn R2-C0054-F00003 */id=>byId.has(id)));}
  } catch {}
  const zh=/* @r2fn R2-C0054-F00004 */()=>R2.i18n?.language==='zh', t=/* @r2fn R2-C0054-F00005 */(en,cn)=>zh()?cn:en, esc=R2.esc;
  /* @r2fn R2-C0054-F00006 */function save(){try{localStorage.setItem('missy-r2-sound',enabled?'on':'off');localStorage.setItem(KEY,JSON.stringify({volume,disabled:[...disabled]}));}catch{}}
  /* @r2fn R2-C0054-F00007 */function paint(){
    const b=document.getElementById('workbench-sound');if(b){b.textContent=t(enabled?'Sound on':'Sound off',enabled?'声音开':'声音关');b.setAttribute('aria-pressed',String(enabled));}
    const b2=document.getElementById('welcome-sound');if(b2)b2.textContent=enabled?'🔊':'🔇';
    if(!enabled)R2.annunciator?.silence();document.dispatchEvent(new Event('r2-sound-state'));
  }
  /* @r2fn R2-C0054-F00008 */async function engine(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;context||=new C();if(context.state==='suspended')await context.resume();return context.state==='running'?context:null;}
  /* @r2fn R2-C0054-F00009 */function note(c, p, gain, ended){
    const [f,at,length,type='sine',end=null,filter=null]=p,start=c.currentTime+.01+at;
    const g=c.createGain();let source;
    if(type==='noise'){source=c.createBufferSource();const b=c.createBuffer(1,Math.max(1,Math.ceil(length*c.sampleRate)),c.sampleRate),a=b.getChannelData(0);let seed=123456789;for(let i=0;i<a.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;a[i]=(seed>>>0)/2147483648-1;}source.buffer=b;}
    else{source=c.createOscillator();source.type=type;source.frequency.setValueAtTime(f,start);if(end)source.frequency.linearRampToValueAtTime(end,start+length);}
    let tail=source,fil;if(filter){fil=c.createBiquadFilter();fil.type=filter[0];fil.frequency.value=filter[1];fil.Q.value=filter[2];tail.connect(fil);tail=fil;}
    tail.connect(g);const attack=Math.min(.015,length/4),release=Math.max(attack,length-.04);
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(gain,start+attack);g.gain.setValueAtTime(gain,start+release);g.gain.linearRampToValueAtTime(0,start+length);g.connect(c.destination);
    nodes.add(source);source.onended=/* @r2fn R2-C0054-F00010 */()=>{nodes.delete(source);source.disconnect();fil?.disconnect();g.disconnect();ended?.();};source.start(start);source.stop(start+length+.01);
  }
  /* @r2fn R2-C0054-F00011 */async function play(id='affirmative', preview=false,sequence=false){
    if(!enabled||(!preview&&(disabled.has(id)||(!sequence&&(R2.voiceConsole?.listening||R2.voiceConsole?.pending||R2.voiceConsole?.playbackBusy))))||document.hidden)return false;
    const item=byId.get(id);if(!item)return false;const generation=previewGeneration;
    if(preview)R2.voiceConsole?.cancelSpeech();
    let settle;const completed=new Promise(/* @r2fn R2-C0054-F00012 */resolve=>settle=resolve);const release=/* @r2fn R2-C0054-F00013 */()=>{unlock();settle();};const unlock=R2.voiceConsole?.beginPlayback(sequence?'vui-effect':'interface-effect')||(/* @r2fn R2-C0054-F00014 */()=>{});releases.add(release);const done=/* @r2fn R2-C0054-F00015 */()=>{release();releases.delete(release);};
    try{const c=await engine();if(!c||!enabled||generation!==previewGeneration){done();return false;}
      if(item.sample){
        const pcm=atob(item.sample.pcm16le),frames=item.sample.frames,buffer=c.createBuffer(1,frames,item.sample.rate),data=buffer.getChannelData(0);
        for(let i=0;i<frames;i++){const v=pcm.charCodeAt(i*2)|(pcm.charCodeAt(i*2+1)<<8);data[i]=(v>=32768?v-65536:v)/32768;}
        const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=volume*(item.volume??1);source.connect(gain).connect(c.destination);nodes.add(source);
        source.onended=/* @r2fn R2-C0054-F00016 */()=>{nodes.delete(source);source.disconnect();gain.disconnect();done();};source.start();played++;lastId=id;await completed;return generation===previewGeneration;
      }
      let remaining=item.pattern.length;
      for(const p of item.pattern)note(c,p,(item.group==='Background'?.009:.055)*volume*(item.volume??1),/* @r2fn R2-C0054-F00017 */()=>{if(--remaining===0)done();});
      if(!remaining)done();played++;lastId=id;await completed;return generation===previewGeneration;
    }catch{done();return false;}
  }
  /* @r2fn R2-C0054-F00018 */function stop(){previewGeneration++;for(const n of nodes){try{n.stop();}catch{}}nodes.clear();for(const release of releases)release();releases.clear();}
  /* @r2fn R2-C0054-F00019 */function setEnabled(on){enabled=!!on;save();if(!enabled)stop();paint();}
  /* @r2fn R2-C0054-F00020 */function ambience(id){clearInterval(ambientTimer);ambientTimer=null;background='';stop();const item=byId.get(id);if(item?.group!=='Background')return;
    background=id;const pulse=/* @r2fn R2-C0054-F00021 */()=>{if(enabled&&!document.hidden&&!R2.voiceConsole?.listening)void play(id);};pulse();ambientTimer=setInterval(pulse,Math.max(3000,1000*Math.max(...item.pattern.map(/* @r2fn R2-C0054-F00022 */p=>p[1]+p[2]))+200));}
  /* @r2fn R2-C0054-F00023 */function renderRows(){
    if(!dialog)return;const group=dialog.querySelector('#r2-sound-group').value;
    const shown=catalog.filter(/* @r2fn R2-C0054-F00024 */x=>!group||x.group===group),list=dialog.querySelector('.r2-sound-list');list.replaceChildren();
    for(const item of shown){const row=document.createElement('div');row.className='r2-sound-row';const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!disabled.has(item.id);check.dataset.soundId=item.id;check.onchange=/* @r2fn R2-C0054-F00025 */()=>{check.checked?disabled.delete(item.id):disabled.add(item.id);save();};
      const span=document.createElement('span');span.textContent=zh()?item.zh:item.en;label.append(check,span);const preview=document.createElement('button');preview.type='button';preview.textContent='▶';preview.dataset.noSound='';preview.setAttribute('aria-label',t('Preview: ','试听：')+span.textContent);preview.onclick=/* @r2fn R2-C0054-F00026 */()=>{stop();void play(item.id,true);dialog.querySelector('#r2-sound-status').textContent=enabled?span.textContent:t('Sounds are off. Enable sound to preview.','声音已关闭。开启声音后可试听。');};row.append(label,preview);list.append(row);}
  }
  /* @r2fn R2-C0054-F00027 */function open(){
    R2.voiceConsole?.pauseRecognition();
    if(!dialog){dialog=document.createElement('dialog');dialog.id='r2-sound-settings';dialog.className='r2-utility-dialog';dialog.dataset.i18nSkip='';document.body.append(dialog);dialog.addEventListener('close',/* @r2fn R2-C0054-F00028 */()=>{stop();});}
    const groups=[...new Set(catalog.map(/* @r2fn R2-C0054-F00029 */x=>x.group))],cnGroups=['启动','导入','核心','导出','完整性','警报','导航','审核','模式','图表','配置','配置文件','控件','结果','控制面板','语音','背景','报告','演示'];const enGroups=['Startup','Intake','Core','Exports','Integrity','Alarms','Navigation','Review','Modes','Charts','Configuration','Profiles','Controls','Results','Control panel','Voice','Background','Reports','Demo'];
    dialog.innerHTML=`<header><h2>${t('Sounds','声音')} (${catalog.length})</h2><button type="button" data-close>${t('Go back','返回')}</button></header>
      <div class="r2-utility-body"><div class="row"><label><input id="r2-sound-enabled" type="checkbox" ${enabled?'checked':''}> ${t('Interface sounds','界面音效')}</label><label>${t('Volume','音量')} <input id="r2-sound-volume" type="range" min="0" max="1" step=".05" value="${volume}"></label><button type="button" id="r2-sound-stop" data-no-sound>${t('Stop preview','停止试听')}</button></div>
      <label>${t('Sound group','音效分组')} <select id="r2-sound-group"><option value="">${t('All sounds','全部音效')}</option>${groups.map(/* @r2fn R2-C0054-F00030 */g=>`<option value="${esc(g)}">${esc(zh()?cnGroups[enGroups.indexOf(g)]||g:g)}</option>`).join('')}</select></label>
      <div class="row"><button type="button" id="r2-sound-group-on">${t('Enable group','启用分组')}</button><button type="button" id="r2-sound-group-off">${t('Disable group','禁用分组')}</button></div><p id="r2-sound-status" role="status">${t('Choose interface sounds. Preview each effect or switch off a group.','选择界面音效。可逐项试听或关闭整个分组。')}</p><div class="r2-sound-list"></div>
      <label>${t('Background','背景音')} <select id="r2-sound-background"><option value="">${t('Background off','关闭背景音')}</option>${catalog.filter(/* @r2fn R2-C0054-F00031 */x=>x.group==='Background').map(/* @r2fn R2-C0054-F00032 */x=>`<option value="${esc(x.id)}">${esc(zh()?x.zh:x.en)}</option>`).join('')}</select></label></div>`;
    dialog.querySelector('[data-close]').onclick=/* @r2fn R2-C0054-F00033 */()=>dialog.close();dialog.querySelector('#r2-sound-enabled').onchange=/* @r2fn R2-C0054-F00034 */e=>setEnabled(e.target.checked);
    dialog.querySelector('#r2-sound-volume').oninput=/* @r2fn R2-C0054-F00035 */e=>{volume=Number(e.target.value);save();};dialog.querySelector('#r2-sound-stop').onclick=/* @r2fn R2-C0054-F00036 */()=>{stop();dialog.querySelector('#r2-sound-status').textContent=t('Stopped','已停止');};
    dialog.querySelector('#r2-sound-group').onchange=renderRows;
    for(const [id,on] of [['r2-sound-group-on',true],['r2-sound-group-off',false]])dialog.querySelector('#'+id).onclick=/* @r2fn R2-C0054-F00037 */()=>{const group=dialog.querySelector('#r2-sound-group').value;for(const x of catalog.filter(/* @r2fn R2-C0054-F00038 */x=>!group||x.group===group)){on?disabled.delete(x.id):disabled.add(x.id);}save();renderRows();};
    const bg=dialog.querySelector('#r2-sound-background');bg.value=background;bg.onchange=/* @r2fn R2-C0054-F00039 */()=>ambience(bg.value);renderRows();if(!dialog.open)dialog.showModal();
  }
  /* @r2fn R2-C0054-F00040 */function eventSound(e){const b=e.target.closest('button,a[href],summary');if(!b||b.disabled||b.closest('[data-no-sound]')||b.id==='workbench-sound'||b.id==='welcome-sound'||b.matches('[data-mic-start],[data-mic-stop],#vi-mic,#vi-mic-stop,#vi-dialogue-start,#vi-dialogue-pause,.r2-voice-play'))return;
    const text=b.textContent||'', id=/download|save|下载|保存/i.test(text)?'download':/back|close|cancel|返回|关闭/i.test(text)?'consoleClose':/start|launch|prepare|开始|生成/i.test(text)?'working':b.id==='missy-open'?'loaded':b.matches('.workspace-choice,.entry-choice')?'enter':'affirmative';void play(id);}
  R2.sound={play,stop,open,setEnabled,ambience,get enabled/* @r2fn R2-C0054-F00041 */(){return enabled;},get catalog/* @r2fn R2-C0054-F00042 */(){return catalog;},get diagnostics/* @r2fn R2-C0054-F00043 */(){return {played,lastId,activeNodes:nodes.size,background};}};
  document.getElementById('workbench-sound').addEventListener('click',/* @r2fn R2-C0054-F00044 */()=>{setEnabled(!enabled);if(enabled)void play('affirmative');});
  document.addEventListener('click',eventSound,true);document.addEventListener('change',/* @r2fn R2-C0054-F00045 */e=>{if(e.target.matches('input,select')&&!e.target.closest('#r2-sound-settings'))void play('received');},true);
  document.addEventListener('r2-language',/* @r2fn R2-C0054-F00046 */()=>{paint();if(dialog?.open)open();});document.addEventListener('visibilitychange',/* @r2fn R2-C0054-F00047 */()=>{if(document.hidden)stop();});window.addEventListener('pagehide',/* @r2fn R2-C0054-F00048 */()=>{stop();clearInterval(ambientTimer);});paint();
})(window.R2);
