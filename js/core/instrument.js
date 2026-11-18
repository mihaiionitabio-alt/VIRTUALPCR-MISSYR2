/* The simulated instrument as one object: plant + firmware + the record of everything it reported.
 * The record keeps three tables (telemetry, optical, events) exactly as reported; analysis only reads them. */
(function (R2) {
  "use strict";
  // opts: { wells: 384, camera: true } for the technician plate; default the 16-tube R2 block of the engineer bench
  R2.Instrument = function (seed, opts) {
    this.seed = seed || 7; this.plant = new R2.Plant(this.seed, opts);
    this.rec = { telemetry: [], optical: [], events: [] };
    const rec = this.rec; this.onEvent = null; const self = this;
    this.fw = new R2.Firmware(this.plant, { telemetry: r => rec.telemetry.push(r), optical: r => rec.optical.push(r), event: r => { rec.events.push(r); if (self.onEvent) self.onEvent(r); } });
    this.chemLog = [];            // "X-ray" view: chemistry state once per second (a real instrument has no such signal)
  };
  const I = R2.Instrument.prototype;
  I.setPlate = function (wells) {           // wells: [{kind, copies, ...assay}] what is physically in the tubes
    wells.forEach((a, i) => { const w = this.plant.wells[i], b = Object.assign({}, a), second = b.second; delete b.second; w.a = Object.assign(R2.chem.assayDefaults(), b); w.a2 = second ? Object.assign(R2.chem.assayDefaults(), second) : null; });
    this.plant.loadWells();
  };
  I.injectFault = function (name, afterMs, forMs) { const p = this.plant; p.fault = name; p.faultAt = p.t + (afterMs || 0); p.faultEnd = forMs ? p.faultAt + forMs : 0; };
  I.clearFault = function () { const p = this.plant; if (p.fault === "lid_open") p.lidClosed = true; if (p.fault === "rails") p.railsOk = true; p.fault = null; };
  // advance by ms of instrument time (multiple of 10)
  I.advance = function (ms) {
    const p = this.plant, fw = this.fw;
    for (let k = 0; k < ms; k += 10) {
      const hang = p.faultActive("fw_hang"), run = p.faultActive("fw_runaway");
      if (!hang && !run) fw.tick();
      else if (run) { p.fwEnable = true; p.duty = [1, 1]; p.kick(); }          // firmware ignores everything and keeps serving the watchdog
      for (let i = 0; i < 10; i++) p.stepMs();
      if (p.t % (p.NW > 16 ? 10000 : 1000) === 0 && (fw.running() || hang || run)) this.logChem();   // 384-well plate: every 10 s, occupied wells only
    }
  };
  I.logChem = function () {
    const p = this.plant, fw = this.fw;
    const row = { t_ms: p.t, liquid_c: [...p.Ts], wells: [],
      plant: {
        block_c: [...p.Tb], lid_c: p.Tlid, sink_c: p.Ths, ambient_c: p.Tamb,
        tec_mA: [...p.iTec], lid_mA: p.iLid, watchdog_ok: p.wdtOk, watchdog_age_ms: p.t - p.lastKick,
        enable_request: p.fwEnable, overtemperature_test: p.otTest, hardware_trip: p.hwTrip,
        selected_well: p.sel, led_drive: p.led
      },
      control: {
        destination_c: fw.target, setpoint_c: fw.sp, maximum_ramp_c_per_s: fw.ramp,
        at_target: fw.atTarget, lid_integral: fw.lidInteg, zone_integrals: fw.pid.map(pid => pid.integ),
        zone_filtered_derivatives: fw.pid.map(pid => pid.dF)
      } };
    for (let w = 0; w < p.wells.length; w++) {
      const well = p.wells[w]; if (p.NW > 16 && well.a.kind === "empty") continue;
      const snapshot = R2.chem.snapshot(well.ch, well.a); snapshot.well = w;
      if (well.pr) snapshot.probe = p.probeState(w, false);
      if (well.ch2) {
        snapshot.second = R2.chem.snapshot(well.ch2, well.a2);
        if (well.pr2) snapshot.second.probe = p.probeState(w, true);
      }
      row.wells.push(snapshot);
    }
    this.chemLog.push(row);
  };
  I.state = function () { return this.fw.st; };
  // estimated duration of a protocol in seconds (for the progress bar): holds + ramps at 2.5 °C/s + reads
  R2.estimateSeconds = function (prog) {
    let t = 75, last = 25;
    for (const s of prog.stages) {
      if (s.type === "melt") { t += Math.abs(s.from_c - last) / 2.5 + (s.to_c - s.from_c) / s.rate_c_per_s + 5; last = s.to_c; continue; }
      for (let cy = 1; cy <= (s.repeats || 1); cy++) for (let k = 0; k < s.steps.length; k++) {
        const T = R2.Firmware.prototype.stepTemp(s, k, cy), r = s.steps[k].ramp_c_per_s || 2.5;
        t += Math.abs(T - last) / Math.min(r, 2.5) + 2 + R2.Firmware.prototype.stepHold(s, k, cy); last = T;
      }
    }
    return t;
  };
})(window.R2);
