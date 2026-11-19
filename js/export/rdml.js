/* RDML 1.2 export (www.rdml.org): one experiment, one run per detection channel, amplification and melt data per reaction.
 * Fluorescence is the instrument's mean LED-on minus LED-off counts: not baseline-subtracted, not normalised.
 * The Cq written is the one computed on the quality-manager bench with the settings shown there. */
(/* @r2fn R2-C0041-F00001 */function (R2) {
  "use strict";
  const publicTarget = /* @r2fn R2-C0041-F00002 */value => R2.publicAssayTarget ? R2.publicAssayTarget(value) : ({ "SIMPLEX-35S": "P-35S", "SIMPLEX-TNOS": "T-nos", "SIMPLEX-LEC": "LE1", "SIMPLEX-HMG": "hmgA" }[value] || value);
  const e = R2.esc, id = /* @r2fn R2-C0041-F00003 */s => e(String(s).replace(/\s+/g, "_"));
  const sampleKey = /* @r2fn R2-C0041-F00004 */(w, i) => (w.label ? w.label + " · " : "") + (w.sample || R2.wellName(i)) + " [" + (w.sampleId || w.role) + "]";
  R2.rdmlSampleKey = sampleKey;
  R2.rdmlXml = /* @r2fn R2-C0041-F00005 */function (run, ev, version = "1.2") {
    const now = run.startedAt || run.time || new Date().toISOString(), tb = R2.analysis.tables(run.record), plate = run.plate, prog = run.protocol, L = [], MM = R2.GMO.methods;
    const chan = /* @r2fn R2-C0041-F00006 */m => ev.assays[m].channel, dyeOf = /* @r2fn R2-C0041-F00007 */m => MM[m].P ? MM[m].P[1] : "SYBR", used = [...new Set(ev.order.map(dyeOf))];
    const dyes = used, dyeNote = used.map(/* @r2fn R2-C0041-F00008 */d => d === "SYBR" ? "SYBR Green, intercalating dye, detection channel 1 (simulated)" : d + " reporter of a hydrolysis probe, detection channel " + (d === "FAM" ? 1 : 2) + " (simulated)");
    L.push('<?xml version="1.0" encoding="UTF-8"?>', `<rdml version="${version}" xmlns:rdml="http://www.rdml.org" xmlns="http://www.rdml.org">`);
    L.push(`<dateMade>${now}</dateMade>`, `<dateUpdated>${now}</dateUpdated>`);
    L.push(`<id><publisher>MISSY R2 workbench (simulated instrument)</publisher><serialNumber>${e(run.serial)}</serialNumber></id>`);
    L.push(`<experimenter id="operator"><firstName>${e(run.operator || "Simulated")}</firstName><lastName>operator</lastName></experimenter>`);
    L.push(`<documentation id="origin"><text>Simulated data from the MISSY R2 workbench, seed ${run.seed}. Teaching model; research use only; not from a real instrument. Fluorescence = mean LED-on minus LED-off detector counts, no baseline subtraction, no normalisation. Method sources are identified in the target descriptions.</text></documentation>`);
    dyes.forEach(/* @r2fn R2-C0041-F00009 */(d, i) => L.push(`<dye id="${d}"><description>${e(dyeNote[i])}</description></dye>`));

    const samples = new Map();
    plate.forEach(/* @r2fn R2-C0041-F00010 */(w, i) => { if (w.role === "empty") return; const key = sampleKey(w, i); if (!samples.has(key)) samples.set(key, w); });
    for (const [name, w] of samples) {
      const type = { standard: "std", unknown: "unkn", ntc: "ntc", positive: "pos" }[w.role] || "unkn";
      const types = w.role === "negative" && version === "1.3" ? ev.order.map(/* @r2fn R2-C0041-F00011 */target =>
        `<type targetId="${publicTarget(target)}">${MM[target].kind === "taxon" ? "pos" : "ntp"}</type>`).join("") : `<type>${type}</type>`;
      L.push(`<sample id="${e(name)}"><description>${e([w.sample, w.material, w.parentSampleId && "Linked sample " + w.parentSampleId,
        ...(w.stocks || []).map(/* @r2fn R2-C0041-F00012 */stock => stock.name + (stock.extractedAt ? ", DNA extracted " + stock.extractedAt : ""))].filter(Boolean).join(". "))}</description>${types}</sample>`);
    }
    for (const m of ev.order) L.push(`<target id="${publicTarget(m)}"><description>${e(ev.assays[m].name + ": " + MM[m].title + " (" + (MM[m].source || "EURL GMFF GMOMETHODS " + m) + ")")}</description><type>${MM[m].kind === "taxon" ? "ref" : "toi"}</type><dyeId id="${dyeOf(m)}"/></target>`);
    // thermal protocol as RDML steps with loops
    L.push(`<thermalCyclingConditions id="protocol"><description>${e(prog.name || "protocol")}</description><lidTemperature>${prog.lid_c || 0}</lidTemperature>`);
    let nr = 0;
    for (const s of prog.stages) {
      if (s.type === "melt") { L.push(`<step><nr>${++nr}</nr><description>melt ${s.from_c} to ${s.to_c} at ${s.rate_c_per_s} per s, continuous reads</description><temperature><temperature>${s.from_c}</temperature><duration>1</duration></temperature></step>`,
        `<step><nr>${++nr}</nr><temperature><temperature>${s.to_c}</temperature><duration>1</duration><ramp>${s.rate_c_per_s}</ramp></temperature></step>`); continue; }
      const first = nr + 1;
      for (const q of s.steps) L.push(`<step><nr>${++nr}</nr>` + (q.read ? `<description>fluorescence read at the end of the hold</description>` : "") + `<temperature><temperature>${q.temp_c}</temperature><duration>${Math.round(q.hold_s)}</duration>` +
        (q.delta_temp_c ? `<temperatureChange>${q.delta_temp_c}</temperatureChange>` : "") + (q.delta_hold_s ? `<durationChange>${Math.round(q.delta_hold_s)}</durationChange>` : "") + (q.ramp_c_per_s ? `<ramp>${q.ramp_c_per_s}</ramp>` : "") + `</temperature></step>`);
      if ((s.repeats || 1) > 1) L.push(`<step><nr>${++nr}</nr><loop><goto>${first}</goto><repeat>${s.repeats - 1}</repeat></loop></step>`);
    }
    L.push(`</thermalCyclingConditions>`);
    L.push(`<experiment id="${id(run.runId)}"><description>Simulated run, outcome: ${e(run.outcome)}</description>`);
    const multiplex = version === "1.3";
    for (const c of multiplex ? [null] : [0, 1]) {
      const here = ev.order.filter(/* @r2fn R2-C0041-F00013 */m => multiplex || chan(m) === c); if (!here.length) continue;
      const cqNote = here.map(/* @r2fn R2-C0041-F00014 */m => { const a = ev.assays[m].one.res.amp; return m + ": " + (a ? (a.cqMethod === "cy0" ? "Cy0 from a four-parameter sigmoid fit" : "threshold " + a.threshold.toPrecision(4) + " on baseline-subtracted counts") : "none"); }).join("; ");
      L.push(`<run id="${id(run.runId)}${multiplex ? "" : "_ch" + (c + 1)}"><description>${multiplex ? "Physical plate" : "Detection channel " + (c + 1)}: ${e(here.map(/* @r2fn R2-C0041-F00015 */m => ev.assays[m].name).join(", "))}${multiplex ? ". Cq settings: " + e(cqNote) : ""}</description><experimenter id="operator"/><instrument>MISSY R2 simulated instrument, serial ${e(run.serial)}, ${plate.length} wells</instrument>`,
        `<dataCollectionSoftware><name>MISSY R2 workbench</name><version>${e(R2.VERSION)}</version></dataCollectionSoftware>`,
        `<backgroundDeterminationMethod>${multiplex ? "other" : "none applied to the exported fluorescence"}</backgroundDeterminationMethod>`,
        `<cqDetectionMethod>${multiplex ? "other" : e(cqNote)}</cqDetectionMethod>`,
        `<thermalCyclingConditions id="protocol"/><pcrFormat><rows>${R2.PLATE.rows}</rows><columns>${R2.PLATE.cols}</columns><rowLabel>ABC</rowLabel><columnLabel>123</columnLabel></pcrFormat><runDate>${now}</runDate>`);
      for (let w = 0; w < plate.length; w++) {
        const targets = (plate[w].t || []).filter(/* @r2fn R2-C0041-F00016 */x => multiplex || chan(x.m) === c);
        if (!targets.length) continue;
        const row = [`<react id="${w + 1}"><sample id="${e(sampleKey(plate[w], w))}"/>`];
        for (const t of targets) {
          const channel = chan(t.m), a = ev.assays[t.m].one.res.amp, aw = a ? a.wells[w] : null;
          const cq = aw && Number.isFinite(aw.cq) ? aw.cq.toFixed(4) : null;
          row.push(`<data><tar id="${publicTarget(t.m)}"/>`);
          if (cq) row.push(`<cq>${cq}</cq>`);
          tb.cycles.forEach(/* @r2fn R2-C0041-F00017 */(cy, i) => { const v = tb.amp[channel][w][i]; if (isFinite(v)) row.push(`<adp><cyc>${cy}</cyc><fluor>${v.toFixed(3)}</fluor></adp>`); });
          if (MM[t.m].sybr) tb.melt[channel][w].forEach(/* @r2fn R2-C0041-F00018 */(v, i) => { const tt = tb.meltT[channel][w][i]; if (isFinite(v) && isFinite(tt)) row.push(`<mdp><tmp>${tt.toFixed(3)}</tmp><fluor>${v.toFixed(3)}</fluor></mdp>`); });
          row.push("</data>");
        }
        row.push("</react>");
        L.push(row.join(""));
      }
      L.push(`</run>`);
    }
    L.push(`</experiment>`, `</rdml>`);
    return L.join("\n");
  };
  R2.rdmlBlob = /* @r2fn R2-C0041-F00019 */(run, ev) => R2.zip([{ name: "rdml_data.xml", data: R2.utf8(R2.rdmlXml(run, ev)) }]);
})(window.R2);
