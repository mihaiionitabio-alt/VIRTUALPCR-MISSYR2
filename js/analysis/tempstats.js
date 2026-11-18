/* Temperature statistics of a run, from the telemetry record: per programme step the measured hold temperature,
 * its scatter and largest error, overshoot on arrival, and the ramp rate and time before it; plus lid, heat sink and zones. */
(function (R2) {
  "use strict";
  R2.tempStats = function (tm, prog) {
    const steps = new Map(), key = r => r.stage + "." + r.step, out = { steps: [], zoneDiffMax: 0, blockMax: -1e9, hsMax: -1e9, lid: { n: 0, s: 0, s2: 0 }, cycleMs: [] };
    let ramp = null, lastCycle = null, cycleT0 = null;
    const get = r => { let s = steps.get(key(r)); if (!s) { const st = prog.stages[r.stage] || {}, sp = st.steps ? st.steps[r.step] : null; s = { stage: r.stage, step: r.step, type: st.type, target: sp ? sp.temp_c : r.setpoint_c, n: 0, s: 0, s2: 0, min: 1e9, max: -1e9, err: 0, over: 0, ramps: [], holds: 0, dir: 0, perCycle: [] }; steps.set(key(r), s); } return s; };
    for (let i = 0; i < tm.length; i++) { const r = tm[i]; out.blockMax = Math.max(out.blockMax, r.zone1_c, r.zone2_c); out.hsMax = Math.max(out.hsMax, r.heatsink_c); if (r.lid_duty !== undefined && r.state !== "LID_PREHEAT" && r.state !== "SELFTEST") { out.lid.n++; out.lid.s += r.lid_c; out.lid.s2 += r.lid_c * r.lid_c; }
      const st = prog.stages[r.stage]; if (!st || st.type === "melt" || !["RAMP", "HOLD"].includes(r.state)) { ramp = null; continue; }
      if (st.type === "cycle" && r.step === 0 && r.state === "RAMP" && r.cycle !== lastCycle) { if (cycleT0 !== null) out.cycleMs.push(r.t_ms - cycleT0); cycleT0 = r.t_ms; lastCycle = r.cycle; }
      const s = get(r);
      if (r.state === "RAMP") { if (!ramp || ramp.k !== key(r) || ramp.c !== r.cycle) ramp = { k: key(r), c: r.cycle, t0: r.t_ms, T0: r.zone1_c }; ramp.t1 = r.t_ms; ramp.T1 = r.zone1_c; continue; }
      if (ramp && ramp.k === key(r)) { const dt = (ramp.t1 - ramp.t0) / 1000 + 0.1, dT = s.target - ramp.T0; if (Math.abs(dT) > 2) { s.ramps.push({ s: dt, rate: Math.abs(dT) / dt }); s.dir = Math.sign(dT); } ramp = null; s.holds++; s.cur = { n: 0, s: 0 }; s.perCycle.push(s.cur); }
      if (!s.cur) { s.cur = { n: 0, s: 0 }; s.perCycle.push(s.cur); s.holds++; }
      const T = r.zone1_c, e = T - s.target; s.n++; s.s += T; s.s2 += T * T; s.min = Math.min(s.min, T); s.max = Math.max(s.max, T); s.err = Math.max(s.err, Math.abs(e)); s.cur.n++; s.cur.s += T; s.cur.c = r.cycle;
      if (s.dir && e * s.dir > s.over) s.over = e * s.dir; out.zoneDiffMax = Math.max(out.zoneDiffMax, Math.abs(r.zone1_c - r.zone2_c));
    }
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    for (const s of steps.values()) { if (!s.n) continue; const mean = s.s / s.n; out.steps.push({ stage: s.stage, step: s.step, type: s.type, target: s.target, holds: s.holds, mean, sd: Math.sqrt(Math.max(0, s.s2 / s.n - mean * mean)), min: s.min, max: s.max, maxErr: s.err, overshoot: s.over, dir: s.dir, rampRate: avg(s.ramps.map(r => r.rate)), rampS: avg(s.ramps.map(r => r.s)), holdS: s.n / 10 / Math.max(1, s.holds), perCycle: s.perCycle.filter(c => c.n).map(c => ({ cycle: c.c, mean: c.s / c.n })) }); }
    out.steps.sort((a, b) => a.stage - b.stage || a.step - b.step);
    out.lidMean = out.lid.n ? out.lid.s / out.lid.n : NaN; out.lidSd = out.lid.n ? Math.sqrt(Math.max(0, out.lid.s2 / out.lid.n - out.lidMean * out.lidMean)) : NaN; out.cycleS = avg(out.cycleMs) / 1000;
    return out;
  };
  R2.tempStatsLabel = s => s.type === "hold" ? (s.target < 70 ? "UNG step" : "Activation") : s.type === "cycle" ? (s.step === 0 ? "Denaturation" : s.step === 2 ? "Extension" : "Annealing/extension") : "Step";
  R2.tempStatsTable = st => `<tr><th class="l">Step</th><th>Target</th><th>Mean in holds</th><th>SD</th><th>Min to max</th><th>Largest error</th><th>Overshoot</th><th>Ramp before</th><th>Ramp time</th><th>Holds</th></tr>` +
    st.steps.map(s => `<tr><td class="l">${R2.tempStatsLabel(s)}</td><td>${s.target.toFixed(1)} °C</td><td>${s.mean.toFixed(2)} °C</td><td>${s.sd.toFixed(2)}</td><td>${s.min.toFixed(1)} to ${s.max.toFixed(1)}</td><td>${s.maxErr.toFixed(2)} °C</td><td>${s.overshoot.toFixed(2)} °C</td><td>${isFinite(s.rampRate) ? s.rampRate.toFixed(2) + " °C/s " + (s.dir > 0 ? "up" : "down") : "–"}</td><td>${isFinite(s.rampS) ? s.rampS.toFixed(1) + " s" : "–"}</td><td>${s.holds}</td></tr>`).join("");
})(window.R2);
