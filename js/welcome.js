/* Actual workbench-resource loading and the public/offline entry screen. */
(() => {
 "use strict";
 const total=Number(document.currentScript.dataset.moduleCount),began=performance.now(),waiting=[];
 let loaded=0,failed=false,entered=false,ready=false,timer,finishedAt=null;
 const $=id=>document.getElementById(id);
 function paint(){if(!$("welcome-progress"))return;$("welcome-progress").value=ready?100:Math.min(95,Math.round(loaded/total*95));const memory=performance.memory;$("welcome-computer").textContent=`${loaded} of ${total} workbench modules loaded · ${(((finishedAt??performance.now())-began)/1000).toFixed(1)} s`+(memory?` · ${Math.round(memory.usedJSHeapSize/1048576)} MB browser memory`:"");}
 function fail(message){failed=true;finishedAt??=performance.now();clearInterval(timer);const show=()=>{paint();if($("welcome-status"))$("welcome-status").textContent=message;};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();}
 function enter(){if(!ready||failed||entered)return;entered=true;clearInterval(timer);$("welcome-screen").hidden=true;$("workbench-app").hidden=false;waiting.splice(0).forEach(fn=>fn());window.scrollTo(0,0);document.querySelector('#view-home .role-options a')?.focus({preventScroll:true});}
 timer=setInterval(paint,400);
 window.R2Boot={get entered(){return entered},step(status){loaded++;paint();if(!failed&&$("welcome-status"))$("welcome-status").textContent=status+'…';},fail,whenEntered(fn){if(entered)fn();else waiting.push(fn)}};
 window.addEventListener('error',event=>{if((event.error||['SCRIPT','LINK'].includes(event.target?.tagName))&&!ready)fail('The workbench could not finish loading. Reload the page or extract the complete download.');});
 document.addEventListener('DOMContentLoaded',()=>{
  paint();
  if(!failed&&(loaded!==total||!window.R2?.techAccess||!R2.gmoeval||!R2.templates||!R2.ui?.quality||!R2.batchRuns||!R2.batchUi))fail('The workbench is missing a required component. Reload the page or extract the complete download.');
  if(!failed){finishedAt=performance.now();ready=true;clearInterval(timer);paint();$("welcome-status").textContent='Ready. Virtual instrument, learning levels and file-analysis tools are loaded.';$("welcome-enter").disabled=false;$("welcome-enter").textContent='Choose your role';}
  $("welcome-enter").onclick=enter;
  document.querySelectorAll('[data-app-version]').forEach(node=>node.textContent=window.R2?.VERSION||'0.4.29');
  const online=/^https?:$/.test(location.protocol),version=window.R2?.VERSION||'0.4.29';
  document.querySelectorAll('[data-download-website]').forEach(button=>{
   button.disabled=!online;
   button.title=online?'Download the complete offline website':'You are already using the downloaded offline website';
   button.onclick=()=>{const link=document.createElement('a');link.href=new URL('downloads/MISSY_R2_workbench_site_'+version+'.zip',document.baseURI).href;link.download='MISSY_R2_workbench_site_'+version+'.zip';document.body.append(link);link.click();link.remove();$("website-download-status").textContent='Website download requested. Extract the ZIP and open index.html in pcr-workbench.';};
  });
  if(!online)$("website-download-status").textContent='This is the offline copy. Website downloads are available from the live site.';
 },{once:true});
})();
