/* Read workbench archive metadata and batch sample names locally. */
(/* @r2fn R2-C0044-F00001 */function (R2) {
  "use strict";
  const decode = /* @r2fn R2-C0044-F00002 */bytes => new TextDecoder("utf-8").decode(bytes);
  /* @r2fn R2-C0044-F00003 */function zipIndex(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = new Map();
    const u16 = /* @r2fn R2-C0044-F00004 */p => dv.getUint16(p, true), u32 = /* @r2fn R2-C0044-F00005 */p => dv.getUint32(p, true);
    let end = bytes.length - 22;
    while (end >= Math.max(0, bytes.length - 65557) && u32(end) !== 0x06054b50) end--;
    if (end < Math.max(0, bytes.length - 65557)) throw new Error("ZIP directory missing.");
    let pos = u32(end + 16);
    for (let i = 0; i < u16(end + 10); i++) {
      if (u32(pos) !== 0x02014b50) throw new Error("Invalid ZIP directory.");
      const len = u16(pos + 28);
      const key = decode(bytes.subarray(pos + 46, pos + 46 + len));
      if (files.has(key)) throw new Error("Duplicate ZIP member.");
      files.set(key, { compression: u16(pos + 10), crc: u32(pos + 16), length: u32(pos + 20), size: u32(pos + 24), offset: u32(pos + 42) });
      pos += 46 + len + u16(pos + 30) + u16(pos + 32);
    }
    return { has: /* @r2fn R2-C0044-F00006 */key => files.has(key), async get/* @r2fn R2-C0044-F00007 */(key) {
      const f = files.get(key);
      if (!f) throw new Error("Missing " + key + ".");
      if (f.size > 300 * 1024 * 1024 || u32(f.offset) !== 0x04034b50) throw new Error("Unreadable " + key + ".");
      const start = f.offset + 30 + u16(f.offset + 26) + u16(f.offset + 28);
      let data = bytes.subarray(start, start + f.length);
      if (f.compression === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else if (f.compression !== 0) throw new Error("Unsupported ZIP compression.");
      if (data.length !== f.size || R2.crc32(data) !== f.crc) throw new Error("Invalid checksum for " + key + ".");
      return data;
    } };
  }
  const isZip = /* @r2fn R2-C0044-F00008 */bytes => bytes[0] === 80 && bytes[1] === 75;
  const metadata = /* @r2fn R2-C0044-F00009 */async zip => JSON.parse(decode(await zip.get("source/run-input.json")));
  /* @r2fn R2-C0044-F00010 */function fromXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror") || doc.documentElement.localName !== "rdml") throw new Error("Expected an RDML document.");
    const core = [...doc.documentElement.children];
    const samples = core.filter(/* @r2fn R2-C0044-F00011 */n => n.localName === "sample"), names = new Map();
    for (const node of samples) {
      const types = [...node.children].filter(/* @r2fn R2-C0044-F00012 */el => el.localName === "type");
      if (types.length && !types.some(/* @r2fn R2-C0044-F00013 */n => n.textContent.trim() === "unkn")) continue;
      const id = node.getAttribute("id")?.trim();
      if (!id) continue;
      const name = id.replace(/ \[(?:S-[\w-]+|unknown)\]$/, "").replace(/((?:[0-9]{6}-\d+-\d{8}))-E\d+(?=\b)/, "$1");
      const label = name.replace(/ · \d{6}-\d+-\d{8}$/, "");
      const date = /\d{6}-\d+-(\d{8})$/.exec(name)?.[1];
      names.set(name, { label, extractionDate: date ? date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6) : null });
    }
    return [...names.values()];
  }
  /* @r2fn R2-C0044-F00014 */function cleanRows(rows) {
    const seen = new Set(), cleaned = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const label = String(row.label || row.name || "").trim(), date = typeof row.extractionDate === "string" ? row.extractionDate.trim() : null;
      if (!label) continue;
      const token = row.no ?? null;
      if (token !== null && seen.has(token)) continue;
      seen.add(token);
      cleaned.push({ label: label.slice(0, 100), extractionDate: /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : null });
    }
    if (!cleaned.length) throw new Error("No sample names found.");
    return cleaned;
  }
  R2.sampleNames = /* @r2fn R2-C0044-F00015 */async bytes => {
    if (isZip(bytes)) {
      const zip = zipIndex(bytes);
      if (zip.has("source/run-input.json")) {
        const samples = (await metadata(zip)).sampleIdentity?.samples;
        if (samples?.length) return cleanRows(samples);
      }
      return cleanRows(fromXml(decode(await zip.get("rdml_data.xml"))));
    }
    const text = decode(bytes).replace(/^\uFEFF/, "").trim();
    if (text.startsWith("[") || text.startsWith("{")) {
      const json = JSON.parse(text), rows = Array.isArray(json) ? json : json.samples || json.batch;
      if (!Array.isArray(rows)) throw new Error("Expected a JSON list of sample names.");
      return cleanRows(rows.map(/* @r2fn R2-C0044-F00016 */row => typeof row === "string" ? { label: row } : row));
    }
    if (text.startsWith("<")) return cleanRows(fromXml(text));
    const tab = text.split(/\r?\n/, 1)[0].includes("\t");
    const rows = R2.external.csv(text, tab ? "\t" : ",");
    const headers = rows[0].map(/* @r2fn R2-C0044-F00017 */value => value.trim().toLowerCase().replace(/\s+/g, "_"));
    const name = ["sample_label","sample_name","name","label","sample"].map(/* @r2fn R2-C0044-F00018 */key => headers.indexOf(key)).find(/* @r2fn R2-C0044-F00019 */i => i >= 0) ?? -1;
    if (name === -1 && rows.some(/* @r2fn R2-C0044-F00020 */row => row.length !== 1)) throw new Error("Add a Sample Name column to the list.");
    const date = headers.indexOf("extraction_date"), no = headers.indexOf("sample_no"), role = headers.indexOf("role");
    return cleanRows((name === -1 ? rows : rows.slice(1)).filter(/* @r2fn R2-C0044-F00021 */row => role < 0 || row[role] === "unknown").map(/* @r2fn R2-C0044-F00022 */row => ({
      label: row[name < 0 ? 0 : name] || row[headers.indexOf("sample_name")], extractionDate: row[date], no: row[no] || undefined
    })));
  };
  R2.importWorkbenchRun = /* @r2fn R2-C0044-F00023 */async bytes => {
    const zip = zipIndex(bytes), input = await metadata(zip);
    if (!input.runId || !input.gmo?.stage || !input.protocol?.stages || input.plate?.length !== R2.PLATE.n ||
        !input.plate.every(/* @r2fn R2-C0044-F00024 */w => Array.isArray(w.t) && w.t.every(/* @r2fn R2-C0044-F00025 */t => !!R2.GMO.methods[t.m]))) {
      throw new Error("Expected a run created by this workbench with known assay IDs.");
    }
    const record = JSON.parse(decode(await zip.get("source/simulator-record.json")));
    if (![record.optical, record.telemetry, record.events].every(Array.isArray)) throw new Error("Instrument record is incomplete.");
    const samples = input.sampleIdentity?.samples || [];
    const byNo = new Map(samples.map(/* @r2fn R2-C0044-F00026 */sample => [sample.no, sample]));
    const plate = input.plate.map(/* @r2fn R2-C0044-F00027 */well => {
      const sample = byNo.get(well.sampleNo);
      return sample ? { ...well, label: well.label || sample.label, extractionDate: well.extractionDate || sample.extractionDate } : well;
    });
    const run = { ...input, plate, name: input.runId, time: input.finishedAt, record, samples, prefix: input.sampleIdentity?.prefix,
      serial: input.serial || (input.gmo.layout?.cols === 24 || input.plate.length === 384 ? "SIM-0384" : "SIM-0001"), imported: true };
    if (!run.gmo.truth) run.gmo.truth = { events: {} };
    return run;
  };
})(window.R2);
