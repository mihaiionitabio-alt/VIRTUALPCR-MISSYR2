/* Technician tab 6: primer and probe concentrations and probe chemistry. */
(/* @r2fn R2-C0071-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech, K = ["primerF", "primerR", "probe"];
  X.effects = /* @r2fn R2-C0071-F00002 */function (el) { const m = X.M(X.methodShown); $(el).innerHTML = `<h3>What the settings do to ${R2.esc(X.GP().name(X.methodShown))} <small>${X.methodShown}</small></h3>` + R2.reagents.explain(m, X.settings, X.f.annT).map(/* @r2fn R2-C0071-F00003 */t => `<small>• ${R2.esc(t)}</small>`).join(""); };
  /* @r2fn R2-C0071-F00004 */function draw() {
    const s = X.settings, m = X.M(X.methodShown); for (const k of K) $("r-" + k).value = s[k]; $("r-quencher").value = s.quencher; $("r-probeMismatch").checked = s.probeMismatch;
    $("r-abs").innerHTML = `<dt>Forward primer</dt><dd>${(m.nM[0] * s.primerF).toFixed(0)} nmol/L (method: ${m.nM[0]})</dd><dt>Reverse primer</dt><dd>${(m.nM[1] * s.primerR).toFixed(0)} nmol/L (method: ${m.nM[1]})</dd>` + (m.P ? `<dt>Probe</dt><dd>${(m.nM[2] * s.probe).toFixed(0)} nmol/L (method: ${m.nM[2]}), ${m.P[1]}–${s.quencher === "method" ? m.P[3] : s.quencher}</dd>` : `<dt>Detection</dt><dd>SYBR Green: no probe</dd>`);
    X.effects("r-eff1");
  }
  X.tab({ id: "reagents", title: "Primers and probe", done: /* @r2fn R2-C0071-F00005 */() => K.some(/* @r2fn R2-C0071-F00006 */k => X.settings[k] !== 1) || X.settings.quencher !== "method" || X.settings.probeMismatch,
    html: `<div class="grid two"><div class="panel"><h3>Concentrations <small>multiples of the method's value, for every assay on the plate</small></h3>
        <label>Forward primer × <input id="r-primerF" type="number" min="0.05" max="5" step="0.05" style="width:5em"></label><label>Reverse primer × <input id="r-primerR" type="number" min="0.05" max="5" step="0.05" style="width:5em"></label><label>Probe × <input id="r-probe" type="number" min="0.05" max="5" step="0.05" style="width:5em"></label>
        <dl class="kv" id="r-abs"></dl>
        <h3>Probe chemistry</h3><label>Quencher <select id="r-quencher"><option value="method">as in the method</option><option>TAMRA</option><option>BHQ1</option><option>MGBNFQ</option></select></label>
        <label class="c"><input id="r-probeMismatch" type="checkbox"> Target variant with one mismatch under the probe</label>
        <div class="row"><button id="r-reset1">Back to the method's values</button></div></div>
      <div class="panel"><div id="r-eff1" class="stack" style="gap:5px"></div><p class="note">The assay shown is the one chosen on the Method record tab. Change one thing, run, and compare the runs on the quality bench.</p></div></div>`,
    init/* @r2fn R2-C0071-F00007 */() {
      for (const k of K) $("r-" + k).onchange = /* @r2fn R2-C0071-F00008 */e => { X.settings[k] = R2.clamp(+e.target.value || 1, 0.05, 5); draw(); X.marks(); };
      $("r-quencher").onchange = /* @r2fn R2-C0071-F00009 */e => { X.settings.quencher = e.target.value; draw(); X.marks(); }; $("r-probeMismatch").onchange = /* @r2fn R2-C0071-F00010 */e => { X.settings.probeMismatch = e.target.checked; draw(); X.marks(); };
      $("r-reset1").onclick = /* @r2fn R2-C0071-F00011 */() => { for (const k of K) X.settings[k] = 1; X.settings.quencher = "method"; X.settings.probeMismatch = false; draw(); X.marks(); };
    }, show: draw });
})(window.R2);
