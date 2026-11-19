/* Technician tab 8: the cycling programme. */
(/* @r2fn R2-C0073-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech, TF = ["ung", "act", "cycles", "denS", "annT", "annS", "extS"];
  /* @r2fn R2-C0073-F00002 */function draw() {
    for (const k of TF) $("t-" + k).value = X.f[k]; $("t-melt").checked = X.f.melt; $("g-lead").textContent = "from " + X.fl.lead;
    $("g-diff").innerHTML = X.fl.diff.map(/* @r2fn R2-C0073-F00003 */d => `<div class="flag"><span class="pill warn">differs</span><span>${R2.esc(d)}. One block runs one programme: this plate uses the programme on the left.</span></div>`).join("") || `<small>All methods on this plate ask for the same programme.</small>`;
    const p = X.protocol(), err = R2.Firmware.prototype.validate(p); X.prof = R2.planProfile(p);
    $("t-est").textContent = err ? "The instrument will refuse this programme: " + err + "." : `Instrument time ${R2.hms(X.prof.total)}. On screen: one second per cycle, about ${X.f.cycles + 5} s in all.`; $("t-est").style.color = err ? "var(--bad)" : "";
    R2.chart($("t-plan"), { series: [{ x: X.prof.t.map(/* @r2fn R2-C0073-F00004 */v => v / 60), y: X.prof.T, color: "var(--heat)", width: 1.2 }], xlab: "instrument minutes", ylab: "block temperature (°C)", height: 240, ylim: [20, 112], xshort: "min" });
    $("t-stages").innerHTML = `<tr><th class="l">Stage</th><th>Repeats</th><th class="l">Steps</th></tr>` + p.stages.map(/* @r2fn R2-C0073-F00005 */s => `<tr><td class="l">${s.type === "hold" ? (s.steps[0].temp_c < 70 ? "UNG" : "Activation") : s.type === "cycle" ? "Cycling" : "Melt"}</td><td>${s.repeats || 1}</td><td class="l">${s.steps ? s.steps.map(/* @r2fn R2-C0073-F00006 */x => `${x.temp_c} °C ${x.hold_s} s${x.read ? " · read" : ""}`).join(" → ") : `${s.from_c} → ${s.to_c} °C at ${s.rate_c_per_s} °C/s, reading all the way`}</td></tr>`).join("");
  }
  X.tab({ id: "programme", title: "Programme", done: /* @r2fn R2-C0073-F00007 */() => true,
    html: `<div class="grid two"><div class="panel"><h3>Cycling programme <small id="g-lead"></small></h3>
        <div class="row"><label>UNG step at 50 °C <input id="t-ung" type="number" min="0" max="600" style="width:4.5em"> s</label><label>Activation at 95 °C <input id="t-act" type="number" min="1" max="1200" style="width:5em"> s</label></div>
        <div class="row"><label>Cycles <input id="t-cycles" type="number" min="5" max="60" style="width:4em"></label><label>Denature 95 °C <input id="t-denS" type="number" min="1" max="120" style="width:4em"> s</label></div>
        <div class="row"><label>Anneal/extend <input id="t-annT" type="number" min="40" max="75" style="width:4em"> °C</label><label><input id="t-annS" type="number" min="5" max="180" style="width:4em"> s</label><label>Extra 72 °C step <input id="t-extS" type="number" min="0" max="120" style="width:4em"> s</label></div>
        <label class="c"><input id="t-melt" type="checkbox"> Melt curve 65 → 95 °C (SYBR Green assays)</label>
        <div class="row"><button id="t-fromrec">Take the programme from the method record again</button></div>
        <div id="g-diff" class="stack" style="gap:4px"></div><small id="t-est"></small></div>
      <div class="stack"><div class="panel"><h3>Planned temperature profile</h3><div id="t-plan"></div></div><div class="panel"><h3>Stages</h3><div class="scroll"><table id="t-stages"></table></div></div></div></div>`,
    init/* @r2fn R2-C0073-F00008 */() {
      for (const k of TF) $("t-" + k).onchange = /* @r2fn R2-C0073-F00009 */e => { X.f[k] = +e.target.value || 0; draw(); };
      $("t-melt").onchange = /* @r2fn R2-C0073-F00010 */e => { X.f.melt = e.target.checked; draw(); }; $("t-fromrec").onclick = /* @r2fn R2-C0073-F00011 */() => { X.build(true); draw(); };
    }, show: draw });
})(window.R2);
