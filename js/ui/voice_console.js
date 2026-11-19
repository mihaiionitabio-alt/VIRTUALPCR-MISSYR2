/* Local-only speech, language-pack installation and the common computer status strip. */
(function (R2) {
  "use strict";
  let recognition=null, listening=false, speechOn=false, generation=0, status="Ready", replay=null, stopAction=null;
  let modalOrder=[];
  let sessionActive=false,sessionUntil=0,sessionTimer=null,resumeTimer=null,sessionHandlers=null,sessionScope="console",sessionMinutes=10;
  try{const n=Number(localStorage.getItem("missy-r2-mic-minutes"));if(n>=1&&n<=120)sessionMinutes=Math.round(n);}catch{}
  const playbackLocks=new Set();let speechGeneration=0,speechRelease=null,speechPending=false,speaking=false,speechTimer=null;
  let bar, voiceActive=false, lag=0, lastTick=performance.now(), packState="unknown", micAction=null;
  let micStream=null, meterContext=null, meterSource=null, meterTimer=null, level=0, micPending=false, meterUnavailable=false;
  const SR=()=>window.SpeechRecognition || window.webkitSpeechRecognition;
  const lang=()=>document.getElementById("voice-pack-language")?.value || "en-US";
  const tr=s=>R2.i18n?.text(s)||s;
  const store=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  function setStatus(text){status=text;paint();
    // recognition, speech and storage problems also go to the alert panel (identifier only)
    const A=R2.annunciator;if(!A)return;const c=A.classify(text,"info");
    if(c.entry&&["VOI","MEM"].includes(c.entry.area))A.sync("console",[{text,kind:"info"}]);else if(/^(Ready|Listening)/.test(text))A.clearSource("console");}
  function packMessage(text){const n=document.getElementById("voice-pack-status");if(n)n.textContent=text;for(const other of document.querySelectorAll("[data-pack-message]"))other.textContent=tr(text);R2.i18n?.refresh();
    const A=R2.annunciator,c=A?.classify(text,"info");if(c&&c.entry.area==="VOI")A.sync("pack",[{text,kind:"info"}]);else A?.clearSource("pack");}
  async function pack(install=false) {
    const C=SR(),button=document.getElementById("voice-pack-install"), selected=lang();
    if(!C || typeof C.available!=="function" || typeof C.install!=="function") {
      packState="unsupported";packMessage("Local speech packs are unavailable in this browser. Use typed answers, or open the site in a browser with on-device speech recognition.");return false;
    }
    button.disabled=true;
    try {
      packMessage(install?"Checking the English offline recognition pack…":"Checking local recognition…");
      packState=await C.available({langs:[selected],processLocally:true});
      if(install && (packState==="downloadable"||packState==="downloading")) {
        packMessage("Downloading / installing the English pack. Keep this page open…");
        const ok=await C.install({langs:[selected],processLocally:true});
        packState=ok?await C.available({langs:[selected],processLocally:true}):"unavailable";
      }
      packMessage(packState==="available"?"English offline recognition pack is ready.":
        packState==="downloadable"?"English offline pack is available. Click Download / install English pack.":
        packState==="downloading"?"English pack is downloading. Check again after it completes.":
        "No local English pack is available for this browser. You can type or tap every answer.");
      return packState==="available";
    } catch(err){packState="error";packMessage("Language-pack request failed: "+err.message);return false;}
    finally{button.disabled=false;}
  }
  function closeMeter(){clearInterval(meterTimer);meterTimer=null;micStream?.getTracks().forEach(t=>t.stop());micStream=null;try{meterSource?.disconnect();}catch{}meterSource=null;const c=meterContext;meterContext=null;void c?.close().catch(()=>{});level=0;}
  function meterPaint(){for(const el of document.querySelectorAll('[data-r2-mic-meter]')){const n=Math.round(level*100);el.setAttribute('aria-valuenow',String(n));el.firstElementChild.style.width=n+'%';el.setAttribute('aria-valuetext',meterUnavailable?tr('Level unavailable'):n+'%');}}
  async function openMeter(token){
    meterUnavailable=false;if(!navigator.mediaDevices?.getUserMedia){meterUnavailable=true;meterPaint();return;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});if(token!==generation){stream.getTracks().forEach(t=>t.stop());return;}micStream=stream;
    try{const C=window.AudioContext||window.webkitAudioContext;meterContext=new C();meterSource=meterContext.createMediaStreamSource(stream);const a=meterContext.createAnalyser();a.fftSize=256;meterSource.connect(a);const data=new Float32Array(a.fftSize);await meterContext.resume();
      if(token!==generation)return;meterTimer=setInterval(()=>{a.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;const rms=Math.sqrt(sum/data.length);level=rms>0?Math.max(0,Math.min(1,(20*Math.log10(rms)+60)/54)):0;meterPaint();},80);
    }catch{meterUnavailable=true;meterPaint();}
  }
  function pauseRecognition(){generation++;const rec=recognition;recognition=null;listening=false;micPending=false;status="Ready";try{rec?.abort();}catch{}closeMeter();paint();meterPaint();}
  function endSession(){sessionActive=false;sessionUntil=0;sessionHandlers=null;clearTimeout(resumeTimer);resumeTimer=null;clearInterval(sessionTimer);sessionTimer=null;}
  function stopRecognition(){endSession();pauseRecognition();}
  function sessionScopeReady(){return !document.hidden&&(sessionScope!=="interview"||(voiceActive&&topDialog()?.id==="voice-builder"&&(R2.voiceBuilder?.canListen!==false)));}
  function resumeSession(){
    clearTimeout(resumeTimer);resumeTimer=null;
    if(!sessionActive||listening||micPending||playbackLocks.size||!sessionScopeReady())return;
    if(Date.now()>=sessionUntil){stopRecognition();setStatus("Microphone session expired. Start a new session to continue.");return;}
    resumeTimer=setTimeout(()=>{resumeTimer=null;if(sessionActive&&!playbackLocks.size&&sessionScopeReady()&&Date.now()<sessionUntil&&!listening&&!micPending)void listen(sessionHandlers.final,sessionHandlers.interim);},400);
  }
  function setSessionMinutes(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>120)return false;sessionMinutes=Math.round(n);store("missy-r2-mic-minutes",String(sessionMinutes));if(sessionActive)sessionUntil=Date.now()+sessionMinutes*60000;paint();return true;}
  function startSession(onFinal,onInterim){
    endSession();pauseRecognition();sessionActive=true;sessionUntil=Date.now()+sessionMinutes*60000;sessionScope=voiceActive?"interview":"console";sessionHandlers={final:onFinal,interim:onInterim};
    sessionTimer=setInterval(()=>{if(Date.now()>=sessionUntil){stopRecognition();setStatus("Microphone session expired. Start a new session to continue.");}else paint();},1000);
    if(playbackLocks.size||!sessionScopeReady()){setStatus("Microphone session paused during playback or another panel.");resumeSession();return;}
    void listen(onFinal,onInterim);paint();
  }
  function stop(){R2.annunciator?.silence();R2.sound?.stop();stopRecognition();cancelSpeech();if(voiceActive&&R2.batchRuns?.busy())R2.batchRuns.cancel();stopAction?.();setStatus("Paused");}
  function beginPlayback(owner){
    const token=Symbol(String(owner||"audio"));playbackLocks.add(token);pauseRecognition();if(sessionActive)setStatus("Microphone paused while audio is playing.");
    let released=false;return ()=>{if(released)return;released=true;playbackLocks.delete(token);paint();resumeSession();};
  }
  function cancelSpeech(){clearTimeout(speechTimer);speechTimer=null;speechGeneration++;speechPending=false;speaking=false;try{window.speechSynthesis?.cancel();}catch{}speechRelease?.();speechRelease=null;paint();}
  function localVoice(synth,want){return synth.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith(want));}
  async function waitForVoice(synth,want){
    const found=localVoice(synth,want);if(found)return found;
    await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);synth.removeEventListener?.("voiceschanged",changed);resolve();};const changed=()=>{if(localVoice(synth,want))done();};synth.addEventListener?.("voiceschanged",changed);timer=setTimeout(done,1800);});
    return localVoice(synth,want);
  }
  async function speak(text){
    const synth=window.speechSynthesis;if(!speechOn||!text)return false;if(!synth){setStatus("Speech output unavailable. Captions remain available.");return false;}
    cancelSpeech();R2.sound?.stop();const token=speechGeneration,release=beginPlayback("spoken-prompt");speechRelease=release;speechPending=true;setStatus("Preparing spoken question…");
    try{
      const want=R2.i18n?.language==="zh"?"zh":"en",voice=await waitForVoice(synth,want);
      if(token!==speechGeneration)return false;
      if(!voice){speechPending=false;release();speechRelease=null;setStatus("No local speech voice for this language. Recognition packs do not install speaking voices. Use captions or select another interface language.");return false;}
      const msg=new SpeechSynthesisUtterance(text);msg.voice=voice;msg.lang=voice.lang;msg.rate=.95;
      let finished=false;const finish=error=>{if(finished||token!==speechGeneration)return;finished=true;clearTimeout(speechTimer);speechTimer=null;speechPending=false;speaking=false;release();speechRelease=null;setStatus(error?"Speech output unavailable. Captions remain available.":"Question finished. Click Start microphone to answer.");};
      msg.onstart=()=>{if(finished||token!==speechGeneration)return;clearTimeout(speechTimer);speechTimer=setTimeout(()=>{if(token===speechGeneration){finish(true);synth.cancel();}},Math.max(20000,text.length*180));speechPending=false;speaking=true;setStatus("Speaking question — microphone is off.");};msg.onend=()=>finish(false);msg.onerror=()=>finish(true);
      synth.speak(msg);if(speechPending)speechTimer=setTimeout(()=>{if(token===speechGeneration&&speechPending){finish(true);synth.cancel();}},5000);return true;
    }catch{if(token===speechGeneration){speechPending=false;speaking=false;release();speechRelease=null;setStatus("Speech output unavailable. Captions remain available.");}return false;}
  }
  async function respond(message,{wake=false,viewChanged=false}={}){
    if(!speechOn){if(wake)void R2.sound?.play('received');return;}
    cancelSpeech();R2.sound?.stop();const token=speechGeneration,release=beginPlayback('voice-response');
    try{
      if(wake)await R2.sound?.play('received',false,true);
      if(token!==speechGeneration||!speechOn)return;
      if(viewChanged)await R2.sound?.play('viewMenu',false,true);
      if(token!==speechGeneration||!speechOn)return;
      await speak(message);
    }finally{release();}
  }
  function startDialogue(){speechOn=true;replay?.();paint();}
  function pauseDialogue(){speechOn=false;stopRecognition();cancelSpeech();setStatus("Spoken interview paused.");}
  async function listen(onFinal,onInterim) {
    if(playbackLocks.size){setStatus("Wait for playback to finish before starting the microphone.");return false;}
    pauseRecognition();const token=generation;const C=SR();
    if(!C || typeof C.available!=="function" || !('processLocally' in new C())){endSession();setStatus("Local recognition unavailable. Type or tap an answer.");return false;}
    try {
      if(await C.available({langs:[lang()],processLocally:true})!=="available") {endSession();setStatus("Install the English offline pack on the first page, or type an answer.");return false;}
      if(token!==generation)return false;
      micPending=true;setStatus("Opening microphone…");await openMeter(token);
      if(token!==generation)return false;
      window.speechSynthesis?.cancel();const rec=recognition=new C();rec.lang=lang();rec.processLocally=true;
      rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;let received=false;
      rec.onstart=()=>{if(token!==generation)return;micPending=false;listening=true;setStatus("Listening locally…");};
      rec.onresult=e=>{
        if(token!==generation)return;
        const r=e.results[e.results.length-1];onInterim?.(tr("Recognising locally…"));
        if(r.isFinal&&!received){received=true;const confidence=r[0].confidence;
          pauseRecognition();if(Number.isFinite(confidence)&&confidence>0&&confidence<.55){setStatus("Uncertain recognition. Please repeat or use the buttons.");resumeSession();return;}
          onFinal(r[0].transcript,{via:"voice",engine:"native-on-device",confidence:Number.isFinite(confidence)?confidence:null});resumeSession();
        }
      };
      rec.onend=()=>{if(token===generation){pauseRecognition();setStatus("Ready");resumeSession();}};
      rec.onerror=e=>{if(token===generation){if(e.error==="no-speech"){pauseRecognition();setStatus("Ready");resumeSession();}else{stopRecognition();setStatus("Microphone: "+e.error+". Type or tap an answer.");}}};
      rec.start();return true;
    }catch(err){if(token===generation){stopRecognition();setStatus("Local microphone could not start: "+err.message);}return false;}
  }
  function paint(){
    if(!bar)return;
    const memory=performance.memory;
    bar.querySelector(".r2-machine").textContent=(memory?Math.round(memory.usedJSHeapSize/1048576)+" MB · ":"")+
      (navigator.hardwareConcurrency?navigator.hardwareConcurrency+(R2.i18n?.language==="zh"?" 个逻辑处理器 · ":" logical cores · "):"")+Math.round(lag)+(R2.i18n?.language==="zh"?" ms 界面延迟":" ms UI delay");
    bar.querySelector(".r2-console-state").textContent=tr(R2.batchRuns?.busy()?"Generating virtual runs…":status);
    bar.querySelector(".r2-voice-play").hidden=!voiceActive;
    bar.querySelector(".r2-voice-stop").hidden=!voiceActive;
    bar.querySelector(".r2-voice-stop").textContent="■ "+tr("Stop");
    bar.querySelector(".r2-voice-play").setAttribute("aria-pressed",String(speechOn));
    bar.querySelector(".r2-voice-play").textContent=tr(speechOn?"■ Pause spoken interview":"▶ Start spoken interview");
    bar.querySelector(".r2-listening").hidden=!listening;
    document.dispatchEvent(new Event("r2-voice-state"));
  }
  function topDialog(records=[]){
    modalOrder=modalOrder.filter(d=>d.isConnected&&d.open);
    for(const r of records)if(r.type==="attributes"&&r.attributeName==="open"&&r.target.matches('dialog')&&r.target.open){modalOrder=modalOrder.filter(d=>d!==r.target);modalOrder.push(r.target);}
    for(const d of document.querySelectorAll('dialog[open]'))if(!modalOrder.includes(d))modalOrder.push(d);
    return modalOrder.at(-1)||null;
  }
  function attach(records=[]){
    if(!bar)return;const host=topDialog(records)||document.body;
    if(bar.parentNode!==host)host.append(bar);
    if(host.tagName==="DIALOG"&&bar.querySelector(".r2-language"))for(const duplicate of host.querySelectorAll(":scope>.r2-language"))duplicate.remove();
    if(sessionActive){if(!sessionScopeReady()){pauseRecognition();setStatus("Microphone session paused during playback or another panel.");}else resumeSession();}
  }
  function init(){
    bar=document.createElement("footer");bar.id="r2-console-bar";bar.dataset.i18nSkip="";
    bar.innerHTML='<span class="r2-console-brand">MISSY R2</span><span class="r2-console-state"></span><span class="r2-listening" hidden>● MIC</span><span class="r2-machine" title="Browser heap, logical processors and timer scheduling delay; not CPU utilisation"></span><button type="button" class="r2-voice-play" hidden></button><button type="button" class="r2-voice-stop" hidden>■ Stop</button>';
    bar.querySelector(".r2-voice-play").onclick=()=>speechOn?pauseDialogue():startDialogue();
    bar.querySelector(".r2-voice-stop").onclick=stop;document.body.append(bar);
    document.getElementById("voice-pack-install").onclick=()=>pack(true);
    document.getElementById("voice-pack-check").onclick=()=>pack(false);
    document.getElementById("voice-pack-language").onchange=e=>{stopRecognition();packState="unknown";store("missy-r2-recognition-language",e.target.value);packMessage("Check or download the selected English pack.");};
    try{const previous=localStorage.getItem("missy-r2-recognition-language");if(["en-US","en-GB"].includes(previous))document.getElementById("voice-pack-language").value=previous;}catch{}
    new MutationObserver(records=>{
      if(records.some(r=>r.type==="attributes"||[...r.addedNodes,...r.removedNodes].some(n=>n===bar||n.nodeType===1&&(n.matches("dialog")||n.contains(bar)))))attach(records);
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["open"]});
    setInterval(()=>{const now=performance.now();lag=Math.max(0,now-lastTick-1000);lastTick=now;paint();},1000);
    document.addEventListener("r2-language",paint);paint();
    document.addEventListener("visibilitychange",()=>{if(document.hidden){stopRecognition();cancelSpeech();}});
    window.addEventListener("pagehide",()=>{stopRecognition();cancelSpeech();});
  }
  R2.voiceConsole={pack,listen,stopRecognition,pauseRecognition,startSession,resumeSession,setSessionMinutes,speak,stop,setStatus,topDialog,beginPlayback,respond,startDialogue,pauseDialogue,cancelSpeech,
    stopMicrophone(){stopRecognition();cancelSpeech();R2.sound?.stop();},
    activate(handlers){voiceActive=!!handlers;replay=handlers?.play||null;stopAction=handlers?.stop||null;micAction=handlers?.microphone||null;if(!handlers){speechOn=false;stopRecognition();cancelSpeech();R2.sound?.stop();}paint();},
    startMicrophone(){if(listening||micPending)return;if(playbackLocks.size){setStatus("Wait for playback to finish before starting the microphone.");return;}if(micAction)return micAction();return startSession(raw=>R2.consoleUi?.command(raw,true));},
    get sessionActive(){return sessionActive;},get sessionMinutes(){return sessionMinutes;},get sessionRemaining(){return sessionActive?Math.max(0,Math.ceil((sessionUntil-Date.now())/1000)):0;},
    get playbackBusy(){return playbackLocks.size>0;},get speechOn(){return speechOn;},get speaking(){return speaking||speechPending;},
    get status(){return status;},get pending(){return micPending;},get level(){return level;},get active(){return voiceActive;},get listening(){return listening;},get language(){return lang();},get packState(){return packState;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window.R2);
