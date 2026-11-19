/* Three editors, one profile and one existing batch executor. No Scratch code. */
(function (R2) {
  "use strict";
  const B = R2.batchRuns, U = R2.batchUi, esc = R2.esc;
  let picker, sectionOrder = [], dragged = null;
  const t = s => R2.i18n?.text(s) || s;
  function toolbar(d, mode) {
    const bar = document.createElement("nav"); bar.className = "studio-switch";
    bar.setAttribute("aria-label", "Profile editing mode");
    for (const [key, label] of [["assisted", "Assisted"], ["visual", "Visual blocks"], ["audio", "Audio interview"]]) {
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = label;
      btn.setAttribute("aria-pressed", String(key === mode));
      btn.onclick = () => { document.activeElement?.blur();
        if (key === "audio") { U.close(); R2.voiceBuilder.open(U.getProfile()); }
        else U.openBuilder(U.getProfile(), key);
      }; bar.append(btn);
    }
    d.querySelector("h1").after(bar);
    const back = d.querySelector(".batch-close");
    back.onclick = () => { U.close(); open(); };
  }
  function decorate(d, mode) {
    toolbar(d, mode);
    if (mode !== "visual") return;
    const form = d.querySelector("#bf-form");
    const palette = document.createElement("nav"); palette.className = "brick-palette";
    palette.setAttribute("aria-label", "Setting blocks");
    const intro = document.createElement("p"); intro.className = "note brick-intro";
    intro.textContent = "Tap a block category to edit it. Drag blocks to arrange your workspace. Settings inside a run group are applied together, not as a programme.";
    form.before(intro, palette);
    const sections = [...form.querySelectorAll(".bf-sec")];
    sections.forEach((section, index) => {
      section.classList.add("setting-brick"); section.style.setProperty("--brick-hue", String((index * 31 + 20) % 360));
      const key = section.dataset.sec;
      const button = document.createElement("button"); button.type = "button";
      button.textContent = section.querySelector("summary").textContent;
      button.onclick = () => { section.open = true; section.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); section.querySelector("summary").focus(); };
      palette.append(button);
      const header = section.querySelector("summary"); header.draggable = true;
      header.addEventListener("dragstart", e => { dragged = key; e.dataTransfer.setData("text/plain", key); e.dataTransfer.effectAllowed = "move"; });
      section.addEventListener("dragover", e => { if (dragged !== null) e.preventDefault(); });
      section.addEventListener("drop", e => { e.preventDefault(); const source = sections.find(s => s.dataset.sec === dragged);
        if (source && source !== section) form.insertBefore(source, section);
        sectionOrder = [...form.querySelectorAll(".bf-sec")].map(s => s.dataset.sec); dragged = null;
      });
      const controls = document.createElement("div"); controls.className = "brick-arrange";
      for (const [offset, label] of [[-1,"Move block earlier"],[1,"Move block later"]]) {
        const move = document.createElement("button"); move.type="button"; move.textContent=label;
        move.onclick = () => { const list=[...form.querySelectorAll(".bf-sec")], i=list.indexOf(section), other=list[i+offset];
          if (!other) return; if (offset<0) form.insertBefore(section,other); else other.after(section);
          sectionOrder=[...form.querySelectorAll(".bf-sec")].map(s=>s.dataset.sec); move.focus();
        }; controls.append(move);
      }
      section.querySelector(".bf-body").prepend(controls);
    });
    for (const key of sectionOrder) { const section = sections.find(s => s.dataset.sec === key); if (section) form.append(section); }
    const groupTools = document.createElement("div"); groupTools.className="row brick-group-tools";
    for (const [offset,label] of [[-1,"Move group earlier"],[1,"Move group later"]]) {
      const btn=document.createElement("button"); btn.type="button"; btn.textContent=label;
      btn.onclick=()=>{const current=Number(d.querySelector('.bf-tab[aria-selected="true"]').dataset.g); U.moveGroup(current,current+offset);};groupTools.append(btn);
    }
    d.querySelector(".bf-groups").after(groupTools);
    d.querySelectorAll(".bf-tab").forEach(btn=>{
      btn.draggable=true; btn.ondragstart=e=>{e.dataTransfer.setData("application/x-missy-group",btn.dataset.g);};
      btn.ondragover=e=>e.preventDefault(); btn.ondrop=e=>{e.preventDefault();const from=e.dataTransfer.getData("application/x-missy-group");if(from!=="")U.moveGroup(Number(from),Number(btn.dataset.g));};
    });
  }
  function open() {
    if (B.busy() || R2.tech.running()) return;
    if (!picker) { picker=document.createElement("dialog");picker.id="profile-mode-picker";picker.className="batch-dialog";document.body.append(picker); }
    picker.innerHTML=`<div class="entry-rail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="entry-content"><div class="entry-heading"><div><div class="entry-eyebrow">MISSY / PROFILE BUILDER</div><h1 id="studio-title">Build a JSON run profile</h1><p>Choose how to build your profile. All three options share your settings.</p></div><img src="assets/missy-logo.svg" alt="MISSY"></div><div class="entry-choices">
      <button type="button" class="entry-choice" data-mode="assisted"><span class="entry-number">01</span><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M20 18h80v60H20zM35 35h7m12 0h30M35 49h7m12 0h30M35 63h7m12 0h30"/></svg><strong>Assisted</strong><span>Checklists, radio buttons and fields. The current profile builder.</span></button>
      <button type="button" class="entry-choice" data-mode="visual"><span class="entry-number">02</span><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M20 15h20v7h20v-7h40v24H60v7H40v-7H20zM20 48h20v7h20v-7h40v24H60v7H40v-7H20z"/></svg><strong>Visual blocks</strong><span>Arrange setting bricks, choose values and repeat each run group.</span></button>
      <button type="button" class="entry-choice" data-mode="audio"><span class="entry-number">03</span><svg viewBox="0 0 120 90" aria-hidden="true"><rect x="49" y="12" width="22" height="42" rx="11"/><path d="M37 40v8a23 23 0 0 0 46 0v-8M60 71v12M45 83h30M18 30v25m83-25v25"/></svg><strong>Audio interview</strong><span>Answer by voice, typing or numbered buttons. Review and save your decisions.</span></button>
    </div><div class="entry-footer"><p>Choose an editor to continue.</p><div><button type="button" id="studio-back">Go back</button><button type="button" id="studio-sound">Sound on</button></div></div></div>`;
    picker.querySelector("#studio-back").onclick=()=>picker.close();
    picker.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{picker.close();
      if(btn.dataset.mode==="audio")R2.voiceBuilder.open(U.getProfile());else U.openBuilder(null,btn.dataset.mode);
    });
    picker.setAttribute("aria-labelledby","studio-title");
    const sound=picker.querySelector("#studio-sound"), source=document.getElementById("workbench-sound");
    sound.textContent=source?.getAttribute("aria-pressed")==="true"?"Sound on":"Sound off";sound.onclick=()=>{source?.click();sound.textContent=source?.getAttribute("aria-pressed")==="true"?"Sound on":"Sound off";};
    picker.showModal(); R2.i18n?.refresh();
  }
  function validate(profile) {
    const parsed=B.parse(profile), errors=[...parsed.errors],warnings=[...parsed.warnings],seen=new Set(), groups=[];
    for(const item of parsed.runs) { if(seen.has(item.group))continue;seen.add(item.group);const pv=B.preview(item.spec,item.k);
      pv.errors.forEach(e=>errors.push(`Group ${item.group+1}: ${e}`));pv.warnings.forEach(e=>warnings.push(`Group ${item.group+1}: ${e}`));groups.push({group:item.group,info:pv.info,errors:pv.errors,warnings:pv.warnings});
    }
    return {errors,warnings,runs:parsed.runs.length,groups};
  }
  function snapshot() {
    const saved=B.snapshot(), templates=[], scenarioApplicability={};
    try {
      for(const tpl of R2.templates.list().filter(t=>!t.programmeOnly)) {
        const preview=B.preview({template:tpl.id});
        const applied=B.apply({template:tpl.id});
        if(applied.errors?.length)continue;
        const controls={};for(const w of R2.tech.plate||[])if(w.ctl)controls[w.ctl]=(controls[w.ctl]||0)+1;
        templates.push({id:tpl.id,name:tpl.name,crop:preview.info.crop,stage:preview.info.stage,controls,samplesMax:preview.info.maxSamples});
        // Template applicability is still checked again at confirm/launch by preview().
        scenarioApplicability[tpl.id]=R2.qpcrFaults.LIST.filter(s=>R2.qpcrFaults.runnable(s)).map(s=>s.id);
      }
    } finally { B.restore(saved); }
    return {fields:B.FIELDS,templates,scenarioApplicability,
      materials:R2.GMO.samples,scenarios:R2.qpcrFaults.LIST.filter(s=>R2.qpcrFaults.runnable(s)).map(s=>({id:s.id,title:s.title,category:s.cat})),categories:R2.qpcrFaults.CATEGORIES};
  }
  R2.profileStudio={open,decorate,validate,snapshot};
})(window.R2);
