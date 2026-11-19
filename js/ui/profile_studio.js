/* Three editors, one profile and one existing batch executor. No Scratch code. */
(/* @r2fn R2-C0058-F00001 */function (R2) {
  "use strict";
  const B = R2.batchRuns, U = R2.batchUi, esc = R2.esc;
  let picker, sectionOrder = [], dragged = null;
  const t = /* @r2fn R2-C0058-F00002 */s => R2.i18n?.text(s) || s;
  /* @r2fn R2-C0058-F00003 */function toolbar(d, mode) {
    const bar = document.createElement("nav"); bar.className = "studio-switch";
    bar.setAttribute("aria-label", "Profile editing mode");
    for (const [key, label] of [["assisted", "Assisted"], ["visual", "Visual blocks"], ["audio", "Audio interview"]]) {
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = label;
      btn.setAttribute("aria-pressed", String(key === mode));
      btn.onclick = /* @r2fn R2-C0058-F00004 */() => { document.activeElement?.blur();
        if (key === "audio") { U.close(); R2.voiceBuilder.open(U.getProfile()); }
        else U.openBuilder(U.getProfile(), key);
      }; bar.append(btn);
    }
    d.querySelector("h1").after(bar);
    const back = d.querySelector(".batch-close");
    back.onclick = /* @r2fn R2-C0058-F00005 */() => { U.close(); open(); };
  }
  /* @r2fn R2-C0058-F00006 */function decorate(d, mode) {
    toolbar(d, mode);
    if (mode !== "visual") return;
    const form = d.querySelector("#bf-form");
    const palette = document.createElement("nav"); palette.className = "brick-palette";
    palette.setAttribute("aria-label", "Setting blocks");
    const intro = document.createElement("p"); intro.className = "note brick-intro";
    intro.textContent = "Tap a block category to edit it. Drag blocks to arrange your workspace. Settings inside a run group are applied together, not as a programme.";
    form.before(intro, palette);
    const sections = [...form.querySelectorAll(".bf-sec")];
    sections.forEach(/* @r2fn R2-C0058-F00007 */(section, index) => {
      section.classList.add("setting-brick"); section.style.setProperty("--brick-hue", String((index * 31 + 20) % 360));
      const key = section.dataset.sec;
      const button = document.createElement("button"); button.type = "button";
      button.textContent = section.querySelector("summary").textContent;
      button.onclick = /* @r2fn R2-C0058-F00008 */() => { section.open = true; section.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); section.querySelector("summary").focus(); };
      palette.append(button);
      const header = section.querySelector("summary"); header.draggable = true;
      header.addEventListener("dragstart", /* @r2fn R2-C0058-F00009 */e => { dragged = key; e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; });
      section.addEventListener("dragover", /* @r2fn R2-C0058-F00010 */e => { if (dragged !== null) e.preventDefault(); });
      section.addEventListener("drop", /* @r2fn R2-C0058-F00011 */e => { e.preventDefault(); const source = sections.find(/* @r2fn R2-C0058-F00012 */s => s.dataset.sec === dragged);
        if (source && source !== section) form.insertBefore(source, section);
        sectionOrder = [...form.querySelectorAll(".bf-sec")].map(/* @r2fn R2-C0058-F00013 */s => s.dataset.sec); dragged = null;
      });
      const controls = document.createElement("div"); controls.className = "brick-arrange";
      for (const [offset, label] of [[-1,"Move block earlier"],[1,"Move block later"]]) {
        const move = document.createElement("button"); move.type="button"; move.textContent=label;
        move.onclick = /* @r2fn R2-C0058-F00014 */() => { const list=[...form.querySelectorAll(".bf-sec")], i=list.indexOf(section), other=list[i+offset];
          if (!other) return; if (offset<0) form.insertBefore(section,other); else other.after(section);
          sectionOrder=[...form.querySelectorAll(".bf-sec")].map(/* @r2fn R2-C0058-F00015 */s=>s.dataset.sec); move.focus();
        }; controls.append(move);
      }
      section.querySelector(".bf-body").prepend(controls);
    });
    for (const key of sectionOrder) { const section = sections.find(/* @r2fn R2-C0058-F00016 */s => s.dataset.sec === key); if (section) form.append(section); }
    const groupTools = document.createElement("div"); groupTools.className="row brick-group-tools";
    for (const [offset,label] of [[-1,"Move group earlier"],[1,"Move group later"]]) {
      const btn=document.createElement("button"); btn.type="button"; btn.textContent=label;
      btn.onclick=/* @r2fn R2-C0058-F00017 */()=>{const current=Number(d.querySelector('.bf-tab[aria-selected="true"]').dataset.g); U.moveGroup(current,current+offset);};groupTools.append(btn);
    }
    d.querySelector(".bf-groups").after(groupTools);
    d.querySelectorAll(".bf-tab").forEach(/* @r2fn R2-C0058-F00018 */btn=>{
      btn.draggable=true; btn.ondragstart=/* @r2fn R2-C0058-F00019 */e=>{e.dataTransfer.setData("application/x-missy-group",btn.dataset.g);};
      btn.ondragover=/* @r2fn R2-C0058-F00020 */e=>e.preventDefault(); btn.ondrop=/* @r2fn R2-C0058-F00021 */e=>{e.preventDefault();const from=e.dataTransfer.getData("application/x-missy-group");if(from!=="")U.moveGroup(Number(from),Number(btn.dataset.g));};
    });
  }
  /* @r2fn R2-C0058-F00022 */function open() {
    if (B.busy() || R2.tech.running()) return;
    if (!picker) { picker=document.createElement("dialog");picker.id="profile-mode-picker";picker.className="batch-dialog";document.body.append(picker); }
    picker.innerHTML=`<div class="entry-rail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="entry-content"><div class="entry-heading"><div><div class="entry-eyebrow">MISSY / PROFILE BUILDER</div><h1 id="studio-title">Build a JSON run profile</h1><p>Choose how to build your profile. All three options share your settings.</p></div><img src="assets/missy-logo.svg" alt="MISSY"></div><div class="entry-choices">
      <button type="button" class="entry-choice" data-mode="assisted"><span class="entry-number">01</span><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M20 18h80v60H20zM35 35h7m12 0h30M35 49h7m12 0h30M35 63h7m12 0h30"/></svg><strong>Assisted</strong><span>Checklists, radio buttons and fields. The current profile builder.</span></button>
      <button type="button" class="entry-choice" data-mode="visual"><span class="entry-number">02</span><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M20 15h20v7h20v-7h40v24H60v7H40v-7H20zM20 48h20v7h20v-7h40v24H60v7H40v-7H20z"/></svg><strong>Visual blocks</strong><span>Arrange setting bricks, choose values and repeat each run group.</span></button>
      <button type="button" class="entry-choice" data-mode="audio"><span class="entry-number">03</span><svg viewBox="0 0 120 90" aria-hidden="true"><rect x="49" y="12" width="22" height="42" rx="11"/><path d="M37 40v8a23 23 0 0 0 46 0v-8M60 71v12M45 83h30M18 30v25m83-25v25"/></svg><strong>Audio interview</strong><span>Answer by voice, typing or numbered buttons. Review and save your decisions.</span></button>
    </div><div class="entry-footer"><p>Choose an editor to continue.</p><div><button type="button" id="studio-back">Go back</button><button type="button" id="studio-sound">Sound on</button></div></div></div>`;
    picker.querySelector("#studio-back").onclick=/* @r2fn R2-C0058-F00023 */()=>picker.close();
    picker.querySelectorAll("[data-mode]").forEach(/* @r2fn R2-C0058-F00024 */btn=>btn.onclick=/* @r2fn R2-C0058-F00025 */()=>{picker.close();
      if(btn.dataset.mode==="audio")R2.voiceBuilder.open(U.getProfile());else U.openBuilder(null,btn.dataset.mode);
    });
    picker.setAttribute("aria-labelledby","studio-title");
    const sound=picker.querySelector("#studio-sound"), source=document.getElementById("workbench-sound");
    sound.textContent=source?.getAttribute("aria-pressed")==="true"?"Sound on":"Sound off";sound.onclick=/* @r2fn R2-C0058-F00026 */()=>{source?.click();sound.textContent=source?.getAttribute("aria-pressed")==="true"?"Sound on":"Sound off";};
    picker.showModal(); R2.i18n?.refresh();
  }
  /* @r2fn R2-C0058-F00027 */function validate(profile) {
    const parsed=B.parse(profile), errors=[...parsed.errors],warnings=[...parsed.warnings],seen=new Set(), groups=[];
    const alerts=[...parsed.errors.map(/* @r2fn R2-C0058-F00028 */text=>({kind:"error",text})),...parsed.warnings.map(/* @r2fn R2-C0058-F00029 */text=>({kind:"warning",text}))];
    const sops=new Set();
    for(const item of parsed.runs) { if(seen.has(item.group))continue;seen.add(item.group);const pv=B.preview(item.spec,item.k);
      pv.errors.forEach(/* @r2fn R2-C0058-F00030 */e=>{errors.push(`Group ${item.group+1}: ${e}`);alerts.push({kind:"error",text:`Group ${item.group+1}: ${e}`});});
      pv.warnings.forEach(/* @r2fn R2-C0058-F00031 */e=>{warnings.push(`Group ${item.group+1}: ${e}`);alerts.push({kind:"warning",text:`Group ${item.group+1}: ${e}`});});
      groups.push({group:item.group,info:pv.info,errors:pv.errors,warnings:pv.warnings});
      if(pv.info&&!pv.errors.length)for(const f of correlation(item.group,item.spec,pv.info)){(f.kind==="error"?errors:warnings).push(f.text);alerts.push(f);}
      if(pv.info?.sop)sops.add(pv.info.sop);
    }
    if(sops.size>1)alerts.push({kind:"info",id:"R2-SOP-054",params:{n:sops.size,list:[...sops].join(", ")},text:`The batch uses ${sops.size} different SOPs`});
    return {errors,warnings,runs:parsed.runs.length,groups,alerts};
  }
  // SOP correlation: what the operator chose (template, design, controls, scenario) against what the
  // bench will run (preview). Same rules for Assisted, Visual blocks and Audio interview.
  /* @r2fn R2-C0058-F00032 */function correlation(group,spec,info){
    const out=[],g=group+1,tpl=typeof spec.template==="string"?R2.templates.get(spec.template):null,d=spec.design||{};
    const push=/* @r2fn R2-C0058-F00033 */(kind,id,params,text)=>out.push({kind,id,params:Object.assign({group:g},params),text:`Group ${g}: ${text}`});
    if(tpl&&tpl.crop&&info.crop&&tpl.crop!==info.crop)
      push("error","R2-SOP-050",{template:tpl.name,tcrop:tpl.crop,crop:info.crop,sop:info.sop},`template "${tpl.name}" is ${tpl.crop}, but the run will be ${info.crop} (${info.sop})`);
    if(tpl&&tpl.stage&&info.stage&&tpl.stage!==info.stage)
      push("warning","R2-SOP-051",{tstage:tpl.stage,stage:info.stage,sop:info.sop},`template step is ${tpl.stage}; the run will be ${info.stage} (${info.sop})`);
    const ext=d.extractions??3,rep=d.replicates??3;
    if(ext!==3||rep!==3)push("warning","R2-SOP-052",{ext,rep},`${ext} extraction(s) × ${rep} PCR replicate(s) differs from the default 3 × 3`);
    const zero=Object.entries(d.controlCounts||{}).filter(/* @r2fn R2-C0058-F00034 */([,n])=>n===0).map(/* @r2fn R2-C0058-F00035 */([c])=>c);
    if(zero.length)push("warning","R2-SOP-053",{list:zero.join(", ")},`${zero.join(", ")} set to 0 wells`);
    if(spec.errorScenario)push("warning","R2-SOP-055",{value:spec.errorScenario},`scenario "${spec.errorScenario}" will be simulated`);
    return out;
  }
  /* @r2fn R2-C0058-F00036 */function snapshot() {
    const saved=B.snapshot(), templates=[], scenarioApplicability={};
    try {
      for(const tpl of R2.templates.list().filter(/* @r2fn R2-C0058-F00037 */t=>!t.programmeOnly)) {
        const preview=B.preview({template:tpl.id});
        const applied=B.apply({template:tpl.id});
        if(applied.errors?.length)continue;
        const controls={};for(const w of R2.tech.plate||[])if(w.ctl)controls[w.ctl]=(controls[w.ctl]||0)+1;
        templates.push({id:tpl.id,name:tpl.name,crop:preview.info.crop,stage:preview.info.stage,controls,samplesMax:preview.info.maxSamples});
        // Offer only scenarios the bench accepts for this template. Computed when first asked
        // (about 0.1 s per template) and cached; confirm/launch still re-check with preview().
        let cached=null;
        Object.defineProperty(scenarioApplicability,tpl.id,{enumerable:true,get/* @r2fn R2-C0058-F00038 */(){
          if(cached)return cached;const keep=B.snapshot();
          try{cached=R2.qpcrFaults.LIST.filter(/* @r2fn R2-C0058-F00039 */s=>R2.qpcrFaults.runnable(s)&&!B.preview({template:tpl.id,errorScenario:s.id}).errors.length).map(/* @r2fn R2-C0058-F00040 */s=>s.id);}
          finally{B.restore(keep);}
          return cached;}});
      }
    } finally { B.restore(saved); }
    return {fields:B.FIELDS,templates,scenarioApplicability,templateInfo:/* @r2fn R2-C0058-F00041 */template=>B.preview({template}).info,scenarioFor:/* @r2fn R2-C0058-F00042 */template=>R2.qpcrFaults.LIST.filter(/* @r2fn R2-C0058-F00043 */s=>R2.qpcrFaults.runnable(s)&&!B.preview({template,errorScenario:s.id}).errors.length).map(/* @r2fn R2-C0058-F00044 */s=>s.id),
      materials:R2.GMO.samples,scenarios:R2.qpcrFaults.LIST.filter(/* @r2fn R2-C0058-F00045 */s=>R2.qpcrFaults.runnable(s)).map(/* @r2fn R2-C0058-F00046 */s=>({id:s.id,title:s.title,category:s.cat})),categories:R2.qpcrFaults.CATEGORIES};
  }
  R2.profileStudio={open,decorate,validate,snapshot};
})(window.R2);
