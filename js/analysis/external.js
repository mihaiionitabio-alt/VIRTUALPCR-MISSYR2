/* Data from outside the simulator, analysed on the quality bench.
 * Readers (all written for this bench; the formats are those of the example files the tools ship with):
 *   opticalcyclerb : results export of OpticalCyclerB / CompactCycler software as used by Auto-qPCR (Maussion et al. 2021, GPL-3.0)
 *   long        : one row per Cq, columns sample, group, gene, Cq (Click-qPCR template; Kubota & Tajima 2025, MIT)
 *   wide        : condition columns, a replicate column, then efficiency/Ct column pairs per gene (rtpcr / shiny_rtpcr layout,
 *                 Ghaderi; reference genes last)
 *   planner     : plate JSON of qPCR plate planner (M. M. Ali, CC BY-NC 4.0): samples by colour, Ct per well
 *   curves      : amplification curves, first column the cycle, one column per well (the export of the owner's own runs)
 * Analyses: standard curve (absolute quantification), ΔCq / ΔΔCq with optional efficiency weighting (Pfaffl), reference-gene
 * stability (geNorm M), curve calls (baseline, 10 %-rise Cq, plateau). Every analysis returns tables, findings, and its own
 * SOP identity (same analysis of the same kind of data with the same settings → same SOP). Nothing here leaves the browser. */
