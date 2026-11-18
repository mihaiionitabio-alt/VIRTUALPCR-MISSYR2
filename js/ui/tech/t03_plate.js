/* Technician tab 3: the plate. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  function draw(refreshStocks = true) {
    if (refreshStocks) drawStocks();
    $("g-plate").innerHTML = X.plateHtml(X.sel, true); $("g-plate-leg").innerHTML = X.plateLegend();
    $("g-notes").innerHTML = X.plan.notes.map(n => `<small>${R2.esc(n)}</small>`).join("");
    const cp = X.plan.capacity; $("g-cap").innerHTML = `<dt>Samples</dt><dd>${X.plan.samples.length} of at most ${cp.maxSamples} with these mixes</dd><dt>Wells used</dt><dd>${X.plate.filter(W => W.role !== "empty").length} of 384, rows A–${String.fromCharCode(64 + cp.rowsUsed)}</dd>`;
    const W = X.plate[X.sel], c = X.D().crops[X.sample.crop];
    $("g-tube").innerHTML = `<dt>Tube</dt><dd>${R2.wellName(X.sel)}</dd><dt>Role</dt><dd>${{ unknown: "sample", positive: "positive control", negative: "non-GM control", ntc: "no-template control", standard: "calibrant" }[W.role] || "empty"}</dd><dt>Template</dt><dd>${W.role === "unknown" ? "sample " + W.sampleNo + " (" + R2.esc(W.sample) + "), extraction E" + W.ext + ", PCR replicate " + W.rep + ", " + X.ng + " ng" : W.role === "ntc" ? "water" : R2.esc(W.material || W.sample)}</dd>` +
      W.t.map(t => { const m = X.M(t.m); return `<dt>${R2.esc(X.GP().name(t.m))}</dt><dd>${t.m}; primers ${m.nM[0] / 1000} / ${m.nM[1] / 1000} µmol/L${m.P ? ", probe " + m.P[1] + "–" + m.P[3] + " " + m.nM[2] / 1000 + " µmol/L" : ", SYBR Green"}; ${m.vol} µL${t.q ? "; " + t.q.toLocaleString("en") + " target copies" : ""}</dd>`; }).join("");
    $("g-mix").innerHTML = `<tr><th>Key</th><th class="l">Reaction mix</th><th class="l">Methods</th><th>Tubes</th><th class="l">Detection</th></tr>` + X.plan.tubes.map((t, index) => `<tr><td>M${index + 1}</td><td class="l">${t.map(id => R2.esc(X.GP().name(id))).join(" + ")}</td><td class="l">${t.join(" + ")}</td><td>${X.plate.filter(W => W.t.length && W.t[0].m === t[0]).length}</td><td class="l">${t.map(id => { const m = X.M(id); return m.P ? m.P[1] + " (channel " + (X.GP().channel(id) + 1) + ")" : "SYBR Green (channel 1)"; }).join(", ")}</td></tr>`).join("");
  }
  function drawStocks() {
    const stocks = [...new Set(X.plate.flatMap(well => R2.materials.stocks(well, X.plan, X.sample.crop)))];
    const container = $("g-extractions");
    container.replaceChildren();
    for (const name of stocks) {
      const label = document.createElement("label"), field = document.createElement("input");
      label.textContent = name;
      field.type = "datetime-local";
      if (X.extractions[name]) {
        const date = new Date(X.extractions[name]);
        field.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
      field.onchange = () => {
        X.extractions[name] = field.value ? new Date(field.value).toISOString() : null;
      };
      label.append(field);
      container.append(label);
    }
  }
  X.tab({ id: "plate", title: "Plate", done: () => true,
    html: `<div class="grid two"><div class="panel"><h3>Plate layout <small>384 wells, 16 rows × 24 columns</small></h3><div class="scroll"><div class="plate384" id="g-plate"></div></div><div id="g-plate-leg"></div><div id="g-notes" class="stack" style="gap:4px"></div>
        <p class="note">Each sample: three independent DNA extractions (sub-samples E1–E3), each in three PCR replicates, for every reaction mix. Controls once per run for every mix. Each mix starts on a new row.</p><dl class="kv" id="g-cap"></dl></div>
      <div class="stack"><div class="panel"><h3>Selected tube</h3><dl class="kv" id="g-tube"></dl></div><div class="panel"><h3>Reaction mixes to prepare</h3><div class="scroll"><table id="g-mix"></table></div></div><div class="panel"><h3>Control and calibrant DNA extraction</h3><p class="note">Optional local date and time for each material. Reused for matching material in later runs in this tab.</p><div class="stack" id="g-extractions"></div></div></div></div>`,
    init() { $("g-plate").onclick = e => { const b = e.target.closest("[data-w]"); if (b && !b.disabled) { X.sel = +b.dataset.w; const t = X.plate[X.sel].t[0]; if (t) X.methodShown = t.m; draw(false); $("g-plate").querySelector(`[data-w="${X.sel}"]`).focus(); } }; }, show: draw });
})(window.R2);
