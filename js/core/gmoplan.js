/* GMO analysis with EURL GMFF reference methods (or a laboratory procedure): what is in the samples, which wells go on the 384-well
 * plate for screening, identification or quantification, the cycling programme, and the reactions for the instrument model. */
(function (R2) {
  "use strict";
  const P = (R2.gmoplan = {}),
    D = () => R2.GMO,
    M = (id) => R2.GMO.methods[id];
  const evt = (name) => D().events.find((e) => e.name === name);
  /* DNA per reaction: 5 µL of extract diluted to 40 ng/µL = 200 ng, the amount used in every real run the curve shape
   * and the control variation were taken from. Calibrants bracket that amount in four-fold steps (5 µL at 80, 20, 5 and
   * 1.25 ng/µL), so a 200 ng sample sits in the middle of the calibrated range on a log scale. */
  P.DNA = {
    concNgPerUl: 40,
    volUl: 5,
  };
  P.DEFAULT_NG = P.DNA.concNgPerUl * P.DNA.volUl;
  P.MIN_READ_S = 1;
  P.INSTRUMENT = {
    wells: 384,
    camera: true,
  }; // options of R2.Instrument for the technician plate
  P.STD_NG = [400, 100, 25, 6.25];
  /* Amplifiable share of the genome copies that a DNA mass implies. Fitted so that 200 ng gives the median reference-gene
   * Cq of the real runs, Cq taken as the cycle where 10 % of the rise is reached (same definition applied to the model):
   * lectin 22.0 (non-GM soybean control, 214 runs; sample duplicates 22.0), HMG 23.5 (non-GM maize control, 178 runs;
   * sample duplicates 23.6), from the CN_SOIA / CN_PORUMB wells of the owner's 730-run export. It stands for over-estimated
   * DNA concentration and for DNA that does not amplify. It applies equally to samples, controls and calibrants, so ratios
   * and GM content are not affected; only absolute Cq values move. */
  P.AMPLIFIABLE = {
    soybean: 0.44,
    maize: 0.82,
  };
  /* Natural variation, from the same real runs (robust SD = 1.4826 × median absolute deviation, 10 %-rise Cq):
   * within one run, a tube against its duplicate: 0.16 cycles (lectin, 1718 sample duplicates; HMG, 1412);
   * between runs, the single non-GM control tube: 0.41 (lectin) and 0.47 (HMG).
   * Original tube term: 0.15 after accounting for model reading scatter. The current camera setting assumes tighter
   * normalized loading. Run term: what remains of the
   * between-run SD (0.44) after the tube term: sqrt(0.44² − 0.16²) ≈ 0.41. The tube term is shared by both targets of a duplex
   * tube (one template volume); the run term is common to every tube of the run, as a reagent lot or a threshold would be.
   * Calibrant and positive-control tubes (refTubeSd): the real export has one such tube per run, so their within-run scatter
   * cannot be measured there. The bench assumes half the sample term, for a dilution series made in one go from one
   * homogeneous certified material; with the full sample term, a four-point single-tube calibration fails the slope criterion in
   * about one run in six. Their run-to-run variation is the measured run term. */
  /* Independent DNA extractions of one sample (sub-samples): the DNA amount differs after quantification and dilution
   * (extractionSd, in cycles) and the GM share differs between sub-samples of the ground material (gmCv). Both are
   * assumptions of this bench: the real export has no parallel extractions to measure them. */
  P.VARIATION = {
    extractionSd: 0.06,
    gmCv: 0.1,
    tubeSd: 0.07,
    refTubeSd: 0.05,
    runSd: 0.41,
    source:
      "robust SD of Cq (10 % of the rise) in the owner's 730 real runs at 200 ng per reaction. Camera well and dilution terms are normalized-template teaching settings.",
  };
  const cpn = (crop) =>
    D().crops[crop].copiesPerNg * (P.AMPLIFIABLE[crop] || 1);
  P.blind = function (seed, forcedCrop) {
    const g = new R2.Rng(1000 + (seed || 7)),
      crop = forcedCrop || (g.u() < 0.5 ? "maize" : "soybean"),
      pool = D().events.filter((e) => e.crop === crop && !e.mara),
      lv = [0.05, 0.1, 0.4, 0.9, 2, 5],
      events = {};
    const n = g.u() < 0.15 ? 0 : g.u() < 0.6 ? 1 : 2;
    for (let i = 0; i < n; i++)
      events[pool[Math.floor(g.u() * pool.length)].name] =
        lv[Math.floor(g.u() * lv.length)];
    return {
      key: "blind",
      label: "Blind sample",
      blind: true,
      crop,
      events,
      frag: g.u() < 0.3 ? 250 : 2000,
      inhibitor: g.u() < 0.25 ? 0.2 : 0,
    };
  };
  const integrity = (bp, frag) => Math.exp(-bp / (frag || 2000)); // share of target copies still intact across the amplicon
  // copies of a method's target in ng of the sample DNA
  P.sampleCopies = function (s, m, ng) {
    const base = ng * cpn(s.crop) * integrity(m.bp, s.frag);
    if (m.kind === "taxon")
      return {
        copies: m.crop === s.crop ? base : 0,
      };
    if (m.kind === "event")
      return {
        copies: m.crop === s.crop ? (base * (s.events[m.event] || 0)) / 100 : 0,
      };
    let f = 0,
      perfect = false;
    for (const name in s.events) {
      const v = evt(name)?.el[m.el];
      if (v > 0) {
        f += s.events[name] / 100;
        if (v === 2) perfect = true;
      }
    }
    return {
      copies: base * f,
      imperfect: f > 0 && !perfect,
    };
  };
  // positive control as the method's record names it; reference-gene and event controls carry the same DNA mass as the sample
  function control(m, crop, ng) {
    if (m.kind === "taxon")
      return {
        material: "non-GM " + crop + " genomic DNA, " + ng + " ng",
        copies: ng * cpn(crop),
      };
    if (m.kind === "event")
      return {
        material:
          m.crm + "; control DNA with 1 % " + m.event + ", " + ng + " ng",
        copies: ng * cpn(crop) * 0.01,
        pct: 1,
      };
    if (m.pc.copies)
      return {
        material: m.crm + " (" + m.pc.copies + " target copies)",
        copies: m.pc.copies,
      };
    const e = evt(m.pc.event);
    return {
      material:
        m.crm + ": " + m.pc.pct + " % " + m.pc.event + ", " + m.pc.ng + " ng",
      copies: e.el[m.el] > 0 ? (m.pc.ng * cpn(m.pc.crop) * m.pc.pct) / 100 : 0,
    };
  }
  /* The technician plate: 384 wells, 16 rows × 24 columns. Every sample is analysed as three parallel sub-samples
   * (independent DNA extractions), each with three PCR replicates, for every reaction mix. The run controls are prepared
   * once per run for each reaction mix. Each mix starts on a new row: first the sample wells (sample 1 E1 R1–R3, E2 …),
   * then its controls.
   * choice: { stage: "screen"|"ident"|"quant", assays, duplex, ng, layout: "eurl"|"simplex", samples: [sample objects] }
   * (a single sample may be passed as the first argument). Returns { wells: 384 × { role, ctl, sample, sampleNo, ext, rep,
   * material, t: [{ m, q }], sim: [{ copies, ... }] }, tubes, taxon, notes, ng, pcNg, samples, capacity, lab?, calPct? }. */
  P.LAYOUT = {
    extractions: 3,
    replicates: 3,
  };
  P.plate = function (sample, choice) {
    const samples =
        choice.samples && choice.samples.length ? choice.samples : [sample],
      first = samples[0],
      crop = first.crop,
      ng = choice.ng || P.DEFAULT_NG,
      notes = [];
    const NW = R2.PLATE.n,
      COLS = R2.PLATE.cols,
      ROWS = R2.PLATE.rows,
      X = choice.design?.extractions ?? P.LAYOUT.extractions,
      REP = choice.design?.replicates ?? P.LAYOUT.replicates;
    if (
      !Number.isInteger(X) ||
      X < 1 ||
      X > 12 ||
      !Number.isInteger(REP) ||
      REP < 1 ||
      REP > 12
    )
      throw new Error(
        "Extractions and PCR replicates must be whole numbers from 1 to 12.",
      );
    const wells = Array.from(
      {
        length: NW,
      },
      () => ({
        role: "empty",
        sample: "",
        t: [],
        sim: [],
      }),
    );
    const short = (id) =>
      M(id).kind === "taxon"
        ? M(id).target.split(" ")[0]
        : M(id).kind === "event"
          ? M(id).event
          : D().elementNames[M(id).el];
    const mixName = (t) => t.map(short).join("+");
    const lab =
      choice.layout === "simplex" && choice.stage === "screen"
        ? R2.LAB.simplex
        : null;
    let tubes, taxon, calPct, em, mara;
    // controls of one mix: [{ role, ctl, label, per target: { q, copies, material, pct } }]
    const ctl = (role, c, label, mk) => ({
      role,
      ctl: c,
      label,
      mk,
    });
    let controls;
    if (choice.layout === "mara17" && choice.stage === "screen") {
      const field = R2.MARA.rapid;
      taxon = field.taxon[crop];
      if (
        !taxon ||
        !choice.assays.length ||
        choice.assays.some((id) => !field.assays.includes(id))
      )
        throw new Error("Select a supported Standard 17 panel.");
      tubes = [[taxon], ...choice.assays.map((id) => [id])];
      mara = {
        mode: "screen",
        lodPct: 1,
        taxon,
      };
      controls = ([id]) =>
        [1, 2, 3].flatMap((rep) => [
          {
            ...ctl("positive", "PC", "Rapid-screen positive", () => ({
              copies: id === taxon ? ng * cpn(crop) : 0.01 * ng * cpn(crop),
              material: "Simulated positive target control, " + ng + " ng",
            })),
            rep,
          },
          {
            ...ctl("negative", "NC", "Non-GM control", () => ({
              copies: id === taxon ? ng * cpn(crop) : 0,
              material: "Non-GM " + crop + " genomic DNA, " + ng + " ng",
            })),
            rep,
          },
          {
            ...ctl("ntc", "NTC", "Blank", () => ({
              copies: 0,
              material: "Water",
            })),
            rep,
          },
        ]);
      notes.push(
        "Standard 17 Annex A fluorescence subset on the virtual 384-well instrument. Published target LOD 1%. The run screens only the chosen targets.",
      );
    } else if (R2.MARA?.isLayout(choice.layout) && choice.stage !== "screen") {
      em = M(choice.assays[0]);
      const method = R2.MARA.assays[em.id];
      if (!method || method.crop !== crop || method.reviewOnly)
        throw new Error("Select a supported MARA event for the sample crop.");
      taxon = em.taxon;
      tubes = [[em.id], [taxon]];
      const mode =
        choice.stage === "quant"
          ? "quant"
          : choice.layout === "mara16"
            ? "ddct"
            : "ident";
      const comparatorPct = R2.MARA.comparator(choice.layout, choice.stage);
      const copiesPerNg =
        method.lodCopies / ((method.basisNg * method.lodPct) / 100);
      const stockPct = 10;
      const minMass =
        (method.lodCopies + method.loqCopies) /
        2 /
        ((copiesPerNg * stockPct) / 100);
      const levels = Array.from(
        {
          length: 5,
        },
        (_, i) =>
          +(method.calMax * Math.pow(minMass / method.calMax, i / 4)).toFixed(
            4,
          ),
      );
      const reference = em.crm,
        pcMaterial =
          "Laboratory-prepared " +
          method.event +
          " positive control at " +
          comparatorPct +
          " %";
      mara = {
        mode,
        method: em.id,
        comparatorPct,
        copiesPerNg,
        stockPct,
        levels: mode === "quant" ? levels : [],
      };
      const triplicate = (role, code, label, make) =>
        [1, 2, 3].map((rep) => ({
          ...ctl(role, code, label, make),
          rep,
        }));
      controls = ([id]) => [
        ...triplicate("positive", "PC", "Positive control", () => ({
          copies: ng * copiesPerNg * (id === em.id ? comparatorPct / 100 : 1),
          material: pcMaterial + ", " + ng + " ng",
          pct: comparatorPct,
        })),
        ...triplicate("negative", "NC", "Non-GM control", () => ({
          copies: id === em.id ? 0 : ng * copiesPerNg,
          material: "Non-GM " + crop + " genomic DNA, " + ng + " ng",
        })),
        ...triplicate("ntc", "NTC", "Blank", () => ({
          copies: 0,
          material: "Water",
        })),
        ...(mode === "quant"
          ? levels.flatMap((mass) =>
              triplicate("standard", "CAL", "STD " + mass + " ng", () => {
                const copies =
                  mass * copiesPerNg * (id === em.id ? stockPct / 100 : 1);
                return {
                  copies,
                  q: copies,
                  material:
                    reference + " at " + stockPct + " %; " + mass + " ng",
                };
              }),
            )
          : []),
      ];
      notes.push(
        "MARA 1012-" +
          method.std +
          "-2026. Paired event/reference assays. Three extracts per sample and three wells per extract and control.",
      );
      if (mode === "ddct")
        notes.push(
          "Standard 16 comparison against a simulated " +
            comparatorPct +
            " % control. The interval −0.4 to +0.4 requires standard-curve quantification.",
        );
    } else if (lab) {
      taxon = lab.taxon[crop];
      tubes = [[lab.assays.p35s], [lab.assays.tnos], [taxon]];
      const lc = (m, c) => {
        const e = evt(c.event);
        return e && e.el[m.el] > 0 ? (ng * cpn(crop) * c.pct) / 100 : 0;
      };
      controls = (t) =>
        M(t[0]).kind === "taxon"
          ? []
          : [
              ctl("positive", "LOD", "PC LOD " + mixName(t), (m) => ({
                copies: lc(m, lab.crm[crop]),
                material: lab.crm[crop].name + ", " + ng + " ng",
              })),
              ctl("positive", "LOD", "PC LOD " + mixName(t), (m) => ({
                copies: lc(m, lab.crm[crop]),
                material: lab.crm[crop].name + ", " + ng + " ng",
              })),
              ctl("positive", "POS", "Pos. sample " + mixName(t), (m) => ({
                copies: lc(m, lab.positiveSample[crop]),
                material: lab.positiveSample[crop].name + ", " + ng + " ng",
              })),
              ctl("ntc", "NTC", "NTC " + mixName(t), () => ({
                copies: 0,
                material: "water (no-template control)",
              })),
              ctl("ntc", "BLK", "Blank extr. " + mixName(t), () => ({
                copies: 0,
                material: "DNA extraction blank",
              })),
            ];
      notes.push(
        `Simplex screening for P-35S, T-nos and ${short(taxon)}. Run controls once per run and element: 0.1 % certified material at the limit of detection (duplicate), a positive sample, a no-template control and the DNA extraction blank.`,
      );
    } else if (choice.stage === "quant") {
      em = M(choice.assays[0]);
      taxon = em.taxon || D().crops[crop].taxon;
      calPct = em.crmPct >= 100 ? 10 : em.crmPct;
      tubes = [[em.id], [taxon]];
      const nominal = D().crops[crop].copiesPerNg,
        amp = cpn(crop);
      controls = (t) => {
        const id = t[0],
          share = id === em.id ? calPct / 100 : 1,
          out = [];
        // assigned copies: nominal genome copies of the DNA mass; the model amplifies the amplifiable share of them, as it does for the samples
        for (const g of P.STD_NG)
          for (let r = 0; r < 3; r++)
            out.push(
              ctl("standard", "CAL", "STD " + g + " ng", () => ({
                q: Math.round(g * nominal * share),
                copies: g * amp * share,
                material: em.crm + "; calibrant " + g + " ng",
              })),
            );
        const pc = control(em, crop, ng);
        for (let r = 0; r < 3; r++)
          out.push(
            ctl("positive", "PC", "Control 1 %", () => ({
              ...pc,
              copies: id === em.id ? pc.copies : ng * amp,
            })),
          );
        for (let r = 0; r < 3; r++)
          out.push(
            ctl("ntc", "NTC", "NTC", () => ({
              copies: 0,
            })),
          );
        return out;
      };
      notes.push(
        `Calibration: DNA from the method's reference material (${em.crm}) at ${calPct} % ${em.event}, ${P.STD_NG.join(", ")} ng per tube (four-fold dilutions bracketing the ${ng} ng of the samples), each level in triplicate; 1 % control and no-template control in triplicate. The ${calPct} % level is an assumption of this bench.`,
      );
    } else {
      let ids = choice.assays.slice();
      const ev0 = ids.map(M).find((m) => m.kind === "event");
      taxon = (ev0 && ev0.taxon) || D().crops[crop].taxon;
      tubes = [[taxon]];
      if (
        choice.stage === "screen" &&
        choice.duplex &&
        ids.includes("QL-ELE-00-012") &&
        ids.includes("QL-ELE-00-013")
      ) {
        tubes.push(["QL-ELE-00-012", "QL-ELE-00-013"]);
        ids = ids.filter((x) => x !== "QL-ELE-00-012" && x !== "QL-ELE-00-013");
      }
      for (const id of ids) tubes.push([id]);
      controls = (t) => [
        ctl("positive", "PC", "PC " + mixName(t), (m) => control(m, crop, ng)),
        ctl("positive", "PC", "PC " + mixName(t), (m) => control(m, crop, ng)),
        ctl("ntc", "NTC", "NTC " + mixName(t), () => ({
          copies: 0,
        })),
        ctl("ntc", "NTC", "NTC " + mixName(t), () => ({
          copies: 0,
        })),
      ];
    }
    if (choice.design?.controlCounts) {
      const original = controls,
        requested = choice.design.controlCounts;
      controls = (t) => {
        const base = original(t),
          groups = new Map();
        if (!base.length) return base; // the procedure has no run controls on this mix (simplex reference gene): leave it unchanged
        for (const c of base) {
          const key = c.ctl + "|" + c.label;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(c);
        }
        for (const [code, n] of Object.entries(requested)) {
          if (
            !["PC", "NC", "NTC", "BLK", "LOD", "POS", "CAL"].includes(code) ||
            !Number.isInteger(n) ||
            n < 0 ||
            n > 12
          )
            throw new Error(
              "Control counts must be 0–12 for known control types.",
            );
          if (n > 0 && !base.some((c) => c.ctl === code)) {
            if (M(t[0]).kind === "taxon" && (code === "LOD" || code === "POS"))
              continue;
            let c;
            if (code === "NC")
              c = ctl("negative", code, "Non-GM control", (m) => ({
                copies: m.kind === "taxon" ? ng * cpn(crop) : 0,
                material: "Non-GM " + crop + " genomic DNA",
              }));
            else if (code === "NTC" || code === "BLK")
              c = ctl(
                "ntc",
                code,
                code === "BLK" ? "Extraction blank" : "NTC",
                () => ({
                  copies: 0,
                  material: code === "BLK" ? "DNA extraction blank" : "Water",
                }),
              );
            else if (code === "PC")
              c = ctl("positive", code, "PC " + mixName(t), (m) =>
                control(m, crop, ng),
              );
            else
              throw new Error(
                code +
                  " is not provided by this analysis template; choose a template containing it.",
              );
            groups.set(code + "|" + c.label, [c]);
          }
        }
        return [...groups.values()].flatMap((group) =>
          Array.from(
            {
              length: requested[group[0].ctl] ?? group.length,
            },
            (_, i) => ({
              ...group[i % group.length],
              rep: i + 1,
            }),
          ),
        );
      };
      notes.push(
        "Custom control counts per mix (CAL count applies to each calibrant level). Mixes without run controls in the procedure are left unchanged. Original method acceptance requirements remain applicable.",
      );
    }
    // capacity: whole rows per mix
    const perSample = X * REP,
      rowsFor = (n) =>
        tubes.reduce(
          (a, t) => a + Math.ceil((n * perSample + controls(t).length) / COLS),
          0,
        );
    let maxN = 0;
    while (rowsFor(maxN + 1) <= ROWS) maxN++;
    if (maxN === 0)
      throw new Error(
        "No sample fits with this extraction, replicate and control configuration.",
      );
    let use = samples;
    if (samples.length > maxN) {
      notes.push(
        `${samples.length} samples requested; ${maxN} fit on the 384-well plate with these mixes and controls. The rest were left out.`,
      );
      use = samples.slice(0, maxN);
    }
    let row = 0;
    for (const t of tubes) {
      let w = row * COLS;
      const fill = (role, extra) => {
        const W = wells[w++];
        Object.assign(W, extra.head);
        W.role = role;
        for (const id of t) {
          const m = M(id),
            d = extra.mk(m, id);
          W.t.push({
            m: id,
            q: d.q === undefined ? null : d.q,
            material: d.material,
            expectPct: d.pct,
          });
          W.sim.push(
            d.sim || {
              copies: d.copies,
            },
          );
        }
        W.material = [
          ...new Set(W.t.map((x) => x.material).filter(Boolean)),
        ].join(" + ");
      };
      use.forEach((smp, i) => {
        for (let e = 1; e <= X; e++)
          for (let r = 1; r <= REP; r++)
            fill("unknown", {
              head: {
                sample: smp.label,
                sampleNo: i + 1,
                ext: e,
                rep: r,
                ctl: "S",
              },
              mk: (m) => {
                const c =
                  mara && mara.mode !== "screen"
                    ? {
                        copies:
                          ng *
                          mara.copiesPerNg *
                          integrity(m.bp, smp.frag) *
                          (m.kind === "taxon"
                            ? 1
                            : (smp.events[m.event] || 0) / 100),
                      }
                    : P.sampleCopies(smp, m, ng);
                return {
                  sim: {
                    copies: c.copies,
                    imperfect: c.imperfect,
                    isSample: true,
                    inhibitor: smp.inhibitor,
                    sampleNo: i + 1,
                    ext: e,
                  },
                };
              },
            });
      });
      for (const c of controls(t))
        fill(c.role, {
          head: {
            sample: c.label,
            ctl: c.ctl,
            rep: c.rep,
          },
          mk: (m) => c.mk(m),
        });
      row += Math.ceil((use.length * perSample + controls(t).length) / COLS);
    }
    const out = {
      wells,
      tubes,
      taxon,
      notes,
      ng,
      pcNg: ng,
      samples: use.map((s, i) => ({
        no: i + 1,
        label: s.label,
        preset: s.key || null,
      })),
      capacity: {
        maxSamples: maxN,
        rowsUsed: row,
        rows: ROWS,
        cols: COLS,
        extractions: X,
        replicates: REP,
      },
    };
    if (mara) out.mara = mara;
    if (lab) out.lab = lab.id;
    if (calPct !== undefined) out.calPct = calPct;
    return out;
  };
  // cycling fields of the plate: taken from the first GM assay; the others are listed when they differ
  P.fields = function (tubes) {
    const all = tubes.flat().map(M),
      lead = all.find((m) => m.kind !== "taxon") || all[0],
      c = lead.cyc,
      diff = [];
    for (const m of all)
      if (
        m !== lead &&
        (m.cyc[4] !== c[4] ||
          m.cyc[2] !== c[2] ||
          m.cyc[1] !== c[1] ||
          m.cyc[0] > 0 !== c[0] > 0)
      )
        diff.push(
          `${m.id}: ${m.cyc[0] ? "UNG, " : ""}${m.cyc[1]} s activation, ${m.cyc[2]} × (95 °C ${m.cyc[3]} s, ${m.cyc[4]} °C ${m.cyc[5]} s)`,
        );
    return {
      f: {
        ung: c[0],
        act: c[1],
        cycles: c[2],
        denS: c[3],
        annT: c[4],
        annS: c[5],
        extT: c[6] || 72,
        extS: c[7] || 0,
        melt: all.some((m) => m.sybr),
        coolT: lead.cool ? lead.cool[0] : 0,
        coolS: lead.cool ? lead.cool[1] : 0,
      },
      lead: lead.id,
      diff,
    };
  };
  P.protocol = function (f, name) {
    const stages = [];
    if (f.ung > 0)
      stages.push({
        type: "hold",
        repeats: 1,
        steps: [
          {
            temp_c: 50,
            hold_s: f.ung,
          },
        ],
      });
    stages.push({
      type: "hold",
      repeats: 1,
      steps: [
        {
          temp_c: 95,
          hold_s: Math.max(1, f.act),
        },
      ],
    });
    // the 384-well plate is imaged by a camera in 0.12 s, so the 1 s acquisition hold of the OpticalCyclerA templates is kept
    const readHold = (s0) => Math.max(s0, P.MIN_READ_S);
    const steps = [
      {
        temp_c: 95,
        hold_s: f.denS,
      },
    ];
    if (f.extS > 0)
      steps.push(
        {
          temp_c: f.annT,
          hold_s: f.annS,
        },
        {
          temp_c: f.extT,
          hold_s: readHold(f.extS),
          read: true,
        },
      );
    else
      steps.push({
        temp_c: f.annT,
        hold_s: readHold(f.annS),
        read: true,
      });
    stages.push({
      type: "cycle",
      repeats: f.cycles,
      steps,
    });
    if (f.melt)
      stages.push({
        type: "melt",
        from_c: 65,
        to_c: 95,
        rate_c_per_s: 0.1,
      });
    if (f.coolS > 0)
      stages.push({
        type: "hold",
        repeats: 1,
        steps: [
          {
            temp_c: f.coolT || 40,
            hold_s: f.coolS,
          },
        ],
      });
    return {
      name: name || "EURL GMFF method programme",
      lid_c: 105,
      stages,
    };
  };
  // reactions for the instrument model
  /* opts.runIndex: number of the run in the session, so that each run draws its own natural variation (the seed still decides
   * everything else); opts.natural === false switches the natural variation off (repeatable teaching runs). */
  P.simWells = function (plate, settings, f, seed, opts) {
    opts = opts || {};
    const g = new R2.Rng(77 + (seed || 7)),
      info = {},
      V = P.VARIATION,
      natural = opts.natural !== false;
    const gv = new R2.Rng(
        9001 + (seed || 7) * 131 + (opts.runIndex || 0) * 7919,
      ),
      runShift = natural ? V.runSd * gv.gauss() : 0,
      tubeShift = [];
    const extr = new Map(); // one draw per sub-sample (independent DNA extraction)
    const extOf = (W) => {
      const k = W.sampleNo + "/" + W.ext;
      if (!extr.has(k))
        extr.set(
          k,
          natural
            ? {
                dna: V.extractionSd * gv.gauss(),
                gm: Math.exp(V.gmCv * gv.gauss() - (V.gmCv * V.gmCv) / 2),
              }
            : {
                dna: 0,
                gm: 1,
              },
        );
      return extr.get(k);
    };
    const wells = plate.wells.map((W, w) => {
      if (W.role === "empty") {
        tubeShift.push(null);
        return {
          kind: "empty",
        };
      }
      const xe = W.role === "unknown" && W.ext ? extOf(W) : null;
      const z = natural
          ? (W.role === "standard" || W.role === "positive"
              ? V.refTubeSd
              : V.tubeSd) * gv.gauss()
          : 0,
        k = Math.pow(2, -(runShift + z));
      tubeShift.push(+z.toFixed(4));
      const rx = W.t.map((t, i) => {
        const b = R2.reagents.build(
          M(t.m),
          settings,
          Object.assign(
            {
              annealC: f.annT,
              annS: f.annS,
              ungStep: f.ung > 0,
            },
            W.sim[i],
          ),
          g,
        );
        b.a.copies *= k;
        if (xe)
          b.a.copies *=
            Math.pow(2, -xe.dna) * (M(t.m).kind === "taxon" ? 1 : xe.gm);
        info[t.m] = b.info;
        return b.a;
      });
      const a = rx[0];
      if (rx[1]) a.second = rx[1];
      return a;
    });
    return {
      wells,
      info,
      variation: {
        extractions: [...extr].map(([k, v]) => ({
          subsample: k,
          dnaShiftCycles: +v.dna.toFixed(4),
          gmFactor: +v.gm.toFixed(4),
        })),
        extractionSd: natural ? V.extractionSd : 0,
        gmCv: natural ? V.gmCv : 0,
        natural,
        runIndex: opts.runIndex || 0,
        runShiftCycles: +runShift.toFixed(4),
        tubeShiftCycles: tubeShift,
        tubeSd: natural ? V.tubeSd : 0,
        refTubeSd: natural ? V.refTubeSd : 0,
        runSd: natural ? V.runSd : 0,
        source: V.source,
      },
    };
  };
  P.name = (id) => {
    const m = M(id);
    return m.kind === "taxon"
      ? m.target.split(" ")[0] + " (" + m.crop + ")"
      : m.kind === "event"
        ? m.event
        : D().elementNames[m.el];
  };
  P.channel = (id) => {
    const m = M(id);
    return m.P ? R2.reagents.channelOf(m.P[1]) : 0;
  };
})(window.R2);
