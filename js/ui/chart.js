/* SVG plot used on every bench. The presentation follows the Curves and Instrument views of zpcrweb
 * (R. Byers, GPL-3.0, https://zpcr.rbyers.ca): dark plot surface, hover that lifts one curve and dims the rest with a
 * read-out card, Cq markers, a threshold line that can be dragged, baseline overlays, min/max bands, a right-hand
 * temperature axis, and a live trace that crosses a frame spanning the whole planned run. Re-implemented here; no code copied. */
(function (R2) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg"; let uid = 0;
  function ticks(lo, hi, n) { const span = hi - lo || 1, step0 = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step0, step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1), out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12)); return out; }
  const nice = v => Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(0) : String(+v.toPrecision(6));
  R2.niceNum = nice;
  /* opt: { series:[{x,y,color,label,key,width,dash,points,r,opacity,band:{lo,hi},card}], y2:{series:[…],label,lim},
   *        xlab, ylab, ylog, ylogFloor, xlim, ylim, height, hlines:[{y,label,color}], spans:[{x0,x1,color}], cursorX,
   *        markers:[{x,y,color,key}], threshold:{y,label,onChange}, onHover(key|null), highlight:key } */
  R2.chart = function (el, opt) {
    const id = el.dataset.cid || (el.dataset.cid = "c" + (++uid));
    const W = Math.max(330, Math.min(opt.maxWidth || 980, el.clientWidth || 640)), H = opt.height || 300, m = { l: 56, r: opt.y2 ? 62 : 14, t: 10, b: 38 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const floor = opt.ylogFloor || 1e-3, ty = v => opt.ylog ? Math.log10(Math.max(v, floor)) : v;
    let xs = [], ys = [];
    for (const s of opt.series) for (let i = 0; i < s.x.length; i++) if (isFinite(s.x[i]) && isFinite(s.y[i])) { xs.push(s.x[i]); ys.push(ty(s.y[i])); }
    for (const h of opt.hlines || []) ys.push(ty(h.y)); if (opt.threshold) ys.push(ty(opt.threshold.y));
    if (!xs.length) { xs = [0, 1]; ys = [0, 1]; }
    let x0 = opt.xlim ? opt.xlim[0] : Math.min(...xs), x1 = opt.xlim ? opt.xlim[1] : Math.max(...xs), y0 = opt.ylim ? ty(opt.ylim[0]) : Math.min(...ys), y1 = opt.ylim ? ty(opt.ylim[1]) : Math.max(...ys);
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1; if (!opt.ylim) { const pad = (y1 - y0) * 0.06; y0 -= pad; y1 += pad; }
    const X = v => m.l + (v - x0) / (x1 - x0) * pw, Yt = t => m.t + ph - (t - y0) / (y1 - y0) * ph, Y = v => Yt(ty(v));
    let z0 = 0, z1 = 1; if (opt.y2) { const zs = []; for (const s of opt.y2.series) for (const v of s.y) if (isFinite(v)) zs.push(v); z0 = opt.y2.lim ? opt.y2.lim[0] : Math.min(...zs, 0); z1 = opt.y2.lim ? opt.y2.lim[1] : Math.max(...zs, 1); if (z1 === z0) z1 = z0 + 1; }
    const Z = v => m.t + ph - (v - z0) / (z1 - z0) * ph;
    const p = [`<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" role="img" aria-label="${R2.esc(opt.ylab || "chart")}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="var(--plot-bg)"/>`];
    for (const sp of opt.spans || []) { const a = Math.max(X(sp.x0), m.l), b = Math.min(X(sp.x1), m.l + pw); if (b > a) p.push(`<rect x="${a}" y="${m.t}" width="${b - a}" height="${ph}" fill="${sp.color || "var(--plot-span)"}"/>`); }
    for (const t of ticks(x0, x1, Math.max(3, Math.round(pw / 90)))) p.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--plot-grid)"/><text x="${X(t)}" y="${m.t + ph + 15}" text-anchor="middle" font-size="11" fill="var(--muted)">${nice(t)}</text>`);
    const yt = opt.ylog ? (() => { const o = []; for (let d = Math.ceil(y0); d <= Math.floor(y1); d++) o.push(d); return o.length >= 2 ? o : ticks(y0, y1, 4); })() : ticks(y0, y1, 5);
    for (const t of yt) p.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${Yt(t)}" y2="${Yt(t)}" stroke="var(--plot-grid)"/><text x="${m.l - 6}" y="${Yt(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${opt.ylog ? nice(+Math.pow(10, t).toPrecision(2)) : nice(t)}</text>`);
    if (opt.y2) { for (const t of ticks(z0, z1, 5)) p.push(`<text x="${m.l + pw + 6}" y="${Z(t) + 4}" font-size="11" fill="var(--plot-y2)">${nice(t)}</text>`); p.push(`<text transform="translate(${W - 16} ${m.t + ph / 2}) rotate(90)" text-anchor="middle" font-size="11" fill="var(--plot-y2)">${R2.esc(opt.y2.label || "")}</text>`); }
    p.push(`<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="var(--plot-edge)"/>`);
    p.push(`<text x="${m.l + pw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${R2.esc(opt.xlab || "")}</text>`);
    p.push(`<text transform="translate(13 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="var(--muted)">${R2.esc(opt.ylab || "")}</text>`);
    p.push(`<clipPath id="cp${id}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath><g clip-path="url(#cp${id})">`);
    const path = (xa, ya, fy) => { let d = "", pen = false; for (let i = 0; i < xa.length; i++) { if (!isFinite(xa[i]) || !isFinite(ya[i])) { pen = false; continue; } d += (pen ? "L" : "M") + X(xa[i]).toFixed(1) + " " + fy(ya[i]).toFixed(1); pen = true; } return d; };
    if (opt.y2) for (const s of opt.y2.series) p.push(`<path d="${path(s.x, s.y, Z)}" fill="none" stroke="${s.color || "var(--plot-y2)"}" stroke-width="${s.width || 1.2}" stroke-dasharray="${s.dash || "2 3"}" opacity="0.9"/>`);
    for (const h of opt.hlines || []) p.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="${h.color || "var(--heat)"}" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${m.l + pw - 4}" y="${Y(h.y) - 4}" text-anchor="end" font-size="10.5" fill="${h.color || "var(--heat)"}">${R2.esc(h.label || "")}</text>`);
    opt.series.forEach((s, si) => {
      const col = s.color || "var(--s1)", k = s.key === undefined ? "" : ` data-k="${s.key}"`;
      if (s.band) { let top = "", bot = ""; for (let i = 0; i < s.x.length; i++) if (isFinite(s.band.lo[i]) && isFinite(s.band.hi[i])) { top += (top ? "L" : "M") + X(s.x[i]).toFixed(1) + " " + Y(s.band.hi[i]).toFixed(1); bot = "L" + X(s.x[i]).toFixed(1) + " " + Y(s.band.lo[i]).toFixed(1) + bot; } if (top) p.push(`<path class="ser band"${k} d="${top}${bot}Z" fill="${col}" opacity="0.16" stroke="none"/>`); }
      if (s.points) { for (let i = 0; i < s.x.length; i++) if (isFinite(s.x[i]) && isFinite(s.y[i])) p.push(`<circle class="ser"${k} cx="${X(s.x[i]).toFixed(1)}" cy="${Y(s.y[i]).toFixed(1)}" r="${s.r || 4}" fill="${col}" stroke="var(--plot-bg)" stroke-width="1.5"/>`); return; }
      p.push(`<path class="ser"${k} d="${path(s.x, s.y, Y)}" fill="none" stroke="${col}" stroke-width="${s.width || 1.8}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round" opacity="${s.opacity || 1}"/>`);
    });
    for (const mk of opt.markers || []) if (isFinite(mk.x) && isFinite(mk.y)) { const cx = X(mk.x), cy = Y(mk.y); p.push(`<path class="ser mk" data-k="${mk.key}" d="M${cx} ${cy - 5}L${cx + 5} ${cy}L${cx} ${cy + 5}L${cx - 5} ${cy}Z" fill="${mk.color}" stroke="var(--plot-bg)" stroke-width="1.2"/>`); }
    if (opt.cursorX !== undefined && isFinite(opt.cursorX)) p.push(`<line x1="${X(opt.cursorX)}" x2="${X(opt.cursorX)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--plot-cursor)" stroke-width="1.4"/>`);
    p.push(`</g>`);
    if (opt.threshold) { const yy = Y(opt.threshold.y); p.push(`<g class="thr" style="cursor:ns-resize"><line x1="${m.l}" x2="${m.l + pw}" y1="${yy}" y2="${yy}" stroke="var(--plot-thr)" stroke-dasharray="6 4" stroke-width="1.5"/><rect x="${m.l}" y="${yy - 7}" width="${pw}" height="14" fill="transparent"/><rect x="${m.l + pw - 9}" y="${yy - 6}" width="9" height="12" rx="2" fill="var(--plot-thr)"/><text x="${m.l + 6}" y="${yy - 5}" font-size="10.5" fill="var(--plot-thr)">${R2.esc(opt.threshold.label || "threshold")} ${nice(+opt.threshold.y.toPrecision(3))}</text></g>`); }
    p.push(`<line class="xh" pointer-events="none" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" stroke="var(--plot-cursor)" stroke-width="1" visibility="hidden"/><circle class="dot" pointer-events="none" r="4.5" fill="none" stroke="var(--plot-ink)" stroke-width="1.5" visibility="hidden"/></svg><div class="tip" hidden></div>`);
    el.classList.add("chart"); el.innerHTML = p.join("");
    const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector(".xh"), dot = el.querySelector(".dot");
    const setHi = key => { svg.querySelectorAll(".ser[data-k]").forEach(n => { const on = key === null || key === undefined || n.dataset.k === String(key); n.style.opacity = on ? "" : (n.classList.contains("band") ? "0.03" : "0.13"); if (!n.classList.contains("band") && !n.classList.contains("mk") && n.tagName === "path") n.style.strokeWidth = (key !== null && key !== undefined && on) ? "3" : ""; }); };
    if (opt.highlight !== undefined && opt.highlight !== null) setHi(opt.highlight);
    let dragging = false;
    const toData = ev => { const r = svg.getBoundingClientRect(); return { px: (ev.clientX - r.left) / r.width * W, py: (ev.clientY - r.top) / r.height * H, r }; };
    if (opt.threshold && opt.threshold.onChange) {
      const g = svg.querySelector(".thr");
      let val = null;
      const move = ev => { const { py } = toData(ev), tt = y0 + (m.t + ph - R2.clamp(py, m.t, m.t + ph)) / ph * (y1 - y0); val = opt.ylog ? Math.pow(10, tt) : tt; g.setAttribute("transform", `translate(0 ${Yt(tt) - Y(opt.threshold.y)})`); };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); dragging = false; if (val !== null) opt.threshold.onChange(val); };
      g.addEventListener("pointerdown", ev => { dragging = true; val = null; tip.hidden = true; ev.preventDefault(); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); });
    }
    svg.onmousemove = ev => {
      if (dragging) return; const { px, py, r } = toData(ev); let best = null;
      for (const s of opt.series) { if (s.noHover) continue; for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.x[i]) || !isFinite(s.y[i])) continue; const dx = X(s.x[i]) - px, dy = Y(s.y[i]) - py, dd = dx * dx + dy * dy; if (!best || dd < best.d) best = { d: dd, s, i }; } }
      if (!best || best.d > 2500) { hide(); return; }
      const cx = X(best.s.x[best.i]), cy = Y(best.s.y[best.i]);
      xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.setAttribute("visibility", "visible"); dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.hidden = false; tip.style.left = R2.clamp(cx / W * r.width, 70, r.width - 70) + "px"; tip.style.top = (cy / H * r.height) + "px";
      tip.innerHTML = (best.s.card ? best.s.card(best.i) : `<b>${R2.esc(best.s.label || "")}</b>`) + `<span>${R2.esc(opt.xshort || "x")} ${nice(+best.s.x[best.i].toPrecision(5))} · ${nice(+best.s.y[best.i].toPrecision(4))}</span>`;
      if (best.s.key !== undefined) { setHi(best.s.key); if (opt.onHover) opt.onHover(best.s.key); }
    };
    function hide() { tip.hidden = true; xh.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); setHi(opt.highlight === undefined ? null : opt.highlight); if (opt.onHover) opt.onHover(null); }
    svg.onmouseleave = hide;
    return { highlight: setHi };
  };
  R2.legend = items => `<div class="legend">${items.map(i => `<span><i style="background:${i[1]}"></i>${R2.esc(i[0])}</span>`).join("")}</div>`;
  R2.$ = id => document.getElementById(id);
  R2.roleColor = r => ({ standard: "var(--s1)", unknown: "var(--s2)", ntc: "var(--s3)", positive: "#a855f7" }[r] || "var(--s4)");
  // per-tube colours inside a role, so replicates can be told apart on the dark plot
  R2.wellColor = function (plate, w) { const base = { standard: 205, unknown: 22, ntc: 152, positive: 285 }[plate[w].role]; if (base === undefined) return "var(--s4)"; const same = plate.map((q, i) => q.role === plate[w].role ? i : -1).filter(i => i >= 0), k = same.indexOf(w), n = Math.max(1, same.length - 1); return `hsl(${base + (k / n - 0.5) * 34} 88% ${52 + (k % 2) * 12}%)`; };
  // planned block temperature against time for a protocol (ramps at the plant's typical rate), for previews and the live frame
  R2.planProfile = function (prog) {
    const t = [0], T = [25]; let now = 0, last = 25; const go = (target, rate) => { now += Math.abs(target - last) / rate; t.push(now); T.push(target); last = target; }, hold = s => { now += s; t.push(now); T.push(last); };
    // timings measured on the instrument model: lid heating about 56 s, ramps near 3.45 degC/s plus 0.75 s to settle
    const RATE = 3.45; hold(56);
    for (const s of prog.stages) {
      if (s.type === "melt") { go(s.from_c, RATE); hold(1); go(s.to_c, s.rate_c_per_s); hold(3); continue; }
      for (let cy = 1; cy <= (s.repeats || 1); cy++) for (let k = 0; k < s.steps.length; k++) { const T1 = R2.Firmware.prototype.stepTemp(s, k, cy); if (T1 !== last) { go(T1, Math.min(s.steps[k].ramp_c_per_s || RATE, RATE)); hold(0.75); } else hold(0.4); hold(R2.Firmware.prototype.stepHold(s, k, cy)); }
    }
    return { t, T, total: now };
  };
  R2.hms = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(ss).padStart(2, "0"); };
})(window.R2);
