/* Technician tab 12: the record of the run and the hand-over to the quality manager. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  function draw() {
    if (!X.ins) return; const r = X.runInfo, rec = X.ins.rec;
    $("rec-kv").innerHTML = r ? `<dt>Filed as</dt><dd>${R2.esc(r.name)}</dd><dt>Finished</dt><dd>${new Date(r.time).toLocaleString()}</dd><dt>Outcome</dt><dd>${R2.esc(r.outcome)}</dd><dt>Records</dt><dd>${rec.telemetry.length} thermal, ${rec.optical.length} optical, ${rec.events.length} events</dd><dt>Runs filed in this session</dt><dd>${R2.session.runs.length}</dd>` : `<dt>Status</dt><dd>the run is still in progress</dd>`;
    $("rec-log").textContent = rec.events.map(e => `[${R2.hms(e.t_ms / 1000).padStart(7)}] ${e.code}${e.severity >= 2 ? "  FAULT" : ""}`).join("\n"); $("t-handover").disabled = !r;
    $("rec-runs").innerHTML = `<tr><th class="l">Run</th><th class="l">Finished</th><th class="l">Step</th><th class="l">Outcome</th></tr>` + (R2.session.runs || []).slice().reverse().map(x => `<tr><td class="l">${R2.esc(x.name)}</td><td class="l">${new Date(x.time).toLocaleTimeString()}</td><td class="l">${x.gmo.stage}</td><td class="l">${R2.esc(x.outcome)}</td></tr>`).join("");
  }
  X.tab({ id: "record", title: "Record and hand-over", needsRun: true, done: () => false,
    html: `<div class="grid two"><div class="stack"><div class="panel"><h3>This run</h3><dl class="kv" id="rec-kv"></dl><div class="row"><button id="t-handover" class="primary">Open it on the quality bench</button></div>
          <p class="note">Every finished run is filed on the quality bench under its number and name. The technician's work ends here; evaluation is the quality manager's.</p></div>
        <div class="panel"><h3>Runs of this session</h3><div class="scroll"><table id="rec-runs"></table></div></div></div>
      <div class="panel"><h3>Event record</h3><div class="log" id="rec-log" style="max-height:420px"></div></div></div>`,
    init() { $("t-handover").onclick = () => { R2.session.run = X.runInfo; location.hash = R2.levels.reviewRoute(); }; }, show: draw });
})(window.R2);
