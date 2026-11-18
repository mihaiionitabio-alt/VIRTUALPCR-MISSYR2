/* Technician tab 11: inside the tube. The state of the reaction model, which no real instrument can see. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  let selection, selected = null, shown = null;
  function draw() {
    if (!X.runInfo) return;
    const plate = X.runInfo.plate;
    if (shown !== X.runInfo) { shown = X.runInfo; selected = null; selection.reset(); }
    if (plate[X.sel].role === "empty") X.sel = plate.findIndex(w => w.role !== "empty"); $("x-plate").innerHTML = X.plateHtml(X.sel, false, plate); $("x-plate").className = "plate384";
    $("x-plate").querySelectorAll("[data-w]:not(:disabled)").forEach(button => {
      const w = +button.dataset.w;
      button.setAttribute("aria-pressed", selected ? selected.has(w) : X.sel === w);
      button.title = R2.wellIdentity(plate[w], w);
      button.setAttribute("aria-label", button.title);
    }); const W = plate[X.sel], w = X.ins.plant.wells[X.sel], a = w.a;
    $("t-xw").textContent = R2.wellIdentity(W, X.sel) + " · " + X.tubeLabel(W);
    if (a.kind !== "reaction") { $("t-xray").innerHTML = `<span class="muted" style="grid-column:1/-1">This tube holds no reaction.</span>`; $("t-xnote").textContent = ""; $("x-kv").innerHTML = ""; return; }
    const row = (name, frac, txt) => `<span>${name}</span><div class="bar"><i style="width:${(R2.clamp(frac, 0, 1) * 100).toFixed(1)}%"></i></div><span class="n">${txt}</span>`, parts = [], kv = [];
    [[w.a, w.ch, false], [w.a2, w.ch2, true]].forEach(([ra, rc, second], k) => { if (!ra) return; const s = R2.chem.snapshot(rc, ra), total = Math.max(1, s.ds * 2 + s.ss + s.copying + s.stalled + s.template * 2), pr = X.ins.plant.probeState(X.sel, second), id = W.t[k].m, nm = X.GP().name(id).replace(/ \(.*/, ""), inf = X.simInfo[id] || {};
      parts.push(row(nm + ": product", s.ds * 2 / total, R2.sci(s.ds) + " copies"), row(nm + ": primers left", s.primers, (s.primers * 100).toFixed(0) + " %"));
      if (pr) parts.push(row(nm + ": probe cut", pr.cleaved / 0.25, (pr.cleaved * 100).toFixed(1) + " %")); else parts.push(row(nm + ": primer-dimer", Math.min(1, s.dimer / Math.max(1, s.ds + s.dimer)), R2.sci(s.dimer)));
      kv.push(`<dt>${R2.esc(nm)}</dt><dd>${s.copiesReal} target copies pipetted; primers ${R2.fmt(inf.F, 0)} / ${R2.fmt(inf.R, 0)} nmol/L${pr ? `; probe ${R2.fmt(inf.probeNominal, 0)} nmol/L, ${((inf.probeIntact || 1) * 100).toFixed(0)} % intact, ${((inf.bleached || 0) * 100).toFixed(0)} % bleached, binds at ${pr.tm.toFixed(1)} °C` : ""}; efficiency setting ${(ra.eff * 100).toFixed(0)} %</dd>`); });
    parts.push(row("Polymerase active", R2.chem.snapshot(w.ch, a).enzyme, (R2.chem.snapshot(w.ch, a).enzyme * 100).toFixed(0) + " %"));
    $("t-xray").innerHTML = parts.join(""); $("x-kv").innerHTML = kv.join("");
    $("t-xnote").textContent = "Probe cleavage shows the reaction model. The camera detector uses a gradual reporter response after onset. Background and quenching also affect the recorded fluorescence.";
    const tb = R2.analysis.tables(X.ins.rec), cyc = tb.cycles.map((c, i) => i + 1);
    const wells = selected ? [...selected] : [X.sel];
    const series = wells.flatMap(w => [0,1].filter(c => plate[w].t.some(t => X.GP().channel(t.m) === c)).map(c => ({
      key: w, x: cyc, y: tb.amp[c][w], color: c ? "var(--plot-y2, #fbbf24)" : R2.wellColor(plate,w), width: 1.6,
      card: () => `<b>${R2.esc(R2.wellIdentity(plate[w],w))}</b><span>${R2.esc(X.tubeLabel(plate[w]))}</span>`
    })));
    $("x-selection-count").textContent = wells.length + " wells selected";
    R2.chart($("x-curve"), { series, xlab: "cycle", ylab: "detector counts", height: 230, xshort: "cycle" });
  }
  X.tab({ id: "tube", title: "Inside the tube", needsRun: true, done: () => false,
    html: `<div class="grid two"><div class="stack"><div class="panel"><h3>Choose wells <small id="x-selection-count"></small></h3><p class="note">Drag or Shift-click a range, or Ctrl-click individual wells. Chemistry details follow the last well selected.</p><div class="scroll"><div class="plate384" id="x-plate"></div></div></div><div class="panel"><h3>What this tube gave the detector</h3><div id="x-curve"></div></div></div>
      <div class="panel"><h3>Inside tube <span id="t-xw" class="val"></span> <small>at the end of the run</small></h3><div class="bars" id="t-xray"></div><dl class="kv" id="x-kv"></dl><p class="note" id="t-xnote"></p><p class="note">A real instrument cannot see any of this. It is the model's own state, shown to explain the curve.</p></div></div>`,
    init() { selection = R2.selectPlate($("x-plate"), w => !!X.runInfo?.plate[w]?.t.length, (wells, focus) => {
      selected = wells || new Set(X.runInfo.plate.flatMap((well, i) => well.t.length ? [i] : []));
      X.sel = focus ?? selected.values().next().value ?? X.sel;
      draw();
      if (focus !== undefined) $("x-plate").querySelector(`[data-w="${focus}"]`)?.focus({ preventScroll: true });
    }); }, show: draw });
})(window.R2);
