/* Quality manager bench, guided levels.
 * Beginner and Intermediate: training cases of SIMPLEX TRAINING-SCREEN-001 screening runs (P-35S, T-nos, reference gene;
 * PC at the limit of detection, positive sample, NTC and extraction blank for the run; sample in three extracts × three
 * PCR replicates). Cq values are generated for each attempt with the natural variation fitted to the real runs (run SD
 * 0.41, extraction SD 0.2, tube SD 0.15 cycles) around typical values; the expected decision is worked out with the
 * procedure's acceptance rules (R2.LAB.simplex.rules), the same rules as the quality evaluation. Beginner cases have one
 * clear fault and show the rules; Intermediate cases are subtler, show no hints and also ask for the cause.
 * Intermediate also offers a short review of the runs filed in this browser (same evaluation as the full review).
 * Administrator: SOP registry, acceptance rules in use, training records. */
(/* @r2fn R2-C0060-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, L = R2.levels, esc = R2.esc;
  const store = L.store("missy-r2-qm-cases", /* @r2fn R2-C0060-F00002 */() => ({ beginner: {}, intermediate: {} }));
  const RULES = /* @r2fn R2-C0060-F00003 */() => (R2.LAB && R2.LAB.simplex ? R2.LAB.simplex.rules : { lod: [29, 36], taxon: [20, 27], negativeCq: 40 });
  const SD = { run: 0.41, ext: 0.2, tube: 0.15 };
  const NAMES = { p35s: "P-35S", tnos: "T-nos", ref: { soybean: "Le1 (reference)", maize: "hmgA (reference)" } };
  const DEC = { report: "Report the result", repeat: "Repeat the PCR run", dilute: "Dilute the DNA and repeat", extract: "Extract the DNA again" };
  const RES = { both: "P-35S and T-nos detected", none: "No GM element detected (P-35S and T-nos not detected)", below: "Below the limit of detection" };
  const CAUSE = {
    normal: "Controls valid and sample DNA accepted: nothing blocks the result",
    ntc: "NTC amplified: contamination of reagents or mix",
    blank: "Extraction blank amplified: contamination during extraction",
    lod: "PC at the limit of detection out of 29–36 or not amplified in both tubes",
    pos: "Positive sample did not amplify",
    refLate: "Reference gene absent or later than Cq 27: sample DNA not accepted",
    refEarly: "Reference gene earlier than Cq 20: too much DNA",
    one: "Only one element above the limit of detection",
    belowLod: "Sample later than the PC at the limit of detection",
    lateNtc: "NTC signal at Cq 40 or later counts as no amplification",
    dropout: "Some sample wells did not amplify; the amplifying wells still decide"
  };
  // typical Cq at 200 ng per reaction (5 µL at 40 ng/µL) in the simulated SIMPLEX runs
  const BASE = { ref: { soybean: 22.6, maize: 23.3 }, lod: { p35s: 33.2, tnos: 31.8 }, pos: { p35s: 29.9, tnos: 28.4 } };
  const gmCq = /* @r2fn R2-C0060-F00004 */(el, pct) => BASE.pos[el] - 3.32 * Math.log10(pct / 1);
  const CASES = [
    { id: "b-neg", lv: "beginner", crop: "soybean", title: "Routine soybean sample", text: "Soybean meal, screening. Read the controls first, then the sample.", gen: /* @r2fn R2-C0060-F00005 */() => ({ pct: 0 }) },
    { id: "b-pos", lv: "beginner", crop: "soybean", title: "Soybean sample with GM signal", text: "Soybean meal from an import lot.", gen: /* @r2fn R2-C0060-F00006 */() => ({ pct: 2 }) },
    { id: "b-ntc", lv: "beginner", crop: "maize", title: "Maize run, look at the NTC", text: "Maize flour, screening.", gen: /* @r2fn R2-C0060-F00007 */r => ({ pct: 0, ntc: { tnos: 33.4 + r() * 1.5 } }) },
    { id: "b-lod", lv: "beginner", crop: "soybean", title: "Soybean run, look at the PC at LOD", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00008 */() => ({ pct: 0, lodFail: { p35s: [null, null] } }) },
    { id: "b-noref", lv: "beginner", crop: "maize", title: "Maize sample without reference signal", text: "Maize flour, screening; the extract looked clear.", gen: /* @r2fn R2-C0060-F00009 */() => ({ pct: 0, refShift: null }) },
    { id: "b-early", lv: "beginner", crop: "soybean", title: "Very early reference gene", text: "Soybean meal; the extract was not diluted.", gen: /* @r2fn R2-C0060-F00010 */r => ({ pct: 0.5, refMean: 17.6 + r() * 1.2 }) },
    { id: "b-blank", lv: "beginner", crop: "soybean", title: "Soybean run, look at the extraction blank", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00011 */r => ({ pct: 0, blank: { p35s: 34.4 + r() * 1.2 } }) },
    { id: "i-below", lv: "intermediate", crop: "soybean", title: "Weak signal in a soybean sample", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00012 */() => ({ pct: 0.05, belowLod: true }) },
    { id: "i-lodlate", lv: "intermediate", crop: "maize", title: "Maize run", text: "Maize flour, screening. New CRM dilution prepared this week.", gen: /* @r2fn R2-C0060-F00013 */r => ({ pct: 0, lodMean: { p35s: 36.25 + r() * 0.5 } }) },
    { id: "i-one", lv: "intermediate", crop: "maize", title: "Maize sample", text: "Maize flour, screening.", gen: /* @r2fn R2-C0060-F00014 */() => ({ pct: 1, only: "tnos" }) },
    { id: "i-pos", lv: "intermediate", crop: "soybean", title: "Soybean run", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00015 */() => ({ pct: 0, posFail: "tnos" }) },
    { id: "i-latentc", lv: "intermediate", crop: "soybean", title: "Soybean run with a late NTC curve", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00016 */r => ({ pct: 0, ntc: { p35s: 40.6 + r() * 1.2 } }) },
    { id: "i-reflate", lv: "intermediate", crop: "soybean", title: "Processed soybean product", text: "Soybean protein product, heat treated.", gen: /* @r2fn R2-C0060-F00017 */r => ({ pct: 0, refMean: 27.3 + r() * 0.8 }) },
    { id: "i-drop", lv: "intermediate", crop: "maize", title: "Maize sample", text: "Maize flour, screening.", gen: /* @r2fn R2-C0060-F00018 */() => ({ pct: 0.4, drop: { p35s: 2 } }) },
    { id: "i-lodone", lv: "intermediate", crop: "soybean", title: "Soybean run", text: "Soybean meal, screening.", gen: /* @r2fn R2-C0060-F00019 */() => ({ pct: 0, lodFail: { tnos: [true, null] } }) }
  ];
  const mean = /* @r2fn R2-C0060-F00020 */a => a.reduce(/* @r2fn R2-C0060-F00021 */(s, v) => s + v, 0) / a.length;
  const amp = /* @r2fn R2-C0060-F00022 */(v, R) => v !== null && v < R.negativeCq;
  /* @r2fn R2-C0060-F00023 */function generate(c, seed) {
    const r = L.rng(seed), g = /* @r2fn R2-C0060-F00024 */() => L.gauss(r), o = c.gen(r), R = RULES(), run0 = g() * SD.run, ext = [0, 1, 2].map(/* @r2fn R2-C0060-F00025 */() => g() * SD.ext), tube = /* @r2fn R2-C0060-F00026 */v => v === null ? null : +(v + run0 + g() * SD.tube).toFixed(2);
    const els = ["p35s", "tnos"], d = { crop: c.crop, assays: { ref: {}, p35s: {}, tnos: {} } };
    // reference gene: sample extracts, NTC, blank
    const refM = o.refShift === null ? null : (o.refMean !== undefined ? o.refMean : BASE.ref[c.crop]);
    d.assays.ref = { S: ext.map(/* @r2fn R2-C0060-F00027 */e => [0, 1, 2].map(/* @r2fn R2-C0060-F00028 */() => refM === null ? null : tube(refM + e))), NTC: [null], BLK: [null] };
    if (refM !== null && o.refMean !== undefined) { const m = mean(d.assays.ref.S.flat()); d.assays.ref.S = d.assays.ref.S.map(/* @r2fn R2-C0060-F00029 */row => row.map(/* @r2fn R2-C0060-F00030 */v => +(v - m + o.refMean).toFixed(2))); }
    const refOff = refM === null ? 0 : refM - BASE.ref[c.crop];   // more or less DNA moves every target of the sample
    for (const el of els) {
      const A = d.assays[el];
      A.LOD = [0, 1].map(/* @r2fn R2-C0060-F00031 */() => tube(BASE.lod[el]));
      if (o.lodMean && o.lodMean[el] !== undefined) { const m = mean(A.LOD); A.LOD = A.LOD.map(/* @r2fn R2-C0060-F00032 */v => +(v - m + o.lodMean[el]).toFixed(2)); }
      if (o.lodFail && o.lodFail[el]) A.LOD = A.LOD.map(/* @r2fn R2-C0060-F00033 */(v, i) => o.lodFail[el][i] ? v : null);
      A.POS = [o.posFail === el ? null : tube(BASE.pos[el])];
      A.NTC = [o.ntc && o.ntc[el] ? +o.ntc[el].toFixed(2) : null];
      A.BLK = [o.blank && o.blank[el] ? +o.blank[el].toFixed(2) : null];
      let sm = null;
      if (refM !== null && o.pct > 0 && !(o.only && o.only !== el)) sm = (o.belowLod ? mean(A.LOD.filter(/* @r2fn R2-C0060-F00034 */v => v !== null)) + 1.3 : gmCq(el, o.pct)) + refOff;
      A.S = ext.map(/* @r2fn R2-C0060-F00035 */e => [0, 1, 2].map(/* @r2fn R2-C0060-F00036 */() => sm === null ? null : tube(sm + e)));
      if (o.belowLod) A.S = A.S.map(/* @r2fn R2-C0060-F00037 */(row, i) => row.map(/* @r2fn R2-C0060-F00038 */(v, k) => (i * 3 + k) % 4 === 1 ? null : v));
      if (o.drop && o.drop[el]) L.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], r).slice(0, o.drop[el]).forEach(/* @r2fn R2-C0060-F00039 */i => { A.S[Math.floor(i / 3)][i % 3] = null; });
    }
    if (o.belowLod) for (const el of els) { const lm = mean(d.assays[el].LOD), sv = d.assays[el].S.flat().filter(/* @r2fn R2-C0060-F00040 */v => v !== null), sm = mean(sv); if (sm <= lm) d.assays[el].S = d.assays[el].S.map(/* @r2fn R2-C0060-F00041 */row => row.map(/* @r2fn R2-C0060-F00042 */v => v === null ? null : +(v + (lm - sm) + 0.4).toFixed(2))); }
    return d;
  }
  // the procedure's rules (as in R2.gmoeval for SIMPLEX) applied to a case; returns the checks, the decision and the cause
  /* @r2fn R2-C0060-F00043 */function judge(d) {
    const R = RULES(), chk = [], push = /* @r2fn R2-C0060-F00044 */(ok, text, key) => chk.push({ ok, text, key });
    let valid = true, blankHit = false, ntcHit = false, lodBad = false, posBad = false, lateNtc = false;
    const calls = {};
    for (const el of ["p35s", "tnos"]) {
      const A = d.assays[el], n = NAMES[el], lv = A.LOD.filter(/* @r2fn R2-C0060-F00045 */v => amp(v, R)), lm = lv.length === 2 ? mean(lv) : null;
      if (lm === null) { valid = false; lodBad = true; push(false, `${n}: PC at LOD amplified in ${lv.length} of 2 tubes (both required).`, "lod"); }
      else if (lm < R.lod[0] || lm > R.lod[1]) { valid = false; lodBad = true; push(false, `${n}: PC at LOD mean Cq ${lm.toFixed(2)}, outside ${R.lod[0]}–${R.lod[1]}.`, "lod"); }
      else push(true, `${n}: PC at LOD mean Cq ${lm.toFixed(2)}, within ${R.lod[0]}–${R.lod[1]}.`);
      if (amp(A.NTC[0], R)) { valid = false; ntcHit = true; push(false, `${n}: NTC amplified at Cq ${A.NTC[0].toFixed(2)}.`, "ntc"); }
      else if (A.NTC[0] !== null) { lateNtc = true; push(true, `${n}: NTC signal at Cq ${A.NTC[0].toFixed(2)}, at or after ${R.negativeCq}: no amplification.`); }
      else push(true, `${n}: NTC clean.`);
      if (amp(A.BLK[0], R)) { valid = false; blankHit = true; push(false, `${n}: extraction blank amplified at Cq ${A.BLK[0].toFixed(2)}.`, "blank"); } else push(true, `${n}: extraction blank clean.`);
      if (!amp(A.POS[0], R)) { valid = false; posBad = true; push(false, `${n}: positive sample did not amplify.`, "pos"); } else push(true, `${n}: positive sample amplified (Cq ${A.POS[0].toFixed(2)}).`);
      const sw = A.S.flat(), sv = sw.filter(/* @r2fn R2-C0060-F00046 */v => amp(v, R)), sm = sv.length ? mean(sv) : null;
      calls[el] = !sv.length ? "not detected" : lm === null ? "not evaluable" : sm < lm ? "detected" : "below the limit of detection";
      push(true, `${n}: sample ${sv.length} of ${sw.length} wells amplified${sm !== null ? ", mean Cq " + sm.toFixed(2) : ""} → ${calls[el]}${lm !== null && sm !== null ? " (PC at LOD " + lm.toFixed(2) + ")" : ""}.`);
    }
    const rv = d.assays.ref.S.flat().filter(/* @r2fn R2-C0060-F00047 */v => amp(v, R)), rm = rv.length ? mean(rv) : null;
    let dna = "ok";
    if (rm === null) { dna = "late"; push(false, `Reference gene: no amplification in the sample.`, "refLate"); }
    else if (rm < R.taxon[0]) { dna = "early"; push(false, `Reference gene mean Cq ${rm.toFixed(2)}, below ${R.taxon[0]}: too much DNA.`, "refEarly"); }
    else if (rm > R.taxon[1]) { dna = "late"; push(false, `Reference gene mean Cq ${rm.toFixed(2)}, above ${R.taxon[1]}.`, "refLate"); }
    else push(true, `Reference gene mean Cq ${rm.toFixed(2)}, within ${R.taxon[0]}–${R.taxon[1]}: DNA accepted.`);
    const cv = Object.values(calls), one = cv.includes("detected") && cv.some(/* @r2fn R2-C0060-F00048 */c => c !== "detected");
    let decision, also = null, cause, result = null;
    if (!valid) { decision = blankHit && !ntcHit && !lodBad && !posBad ? "extract" : "repeat"; also = blankHit && decision === "extract" ? "repeat" : null;
      cause = ntcHit ? "ntc" : blankHit ? "blank" : lodBad ? "lod" : "pos"; }
    else if (dna === "early") { decision = "dilute"; cause = "refEarly"; }
    else if (dna === "late") { decision = "extract"; cause = "refLate"; }
    else if (one) { decision = "extract"; cause = "one"; push(false, "Only one element is above the limit of detection: the procedure asks for a new extraction.", "one"); }
    else { decision = "report"; result = cv.every(/* @r2fn R2-C0060-F00049 */c => c === "detected") ? "both" : cv.every(/* @r2fn R2-C0060-F00050 */c => c === "not detected") ? "none" : "below";
      cause = result === "below" ? "belowLod" : lateNtc ? "lateNtc" : d.assays.p35s.S.flat().concat(d.assays.tnos.S.flat()).some(/* @r2fn R2-C0060-F00051 */v => v === null) && cv.every(/* @r2fn R2-C0060-F00052 */c => c === "detected") ? "dropout" : "normal"; }
    return { checks: chk, decision, also, cause, result };
  }

  /* ---------------- presentation ---------------- */
  let state = null;   // { c, seed, d, j, stage: cause|decision|result|done, pen, wrong:Set, fb }
  const cqTxt = /* @r2fn R2-C0060-F00053 */v => v === null ? "–" : v.toFixed(2);
  /* @r2fn R2-C0060-F00054 */function table(d, hints) {
    const R = RULES(), refAll = d.assays.ref.S.flat().filter(/* @r2fn R2-C0060-F00055 */v => amp(v, R)), refBad = !refAll.length || mean(refAll) < R.taxon[0] || mean(refAll) > R.taxon[1];
    const cell = /* @r2fn R2-C0060-F00056 */(arr, el, role) => { const cls = arr.some(/* @r2fn R2-C0060-F00057 */v => amp(v, R)) && (role === "NTC" || role === "BLK") ? "badcell" : arr.filter(/* @r2fn R2-C0060-F00058 */v => amp(v, R)).length < arr.length && role === "LOD" ? "badcell" : arr.every(/* @r2fn R2-C0060-F00059 */v => !amp(v, R)) && role === "POS" ? "badcell" : role === "S" && el === "ref" && refBad ? "badcell" : "";
      return `<td class="${hints ? cls : ""}">${arr.map(cqTxt).join(", ")}${hints && arr.filter(/* @r2fn R2-C0060-F00060 */v => amp(v, R)).length > 1 ? `<br><small>mean ${mean(arr.filter(/* @r2fn R2-C0060-F00061 */v => amp(v, R))).toFixed(2)}</small>` : ""}</td>`; };
    const cols = ["p35s", "tnos", "ref"], head = cols.map(/* @r2fn R2-C0060-F00062 */k => k === "ref" ? NAMES.ref[d.crop] : NAMES[k]);
    const row = /* @r2fn R2-C0060-F00063 */(label, role, get) => `<tr><td class="l">${label}</td>${cols.map(/* @r2fn R2-C0060-F00064 */k => { const A = d.assays[k], v = get(A); return v ? cell(v, k, role) : `<td><small>not tested</small></td>`; }).join("")}</tr>`;
    return `<div class="scroll"><table class="cq"><tr><th class="l">Material</th>${head.map(/* @r2fn R2-C0060-F00065 */h => `<th>${esc(h)}</th>`).join("")}</tr>
      ${row("PC at LOD (CRM 0.1 %), 2 tubes", "LOD", /* @r2fn R2-C0060-F00066 */A => A.LOD)}${row("Positive sample", "POS", /* @r2fn R2-C0060-F00067 */A => A.POS)}${row("NTC", "NTC", /* @r2fn R2-C0060-F00068 */A => A.NTC)}${row("Extraction blank", "BLK", /* @r2fn R2-C0060-F00069 */A => A.BLK)}
      ${[0, 1, 2].map(/* @r2fn R2-C0060-F00070 */e => row(`Sample, extract E${e + 1} (3 PCR replicates)`, "S", /* @r2fn R2-C0060-F00071 */A => A.S[e])).join("")}</table></div><small>Cq by second-derivative maximum; "–" = no amplification within ${RULES().negativeCq} cycles.</small>`;
  }
  /* @r2fn R2-C0060-F00072 */function curves(d, el, box) {
    const r = L.rng(7 + el.length), s = 1.5, cyc = Array.from({ length: 45 }, /* @r2fn R2-C0060-F00073 */(_, i) => i + 1), A0 = el === "ref" ? 1 : 0.8;
    const curve = /* @r2fn R2-C0060-F00074 */cq => cyc.map(/* @r2fn R2-C0060-F00075 */c => (cq === null ? 0 : A0 / (1 + Math.exp(-(c - (cq + s * Math.log(9))) / s))) + (r() - 0.5) * 0.012 * A0);
    const A = d.assays[el], series = [], add = /* @r2fn R2-C0060-F00076 */(arr, color, label) => arr.forEach(/* @r2fn R2-C0060-F00077 */(v, i) => series.push({ x: cyc, y: curve(v), color, width: 1.4, label: i ? undefined : label }));
    if (A.LOD) add(A.LOD, "#a855f7", "PC at LOD"); if (A.POS) add(A.POS, "var(--s1)", "positive sample"); add(A.NTC, "var(--s3)", "NTC"); add(A.BLK, "var(--muted)", "extraction blank"); add(A.S.flat(), "var(--s2)", "sample");
    series.push({ x: [1, 45], y: [A0 / 10, A0 / 10], color: "var(--bad)", dash: "4 3", width: 1 });
    R2.chart(box, { series, xlab: "cycle", ylab: "fluorescence (relative)", height: 220 });
    box.insertAdjacentHTML("beforeend", R2.legend([["PC at LOD", "#a855f7"], ["positive sample", "var(--s1)"], ["NTC", "var(--s3)"], ["extraction blank", "var(--muted)"], ["sample", "var(--s2)"]]));
  }
  /* @r2fn R2-C0060-F00078 */function newCase(lv, id) {
    const pool = CASES.filter(/* @r2fn R2-C0060-F00079 */c => c.lv === lv), rec = store.get()[lv] || {};
    const c = id ? CASES.find(/* @r2fn R2-C0060-F00080 */x => x.id === id) : L.shuffle(pool, L.rng(Date.now() >>> 0)).sort(/* @r2fn R2-C0060-F00081 */(a, b) => ((rec[a.id] || {}).n || 0) - ((rec[b.id] || {}).n || 0))[0];
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, d = generate(c, seed), j = judge(d);
    const r = L.rng(seed ^ 0x5bd1e995), others = L.shuffle(Object.keys(CAUSE).filter(/* @r2fn R2-C0060-F00082 */k => k !== j.cause), r).slice(0, 3);
    state = { lv, c, seed, d, j, stage: lv === "intermediate" ? "cause" : "decision", pen: 0, wrong: new Set(), fb: "", causes: L.shuffle([j.cause, ...others], r), assay: "p35s" };
    draw();
  }
  /* @r2fn R2-C0060-F00083 */function draw() {
    const box = $("qc-case"); if (!state) { box.innerHTML = `<div class="panel"><p class="note">Start a case. Each attempt draws new Cq values with the natural variation of real runs.</p></div>`; return; }
    const s = state, hints = s.lv === "beginner", R = RULES(), done = s.stage === "done";
    const q = s.stage === "cause" ? `<h4 style="margin:0">1 · What is the key finding?</h4><div class="choices">${s.causes.map(/* @r2fn R2-C0060-F00084 */k => `<button type="button" data-cause="${k}" class="${s.wrong.has("c:" + k) ? "wrong" : ""}" ${s.wrong.has("c:" + k) ? "disabled" : ""}>${esc(CAUSE[k])}</button>`).join("")}</div>` :
      s.stage === "decision" ? `<h4 style="margin:0">${s.lv === "intermediate" ? "2 · " : ""}Your decision</h4><div class="choices">${Object.entries(DEC).map(/* @r2fn R2-C0060-F00085 */([k, t]) => `<button type="button" data-dec="${k}" class="${s.wrong.has("d:" + k) ? "wrong" : ""}" ${s.wrong.has("d:" + k) ? "disabled" : ""}>${esc(t)}</button>`).join("")}</div>` :
      s.stage === "result" ? `<h4 style="margin:0">Which result do you report?</h4><div class="choices">${Object.entries(RES).map(/* @r2fn R2-C0060-F00086 */([k, t]) => `<button type="button" data-res="${k}" class="${s.wrong.has("r:" + k) ? "wrong" : ""}" ${s.wrong.has("r:" + k) ? "disabled" : ""}>${esc(t)}</button>`).join("")}</div>` : "";
    box.innerHTML = `<div class="panel"><h3>${esc(s.c.title)} <small>${s.lv === "beginner" ? "Beginner" : "Intermediate"} screening case</small></h3><p>${esc(s.c.text)}</p>
      ${hints ? `<div class="flag"><span class="pill off">rules</span><span>Run valid when, for P-35S and T-nos: PC at LOD amplified in both tubes with mean Cq ${R.lod[0]}–${R.lod[1]}; positive sample amplified; NTC and extraction blank without amplification (a signal at Cq ≥ ${R.negativeCq} counts as none). Sample DNA accepted when the reference gene mean Cq is ${R.taxon[0]}–${R.taxon[1]} (below: dilute; above or absent: extract again). Element detected when the sample mean Cq is below the PC at LOD mean; only one element detected: extract again.</span></div>` :
        `<details><summary>Acceptance rules</summary><p class="note">PC at LOD ${R.lod[0]}–${R.lod[1]} (both tubes); reference gene ${R.taxon[0]}–${R.taxon[1]}; no amplification below Cq ${R.negativeCq} in NTC and blank; positive sample amplified.</p></details>`}
      ${table(s.d, hints)}
      <div class="row"><label>Curves of <select id="qc-assay"><option value="p35s">P-35S</option><option value="tnos">T-nos</option><option value="ref">${esc(NAMES.ref[s.d.crop])}</option></select></label></div><div id="qc-curves"></div>
      ${q}<p class="note" role="status">${esc(s.fb)}</p>
      ${done ? `<div class="flag"><span class="pill ${s.pen ? "warn" : "ok"}">${Math.max(2, 10 - s.pen)} of 10</span><span><b>Expected: ${esc(DEC[s.j.decision])}${s.j.result ? " — " + esc(RES[s.j.result]) : ""}.</b> Key finding: ${esc(CAUSE[s.j.cause])}.</span></div>
        <div class="stack" style="gap:3px">${s.j.checks.map(/* @r2fn R2-C0060-F00087 */x => `<div class="flag"><span class="pill ${x.ok ? "ok" : "bad"}">${x.ok ? "pass" : "fail"}</span><span>${esc(x.text)}</span></div>`).join("")}</div>
        <div class="row"><button class="primary" data-qc-next>Next case</button><button data-qc-again>Same case, new values</button></div>` : ""}</div>`;
    $("qc-assay").value = s.assay; curves(s.d, s.assay, $("qc-curves"));
  }
  /* @r2fn R2-C0060-F00088 */function finish() {
    const s = state; s.stage = "done"; const all = store.get(), lv = all[s.lv] = all[s.lv] || {}, was = lv[s.c.id] || { best: 0, n: 0 };
    lv[s.c.id] = { best: Math.max(was.best, Math.max(2, 10 - s.pen)), n: was.n + 1, last: new Date().toISOString() }; store.put(all); scoreLine();
  }
  /* @r2fn R2-C0060-F00089 */function answer(kind, k) {
    const s = state, j = s.j;
    if (kind === "cause") { if (k === j.cause) { s.stage = "decision"; s.fb = "Right finding. Now decide."; } else { s.pen += 3; s.wrong.add("c:" + k); s.fb = "Look again at the controls and the sample means (−3)."; } }
    if (kind === "dec") {
      if (k === j.decision) { if (k === "report") { s.stage = "result"; s.fb = "The run and the sample DNA pass: report. Which result?"; } else { s.fb = "Right decision."; finish(); } }
      else if (k === j.also) { s.pen += 5; s.fb = "Acceptable under the procedure (the run is not valid), but the contamination came through extraction: repeating the PCR on the same extracts can carry it again. Extract again with a new blank (−5)."; finish(); }
      else { s.pen += 4; s.wrong.add("d:" + k); s.fb = k === "report" ? "Something blocks the result: check every control and the reference gene (−4)." : "Not the decision the procedure asks for here (−4)."; }
    }
    if (kind === "res") { if (k === j.result) { s.fb = "Right result."; finish(); } else { s.pen += 3; s.wrong.add("r:" + k); s.fb = "Compare each element's sample mean with its PC at LOD mean (−3)."; } }
    draw();
  }
  /* @r2fn R2-C0060-F00090 */function scoreLine() {
    const all = store.get();
    for (const lv of ["beginner", "intermediate"]) { const el = $("qc-score-" + lv); if (!el) continue; const pool = CASES.filter(/* @r2fn R2-C0060-F00091 */c => c.lv === lv), rec = all[lv] || {};
      el.textContent = `${pool.reduce(/* @r2fn R2-C0060-F00092 */(s, c) => s + ((rec[c.id] || {}).best || 0), 0)} of ${pool.length * 10} points · ${pool.filter(/* @r2fn R2-C0060-F00093 */c => rec[c.id]).length} of ${pool.length} cases`; }
  }

  /* ---------------- Intermediate: short review of filed runs ---------------- */
  let picked = null, pickedEv = null;
  /* @r2fn R2-C0060-F00094 */function review() {
    const box = $("qc-review"); if (!box) return; const runs = (R2.session.runs || []).slice().reverse();
    if (!runs.length) { box.innerHTML = `<p class="note">No run filed yet in this browser tab. Run one on the technician bench; it appears here.</p>`; return; }
    if (!picked || !runs.includes(picked)) picked = runs.includes(R2.session.run) ? R2.session.run : runs[0];
    try { pickedEv = R2.gmoeval.run(picked, { cqMethod: picked.gmo.lab && R2.LAB[picked.gmo.lab] ? R2.LAB[picked.gmo.lab].rules.cqMethod : "threshold", thresholds: {} }); } catch (err) { pickedEv = null; }
    const ev = pickedEv, list = ev ? (ev.samples && ev.samples.length ? ev.samples : [{ no: 1, name: picked.samples?.[0]?.name || picked.name, ev }]) : [];
    const txt = /* @r2fn R2-C0060-F00095 */e => e.mara ? e.mara.statement : e.lab ? e.lab.overall : e.stage === "quant" ? (e.gmPct !== undefined ? e.gmPct.toFixed(2) + " % GM" : e.quantStatus || "inconclusive") : e.order.filter(/* @r2fn R2-C0060-F00096 */id => e.assays[id].kind !== "taxon").map(/* @r2fn R2-C0060-F00097 */id => e.assays[id].name + ": " + e.assays[id].reported).join("; ");
    const fl = ev ? [...new Map(list.flatMap(/* @r2fn R2-C0060-F00098 */x => x.ev.findings || []).filter(/* @r2fn R2-C0060-F00099 */f => f.level !== "info").map(/* @r2fn R2-C0060-F00100 */f => [f.text, f])).values()] : [];
    box.innerHTML = `<div class="row"><label>Run <select id="qr-run" style="max-width:min(560px,85vw)">${runs.map(/* @r2fn R2-C0060-F00101 */r => `<option value="${r.no}" ${r === picked ? "selected" : ""}>${esc(r.name)} · ${esc(r.outcome)}</option>`).join("")}</select></label></div>
      ${ev ? `<div class="scroll"><table><tr><th>No.</th><th class="l">Sample</th><th class="l">Result</th></tr>${list.map(/* @r2fn R2-C0060-F00102 */x => `<tr><td>${x.no}</td><td class="l">${esc(picked.samples?.find(/* @r2fn R2-C0060-F00103 */s => s.no === x.no)?.name || x.name)}</td><td class="l"><b>${esc(txt(x.ev))}</b></td></tr>`).join("")}</table></div>
      <div class="stack" style="gap:4px">${fl.length ? fl.slice(0, 8).map(/* @r2fn R2-C0060-F00104 */f => `<div class="flag"><span class="pill ${f.level === "fail" ? "bad" : "warn"}">${f.level === "fail" ? "fail" : "check"}</span><span>${esc(f.text)}</span></div>`).join("") : `<div class="flag"><span class="pill ok">clear</span><span>No failed or questionable check.</span></div>`}</div>` : `<p class="note">This run could not be evaluated here; open the full review.</p>`}
      <div class="row"><button id="qr-rdmlt" class="primary">RDMLt (.rdmlt)</button><button id="qr-sop">SOP (.json)</button><button id="qr-full">Open the full review (Expert)</button></div>
      <p class="note">SOP of this analysis: <code>${esc(R2.sop.idOfRun(picked))}</code>. Runs of the same analysis share it.</p>`;
    $("qr-run").onchange = /* @r2fn R2-C0060-F00105 */e => { picked = runs.find(/* @r2fn R2-C0060-F00106 */r => r.no === +e.target.value); review(); };
    const base = /* @r2fn R2-C0060-F00107 */() => picked.name.replace(/[^A-Za-z0-9_-]/g, "_");
    $("qr-rdmlt").onclick = /* @r2fn R2-C0060-F00108 */() => R2.downloadAsync($("qr-rdmlt"), base() + ".rdmlt", /* @r2fn R2-C0060-F00109 */() => R2.rdmltCompressed(picked, pickedEv || R2.gmoeval.run(picked, { cqMethod: "auto", thresholds: {} })));
    $("qr-sop").onclick = /* @r2fn R2-C0060-F00110 */() => R2.download(R2.sop.idOfRun(picked) + ".json", R2.sopJson(picked), "application/json");
    $("qr-full").onclick = /* @r2fn R2-C0060-F00111 */() => { R2.session.run = picked; L.set("quality", "expert"); };
  }

  /* ---------------- Administrator ---------------- */
  /* @r2fn R2-C0060-F00112 */function admin() {
    const box = $("q-admin"), runs = R2.session.runs || [], groups = new Map();
    for (const r of runs) { let id = "–"; try { id = R2.sop.idOfRun(r); } catch {} if (!groups.has(id)) groups.set(id, []); groups.get(id).push(r); }
    const R = RULES();
    box.innerHTML = `<div class="grid two"><div class="panel"><h3>SOP registry <small>${groups.size} SOP${groups.size === 1 ? "" : "s"}, ${runs.length} run${runs.length === 1 ? "" : "s"}</small></h3>
        <div class="scroll" style="max-height:260px"><table><tr><th class="l">SOP</th><th>Runs</th><th class="l">Run names</th><th></th></tr>${[...groups].map(/* @r2fn R2-C0060-F00113 */([id, rs]) => `<tr><td class="l"><code>${esc(id)}</code></td><td>${rs.length}</td><td class="l">${esc(rs.map(/* @r2fn R2-C0060-F00114 */r => r.name).join(", "))}</td><td><button data-qa-sop="${rs[0].no}">SOP (.json)</button></td></tr>`).join("") || `<tr><td class="l" colspan="4">No run filed yet.</td></tr>`}</table></div>
        <p class="note">One SOP per analysis: the identity is the SHA-256 of the analysis definition (layout rule, not well positions or sample count). Bulk downloads are in the run files panel below.</p></div>
      <div class="panel"><h3>Acceptance rules in use <small>read only</small></h3><dl class="kv"><dt>Simplex screening</dt><dd>PC at LOD mean Cq ${R.lod.join("–")} (both tubes); reference gene ${R.taxon.join("–")}; negative from Cq ${R.negativeCq}; Cq method ${esc(R.cqMethod || "sdm")}</dd>
          <dt>Calibration curves</dt><dd>slope −3.1 to −3.6, R² ≥ 0.98 (ENGL minimum performance requirements)</dd><dt>Natural variation of the training cases</dt><dd>run SD ${SD.run}, extraction SD ${SD.ext}, tube SD ${SD.tube} cycles</dd></dl>
        <h4 style="margin:4px 0">Training records</h4><div class="row"><button id="qa-rec">Download training records (.json)</button><button id="qa-reset" class="danger">Reset quality case scores</button></div><p class="note" id="qa-msg" role="status"></p></div></div>`;
    box.onclick = /* @r2fn R2-C0060-F00115 */e => { const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.qaSop) { const r = runs.find(/* @r2fn R2-C0060-F00116 */x => x.no === +b.dataset.qaSop); R2.download(R2.sop.idOfRun(r) + ".json", R2.sopJson(r), "application/json"); }
      if (b.id === "qa-rec") R2.download("MISSY_R2_training_records_" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(L.records(), null, 1), "application/json");
      if (b.id === "qa-reset") { store.put({ beginner: {}, intermediate: {} }); scoreLine(); $("qa-msg").textContent = "Quality case scores reset."; } };
  }

  let curLv = "expert";
  /* @r2fn R2-C0060-F00117 */function build() {
    const box = $("q-guided");
    if (!box.childElementCount) {
      box.innerHTML = `<div class="panel"><h3>Training cases <small class="lv-b" id="qc-score-beginner"></small><small class="lv-i" id="qc-score-intermediate"></small></h3>
          <p class="note lv-b">One clear fault per case. Read the controls against the rules, then decide: report, repeat the PCR, dilute and repeat, or extract again.</p>
          <p class="note lv-i">Subtler cases, no hints: name the key finding (−3 per wrong answer), then decide (−4), then the result if you report (−3).</p>
          <div class="row"><button id="qc-new" class="primary">New case</button><label>or choose <select id="qc-pick"><option value="">the next case</option></select></label></div></div>
        <div id="qc-case"></div>
        <div class="panel lv-i"><h3>Short review of the filed runs</h3><div id="qc-review" class="stack" style="gap:8px"></div></div>`;
      $("qc-new").onclick = /* @r2fn R2-C0060-F00118 */() => newCase(curLv, $("qc-pick").value || null);
      $("qc-case").addEventListener("click", /* @r2fn R2-C0060-F00119 */e => { const b = e.target.closest("button"); if (!b || !state) return;
        if (b.dataset.cause) answer("cause", b.dataset.cause); else if (b.dataset.dec) answer("dec", b.dataset.dec); else if (b.dataset.res) answer("res", b.dataset.res);
        else if (b.hasAttribute("data-qc-next")) newCase(curLv); else if (b.hasAttribute("data-qc-again")) newCase(curLv, state.c.id); });
      $("qc-case").addEventListener("change", /* @r2fn R2-C0060-F00120 */e => { if (e.target.id === "qc-assay" && state) { state.assay = e.target.value; const b = $("qc-curves"); b.innerHTML = ""; curves(state.d, state.assay, b); } });
    }
    $("qc-pick").innerHTML = `<option value="">the next case</option>` + CASES.filter(/* @r2fn R2-C0060-F00121 */c => c.lv === curLv).map(/* @r2fn R2-C0060-F00122 */c => `<option value="${c.id}">${esc(c.title)}</option>`).join("");
    if (state && state.lv !== curLv) state = null;
    scoreLine(); draw(); review();
  }
  L.on("quality", /* @r2fn R2-C0060-F00123 */lv => { curLv = lv; if (lv === "beginner" || lv === "intermediate") build(); if (lv === "admin") admin(); });
  R2.qmCases = { CASES, generate, judge, newCase, answer, state: /* @r2fn R2-C0060-F00124 */() => state };
})(window.R2);
