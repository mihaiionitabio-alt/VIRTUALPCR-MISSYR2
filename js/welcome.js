/* Actual workbench-resource loading and the public/offline entry screen. */
(() => {
 "use strict";
 let total=Number(document.currentScript.dataset.moduleCount);const began=performance.now(),waiting=[];
 const log=[];
 let loaded=0,failed=false,entered=false,ready=false,timer,finishedAt=null;
 const $=id=>document.getElementById(id);
 document.documentElement.classList.add('r2-starting');
 function paint(){
  if(!$("welcome-progress"))return;
  const count=ready?5:Math.min(4,Math.floor(loaded/Math.max(1,total)*5));
  $("welcome-modules").textContent=count+" / 5";
  document.querySelectorAll("[data-boot-step]").forEach(n=>n.classList.toggle("is-loaded",+n.dataset.bootStep<=count));
  $("welcome-progress").setAttribute("aria-valuenow",String(count));
  $("welcome-progress-fill").style.transition=ready?"none":"width .12s";$("welcome-progress-fill").style.width=(count/5*100)+"%";
  if($("welcome-log").textContent!==log.join("\n")){$("welcome-log").textContent=log.join("\n");$("welcome-log").scrollTop=$("welcome-log").scrollHeight;}
  const memory=performance.memory;
  $("welcome-computer").textContent=`${loaded} of ${total} workbench modules loaded · ${(((finishedAt??performance.now())-began)/1000).toFixed(1)} s`+(memory?` · ${Math.round(memory.usedJSHeapSize/1048576)} MB browser memory`:"");
 }
 function fail(message){failed=true;finishedAt??=performance.now();clearInterval(timer);const show=()=>{paint();if($("welcome-status"))$("welcome-status").textContent=message;};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();}
 function enter(){if(!ready||failed||entered)return;entered=true;clearInterval(timer);$("welcome-screen").hidden=true;document.documentElement.classList.remove("r2-starting");$("workbench-app").hidden=false;waiting.splice(0).forEach(fn=>fn());window.scrollTo(0,0);document.querySelector('#view-home .role-options a')?.focus({preventScroll:true});}
 timer=setInterval(paint,400);

 window.R2Boot={get entered(){return entered},step(status){loaded++;log.push(`[OK] ${status} · ${(performance.now()-began).toFixed(1)} ms`);paint();if(!failed&&$("welcome-status"))$("welcome-status").textContent=status+'…';},fail,whenEntered(fn){if(entered)fn();else waiting.push(fn)}};
 window.addEventListener('error',event=>{if((event.error||['SCRIPT','LINK'].includes(event.target?.tagName))&&!ready)fail('The workbench could not finish loading. Reload the page or extract the complete download.');});
 document.addEventListener('DOMContentLoaded',()=>{
  total=document.querySelectorAll('script[onload*="R2Boot.step"]').length;
  paint();
  $("welcome-sound").onclick=()=>{document.getElementById("workbench-sound")?.click();$("welcome-sound").textContent=document.getElementById("workbench-sound")?.getAttribute("aria-pressed")==="true"?"🔊":"🔇";};
  if(!failed&&(loaded!==total||!window.R2?.techAccess||!R2.gmoeval||!R2.templates||!R2.ui?.quality||!R2.batchRuns||!R2.batchUi||!R2.maraEvidenceFrom||!R2.profileStudio||!R2.voiceConsole||!R2.voiceBuilder||!window.MissyVoiceInterview))fail('The workbench is missing a required component. Reload the page or extract the complete download.');
  if(!failed){finishedAt=performance.now();ready=true;clearInterval(timer);paint();$("welcome-status").textContent='Ready — click the MISSY logo to enter.';$("welcome-enter").disabled=false;$("welcome-enter").setAttribute("aria-label","Enter MISSY R2");log.push("[READY] Initialization complete. No experiment files read during startup.");paint();}
  $("welcome-enter").onclick=enter;
  document.querySelectorAll('[data-app-version]').forEach(node=>node.textContent=window.R2?.VERSION||'0.4.32');
  const online=/^https?:$/.test(location.protocol),version=window.R2?.VERSION||'0.4.32';
  document.querySelectorAll('[data-download-website]').forEach(button=>{
   button.disabled=!online;
   button.title=online?'Download the complete offline website':'You are already using the downloaded offline website';
   button.onclick=()=>{const link=document.createElement('a');link.href=new URL('downloads/MISSY_R2_workbench_site_'+version+'.zip',document.baseURI).href;link.download='MISSY_R2_workbench_site_'+version+'.zip';document.body.append(link);link.click();link.remove();$("website-download-status").textContent='Website download requested. Extract the ZIP and open index.html in pcr-workbench.';};
  });
  if(!online)$("website-download-status").textContent='This is the offline copy. Website downloads are available from the live site.';
 },{once:true});
})();
