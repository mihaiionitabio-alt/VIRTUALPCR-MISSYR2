/* Quality-manager bench: review of a GMO run. Controls, sample result per assay, screening pattern or GM content,
 * and the output files (RDML for MISSY, wells table, run package, analysis summary). */
(/* @r2fn R2-C0059-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, M = /* @r2fn R2-C0059-F00002 */id => R2.GMO.methods[id], GP = /* @r2fn R2-C0059-F00003 */() => R2.gmoplan;
  const LBL = { primerF: "forward primer, × method", primerR: "reverse primer, × method", probe: "probe, × method", quencher: "quencher", probeMismatch: "mismatch under the probe", probeStoreC: "probe storage °C", probeMonths: "probe stored, months", probeLightH: "probe in room light, h", freezeThaw: "freeze–thaw cycles", primerStoreC: "primer storage °C", primerMonths: "primers stored, months", mixStoreC: "master mix storage °C", mixMonths: "master mix stored, months", hotStart: "hot-start polymerase", benchMin: "plate on the bench, min", ambientC: "room °C", carryover: "amplicon carry-over, copies per tube", ungActive: "UNG active", pipetCV: "pipetting scatter %", inhibitor: "extra inhibitor" };
  let inited = false, run = null, ev = null, cur = null, res = null, pl = null, pkg = null, shown = null, thresholds = {};
  let appliedMethod = "threshold", pendingThresholds = {};
  /* @r2fn R2-C0059-F00004 */function pendingSettings() { $("q-apply-settings").disabled = false; $("q-settings-status").textContent = "Settings changed. Confirm to update the results."; }
  let selected = null, selection, roleOff = new Set(), hoverKey = null, charts = [];
  const vis = /* @r2fn R2-C0059-F00005 */w => pl[w].role !== "empty" && (selected === null || selected.has(w)) && !roleOff.has(pl[w].role);
  const card = /* @r2fn R2-C0059-F00006 */w => { const a = res.amp ? res.amp.wells[w] : null; return `<b>${R2.esc(R2.wellIdentity(run.plate[w], w))}</b><span>${pl[w].role}${a && a.cq !== null ? " · Cq " + a.cq.toFixed(2) : " · no Cq"}</span>`; };
  /* @r2fn R2-C0059-F00007 */function setHover(k) { if (k === hoverKey) return; hoverKey = k; for (const c of charts) c.highlight(k); document.querySelectorAll("#q-plate [data-w]").forEach(/* @r2fn R2-C0059-F00008 */b => b.classList.toggle("dim", k !== null && +b.dataset.w !== k)); }
  /* @r2fn R2-C0059-F00009 */function bandTables(tb, ch) {
    const n = tb.cycles.length, lo = Array.from({ length: tb.nw }, /* @r2fn R2-C0059-F00010 */() => new Array(n).fill(NaN)), hi = Array.from({ length: tb.nw }, /* @r2fn R2-C0059-F00011 */() => new Array(n).fill(NaN)), T = new Array(n).fill(0), nT = new Array(n).fill(0), ci = new Map(tb.cycles.map(/* @r2fn R2-C0059-F00012 */(c, i) => [c, i]));
    for (const o of run.record.optical) if (o.kind === "A" && ci.has(o.cycle) && o.channel === ch) { const i = ci.get(o.cycle); lo[o.well][i] = o.min_net / 8; hi[o.well][i] = o.max_net / 8; T[i] += o.tzone_end_mC / 1000; nT[i]++; }
    return { lo, hi, T: T.map(/* @r2fn R2-C0059-F00013 */(v, i) => nT[i] ? v / nT[i] : NaN) };
  }
  /* @r2fn R2-C0059-F00014 */function drawAmp() {
    const a = res.amp; charts = charts.filter(/* @r2fn R2-C0059-F00015 */c => c.tag !== "amp");
    if (!a) { $("q-amp").innerHTML = `<p class="note">Fewer than 8 read cycles: no amplification analysis.</p>`; $("q-amp-unit").textContent = ""; return; }
    const sub = $("q-view").value === "sub", log = $("q-scale").value === "log" && sub, floor = a.threshold / 30, x = a.cycles.map(/* @r2fn R2-C0059-F00016 */(c, i) => i + 1), bt = bandTables(res.tables, ev.assays[cur].channel), series = [], markers = [];
    $("q-scale").disabled = !sub;
    for (const w of a.wells) {
      if (!vis(w.well) || (sub && !w.corrected)) continue; const b = w.baseline, col = R2.wellColor(pl, w.well), base = /* @r2fn R2-C0059-F00017 */i => b.error ? 0 : b.intercept + b.slope * a.cycles[i];
      const conv = /* @r2fn R2-C0059-F00018 */(v, i) => sub ? v - base(i) : v, cut = /* @r2fn R2-C0059-F00019 */v => log ? (v > floor ? v : NaN) : v;
      const s = { key: w.well, x, y: (sub ? w.corrected : w.signal).map(cut), color: col, width: 1.6, card: /* @r2fn R2-C0059-F00020 */() => card(w.well) };
      if ($("q-bands").checked) s.band = { lo: bt.lo[w.well].map(/* @r2fn R2-C0059-F00021 */(v, i) => cut(conv(v, i))), hi: bt.hi[w.well].map(/* @r2fn R2-C0059-F00022 */(v, i) => cut(conv(v, i))) };
      series.push(s);
      if (!sub && !b.error) series.push({ key: w.well, x: x.slice(0, b.window[1] + 4), y: x.slice(0, b.window[1] + 4).map(/* @r2fn R2-C0059-F00023 */(v, i) => base(i)), color: col, dash: "3 3", width: 1, noHover: true });
      if (w.cq !== null && sub) { const i0 = Math.floor(w.cq) - 1, fr = w.cq - Math.floor(w.cq), y = a.cqMethod === "cy0" ? (w.corrected[i0] + fr * ((w.corrected[i0 + 1] === undefined ? w.corrected[i0] : w.corrected[i0 + 1]) - w.corrected[i0])) : a.threshold; if (!log || y > floor) markers.push({ x: w.cq, y, color: col, key: w.well }); }
    }
    const opt = { series, markers, xlab: "cycle", ylab: sub ? "baseline-subtracted counts" : "counts as measured", height: 340, maxWidth: 1920, ylog: log, ylogFloor: floor, xshort: "cycle", highlight: hoverKey, onHover: setHover };
    if (sub) opt.threshold = { y: a.threshold, label: "threshold", onChange: /* @r2fn R2-C0059-F00024 */v => { pendingThresholds[cur] = +v.toPrecision(3); $("q-thr").value = pendingThresholds[cur]; pendingSettings(); } };
    if ($("q-temp").checked) opt.y2 = { series: [{ x, y: bt.T }], label: "block at reading (°C)", lim: [Math.min(...bt.T.filter(isFinite)) - 1.5, Math.max(...bt.T.filter(isFinite)) + 1.5] };
    const c = R2.chart($("q-amp"), opt); c.tag = "amp"; charts.push(c);
    $("q-amp-unit").textContent = `${GP().name(cur)} · channel ${ev.assays[cur].channel + 1} · threshold: ${a.thresholdSource.replace(/^automatic: /, "automatic, ")}`;
  }
  /* @r2fn R2-C0059-F00025 */function drawPlate() {
    const a = res.amp;
    const cols = R2.PLATE.cols; let h = `<span class="ph"></span>` + Array.from({ length: cols }, /* @r2fn R2-C0059-F00026 */(_, c) => R2.plateAxis("col", c, c + 1)).join("");
    run.plate.forEach(/* @r2fn R2-C0059-F00027 */(W, i) => { if (i % cols === 0) h += R2.plateAxis("row", i / cols, String.fromCharCode(65 + i / cols)); const here = pl[i].role !== "empty", aw = a && here ? a.wells[i] : null;
      h += `<button type="button" class="w384 ${here ? pl[i].role : "empty"}${here && vis(i) ? "" : " off"}" data-w="${i}" ${here ? "" : "disabled"} aria-pressed="${here && vis(i)}" title="${R2.esc([R2.wellName(i), W.role === "empty" ? "empty" : (W.label || W.sampleName || W.sample) + (W.ext ? " · E" + W.ext + " · R" + W.rep : ""), here ? (aw && aw.cq !== null ? "Cq " + aw.cq.toFixed(2) : "no Cq") : W.role === "empty" ? "" : "other assay"].filter(Boolean).join(" · "))}" ${here ? `style="box-shadow:inset 0 -3px 0 ${R2.wellColor(pl, i)}"` : ""}>${here ? W.sampleNo || W.ctl || "" : ""}</button>`; });
    $("q-plate").innerHTML = h;
    $("q-chips").innerHTML = [["standard", "calibrants"], ["unknown", "sample"], ["positive", "positive"], ["ntc", "no template"]].filter(/* @r2fn R2-C0059-F00028 */r => pl.some(/* @r2fn R2-C0059-F00029 */w => w.role === r[0])).map(/* @r2fn R2-C0059-F00030 */r => `<button type="button" data-r="${r[0]}" aria-pressed="${!roleOff.has(r[0])}">${r[1]}</button>`).join("");
    $("q-plate-for").textContent = GP().name(cur) + " · " + pl.filter(/* @r2fn R2-C0059-F00031 */(w, i) => vis(i)).length + " wells shown";
  }
  /* @r2fn R2-C0059-F00032 */function drawMelt() {
    charts = charts.filter(/* @r2fn R2-C0059-F00033 */c => c.tag !== "melt");
    if (!res.melt || !M(cur).sybr) { $("q-melt").innerHTML = `<p class="note">${M(cur).sybr ? "The programme had no melt stage." : "Probe-based assay: a melt curve says nothing here, because the signal comes from cut probe."}</p>`; return; }
    const ws = res.melt.wells.filter(/* @r2fn R2-C0059-F00034 */w => w.t && vis(w.well));
    const c = R2.chart($("q-melt"), { series: ws.map(/* @r2fn R2-C0059-F00035 */w => ({ key: w.well, x: w.t, y: w.d, color: R2.wellColor(pl, w.well), width: 1.4, card: /* @r2fn R2-C0059-F00036 */() => card(w.well) })), markers: ws.filter(/* @r2fn R2-C0059-F00037 */w => w.peaks[0]).map(/* @r2fn R2-C0059-F00038 */w => ({ x: w.peaks[0].tm, y: Math.max(...w.d.filter(isFinite)), color: R2.wellColor(pl, w.well), key: w.well })), xlab: "temperature at each tube's own reading (°C)", ylab: "−dF/dT", height: 260, xshort: "°C", highlight: hoverKey, onHover: setHover });
    c.tag = "melt"; charts.push(c);
  }
  /* @r2fn R2-C0059-F00039 */function redraw() { drawPlate(); drawAmp(); drawMelt(); }
  const cqs = /* @r2fn R2-C0059-F00040 */a => a.map(/* @r2fn R2-C0059-F00041 */v => v === null ? "–" : v.toFixed(2)).join(" / ") || "–";
  /* @r2fn R2-C0059-F00042 */function drawResult() {
    const g = run.gmo, pill = /* @r2fn R2-C0059-F00043 */(cls, t) => `<span class="pill ${cls}">${t}</span>`;
    const sn = (evAll.samples || []).find(/* @r2fn R2-C0059-F00044 */x => x.no === sampleNo); $("q-stage").textContent = { screen: "screening", ident: "identification", quant: "quantification" }[g.stage] + " · sample " + (sn ? sn.no + " " + sn.name : g.sample) + " · " + g.ng + " ng per well";
    $("q-gmo").innerHTML = `<tr><th class="l">Assay</th><th class="l">Method</th><th>Sample Cq</th><th>Positive Cq</th><th class="l">No template</th><th class="l">Controls</th><th class="l">Sample</th></tr>` + ev.order.map(/* @r2fn R2-C0059-F00045 */id => { const r = ev.assays[id];
      return `<tr><td class="l">${R2.esc(r.name)}</td><td class="l">${id}</td><td>${cqs(r.sampleCq)}</td><td>${cqs(r.pcCq)}</td><td class="l">${!r.ntcPresent ? "missing" : r.ntcOk ? "clean" : "amplified"}</td><td class="l">${pill(r.valid ? "ok" : "bad", r.valid ? "valid" : "not valid")}</td><td class="l">${r.reported === "not reported" ? pill("off", r.reported) : r.reported === "detected" ? pill("warn", "detected") : r.reported === "not detected" ? pill("ok", "not detected") : pill("off", R2.esc(r.reported))}</td></tr>`; }).join("");
    const more = [];
    if (ev.lab) {
      const L = ev.lab, pill2 = /* @r2fn R2-C0059-F00046 */c => c === "detected" ? pill("warn", "detected") : c === "not detected" ? pill("ok", "not detected") : c === "below the limit of detection" ? pill("off", "below LOD") : pill("bad", c);
      more.push(`<h4 style="margin:4px 0">${R2.esc(R2.LAB[g.lab].title)} <small>Cq: second-derivative maximum</small></h4><div class="scroll"><table><tr><th class="l">Element</th><th>PC at LOD, mean Cq</th><th>Sample, mean Cq</th><th class="l">Call</th></tr>${Object.values(L.elements).map(/* @r2fn R2-C0059-F00047 */e => `<tr><td class="l">${R2.esc(e.name)}</td><td>${e.lodMeanCq === null ? "–" : e.lodMeanCq.toFixed(2)}</td><td>${e.sampleMeanCq === null ? "no amplification" : e.sampleMeanCq.toFixed(2)}</td><td class="l">${pill2(e.call)}</td></tr>`).join("")}</table></div>
        <dl class="kv"><dt>Result</dt><dd><b>${R2.esc(L.overall)}</b></dd><dt>Run validity</dt><dd>${L.valid ? pill("ok", "valid") : pill("bad", "not valid")} PC at LOD mean Cq ${L.rules.lod[0]}–${L.rules.lod[1]}; NTC and extraction blank clean; positive sample amplified</dd><dt>Sample DNA</dt><dd>${L.dnaAccepted ? pill("ok", "accepted") : pill("bad", "not accepted")} ${L.dna && L.dna.meanCq !== null ? "reference gene mean Cq " + L.dna.meanCq.toFixed(2) + " (accepted " + L.rules.taxon[0] + "–" + L.rules.taxon[1] + ")" : "reference gene not amplified"}</dd></dl>`);
    }
    if (g.stage === "screen" && ev.candidates) {
      const grp = /* @r2fn R2-C0059-F00048 */s => ev.candidates.filter(/* @r2fn R2-C0059-F00049 */c => c.status === s).map(/* @r2fn R2-C0059-F00050 */c => `${c.event}${c.via.length ? " (" + c.via.join(", ") + (c.proxy ? "; P-35S coverage uses a proxy" : "") + ")" : ""}`).join("; ") || "none";
      more.push(`<dl class="kv"><dt>Events still possible</dt><dd>${grp("possible")}</dd><dt>Excluded by a negative element</dt><dd>${grp("excluded")}</dd><dt>Open: an assay was not valid</dt><dd>${grp("unresolved")}</dd><dt>Not covered by these assays</dt><dd>${grp("not covered")}</dd></dl>`,
        `<small>Element content of each event: JRC GMO-Matrix predictions. "Possible" means every tested element that the event carries was found, not that the event is present. Only the events with a method on this bench are listed. ${R2.esc(ev.screeningAssumption || "")}</small>`);
    }
    if (ev.mara) {
      const m = ev.mara, fmt = /* @r2fn R2-C0059-F00051 */value => Number.isFinite(value) ? value.toFixed(2) : "–";
      const controls = Object.entries(m.controls).flatMap(/* @r2fn R2-C0059-F00052 */([id, checks]) => Object.entries(checks).map(/* @r2fn R2-C0059-F00053 */([ctl, c]) =>
        `<tr><td class="l">${id}</td><td>${ctl}</td><td>${c.count}/${c.ws.length}</td><td>${fmt(c.meanCq)}</td><td>${c.accepted ? "accepted" : "failed"}</td></tr>`));
      more.push(`<h4>${R2.esc(m.decisionStandard || m.standard)} · ${R2.esc(m.event)} / ${R2.esc(m.reference)}</h4>
        <p><b>${R2.esc(m.statement)}</b></p>
        ${m.targets?.length ? `<div class="scroll"><table><tr><th>Marker</th><th>Result</th><th>E1–E3 calls</th></tr>
          ${m.targets.map(/* @r2fn R2-C0059-F00054 */t => `<tr><td>${R2.esc(t.target)}</td><td>${R2.esc(t.call)}</td><td>${R2.esc(t.extractions.map(/* @r2fn R2-C0059-F00055 */x => x.call).join(" / "))}</td></tr>`).join("")}</table></div>` : ""}
        ${m.evidence.length ? `<div class="scroll"><table><tr><th>Extract</th><th>Reference Cq</th><th>Event Cq</th><th>Amplified event wells</th><th>Call</th><th>ΔCt</th><th>Copy ratio %</th></tr>
        ${m.evidence.map(/* @r2fn R2-C0059-F00056 */x => `<tr><td>E${x.ext}</td><td>${fmt(x.referenceCq)}</td><td>${fmt(x.eventCq)}</td><td>${x.eventDetected}/3</td><td>${R2.esc(x.call)}</td><td>${fmt(x.deltaCt)}</td><td>${fmt(ev.gmPct !== undefined ? x.diagnosticPct : null)}</td></tr>`).join("")}</table></div>` : ""}
        ${m.deltaDeltaCt !== undefined ? `<p>ΔCt sample ${fmt(m.sampleDeltaCt)} · ΔCt control ${fmt(m.controlDeltaCt)} · ΔΔCt ${fmt(m.deltaDeltaCt)}</p>` : ""}
        ${m.extractionStats ? `<p>Range-based extraction RSD ${fmt(m.extractionStats.rsdPct)} %</p>` : ""}
        ${m.quantitativeControl ? `<p>Quantitative control ${fmt(m.quantitativeControl.mean)} % · relative bias ${fmt(m.quantitativeControl.biasPct)} % · RSD ${fmt(m.quantitativeControl.rsdPct)} %</p>` : ""}
        <div class="scroll"><table><tr><th class="l">Assay</th><th>Control</th><th>Amplified</th><th>Mean Cq</th><th>Check</th></tr>${controls.join("")}</table></div>`);
    }
    if (g.stage === "quant" && !ev.mara) {
      const e = ev.event, t = ev.taxon, curve = /* @r2fn R2-C0059-F00057 */r => r && r.curve ? `slope ${r.curve.slope.toFixed(2)}, efficiency ${(r.curve.efficiency * 100).toFixed(0)} %, R² ${r.curve.r2.toFixed(4)} ${r.curveOk ? "" : "(outside acceptance)"}` : "none";
      more.push(`<dl class="kv"><dt>GM content of the sample</dt><dd><b>${ev.gmPct === undefined ? ev.quantStatus || "inconclusive" : ev.gmPct.toFixed(2) + " %"}</b>${ev.gmPctEach ? " (replicates " + ev.gmPctEach.map(/* @r2fn R2-C0059-F00058 */v => v.toFixed(2)).join(", ") + " %)" : ""}, ${e ? R2.esc(e.name) : ""} copies per reference-gene copy</dd>
        ${ev.gmPct === undefined && ev.diagnosticGmPct !== undefined ? `<dt>Diagnostic estimate</dt><dd>${ev.diagnosticGmPct.toFixed(2)} % (withheld from result)</dd>` : ""}<dt>Control with 1 % event</dt><dd>${ev.controlPct === undefined ? "–" : ev.controlPct.toFixed(2) + " %"}</dd><dt>Calibration, event assay</dt><dd>${curve(e)}</dd><dt>Calibration, reference gene</dt><dd>${curve(t)}</dd>
        <dt>Method's reported limits</dt><dd>${e ? R2.esc(M(e.id).lod || "not given") : ""}</dd>${ev.byExtraction ? `<dt>Per extraction</dt><dd>${ev.byExtraction.map(/* @r2fn R2-C0059-F00059 */x => "E" + x.ext + ": " + (x.gmPct === null ? "–" : x.gmPct.toFixed(2) + " %")).join(" · ")}${ev.extractionStats ? ` · mean ${ev.extractionStats.mean.toFixed(2)} %, RSD ${ev.extractionStats.rsdPct.toFixed(0)} %` : ""}</dd>` : ""}</dl>`, `<small>${R2.esc((g.notes || []).join(" "))} The result carries the model's scatter only; it has no measurement uncertainty statement.</small>`);
    }
    $("q-gmo-more").innerHTML = more.join(""); $("q-truth").innerHTML = "";
  }
  let sampleNo = 1, evAll = null;
  /* @r2fn R2-C0059-F00060 */function sampleSummary() {
    const L = evAll.samples || []; $("q-sample-wrap").hidden = L.length < 2;
    $("q-sample").innerHTML = L.map(/* @r2fn R2-C0059-F00061 */x => `<option value="${x.no}">${x.no} · ${R2.esc(run.samples?.find(/* @r2fn R2-C0059-F00062 */sample => sample.no === x.no)?.label || x.name)}</option>`).join(""); $("q-sample").value = sampleNo;
    const cell = /* @r2fn R2-C0059-F00063 */e => e.mara ? R2.esc(e.mara.statement) : e.lab ? R2.esc(e.lab.overall) : e.stage === "quant" ? (e.gmPct !== undefined ? e.gmPct.toFixed(2) + " %" : e.quantStatus || "inconclusive") + (e.extractionStats ? ` (extractions ${e.byExtraction.map(/* @r2fn R2-C0059-F00064 */x => x.gmPct === null ? "–" : x.gmPct.toFixed(2)).join(" / ")}; RSD ${e.extractionStats.rsdPct.toFixed(0)} %)` : "") : e.order.filter(/* @r2fn R2-C0059-F00065 */id => e.assays[id].kind !== "taxon").map(/* @r2fn R2-C0059-F00066 */id => e.assays[id].name + ": " + e.assays[id].reported).join("; ");
    $("q-samples").innerHTML = `<tr><th>No.</th><th class="l">Sample</th><th class="l">Result</th><th class="l">Checks</th></tr>` + L.map(/* @r2fn R2-C0059-F00067 */x => `<tr class="${x.no === sampleNo ? "cur" : ""}"><td>${x.no}</td><td class="l"><b>${R2.esc(run.samples?.find(/* @r2fn R2-C0059-F00068 */sample => sample.no === x.no)?.label || x.name)}</b></td><td class="l">${cell(x.ev)}</td><td class="l">${x.ev.findings.filter(/* @r2fn R2-C0059-F00069 */f => f.level === "fail" || f.level === "warn").length || "none"}</td></tr>`).join("");
  }
  /* @r2fn R2-C0059-F00070 */function analyse() {
    evAll = R2.gmoeval.run(run, { cqMethod: appliedMethod, thresholds });
    ev = ((evAll.samples || []).find(/* @r2fn R2-C0059-F00071 */x => x.no === sampleNo) || { ev: evAll }).ev; sampleSummary(); if (!ev.assays[cur]) cur = ev.order.find(/* @r2fn R2-C0059-F00072 */id => M(id).kind !== "taxon") || ev.order[0];
    const r = ev.assays[cur]; res = r.one.res; pl = $("q-all-samples").checked ? run.plate.map(/* @r2fn R2-C0059-F00073 */(w, i) => w.t.some(/* @r2fn R2-C0059-F00074 */t => t.m === cur) ?
      { ...r.one.view[i], role: w.role, sample: w.sample } : r.one.view[i]) : r.one.view; $("q-assay").value = cur; $("q-thr").value = Object.hasOwn(pendingThresholds, cur) ? (pendingThresholds[cur] || "") : (thresholds[cur] || "");
    const a = res.amp, tm = run.record.telemetry, dur = tm.length ? tm[tm.length - 1].t_ms / 1000 : 0;
    $("q-run").innerHTML = `<dt>Run</dt><dd>${R2.esc(run.name || run.runId)}</dd><dt>Run at</dt><dd>${run.time ? new Date(run.time).toLocaleString() : "–"}</dd><dt>Instrument</dt><dd>${run.serial} (simulated), seed ${run.seed}</dd><dt>Source</dt><dd>${run.imported ? "imported workbench RDMLt" : run.live ? "run on the technician bench" : "example record, computed at once"}</dd><dt>Programme</dt><dd>${R2.esc(run.protocol.name)}</dd><dt>Instrument time</dt><dd>${R2.hms(dur)}</dd><dt>Outcome</dt><dd>${R2.esc(run.outcome)}</dd><dt>Records</dt><dd>${tm.length} thermal, ${run.record.optical.length} optical, ${run.record.events.length} events</dd>`;
    const lv = { fail: "bad", warn: "warn", info: "off" };
    $("q-flags").innerHTML = ev.findings.length ? ev.findings.map(/* @r2fn R2-C0059-F00075 */f => `<div class="flag"><span class="pill ${lv[f.level]}">${f.level === "fail" ? "fail" : f.level === "warn" ? "check" : "note"}</span><span>${R2.esc(f.text)}</span></div>`).join("") : `<div class="flag"><span class="pill ok">clear</span><span>No evaluation rule was triggered.</span></div>`;
    $("q-plate-leg").innerHTML = `<small>Colour dots match the curves. Orange: sample, purple: positive control, green: no-template control, blue: calibrants.</small>`;
    drawResult(); redraw();
    const sc = res.sc;
    if (sc && sc.available) {
      const unk = a.wells.filter(/* @r2fn R2-C0059-F00076 */w => (w.role === "unknown" || w.role === "positive") && w.quantity > 0 && w.cq !== null), xs = [sc.range[0] - 0.3, sc.range[1] + 0.3];
      R2.chart($("q-sc"), { series: [{ x: xs, y: xs.map(/* @r2fn R2-C0059-F00077 */x => sc.intercept + sc.slope * x), color: "var(--muted)", label: "fit", width: 1.3 }, { x: sc.points.map(/* @r2fn R2-C0059-F00078 */p => p.lq), y: sc.points.map(/* @r2fn R2-C0059-F00079 */p => p.cq), color: "var(--s1)", label: "calibrant", points: true }, { x: unk.map(/* @r2fn R2-C0059-F00080 */w => Math.log10(w.quantity)), y: unk.map(/* @r2fn R2-C0059-F00081 */w => w.cq), color: "var(--s2)", label: "sample and control", points: true }], xlab: "log10 copies", ylab: "Cq", height: 240 });
      $("q-sc-kv").innerHTML = `<dt>Slope</dt><dd>${sc.slope.toFixed(3)}</dd><dt>Efficiency</dt><dd>${(sc.efficiency * 100).toFixed(1)} %</dd><dt>R²</dt><dd>${sc.r2.toFixed(4)}</dd><dt>Acceptance</dt><dd>slope −3.1 to −3.6, R² ≥ 0.98 (ENGL minimum performance requirements)</dd>`;
    } else { $("q-sc").innerHTML = `<p class="note">${run.gmo.stage === "quant" ? "No calibration curve for this assay." : "Qualitative run: no calibrants on the plate."}</p>`; $("q-sc-kv").innerHTML = ""; }
    $("q-table").innerHTML = `<tr><th class="l">Tube</th><th class="l">Content</th><th class="l">Role</th><th>Cq</th><th>Cq threshold</th><th>Cy0</th><th>Copies</th><th>Tm °C</th><th class="l">Notes</th></tr>` + pl.map(/* @r2fn R2-C0059-F00082 */(w, i) => {
      if (w.role === "empty") return ""; const aw = a ? a.wells[i] : {}, mw = res.melt && M(cur).sybr ? res.melt.wells[i] : { peaks: [] }, notes = [];
      if (a && aw.cq === null) notes.push(String(aw.cqReason).replace(/_/g, " ")); if (aw.extrapolated) notes.push("outside calibrated range"); if (aw.saturated) notes.push("saturated"); if (mw.peaks.length > 1) notes.push(mw.peaks.length + " melt peaks");
      return `<tr><td class="l">${R2.wellName(i)}</td><td class="l" title="${R2.esc(run.plate[i].material || "")}">${R2.esc(run.plate[i].label ? run.plate[i].label + " · E" + run.plate[i].ext + " / R" + run.plate[i].rep : w.sample)}</td><td class="l">${w.role}</td><td>${R2.fmt(aw.cq)}</td><td>${R2.fmt(aw.cqThreshold)}</td><td>${R2.fmt(aw.cqCy0)}</td><td>${aw.quantity ? R2.sci(aw.quantity) : "–"}</td><td>${mw.peaks[0] ? mw.peaks[0].tm.toFixed(1) : "–"}</td><td class="l">${R2.esc(notes.join("; "))}</td></tr>`; }).join("");
    const th = res.thermal;
    $("q-thermal").innerHTML = th.holdErrMax === undefined ? `<dt>Holds</dt><dd>none recorded</dd>` : `<dt>Largest hold error</dt><dd>${th.holdErrMax.toFixed(2)} °C (RMS ${th.holdErrRms.toFixed(2)} °C)</dd><dt>Largest zone difference in holds</dt><dd>${th.zoneDiffMax.toFixed(2)} °C</dd><dt>Highest block temperature</dt><dd>${th.blockMax.toFixed(2)} °C</dd><dt>Scale</dt><dd>block sensor, not sample temperature</dd>`;
    if (run.gmo.stage === "screen" && ev.candidates) R2.session.screen = { crop: run.gmo.crop, candidates: ev.candidates };
  }
  /* @r2fn R2-C0059-F00083 */function ensurePkg() { if (!pkg) { pkg = R2.runPackage(run); $("q-prov").innerHTML = `<dt>Manifest SHA-256</dt><dd>${pkg.manifestSha256}</dd>`; } return pkg; }
  /* @r2fn R2-C0059-F00084 */function load(r) {
    run = r; R2.session.run = r; document.dispatchEvent(new Event("r2-quality-run")); pkg = null; shown = r; sampleNo = 1; selected = null; selection?.reset(); roleOff = new Set(); hoverKey = null; charts = []; thresholds = {}; cur = null;
    $("q-body").hidden = false; list(); $("q-prov").innerHTML = `<dt>Manifest SHA-256</dt><dd>computed when a file is exported</dd>`;
    $("q-method").disabled = !!run.gmo.mara;
    $("q-method").value = run.gmo.lab && R2.LAB[run.gmo.lab] ? R2.LAB[run.gmo.lab].rules.cqMethod : "threshold";
    appliedMethod = $("q-method").value; pendingThresholds = {}; $("q-apply-settings").disabled = true; $("q-settings-status").textContent = "";
    const ids = R2.gmoeval.assays(run); $("q-assay").innerHTML = ids.map(/* @r2fn R2-C0059-F00085 */id => `<option value="${id}">${R2.esc(GP().name(id))}</option>`).join("");
    const s = run.gmo.settings || {}, d = R2.reagents.DEFAULT, ch = Object.keys(d).filter(/* @r2fn R2-C0059-F00086 */k => s[k] !== undefined && s[k] !== d[k]);
    $("q-settings").innerHTML = ch.length ? ch.map(/* @r2fn R2-C0059-F00087 */k => `<small>• ${LBL[k] || k}: ${R2.esc(String(s[k]))} (method: ${R2.esc(String(d[k]))})</small>`).join("") : `<small>As the method records state; reagents fresh, stored at −20 °C.</small>`;
    analyse();
  }
  /* @r2fn R2-C0059-F00088 */function list() {
    const runs = (R2.session.runs || []).slice(), o = $("q-sort").value; runs.sort(/* @r2fn R2-C0059-F00089 */(a, b) => o === "name" ? a.name.replace(/^\d+_/, "").localeCompare(b.name.replace(/^\d+_/, "")) || a.no - b.no : o === "timeasc" ? a.no - b.no : b.no - a.no);
    $("q-files-n").textContent = runs.length ? runs.length + " run" + (runs.length > 1 ? "s" : "") : "none yet"; $("q-bulk").disabled = $("q-bulk-rdmlt").disabled = !runs.length; $("q-bulk-sop").disabled = !runs.length && !(R2.session.imports || []).some(/* @r2fn R2-C0059-F00090 */it => it.kind);
    $("q-list").innerHTML = runs.length ? `<tr><th>No.</th><th class="l">Name</th><th class="l">Run at</th><th class="l">Step</th><th class="l">Sample</th><th class="l">Outcome</th><th class="l">SOP</th><th class="l">Files</th></tr>` + runs.map(/* @r2fn R2-C0059-F00091 */r => `<tr class="${r === run ? "cur" : ""}"><td>${r.no}</td><td class="l"><b>${R2.esc(r.name)}</b>${r.injectedFault ? `<small>Training scenario: ${R2.esc(r.injectedFault.title)} · ${R2.esc(r.injectedFault.kind)}</small>` : ""}</td><td class="l">${new Date(r.time).toLocaleString()}</td><td class="l">${{ screen: "screening", ident: "identification", quant: "quantification" }[r.gmo.stage]}</td><td class="l">${R2.esc(r.gmo.sample)}</td><td class="l">${R2.esc(r.outcome)}</td><td class="l"><code>${R2.sop.idOfRun(r)}</code></td>
      <td class="l"><span class="row" style="gap:6px"><button data-open="${r.no}">${r === run ? "Shown below" : "Open"}</button><button data-zip="${r.no}">Files (.zip)</button><button data-sop="${r.no}">SOP (.json)</button></span></td></tr>`).join("") : `<tr><td class="l">No run yet. Run one on the technician bench, or add an example run.</td></tr>`;
  }
  const byNo = /* @r2fn R2-C0059-F00092 */n => (R2.session.runs || []).find(/* @r2fn R2-C0059-F00093 */r => r.no === +n), fname = /* @r2fn R2-C0059-F00094 */r => r.name.replace(/[^A-Za-z0-9_-]/g, "_");
  /* @r2fn R2-C0059-F00095 */function example() {
    $("q-example").disabled = true; $("q-exprog").hidden = false;
    const smp = [0, 0].map(/* @r2fn R2-C0059-F00096 */() => JSON.parse(JSON.stringify(R2.GMO.samples[0]))), plan = GP().plate(smp[0], { stage: "quant", assays: ["QT-EVE-GM-005"], samples: smp }), f = GP().fields(plan.tubes).f, prog = GP().protocol(f, "EURL GMFF: QT-EVE-GM-005, QT-TAX-GM-002"), ins = new R2.Instrument(7, GP().INSTRUMENT), est = R2.planProfile(prog).total;
    const no = R2.session.runNo = (R2.session.runNo || 0) + 1, name = String(no).padStart(3, "0") + "_example_quantification_40-3-2";
    const identity = R2.materials.next(), today = new Date().toISOString().slice(0, 10), assigned = R2.materials.assign(plan, identity, smp.map(/* @r2fn R2-C0059-F00097 */() => ({ extractionDate: today })), {}, "soybean");
    const simulationSetup = GP().simWells(plan, {}, f, 7, { runIndex: no });
    ins.plant.Tamb = 22; ins.setPlate(simulationSetup.wells); ins.fw.start(prog, name);
    const loop = /* @r2fn R2-C0059-F00098 */() => { const t0 = Date.now(); while (Date.now() - t0 < 40 && ins.fw.running()) ins.advance(500); $("q-exprog").value = Math.min(1, ins.plant.t / 1000 / est);
      if (ins.fw.running()) setTimeout(loop, 0); else { ins.advance(300); const r = { runId: name, no, name, time: new Date().toISOString(), serial: "SIM-0384", seed: 7, operator: "example", live: false, outcome: ins.rec.events.some(/* @r2fn R2-C0059-F00099 */e => e.code === "RUN_COMPLETE") ? "completed" : "aborted", protocol: prog, record: ins.rec, chemLog: ins.chemLog,
        startedAt: identity.createdAt, prefix: identity.prefix, samples: assigned.samples, simulationSetup, firmwareConfiguration: { ...ins.fw.cfg, wells: 384, optics: "camera, whole plate per exposure", opticsSeed: ins.plant.opticsSeed, cameraReporter: R2.Plant.CAMERA_REPORTER_MODEL },
        sampleIdentity: { id: "RUN-" + identity.uid, name: assigned.samples.map(/* @r2fn R2-C0059-F00100 */x => x.name).join(", "), prefix: identity.prefix, createdAt: identity.createdAt, mode: "prefix-number-date", samples: assigned.samples },
        plate: assigned.wells,
        gmo: { stage: "quant", crop: "soybean", sample: assigned.samples.map(/* @r2fn R2-C0059-F00101 */x => x.name).join(", "), samplePreset: smp[0].label, ng: plan.ng, pcNg: plan.pcNg, dna: { ...GP().DNA }, settings: Object.assign({}, R2.reagents.DEFAULT), fields: f, calPct: plan.calPct, notes: plan.notes, layout: plan.capacity, truth: { events: smp[0].events, frag: smp[0].frag, inhibitor: smp[0].inhibitor } } };
        (R2.session.runs = R2.session.runs || []).push(r); R2.session.run = r; $("q-example").disabled = false; $("q-exprog").hidden = true; load(r); } };
    loop();
  }
  R2.ui.quality = { show/* @r2fn R2-C0059-F00102 */() {
    if (!inited) {
      inited = true;
      $("q-method").addEventListener("change", pendingSettings);
      $("q-apply-settings").onclick = /* @r2fn R2-C0059-F00103 */() => {
        appliedMethod = $("q-method").value;
        thresholds = { ...thresholds, ...pendingThresholds };
        for (const key of Object.keys(thresholds)) if (!(thresholds[key] > 0)) delete thresholds[key];
        pendingThresholds = {}; analyse();
        $("q-apply-settings").disabled = true; $("q-settings-status").textContent = "Analysis settings applied.";
      };
      $("q-sample").addEventListener("change", /* @r2fn R2-C0059-F00104 */() => { sampleNo = +$("q-sample").value; selected = null; selection.reset(); analyse(); });
      $("q-assay").addEventListener("change", /* @r2fn R2-C0059-F00105 */() => { cur = $("q-assay").value; selected = null; selection?.reset(); roleOff = new Set(); analyse(); });
      $("q-thr").addEventListener("input", /* @r2fn R2-C0059-F00106 */() => { const v = +$("q-thr").value; pendingThresholds[cur] = v > 0 ? v : null; pendingSettings(); });
      ["q-view", "q-scale", "q-bands", "q-temp"].forEach(/* @r2fn R2-C0059-F00107 */id => $(id).addEventListener("change", /* @r2fn R2-C0059-F00108 */() => run && drawAmp()));
      selection = R2.selectPlate($("q-plate"), /* @r2fn R2-C0059-F00109 */w => pl?.[w]?.role !== "empty" && !!pl?.[w], /* @r2fn R2-C0059-F00110 */(wells, focus) => {
        selected = wells;
        setHover(null);
        redraw();
        if (focus !== undefined) $("q-plate").querySelector(`[data-w="${focus}"]`)?.focus({ preventScroll: true });
      });
      $("q-select-all").onclick = /* @r2fn R2-C0059-F00111 */() => selection.all();
      $("q-select-clear").onclick = /* @r2fn R2-C0059-F00112 */() => selection.clear();
      $("q-all-samples").onchange = /* @r2fn R2-C0059-F00113 */() => { selected = null; selection.reset(); analyse(); };
      $("q-plate").onmouseover = /* @r2fn R2-C0059-F00114 */e => { const b = e.target.closest("[data-w]"); setHover(b && !b.disabled ? +b.dataset.w : null); };
      $("q-plate").onmouseleave = /* @r2fn R2-C0059-F00115 */() => setHover(null);
      $("q-chips").onclick = /* @r2fn R2-C0059-F00116 */e => { const b = e.target.closest("[data-r]"); if (!b) return; const r = b.dataset.r; roleOff.has(r) ? roleOff.delete(r) : roleOff.add(r); redraw(); };
      $("q-reveal").onclick = /* @r2fn R2-C0059-F00117 */() => { const t = run.gmo.truth.samples?.[sampleNo - 1] || run.gmo.truth, e = Object.keys(t.events); $("q-truth").innerHTML = `<p class="note">Put into the simulated sample: ${e.length ? e.map(/* @r2fn R2-C0059-F00118 */k => `${k} ${t.events[k]} %`).join(", ") : "no GM event"}; mean DNA fragment ${t.frag} bp; inhibitor carry-over ${t.inhibitor}. This is the model's input, known only because the sample is simulated.</p>`; };
      $("q-example").onclick = example; $("q-sort").onchange = list;
      $("q-list").onclick = /* @r2fn R2-C0059-F00119 */e => { const b = e.target.closest("button"); if (!b) return; const d = b.dataset, r = byNo(d.open || d.zip || d.sop); if (!r) return;
        if (d.open) load(r); else if (d.sop) R2.download(R2.sop.idOfRun(r) + ".json", R2.sopJson(r), "application/json"); else R2.downloadAsync(b, fname(r) + "_files.zip", /* @r2fn R2-C0059-F00120 */async () => R2.zip(await R2.runFiles(r, R2.gmoeval.run(r, { cqMethod: "auto", thresholds: {} })))); };
      $("q-bulk").onclick = /* @r2fn R2-C0059-F00121 */() => R2.downloadAsync($("q-bulk"), "MISSY_R2_runs_" + new Date().toISOString().slice(0, 10) + ".zip", /* @r2fn R2-C0059-F00122 */() => R2.bulkZip(R2.session.runs));
      $("q-bulk-rdmlt").onclick = /* @r2fn R2-C0059-F00123 */() => R2.downloadAsync($("q-bulk-rdmlt"), "MISSY_R2_RDMLt_" + new Date().toISOString().slice(0, 10) + ".zip", /* @r2fn R2-C0059-F00124 */() => R2.bulkRdmlt(R2.session.runs));
      $("q-bulk-sop").onclick = /* @r2fn R2-C0059-F00125 */() => R2.downloadAsync($("q-bulk-sop"), "MISSY_R2_SOPs_" + new Date().toISOString().slice(0, 10) + ".zip", /* @r2fn R2-C0059-F00126 */() => R2.sop.zip((R2.session.runs || []).concat(R2.importSopItems ? R2.importSopItems() : [])));
      $("q-missy-sop").onclick = /* @r2fn R2-C0059-F00127 */() => R2.download(R2.sop.idOfRun(run) + "_MISSY.sop.json", R2.missySopForRun(run), "application/json");
      $("q-sop").onclick = /* @r2fn R2-C0059-F00128 */() => R2.download(R2.sop.idOfRun(run) + ".json", R2.sopJson(run), "application/json");
      const base = /* @r2fn R2-C0059-F00129 */() => (run.name || run.runId).replace(/[^A-Za-z0-9_-]/g, "_");
      $("q-rdmlt").onclick = /* @r2fn R2-C0059-F00130 */() => R2.downloadAsync($("q-rdmlt"), base() + ".rdmlt", /* @r2fn R2-C0059-F00131 */() => R2.rdmltCompressed(run, evAll));
      $("q-rdml").onclick = /* @r2fn R2-C0059-F00132 */() => { ensurePkg(); R2.download(base() + ".rdml", R2.rdmlBlob(run, evAll)); };
      $("q-csv").onclick = /* @r2fn R2-C0059-F00133 */() => R2.download(base() + "_wells.csv", R2.wellsCsv(run, evAll), "text/csv");
      $("q-pkg").onclick = /* @r2fn R2-C0059-F00134 */() => R2.download(base() + "_run_package.zip", ensurePkg().blob);
      $("q-json").onclick = /* @r2fn R2-C0059-F00135 */() => R2.download(base() + "_analysis.json", R2.analysisJson(run, evAll, ensurePkg().manifestSha256), "application/json");
    }
    if (R2.session.run && R2.session.run !== shown) load(R2.session.run); else list();
    if (R2.ui.qualityImport) R2.ui.qualityImport.show();
  } };
})(window.R2);
