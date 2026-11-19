/* Technician tab 4: the method record of each assay on the plate. */
(/* @r2fn R2-C0069-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  /* @r2fn R2-C0069-F00002 */function draw() {
    const ids = X.plan.tubes.flat(); $("g-method").innerHTML = ids.map(/* @r2fn R2-C0069-F00003 */id => `<option value="${id}">${R2.esc(X.GP().name(id))} · ${id}</option>`).join(""); $("g-method").value = X.methodShown;
    const id = X.methodShown, m = X.M(id), b = R2.reagents.build(m, R2.reagents.DEFAULT, { copies: 0, annealC: m.cyc[4] }, null).info, c = m.cyc;
    const oligo = /* @r2fn R2-C0069-F00004 */(k, name, seq, extra) => `<tr><td class="l">${k}</td><td class="l">${R2.esc(name)}</td><td class="l" style="font-family:var(--mono);font-size:.76rem;overflow-wrap:anywhere">${extra || ""}${seq}</td><td>${seq.replace(/[^ACGT]/g, "").length}</td></tr>`;
    $("g-card").innerHTML = `<p><b>${id}</b> · ${R2.esc(m.title)}. Target: ${R2.esc(m.target)}.</p>
      <div class="scroll"><table><tr><th class="l">Oligo</th><th class="l">Name</th><th class="l">Sequence 5′→3′</th><th>nt</th></tr>${oligo("Forward", m.F[0], m.F[1])}${oligo("Reverse", m.R[0], m.R[1])}${m.P ? oligo("Probe", m.P[0], m.P[2] + "–" + m.P[3], m.P[1] + "–") : ""}</table></div>
      ${m.amp ? `<p class="note" style="font-family:var(--mono);font-size:.74rem;overflow-wrap:anywhere">Amplicon: ${m.amp}</p>` : ""}`;
    $("g-card2").innerHTML = `<dt>Concentrations</dt><dd>primers ${m.nM[0] / 1000} / ${m.nM[1] / 1000} µmol/L${m.P ? ", probe " + m.nM[2] / 1000 + " µmol/L" : ", SYBR Green master mix"}; ${m.vol} µL</dd>
      <dt>Cycling</dt><dd>${c[0] ? "50 °C " + c[0] + " s (UNG); " : ""}95 °C ${c[1]} s; ${c[2]} × (95 °C ${c[3]} s, ${c[4]} °C ${c[5]} s)${m.melt ? "; melt 60–95 °C" : ""}</dd>
      <dt>Amplicon</dt><dd>${m.bp} bp${m.bpSrc ? " (" + R2.esc(m.bpSrc) + ")" : ""}</dd>${m.eff ? `<dt>Reported efficiency</dt><dd>${m.eff} %</dd>` : ""}${m.lod ? `<dt>Reported limits</dt><dd>${R2.esc(m.lod)}</dd>` : ""}${m.crm ? `<dt>Reference material</dt><dd>${R2.esc(m.crm)}</dd>` : ""}
      <dt>Computed on this bench</dt><dd>primer Tm ${b.tmF.toFixed(1)} / ${b.tmR.toFixed(1)} °C${m.P ? `; probe binds at about ${b.probeTm.toFixed(1)} °C` + (b.mgb ? ` (the minor-groove binder adds ${(b.probeTm - b.probeTm0).toFixed(0)} °C)` : "") : `; product melts near ${b.ampliconTm.toFixed(1)} °C`}; 3′ pairing between primers ${b.dimer3} bases</dd>
      <dt>Record</dt><dd>${m.source ? R2.esc(m.source) : `<a href="https://gmo-crl.jrc.ec.europa.eu/gmomethods/show/${m.labOf || id}/" target="_blank" rel="noopener">GMOMETHODS ${m.labOf || id}</a>`}</dd>${m.ampNote ? `<dt>Note</dt><dd>${R2.esc(m.ampNote)}</dd>` : ""}`;
  }
  X.tab({ id: "method", title: "Method record", done: /* @r2fn R2-C0069-F00005 */() => true,
    html: `<div class="grid two"><div class="panel"><h3>Method <select id="g-method" aria-label="Method"></select></h3><div id="g-card"></div></div>
      <div class="panel"><h3>Conditions and performance from the record</h3><dl class="kv" id="g-card2"></dl><p class="note">The record identifies the source for each assay.</p></div></div>`,
    init/* @r2fn R2-C0069-F00006 */() { $("g-method").onchange = /* @r2fn R2-C0069-F00007 */e => { X.methodShown = e.target.value; draw(); }; }, show: draw });
})(window.R2);
