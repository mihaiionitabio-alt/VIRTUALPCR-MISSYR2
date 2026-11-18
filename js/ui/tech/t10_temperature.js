/* Technician tab 10: temperature statistics of the finished run. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  function draw() {
    if (!X.ins) return; const tm = X.ins.rec.telemetry, prog = X.ins.fw.prog || X.protocol(), ts = R2.tempStats(tm, prog);
    $("ts-table").innerHTML = R2.tempStatsTable(ts);
    $("ts-kv").innerHTML = `<dt>Highest block temperature</dt><dd>${ts.blockMax.toFixed(2)} °C (firmware limit 103 °C, hardware trip 108 °C)</dd><dt>Largest difference between the two zones in holds</dt><dd>${ts.zoneDiffMax.toFixed(2)} °C</dd><dt>Lid during the run</dt><dd>mean ${R2.fmt(ts.lidMean, 1)} °C, SD ${R2.fmt(ts.lidSd)} °C</dd><dt>Heat sink peak</dt><dd>${ts.hsMax.toFixed(1)} °C (limit 80 °C)</dd><dt>One cycle takes</dt><dd>${R2.fmt(ts.cycleS, 1)} s of instrument time</dd><dt>Telemetry</dt><dd>${tm.length} records at 10 per second</dd><dt>Scale</dt><dd>block sensor; the liquid in a tube lags behind it</dd>`;
    X.drawThermal("ts-all", null, 230);
    const cyc = ts.steps.filter(s => s.type === "cycle"), col = ["var(--heat)", "var(--s1)", "var(--s3)"];
    R2.chart($("ts-cyc"), { series: cyc.map((s, i) => ({ x: s.perCycle.map(c => c.cycle), y: s.perCycle.map(c => c.mean - s.target), color: col[i % 3], width: 1.4, points: true, r: 2.2 })), xlab: "cycle", ylab: "mean hold temperature − target (°C)", height: 220 });
    $("ts-cyc-leg").innerHTML = R2.legend(cyc.map((s, i) => [R2.tempStatsLabel(s) + " " + s.target + " °C", col[i % 3]]));
    // one cycle enlarged: the middle cycle
    const st = prog.stages.findIndex(s => s.type === "cycle"), mid = Math.max(1, Math.round((prog.stages[st] || { repeats: 2 }).repeats / 2)), rows = tm.filter(r => r.stage === st && r.cycle === mid), t0 = rows.length ? rows[0].t_ms : 0;
    R2.chart($("ts-one"), { series: [{ x: rows.map(r => (r.t_ms - t0) / 1000), y: rows.map(r => r.setpoint_c), color: "var(--muted)", dash: "4 3", width: 1.1 }, { x: rows.map(r => (r.t_ms - t0) / 1000), y: rows.map(r => r.zone1_c), color: "var(--heat)" }], xlab: "seconds within cycle " + mid, ylab: "°C", height: 220 });
  }
  X.tab({ id: "temperature", title: "Temperature statistics", needsRun: true, done: () => false,
    html: `<div class="panel"><h3>Per programme step</h3><div class="scroll"><table id="ts-table"></table></div><p class="note">Mean, scatter and largest error are taken over the hold periods only. Overshoot is how far the block went past the target on arrival. The ramp is the one that leads into the step.</p></div>
      <div class="grid two"><div class="panel"><h3>Whole run</h3><div id="ts-all"></div><dl class="kv" id="ts-kv"></dl></div>
        <div class="stack"><div class="panel"><h3>Hold temperature cycle by cycle</h3><div id="ts-cyc"></div><div id="ts-cyc-leg"></div></div><div class="panel"><h3>One cycle enlarged</h3><div id="ts-one"></div></div></div></div>`,
    show: draw });
})(window.R2);
