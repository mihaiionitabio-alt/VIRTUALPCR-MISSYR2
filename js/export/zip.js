/* ZIP writer with stored entries and optional native browser DEFLATE. */
(/* @r2fn R2-C0046-F00001 */function (R2) {
  "use strict";
  R2.zipBytes = /* @r2fn R2-C0046-F00002 */function (files) {         // files: [{name, data: Uint8Array}] -> Uint8Array
    const parts = [], central = []; let offset = 0;
    const u16 = /* @r2fn R2-C0046-F00003 */v => [v & 255, (v >> 8) & 255], u32 = /* @r2fn R2-C0046-F00004 */v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = R2.utf8(f.name), crc = f.checksum ?? R2.crc32(f.data), n = f.data.length;
      const size = f.rawSize ?? n, method = f.rawSize === undefined ? 0 : 8;
      const head = Uint8Array.from([0x50, 0x4b, 3, 4, 20, 0, 0, 8, ...u16(method), ...u16(time), ...u16(date), ...u32(crc), ...u32(n), ...u32(size), ...u16(name.length), 0, 0]);
      parts.push(head, name, f.data);
      central.push(Uint8Array.from([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, ...u16(method), ...u16(time), ...u16(date), ...u32(crc), ...u32(n), ...u32(size), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset)]), name);
      offset += head.length + name.length + n;
    }
    const csize = central.reduce(/* @r2fn R2-C0046-F00005 */(s, p) => s + p.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(offset), 0, 0]);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce(/* @r2fn R2-C0046-F00006 */(s, p) => s + p.length, 0)); let o = 0; for (const p of all) { out.set(p, o); o += p.length; } return out;
  };
  R2.zipDeflated = /* @r2fn R2-C0046-F00007 */async files => {
    if (typeof CompressionStream === "undefined") return R2.zipBytes(files);
    try { new CompressionStream("deflate-raw"); } catch { return R2.zipBytes(files); }
    for (let i = 0; i < files.length; i++) {
      const { name, data } = files[i];
      if (data.length < 512) continue;
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const packed = new Uint8Array(await new Response(stream).arrayBuffer());
      if (packed.length < data.length) files[i] = { name, data: packed, rawSize: data.length, checksum: R2.crc32(data) };
    }
    return R2.zipBytes(files);
  };
  R2.downloadAsync = /* @r2fn R2-C0046-F00008 */async (button, name, prepare) => {
    // restore the English source label; the language layer paints it again
    const label = R2.i18n?.source ? R2.i18n.source(button) : button.textContent;
    button.disabled = true;
    button.textContent = "Preparing download…";
    try {
      R2.download(name, await prepare(), "application/zip");
      button.textContent = label;
      return true;
    } catch (error) {
      console.error("Run export failed", error);
      button.textContent = "Retry download";
      return false;
    } finally { button.disabled = false; }
  };
  R2.zip = /* @r2fn R2-C0046-F00009 */files => new Blob([R2.zipBytes(files)], { type: "application/zip" });
  R2.download = /* @r2fn R2-C0046-F00010 */function (name, blobOrText, type) {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: type || "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(/* @r2fn R2-C0046-F00011 */() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };
})(window.R2);
