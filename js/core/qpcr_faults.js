/* qPCR error scenarios: reproduces the hardware, software, reagent and human errors of a real-time PCR run on the
 * workbench instrument, so that their signature can be studied in the Quality review and in MISSY.
 *
 * Two kinds of scenario, always labelled in the run (run.injectedFault) and in its RDMLt (source/run-input.json):
 *   native    the error is produced by the existing model: reagent and handling settings (R2.reagents), programme
 *             fields, plate plan, firmware configuration, the plant's fault list (R2.Plant.FAULTS) or an instance-level
 *             change of one simulated instrument (optical gain, LED code, thermal contact). The kinetics, the optics
 *             equations and every file in js/core stay unchanged; only the inputs of one run differ.
 *   injected  the model has no physics for the error (bubbles, droplets, plate rotation, data-link loss, crash,
 *             evaporation, autofluorescent plastic...). The acquired raw record is transformed after the run in a
 *             documented, reproducible way. These records are teaching material, not simulated chemistry.
 *
 * Hooks, called by the technician run (js/ui/tech/t09_run.js) or by tools_qpcr_faults_check.js:
 *   F.prepare(sc, ctx)            before simWells: returns { settings, f, plan, prog } (clones, the bench is untouched)
 *   F.afterSimWells(sc, sw, ctx)  per-well reaction inputs (copies, efficiency, primers)
 *   F.afterSetPlate(sc, ins, ctx) instrument instance: firmware configuration, optics, thermal contact, plant faults
 *   F.afterRun(sc, run, ctx)      raw-record transforms, labelling
 * ctx = { plan, seed } ; every random choice uses R2.Rng(seed) so a scenario reproduces exactly. */
