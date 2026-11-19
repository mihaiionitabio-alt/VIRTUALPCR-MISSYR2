/* Simulator facts for MISSY's native MARA evidence inputs. Not laboratory approval. */
(function (R2) {
  "use strict";
  R2.maraEvidenceFrom = function (run, diagnostics, document) {
    const m = run.gmo?.mara;
    if (!m || !document?.definition?.mara) return null;
    const def = document.definition, method = R2.MARA.assays[m.method];
    const protocol = R2.MARA.protocolMatches(run.protocol, m.mode);
    const actualMethods = [...new Set(run.plate.flatMap(w => w.t.map(t => t.m)))];
    const declared = document.methods.map(x => x.id);
    const methodMatch = actualMethods.length === declared.length && actualMethods.every(x => declared.includes(x));
    const sequenceMatch = document.methods.every(m => {
      const reference = R2.GMO.methods[m.id];
      return reference && m.oligonucleotides?.forward?.sequence === reference.F?.[1] &&
        m.oligonucleotides?.reverse?.sequence === reference.R?.[1] && m.oligonucleotides?.probe?.sequence === reference.P?.[2];
    });
    const dnaMatch = Number.isFinite(run.gmo.ng) && run.gmo.ng === def.dna.ng_per_reaction;
    const cropMatch = m.mode === "screen" ? ["soybean", "maize"].includes(run.gmo.crop) : !!method && method.crop === run.gmo.crop && !method.reviewOnly;
    const settings = run.gmo.settings || {};
    const composition = def.reagent_composition || {};
    const compositionMatch = Object.keys(composition).every(k => (settings[k] ?? R2.reagents.DEFAULT[k]) === composition[k]);
    const methodDnaMatch = m.mode === "screen" || run.gmo.ng === (m.mode === "quant" ? method?.quantNg : method?.qualNg);
    const quencher = settings.quencher ?? R2.reagents.DEFAULT.quencher;
    const methodChemistry = ["primerF", "primerR", "probe"].every(k => (settings[k] ?? R2.reagents.DEFAULT[k]) === 1) &&
      (settings.hotStart ?? R2.reagents.DEFAULT.hotStart) && !settings.probeMismatch &&
      (quencher === "method" || actualMethods.every(id => R2.GMO.methods[id]?.P?.[3] === quencher));
    const occupied = run.plate.filter(w => w.role !== "empty");
    // The workbench's MARA procedures prescribe a triplicate of each run control.
    // A custom control layout is not silently confirmed as that source procedure.
    const controlStructure = actualMethods.every(id => ["PC", "NC", "NTC"].every(code =>
      occupied.filter(w => w.ctl === code && w.t.some(t => t.m === id)).length === 3));
    const verified = protocol && methodMatch && sequenceMatch && dnaMatch && cropMatch && compositionMatch && methodDnaMatch && methodChemistry && controlStructure;
    const samePlate = occupied.length > 0 && run.plate.length <= 384;
    const levels = [...new Set(occupied.filter(w => w.role === "standard").map(w => w.dilution))];
    // Plate dilution labels carry units (for example, "200 ng").
    const masses = levels.map(level => parseFloat(level));
    const lowEventCopies = Math.min(...masses) * m.copiesPerNg * m.stockPct / 100;
    const calibration = m.mode === "quant" && levels.length >= 5 && masses.every(v => Number.isFinite(v) && v > 0) &&
      Math.max(...masses) > run.gmo.ng && Math.max(...masses) <= method?.calMax &&
      lowEventCopies > method.lodCopies && lowEventCopies <= method.loqCopies &&
      m.stockPct > 0 && m.stockPct <= 100 && actualMethods.every(id => levels.every(level => {
      const wells = occupied.filter(w => w.role === "standard" && w.dilution === level && w.t.some(t => t.m === id));
      const expected = parseFloat(level) * m.copiesPerNg * (id === m.method ? m.stockPct / 100 : 1);
      return wells.length === 3 && wells.every(w => {
        const q = w.t.find(t => t.m === id).q;
        return q > 0 && Math.abs(q - expected) <= 1e-8 * Math.max(1, expected);
      });
    }));
    const reactions = [];
    for (const id of actualMethods) {
      const amp = diagnostics[id]?.amp;
      for (let index = 0; index < run.plate.length; index++) {
        const well = run.plate[index], target = well.t.find(t => t.m === id);
        if (!target || well.role === "empty") continue;
        const a = amp?.wells?.[index];
        const curve = !a ? "unknown" : a.saturated ? "atypical" :
          a.cq === null && a.cqReason === "no_amplification" ? "absent" :
          Number.isFinite(a.cq) && a.sigmoid?.fit?.status === "ok" && !a.sigmoid.reasonIfNot ? "typical" : "atypical";
        reactions.push({ position: index, method: id, curve,
          ...(well.ctl === "PC" ? { pair: "PC-" + well.rep } : {}),
          ...(well.role === "standard" ? { copies: target.q, level: String(well.dilution), pair: String(well.dilution) } : {}) });
      }
    }
    return { schema: "missy-r2-mara-evidence/1", sourceSop: document.sop_id,
      provenance: "Derived from verified simulator inputs and recorded amplification analysis; not laboratory confirmation or approval",
      context: { methodVerified: verified, rapidWorkflow: verified && m.mode === "screen", samePlateVerified: samePlate,
        calibrationRangeVerified: verified && calibration },
      checks: { protocol, methodMatch, sequenceMatch, dnaMatch, cropMatch, compositionMatch, methodDnaMatch, methodChemistry, controlStructure }, reactions };
  };
  R2.maraEvidenceForRun = (run, ev) => R2.maraEvidenceFrom(run,
    Object.fromEntries(ev.order.map(id => [id, ev.assays[id].one.res])), R2.sop.docOfRun(run));
})(window.R2);
