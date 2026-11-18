/* Plates and protocols offered on the technician bench. Assay properties are inputs of the teaching model (firmware/sim/MODEL.md). */
(function (R2) {
  "use strict";
  R2.VERSION = "0.4.29";
  R2.BUILD = "0.4.29-r3";
  R2.ASSAYS = {
    good: { label: "Good assay (120 bp, primers 62 °C)", sim: {} },
    lowtm: { label: "Primers melt at 54 °C", sim: { primer_tm: 54 } },
    long: { label: "Long amplicon (1500 bp)", sim: { amplicon_bp: 1500, amplicon_tm: 88 } },
    dimer: { label: "Poor primers, no hot start", sim: { dimer_rate: 20, hot_start: false } },
    gc: { label: "GC-rich product (melts at 95 °C)", sim: { amplicon_tm: 95 } },
    second: { label: "Second target (product melts at 80.5 °C)", sim: { amplicon_tm: 80.5 } }
  };
  const W = (sample, role, copies, assay, quantity) => ({ sample, role, copies, assay: assay || "good", quantity: quantity === undefined ? (role === "standard" ? copies : null) : quantity, rin: 10 });
  R2.PLATES = {
    standards: { label: "Standard curve, two unknowns, controls", wells: [W("STD 1e6", "standard", 1e6), W("STD 1e6", "standard", 1e6), W("STD 1e5", "standard", 1e5), W("STD 1e5", "standard", 1e5), W("STD 1e4", "standard", 1e4), W("STD 1e4", "standard", 1e4), W("STD 1e3", "standard", 1e3), W("STD 1e3", "standard", 1e3),
      W("STD 1e2", "standard", 1e2), W("STD 1e2", "standard", 1e2), W("Unknown 1", "unknown", 3e4), W("Unknown 1", "unknown", 3e4), W("Unknown 2", "unknown", 5e2, "second"), W("Unknown 2", "unknown", 5e2, "second"), W("NTC", "ntc", 0), W("NTC", "ntc", 0)] },
    wrong: { label: "What can go wrong: eight situations", wells: [W("Good assay", "unknown", 1e4), W("Good assay", "unknown", 1e4), W("Primers Tm 54", "unknown", 1e4, "lowtm"), W("Primers Tm 54", "unknown", 1e4, "lowtm"), W("1500 bp", "unknown", 1e4, "long"), W("1500 bp", "unknown", 1e4, "long"), W("NTC poor primers", "ntc", 0, "dimer"), W("NTC poor primers", "ntc", 0, "dimer"),
      W("NTC good", "ntc", 0), W("NTC good", "ntc", 0), W("GC-rich", "unknown", 1e4, "gc"), W("GC-rich", "unknown", 1e4, "gc"), W("1 copy", "unknown", 1), W("1 copy", "unknown", 1), W("1 copy", "unknown", 1), W("1 copy", "unknown", 1)] },
    lowcopy: { label: "Low copy numbers: 16 tubes, 2 copies intended", wells: Array.from({ length: 16 }, () => W("2 copies", "unknown", 2)) }
  };
  const P = (name, f) => ({ name, f });
  R2.PROTOCOLS = {
    two: P("Two-step, 40 cycles, melt", { initT: 95, initS: 60, cycles: 40, denT: 95, denS: 10, annT: 60, annS: 30, ext: false, extT: 72, extS: 30, melt: true }),
    three: P("Three-step with 60 s extension", { initT: 95, initS: 60, cycles: 40, denT: 95, denS: 10, annT: 60, annS: 20, ext: true, extT: 72, extS: 60, melt: true }),
    hot: P("Annealing too hot (68 °C)", { initT: 95, initS: 60, cycles: 40, denT: 95, denS: 10, annT: 68, annS: 30, ext: false, extT: 72, extS: 30, melt: true }),
    cool: P("Denaturation too cool (86 °C)", { initT: 95, initS: 60, cycles: 40, denT: 86, denS: 10, annT: 60, annS: 30, ext: false, extT: 72, extS: 30, melt: true }),
    quick: P("Quick look: 25 cycles, no melt", { initT: 95, initS: 30, cycles: 25, denT: 95, denS: 5, annT: 60, annS: 20, ext: false, extT: 72, extS: 30, melt: false })
  };
  R2.protocolFromFields = function (f, name) {
    const steps = [{ temp_c: f.denT, hold_s: f.denS }];
    if (f.ext) steps.push({ temp_c: f.annT, hold_s: f.annS }, { temp_c: f.extT, hold_s: f.extS, read: true }); else steps.push({ temp_c: f.annT, hold_s: f.annS, read: true });
    const stages = []; if (f.initS > 0) stages.push({ type: "hold", repeats: 1, steps: [{ temp_c: f.initT, hold_s: f.initS }] });
    stages.push({ type: "cycle", repeats: f.cycles, steps }); if (f.melt) stages.push({ type: "melt", from_c: 65, to_c: 95, rate_c_per_s: 0.1 });
    return { name: name || "custom", lid_c: 105, stages };
  };
  // template integrity factor after virtualPCR (G. Spaepen, BSD licence): cDNA * (0.5 sin(pi (RIN - 5) / 10) + 0.5)
  R2.integrity = rin => 0.5 * Math.sin(Math.PI * ((rin - 5) / 10)) + 0.5;
  R2.simWells = plateWells => plateWells.map(w => { if (w.role === "empty") return { kind: "empty" }; const sim = Object.assign({}, (R2.ASSAYS[w.assay || "good"] || R2.ASSAYS.good).sim), none = sim.noProduct; delete sim.noProduct;
    return Object.assign({ copies: none ? 0 : (w.copies || 0) * R2.integrity(w.rin === undefined ? 10 : w.rin) }, sim); });
  R2.session = { run: null };          // the finished run handed from the technician to the quality manager
})(window.R2);
