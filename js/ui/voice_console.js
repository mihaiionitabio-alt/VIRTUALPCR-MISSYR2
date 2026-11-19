/* Local-only speech, language-pack installation and the common computer status strip. */
(/* @r2fn R2-C0081-F00001 */function (R2) {
  "use strict";
  let recognition=null, listening=false, speechOn=false, generation=0, status="Ready", replay=null, stopAction=null;
  let modalOrder=[];
  let sessionActive=false,sessionUntil=0,sessionTimer=null,resumeTimer=null,sessionHandlers=null,sessionScope="console",sessionMinutes=10;
  try{const n=Number(localStorage.getItem("missy-r2-mic-minutes"));if(n>=1&&n<=120)sessionMinutes=Math.round(n);}catch{}
  const playbackLocks=new Map();let wakeUntil=0,wakeCue=Promise.resolve(),wakeEpoch=0;let speechGeneration=0,speechRelease=null,speechPending=false,speaking=false,speechTimer=null;
  let bar, voiceActive=false, lag=0, lastTick=performance.now(), packState="unknown", micAction=null;
  let micStream=null, meterContext=null, meterSource=null, meterTimer=null, level=0, micPending=false, meterUnavailable=false;
  const SR=/* @r2fn R2-C0081-F00002 */()=>window.SpeechRecognition || window.webkitSpeechRecognition;
  const lang=/* @r2fn R2-C0081-F00003 */()=>document.getElementById("voice-pack-language")?.value || "en-US";
  const tr=/* @r2fn R2-C0081-F00004 */s=>R2.i18n?.text(s)||s;
  const store=/* @r2fn R2-C0081-F00005 */(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
  /* @r2fn R2-C0081-F00006 */function setStatus(text){status=text;paint();
    // recognition, speech and storage problems also go to the alert panel (identifier only)
    const A=R2.annunciator;if(!A)return;const c=A.classify(text,"info");
    if(c.entry&&["VOI","MEM"].includes(c.entry.area))A.sync("console",[{text,kind:"info"}]);else if(/^(Ready|Listening)/.test(text))A.clearSource("console");}
  /* @r2fn R2-C0081-F00007 */function packMessage(text){const n=document.getElementById("voice-pack-status");if(n)n.textContent=text;for(const other of document.querySelectorAll("[data-pack-message]"))other.textContent=tr(text);R2.i18n?.refresh();
    const A=R2.annunciator,c=A?.classify(text,"info");if(c&&c.entry.area==="VOI")A.sync("pack",[{text,kind:"info"}]);else A?.clearSource("pack");}
  /* @r2fn R2-C0081-F00008 */async function pack(install=false) {
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
  /* @r2fn R2-C0081-F00009 */function closeMeter(){clearInterval(meterTimer);meterTimer=null;micStream?.getTracks().forEach(/* @r2fn R2-C0081-F00010 */t=>t.stop());micStream=null;try{meterSource?.disconnect();}catch{}meterSource=null;const c=meterContext;meterContext=null;void c?.close().catch(/* @r2fn R2-C0081-F00011 */()=>{});level=0;}
  /* @r2fn R2-C0081-F00012 */function meterPaint(){for(const el of document.querySelectorAll('[data-r2-mic-meter]')){const n=Math.round(level*100);el.setAttribute('aria-valuenow',String(n));el.firstElementChild.style.width=n+'%';el.setAttribute('aria-valuetext',meterUnavailable?tr('Level unavailable'):n+'%');}}
  /* @r2fn R2-C0081-F00013 */async function openMeter(token){
    meterUnavailable=false;if(!navigator.mediaDevices?.getUserMedia){meterUnavailable=true;meterPaint();return;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(token!==generation){stream.getTracks().forEach(/* @r2fn R2-C0081-F00014 */t=>t.stop());return;}micStream=stream;
    try{const C=window.AudioContext||window.webkitAudioContext;meterContext=new C();meterSource=meterContext.createMediaStreamSource(stream);const a=meterContext.createAnalyser();a.fftSize=256;meterSource.connect(a);const data=new Float32Array(a.fftSize);await meterContext.resume();
      if(token!==generation)return;meterTimer=setInterval(/* @r2fn R2-C0081-F00015 */()=>{a.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;const rms=Math.sqrt(sum/data.length);level=rms>0?Math.max(0,Math.min(1,(20*Math.log10(rms)+60)/54)):0;meterPaint();},80);
    }catch{meterUnavailable=true;meterPaint();}
  }
  /* @r2fn R2-C0081-F00016 */function pauseRecognition(){generation++;const rec=recognition;recognition=null;listening=false;micPending=false;status="Ready";try{rec?.abort();}catch{}closeMeter();paint();meterPaint();}
  /* @r2fn R2-C0081-F00017 */function endSession(){sessionActive=false;sessionUntil=0;sessionHandlers=null;clearTimeout(resumeTimer);resumeTimer=null;clearInterval(sessionTimer);sessionTimer=null;}
  /* @r2fn R2-C0081-F00018 */function stopRecognition(){wakeUntil=0;wakeEpoch++;endSession();pauseRecognition();}
  /* @r2fn R2-C0081-F00019 */function sessionScopeReady(){return !document.hidden&&(sessionScope!=="interview"||(voiceActive&&topDialog()?.id==="voice-builder"&&(R2.voiceBuilder?.canListen!==false)));}
  const wakePlayback=/* @r2fn R2-C0081-F00020 */()=>playbackLocks.size>0&&[...playbackLocks.values()].every(/* @r2fn R2-C0081-F00021 */owner=>["spoken-prompt","voice-response","vui-effect"].includes(owner));
  /* @r2fn R2-C0081-F00022 */function resumeSession(){
    clearTimeout(resumeTimer);resumeTimer=null;
    if(!sessionActive||listening||micPending||(playbackLocks.size&&!wakePlayback())||!sessionScopeReady())return;
    if(Date.now()>=sessionUntil){stopRecognition();setStatus("Microphone session expired. Start a new session to continue.");return;}
    resumeTimer=setTimeout(/* @r2fn R2-C0081-F00023 */()=>{resumeTimer=null;if(sessionActive&&(!playbackLocks.size||wakePlayback())&&sessionScopeReady()&&Date.now()<sessionUntil&&!listening&&!micPending)void listen(sessionHandlers.final,sessionHandlers.interim);},400);
  }
  /* @r2fn R2-C0081-F00024 */function setSessionMinutes(value){const n=Number(value);if(!Number.isInteger(n)||n<1||n>120)return false;sessionMinutes=Math.round(n);store("missy-r2-mic-minutes",String(sessionMinutes));if(sessionActive)sessionUntil=Date.now()+sessionMinutes*60000;paint();return true;}
  /* @r2fn R2-C0081-F00025 */function startSession(onFinal,onInterim){
    wakeUntil=0;wakeEpoch++;endSession();pauseRecognition();sessionActive=true;sessionUntil=Date.now()+sessionMinutes*60000;sessionScope=voiceActive?"interview":"console";sessionHandlers={final:onFinal,interim:onInterim};
    sessionTimer=setInterval(/* @r2fn R2-C0081-F00026 */()=>{if(Date.now()>=sessionUntil){stopRecognition();setStatus("Microphone session expired. Start a new session to continue.");}else paint();},1000);
    if((playbackLocks.size&&!wakePlayback())||!sessionScopeReady()){setStatus("Microphone session paused during playback or another panel.");resumeSession();return;}
    void listen(onFinal,onInterim);paint();
  }
  /* @r2fn R2-C0081-F00027 */function stop(){R2.annunciator?.silence();R2.sound?.stop();stopRecognition();cancelSpeech();if(voiceActive&&R2.batchRuns?.busy())R2.batchRuns.cancel();stopAction?.();setStatus("Paused");}
  /* @r2fn R2-C0081-F00028 */function beginPlayback(owner){
    const token=Symbol(String(owner||"audio"));playbackLocks.set(token,owner);if(!wakePlayback())pauseRecognition();if(sessionActive){setStatus(wakePlayback()?"Wake-word listening during reply.":"Microphone paused while audio is playing.");resumeSession();}
    let released=false;return /* @r2fn R2-C0081-F00029 */()=>{if(released)return;released=true;playbackLocks.delete(token);paint();resumeSession();};
  }
  /* @r2fn R2-C0081-F00030 */function cancelSpeech(){clearTimeout(speechTimer);speechTimer=null;speechGeneration++;speechPending=false;speaking=false;try{window.speechSynthesis?.cancel();}catch{}speechRelease?.();speechRelease=null;paint();}
  /* @r2fn R2-C0081-F00031 */function localVoice(synth,want){const voices=synth.getVoices().filter(/* @r2fn R2-C0081-F00032 */v=>v.localService&&v.lang.toLowerCase().startsWith(want));return voices.find(/* @r2fn R2-C0081-F00033 */v=>/zira/i.test(v.name||v.voiceURI))||voices[0];}
  /* @r2fn R2-C0081-F00034 */async function waitForVoice(synth,want){
    const found=localVoice(synth,want);if(found)return found;
    await new Promise(/* @r2fn R2-C0081-F00035 */resolve=>{let timer;const done=/* @r2fn R2-C0081-F00036 */()=>{clearTimeout(timer);synth.removeEventListener?.("voiceschanged",changed);resolve();};const changed=/* @r2fn R2-C0081-F00037 */()=>{if(localVoice(synth,want))done();};synth.addEventListener?.("voiceschanged",changed);timer=setTimeout(done,1800);});
    return localVoice(synth,want);
  }
  /* @r2fn R2-C0081-F00038 */async function speak(text){
    const synth=window.speechSynthesis;if(!speechOn||!text)return false;if(!synth){setStatus("Speech output unavailable. Captions remain available.");return false;}
    cancelSpeech();R2.sound?.stop();const token=speechGeneration,release=beginPlayback("spoken-prompt");speechRelease=release;speechPending=true;setStatus("Preparing spoken question…");
    try{
      const want=R2.i18n?.language==="zh"?"zh":"en",voice=await waitForVoice(synth,want);
      if(token!==speechGeneration)return false;
      if(!voice){speechPending=false;release();speechRelease=null;setStatus("No local speech voice for this language. Recognition packs do not install speaking voices. Use captions or select another interface language.");return false;}
      const msg=new SpeechSynthesisUtterance(text);msg.voice=voice;msg.lang=voice.lang;msg.rate=.95;
      let finished=false;const finish=/* @r2fn R2-C0081-F00039 */error=>{if(finished||token!==speechGeneration)return;finished=true;clearTimeout(speechTimer);speechTimer=null;speechPending=false;speaking=false;release();speechRelease=null;setStatus(error?"Speech output unavailable. Captions remain available.":(sessionActive?"Listening locally…":"Question finished. Start microphone to answer."));};
      msg.onstart=/* @r2fn R2-C0081-F00040 */()=>{if(finished||token!==speechGeneration)return;clearTimeout(speechTimer);speechTimer=setTimeout(/* @r2fn R2-C0081-F00041 */()=>{if(token===speechGeneration){finish(true);synth.cancel();}},Math.max(20000,text.length*180));speechPending=false;speaking=true;setStatus(sessionActive?"Wake-word listening during reply.":"Speaking question.");};msg.onend=/* @r2fn R2-C0081-F00042 */()=>finish(false);msg.onerror=/* @r2fn R2-C0081-F00043 */()=>finish(true);
      synth.speak(msg);if(speechPending)speechTimer=setTimeout(/* @r2fn R2-C0081-F00044 */()=>{if(token===speechGeneration&&speechPending){finish(true);synth.cancel();}},5000);return true;
    }catch{if(token===speechGeneration){speechPending=false;speaking=false;release();speechRelease=null;setStatus("Speech output unavailable. Captions remain available.");}return false;}
  }
  /* @r2fn R2-C0081-F00045 */async function respond(message,{wake=false,viewChanged=false}={}){
    if(!speechOn){if(wake)void R2.sound?.play('wakeTone',false,true);return;}
    cancelSpeech();R2.sound?.stop();const token=speechGeneration,release=beginPlayback('voice-response');
    try{
      if(wake)await R2.sound?.play('wakeTone',false,true);
      if(token!==speechGeneration||!speechOn)return;
      if(viewChanged)await R2.sound?.play('navigationTone',false,true);
      if(token!==speechGeneration||!speechOn)return;
      await speak(message);
    }finally{release();}
  }
  /* @r2fn R2-C0081-F00046 */function startDialogue(){speechOn=true;replay?.();if(!sessionActive){if(micAction)micAction();else startSession(/* @r2fn R2-C0081-F00047 */raw=>R2.consoleUi?.command(raw,true));}paint();}
  /* @r2fn R2-C0081-F00048 */function pauseDialogue(){speechOn=false;stopRecognition();cancelSpeech();setStatus("Spoken interview paused.");}
  /* @r2fn R2-C0081-F00049 */async function listen(onFinal,onInterim) {
    if(playbackLocks.size&&!wakePlayback()){setStatus("Wait for playback to finish before starting the microphone.");return false;}
    pauseRecognition();const token=generation;const C=SR();
    if(!C || typeof C.available!=="function" || !('processLocally' in new C())){endSession();setStatus("Local recognition unavailable. Type or tap an answer.");return false;}
    try {
      if(await C.available({langs:[lang()],processLocally:true})!=="available") {endSession();setStatus("Install the English offline pack on the first page, or type an answer.");return false;}
      if(token!==generation)return false;
      micPending=true;setStatus("Opening microphone…");await openMeter(token);
      if(token!==generation)return false;
      const rec=recognition=new C();rec.lang=lang();rec.processLocally=true;
      rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;let received=false,woke=false;
      rec.onstart=/* @r2fn R2-C0081-F00050 */()=>{if(token!==generation)return;micPending=false;listening=true;setStatus(speaking||speechPending?"Wake-word listening during reply.":"Listening locally…");};
      rec.onresult=/* @r2fn R2-C0081-F00051 */async e=>{
        if(token!==generation)return;
        const r=e.results[e.results.length-1],raw=String(r[0]?.transcript||''),wake=raw.match(/^\s*(?:computer|missy)(?=[\s,.:!?，。：！？-]|$)[\s,.:!?，。：！？-]*(.*)$/i);
        const replying=speaking||speechPending||wakePlayback();
        if(replying&&!wake&&Date.now()>=wakeUntil)return; // Output is never an answer without a wake word.
        if(wake&&!woke){
          const confidence=r[0].confidence;if(Number.isFinite(confidence)&&confidence>0&&confidence<.55)return;
          woke=true;cancelSpeech();R2.sound?.stop();wakeUntil=Date.now()+10000;
          wakeCue=Promise.resolve(R2.sound?.play('wakeTone',false,true));setStatus('Wake acknowledged. Listening for command…');
        }
        if(!r.isFinal||received)return;
        received=true;const confidence=r[0].confidence;
        if(Number.isFinite(confidence)&&confidence>0&&confidence<.55){pauseRecognition();setStatus('Uncertain recognition. Please repeat or use the buttons.');resumeSession();return;}
        if(!wake&&Date.now()>=wakeUntil){pauseRecognition();resumeSession();return;}
        const command=wake?wake[1].trim():raw.trim(),acknowledged=woke||Date.now()<wakeUntil;
        const epoch=wakeEpoch;pauseRecognition();const after=generation;
        await wakeCue;
        if(epoch!==wakeEpoch||after!==generation||!sessionActive||!sessionScopeReady())return;
        if(!command){setStatus('Wake acknowledged. Listening for command…');resumeSession();return;}
        wakeUntil=0;
        onFinal(wake?raw:'Computer '+command,{via:'voice',engine:'native-on-device',confidence:Number.isFinite(confidence)?confidence:null,wakeAcknowledged:acknowledged});resumeSession();
      };
      rec.onend=/* @r2fn R2-C0081-F00052 */()=>{if(token===generation){pauseRecognition();setStatus("Ready");resumeSession();}};
      rec.onerror=/* @r2fn R2-C0081-F00053 */e=>{if(token===generation){if(e.error==="no-speech"){pauseRecognition();setStatus("Ready");resumeSession();}else{stopRecognition();setStatus("Microphone: "+e.error+". Type or tap an answer.");}}};
      rec.start();return true;
    }catch(err){if(token===generation){stopRecognition();setStatus("Local microphone could not start: "+err.message);}return false;}
  }
  /* @r2fn R2-C0081-F00054 */function paint(){
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
  /* @r2fn R2-C0081-F00055 */function topDialog(records=[]){
    modalOrder=modalOrder.filter(/* @r2fn R2-C0081-F00056 */d=>d.isConnected&&d.open);
    for(const r of records)if(r.type==="attributes"&&r.attributeName==="open"&&r.target.matches('dialog')&&r.target.open){modalOrder=modalOrder.filter(/* @r2fn R2-C0081-F00057 */d=>d!==r.target);modalOrder.push(r.target);}
    for(const d of document.querySelectorAll('dialog[open]'))if(!modalOrder.includes(d))modalOrder.push(d);
    return modalOrder.at(-1)||null;
  }
  /* @r2fn R2-C0081-F00058 */function attach(records=[]){
    if(!bar)return;const host=topDialog(records)||document.body;
    if(bar.parentNode!==host)host.append(bar);
    if(host.tagName==="DIALOG"&&bar.querySelector(".r2-language"))for(const duplicate of host.querySelectorAll(":scope>.r2-language"))duplicate.remove();
    if(sessionActive){if(!sessionScopeReady()){pauseRecognition();setStatus("Microphone session paused during playback or another panel.");}else resumeSession();}
  }
  /* @r2fn R2-C0081-F00059 */function init(){
    bar=document.createElement("footer");bar.id="r2-console-bar";bar.dataset.i18nSkip="";
    bar.innerHTML='<span class="r2-console-brand">MISSY R2</span><span class="r2-console-state"></span><span class="r2-listening" hidden>● MIC</span><span class="r2-machine" title="Browser heap, logical processors and timer scheduling delay; not CPU utilisation"></span><button type="button" class="r2-voice-play" hidden></button><button type="button" class="r2-voice-stop" hidden>■ Stop</button>';
    bar.querySelector(".r2-voice-play").onclick=/* @r2fn R2-C0081-F00060 */()=>speechOn?pauseDialogue():startDialogue();
    bar.querySelector(".r2-voice-stop").onclick=stop;document.body.append(bar);
    document.getElementById("voice-pack-install").onclick=/* @r2fn R2-C0081-F00061 */()=>pack(true);
    document.getElementById("voice-pack-check").onclick=/* @r2fn R2-C0081-F00062 */()=>pack(false);
    document.getElementById("voice-pack-language").onchange=/* @r2fn R2-C0081-F00063 */e=>{stopRecognition();packState="unknown";store("missy-r2-recognition-language",e.target.value);packMessage("Check or download the selected English pack.");};
    try{const previous=localStorage.getItem("missy-r2-recognition-language");if(["en-US","en-GB"].includes(previous))document.getElementById("voice-pack-language").value=previous;}catch{}
    new MutationObserver(/* @r2fn R2-C0081-F00064 */records=>{
      if(records.some(/* @r2fn R2-C0081-F00065 */r=>r.type==="attributes"||[...r.addedNodes,...r.removedNodes].some(/* @r2fn R2-C0081-F00066 */n=>n===bar||n.nodeType===1&&(n.matches("dialog")||n.contains(bar)))))attach(records);
    }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["open"]});
    setInterval(/* @r2fn R2-C0081-F00067 */()=>{const now=performance.now();lag=Math.max(0,now-lastTick-1000);lastTick=now;paint();},1000);
    document.addEventListener("r2-language",paint);paint();
    document.addEventListener("visibilitychange",/* @r2fn R2-C0081-F00068 */()=>{if(document.hidden){stopRecognition();cancelSpeech();}});
    window.addEventListener("pagehide",/* @r2fn R2-C0081-F00069 */()=>{stopRecognition();cancelSpeech();});
  }
  R2.voiceConsole={pack,listen,stopRecognition,pauseRecognition,startSession,resumeSession,setSessionMinutes,speak,stop,setStatus,topDialog,beginPlayback,respond,startDialogue,pauseDialogue,cancelSpeech,
    stopMicrophone/* @r2fn R2-C0081-F00070 */(){stopRecognition();cancelSpeech();R2.sound?.stop();},
    activate/* @r2fn R2-C0081-F00071 */(handlers){voiceActive=!!handlers;replay=handlers?.play||null;stopAction=handlers?.stop||null;micAction=handlers?.microphone||null;if(!handlers){speechOn=false;stopRecognition();cancelSpeech();R2.sound?.stop();}paint();},
    startMicrophone/* @r2fn R2-C0081-F00072 */(){if(listening||micPending)return;if(playbackLocks.size&&!wakePlayback()){setStatus("Wait for playback to finish before starting the microphone.");return;}if(micAction)return micAction();return startSession(/* @r2fn R2-C0081-F00073 */raw=>R2.consoleUi?.command(raw,true));},
    get sessionActive/* @r2fn R2-C0081-F00074 */(){return sessionActive;},get sessionMinutes/* @r2fn R2-C0081-F00075 */(){return sessionMinutes;},get sessionRemaining/* @r2fn R2-C0081-F00076 */(){return sessionActive?Math.max(0,Math.ceil((sessionUntil-Date.now())/1000)):0;},
    get playbackBusy/* @r2fn R2-C0081-F00077 */(){return playbackLocks.size>0;},get wakePlayback/* @r2fn R2-C0081-F00078 */(){return wakePlayback();},get speechOn/* @r2fn R2-C0081-F00079 */(){return speechOn;},get speaking/* @r2fn R2-C0081-F00080 */(){return speaking||speechPending;},
    get status/* @r2fn R2-C0081-F00081 */(){return status;},get pending/* @r2fn R2-C0081-F00082 */(){return micPending;},get level/* @r2fn R2-C0081-F00083 */(){return level;},get active/* @r2fn R2-C0081-F00084 */(){return voiceActive;},get listening/* @r2fn R2-C0081-F00085 */(){return listening;},get language/* @r2fn R2-C0081-F00086 */(){return lang();},get packState/* @r2fn R2-C0081-F00087 */(){return packState;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window.R2);
