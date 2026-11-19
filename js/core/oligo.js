/* Primer and amplicon properties from sequence, feeding the reaction model.
 * Methods as described for the PCR design platform of Kalendar (Mol Ther Nucleic Acids 2025, 36:102716, CC BY 4.0):
 * nearest-neighbour Tm (unified parameters of Allawi and SantaLucia / SantaLucia 1998) with the Owczarzy salt
 * corrections, linguistic complexity, a 3'-end dimer check (ungapped alignment) and in silico PCR on a target.
 * The methods and site-wide conditions follow the PCRtools source (github.com/rkalendar/PCRtools, GPL-3.0), which was
 * read to match its definitions; the code here is written independently and none of it is copied. */
(/* @r2fn R2-C0030-F00001 */function (R2) {
  "use strict";
  const O = R2.oligo = {};
  const NN = { AA: [-7.9, -22.2], TT: [-7.9, -22.2], AT: [-7.2, -20.4], TA: [-7.2, -21.3], CA: [-8.5, -22.7], TG: [-8.5, -22.7], GT: [-8.4, -22.4], AC: [-8.4, -22.4],
    CT: [-7.8, -21.0], AG: [-7.8, -21.0], GA: [-8.2, -22.2], TC: [-8.2, -22.2], CG: [-10.6, -27.2], GC: [-9.8, -24.4], GG: [-8.0, -19.9], CC: [-8.0, -19.9] };
  const COMP = { A: "T", T: "A", C: "G", G: "C" };
  O.clean = /* @r2fn R2-C0030-F00002 */s => String(s || "").toUpperCase().replace(/[^ACGT]/g, "");
  O.revcomp = /* @r2fn R2-C0030-F00003 */s => s.split("").reverse().map(/* @r2fn R2-C0030-F00004 */c => COMP[c]).join("");
  O.gc = /* @r2fn R2-C0030-F00005 */s => { s = O.clean(s); return s.length ? 100 * (s.split("").filter(/* @r2fn R2-C0030-F00006 */c => c === "G" || c === "C").length) / s.length : 0; };
  // monovalent-equivalent salt in M for long duplexes (Na + 120*sqrt(Mg - dNTP), mM; von Ahsen et al. 2001)
  O.saltEq = /* @r2fn R2-C0030-F00007 */(naMM, mgMM, dntpMM) => (naMM + 120 * Math.sqrt(Math.max(0, mgMM - dntpMM))) / 1000;
  // Nearest-neighbour Tm at 1 M Na+, then the salt corrections of Owczarzy et al. (2004 monovalent; 2008 Mg2+), chosen by
  // the ratio sqrt[Mg]/[Mon] as in the 2008 paper. c: { mono (M), mg (M, free), oligo (M) }. Defaults are the PCRtools
  // site-wide conditions (55 mM monovalent, 1 mM Mg2+, 0.2 uM oligonucleotide), which reproduce Table S1.
  // The concentration term is half the stated primer concentration (0.1 uM for 0.2 uM): with that, the 182 Tm values of
  // Table S1 are reproduced within 0.05 degC.
  O.SITE = { mono: 0.055, mg: 0.001, oligo: 0.1e-6 };
  O.tmNN = /* @r2fn R2-C0030-F00008 */function (seq, c) {
    const s = O.clean(seq), n = s.length; if (n < 8) return NaN; c = Object.assign({}, O.SITE, c || {});
    let dH = 0, dS = 0; for (let i = 0; i < n - 1; i++) { const p = NN[s.substr(i, 2)]; dH += p[0]; dS += p[1]; }
    for (const e of [s[0], s[n - 1]]) { if (e === "G" || e === "C") { dH += 0.1; dS += -2.8; } else { dH += 2.3; dS += 4.1; } }
    if (s === O.revcomp(s)) dS -= 1.4;
    let inv = (dS + 1.9872 * Math.log(c.oligo)) / (dH * 1000);
    const f = O.gc(s) / 100, mon = Math.max(c.mono, 1e-6), lm = Math.log(mon), R = c.mg > 0 ? Math.sqrt(c.mg) / mon : 0;
    if (R < 0.22) inv += (4.29 * f - 3.95) * 1e-5 * lm + 9.40e-6 * lm * lm;
    else {
      const lg = Math.log(c.mg); let a = 3.92e-5, d = 1.42e-5, g = 8.31e-5;
      if (R < 6.0) { a *= 0.843 - 0.352 * Math.sqrt(mon) * lm; d *= 1.279 - 4.03e-3 * lm - 8.03e-3 * lm * lm; g *= 0.486 - 0.258 * lm + 5.25e-3 * lm * lm * lm; }
      inv += a - 9.11e-6 * lg + f * (6.26e-5 + d * lg) + 1 / (2 * (n - 1)) * (-4.82e-4 + 5.25e-4 * lg + g * lg * lg);
    }
    return 1 / inv - 273.15;
  };
  // long duplex (amplicon): 81.5 + 16.6 log10[salt] + 0.41 %GC - 675/N
  O.tmAmplicon = /* @r2fn R2-C0030-F00009 */(seq, salt) => 81.5 + 16.6 * Math.log10(salt) + 0.41 * O.gc(seq) - 675 / seq.length;
  // Linguistic complexity as PCRtools computes it for a primer: distinct words of 1 to 4 bases found, over the most
  // that a sequence of this length could hold, in whole percent.
  O.complexity = /* @r2fn R2-C0030-F00010 */function (seq) {
    const s = O.clean(seq), L = s.length; if (L < 6) return 100; let obs = 0;
    for (let k = 1; k <= 4; k++) { const set = new Set(); for (let i = 0; i + k <= L; i++) set.add(s.substr(i, k)); obs += set.size; }
    return Math.floor(100 * obs / (4 + Math.min(L - 1, 16) + Math.min(L - 2, 64) + Math.min(L - 3, 256)));
  };
  // longest run of complementary bases in any ungapped antiparallel alignment that includes the 3' end of a
  O.dimer3 = /* @r2fn R2-C0030-F00011 */function (a, b) {
    a = O.clean(a); const rb = O.revcomp(O.clean(b)); let best = 0;       // a's 3' end pairs with b when a's suffix equals a substring of revcomp(b)
    for (let off = 0; off < rb.length; off++) { let n = 0; while (n < a.length && off - n >= 0 && a[a.length - 1 - n] === rb[off - n]) n++; if (n > best) best = n; }
    return best;
  };
  O.sites = /* @r2fn R2-C0030-F00012 */function (target, primer, maxMis) {      // positions where the primer anneals to the bottom strand (i.e. matches the top strand)
    const out = [], n = primer.length; if (n < 8) return out;
    for (let i = 0; i + n <= target.length; i++) { let mis = 0; for (let k = 0; k < n && mis <= maxMis; k++) if (target[i + k] !== primer[k]) { mis++; if (k >= n - 3) mis = 99; } if (mis <= maxMis) out.push({ pos: i, mis }); }
    return out;
  };
  // in silico PCR: every forward site paired with every reverse site downstream of it, within maxLen
  O.pcr = /* @r2fn R2-C0030-F00013 */function (target, fwd, rev, maxLen) {
    const t = O.clean(target), prods = []; let fwdSites = 0, revSites = 0;
    for (const [a, b, swapped] of [[O.clean(fwd), O.clean(rev), false], [O.clean(rev), O.clean(fwd), true]]) {       // either primer may be the one on the top strand
      const rb = O.revcomp(b), fs = O.sites(t, a, 2);
      const rs2 = []; { const n = rb.length; for (let i = 0; i + n <= t.length; i++) { let mis = 0; for (let k = 0; k < n && mis <= 2; k++) if (t[i + k] !== rb[k]) { mis++; if (k < 3) mis = 99; } if (mis <= 2) rs2.push({ pos: i, mis }); } }   // 3' end of the bottom-strand primer is at the left of rb
      if (!swapped) { fwdSites += fs.length; revSites += rs2.length; } else { fwdSites += rs2.length; revSites += fs.length; }
      for (const x of fs) for (const y of rs2) { const len = y.pos + rb.length - x.pos; if (len > a.length + b.length - 5 && len <= (maxLen || 3000)) prods.push({ start: x.pos, len, seq: t.substr(x.pos, len), mismatches: x.mis + y.mis, misF: swapped ? y.mis : x.mis, misR: swapped ? x.mis : y.mis }); }
    }
    prods.sort(/* @r2fn R2-C0030-F00014 */(x, y) => x.mismatches - y.mismatches || x.len - y.len);
    return { fwdSites, revSites, products: prods };
  };
  // everything the technician bench shows, and the inputs of the reaction model derived from it
  O.evaluate = /* @r2fn R2-C0030-F00015 */function (target, fwd, rev, cond) {
    const c = Object.assign({ naMM: 50, mgMM: 3, dntpMM: 0.8, primerNM: 300 }, cond || {}), salt = O.saltEq(c.naMM, c.mgMM, c.dntpMM), f = O.clean(fwd), r = O.clean(rev);
    const pc = { mono: c.naMM / 1000, mg: Math.max(0, c.mgMM - c.dntpMM) / 1000, oligo: c.primerNM * 1e-9 / 2 }, res = { fwd: f, rev: r, salt, warnings: [] };
    res.tmF = O.tmNN(f, pc); res.tmR = O.tmNN(r, pc); res.tmFsite = O.tmNN(f); res.tmRsite = O.tmNN(r); res.gcF = O.gc(f); res.gcR = O.gc(r); res.lcF = O.complexity(f); res.lcR = O.complexity(r);
    res.dimer = Math.max(O.dimer3(f, r), O.dimer3(r, f), O.dimer3(f, f), O.dimer3(r, r));
    const p = O.pcr(target, f, r, 3000); res.pcr = p; res.product = p.products[0] || null;
    // a mismatched primer binds less firmly: about 1.2 degC lower Tm for each percent of mismatched bases (rule of thumb)
    res.tmFeff = res.tmF - (res.product ? 120 * res.product.misF / f.length : 0); res.tmReff = res.tmR - (res.product ? 120 * res.product.misR / r.length : 0);
    if (res.product && res.product.mismatches) res.warnings.push("The primers differ from this target at " + res.product.mismatches + " position" + (res.product.mismatches > 1 ? "s" : "") + ". They still bind, but less firmly: effective annealing near " + Math.min(res.tmFeff, res.tmReff).toFixed(0) + " °C.");
    if (f.length < 15 || r.length < 15) res.warnings.push("A primer is shorter than 15 bases.");
    if (!res.product) res.warnings.push("These primers give no product on this target: the tube will contain primers but nothing they can copy.");
    if (p.products.length > 1) res.warnings.push(p.products.length + " possible products on this target. Only the first is simulated; real reactions would show the others too.");
    if (Math.abs(res.tmF - res.tmR) > 3) res.warnings.push("Primer melting temperatures differ by " + Math.abs(res.tmF - res.tmR).toFixed(1) + " °C; the lower one limits annealing.");
    if (res.dimer >= 5) res.warnings.push("The primers can pair over " + res.dimer + " bases at a 3′ end: primer-dimers are likely.");
    if (res.product && res.product.len > 400) res.warnings.push("A " + res.product.len + " bp product needs time to be copied: allow roughly 1 s per 25 bases at 60 °C, less at 72 °C.");
    if (Math.min(res.lcF, res.lcR) < 75) res.warnings.push("Low sequence complexity (" + Math.min(res.lcF, res.lcR).toFixed(0) + " %): such primers tend to bind in more than one place. Not simulated.");
    if (res.product) { res.ampliconBp = res.product.len; res.ampliconTm = O.tmAmplicon(res.product.seq, salt); res.ampliconGc = O.gc(res.product.seq); }
    // reaction-model inputs: the weaker primer sets annealing; each 3' base pair beyond 3 makes dimers about four times more likely
    res.sim = { primer_tm: Math.min(res.tmFeff, res.tmReff), primer_nM: c.primerNM, dimer_rate: 0.3 * Math.pow(4, Math.max(0, res.dimer - 3)), noProduct: !res.product,
      amplicon_bp: res.product ? res.ampliconBp : 120, amplicon_tm: res.product ? res.ampliconTm : 84, dimer_tm: 70 + 0.2 * (res.gcF + res.gcR) / 2 * 0.4 };
    return res;
  };
})(window.R2);
