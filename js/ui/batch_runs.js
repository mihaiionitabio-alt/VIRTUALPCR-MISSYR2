/* JSON run profiles: describe any number of virtual runs in one JSON file and generate them without opening the
 * Technician tabs. Every option of the Technician bench at Administrator level can be set: template, material of each
 * sample, analysis step, procedure, assays, duplex, sample composition, number of samples with their extraction dates and
 * names, DNA per reaction, seed and natural variation, primers and probe, storage and handling, programme, reaction-mix
 * calculator, extraction times of the reference materials, and the qPCR error scenario.
 *
 * A run is built by the same code as a run started by hand (R2.tech.prepareRun / completeRun in js/ui/tech/t09_run.js):
 * the profile only sets the bench, the bench builds the plate, the instrument plays the programme as fast as the browser
 * allows, and the finished run is filed for the Quality manager like any other. The Technician's own set-up is saved
 * before a batch and restored afterwards.
 *
 * Format (missy-r2-batch/1):
 *   { "format": "missy-r2-batch/1", "name": "…", "description": "…",
 *     "defaults": { …run settings… },              applied to every run group
 *     "runs": [ { …run settings…, "repeat": 3 } ],   each group, repeated `repeat` times
 *     "output": { "openQuality": true, "selectForMissy": true, "downloadRdmltZip": false } }
 * Run settings: see R2.batchRuns.FIELDS and the README in docs/JSON_RUN_PROFILES.md. */
