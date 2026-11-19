/* Identities of the material in a run, independent of well positions and analytical inputs.
 * Samples are numbered 1 to n in the run. Because many independent runs are analysed together, each sample name also
 * carries a random six-digit prefix that is unique to the run and the DNA extraction date of the sample:
 *   <prefix>-<n>-<YYYYMMDD>          sample               e.g. 583012-1-20261117
 *   <prefix>-<n>-<YYYYMMDD>-E<k>     sub-sample k (one independent DNA extraction), tested in three PCR replicates
 * Controls carry the same prefix. */
(/* @r2fn R2-C0028-F00001 */function (R2) {
  "use strict";
  const M = R2.materials = {};
  const usedKey = "missy-r2-run-prefixes", maskKey = usedKey + "-bitmap";
  const count = 900000, bitmap = new Uint8Array(count / 8);
  const includes = /* @r2fn R2-C0028-F00002 */n => (bitmap[n >> 3] & (1 << (n % 8))) !== 0;
  const mark = /* @r2fn R2-C0028-F00003 */n => { if (n >= 0 && n < count) bitmap[n >> 3] |= 1 << (n % 8); };
  /* @r2fn R2-C0028-F00004 */function loadPrefixes() {
    try {
      const bas = localStorage.getItem(maskKey);
      if (bas) {
        const bytes = atob(bas);
        for (let i = 0; i < bitmap.length; i++) bitmap[i] |= bytes.charCodeAt(i);
      } else {
        for (const prefix of JSON.parse(localStorage.getItem(usedKey) || "[]")) mark(Number(prefix) - 100000);
      }
    } catch {}
  }
  /* @r2fn R2-C0028-F00005 */function savePrefixes() {
    try {
      let data = "";
      for (let i = 0; i < bitmap.length; i += 8192) data += String.fromCharCode(...bitmap.subarray(i, i + 8192));
      localStorage.setItem(maskKey, btoa(data));
    } catch {}
  }
  M.next = /* @r2fn R2-C0028-F00006 */function () {
    loadPrefixes();
    const random = crypto.getRandomValues(new Uint32Array(1))[0] % count;
    let n = random;
    while (includes(n)) {
      n = (n + 1) % count;
      if (n === random) throw new Error("All six-digit run prefixes have already been used in this browser.");
    }
    mark(n);
    savePrefixes();
    const prefix = String(100000 + n), createdAt = new Date().toISOString();
    const uid = Array.from(crypto.getRandomValues(new Uint8Array(12)), /* @r2fn R2-C0028-F00007 */b => b.toString(16).padStart(2, "0")).join("");
    return { prefix, createdAt, uid, autoName: prefix };
  };
  M.dateCode = /* @r2fn R2-C0028-F00008 */d => String(d || new Date().toISOString().slice(0, 10)).slice(0, 10).replace(/-/g, "");
  M.sampleName = /* @r2fn R2-C0028-F00009 */(prefix, no, date) => prefix + "-" + no + "-" + M.dateCode(date);
  M.stocks = /* @r2fn R2-C0028-F00010 */function (well, plan, crop) {
    if (plan.mara && ["positive", "negative", "standard"].includes(well.role)) {
      return [well.role === "negative" ? "Non-GM " + crop + " genomic DNA" : R2.GMO.methods[plan.mara.method]?.crm || "Simulated rapid-screen target material"];
    }
    if (!["positive", "standard"].includes(well.role)) return [];
    if (plan.lab && R2.LAB[plan.lab]) { const L = R2.LAB[plan.lab]; return [well.ctl === "LOD" ? L.crm[crop].name : L.positiveSample[crop].name]; }
    const event = plan.calPct === undefined ? null : R2.GMO.methods[plan.tubes[0][0]];
    return [...new Set(well.t.map(/* @r2fn R2-C0028-F00011 */t => { const method = R2.GMO.methods[t.m]; return event ? event.crm : method.crm || "Non-GM " + crop + " genomic DNA"; }))];
  };
  /* plan: gmoplan.plate output; identity: M.next(); meta: per sample { extractionDate (YYYY-MM-DD), label (optional), preset };
   * extractions: extraction date and time of named reference materials. Returns the plate with names and identifiers. */
  M.assign = /* @r2fn R2-C0028-F00012 */function (plan, identity, meta, extractions = {}, crop = null) {
    const roleName = { negative: "NC", positive: "PC", ntc: "NTC", standard: "Calibrant" }, ctlName = { LOD: "PC at LOD", POS: "Positive sample", NTC: "NTC", BLK: "Extraction blank", PC: "PC", NC: "Non-GM control", CAL: "Calibrant" };
    const names = plan.samples.map(/* @r2fn R2-C0028-F00013 */s => { const m = meta[s.no - 1] || {}; return { no: s.no, name: M.sampleName(identity.prefix, s.no, m.extractionDate), extractionDate: m.extractionDate || new Date().toISOString().slice(0, 10), label: m.label || "", preset: s.label }; });
    const related = new Map();
    const wells = plan.wells.map(/* @r2fn R2-C0028-F00014 */well => {
      const { role, t, material } = well;
      if (role === "empty") return { role, sample: "", t: [], material: "" };
      if (role === "unknown") { const n = names[well.sampleNo - 1];
        return { role, ctl: "S", sample: n.name + "-E" + well.ext, sampleName: n.name, label: n.label, extractionDate: n.extractionDate, sampleNo: well.sampleNo, ext: well.ext, rep: well.rep, sampleId: "S-" + (identity.uid || identity.prefix) + "-" + well.sampleNo + "-E" + well.ext,
          parentSampleId: "S-" + (identity.uid || identity.prefix) + "-" + well.sampleNo, material: (n.label ? n.label + "; " : "") + "simulated material: " + n.preset + "; DNA extracted " + n.extractionDate + ", sub-sample E" + well.ext, stocks: [], dilution: null, t: t.map(/* @r2fn R2-C0028-F00015 */x => ({ ...x })) }; }
      const stocks = M.stocks(well, plan, crop || "maize").map(/* @r2fn R2-C0028-F00016 */name => ({ name, extractedAt: extractions[name] || null }));
      const level = role === "standard" ? well.sample.replace(/^STD\s*/, "") : "";
      const key = JSON.stringify([role, well.ctl || "", stocks.map(/* @r2fn R2-C0028-F00017 */s => s.name), level]);
      if (!related.has(key)) related.set(key, "C-" + (identity.uid || identity.prefix) + "-" + (related.size + 1));
      const source = stocks.map(/* @r2fn R2-C0028-F00018 */s => s.name + (s.extractedAt ? " [" + s.extractedAt + "]" : "")).join(" + ");
      const label = [identity.prefix, ctlName[well.ctl] || roleName[role], source, level].filter(Boolean).join(" / ");
      return { role, ctl: well.ctl || null, rep: well.rep, sample: label, sampleId: related.get(key), parentSampleId: "RUN-" + (identity.uid || identity.prefix),
        material: material || (role === "ntc" ? "Water" : ""), stocks, dilution: level || null, t: t.map(/* @r2fn R2-C0028-F00019 */x => ({ ...x })) };
    });
    return { wells, samples: names };
  };
})(window.R2);
