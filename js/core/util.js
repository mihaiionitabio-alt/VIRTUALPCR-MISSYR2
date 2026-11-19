/* R2 workbench - shared helpers. Classic scripts on one global namespace so the site also runs from file://. */
window.R2 = window.R2 || {};
(/* @r2fn R2-C0037-F00001 */function (R2) {
  "use strict";
  // deterministic random numbers (mulberry32); not bit-identical to the C simulator
  R2.Rng = /* @r2fn R2-C0037-F00002 */function (seed) { this.s = (seed >>> 0) || 1; };
  R2.Rng.prototype.u = /* @r2fn R2-C0037-F00003 */function () { let t = (this.s += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  R2.Rng.prototype.gauss = /* @r2fn R2-C0037-F00004 */function () { const u = this.u() + 1e-12, v = this.u(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * v); };
  R2.Rng.prototype.poisson = /* @r2fn R2-C0037-F00005 */function (mean) {
    if (mean <= 0) return 0;
    if (mean > 50) { const v = mean + Math.sqrt(mean) * this.gauss(); return v < 0 ? 0 : Math.round(v); }
    const l = Math.exp(-mean); let p = 1, k = 0;
    do { k++; p *= this.u(); } while (p > l);
    return k - 1;
  };
  R2.clamp = /* @r2fn R2-C0037-F00006 */(x, lo, hi) => x < lo ? lo : (x > hi ? hi : x);
  R2.sigm = /* @r2fn R2-C0037-F00007 */x => 1 / (1 + Math.exp(-x));
  /* Plate of the technician and quality benches: 384 wells, 16 rows × 24 columns (OpticalCyclerA 480 / OpticalCyclerB format).
   * The engineer bench keeps the 16-tube R2 block (2 × 8), whose names A1–A8, B1–B8 are given by wellName(w, 8). */
  R2.PLATE = { rows: 16, cols: 24, n: 384 };
  R2.wellName = /* @r2fn R2-C0037-F00008 */(w, cols) => { cols = typeof cols === "number" && cols > 0 ? cols : R2.PLATE.cols; return String.fromCharCode(65 + Math.floor(w / cols)) + (w % cols + 1); };
  R2.fmt = /* @r2fn R2-C0037-F00009 */(x, d) => (x === null || x === undefined || !isFinite(x)) ? "–" : Number(x).toFixed(d === undefined ? 2 : d);
  R2.sci = /* @r2fn R2-C0037-F00010 */x => (x === null || x === undefined || !isFinite(x)) ? "–" : (x === 0 ? "0" : (Math.abs(x) >= 1e4 || Math.abs(x) < 1e-2 ? x.toExponential(2) : String(Math.round(x * 100) / 100)));
  R2.esc = /* @r2fn R2-C0037-F00011 */s => String(s).replace(/[&<>"]/g, /* @r2fn R2-C0037-F00012 */c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // CRC-16/CCITT-FALSE as used on the instrument link
  R2.crc16 = /* @r2fn R2-C0037-F00013 */function (str) { let c = 0xFFFF; for (let i = 0; i < str.length; i++) { c ^= str.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c; };
  R2.frame = /* @r2fn R2-C0037-F00014 */body => body + "*" + R2.crc16(body).toString(16).toUpperCase().padStart(4, "0");

  // CRC-32 (zip) and SHA-256 (manifests), synchronous, on Uint8Array
  const CRC_T = (/* @r2fn R2-C0037-F00015 */() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  R2.crc32 = /* @r2fn R2-C0037-F00016 */function (u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  R2.sha256 = /* @r2fn R2-C0037-F00017 */function (u8) {
    const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const l = u8.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(u8); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 8, Math.floor(l / 536870912)); dv.setUint32(n - 4, (l * 8) >>> 0);
    const w = new Uint32Array(64), rr = /* @r2fn R2-C0037-F00018 */(x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, /* @r2fn R2-C0037-F00019 */x => x.toString(16).padStart(8, "0")).join("");
  };
  R2.utf8 = /* @r2fn R2-C0037-F00020 */s => new TextEncoder().encode(s);
})(window.R2);
