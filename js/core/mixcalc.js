/* Reaction-mix calculator. Idea taken from PCR-Calculator (S. Gil, github.com/shellygil/PCR-Calculator: number of
 * reactions, pipetting excess, 2× or 5× mix, totals rounded for the pipette, a copyable report); written anew and extended
 * for the plate of this bench: one mix per reaction-mix key of the plate, volumes from the EURL method record's final
 * concentrations and reaction volume, oligonucleotide stock concentrations, water to volume, checks for volumes that do not
 * fit or cannot be pipetted, and the DNA dilutions for the sample, the controls and the calibrant series.
 * Pure functions: no page access, so the node checks can use them. */
(function (R2) {
  "use strict";
  const C = R2.mixcalc = {};
  C.DEFAULT = {
    masterMixX: 2,          // concentration of the commercial master mix (2× means half the reaction volume)
    excessPct: 10,          // pipetting excess on every mix and every DNA solution
    extraReactions: 0,      // whole reactions added to every mix on top of the excess
    roundUl: 0.1,           // totals rounded up to this step
    minPipetUl: 0.5,        // smallest volume the laboratory pipettes reliably
    primerStockUM: 10,      // µmol/L of each primer stock
    probeStockUM: 5,        // µmol/L of each probe stock
    rxnUl: null,            // null: the reaction volume of the method record
    sampleStockNgPerUl: 120,// measured concentration of the sample extract before dilution
    crmStockNgPerUl: 100,   // DNA extracted from the certified reference material, measured concentration
    minSolutionUl: 20       // smallest volume of any DNA solution prepared
  };
  const up = (v, step) => Math.ceil(v / step - 1e-9) * step;
  const fix = v => +v.toFixed(3);
  /* plan: gmoplan.plate output; settings: reagent settings (multipliers of the method concentrations);
   * s: calculator settings (C.DEFAULT shape); dna: { concNgPerUl, volUl }. */
  C.recipe = function (plan, settings, s, dna) {
    s = Object.assign({}, C.DEFAULT, s || {}); settings = Object.assign({}, R2.reagents.DEFAULT, settings || {});
    const M = id => R2.GMO.methods[id], warnings = [], tUl = dna.volUl, factor = 1 + s.excessPct / 100;
    const key = W => W.t.map(t => t.m).join("+");
    const mixes = plan.tubes.map((tube, k) => {
      const ids = tube, wells = plan.wells.map((W, i) => key(W) === ids.join("+") ? i : -1).filter(i => i >= 0);
      const rxn = s.rxnUl > 0 ? s.rxnUl : M(ids[0]).vol || 25, prepared = wells.length * factor + s.extraReactions;
      const rows = [{ component: s.masterMixX + "× master mix", stock: s.masterMixX + "×", final: "1×", perRxn: rxn / s.masterMixX }];
      for (const id of ids) {
        const m = M(id), mult = [settings.primerF, settings.primerR, settings.probe];
        const add = (label, name, seq, nM, stock) => rows.push({ component: label + " " + name, method: id, sequence: seq, stock: stock + " µmol/L", final: fix(nM) + " nmol/L", perRxn: nM * rxn / (stock * 1000) });
        add("forward primer", m.F[0], m.F[1], m.nM[0] * mult[0], s.primerStockUM);
        add("reverse primer", m.R[0], m.R[1], m.nM[1] * mult[1], s.primerStockUM);
        if (m.P) add("probe " + m.P[1] + "–" + (settings.quencher === "method" ? m.P[3] : settings.quencher), m.P[0], m.P[2], m.nM[2] * mult[2], s.probeStockUM);
        if (m.vol && m.vol !== rxn) warnings.push(`${id}: the method record states ${m.vol} µL per reaction; this mix is calculated for ${rxn} µL with the same final concentrations.`);
      }
      const used = rows.reduce((a, r) => a + r.perRxn, 0), water = rxn - tUl - used;
      rows.push({ component: "nuclease-free water", stock: "", final: "to volume", perRxn: water });
      const mixWarn = [];
      if (water < 0) mixWarn.push(`The components and ${tUl} µL of template exceed ${rxn} µL by ${fix(-water)} µL: use more concentrated stocks or less template.`);
      for (const r of rows) { r.perRxn = fix(r.perRxn); r.total = r.perRxn > 0 ? fix(up(r.perRxn * prepared, s.roundUl)) : 0;
        if (r.total > 0 && r.total < s.minPipetUl) mixWarn.push(`${r.component}: ${r.total} µL in total is below the ${s.minPipetUl} µL that can be pipetted reliably. Dilute the stock ten-fold or prepare more reactions.`); }
      const perTube = fix(rxn - tUl);
      return { key: "M" + (k + 1), methods: ids, wells, reactions: wells.length, prepared: fix(prepared), rxnUl: rxn, templateUl: tUl, mixPerTubeUl: perTube,
        rows, totalUl: fix(rows.reduce((a, r) => a + r.total, 0)), warnings: mixWarn };
    });
    // DNA solutions: one per kind of template on the plate, at the concentration that gives the planned mass in tUl
    const sols = new Map();
    plan.wells.forEach((W, i) => {
      if (W.role === "empty") return;
      let label, ng;
      if (W.role === "ntc") { label = "water (no-template control)"; ng = 0; }
      else if (W.role === "standard") { ng = parseFloat(String(W.dilution || W.sample).replace(/^STD\s*/, "")); label = "calibrant " + ng + " ng"; }
      else if (W.role === "unknown") { ng = plan.ng; label = W.ext ? "sample DNA extracts (one per sub-sample)" : "sample DNA"; }
      else { const mm = /([\d.]+) ng\b/.exec(W.material || ""); ng = mm ? +mm[1] : null; label = (W.role === "negative" ? "negative control: " : "positive control: ") + W.material; }   // plasmid controls: used as supplied
      const k = label; if (!sols.has(k)) sols.set(k, { label, role: W.role, ngPerRxn: ng, tubes: 0, wells: [] });
      const o = sols.get(k); o.tubes++; o.wells.push(i);
    });
    const extracts = new Set(plan.wells.filter(W => W.role === "unknown" && W.ext).map(W => W.sampleNo + "/" + W.ext)).size;
    const solutions = [...sols.values()].map(o => {
      const per = o.role === "unknown" && extracts ? extracts : 1, conc = o.ngPerRxn === null ? null : o.ngPerRxn / tUl, need = Math.max(s.minSolutionUl, up(o.tubes / per * tUl * factor, s.roundUl));
      return { ...o, concNgPerUl: conc === null ? null : fix(conc), volumeUl: fix(need), solutions: per, tubesPerSolution: o.tubes / per, label: per > 1 ? o.label + ": " + per + " extracts, " + (o.tubes / per) + " wells each" : o.label };
    });
    // sample dilution from the measured extract
    const smp = solutions.find(o => o.role === "unknown"), dil = {};
    if (smp) {
      const target = smp.concNgPerUl, stock = s.sampleStockNgPerUl;
      if (stock < target) warnings.push(`The sample extract (${stock} ng/µL) is more dilute than the ${target} ng/µL needed for ${plan.ng} ng in ${tUl} µL. Use the extract undiluted with a larger template volume, or concentrate it.`);
      const ext = Math.min(smp.volumeUl, smp.volumeUl * target / stock);
      dil.sample = { from: stock, to: target, extractUl: fix(up(ext, s.roundUl)), waterUl: fix(Math.max(0, smp.volumeUl - up(ext, s.roundUl))), totalUl: smp.volumeUl };
      if (dil.sample.extractUl < s.minPipetUl) warnings.push(`Sample dilution: ${dil.sample.extractUl} µL of extract is too little to pipette; make an intermediate dilution first.`);
    }
    // calibrant series: highest level from the CRM extract, then each level from the one above
    const levels = solutions.filter(o => o.role === "standard").sort((a, b) => b.ngPerRxn - a.ngPerRxn);
    if (levels.length) {
      const need = levels.map(o => o.volumeUl), steps = [];
      let carry = 0;
      for (let i = levels.length - 1; i >= 0; i--) {
        const total = Math.max(s.minSolutionUl, need[i] + carry), f = i > 0 ? levels[i - 1].ngPerRxn / levels[i].ngPerRxn : null;
        steps[i] = { level: levels[i].label, concNgPerUl: levels[i].concNgPerUl, totalUl: fix(up(total, s.roundUl)), forWellsUl: need[i], passedOnUl: fix(carry) };
        if (f) { steps[i].fromAboveUl = fix(up(total / f, s.roundUl)); steps[i].waterUl = fix(steps[i].totalUl - steps[i].fromAboveUl); steps[i].factor = fix(f); }
        carry = f ? steps[i].fromAboveUl : 0;
      }
      const top = steps[0], stock = s.crmStockNgPerUl;
      if (stock < top.concNgPerUl) warnings.push(`The certified-material extract (${stock} ng/µL) is more dilute than the highest calibrant (${top.concNgPerUl} ng/µL). Concentrate it or lower the calibrant series.`);
      top.fromStockUl = fix(up(Math.min(top.totalUl, top.totalUl * top.concNgPerUl / stock), s.roundUl)); top.waterUl = fix(Math.max(0, top.totalUl - top.fromStockUl));
      dil.calibrants = { stockNgPerUl: stock, steps };
    }
    for (const m of mixes) warnings.push(...m.warnings.map(w => m.key + ": " + w));
    return { settings: s, templateUl: tUl, dnaNgPerRxn: plan.ng, mixes, solutions, dilutions: dil, warnings };
  };
  // plain-text report for a lab notebook (format idea from PCR-Calculator)
  C.text = function (r, title) {
    const L = [title || "Reaction mixes", `Template ${r.templateUl} µL per reaction (${r.dnaNgPerRxn} ng) · excess ${r.settings.excessPct} %` + (r.settings.extraReactions ? ` + ${r.settings.extraReactions} reaction(s)` : "") + ` · totals rounded up to ${r.settings.roundUl} µL`, ""];
    for (const m of r.mixes) {
      L.push(`${m.key}: ${m.methods.join(" + ")} · ${m.reactions} tubes (${m.wells.map(w => R2.wellName(w)).join(", ")}) · prepare for ${m.prepared} · ${m.rxnUl} µL reactions`);
      L.push("  " + "component".padEnd(34) + "stock".padStart(12) + "final".padStart(16) + "per rxn µL".padStart(12) + "total µL".padStart(10));
      for (const x of m.rows) L.push("  " + x.component.slice(0, 34).padEnd(34) + String(x.stock).padStart(12) + String(x.final).padStart(16) + x.perRxn.toFixed(2).padStart(12) + x.total.toFixed(1).padStart(10));
      L.push(`  dispense ${m.mixPerTubeUl} µL of mix per tube, then ${m.templateUl} µL of template · mix total ${m.totalUl} µL`, "");
    }
    L.push("DNA solutions");
    for (const o of r.solutions) L.push(`  ${o.label}: ${o.tubes} tube(s), ${o.concNgPerUl === null ? "as supplied" : o.concNgPerUl + " ng/µL"}, prepare ${o.volumeUl} µL`);
    const d = r.dilutions;
    if (d.sample) L.push(`  sample: ${d.sample.extractUl} µL extract (${d.sample.from} ng/µL) + ${d.sample.waterUl} µL water → ${d.sample.to} ng/µL`);
    if (d.calibrants) d.calibrants.steps.forEach((x, i) => L.push(i === 0 ? `  ${x.level}: ${x.fromStockUl} µL CRM extract (${d.calibrants.stockNgPerUl} ng/µL) + ${x.waterUl} µL water → ${x.concNgPerUl} ng/µL, ${x.totalUl} µL` : `  ${x.level}: ${x.fromAboveUl} µL of the level above + ${x.waterUl} µL water (1:${x.factor}) → ${x.concNgPerUl} ng/µL, ${x.totalUl} µL`));
    if (r.warnings.length) { L.push("", "Check"); for (const w of r.warnings) L.push("  ! " + w); }
    return L.join("\n") + "\n";
  };
  C.csv = function (r) {
    const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    const L = ["mix,methods,tubes,prepared_reactions,reaction_ul,component,sequence,stock,final,per_reaction_ul,total_ul"];
    for (const m of r.mixes) for (const x of m.rows) L.push([m.key, m.methods.join("+"), m.reactions, m.prepared, m.rxnUl, x.component, x.sequence || "", x.stock, x.final, x.perRxn, x.total].map(q).join(","));
    return L.join("\r\n") + "\r\n";
  };
})(window.R2);