(/* @r2fn R2-C0032-F00001 */function (R2) {
  "use strict";
  const F = R2.qpcrFaults = {};
  const M = /* @r2fn R2-C0032-F00002 */id => (R2.GMO && R2.GMO.methods[id]) || {};
  const COLS = 24;
  const col = /* @r2fn R2-C0032-F00003 */w => w % COLS, row = /* @r2fn R2-C0032-F00004 */w => Math.floor(w / COLS);
  const isEdge = /* @r2fn R2-C0032-F00005 */w => col(w) === 0 || col(w) === COLS - 1 || row(w) === 0 || row(w) === 15;
  // plate helpers (plan.wells: role, ctl, t[{m}], sampleNo, ext, rep)
  const used = /* @r2fn R2-C0032-F00006 */plan => plan.wells.map(/* @r2fn R2-C0032-F00007 */(W, i) => [W, i]).filter(/* @r2fn R2-C0032-F00008 */([W]) => W.role !== "empty");
  const wellsWhere = /* @r2fn R2-C0032-F00009 */(plan, pred) => used(plan).filter(/* @r2fn R2-C0032-F00010 */([W, i]) => pred(W, i)).map(/* @r2fn R2-C0032-F00011 */([, i]) => i);
  const kindOf = /* @r2fn R2-C0032-F00012 */W => M((W.t[0] || {}).m).kind;
  const element = /* @r2fn R2-C0032-F00013 */W => ["screen", "element", "event", "construct"].includes(kindOf(W));
  const taxon = /* @r2fn R2-C0032-F00014 */W => kindOf(W) === "taxon";
  // raw optical record: net signal per reading = (sum_on − sum_off) / (periods × 8)
  const D = /* @r2fn R2-C0032-F00015 */o => o.periods * 8, net = /* @r2fn R2-C0032-F00016 */o => (o.sum_on - o.sum_off) / D(o);
  /* @r2fn R2-C0032-F00017 */function setNet(o, v) { const k = net(o) ? v / net(o) : 1; o.sum_on = Math.round(o.sum_off + v * D(o)); o.min_net = Math.round(o.min_net * k); o.max_net = Math.round(o.max_net * k); o.sumsq_net = Math.round(o.sumsq_net * k * k); }
  const ampReads = /* @r2fn R2-C0032-F00018 */(run, wells) => { const s = wells ? new Set(wells) : null; return run.record.optical.filter(/* @r2fn R2-C0032-F00019 */o => o.kind === "A" && (!s || s.has(o.well))); };
  const byWellChannel = /* @r2fn R2-C0032-F00020 */reads => { const m = new Map(); for (const o of reads) { const k = o.well + "/" + o.channel; if (!m.has(k)) m.set(k, []); m.get(k).push(o); } for (const a of m.values()) a.sort(/* @r2fn R2-C0032-F00021 */(x, y) => x.cycle - y.cycle); return m; };
  const pick = /* @r2fn R2-C0032-F00022 */(arr, n, rng) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.u() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  // instance-level changes of one simulated instrument (no edit of plant.js)
  /* @r2fn R2-C0032-F00023 */function thermalLag(ins, wells, tauMs) {           // poor thermal contact: the liquid follows the block with a time constant
    const p = ins.plant, base = p.wellTemp.bind(p), set = new Set(wells), Tw = new Map(), last = new Map();
    p.wellTemp = /* @r2fn R2-C0032-F00024 */function (w) { const t = base(w); if (!set.has(w)) return t; const now = this.t;
      if (!Tw.has(w)) { Tw.set(w, t); last.set(w, now); return t; }
      const dt = now - last.get(w); if (dt > 0) { Tw.set(w, Tw.get(w) + (t - Tw.get(w)) * (1 - Math.exp(-dt / tauMs))); last.set(w, now); } return Tw.get(w); };
  }
  /* @r2fn R2-C0032-F00025 */function tempOffset(ins, wells, fn) { const p = ins.plant, base = p.wellTemp.bind(p), set = new Set(wells); p.wellTemp = /* @r2fn R2-C0032-F00026 */function (w) { const t = base(w); return set.has(w) ? t + fn(t, this.Tamb, w) : t; }; }
  /* @r2fn R2-C0032-F00027 */function extraBackground(ins, counts) { const p = ins.plant, base = p.signal.bind(p); p.signal = /* @r2fn R2-C0032-F00028 */function (wi) { const s = base(wi); if (this.wells[wi].a.kind !== "reaction") return s; const f = this.wells[wi].factor * this.led; return [s[0] + counts * f, s[1] + counts * 0.6 * f]; }; }
  /* @r2fn R2-C0032-F00029 */function weakTec(ins, zone, k) { const p = ins.plant, base = p.stepMs.bind(p); p.stepMs = /* @r2fn R2-C0032-F00030 */function () { const d = this.duty[zone]; this.duty[zone] = d * k; base(); this.duty[zone] = d; }; }
  /* @r2fn R2-C0032-F00031 */function dntpPool(ins, k) { const p = ins.plant, base = p.loadWells.bind(p); p.loadWells = /* @r2fn R2-C0032-F00032 */function () { base(); for (const w of this.wells) { if (w.ch) w.ch.dntp *= k; if (w.ch2) w.ch2.dntp *= k; } }; }
  // raw-record transforms (injected scenarios)
  /* @r2fn R2-C0032-F00033 */function scaleReads(run, wells, fn) { for (const o of ampReads(run, wells)) setNet(o, fn(net(o), o)); }
  /* @r2fn R2-C0032-F00034 */function delayCurves(run, wells, cycles) {          // template on the wall reaches the reaction late
    for (const reads of byWellChannel(ampReads(run, wells)).values()) { const v = reads.map(net), b = v[0]; reads.forEach(/* @r2fn R2-C0032-F00035 */(o, i) => setNet(o, i - cycles >= 0 ? v[i - cycles] : b + (v[1] - v[0]) * 0)); }
  }
  /* @r2fn R2-C0032-F00036 */function spikes(run, wells, rng) {                  // bubble: light scattered for one reading, then lens effect as it expands
    for (const reads of byWellChannel(ampReads(run, wells)).values()) {
      const i = 6 + Math.floor(rng.u() * (reads.length - 10)), v = net(reads[i]), base = net(reads[0]);
      setNet(reads[i], base + (v - base) * 0.35 - 0.25 * base); setNet(reads[i + 1], net(reads[i + 1]) * 1.18);
    }
  }
  /* @r2fn R2-C0032-F00037 */function linearCreep(run, wells, start, perCycle) { scaleReads(run, wells, /* @r2fn R2-C0032-F00038 */(v, o) => o.cycle > start ? v + perCycle * (o.cycle - start) : v); }
  F.helpers = { used, wellsWhere, element, taxon, net, setNet, ampReads, byWellChannel, thermalLag, tempOffset, extraBackground, weakTec, dntpPool, scaleReads, delayCurves, spikes, linearCreep, isEdge };

  /* ------------------------------------------------------------------------------------------------------------
   * The catalogue. Fields: id, cat (1 hardware, 2 software, 3 reagents, 4a configuration, 4b handling,
   * 4c interpretation), title, kind, mechanism, workbench (where it is set or seen), missy (where it shows),
   * choice (analysis to run; default SIMPLEX soybean screening), hooks, expect(base, run) → [ok, text]. */
  const MAIZE_DUPLEX = { sample: "maiC", stage: "screen", assays: ["QL-ELE-00-012", "QL-ELE-00-013", "QT-ELE-00-002", "QL-CON-00-008"], duplex: true };
  const SOY_DUPLEX = { sample: "soyA", stage: "screen", assays: ["QL-ELE-00-012", "QL-ELE-00-013", "QT-ELE-00-002", "QL-CON-00-008"], duplex: true };
  const SOY_QUANT = { sample: "soyA", stage: "quant", assays: ["QT-EVE-GM-005"] };
  const L = [];
  const add = /* @r2fn R2-C0032-F00039 */s => L.push(Object.assign({ kind: "native", choice: null }, s));

  // ---------------- 1. Hardware ----------------
  add({ id: "hw-edge", cat: "1", title: "Thermal block non-uniformity (edge effect)",
    mechanism: "Edge wells run 7 °C colder at denaturation (88 °C instead of 95 °C, no offset at annealing). Even this large deviation delays the edge wells by only about 0.2 cycle: in the model, denaturation of a 70–120 bp amplicon is robust, so practical edge effects come mainly from evaporation (see hu-seal).",
    workbench: "Instance change of plant.wellTemp for the outer row/column; the plant already has a small edge term (P.wellTemp).",
    missy: "Results: replicate spread; Control Panel B-O3 Row / column pattern, B-O1 Replicate precision; B-H5 zone uniformity stays normal (the controller sensors do not see it).",
    afterSetPlate/* @r2fn R2-C0032-F00040 */(ins, ctx) { tempOffset(ins, wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00041 */(W, i) => isEdge(i)), /* @r2fn R2-C0032-F00042 */(t, a) => -7 * Math.max(0, t - a - 40) / 33); } });
  add({ id: "hw-peltier", cat: "1", title: "Peltier element degradation (zone 1 pumps 70 % of nominal)",
    mechanism: "The zone-1 module converts only part of its drive into heat flow: ramps slow down, zone 1 lags zone 2 and the firmware stops the run with F_ZONE_MISMATCH.",
    workbench: "Instance change of plant.stepMs scaling zone-1 duty; native relative of the tec_open fault (R2.Plant.FAULTS).",
    missy: "Control Panel B-H1 Peak heating rate, B-H2 cooling rate, B-H3c transition time, B-H5 / V-virtual_zone_spread, V-virtual_tec_duty, V-virtual_hold_rms.",
    afterSetPlate/* @r2fn R2-C0032-F00043 */(ins) { weakTec(ins, 0, 0.7); } });
  add({ id: "hw-lid", cat: "1", title: "Heated lid malfunction (lid at 60 °C, condensation)",
    mechanism: "The lid stays far below the block: water condenses under the seal, wells concentrate and the reading through droplets falls and scatters.",
    workbench: "Native: programme lid_c = 60 °C (telemetry lid_c). Injected: condensation transform of the readings after cycle 20 (no evaporation physics in the model).",
    missy: "Control Panel B-H6b Heated cover temperature, V-virtual_lid_temp, V-virtual_lid_duty; A-H3 background and A-H3b end-point fluorescence; Results: noisy plateau.",
    kind: "native+injected", prepare/* @r2fn R2-C0032-F00044 */(c) { c.prog = Object.assign({}, c.prog, { lid_c: 60 }); },
    afterRun/* @r2fn R2-C0032-F00045 */(run, ctx) { const r = new R2.Rng(ctx.seed); scaleReads(run, null, /* @r2fn R2-C0032-F00046 */(v, o) => o.cycle > 20 ? v * (1 - 0.006 * (o.cycle - 20)) * (1 + 0.03 * r.gauss()) : v); } });
  add({ id: "hw-optics-misaligned", cat: "1", title: "Optical misalignment (vignetting across the plate)",
    mechanism: "The light path is shifted: collected light falls linearly from 100 % at column 1 to 35 % at column 24.",
    workbench: "Instance change of the plant's per-well optical factor (wells[].factor).",
    missy: "Control Panel B-O3 Row / column pattern, A-H3 background and A-H3b end-point fluorescence; OpticalCyclerB files: B-H13 uniformity calibration.",
    afterSetPlate/* @r2fn R2-C0032-F00047 */(ins) { ins.plant.wells.forEach(/* @r2fn R2-C0032-F00048 */(w, i) => { w.factor *= 1 - 0.65 * col(i) / 23; }); } });
  add({ id: "hw-crosstalk", cat: "1", title: "Optical crosstalk (filter shifted: 30 % FAM into the YY channel)",
    mechanism: "A shifted emission filter lets FAM light into the second channel. In the P-35S/T-nos duplex, maize MON810 (P-35S without T-nos) shows a false T-nos signal.",
    workbench: "Native crosstalk matrix in plant.signal (8 % FAM→ch2, 4 % ch2→FAM). Injected: extra 30 % added to channel 2 per well and cycle.",
    missy: "Results of the duplex screening (T-nos call), curves of channel 2; Quality bench: duplex crosstalk note.",
    kind: "injected", choice: MAIZE_DUPLEX,
    afterRun/* @r2fn R2-C0032-F00049 */(run) { const reads = ampReads(run), m = new Map(reads.filter(/* @r2fn R2-C0032-F00050 */o => o.channel === 0).map(/* @r2fn R2-C0032-F00051 */o => [o.well + "/" + o.cycle, net(o)]));
      for (const o of reads) if (o.channel === 1) { const a = m.get(o.well + "/" + o.cycle); if (a !== undefined) setNet(o, net(o) + 0.30 * a); } } });
  add({ id: "hw-led-aged", cat: "1", title: "Light source degradation (LED at 50 %)",
    mechanism: "The excitation LED delivers half its light; every signal and the reference photodiode halve, noise stays.",
    workbench: "Native: firmware configuration ledCode 128 → 64 (R2.CFG().ledCode), saved in the run's firmwareConfiguration.",
    missy: "Control Panel B-H8 Lamp reference channel, A-H3 / A-H3b fluorescence levels, B-M1 Probe signal strength (positive control).",
    afterSetPlate/* @r2fn R2-C0032-F00052 */(ins) { ins.fw.cfg.ledCode = 64; } });
  add({ id: "hw-led-drift", cat: "1", title: "Light source drifting within the run (end of life)",
    mechanism: "LED output falls by 25 % during cycling (thermal ageing).",
    workbench: "Native: firmware ledCode lowered step by step during the run (instance timer on the firmware).",
    missy: "Control Panel B-H9 Lamp drift within a run; MISSY reading: 'Growing drift is typical of a lamp near the end of its life'.",
    afterSetPlate/* @r2fn R2-C0032-F00053 */(ins) { const fw = ins.fw, base = ins.advance.bind(ins); let n = 0; ins.advance = /* @r2fn R2-C0032-F00054 */function (ms) { base(ms); n += ms; fw.cfg.ledCode = Math.max(96, Math.round(128 - n / 60000 * 0.6)); }; } });
  add({ id: "hw-saturation", cat: "1", title: "Detector saturation (gain set too high)",
    mechanism: "Camera gain ×6: bright wells clip at full scale (4095 counts), plateaus flatten.",
    workbench: "Native: per-well gainBoost of the plant (the clipping and sat_samples counter are in plant.opticsPeriodWell).",
    missy: "Control Panel B-S11 Invalid fluorescence readings (readings with saturated samples), OpticalCyclerB B-H12 Saturated well images; curves clipped.",
    afterSetPlate/* @r2fn R2-C0032-F00055 */(ins) { ins.plant.wells.forEach(/* @r2fn R2-C0032-F00056 */w => { w.gainBoost = 6; }); } });
  add({ id: "hw-noise", cat: "1", title: "Detector noise (camera read scatter ×8)",
    mechanism: "A failing camera adds read scatter to every exposure.",
    workbench: "Native: per-well scatterScale of the plant (READ_SCATTER in plant.illuminate).",
    missy: "Control Panel baseline noise ('Early-cycle fluorescence variation'), B-O1 Replicate precision; Results: Cq spread.",
    afterSetPlate/* @r2fn R2-C0032-F00057 */(ins) { ins.plant.wells.forEach(/* @r2fn R2-C0032-F00058 */w => { w.scatterScale *= 8; }); } });
  add({ id: "hw-dirty", cat: "1", title: "Dirty optical path (spill over a 4 × 4 patch)",
    mechanism: "Dried reagent on the window over 16 wells halves their light and makes it unsteady.",
    workbench: "Native: plant per-well factor ×0.5 and scatterScale ×4 for the patch.",
    missy: "Control Panel B-O3 Row / column pattern; Results: low plateaus clustered in one area.",
    afterSetPlate/* @r2fn R2-C0032-F00059 */(ins, ctx) { const w0 = wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00060 */() => true)[0] || 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const w = ins.plant.wells[w0 + r * COLS + c]; if (w) { w.factor *= 0.5; w.scatterScale *= 4; } } } });
  add({ id: "hw-not-seated", cat: "1", title: "Plate not seated flush (drawer jam; poor thermal contact in rows A–D)",
    mechanism: "The plate rides on the block edge: the liquid follows the block with a 20 s time constant and does not reach 95 °C in a 15 s step.",
    workbench: "Instance change of plant.wellTemp (thermal lag). The R2 block has no motorised drawer, so the jam is represented by its consequence.",
    missy: "Results: late or missing Cq in one region; B-O3 Row / column pattern. Block telemetry looks normal (the sensors are in the block).",
    afterSetPlate/* @r2fn R2-C0032-F00061 */(ins, ctx) { thermalLag(ins, wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00062 */(W, i) => row(i) < 4), 20000); } });
  add({ id: "hw-sensor-drift", cat: "1", title: "Block temperature sensor drifting low (added)",
    mechanism: "The zone-1 sensor reads up to 12 °C low; the controller heats until the sensor agrees, the block overheats.",
    workbench: "Native plant fault ntc_drift (R2.Plant.FAULTS); detected by the independent block sensor (telemetry ref_c).",
    missy: "Timeline and log events; Control Panel B-H3 overshoot / B-H4 temperature at reading (from the controller's sensor) look normal: compare with ref_c.",
    afterSetPlate/* @r2fn R2-C0032-F00063 */(ins) { ins.injectFault("ntc_drift", 20 * 60000); } });
  add({ id: "hw-fan", cat: "1", title: "Cooling fan stalled (added)",
    mechanism: "The heat sink overheats; the firmware stops the run when the fan is below 600 rpm for 3 s.",
    workbench: "Native plant fault fan_stall (R2.Plant.FAULTS); firmware limits rpmMin and stallMs.",
    missy: "V-virtual_fan_rpm Cooling fan speed, B-H6 / V-virtual_sink_peak heat sink; run aborted: Results withheld.",
    afterSetPlate/* @r2fn R2-C0032-F00064 */(ins) { ins.injectFault("fan_stall", 30 * 60000); } });
  add({ id: "hw-lid-opened", cat: "1", title: "Lid opened during the run (added)",
    mechanism: "The lid switch removes the drive enable; the firmware aborts.",
    workbench: "Native plant fault lid_open; the run window also has Open lid.",
    missy: "Timeline events; Results withheld for an aborted run.",
    afterSetPlate/* @r2fn R2-C0032-F00065 */(ins) { ins.injectFault("lid_open", 25 * 60000, 20000); } });

  // ---------------- 2. Software ----------------
  add({ id: "sw-baseline", cat: "2", title: "Baseline misassignment (very early amplification)",
    mechanism: "Sample DNA 200 × too concentrated: the reference gene rises inside the default baseline window (cycles 3–15).",
    workbench: "Native: template copies ×200 in the sample wells (as an undiluted extract).",
    missy: "Results: reference Cq < 20 → 'dilute'; curve view with baseline window; OpticalCyclerB files: BLFAIL flag.",
    afterSimWells/* @r2fn R2-C0032-F00066 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00067 */W => W.role === "unknown")) sw.wells[i].copies *= 200; } });
  add({ id: "sw-threshold", cat: "2", title: "Inappropriate threshold placement",
    mechanism: "The same raw record evaluated with the automatic threshold and with a manual threshold inside the noise or high in the linear phase.",
    workbench: "Quality manager: Cq method 'threshold', threshold field or drag, then Confirm analysis settings (0.4.18). No change to the run.",
    missy: "Results recalculated with the profile's threshold settings; B-S12 Stored Ct not reproducible (OpticalCyclerB).",
    kind: "analysis" });
  add({ id: "sw-colorcomp", cat: "2", title: "Missing colour compensation (crosstalk not corrected)",
    mechanism: "Same as the optical crosstalk record, read without compensation: the duplex T-nos call follows P-35S.",
    workbench: "Duplex screening (Technician step 2 'Duplex'); injected 30 % crosstalk, as in the optical crosstalk scenario.",
    missy: "Results of channel 2; Quality bench duplex note.",
    kind: "injected", choice: MAIZE_DUPLEX, afterRun/* @r2fn R2-C0032-F00068 */(run, ctx) { F.get("hw-crosstalk").afterRun(run, ctx); } });
  add({ id: "sw-passive-ref", cat: "2", title: "Passive-reference normalisation applied to a mix without ROX",
    mechanism: "The probe mixes of the workbench contain no passive dye (noRef). Dividing FAM by the second channel divides by its bleed-through, which rises with amplification: curves flatten.",
    workbench: "Analysis-only: the check tool divides channel 1 by channel 2 of the same record.",
    missy: "OpticalCyclerB files: B-M2 Passive reference (ROX) level, B-O2 ROX CV, flags ROXLOW / BADROX / ROXDROP.",
    kind: "analysis" });
  add({ id: "sw-dropout", cat: "2", title: "Firmware–software communication dropout",
    mechanism: "The data link stalls for three cycles: their readings and 4 minutes of telemetry never reach the PC.",
    workbench: "Injected: readings of cycles 18–20 and the matching telemetry removed, event HOST_LINK_TIMEOUT added. Native relative: fault fw_hang (run aborted).",
    missy: "Load an experiment: missing cycles; A-H4b Total run minus temperature-log duration, A-H4a log duration; timeline event.",
    kind: "injected",
    afterRun/* @r2fn R2-C0032-F00069 */(run) { const rec = run.record, gone = rec.optical.filter(/* @r2fn R2-C0032-F00070 */o => o.kind === "A" && o.cycle >= 18 && o.cycle <= 20), t0 = Math.min(...gone.map(/* @r2fn R2-C0032-F00071 */o => o.t_start_ms)), t1 = Math.max(...gone.map(/* @r2fn R2-C0032-F00072 */o => o.t_end_ms));
      rec.optical = rec.optical.filter(/* @r2fn R2-C0032-F00073 */o => !(o.kind === "A" && o.cycle >= 18 && o.cycle <= 20)); rec.telemetry = rec.telemetry.filter(/* @r2fn R2-C0032-F00074 */r => r.t_ms < t0 || r.t_ms > t1);
      rec.events.push({ seq: 1e9, t_ms: t0, code: "HOST_LINK_TIMEOUT", severity: 1, detail: "no data from the instrument for " + Math.round((t1 - t0) / 1000) + " s" }); } });
  add({ id: "sw-template", cat: "2", title: "Corrupted / outdated run template",
    mechanism: "An old template carries annealing 55 °C and 40 cycles: a different programme, so a different SOP.",
    workbench: "Native: programme fields annT 55, cycles 40 (Technician step 6, or an old .ixo/.json template on step 1). SOP identity changes (R2.sop.idOf).",
    missy: "SOP tab: a second procedure ID; full-page different-SOP warning when opened with a normal run.",
    prepare/* @r2fn R2-C0032-F00075 */(c) { c.f = Object.assign({}, c.f, { annT: 55, cycles: 40 }); } });
  add({ id: "sw-melt", cat: "2", title: "Melt-curve derivative errors",
    mechanism: "This catalogue scenario is not implemented for the default probe assays. A hydrolysis-probe melt is not an amplicon melt. The separate EURL QL-ELE-00-020 method uses SYBR Green.",
    workbench: "Not implemented by this scenario. The default screening is probe-based; QL-ELE-00-020 provides a separate SYBR/melt workflow.",
    missy: "Melting peaks (CSV) for imported SYBR runs from real instruments.", kind: "not reproducible" });
  add({ id: "sw-crash", cat: "2", title: "Software crash before saving (long run)",
    mechanism: "The PC software stops after cycle 30: the run file ends there and has no completion event.",
    workbench: "Injected: record truncated after cycle 30, RUN_COMPLETE removed, HOST_CRASH added, outcome 'aborted'. Native relative: Abort in the run window.",
    missy: "Native adapter: incomplete run → sample calls withheld; timeline without 'Run ended'; A-H4 run duration short.",
    kind: "injected",
    afterRun/* @r2fn R2-C0032-F00076 */(run) { const rec = run.record, last = rec.optical.filter(/* @r2fn R2-C0032-F00077 */o => o.kind === "A" && o.cycle === 30).reduce(/* @r2fn R2-C0032-F00078 */(m, o) => Math.max(m, o.t_end_ms), 0);
      rec.optical = rec.optical.filter(/* @r2fn R2-C0032-F00079 */o => o.t_end_ms <= last); rec.telemetry = rec.telemetry.filter(/* @r2fn R2-C0032-F00080 */r => r.t_ms <= last); rec.events = rec.events.filter(/* @r2fn R2-C0032-F00081 */e => (e.t_ms ?? 0) <= last && e.code !== "RUN_COMPLETE");
      rec.events.push({ seq: 1e9, t_ms: last + 1, code: "HOST_CRASH", severity: 2, detail: "acquisition software stopped" }); run.outcome = "aborted"; } });

  // ---------------- 3. Reagents and consumables ----------------
  add({ id: "re-polymerase", cat: "3", title: "Polymerase inactivation (master mix 6 months at room temperature)",
    mechanism: "Enzyme activity and efficiency fall with storage temperature and time.",
    workbench: "Native: reagent settings mixStoreC 22, mixMonths 6 (Technician step 4 'Reagents and handling'; R2.reagents.build).",
    missy: "A-M1 Positive control Cq (Levey-Jennings) shifts up, B-M1 Probe signal strength falls, B-M3 efficiency (quantification).",
    prepare/* @r2fn R2-C0032-F00082 */(c) { Object.assign(c.settings, { mixStoreC: 22, mixMonths: 6 }); } });
  add({ id: "re-bleach", cat: "3", title: "Fluorophore photobleaching (probe 24 h in lab light)",
    mechanism: "Bleached probes still bind and are cut but give no light: lower plateau, same Cq.",
    workbench: "Native: probeLightH 24 (R2.reagents BLEACH_H per dye).",
    missy: "B-M1 Probe signal strength (positive control), A-H3b end-point fluorescence.",
    prepare/* @r2fn R2-C0032-F00083 */(c) { Object.assign(c.settings, { probeLightH: 24 }); } });
  add({ id: "re-probe-degraded", cat: "3", title: "Probe degradation (quencher separated: high baseline)",
    mechanism: "Probes stored 12 months at room temperature: cut reporter is free before cycling starts.",
    workbench: "Native: probeStoreC 22, probeMonths 12 (free reporter freeNM in R2.reagents.build).",
    missy: "A-H3 Background fluorescence per channel rises; plateau/baseline ratio falls; B-M1.",
    prepare/* @r2fn R2-C0032-F00084 */(c) { Object.assign(c.settings, { probeStoreC: 22, probeMonths: 12 }); } });
  add({ id: "re-dntp", cat: "3", title: "dNTP hydrolysis (nucleotides run out in the late cycles)",
    mechanism: "Degraded dNTPs starve the reaction once product accumulates: the plateau comes early and low, the Cq barely moves.",
    workbench: "Injected: plateau compression after the rise (v = base + P·tanh((v − base)/P), P = 45 % of the rise). On the 384-well camera the plateau follows the fitted reporter model (plant.js CAMERA_REPORTER_MODEL), so the dNTP pool of chemistry.js does not change the reading; the instance hook dntpPool() is kept for the 16-tube block.",
    missy: "A-H3b End-point fluorescence, B-M1 Probe signal strength (positive control).",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00085 */(run) { for (const reads of byWellChannel(ampReads(run)).values()) { const v = reads.map(net), base = (v[2] + v[3] + v[4]) / 3, P = 0.45 * (Math.max(...v) - base); if (P > 20) reads.forEach(/* @r2fn R2-C0032-F00086 */(o, k) => setNet(o, base + P * Math.tanh((v[k] - base) / P))); } } });
  add({ id: "re-inhibitor", cat: "3", title: "Inhibitors in the template (ethanol / humic acid carry-over)",
    mechanism: "Sample wells only: efficiency and enzyme activity fall; controls are unaffected.",
    workbench: "Native: reagent setting inhibitor 0.5 (sample wells), or a sample preset with inhibitor.",
    missy: "Results: reference gene late in the samples, controls normal; B-M6 IC shift (when an internal control is configured).",
    prepare/* @r2fn R2-C0032-F00087 */(c) { Object.assign(c.settings, { inhibitor: 0.5 }); } });
  add({ id: "re-plastic-profile", cat: "3", title: "Incompatible plastics (wrong plate profile)",
    mechanism: "The plate does not sit in the block wells: every well follows the block with a 12 s time constant.",
    workbench: "Instance change of plant.wellTemp (thermal lag, whole plate).",
    missy: "Results: all Cq later, controls may leave their windows; block telemetry normal.",
    afterSetPlate/* @r2fn R2-C0032-F00088 */(ins, ctx) { thermalLag(ins, wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00089 */() => true), 12000); } });
  add({ id: "re-seal", cat: "3", title: "Non-optical sealing film",
    mechanism: "A white or foil seal passes about 12 % of the light: low counts, noise dominates.",
    workbench: "Native: plant optical factor ×0.12 for every well.",
    missy: "A-H3 / A-H3b fluorescence collapse; B-M1; Results: late or missing Cq.",
    afterSetPlate/* @r2fn R2-C0032-F00090 */(ins) { ins.plant.wells.forEach(/* @r2fn R2-C0032-F00091 */w => { w.factor *= 0.12; }); } });
  add({ id: "re-autofluor", cat: "3", title: "Autofluorescent plastics",
    mechanism: "The polypropylene adds a constant glow of 900 counts: higher background, lower relative signal.",
    workbench: "Instance change of plant.signal (constant background, scaled by the optics).",
    missy: "A-H3 Background fluorescence per channel; early-cycle baseline level.",
    afterSetPlate/* @r2fn R2-C0032-F00092 */(ins) { extraBackground(ins, 900); } });
  add({ id: "re-lot", cat: "3", title: "Lot-to-lot variability (new primer/probe lot at 60 % / 70 %)",
    mechanism: "A new lot delivers less primer and probe than stated: positive control later and weaker.",
    workbench: "Native: primerF 0.6, primerR 0.6, probe 0.7 (step 4 'Primers and probe').",
    missy: "A-M1 Positive control Cq (Westgard rules flag the step), B-M1; MISSY reading 'A step = new master-mix lot'.",
    prepare/* @r2fn R2-C0032-F00093 */(c) { Object.assign(c.settings, { primerF: 0.6, primerR: 0.6, probe: 0.7 }); } });
  add({ id: "re-hotstart", cat: "3", title: "No hot start, plate left 4 h on a warm bench (added)",
    mechanism: "Polymerase active at room temperature extends primer-dimers before the run. Hydrolysis probes do not report dimers, so the curves stay clean: the lesson is that this error is invisible with probes and visible with intercalating dyes.",
    workbench: "Native: hotStart false, benchMin 240, ambientC 30 (dimer0 in R2.reagents.build).",
    missy: "B-M1 lower plateau; NTC curves (B-M5) in dimer-prone assays.",
    prepare/* @r2fn R2-C0032-F00094 */(c) { Object.assign(c.settings, { hotStart: false, benchMin: 240, ambientC: 30 }); } });
  add({ id: "re-mismatch", cat: "3", title: "Probe mismatch to the target variant (added)",
    mechanism: "One mismatch lowers the probe Tm: weaker binding at annealing, lower plateau, later Cq.",
    workbench: "Native: probeMismatch true.",
    missy: "B-M1 Probe signal strength, A-M1.",
    prepare/* @r2fn R2-C0032-F00095 */(c) { Object.assign(c.settings, { probeMismatch: true }); } });

  // ---------------- 4a. Configuration and set-up ----------------
  add({ id: "hu-anneal-high", cat: "4a", title: "Wrong thermal profile: annealing too high (68 °C)",
    mechanism: "Primers barely bind above their Tm: very late or no amplification.",
    workbench: "Native: annT 68 (Technician step 6 'Programme').",
    missy: "Results: controls fail → run invalid; SOP tab: different programme = different SOP.",
    prepare/* @r2fn R2-C0032-F00096 */(c) { c.f = Object.assign({}, c.f, { annT: 68 }); } });
  add({ id: "hu-anneal-low", cat: "4a", title: "Wrong thermal profile: annealing too low (50 °C)",
    mechanism: "Permissive priming: more primer-dimer and off-target product.",
    workbench: "Native: annT 50.",
    missy: "Results and SOP identity as above.",
    prepare/* @r2fn R2-C0032-F00097 */(c) { c.f = Object.assign({}, c.f, { annT: 50 }); } });
  add({ id: "hu-dye", cat: "4a", title: "Incorrect fluorophore selection (P-35S read on the wrong channel)",
    mechanism: "The software reads the YY channel for a FAM probe: the P-35S wells look flat.",
    workbench: "Injected: channel labels of the P-35S wells swapped in the record.",
    missy: "Results: P-35S not amplified in controls → run invalid; curve channel view.",
    kind: "injected",
    afterRun/* @r2fn R2-C0032-F00098 */(run, ctx) { const w = new Set(wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00099 */W => W.t.some(/* @r2fn R2-C0032-F00100 */t => /35S|ELE-00-012/.test(t.m)))); for (const o of run.record.optical) if (w.has(o.well)) o.channel = 1 - o.channel; } });
  add({ id: "hu-rotated", cat: "4a", title: "Plate loaded rotated 180°",
    mechanism: "Well A1 sits at P24: the camera reads empty positions where the plan expects reactions.",
    workbench: "Injected: well index w → 383 − w in the record.",
    missy: "Results: no amplification anywhere / controls missing → run invalid; plate heat map shows signal in the wrong corner.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00101 */(run) { for (const o of run.record.optical) o.well = 383 - o.well; } });
  add({ id: "hu-no-controls", cat: "4a", title: "Missing controls (NTC and extraction blank omitted)",
    mechanism: "Without negative controls, contamination cannot be excluded.",
    workbench: "Native: NTC and blank wells left empty on the plan (step 3 'Plate').",
    missy: "Native adapter (0.4.21): missing required controls → acceptance and calls withheld; B-M5 has no data.",
    prepare/* @r2fn R2-C0032-F00102 */(c) { c.plan = structuredClone(c.plan); c.plan.wells.forEach(/* @r2fn R2-C0032-F00103 */W => { if (W.role === "ntc") { W.role = "empty"; W.t = []; } }); } });
  add({ id: "hu-seal", cat: "4a", title: "Inadequate sealing (edge-well evaporation)",
    mechanism: "Edge wells lose water: concentrated dye raises their fluorescence through the run.",
    workbench: "Injected: edge-well readings ×(1 + 1.2 % per cycle). Native relative: lid temperature.",
    missy: "B-O3 Row / column pattern, baseline drift ('Early-cycle baseline drift'), A-H3b end-point.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00104 */(run, ctx) { scaleReads(run, wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00105 */(W, i) => isEdge(i)), /* @r2fn R2-C0032-F00106 */(v, o) => v * (1 + 0.012 * o.cycle)); } });
  add({ id: "hu-dna-amount", cat: "4a", title: "Wrong DNA amount (template 16 × too low) (added)",
    mechanism: "12.5 ng instead of 200 ng: reference gene later than Cq 27.",
    workbench: "Native: copies ×1/16 in the sample wells (Technician step 4 DNA amount / mix calculator).",
    missy: "Results: 'sample DNA not accepted: extract again'.",
    afterSimWells/* @r2fn R2-C0032-F00107 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00108 */W => W.role === "unknown")) sw.wells[i].copies /= 16; } });

  // ---------------- 4b. Pipetting and handling ----------------
  add({ id: "hu-bubbles", cat: "4b", title: "Air bubbles in wells",
    mechanism: "A bubble scatters light for one reading and then lenses it: a dip followed by a jump.",
    workbench: "Injected: one dip/jump pair per affected well (6 sample wells).",
    missy: "Results: odd curves, Cq confidence; OpticalCyclerB B-M9 Low Cq confidence.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00109 */(run, ctx) { spikes(run, pick(wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00110 */W => W.role === "unknown"), 6, new R2.Rng(ctx.seed)), new R2.Rng(ctx.seed + 1)); } });
  add({ id: "hu-pipetting", cat: "4b", title: "Pipetting volume inaccuracy (CV 30 %)",
    mechanism: "Uncalibrated pipette: template and mix volumes scatter from tube to tube.",
    workbench: "Native: reagent setting pipetCV 30 (percent; on top of the fitted natural variation).",
    missy: "B-O1 Replicate precision (pooled SD), OpticalCyclerB HIGHSD / OUTLIERRG flags; Results: replicate spread.",
    prepare/* @r2fn R2-C0032-F00111 */(c) { Object.assign(c.settings, { pipetCV: 30 }); } });
  add({ id: "hu-aerosol", cat: "4b", title: "Aerosol cross-contamination (amplicon carry-over, UNG off)",
    mechanism: "2 000 amplicon copies reach every tube; nothing destroys them.",
    workbench: "Native: carryover 2000, ungActive false (R2.reagents.build).",
    missy: "Results: NTC amplified → run invalid; B-M5 Negative controls, B-O5 Contamination rate by operator.",
    prepare/* @r2fn R2-C0032-F00112 */(c) { Object.assign(c.settings, { carryover: 2000, ungActive: false }); } });
  add({ id: "hu-mixing", cat: "4b", title: "Incomplete master-mix homogenisation (gradient across columns)",
    mechanism: "The mix was not vortexed: primer and enzyme concentration drift from the first to the last column dispensed.",
    workbench: "Native per-well inputs: primer ×(1.6 → 0.4) and efficiency ×(1 → 0.9) along the columns.",
    missy: "B-O3 Row / column pattern, B-O1 Replicate precision.",
    afterSimWells/* @r2fn R2-C0032-F00113 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00114 */() => true)) { const k = col(i) / 23, a = sw.wells[i]; a.primer_nM *= 1.6 - 1.2 * k; a.eff *= 1 - 0.1 * k; } } });
  add({ id: "hu-droplets", cat: "4b", title: "Droplets on well walls (template enters 4 cycles late)",
    mechanism: "Template hangs on the wall until condensation washes it down.",
    workbench: "Injected: curves of 3 sample wells shifted 4 cycles right.",
    missy: "Results: one replicate late (OUTLIERRG / HIGHSD in OpticalCyclerB), B-O1.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00115 */(run, ctx) { delayCurves(run, pick(wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00116 */W => W.role === "unknown"), 3, new R2.Rng(ctx.seed)), 4); } });
  add({ id: "hu-no-spin", cat: "4b", title: "Plate not centrifuged",
    mechanism: "Bubbles and droplets together in a quarter of the sample wells.",
    workbench: "Injected: bubbles and 3-cycle delays.",
    missy: "Results, B-O1, Cq confidence.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00117 */(run, ctx) { const w = pick(wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00118 */W => W.role === "unknown"), 8, new R2.Rng(ctx.seed)); delayCurves(run, w.slice(0, 4), 3); spikes(run, w.slice(4), new R2.Rng(ctx.seed + 2)); } });

  // ---------------- 4c. Interpretation ----------------
  add({ id: "in-nonsigmoid", cat: "4c", title: "Accepting non-sigmoidal curves (baseline creep in negatives)",
    mechanism: "NTC and blank drift upward linearly from cycle 15: a fixed threshold calls a 'Cq', the second-derivative method does not.",
    workbench: "Injected: linear creep in the NTC/blank wells. Compare Cq method 'threshold' and 'second derivative' in the Quality review.",
    missy: "Results with the profile's method; baseline drift chart; OpticalCyclerB EXPFAIL / CTFAIL flags.",
    kind: "injected", afterRun/* @r2fn R2-C0032-F00119 */(run, ctx) { const w = wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00120 */W => W.role === "ntc"); const base = ampReads(run, w).filter(/* @r2fn R2-C0032-F00121 */o => o.cycle === 5).map(net); const b = base.length ? base.reduce(/* @r2fn R2-C0032-F00122 */(s, v) => s + v, 0) / base.length : 400; linearCreep(run, w, 15, b * 0.012); } });
  add({ id: "in-efficiency", cat: "4c", title: "Ignoring amplification efficiency (event assay at 88 % of the reference efficiency)",
    mechanism: "Target and reference no longer amplify alike: the ΔCq-based GM % is biased although the calibrants look fine.",
    workbench: "Native per-well input: efficiency ×0.88 for the event assay wells (40-3-2 quantification).",
    missy: "B-M3 PCR efficiency from the standards (90–110 %), Results GM %.",
    choice: SOY_QUANT, afterSimWells/* @r2fn R2-C0032-F00123 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00124 */W => kindOf(W) === "event")) sw.wells[i].eff *= 0.88; } });
  add({ id: "in-highcq", cat: "4c", title: "Misinterpreting high Cq values (sample at 1/40 of the GM content)",
    mechanism: "Few target copies: stochastic Cq 36–40, some replicates empty.",
    workbench: "Native: element copies ×1/40 in the sample wells.",
    missy: "B-M10 Late signal / stochastic-zone results; Results: below LOD / extract again.",
    afterSimWells/* @r2fn R2-C0032-F00125 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00126 */W => W.role === "unknown" && element(W))) sw.wells[i].copies /= 40; } });
  add({ id: "in-blank", cat: "4c", title: "Overlooking extraction contamination (in place of gDNA in −RT controls)",
    mechanism: "The workbench is a DNA method (no reverse transcription); the analogous control is the extraction blank, here contaminated with 60 GM copies.",
    workbench: "Native: copies added to the extraction-blank wells.",
    missy: "Results: blank amplified → run invalid; B-M5 Negative controls by process stage.",
    afterSimWells/* @r2fn R2-C0032-F00127 */(sw, ctx) { for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00128 */W => W.ctl === "BLK")) sw.wells[i].copies += 60; } });
  add({ id: "in-refgene", cat: "4c", title: "Unstable reference gene (reference varies ±1.6 cycles by extract)",
    mechanism: "The reference target moves between extracts while the elements do not: normalisation adds error.",
    workbench: "Native per-well input: reference copies ×2^(±1.6) per sub-sample.",
    missy: "Results by extraction; reference-gene stability; B-O1.",
    afterSimWells/* @r2fn R2-C0032-F00129 */(sw, ctx) { const r = new R2.Rng(ctx.seed), sh = {}; for (const i of wellsWhere(ctx.plan, /* @r2fn R2-C0032-F00130 */W => W.role === "unknown" && taxon(W))) { const W = ctx.plan.wells[i], k = W.sampleNo + "/" + W.ext; if (sh[k] === undefined) sh[k] = 1.6 * (r.u() * 2 - 1); sw.wells[i].copies *= Math.pow(2, sh[k]); } } });

  F.LIST = L;
  F.get = /* @r2fn R2-C0032-F00131 */id => L.find(/* @r2fn R2-C0032-F00132 */s => s.id === id);
  F.CATEGORIES = { "1": "Hardware", "2": "Software (firmware and operating software)", "3": "Reagents and consumables", "4a": "Human: configuration and set-up", "4b": "Human: pipetting and handling", "4c": "Human: data interpretation" };
  F.runnable = /* @r2fn R2-C0032-F00133 */s => typeof s.prepare === "function" || typeof s.afterSimWells === "function" || typeof s.afterSetPlate === "function" || typeof s.afterRun === "function";
  F.validateSetup = /* @r2fn R2-C0032-F00134 */function(sc, bench) {
    if (!sc) return "";
    if (!F.runnable(sc)) return "This catalogue entry is a manual analysis exercise or is not reproducible by these assays.";
    const choice = sc.choice;
    if (choice) {
      const ids = new Set(bench.plan.tubes.flat());
      const sampleName = R2.GMO.samples.find(/* @r2fn R2-C0032-F00135 */sample=>sample.key===choice.sample)?.label || choice.sample;
      const assayNames = choice.assays.map(/* @r2fn R2-C0032-F00136 */id=>M(id).target || id).join(", ");
      if (bench.sampleKey !== choice.sample || bench.stage !== choice.stage || choice.assays.some(/* @r2fn R2-C0032-F00137 */id=>!ids.has(id)) ||
          choice.duplex && !bench.plan.tubes.some(/* @r2fn R2-C0032-F00138 */mix=>mix.includes(choice.assays[0]) && mix.includes(choice.assays[1])))
        return "Scenario requires " + sampleName + ", " + choice.stage + (choice.duplex ? ", duplex" : "") + ", assays " + assayNames + ". Restore that setup or disarm the scenario.";
    }
    if (sc.id === "in-blank" && !bench.plan.wells.some(/* @r2fn R2-C0032-F00139 */well=>well.ctl === "BLK")) return "This scenario requires extraction-blank wells. Select the simplex screening template or disarm it.";
    return "";
  };
  // ----- hooks -----
  F.prepare = /* @r2fn R2-C0032-F00140 */function (sc, c) { const out = { settings: Object.assign({}, c.settings), f: Object.assign({}, c.f), plan: c.plan, prog: c.prog }; if (sc && sc.prepare) sc.prepare(out); return out; };
  F.afterSimWells = /* @r2fn R2-C0032-F00141 */(sc, sw, ctx) => { if (sc && sc.afterSimWells) sc.afterSimWells(sw, ctx); };
  F.afterSetPlate = /* @r2fn R2-C0032-F00142 */(sc, ins, ctx) => { if (sc && sc.afterSetPlate) sc.afterSetPlate(ins, ctx); };
  F.afterRun = /* @r2fn R2-C0032-F00143 */function (sc, run, ctx) {
    if (!sc) return run;
    if (sc.afterRun) sc.afterRun(run, ctx);
    run.injectedFault = { id: sc.id, category: F.CATEGORIES[sc.cat], title: sc.title, kind: sc.kind, mechanism: sc.mechanism, seed: ctx.seed,
      note: sc.kind.includes("injected") ? "Raw readings transformed after acquisition by js/core/qpcr_faults.js; not simulated chemistry." : "Produced by the instrument model with changed inputs; model code unchanged." };
    return run;
  };
  // the scenario chosen for the next technician run (Administrator panel); null = normal run
  F.active = null;
})(window.R2);
