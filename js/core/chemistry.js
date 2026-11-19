/* Kinetic model of one PCR well. JavaScript port of firmware/sim/pcr_model.c (see firmware/sim/MODEL.md).
 * Driven only by the liquid temperature; textbook magnitudes, not fitted to any assay. */
(/* @r2fn R2-C0024-F00001 */function (R2) {
  "use strict";
  const C = R2.chem = {}; const NB = 10, NM = 1.2044e10;          // progress bins; molecules per nM in 20 µL
  const K_ANNEAL = 1e-3, K_REANNEAL = 2.5e-3, K_SEP = 5.0, ENZ = 5e10, DNTP = 9.6e15;
  C.NB = NB; C.NM = NM; C.ENZ = ENZ;
  const sigm = R2.sigm, frac = /* @r2fn R2-C0024-F00002 */(rate, dt) => 1 - Math.exp(-rate * dt);
  C.fracOpen = /* @r2fn R2-C0024-F00003 */(t, tm, w) => sigm((t - tm) / w);
  C.primerBound = /* @r2fn R2-C0024-F00004 */(t, tm) => sigm((tm - t) / 1.5);
  C.extension = /* @r2fn R2-C0024-F00005 */t => { const d = (t - 72) / 14; return t > 85 ? 0 : 60 * Math.exp(-d * d); };
  C.enzymeHalfLife = /* @r2fn R2-C0024-F00006 */t => 2400 * Math.exp(-0.5 * (t - 95));
  C.assayDefaults = /* @r2fn R2-C0024-F00007 */() => ({ kind: "reaction", copies: 0, amplicon_bp: 120, amplicon_tm: 84, template_tm: 91, primer_tm: 62, primer_nM: 300,
    eff: 0.95, dimer_rate: 0.3, dimer_bp: 50, dimer_tm: 76, hot_start: true });
  const product = /* @r2fn R2-C0024-F00008 */() => ({ ds: 0, ss: 0, ext: new Float64Array(NB), stalled: 0 });
  C.init = /* @r2fn R2-C0024-F00009 */function (a, rng) {
    const c = { tgt: product(), dim: product(), tmpl: 0, primers: 0, dntp: 0, enzActive: 0, enzBlocked: 0, copiesReal: 0, madeTgt: 0, madeDim: 0 };
    if (a.kind !== "reaction") return c;
    c.copiesReal = rng.poisson(a.copies * (1 + 0.02 * rng.gauss()));
    c.tmpl = c.copiesReal; c.primers = 2 * a.primer_nM * NM; c.dntp = DNTP;
    const enz = ENZ * (a.enz === undefined ? 1 : a.enz);                  // enz: fraction of polymerase activity left in the master mix
    if (a.hot_start) c.enzBlocked = enz; else c.enzActive = enz;
    if (a.dimer0) { const n = Math.min(rng.poisson(a.dimer0), c.primers / 2); c.dim.ds += n; c.primers -= 2 * n; }   // primer-dimers formed on the bench before the run
    return c;
  };
  const primed = /* @r2fn R2-C0024-F00010 */p => { let s = 0; for (let b = 0; b < NB; b++) s += p.ext[b]; return s; };
  C.primed = primed;
  /* @r2fn R2-C0024-F00011 */function productStep(p, c, len, tm, primerTm, eff, served, t, dt) {
    const m = p.ds * frac(K_SEP * C.fracOpen(t, tm + 2, 0.5), dt); p.ds -= m; p.ss += 2 * m;
    { const x = p.stalled * frac(K_SEP * C.fracOpen(t, tm - 2, 0.7), dt); p.stalled -= x; p.ss += x; }
    const offHot = frac(K_SEP * C.fracOpen(t, tm - 4, 1), dt);
    for (let b = 0; b < NB; b++) { const x = p.ext[b] * offHot; p.ext[b] -= x; p.ss += x; }
    const bound = C.primerBound(t, primerTm);
    { const young = Math.min(1, 15 / (len / NB)); const x = p.ext[0] * frac(2 * (1 - bound) * young, dt); p.ext[0] -= x; p.ss += x; c.primers += x; }
    const closed = 1 - C.fracOpen(t, tm, 0.7);
    const rP = K_ANNEAL * (c.primers / 2 / NM) * bound, rR = K_REANNEAL * (p.ss / 2 / NM) * closed, tot = rP + rR;
    const leave = p.ss * frac(tot, dt); let pr = tot > 0 ? leave * rP / tot : 0; const re = leave - pr;
    if (pr > c.primers) pr = c.primers;
    p.ss -= pr + re; p.ext[0] += pr; c.primers -= pr; p.ds += re / 2;
    const v = c.dntp > 0 ? C.extension(t) * served : 0, adv = Math.min(1, v * dt * NB / len);
    const done = p.ext[NB - 1] * adv; p.ext[NB - 1] -= done;
    for (let b = NB - 2; b >= 0; b--) { const x = p.ext[b] * adv; p.ext[b] -= x; p.ext[b + 1] += x; }
    const made = done * eff; p.ds += made; p.stalled += done - made;
    c.dntp = Math.max(0, c.dntp - made * len);
    return made;
  }
  C.step = /* @r2fn R2-C0024-F00012 */function (c, a, t, dt, rng) {
    if (a.kind !== "reaction") return;
    const act = c.enzBlocked * frac(Math.log(2) / 30 * sigm((t - 90) / 1.5), dt); c.enzBlocked -= act; c.enzActive += act;
    c.enzActive *= Math.exp(-Math.log(2) / C.enzymeHalfLife(t) * dt);
    const g = c.tmpl * frac(K_SEP * C.fracOpen(t, a.template_tm + 2, 0.7), dt); c.tmpl -= g; c.tgt.ss += 2 * g;
    const need = primed(c.tgt) + primed(c.dim), served = need <= c.enzActive ? 1 : c.enzActive / need;
    c.madeTgt += productStep(c.tgt, c, a.amplicon_bp, a.amplicon_tm, a.primer_tm, a.eff, served, t, dt);
    c.madeDim += productStep(c.dim, c, a.dimer_bp, a.dimer_tm, a.primer_tm, 0.85, served, t, dt);
    const p0 = 2 * a.primer_nM * NM, pf = p0 > 0 ? c.primers / p0 : 0, ex = C.extension(t);
    const lam = a.dimer_rate * pf * pf * sigm(((a.primer_tm - 12) - t) / 2.5) * (c.enzActive / ENZ) * (ex > 0.05 ? 1 : ex / 0.05) * dt;
    const nd = rng.poisson(lam);
    if (nd > 0 && c.primers >= 2 * nd) { c.dim.ds += nd; c.primers -= 2 * nd; }
  };
  C.dsBasePairs = /* @r2fn R2-C0024-F00013 */function (c, a, t) {
    if (a.kind !== "reaction") return 0;
    let bp = 0; const ps = [c.tgt, c.dim], len = [a.amplicon_bp, a.dimer_bp], tm = [a.amplicon_tm, a.dimer_tm];
    for (let j = 0; j < 2; j++) {
      bp += ps[j].ds * len[j] * (1 - C.fracOpen(t, tm[j], 0.7));
      for (let b = 0; b < NB; b++) bp += ps[j].ext[b] * len[j] * (b + 0.5) / NB * (1 - C.fracOpen(t, tm[j] - 4, 1.5));
    }
    return bp;
  };
  // what the "X-ray" view shows for one well
  C.snapshot = /* @r2fn R2-C0024-F00014 */function (c, a) {
    const p0 = 2 * a.primer_nM * NM;
    return { template: c.tmpl, ds: c.tgt.ds, ss: c.tgt.ss, copying: primed(c.tgt), stalled: c.tgt.stalled, dimer: c.dim.ds + c.dim.ss / 2,
      primers: p0 > 0 ? c.primers / p0 : 0, enzyme: c.enzActive / ENZ, enzymeBlocked: c.enzBlocked / ENZ, copiesReal: c.copiesReal };
  };
})(window.R2);