(function (R2) {
  "use strict";
  const B = (R2.batchRuns = {}),
    X = () => R2.tech,
    FORMAT = "missy-r2-batch/1",
    MAX_RUNS = 200,
    WARN_RUNS = 40;
  B.FORMAT = FORMAT;
  B.MAX_RUNS = MAX_RUNS;
  B.WARN_RUNS = WARN_RUNS;
  const today = () => new Date().toISOString().slice(0, 10);
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const clone = (v) =>
    v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  // ---------------------------------------------------------------- option tables (shared with the builder)
  const temps = [-80, -20, 4, 22, 37];
  B.FIELDS = {
    reagents: [
      {
        k: "primerF",
        label: "Forward primer × method",
        type: "number",
        min: 0.05,
        max: 5,
        step: 0.05,
        group: "Primers and probe",
      },
      {
        k: "primerR",
        label: "Reverse primer × method",
        type: "number",
        min: 0.05,
        max: 5,
        step: 0.05,
        group: "Primers and probe",
      },
      {
        k: "probe",
        label: "Probe × method",
        type: "number",
        min: 0.05,
        max: 5,
        step: 0.05,
        group: "Primers and probe",
      },
      {
        k: "quencher",
        label: "Quencher",
        type: "select",
        options: ["method", "TAMRA", "BHQ1", "MGBNFQ"],
        group: "Primers and probe",
      },
      {
        k: "probeMismatch",
        label: "Target variant with one mismatch under the probe",
        type: "bool",
        group: "Primers and probe",
      },
      {
        k: "probeStoreC",
        label: "Probe stored at (°C)",
        type: "select",
        options: temps,
        group: "Storage",
      },
      {
        k: "probeMonths",
        label: "Probe storage (months)",
        type: "number",
        min: 0,
        max: 120,
        step: 1,
        group: "Storage",
      },
      {
        k: "probeLightH",
        label: "Probe in room light (h)",
        type: "number",
        min: 0,
        max: 500,
        step: 1,
        group: "Storage",
      },
      {
        k: "freezeThaw",
        label: "Freeze–thaw cycles",
        type: "number",
        min: 0,
        max: 200,
        step: 1,
        group: "Storage",
      },
      {
        k: "primerStoreC",
        label: "Primers stored at (°C)",
        type: "select",
        options: temps,
        group: "Storage",
      },
      {
        k: "primerMonths",
        label: "Primer storage (months)",
        type: "number",
        min: 0,
        max: 120,
        step: 1,
        group: "Storage",
      },
      {
        k: "mixStoreC",
        label: "Master mix stored at (°C)",
        type: "select",
        options: temps,
        group: "Storage",
      },
      {
        k: "mixMonths",
        label: "Master mix storage (months)",
        type: "number",
        min: 0,
        max: 60,
        step: 1,
        group: "Storage",
      },
      {
        k: "hotStart",
        label: "Hot-start polymerase",
        type: "bool",
        group: "Bench and room",
      },
      {
        k: "benchMin",
        label: "Plate waits on the bench (min)",
        type: "number",
        min: 0,
        max: 240,
        step: 1,
        group: "Bench and room",
      },
      {
        k: "ambientC",
        label: "Room temperature (°C)",
        type: "number",
        min: 10,
        max: 38,
        step: 1,
        group: "Bench and room",
      },
      {
        k: "carryover",
        label: "Amplicon carry-over (copies per tube)",
        type: "number",
        min: 0,
        max: 100000,
        step: 10,
        group: "Bench and room",
      },
      {
        k: "ungActive",
        label: "UNG active in the mix",
        type: "bool",
        group: "Bench and room",
      },
      {
        k: "pipetCV",
        label: "Pipetting scatter (%)",
        type: "number",
        min: 0,
        max: 30,
        step: 1,
        group: "Bench and room",
      },
      {
        k: "inhibitor",
        label: "Extra inhibitor in the sample",
        type: "number",
        min: 0,
        max: 0.8,
        step: 0.05,
        group: "Bench and room",
      },
    ],
    programme: [
      {
        k: "ung",
        label: "UNG step at 50 °C (s)",
        type: "number",
        min: 0,
        max: 600,
        step: 1,
      },
      {
        k: "act",
        label: "Activation at 95 °C (s)",
        type: "number",
        min: 1,
        max: 1200,
        step: 1,
      },
      {
        k: "cycles",
        label: "Cycles",
        type: "number",
        min: 5,
        max: 60,
        step: 1,
      },
      {
        k: "denS",
        label: "Denature 95 °C (s)",
        type: "number",
        min: 1,
        max: 120,
        step: 1,
      },
      {
        k: "annT",
        label: "Anneal/extend (°C)",
        type: "number",
        min: 40,
        max: 75,
        step: 0.5,
      },
      {
        k: "annS",
        label: "Anneal/extend (s)",
        type: "number",
        min: 5,
        max: 180,
        step: 1,
      },
      {
        k: "extS",
        label: "Extra 72 °C step (s)",
        type: "number",
        min: 0,
        max: 120,
        step: 1,
      },
      {
        k: "melt",
        label: "Melt curve 65 → 95 °C",
        type: "bool",
      },
    ],
    mix: [
      {
        k: "minSolutionUl",
        label: "Minimum prepared DNA solution (µL)",
        type: "number",
        min: 0.1,
        max: 2000,
        step: 0.1,
      },
      {
        k: "masterMixX",
        label: "Master mix",
        type: "select",
        options: [2, 4, 5, 10],
      },
      {
        k: "rxnUl",
        label: "Reaction volume (µL; empty = method record)",
        type: "number",
        min: 5,
        max: 100,
        step: 1,
        nullable: true,
      },
      {
        k: "excessPct",
        label: "Excess (%)",
        type: "number",
        min: 0,
        max: 50,
        step: 1,
      },
      {
        k: "extraReactions",
        label: "Extra reactions",
        type: "number",
        min: 0,
        max: 10,
        step: 1,
      },
      {
        k: "roundUl",
        label: "Round up to (µL)",
        type: "select",
        options: [0.1, 0.5, 1],
      },
      {
        k: "minPipetUl",
        label: "Smallest pipetted volume (µL)",
        type: "number",
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      {
        k: "primerStockUM",
        label: "Primer stocks (µmol/L)",
        type: "number",
        min: 0.1,
        max: 100,
        step: 0.1,
      },
      {
        k: "probeStockUM",
        label: "Probe stocks (µmol/L)",
        type: "number",
        min: 0.1,
        max: 100,
        step: 0.1,
      },
      {
        k: "sampleStockNgPerUl",
        label: "Sample extract measured at (ng/µL)",
        type: "number",
        min: 0.1,
        max: 2000,
        step: 0.1,
      },
      {
        k: "crmStockNgPerUl",
        label: "Certified-material extract (ng/µL)",
        type: "number",
        min: 0.1,
        max: 2000,
        step: 0.1,
      },
    ],
    dna: [
      {
        k: "concNgPerUl",
        label: "DNA extract diluted to (ng/µL)",
        type: "number",
        min: 0.1,
        max: 200,
        step: 0.1,
      },
      {
        k: "volUl",
        label: "Template per reaction (µL)",
        type: "number",
        min: 1,
        max: 20,
        step: 0.5,
      },
    ],
    sample1: [
      {
        k: "fragmentBp",
        label: "Mean DNA fragment (bp)",
        type: "number",
        min: 60,
        max: 20000,
        step: 10,
      },
      {
        k: "inhibitor",
        label: "Inhibitor carry-over in the extract",
        type: "number",
        min: 0,
        max: 0.8,
        step: 0.05,
      },
    ],
  };
  B.STAGES = {
    screen: "Screening: elements and constructs",
    ident: "Identification: event-specific, qualitative",
    quant: "Quantification: event against the species reference gene",
  };
  B.PROCEDURES = {
    mara17: "Rapid fluorescence screening",
    eurl: "Duplex marker screening / reference-method event assays",
    simplex: "Simplex screening (P-35S, T-nos, reference gene)",
    mara: "Event identification or quantification (MARA)",
    mara16: "Relative ΔΔCt comparison",
  };
  B.procedureName = (proc, stage) =>
    proc === "eurl"
      ? stage === "screen"
        ? "Duplex marker screening"
        : "Reference-method event assays"
      : proc === "mara"
        ? stage === "quant"
          ? "Event quantification by standard curves"
          : "Event identification"
        : B.PROCEDURES[proc] || proc;
  B.proceduresFor = (stage, crop) =>
    stage === "screen"
      ? crop === "cotton"
        ? []
        : ["mara17", "eurl", "simplex"]
      : stage === "ident"
        ? ["mara", "mara16", ...(crop !== "cotton" ? ["eurl"] : [])]
        : ["mara", ...(crop !== "cotton" ? ["eurl"] : [])];
  B.normalize = function (p) {
    if (!p || typeof p !== "object") return p;
    if (
      p.format !== "missy-r2-batch-plan/1" &&
      !(
        p.format === FORMAT &&
        !Array.isArray(p.runs) &&
        p.template &&
        p.count !== undefined
      )
    )
      return p;
    const groups =
      p.format === "missy-r2-batch-plan/1" ? p.configurations : [p];
    if (!Array.isArray(groups) || !groups.length)
      throw new Error("The plan needs at least one configuration.");
    const runs = [];
    for (const c of groups) {
      if (!Number.isInteger(c.count) || c.count < 1 || c.count > MAX_RUNS)
        throw new Error("Configuration count must be 1–" + MAX_RUNS);
      const base = {
        name: c.name || "Configuration",
        repeat: c.count,
        template: clone(c.template),
        seed: c.seed,
        seedStep: 1,
        naturalVariation: c.template.natural !== false,
        reagents: clone(c.template.settings),
        design: clone(c.design || c.template.design),
        dna: clone(c.template.dna),
        mix: clone(c.template.mix),
        referenceExtractions: clone(c.extractions || {}),
        samples: (
          c.samples ||
          c.template.batch || [
            {
              preset: c.template.samplePreset,
            },
          ]
        ).map((x) => ({
          material: x.preset || c.template.samplePreset,
          extractionDate: x.extractionDate || today(),
          label: x.label || "",
        })),
      };
      if (c.sample)
        Object.assign(base.samples[0], {
          gm: clone(c.sample.events),
          fragmentBp: c.sample.frag,
          inhibitor: c.sample.inhibitor,
        });
      if (c.scenarioIds?.length) {
        for (let i = 0; i < c.count; i++)
          runs.push({
            ...clone(base),
            repeat: 1,
            seed: Math.min(99999, c.seed + i),
            errorScenario: c.scenarioIds[i % c.scenarioIds.length],
          });
      } else runs.push(base);
    }
    return {
      format: FORMAT,
      name: p.name || "Imported batch plan",
      runs,
      output: {
        openQuality: true,
        selectForMissy: true,
        downloadRdmltZip: false,
      },
    };
  };
  // ---------------------------------------------------------------- checking one value against its table row
  function check(row, v, path, errors) {
    if (v === null && row.nullable) return null;
    if (row.type === "bool") {
      if (typeof v !== "boolean")
        errors.push(`${path}: true or false expected`);
      return !!v;
    }
    if (row.type === "select") {
      const hit = row.options.find((o) => String(o) === String(v));
      if (hit === undefined)
        errors.push(
          `${path}: one of ${row.options.join(", ")} expected, got ${JSON.stringify(v)}`,
        );
      return hit === undefined ? row.options[0] : hit;
    }
    const n = typeof v === "number" ? v : NaN;
    if (!Number.isFinite(n)) {
      errors.push(`${path}: number expected, got ${JSON.stringify(v)}`);
      return row.min;
    }
    if (n < row.min || n > row.max)
      errors.push(`${path}: ${n} is outside ${row.min}–${row.max}`);
    return R2.clamp(n, row.min, row.max);
  }

  function checkBlock(table, obj, path, errors) {
    if (obj === undefined) return undefined;
    if (!isObj(obj)) {
      errors.push(path + ": object expected");
      return undefined;
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const row = table.find((r) => r.k === k);
      if (!row) {
        errors.push(
          `${path}.${k}: unknown setting (known: ${table.map((r) => r.k).join(", ")})`,
        );
        continue;
      }
      out[k] = check(row, v, path + "." + k, errors);
    }
    return out;
  }
  // ---------------------------------------------------------------- profile → expanded list of runs
  const KNOWN = [
    "name",
    "repeat",
    "template",
    "material",
    "stage",
    "procedure",
    "assays",
    "duplex",
    "samples",
    "sampleCount",
    "dna",
    "seed",
    "seedStep",
    "naturalVariation",
    "reagents",
    "programme",
    "mix",
    "referenceExtractions",
    "design",
    "errorScenario",
    "note",
  ];

  function merge(a, b) {
    const out = clone(a) || {};
    for (const [k, v] of Object.entries(b || {}))
      out[k] =
        isObj(v) && isObj(out[k]) && !["template"].includes(k)
          ? merge(out[k], v)
          : clone(v);
    return out;
  }
  // checks the whole profile without touching the bench; returns { runs:[{spec, group, k, label}], errors, warnings, output }
  B.parse = function (input) {
    let p = input,
      errors = [],
      warnings = [];
    if (typeof p === "string") {
      try {
        p = JSON.parse(p);
      } catch (err) {
        return {
          runs: [],
          errors: ["Not valid JSON: " + err.message],
          warnings,
          output: {},
        };
      }
    }
    try {
      p = B.normalize(p);
    } catch (e) {
      return {
        runs: [],
        errors: [e.message],
        warnings,
        output: {},
      };
    }

    function unsafe(v) {
      if (!v || typeof v !== "object") return false;
      return Object.entries(v).some(
        ([k, x]) =>
          ["__proto__", "constructor", "prototype"].includes(k) || unsafe(x),
      );
    }
    if (unsafe(p))
      return {
        runs: [],
        errors: ["Unsupported object key in profile."],
        warnings,
        output: {},
      };
    if (!isObj(p))
      return {
        runs: [],
        errors: ["The profile must be a JSON object."],
        warnings,
        output: {},
      };
    if (p.format !== FORMAT)
      errors.push(
        `format must be "${FORMAT}" (got ${JSON.stringify(p.format)})`,
      );
    if (!Array.isArray(p.runs) || !p.runs.length)
      errors.push("runs: a list with at least one run group is required");
    for (const k of Object.keys(p))
      if (
        ![
          "format",
          "name",
          "description",
          "created",
          "createdWith",
          "defaults",
          "runs",
          "output",
        ].includes(k)
      )
        warnings.push(`${k}: not a profile field, ignored`);
    if (p.defaults !== undefined && !isObj(p.defaults))
      errors.push("defaults: object expected");
    const runs = [];
    (Array.isArray(p.runs) ? p.runs : []).forEach((g, gi) => {
      if (!isObj(g)) {
        errors.push(`runs[${gi}]: object expected`);
        return;
      }
      const spec = merge(p.defaults || {}, g),
        path = `runs[${gi}]`;
      for (const k of Object.keys(spec))
        if (!KNOWN.includes(k))
          errors.push(`${path}.${k}: unknown run setting`);
      const repeat = spec.repeat === undefined ? 1 : spec.repeat;
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_RUNS)
        errors.push(`${path}.repeat: whole number 1–${MAX_RUNS} expected`);
      const e0 = errors.length;
      B.validateSpec(spec, path, errors, warnings);
      if (errors.length > e0) return;
      for (let k = 0; k < Math.max(1, Math.min(MAX_RUNS, repeat | 0)); k++)
        runs.push({
          spec,
          group: gi,
          k,
          label: g.name || spec.name || `group ${gi + 1}`,
        });
    });
    if (runs.length > MAX_RUNS)
      errors.push(
        `${runs.length} runs requested; at most ${MAX_RUNS} per profile`,
      );
    else if (runs.length > WARN_RUNS)
      warnings.push(
        `${runs.length} runs: every run keeps its full raw record in this browser tab (about 15–25 MB each). Download the RDMLt files as they are made if memory is short.`,
      );
    const output = Object.assign(
      {
        openQuality: true,
        selectForMissy: true,
        downloadRdmltZip: false,
      },
      isObj(p.output) ? p.output : {},
    );
    if (p.output !== undefined && !isObj(p.output))
      errors.push("output: object expected");
    for (const [key, value] of Object.entries(p.output || {})) {
      if (
        !["openQuality", "selectForMissy", "downloadRdmltZip"].includes(key) ||
        typeof value !== "boolean"
      )
        errors.push("output." + key + ": known boolean option expected");
    }
    return {
      name: p.name || "JSON run profile",
      description: p.description || "",
      runs,
      errors,
      warnings,
      output,
      profile: p,
    };
  };
  // When the template of a group changes, settings that belonged to the previous analysis are
  // removed so that every editor (Assisted, Visual, Audio) produces the same run and SOP.
  // Kept: names, labels, dates, design, reagents, programme, mix, DNA, seed, scenario.
  B.resetForTemplate = function (g, previousTemplate) {
    const T = R2.templates, D = R2.GMO;
    const next = typeof g.template === "string" ? T.get(g.template) : g.template;
    const prev = typeof previousTemplate === "string" ? T.get(previousTemplate) : previousTemplate;
    const removed = [];
    for (const k of ["stage", "procedure", "assays", "duplex"])
      if (g[k] !== undefined) { delete g[k]; removed.push(k); }
    const cropOf = (key) => { const m = D.samples.find((x) => x.key === key); return m && !m.blind ? m.crop : null; };
    if (next && next.crop) {
      if (g.material && cropOf(g.material) && cropOf(g.material) !== next.crop) { delete g.material; removed.push("material"); }
      (g.samples || []).forEach((s, i) => {
        if (s && s.material && cropOf(s.material) && cropOf(s.material) !== next.crop) { delete s.material; removed.push(`samples[${i}].material`); }
      });
      if (g.samples && g.samples[0] && g.samples[0].gm && prev && prev.crop !== next.crop) { delete g.samples[0].gm; removed.push("samples[0].gm"); }
      if (g.referenceExtractions && (!prev || prev.crop !== next.crop)) { delete g.referenceExtractions; removed.push("referenceExtractions"); }
    }
    return removed;
  };
  // static checks of one run's settings (types, ranges, known identifiers); the bench checks the rest when it is applied
  B.validateSpec = function (s, path, errors, warnings) {
    const D = R2.GMO,
      T = R2.templates;
    let tpl = null;
    if (s.template !== undefined && s.template !== null) {
      if (typeof s.template === "string") {
        tpl = T.get(s.template);
        if (!tpl)
          errors.push(
            `${path}.template: no template "${s.template}" in this browser (built-in or saved)`,
          );
      } else if (isObj(s.template)) {
        try {
          tpl = T.parse(JSON.stringify(s.template));
        } catch (err) {
          errors.push(`${path}.template: ${err.message}`);
        }
      } else
        errors.push(
          `${path}.template: template id or template object expected`,
        );
    }
    if (
      s.material &&
      s.samples &&
      s.samples[0] &&
      s.samples[0].material &&
      s.samples[0].material !== s.material
    )
      errors.push(
        `${path}: material "${s.material}" and samples[0].material "${s.samples[0].material}" differ; give sample 1's material once`,
      );
    const mat =
      s.material ||
      (s.samples && s.samples[0] && s.samples[0].material) ||
      (tpl && tpl.samplePreset);
    if (!mat && !tpl)
      errors.push(`${path}: give a template or a material for sample 1`);
    const preset = mat && D.samples.find((x) => x.key === mat);
    if (mat && !preset)
      errors.push(
        `${path}.material: unknown material "${mat}" (known: ${D.samples.map((x) => x.key).join(", ")})`,
      );
    const crop = preset
      ? preset.blind
        ? (tpl && tpl.crop) || "soybean"
        : preset.crop
      : tpl && tpl.crop;
    // A material of another species silently turns the template into a different analysis
    // (for example a maize template run as soybean) and changes the SOP. Refuse it.
    if (preset && !preset.blind && tpl && tpl.crop && preset.crop !== tpl.crop)
      errors.push(
        `${path}.material: ${mat} is ${preset.crop}; template "${tpl.name || tpl.id}" is ${tpl.crop}. Choose a ${tpl.crop} material, or leave sample 1 as the template`,
      );
    if (s.stage !== undefined && !B.STAGES[s.stage])
      errors.push(
        `${path}.stage: one of ${Object.keys(B.STAGES).join(", ")} expected`,
      );
    if (s.procedure !== undefined && !B.PROCEDURES[s.procedure])
      errors.push(
        `${path}.procedure: one of ${Object.keys(B.PROCEDURES).join(", ")} expected`,
      );
    if (s.assays !== undefined) {
      if (!Array.isArray(s.assays) || !s.assays.length)
        errors.push(`${path}.assays: non-empty list of method ids expected`);
      else
        for (const id of s.assays)
          if (!D.methods[id])
            errors.push(`${path}.assays: unknown method "${id}"`);
    }
    if (s.duplex !== undefined && typeof s.duplex !== "boolean")
      errors.push(`${path}.duplex: true or false expected`);
    if (s.samples !== undefined) {
      if (!Array.isArray(s.samples) || !s.samples.length)
        errors.push(`${path}.samples: list of samples expected`);
      else
        s.samples.forEach((x, i) => {
          const q = `${path}.samples[${i}]`;
          if (!isObj(x)) {
            errors.push(q + ": object expected");
            return;
          }
          for (const k of Object.keys(x))
            if (
              ![
                "material",
                "extractionDate",
                "label",
                "gm",
                "fragmentBp",
                "inhibitor",
              ].includes(k)
            )
              errors.push(`${q}.${k}: unknown sample field`);
          if (x.material !== undefined) {
            const m = D.samples.find((y) => y.key === x.material);
            if (!m)
              errors.push(`${q}.material: unknown material "${x.material}"`);
            else if (crop && !m.blind && m.crop !== crop)
              errors.push(
                `${q}.material: ${x.material} is ${m.crop}, the run is ${crop}`,
              );
          }
          if (
            x.extractionDate !== undefined &&
            !/^\d{4}-\d{2}-\d{2}$/.test(String(x.extractionDate))
          )
            errors.push(`${q}.extractionDate: YYYY-MM-DD expected`);
          if (
            x.label !== undefined &&
            (typeof x.label !== "string" || x.label.length > 100)
          )
            errors.push(`${q}.label: text up to 100 characters expected`);
          if (
            i > 0 &&
            (x.gm !== undefined ||
              x.fragmentBp !== undefined ||
              x.inhibitor !== undefined)
          )
            errors.push(
              `${q}: composition (gm, fragmentBp, inhibitor) can be set for sample 1 only; samples 2…n use their material preset`,
            );
          if (x.gm !== undefined) {
            if (!isObj(x.gm))
              errors.push(`${q}.gm: object { "event": percent } expected`);
            else
              for (const [ev, v] of Object.entries(x.gm)) {
                if (
                  !D.events.some(
                    (e) => e.name === ev && (!crop || e.crop === crop),
                  )
                )
                  errors.push(`${q}.gm: no ${crop || ""} event "${ev}"`);
                if (!(typeof v === "number" && v >= 0 && v <= 100))
                  errors.push(`${q}.gm.${ev}: 0–100 % expected`);
              }
          }
          if (x.fragmentBp !== undefined)
            check(B.FIELDS.sample1[0], x.fragmentBp, q + ".fragmentBp", errors);
          if (x.inhibitor !== undefined)
            check(B.FIELDS.sample1[1], x.inhibitor, q + ".inhibitor", errors);
        });
    }
    if (
      s.sampleCount !== undefined &&
      !(
        Number.isInteger(s.sampleCount) &&
        s.sampleCount >= 1 &&
        s.sampleCount <= 384
      )
    )
      errors.push(`${path}.sampleCount: whole number expected`);
    if (s.design !== undefined) {
      if (!isObj(s.design)) errors.push(path + ".design: object expected");
      else {
        for (const k of Object.keys(s.design))
          if (!["extractions", "replicates", "controlCounts"].includes(k))
            errors.push(path + ".design: unknown field " + k);
        for (const k of ["extractions", "replicates"])
          if (
            s.design[k] !== undefined &&
            (!Number.isInteger(s.design[k]) ||
              s.design[k] < 1 ||
              s.design[k] > 12)
          )
            errors.push(path + ".design." + k + ": whole number 1–12 expected");
        if (s.design.controlCounts !== undefined) {
          if (!isObj(s.design.controlCounts))
            errors.push(path + ".design.controlCounts: object expected");
          else
            for (const [code, n] of Object.entries(s.design.controlCounts))
              if (
                !["PC", "NC", "NTC", "BLK", "LOD", "POS", "CAL"].includes(
                  code,
                ) ||
                !Number.isInteger(n) ||
                n < 0 ||
                n > 12
              )
                errors.push(
                  path +
                    ".design.controlCounts." +
                    code +
                    ": count 0–12 expected",
                );
        }
      }
    }
    checkBlock(B.FIELDS.dna, s.dna, path + ".dna", errors);
    checkBlock(B.FIELDS.reagents, s.reagents, path + ".reagents", errors);
    checkBlock(B.FIELDS.mix, s.mix, path + ".mix", errors);
    if (
      s.programme !== undefined &&
      s.programme !== "method" &&
      s.programme !== "template"
    )
      checkBlock(B.FIELDS.programme, s.programme, path + ".programme", errors);
    if (
      s.seed !== undefined &&
      !(Number.isInteger(s.seed) && s.seed >= 1 && s.seed <= 99999)
    )
      errors.push(`${path}.seed: whole number 1–99999 expected`);
    if (
      s.seedStep !== undefined &&
      !(Number.isInteger(s.seedStep) && s.seedStep >= 0 && s.seedStep <= 9999)
    )
      errors.push(`${path}.seedStep: whole number 0–9999 expected`);
    if (
      s.naturalVariation !== undefined &&
      typeof s.naturalVariation !== "boolean"
    )
      errors.push(`${path}.naturalVariation: true or false expected`);
    if (s.referenceExtractions !== undefined) {
      if (!isObj(s.referenceExtractions))
        errors.push(
          `${path}.referenceExtractions: object { "material name": "ISO date-time" } expected`,
        );
      else
        for (const [k, v] of Object.entries(s.referenceExtractions))
          if (v !== null && isNaN(Date.parse(v)))
            errors.push(
              `${path}.referenceExtractions["${k}"]: date-time expected`,
            );
    }
    if (s.errorScenario !== undefined && s.errorScenario !== null) {
      const sc = R2.qpcrFaults && R2.qpcrFaults.get(s.errorScenario);
      if (!sc)
        errors.push(
          `${path}.errorScenario: unknown scenario "${s.errorScenario}"`,
        );
      else if (!R2.qpcrFaults.runnable(sc))
        errors.push(
          `${path}.errorScenario: "${s.errorScenario}" is ${sc.kind} and cannot be armed for a run`,
        );
    }
    if (s.name !== undefined && (typeof s.name !== "string" || !s.name.trim()))
      errors.push(`${path}.name: text expected`);
  };
  // ---------------------------------------------------------------- the Technician bench: save, apply, restore
  const KEYS = [
    "sample",
    "sampleKey",
    "extra",
    "meta",
    "stage",
    "chosen",
    "duplex",
    "layout",
    "screenLayout",
    "dna",
    "ng",
    "settings",
    "f",
    "fl",
    "mixSettings",
    "natural",
    "seed",
    "templateUsed",
    "extractions",
    "stageIds",
    "methodShown",
    "sel",
    "design",
  ];

  function ensureBench() {
    const x = X();
    if (!x.settings || !x.sample) {
      x.settings = {
        ...R2.reagents.DEFAULT,
      };
      x.setSample("soyA");
    }
    return x;
  }
  B.snapshot = () => {
    const x = ensureBench(),
      o = {};
    for (const k of KEYS) o[k] = clone(x[k]);
    return o;
  };
  B.restore = function (o) {
    const x = X();
    for (const k of KEYS) x[k] = clone(o[k]);
    x.extractions = Object.assign(Object.create(null), o.extractions || {});
    x.build(false);
    x.f = clone(o.f);
    x.prof = R2.planProfile(x.protocol());
  };
  // apply the settings of one run to the bench; returns { errors, warnings, info }
  B.apply = function (s, k = 0) {
    const x = ensureBench(),
      T = R2.templates,
      D = R2.GMO,
      errors = [],
      warnings = [];
    const tpl = s.template
      ? typeof s.template === "string"
        ? T.get(s.template)
        : T.parse(JSON.stringify(s.template))
      : null;
    const seed = (s.seed !== undefined ? s.seed : 7) + k * (s.seedStep || 0);
    if (seed < 1 || seed > 99999)
      errors.push("seed plus seedStep exceeds 1–99999");
    Object.assign(x, {
      sample: null,
      sampleKey: null,
      extra: [],
      meta: [
        {
          extractionDate: today(),
          label: "",
        },
      ],
      chosen: {
        screen: null,
        ident: null,
        quant: null,
      },
      stage: "screen",
      layout: "mara17",
      screenLayout: "mara17",
      duplex: true,
      f: null,
      settings: {
        ...R2.reagents.DEFAULT,
      },
    });
    x.seed = R2.clamp(seed, 1, 99999);
    x.extractions = Object.create(null);
    if (tpl) T.apply(tpl, x);
    else {
      x.settings = Object.assign({}, R2.reagents.DEFAULT);
      x.mixSettings = Object.assign({}, R2.mixcalc.DEFAULT);
      x.templateUsed = null;
      x.natural = true;
      x.layout = "mara17";
      x.screenLayout = "mara17";
      x.duplex = true;
      x.dna = {
        ...R2.gmoplan.DNA,
      };
      x.ng = R2.gmoplan.DEFAULT_NG;
    }
    x.design = clone(s.design || tpl?.design || null);
    const mat =
      s.material || (s.samples && s.samples[0] && s.samples[0].material);
    if (mat && (mat !== x.sampleKey || !tpl)) x.setSample(mat);
    // analysis step, procedure, assays, duplex: in the order of the Analysis step tab
    if (
      s.procedure !== undefined ||
      s.stage !== undefined ||
      s.assays !== undefined ||
      s.duplex !== undefined
    ) {
      const stage = s.stage || x.stage;
      if (s.procedure !== undefined) {
        x.layout = s.procedure;
        if (s.procedure === "simplex") {
          x.mixSettings = Object.assign(
            {},
            R2.mixcalc.DEFAULT,
            R2.LAB.simplex.mix,
          );
          x.dna = {
            ...R2.LAB.simplex.dna,
          };
          x.ng = x.dna.concNgPerUl * x.dna.volUl;
        } else if (s.procedure === "eurl" || s.procedure === "mara17") {
          x.dna = {
            ...R2.gmoplan.DNA,
          };
          x.ng = R2.gmoplan.DEFAULT_NG;
          x.mixSettings = {
            ...R2.mixcalc.DEFAULT,
          };
        }
        if (stage === "screen") x.screenLayout = s.procedure;
      } else if (x.stage === "screen" && stage !== "screen") x.layout = "mara";
      if (s.duplex !== undefined) x.duplex = s.duplex;
      if (s.assays) x.chosen[stage] = s.assays.slice();
      x.setStage(stage);
      if (x.stage !== stage)
        errors.push(
          `stage "${stage}" is not available for ${x.sample.crop}; the bench chose "${x.stage}"`,
        );
      if (s.procedure !== undefined && x.layout !== s.procedure)
        errors.push(
          `procedure "${s.procedure}" is not available for ${B.STAGES[x.stage].split(":")[0].toLowerCase()} of ${x.sample.crop} (available: ${B.proceduresFor(x.stage, x.sample.crop).join(", ")})`,
        );
      if (s.assays && x.layout !== "simplex") {
        const got = x.chosen[x.stage] || [],
          lost = s.assays.filter((id) => !got.includes(id));
        if (lost.length)
          errors.push(
            `assays ${lost.join(", ")} are not available here (available: ${(x.stageIds || []).join(", ")}${R2.MARA.isLayout(x.layout) || x.stage === "quant" ? "; one assay per run" : ""})`,
          );
      }
      if (tpl && tpl.fields && s.programme !== "method") {
        x.f = {
          ...x.f,
          ...tpl.fields,
        };
      }
    }
    // composition of sample 1 (Sample tab)
    const s1 = (s.samples && s.samples[0]) || {};
    if (
      x.sample.blind &&
      (s1.gm || s1.fragmentBp !== undefined || s1.inhibitor !== undefined)
    )
      warnings.push(
        "sample 1 is a blind sample: its composition stays hidden and is not changed",
      );
    else {
      if (s1.gm)
        x.sample.events = Object.fromEntries(
          Object.entries(s1.gm).filter(([, v]) => v > 0),
        );
      if (s1.fragmentBp !== undefined) x.sample.frag = s1.fragmentBp;
      if (s1.inhibitor !== undefined) x.sample.inhibitor = s1.inhibitor;
    }
    // samples 2…n, extraction dates and names
    let list = s.samples
      ? s.samples.map((o) => Object.assign({}, o))
      : tpl?.batch?.length
        ? tpl.batch.map((o) => ({
            material: o.preset,
            extractionDate: o.extractionDate,
            label: o.label,
          }))
        : [{}];
    if (s.sampleCount) {
      while (list.length < s.sampleCount)
        list.push({
          material: list[list.length - 1].material,
          extractionDate: list[list.length - 1].extractionDate,
        });
      list.length = s.sampleCount;
    }
    const firstDate = list[0].extractionDate || today();
    x.extra = list
      .slice(1)
      .map(
        (o) =>
          o.material ||
          (x.sampleKey === "blind"
            ? D.samples.find((y) => y.crop === x.sample.crop && !y.blind).key
            : x.sampleKey),
      );
    x.meta = list.map((o) => ({
      extractionDate: o.extractionDate || firstDate,
      label: o.label || "",
    }));
    if (s.dna) {
      x.dna = {
        ...x.dna,
        ...s.dna,
      };
      x.ng = +(x.dna.concNgPerUl * x.dna.volUl).toFixed(2);
    }
    if (s.naturalVariation !== undefined) x.natural = s.naturalVariation;
    if (s.reagents) Object.assign(x.settings, s.reagents);
    if (s.mix)
      x.mixSettings = Object.assign(
        {},
        R2.mixcalc.DEFAULT,
        x.mixSettings || {},
        s.mix,
      );
    x.build(s.programme === "method");
    if (isObj(s.programme))
      x.f = {
        ...x.f,
        ...s.programme,
      };
    x.prof = R2.planProfile(x.protocol());
    if (s.referenceExtractions)
      for (const [name, at] of Object.entries(s.referenceExtractions))
        x.extractions[name] = at ? new Date(at).toISOString() : null;
    // the checks of the Run step
    const cap = x.plan.capacity.maxSamples;
    if (x.meta.length > cap)
      errors.push(
        `${x.meta.length} samples do not fit: at most ${cap} with the mixes of this analysis`,
      );
    const stocks = [
      ...new Set(
        x.plate.flatMap((w) => R2.materials.stocks(w, x.plan, x.sample.crop)),
      ),
    ];
    if (s.referenceExtractions)
      for (const name of Object.keys(s.referenceExtractions))
        if (!stocks.includes(name))
          warnings.push(
            `referenceExtractions: "${name}" is not used on this plate (used: ${stocks.join("; ") || "none"})`,
          );
    const progErr =
      x.plan.mara && !R2.MARA.protocolMatches(x.protocol(), x.plan.mara.mode)
        ? "the programme differs from the one the MARA method requires"
        : R2.Firmware.validateFor(x.protocol(), R2.Firmware.CAMERA_MS);
    if (progErr) errors.push("programme: " + progErr);
    const sc = s.errorScenario ? R2.qpcrFaults.get(s.errorScenario) : null,
      scErr =
        sc && R2.qpcrFaults.validateSetup
          ? R2.qpcrFaults.validateSetup(sc, x)
          : null;
    if (scErr) errors.push("error scenario: " + scErr);
    const assays = x.plan.tubes.flat();
    return {
      errors,
      warnings,
      scenario: sc,
      info: {
        crop: x.sample.crop,
        stage: x.stage,
        procedure: x.layout,
        assays,
        duplex: x.duplex,
        design: clone(x.design || {}),
        controls: [
          ...new Set(
            x.plate
              .filter((w) => w.ctl && w.role !== "unknown")
              .map((w) => w.ctl),
          ),
        ],
        samples: x.plan.samples.length,
        maxSamples: cap,
        wells: x.plate.filter((w) => w.role !== "empty").length,
        ng: x.ng,
        seed: x.seed,
        natural: x.natural,
        sop: R2.templates.sopId(x),
        minutes: Math.round(x.prof.total / 60),
        stocks,
        stageIds: (x.stageIds || []).slice(),
        template: x.templateUsed ? x.templateUsed.name : null,
        programme: {
          ...x.f,
        },
        defaultName:
          {
            screen: "screening",
            ident: "identification",
            quant: "quantification",
          }[x.stage] +
          " " +
          x.sample.label.split(" (")[0],
      },
    };
  };
  // the bench as one run of this profile would set it, without running anything (the builder's live check)
  B.preview = function (spec, k = 0) {
    const snap = B.snapshot();
    try {
      return B.apply(spec, k);
    } catch (err) {
      return {
        errors: [err.message],
        warnings: [],
        info: null,
      };
    } finally {
      B.restore(snap);
    }
  };
  const runName = (s, ctx) =>
    (s.name || ctx.defaultName)
      .replace(/\{i\}/g, ctx.i)
      .replace(/\{n\}/g, ctx.n)
      .replace(/\{group\}/g, ctx.group)
      .replace(/\{seed\}/g, ctx.seed)
      .replace(/\{material\}/g, ctx.material)
      .replace(/\{stage\}/g, ctx.stage);
  // ---------------------------------------------------------------- running a profile
  let busy = false,
    cancel = false;
  B.busy = () => busy;
  B.cancel = () => {
    cancel = true;
  };
  // onProgress({ index, total, name, fraction, done:[runs], current }) ; resolves { runs, failures, cancelled }
  B.run = async function (input, onProgress = () => {}) {
    const parsed =
      typeof input === "object" && input.runs && input.errors
        ? input
        : B.parse(input);
    if (parsed.errors.length) throw new Error(parsed.errors.join("\n"));
    if (busy) throw new Error("A JSON batch is already running.");
    const x = ensureBench();
    if (x.running())
      throw new Error(
        "A run is in progress on the Technician bench. Wait until it ends.",
      );
    const preflight = [];
    for (const item of parsed.runs) {
      const a = B.preview(item.spec, item.k);
      preflight.push(
        ...a.errors.map(
          (e) => `Group ${item.group + 1}, repeat ${item.k + 1}: ${e}`,
        ),
      );
    }
    if (preflight.length) throw new Error(preflight.join("\n"));
    busy = true;
    cancel = false;
    const snap = B.snapshot(),
      done = [],
      failures = [],
      text = JSON.stringify(parsed.profile),
      digest = R2.sha256(R2.utf8(text)).slice(0, 16),
      started = new Date().toISOString();
    try {
      for (let n = 0; n < parsed.runs.length && !cancel; n++) {
        const item = parsed.runs[n],
          s = item.spec,
          a = B.apply(s, item.k);
        const name = runName(s, {
          i: item.k + 1,
          n: n + 1,
          group: item.group + 1,
          seed: a.info.seed,
          material: x.sampleKey,
          stage: a.info.stage,
          defaultName: a.info.defaultName,
        });
        if (a.errors.length) {
          failures.push({
            index: n,
            name,
            errors: a.errors,
          });
          onProgress({
            index: n,
            total: parsed.runs.length,
            name,
            fraction: 1,
            done,
            failures,
          });
          continue;
        }
        const c = x.prepareRun(name, {
          scenario: a.scenario || null,
          operator: "json-profile",
          live: false,
          batch: {
            format: FORMAT,
            profile: parsed.name,
            profileSha256: digest,
            startedAt: started,
            group: item.group + 1,
            repeat: item.k + 1,
            index: n + 1,
            of: parsed.runs.length,
            settings: clone(s),
          },
        });
        if (c.error) {
          failures.push({
            index: n,
            name,
            errors: [c.error],
          });
          continue;
        }
        const fw = c.ins.fw,
          total = Math.max(1, c.prof.total);
        while (fw.running()) {
          const t0 = performance.now();
          while (fw.running() && performance.now() - t0 < 25)
            c.ins.advance(500);
          onProgress({
            index: n,
            total: parsed.runs.length,
            name: c.runName,
            fraction: Math.min(0.99, c.ins.plant.t / 1000 / total),
            done,
            failures,
          });
          await new Promise((r) => setTimeout(r, 0));
        }

        done.push(x.completeRun(c));
        onProgress({
          index: n,
          total: parsed.runs.length,
          name: c.runName,
          fraction: 1,
          done,
          failures,
        });
      }
    } finally {
      B.restore(snap);
      busy = false;
    }
    // An explicit empty selection also prevents the Quality page from selecting
    // the newest run as its legacy default when the profile requested no selection.
    R2.session.missyPreselect = parsed.output.selectForMissy ? done.map((r) => r.no) : [];
    return {
      runs: done,
      failures,
      cancelled: cancel,
      output: parsed.output,
      name: parsed.name,
    };
  };
  // ---------------------------------------------------------------- a starting profile
  B.example = () => ({
    format: FORMAT,
    name: "Example: soybean screening and quantification",
    description:
      "Two screening runs with natural variation, one quantification with an aged probe, one run with an LED at half power.",
    defaults: {
      naturalVariation: true,
      samples: [
        {
          extractionDate: today(),
        },
      ],
    },
    runs: [
      {
        name: "screening soybean {i}",
        repeat: 2,
        template: "TPL-BUILTIN-SIMPLEX-SC-SOY",
        samples: [
          {
            material: "soyA",
            extractionDate: today(),
            label: "Lot A",
          },
          {
            material: "soyB",
            extractionDate: today(),
            label: "Lot B",
          },
        ],
      },
      {
        name: "quantification 40-3-2 aged probe",
        material: "soyA",
        stage: "quant",
        procedure: "eurl",
        assays: ["QT-EVE-GM-005"],
        reagents: {
          probeStoreC: 22,
          probeMonths: 6,
        },
      },
      {
        name: "screening LED 50 percent",
        template: "TPL-BUILTIN-SIMPLEX-SC-SOY",
        errorScenario: "hw-led-aged",
      },
    ],
    output: {
      openQuality: true,
      selectForMissy: true,
      downloadRdmltZip: false,
    },
  });
})(window.R2);
