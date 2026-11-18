/* Technician Administrator: arm one qPCR error scenario (js/core/qpcr_faults.js) for the next run.
 * The scenario applies to one run only; the run and its RDMLt carry run.injectedFault, so MISSY and the Quality
 * review always know that the record was produced on purpose. Nothing here changes the bench settings. */
(function (R2) {
  "use strict";
  const $ = R2.$, esc = R2.esc, FX = R2.qpcrFaults, L = R2.levels;
  let picked = null;
  function draw() {
    let box = $("tech-faults");
    if (!box) { box = document.createElement("div"); box.id = "tech-faults"; box.className = "stack lv-admin"; $("tech-admin").after(box); }
    const cats = Object.keys(FX.CATEGORIES), sc = picked && FX.get(picked), armed = FX.active;
    box.innerHTML = `<div class="panel"><h3>Administrator · qPCR error scenario for the next run <small>${FX.LIST.length} catalogue entries · ${FX.LIST.filter(FX.runnable).length} armable</small></h3>
      <p class="note">Native scenarios change only the inputs of one run (reagents, programme, plan, instrument instance). Injected scenarios transform the raw readings after acquisition, where the model has no physics for the error. Both are labelled in the run and in its RDMLt (<code>source/run-input.json → injectedFault</code>).</p>
      <div class="row"><label>Scenario <select id="fx-pick" style="max-width:min(640px,90vw)"><option value="">none (normal run)</option>${cats.map(c => `<optgroup label="${esc(c + " · " + FX.CATEGORIES[c])}">${FX.LIST.filter(s => s.cat === c).map(s => `<option value="${s.id}" ${s.id === picked ? "selected" : ""} >${esc(s.title)}${FX.runnable(s) ? "" : " — " + esc(s.kind)}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <button id="fx-arm" class="primary" ${sc && FX.runnable(sc) ? "" : "disabled"}>Arm for the next run</button><button id="fx-clear" ${armed ? "" : "disabled"}>Disarm</button></div>
      <p class="note" role="status">${armed ? `<span class="pill warn">armed</span> ${esc(armed.title)} — start the run from any level; the scenario applies once.` : "No scenario armed: the next run is normal."}</p>
      ${sc ? `<dl class="kv"><dt>Kind</dt><dd>${esc(sc.kind)}</dd><dt>Mechanism</dt><dd>${esc(sc.mechanism)}</dd><dt>Workbench</dt><dd>${esc(sc.workbench)}</dd><dt>Where it shows in MISSY</dt><dd>${esc(sc.missy)}</dd>${sc.choice ? `<dt>Analysis</dt><dd>Set up ${esc(sc.choice.stage === "quant" ? "a quantification" : "a duplex screening")} first (${esc(R2.GMO.samples.find(sample=>sample.key===sc.choice.sample)?.label || sc.choice.sample)}).</dd>` : ""}</dl>` : ""}</div>`;
    $("fx-pick").onchange = e => { picked = e.target.value || null; draw(); };
    $("fx-arm").onclick = () => { FX.active = FX.get(picked); draw(); };
    $("fx-clear").onclick = () => { FX.active = null; draw(); };
  }
  if (FX && L) L.on("technician", lv => { if (lv === "admin") draw(); });
})(window.R2);
