/* Output files of the quality-manager bench: run package (raw record + tables + manifest), wells table, analysis summary. */
(function (R2) {
  "use strict";
  const csv = (cols, rows) => cols.join(",") + "\n" + rows.map(r => cols.map(c => { const v = r[c]; return v === null || v === undefined ? "" : (typeof v === "number" ? (Number.isInteger(v) ? v : +v.toFixed(4)) : /[",\r\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v); }).join(",")).join("\n") + "\n";
  // the record as the instrument would send it: one line per record, sequence number, CRC-16 (same framing as the firmware)
  R2.frames = function (rec) {
    const all = [];
    for (const r of rec.telemetry) all.push([r.seq, ["T", r.seq, r.t_ms, r.state, r.stage, r.step, r.cycle, Math.round(r.setpoint_c * 1000), Math.round(r.zone1_c * 1000), Math.round(r.zone2_c * 1000), Math.round(r.lid_c * 1000), Math.round(r.heatsink_c * 1000), Math.round(r.ref_c * 1000),
      Math.round(r.duty1 * 1000), Math.round(r.duty2 * 1000), Math.round(r.lid_duty * 1000), Math.round(r.fan_duty * 1000), Math.round(r.i_tec1_mA), Math.round(r.i_tec2_mA), r.fan_rpm, r.enable | (r.lid_closed << 1) | (r.hw_trip << 2) | (r.rails_ok << 3) | (r.optics_busy << 5)].join(",")]);
    for (const o of rec.optical) all.push([o.seq, ["O", o.seq, o.t_start_ms, o.t_end_ms, o.kind, o.acq, o.stage, o.step, o.cycle, o.well, o.channel, o.periods, o.sum_on, o.sum_off, o.sumsq_net, o.min_net, o.max_net, o.sat_samples, o.ref_sum_on, o.ref_sum_off, o.tzone_start_mC, o.tzone_end_mC].join(",")]);
    for (const v of rec.events) all.push([v.seq, ["E", v.seq, v.t_ms, v.code, v.severity, v.a, v.b].join(",")]);
    all.sort((a, b) => a[0] - b[0]);
    return all.map(x => R2.frame(x[1])).join("\n") + "\n";
  };
  // one row per tube and target; ev is the GMO evaluation (js/analysis/gmo.js)
  R2.wellsCsv = function (run, ev) {
    const rows = [], bySample = new Map((ev.samples || []).map(entry => [entry.no, entry.ev]));
    run.plate.forEach((W, i) => { for (const t of W.t || []) { const sampleEvaluation = bySample.get(W.sampleNo) || ev; const r = sampleEvaluation.assays[t.m], m = R2.GMO.methods[t.m], a = r.one.res.amp ? r.one.res.amp.wells[i] : {};
      rows.push({ well: i, position: R2.wellName(i), sample: W.sample, sample_no: W.sampleNo || null, sample_name: W.sampleName || null, sample_label: W.label || null, extraction_date: W.extractionDate || null, extraction: W.ext || null, pcr_replicate: W.rep || null, control: W.ctl && W.ctl !== "S" ? W.ctl : null, sample_id: W.sampleId, parent_sample_id: W.parentSampleId, reference_materials: W.stocks ? JSON.stringify(W.stocks) : null, role: W.role, sample_result: W.role === "unknown" ? r.reported : null, mara_status: W.role === "unknown" ? sampleEvaluation.mara?.status : null, material: W.material, method: t.m, target: r.name, channel: r.channel + 1, dye: m.P ? m.P[1] : "SYBR Green", cq: a.cq, cq_reason_if_none: a.cqReason, cq_threshold: a.cqThreshold, cq_cy0: a.cqCy0, copies_from_calibration: a.quantity, tm_c: r.tm[i] === undefined ? null : r.tm[i], saturated_samples: a.saturated }); } });
    return csv(["well", "position", "sample", "sample_no", "sample_name", "sample_label", "extraction_date", "extraction", "pcr_replicate", "control", "sample_id", "parent_sample_id", "reference_materials", "role", "sample_result", "mara_status", "material", "method", "target", "channel", "dye", "cq", "cq_reason_if_none", "cq_threshold", "cq_cy0", "copies_from_calibration", "tm_c", "saturated_samples"], rows);
  };
  R2.runPackage = function (run) {
    const rec = run.record, files = [];
    const add = (name, text) => files.push({ name, data: R2.utf8(text) });
    add("raw/frames.log", R2.frames(rec));
    add("input/protocol.json", JSON.stringify(run.protocol, null, 1)); add("input/plate.json", JSON.stringify(run.plate, null, 1));
    if (run.gmo) add("input/analysis_request.json", JSON.stringify({ step: run.gmo.stage, species: run.gmo.crop, sample: run.gmo.sample, sample_identity: run.sampleIdentity || null, dna_ng_per_tube: run.gmo.ng, dna_template: run.gmo.dna || null, natural_variation: run.simulationSetup && run.simulationSetup.variation || null, template: run.gmo.template || null, reagents_and_handling: run.gmo.settings, notes: run.gmo.notes, methods_source: R2.GMO.source }, null, 1));
    add("data/thermal.csv", csv(["t_ms", "state", "stage", "step", "cycle", "setpoint_c", "zone1_c", "zone2_c", "lid_c", "heatsink_c", "ref_c", "duty1", "duty2", "lid_duty", "fan_duty", "i_tec1_mA", "i_tec2_mA", "fan_rpm", "enable", "lid_closed", "hw_trip", "rails_ok", "optics_busy", "seq"], rec.telemetry));
    add("data/optical.csv", csv(["seq", "t_start_ms", "t_end_ms", "kind", "acq", "stage", "step", "cycle", "well", "channel", "periods", "sum_on", "sum_off", "sumsq_net", "min_net", "max_net", "sat_samples", "ref_sum_on", "ref_sum_off", "tzone_start_mC", "tzone_end_mC"], rec.optical));
    add("data/events.csv", csv(["t_ms", "code", "severity", "a", "b", "seq"], rec.events));
    add("run.json", JSON.stringify({ format: "missy-r2-workbench-run/0.1", notice: "Simulated instrument (browser port of the R2 models). Teaching data, research use only, not from a real instrument.", run_id: run.runId, serial: run.serial, seed: run.seed, operator: run.operator, outcome: run.outcome,
      records: rec.telemetry.length + rec.optical.length + rec.events.length, faults: rec.events.filter(v => v.severity >= 2).map(v => v.code), software: "MISSY R2 workbench " + R2.VERSION }, null, 1));
    const manifest = { format: "missy-r2-workbench-run/0.1", files: files.map(f => ({ path: f.name, bytes: f.data.length, sha256: R2.sha256(f.data) })) };
    add("manifest.json", JSON.stringify(manifest, null, 1));
    return { blob: R2.zip(files), manifestSha256: R2.sha256(files[files.length - 1].data) };
  };
  R2.analysisJson = function (run, ev, manifestSha) {
    const assays = ev.order.map(id => { const r = ev.assays[id], res = r.one.res, a = res.amp;
      return { method: id, target: r.name, kind: r.kind, channel: r.channel + 1, threshold: a ? a.threshold : null, threshold_source: a ? a.thresholdSource : null, cq_method: a ? a.cqMethod : null,
        controls: { no_template_present: r.ntcPresent, no_template_clean: r.ntcOk, positive_amplified: r.pcOk, valid: r.valid }, sample_result: r.reported, sample_cq: r.sampleCq, positive_cq: r.pcCq,
        calibration: r.curve ? { slope: r.curve.slope, intercept: r.curve.intercept, r2: r.curve.r2, efficiency: r.curve.efficiency, within_acceptance: r.curveOk } : null,
        wells: a ? a.wells.filter(w => run.plate[w.well].t.some(t => t.m === id)).map(w => ({ well: w.well, position: R2.wellName(w.well), role: w.role, sample: w.sample, cq: w.cq, cq_reason_if_none: w.cqReason, cq_threshold: w.cqThreshold, cq_cy0: w.cqCy0, copies_from_calibration: w.quantity === undefined ? null : w.quantity,
          baseline: w.baseline.error ? { error: w.baseline.error } : { window: w.baseline.window, intercept: w.baseline.intercept, slope: w.baseline.slope, residual_sd: w.baseline.residualSd }, saturated_samples: w.saturated, tm_c: r.tm[w.well] === undefined ? null : r.tm[w.well] })) : [] }; });
    return JSON.stringify({ format: "missy-r2-workbench-gmo-analysis/0.4", notice: "Research use only. Not validated. Simulated data.", run_id: run.runId, run_package_manifest_sha256: manifestSha, sop_id: R2.sop.idOfRun(run),
      sample_identity: run.sampleIdentity || null, step: ev.stage, species: run.gmo.crop, sample: run.gmo.sample, dna_ng_per_tube: run.gmo.ng, dna_template: run.gmo.dna || null, natural_variation: run.simulationSetup && run.simulationSetup.variation || null, template: run.gmo.template || null, reagents_and_handling: run.gmo.settings, methods_source: run.gmo.mara?.mode === "screen" ? R2.MARA.rapid.source : run.gmo.mara ? R2.MARA.scope : R2.GMO.source,
      mara: ev.mara || null, assays, findings: ev.findings, screening: ev.candidates ? { elements: ev.elements, events: ev.candidates, assumption: ev.screeningAssumption || null } : null,
      quantification: ev.stage === "quant" ? { status: ev.quantStatus || "inconclusive", diagnostic_gm_percent_copies: ev.diagnosticGmPct ?? null, gm_percent_copies: ev.gmPct === undefined ? null : ev.gmPct, replicates: ev.gmPctEach || null, control_1_percent_reads: ev.controlPct === undefined ? null : ev.controlPct, acceptance: "slope -3.1 to -3.6, R2 >= 0.98" } : null,
      samples: (ev.samples || []).map(x => ({ no: x.no, name: x.name, result: x.ev.mara ? x.ev.mara.status : x.ev.lab ? x.ev.lab.overall : x.ev.stage === "quant" ? x.ev.quantStatus : null, gm_percent_copies: x.ev.gmPct === undefined ? null : x.ev.gmPct,
        by_extraction: x.ev.byExtraction || null, extraction_statistics: x.ev.extractionStats || null, laboratory: x.ev.lab || null, mara: x.ev.mara || null,
        assays: x.ev.order.map(id => ({ method: id, sample_result: x.ev.assays[id].reported, by_extraction: (x.ev.assays[id].byExtraction || []).map(b => ({ extraction: b.ext, tubes: b.tubes, amplified: b.amplified, mean_cq: b.meanCq })) })), findings: x.ev.findings })),
      plate_format: { wells: run.plate.length, rows: R2.PLATE.rows, columns: R2.PLATE.cols, extractions_per_sample: 3, pcr_replicates_per_extraction: 3 }, run_prefix: run.prefix || null,
      thermal: ev.assays[ev.order[0]].one.res.thermal, software: "MISSY R2 workbench " + R2.VERSION }, null, 1);
  };
  // the run's SOP: one document per analysis, identity from the analysis definition (js/export/sop.js)
  R2.sopJson = run => R2.sop.jsonOfRun(run);
  // the files of one run, as bytes
  R2.runFiles = async function (run, ev) {
    const base = (run.name || run.runId).replace(/[^A-Za-z0-9_-]/g, "_"), sha = R2.runPackage(run).manifestSha256;
    return [{ name: base + ".rdmlt", data: await R2.rdmltCompressed(run, ev) }, { name: base + ".rdml", data: R2.zipBytes([{ name: "rdml_data.xml", data: R2.utf8(R2.rdmlXml(run, ev)) }]) }, { name: base + "_wells.csv", data: R2.utf8(R2.wellsCsv(run, ev)) }, { name: base + "_analysis.json", data: R2.utf8(R2.analysisJson(run, ev, sha)) }, { name: R2.sop.idOfRun(run) + ".json", data: R2.utf8(R2.sopJson(run)) }];
  };
  R2.bulkRdmlt = async runs => {
    const files = [];
    for (const run of runs.slice()) {
      const evaluation = R2.gmoeval.run(run, { cqMethod: "auto" });
      const name = run.runId.replace(/[^A-Za-z0-9_-]/g, "_") + ".rdmlt";
      files.push({ name, data: await R2.rdmltCompressed(run, evaluation) });
    }
    return R2.zip(files);
  };
  // all runs in one archive: one folder per run plus an index; sopOnly: only the JSON SOPs
  R2.bulkZip = async function (runs, sopOnly) {
    if (sopOnly) return R2.sop.zip(runs);
    const files = [], idx = [["number", "name", "finished", "step", "species", "sample", "outcome", "sop_id"].join(",")];
    for (const run of runs.slice()) { const base = (run.name || run.runId).replace(/[^A-Za-z0-9_-]/g, "_"); idx.push([run.no, base, run.time, run.gmo.stage, run.gmo.crop, '"' + run.gmo.sample.replace(/"/g, '""') + '"', run.outcome, R2.sop.idOfRun(run)].join(","));
      for (const f of await R2.runFiles(run, R2.gmoeval.run(run, { cqMethod: "auto", thresholds: {} }))) files.push({ name: base + "/" + f.name, data: f.data }); }
    files.push({ name: "runs_index.csv", data: R2.utf8(idx.join("\r\n") + "\r\n") }); return R2.zip(files);
  };
})(window.R2);
