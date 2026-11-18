/* Neutral simplex screening training procedure. Sequence records and numerical simulation settings are retained. */
(function (R2) {
  "use strict";
  const M = R2.GMO.methods;
  const lab = (id, base, o) => { M[id] = Object.assign({}, M[base], { id, labOf: base, labOnly: true, crm: undefined, pc: undefined }, o); };
  const cyc = [0, 600, 45, 15, 60, 60, 72, 1];                 // no UNG hold; 95 °C 600 s; 45 × (95 °C 15 s, 60 °C 60 s, 72 °C 1 s with acquisition)
  const cool = [40, 30];                                        // final cooling 40 °C, 30 s (RACIRE)
  lab("SIMPLEX-35S", "QL-ELE-00-012", { title: "P-35S, simplex", nM: [300, 300, 100], vol: 25, cyc, cool, duplexWith: undefined });
  lab("SIMPLEX-TNOS", "QL-ELE-00-013", { title: "T-nos, simplex", nM: [400, 400, 100], vol: 25, cyc, cool, duplexWith: undefined,
    eff: 99 });   // calibration, not from the record: in the laboratory's real runs T-nos crosses 1.5 cycles before P-35S on the same samples (418 pairs); at the record's 93 % the model put it 1.7 cycles after
  lab("SIMPLEX-HMG", "QT-TAX-ZM-002", { title: "Maize hmgA reference gene", P: ["hmgA-S", "FAM", M["QT-TAX-ZM-002"].P[2], "BHQ1"], nM: [300, 300, 160], vol: 25, cyc, cool });
  lab("SIMPLEX-LEC", "QT-TAX-GM-002", { title: "Soybean Le1 reference gene", nM: [300, 300, 120], vol: 25, cyc, cool });
  R2.LAB = R2.LAB || {};
  R2.LAB.simplex = {
    id: "simplex", sop: "TRAINING-SCREEN-001", title: "Simplex screening for P-35S and T-nos",
    instrument: "Virtual 384-well real-time PCR instrument", template: "SCREENING.ixo",
    assays: { p35s: "SIMPLEX-35S", tnos: "SIMPLEX-TNOS" }, taxon: { maize: "SIMPLEX-HMG", soybean: "SIMPLEX-LEC" },
    // positive control at the limit of detection: certified reference material at 0.1 % (m/m)
    crm: { maize: { name: "ERM-BF415 (NK603 maize), 0.1 % m/m", event: "NK603", pct: 0.1 }, soybean: { name: "ERM-BF410 (40-3-2 soybean), 0.1 % m/m", event: "40-3-2", pct: 0.1 } },
    // second positive control: an earlier routine sample in which both elements were detected (GM share assumed by this bench)
    positiveSample: { maize: { name: "positive sample (earlier routine sample, P-35S and T-nos detected)", event: "NK603", pct: 1 }, soybean: { name: "positive sample (earlier routine sample, P-35S and T-nos detected)", event: "40-3-2", pct: 1 } },
    rules: { lod: [29, 36], taxon: [20, 27], negativeCq: 40, cqMethod: "sdm" },
    mix: { masterMixX: 2, primerStockUM: 10, probeStockUM: 10, rxnUl: 25 },
    dna: { concNgPerUl: 40, volUl: 5 }, dnaRangeNgPerUl: [10, 40],
    replicates: "Workbench sample layout: three extracts with three PCR replicates each. LOD control in duplicate. Positive sample, NTC and extraction blank once per run and assay.",
    source: "Simplex screening training procedure; assay sequences and numerical conditions retained from the supplied method records"
  };
})(window.R2);
