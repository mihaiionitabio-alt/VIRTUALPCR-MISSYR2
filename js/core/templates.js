/* Analysis templates: everything that defines an analysis on the technician bench (species and material preset, step,
 * assays, duplex, DNA per reaction, reagent composition and handling, programme, reaction-mix settings, variation switch),
 * without the run's identity. A template is chosen at the start of a new analysis and saved after a run.
 * Built-in templates take the programme from the method records; saved ones keep the programme as it was run.
 * Stored in this browser (local storage) and downloadable as JSON, so they can be moved to another computer. */
(function (R2) {
  "use strict";
  const T = (R2.templates = {}),
    KEY = "missy-r2-templates",
    FORMAT = "missy-r2-workbench-template/0.1";
  const screenSet = [
    "QL-ELE-00-012",
    "QL-ELE-00-013",
    "QT-ELE-00-002",
    "QL-CON-00-008",
  ];
  T.builtIn = [
    {
      id: "TPL-MARA-17-SOY",
      name: "Rapid soybean screening (P-35S and T-nos)",
      builtIn: true,
      samplePreset: "soyA",
      crop: "soybean",
      stage: "screen",
      layout: "mara17",
      assays: ["MARA-17-35S", "MARA-17-NOS"],
    },
    {
      id: "TPL-MARA-ND207-IDENT",
      name: "ND207 identification",
      builtIn: true,
      samplePreset: "mara1",
      crop: "maize",
      stage: "ident",
      layout: "mara",
      assays: ["MARA-1-EVENT"],
      dna: {
        concNgPerUl: 50,
        volUl: 2,
      },
    },
    {
      id: "TPL-MARA-ND207-QUANT",
      name: "ND207 quantification",
      builtIn: true,
      samplePreset: "mara1",
      crop: "maize",
      stage: "quant",
      layout: "mara",
      assays: ["MARA-1-EVENT"],
      dna: {
        concNgPerUl: 50,
        volUl: 2,
      },
    },
    {
      id: "TPL-MARA-ND207-DDCT",
      name: "ND207 relative comparison (ΔΔCt)",
      builtIn: true,
      samplePreset: "mara1",
      crop: "maize",
      stage: "ident",
      layout: "mara16",
      assays: ["MARA-1-EVENT"],
      dna: {
        concNgPerUl: 50,
        volUl: 2,
      },
    },
    {
      id: "TPL-BUILTIN-SOY-SCREEN",
      name: "Soybean screening: P-35S + T-nos duplex, pat, CTP2–CP4 EPSPS",
      builtIn: true,
      samplePreset: "soyA",
      crop: "soybean",
      stage: "screen",
      assays: screenSet,
      duplex: true,
    },
    {
      id: "TPL-BUILTIN-MAIZE-SCREEN",
      name: "Maize screening: P-35S + T-nos duplex, pat, CTP2–CP4 EPSPS",
      builtIn: true,
      samplePreset: "maiE",
      crop: "maize",
      stage: "screen",
      assays: screenSet,
      duplex: true,
    },
    {
      id: "TPL-BUILTIN-SOY-40-3-2",
      name: "Soybean 40-3-2 quantification (QT-EVE-GM-005 with lectin)",
      builtIn: true,
      samplePreset: "soyA",
      crop: "soybean",
      stage: "quant",
      assays: ["QT-EVE-GM-005"],
      duplex: false,
    },
    {
      id: "TPL-BUILTIN-MAIZE-MON810",
      name: "Maize MON810 quantification (QT-EVE-ZM-020 with HMG)",
      builtIn: true,
      samplePreset: "maiC",
      crop: "maize",
      stage: "quant",
      assays: ["QT-EVE-ZM-020"],
      duplex: false,
    },
    {
      id: "TPL-BUILTIN-SIMPLEX-SC-SOY",
      name: "Soybean screening: P-35S, T-nos and Le1, simplex",
      builtIn: true,
      samplePreset: "soyA",
      crop: "soybean",
      stage: "screen",
      layout: "simplex",
      assays: screenSet,
      duplex: false,
      mix: {
        ...R2.LAB.simplex.mix,
      },
      dna: {
        ...R2.LAB.simplex.dna,
      },
    },
    {
      id: "TPL-BUILTIN-SIMPLEX-SC-MAIZE",
      name: "Maize screening: P-35S, T-nos and hmgA, simplex",
      builtIn: true,
      samplePreset: "maiD",
      crop: "maize",
      stage: "screen",
      layout: "simplex",
      assays: screenSet,
      duplex: false,
      mix: {
        ...R2.LAB.simplex.mix,
      },
      dna: {
        ...R2.LAB.simplex.dna,
      },
    },
  ].map((t) =>
    Object.assign(
      {
        format: FORMAT,
        dna: {
          ...R2.gmoplan.DNA,
        },
        settings: null,
        fields: null,
        mix: null,
        natural: true,
        layout: "eurl",
      },
      t,
    ),
  );
  const stored = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return T._mem || (T._mem = []);
    }
  };
  const store = (list) => {
    T._mem = list;
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };
  T.list = () => T.builtIn.concat(stored());
  T.get = (id) => T.list().find((t) => t.id === id);
  // the template of the technician's current set-up (X = R2.tech)
  T.capture = function (X, name) {
    const t = {
      format: FORMAT,
      name: (name || "").trim() || "Template",
      created: new Date().toISOString(),
      samplePreset: X.sampleKey,
      crop: X.sample.crop,
      stage: X.stage,
      layout: X.layout || "eurl",
      assays: X.chosen[X.stage].slice(),
      duplex: !!X.duplex,
      dna: {
        ...X.dna,
      },
      settings: {
        ...X.settings,
      },
      fields: {
        ...X.f,
      },
      design: structuredClone(X.design || null),
      mix: X.mixSettings
        ? {
            ...X.mixSettings,
          }
        : null,
      natural: X.natural !== false,
    };
    if (X.meta?.some((row) => row.label))
      t.batch = X.meta.map((row, i) => ({
        ...row,
        preset: i === 0 ? X.sampleKey : X.extra[i - 1],
      }));
    t.sop_id = T.sopId(X);
    t.id =
      "TPL-" +
      R2.sha256(
        R2.utf8(
          R2.sop.canonical({
            ...t,
            created: null,
            name: null,
          }),
        ),
      )
        .slice(0, 10)
        .toUpperCase();
    return t;
  };
  T.sopId = (X) =>
    R2.sop.idOf(
      R2.sop.definition({
        mara: X.plan.mara,
        lab: X.plan.lab,
        stage: X.stage,
        crop: X.sample.crop,
        dna: X.dna,
        ng: X.ng,
        settings: X.settings,
        mix: X.mixSettings,
        plate: X.plan.wells,
        protocol: X.protocol(),
      }),
    );
  T.save = function (t) {
    const list = stored().filter((x) => x.id !== t.id && x.name !== t.name);
    list.push(t);
    return store(list);
  };
  T.remove = (id) => store(stored().filter((x) => x.id !== id));
  /* OpticalCyclerA 480 run template (.ixo, "objectstream"): the programme (holds, cycles, segments with acquisition), the
   * detection channels and the reaction volume. It carries no assays, so applying it changes only the programme and the
   * reaction volume of the current analysis. */
  T.fromIxo = function (text, file) {
    const grab = (blk, name) => {
      const m = new RegExp('<prop name="' + name + '">([^<]*)</prop>').exec(
        blk,
      );
      return m ? m[1] : null;
    };
    const progs = text
      .split('class="HTCRunProgram"')
      .slice(1)
      .map((b) => {
        b = b.split('class="HTCRunProgram"')[0];
        return {
          name: grab(b, "name"),
          cycles: +grab(b, "Cycles"),
          mode: grab(b, "AnalysisMode"),
          segs: b
            .split('class="HTCRunSegment"')
            .slice(1)
            .map((g) => ({
              T: +grab(g, "Target"),
              hold: +grab(g, "Hold"),
              slope: +grab(g, "Slope"),
              acq: +grab(g, "AcquisitionMode"),
            })),
        };
      });
    if (!progs.length)
      throw new Error("no programme found in the OpticalCyclerA template");
    const cyc =
      progs.find((p) => p.cycles > 1 && p.mode === "Quantification") ||
      progs.find((p) => p.cycles > 1);
    if (!cyc || cyc.segs.length < 2)
      throw new Error("no amplification programme with at least two segments");
    const before = progs.slice(0, progs.indexOf(cyc)),
      after = progs.slice(progs.indexOf(cyc) + 1);
    const act = before.flatMap((p) => p.segs).find((g) => g.T >= 90),
      ung = before.flatMap((p) => p.segs).find((g) => g.T >= 45 && g.T <= 55),
      cool = after.flatMap((p) => p.segs).find((g) => g.T < 50);
    const f = {
      ung: ung ? ung.hold : 0,
      act: act ? act.hold : 0,
      cycles: cyc.cycles,
      denS: cyc.segs[0].hold,
      annT: cyc.segs[1].T,
      annS: cyc.segs[1].hold,
      extT: cyc.segs[2] ? cyc.segs[2].T : 72,
      extS: cyc.segs[2] ? cyc.segs[2].hold : 0,
      melt: progs.some((p) => /melting/i.test(p.mode || "")),
      coolT: cool ? cool.T : 0,
      coolS: cool ? cool.hold : 0,
    };
    const name =
      (/<obj name="root" class="Template"[^>]*>\s*<prop name="name">([^<]*)</.exec(
        text,
      ) || [])[1] ||
      file ||
      "OpticalCyclerA template";
    const channels = [
      ...text.matchAll(
        /class="HTCChannel"[\s\S]*?<prop name="name">([^<]*)<\/prop>[\s\S]*?<prop name="EmissionWL">(\d+)<\/prop>[\s\S]*?<prop name="ExcitationWL">(\d+)<\/prop>/g,
      ),
    ].map((m) => ({
      name: m[1],
      excitation: +m[3],
      emission: +m[2],
    }));
    const vol =
        +(/<prop name="SampleVolume">([\d.]+)</.exec(text) || [])[1] || null,
      uid = (/<prop name="UID">([0-9A-F]+)</.exec(text) || [])[1] || "";
    return {
      format: FORMAT,
      id:
        "TPL-IXO-" +
        (uid.slice(0, 10) ||
          R2.sha256(R2.utf8(text)).slice(0, 10).toUpperCase()),
      name: "OpticalCyclerA 480: " + name,
      programmeOnly: true,
      fields: f,
      mix: vol
        ? {
            rxnUl: vol,
          }
        : null,
      source: {
        kind: "OpticalCyclerA 480 run template (.ixo)",
        file: file || null,
        template: name,
        uid,
        channels,
        programs: progs.map((p) => ({
          name: p.name,
          cycles: p.cycles,
          analysis: p.mode,
          segments: p.segs,
        })),
        note: "Ramp slopes of the template are kept here for the record; the R2 block uses its own ramp limit. A 1 s acquisition hold is lengthened to the 2 s the R2 block needs to read 16 tubes.",
      },
    };
  };
  T.parse = function (text, file) {
    if (/^\s*<objectstream/.test(text)) return T.fromIxo(text, file);
    const t = JSON.parse(text);
    if (t.format !== FORMAT)
      throw new Error(
        "not a workbench template (format " + (t.format || "missing") + ")",
      );
    for (const k of ["crop", "stage", "assays"])
      if (t[k] === undefined) throw new Error("template without " + k);
    if (!["screen", "ident", "quant"].includes(t.stage))
      throw new Error("unknown analysis step " + t.stage);
    for (const id of t.assays)
      if (!R2.GMO.methods[id]) throw new Error("unknown method " + id);
    if (!t.id)
      t.id = "TPL-" + R2.sha256(R2.utf8(text)).slice(0, 10).toUpperCase();
    delete t.builtIn;
    return t;
  };
  // apply a template to the technician bench: species and material first, then step, assays, amounts, settings and programme
  T.apply = function (t, X) {
    if (t.programmeOnly) {
      // a OpticalCyclerA template: programme and reaction volume only
      X.f = {
        ...X.f,
        ...t.fields,
      };
      if (t.mix && t.mix.rxnUl)
        X.mixSettings = Object.assign(
          {},
          R2.mixcalc.DEFAULT,
          X.mixSettings || {},
          {
            rxnUl: t.mix.rxnUl,
          },
        );
      X.prof = R2.planProfile(X.protocol());
      X.templateUsed = {
        id: t.id,
        name: t.name,
        programmeOnly: true,
      };
      return X;
    }
    X.design = structuredClone(t.design || null);
    const preset =
      R2.GMO.samples.find((s) => s.key === t.samplePreset) ||
      R2.GMO.samples.find((s) => s.crop === t.crop && !s.blind);
    if (
      !X.sample ||
      X.sample.crop !== t.crop ||
      (t.samplePreset && X.sampleKey !== t.samplePreset)
    )
      X.setSample(preset.key);
    X.settings = Object.assign({}, R2.reagents.DEFAULT, t.settings || {});
    X.dna = {
      ...R2.gmoplan.DNA,
      ...(t.dna || {}),
    };
    X.ng = +(X.dna.concNgPerUl * X.dna.volUl).toFixed(2);
    X.mixSettings = Object.assign({}, R2.mixcalc.DEFAULT, t.mix || {});
    X.natural = t.natural !== false;
    X.layout = R2.LAB[t.layout]?.currentLayout || t.layout || "eurl";
    X.stage = t.stage;
    X.chosen[t.stage] = t.assays.slice();
    X.duplex = !!t.duplex;
    X.setStage(t.stage, true);
    if (Array.isArray(t.batch) && t.batch.length) {
      X.meta = t.batch.map((row) => ({
        label: String(row.label || "").slice(0, 100),
        extractionDate:
          row.extractionDate || new Date().toISOString().slice(0, 10),
      }));
      X.extra = t.batch
        .slice(1)
        .map((row) =>
          R2.GMO.samples.some(
            (s) => s.key === row.preset && (s.crop === t.crop || s.blind),
          )
            ? row.preset
            : X.sampleKey,
        );
      X.build(false);
    }
    if (t.fields) {
      X.f = {
        ...X.f,
        ...t.fields,
      };
      X.prof = R2.planProfile(X.protocol());
    }
    X.templateUsed = {
      id: t.id,
      name: t.name,
      builtIn: !!t.builtIn,
    };
    return X;
  };
})(window.R2);
