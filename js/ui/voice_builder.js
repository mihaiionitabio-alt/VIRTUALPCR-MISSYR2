/* Voice interview UI. Shared batch profile; captions, typed and tap alternatives. */
(function(R2){
  "use strict";
  const U=R2.batchUi,B=R2.batchRuns,V=R2.voiceConsole,esc=R2.esc;
  const KEY="missy-r2-voice-draft-v2", LT="missy-r2-voice-last-v2";
  let dialog,engine,shared=null,paused=false,busy=false,ack=new Set(),result=null,expiryTimer,screen="question",lastQuestionId=null,staticText=[],staticAttrs=[];
  const zh=()=>R2.i18n?.language==="zh";
  const uiZh={"Go back":"返回","Back to question":"返回当前问题","Build a profile by voice":"通过语音创建配置","Assisted":"辅助式","Visual blocks":"可视积木","Audio interview":"语音访谈","Profile read-back":"配置复述","Voice command guide":"语音指令指南","JSON history":"JSON 历史","Previous question":"上一个问题","Resume saved interview":"继续已保存访谈","Answer or command":"答案或命令","Send":"发送","Undo":"撤销","Say again":"再说一遍","Review":"审核","Profile JSON · exact settings":"配置 JSON · 确切设置","Download profile (.json)":"下载配置 (.json)","Download decisions":"下载决策记录","Load interview":"加载访谈","Confirm build":"确认生成","Launch virtual runs":"启动虚拟运行","Stop generation":"停止生成","Open the Quality manager":"打开质量管理","Open MISSY":"打开 MISSY","Download these RDMLt files (.zip)":"下载这些 RDMLt 文件 (.zip)","Forget saved interview memory":"清除已保存的访谈记忆","Profile history · JSON only":"配置历史 · 仅 JSON","Interview":"访谈","Read-back":"复述","Ready to launch":"已准备启动","Complete":"已完成","Acknowledged.":"收到。"};
  const tr=s=>zh()?(uiZh[s]||R2.i18n?.text(s)||s):s;
  function captureUiText(){
    staticText=[];staticAttrs=[];const walker=document.createTreeWalker(dialog,NodeFilter.SHOW_TEXT);let node;
    const dynamic='#vi-page-title,#vi-back,#vi-question,#vi-options,#vi-count,#vi-phase,#vi-expiry,#vi-caption,#vi-error,#vi-clauses,#vi-check,#vi-hash,#vi-json,#vi-log,#vi-memory,pre,code';
    while((node=walker.nextNode()))if(node.nodeValue.trim()&&!node.parentElement.closest(dynamic))staticText.push([node,node.nodeValue]);
    for(const el of dialog.querySelectorAll('[title],[aria-label],[placeholder]'))for(const key of ['title','aria-label','placeholder'])if(el.hasAttribute(key))staticAttrs.push([el,key,el.getAttribute(key)]);
  }
  function localizeUi(){
    for(const [node,en]of staticText)if(node.isConnected){const leading=en.match(/^\s*/)[0],trailing=en.match(/\s*$/)[0],value=leading+tr(en.trim())+trailing;if(node.nodeValue!==value)node.nodeValue=value;}
    for(const [el,key,en]of staticAttrs)if(el.isConnected)el.setAttribute(key,tr(en));
  }
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
  function caption(message){const n=dialog?.querySelector("#vi-caption");if(n){n.textContent=message;n.hidden=!message;}}
  const wakeInstruction=()=>zh()?"请以 Computer 或 Missy 开头作答，例如 Computer default 或 Missy yes。":"Begin each spoken answer or command with Computer or Missy, for example Computer default or Missy yes.";
  function showScreen(next){
    screen=next;dialog.querySelectorAll('[data-vi-screen]').forEach(n=>n.hidden=n.dataset.viScreen!==next);
    dialog.dataset.voiceScreen=next;dialog.scrollTop=0;
    V.pauseRecognition();V.resumeSession();
    const title=next==='readback'?'Profile read-back':next==='guide'?'Voice command guide':next==='history'?'Profile history · JSON only':'Build a profile by voice';dialog.querySelector('#vi-page-title').textContent=tr(title);dialog.querySelector('#vi-back').textContent=tr(next==='question'?'Go back':'Back to question');
    document.getElementById('r2-console-bar')?.classList.toggle('r2-audio-page',true);
    const heading=next==='question'?dialog.querySelector('#vi-question'):dialog.querySelector('#vi-page-title');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function openReadback(narrate=true){const changed=screen!=='readback';showScreen('readback');render();if(narrate&&V.speechOn)V.respond((zh()?"收到，已打开配置复述。":"Acknowledged. Profile read-back opened. ")+readbackClauses().map(c=>zh()?c.zh:c.en).join(' '),{viewChanged:changed});return changed;}
  function sayLatest(){
    let message;
    if(screen==='guide')message=guideSpeech();
    else if(screen==='readback'||["review","armed"].includes(engine.state.phase))message=readbackClauses().map(c=>zh()?c.zh:c.en).join(' ');
    else{const turns=engine.state.turns.filter(x=>x.role==='missy'),last=current()||turns.at(-1);message=last?text(last):'';}
    V.speak(wakeInstruction()+' '+message);
  }
  function guideSpeech(){return zh()?"在底栏开始语音访谈，然后启动麦克风一次。会话默认十分钟。以 Computer 或 Missy 开头说答案或命令。播放时麦克风暂停，结束后自动恢复。可说 Computer back、Computer undo、Computer say again、Computer where am I、Computer read back、Computer confirm build 或 Computer launch。生成期间请使用停止生成按钮。":"Start spoken interview in the bottom bar, then start the microphone once. The session defaults to ten minutes. Begin spoken answers and commands with Computer or Missy. The microphone pauses for playback and resumes automatically. Say Computer back, Computer undo, Computer say again, Computer where am I, Computer read back, Computer confirm build, or Computer launch. During generation, use the Stop generation button.";}
  function appliedSummary(before,after,turns,command){
    if(command==='say again')return zh()?'重复当前问题。':'Repeating the current question.';
    const changed=JSON.stringify(before)!==JSON.stringify(after),failure=turns.find(t=>['clarify','refuse','error','nogo','refused'].includes(t.kind));
    if(failure)return (zh()?"未应用此答案。":"That answer was not applied. ")+text(failure);
    const echoes=turns.filter(t=>['echo','copy','undo','dormant'].includes(t.kind));
    if(echoes.length)return (changed?(zh()?"已应用：":"Applied: "):(zh()?"保留当前设置：":"Kept the current setting: "))+echoes.map(text).join(' ');
    const info=turns.find(t=>['status','armed','confirm','pause','save'].includes(t.kind));
    return info?text(info):(changed?(zh()?"配置已更新。":"The profile has been updated."):(zh()?"配置未更改。":"No profile settings changed."));
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
    let answer=String(raw);
    if(meta.via==="voice"){
      const wake=answer.match(/^\s*(?:computer|missy)(?=[\s,.:!?，。：！？-]|$)[\s,.:!?，。：！？-]*(.*)$/i);
      if(!wake||!wake[1].trim()){caption(tr("Begin spoken answers with Computer or Missy."));V.setStatus("Begin spoken answers with Computer or Missy.");V.resumeSession();return;}
      answer=wake[1];
    }
    let command=canonicalCommand(answer).trim();
    if(/^(?:profile )?read[- ]?back$/i.test(command))command="read back";
    if(/^(?:voice )?(?:command )?guide$/i.test(command)){const changed=screen!=='guide';showScreen('guide');if(V.speechOn)V.respond(guideSpeech(),{wake:meta.via==='voice',viewChanged:changed});return;}
    if(command==='read back'){const changed=openReadback(false);if(V.speechOn)V.respond((zh()?"收到。":"Acknowledged. ")+readbackClauses().map(c=>zh()?c.zh:c.en).join(' '),{wake:meta.via==='voice',viewChanged:changed});return;}
    if(command==='back'&&screen!=='question'){showScreen('question');if(V.speechOn)V.respond((zh()?"收到，已返回当前问题。":"Acknowledged. Returned to the current question. ")+(current()?text(current()):''),{wake:meta.via==='voice',viewChanged:true});return;}
    if(screen!=='question'&&!/^(?:back|undo|say again|where am i|read back|stop|save|finish|review|confirm build|launch|change .+|same as .+|rest as method)$/i.test(command)){const message=tr('Return to the question to answer it.');caption(message);V.setStatus('Return to the question to answer it.');if(V.speechOn)V.respond(message,{wake:meta.via==='voice'});V.resumeSession();return;}
    if(screen!=='question'&&engine.state.phase==='interview'&&!['stop','save'].includes(command))showScreen('question');
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
    const before=engine.profile(),previousProfile=JSON.stringify(before),previousCursor=engine.state.cursor,previousScreen=screen;
    const turns=engine.handle(command,meta);
    if(JSON.stringify(engine.profile())!==previousProfile||command==="stop")clearAcks();
    sync();
    // interview events with a catalogue identifier (no wording is logged, only the identifier)
    const KIND={clarify:"R2-VOI-001",dormant:"R2-VOI-004",refuse:"R2-VOI-009",error:"R2-VOI-011",nogo:"R2-CMD-024",refused:"R2-CMD-021",armed:"R2-CMD-020"};
    R2.annunciator?.clearSource("interview");
    for(const t of turns)if(KIND[t.kind])R2.annunciator?.raise(KIND[t.kind],{detail:text(t)},"interview");
    render();
    if(['review','armed','done'].includes(engine.state.phase))showScreen('readback');
    const summary=appliedSummary(before,shared,turns,command),failure=turns.some(t=>['clarify','refuse','error','nogo','refused'].includes(t.kind));
    caption((failure?'':tr('Acknowledged.')+' ')+summary);
    const nextQuestion=engine.state.phase==='interview'&&current()?text(current()):'';
    const response=(failure?'':tr('Acknowledged.')+' ')+summary+(nextQuestion?' '+nextQuestion+' '+wakeInstruction():'');
    if(!paused)V.respond(response,{wake:meta.via==='voice',viewChanged:previousCursor!==engine.state.cursor||previousScreen!==screen});
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
    dialog.querySelector("#vi-question").textContent=state.phase==="interview"&&q?text(q):tr("Review your profile before generating virtual runs.");
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
    if(screen==="question"&&state.phase==="interview"&&lastQuestionId!==state.cursor){lastQuestionId=state.cursor;dialog.scrollTop=0;const heading=dialog.querySelector("#vi-question");heading.tabIndex=-1;heading.focus({preventScroll:true});}
    dialog.querySelector("#vi-cancel-run").hidden=!busy;
    localizeUi();
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
    if(!dialog){dialog=document.createElement("dialog");dialog.id="voice-builder";dialog.className="batch-dialog";dialog.dataset.i18nSkip="";document.body.append(dialog);dialog.addEventListener("cancel",e=>{e.preventDefault();if(!busy){close();R2.profileStudio.open();}else V.stop();});dialog.addEventListener("close",()=>{V.activate(null);clearInterval(expiryTimer);});}
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
    R2.annunciator?.clearSource("voice-import");disarm();paused=false;result=null;screen="question";lastQuestionId=null;
    dialog.innerHTML=`<div class="batch-shell voice-shell vi-vui"><div class="batch-top"><button type="button" id="vi-back">Go back</button><nav class="studio-switch"><button type="button" data-mode="assisted">Assisted</button><button type="button" data-mode="visual">Visual blocks</button><button type="button" aria-pressed="true">Audio interview</button></nav></div>
      <header class="vi-vui-heading"><h1 id="vi-page-title">Build a profile by voice</h1><nav class="vi-screen-shortcuts" aria-label="Voice workspace shortcuts"><button type="button" id="vi-readback-shortcut" class="vi-shortcut"><svg viewBox="0 0 48 38" aria-hidden="true"><path d="M5 31h38M5 31V5M10 26h8l8-14h15M11 17h30"/></svg><span>Profile read-back</span></button><button type="button" id="vi-guide-shortcut" class="vi-shortcut"><svg viewBox="0 0 48 38" aria-hidden="true"><path d="M8 8h32v21H22l-9 6v-6H8zM16 14h16M16 21h12"/></svg><span>Voice command guide</span></button><button type="button" id="vi-history-shortcut" class="vi-shortcut"><svg viewBox="0 0 48 38" aria-hidden="true"><path d="M17 7h-6v10l-4 2 4 2v10h6M31 7h6v10l4 2-4 2v10h-6M21 13h6M21 19h6M21 25h6"/></svg><span>JSON history</span></button></nav></header>
      <div class="vi-stage-row"><span id="vi-phase" class="pill"></span><span id="vi-count"></span><span id="vi-expiry"></span><button type="button" id="vi-resume" ${resume?'':'hidden'}>Resume saved interview</button></div><progress id="vi-progress" max="1" value="0"></progress><p id="vi-error" role="alert" hidden></p>
      <section data-vi-screen="question" class="vi-pane vi-step"><div class="vi-wake-format">Computer / Missy …</div><h2 id="vi-question"></h2><div id="vi-options" class="vi-options"></div><form id="vi-form"><label for="vi-answer">Answer or command</label><div class="row"><input id="vi-answer" autocomplete="off" maxlength="300"><button id="vi-send" type="submit" class="primary">Send</button></div></form><p id="vi-caption" class="vi-implementation" role="status" hidden></p><div class="vi-tools row"><button type="button" data-command="back">Previous question</button><button type="button" data-command="undo">Undo</button><button type="button" data-command="say again">Say again</button><button type="button" data-command="finish">Review</button></div></section>
      <section data-vi-screen="readback" class="vi-pane vi-readback" hidden><h2>Profile read-back</h2><ol id="vi-clauses"></ol><div id="vi-check"></div><code id="vi-hash"></code><details><summary>Profile JSON · exact settings</summary><pre id="vi-json"></pre></details><div class="row"><button type="button" id="vi-save">Download profile (.json)</button><button type="button" id="vi-decisions">Download decisions</button><button type="button" id="vi-load">Load interview</button><input type="file" id="vi-file" accept=".json" hidden></div><div class="row"><button type="button" id="vi-confirm">Confirm build</button><button type="button" id="vi-launch" class="vi-launch" disabled>Launch virtual runs</button><button type="button" id="vi-cancel-run" hidden>Stop generation</button></div><progress id="vi-run-progress" max="1" value="0"></progress><div id="vi-result" class="stack" hidden><button type="button" id="vi-quality">Open the Quality manager</button><button type="button" id="vi-missy">Open MISSY</button><button type="button" id="vi-rdmlt">Download these RDMLt files (.zip)</button></div><button type="button" id="vi-forget">Forget saved interview memory</button></section>
      <section data-vi-screen="history" class="vi-pane" hidden><h2>Profile history · JSON only</h2><pre id="vi-log" class="vi-log"></pre><pre id="vi-memory"></pre></section>
      <section data-vi-screen="guide" class="vi-pane vi-guide" hidden><h2>Voice command guide</h2><p>Recognition uses English voice commands; the examples below are spoken in English.</p><p>Begin every spoken answer or command with Computer or Missy. Typed answers and buttons do not need a wake word.</p><dl><dt>Computer default / Missy yes / Computer option two</dt><dd>Answer the current question.</dd><dt>Computer back / Computer undo / Computer say again</dt><dd>Return to the previous question, undo an accepted setting, or repeat the prompt.</dd><dt>Computer where am I / Missy read back</dt><dd>Hear progress or open the full-screen profile read-back.</dd><dt>Computer change replicates in group one to two</dt><dd>Change a named setting; the applied value is read back.</dd><dt>Computer same as group one / Missy same as last time / Computer rest as method</dt><dd>Reuse settings or accept the remaining method defaults.</dd><dt>Computer confirm build / Computer launch</dt><dd>Review the complete profile and acknowledge cautions first. Confirm the build, then launch within the displayed time window.</dd><dt>Computer stop</dt><dd>Stop listening, pause the interview and disarm launch. While audio is playing, use the bottom-bar Stop button.</dd></dl><p>Start spoken interview in the bottom bar, then start the microphone once. Set the session duration in Microphone settings using min and ✓. The default is 10 minutes. Listening pauses during playback and resumes automatically while the session remains valid.</p><p>Each accepted answer is acknowledged, followed by a summary of the applied setting and the next question. Unprefixed speech is ignored and is not added to JSON history.</p><p>During generation the microphone is off. Use Stop generation to finish and file the current run before stopping the batch.</p></section></div>`;
    captureUiText();if(!dialog.open)dialog.showModal();
    const $=s=>dialog.querySelector(s);
    $("#vi-back").onclick=()=>screen==='question'?switchMode('picker'):showScreen('question');
    $("#vi-readback-shortcut").onclick=()=>openReadback();
    $("#vi-guide-shortcut").onclick=()=>{const changed=screen!=='guide';showScreen('guide');if(V.speechOn)V.respond(guideSpeech(),{viewChanged:changed});};
    $("#vi-history-shortcut").onclick=()=>{const changed=screen!=='history';showScreen('history');if(V.speechOn)V.respond(zh()?'收到，已打开 JSON 历史。':'Acknowledged. JSON history opened.',{viewChanged:changed});};
    dialog.querySelectorAll('[data-return-question]').forEach(b=>b.onclick=()=>showScreen('question'));
    $("#vi-cancel-run").onclick=()=>{B.cancel();caption(tr('Stopping after this run…'));};
    dialog.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));
    $("#vi-form").onsubmit=e=>{e.preventDefault();const raw=$("#vi-answer").value;$("#vi-answer").value="";input(raw);};
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
    V.activate({microphone:()=>{paused=false;V.startSession(input,caption);},play:()=>{paused=false;sayLatest();},stop:()=>{if(!busy)input("stop",{via:"button"});else caption(tr("Stopping after this run…"));}});
    expiryTimer=setInterval(()=>{if(engine.state.phase==="armed"&&Date.now()>engine.state.armedUntil){disarm();render();caption(tr("Launch window expired. Confirm the build again."));}else if(engine.state.phase==="armed")$("#vi-expiry").textContent=Math.max(0,Math.ceil((engine.state.armedUntil-Date.now())/1000))+" s";},500);
    showScreen(engine.state.phase==='interview'?'question':'readback');render();
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
  document.addEventListener("r2-language",()=>{if(dialog?.open){V.stopRecognition();V.cancelSpeech();disarm();persist();render();showScreen(screen);}});
  window.addEventListener("hashchange",()=>{if(dialog?.open&&!busy)close();});
  R2.voiceBuilder={open,input,openReadback,get screen(){return screen;},get canListen(){return !!dialog?.open;},get engine(){return engine;},get profile(){return shared;}};
})(window.R2);
