/* Technician tab 9: the run. Asks for an experiment name, numbers it, then plays the run full screen at one second per cycle:
 * block temperature, fluorescence as it is read, the detector, and live temperature statistics. */
(/* @r2fn R2-C0074-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, X = R2.tech;
  const PH = [["self", "Self-test"], ["lid", "Lid heating"], ["ung", "UNG"], ["act", "Activation"], ["den", "Denature"], ["ann", "Anneal/extend"], ["ext", "Extend"], ["melt", "Melt"], ["read", "Reading"], ["done", "Finished"]];
  let timer = null, lidOpen = false, cyc0 = 0, lastSlow = 0, lastOpt = -1, lastF = 0, runName = "", runNo = 0, pending = null, selectedWell = null, runProfile = null, selection, selected = null, readsByScan = new Map(), seenReads = 0, panel = "fluorescence";
  const runPlate = /* @r2fn R2-C0074-F00002 */() => (X.runInfo || pending).plate;
  const slug = /* @r2fn R2-C0074-F00003 */s => s.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "run";
  const allowed = /* @r2fn R2-C0074-F00004 */w => {
    const method = $("t-assay").value, channel = +$("t-ch").value;
    return runPlate()[w]?.t.some(/* @r2fn R2-C0074-F00005 */t => (!method || t.m === method) && X.GP().channel(t.m) === channel);
  };
  const active = /* @r2fn R2-C0074-F00006 */w => allowed(w) && (selected === null || selected.has(w));
  const groupOf = /* @r2fn R2-C0074-F00007 */(well, i) => well.role === "unknown" ? "S" + (well.sampleNo || well.sample || i) : well.ctl || well.role;
  const colorOf = /* @r2fn R2-C0074-F00008 */(well, i) => {
    const group = groupOf(well, i);
    const controls = { PC: "#b984ff", POS: "#b984ff", LOD: "#deabff", NC: "#9aaacf", NTC: "#32d6a1", BLK: "#89d9b3", CAL: "#62a7ff" };
    return controls[group] || `hsl(${24 + (Math.max(1, well.sampleNo || 1) - 1) * 137.508 % 360} 80% 61%)`;
  };
  const wellLabel = /* @r2fn R2-C0074-F00009 */(plate, w) => R2.wellIdentity(plate[w], w);
  const card = /* @r2fn R2-C0074-F00010 */(w, channel) => `<b>${R2.esc(wellLabel(runPlate(), w))}</b><span>${R2.esc(runPlate()[w].t.filter(/* @r2fn R2-C0074-F00011 */t => X.GP().channel(t.m) === channel).map(/* @r2fn R2-C0074-F00012 */t => X.GP().name(t.m)).join(" + "))}</span>`;
  /* @r2fn R2-C0074-F00013 */function showPanel(name) {
    panel = name;
    $("t-fluorescence-view").hidden = name !== "fluorescence";
    $("t-detector-view").hidden = name !== "detector";
    $("t-fluorescence-tab").setAttribute("aria-selected", name === "fluorescence");
    $("t-detector-tab").setAttribute("aria-selected", name === "detector");
    if (name === "fluorescence") drawFluor();
    else drawMatrix();
  }
  /* @r2fn R2-C0074-F00014 */function summary() {
    const d = R2.reagents.DEFAULT, ch = Object.keys(d).filter(/* @r2fn R2-C0074-F00015 */k => X.settings[k] !== d[k]);
    const method = X.plan.mara && R2.MARA.assays[X.plan.mara.method];
    const fit = X.extra.length + 1 <= X.plan.capacity.maxSamples;
    const massOk = !method || X.ng === (X.stage === "quant" ? method.quantNg : method.qualNg);
    const scenarioError = R2.qpcrFaults?.validateSetup(R2.qpcrFaults.active, X);
    const err = scenarioError || (!fit ? "Reduce the number of samples or assays to fit the plate." : !massOk ?
      "The selected MARA method requires its stated DNA mass per well." :
      X.plan.mara && !R2.MARA.protocolMatches(X.protocol(), X.plan.mara.mode) ?
        "Restore the cycling programme for the selected MARA method." :
        R2.Firmware.validateFor(X.protocol(), R2.Firmware.CAMERA_MS));
    $("run-sum").innerHTML = `<dt>Samples</dt><dd>${X.plan.samples.length} (${X.plan.samples.map(/* @r2fn R2-C0074-F00016 */x => R2.esc(x.label)).join("; ")}), each ${X.plan.capacity.extractions} extractions × ${X.plan.capacity.replicates} PCR replicates; ${X.dna.volUl} µL at ${X.dna.concNgPerUl} ng/µL = ${X.ng} ng per well</dd><dt>Plate</dt><dd>${X.plate.filter(/* @r2fn R2-C0074-F00017 */W => W.role !== "empty").length} of 384 wells</dd><dt>Step</dt><dd>${{ screen: "screening", ident: "identification", quant: "quantification" }[X.stage]}${X.plan.mara?.mode === "screen" ? " · MARA 1012-17" : method ? " · MARA 1012-" + method.std + (X.plan.mara.mode === "ddct" ? " with Standard 16" : "") : X.plan.lab ? " · " + R2.esc(R2.LAB[X.plan.lab].title) : ""}</dd><dt>Reaction mixes</dt><dd>${X.plan.tubes.map(/* @r2fn R2-C0074-F00018 */t => t.map(/* @r2fn R2-C0074-F00019 */id => R2.esc(X.GP().name(id))).join(" + ")).join("; ")}</dd>
      <dt>Programme</dt><dd>${X.f.ung ? "UNG " + X.f.ung + " s; " : ""}95 °C ${X.f.act} s; ${X.f.cycles} × (95 °C ${X.f.denS} s, ${X.f.annT} °C ${X.f.annS} s${X.f.extS ? ", 72 °C " + X.f.extS + " s" : ""})${X.f.melt ? "; melt" : ""} · ${R2.hms(X.prof.total)} instrument time</dd>
      <dt>Reagents and handling</dt><dd>${ch.length ? ch.length + " setting" + (ch.length > 1 ? "s" : "") + " changed from the method" : "as the method records state"}</dd><dt>Template</dt><dd>${X.templateUsed ? R2.esc(X.templateUsed.name) : "none (set up by hand)"}</dd><dt>SOP</dt><dd>${R2.templates.sopId(X)}</dd><dt>Runs so far</dt><dd>${(R2.session.runs || []).length}</dd>` + (err ? `<dt>Problem</dt><dd style="color:var(--bad)">${R2.esc(err)}</dd>` : "");
    $("run-name-mode").textContent = "Sample names are assigned at start: a random six-digit prefix unique to this run, the sample number and the DNA extraction date (" + X.meta.map(/* @r2fn R2-C0074-F00020 */(m, i) => "######-" + (i + 1) + "-" + R2.materials.dateCode(m.extractionDate)).slice(0, 4).join(", ") + (X.meta.length > 4 ? ", …" : "") + ").";
    X.startProblem = err || ""; // read by the guided levels; never parse the displayed (possibly translated) text
    $("t-start").disabled = X.running() || !!err;
  }
  /* @r2fn R2-C0074-F00021 */function ask() {
    const no = (R2.session.runNo || 0) + 1, sug = { screen: "screening", ident: "identification", quant: "quantification" }[X.stage] + " " + X.sample.label.split(" (")[0];
    $("run-dlg").returnValue = ""; $("run-name").value = sug; const upd = /* @r2fn R2-C0074-F00022 */() => { $("run-file").textContent = String(no).padStart(3, "0") + "_" + slug($("run-name").value); }; $("run-name").oninput = upd; upd();
    $("run-dlg").showModal ? $("run-dlg").showModal() : $("run-dlg").setAttribute("open", ""); $("run-name").select();
  }
  /* @r2fn R2-C0074-F00023 */function logLine(e) {
    const txt = { RUN_START: "run started", SELFTEST_OK: "self-test passed: protection chain trips and releases", LID_READY: "lid at temperature after " + (e.b / 1000).toFixed(0) + " s", MELT_START: "melt curve started", MELT_END: "melt curve finished (" + e.a + " readings)", RUN_COMPLETE: "run complete", RUN_ABORTED: "run aborted", LID_OPENED: "lid opened" }[e.code];
    if (!txt && e.severity < 2 && !(e.code === "READ_END" && X.ins && X.ins.fw.st !== "MELT")) return;
    const el = $("t-log"); el.textContent += `[${R2.hms(e.t_ms / 1000).padStart(7)}] ${txt || (e.code === "READ_END" ? "plate read " + e.a + " done" : e.code + (e.severity >= 2 ? "  ← FAULT: drives switched off" : ""))}\n`; el.scrollTop = el.scrollHeight;
  }
  X.beginPreparedRun = start;
  /* The run as the bench defines it: identity, plan, programme, simulated wells, instrument, run record header.
   * Shared by the live run below and by JSON batch runs (js/ui/batch_runs.js), so both produce the same run object.
   * opts.scenario: a qpcr_faults scenario, null for none; left undefined = the scenario armed on the Administrator panel.
   * opts.onEvent: instrument event callback, attached before the firmware starts. opts.operator, opts.live: record fields. */
  let live = null;
  X.prepareRun = /* @r2fn R2-C0074-F00024 */function (name, opts = {}) {
    X.build(false);
    const FX = R2.qpcrFaults, armed = opts.scenario === undefined, scenario = armed ? (FX && FX.active || null) : opts.scenario;
    const setupError = FX && scenario ? FX.validateSetup(scenario, X) : null;
    if (setupError) return { error: setupError };
    const identity = R2.materials.next();
    const runNo = R2.session.runNo = (R2.session.runNo || 0) + 1, runName = String(runNo).padStart(3, "0") + "_" + identity.prefix + "_" + slug(name);
    // qPCR error scenario (js/core/qpcr_faults.js): one run only, labelled in the run and its RDMLt
    const fxc = FX ? FX.prepare(scenario, { settings: X.settings, f: X.f, plan: X.plan, prog: null }) : { settings: X.settings, f: X.f, plan: X.plan, prog: null };
    const fxContext = { plan: fxc.plan, seed: (X.seed ^ Math.imul(runNo, 2654435761)) >>> 0 };
    const keepF = X.f; X.f = fxc.f; const prog = X.protocol(); X.f = keepF; if (fxc.prog && fxc.prog.lid_c) prog.lid_c = fxc.prog.lid_c;
    const sw = X.GP().simWells(fxc.plan, fxc.settings, fxc.f, X.seed, { runIndex: runNo, natural: X.natural }); if (FX) FX.afterSimWells(scenario, sw, fxContext);
    const opticsOptions = X.natural ? { opticsSeed: X.seed ^ 0x47514f50 ^ Math.imul(runNo, 7919) } : {};
    const ins = new R2.Instrument(X.seed, { ...X.GP().INSTRUMENT, ...opticsOptions }), p = ins.plant, ta = R2.clamp(X.settings.ambientC, 10, 38); p.Tamb = ta; p.Tb = [ta, ta]; p.Ts = [ta, ta]; p.Ths = ta; p.Tlid = ta; ins.setPlate(sw.wells); if (FX) FX.afterSetPlate(scenario, ins, fxContext);
    if (opts.onEvent) ins.onEvent = opts.onEvent;
    const st = ins.fw.start(prog, runName); if (st !== "ok") { R2.session.runNo--; return { error: "Start refused: " + st, refused: true }; }
    if (FX && armed) FX.active = null;
    const sample = X.sample, assigned = R2.materials.assign(fxc.plan, identity, X.meta, X.extractions, sample.crop);
    const pending = { runId: runName, no: runNo, name: runName, startedAt: identity.createdAt, prefix: identity.prefix,
      samples: assigned.samples, sampleIdentity: { id: "RUN-" + identity.uid, name: assigned.samples.map(/* @r2fn R2-C0074-F00025 */x => x.name).join(", "), prefix: identity.prefix, createdAt: identity.createdAt, mode: "prefix-number-date", samples: assigned.samples },
      serial: "SIM-0384", seed: ins.seed, operator: opts.operator || "technician", firmwareConfiguration: { ...ins.fw.cfg, wells: 384, optics: "camera, whole plate per exposure", opticsSeed: p.opticsSeed, cameraReporter: R2.Plant.CAMERA_REPORTER_MODEL },
      simulationSetup: sw, protocol: prog, live: opts.live !== false, plate: assigned.wells,
      gmo: { design:structuredClone(X.design||null), stage: X.stage, crop: sample.crop, sample: assigned.samples.map(/* @r2fn R2-C0074-F00026 */x => x.name).join(", "), samplePreset: assigned.samples.map(/* @r2fn R2-C0074-F00027 */x => x.preset).join("; "), ng: X.ng, pcNg: X.plan.pcNg, dna: { ...X.dna }, mix: X.mixSettings ? structuredClone(X.mixSettings) : null, template: X.templateUsed || null,
        settings: { ...fxc.settings }, fields: { ...fxc.f }, calPct: X.plan.calPct, mara: X.plan.mara || null, lab: X.plan.lab || null, notes: X.plan.notes.slice(), layout: X.plan.capacity,
        truth: { samples: X.sampleList().map(/* @r2fn R2-C0074-F00028 */x => ({ preset: x.label, events: { ...x.events }, frag: x.frag, inhibitor: x.inhibitor, blind: !!x.blind })), events: { ...sample.events }, frag: sample.frag, inhibitor: sample.inhibitor, blind: !!sample.blind } } };
    if (fxc.plan !== X.plan) pending.sopPlate = R2.materials.assign(X.plan, identity, X.meta, X.extractions, sample.crop).wells;
    if (opts.batch) pending.batch = opts.batch;
    return { ins, pending, scenario, fxContext, runNo, runName, prof: X.prof };
  };
  // the run record once the firmware has stopped: outcome, record, scenario transforms; filed for the quality bench
  X.completeRun = /* @r2fn R2-C0074-F00029 */function (c) {
    const ins = c.ins; ins.advance(300); const ev = ins.rec.events, outcome = ev.some(/* @r2fn R2-C0074-F00030 */e => e.code === "RUN_COMPLETE") ? "completed" : ev.some(/* @r2fn R2-C0074-F00031 */e => e.severity >= 2) ? "fault: " + ev.find(/* @r2fn R2-C0074-F00032 */e => e.severity >= 2).code : "aborted";
    const runInfo = { ...c.pending, time: new Date().toISOString(), outcome, record: ins.rec, chemLog: ins.chemLog };
    if (c.scenario) R2.qpcrFaults.afterRun(c.scenario, runInfo, c.fxContext);
    (R2.session.runs = R2.session.runs || []).push(runInfo); R2.session.run = runInfo;
    return runInfo;
  };
  /* @r2fn R2-C0074-F00033 */function start(name) {
    if (X.running() || R2.techAccess && !R2.techAccess.allowed(R2.levels.get("technician"))) return;
    if (R2.batchRuns && R2.batchRuns.busy()) { $("run-name-mode").textContent = "A JSON batch is generating runs; start this run when it has finished."; return; }
    lidOpen = false; $("t-lid").textContent = "Open lid"; $("t-log").textContent = "";
    const c = X.prepareRun(name, { onEvent: logLine });
    if (c.error) { if (c.refused) $("t-log").textContent = c.error + "\n"; else $("run-name-mode").textContent = c.error; return; }
    live = c; X.ins = c.ins; X.simInfo = c.pending.simulationSetup.info; runNo = c.runNo; runName = c.runName; pending = c.pending;
    X.runInfo = null; runProfile = c.prof;
    selectedWell = null;
    selected = null;
    readsByScan = new Map();
    seenReads = 0;
    selection.reset();
    $("t-scan").innerHTML = '<option value="">Latest acquisition</option>';
    const assays = [...new Set(pending.plate.flatMap(/* @r2fn R2-C0074-F00034 */w => w.t.map(/* @r2fn R2-C0074-F00035 */t => t.m)))];
    $("t-assay").innerHTML = assays.map(/* @r2fn R2-C0074-F00036 */id => `<option value="${id}">${R2.esc(X.GP().name(id))}</option>`).join("") + '<option value="">All assays on this channel</option>';
    $("t-read-kv").textContent = "";
    $("t-save-state").textContent = "Held in this browser tab";
    cyc0 = 0; lastSlow = 0; lastOpt = -1;
    $("run-pre").hidden = true; $("run-stage").hidden = false; $("run-stage").classList.add("fs"); document.body.classList.add("noscroll"); $("run-title").textContent = runName; $("run-after").hidden = true;
    $("t-abort").disabled = false; $("t-lid").disabled = false; $("t-ch").value = X.GP().channel($("t-assay").value); showPanel("fluorescence"); clearTimeout(timer); X.marks(); loop();
  }
  // holds and the melt are computed as fast as the browser allows; inside the cycling stage one cycle is released per second
  /* @r2fn R2-C0074-F00037 */function loop() {
    const fw = X.ins.fw, t0 = Date.now(); let n = 0;
    const gate = /* @r2fn R2-C0074-F00038 */() => { const s = fw.prog && fw.prog.stages[fw.iStage]; if (!s || s.type !== "cycle" || lidOpen) return true; if (!cyc0) cyc0 = Date.now(); return fw.iCycle <= 1 + Math.floor((Date.now() - cyc0) / 1000); };
    while (fw.running() && gate()) { X.ins.advance(500); if (++n % 4 === 0 && Date.now() - t0 > 30) break; }
    draw(); if (fw.running()) timer = setTimeout(loop, 40); else finish();
  }
  /* @r2fn R2-C0074-F00039 */function finish() {
    X.runInfo = X.completeRun(live); live = null;
    pending = null;
    lastSlow = 0; lastOpt = -1; draw(); $("t-abort").disabled = true; $("t-lid").disabled = true; $("run-after").hidden = false; $("run-after-text").textContent = `Run ${runName} ${X.runInfo.outcome}. Ready for quality review.` + (X.runInfo.injectedFault ? ` Error scenario: ${X.runInfo.injectedFault.title} (${X.runInfo.injectedFault.kind}).` : ""); X.marks();
  }
  /* @r2fn R2-C0074-F00040 */function leave() { $("run-stage").classList.remove("fs"); document.body.classList.remove("noscroll"); if (!X.running()) { lastSlow = 0; lastOpt = -1; if (X.ins) draw(); } document.dispatchEvent(new Event("r2-run-view-left")); }
  /* @r2fn R2-C0074-F00041 */function phaseOf(fw) {
    const st = fw.st; if (st === "SELFTEST") return "self"; if (st === "LID_PREHEAT") return "lid"; if (st === "MELT" || st === "MELT_GOTO") return "melt"; if (["DONE", "ABORTED", "FAULT", "IDLE"].includes(st)) return "done";
    const s = fw.prog && fw.prog.stages[fw.iStage]; if (!s || !s.steps) return ""; if (s.type === "hold") return s.steps[0].temp_c < 70 ? "ung" : "act"; return fw.iStep === 0 ? "den" : fw.iStep === 2 ? "ext" : "ann";
  }
  const net = /* @r2fn R2-C0074-F00042 */r => (r.sum_on - r.sum_off) / (r.periods * 8);
  /* @r2fn R2-C0074-F00043 */function refreshReads() {
    const optical = X.ins.rec.optical;
    for (let i = seenReads; i < optical.length; i++) {
      const read = optical[i];
      if (!readsByScan.has(read.acq)) {
        readsByScan.set(read.acq, { kind: read.kind, cycle: read.cycle, channels: [new Map(), new Map()] });
        const option = document.createElement("option");
        option.value = read.acq;
        option.textContent = read.kind === "M" ? "Melt read " + read.cycle : "Cycle " + read.cycle;
        $("t-scan").append(option);
      }
      readsByScan.get(read.acq).channels[read.channel].set(read.well, read);
    }
    seenReads = optical.length;
    const key = +$("t-scan").value || optical.at(-1)?.acq;
    return readsByScan.get(key);
  }
  /* @r2fn R2-C0074-F00044 */function drawMatrix() {
    const plate = runPlate(), scan = refreshReads(), ch = +$("t-ch").value, reads = scan?.channels[ch];
    const visible = plate.map(/* @r2fn R2-C0074-F00045 */(well, i) => i).filter(/* @r2fn R2-C0074-F00046 */w => allowed(w) && reads?.has(w));
    const top = $("t-detector-scale").value === "auto" ? Math.max(1, ...visible.map(/* @r2fn R2-C0074-F00047 */w => net(reads.get(w)))) : 4095;
    const grid = $("t-matrix");
    const focus = grid.contains(document.activeElement) ? document.activeElement.dataset.w : undefined;
    let html = '<span class="ph"></span>';
    for (let col = 0; col < R2.PLATE.cols; col++) html += R2.plateAxis("col", col, col + 1);
    plate.forEach(/* @r2fn R2-C0074-F00048 */(well, w) => {
      if (w % R2.PLATE.cols === 0) html += R2.plateAxis("row", w / R2.PLATE.cols, String.fromCharCode(65 + w / R2.PLATE.cols));
      const read = reads?.get(w), available = allowed(w), value = available && read ? net(read) : null;
      const brightness = value === null ? 0 : R2.clamp(value / top, 0, 1);
      const label = wellLabel(plate, w) + (value === null ? "" : " · " + value.toFixed(1) + " counts");
      html += `<button type="button" class="det-pixel${available ? "" : " off"}" data-w="${w}" style="--brightness:${brightness.toFixed(4)};--group:${colorOf(well,w)}" ${available ? "" : "disabled"} aria-pressed="${active(w)}" title="${R2.esc(label)}" aria-label="${R2.esc(label)}">${available ? R2.wellName(w) : ""}</button>`;
    });
    grid.innerHTML = html;
    if (focus !== undefined) grid.querySelector(`[data-w="${focus}"]`)?.focus({ preventScroll: true });
    $("t-scale-max").textContent = visible.length ? top.toFixed(1) + " counts" : "–";
    const inspect = selectedWell !== null && active(selectedWell) ? selectedWell : visible.find(active);
    const observed = inspect === undefined ? null : reads?.get(inspect);
    $("t-read-kv").innerHTML = observed ? `<dt>${R2.esc(wellLabel(plate, inspect))}</dt><dd>${net(observed).toFixed(1)} counts · channel ${ch + 1} · ${scan.kind === "M" ? "melt read" : "cycle"} ${scan.cycle}</dd>` : "";
    $("t-det-note").textContent = scan ? (scan.kind === "M" ? "Melt read " : "Cycle ") + scan.cycle : "Waiting for acquisition";
    updateSelectionLabel();
  }
  /* @r2fn R2-C0074-F00049 */function updateSelectionLabel() {
    const n = runPlate().filter(/* @r2fn R2-C0074-F00050 */(w, i) => active(i)).length;
    $("t-selected-count").textContent = n + " wells shown";
  }
  X.drawThermal = /* @r2fn R2-C0074-F00051 */function (elAll, elZoom, h) {
    const prof = runProfile || X.prof, tm = X.ins ? X.ins.rec.telemetry : [], n = tm.length, now = n ? tm[n - 1].t_ms / 1000 : 0, span = Math.max(prof.total, now) / 60, step = Math.max(1, Math.floor(n / 900)), x = [], b = [];
    for (let i = 0; i < n; i += step) { x.push(tm[i].t_ms / 60000); b.push(tm[i].zone1_c); } if (n) { x.push(now / 60); b.push(tm[n - 1].zone1_c); }
    R2.chart($(elAll), { series: [{ x: prof.t.map(/* @r2fn R2-C0074-F00052 */v => v / 60), y: prof.T, color: "var(--muted)", dash: "4 3", width: 1, noHover: true }, { x, y: b, color: "var(--heat)", width: 1.5 }], xlab: "instrument minutes · dashed = plan", ylab: "block °C", height: h || 200, ylim: [20, 112], xlim: [0, span], cursorX: n && X.running() ? now / 60 : undefined, xshort: "min" });
    if (!elZoom) return; const from = Math.max(0, n - 1800), zx = [], zb = [], zs = [], zl = [], spans = []; let s0 = null;
    for (let i = from; i < n; i += 2) { const r = tm[i], t = r.t_ms / 1000; zx.push(t); zb.push(r.zone1_c); zs.push(r.setpoint_c); zl.push(r.lid_c); if (r.optics_busy && s0 === null) s0 = t; if (!r.optics_busy && s0 !== null) { spans.push({ x0: s0, x1: t }); s0 = null; } }
    if (s0 !== null) spans.push({ x0: s0, x1: now });
    R2.chart($(elZoom), { series: [{ x: zx, y: zl, color: "var(--s4)", width: 1.1 }, { x: zx, y: zs, color: "var(--muted)", dash: "4 3", width: 1.1 }, { x: zx, y: zb, color: "var(--heat)" }], spans, xlab: "Instrument time (s) · last 180 s · shading marks detector reads", ylab: "°C", height: h || 200, ylim: [20, 112], xlim: [Math.max(0, now - 180), Math.max(180, now)], xshort: "s" });
  };
  /* @r2fn R2-C0074-F00053 */function drawFluor() {
    const plate = runPlate(), ch = +$("t-ch").value, tb = R2.analysis.tables(X.ins.rec), series = [];
    const scan = refreshReads();
    for (let w = 0; w < plate.length; w++) if (active(w)) series.push({ key: w, x: tb.cycles, y: tb.amp[ch][w], color: colorOf(plate[w], w), width: 1.6, card: /* @r2fn R2-C0074-F00054 */() => card(w, ch) });
    const groups = new Map();
    for (const trace of series) {
      const w = plate[trace.key], key = groupOf(w, trace.key), group = groups.get(key) || { name: w.label || (w.role === "unknown" && w.sampleNo ? "Sample " + w.sampleNo : w.role === "unknown" ? w.sample : key), color: trace.color, count: 0 };
      group.count++;
      groups.set(key, group);
    }
    $("t-trace-key").innerHTML = R2.legend([...groups.values()].map(/* @r2fn R2-C0074-F00055 */group => [group.name + " · " + group.count + " wells", group.color]));
    updateSelectionLabel();
    let plotted = series;
    if ($("t-trace-mode").value === "mean") {
      const extracts = new Map();
      for (const trace of series) {
        const well = plate[trace.key];
        const methods = well.t.filter(/* @r2fn R2-C0074-F00056 */t => X.GP().channel(t.m) === ch).map(/* @r2fn R2-C0074-F00057 */t => t.m).join("/");
        const groupKey = well.ext ? groupOf(well, trace.key) + "-E" + well.ext : groupOf(well, trace.key) + "-" + (well.dilution || "");
        const key = methods + ":" + groupKey;
        if (!extracts.has(key)) extracts.set(key, []);
        extracts.get(key).push(trace);
      }
      plotted = [...extracts.values()].map(/* @r2fn R2-C0074-F00058 */group => {
        const w = plate[group[0].key];
        const y = tb.cycles.map(/* @r2fn R2-C0074-F00059 */(cycle, i) => {
          const values = group.map(/* @r2fn R2-C0074-F00060 */trace => trace.y[i]).filter(Number.isFinite);
          return values.length ? values.reduce(/* @r2fn R2-C0074-F00061 */(total,v) => total+v,0) / values.length : NaN;
        });
        const name = w.ext ? (w.label || w.sampleName || w.sample) + " · E" + w.ext : (w.ctl || w.role) + (w.dilution ? " · " + w.dilution : "");
        return { ...group[0], y, width: 2, card: /* @r2fn R2-C0074-F00062 */() => `<b>${R2.esc(name)}</b><span>Mean of ${group.length} selected wells</span>` };
      });
    }
    R2.chart($("t-amp"), { series: plotted, xlab: "cycle", ylab: "counts (LED on − LED off)", height: 300, xlim: [1, Math.max(10, (X.runInfo || pending).gmo.fields.cycles)], xshort: "cycle", cursorX: scan?.kind === "A" ? scan.cycle : undefined });
    if (tb.melt[ch].some(/* @r2fn R2-C0074-F00063 */trace => trace.length)) { const ms = []; for (let w = 0; w < plate.length; w++) if (active(w) && plate[w].t.some(/* @r2fn R2-C0074-F00064 */t => X.GP().channel(t.m) === ch && X.M(t.m).sybr)) ms.push({ key: w, x: tb.meltT[ch][w], y: tb.melt[ch][w], color: colorOf(plate[w], w), width: 1.4, card: /* @r2fn R2-C0074-F00065 */() => card(w) });
      R2.chart($("t-meltlive"), { series: ms, xlab: "melt of the SYBR Green tubes: block temperature at reading (°C)", ylab: "counts", height: 180, xlim: [64, 96], xshort: "°C" }); } else $("t-meltlive").innerHTML = "";
  }
  /* @r2fn R2-C0074-F00066 */function draw() {
    const plate = runPlate(), ins = X.ins, fw = ins.fw, m = fw.m, st = $("t-state"), el = ins.plant.t / 1000, running = fw.running();
    st.textContent = fw.st + (fw.fault ? " · " + fw.fault : ""); st.className = "pill " + (fw.st === "FAULT" ? "bad" : running ? "ok" : "off");
    const s = fw.prog ? fw.prog.stages[Math.min(fw.iStage, fw.prog.stages.length - 1)] : null, ph = phaseOf(fw);
    $("t-bigT").innerHTML = `${R2.fmt(m.t[0], 1)}<small> °C block · target ${R2.fmt(fw.sp, 1)}</small>`;
    $("t-bigC").innerHTML = s && s.type === "cycle" ? `${fw.iCycle}<small> of ${s.repeats} cycles</small>` : s && s.type === "melt" ? `${fw.meltIdx}<small> melt readings</small>` : `–<small> cycle</small>`;
    $("t-bigR").innerHTML = `${R2.hms(el)}<small> instrument time${running ? " of about " + R2.hms(runProfile.total) : ""}</small>`;
    $("t-phase").innerHTML = PH.map(/* @r2fn R2-C0074-F00067 */([k, n]) => `<span class="${k === ph || (k === "read" && fw.opt.busy) ? "on" : ""}">${n}</span>`).join("");
    $("t-prog").value = fw.st === "DONE" ? 1 : Math.min(0.995, el / Math.max(runProfile.total, el + 1));
    $("t-stats-state").textContent = running ? "Live" : "Final snapshot";
    const now = Date.now(), nOpt = ins.rec.optical.length;
    if (now - lastSlow > 450 || !running) { X.drawThermal("t-temp", "t-zoom", 190); const ts = R2.tempStats(ins.rec.telemetry, fw.prog); $("t-tstat").innerHTML = `<tr><th class="l">Step</th><th>Target</th><th>Mean</th><th>SD</th><th>Largest error</th><th>Overshoot</th><th>Ramp</th></tr>` + ts.steps.map(/* @r2fn R2-C0074-F00068 */x => `<tr><td class="l">${R2.tempStatsLabel(x)}</td><td>${x.target.toFixed(0)} °C</td><td>${x.mean.toFixed(2)}</td><td>${x.sd.toFixed(2)}</td><td>${x.maxErr.toFixed(2)}</td><td>${x.overshoot.toFixed(2)}</td><td>${isFinite(x.rampRate) ? x.rampRate.toFixed(1) + " °C/s" : "–"}</td></tr>`).join("");
      $("t-kv").innerHTML = `<dt>Block zone 1 / zone 2</dt><dd>${R2.fmt(m.t[0])} / ${R2.fmt(m.t[1])} °C (largest difference in holds ${ts.zoneDiffMax.toFixed(2)})</dd><dt>Lid</dt><dd>${R2.fmt(m.t[2], 1)} °C${isFinite(ts.lidMean) ? " (mean " + ts.lidMean.toFixed(1) + ", SD " + ts.lidSd.toFixed(2) + ")" : ""}</dd><dt>Heat sink</dt><dd>${R2.fmt(m.t[3], 1)} °C (peak ${ts.hsMax.toFixed(1)})</dd><dt>Time per cycle</dt><dd>${isFinite(ts.cycleS) ? ts.cycleS.toFixed(1) + " s of instrument time" : "–"}</dd><dt>Drives</dt><dd>${m.enRb ? "enabled" : "off"} · lid ${m.lid ? "closed" : "OPEN"}</dd>`; lastSlow = now; }
    if (nOpt !== lastOpt && (now - lastF > 240 || !running)) { if (panel === "detector") drawMatrix(); else drawFluor(); lastOpt = nOpt; lastF = now; }
  }
  X.tab({ id: "run", title: "Run", done: /* @r2fn R2-C0074-F00069 */() => !!X.runInfo,
    html: `<div class="panel" id="run-pre"><h3>Ready to run</h3><dl class="kv" id="run-sum"></dl>
        <div class="row"><button id="t-start" class="primary">Run…</button></div><p id="run-name-mode" class="note"></p><p class="note">You are asked for an experiment name; the run gets the next number. The display then fills the screen and plays the run at one second per cycle.</p></div>
      <dialog id="run-dlg" aria-labelledby="run-dialog-title"><form method="dialog" class="stack" style="gap:10px;min-width:min(420px,80vw)"><h3 id="run-dialog-title" style="margin:0">Name this experiment</h3><label>Experiment name <input id="run-name" type="text" maxlength="60" style="width:100%" autocomplete="off"></label><small>It will be filed as <b id="run-file"></b></small>
        <div class="row"><button value="ok" class="primary" id="run-ok">Close lid and start</button><button value="cancel">Cancel</button></div></form></dialog>
      <dialog id="tpl-dlg" aria-labelledby="tpl-dialog-title"><form method="dialog" class="stack" style="gap:10px;min-width:min(420px,80vw)"><h3 id="tpl-dialog-title" style="margin:0">Save this analysis as a template</h3><label>Template name <input id="tpl-name" type="text" maxlength="80" style="width:100%" autocomplete="off"></label><small>Saved in this browser; it appears under New analysis on the Sample step.</small>
        <div class="row"><button value="ok" class="primary">Save template</button><button value="cancel">Cancel</button></div></form></dialog>
      <div id="run-stage" hidden>
        <div class="runbar" hidden><b id="run-title"></b><span id="t-state" class="pill off">IDLE</span><div class="big" id="t-bigT">–</div><div class="big" id="t-bigC">–</div><div class="big" id="t-bigR">–</div>
          <span class="row" style="margin-left:auto"><button id="t-abort" class="danger">Abort</button><button id="t-lid">Open lid</button></span></div>
        <button type="button" id="run-leave" class="run-back">← Go back</button><div class="phase" id="t-phase" hidden></div><progress hidden id="t-prog" max="1" value="0"></progress>
        <div class="panel" id="run-after" hidden>
          <h3 id="run-after-text" role="status"></h3><p id="t-save-state" class="note"></p>
          <div class="row"><button id="run-review" class="primary">Open quality review</button><button id="run-rdmlt">Download RDMLt with telemetry</button>
            <button id="run-open-detector">Detector</button><button data-go="temperature">Temperature statistics</button><button data-go="tube">Inside the tube</button>
            <button data-go="record">Record and hand-over</button><button id="run-tpl">Save as template…</button><button id="run-again">Set up another run</button></div><p class="note" id="run-tpl-msg" role="status"></p></div>
        <div class="panel run-views">
          <div class="row" role="tablist" aria-label="Run display" hidden><button role="tab" id="t-fluorescence-tab" aria-controls="t-fluorescence-view" aria-selected="true">Fluorescence</button><button role="tab" id="t-detector-tab" aria-controls="t-detector-view" aria-selected="false">Detector</button></div>
          <div class="row"><label>Assay <select id="t-assay"></select></label><label>Channel <select id="t-ch"><option value="0">1 · FAM / SYBR Green</option><option value="1">2 · VIC / HEX / YY</option></select></label><label hidden>Acquisition <select id="t-scan"></select></label>
          <label hidden>Traces <select id="t-trace-mode"><option value="wells">PCR wells</option><option value="mean">Extraction means</option></select></label><button hidden id="t-select-all">Show all wells</button><button hidden id="t-select-clear">Clear selection</button><span hidden id="t-selected-count" aria-live="polite"></span></div>
        </div>
        <div id="t-detector-view" role="tabpanel" aria-labelledby="t-detector-tab" class="panel" hidden>
          <h3>Detector <small id="t-det-note"></small></h3><div class="scroll"><div class="plate384 detector-plate" id="t-matrix"></div></div>
          <div class="det-scale"><label>Intensity scale <select id="t-detector-scale"><option value="fixed">Fixed</option><option value="auto">Fit this acquisition</option></select></label><span>0 counts</span><div></div><span id="t-scale-max"></span></div>
          <p class="note">Brightness uses LED-on minus LED-off counts for the selected channel and exposure. Drag or Shift-click a range, Ctrl-click to toggle wells, or select a row or column. The same selection filters the fluorescence chart.</p>
          <dl class="kv" id="t-read-kv"></dl>
        </div>
        <div class="rungrid" id="t-fluorescence-view" role="tabpanel" aria-labelledby="t-fluorescence-tab">
          <div class="stack"><div class="panel"><h3>Block temperature</h3><div id="t-temp"></div><div id="t-zoom"></div></div></div>
          <div class="stack"><div class="panel"><h3>Fluorescence</h3><div id="t-amp"></div><div id="t-trace-key"></div><div id="t-meltlive"></div></div></div>
          <div class="stack run-diagnostics" hidden><div class="panel"><h3>Temperature statistics <small id="t-stats-state">Live</small></h3><div class="scroll"><table id="t-tstat"></table></div><dl class="kv" id="t-kv"></dl></div><div class="panel"><h3>Event log</h3><div class="log" id="t-log"></div></div></div>
        </div></div>`,
    init/* @r2fn R2-C0074-F00070 */() {
      $("t-start").onclick = ask; $("run-dlg").addEventListener("close", /* @r2fn R2-C0074-F00071 */() => { if ($("run-dlg").returnValue === "ok") start($("run-name").value); });
      $("t-abort").onclick = /* @r2fn R2-C0074-F00072 */() => { if (X.ins) X.ins.fw.abort(); };
      $("t-lid").onclick = /* @r2fn R2-C0074-F00073 */() => { if (!X.ins) return; lidOpen = !lidOpen; X.ins.plant.fault = null; X.ins.plant.lidClosed = !lidOpen; $("t-lid").textContent = lidOpen ? "Close lid" : "Open lid"; };
      $("run-leave").onclick = leave; $("run-after").addEventListener("click", /* @r2fn R2-C0074-F00074 */e => { if (e.target.closest("[data-go]")) leave(); });
      $("run-review").onclick = /* @r2fn R2-C0074-F00075 */() => { leave(); R2.session.run = X.runInfo; location.hash = R2.levels.reviewRoute(); };
      $("run-rdmlt").onclick = /* @r2fn R2-C0074-F00076 */async () => {
        const run = X.runInfo;
        const evaluation = R2.gmoeval.run(run, { cqMethod: "auto" });
        const downloaded = await R2.downloadAsync($("run-rdmlt"), run.runId + ".rdmlt", /* @r2fn R2-C0074-F00077 */() => R2.rdmltCompressed(run, evaluation));
        if (downloaded && X.runInfo === run) $("t-save-state").textContent = "RDMLt download requested · this copy is held in the browser tab";
      };
      X.resetRunView = /* @r2fn R2-C0074-F00078 */() => { leave(); $("run-stage").hidden = true; $("run-pre").hidden = false; $("run-tpl-msg").textContent = ""; };
      $("run-again").onclick = /* @r2fn R2-C0074-F00079 */() => { X.resetRunView(); summary(); };
      $("run-tpl").onclick = /* @r2fn R2-C0074-F00080 */() => { $("tpl-dlg").returnValue = ""; $("tpl-name").value = runName.replace(/^\d+_/, "").replace(/_/g, " "); $("tpl-dlg").showModal ? $("tpl-dlg").showModal() : $("tpl-dlg").setAttribute("open", ""); $("tpl-name").select(); };
      $("tpl-dlg").addEventListener("close", /* @r2fn R2-C0074-F00081 */() => { if ($("tpl-dlg").returnValue !== "ok") return; const t = R2.templates.capture(X, $("tpl-name").value); const ok = R2.templates.save(t);
        if (X.fillTemplates) X.fillTemplates(t.id);
        $("run-tpl-msg").innerHTML = `${ok ? "Saved" : "Kept for this tab only (browser storage unavailable)"}: template <b>${R2.esc(t.name)}</b> (${t.id}, ${t.sop_id}). <button type="button" id="run-tpl-dl">Download template</button>`;
        $("run-tpl-dl").onclick = /* @r2fn R2-C0074-F00082 */() => R2.download(t.name.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) + ".template.json", JSON.stringify(t, null, 1), "application/json"); });
      const render = /* @r2fn R2-C0074-F00083 */() => showPanel(panel);
      selection = R2.selectPlate($("t-matrix"), allowed, /* @r2fn R2-C0074-F00084 */(wells, focus) => {
        selected = wells;
        selectedWell = focus ?? null;
        drawMatrix();
        if (focus !== undefined) $("t-matrix").querySelector(`[data-w="${focus}"]`)?.focus({ preventScroll: true });
      });
      $("t-fluorescence-tab").onclick = /* @r2fn R2-C0074-F00085 */() => showPanel("fluorescence");
      $("t-detector-tab").onclick = $("run-open-detector").onclick = /* @r2fn R2-C0074-F00086 */() => showPanel("detector");
      $("t-assay").onchange = /* @r2fn R2-C0074-F00087 */() => {
        if ($("t-assay").value) $("t-ch").value = X.GP().channel($("t-assay").value);
        selection.reset(); selected = null; render();
      };
      $("t-ch").onchange = /* @r2fn R2-C0074-F00088 */() => {
        const id = $("t-assay").value;
        if (id && X.GP().channel(id) !== +$("t-ch").value) $("t-assay").value = "";
        selection.reset(); selected = null; render();
      };
      $("t-scan").onchange = $("t-trace-mode").onchange = $("t-detector-scale").onchange = render;
      $("t-select-all").onclick = /* @r2fn R2-C0074-F00089 */() => { selection.all(); render(); };
      $("t-select-clear").onclick = /* @r2fn R2-C0074-F00090 */() => { selection.clear(); render(); };
    }, show/* @r2fn R2-C0074-F00091 */() { if (!X.running()) { summary(); if (X.ins && !$("run-stage").hidden) { lastSlow = 0; lastOpt = -1; draw(); } } } });
})(window.R2);
