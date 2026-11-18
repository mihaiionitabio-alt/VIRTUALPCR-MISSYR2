/* Evaluation of a GMO run: each assay is analysed on its own tubes and channel, then controls, sample result,
 * screening pattern or GM content are derived. Acceptance values for the calibration curve are the ENGL minimum
 * performance requirements (slope between -3.1 and -3.6, R² at least 0.98). */
(function (R2) {
  "use strict";
  const G = (R2.gmoeval = {}),
    M = (id) => R2.GMO.methods[id],
    mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  G.THRESHOLD = 15; // counts above baseline; one fixed default so that Cq values of different runs and reagent conditions can be compared
  G.assays = (run) => {
    const ids = [];
    for (const W of run.plate)
      for (const t of W.t || []) if (!ids.includes(t.m)) ids.push(t.m);
    return ids;
  };
  // one assay: its tubes, channel and a plate view the general analysis understands
  // Cq method: "auto" takes the laboratory procedure's (second-derivative maximum for SIMPLEX) or the threshold crossing
  G.method = (run, m) =>
    run.gmo?.mara
      ? "threshold"
      : !m || m === "auto"
        ? run.gmo && run.gmo.lab && R2.LAB[run.gmo.lab]
          ? R2.LAB[run.gmo.lab].rules.cqMethod
          : "threshold"
        : m;
  G.one = function (run, id, opt) {
    const set = new Set(),
      view = run.plate.map((W, w) => {
        const t = (W.t || []).find((x) => x.m === id);
        if (!t) return { role: "empty", sample: "" };
        set.add(w);
        return {
          role: W.role,
          sample: W.sample,
          quantity: W.role === "standard" ? t.q : null,
        };
      });
    const ch = R2.gmoplan.channel(id),
      thr = opt.thresholds && opt.thresholds[id];
    // the analysis of an assay is done once on all its tubes (every sample); per-sample evaluations reuse it
    const full = opt._full || run,
      key = id + "|" + G.method(run, opt.cqMethod) + "|" + (thr || ""),
      cache = opt._cache || {};
    let res = cache[key];
    if (!res) {
      const fset = new Set(),
        fview = full.plate.map((W, w) => {
          const t = (W.t || []).find((x) => x.m === id);
          if (!t) return { role: "empty", sample: "" };
          fset.add(w);
          return {
            role: W.role,
            sample: W.sample,
            quantity: W.role === "standard" ? t.q : null,
          };
        });
      res = R2.analysis.run(
        full.record,
        fview,
        {
          target: ch,
          passiveRef: null,
          cqMethod: G.method(run, opt.cqMethod),
          threshold: thr > 0 ? thr : G.THRESHOLD,
          wells: fset,
        },
        full.outcome,
      );
      cache[key] = res;
    }
    if (!(thr > 0) && res.amp)
      res.amp.thresholdSource =
        "fixed, " +
        G.THRESHOLD +
        " counts above baseline (default of this bench for every assay)";
    return { id, channel: ch, view, wells: set, res };
  };
  // every sample of the run is evaluated with the run's shared controls; out.samples lists them, out itself is sample 1
  G.run = function (run, opt) {
    opt = Object.assign({}, opt || {});
    opt._cache = opt._cache || {};
    opt._full = run;
    const nos = [
      ...new Set(
        run.plate
          .filter((W) => W.role === "unknown")
          .map((W) => W.sampleNo || 1),
      ),
    ].sort((a, b) => a - b);
    const list = (nos.length ? nos : [1]).map((no) => {
      const view =
        nos.length > 1
          ? Object.assign({}, run, {
              plate: run.plate.map((W) =>
                W.role === "unknown" && (W.sampleNo || 1) !== no
                  ? { role: "empty", sample: "", t: [] }
                  : W,
              ),
            })
          : run;
      const ev = run.gmo.mara
          ? R2.MARA.evaluate(view, opt)
          : G.runOne(view, opt),
        W0 = run.plate.find(
          (W) => W.role === "unknown" && (W.sampleNo || 1) === no,
        );
      if (nos.length > 1 && W0 && W0.sampleName)
        ev.findings = ev.findings.filter(
          (f) =>
            !/^.*Replicates of '/.test(f.text) ||
            f.text.includes(W0.sampleName + "-"),
        );
      if (!run.gmo.mara) G.extractions(view, ev);
      return { no, name: W0 ? W0.sampleName || W0.sample : "sample", ev };
    });
    return { ...list[0].ev, samples: list, sampleCount: list.length };
  };
  // results per sub-sample (independent extraction): detection per assay, and GM content per extraction for quantification
  G.extractions = function (run, ev) {
    const un = run.plate
      .map((W, w) => [W, w])
      .filter(([W]) => W.role === "unknown" && W.ext);
    if (!un.length) return;
    const exts = [...new Set(un.map(([W]) => W.ext))].sort();
    for (const id of ev.order) {
      const r = ev.assays[id],
        a = r.one.res.amp;
      r.byExtraction = exts.map((e) => {
        const ws = un
            .filter(([W]) => W.ext === e && W.t.some((t) => t.m === id))
            .map(([, w]) => w),
          cq = ws
            .map((w) => r.cq[w])
            .filter((v) => v !== null && v !== undefined);
        return {
          ext: e,
          tubes: ws.length,
          amplified: cq.length,
          meanCq: cq.length ? mean(cq) : null,
          copies: a
            ? ws.map((w) => a.wells[w].quantity).filter((v) => v > 0)
            : [],
        };
      });
    }
    if (ev.stage === "quant" && ev.event && ev.taxon && ev.event.byExtraction) {
      ev.byExtraction = exts.map((e, i) => {
        const E = ev.event.byExtraction[i],
          T = ev.taxon.byExtraction[i];
        return {
          ext: e,
          gmPct:
            E.copies.length && T.copies.length
              ? (100 * mean(E.copies)) / mean(T.copies)
              : null,
          eventCq: E.meanCq,
          taxonCq: T.meanCq,
        };
      });
      const v = ev.byExtraction.map((x) => x.gmPct).filter(Number.isFinite);
      if (v.length > 1) {
        const m = mean(v),
          sd = Math.sqrt(
            v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1),
          );
        ev.extractionStats = {
          n: v.length,
          mean: m,
          sd,
          rsdPct: (100 * sd) / m,
        };
        if (ev.extractionStats.rsdPct > 25)
          ev.findings.push({
            level: "warn",
            text: `GM content differs between the ${v.length} independent extractions (RSD ${ev.extractionStats.rsdPct.toFixed(0)} %, above 25 %).`,
          });
      }
    }
  };
  G.runOne = function (run, opt) {
    const ids = G.assays(run),
      g = run.gmo,
      completed = run.outcome === "completed",
      out = { assays: {}, order: ids, findings: [], stage: g.stage },
      cyc = run.protocol.stages.find((s) => s.type === "cycle").repeats;
    for (const id of ids) {
      const o = G.one(run, id, opt),
        a = o.res.amp,
        m = M(id),
        r = {
          id,
          name: R2.gmoplan.name(id),
          kind: m.kind,
          channel: o.channel,
          one: o,
          cq: {},
          tm: {},
        };
      const of = (kind) =>
          [...o.wells].filter((w) => run.plate[w].role === kind),
        cq = (w) => (a ? a.wells[w].cq : null);
      for (const w of o.wells) {
        r.cq[w] = cq(w);
        if (m.sybr && o.res.melt && o.res.melt.wells[w].peaks[0])
          r.tm[w] = o.res.melt.wells[w].peaks[0].tm;
      }
      const ntc = of("ntc"),
        pc = of("positive"),
        un = of("unknown"),
        st = of("standard");
      const tmPc = m.sybr && pc.length ? r.tm[pc[0]] : undefined,
        sameProduct = (w) =>
          tmPc === undefined ||
          (r.tm[w] !== undefined && Math.abs(r.tm[w] - tmPc) <= 1.5);
      r.ntcPresent = ntc.length > 0;
      r.ntcOk =
        r.ntcPresent &&
        ntc.every(
          (w) =>
            cq(w) === null || (m.sybr && tmPc !== undefined && !sameProduct(w)),
        ); // SYBR Green: a late rise that does not melt like the target is primer-dimer
      if (m.sybr && ntc.some((w) => cq(w) !== null) && r.ntcOk)
        out.findings.push({
          level: "info",
          text: `${R2.gmoplan.name(id)}: the no-template control shows a late signal that does not melt at the target's temperature (primer-dimer). Accepted by the melting criterion.`,
        });
      r.pcOk =
        pc.length > 0 &&
        pc.every((w) => cq(w) !== null && (!m.sybr || r.tm[w] !== undefined));
      r.valid = completed && r.ntcOk && r.pcOk && !!a;
      const isPos = (w) => cq(w) !== null && sameProduct(w),
        pos = un.filter(isPos).length;
      if (m.sybr && un.some((w) => cq(w) !== null && !isPos(w)))
        out.findings.push({
          level: "info",
          text: `${R2.gmoplan.name(id)}: a sample tube shows a late signal without the target's melting peak (primer-dimer). It is counted as not detected.`,
        });
      r.sample = !un.length
        ? "none"
        : pos === un.length
          ? "detected"
          : pos === 0
            ? "not detected"
            : "inconclusive";
      r.sampleCq = un.map(cq);
      r.pcCq = pc.map(cq);
      if (g.lab && m.kind === "taxon" && !ntc.length && !pc.length) {
        r.ntcPresent = r.ntcOk = r.pcOk = true;
        r.valid = completed && !!a;
        r.controlsByProcedure =
          "reference gene used to accept the sample DNA; run controls are on the element assays";
      }
      if (!r.ntcPresent)
        out.findings.push({
          level: "fail",
          text: `${r.name}: no-template control missing.`,
        });
      else if (!r.ntcOk)
        out.findings.push({
          level: "fail",
          text: `${r.name} (${id}): the no-template control amplified (Cq ${ntc
            .map(cq)
            .filter((v) => v !== null)
            .map((v) => v.toFixed(1))
            .join(", ")}). Results of this assay are not valid.`,
        });
      if (!r.pcOk)
        out.findings.push({
          level: "fail",
          text: `${r.name} (${id}): the positive control was missing or did not yield an interpretable signal. Results of this assay are not valid.`,
        });
      if (r.sample === "inconclusive")
        out.findings.push({
          level: "warn",
          text: `${r.name} (${id}): ${r.note || "only some sample tubes amplified"}. Repeat the assay.`,
        });
      const nc = of("negative");
      if (
        nc.length &&
        !nc.every((w) => (m.kind === "taxon" ? cq(w) !== null : cq(w) === null))
      ) {
        r.valid = false;
        out.findings.push({
          level: "fail",
          text:
            r.name +
            ": non-GM control has an unexpected reference/target signal.",
        });
      }
      if (g.stage === "quant") {
        const levels = new Map();
        for (const w of st) {
          const k = String(run.plate[w].t.find((t) => t.m === id)?.q);
          levels.set(k, (levels.get(k) || 0) + 1);
        }
        if (
          pc.length < 3 ||
          ntc.length < 3 ||
          levels.size < 4 ||
          [...levels.values()].some((n) => n < 3)
        ) {
          r.valid = false;
          out.findings.push({
            level: "fail",
            text:
              r.name +
              ": quantification requires at least three positive controls, three NTCs and four calibrant levels with at least three wells per level.",
          });
        }
      }
      if (st.length) {
        const sc = o.res.sc;
        r.curve = sc && sc.available ? sc : null;
        if (!r.curve)
          out.findings.push({
            level: "fail",
            text: `${r.name}: no calibration curve (${sc ? sc.reason : "no data"}).`,
          });
        else {
          r.curveOk = sc.slope <= -3.1 && sc.slope >= -3.6 && sc.r2 >= 0.98;
          if (!r.curveOk)
            out.findings.push({
              level: "warn",
              text: `${r.name}: calibration slope ${sc.slope.toFixed(2)}, R² ${sc.r2.toFixed(3)} is outside the acceptance range (slope −3.1 to −3.6, R² ≥ 0.98).`,
            });
          const q = (ws) =>
            ws.map((w) => a.wells[w].quantity).filter((v) => v > 0);
          r.sampleCopies = q(un);
          r.pcCopies = q(pc);
          r.extrapolated = un.some((w) => a.wells[w].extrapolated);
        }
      }
      for (const f of o.res.flags)
        if (["SATURATION", "REPLICATE_SPREAD"].includes(f.code))
          out.findings.push({ level: "warn", text: r.name + ": " + f.text });
      if (
        a &&
        pos &&
        Math.max(...un.map(cq).filter((v) => v !== null)) > cyc - 3
      )
        out.findings.push({
          level: "info",
          text: `${r.name}: the sample crosses the threshold in the last three cycles; close to the limit of detection.`,
        });
      out.assays[id] = r;
    }
    for (const f of out.assays[ids[0]].one.res.flags)
      if (
        ![
          "SATURATION",
          "REPLICATE_SPREAD",
          "NO_STANDARD_CURVE",
          "NTC_AMPLIFIED",
          "STANDARD_NO_CQ",
          "EFFICIENCY",
          "CURVE_FIT",
          "MULTIPLE_MELT_PEAKS",
        ].includes(f.code)
      )
        out.findings.push({ level: f.level, text: f.text });
    if (!completed)
      out.findings.push({
        level: "fail",
        text: "The run did not complete. Assay results are withheld.",
      });
    const tax = ids.map((id) => out.assays[id]).find((r) => r.kind === "taxon");
    out.taxon = tax;
    const taxonOk = !!(tax && tax.valid && tax.sample === "detected");
    if (tax) {
      if (tax.sample !== "detected")
        out.findings.push({
          level: "fail",
          text: `The species reference gene ${tax.name} was not detected in the sample: no amplifiable DNA of this species, or the reaction is inhibited. Negative GM results are not valid.`,
        });
      else if (tax.pcCq[0] !== null && tax.pcOk && !tax.curve) {
        const ngS = g.ng,
          exp = Math.log2((g.pcNg || 50) / ngS),
          obs = mean(tax.sampleCq) - tax.pcCq[0];
        tax.delay = obs - exp;
        if (tax.delay > 1)
          out.findings.push({
            level: "warn",
            text: `The reference gene appears ${tax.delay.toFixed(1)} cycles later than ${ngS} ng of intact DNA should: inhibition or degraded DNA is likely. Dilute the extract or repeat the extraction.`,
          });
      }
    }
    const gm = ids
      .map((id) => out.assays[id])
      .filter((r) => r.kind !== "taxon");
    for (const r of Object.values(out.assays)) {
      r.reported =
        r.valid && (r === tax || taxonOk) ? r.sample : "not reported";
    }
    if (g.lab && R2.LAB[g.lab]) G.lab(run, out, R2.LAB[g.lab]);
    if (g.stage === "screen") {
      const tested = {};
      for (const r of gm) tested[M(r.id).el] = r.reported;
      out.elements = tested;
      out.candidates = [];
      const proxy = gm.find((r) => r.id === "QL-ELE-00-012");
      if (proxy)
        out.screeningAssumption =
          "P-35S event coverage for QL-ELE-00-012 uses the GMO-Matrix column for QL-ELE-00-004 as a proxy.";
      for (const e of R2.GMO.events.filter(
        (e) => e.crop === g.crop && !e.mara,
      )) {
        const has = Object.keys(tested).filter((k) => e.el[k] > 0),
          neg = has.filter((k) => tested[k] === "not detected"),
          open = has.filter(
            (k) => tested[k] !== "detected" && tested[k] !== "not detected",
          );
        out.candidates.push({
          event: e.name,
          method: e.method,
          status: !has.length
            ? "not covered"
            : neg.length
              ? "excluded"
              : open.length
                ? "unresolved"
                : "possible",
          via: has.map((k) => R2.GMO.elementNames[k]),
          proxy: !!proxy && has.includes("p35s"),
        });
      }
    }
    if (g.stage === "quant" && tax && gm[0]) {
      const e = gm[0];
      if (
        e.curve &&
        tax.curve &&
        e.sampleCopies.length &&
        tax.sampleCopies.length
      ) {
        out.diagnosticGmPct =
          (100 * mean(e.sampleCopies)) / mean(tax.sampleCopies);
        if (
          e.sample === "detected" &&
          tax.sample === "detected" &&
          e.sampleCopies.length === tax.sampleCopies.length
        ) {
          out.diagnosticGmPctEach = e.sampleCopies.map(
            (v, i) => (100 * v) / tax.sampleCopies[i],
          );
        }
      }
      if (e.pcCopies?.length && tax.pcCopies?.length) {
        out.controlPct = (100 * mean(e.pcCopies)) / mean(tax.pcCopies);
      }
      const controlOk =
        Number.isFinite(out.controlPct) && Math.abs(out.controlPct - 1) <= 0.5;
      if (!controlOk && e.curve && tax.curve) {
        const detail = Number.isFinite(out.controlPct)
          ? `read ${out.controlPct.toFixed(2)} %`
          : "could not be quantified";
        out.findings.push({
          level: "warn",
          text: `The 1 % control ${detail}. Acceptance is 0.5–1.5 %.`,
        });
      }
      for (const assay of [e, tax]) {
        if (!assay.extrapolated) continue;
        const lowest =
            assay.curve &&
            Math.min(...assay.curve.points.map((p) => Math.pow(10, p.lq))),
          low =
            assay.sampleCopies.length &&
            lowest &&
            Math.max(...assay.sampleCopies) < lowest;
        out.findings.push({
          level: "warn",
          text:
            `${assay.name}: sample outside the calibrated range` +
            (low && assay === e
              ? ` (below the lowest calibrant, ${Math.round(lowest)} copies). Report the event as below the quantification range of this calibration.`
              : "."),
        });
      }
      if (!completed || !e.valid || !tax.valid) out.quantStatus = "invalid run";
      else if (
        !taxonOk ||
        !e.curveOk ||
        !tax.curveOk ||
        e.extrapolated ||
        tax.extrapolated ||
        !controlOk
      )
        out.quantStatus = "inconclusive";
      else if (e.sample === "not detected")
        out.quantStatus = "event not detected";
      else if (e.sample !== "detected" || !Number.isFinite(out.diagnosticGmPct))
        out.quantStatus = "inconclusive";
      else {
        out.quantStatus = "reported";
        out.gmPct = out.diagnosticGmPct;
        out.gmPctEach = out.diagnosticGmPctEach;
      }
      if (tax.curve && tax.sampleCopies.length) {
        const expect = g.ng * R2.GMO.crops[g.crop].copiesPerNg,
          rec = mean(tax.sampleCopies) / expect;
        out.recovery = rec;
        if (rec < 0.4)
          out.findings.push({
            level: "warn",
            text: `The reference gene finds ${(rec * 100).toFixed(0)} % of the copies that ${g.ng} ng of intact DNA would hold: inhibition or degraded DNA is likely, and the GM content may be biased.`,
          });
      }
      out.event = e;
    }
    return out;
  };
  /* Evaluation of SIMPLEX TRAINING-SCREEN-001 (section c5), on top of the controls above:
   * element detected when the mean sample Cq is below the mean Cq of the 0.1 % control at the limit of detection; amplified
   * but at or above it: below the limit of detection; no amplification or Cq ≥ 40: not detected. The run is valid when that
   * control's mean Cq lies within 29–36; the sample DNA is accepted when its reference-gene mean Cq lies within 20–27. */
  G.lab = function (run, out, L) {
    const R = L.rules,
      plate = run.plate,
      lab = (out.lab = {
        procedure: L.sop,
        cqMethod: R.cqMethod,
        rules: R,
        elements: {},
        valid: true,
        dnaAccepted: true,
        dna: null,
        overall: null,
      });
    const ws = (r, f) => [...r.one.wells].filter((w) => f(plate[w])),
      cqs = (r, list) =>
        list.map((w) => r.cq[w]).filter((v) => v !== null && v < R.negativeCq);
    for (const id of out.order) {
      const r = out.assays[id];
      if (r.kind === "taxon") {
        const v = cqs(
            r,
            ws(r, (W) => W.role === "unknown"),
          ),
          m = v.length ? mean(v) : null;
        lab.dna = { method: id, meanCq: m, range: R.taxon };
        if (m === null) {
          lab.dnaAccepted = false;
          out.findings.push({
            level: "fail",
            text: `${r.name}: no amplification of the reference gene in the sample: repeat the DNA extraction.`,
          });
        } else if (m < R.taxon[0]) {
          lab.dnaAccepted = false;
          out.findings.push({
            level: "warn",
            text: `${r.name}: mean Cq ${m.toFixed(2)} below ${R.taxon[0]}: dilute the DNA and repeat.`,
          });
        } else if (m > R.taxon[1]) {
          lab.dnaAccepted = false;
          out.findings.push({
            level: "fail",
            text: `${r.name}: mean Cq ${m.toFixed(2)} above ${R.taxon[1]}: extract the DNA again and repeat.`,
          });
        } else
          out.findings.push({
            level: "info",
            text: `${r.name}: mean Cq ${m.toFixed(2)}, within ${R.taxon[0]}–${R.taxon[1]}: DNA accepted.`,
          });
        continue;
      }
      const MIN = R.minControls || { LOD: 2, NTC: 1, BLK: 1, POS: 1 }; // procedure minimum per element mix; more tubes are allowed, all must pass
      const lodW = ws(r, (W) => W.ctl === "LOD"),
        lodV = cqs(r, lodW),
        lodShort = lodW.length < MIN.LOD,
        lod = !lodShort && lodV.length === lodW.length ? mean(lodV) : null,
        sv = cqs(
          r,
          ws(r, (W) => W.role === "unknown"),
        ),
        sm = sv.length ? mean(sv) : null;
      const e = (lab.elements[id] = {
        name: r.name,
        lodMeanCq: lod,
        sampleMeanCq: sm,
        sampleAmplified: sv.length,
        call: null,
      });
      if (lod === null) {
        lab.valid = false;
        out.findings.push({
          level: "fail",
          text: lodShort
            ? `${r.name}: ${lodW.length} tube${lodW.length === 1 ? "" : "s"} of the 0.1 % control at the limit of detection on the plate; the procedure requires at least ${MIN.LOD}: repeat with the control in duplicate.`
            : `${r.name}: the 0.1 % control at the limit of detection did not amplify in ${lodW.length === 2 ? "both" : "all " + lodW.length} tubes: repeat with a new control.`,
        });
      } else if (lod > R.lod[1]) {
        lab.valid = false;
        out.findings.push({
          level: "fail",
          text: `${r.name}: control at the limit of detection, mean Cq ${lod.toFixed(2)} above ${R.lod[1]}: repeat the reaction with a new control.`,
        });
      } else if (lod < R.lod[0]) {
        lab.valid = false;
        out.findings.push({
          level: "fail",
          text: `${r.name}: control at the limit of detection, mean Cq ${lod.toFixed(2)} below ${R.lod[0]}: check the reference-gene Cq of that control (below 20: dilute its DNA).`,
        });
      }
      e.call = !sv.length
        ? "not detected"
        : lod === null
          ? "not evaluable"
          : sm < lod
            ? "detected"
            : "below the limit of detection";
      if (sv.length && sv.length < ws(r, (W) => W.role === "unknown").length)
        out.findings.push({
          level: "warn",
          text: `${r.name}: only some sample wells amplified. The screening mean uses the amplifying wells.`,
        });
      const ntc = ws(r, (W) => W.ctl === "NTC"),
        blank = ws(r, (W) => W.ctl === "BLK"),
        positive = ws(r, (W) => W.ctl === "POS");
      const short = [
        ["NTC", ntc, "NTC"],
        ["BLK", blank, "extraction blank"],
        ["POS", positive, "positive sample"],
      ]
        .filter(([k, w]) => w.length < MIN[k])
        .map((x) => x[2]);
      const controlsOk =
        !short.length &&
        cqs(r, ntc.concat(blank)).length === 0 &&
        cqs(r, positive).length === positive.length;
      if (!controlsOk)
        out.findings.push({
          level: "fail",
          text: short.length
            ? `${r.name}: ${short.join(", ")} missing from the plate; the procedure requires ${short.length > 1 ? "each" : "it"} once per run and element.`
            : r.name +
              ": NTC, extraction blank or positive sample failed or was missing.",
        });
      if (!r.valid || !controlsOk) lab.valid = false;
    }
    const calls = Object.values(lab.elements).map((e) => e.call);
    if (calls.includes("detected") && calls.some((c) => c !== "detected")) {
      lab.repeatExtraction = true;
      out.findings.push({
        level: "warn",
        text: `Only one element is above the limit of detection: repeat the DNA extraction for this sample.`,
      });
    }
    for (const id of Object.keys(lab.elements)) {
      const e = lab.elements[id],
        r = out.assays[id];
      e.observedCall = e.call;
      if (!lab.valid || !lab.dnaAccepted || lab.repeatExtraction)
        e.call = "not evaluable";
      r.reported = e.call === "not evaluable" ? "not reported" : e.call;
    }
    lab.overall = !lab.valid
      ? "run not validated: repeat"
      : !lab.dnaAccepted
        ? "sample DNA not accepted: extract again"
        : lab.repeatExtraction
          ? "repeat the extraction"
          : calls.every((c) => c === "detected")
            ? "GM DNA with P-35S and T-nos detected"
            : calls.every((c) => c === "not detected")
              ? "no GM DNA with P-35S or T-nos detected"
              : calls.some((c) => c === "detected")
                ? "detected"
                : "below the limit of detection";
  };
})(window.R2);
