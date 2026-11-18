/* MARA 1012 event qPCR and Standard 16 decisions on paired, per-well Cq observations. */
(function (R2) {
  "use strict";
  const M = R2.MARA, CUT = 36, F = 1.693, N = 3;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const detected = cq => Number.isFinite(cq) && cq <= CUT;
  const stats = values => {
    const avg = mean(values), sd = (Math.max(...values) - Math.min(...values)) / F;
    return { n: values.length, mean: avg, sd, rsdPct: 100 * sd / avg };
  };
  const band = difference => difference < -0.4 - 1e-10 ? "higher than comparator" :
    difference > 0.4 + 1e-10 ? "lower than comparator" : "within decision band: quantify by standard curves";
  M.band = band;
  const positions = (run, assay, accept) => [...assay.one.wells].filter(w => accept(run.plate[w]));
  const complete = (run, ws) => ws.length === N &&
    [1, 2, 3].every(rep => ws.filter(w => run.plate[w].rep === rep).length === 1);
  function group(run, assay, accept) {
    const ws = positions(run, assay, accept), count = ws.filter(w => detected(assay.cq[w])).length;
    const usable = complete(run, ws);
    const saturated = ws.some(w => assay.one.res.amp?.wells[w]?.saturated);
    return { ws, count, complete: usable, saturated, meanCq: count ? mean(ws.filter(w => detected(assay.cq[w])).map(w => assay.cq[w])) : null,
      call: !usable || saturated ? "inconclusive" : count === N ? "detected" : count === 0 ? "not detected" : "inconclusive" };
  }
  function calibration(run, assay, other, method, eventAssay) {
    const amp = assay.one.res.amp;
    if (!amp) return false;
    const levels = new Map();
    for (const w of positions(run, assay, W => W.role === "standard")) {
      const well = run.plate[w], level = parseFloat(well.dilution || well.sample.replace(/^STD\s*/, ""));
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level).push(w);
    }
    const masses = [...levels.keys()].sort((a,b) => a-b);
    if (masses.length < 5 || masses.some(mass => !Number.isFinite(mass)) || masses.at(-1) <= run.gmo.ng ||
      masses.at(-1) > method.calMax || masses.length !== other.length || masses.some((mass,i) => mass !== other[i])) return false;
    if (masses.some(mass => !complete(run, levels.get(mass)) || levels.get(mass).some(w => !detected(assay.cq[w])))) return false;
    const low = assay.one.view[levels.get(masses[0])[0]].quantity;
    if (eventAssay && !(low > method.lodCopies && low <= method.loqCopies)) return false;
    const sc = R2.analysis.standardCurve({ wells: amp.wells.map((w, i) => ({ ...w, cq: assay.cq[i] ?? null })) }, assay.one.view);
    const fit = sc && sc.available ? sc : null;
    assay.curve = fit;
    assay.curveOk = !!fit && fit.r2 >= 0.98 && fit.slope >= -3.6 && fit.slope <= -3.1;
    return assay.curveOk;
  }
  function massesOf(run, assay) {
    return [...new Set(positions(run, assay, W => W.role === "standard").map(w => {
      const W = run.plate[w];
      return parseFloat(W.dilution || W.sample.replace(/^STD\s*/, ""));
    }))].sort((a,b) => a-b);
  }
  const copiesAt = (assay, w) => Math.pow(10, (assay.cq[w] - assay.curve.intercept) / assay.curve.slope);
  const extrapolates = (assay, ws) => ws.some(w => {
    const x = Math.log10(copiesAt(assay,w));
    return x < assay.curve.range[0] || x > assay.curve.range[1];
  });
  const ratio = (event, ref, e, t) => 100 * mean(e.ws.map(w => copiesAt(event,w))) / mean(t.ws.map(w => copiesAt(ref,w)));
  function reportValue(value, U) {
    let digits = 1 - Math.floor(Math.log10(U));
    const rounded = Number(U.toFixed(Math.max(0, digits)));
    digits = Math.max(0, 1 - Math.floor(Math.log10(rounded)));
    return value.toFixed(digits) + " ± " + U.toFixed(digits) + " %";
  }
  M.protocolMatches = function (protocol, mode) {
    const [hold, cycle] = protocol.stages;
    if (protocol.stages.length !== 2 || hold?.type !== "hold" || hold.steps?.length !== 1 ||
        cycle?.type !== "cycle" || cycle.steps?.length !== 2) return false;
    const [activation] = hold.steps, [denaturation, acquisition] = cycle.steps;
    if (activation.read || denaturation.read || !acquisition.read || acquisition.temp_c !== 60) return false;
    if (mode === "screen") {
      const within = (value, min, max) => value >= min && value <= max;
      return within(activation.temp_c, 95, 98) && within(activation.hold_s, 30, 180) &&
        within(denaturation.temp_c, 95, 98) && within(denaturation.hold_s, 5, 10) &&
        within(acquisition.hold_s, 5, 20) && within(cycle.repeats, 35, 40);
    }
    return activation.temp_c === 95 && activation.hold_s === 300 && denaturation.temp_c === 95 &&
      denaturation.hold_s === 15 && acquisition.hold_s === 60 && cycle.repeats >= 40;
  };
  function readAssays(run, opt, out, audit, setup) {
    for (const id of out.order) {
      const one = R2.gmoeval.one(run, id, opt), amp = one.res.amp, M0 = R2.GMO.methods[id];
      const cq = Object.fromEntries([...one.wells].map(w => [w, amp && !amp.wells[w].saturated ? amp.wells[w].cq : null]));
      const assay = out.assays[id] = { id, name: R2.gmoplan.name(id), kind: M0.kind, channel: one.channel, one, cq, tm: {},
        reported: "not reported", sample: "inconclusive", valid: false };
      const controls = audit.controls[id] = {};
      for (const ctl of ["PC", "NC", "NTC"]) {
        const result = group(run, assay, W => W.ctl === ctl);
        const expected = ctl === "PC" || (ctl === "NC" && M0.kind === "taxon") ? "detected" : "not detected";
        const signalAbsent = setup.mode !== "screen" || expected === "detected" || result.ws.every(w => amp?.wells[w]?.cq === null);
        controls[ctl] = { ...result, expected, accepted: signalAbsent && result.call === expected && result.ws.every(w => !amp?.wells[w]?.saturated) };
      }
      assay.ntcPresent = controls.NTC.complete;
      assay.ntcOk = controls.NTC.accepted;
      assay.pcOk = controls.PC.accepted;
      assay.pcCq = controls.PC.ws.map(w => cq[w]);
      assay.sampleCq = positions(run, assay, W => W.role === "unknown").map(w => cq[w]);
    }
  }
  function rapidScreen(run, opt) {
    const setup = run.gmo.mara, out = { assays: {}, order: R2.gmoeval.assays(run), stage: "screen", findings: [] };
    const audit = out.mara = { mode: "screen", standard: "MARA 1012-17-2026", reference: R2.gmoeval.assays(run).includes(setup.taxon) ?
      R2.gmoplan.name(setup.taxon) : "Missing crop reference", event: "Selected markers", ctCutoff: CUT, lodPct: 1,
      controls: {}, evidence: [], targets: [] };
    const finish = (status, statement, level = "info") => {
      audit.status = status; audit.statement = statement; out.findings.push({ level, text: statement }); return out;
    };
    readAssays(run, opt, out, audit, setup);
    const ref = out.taxon = out.assays[setup.taxon];
    if (!ref || run.outcome !== "completed") return finish("invalid run", "The run did not complete or its crop reference is missing.", "fail");
    if (!M.protocolMatches(run.protocol, "screen")) return finish("invalid run", "The programme differs from the Standard 17 rapid-PCR range.", "fail");
    if (Object.values(audit.controls).some(assay => Object.values(assay).some(c => !c.accepted)))
      return finish("control fail", "One or more shared rapid-screen controls failed.", "fail");
    const extraction = (assay, ext) => group(run, assay, W => W.role === "unknown" && W.ext === ext);
    const reference = [1,2,3].map(ext => extraction(ref, ext));
    if (reference.some(x => x.call !== "detected")) return finish("invalid sample", "At least one crop-reference triplicate is invalid.", "fail");
    ref.valid = true; ref.reported = ref.sample = "detected";
    for (const id of out.order.filter(id => id !== setup.taxon)) {
      const assay = out.assays[id], rows = [1,2,3].map(ext => extraction(assay, ext));
      const calls = rows.map(x => x.call), pos = calls.filter(x => x === "detected").length, neg = calls.filter(x => x === "not detected").length;
      assay.valid = true;
      assay.reported = assay.sample = rows.every(row => row.complete && !row.saturated) && pos >= 2 ? "detected" :
        rows.every(row => row.complete && !row.saturated) && neg >= 2 ? "not detected" : "inconclusive";
      audit.targets.push({ method: id, target: assay.name, call: assay.reported,
        extractions: rows.map((row, i) => ({ ext: i + 1, call: row.call, meanCq: row.meanCq, referenceCq: reference[i].meanCq, amplified: row.count })) });
      if (new Set(calls).size > 1) out.findings.push({ level: "warn", text: assay.name + ": extraction calls disagree." });
    }
    const detectedTargets = audit.targets.filter(t => t.call === "detected");
    if (detectedTargets.length) return finish("marker detected", detectedTargets.map(t => t.target).join(", ") + " detected. Follow up with event identification.");
    if (audit.targets.some(t => t.call === "inconclusive")) return finish("repeat", "At least one marker call is inconclusive.", "warn");
    return finish("no selected marker detected", "No selected marker detected. Standard 17 states a 1 % target LOD.");
  }
  M.evaluate = function (run, opt) {
    if (run.gmo.mara.mode === "screen") return rapidScreen(run, opt);
    const g = run.gmo, setup = g.mara, method = M.assays[setup.method], ids = R2.gmoeval.assays(run);
    const out = { assays: {}, order: ids, stage: g.stage, findings: [] };
    const audit = out.mara = { mode: setup.mode, standard: "MARA 1012-" + method.std + "-2026",
      event: method.event, reference: method.ref, ctCutoff: CUT, comparatorPct: setup.comparatorPct,
      lodPct: method.lodPct, loqPct: method.loqPct, lodCopies: method.lodCopies, loqCopies: method.loqCopies,
      evidence: [], controls: {}, status: "invalid run", statement: "" };
    if (setup.mode === "ddct") audit.decisionStandard = "MARA 1012-16-2026 §5.4";
    const finish = (status, statement, level = "info") => {
      audit.status = status; audit.statement = statement;
      if (setup.mode === "quant") out.quantStatus = status;
      out.findings.push({ level, text: statement });
      return out;
    };
    readAssays(run, opt, out, audit, setup);
    const event = out.event = out.assays[setup.method], ref = out.taxon = out.assays[R2.GMO.methods[setup.method].taxon];
    if (!event || !ref || run.outcome !== "completed" || method.reviewOnly)
      return finish("invalid run", "Complete a run with the declared event and crop-reference assays.", "fail");
    if (!M.protocolMatches(run.protocol, setup.mode)) return finish("invalid run", "The programme differs from the selected MARA event method.", "fail");
    if (!Number.isFinite(g.ng) || g.ng !== (setup.mode === "quant" ? method.quantNg : method.qualNg))
      return finish("invalid run", "The DNA mass per reaction differs from the selected MARA method.", "fail");
    const bad = ids.flatMap(id => Object.entries(audit.controls[id]).filter(([, c]) => !c.accepted).map(([ctl]) => id + " " + ctl));
    if (bad.length) return finish("control fail", "Shared controls failed or were incomplete: " + bad.join(", ") + ".", "fail");
    // the published interpretation needs exactly 3 extracts x 3 PCR replicates per sample; any other design goes to review
    const sampleWells = run.plate.filter(w => w.role === "unknown"), exts = new Set(sampleWells.map(w => w.ext)), reps = new Set(sampleWells.map(w => w.rep));
    const is123 = set => set.size === 3 && [...set].every(v => [1, 2, 3].includes(v));
    if (!is123(exts) || !is123(reps)) return finish("review required", `Custom design (${exts.size} extraction${exts.size === 1 ? "" : "s"} × ${reps.size} PCR replicate${reps.size === 1 ? "" : "s"}) differs from the published 3 × 3 method. Review all raw wells; the fixed-method interpretation was not applied.`, "warn");
    const groups = [1, 2, 3].map(ext => {
      const e = group(run, event, W => W.role === "unknown" && W.ext === ext);
      const t = group(run, ref, W => W.role === "unknown" && W.ext === ext);
      const call = t.call === "detected" && !e.saturated ? e.call : "invalid";
      audit.evidence.push({ ext, call, eventCq: e.meanCq, referenceCq: t.meanCq,
        eventDetected: e.count, referenceDetected: t.count, eventWells: e.ws, referenceWells: t.ws });
      return { e, t, call };
    });
    event.valid = ref.valid = true;
    if (groups.some(x => x.call === "invalid"))
      return finish("invalid sample", "One or more extracts lack an interpretable crop-reference triplicate or contain saturated wells.", "fail");
    if (groups.some(x => !x.e.complete)) return finish("repeat", "One or more event triplicates are incomplete.", "warn");
    ref.sample = ref.reported = "detected";
    const calls = groups.map(x => x.call);
    const pos = calls.filter(c => c === "detected").length, neg = calls.filter(c => c === "not detected").length;
    if (setup.mode === "ident") {
      event.sample = event.reported = pos >= 2 ? "detected" : neg >= 2 ? "not detected" : "inconclusive";
      if (new Set(calls).size > 1) out.findings.push({ level: "warn", text: "Extraction calls disagree. See E1–E3 before using the majority call." });
      return finish(event.reported === "inconclusive" ? "repeat" : event.reported,
        method.event + " " + event.reported + " (" + pos + " detected, " + neg + " not detected out of 3 extracts).");
    }
    const positiveEvent = audit.controls[event.id].PC, positiveRef = audit.controls[ref.id].PC;
    if (setup.mode === "ddct") {
      if (pos !== 3) return finish("comparison unavailable", "Standard 16 comparison requires three interpretable event and reference triplicates.", "warn");
      event.sample = event.reported = "detected";
      audit.evidence.forEach(row => { row.deltaCt = row.eventCq - row.referenceCq; });
      audit.sampleDeltaCt = mean(audit.evidence.map(row => row.deltaCt));
      audit.controlDeltaCt = positiveEvent.meanCq - positiveRef.meanCq;
      audit.deltaDeltaCt = audit.sampleDeltaCt - audit.controlDeltaCt;
      return finish(band(audit.deltaDeltaCt), "Event detected. " + band(audit.deltaDeltaCt) + " (control " + setup.comparatorPct + " %).");
    }
    const acceptedEventCurve = calibration(run, event, massesOf(run, ref), method, true);
    const acceptedRefCurve = calibration(run, ref, massesOf(run, event), method, false);
    if (!acceptedEventCurve || !acceptedRefCurve)
      return finish("invalid run", "Both assays require at least five shared triplicate calibration levels, Cq ≤ 36, slope −3.6 to −3.1 and R² ≥ 0.98. The lowest event level must be above LOD and at or below LOQ.", "fail");
    const controlRatios = [1,2,3].map(rep => {
      const wE = positiveEvent.ws.find(w => run.plate[w].rep === rep), wT = positiveRef.ws.find(w => run.plate[w].rep === rep);
      return 100 * copiesAt(event, wE) / copiesAt(ref, wT);
    });
    const control = audit.quantitativeControl = { ...stats(controlRatios), ratios: controlRatios,
      assignedPct: setup.comparatorPct, kind: "laboratory-prepared" };
    control.biasPct = 100 * (control.mean - control.assignedPct) / control.assignedPct;
    control.accepted = control.rsdPct <= 25 && Math.abs(control.biasPct) <= 25 &&
      !extrapolates(event, positiveEvent.ws) && !extrapolates(ref, positiveRef.ws);
    if (!control.accepted) return finish("control fail", "The quantitative control exceeds the 25 % relative bias or RSD limit, or lies outside calibration.", "fail");
    if (neg === 3) {
      event.sample = event.reported = "not detected";
      return finish("event not detected", method.event + " was not detected in the three valid extracts.");
    }
    if (pos !== 3) return finish("repeat", "Quantification requires three complete event and reference triplicates.", "warn");
    const ratios = groups.map(({e,t}) => ratio(event, ref, e,t));
    audit.evidence.forEach((row, i) => { row.diagnosticPct = ratios[i]; });
    const result = audit.extractionStats = stats(ratios);
    event.sample = "detected";
    if (groups.some(({t}) => extrapolates(ref, t.ws)))
      return finish("repeat", "One or more crop-reference replicates are outside the calibration range.", "warn");
    if (result.mean < method.loqPct) {
      event.reported = "detected below LOQ";
      return finish("below LOQ", method.event + " detected below the " + method.loqPct + " % quantification limit.");
    }
    if (groups.some(({e}) => extrapolates(event, e.ws)) || result.rsdPct > 25)
      return finish("repeat", "At least one event Cq is outside calibration or the extraction RSD exceeds 25 %.", "warn");
    const U = 2 * Math.hypot(method.u0, method.ur * result.mean);
    audit.uncertainty = { k: 2, u0: method.u0, ur: method.ur, expandedPct: U, formatted: reportValue(result.mean, U) };
    out.gmPct = result.mean;
    out.byExtraction = audit.evidence.map((row, i) => ({ ext: row.ext, gmPct: ratios[i], eventCq: row.eventCq, taxonCq: row.referenceCq }));
    out.extractionStats = result;
    event.reported = "detected";
    return finish("reported", method.event + " · " + audit.uncertainty.formatted + " copy ratio (k = 2).");
  };
})(window.R2);
