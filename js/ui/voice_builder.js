/* Voice interview UI. Shared batch profile; captions, typed and tap alternatives. */
(function(R2){
  "use strict";
  const U=R2.batchUi,B=R2.batchRuns,V=R2.voiceConsole,esc=R2.esc;
  const KEY="missy-r2-voice-draft-v2", LT="missy-r2-voice-last-v2";
  let dialog,engine,shared=null,paused=false,busy=false,ack=new Set(),result=null,expiryTimer;
  const zh=()=>R2.i18n?.language==="zh",tr=s=>R2.i18n?.text(s)||s;
  const text=turn=>zh()?(turn.zh||tr(turn.text)):turn.text;
  const read=key=>{try{
    const saved=JSON.parse(localStorage.getItem(key));
    if(key===KEY&&saved){
      saved.turns=[];saved.undo=[];saved.lastInput=null;saved.pending=null;
      for(const f of Object.values(saved.facts||{})){delete f.heard;delete f.reason;delete f.via;f.history=(f.history||[]).map(h=>({value:h.value}));}
      localStorage.setItem(key,JSON.stringify(saved));
    }
    return saved;
  }catch{return null;}};
  read(KEY); // Migrate earlier drafts immediately: remove conversation wording, retain settings.
  const write=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val));}catch{V.setStatus("Draft storage unavailable. Download your profile to keep it.");}};
  function persist(){if(engine)write(KEY,JSON.parse(engine.save()));}
  function current(){return [...engine.state.turns].reverse().find(x=>x.role==="missy"&&x.kind==="question"&&x.qid===engine.state.cursor);}
  function caption(message){const n=dialog?.querySelector("#vi-caption");if(n)n.textContent=message;}
  function sayLatest(){
    if (["review", "armed"].includes(engine.state.phase)) {
      V.speak(engine.readback().map(c=>zh()?c.zh:c.en).join(" ")); return;
    }
    const turns=engine.state.turns.filter(x=>x.role==="missy");const last=current()||turns.at(-1);if(last)V.speak(text(last));
  }
  function disarm(){if(engine?.state.phase==="armed"){engine.state.phase="review";engine.state.armedUntil=0;}ack.clear();}
  function close(){if(busy){B.cancel();return;}disarm();persist();V.activate(null);clearInterval(expiryTimer);dialog.close();}
  function switchMode(mode){close();if(mode==="picker")R2.profileStudio.open();else U.openBuilder(shared||engine.profile(),mode);}
  function sync(){shared=engine.profile();U.setProfile(shared);persist();}
  function canonicalCommand(raw){
    const aliases={"是":"yes","否":"no","默认":"default","方法":"method","返回":"back","撤销":"undo","再说一遍":"say again","进度":"where am i","复述":"read back","确认生成":"confirm build","启动":"launch","停止":"stop","暂停":"stop","继续":"say again","保存":"save","完成":"finish","保留":"keep","和上次一样":"same as last time","和第一组一样":"same as group one","添加组":"add group","重新开始":"start over","其余按方法":"rest as method"};
    const trimmed=raw.trim();if(aliases[trimmed])return aliases[trimmed];
    const option=trimmed.match(/^选项\s*(\d+)$/);return option?"option "+option[1]:raw;
  }
  function input(raw,meta={via:"typed"}){
    if(!engine||busy)return;
    const command=canonicalCommand(String(raw));
    if (!command.trim()) return;
    if(command==="confirm build"){
      const check=R2.profileStudio.validate(engine.profile());
      if(check.warnings.some(w=>!ack.has(w))){caption(tr("Read and acknowledge every caution before confirming the build."));return;}
    }
    if(command==="launch"){
      const check=R2.profileStudio.validate(engine.profile());
      if(check.errors.length||check.warnings.some(w=>!ack.has(w))){disarm();render();caption(check.errors[0]||tr("Acknowledge the cautions before launch."));return;}
    }
    V.stopRecognition();paused=command==="stop";
    if(command!=="confirm build"&&command!=="launch"&&!/^(say again|read back|where am i|list options|save)$/.test(command))ack.clear();
    const turns=engine.handle(command,meta);sync();render();
    const last=turns.filter(x=>x.role==="missy").at(-1);if(last){caption(text(last));if(!paused)V.speak(text(last));}
    if(turns.some(x=>x.kind==="save"))downloadProfile();
    if(turns.some(x=>x.kind==="launch"))void generate();
  }
  function button(label,callback,attrs={}){const b=document.createElement("button");b.type="button";b.textContent=tr(label);Object.assign(b,attrs);b.onclick=callback;return b;}
  function render(){
    if(!dialog?.open||!engine)return;
    const q=current(),state=engine.state,progress=engine.progress();
    const phaseLabels={interview:"Interview",review:"Read-back",armed:"Ready to launch",done:"Complete"};
    dialog.querySelector("#vi-phase").textContent=tr(busy?"Generating virtual runs…":paused?"Paused":phaseLabels[state.phase]||state.phase);
    dialog.querySelector("#vi-question").textContent=q?text(q):tr("Review your profile before generating virtual runs.");
    dialog.querySelector("#vi-progress").value=progress.answered/Math.max(1,progress.total);
    dialog.querySelector("#vi-count").textContent=zh()?`已回答 ${progress.answered} / ${progress.total} 项；已记录 ${engine.decisionLog().changes.length} 次 JSON 修订`:`${progress.answered} / ${progress.total} answered · ${engine.decisionLog().changes.length} JSON revisions`;
    const opts=dialog.querySelector("#vi-options");opts.replaceChildren();
    if(state.phase==="interview"&&q){
      if(q.options)for(const o of q.options)opts.append(button(o.n+" · "+tr(o.label),()=>input("option "+o.n,{via:"button"})));
      else if(/Yes or no/.test(q.text))for(const [value,label] of [["yes","Yes"],["no","No"]])opts.append(button(label,()=>input(value,{via:"button"})));
      opts.append(button("Use default / method",()=>input("default",{via:"button"})));
    }
    dialog.querySelector("#vi-json").textContent=JSON.stringify(shared||engine.profile(),null,2);
    const clauses=dialog.querySelector("#vi-clauses");clauses.replaceChildren();
    for(const clause of engine.readback()){const item=document.createElement("li");item.textContent=zh()?clause.zh:clause.en;clauses.append(item);}
    const check=R2.profileStudio.validate(shared||engine.profile()),checkArea=dialog.querySelector("#vi-check");
    checkArea.replaceChildren();
    for(const group of check.groups){const row=document.createElement("p");row.className=group.errors.length?"vi-caution":"vi-go";
      row.textContent=(zh()?"组 ":"Group ")+(group.group+1)+" · "+(group.info?.sop||"—")+" · "+(group.info?.wells??"—")+" / 384 · "+(group.errors[0]||tr("Ready"));checkArea.append(row);}
    for(const error of check.errors){const p=document.createElement("p");p.className="vi-caution";p.textContent=error;checkArea.append(p);}
    for(const warning of check.warnings){const label=document.createElement("label");label.className="vi-caution";const box=document.createElement("input");box.type="checkbox";box.checked=ack.has(warning);box.disabled=busy;box.onchange=()=>{box.checked?ack.add(warning):ack.delete(warning);disarmIfUnchecked();render();};label.append(box,document.createTextNode(tr("Acknowledge")+" · "+warning));checkArea.append(label);}
    function disarmIfUnchecked(){if(check.warnings.some(w=>!ack.has(w))&&state.phase==="armed"){state.phase="review";state.armedUntil=0;}}
    dialog.querySelector("#vi-hash").textContent="SHA-256 · "+R2.sha256(R2.utf8(JSON.stringify(shared||engine.profile())));
    dialog.querySelector("#vi-confirm").disabled=busy||state.phase!=="review"||check.errors.length>0||check.warnings.some(w=>!ack.has(w));
    dialog.querySelector("#vi-launch").disabled=busy||state.phase!=="armed"||Date.now()>state.armedUntil;
    dialog.querySelector("#vi-expiry").textContent=state.phase==="armed"?(zh()?"启动有效期 ":"Launch window ")+Math.max(0,Math.ceil((state.armedUntil-Date.now())/1000))+" s":"";
    const log=dialog.querySelector("#vi-log");log.textContent=JSON.stringify(engine.decisionLog().changes,null,2);
    const memory=dialog.querySelector("#vi-memory");memory.textContent=JSON.stringify(shared||engine.profile(),null,2);
    dialog.querySelectorAll("#vi-answer,#vi-send,#vi-mic").forEach(el=>el.disabled=busy);
    dialog.querySelectorAll("[data-mode],#vi-back,#vi-forget,#vi-load,#vi-resume").forEach(el=>el.disabled=busy);
    dialog.querySelector("#vi-result").hidden=!result;
    V.setStatus(busy?"Generating virtual runs…":paused?"Paused":phaseLabels[state.phase]||state.phase);
  }
  const fileStem=()=>((shared||engine.profile()).name||"profile").replace(/[^A-Za-z0-9_-]+/g,"_").slice(0,60)||"profile";
  function downloadProfile(){R2.download(fileStem()+".missy-runs.json",JSON.stringify(shared||engine.profile(),null,2),"application/json");}
  function downloadMemory(){R2.download(fileStem()+".missy-runs.decisions.json",JSON.stringify({...engine.decisionLog(),memory:JSON.parse(engine.save())},null,2),"application/json");}
  async function generate(){
    if(busy)return;busy=true;V.stopRecognition();persist();render();
    const profile=JSON.parse(JSON.stringify(shared));
    // The executor files/preselects runs; this panel owns navigation and downloads.
    // Pass the exact reviewed profile so its batch checksum remains traceable.
    try{
      result=await B.run(profile,event=>{caption((zh()?"运行 ":"Run ")+(event.index+1)+" / "+event.total+" · "+Math.round(event.fraction*100)+" %");dialog.querySelector("#vi-run-progress").value=(event.index+event.fraction)/event.total;});
      const old=read(LT);write(LT,engine.longTermUpdate(old));
      dialog.querySelector("#vi-run-progress").value=result.cancelled?result.runs.length/Math.max(1,result.runs.length+result.failures.length+1):1;
      caption((zh()?"已归档运行：":"Runs filed: ")+result.runs.length+(result.failures.length?" · "+result.failures.map(f=>f.errors.join("; ")).join(" · "):""));
      if(shared.output?.downloadRdmltZip&&result.runs.length)await R2.downloadAsync(dialog.querySelector("#vi-rdmlt"),"MISSY_R2_RDMLt.zip",()=>R2.bulkRdmlt(result.runs));
    }catch(err){caption(err.message);engine.state.phase="review";engine.state.armedUntil=0;}
    finally{busy=false;persist();render();}
    if(result?.runs.length && !result.cancelled && !result.failures.length && shared.output?.openQuality) quality(false);
  }
  function quality(openMissy){
    if(openMissy&&result?.runs.length)R2.session.missyPreselect=result.runs.map(r=>r.no);
    close();if(!R2Boot.entered)document.getElementById("welcome-enter").click();
    if(location.hash==="#quality")window.dispatchEvent(new HashChangeEvent("hashchange"));else location.hash="#quality";
    if(openMissy){const launch=()=>{const btn=document.getElementById("missy-open");if(btn&&!btn.disabled)btn.click();};setTimeout(launch,150);}
  }
  function open(profile){
    if(B.busy()||R2.tech.running())return;
    if(!dialog){dialog=document.createElement("dialog");dialog.id="voice-builder";dialog.className="batch-dialog";document.body.append(dialog);dialog.addEventListener("cancel",e=>{e.preventDefault();if(!busy){close();R2.profileStudio.open();}else V.stop();});dialog.addEventListener("close",()=>{V.activate(null);clearInterval(expiryTimer);});}
    const resume=read(KEY);
    if(!engine){engine=MissyVoiceInterview.create({snapshot:R2.profileStudio.snapshot(),lang:zh()?"zh":"en",longTerm:read(LT),validate:R2.profileStudio.validate});}
    if(profile){const scientificDraft=p=>{if(!p)return null;const copy={...p};delete copy.created;delete copy.createdWith;return JSON.stringify(copy);};if(scientificDraft(profile)!==scientificDraft(shared)){engine.importProfile(profile);shared=profile;engine.resume();}}
    else if(!engine.state.turns.length){engine.start();shared=engine.profile();}
    disarm();paused=false;result=null;
    dialog.innerHTML=`<div class="batch-shell voice-shell"><div class="batch-top"><button type="button" id="vi-back">Go back</button><nav id="vi-switch" class="studio-switch"><button type="button" data-mode="assisted">Assisted</button><button type="button" data-mode="visual">Visual blocks</button><button type="button" aria-pressed="true">Audio interview</button></nav></div><h1>Build a profile by voice</h1><p class="note">Local English recognition. English / Chinese captions and local speech output. Every answer can also be typed or tapped.</p>
      <div class="row"><span id="vi-phase" class="pill"></span><span id="vi-count"></span><span id="vi-expiry"></span><button type="button" id="vi-resume" ${resume?"":"hidden"}>Resume saved interview</button></div><progress id="vi-progress" max="1" value="0"></progress>
      <div class="vi-columns"><section class="vi-interview panel"><h2 id="vi-question"></h2><div id="vi-options" class="vi-options"></div><form id="vi-form"><label for="vi-answer">Answer or command</label><div class="row"><input id="vi-answer" autocomplete="off" maxlength="300"><button id="vi-send" type="submit" class="primary">Send</button><button id="vi-mic" type="button">Microphone · speak English</button></div></form><p id="vi-caption" role="status"></p><div class="vi-tools row"><button type="button" data-command="back">Back</button><button type="button" data-command="undo">Undo</button><button type="button" data-command="say again">Say again</button><button type="button" data-command="read back">Read back</button><button type="button" data-command="finish">Review</button></div><details><summary>Profile history · JSON only</summary><p>Only accepted profile settings are kept. Speech and conversation text are not saved.</p><pre id="vi-log" class="vi-log"></pre><pre id="vi-memory"></pre></details><details><summary>Voice command guide</summary><p>Say: back, undo, say again, where am I, change replicates in group one to two, same as group one, same as last time, rest as method, confirm build, launch, stop.</p><p>Recognition is push-to-talk. Click Microphone for each answer. Play reads the current prompt; Stop closes the microphone, cancels speech and disarms launch. During generation, Stop finishes and files the current run.</p></details></section>
      <aside class="panel vi-review"><h2>Profile read-back</h2><ol id="vi-clauses"></ol><div id="vi-check"></div><code id="vi-hash"></code><details><summary>Profile JSON · exact settings</summary><pre id="vi-json"></pre></details><div class="row"><button type="button" id="vi-save">Download profile (.json)</button><button type="button" id="vi-decisions">Download decisions</button><button type="button" id="vi-load">Load interview</button><input type="file" id="vi-file" accept=".json" hidden></div><div class="row"><button type="button" id="vi-confirm">Confirm build</button><button type="button" id="vi-launch" class="vi-launch" disabled>Launch virtual runs</button></div><progress id="vi-run-progress" max="1" value="0"></progress><div id="vi-result" class="stack" hidden><button type="button" id="vi-quality">Open the Quality manager</button><button type="button" id="vi-missy">Open MISSY</button><button type="button" id="vi-rdmlt">Download these RDMLt files (.zip)</button></div><button type="button" id="vi-forget">Forget saved interview memory</button><p class="note">ARTIFICIAL DATA — NOT A LABORATORY RESULT</p></aside></div></div>`;
    if(!dialog.open)dialog.showModal();
    const $=s=>dialog.querySelector(s);
    $("#vi-back").onclick=()=>switchMode("picker");
    dialog.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
    $("#vi-form").onsubmit=e=>{e.preventDefault();const raw=$("#vi-answer").value;$("#vi-answer").value="";input(raw);};
    $("#vi-mic").onclick=()=>{paused=false;void V.listen(input,caption);};
    dialog.querySelectorAll("[data-command]").forEach(b=>b.onclick=()=>input(b.dataset.command,{via:"button"}));
    $("#vi-confirm").onclick=()=>input("confirm build",{via:"button"});$("#vi-launch").onclick=()=>input("launch",{via:"button"});
    $("#vi-save").onclick=downloadProfile;$("#vi-decisions").onclick=downloadMemory;
    $("#vi-quality").onclick=()=>quality(false);$("#vi-missy").onclick=()=>quality(true);
    $("#vi-rdmlt").onclick=()=>result?.runs.length&&R2.downloadAsync($("#vi-rdmlt"),"MISSY_R2_RDMLt.zip",()=>R2.bulkRdmlt(result.runs));
    $("#vi-load").onclick=()=>$("#vi-file").click();
    $("#vi-file").onchange=async e=>{const file=e.target.files[0];e.target.value="";if(!file)return;try{if(file.size>10*1024*1024)throw Error("Interview file is too large.");const data=JSON.parse(await file.text());if(!engine.load(data.memory||data))throw Error("Invalid interview memory.");disarm();engine.resume();sync();render();}catch(err){caption(err.message);}};
    $("#vi-resume").onclick=()=>{if(resume&&engine.load(resume)){disarm();engine.resume();sync();render();}};
    $("#vi-forget").onclick=()=>{if(!confirm(tr("Forget saved interview memory? Your run files are kept.")))return;try{localStorage.removeItem(KEY);localStorage.removeItem(LT);}catch{}engine=MissyVoiceInterview.create({snapshot:R2.profileStudio.snapshot(),lang:zh()?"zh":"en",validate:R2.profileStudio.validate});engine.start();shared=engine.profile();U.setProfile(shared);ack.clear();render();};
    V.activate({play:()=>{paused=false;sayLatest();},stop:()=>{if(!busy)input("stop",{via:"button"});else caption(tr("Stopping after this run…"));}});
    expiryTimer=setInterval(()=>{if(engine.state.phase==="armed"&&Date.now()>engine.state.armedUntil){disarm();render();caption(tr("Launch window expired. Confirm the build again."));}else if(engine.state.phase==="armed")$("#vi-expiry").textContent=Math.max(0,Math.ceil((engine.state.armedUntil-Date.now())/1000))+" s";},500);
    render();R2.i18n?.refresh();
  }
  document.addEventListener("r2-language",()=>{if(dialog?.open){V.stopRecognition();window.speechSynthesis?.cancel();disarm();persist();render();}});
  window.addEventListener("hashchange",()=>{if(dialog?.open&&!busy)close();});
  R2.voiceBuilder={open,input,get engine(){return engine;},get profile(){return shared;}};
})(window.R2);
