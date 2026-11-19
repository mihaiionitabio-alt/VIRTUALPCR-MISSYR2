/* Technician bench, guided levels. They drive the same technician bench (R2.tech) and its run window; they only reduce
 * the number of screens where the technician enters data.
 * Beginner: one screen. Choose a prepared analysis (a built-in template) and start; plate, controls, mixes and
 *   programme come from the template.
 * Intermediate: four steps. Analysis (any template) → samples (number, material, extraction date) → check (plate,
 *   mixes, programme, warnings; read only) → run and result.
 * Administrator: the full bench plus template, procedure and natural-variation administration.
 * No calculation, model or default changes here: templates are applied with R2.templates.apply as on step 1. */
(/* @r2fn R2-C0065-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, L = R2.levels, X = R2.tech, T = /* @r2fn R2-C0065-F00002 */() => R2.templates, esc = R2.esc;
  const rec = L.store("missy-r2-tech-guided", /* @r2fn R2-C0065-F00003 */() => ({ runs: 0 }));
  const today = /* @r2fn R2-C0065-F00004 */() => new Date().toISOString().slice(0, 10);
  const SCEN = [
    { id: "lcc-soy", tpl: "TPL-BUILTIN-SIMPLEX-SC-SOY", title: "Soybean screening", text: "P-35S, T-nos and Le1, simplex. Soybean meal A. PC at LOD, positive sample, NTC and extraction blank for the run.", sample: "soyA" },
    { id: "lcc-mai", tpl: "TPL-BUILTIN-SIMPLEX-SC-MAIZE", title: "Maize screening, non-GM sample", text: "P-35S, T-nos and hmgA, simplex. Maize flour E (non-GM): expect no GM element.", sample: "maiE" },
    { id: "mara17", tpl: "TPL-MARA-17-SOY", title: "Rapid soybean screening", text: "P-35S and T-nos rapid screen on soybean meal A.", sample: "soyA" },
    { id: "quant", tpl: "TPL-BUILTIN-SOY-40-3-2", title: "Soybean 40-3-2 quantification", text: "Event 40-3-2 with lectin, calibrants on the plate; GM content per sample.", sample: "soyA" }
  ];
  let scen = SCEN[0].id, step = 0, wzTpl = null, watch = null, lastRun = null, mode = "beginner";
  const view = /* @r2fn R2-C0065-F00005 */() => $("view-technician");
  const draw = /* @r2fn R2-C0065-F00006 */() => { if (mode === "beginner" || mode === "intermediate") build(); };

  // result of each sample of a finished run, from the same evaluation as the quality bench
  /* @r2fn R2-C0065-F00007 */function resultRows(run) {
    let ev; try { ev = R2.gmoeval.run(run, { cqMethod: "auto", thresholds: {} }); } catch (err) { return `<p class="note">The result could not be evaluated here: ${esc(err.message)}. Open the quality review.</p>`; }
    const list = (ev.samples && ev.samples.length ? ev.samples : [{ no: 1, name: run.samples?.[0]?.name || run.name, ev }]);
    const txt = /* @r2fn R2-C0065-F00008 */e => e.mara ? e.mara.statement : e.lab ? e.lab.overall : e.stage === "quant" ? (e.gmPct !== undefined ? e.gmPct.toFixed(2) + " % GM" : e.quantStatus || "inconclusive") :
      e.order.filter(/* @r2fn R2-C0065-F00009 */id => e.assays[id].kind !== "taxon").map(/* @r2fn R2-C0065-F00010 */id => e.assays[id].name + ": " + e.assays[id].reported).join("; ");
    const lvl = /* @r2fn R2-C0065-F00011 */e => { const f = e.findings || []; return f.some(/* @r2fn R2-C0065-F00012 */x => x.level === "fail") ? ["bad", "check"] : f.some(/* @r2fn R2-C0065-F00013 */x => x.level === "warn") ? ["warn", "check"] : ["ok", "clear"]; };
    return `<div class="scroll"><table><tr><th>No.</th><th class="l">Sample</th><th class="l">Result</th><th class="l">Checks</th></tr>${list.map(/* @r2fn R2-C0065-F00014 */x => { const l = lvl(x.ev); return `<tr><td>${x.no}</td><td class="l">${esc(run.samples?.find(/* @r2fn R2-C0065-F00015 */s => s.no === x.no)?.name || x.name)}</td><td class="l"><b>${esc(txt(x.ev))}</b></td><td class="l"><span class="pill ${l[0]}">${l[1]}</span> ${esc((x.ev.findings || []).filter(/* @r2fn R2-C0065-F00016 */f => f.level !== "info").map(/* @r2fn R2-C0065-F00017 */f => f.text).slice(0, 2).join(" · "))}</td></tr>`; }).join("")}</table></div>`;
  }
  /* @r2fn R2-C0065-F00018 */function resultPanel(run) {
    return `<div class="panel"><h3>Result of run ${esc(run.name)} <small>${esc(run.outcome)}</small></h3>${resultRows(run)}
      <div class="row"><button class="primary" data-g-review>Open in the quality review</button><button data-g-save>Save as template</button><label>name <input data-g-tname value="${esc(run.name.replace(/^\d+_\d+_/, "").replace(/_/g, " "))}" style="width:16em"></label></div>
      <p class="note" data-g-msg role="status">The run is filed on the quality bench with its SOP. Same analysis, same SOP.</p></div>`;
  }
  // Start the prepared analysis directly; level unlocking is assessed separately.
  let requestingRun = false;
  /* @r2fn R2-C0065-F00019 */async function startRun(name) {
    if (requestingRun) return null;
    if (X.running()) return "A run is in progress.";
    X.go("run");
    if ($("t-start").disabled) return "The run cannot start: " + (X.running() ? "A run is in progress." : X.startProblem || "Check the set-up on the full bench (Expert).");
    requestingRun = true;
    const n0 = (R2.session.runs || []).length;
    view().classList.add("lv-run");
    try { X.beginPreparedRun(name || "Virtual PCR"); } finally { requestingRun = false; }
    // Detect a refused firmware start without counting a nonexistent completed run.
    setTimeout(/* @r2fn R2-C0065-F00020 */() => { if (!X.running() && (R2.session.runs || []).length === n0) { view().classList.remove("lv-run"); clearInterval(watch); const m = $("tg-msg") || $("wz-msg"); if (m) m.textContent = "The instrument refused to start (see the run log on the full bench)."; } }, 400);
    const r = rec.get(); r.runs++; r.last = new Date().toISOString(); rec.put(r);
    clearInterval(watch);
    watch = setInterval(/* @r2fn R2-C0065-F00021 */() => {
      const fs = $("run-stage").classList.contains("fs");
      if (!X.running() && (R2.session.runs || []).length > n0) {
        const completed = R2.session.runs[R2.session.runs.length - 1];
        if (lastRun !== completed) { lastRun = completed; draw(); }
        clearInterval(watch);
      }
      if (!X.running() && !fs) { view().classList.remove("lv-run"); if ((R2.session.runs || []).length > n0) clearInterval(watch); }
    }, 400);
    return null;
  }
  document.addEventListener("r2-run-view-left", /* @r2fn R2-C0065-F00022 */() => {
    if (!X.running()) { clearInterval(watch); view().classList.remove("lv-run"); }
  });
  /* @r2fn R2-C0065-F00023 */function apply(tplId, sampleKey) {
    const t = T().get(tplId); if (!t) return "Template not found.";
    T().apply(sampleKey ? Object.assign({}, t, { samplePreset: sampleKey }) : t, X);
    if (X.resetRunView) X.resetRunView(); return null;
  }
  /* @r2fn R2-C0065-F00024 */function setSamples(rows) {
    X.extra = rows.slice(1).map(/* @r2fn R2-C0065-F00025 */r => r.key); X.meta = rows.map(/* @r2fn R2-C0065-F00026 */r => ({ extractionDate: r.date || today(), label: r.label || "" })); X.build(false);
  }
  /* @r2fn R2-C0065-F00027 */function wireResult(box) {
    box.onclick = /* @r2fn R2-C0065-F00028 */async e => { const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-g-review") && lastRun) { R2.session.run = lastRun; location.hash = L.reviewRoute(); }
      if (b.hasAttribute("data-g-save") && lastRun) { const name = box.querySelector("[data-g-tname]").value; const t = T().capture(X, name); const ok = T().save(t);
        box.querySelector("[data-g-msg]").innerHTML = `${ok ? "Saved" : "Kept for this tab only"}: template <b>${esc(t.name)}</b> (${t.id}, SOP ${t.sop_id}).`; if (X.fillTemplates) X.fillTemplates(); } };
  }

  /* ---------------- Beginner ---------------- */
  /* @r2fn R2-C0065-F00029 */function drawBeginner() {
    const box = $("tg-b"), S = SCEN.find(/* @r2fn R2-C0065-F00030 */s => s.id === scen);
    box.innerHTML = `<div class="panel"><h3>New analysis <small>one screen</small></h3><div class="cards" id="tg-cards">${SCEN.map(/* @r2fn R2-C0065-F00031 */s => `<button type="button" data-scen="${s.id}" aria-pressed="${s.id === scen}"><span class="analysis-icon" aria-hidden="true">${s.id === "quant" ? "▥" : s.id === "mara17" ? "⌁" : s.id === "lcc-mai" ? "◈" : "❧"}</span><b>${esc(s.title)}</b><small>${esc(s.text)}</small></button>`).join("")}</div>
      <div class="row"><label>DNA extraction date <input type="date" id="tg-date" value="${esc(X.meta[0]?.extractionDate || today())}"></label><button id="tg-go" class="primary">Prepare the plate and start the run</button></div>
      <p class="note" id="tg-msg" role="status">The template sets plate, controls, mixes and programme. The run window fills the screen; close it when the run ends to see the result here.</p></div>
      <div id="tg-b-res">${lastRun ? resultPanel(lastRun) : ""}</div>`;
    $("tg-cards").onclick = /* @r2fn R2-C0065-F00032 */e => { const b = e.target.closest("[data-scen]"); if (b) { scen = b.dataset.scen; drawBeginner(); } };
    $("tg-go").onclick = /* @r2fn R2-C0065-F00033 */async () => { const err = apply(S.tpl, S.sample); if (err) { $("tg-msg").textContent = err; return; }
      setSamples([{ key: X.sampleKey, date: $("tg-date").value }]); const e2 = await startRun(S.title.replace(/\s*\(.*\)/, "")); if (e2) $("tg-msg").textContent = e2; };
    wireResult($("tg-b-res"));
  }

  /* ---------------- Intermediate: four steps ---------------- */
  const STEPS = ["Analysis", "Samples", "Check", "Run"];
  /* @r2fn R2-C0065-F00034 */function drawWizard() {
    // commit a value still being typed (its change event redraws first) before this redraw removes the field
    const act = document.activeElement; if (act && $("tg-i").contains(act) && act !== document.body) act.blur();
    const box = $("tg-i"), tpls = T().list().filter(/* @r2fn R2-C0065-F00035 */t => !t.programmeOnly);
    if (!wzTpl || !T().get(wzTpl)) wzTpl = tpls[0].id;
    let body = "";
    if (step === 0) body = `<label>Template <select id="wz-tpl" style="max-width:min(640px,90vw)">${tpls.map(/* @r2fn R2-C0065-F00036 */t => `<option value="${esc(t.id)}" ${t.id === wzTpl ? "selected" : ""}>${t.builtIn ? "Built-in · " : "Saved · "}${esc(t.name)}</option>`).join("")}</select></label>
      <p class="note">Species, step, assays, DNA per reaction, reagents, programme and reaction mixes come from the template.</p>`;
    if (step === 1) { const opts = R2.GMO.samples.filter(/* @r2fn R2-C0065-F00037 */s => s.blind || s.crop === X.sample.crop), n = 1 + X.extra.length, max = Math.min(X.plan.capacity.maxSamples, 12);
      body = `<div class="row"><label>Number of samples <input id="wz-n" type="number" min="1" max="${max}" value="${n}" style="width:4.5em"></label><small>up to ${max} on this plate; each sample: ${X.plan.capacity.extractions} extractions × ${X.plan.capacity.replicates} PCR replicates</small></div>
        <div class="scroll"><table><tr><th>No.</th><th class="l">Simulated material</th><th class="l">DNA extraction date</th><th class="l">Name (optional)</th></tr>${X.meta.map(/* @r2fn R2-C0065-F00038 */(m, i) => `<tr><td>${i + 1}</td>
          <td class="l"><select data-wz-mat="${i}">${opts.map(/* @r2fn R2-C0065-F00039 */o => `<option value="${o.key}" ${o.key === (i ? X.extra[i - 1] : X.sampleKey) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></td>
          <td class="l"><input type="date" data-wz-date="${i}" value="${esc(m.extractionDate)}"></td><td class="l"><input data-wz-lab="${i}" value="${esc(m.label || "")}" style="width:12em"></td></tr>`).join("")}</table></div>`; }
    if (step === 2) { let r = null; try { r = X.recipe(); } catch (err) { r = null; }
      const ctl = X.plate.filter(/* @r2fn R2-C0065-F00040 */w => w.role !== "unknown" && w.role !== "empty").length, used = X.plate.filter(/* @r2fn R2-C0065-F00041 */w => w.role !== "empty").length;
      body = `<div class="grid two"><div class="stack"><dl class="kv"><dt>Template</dt><dd>${esc(X.templateUsed ? X.templateUsed.name : "–")}</dd><dt>Samples</dt><dd>${X.plan.samples.length} · ${esc(X.plan.samples.map(/* @r2fn R2-C0065-F00042 */s => s.label).join("; "))}</dd>
          <dt>Wells</dt><dd>${used} of 384 (${ctl} control or calibrant wells)</dd><dt>DNA per well</dt><dd>${X.dna.volUl} µL at ${X.dna.concNgPerUl} ng/µL = ${X.ng} ng</dd>
          <dt>Programme</dt><dd>${X.f.ung ? "UNG " + X.f.ung + " s; " : ""}95 °C ${X.f.act} s; ${X.f.cycles} × (95 °C ${X.f.denS} s, ${X.f.annT} °C ${X.f.annS} s${X.f.extS ? ", " + X.f.extT + " °C " + X.f.extS + " s" : ""})${X.f.melt ? "; melt" : ""}</dd></dl>
          ${r ? `<div class="scroll"><table><tr><th class="l">Mix</th><th class="l">Assays</th><th>Tubes</th><th>Prepare for</th><th>Mix total µL</th></tr>${r.mixes.map(/* @r2fn R2-C0065-F00043 */m => `<tr><td class="l">${m.key}</td><td class="l">${esc(m.methods.map(/* @r2fn R2-C0065-F00044 */id => R2.gmoplan.name(id)).join(" + "))}</td><td>${m.reactions}</td><td>${m.prepared}</td><td>${m.totalUl.toFixed(1)}</td></tr>`).join("")}</table></div>
          ${r.warnings.length ? r.warnings.map(/* @r2fn R2-C0065-F00045 */w => `<div class="flag"><span class="pill warn">check</span><span>${esc(w)}</span></div>`).join("") : `<div class="flag"><span class="pill ok">fits</span><span>Every mix fits its reaction volume and every total can be pipetted.</span></div>`}` : ""}
          <p class="note">Full recipes, dilutions and every setting: Expert level, steps 3–8.</p></div>
        <div class="panel" style="padding:8px"><div class="scroll"><div class="plate384">${X.plateHtml(-1, true)}</div></div>${X.plateLegend()}</div></div>`; }
    if (step === 3) body = `<p>Start the run. The run window fills the screen; close it when the run ends to see the result here.</p><div class="row"><label>Experiment name <input id="wz-name" value="${esc({ screen: "screening", ident: "identification", quant: "quantification" }[X.stage] + " " + X.sample.label.split(" (")[0])}" style="width:20em"></label><button id="wz-go" class="primary">Close lid and start</button></div><p class="note" id="wz-msg" role="status"></p><div id="wz-res">${lastRun ? resultPanel(lastRun) : ""}</div>`;
    box.innerHTML = `<div class="panel"><h3>New analysis <small>four steps</small></h3><div class="wizard">${STEPS.map(/* @r2fn R2-C0065-F00046 */(s, i) => `<span class="${i === step ? "on" : i < step ? "done" : ""}">${s}</span>`).join("")}</div>${body}
      <div class="row stepnav">${step ? `<button type="button" data-wz="${step - 1}">← ${STEPS[step - 1]}</button>` : ""}${step < 3 ? `<button type="button" class="primary" data-wz="${step + 1}">${STEPS[step + 1]} →</button>` : ""}</div></div>`;
    box.onchange = /* @r2fn R2-C0065-F00047 */e => { const t = e.target, d = t.dataset;
      if (t.id === "wz-tpl") wzTpl = t.value;
      if (t.id === "wz-n") { const n = R2.clamp(Math.round(+t.value || 1), 1, Math.min(X.plan.capacity.maxSamples, 12)); const rows = currentRows(); while (rows.length < n) rows.push({ key: X.sampleKey === "blind" ? (R2.GMO.samples.find(/* @r2fn R2-C0065-F00048 */s => s.crop === X.sample.crop && !s.blind) || {}).key : X.sampleKey, date: rows[0].date }); rows.length = n; setSamples(rows); drawWizard(); }
      if (d.wzMat !== undefined) { const i = +d.wzMat, rows = currentRows(); if (i === 0) { X.setSample(t.value); setSamples(rows.map(/* @r2fn R2-C0065-F00049 */(r, k) => k ? Object.assign(r, { key: R2.GMO.samples.find(/* @r2fn R2-C0065-F00050 */s => s.key === r.key && (s.blind || s.crop === X.sample.crop)) ? r.key : t.value }) : Object.assign(r, { key: t.value }))); } else { rows[i].key = t.value; setSamples(rows); } drawWizard(); }
      if (d.wzDate !== undefined) X.meta[+d.wzDate].extractionDate = t.value || today();
      if (d.wzLab !== undefined) X.meta[+d.wzLab].label = t.value.trim(); };
    box.onpointerdown = /* @r2fn R2-C0065-F00051 */e => {
      if (e.target.closest("[data-wz]")) e.preventDefault();
    };
    box.onclick = /* @r2fn R2-C0065-F00052 */async e => { const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.wz !== undefined && box.contains(document.activeElement)) document.activeElement.blur();
      if (b.dataset.wz !== undefined) { const to = +b.dataset.wz; if (step === 0 && to === 1) { const err = apply(wzTpl); if (err) return; X.meta = X.meta.slice(0, 1 + X.extra.length); } step = to; drawWizard(); return; }
      if (b.id === "wz-go") { const err = await startRun($("wz-name").value); if (err) $("wz-msg").textContent = err; return; }
    };
    if ($("wz-res")) { $("wz-res").addEventListener("click", /* @r2fn R2-C0065-F00053 */e => e.stopPropagation()); wireResult($("wz-res")); }
  }
  const currentRows = /* @r2fn R2-C0065-F00054 */() => X.meta.map(/* @r2fn R2-C0065-F00055 */(m, i) => ({ key: i ? X.extra[i - 1] : X.sampleKey, date: m.extractionDate, label: m.label }));

  /* ---------------- Administrator ---------------- */
  /* @r2fn R2-C0065-F00056 */function admin() {
    const box = $("tech-admin");
    const saved = T().list().filter(/* @r2fn R2-C0065-F00057 */t => !t.builtIn);
    box.innerHTML = `<div class="grid two"><div class="panel"><h3>Administrator · templates <small>${saved.length} saved in this browser</small></h3>
        <div class="scroll" style="max-height:260px"><table><tr><th class="l">Name</th><th class="l">ID</th><th class="l">Procedure ID</th><th></th></tr>${saved.map(/* @r2fn R2-C0065-F00058 */t => `<tr><td class="l">${esc(t.name)}</td><td class="l"><code>${esc(t.id)}</code></td><td class="l"><code>${esc(t.sop_id || "–")}</code></td><td><button data-ta-del="${esc(t.id)}" class="danger">Delete</button></td></tr>`).join("") || `<tr><td class="l" colspan="4">No saved templates yet.</td></tr>`}</table></div>
        <div class="row"><button id="ta-exp">Download all saved templates (.json)</button></div><p class="note" id="ta-msg" role="status">Built-in templates cannot be deleted. Import is on step 1 of the full bench.</p></div>
      <div class="panel"><h3>Procedures and natural variation</h3>
        <div class="scroll" style="max-height:200px"><table><tr><th class="l">Procedure</th><th class="l">Acceptance</th></tr>${Object.values(R2.LAB || {}).map(/* @r2fn R2-C0065-F00059 */p => `<tr><td class="l">${esc(p.title)}</td><td class="l">${p.rules ? `PC at LOD Cq ${p.rules.lod.join("–")}; reference gene ${p.rules.taxon.join("–")}; negative ≥ ${p.rules.negativeCq}` : ""}</td></tr>`).join("")}</table></div>
        <label class="c"><input type="checkbox" id="ta-nat" ${X.natural !== false ? "checked" : ""}> Natural run-to-run variation (fitted to the real runs; off gives the model's mean values)</label>
        <p class="note">Guided runs on this browser: ${rec.get().runs}. Variation applies to the next run and is stored in templates saved afterwards.</p></div></div>`;
    box.onclick = /* @r2fn R2-C0065-F00060 */async e => { const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.taDel) { T().remove(b.dataset.taDel); if (X.fillTemplates) X.fillTemplates(); admin(); }
      if (b.id === "ta-exp") R2.download("MISSY_R2_templates_" + today() + ".json", JSON.stringify(T().list().filter(/* @r2fn R2-C0065-F00061 */t => !t.builtIn), null, 1), "application/json"); };
    $("ta-nat").onchange = /* @r2fn R2-C0065-F00062 */e => { X.natural = e.target.checked; };
  }

  /* @r2fn R2-C0065-F00063 */function build() {
    const box = $("tech-guided");
    if (!box.childElementCount) box.innerHTML = `<div class="lv-b stack" id="tg-b"></div><div class="lv-i stack" id="tg-i"></div>`;
    if (mode === "beginner") drawBeginner(); else { if (step > 1 && !X.plan) step = 0; drawWizard(); }
  }
  L.on("technician", /* @r2fn R2-C0065-F00064 */lv => { mode = lv; if (lv === "beginner" || lv === "intermediate") { if (!X.running()) build(); } if (lv === "admin") admin(); if (lv === "expert" || lv === "admin") view().classList.remove("lv-run"); });
  R2.techGuided = { SCEN, apply, setSamples, startRun, state: /* @r2fn R2-C0065-F00065 */() => ({ scen, step, lastRun }), go/* @r2fn R2-C0065-F00066 */(s) { step = s; drawWizard(); } };
})(window.R2);
