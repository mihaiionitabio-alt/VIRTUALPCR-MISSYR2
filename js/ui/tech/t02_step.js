/* Technician tab 2: analysis step and assays. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  function draw() {
    const st = X.stage, hint = R2.session.screen && R2.session.screen.crop === X.sample.crop ? R2.session.screen.candidates : null, status = id => { const c = hint && hint.find(x => x.method === id); return c ? c.status : ""; };
    const rapid = X.layout === "mara17", mara = R2.MARA.isLayout(X.layout), single = mara || st === "quant";
    const lab = st === "screen" && X.layout === "simplex", L = R2.LAB.simplex;
    $("g-stage").value = st;
    $("g-stage").querySelector('[value="screen"]').disabled = X.sample.crop === "cotton";
    $("g-duplex").checked = X.duplex;
    $("g-duplex-wrap").hidden = st !== "screen" || lab || rapid;
    const layouts = st === "screen" ?
      [["mara17", "Rapid fluorescence screening"], ["eurl", "Duplex marker screening"], ["simplex", "Simplex screening"]] :
      [["mara", (st === "quant" ? "Event quantification by standard curves" : "Event identification")],
       ...(st === "ident" ? [["mara16", "Relative ΔΔCt comparison"]] : []),
       ...(X.sample.crop !== "cotton" ? [["eurl", "Reference-method event assays"]] : [])];
    $("g-layout").innerHTML = layouts.map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
    $("g-layout").value = X.layout;
    if (lab) { const tax = L.taxon[X.sample.crop]; $("g-assays").innerHTML = [L.assays.p35s, L.assays.tnos, tax].map(id => { const m = X.M(id); return `<div class="c"><b>${R2.esc(X.GP().name(id))}</b> <small>${R2.esc(m.title)} · ${m.P[1]}–${m.P[3]} · primers ${m.nM[0]} nmol/L, probe ${m.nM[2]} nmol/L, ${m.vol} µL</small></div>`; }).join("");
      $("g-hint").textContent = "Simplex reactions. Per run and element: 0.1 % certified material at the limit of detection (duplicate), a positive sample, a no-template control and the DNA extraction blank. Each sample has three extracts in triplicate for P-35S, T-nos and the reference gene.";
      $("g-step-why").textContent = "Screening asks whether P-35S or T-nos, present in most GM events, is in the sample. The reference gene accepts the sample DNA (mean Cq 20–27).";
      return; }
    $("g-assays").innerHTML = X.stageIds.map(id => { const m = X.M(id), on = X.chosen[st].includes(id); return `<label class="c"><input type="${single ? "radio" : "checkbox"}" name="g-as" value="${id}" ${on ? "checked" : ""}> ${R2.esc(X.GP().name(id))} <small>${id}${m.sybr ? " · SYBR Green" : " · " + m.P[1] + "–" + m.P[3]} · ${m.cyc[2]} cycles, ${m.cyc[4]} °C${status(id) ? " · screening: " + status(id) : ""}</small></label>`; }).join("");
    if (rapid) {
      $("g-step-why").textContent = "Screen only the selected markers. Standard 17 gives a published target LOD of 1 %. A marker result can guide event-specific identification.";
      $("g-hint").textContent = "Includes " + X.GP().name(R2.MARA.rapid.taxon[X.sample.crop]) + " and shared controls. " + X.plan.capacity.maxSamples + " samples fit.";
      return;
    }
    if (mara) {
      const method = R2.MARA.assays[X.chosen[st][0]];
      const detail = X.layout === "mara16" ? "Compared with the simulated 0.9 % control. The −0.4 to +0.4 band goes to Method 2." :
        st === "quant" ? "Method 2 uses five shared calibrant levels, triplicate controls and an uncertainty interval." :
        "Method 1 uses an event/reference pair, a Cq cutoff of 36 and the majority of concordant extraction triplicates.";
      $("g-step-why").textContent = detail;
      $("g-hint").textContent = "Reference: " + method.ref + " · " + X.plan.capacity.extractions + " extracts × " + X.plan.capacity.replicates + " PCR replicates · up to " + X.plan.capacity.maxSamples + " samples.";
      return;
    }
    $("g-hint").textContent = st === "screen" ? "The species reference gene is always added. The selected reaction mixes fit up to " + X.plan.capacity.maxSamples + " samples on 384 wells." : st === "ident" ? (hint ? "The marks come from the last screening evaluated on the quality bench." : "Run a screening and evaluate it on the quality bench first: it tells you which events remain possible.") : "The method default uses four calibrant levels and triplicate controls. The Plate step shows this run’s actual controls and " + X.plan.capacity.extractions + " × " + X.plan.capacity.replicates + " sample wells per mix.";
    $("g-step-why").textContent = { screen: "Screening asks whether any common genetic element of GM plants is present. It is cheap and covers many events at once, but it cannot name the event.", ident: "Identification uses event-specific methods: each one spans the junction between the insert and the plant genome, which is unique to one event.", quant: "Quantification measures the event against a species reference gene with two calibration curves. The result is the GM content in % of genome copies." }[st];
  }
  X.tab({ id: "step", title: "Analysis step", done: () => true,
    html: `<div class="grid two"><div class="panel"><h3>What do you want to know</h3>
        <select id="g-stage" aria-label="Analysis step"><option value="screen">Screening: elements and constructs</option><option value="ident">Identification: event-specific, qualitative</option><option value="quant">Quantification: event against the species reference gene</option></select>
        <p id="g-step-why"></p><p class="note">Normal order: screening, then identification of the events the screening leaves possible, then quantification of each event found.</p></div>
      <div class="panel"><h3>Assays for this run</h3>
        <label id="g-layout-wrap">Procedure <select id="g-layout"><option value="eurl">Reference-method screening (default)</option><option value="simplex">P-35S, T-nos and reference gene, simplex</option></select></label>
        <div id="g-assays" class="stack" style="gap:5px"></div>
        <label class="c" id="g-duplex-wrap"><input id="g-duplex" type="checkbox"> Run P-35S and T-nos as the validated duplex (one tube, two dyes). Unticked: two simplex reactions.</label>
        <small id="g-hint"></small></div></div>`,
    init() {
      $("g-stage").onchange = e => {
        if (X.stage === "screen" && e.target.value !== "screen") X.layout = "mara";
        X.setStage(e.target.value); draw();
      };
      $("g-layout").onchange = e => { X.layout = e.target.value; if (X.layout === "simplex") { X.mixSettings = Object.assign({}, R2.mixcalc.DEFAULT, R2.LAB.simplex.mix); X.dna = { ...R2.LAB.simplex.dna }; X.ng = X.dna.concNgPerUl * X.dna.volUl; } else if (X.layout === "eurl" || X.layout === "mara17") { X.dna = { ...R2.gmoplan.DNA }; X.ng = R2.gmoplan.DEFAULT_NG; X.mixSettings = { ...R2.mixcalc.DEFAULT }; } X.setStage(X.stage); draw(); };
      $("g-duplex").onchange = e => { X.duplex = e.target.checked; X.build(true); };
      $("g-assays").addEventListener("change", () => { const v = [...document.querySelectorAll("#g-assays input:checked")].map(n => n.value); if (v.length) X.chosen[X.stage] = v; X.setStage(X.stage); draw(); });
    }, show: draw });
})(window.R2);
