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
  const makeEngine=longTerm=>MissyVoiceInterview.create({snapshot:R2.profileStudio.snapshot(),lang:zh()?"zh":"en",longTerm,validate:R2.profileStudio.validate,resetForTemplate:B.resetForTemplate});
  // The spoken read-back must describe the run the bench will make, not only the answers given.
  // One clause per group is taken from preview(): species, step, assays, SOP and wells.
  function benchClauses(){
    const profile=shared||engine.profile(),check=R2.profileStudio.validate(profile),out=[];
    for(const g of check.groups){
      const i=g.info,run=profile.runs[g.group]||{},tpl=typeof run.template==="string"?R2.templates.get(run.template):null;
      if(!i?.sop||g.errors.length){out.push({group:g.group,en:`Group ${g.group+1} bench check: not available. ${g.errors[0]||""}`,zh:`第 ${g.group+1} 组台架检查：不可用。${g.errors[0]||""}`,mismatch:true});continue;}
      const mismatch=!!tpl&&((tpl.crop&&tpl.crop!==i.crop)||(tpl.stage&&tpl.stage!==i.stage));
      out.push({group:g.group,mismatch,
        en:`Group ${g.group+1} bench check: ${i.crop}, ${i.stage}, ${(i.assays||[]).join(", ")}; ${i.sop}; ${i.wells} wells.`+(mismatch?` Caution: the template is ${tpl.crop} ${tpl.stage}, the run will be ${i.crop} ${i.stage}.`:""),
        zh:`第 ${g.group+1} 组台架检查：${i.crop}，${i.stage}，${(i.assays||[]).join("、")}；${i.sop}；${i.wells} 孔。`+(mismatch?` 注意：模板为 ${tpl.crop} ${tpl.stage}，运行将为 ${i.crop} ${i.stage}。`:"")});
    }
    return out;
  }
  function readbackClauses(){
    const profile=shared||engine.profile(),bench=benchClauses(),out=[];
    out.push({path:"name",en:`Build profile ${profile.name||""}.`,zh:`生成配置 ${profile.name||""}。`});
    profile.runs.forEach((group,i)=>{
      const tpl=typeof group.template==="string"?R2.templates.get(group.template):group.template;
      const d=group.design||{},settings=Object.fromEntries(Object.entries(group).filter(([k])=>!["repeat","template","design"].includes(k)));
      const detail=Object.keys(settings).length?JSON.stringify(settings):"template defaults";
      out.push({path:`runs[${i}]`,en:`Group ${i+1}: ${group.repeat||1} run(s); ${tpl?.name||group.template||"no template"}; ${d.extractions??3} extractions × ${d.replicates??3} PCR replicates. Control overrides: ${JSON.stringify(d.controlCounts||{})}. Settings: ${detail}.`,
        zh:`第 ${i+1} 组：${group.repeat||1} 次运行；${tpl?.name||group.template||"无模板"}；${d.extractions??3} 次提取 × ${d.replicates??3} 个 PCR 重复。对照覆盖值：${JSON.stringify(d.controlCounts||{})}。设置：${detail}。`});
      for(const checked of bench.filter(x=>x.group===i))out.push({path:`runs[${i}].bench`,...checked});
    });
    const output=profile.output||{};
    out.push({path:"output",en:`Output: ${output.openQuality!==false?"open Quality manager":"do not open Quality manager"}; ${output.selectForMissy!==false?"select new runs for MISSY":"do not select new runs for MISSY"}; ${output.downloadRdmltZip?"download RDMLt ZIP":"no automatic download"}.`,
      zh:`输出：${output.openQuality!==false?"打开质量管理":"不打开质量管理"}；${output.selectForMissy!==false?"为 MISSY 勾选新运行":"不为 MISSY 勾选新运行"}；${output.downloadRdmltZip?"下载 RDMLt ZIP":"不自动下载"}。`});
    return out;
  }
  function clearAcks(){ack.clear();R2.annunciator?.reactivate("voice");}
  function current(){return [...engine.state.turns].reverse().find(x=>x.role==="missy"&&x.kind==="question"&&x.qid===engine.state.cursor);}
  function caption(message){const n=dialog?.querySelector("#vi-caption");if(n)n.textContent=message;}
  function sayLatest(){
    if (["review", "armed"].includes(engine.state.phase)) {
      V.speak(readbackClauses().map(c=>zh()?c.zh:c.en).join(" ")); return;
    }
    const turns=engine.state.turns.filter(x=>x.role==="missy");const last=current()||turns.at(-1);if(last)V.speak(text(last));
  }
  function disarm(reason){if(engine?.state.phase==="armed"){engine.state.phase="review";engine.state.armedUntil=0;R2.annunciator?.raise("R2-CMD-025",{detail:reason||"a change"},"interview");}clearAcks();}
  function close(){if(busy){B.cancel();return;}disarm();R2.annunciator?.clearSource("voice");R2.annunciator?.clearSource("interview");persist();V.activate(null);clearInterval(expiryTimer);dialog.close();}
  function switchMode(mode){close();if(mode==="picker")R2.profileStudio.open();else U.openBuilder(shared||engine.profile(),mode);}
  function sync(){shared=engine.profile();U.setProfile(shared);persist();}
  function canonicalCommand(raw){
    const aliases={"是":"yes","否":"no","默认":"default","方法":"method","返回":"back","撤销":"undo","再说一遍":"say again","进度":"where am i","复述":"read back","确认生成":"confirm build","启动":"launch","停止":"stop","暂停":"stop","继续":"say again","保存":"save","完成":"finish","保留":"keep","和上次一样":"same as last time","和第一组一样":"same as group one","添加组":"add group","重新开始":"start over","其余按方法":"rest as method"};
    const trimmed=raw.trim();if(aliases[trimmed])return aliases[trimmed];
    const option=trimmed.match(/^选项\s*(\d+)$/);return option?"option "+option[1]:raw;
  }
  function input(raw,meta={via:"typed"}){
    if(!engine||busy||!dialog?.open)return;
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
    if(command==="stop")V.stopRecognition();else V.pauseRecognition();paused=command==="stop";
    const previousProfile=JSON.stringify(engine.profile());
    const turns=engine.handle(command,meta);
    if(JSON.stringify(engine.profile())!==previousProfile||command==="stop")clearAcks();
    sync();
    // interview events with a catalogue identifier (no wording is logged, only the identifier)
    const KIND={clarify:"R2-VOI-001",dormant:"R2-VOI-004",refuse:"R2-VOI-009",error:"R2-VOI-011",nogo:"R2-CMD-024",refused:"R2-CMD-021",armed:"R2-CMD-020"};
    R2.annunciator?.clearSource("interview");
    for(const t of turns)if(KIND[t.kind])R2.annunciator?.raise(KIND[t.kind],{detail:text(t)},"interview");
    render();
    const last=turns.filter(x=>x.role==="missy").at(-1);
    if(last){const message=last.kind==="review"?readbackClauses().map(c=>zh()?c.zh:c.en).join(" "):text(last);caption(message);if(!paused)V.speak(message);}
    if(turns.some(x=>x.kind==="save"))downloadProfile();
    if(turns.some(x=>x.kind==="launch"))void generate();
    else if(command!=="stop")V.resumeSession();
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
    for(const clause of readbackClauses()){const item=document.createElement("li");item.textContent=zh()?clause.zh:clause.en;if(clause.mismatch)item.className="vi-caution";clauses.append(item);}
    const check=R2.profileStudio.validate(shared||engine.profile()),checkArea=dialog.querySelector("#vi-check");
    // One alert model: the same results feed the alert panel and the master caution/warning lamp.
    R2.annunciator?.sync("voice",check.alerts,R2.sha256(R2.utf8(JSON.stringify(shared||engine.profile()))));
    for(const w of check.warnings)if(R2.annunciator?.isAcked("voice",w))ack.add(w);
    checkArea.replaceChildren();
    for(const group of check.groups){const row=document.createElement("p");row.className=group.errors.length?"vi-caution":"vi-go";
      row.textContent=(zh()?"组 ":"Group ")+(group.group+1)+" · "+(group.info?.sop||"—")+" · "+(group.info?.wells??"—")+" / 384 · "+(group.errors[0]||tr("Ready"));checkArea.append(row);}
    for(const error of check.errors){const p=document.createElement("p");p.className="vi-caution";p.textContent=error;checkArea.append(p);}
    for(const warning of check.warnings){const label=document.createElement("label");label.className="vi-caution";const box=document.createElement("input");box.type="checkbox";box.checked=ack.has(warning);box.disabled=busy;box.onchange=()=>{box.checked?ack.add(warning):ack.delete(warning);for(const a of R2.annunciator?.active()||[])if(a.source==="voice"&&a.text===warning){if(box.checked)R2.annunciator.ack(a.key);else R2.annunciator.unack(a.key);}disarmIfUnchecked();render();};label.append(box,document.createTextNode(tr("Acknowledge")+" · "+warning));checkArea.append(label);}
    function disarmIfUnchecked(){if(check.warnings.some(w=>!ack.has(w))&&state.phase==="armed"){state.phase="review";state.armedUntil=0;}}
    {const full=R2.sha256(R2.utf8(JSON.stringify(shared||engine.profile())));dialog.querySelector("#vi-hash").textContent=(zh()?"配置文件摘要（运行记录中）· ":"Profile digest recorded in each run · ")+full.slice(0,16)+" · SHA-256 "+full;}
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
    if(busy)return;busy=true;R2.annunciator?.clearSource("run");R2.annunciator?.clearSource("handoff");V.stopRecognition();persist();render();
    const profile=JSON.parse(JSON.stringify(shared));
    // The executor files/preselects runs; this panel owns navigation and downloads.
    // Pass the exact reviewed profile so its batch checksum remains traceable.
    try{
      result=await B.run(profile,event=>{caption((zh()?"运行 ":"Run ")+(event.index+1)+" / "+event.total+" · "+Math.round(event.fraction*100)+" %");dialog.querySelector("#vi-run-progress").value=(event.index+event.fraction)/event.total;});
      const old=read(LT);write(LT,engine.longTermUpdate(old));
      dialog.querySelector("#vi-run-progress").value=result.cancelled?result.runs.length/Math.max(1,result.runs.length+result.failures.length+1):1;
      caption((zh()?"已归档运行：":"Runs filed: ")+result.runs.length+(result.failures.length?" · "+result.failures.map(f=>f.errors.join("; ")).join(" · "):""));
      R2.annunciator?.clearSource("run");
      R2.annunciator?.raise(result.cancelled?"R2-RUN-032":"R2-RUN-033",{n:result.runs.length},"run");
      for(const f of result.failures)R2.annunciator?.raise("R2-RUN-031",{detail:f.name+": "+f.errors.join("; ")},"run");
      if(shared.output?.downloadRdmltZip&&result.runs.length)await R2.downloadAsync(dialog.querySelector("#vi-rdmlt"),"MISSY_R2_RDMLt.zip",()=>R2.bulkRdmlt(result.runs));
    }catch(err){caption(err.message);engine.state.phase="review";engine.state.armedUntil=0;
      R2.annunciator?.sync("run",String(err.message).split("\n").map(text=>({kind:"error",text})));}
    finally{busy=false;persist();render();}
    if(result?.runs.length && !result.cancelled && !result.failures.length && shared.output?.openQuality) quality(false);
  }
  function quality(openMissy){
    // The profile's output choice decides which runs are ticked for MISSY.
    const select=result?.runs.length&&shared?.output?.selectForMissy!==false;
    if(openMissy&&select)R2.session.missyPreselect=result.runs.map(r=>r.no);
    close();if(!R2Boot.entered)document.getElementById("welcome-enter").click();
    if(location.hash==="#quality")window.dispatchEvent(new HashChangeEvent("hashchange"));else location.hash="#quality";
    if(!openMissy)return;
    if(!select){R2.annunciator?.raise("R2-HOF-003",{},"handoff");return;}
    const t0=Date.now();const launch=()=>{const btn=document.getElementById("missy-open");
      const expected=result.runs.map(r=>String(r.no));
      const selected=[...document.querySelectorAll('#missy-run input:checked')].map(n=>n.value);
      if(!/^#quality(?:\/|$)/.test(location.hash))return;
      if(btn&&!btn.disabled&&document.getElementById('view-quality')?.hidden===false&&expected.every(id=>selected.includes(id)))btn.click();else if(Date.now()-t0<5000)setTimeout(launch,150);else R2.annunciator?.raise("R2-HOF-002",{},"handoff");};setTimeout(launch,150);
  }
  function open(profile){
    if(B.busy()||R2.tech.running())return;
    if(!dialog){dialog=document.createElement("dialog");dialog.id="voice-builder";dialog.className="batch-dialog";document.body.append(dialog);dialog.addEventListener("cancel",e=>{e.preventDefault();if(!busy){close();R2.profileStudio.open();}else V.stop();});dialog.addEventListener("close",()=>{V.activate(null);clearInterval(expiryTimer);});}
    const resume=read(KEY);
    if(!engine){engine=makeEngine(read(LT));}
    if(profile){const scientificDraft=p=>{if(!p)return null;const copy={...p};delete copy.created;delete copy.createdWith;return JSON.stringify(copy);};if(scientificDraft(profile)!==scientificDraft(shared)){
      // Never replace a shared draft the interview cannot represent: return to the editor instead.
      if(!engine.importProfile(profile)){
        if(dialog.open)dialog.close();V.activate(null);clearInterval(expiryTimer);
        R2.annunciator?.raise("R2-VOI-010",{groups:profile.runs?.length},"voice-import");U.openBuilder(profile,"assisted");return;
      }
      shared=profile;engine.resume();}}
    else if(!engine.state.turns.length){engine.start();shared=engine.profile();}
    R2.annunciator?.clearSource("voice-import");disarm();paused=false;result=null;
    dialog.innerHTML=`<div class="batch-shell voice-shell"><div class="batch-top"><button type="button" id="vi-back">Go back</button><nav id="vi-switch" class="studio-switch"><button type="button" data-mode="assisted">Assisted</button><button type="button" data-mode="visual">Visual blocks</button><button type="button" aria-pressed="true">Audio interview</button></nav></div><h1>Build a profile by voice</h1><div class="row vi-microphone-toolbar"><button type="button" id="vi-dialogue-start" class="primary" data-no-sound>▶ Start spoken interview</button><button type="button" id="vi-dialogue-pause" data-no-sound>■ Pause spoken interview</button><div class="r2-session-control"><label for="vi-listen-minutes">min</label><input id="vi-listen-minutes" type="number" min="1" max="120" step="1" value="10" aria-label="Microphone session duration in minutes"><button type="button" id="vi-duration-apply" disabled class="r2-duration-apply" data-no-sound title="Apply session duration" aria-label="Apply session duration">✓</button></div><button type="button" id="vi-pack-install">Download / install English pack</button><button type="button" id="vi-voice-settings">Microphone settings</button></div><p data-pack-message role="status"></p><p class="vi-audio-help">Start spoken interview reads the questions aloud. Click Start microphone once to answer across stages. The microphone pauses while any sound is playing and resumes automatically during a timed session.</p><p id="vi-audio-status" role="status"></p><p class="note">Local English recognition. English / Chinese captions and local speech output. Every answer can also be typed or tapped.</p>
      <div class="row"><span id="vi-phase" class="pill"></span><span id="vi-count"></span><span id="vi-expiry"></span><button type="button" id="vi-resume" ${resume?"":"hidden"}>Resume saved interview</button></div><progress id="vi-progress" max="1" value="0"></progress>
      <div class="vi-columns"><section class="vi-interview panel"><h2 id="vi-question"></h2><div id="vi-options" class="vi-options"></div><form id="vi-form"><label for="vi-answer">Answer or command</label><div class="row"><input id="vi-answer" autocomplete="off" maxlength="300"><button id="vi-send" type="submit" class="primary">Send</button><button id="vi-mic" type="button">▶ Start microphone · speak English</button><button id="vi-mic-stop" type="button">■ Stop microphone</button><span class="r2-mic-meter" data-r2-mic-meter role="meter" aria-label="Microphone level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></span></div></form><p id="vi-caption" role="status"></p><div class="vi-tools row"><button type="button" data-command="back">Back</button><button type="button" data-command="undo">Undo</button><button type="button" data-command="say again">Say again</button><button type="button" data-command="read back">Read back</button><button type="button" data-command="finish">Review</button></div><details><summary>Profile history · JSON only</summary><p>Only accepted profile settings are kept. Speech and conversation text are not saved.</p><pre id="vi-log" class="vi-log"></pre><pre id="vi-memory"></pre></details><details><summary>Voice command guide</summary><p>Say: back, undo, say again, where am I, change replicates in group one to two, same as group one, same as last time, rest as method, confirm build, launch, stop.</p><p>Recognition continues across stages for the selected session duration and pauses during playback. Play reads the current prompt; Stop closes the microphone, cancels speech and disarms launch. During generation, Stop finishes and files the current run.</p></details></section>
      <aside class="panel vi-review"><h2>Profile read-back</h2><ol id="vi-clauses"></ol><div id="vi-check"></div><code id="vi-hash"></code><details><summary>Profile JSON · exact settings</summary><pre id="vi-json"></pre></details><div class="row"><button type="button" id="vi-save">Download profile (.json)</button><button type="button" id="vi-decisions">Download decisions</button><button type="button" id="vi-load">Load interview</button><input type="file" id="vi-file" accept=".json" hidden></div><div class="row"><button type="button" id="vi-confirm">Confirm build</button><button type="button" id="vi-launch" class="vi-launch" disabled>Launch virtual runs</button></div><progress id="vi-run-progress" max="1" value="0"></progress><div id="vi-result" class="stack" hidden><button type="button" id="vi-quality">Open the Quality manager</button><button type="button" id="vi-missy">Open MISSY</button><button type="button" id="vi-rdmlt">Download these RDMLt files (.zip)</button></div><button type="button" id="vi-forget">Forget saved interview memory</button><p class="note">ARTIFICIAL DATA — NOT A LABORATORY RESULT</p></aside></div></div>`;
    if(!dialog.open)dialog.showModal();
    const $=s=>dialog.querySelector(s);
    const micToolbar=$(".vi-microphone-toolbar");for(const sel of ['#vi-mic','#vi-mic-stop','#vi-form .r2-mic-meter'])micToolbar.append($(sel));
    $("#vi-listen-minutes").value=V.sessionMinutes;const applyDuration=()=>{const field=$("#vi-listen-minutes");if(!V.setSessionMinutes(field.value)){field.value=V.sessionMinutes;V.setStatus("Use 1 to 120 minutes.");}$("#vi-duration-apply").disabled=true;};
    $("#vi-listen-minutes").oninput=()=>{$("#vi-duration-apply").disabled=Number($("#vi-listen-minutes").value)===V.sessionMinutes;};$("#vi-duration-apply").onclick=applyDuration;$("#vi-listen-minutes").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();applyDuration();}};
    $("#vi-dialogue-start").onclick=()=>V.startDialogue();
    $("#vi-dialogue-pause").onclick=()=>V.pauseDialogue();
    $("#vi-pack-install").onclick=()=>V.pack(true);
    $("#vi-voice-settings").onclick=()=>R2.consoleUi.voiceSettings();
    $("#vi-back").onclick=()=>switchMode("picker");
    dialog.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
    $("#vi-form").onsubmit=e=>{e.preventDefault();const raw=$("#vi-answer").value;$("#vi-answer").value="";input(raw);};
    $("#vi-mic").onclick=()=>{paused=false;V.startSession(input,caption);};
    $("#vi-mic-stop").onclick=()=>V.stopMicrophone();
    dialog.querySelectorAll("[data-command]").forEach(b=>b.onclick=()=>input(b.dataset.command,{via:"button"}));
    $("#vi-confirm").onclick=()=>input("confirm build",{via:"button"});$("#vi-launch").onclick=()=>input("launch",{via:"button"});
    $("#vi-save").onclick=downloadProfile;$("#vi-decisions").onclick=downloadMemory;
    $("#vi-quality").onclick=()=>quality(false);$("#vi-missy").onclick=()=>quality(true);
    $("#vi-rdmlt").onclick=()=>result?.runs.length&&R2.downloadAsync($("#vi-rdmlt"),"MISSY_R2_RDMLt.zip",()=>R2.bulkRdmlt(result.runs));
    $("#vi-load").onclick=()=>$("#vi-file").click();
    $("#vi-file").onchange=async e=>{const file=e.target.files[0];e.target.value="";if(!file)return;try{if(file.size>10*1024*1024)throw Error("Interview file is too large.");const data=JSON.parse(await file.text());if(!engine.load(data.memory||data))throw Error("Invalid interview memory.");disarm();engine.resume();sync();render();showDropped();}catch(err){caption(err.message);}};
    $("#vi-resume").onclick=()=>{
      if(resume&&engine.load(resume)){disarm();engine.resume();sync();render();showDropped();}
      else{caption(tr("Invalid interview memory. Your current profile is unchanged."));R2.annunciator?.raise("R2-MEM-002",{},"interview");}
    };
    $("#vi-forget").onclick=()=>{if(!confirm(tr("Forget saved interview memory? Your run files are kept.")))return;try{localStorage.removeItem(KEY);localStorage.removeItem(LT);}catch{}engine=makeEngine(null);engine.start();shared=engine.profile();U.setProfile(shared);clearAcks();render();};
    V.activate({microphone:()=>$("#vi-mic").click(),play:()=>{paused=false;sayLatest();},stop:()=>{if(!busy)input("stop",{via:"button"});else caption(tr("Stopping after this run…"));}});
    expiryTimer=setInterval(()=>{if(engine.state.phase==="armed"&&Date.now()>engine.state.armedUntil){disarm();render();caption(tr("Launch window expired. Confirm the build again."));}else if(engine.state.phase==="armed")$("#vi-expiry").textContent=Math.max(0,Math.ceil((engine.state.armedUntil-Date.now())/1000))+" s";},500);
    render();
    const skipped=(engine.state.importSkipped||[]).filter(id=>!engine.state.facts[id]);
    if(skipped.length){
      const message=(zh()?"以下设置保留在共享配置中，请重新回答或在辅助式编辑器中修改：":"These settings remain in the shared profile. Answer again or edit them in Assisted: ")+skipped.join(", ");
      caption(message);R2.annunciator?.raise("R2-VOI-012",{detail:message},"interview");
    }
    R2.i18n?.refresh();
  }
  function showDropped(){
    const keys=engine?.state.droppedOnLoad||[];
    if(keys.length){R2.annunciator?.raise("R2-MEM-003",{n:keys.length,list:keys.join(", ")},"interview");caption((zh()?"已保留配置；请重新回答：":"Profile retained. Please answer again: ")+keys.join(", "));}
  }
  document.addEventListener("r2-alert-ack",event=>{
    if(event.detail.source==="voice"&&dialog?.open)requestAnimationFrame(()=>render());
  });
  document.addEventListener("r2-language",()=>{if(dialog?.open){V.stopRecognition();V.cancelSpeech();disarm();persist();render();}});
  window.addEventListener("hashchange",()=>{if(dialog?.open&&!busy)close();});
  R2.voiceBuilder={open,input,get engine(){return engine;},get profile(){return shared;}};
})(window.R2);
