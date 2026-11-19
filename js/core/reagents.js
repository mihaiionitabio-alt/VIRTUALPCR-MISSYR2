/* Reagents and handling: how primer and probe concentration, probe chemistry, storage, light and bench conditions
 * change the reaction that goes into a tube. Output: the inputs of the kinetic model (chemistry.js) and of the probe
 * model (plant.js), plus a plain-language list of what each setting did.
 * Every number in this file is a teaching assumption chosen for plausible direction and order of magnitude.
 * None is a measured property of any product; the comments say what each one stands for. */
(/* @r2fn R2-C0033-F00001 */function (R2) {
  "use strict";
  const G = R2.reagents = {}, O = R2.oligo, K = 45;        // K: detector counts per nmol/L of free reporter (same constant as plant.js)
  G.DEFAULT = { primerF: 1, primerR: 1, probe: 1,            // multiples of the method's concentration
    quencher: "method", probeMismatch: false,
    probeStoreC: -20, probeMonths: 0, probeLightH: 0, freezeThaw: 0,
    primerStoreC: -20, primerMonths: 0, mixStoreC: -20, mixMonths: 0,
    hotStart: true, benchMin: 5, ambientC: 22, carryover: 0, ungActive: true, pipetCV: 0, inhibitor: 0 };        // pipetCV: extra scatter on top of the natural variation (gmoplan.VARIATION)
  // quenching efficiency of the intact probe (share of reporter light suppressed). TAMRA is itself fluorescent and quenches
  // less completely than dark quenchers; short MGB probes hold reporter and quencher close together.
  G.QUENCH = { TAMRA: 0.90, TAM: 0.90, BHQ1: 0.92, BBQ: 0.92, MGBNFQ: 0.935 };      // with these, plateau/baseline comes out near 2.2 to 3, as in real runs
  G.quenchers = ["TAMRA", "BHQ1", "MGBNFQ"];
  // half-life (days) of an oligonucleotide in solution against storage temperature: log-linear between anchor points
  const HL = [[-80, 73000], [-20, 14600], [4, 2920], [22, 730], [37, 180]];
  G.halfLifeDays = /* @r2fn R2-C0033-F00002 */function (c) { if (c <= HL[0][0]) return HL[0][1]; for (let i = 1; i < HL.length; i++) if (c <= HL[i][0]) { const f = (c - HL[i - 1][0]) / (HL[i][0] - HL[i - 1][0]); return Math.exp(Math.log(HL[i - 1][1]) * (1 - f) + Math.log(HL[i][1]) * f); } return HL[HL.length - 1][1] * Math.pow(0.5, (c - 37) / 8); };
  const intact = /* @r2fn R2-C0033-F00003 */(c, months, hlFactor) => Math.pow(0.5, months * 30.4 / (G.halfLifeDays(c) * (hlFactor || 1)));
  // reporter photobleaching in ambient laboratory light, clear tube: half-life in hours
  G.BLEACH_H = { FAM: 24, VIC: 48, HEX: 48, YY: 40 };
  G.channelOf = /* @r2fn R2-C0033-F00004 */dye => dye === "FAM" || !dye ? 0 : 1;
  // minor-groove binder: raises the Tm of a short probe (larger gain for shorter probes)
  G.mgbBonus = /* @r2fn R2-C0033-F00005 */len => R2.clamp(30 - 0.8 * len, 10, 20);
  G.COND = { mono: 0.05, mg: 0.003 };       // reaction buffer assumed for Tm: 50 mM monovalent, 3 mM free Mg2+

  /* method: entry of R2.GMO.methods; s: settings (G.DEFAULT shape); well: { copies, isSample, imperfect, annealC, ungStep }.
   * Returns { a: assay for the instrument model, info: {...numbers for display} }. */
  G.build = /* @r2fn R2-C0033-F00006 */function (m, s, well, rng) {
    s = Object.assign({}, G.DEFAULT, s); const info = {};
    const pI = intact(s.primerStoreC, s.primerMonths, 3);                         // unlabelled primers: three times the half-life of a labelled probe
    const F = m.nM[0] * s.primerF * pI, R = m.nM[1] * s.primerR * pI, lim = Math.min(F, R);
    const tmF = O.tmNN(m.F[1], { mono: G.COND.mono, mg: G.COND.mg, oligo: Math.max(F, 1) * 1e-9 / 2 }), tmR = O.tmNN(m.R[1], { mono: G.COND.mono, mg: G.COND.mg, oligo: Math.max(R, 1) * 1e-9 / 2 });
    const mmPen = well.imperfect ? 120 / Math.min(m.F[1].length, m.R[1].length) : 0;    // one mismatch in the shorter primer: about 1.2 °C per percent of bases
    const d3 = Math.max(O.dimer3(m.F[1], m.R[1]), O.dimer3(m.R[1], m.F[1]), O.dimer3(m.F[1], m.F[1]), O.dimer3(m.R[1], m.R[1]));
    const known = (m.amp || "").replace(/N/g, ""), gc = known ? O.gc(known) : 50, salt = O.saltEq(50, 3, 0.8);
    const mix = intact(s.mixStoreC, s.mixMonths, 0.4);                              // polymerase in the master mix: less stable than an oligonucleotide
    let eff = Math.min(0.99, (m.eff ? R2.clamp(m.eff, 85, 99) / 100 : 0.94) + 0.01);
    const inh = well.isSample ? R2.clamp((well.inhibitor || 0) + s.inhibitor, 0, 0.9) : 0;
    eff *= (1 - 0.45 * inh) * (0.85 + 0.15 * mix);
    const a = { kind: "reaction", copies: well.copies, amplicon_bp: m.bp, amplicon_tm: 81.5 + 16.6 * Math.log10(salt) + 0.41 * gc - 675 / m.bp,
      primer_tm: Math.min(tmF, tmR) + 2 - mmPen,                                   // +2 °C: primers are in large excess, so priming stays effective slightly above Tm
      primer_nM: Math.max(1, lim), primer_ref_nM: Math.min(m.nM[0], m.nM[1]), dimer_rate: 0.3 * (F * R) / 9e4 * Math.min(6, Math.pow(2, Math.max(0, d3 - 3))), dimer_bp: Math.min(50, m.F[1].length + m.R[1].length - d3), dimer_tm: 72,
      hot_start: !!s.hotStart, enz: mix * (1 - 0.5 * inh), eff, noRef: true };
    if (!s.hotStart) a.dimer0 = a.dimer_rate * s.benchMin * 60 * R2.sigm((s.ambientC - 12) / 6) * 0.2;   // without hot start the polymerase works on the bench
    Object.assign(info, { F, R, tmF, tmR, primerIntact: pI, mix, eff, dimer3: d3, ampliconTm: a.amplicon_tm, inhibitor: inh, imperfect: !!well.imperfect });
    if (m.P) {
      const dye = m.P[1], qn = s.quencher === "method" ? m.P[3] : s.quencher, q = G.QUENCH[qn] || 0.95, mgb = qn === "MGBNFQ";
      const nominal = m.nM[2] * s.probe, ok = intact(s.probeStoreC, s.probeMonths, 1) * Math.pow(0.998, s.freezeThaw);
      const bleach = 1 - Math.pow(0.5, s.probeLightH / (G.BLEACH_H[dye] || 32));
      const len = m.P[2].length, tm0 = O.tmNN(m.P[2], { mono: G.COND.mono, mg: G.COND.mg, oligo: Math.max(nominal, 1) * 1e-9 / 2 });
      const tm = tm0 + (mgb ? G.mgbBonus(len) : 0) - (s.probeMismatch ? 120 / len * (mgb ? 1.6 : 1) : 0);   // a mismatch costs a short MGB probe more: that is its specificity
      a.probe = { methodId: m.id, nM: nominal * ok * (1 - bleach), darkNM: nominal * ok * bleach, freeNM: nominal * (1 - ok) * (1 - bleach), tm, width: mgb ? 1.4 : 2.2, q, channel: G.channelOf(dye), annS: well.annS || 60 };
      a.eff *= 1 - 0.12 * Math.max(0, (nominal - 300) / 300);                       // a large excess of probe gets in the polymerase's way
      Object.assign(info, { dye, quencher: qn, probeNominal: nominal, probeIntact: ok, bleached: bleach, probeTm: tm, probeTm0: tm0, mgb, q, channel: a.probe.channel,
        baseline: K * (a.probe.nM * (1 - q) + a.probe.freeNM), plateau: K * a.probe.nM * 0.15 * q, bound: R2.sigm((tm - well.annealC) / a.probe.width) * (1 - Math.exp(-2e-3 * (a.probe.nM + a.probe.darkNM) * (well.annS || 60))) });
    } else Object.assign(info, { dye: "SYBR", channel: 0 });
    if (s.carryover > 0) a.copies += s.carryover * (well.ungStep && s.ungActive ? 0.001 : 1);          // amplicon carried over from earlier runs; UNG destroys dU-containing product
    if (rng && s.pipetCV > 0) a.copies *= Math.max(0, 1 + s.pipetCV / 100 * rng.gauss());
    return { a, info };
  };
  // plain-language account of the settings for one method
  G.explain = /* @r2fn R2-C0033-F00007 */function (m, s, annealC) {
    const b = G.build(m, s, { copies: 0, isSample: false, annealC, ungStep: m.cyc[0] > 0 }, null), i = b.info, out = [], nom = G.build(m, G.DEFAULT, { copies: 0, annealC, ungStep: m.cyc[0] > 0 }, null).info;
    const pct = /* @r2fn R2-C0033-F00008 */v => (v * 100).toFixed(0) + " %";
    out.push(`Primers ${i.F.toFixed(0)} / ${i.R.toFixed(0)} nmol/L (Tm ${i.tmF.toFixed(1)} / ${i.tmR.toFixed(1)} °C).` + (Math.min(i.tmF, i.tmR) + 2 < annealC ? " The weaker primer binds poorly at " + annealC + " °C." : "") + (i.F !== i.R ? " The lower concentration limits the product." : ""));
    if (i.primerIntact < 0.97) out.push(`Primer storage: ${pct(i.primerIntact)} still intact.`);
    if (i.dimer3 >= 5) out.push(`The primers can pair over ${i.dimer3} bases at a 3′ end: more primer means more primer-dimer.` + (m.P ? " A probe does not report dimers, but they use up primers." : " SYBR Green reports them."));
    if (m.P) {
      out.push(`Probe ${i.dye}–${i.quencher}, ${i.probeNominal.toFixed(0)} nmol/L, binds at about ${i.probeTm.toFixed(1)} °C` + (i.mgb ? ` (${i.probeTm0.toFixed(1)} °C without the minor-groove binder)` : "") + `: about ${pct(i.bound)} of new strands pick up a probe at ${annealC} °C.`);
      if (i.probeIntact < 0.98) out.push(`Probe storage: ${pct(1 - i.probeIntact)} is hydrolysed. Free reporter raises the baseline; less intact probe lowers the plateau.`);
      if (i.bleached > 0.02) out.push(`Light: ${pct(i.bleached)} of the reporter is bleached. Those probes still bind and are cut but give no light.`);
      out.push(`Expected baseline ${i.baseline.toFixed(0)} counts (${(i.baseline / Math.max(1, nom.baseline)).toFixed(2)} × the method's), highest possible rise ${i.plateau.toFixed(0)} counts (${(i.plateau / Math.max(1, nom.plateau)).toFixed(2)} ×).`);
      if (s.probeMismatch) out.push(`Target variant with one mismatch under the probe: the probe binds ${(G.build(m, Object.assign({}, s, { probeMismatch: false }), { copies: 0, annealC }, null).info.probeTm - i.probeTm).toFixed(1)} °C lower. Short minor-groove-binder probes lose the most, which is why they tell single-base variants apart.`);
    }
    if (i.mix < 0.97) out.push(`Master mix storage: ${pct(i.mix)} of the polymerase activity is left.`);
    if (!s.hotStart) out.push(`No hot start: during ${s.benchMin} min on the bench at ${s.ambientC} °C the polymerase can extend mis-paired primers.`);
    if (s.carryover > 0) out.push(`Carry-over of ${s.carryover} amplicon copies per tube; ` + (m.cyc[0] > 0 && s.ungActive ? "the UNG step removes about 99.9 % of it." : "nothing removes it, so controls without template will rise too."));
    return out;
  };
})(window.R2);
