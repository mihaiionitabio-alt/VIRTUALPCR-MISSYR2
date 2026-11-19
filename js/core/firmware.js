/* Controller behaviour: JavaScript port of the R2 firmware core (firmware/src/app.c, safety.c, optics.c, util.c).
 * 10 ms tick: read, check, state machine, PID, plate read, outputs, records, watchdog. */
(/* @r2fn R2-C0025-F00001 */function (R2) {
  "use strict";
  const TICK = 10, NW = 16, SETTLE = 20, INTEG = 100, PLATE_MS = NW * (SETTLE + INTEG), CAMERA_MS = SETTLE + INTEG, MELT_SCAN_MS = 2000;   // camera: one exposure every 2 s in the melt = 5 per °C at 0.1 °C/s, as the OpticalCyclerA templates (AcqPerDegree 5)
  R2.CFG = /* @r2fn R2-C0025-F00002 */() => ({ kp: 0.55, ki: 0.25, kd: 0.06, dTau: 0.08, ffHeat: 0.0045, ffCool: 0.0065, band: 0.5, dwellMs: 500, rampTimeoutMs: 120000,
    lidKp: 0.25, lidKi: 0.02, lidBand: 2, lidTimeoutMs: 600000, fanMin: 0.3, fanLo: 35, fanHi: 55,
    blockMax: 103, blockMin: -5, lidMax: 120, hsMax: 80, limitN: 2, zoneMis: 6, zoneMisMs: 5000, refMis: 4, refMisMs: 8000,
    iMin: 300, iMax: 9000, iMs: 1000, rpmMin: 600, stallMs: 3000, maxRamp: 5, telemetryMs: 100, ledCode: 128 });

  /* @r2fn R2-C0025-F00003 */function Pid() { this.reset(); }
  Pid.prototype.reset = /* @r2fn R2-C0025-F00004 */function () { this.integ = 0; this.dF = 0; this.prev = 0; this.init = false; };
  Pid.prototype.step = /* @r2fn R2-C0025-F00005 */function (c, sp, meas, dt, ff) {
    if (!this.init) { this.prev = meas; this.init = true; }
    const e = sp - meas, dRaw = (meas - this.prev) / dt; this.prev = meas;
    this.dF += (dRaw - this.dF) * dt / (c.dTau + dt);
    const un = ff + c.kp * e + this.integ - c.kd * this.dF, u = R2.clamp(un, -1, 1);
    if (u === un || (un > 1 && e < 0) || (un < -1 && e > 0)) this.integ += c.ki * e * dt;
    return u;
  };
  R2.Pid = Pid;

  R2.Firmware = /* @r2fn R2-C0025-F00006 */function (plant, log) {
    this.p = plant; this.NW = plant.NW || NW; this.camera = !!plant.camera; this.plateMs = this.camera ? CAMERA_MS : this.NW * (SETTLE + INTEG); this.cfg = R2.CFG(); this.log = log; this.st = "IDLE"; this.seq = 0; this.fault = null;
    this.pid = [new Pid(), new Pid()]; this.out = { enable: false, tec: [0, 0], lid: 0, fan: 0 };
    this.m = { t: [25, 25, 25, 25, 25], iTec: [0, 0], rpm: 0, lid: true, rails: true, trip: false, enRb: false };
    this.prog = null; this.lidOn = false; this.lidSp = 0; this.lidInteg = 0; this.sp = 25; this.target = 25; this.ramp = 0;
    this.iStage = 0; this.iStep = 0; this.iCycle = 0; this.acq = 0; this.meltIdx = 0; this.tState = 0; this.tLastTm = -1e9;
    this.opt = { busy: false }; this.safety = {}; this.lidWasOpen = false;
    this.event("BOOT", 0, 2, 0);
  };
  const F = R2.Firmware.prototype;
  F.now = /* @r2fn R2-C0025-F00007 */function () { return this.p.t; };
  F.event = /* @r2fn R2-C0025-F00008 */function (code, sev, a, b) { this.log.event({ seq: this.seq++, t_ms: this.now(), code, severity: sev, a: a || 0, b: b || 0 }); };
  F.enter = /* @r2fn R2-C0025-F00009 */function (s) { this.st = s; this.tState = this.now(); };
  F.outputsOff = /* @r2fn R2-C0025-F00010 */function () { this.out.enable = false; this.out.tec = [0, 0]; this.out.lid = 0; this.lidOn = false; this.opt.busy = false; this.p.select(-1, 0); };
  F.doFault = /* @r2fn R2-C0025-F00011 */function (code, a, b) { this.outputsOff(); this.fault = code; this.event(code, 2, a, b); this.event("RUN_ABORTED", 1, 0, 0); this.enter("FAULT"); };

  // ---- protocol: same JSON as the instrument software (stages of steps, melt), with the options of the source software
  F.stepTemp = /* @r2fn R2-C0025-F00012 */(s, k, cy) => { let t = s.steps[k].temp_c; const d0 = s.auto_delta_start_cycle === undefined ? 1 : s.auto_delta_start_cycle; if (cy > d0) t += (s.steps[k].delta_temp_c || 0) * (cy - d0); return R2.clamp(t, 4, 100); };
  F.stepHold = /* @r2fn R2-C0025-F00013 */(s, k, cy) => { let h = s.steps[k].hold_s; const d0 = s.auto_delta_start_cycle === undefined ? 1 : s.auto_delta_start_cycle; if (cy > d0) h += (s.steps[k].delta_hold_s || 0) * (cy - d0); return Math.max(0, h); };
  F.validate = /* @r2fn R2-C0025-F00014 */function (p) {
    if (!p || !p.stages || !p.stages.length) return "protocol has no stages";
    if (p.lid_c < 0 || p.lid_c > 110) return "lid temperature outside 0–110 °C";
    for (let i = 0; i < p.stages.length; i++) {
      const s = p.stages[i];
      if (s.type === "melt") { if (!(s.from_c >= 4 && s.to_c <= 100 && s.to_c > s.from_c)) return "melt range"; if (!(s.rate_c_per_s >= 0.01 && s.rate_c_per_s <= 1)) return "melt rate outside 0.01–1 °C/s"; continue; }
      const rep = s.repeats || 1; if (rep < 1 || rep > 99 || !s.steps || !s.steps.length) return "stage " + (i + 1) + ": repeats or steps";
      for (let k = 0; k < s.steps.length; k++) {
        const q = s.steps[k], last = i === p.stages.length - 1 && k === s.steps.length - 1;
        if (!(q.temp_c >= 4 && q.temp_c <= 100)) return "temperature " + q.temp_c + " °C outside 4–100 °C";
        if (q.hold_s < 0 || q.hold_s > 3600) return "hold time outside 0–3600 s";
        if (q.pause && q.read) return "a pause step cannot also read";
        if (q.hold_s === 0 && !q.pause && !(last && rep === 1)) return "only the final step may have no hold time";
        const plateMs = (this && this.plateMs) || PLATE_MS;
        for (let cy = 1; cy <= rep; cy++) if (q.read && F.stepHold(s, k, cy) * 1000 < plateMs) return "a plate read takes " + plateMs / 1000 + " s and must fit inside its hold";
      }
    }
    return null;
  };
  F.start = /* @r2fn R2-C0025-F00015 */function (prog, runId) {
    if (this.st !== "IDLE") return "busy";
    const err = this.validate(prog); if (err) return "invalid: " + err;
    this.read(); if (!this.m.lid) return "lid open";
    if (this.fault) return "fault not cleared";
    this.prog = prog; this.runId = runId; this.iStage = 0; this.acq = 0; this.lidSp = prog.lid_c || 0; this.lidOn = this.lidSp > 0; this.lidInteg = 0;
    this.pid.forEach(/* @r2fn R2-C0025-F00016 */x => x.reset()); this.safety = {};
    this.out.enable = true; this.event("RUN_START", 0, 0, 0);
    this.selftest = 0; this.p.otTest = true; this.enter("SELFTEST");      // proof test of the hardware chain before any heat
    return "ok";
  };
  F.abort = /* @r2fn R2-C0025-F00017 */function () { if (["IDLE", "DONE", "ABORTED", "FAULT"].includes(this.st)) return "idle"; this.outputsOff(); this.event("RUN_ABORTED", 1, 0, 0); this.enter("ABORTED"); return "ok"; };
  F.clear = /* @r2fn R2-C0025-F00018 */function () { if (this.st !== "FAULT") return "nofault"; this.p.clearTrip(); this.read(); if (this.p.hwTrip) return "trip persists"; this.fault = null; this.event("FAULT_CLEARED", 0, 0, 0); this.enter("IDLE"); return "ok"; };
  F.resume = /* @r2fn R2-C0025-F00019 */function () { if (this.st !== "PAUSED") return "not paused"; if (!this.m.lid) return "lid open"; this.event("RESUMED", 0, 0, 0); this.nextStep(); return "ok"; };
  F.stop = /* @r2fn R2-C0025-F00020 */function () { if (this.st !== "HOLD_FOREVER") return "not holding"; this.finish(); return "ok"; };

  F.stage = /* @r2fn R2-C0025-F00021 */function () { return this.prog.stages[this.iStage]; };
  F.startStep = /* @r2fn R2-C0025-F00022 */function () {
    const s = this.stage(), q = s.steps[this.iStep];
    this.target = this.stepTemp(s, this.iStep, this.iCycle); this.holdMs = this.stepHold(s, this.iStep, this.iCycle) * 1000; this.stepRead = !!q.read;
    this.ramp = Math.min(q.ramp_c_per_s || 0, this.cfg.maxRamp); if (this.ramp <= 0) { this.ramp = 0; this.sp = this.target; }
    this.stepPause = !!q.pause; this.stepForever = q.hold_s === 0 && !q.pause;
    this.atTarget = false; this.tAt = 0; this.readStarted = this.readDone = false; this.peakErr = 0;
    this.event("STEP_START", 0, this.iStage * 100 + this.iStep, this.iCycle); this.enter("RAMP");
  };
  F.startStage = /* @r2fn R2-C0025-F00023 */function () {
    const s = this.stage(); this.event("STAGE_START", 0, this.iStage, s.type === "melt" ? 77 : 67); this.iStep = 0; this.iCycle = 1;
    if (s.type === "melt") { this.target = s.from_c; this.sp = this.target; this.ramp = 0; this.atTarget = false; this.tAt = 0; this.meltIdx = 0; this.readStarted = false; this.enter("MELT_GOTO"); }
    else this.startStep();
  };
  F.finish = /* @r2fn R2-C0025-F00024 */function () { this.outputsOff(); this.event("RUN_COMPLETE", 0, this.acq, 0); this.enter("DONE"); };
  F.nextStage = /* @r2fn R2-C0025-F00025 */function () { if (++this.iStage >= this.prog.stages.length) this.finish(); else this.startStage(); };
  F.nextStep = /* @r2fn R2-C0025-F00026 */function () {
    const s = this.stage(); this.event("STEP_END", 0, this.iStage * 100 + this.iStep, this.iCycle);
    if (++this.iStep < s.steps.length) return this.startStep();
    this.iStep = 0; if (++this.iCycle <= (s.repeats || 1)) return this.startStep();
    this.nextStage();
  };

  // ---- inputs and checks
  F.read = /* @r2fn R2-C0025-F00027 */function () {
    const p = this.p, m = this.m; m.t = p.readSensors();
    for (let z = 0; z < 2; z++) m.iTec[z] = p.iTec[z] * (1 + 0.01 * p.rng.gauss());
    m.rpm = p.fanRpm; m.lid = p.lidClosed; m.rails = p.railsOk; m.trip = p.hwTrip; m.enRb = p.hwEnable();
  };
  F.held = /* @r2fn R2-C0025-F00028 */function (key, cond, ms) { const s = this.safety, now = this.now(); if (!cond) { s[key] = 0; return false; } if (!s[key]) s[key] = now || 1; return now - s[key] >= ms; };
  F.check = /* @r2fn R2-C0025-F00029 */function () {
    const m = this.m, c = this.cfg, o = this.out, s = this.safety;
    for (let i = 0; i < 5; i++) { if (Number.isNaN(m.t[i])) return "F_SENSOR_OPEN"; if (m.t[i] === -Infinity) return "F_SENSOR_SHORT"; }
    if (!m.rails) return "F_RAILS";
    if (m.trip) return "F_HW_TRIP";
    const bmax = Math.max(m.t[0], m.t[1], m.t[4]), bmin = Math.min(m.t[0], m.t[1]);
    s.nB = (bmax > c.blockMax || bmin < c.blockMin) ? (s.nB || 0) + 1 : 0; s.nL = m.t[2] > c.lidMax ? (s.nL || 0) + 1 : 0; s.nH = m.t[3] > c.hsMax ? (s.nH || 0) + 1 : 0;
    if (s.nB >= c.limitN) return "F_BLOCK_LIMIT"; if (s.nL >= c.limitN) return "F_LID_LIMIT"; if (s.nH >= c.limitN) return "F_HS_LIMIT";
    if (this.held("zone", Math.abs(m.t[0] - m.t[1]) > c.zoneMis, c.zoneMisMs)) return "F_ZONE_MISMATCH";
    if (this.held("ref", Math.abs(m.t[4] - 0.5 * (m.t[0] + m.t[1])) > c.refMis, c.refMisMs)) return "F_REF_MISMATCH";
    for (let z = 0; z < 2; z++) {
      if (this.held("io" + z, o.enable && Math.abs(o.tec[z]) > 0.3 && m.iTec[z] < c.iMin, c.iMs)) return "F_TEC_OPEN";
      if (m.iTec[z] > c.iMax) return "F_TEC_OVERCURRENT";
    }
    if (this.held("fan", o.fan > 0.2 && m.rpm < c.rpmMin, c.stallMs)) return "F_FAN_STALL";
    if (this.held("en", o.enable && !m.enRb && m.lid, 300)) return "F_ENABLE_MISMATCH";
    return null;
  };

  // ---- plate read (optics.c): per well 20 settle + 100 integration periods, integer sums
  F.beginWell = /* @r2fn R2-C0025-F00030 */function (w) { const o = this.opt; o.well = w; o.phase = 0; o.on = [0, 0]; o.off = [0, 0]; o.sq = [0, 0]; o.min = [1e9, 1e9]; o.max = [-1e9, -1e9]; o.sat = [0, 0]; o.rOn = 0; o.rOff = 0; this.p.select(w, this.cfg.ledCode); };
  F.startRead = /* @r2fn R2-C0025-F00031 */function (kind) { this.opt = { busy: true, kind, acq: ++this.acq, stage: this.iStage, step: this.iStep, cycle: kind === "M" ? this.meltIdx : this.iCycle }; this.event("READ_START", 0, this.acq, this.opt.cycle); this.readStarted = true; this.lastRead = this.now();
    if (this.camera) { const o = this.opt, wells = []; for (let w = 0; w < this.NW; w++) if (this.p.wells[w].a.kind !== "empty") wells.push(w);
      o.wells = wells; o.phase = 0; o.acc = wells.map(/* @r2fn R2-C0025-F00032 */() => ({ on: [0, 0], off: [0, 0], sq: [0, 0], min: [1e9, 1e9], max: [-1e9, -1e9], sat: [0, 0] })); o.rOn = 0; o.rOff = 0; o.well = -1; this.p.illuminate(this.cfg.ledCode, wells); return; }
    this.beginWell(0); };
  // camera exposure: settle, then integrate every occupied well over the same chop periods; one record per well and channel
  F.cameraTick = /* @r2fn R2-C0025-F00033 */function () {
    const o = this.opt;
    for (let k = 0; k < TICK && o.busy; k++) {
      if (o.phase === SETTLE) { o.t0 = this.now() + k; o.tz0 = [this.m.t[0], this.m.t[1]]; }
      if (o.phase >= SETTLE) { o.wells.forEach(/* @r2fn R2-C0025-F00034 */(w, i) => { const p = this.p.opticsPeriodWell(w), a = o.acc[i];
          for (let c = 0; c < 2; c++) { const net = p.on[c] - p.off[c]; a.on[c] += p.on[c]; a.off[c] += p.off[c]; a.sq[c] += net * net; if (net < a.min[c]) a.min[c] = net; if (net > a.max[c]) a.max[c] = net; a.sat[c] += p.sat[c]; } });
        const r = this.p.opticsReference(); o.rOn += r.on; o.rOff += r.off; }
      if (++o.phase === SETTLE + INTEG) {
        o.wells.forEach(/* @r2fn R2-C0025-F00035 */(w, i) => { const a = o.acc[i], z = this.p.zoneOf(w); for (let c = 0; c < 2; c++) this.log.optical({ seq: this.seq++, t_start_ms: o.t0, t_end_ms: this.now() + k + 1, kind: o.kind, acq: o.acq, stage: o.stage, step: o.step, cycle: o.cycle,
          well: w, channel: c, periods: INTEG, sum_on: a.on[c], sum_off: a.off[c], sumsq_net: a.sq[c], min_net: a.min[c], max_net: a.max[c], sat_samples: a.sat[c],
          ref_sum_on: o.rOn, ref_sum_off: o.rOff, tzone_start_mC: Math.round(o.tz0[z] * 1000), tzone_end_mC: Math.round(this.m.t[z] * 1000) }); });
        o.busy = false; this.p.darken();
      }
    }
  };
  F.opticsTick = /* @r2fn R2-C0025-F00036 */function () {
    const o = this.opt; if (!o.busy) return; if (this.camera) return this.cameraTick();
    for (let k = 0; k < TICK && o.busy; k++) {
      const p = this.p.opticsPeriod(), zone = this.p.zoneOf(o.well);
      if (o.phase === SETTLE) { o.t0 = this.now() + k; o.tz0 = this.m.t[zone]; }
      if (o.phase >= SETTLE) {
        for (let c = 0; c < 2; c++) { const net = p.on[c] - p.off[c]; o.on[c] += p.on[c]; o.off[c] += p.off[c]; o.sq[c] += net * net; if (net < o.min[c]) o.min[c] = net; if (net > o.max[c]) o.max[c] = net; o.sat[c] += p.sat[c]; }
        o.rOn += p.refOn; o.rOff += p.refOff;
      }
      if (++o.phase === SETTLE + INTEG) {
        for (let c = 0; c < 2; c++) this.log.optical({ seq: this.seq++, t_start_ms: o.t0, t_end_ms: this.now() + k + 1, kind: o.kind, acq: o.acq, stage: o.stage, step: o.step, cycle: o.cycle,
          well: o.well, channel: c, periods: INTEG, sum_on: o.on[c], sum_off: o.off[c], sumsq_net: o.sq[c], min_net: o.min[c], max_net: o.max[c], sat_samples: o.sat[c],
          ref_sum_on: o.rOn, ref_sum_off: o.rOff, tzone_start_mC: Math.round(o.tz0 * 1000), tzone_end_mC: Math.round(this.m.t[zone] * 1000) });
        if (o.well + 1 < this.NW) this.beginWell(o.well + 1); else { o.busy = false; this.p.select(-1, 0); }
      }
    }
  };

  // ---- state machine, control, outputs
  F.within = /* @r2fn R2-C0025-F00037 */function (b) { return Math.abs(this.m.t[0] - this.target) < b && Math.abs(this.m.t[1] - this.target) < b; };
  F.executor = /* @r2fn R2-C0025-F00038 */function () {
    const c = this.cfg, now = this.now(), m = this.m;
    switch (this.st) {
      case "SELFTEST":
        if (this.selftest === 0 && now - this.tState >= 50) {
          if (!m.trip || m.enRb) { this.p.otTest = false; return this.doFault("F_SELFTEST", m.trip ? 1 : 0, m.enRb ? 1 : 0); }
          this.p.otTest = false; this.p.clearTrip(); this.selftest = 1; this.tState = now;
        } else if (this.selftest === 1 && now - this.tState >= 50) {
          if (m.trip || !m.enRb) return this.doFault("F_SELFTEST", 10 + (m.trip ? 1 : 0), m.enRb ? 1 : 0);
          this.event("SELFTEST_OK", 0, 0, 0); this.safety = {};
          if (this.lidOn) this.enter("LID_PREHEAT"); else this.startStage();
        }
        break;
      case "LID_PREHEAT":
        if (Math.abs(m.t[2] - this.lidSp) < c.lidBand) { this.event("LID_READY", 0, Math.round(m.t[2] * 1000), now - this.tState); this.startStage(); }
        else if (now - this.tState > c.lidTimeoutMs) this.doFault("F_LID_TIMEOUT", Math.round(m.t[2] * 1000), 0);
        break;
      case "RAMP": case "MELT_GOTO": {
        const inb = this.within(c.band) && Math.abs(this.sp - this.target) < 1e-3;
        if (!inb) this.tAt = 0; else if (!this.tAt) this.tAt = now || 1;
        if (inb && now - this.tAt >= c.dwellMs) {
          this.event("TARGET_REACHED", 0, Math.round(this.target * 1000), now - this.tState); this.tHold = now; this.atTarget = true;
          if (this.st === "RAMP" && this.stepPause) { this.event("PAUSED", 0, 0, 0); this.enter("PAUSED"); }
          else if (this.st === "RAMP" && this.stepForever) { this.event("HOLDING", 0, Math.round(this.target * 1000), 0); this.enter("HOLD_FOREVER"); }
          else if (this.st === "RAMP") this.enter("HOLD");
          else { const g = this.stage(); this.event("MELT_START", 0, g.from_c * 1000, g.to_c * 1000); this.target = g.to_c; this.ramp = g.rate_c_per_s; this.enter("MELT"); }
        } else if (now - this.tState > c.rampTimeoutMs) this.doFault("F_RAMP_TIMEOUT", Math.round(this.target * 1000), Math.round(m.t[0] * 1000));
        break; }
      case "HOLD": {
        const e = Math.max(Math.abs(m.t[0] - this.target), Math.abs(m.t[1] - this.target)); if (e > this.peakErr) this.peakErr = e;
        const el = now - this.tHold;
        if (this.stepRead && !this.readStarted && el + this.plateMs >= this.holdMs) this.startRead("A");
        if (this.readStarted && !this.readDone && !this.opt.busy) { this.readDone = true; this.event("READ_END", 0, this.acq, Math.round(this.peakErr * 1000)); }
        if (el >= this.holdMs && (!this.stepRead || this.readDone)) this.nextStep();
        break; }
      case "MELT":
        if (!this.opt.busy) {
          if (this.readStarted) { this.event("READ_END", 0, this.acq, this.meltIdx); this.readStarted = false; this.meltIdx++; }
          if (Math.abs(this.sp - this.target) < 1e-3) { this.event("MELT_END", 0, this.meltIdx, 0); this.nextStage(); } else if (!this.camera || now - (this.lastRead || 0) >= MELT_SCAN_MS) this.startRead("M");
        }
        break;
      case "DONE": case "ABORTED": if (now - this.tState > 200) this.enter("IDLE"); break;
    }
  };
  F.control = /* @r2fn R2-C0025-F00039 */function () {
    const c = this.cfg, m = this.m, o = this.out, dt = TICK / 1000, st = this.st;
    if (st === "SELFTEST") { o.tec = [0, 0]; o.lid = 0; o.fan = c.fanMin; return; }
    const active = ["RAMP", "HOLD", "MELT_GOTO", "MELT", "PAUSED", "HOLD_FOREVER"].includes(st) && m.lid;
    if (active) {
      if (this.ramp > 0) { const d = this.target - this.sp, lim = this.ramp * dt; this.sp += R2.clamp(d, -lim, lim); } else if (st !== "MELT") this.sp = this.target;
      for (let z = 0; z < 2; z++) { const dth = this.sp - m.t[3]; o.tec[z] = this.pid[z].step(c, this.sp, m.t[z], dt, dth * (dth > 0 ? c.ffHeat : c.ffCool)); }
    } else { o.tec = [0, 0]; this.pid.forEach(/* @r2fn R2-C0025-F00040 */x => x.reset()); }
    if (this.lidOn && m.lid) { const e = this.lidSp - m.t[2]; let u = c.lidKp * e + this.lidInteg; if (u > 1) u = 1; else if (u < 0) u = 0; else this.lidInteg += c.lidKi * e * dt; if (this.lidInteg < 0) this.lidInteg = 0; o.lid = u; } else o.lid = 0;
    const f = (m.t[3] - c.fanLo) / (c.fanHi - c.fanLo); o.fan = st === "FAULT" ? 1 : R2.clamp(f, c.fanMin, 1);
    if (["IDLE", "DONE", "ABORTED"].includes(st)) o.fan = m.t[3] > c.fanLo ? o.fan : 0;
  };
  F.apply = /* @r2fn R2-C0025-F00041 */function () { const p = this.p, o = this.out; p.fwEnable = o.enable; p.duty = o.enable ? o.tec.slice() : [0, 0]; p.lidDuty = o.enable ? o.lid : 0; p.fan = o.fan; };
  F.telemetry = /* @r2fn R2-C0025-F00042 */function () {
    const now = this.now(); if (now - this.tLastTm < this.cfg.telemetryMs) return; this.tLastTm = now; const m = this.m, o = this.out;
    this.log.telemetry({ seq: this.seq++, t_ms: now, state: this.st, stage: this.iStage, step: this.iStep, cycle: this.iCycle, setpoint_c: this.sp, zone1_c: m.t[0], zone2_c: m.t[1], lid_c: m.t[2],
      heatsink_c: m.t[3], ref_c: m.t[4], duty1: o.tec[0], duty2: o.tec[1], lid_duty: o.lid, fan_duty: o.fan, i_tec1_mA: m.iTec[0], i_tec2_mA: m.iTec[1], fan_rpm: m.rpm,
      enable: m.enRb ? 1 : 0, lid_closed: m.lid ? 1 : 0, hw_trip: m.trip ? 1 : 0, rails_ok: m.rails ? 1 : 0, optics_busy: this.opt.busy ? 1 : 0 });
  };
  F.running = /* @r2fn R2-C0025-F00043 */function () { return !["IDLE", "DONE", "ABORTED", "FAULT"].includes(this.st); };
  F.tick = /* @r2fn R2-C0025-F00044 */function () {
    this.read();
    if (this.st !== "FAULT" && this.st !== "SELFTEST") {
      const e = this.check();
      if (e) this.doFault(e, Math.round((isFinite(this.m.t[0]) ? this.m.t[0] : -999) * 1000), Math.round(this.m.t[1] * 1000));
      else if (this.running() && !this.m.lid) {
        if (this.st === "PAUSED") { if (!this.lidWasOpen) { this.event("LID_OPENED", 0, 0, 0); this.lidWasOpen = true; } }
        else if (this.st === "HOLD_FOREVER") { this.event("LID_OPENED", 0, 0, 0); this.finish(); }
        else { this.outputsOff(); this.event("LID_OPENED", 1, 0, 0); this.event("RUN_ABORTED", 1, 0, 0); this.enter("ABORTED"); }
      } else if (this.m.lid) this.lidWasOpen = false;
    }
    if (this.st !== "FAULT") this.executor();
    this.control(); this.opticsTick(); this.apply(); this.telemetry(); this.p.kick();
  };
  R2.Firmware.PLATE_MS = PLATE_MS; R2.Firmware.CAMERA_MS = CAMERA_MS;
  R2.Firmware.validateFor = /* @r2fn R2-C0025-F00045 */(prog, plateMs) => F.validate.call({ plateMs }, prog); R2.Firmware.TICK = TICK;
})(window.R2);
