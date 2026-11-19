/* Local-only speech, language-pack installation and the common computer status strip. */
(function (R2) {
  "use strict";
  let recognition=null, listening=false, speechOn=false, generation=0, status="Ready", replay=null, stopAction=null;
  let modalOrder=[];
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
      packMessage(packState==="available"?"English offline recognition pack is ready. Microphone permission is still required.":
        packState==="downloadable"?"English offline pack is available. Click Download / install English pack.":
        packState==="downloading"?"English pack is downloading. Check again after it completes.":
        "No local English pack is available for this browser. You can type or tap every answer.");
      return packState==="available";
    } catch(err){packState="error";packMessage("Language-pack request failed: "+err.message);return false;}
    finally{button.disabled=false;}
  }
  function closeMeter(){clearInterval(meterTimer);meterTimer=null;micStream?.getTracks().forEach(t=>t.stop());micStream=null;try{meterSource?.disconnect();}catch{}meterSource=null;const c=meterContext;meterContext=null;void c?.close().catch(()=>{});level=0;}
  function meterPaint(){for(const el of document.querySelectorAll('[data-r2-mic-meter]')){const n=Math.round(level*100);el.setAttribute('aria-valuenow',String(n));el.firstElementChild.style.width=n+'%';el.setAttribute('aria-valuetext',meterUnavailable?tr('Level unavailable'):n+'%');}document.dispatchEvent(new Event('r2-voice-state'));}
  async function openMeter(token){
    meterUnavailable=false;if(!navigator.mediaDevices?.getUserMedia){meterUnavailable=true;meterPaint();return;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});if(token!==generation){stream.getTracks().forEach(t=>t.stop());return;}micStream=stream;
    try{const C=window.AudioContext||window.webkitAudioContext;meterContext=new C();meterSource=meterContext.createMediaStreamSource(stream);const a=meterContext.createAnalyser();a.fftSize=256;meterSource.connect(a);const data=new Float32Array(a.fftSize);await meterContext.resume();
      if(token!==generation)return;meterTimer=setInterval(()=>{a.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;const rms=Math.sqrt(sum/data.length);level=rms>0?Math.max(0,Math.min(1,(20*Math.log10(rms)+60)/54)):0;meterPaint();},80);
    }catch{meterUnavailable=true;meterPaint();}
  }
  function stopRecognition(){generation++;const rec=recognition;recognition=null;listening=false;micPending=false;status="Ready";try{rec?.abort();}catch{}closeMeter();paint();meterPaint();}
  function stop(){R2.annunciator?.silence();R2.sound?.stop();stopRecognition();try{window.speechSynthesis?.cancel();}catch{}if(voiceActive&&R2.batchRuns?.busy())R2.batchRuns.cancel();stopAction?.();setStatus("Paused");}
  function speak(text){
    try {
      const synth=window.speechSynthesis;if(!speechOn||!synth||!text)return;
      const want=R2.i18n?.language==="zh"?"zh":"en";
      const voice=synth.getVoices().find(v=>v.localService && v.lang.toLowerCase().startsWith(want));
      if(!voice){setStatus("No local speech voice. Captions remain available.");return;}
      synth.cancel();const msg=new SpeechSynthesisUtterance(text);msg.voice=voice;msg.lang=voice.lang;msg.rate=.95;synth.speak(msg);
    }catch{setStatus("Speech output unavailable. Captions remain available.");}
  }
  async function listen(onFinal,onInterim) {
    R2.sound?.stop();stopRecognition();const token=generation;const C=SR();
    if(!C || typeof C.available!=="function" || !('processLocally' in new C())){setStatus("Local recognition unavailable. Type or tap an answer.");return false;}
    try {
      if(await C.available({langs:[lang()],processLocally:true})!=="available") {setStatus("Install the English offline pack on the first page, or type an answer.");return false;}
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
          stopRecognition();if(Number.isFinite(confidence)&&confidence>0&&confidence<.55){setStatus("Uncertain recognition. Please repeat or use the buttons.");return;}
          onFinal(r[0].transcript,{via:"voice",engine:"native-on-device",confidence:Number.isFinite(confidence)?confidence:null});
        }
      };
      rec.onend=()=>{if(token===generation){stopRecognition();setStatus("Ready");}};
      rec.onerror=e=>{if(token===generation){stopRecognition();setStatus("Microphone: "+e.error+". Type or tap an answer.");}};
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
    bar.querySelector(".r2-voice-play").textContent=tr("Read prompt");
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
  }
  function init(){
    bar=document.createElement("footer");bar.id="r2-console-bar";bar.dataset.i18nSkip="";
    bar.innerHTML='<span class="r2-console-brand">MISSY R2</span><span class="r2-console-state"></span><span class="r2-listening" hidden>● MIC</span><span class="r2-machine" title="Browser heap, logical processors and timer scheduling delay; not CPU utilisation"></span><button type="button" class="r2-voice-play" hidden></button><button type="button" class="r2-voice-stop" hidden>■ Stop</button>';
    bar.querySelector(".r2-voice-play").onclick=()=>{speechOn=true;replay?.();paint();};
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
    document.addEventListener("visibilitychange",()=>{if(document.hidden){stopRecognition();window.speechSynthesis?.cancel();}});
    window.addEventListener("pagehide",stopRecognition);
  }
  R2.voiceConsole={pack,listen,stopRecognition,speak,stop,setStatus,topDialog,
    stopMicrophone(){stopRecognition();window.speechSynthesis?.cancel();R2.sound?.stop();},
    activate(handlers){voiceActive=!!handlers;replay=handlers?.play||null;stopAction=handlers?.stop||null;micAction=handlers?.microphone||null;if(!handlers){stopRecognition();window.speechSynthesis?.cancel();}paint();},
    startMicrophone(){if(listening||micPending)return;R2.sound?.stop();if(micAction)return micAction();return listen(raw=>R2.consoleUi?.command(raw));},
    get status(){return status;},get pending(){return micPending;},get level(){return level;},get active(){return voiceActive;},get listening(){return listening;},get language(){return lang();},get packState(){return packState;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})(window.R2);
