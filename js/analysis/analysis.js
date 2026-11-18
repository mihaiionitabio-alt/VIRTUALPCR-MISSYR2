/* Analysis of a run record: signal, baseline, threshold, Cq, sigmoid/Cy0, standard curve, melt, flags.
 * JavaScript port of analysis_software/missy_analysis (amplification.py, sigmoid.py, melt.py, qc.py). Research use only. */
(function (R2) {
  "use strict";
  const A = R2.analysis = {};
  A.DEFAULTS = { baselineFirst: 5, baselineMinPts: 4, baselineMargin: 4, baselineFallbackLast: 15, takeoffNoise: 10, thresholdNoise: 10, thresholdFraction: 0.02,
    amplifiedMinRatio: 5, minReliableCycle: 5, scaledSignalMin: 0.086, scaledDr1Min: 0.0089, scaledDr2Min: 0.000689, meltHalfWindow: 1.0, meltGrid: 0.1,
    meltMinFractionOfPlateMax: 0.03, meltNoiseMultiple: 8, meltSecondary: 0.25, meltMinSeparation: 1.5, replicateSd: 0.3 };
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : 0.5 * (b[n / 2 - 1] + b[n / 2])) : NaN; };
  function line(x, y) { const n = x.length, mx = mean(x), my = mean(y); let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); } const b = sxx ? sxy / sxx : 0, a = my - b * mx; let ss = 0; for (let i = 0; i < n; i++) ss += (y[i] - a - b * x[i]) ** 2; return { a, b, sd: Math.sqrt(ss / Math.max(1, n - 2)) }; }

  // tables from the optical records: mean net counts per sample = (sum_on - sum_off) / (periods * 8)
  A.tables = function (rec) {
    const amp = rec.optical.filter(o => o.kind === "A"), melt = rec.optical.filter(o => o.kind === "M");
    const groups = {}; for (const o of amp) { const k = o.stage + "/" + o.step; (groups[k] = groups[k] || new Set()).add(o.cycle); }
    let key = null; for (const k in groups) if (!key || groups[k].size > groups[key].size) key = k;
    const cycles = key ? Array.from(groups[key]).sort((a, b) => a - b) : [], ci = new Map(cycles.map((c, i) => [c, i]));
    let top = 0; for (const o of rec.optical) if (o.well > top) top = o.well;
    const nw = rec.nWells || (top >= 16 ? 384 : 16);                     // 16-tube R2 block or 384-well plate
    const mk = n => [0, 1].map(() => Array.from({ length: nw }, () => new Array(n).fill(NaN)));
    const out = { nw, cycles, amp: mk(cycles.length), ampSat: mk(cycles.length), ampRef: mk(cycles.length) };
    for (const o of amp) if (o.stage + "/" + o.step === key) { const i = ci.get(o.cycle), d = o.periods * 8; out.amp[o.channel][o.well][i] = (o.sum_on - o.sum_off) / d; out.ampSat[o.channel][o.well][i] = o.sat_samples; out.ampRef[o.channel][o.well][i] = (o.ref_sum_on - o.ref_sum_off) / d; }
    const reads = Array.from(new Set(melt.map(o => o.cycle))).sort((a, b) => a - b), mi = new Map(reads.map((c, i) => [c, i]));
    out.melt = mk(reads.length); out.meltT = mk(reads.length);
    for (const o of melt) { const i = mi.get(o.cycle); out.melt[o.channel][o.well][i] = (o.sum_on - o.sum_off) / (o.periods * 8); out.meltT[o.channel][o.well][i] = 0.0005 * (o.tzone_start_mC + o.tzone_end_mC); }
    return out;
  };

  function baseline(x, y, p) {
    const n = x.length, idx = (lo, hi) => { const r = []; for (let i = 0; i < n; i++) if (x[i] >= lo && x[i] <= hi && isFinite(y[i])) r.push(i); return r; };
    let w = idx(p.baselineFirst, Math.min(p.baselineFallbackLast, x[n - 1]));
    if (w.length < p.baselineMinPts) return { error: "too_few_baseline_points" };
    let f = line(w.map(i => x[i]), w.map(i => y[i]));
    // provisional take-off: the first cycle at which the curve has gained a tenth of its total rise and keeps it; the baseline
    // window ends a margin before that cycle. A curve whose rise is within the noise has no take-off.
    const early = idx(p.baselineFirst, p.baselineFirst + 5), fe = early.length >= 3 ? line(early.map(i => x[i]), early.map(i => y[i])) : f;
    const noise = Math.max(fe.sd, 1e-9), lvl = early.map(i => y[i]).sort((a, b) => a - b)[early.length >> 1], top = Math.max(...y.filter(isFinite)), rise = top - lvl; let take = null;
    if (rise > Math.max(p.takeoffNoise * 2 * noise, 0.02 * Math.abs(lvl))) for (let i = 0; i < n; i++) { if (x[i] <= p.baselineFirst + 2) continue; let ok = true; for (let j = i; j < Math.min(n, i + 3); j++) if (!(y[j] - lvl > 0.1 * rise)) ok = false; if (ok) { take = x[i]; break; } }
    const last = take === null ? Math.min(p.baselineFallbackLast, x[n - 1]) : Math.max(p.baselineFirst + p.baselineMinPts - 1, take - p.baselineMargin);
    w = idx(p.baselineFirst, last);
    if (w.length >= p.baselineMinPts) f = line(w.map(i => x[i]), w.map(i => y[i]));
    return { window: [p.baselineFirst, last], intercept: f.a, slope: f.b, residualSd: f.sd, takeoff: take, corrected: y.map((v, i) => v - (f.a + f.b * x[i])) };
  }
  function cqThreshold(x, d, thr, start, p) {
    const n = x.length;
    if (!(d[n - 1] > p.amplifiedMinRatio * thr)) return [null, "no_amplification"];
    for (let i = 1; i < n; i++) {
      if (x[i] <= start - p.baselineMargin) continue;
      if (d[i - 1] < thr && d[i] >= thr) {
        let ok = true; for (let j = i; j < Math.min(n, i + 3); j++) if (d[j] < thr) ok = false;
        if (!ok) continue;
        if (d[i - 1] > 0) return [x[i - 1] + (Math.log(thr) - Math.log(d[i - 1])) / (Math.log(d[i]) - Math.log(d[i - 1])) * (x[i] - x[i - 1]), null];
        return [x[i - 1] + (thr - d[i - 1]) / (d[i] - d[i - 1]) * (x[i] - x[i - 1]), null];
      }
    }
    return d[0] >= thr ? [null, "above_threshold_from_start"] : [null, "no_threshold_crossing"];
  }
  // four-parameter log-logistic model of the source software (l4_enl) and Cy0
  const sf = (x, th) => th[1] + (th[2] - th[1]) / (1 + Math.exp(R2.clamp(th[0] * (Math.log(x) - th[3]), -700, 700)));
  function solve4(Am, g) { const M = Am.map((r, i) => r.concat([g[i]])); for (let i = 0; i < 4; i++) { let p = i; for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; if (Math.abs(M[p][i]) < 1e-300) return null; [M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < 4; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c < 5; c++) M[r][c] -= f * M[i][c]; } } return M.map((r, i) => r[4] / r[i]); }
  A.sigmoidFit = function (cycles, y, p) {
    const xs = [], ys = []; for (let i = 0; i < cycles.length; i++) if (cycles[i] >= p.minReliableCycle && isFinite(y[i])) { xs.push(cycles[i]); ys.push(y[i]); }
    if (xs.length < 6) return { status: "too_few_cycles" };
    let i0 = 0; for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i0]) i0 = i;
    const c0 = ys[i0] - 0.01, d0 = Math.max(...ys) + 0.01, lx = [], lg = [];
    for (let i = i0; i < xs.length; i++) { const v = Math.log((d0 - ys[i]) / (ys[i] - c0)); if (isFinite(v)) { lx.push(Math.log(xs[i])); lg.push(v); } }
    if (lx.length < 3) return { status: "no_start_values" };
    const l0 = line(lx, lg); if (!isFinite(l0.b) || l0.b === 0) return { status: "no_start_values" };
    let th = [l0.b, c0, d0, -l0.a / l0.b], lam = 1e-3;
    const res = t => xs.map((x, i) => sf(x, t) - ys[i]), sse = r => r.reduce((s, v) => s + v * v, 0);
    let r = res(th), S = sse(r);
    for (let it = 0; it < 200; it++) {
      const Am = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], g = [0, 0, 0, 0];
      for (let i = 0; i < xs.length; i++) { const L = Math.log(xs[i]), z = Math.exp(R2.clamp(th[0] * (L - th[3]), -700, 700)), gg = 1 / (1 + z), k = -(th[2] - th[1]) * gg * gg * z, J = [k * (L - th[3]), 1 - gg, gg, -k * th[0]]; for (let a = 0; a < 4; a++) { g[a] += J[a] * r[i]; for (let b = 0; b < 4; b++) Am[a][b] += J[a] * J[b]; } }
      for (let a = 0; a < 4; a++) Am[a][a] += lam * (Am[a][a] + 1e-12);
      const st = solve4(Am, g.map(v => -v)); if (!st) { lam *= 10; continue; }
      const nt = th.map((v, i) => v + st[i]), rn = res(nt), Sn = sse(rn);
      if (isFinite(Sn) && Sn < S) { const conv = S - Sn < 1e-12 * Math.max(S, 1e-300); th = nt; r = rn; S = Sn; lam /= 3; if (conv) break; } else { lam *= 4; if (lam > 1e12) break; }
    }
    const span = Math.max(...ys) - Math.min(...ys);
    if (!(th[1] >= Math.min(...ys) - 0.5 * span && th[1] <= Math.max(...ys)) || !th.every(isFinite)) return { status: "fit_not_plausible" };
    return { status: "ok", b: th[0], c: th[1], d: th[2], e: th[3], residualSd: Math.sqrt(S / Math.max(1, xs.length - 4)) };
  };
  A.sigmoidQuant = function (cycles, ft) {
    if (ft.status !== "ok") return null;
    const th = [ft.b, ft.c, ft.d, ft.e], n = Math.round((cycles[cycles.length - 1] - 1) * 100) + 1, x = [], y = [];
    for (let i = 0; i < n; i++) { x.push(1 + i * 0.01); y.push(sf(x[i], th) - ft.c); }
    const d1 = y.map((v, i) => i === 0 ? (y[1] - y[0]) / 0.01 : i === n - 1 ? (y[n - 1] - y[n - 2]) / 0.01 : (y[i + 1] - y[i - 1]) / 0.02);
    const d2 = d1.map((v, i) => i === 0 ? (d1[1] - d1[0]) / 0.01 : i === n - 1 ? (d1[n - 1] - d1[n - 2]) / 0.01 : (d1[i + 1] - d1[i - 1]) / 0.02);
    let i1 = 0, i2 = 0; for (let i = 1; i < n; i++) { if (d1[i] > d1[i1]) i1 = i; if (d2[i] > d2[i2]) i2 = i; }
    return { cy0: d1[i1] > 0 ? x[i1] - y[i1] / d1[i1] : null, cpDr1: x[i1], cpDr2: x[i2], maxDr1: d1[i1], maxDr2: d2[i2], maxSignal: Math.max(...y), rising: ft.b < 0 };
  };
  function reportable(q, ref, nCyc, p) {
    if (!q) return "sigmoid_fit_failed"; if (!q.rising) return "curve_not_rising";
    if (q.cy0 === null || q.cy0 < p.minReliableCycle || q.cy0 > nCyc) return "cy0_outside_cycle_range";
    if (!(ref > 0)) return "no_plate_reference";
    if (q.maxSignal / ref < p.scaledSignalMin) return "signal_below_reporting_rule";
    if (q.maxDr1 / ref < p.scaledDr1Min) return "slope_below_reporting_rule";
    if (q.maxDr2 / ref < p.scaledDr2Min) return "curvature_below_reporting_rule";
    return null;
  }

  A.amplification = function (tb, plate, opt) {
    const p = Object.assign({}, A.DEFAULTS, opt.params || {}), cycles = tb.cycles, tc = opt.target || 0;
    if (cycles.length < 8) return null;
    const sig = []; for (let w = 0; w < tb.nw; w++) sig.push(tb.amp[tc][w].map((v, i) => opt.passiveRef === null || opt.passiveRef === undefined ? v : v / tb.amp[opt.passiveRef][w][i]));
    const info = sig.map(y => baseline(cycles, y, p));
    const noiseThr = p.thresholdNoise * median(info.filter(b => !b.error).map(b => b.residualSd));
    const ends = info.filter(b => !b.error && b.corrected[cycles.length - 1] > p.amplifiedMinRatio * noiseThr).map(b => b.corrected[cycles.length - 1]);
    const auto = ends.length ? Math.max(noiseThr, p.thresholdFraction * median(ends)) : noiseThr, thr = opt.threshold ? opt.threshold : auto;
    const q9 = info.filter(b => !b.error).map(b => { const s = b.corrected.filter(isFinite).sort((x, y) => x - y); return s[Math.floor(0.9 * (s.length - 1))]; });
    const plateRef = q9.length ? Math.max(...q9) : null;
    const wells = info.map((b, w) => {
      const r = { well: w, role: plate[w].role, sample: plate[w].sample, baseline: b, signal: sig[w], corrected: b.error ? null : b.corrected, saturated: tb.ampSat[tc][w].reduce((s, v) => s + (v || 0), 0) };
      let cq = null, why = b.error || null; if (!b.error) [cq, why] = cqThreshold(cycles, b.corrected, thr, b.window[1], p);
      r.cqThreshold = cq; const ft = A.sigmoidFit(cycles, sig[w], p), sq = A.sigmoidQuant(cycles, ft), no = reportable(sq, plateRef, cycles[cycles.length - 1], p);
      r.sigmoid = { fit: ft, reasonIfNot: no }; r.cqCy0 = no ? null : sq.cy0;
      // second-derivative maximum of the fitted sigmoid: the kind of Cp the OpticalCyclerA 480 "Abs Quant / 2nd Derivative Max" reports; only for curves that also cross the threshold
      r.cqSdm = no || cq === null ? null : sq.cpDr2;
      r.cq = opt.cqMethod === "cy0" ? r.cqCy0 : opt.cqMethod === "sdm" ? r.cqSdm : cq; r.cqReason = r.cq === null ? (opt.cqMethod === "cy0" || (opt.cqMethod === "sdm" && cq !== null) ? no : why) : null;
      r.endSignal = b.error ? null : b.corrected[cycles.length - 1];
      return r;
    });
    return { cycles, wells, threshold: thr, thresholdSource: opt.threshold ? "user" : "automatic: larger of 10 × baseline noise and 2 % of the median end signal", cqMethod: opt.cqMethod || "threshold",
      unit: opt.passiveRef === null || opt.passiveRef === undefined ? "counts (LED on − LED off)" : "ratio to passive reference" };
  };
  A.standardCurve = function (amp, plate) {
    const pts = amp.wells.filter(w => plate[w.well].role === "standard" && plate[w.well].quantity > 0 && w.cq !== null).map(w => ({ well: w.well, lq: Math.log10(plate[w.well].quantity), cq: w.cq }));
    const levels = new Set(pts.map(q => q.lq.toFixed(6)));
    if (levels.size < 3) return { available: false, reason: "fewer than three standard levels with a Cq" };
    const f = line(pts.map(q => q.lq), pts.map(q => q.cq)), my = mean(pts.map(q => q.cq));
    let sst = 0, sse = 0; for (const q of pts) { sst += (q.cq - my) ** 2; sse += (q.cq - f.a - f.b * q.lq) ** 2; }
    const sc = { available: true, slope: f.b, intercept: f.a, r2: 1 - sse / sst, efficiency: Math.pow(10, -1 / f.b) - 1, points: pts, range: [Math.min(...pts.map(q => q.lq)), Math.max(...pts.map(q => q.lq))] };
    for (const w of amp.wells) { w.quantity = null; if (w.cq !== null) { const lq = (w.cq - f.a) / f.b; w.quantity = Math.pow(10, lq); w.extrapolated = plate[w.well].role !== "standard" && (lq < sc.range[0] || lq > sc.range[1]); } }
    return sc;
  };

  A.melt = function (tb, opt) {
    const p = Object.assign({}, A.DEFAULTS, opt.params || {}), tc = opt.target || 0;
    if (!tb.melt[tc][0].length) return null;
    const deriv = (t, f) => {
      const pts = []; for (let i = 0; i < t.length; i++) if (isFinite(t[i]) && isFinite(f[i])) pts.push([t[i], f[i]]);
      if (pts.length < 8) return null; const tmin = Math.min(...pts.map(q => q[0])), tmax = Math.max(...pts.map(q => q[0])), g = [], d = [];
      for (let x = tmin + p.meltHalfWindow; x <= tmax - p.meltHalfWindow + 1e-9; x += p.meltGrid) {
        const sel = pts.filter(q => Math.abs(q[0] - x) <= p.meltHalfWindow); if (sel.length < 5) { g.push(x); d.push(NaN); continue; }
        // local quadratic regression; slope at x
        let s = [0, 0, 0, 0, 0], r = [0, 0, 0]; for (const q of sel) { const u = q[0] - x; s[0]++; s[1] += u; s[2] += u * u; s[3] += u ** 3; s[4] += u ** 4; r[0] += q[1]; r[1] += q[1] * u; r[2] += q[1] * u * u; }
        const M = [[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]], det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const D = det(M), M1 = M.map((row, i) => [row[0], r[i], row[2]]); g.push(x); d.push(D ? -det(M1) / D : NaN);
      }
      return { t: g, d };
    };
    const curves = []; for (let w = 0; w < tb.nw; w++) curves.push(deriv(tb.meltT[tc][w], tb.melt[tc][w]));
    const plateMax = Math.max(...curves.map(c => c ? Math.max(...c.d.filter(isFinite)) : 0));
    const wells = curves.map((c, w) => {
      if (!c) return { well: w, peaks: [] };
      const low = c.d.filter((v, i) => isFinite(v) && c.t[i] < c.t[0] + 5), med = median(low), noise = low.length > 3 ? Math.sqrt(mean(low.map(v => (v - med) ** 2))) : 0;
      const floor = Math.max(p.meltMinFractionOfPlateMax * plateMax, p.meltNoiseMultiple * noise), cand = [];
      for (let i = 1; i < c.d.length - 1; i++) if (c.d[i] > floor && c.d[i] >= c.d[i - 1] && c.d[i] > c.d[i + 1]) { const den = c.d[i - 1] - 2 * c.d[i] + c.d[i + 1], off = den < 0 ? 0.5 * (c.d[i - 1] - c.d[i + 1]) / den : 0; cand.push({ tm: c.t[i] + off * p.meltGrid, height: c.d[i] }); }
      cand.sort((a, b) => b.height - a.height); const kept = [];
      for (const q of cand) if (!kept.length || (q.height >= p.meltSecondary * kept[0].height && kept.every(k => Math.abs(k.tm - q.tm) >= p.meltMinSeparation))) kept.push(q);
      return { well: w, t: c.t, d: c.d, peaks: kept };
    });
    return { wells };
  };

  A.thermal = function (rec) {
    const h = rec.telemetry.filter(r => r.state === "HOLD"); if (!h.length) return {};
    const settled = []; let run = 0; for (const r of h) { run = (r.prevSeq === undefined) ? run + 1 : run; settled.push(r); }
    const err = h.map(r => Math.max(Math.abs(r.zone1_c - r.setpoint_c), Math.abs(r.zone2_c - r.setpoint_c)));
    return { holdErrMax: Math.max(...err), holdErrRms: Math.sqrt(mean(err.map(e => e * e))), zoneDiffMax: Math.max(...h.map(r => Math.abs(r.zone1_c - r.zone2_c))), blockMax: Math.max(...rec.telemetry.map(r => Math.max(r.zone1_c, r.zone2_c))) };
  };
  A.flags = function (rec, plate, amp, sc, melt, th, outcome) {
    const p = A.DEFAULTS, f = [], add = (level, code, text) => f.push({ level, code, text });
    if (outcome !== "completed") add("fail", "RUN_NOT_COMPLETED", "The run ended as: " + outcome + ". Results are from a partial record.");
    for (const e of rec.events) if (e.severity >= 2) add("fail", e.code, "Instrument fault " + e.code + " at " + (e.t_ms / 1000).toFixed(1) + " s.");
    if (amp) {
      for (const w of amp.wells) {
        if (w.saturated > 0) add("warn", "SATURATION", R2.wellName(w.well) + ": " + w.saturated + " detector samples at full scale.");
        if (w.role === "ntc" && w.cq !== null) add("warn", "NTC_AMPLIFIED", "No-template control " + R2.wellName(w.well) + " has Cq " + w.cq.toFixed(2) + ".");
        if (w.role === "standard" && w.cq === null) add("warn", "STANDARD_NO_CQ", "Standard " + R2.wellName(w.well) + " has no Cq (" + w.cqReason + ").");
      }
      const groups = {}; for (const w of amp.wells) if (w.role !== "empty" && w.sample) (groups[w.sample + "|" + w.role] = groups[w.sample + "|" + w.role] || []).push(w);
      for (const k in groups) { const g = groups[k], cq = g.filter(w => w.cq !== null).map(w => w.cq); if (cq.length >= 2) { const m = mean(cq), sd = Math.sqrt(cq.reduce((s, v) => s + (v - m) ** 2, 0) / (cq.length - 1)); if (sd > p.replicateSd) add("warn", "REPLICATE_SPREAD", "Replicates of '" + k.split("|")[0] + "' differ: Cq SD " + sd.toFixed(2) + "."); } else if (cq.length === 1 && g.length > 1 && g[0].role !== "ntc") add("warn", "REPLICATE_DROPOUT", "Only one replicate of '" + k.split("|")[0] + "' has a Cq."); }
      if (sc && sc.available) { if (sc.efficiency < 0.9 || sc.efficiency > 1.1) add("warn", "EFFICIENCY", "Standard-curve efficiency " + (sc.efficiency * 100).toFixed(1) + " % is outside 90–110 %."); if (sc.r2 < 0.98) add("warn", "CURVE_FIT", "Standard-curve R² " + sc.r2.toFixed(4) + " is below 0.98."); }
      else if (sc) add("info", "NO_STANDARD_CURVE", "No standard curve: " + sc.reason + ".");
    }
    if (melt) for (const w of melt.wells) if (w.peaks.length > 1) add("info", "MULTIPLE_MELT_PEAKS", R2.wellName(w.well) + " has " + w.peaks.length + " melt peaks (" + w.peaks.map(q => q.tm.toFixed(1)).join(", ") + " °C).");
    if (th.holdErrMax > 1) add("warn", "HOLD_ERROR", "Largest hold error " + th.holdErrMax.toFixed(2) + " °C.");
    return f;
  };
  A.run = function (rec, plate, opt, outcome) {
    const tb = A.tables(rec);
    if (opt.wells) for (let c = 0; c < 2; c++) for (let w = 0; w < tb.nw; w++) if (!opt.wells.has(w)) { tb.amp[c][w].fill(NaN); tb.melt[c][w].fill(NaN); }   // analyse one assay's tubes only
    const amp = A.amplification(tb, plate, opt), sc = amp ? A.standardCurve(amp, plate) : null, melt = A.melt(tb, opt), th = A.thermal(rec);
    return { tables: tb, amp, sc, melt, thermal: th, flags: A.flags(rec, plate, amp, sc, melt, th, outcome), options: opt };
  };
})(window.R2);
