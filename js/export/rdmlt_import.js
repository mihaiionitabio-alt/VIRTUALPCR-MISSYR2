/* RDMLt package (RDML 1.3 core + draft revision 2 companion) for data imported on the quality bench.
 * Core: samples, targets, one run with one reaction per well, the Cq of the source file (or the one computed here for curve
 * tables) and the fluorescence points when the source has curves. Companion: the original file byte for byte, the analysis
 * summary and the SOP, each listed with SHA-256 and byte count, and the analysis results per reaction. No telemetry exists
 * for imported data; the availability statements say so. */
(/* @r2fn R2-C0043-F00001 */function (R2) {
  "use strict";
  const xml = R2.esc, ref = /* @r2fn R2-C0043-F00002 */(tag, id) => `<${tag} id="${xml(id)}"/>`;
  const q = /* @r2fn R2-C0043-F00003 */(tag, value, unit, source = "reported") => Number.isFinite(value) ? `<${tag} unit="${unit}" origin="${source}">${value}</${tag}>` : "";
  const safeId = /* @r2fn R2-C0043-F00004 */s => String(s).replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^([^A-Za-z_])/, "_$1").slice(0, 80) || "id";
  /* @r2fn R2-C0043-F00005 */function layout(ds) {
    const pos = ds.rows.map(/* @r2fn R2-C0043-F00006 */r => /^([A-P])(\d{1,2})$/i.exec(r.position || "")).filter(Boolean);
    if (pos.length === ds.rows.length && pos.length) {
      const maxR = Math.max(...pos.map(/* @r2fn R2-C0043-F00007 */m => m[1].toUpperCase().charCodeAt(0) - 64)), maxC = Math.max(...pos.map(/* @r2fn R2-C0043-F00008 */m => +m[2]));
      const rows = maxR > 8 || maxC > 12 ? 16 : 8, cols = rows === 16 ? 24 : 12;
      return { rows, cols, id: /* @r2fn R2-C0043-F00009 */r => { const m = /^([A-P])(\d{1,2})$/i.exec(r.position); return (m[1].toUpperCase().charCodeAt(0) - 65) * cols + +m[2]; } };
    }
    const n = Math.max(1, ...ds.rows.map(/* @r2fn R2-C0043-F00010 */r => r.well + 1)); return { rows: 1, cols: n, id: /* @r2fn R2-C0043-F00011 */r => r.well + 1 };
  }
  const sampleKey = /* @r2fn R2-C0043-F00012 */r => r.task === "STANDARD" ? (r.sample || "Standard") + " [" + r.quantity + "]" : r.task === "NTC" ? (r.sample || "NTC") + " [NTC]" : (r.sample || "sample");
  R2.importRdmlXml = /* @r2fn R2-C0043-F00013 */function (item, res) {
    const ds = item.ds, now = item.added || new Date().toISOString(), L = [], lay = layout(ds), runId = safeId(item.name);
    const dye = /* @r2fn R2-C0043-F00014 */r => safeId(r.reporter || "unspecified");
    L.push('<?xml version="1.0" encoding="UTF-8"?>', '<rdml version="1.3" xmlns:rdml="http://www.rdml.org" xmlns="http://www.rdml.org">', `<dateMade>${now}</dateMade>`, `<dateUpdated>${now}</dateUpdated>`,
      `<id><publisher>MISSY R2 workbench, quality bench (imported data)</publisher><serialNumber>${xml(item.sha256.slice(0, 16))}</serialNumber></id>`,
      `<documentation id="origin"><text>${xml("Imported from " + item.file + " (" + ds.formatLabel + "), SHA-256 " + item.sha256 + ". Cq values as given in the source" + (ds.format === "curves" ? "; for this curve table the Cq is computed on the workbench at 10 % of the rise" : "") + ". " + (item.sourceNote || ""))}</text></documentation>`);
    for (const d of [...new Set(ds.rows.map(dye))]) L.push(`<dye id="${d}"/>`);
    const samples = new Map(); for (const r of ds.rows) if (!samples.has(sampleKey(r))) samples.set(sampleKey(r), r);
    for (const [k, r] of samples) L.push(`<sample id="${xml(k)}">${r.group ? `<description>${xml("group " + r.group)}</description>` : ""}<type>${r.task === "STANDARD" ? "std" : r.task === "NTC" ? "ntc" : "unkn"}</type>${r.task === "STANDARD" && r.quantity > 0 ? `<quantity><value>${r.quantity}</value><unit>other</unit></quantity>` : ""}</sample>`);
    const refs = res && res.refs || [], tgs = [...new Set(ds.rows.map(/* @r2fn R2-C0043-F00015 */r => r.target))];
    for (const t of tgs) { const r = ds.rows.find(/* @r2fn R2-C0043-F00016 */x => x.target === t), eff = res && res.kind === "standard" && res.targets.find(/* @r2fn R2-C0043-F00017 */x => x.target === t);
      L.push(`<target id="${xml(t)}"><type>${refs.includes(t) ? "ref" : "toi"}</type>${eff ? `<amplificationEfficiencyMethod>standard curve on the workbench</amplificationEfficiencyMethod><amplificationEfficiency>${(1 + eff.efficiency).toFixed(4)}</amplificationEfficiency>` : ""}<dyeId id="${dye(r)}"/></target>`); }
    L.push(`<experiment id="${runId}"><description>${xml(ds.title)}</description><run id="${runId}"><description>${xml(ds.formatLabel + (ds.meta.instrument ? ", " + ds.meta.instrument : ""))}</description>`,
      ds.meta.instrument ? `<instrument>${xml(ds.meta.instrument)}</instrument>` : "", `<dataCollectionSoftware><name>MISSY R2 workbench (import)</name><version>${R2.VERSION}</version></dataCollectionSoftware>`,
      `<cqDetectionMethod>${ds.format === "curves" ? "other" : "automated threshold and baseline settings"}</cqDetectionMethod>`,
      `<pcrFormat><rows>${lay.rows}</rows><columns>${lay.cols}</columns><rowLabel>${lay.rows > 1 ? "ABC" : "123"}</rowLabel><columnLabel>123</columnLabel></pcrFormat>`);
    const byReact = new Map(); for (const r of ds.rows) { const id = lay.id(r); if (!byReact.has(id)) byReact.set(id, []); byReact.get(id).push(r); }
    for (const [id, rs] of [...byReact].sort(/* @r2fn R2-C0043-F00018 */(a, b) => a[0] - b[0])) {
      const row = [`<react id="${id}"><sample id="${xml(sampleKey(rs[0]))}"/>`];
      for (const r of rs) { row.push(`<data><tar id="${xml(r.target)}"/>`); if (Number.isFinite(r.cq)) row.push(`<cq>${r.cq.toFixed(4)}</cq>`); if (r.omit) row.push("<excl>omitted in the source file</excl>");
        if (ds.curves && ds.curves[r.well]) ds.curves[r.well].forEach(/* @r2fn R2-C0043-F00019 */(v, i) => { if (Number.isFinite(v)) row.push(`<adp><cyc>${ds.cycles[i]}</cyc><fluor>${v}</fluor></adp>`); });
        row.push("</data>"); }
      row.push("</react>"); L.push(row.join(""));
    }
    L.push("</run></experiment></rdml>");
    return L.join("\n");
  };
  // per-reaction result of the workbench analysis, where one exists
  /* @r2fn R2-C0043-F00020 */function resultOf(res, r) {
    if (!res) return null;
    if (res.kind === "standard") { const t = res.targets.find(/* @r2fn R2-C0043-F00021 */x => x.target === r.target); if (!t) return null; const s = t.samples.find(/* @r2fn R2-C0043-F00022 */x => x.sample === r.sample);
      return r.task === "UNKNOWN" && s ? { conc: s.quantity, note: s.outside ? "outside the range of the standards" : s.removed.includes(r.cq) ? "replicate set aside" : null } : null; }
    if (res.kind === "ddcq" && r.task === "UNKNOWN") { const g = (res.genes || []).find(/* @r2fn R2-C0043-F00023 */x => x.gene === r.target); if (!g) return null;
      for (const grp of g.groups) { const smp = grp.samples.find(/* @r2fn R2-C0043-F00024 */x => x.sample === r.sample); if (smp) return { dcq: smp.dcq, ddcq: grp.ddcqMean === null ? null : smp.dcq - (grp.dcqMean - grp.ddcqMean), group: grp.group}; } return null; }
    if (res.kind === "curves") { const w = res.wells.find(/* @r2fn R2-C0043-F00025 */x => x.well === r.well); return w ? { note: w.call } : null; }
    return null;
  }
  R2.importRdmltFiles = /* @r2fn R2-C0043-F00026 */function (item, res) {
    const payloads = [], manifest = [];
    const file = /* @r2fn R2-C0043-F00027 */(id, name, text, type) => { const data = typeof text === "string" ? R2.utf8(text) : text; payloads.push({ name, data }); manifest.push(`<file id="${id}"><filename>${xml(name)}</filename><mediaType>${type}</mediaType><sha256>${R2.sha256(data)}</sha256><byteCount>${data.length}</byteCount></file>`); };
    const ds = item.ds, isJson = ds.format === "planner", sop = R2.external.sopDoc(ds, res);
    file("core-file", "rdml_data.xml", R2.importRdmlXml(item, res), "application/xml");
    file("source-file", "source/" + safeId(item.file).replace(/_(csv|json)$/i, ".$1"), item.bytes, isJson ? "application/json" : "text/csv");
    file("analysis-file", "analysis/analysis.json", R2.external.json(item, res), "application/json");
    file("sop-file", "analysis/sop.json", JSON.stringify(sop, null, 1), "application/json");
    const lay = layout(ds), runId = safeId(item.name), seen = new Set();
    const reacts = []; const byReact = new Map(); for (const r of ds.rows) { const id = lay.id(r); if (!byReact.has(id)) byReact.set(id, []); byReact.get(id).push(r); }
    for (const [id, rs] of [...byReact].sort(/* @r2fn R2-C0043-F00028 */(a, b) => a[0] - b[0])) {
      if (seen.has(id)) continue; seen.add(id);
      const data = rs.map(/* @r2fn R2-C0043-F00029 */r => { const o = resultOf(res, r), state = r.omit ? "invalid" : Number.isFinite(r.cq) ? "determined" : "undetermined";
        return `<data>${ref("tar", r.target)}${ref("analysis", "analysis-1")}<result><state>${state}</state>${q("cq", r.cq, "1", ds.format === "curves" ? "derived" : "reported")}${o && Number.isFinite(o.conc) ? q("conc", o.conc, "1", "derived") : ""}${o && Number.isFinite(o.dcq) ? q("deltaCq", o.dcq, "1", "derived") : ""}${o && Number.isFinite(o.ddcq) ? q("deltaDeltaCq", o.ddcq, "1", "derived") + q("relativeQuantity", Math.pow(2, -o.ddcq), "1", "derived") : ""}${o && o.note ? `<note>${xml(o.note)}</note>` : ""}</result></data>`; });
      reacts.push(`<react id="${id}"><description>${xml(rs[0].sample)}</description>${rs[0].position ? `<position>${xml(rs[0].position)}</position>` : ""}${ref("sample", sampleKey(rs[0]))}${data.join("")}</react>`);
    }
    const companion = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<rdmlt xmlns="urn:rdmlt:1" xmlns:rdml="http://www.rdml.org" version="1.0-draft" baseVersion="1.3" revision="2">',
      `<description>${xml("Data imported on the MISSY R2 Workbench quality bench: " + ds.title)}</description>`, ...manifest, `<core>${ref("file", "core-file")}</core>`,
      `<documentation id="source"><description>${xml("Original file " + item.file + ", unchanged. " + (item.sourceNote || ""))}</description>${ref("file", "source-file")}</documentation>`,
      `<documentation id="analysis"><description>${xml(res ? res.label + ": settings, results and findings." : "No analysis.")}</description>${ref("file", "analysis-file")}</documentation>`,
      `<documentation id="sop"><description>${xml(sop.sop_id + ": procedure of this analysis (one SOP per analysis definition).")}</description>${ref("file", "sop-file")}</documentation>`,
      `<software id="workbench"><name>MISSY R2 Workbench</name><version>${R2.VERSION}</version></software>`,
      `<provenance>${ref("source", "source-file")}${ref("software", "workbench")}<created>${new Date().toISOString()}</created>${ref("documentation", "source")}</provenance>`,
      '<dictionary id="scientific-quantities" version="1.0-r2"><authority>RDMLt proposal</authority>',
      '<term id="quantification-cycle" kind="result"><name>Quantification cycle</name><definition>Cycle coordinate at which the defined signal crosses the stated analysis criterion; undetermined is not zero.</definition><dimension>cycle coordinate</dimension><canonicalUnit>1</canonicalUnit></term>',
      '<term id="relative-quantity" kind="result"><name>Relative quantity</name><definition>Dimensionless amount relative to an identified sample/reference and analysis method.</definition><dimension>dimensionless</dimension><canonicalUnit>1</canonicalUnit></term>',
      "</dictionary>",
      `<instrument id="source-instrument"><description>${xml(ds.meta.instrument ? "Instrument named in the source file" : "Instrument not stated in the source file")}</description>${ds.meta.instrument ? `<model>${xml(ds.meta.instrument)}</model>` : ""}</instrument>`,
      `<experiment id="${runId}"><run id="${runId}"><description>${xml(ds.formatLabel)}</description>${ref("documentation", "source")}${ref("documentation", "analysis")}${ref("documentation", "sop")}${ref("instrument", "source-instrument")}${ref("dataCollectionSoftware", "workbench")}`,
      "<state>unknown</state>",
      '<availability section="acquisition" status="not recorded"/>', `<availability section="react" status="present"/>`, '<availability section="temperatureLog" status="not recorded"/>', '<availability section="series" status="not recorded"/>',
      `<analysis id="analysis-1"><name>${xml(res ? res.label : "imported values")}</name>${ref("software", "workbench")}<origin>stored analysis</origin>${ref("documentation", "analysis")}</analysis>`,
      ...reacts, "</run></experiment></rdmlt>"];
    payloads.push({ name: "rdmlt_data.xml", data: R2.utf8(companion.join("\n")) });
    return payloads;
  };
  R2.importRdmltBytes = /* @r2fn R2-C0043-F00030 */(item, res) => R2.zipBytes(R2.importRdmltFiles(item, res));
  R2.importRdmltCompressed = /* @r2fn R2-C0043-F00031 */(item, res) => R2.zipDeflated(R2.importRdmltFiles(item, res));
})(window.R2);
