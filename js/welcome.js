/* Actual workbench-resource loading and the public/offline entry screen. */
(/* @r2fn R2-C0084-F00001 */() => {
 "use strict";
 let total=Number(document.currentScript.dataset.moduleCount);const began=performance.now(),waiting=[];
 const log=[],seen=new Set();let previousElapsed=0,initialLanguage="en";
 try{initialLanguage=new URLSearchParams(location.search).get("lang")||localStorage.getItem("missy-r2-language")||"en";}catch{}
 const chinese=/* @r2fn R2-C0084-F00002 */()=>window.R2?.i18n?.language?R2.i18n.language==="zh":initialLanguage==="zh";
 /* @r2fn R2-C0084-F00003 */function logText(){return log.map(/* @r2fn R2-C0084-F00004 */item=>typeof item==="string"?(chinese()?"[READY] 初始化完成，启动期间未读取实验文件。":item):`[LOADED] ${String(item.index).padStart(2,"0")}/${total} · ${chinese()?item.zh:item.en} · ${item.elapsed.toFixed(1)} ms ${chinese()?"已用时":"elapsed"} (+${item.interval.toFixed(1)} ms)`).join("\n");}
 let loaded=0,failed=false,entered=false,ready=false,timer,finishedAt=null;
 const $=/* @r2fn R2-C0084-F00005 */id=>document.getElementById(id);
 document.documentElement.classList.add('r2-starting');
 /* @r2fn R2-C0084-F00006 */function paint(){
  if(!$("welcome-progress"))return;
  const count=ready?5:Math.min(4,Math.floor(loaded/Math.max(1,total)*5));
  $("welcome-modules").textContent=count+" / 5";
  document.querySelectorAll("[data-boot-step]").forEach(/* @r2fn R2-C0084-F00007 */n=>n.classList.toggle("is-loaded",+n.dataset.bootStep<=count));
  $("welcome-progress").setAttribute("aria-valuenow",String(count));
  $("welcome-progress-fill").style.transition=ready?"none":"width .12s";$("welcome-progress-fill").style.width=(count/5*100)+"%";
  if($("welcome-log").textContent!==logText()){$("welcome-log").textContent=logText();$("welcome-log").scrollTop=$("welcome-log").scrollHeight;}
  const memory=performance.memory;
  $("welcome-computer").textContent=`${loaded} of ${total} workbench modules loaded · ${(((finishedAt??performance.now())-began)/1000).toFixed(1)} s`+(memory?` · ${Math.round(memory.usedJSHeapSize/1048576)} MB browser memory`:"");
 }
 /* @r2fn R2-C0084-F00008 */function fail(message){failed=true;finishedAt??=performance.now();clearInterval(timer);const show=/* @r2fn R2-C0084-F00009 */()=>{paint();if($("welcome-status"))$("welcome-status").textContent=message;};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();}
 /* @r2fn R2-C0084-F00010 */function enter(){if(!ready||failed||entered)return;entered=true;clearInterval(timer);$("welcome-screen").hidden=true;document.documentElement.classList.remove("r2-starting");$("workbench-app").hidden=false;waiting.splice(0).forEach(/* @r2fn R2-C0084-F00011 */fn=>fn());window.dispatchEvent(new Event("r2-entered"));window.scrollTo(0,0);document.querySelector('#view-home .role-options a')?.focus({preventScroll:true});}
 document.addEventListener("r2-language",paint);
 timer=setInterval(paint,400);

 window.R2Boot={get entered/* @r2fn R2-C0084-F00012 */(){return entered},enter,showLoading/* @r2fn R2-C0084-F00013 */(){entered=false;$("welcome-screen").hidden=false;$("workbench-app").hidden=true;document.documentElement.classList.add('r2-starting');window.scrollTo(0,0);},step/* @r2fn R2-C0084-F00014 */(component){
  const path=component?.getAttribute?.("src")?.split("?")[0];if(path&&seen.has(path))return;if(path)seen.add(path);
  const en=component?.dataset?.bootLabel||String(component),zh=component?.dataset?.bootLabelZh||en,elapsed=performance.now()-began;
  loaded++;log.push({index:loaded,en,zh,elapsed,interval:elapsed-previousElapsed});previousElapsed=elapsed;paint();
  if(!failed&&$("welcome-status"))$("welcome-status").textContent=(chinese()?zh:en)+'…';
 },fail,whenEntered/* @r2fn R2-C0084-F00015 */(fn){if(entered)fn();else waiting.push(fn)}};
 window.addEventListener('error',/* @r2fn R2-C0084-F00016 */event=>{if((event.error||['SCRIPT','LINK'].includes(event.target?.tagName))&&!ready)fail('The workbench could not finish loading. Reload the page or extract the complete download.');});
 document.addEventListener('DOMContentLoaded',/* @r2fn R2-C0084-F00017 */()=>{
  total=document.querySelectorAll('script[onload*="R2Boot.step"]').length;
  paint();
  $("welcome-sound").onclick=/* @r2fn R2-C0084-F00018 */()=>{document.getElementById("workbench-sound")?.click();$("welcome-sound").textContent=document.getElementById("workbench-sound")?.getAttribute("aria-pressed")==="true"?"🔊":"🔇";};
  if(!failed&&(loaded!==total||!window.R2?.techAccess||!R2.gmoeval||!R2.templates||!R2.ui?.quality||!R2.batchRuns||!R2.batchUi||!R2.maraEvidenceFrom||!R2.profileStudio||!R2.voiceConsole||!R2.voiceBuilder||!window.MissyVoiceInterview||!R2.annunciator||!R2.ALERTS))fail('The workbench is missing a required component. Reload the page or extract the complete download.');
  if(!failed){finishedAt=performance.now();ready=true;clearInterval(timer);paint();$("welcome-status").textContent='Ready — click the MISSY logo to enter.';$("welcome-enter").disabled=false;$("welcome-enter").setAttribute("aria-label","Enter MISSY R2");log.push("[READY] Initialization complete. No experiment files read during startup.");paint();}
  $("welcome-enter").onclick=enter;
  document.querySelectorAll('[data-app-version]').forEach(/* @r2fn R2-C0084-F00019 */node=>node.textContent=window.R2?.VERSION||'0.4.40');
  const online=/^https?:$/.test(location.protocol),version=window.R2?.VERSION||'0.4.40';
  document.querySelectorAll('[data-download-website]').forEach(/* @r2fn R2-C0084-F00020 */button=>{
   button.disabled=!online;
   button.title=online?'Download the complete offline website':'You are already using the downloaded offline website';
   button.onclick=/* @r2fn R2-C0084-F00021 */()=>{const link=document.createElement('a');link.href=new URL('downloads/MISSY_R2_workbench_site_'+version+'.zip',document.baseURI).href;link.download='MISSY_R2_workbench_site_'+version+'.zip';document.body.append(link);link.click();link.remove();$("website-download-status").textContent='Website download requested. Extract the ZIP and open index.html in pcr-workbench.';};
  });
  if(!online)$("website-download-status").textContent='This is the offline copy. Website downloads are available from the live site.';
 },{once:true});
})();
