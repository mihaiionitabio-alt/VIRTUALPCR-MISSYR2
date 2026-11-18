/* Standard operating procedures with one identity per analysis.
 * The SOP is built only from what defines the analysis: step, species, methods and reaction mixes, plate layout, DNA per
 * reaction, programme, reagent composition, acceptance and evaluation rules. Run names, times, sample names, seeds, storage
 * incidents and session numbers are left out. Its identity is the SHA-256 of that definition in canonical JSON, so the same
 * analysis always gives the same SOP (same id, same bytes), however often it is run or exported.
 * Imported analyses on the quality bench get their SOP the same way (R2.sop.forImported in js/analysis/external.js). */
(function (R2) {
  "use strict";
  const S = R2.sop = {};
  const KEY = "missy-r2-sop-registry";
  // canonical JSON: object keys sorted, numbers as JavaScript prints them
  S.canonical = function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  };
  S.idOf = def => "SOP-" + R2.sha256(R2.utf8(S.canonical(def))).slice(0, 12).toUpperCase();
  const COMPOSITION = ["primerF", "primerR", "probe", "quencher", "hotStart", "ungActive"];        // what a procedure prescribes
  const MIXKEYS = ["masterMixX", "primerStockUM", "probeStockUM", "rxnUl"];
  /* setup: { stage, crop, dna: { concNgPerUl, volUl }, ng, settings, mix (calculator settings), plate: wells with role, t, sample
   * (calibrant label), material; protocol }. Works for a finished run (S.setupOfRun) and for the technician's current set-up. */
  /* the plate as a rule, not as positions: per reaction mix, the run controls (kind, level, number of wells) and, per sample,
   * extractions × PCR replicates. The number of samples is not part of the procedure, so runs with 1 or 12 samples share it. */
  function layoutOf(plate, tubes) {
    return tubes.map(k => { const ws = plate.filter(W => W.role !== "empty" && W.t.map(t => t.m).join("+") === k), un = ws.filter(W => W.role === "unknown"), ctl = {};
      for (const W of ws.filter(W => W.role !== "unknown")) { const lv = W.role === "standard" ? String(W.dilution || W.sample).replace(/^STD\s*/, "") : W.role === "positive" ? (W.material || "").replace(/\s*\[[^\]]*\]/g, "") : "", key = [W.role, W.ctl || "", lv].join("|");
        ctl[key] = ctl[key] || { role: W.role, control: W.ctl || null, level: lv || null, wells: 0, assigned_copies: W.role === "standard" ? W.t.map(t => t.q) : null }; ctl[key].wells++; }
      const perSample = un.length ? { extractions: Math.max(...un.map(W => W.ext || 1)), pcr_replicates: Math.max(...un.map(W => W.rep || 1)) } : null;
      return { mix: k, per_sample: perSample, run_controls: Object.values(ctl).sort((a, b) => (a.role + a.control + a.level).localeCompare(b.role + b.control + b.level)) }; });
  }
  S.definition = function (setup) {
    const settings = Object.assign({}, R2.reagents.DEFAULT, setup.settings || {}), comp = {};
    for (const k of COMPOSITION) comp[k] = settings[k];
    const mixSettings = Object.assign({}, R2.mixcalc.DEFAULT, setup.mix || {}), mix = {};
    for (const k of MIXKEYS) mix[k] = mixSettings[k];
    const tubes = []; for (const W of setup.plate) if (W.role !== "empty") { const k = W.t.map(t => t.m).join("+"); if (!tubes.includes(k)) tubes.push(k); }
    return {
      kind: "gmo-reference-method-run", stage: setup.stage, species: setup.crop, procedure: setup.mara ? (setup.mara.mode === "screen" ? "MARA 1012-17-2026" : setup.mara.mode === "ddct" ? "MARA 1012-16-2026" : "MARA 1012 event qPCR") : setup.lab || "EURL GMFF method records",
      ...(setup.mara ? { mara: setup.mara } : {}),
      dna: { ng_per_reaction: setup.ng, template_ul: setup.dna.volUl, working_concentration_ng_per_ul: setup.dna.concNgPerUl },
      reaction_mixes: tubes, layout: layoutOf(setup.plate, tubes),
      programme: setup.protocol.stages, lid_c: setup.protocol.lid_c, reagent_composition: comp, mix_settings: mix,
      rules: setup.mara ? { ct_cutoff: 36, mode: setup.mara.mode, calibration: setup.mara.mode === "quant" ? "Five or more shared triplicate levels, slope −3.6 to −3.1, R² ≥ 0.98" : null } : { threshold_counts_above_baseline: R2.gmoeval.THRESHOLD, calibration: "slope -3.1 to -3.6, R2 >= 0.98", control_1_percent: "0.5 to 1.5 %" }
    };
  };
  S.setupOfRun = run => ({ mara: run.gmo.mara || null, lab: run.gmo.lab || null, stage: run.gmo.stage, crop: run.gmo.crop, dna: run.gmo.dna || { concNgPerUl: run.gmo.ng / 5, volUl: 5 }, ng: run.gmo.ng, settings: run.gmo.settings, mix: run.gmo.mix, plate: run.sopPlate || run.plate, protocol: run.protocol });
  S.idOfRun = run => run.sopId || (run.sopId = S.idOf(S.definition(S.setupOfRun(run))));
  // registry of SOP identities met in this browser: which runs and analyses used each one
  S.registry = function () { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return S._mem || (S._mem = {}); } };
  S.note = function (id, title, user) {
    const reg = S.registry(), e = reg[id] || (reg[id] = { title, first: new Date().toISOString(), uses: [] });
    if (user && !e.uses.includes(user)) e.uses.push(user);
    S._mem = reg; try { localStorage.setItem(KEY, JSON.stringify(reg)); } catch {}
    return e;
  };
  /* The SOP document of a run. Deterministic: the same definition gives the same text. */
  S.docOfRun = function (run) {
    const setup = S.setupOfRun(run), def = S.definition(setup), id = S.idOf(def), g = run.gmo, MM = R2.GMO.methods, ids = [...new Set(setup.plate.flatMap(W => W.t.map(t => t.m)))];
    const step = { screen: "Screening for genetic elements and constructs", ident: "Identification of GM events (qualitative)", quant: "Quantification of a GM event against the species reference gene" }[g.stage];
    const plan = { wells: setup.plate.map(W => ({ ...W, material: W.material || "" })), tubes: def.reaction_mixes.map(k => k.split("+")), ng: setup.ng };
    const recipe = R2.mixcalc.recipe(plan, setup.settings, setup.mix, setup.dna);
    return {
      format: "missy-r2-workbench-sop/0.2", experimentalDesign: g.design || null, sop_id: id, notice: "Teaching document generated from the simulated workbench. Not a validated laboratory procedure. Research use only.",
      identity_basis: "SHA-256 of the canonical JSON in 'definition'. Run names, times, sample names, seeds, storage and handling incidents are not part of it, so every run of the same analysis carries this SOP.",
      title: step + " (" + g.crop + "), " + ids.filter(i => MM[i].kind !== "taxon").map(i => R2.gmoplan.name(i)).join(", "), purpose: step,
      scope: { species: g.crop, dna_per_reaction_ng: setup.ng, template: setup.dna.volUl + " µL at " + setup.dna.concNgPerUl + " ng/µL" },
      methods: ids.map(id => { const m = MM[id]; return { id, title: m.title, target: m.target, role: m.kind === "taxon" ? "species reference gene" : m.kind, detection: m.P ? "hydrolysis probe " + m.P[1] + "-" + m.P[3] : "SYBR Green with melt curve", channel: R2.gmoplan.channel(id) + 1,
        oligonucleotides: { forward: { name: m.F[0], sequence: m.F[1] }, reverse: { name: m.R[0], sequence: m.R[1] }, probe: m.P ? { name: m.P[0], reporter: m.P[1], sequence: m.P[2], quencher: m.P[3] } : null },
        final_concentrations_nmol_per_l: { forward: m.nM[0], reverse: m.nM[1], probe: m.P ? m.nM[2] : null }, reaction_volume_ul: m.vol, amplicon_bp: m.bp,
        cycling_in_record: { ung_50C_s: m.cyc[0], activation_95C_s: m.cyc[1], cycles: m.cyc[2], denaturation_95C_s: m.cyc[3], annealing_C: m.cyc[4], annealing_s: m.cyc[5] }, reference_material: m.crm || null, reported_limits: m.lod || null, reported_efficiency_percent: m.eff || null,
        source: m.source || "https://gmo-crl.jrc.ec.europa.eu/gmomethods/show/" + id + "/" }; }),
      reaction_mixes_per_reaction: recipe.mixes.map(m => ({ mix: m.key, methods: m.methods, reaction_ul: m.rxnUl, template_ul: m.templateUl, mix_per_tube_ul: m.mixPerTubeUl, components: m.rows.map(r => ({ component: r.component, sequence: r.sequence || null, stock: r.stock || null, final: r.final, per_reaction_ul: r.perRxn })) })),
      dna_solutions: [...new Map(recipe.solutions.map(o => { const t = o.role === "unknown" ? "sample DNA extract (one per sub-sample)" : o.label; return [t, { template: t, ng_per_ul: o.concNgPerUl }]; })).values()],
      calibrant_series: recipe.dilutions.calibrants ? recipe.dilutions.calibrants.steps.map(x => ({ level: x.level, ng_per_ul: x.concNgPerUl, dilution_from_level_above: x.factor ? "1:" + x.factor : "from the certified-material extract" })) : null,
      layout: def.layout, plate_format: "384 wells, 16 rows x 24 columns; each reaction mix starts on a new row: sample wells (sample 1 E1 R1…Rn, E2…En, sample 2 ...), then its controls", programme: { lid_C: setup.protocol.lid_c, stages: setup.protocol.stages, estimated_instrument_time_s: Math.round(R2.planProfile(setup.protocol).total) },
      procedure: [
        "Record the sample identity and the measured DNA concentration of the extract; dilute it to " + setup.dna.concNgPerUl + " ng/µL (" + setup.ng + " ng in " + setup.dna.volUl + " µL).",
        "Prepare the calibrant series and the positive controls from the certified reference material as listed under calibrant_series and dna_solutions.",
        "Thaw primers, probes and master mix on ice, protected from light; mix and spin briefly.",
        "Prepare one reaction mix per entry of reaction_mixes_per_reaction, with the pipetting excess of the laboratory, without template.",
        "Dispense the mix into the tubes given under plate; add template last: water to the no-template controls first, then the sample, then calibrants and positive controls.",
        "Close the tubes, spin, place them in the block and close the lid.",
        "Load the programme and start the run under the run name.",
        "After the run, check the temperature statistics and the event record for faults.",
        "Evaluate each assay on its own tubes and channel: controls first, then the sample."],
      acceptance: ["The no-template control of every assay shows no amplification (SYBR Green: no product with the target's melting temperature).", "The positive control of every assay amplifies.", "The species reference gene is detected in the sample.",
        g.stage === "quant" ? "Both calibration curves: slope between -3.1 and -3.6, R2 at least 0.98. The sample is within range for both assays, replicates agree, and the 1 % control reads between 0.5 and 1.5 %." : "Sample tubes of one assay agree; a split result is repeated."],
      evaluation: g.stage === "screen" ? "An event stays possible when every tested element it carries is detected; a negative element excludes the events that carry it." : g.stage === "ident" ? "An event is identified when its event-specific assay is detected with valid controls." : "GM content in % = mean event copies / mean reference-gene copies x 100, both read from their own calibration curves.",
      definition: def, methods_source: g.mara ? R2.MARA.scope : R2.GMO.source, software: "MISSY R2 workbench"
    };
  };
  // a laboratory procedure replaces the generic acceptance and evaluation with its own (data/lab_sops.js)
  const docOfRunGeneric = S.docOfRun;
  S.docOfRun = function (run) {
    const d = docOfRunGeneric(run), L = run.gmo.lab && R2.LAB[run.gmo.lab];
    if (run.gmo.mara?.mode === "screen") {
      d.title = "Rapid fluorescence screening (virtual plate)";
      d.methods_source = R2.MARA.rapid.source;
      d.acceptance = ["Shared positive controls show typical amplification. Non-GM controls amplify only the reference. Water controls show no amplification.",
        "Sample calls use crop-reference and marker Cq ≤ 36, across the configured extraction and PCR-replicate layout."];
      d.procedure[1] = "Prepare positive material, non-GM material and water controls as listed for each mix.";
      d.evaluation = "Report only the selected markers. Standard 17 specifies a 1% target LOD. Follow up positive screens with event identification.";
      return d;
    }
    if (run.gmo.mara) {
      const s = run.gmo.mara, r = R2.MARA.assays[s.method];
      d.title = r.event + " / " + r.ref + (s.mode === "ddct" ? " · Relative comparison" : s.mode === "quant" ? " · Quantification" : " · Identification");
      d.acceptance = ["Both assays: positive control amplifies and blank is clean. Non-GM control amplifies only the reference. Controls are triplicate and use Cq ≤ 36."];
      if (s.mode === "quant") d.acceptance.push("Five or more shared, triplicate calibrant levels with valid Cq. Both slopes −3.6 to −3.1 and R² ≥ 0.98. Laboratory-prepared QC relative bias and range-based RSD ≤ 25%.");
      d.procedure[1] = "Prepare the triplicate positive, non-GM and water controls once per run. For Method 2, prepare the paired calibrants from the same stock dilution series.";
      d.evaluation = s.mode === "quant" ? "Average three per-extraction event/reference copy ratios. At or above LOQ require RSD ≤ 25%, then report mean ± expanded uncertainty (k=2)." :
        s.mode === "ddct" ? "ΔΔCt below −0.4 means higher than the control. Above +0.4 means lower. The inclusive band requires Method 2." :
        "With valid reference triplicates, retain each extraction call and use a definitive two-of-three majority.";
      return d;
    }
    if (!L) return d;
    d.title = L.title + " (" + run.gmo.crop + ")"; d.laboratory_procedure = { reference: L.sop, source: L.source, instrument: L.instrument, run_template: L.template, replicates: L.replicates };
    d.acceptance = [`Positive control at the limit of detection (${L.crm[run.gmo.crop].name}): mean Cq between ${L.rules.lod[0]} and ${L.rules.lod[1]}. Above: repeat with a new control. Below: check the reference-gene Cq of that control; below 20, dilute its DNA.`,
      "No-template control and DNA extraction blank: no amplification. Positive sample: amplifies.",
      `Sample DNA: reference-gene mean Cq between ${L.rules.taxon[0]} and ${L.rules.taxon[1]}. Below: dilute the DNA. Above: extract again.`];
    d.evaluation = `Per element (P-35S, T-nos), Cq by second-derivative maximum: sample mean Cq below the mean Cq of the control at the limit of detection: detected; amplified at or above it: below the limit of detection; no amplification or Cq ≥ ${L.rules.negativeCq}: not detected. Only one element above the limit of detection: repeat the DNA extraction.`;
    d.procedure.splice(1, 1, "Prepare the run controls once per run: certified reference material at 0.1 % (duplicate), positive sample, no-template control (water), DNA extraction blank.");
    return d;
  };
  S.jsonOfRun = run => { const d = S.docOfRun(run); run.sopId = d.sop_id; return JSON.stringify(d, null, 1); };
  // unique SOPs of a list of runs (and imported analyses, via their own doc function)
  S.unique = function (items) {
    const out = new Map();
    for (const it of items) { const doc = it.sopDoc ? it.sopDoc() : S.docOfRun(it), name = it.name || it.runId || it.title;
      if (!out.has(doc.sop_id)) out.set(doc.sop_id, { doc, uses: [] }); out.get(doc.sop_id).uses.push(name); S.note(doc.sop_id, doc.title, name); }
    return out;
  };
  S.zip = function (items) {
    const u = S.unique(items), files = [], idx = ["sop_id,title,used_by"];
    for (const [id, e] of u) { files.push({ name: id + ".json", data: R2.utf8(JSON.stringify(e.doc, null, 1)) }); idx.push([id, '"' + e.doc.title.replace(/"/g, '""') + '"', '"' + e.uses.join("; ").replace(/"/g, '""') + '"'].join(",")); }
    files.push({ name: "sop_index.csv", data: R2.utf8(idx.join("\r\n") + "\r\n") });
    return R2.zip(files);
  };
})(window.R2);