(function (R2) {
  "use strict";
  const E = R2.external = {};
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sd = a => a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)) : 0;
  const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
  E.stats = { mean, sd, median };
  // CSV with quotes; returns rows of strings
  E.csv = function (text, delimiter = ",") {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
      if (c === '"') q = true; else if (c === delimiter) { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c; }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };
  const num = v => { if (v === undefined || v === null) return null; const s = String(v).trim(); if (!s || /^(undetermined|no ct|n\/a|na|-|nan)$/i.test(s)) return null; const x = +s.replace(",", "."); return isFinite(x) ? x : null; };
  const wellName = (i, cols) => String.fromCharCode(65 + Math.floor(i / cols)) + (i % cols + 1);
  /* ---------- readers: all return { format, title, meta, rows:[{well, position, sample, target, task, quantity, cq, group, eff, omit}], curves? } ---------- */
  E.read = function (text, name) {
    name = name || "data"; const t = text.replace(/^﻿/, "").trim();
    if (t[0] === "{") { const j = JSON.parse(t); if (j.state && Array.isArray(j.state.wellsB)) return readPlanner(j.state, name); throw new Error("JSON is not a qPCR plate planner file (state.wellsA / state.wellsB missing)"); }
    const rows = E.csv(t).filter(r => r.some(c => c.trim() !== ""));
    const hi = rows.findIndex(r => /^well$/i.test((r[0] || "").trim()) && r.some(c => /^well position$/i.test(c.trim())));
    if (hi >= 0) return readOpticalCyclerB(rows, hi, name);
    const h = rows[0].map(c => c.trim()), lc = h.map(c => c.toLowerCase());
    if (/^cycles?$/i.test(h[0])) return readCurves(rows, name);
    if (["sample", "group", "gene", "cq"].every(k => lc.includes(k)) || (lc.includes("sample") && lc.includes("gene") && (lc.includes("ct") || lc.includes("cq")))) return readLong(rows, name);
    const pairs = []; for (let i = 0; i < h.length - 1; i++) if (/^e(ff(iciency)?)?[\s_.-]*/i.test(h[i]) && /^c[tq][\s_.-]*/i.test(h[i + 1])) { pairs.push(i); i++; }
    if (pairs.length >= 2) return readWide(rows, pairs, name);
    throw new Error("format not recognised: expected a OpticalCyclerB results export, a sample/group/gene/Cq table, efficiency/Ct pairs, a cycle × well curve table, or a plate planner JSON");
  };
  function readOpticalCyclerB(rows, hi, name) {
    const meta = {}; for (const r of rows.slice(0, hi)) if (r[0] && r[0].trim()) meta[r[0].trim()] = (r[1] || "").trim();
    const h = rows[hi].map(c => c.trim()), col = re => h.findIndex(c => re.test(c)), out = [];
    const ci = { well: col(/^well$/i), pos: col(/^well position$/i), omit: col(/^omit$/i), sample: col(/^sample name$/i), target: col(/^target name$/i), task: col(/^task$/i), rep: col(/^reporter$/i), cq: col(/^(c[tтq]|cq)$/i), qty: col(/^quantity$/i) };
    if (ci.cq < 0) ci.cq = col(/^c[tтq]\b/i);
    for (const r of rows.slice(hi + 1)) { if (!r[ci.pos] || !r[ci.target] || (ci.sample >= 0 && !(r[ci.sample] || "").trim() && !/standard|ntc/i.test(r[ci.task] || ""))) continue;
      const task = (r[ci.task] || "UNKNOWN").trim().toUpperCase();
      out.push({ well: +r[ci.well] - 1, position: r[ci.pos].trim(), sample: (r[ci.sample] || "").trim(), target: r[ci.target].trim(), task: task === "STANDARD" ? "STANDARD" : task === "NTC" ? "NTC" : "UNKNOWN",
        reporter: ci.rep >= 0 ? (r[ci.rep] || "").trim() : "", quantity: ci.qty >= 0 ? num(r[ci.qty]) : null, cq: num(r[ci.cq]), group: null, eff: null, omit: ci.omit >= 0 && /^(true|1|yes)$/i.test((r[ci.omit] || "").trim()) });
    }
    return { format: "opticalcyclerb", formatLabel: "OpticalCyclerB / CompactCycler results export", title: meta["Experiment Name"] || name, meta: { instrument: meta["Instrument Type"] || "", chemistry: meta["Chemistry"] || "", experimentType: meta["Experiment Type"] || "", block: meta["Block Type"] || "", runEnd: meta["Experiment Run End Time"] || "", cqMethod: meta["Quantification Cycle Method"] || "" }, rows: out };
  }
  function readLong(rows, name) {
    const h = rows[0].map(c => c.trim().toLowerCase()), k = n => h.indexOf(n), cq = k("cq") >= 0 ? k("cq") : k("ct"), out = [];
    rows.slice(1).forEach((r, i) => { if (!r[k("gene")]) return; out.push({ well: i, position: "", sample: r[k("sample")].trim(), target: r[k("gene")].trim(), task: "UNKNOWN", quantity: null, cq: num(r[cq]), group: k("group") >= 0 ? r[k("group")].trim() : null, eff: null, omit: false }); });
    return { format: "long", formatLabel: "sample / group / gene / Cq table (Click-qPCR layout)", title: name, meta: {}, rows: out };
  }
  function readWide(rows, pairs, name) {
    const h = rows[0].map(c => c.trim()), first = pairs[0], cond = h.slice(0, first), out = [];
    const genes = pairs.map(i => h[i + 1].replace(/^c[tq][\s_.-]*/i, "") || h[i].replace(/^e(ff(iciency)?)?[\s_.-]*/i, "") || "gene" + i);
    rows.slice(1).forEach((r, ri) => { if (!r.length || r.every(c => !c.trim())) return;
      const condVals = cond.slice(0, Math.max(1, cond.length - 1)).map((_, i) => r[i].trim()), rep = cond.length > 1 ? r[cond.length - 1].trim() : String(ri + 1);
      const group = condVals.join(" × "), sample = group + " / " + rep;
      pairs.forEach((i, g) => { const e = num(r[i]); out.push({ well: ri * pairs.length + g, position: "", sample, target: genes[g], task: "UNKNOWN", quantity: null, cq: num(r[i + 1]), group, eff: e === null ? null : (e > 2.5 ? 1 + e / 100 : e), omit: false }); });
    });
    return { format: "wide", formatLabel: "efficiency / Ct column pairs (rtpcr layout)", title: name, meta: { conditionColumns: cond.slice(0, Math.max(1, cond.length - 1)), replicateColumn: cond.length > 1 ? cond[cond.length - 1] : null, genes, referenceGenesLast: true }, rows: out };
  }
  function readPlanner(st, name) {
    const byColor = new Map(st.samples.map(s => [String(s.color).toLowerCase(), s])), cols = st.wellsA.length > 96 ? 24 : 12, out = [];
    st.wellsA.forEach((w, i) => { const colors = (Array.isArray(w.colors) ? w.colors : [w.colors]).map(c => String(c).toLowerCase()), ct = st.wellsB[i] ? st.wellsB[i].ct : null;
      for (const c of colors) { const s = byColor.get(c); if (!s) continue;
        const ntc = /ntc|no.?template/i.test(s.name + " " + s.conditionName), std = /^standard$/i.test(s.role);
        out.push({ well: i, position: wellName(i, cols), sample: std ? s.name : s.conditionName, label: s.name, target: s.target, task: std ? "STANDARD" : ntc ? "NTC" : "UNKNOWN", quantity: std ? num(s.conditionName) : null, cq: num(ct), group: std ? null : s.conditionName, role: s.role, eff: null, omit: false }); } });
    return { format: "planner", formatLabel: "qPCR plate planner JSON", title: (st.meta && st.meta.name) || name, meta: { date: st.meta && st.meta.date, notes: st.meta && st.meta.notes, calcMode: st.calcMode, qc: st.qc, groupSettings: st.groupSettings }, rows: out };
  }
  function readCurves(rows, name) {
    const h = rows[0].map(c => c.trim()), data = rows.slice(1).filter(r => num(r[0]) !== null), cycles = data.map(r => num(r[0])), out = [], curves = {};
    const tFile = (/_for_([A-Za-z0-9-]+?)(?:_qpcR|_curves|\.csv|$)/.exec(name) || [])[1];
    for (let c = 1; c < h.length; c++) { if (!h[c]) continue; const y = data.map(r => num(r[c])); if (y.filter(v => v !== null).length < 10) continue;
      const parts = h[c].split("_"), wellM = /^[A-P]\d{1,2}$/i.test(parts[parts.length - 1]) ? parts.pop() : wellName(c - 1, 12), tgt = parts.length > 1 ? parts.shift() : (tFile || "target"), smp = parts.join("_") || h[c];
      const task = /ntc/i.test(smp) ? "NTC" : /blank/i.test(smp) ? "NTC" : "UNKNOWN";
      curves[c - 1] = y; out.push({ well: c - 1, position: wellM.toUpperCase(), sample: smp, target: tFile && tgt.toUpperCase() !== tFile.toUpperCase() ? tFile : tgt, task, role: /blank/i.test(smp) ? "blank" : task === "NTC" ? "ntc" : /^C[NP]_/i.test(smp) ? "control" : "sample", quantity: null, cq: null, group: null, eff: null, omit: false }); }
    return { format: "curves", formatLabel: "amplification curves, cycle × well table", title: name.replace(/\.csv$/i, ""), meta: { cycles: cycles.length }, rows: out, cycles, curves };
  }
  /* ---------- analysis helpers ---------- */
  E.fit = function (pts) {             // least squares y = a + b x; pts [{x, y}]
    const n = pts.length, mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y)); let sxy = 0, sxx = 0, syy = 0;
    for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
    const b = sxy / sxx, a = my - b * mx; return { a, b, r2: syy ? (sxy * sxy) / (sxx * syy) : 1, n };
  };
  // Welch t-test, two-sided p (incomplete beta by continued fraction)
  function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
  function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  E.welch = function (x, y) {
    if (x.length < 2 || y.length < 2) return null; const vx = sd(x) ** 2 / x.length, vy = sd(y) ** 2 / y.length, se = Math.sqrt(vx + vy); if (!(se > 0)) return null;
    const t = (mean(x) - mean(y)) / se, df = (vx + vy) ** 2 / (vx * vx / (x.length - 1) + vy * vy / (y.length - 1)); return { t, df, p: ibeta(df / 2, 0.5, df / (df + t * t)) };
  };
  // technical replicates: Auto-qPCR style cut-off; with three or more replicates whose SD exceeds the cut-off, the value farthest from the median is set aside
  E.replicates = function (vals, cutoff) {
    const v = vals.filter(x => x !== null), out = { used: v.slice(), removed: [] };
    while (out.used.length >= 3 && sd(out.used) > cutoff) { const m = median(out.used); let k = 0; out.used.forEach((x, i) => { if (Math.abs(x - m) > Math.abs(out.used[k] - m)) k = i; }); out.removed.push(out.used.splice(k, 1)[0]); }
    out.mean = out.used.length ? mean(out.used) : null; out.sd = sd(out.used); out.n = out.used.length; out.missing = vals.length - v.length; return out;
  };
  const group = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  E.targets = ds => [...new Set(ds.rows.map(r => r.target))];
  // group of a sample: a group column of the file, the whole sample name, or the part after the last / before the first separator (Auto-qPCR: "group names are within the sample name")
  E.groupOf = (r, rule) => { const s = r.sample || "", parts = s.split(/[-_ ]+/).filter(Boolean);
    return rule === "column" ? (r.group || s) : rule === "suffix" ? (parts.length > 1 ? parts[parts.length - 1] : s) : rule === "prefix" ? (parts.length > 1 ? parts[0] : s) : rule === "sample" ? s : (r.group || s); };
  E.groups = (ds, rule) => [...new Set(ds.rows.filter(r => r.task === "UNKNOWN").map(r => E.groupOf(r, rule)))];
  // analyses this kind of data supports, with default settings
  E.kinds = function (ds) {
    const k = [];
    if (ds.format === "curves") k.push("curves");
    if (ds.rows.some(r => r.task === "STANDARD" && r.quantity > 0 && r.cq !== null)) k.push("standard");
    const tg = E.targets(ds), gr = E.groups(ds);
    if (tg.length >= 2 && ds.format !== "curves") { k.push("ddcq"); if (gr.length >= 3) k.push("stability"); }
    return k;
  };
  E.KIND_LABEL = { standard: "Standard curve and absolute quantities", ddcq: "Relative quantification (ΔCq, ΔΔCq)", stability: "Reference-gene stability (geNorm M)", curves: "Amplification curves: baseline, Cq, calls" };
  E.defaults = function (ds, kind) {
    const tg = E.targets(ds), groupBy = ds.rows.some(r => r.group) ? "column" : "sample", gr = E.groups(ds, groupBy);
    const ref = ds.format === "wide" ? [tg[tg.length - 1]] : tg.filter(t => /gapdh|actb|b2m|18s|hprt|tbp|ppia|rplp|ubc|ywhaz|lectin|le1|hmg|adh|reference|ref/i.test(t)).slice(0, 2);
    const control = gr.find(g => /control|ctrl|untreated|wt|d0|base/i.test(g)) || gr[0];
    if (kind === "ddcq") return { refs: ref.length ? ref : [tg[0]], control, groupBy, cutoff: 0.3, efficiency: ds.rows.some(r => r.eff) ? "from data" : "100 % (E = 2)" };
    if (kind === "stability") return { genes: tg, cutoff: 0.3 };
    if (kind === "standard") return { cutoff: 0.3 };
    return { cutoff: 0.3, rise: 0.1 };
  };
  /* ---------- analyses ---------- */
  E.analyse = function (ds, kind, opt) {
    opt = Object.assign(E.defaults(ds, kind), opt || {}); const findings = [], rows = ds.rows.filter(r => !r.omit);
    const ntcAmp = rows.filter(r => r.task === "NTC" && r.cq !== null && !(r.cq >= 38));
    if (ntcAmp.length) findings.push({ level: "warn", text: `No-template or blank controls with a Cq below 38: ${ntcAmp.slice(0, 6).map(r => (r.position || r.sample) + " " + r.target + " " + r.cq.toFixed(2)).join(", ")}${ntcAmp.length > 6 ? " …" : ""}.` });
    const res = { kind, label: E.KIND_LABEL[kind], options: opt, findings };
    if (kind === "standard") {
      res.targets = [];
      for (const [t, rs] of group(rows, r => r.target)) {
        const std = rs.filter(r => r.task === "STANDARD" && r.quantity > 0 && r.cq !== null);
        if (std.length < 3) { if (std.length) findings.push({ level: "warn", text: `${t}: fewer than three standard points; no curve.` }); continue; }
        const f = E.fit(std.map(r => ({ x: Math.log10(r.quantity), y: r.cq }))), eff = Math.pow(10, -1 / f.b) - 1, lo = Math.min(...std.map(r => r.quantity)), hi = Math.max(...std.map(r => r.quantity));
        const ok = f.b <= -3.1 && f.b >= -3.6 && f.r2 >= 0.98;
        if (!ok) findings.push({ level: "warn", text: `${t}: slope ${f.b.toFixed(3)}, efficiency ${(eff * 100).toFixed(1)} %, R² ${f.r2.toFixed(4)}: outside slope −3.1 to −3.6 or R² ≥ 0.98.` });
        const samples = [];
        for (const [s, g] of group(rs.filter(r => r.task === "UNKNOWN"), r => r.sample)) {
          const rep = E.replicates(g.map(r => r.cq), opt.cutoff), q = rep.mean === null ? null : Math.pow(10, (rep.mean - f.a) / f.b);
          if (rep.removed.length) findings.push({ level: "info", text: `${t} · ${s}: replicate ${rep.removed.map(v => v.toFixed(2)).join(", ")} set aside (SD above ${opt.cutoff}).` });
          if (rep.n >= 2 && rep.sd > opt.cutoff) findings.push({ level: "warn", text: `${t} · ${s}: replicate SD ${rep.sd.toFixed(2)} cycles.` });
          samples.push({ sample: s, n: rep.n, removed: rep.removed, cqMean: rep.mean, cqSd: rep.sd, quantity: q, outside: q !== null && (q < lo || q > hi), values: g.map(r => r.cq) });
        }
        const out = samples.filter(x => x.outside).length; if (out) findings.push({ level: "info", text: `${t}: ${out} sample(s) outside the range of the standards (${R2.niceNum(lo)} to ${R2.niceNum(hi)}).` });
        res.targets.push({ target: t, slope: f.b, intercept: f.a, r2: f.r2, efficiency: eff, accepted: ok, range: [lo, hi], points: std.map(r => ({ q: r.quantity, cq: r.cq, position: r.position })), samples });
      }
      if (!res.targets.length) findings.push({ level: "fail", text: "No target has three standard points with a Cq." });
    }
    if (kind === "ddcq") {
      const refs = opt.refs.filter(t => E.targets(ds).includes(t)), tg = E.targets(ds).filter(t => !refs.includes(t)), key = r => E.groupOf(r, opt.groupBy);
      if (!refs.length) { findings.push({ level: "fail", text: "Choose at least one reference gene." }); return res; }
      const log2E = r => opt.efficiency === "from data" && r && r.eff ? Math.log2(r.eff) : 1;     // Pfaffl weighting with the efficiency given per row (rtpcr: E = 2 means 100 %)
      const bySample = new Map();
      for (const [s, g] of group(rows.filter(r => r.task === "UNKNOWN"), r => r.sample)) {
        const per = {}; for (const [t, gt] of group(g, r => r.target)) { const rep = E.replicates(gt.map(r => r.cq), opt.cutoff); per[t] = { rep, w: rep.mean === null ? null : rep.mean * log2E(gt[0]) }; if (rep.removed.length) findings.push({ level: "info", text: `${s} · ${t}: replicate ${rep.removed.map(v => v.toFixed(2)).join(", ")} set aside.` }); }
        bySample.set(s, { group: key(g[0]), per });
      }
      const dcq = (s, t) => { const p = s.per; if (!p[t] || p[t].w === null || refs.some(r => !p[r] || p[r].w === null)) return null; return p[t].w - mean(refs.map(r => p[r].w)); };
      res.genes = tg.map(t => {
        const groups = new Map(); for (const [s, o] of bySample) { const d = dcq(o, t); if (d === null) continue; if (!groups.has(o.group)) groups.set(o.group, []); groups.get(o.group).push({ sample: s, dcq: d }); }
        const ctl = groups.get(opt.control) || [], base = ctl.length ? mean(ctl.map(x => x.dcq)) : null;
        if (!ctl.length) findings.push({ level: "warn", text: `${t}: the control group "${opt.control}" has no complete sample; ΔΔCq not computed.` });
        return { gene: t, groups: [...groups].map(([gname, xs]) => { const v = xs.map(x => x.dcq), dd = base === null ? null : v.map(x => x - base), fold = dd ? dd.map(x => Math.pow(2, -x)) : null, test = gname === opt.control || !ctl.length ? null : E.welch(v, ctl.map(x => x.dcq));
          return { group: gname, n: v.length, dcqMean: mean(v), dcqSd: sd(v), relExpr: mean(v.map(x => Math.pow(2, -x))), ddcqMean: dd ? mean(dd) : null, foldMean: fold ? mean(fold) : null, foldSd: fold ? sd(fold) : null, foldOfMean: dd ? Math.pow(2, -mean(dd)) : null, p: test ? test.p : null, df: test ? test.df : null, samples: xs }; }) };
      });
      res.refs = refs;
      if (refs.length > 1) { const pairs = [...bySample.values()].filter(o => refs.every(r => o.per[r] && o.per[r].rep.mean !== null)).map(o => o.per[refs[0]].rep.mean - o.per[refs[1]].rep.mean); if (pairs.length > 2 && sd(pairs) > 0.5) findings.push({ level: "warn", text: `The reference genes ${refs[0]} and ${refs[1]} do not move together (SD of their difference ${sd(pairs).toFixed(2)} cycles). Check their stability.` }); }
    }
    if (kind === "stability") {
      const genes = opt.genes.filter(t => E.targets(ds).includes(t)), samp = [];
      for (const [s, g] of group(rows.filter(r => r.task === "UNKNOWN"), r => r.sample)) { const o = {}; for (const [t, gt] of group(g, r => r.target)) o[t] = E.replicates(gt.map(r => r.cq), opt.cutoff).mean; if (genes.every(t => o[t] !== null && o[t] !== undefined)) samp.push(o); }
      if (samp.length < 3) { findings.push({ level: "fail", text: "Fewer than three samples with every selected gene measured." }); res.genes = []; return res; }
      // geNorm M (Vandesompele et al. 2002) on log2 expression = −Cq (efficiency 2 assumed)
      const M = t => mean(genes.filter(k => k !== t).map(k => sd(samp.map(o => o[k] - o[t]))));
      res.genes = genes.map(t => ({ gene: t, M: genes.length > 1 ? M(t) : null, cqMean: mean(samp.map(o => o[t])), cqSd: sd(samp.map(o => o[t])) })).sort((a, b) => a.M - b.M);
      res.samples = samp.length;
      for (const g of res.genes) if (g.M > 1.5) findings.push({ level: "warn", text: `${g.gene}: M ${g.M.toFixed(2)} above 1.5, the limit usually quoted for a stable reference gene in heterogeneous samples.` });
    }
    if (kind === "curves") {
      res.wells = rows.map(r => { const y = ds.curves[r.well], c = E.curve(y, opt.rise); r.cq = c.cq; return { ...r, ...c }; });
      const reps = [...group(res.wells.filter(w => w.cq !== null && w.role !== "ntc" && w.role !== "blank"), w => w.target + "|" + w.sample)].filter(([, g]) => g.length === 2).map(([k, g]) => ({ key: k, d: g[0].cq - g[1].cq }));
      res.replicateSd = reps.length ? Math.sqrt(mean(reps.map(x => x.d * x.d)) / 2) : null; res.replicatePairs = reps.length;
      for (const w of res.wells) if ((w.role === "ntc" || w.role === "blank") && w.cq !== null) findings.push({ level: "warn", text: `${w.position} ${w.sample} (${w.target}): ${w.role} amplifies, Cq ${w.cq.toFixed(2)}.` });
      const big = reps.filter(x => Math.abs(x.d) > 2 * opt.cutoff); if (big.length) findings.push({ level: "warn", text: `${big.length} duplicate pair(s) differ by more than ${(2 * opt.cutoff).toFixed(1)} cycles: ${big.slice(0, 5).map(x => x.key.replace("|", " · ")).join(", ")}.` });
    }
    if (!findings.some(f => f.level !== "info")) findings.push({ level: "ok", text: "No acceptance rule was triggered." });
    return res;
  };
  /* one curve: linear baseline on cycles 5–14, rise to the mean of the last three cycles, Cq where 10 % of the rise is reached
   * (the definition used to compare the simulator with the owner's real runs), call when plateau/baseline ≥ 1.4 and rise > 20 × baseline SD */
  E.curve = function (y, level) {
    level = level || 0.1; const n = y.length, xs = [], ys = []; for (let i = 4; i < Math.min(14, n); i++) if (y[i] !== null) { xs.push(i); ys.push(y[i]); }
    if (xs.length < 5) return { cq: null, call: "too few cycles" };
    const f = E.fit(xs.map((x, i) => ({ x, y: ys[i] }))), res = ys.map((v, i) => v - (f.a + f.b * xs[i])), bsd = sd(res), end = mean(y.slice(-3).filter(v => v !== null)), base = mean(ys), rise = end - (f.a + f.b * (n - 2));
    const out = { baseline: base, baselineSlope: f.b, baselineSd: bsd, plateauRatio: end / base, rise };
    if (!(base > 0) || end / base < 1.4 || rise < 20 * bsd) return { ...out, cq: null, call: "no amplification" };
    const z = y.map((v, i) => v === null ? null : (v - (f.a + f.b * i)) / rise);
    for (let i = 6; i < n; i++) if (z[i] !== null && z[i - 1] !== null && z[i] >= level && z[i - 1] < level) return { ...out, cq: i - 1 + (level - z[i - 1]) / (z[i] - z[i - 1]) + 1, call: "amplified", z };
    return { ...out, cq: null, call: "no crossing" };
  };
  /* ---------- SOP of an imported analysis ---------- */
  E.sopDefinition = (ds, res) => ({ kind: "imported-data-analysis", input_format: ds.format, analysis: res.kind, settings: res.options,
    rules: { replicate_cutoff_cycles: res.options.cutoff, standard_curve: res.kind === "standard" ? "slope -3.1 to -3.6, R2 >= 0.98" : null, ntc: "no Cq below 38", curve_call: res.kind === "curves" ? "plateau/baseline >= 1.4 and rise > 20 x baseline SD; Cq at " + (res.options.rise * 100) + " % of the rise" : null } });
  E.sopDoc = function (ds, res) {
    const def = E.sopDefinition(ds, res), id = R2.sop.idOf(def), o = res.options;
    const steps = { standard: ["Import the results export; exclude wells marked omitted.", "Per target, fit Cq against log10 quantity of the standards by least squares.", `Average technical replicates; with three or more replicates whose SD exceeds ${o.cutoff} cycles, set aside the value farthest from the median, one at a time (Auto-qPCR rule).`, "Read each sample's quantity from its target's curve; flag samples outside the range of the standards."],
      ddcq: ["Import the Cq table.", `Average technical replicates (cut-off ${o.cutoff} cycles, Auto-qPCR rule).`, `ΔCq = Cq(target) − mean Cq(${(o.refs || []).join(", ")})` + (o.efficiency === "from data" ? ", each Cq first multiplied by log2 of its efficiency (Pfaffl weighting, as rtpcr)." : "."), `ΔΔCq = ΔCq − mean ΔCq of the control group "${o.control}"; fold change = 2^−ΔΔCq.`, "Welch t-test of ΔCq of each group against the control group."],
      stability: ["Import the Cq table.", `Average technical replicates (cut-off ${o.cutoff} cycles).`, "Keep samples in which every candidate gene was measured.", "For each gene, M = mean over the other genes of the SD of the pairwise Cq differences (geNorm); lower M is more stable."],
      curves: ["Import the curve table (first column the cycle).", "Fit a straight baseline to cycles 5 to 14 of each curve.", "Call amplification when plateau/baseline ≥ 1.4 and the rise exceeds 20 × the baseline SD.", `Cq = cycle at which ${o.rise * 100} % of the rise is reached, by linear interpolation.`, "Compare duplicate tubes; flag no-template and blank controls that amplify."] }[res.kind];
    return { format: "missy-r2-workbench-sop/0.2", sop_id: id, notice: "Teaching procedure for data analysed on the workbench's quality bench. Not a validated laboratory procedure. Research use only.",
      identity_basis: "SHA-256 of the canonical JSON in 'definition': input format, analysis and its settings. File names, sample names and values are not part of it, so the same analysis of the same kind of data carries one SOP.",
      title: E.KIND_LABEL[res.kind] + " of " + ds.formatLabel, purpose: E.KIND_LABEL[res.kind], procedure: steps,
      acceptance: ["No-template controls show no Cq below 38.", res.kind === "standard" ? "Standard curve slope between −3.1 and −3.6 and R² ≥ 0.98 (ENGL minimum performance requirements)." : "Replicates agree within the cut-off.", res.kind === "stability" ? "A gene with M above 1.5 is not used as a reference." : "Every flagged finding is reviewed before the result is reported."],
      evaluation: res.label, definition: def, software: "MISSY R2 workbench" };
  };
  // analysis summary as JSON (format kept separate from the simulator's GMO analysis)
  // an imported file as a list entry of the quality bench
  E.item = function (bytes, file, extra) {
    const text = new TextDecoder().decode(bytes), ds = E.read(text, file), kinds = E.kinds(ds);
    return Object.assign({ name: (ds.title || file).replace(/\.(csv|json)$/i, ""), file, bytes, sha256: R2.sha256(bytes), ds, kinds, kind: kinds[0] || null, opts: null, added: new Date().toISOString() }, extra || {});
  };
  E.json = (item, res) => JSON.stringify({ format: "missy-r2-workbench-imported-analysis/0.1", notice: "Analysed on the MISSY R2 workbench. Research use only.", name: item.name, source_file: item.file, source_sha256: item.sha256, input_format: item.ds.format, input_format_label: item.ds.formatLabel, title: item.ds.title, meta: item.ds.meta,
    sop_id: E.sopDoc(item.ds, res).sop_id, analysis: res.kind, settings: res.options, findings: res.findings,
    results: res.kind === "standard" ? res.targets : res.kind === "ddcq" ? { reference_genes: res.refs, genes: res.genes } : res.kind === "stability" ? { samples: res.samples, genes: res.genes } : { replicate_sd: res.replicateSd, replicate_pairs: res.replicatePairs, wells: res.wells.map(w => ({ position: w.position, sample: w.sample, target: w.target, role: w.role, cq: w.cq, call: w.call, plateau_ratio: w.plateauRatio, baseline: w.baseline, baseline_sd: w.baselineSd })) },
    wells: item.ds.rows.map(r => ({ position: r.position, sample: r.sample, target: r.target, task: r.task, quantity: r.quantity, cq: r.cq, group: r.group, efficiency: r.eff, omitted: r.omit })),
    software: "MISSY R2 workbench " + R2.VERSION }, null, 1);
})(window.R2);
