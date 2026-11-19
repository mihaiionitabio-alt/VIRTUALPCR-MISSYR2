/* Technician tab 5: reaction mixes and DNA dilutions for the plate (calculator in js/core/mixcalc.js). */
(/* @r2fn R2-C0070-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech, C = /* @r2fn R2-C0070-F00002 */() => R2.mixcalc;
  const FIELDS = [["masterMixX", "mx-x"], ["excessPct", "mx-ex"], ["extraReactions", "mx-extra"], ["roundUl", "mx-round"], ["minPipetUl", "mx-min"], ["primerStockUM", "mx-pst"], ["probeStockUM", "mx-prst"], ["rxnUl", "mx-rxn"], ["sampleStockNgPerUl", "mx-sst"], ["crmStockNgPerUl", "mx-crm"]];
  X.recipe = /* @r2fn R2-C0070-F00003 */() => C().recipe(X.plan, X.settings, X.mixSettings, X.dna);
  /* @r2fn R2-C0070-F00004 */function draw() {
    X.mixSettings = X.mixSettings || { ...C().DEFAULT };
    for (const [k, id] of FIELDS) $(id).value = X.mixSettings[k] === null ? "" : X.mixSettings[k];
    $("mx-tpl").textContent = `${X.dna.volUl} µL at ${X.dna.concNgPerUl} ng/µL = ${X.ng} ng`;
    const r = X.recipe(), num = /* @r2fn R2-C0070-F00005 */v => v.toFixed(2);
    $("mx-mixes").innerHTML = r.mixes.map(/* @r2fn R2-C0070-F00006 */m => `<div class="panel"><h3>${m.key} · ${R2.esc(m.methods.map(/* @r2fn R2-C0070-F00007 */id => X.GP().name(id)).join(" + "))} <small>${m.methods.join(" + ")}</small></h3>
      <p class="note" style="margin:0 0 6px">${m.reactions} tubes (${m.wells.map(/* @r2fn R2-C0070-F00008 */w => R2.wellName(w)).join(", ")}) · prepare for ${m.prepared} reactions · ${m.rxnUl} µL per reaction</p>
      <div class="scroll"><table><tr><th class="l">Component</th><th>Stock</th><th>Final</th><th>Per reaction µL</th><th>Mix total µL</th></tr>
      ${m.rows.map(/* @r2fn R2-C0070-F00009 */x => `<tr><td class="l w">${R2.esc(x.component)}</td><td>${R2.esc(x.stock)}</td><td>${R2.esc(String(x.final))}</td><td>${num(x.perRxn)}</td><td><b>${x.total.toFixed(1)}</b></td></tr>`).join("")}
      <tr><td class="l"><b>Total</b></td><td></td><td></td><td>${num(m.mixPerTubeUl)} + ${m.templateUl} template</td><td><b>${m.totalUl.toFixed(1)}</b></td></tr></table></div>
      <p class="note" style="margin:6px 0 0">Dispense ${m.mixPerTubeUl} µL of mix into each tube, then ${m.templateUl} µL of template.</p></div>`).join("");
    const d = r.dilutions;
    $("mx-dna").innerHTML = `<tr><th class="l">Template</th><th>Tubes</th><th>ng/µL</th><th>Prepare µL</th></tr>` + r.solutions.map(/* @r2fn R2-C0070-F00010 */o => `<tr><td class="l w">${R2.esc(o.label)}</td><td>${o.tubes}</td><td>${o.concNgPerUl === null ? "as supplied" : o.concNgPerUl}</td><td>${o.volumeUl}</td></tr>`).join("");
    const steps = [];
    if (d.sample) steps.push(`<li>Sample: ${d.sample.extractUl} µL of extract (${d.sample.from} ng/µL) + ${d.sample.waterUl} µL water → ${d.sample.to} ng/µL.</li>`);
    if (d.calibrants) d.calibrants.steps.forEach(/* @r2fn R2-C0070-F00011 */(x, i) => steps.push(i === 0 ? `<li>${R2.esc(x.level)}: ${x.fromStockUl} µL of the certified-material extract (${d.calibrants.stockNgPerUl} ng/µL) + ${x.waterUl} µL water → ${x.concNgPerUl} ng/µL (${x.totalUl} µL).</li>` : `<li>${R2.esc(x.level)}: ${x.fromAboveUl} µL of the level above + ${x.waterUl} µL water (1:${x.factor}) → ${x.concNgPerUl} ng/µL (${x.totalUl} µL).</li>`));
    $("mx-steps").innerHTML = steps.join("") || "<li>No dilution needed for this plate.</li>";
    $("mx-warn").innerHTML = r.warnings.length ? r.warnings.map(/* @r2fn R2-C0070-F00012 */w => `<div class="flag"><span class="pill warn">check</span><span>${R2.esc(w)}</span></div>`).join("") : `<div class="flag"><span class="pill ok">fits</span><span>Every mix fits its reaction volume and every total can be pipetted.</span></div>`;
    $("mx-prog").textContent = `${X.f.ung ? "50 °C " + X.f.ung + " s (UNG); " : ""}95 °C ${X.f.act} s; ${X.f.cycles} × (95 °C ${X.f.denS} s, ${X.f.annT} °C ${X.f.annS} s${X.f.extS ? ", " + X.f.extT + " °C " + X.f.extS + " s" : ""})${X.f.melt ? "; melt 65 → 95 °C" : ""}`;
  }
  X.tab({ id: "mix", title: "Reaction mixes", done: /* @r2fn R2-C0070-F00013 */() => true,
    html: `<div class="grid two"><div class="panel"><h3>Calculator settings</h3>
        <dl class="kv"><dt>Template per reaction</dt><dd id="mx-tpl"></dd></dl>
        <div class="row"><label>Master mix <select id="mx-x"><option value="2">2×</option><option value="4">4×</option><option value="5">5×</option><option value="10">10×</option></select></label>
          <label>Reaction volume <input id="mx-rxn" type="number" min="5" max="100" step="1" placeholder="record" style="width:6.5em"> µL</label></div>
        <div class="row"><label>Excess <input id="mx-ex" type="number" min="0" max="50" step="1" style="width:4em"> %</label><label>Extra reactions <input id="mx-extra" type="number" min="0" max="10" step="1" style="width:4em"></label>
          <label>Round up to <select id="mx-round"><option value="0.1">0.1 µL</option><option value="0.5">0.5 µL</option><option value="1">1 µL</option></select></label></div>
        <div class="row"><label>Primer stocks <input id="mx-pst" type="number" min="0.1" max="100" step="0.1" style="width:4.5em"> µmol/L</label><label>Probe stocks <input id="mx-prst" type="number" min="0.1" max="100" step="0.1" style="width:4.5em"> µmol/L</label>
          <label>Smallest pipetted volume <input id="mx-min" type="number" min="0.1" max="5" step="0.1" style="width:4em"> µL</label></div>
        <div class="row"><label>Sample extract measured at <input id="mx-sst" type="number" min="0.1" max="2000" step="0.1" style="width:5.5em"> ng/µL</label><label>Certified-material extract <input id="mx-crm" type="number" min="0.1" max="2000" step="0.1" style="width:5.5em"> ng/µL</label></div>
        <p class="note">Empty reaction volume: each mix uses the volume of its method record. Final concentrations follow the record, times the factors set on the Primers and probe step.</p>
        <div class="row"><button id="mx-copy">Copy recipe</button><button id="mx-txt">Download .txt</button><button id="mx-csv">Download .csv</button></div><p class="note" id="mx-msg" role="status"></p></div>
      <div class="stack"><div class="panel"><h3>Checks</h3><div id="mx-warn"></div></div>
        <div class="panel"><h3>DNA solutions for this plate</h3><div class="scroll"><table id="mx-dna"></table></div><ol id="mx-steps" style="margin:8px 0 0 1.1em;padding:0;font-size:.85rem"></ol></div>
        <details class="panel"><summary>Programme for these mixes</summary><p id="mx-prog" class="note"></p></details></div></div>
      <div class="stack" id="mx-mixes"></div>
      <p class="note">Calculator idea from PCR-Calculator (S. Gil): reactions, excess, 2× or 5× mix, rounded totals, copyable report. Here the volumes come from the EURL method records of the plate.</p>`,
    init/* @r2fn R2-C0070-F00014 */() {
      X.mixSettings = X.mixSettings || { ...C().DEFAULT };
      for (const [k, id] of FIELDS) $(id).addEventListener("change", /* @r2fn R2-C0070-F00015 */e => { const v = e.target.value; X.mixSettings[k] = v === "" || !isFinite(+v) ? C().DEFAULT[k] : Math.max(0, +v); if (k !== "rxnUl" && k !== "excessPct" && k !== "extraReactions" && !(X.mixSettings[k] > 0)) X.mixSettings[k] = C().DEFAULT[k]; draw(); });
      const title = /* @r2fn R2-C0070-F00016 */() => "Reaction mixes · " + X.stage + " · " + X.plan.tubes.flat().join(", ");
      $("mx-copy").onclick = /* @r2fn R2-C0070-F00017 */() => { const t = C().text(X.recipe(), title()); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(/* @r2fn R2-C0070-F00018 */() => { $("mx-msg").textContent = "Recipe copied."; }, /* @r2fn R2-C0070-F00019 */() => { $("mx-msg").textContent = "Copy is not allowed here; use Download .txt."; }); };
      $("mx-txt").onclick = /* @r2fn R2-C0070-F00020 */() => R2.download("reaction_mixes.txt", C().text(X.recipe(), title()), "text/plain");
      $("mx-csv").onclick = /* @r2fn R2-C0070-F00021 */() => R2.download("reaction_mixes.csv", C().csv(X.recipe()), "text/csv");
    }, show: draw });
})(window.R2);
