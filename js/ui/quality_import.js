/* Quality-manager bench, second part: data from outside the simulator (example files of Auto-qPCR, Click-qPCR, rtpcr and
 * qPCR plate planner, or the laboratory's own exports). Analyse, then export RDMLt, the analysis JSON and the SOP of that
 * analysis. Analyses of the same kind with the same settings share one SOP. */
(function (R2) {
  "use strict";
  const $ = R2.$, X = () => R2.external, items = () => (R2.session.imports = R2.session.imports || []);
  let cur = null, res = null, inited = false, seq = 0;
  const fmt = (v, d = 2) => v === null || v === undefined || !isFinite(v) ? "–" : (+v).toFixed(d);
  const pv = p => p === null || p === undefined ? "–" : p < 0.001 ? "< 0.001" : p.toFixed(3);
  const slug = s => String(s).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60);
  // simple bar chart with error bars; groups along x, one bar per series inside a group
  function bars(el, cats, series, ylab, refLine) {
    const W = Math.max(330, Math.min(980, el.clientWidth || 640)), H = 280, m = { l: 56, r: 14, t: 12, b: 64 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    let hi = 0; for (const s of series) s.v.forEach((v, i) => { if (isFinite(v)) hi = Math.max(hi, v + (s.e && isFinite(s.e[i]) ? s.e[i] : 0)); }); hi = hi || 1; if (refLine) hi = Math.max(hi, refLine * 1.1);
    const step = Math.pow(10, Math.floor(Math.log10(hi / 4))), tick = [1, 2, 5, 10].map(k => k * step).find(t => hi / t <= 6), top = Math.ceil(hi / tick) * tick, Y = v => m.t + ph - v / top * ph;
    const gw = pw / cats.length, bw = Math.min(38, gw * 0.8 / series.length), p = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${R2.esc(ylab)}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="var(--plot-bg)"/>`];
    for (let t = 0; t <= top + 1e-9; t += tick) p.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--plot-grid)"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${R2.niceNum(t)}</text>`);
    if (refLine) p.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(refLine)}" y2="${Y(refLine)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`);
    cats.forEach((c, i) => { const x0 = m.l + gw * i + (gw - bw * series.length) / 2;
      series.forEach((s, k) => { const v = s.v[i]; if (!isFinite(v)) return; const x = x0 + k * bw, e = s.e && s.e[i];
        p.push(`<rect x="${x + 1}" y="${Y(v)}" width="${bw - 2}" height="${Math.max(0, m.t + ph - Y(v))}" rx="2" fill="${s.color}"><title>${R2.esc(s.name + " · " + c + ": " + fmt(v) + (isFinite(e) ? " ± " + fmt(e) : ""))}</title></rect>`);
        if (isFinite(e) && e > 0) p.push(`<path d="M${x + bw / 2} ${Y(v + e)}V${Y(Math.max(0, v - e))}M${x + bw / 2 - 4} ${Y(v + e)}h8M${x + bw / 2 - 4} ${Y(Math.max(0, v - e))}h8" stroke="var(--fg)" stroke-width="1.2" fill="none"/>`); });
      p.push(`<text x="${m.l + gw * i + gw / 2}" y="${m.t + ph + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${R2.esc(c.length > 16 ? c.slice(0, 15) + "…" : c)}</text>`); });
    p.push(`<text x="14" y="${m.t + ph / 2}" transform="rotate(-90 14 ${m.t + ph / 2})" text-anchor="middle" font-size="11" fill="var(--muted)">${R2.esc(ylab)}</text></svg>`);
    el.innerHTML = p.join("") + (series.length > 1 ? R2.legend(series.map(s => [s.name, s.color])) : "");
  }
  const COLORS = ["var(--s1)", "var(--s2)", "#a855f7", "var(--s3)", "var(--s4)", "var(--heat)"];
  const sopDocOf = it => X().sopDoc(it.ds, it.res || X().analyse(it.ds, it.kind, it.opts));
  const asSopItem = it => ({ name: it.name, sopDoc: () => sopDocOf(it) });
  R2.importSopItems = () => items().filter(it => it.kind).map(asSopItem);
  function add(bytes, file, extra) {
    const it = X().item(bytes, file, extra); it.no = ++seq; it.name = String(it.no).padStart(3, "0") + "_" + slug(it.name);
    if (extra && extra.kind && it.kinds.includes(extra.kind)) it.kind = extra.kind;
    items().push(it); open(it); return it;
  }
  function list() {
    const L = items(); $("x-n").textContent = L.length ? L.length + " data set" + (L.length > 1 ? "s" : "") : "none yet"; $("x-bulk").disabled = !L.some(it => it.kind); if ($("q-bulk-sop")) $("q-bulk-sop").disabled = !(R2.session.runs || []).length && !L.some(it => it.kind);
    $("x-list").innerHTML = L.length ? `<tr><th>No.</th><th class="l">Name</th><th class="l">Format</th><th class="l">Analysis</th><th class="l">SOP</th><th class="l">Files</th></tr>` + L.map(it => `<tr class="${it === cur ? "cur" : ""}"><td>${it.no}</td><td class="l"><b>${R2.esc(it.name)}</b><br><small>${R2.esc(it.file)}</small></td><td class="l">${R2.esc(it.ds.formatLabel)}</td><td class="l">${it.kind ? R2.esc(X().KIND_LABEL[it.kind]) : "none possible"}</td><td class="l"><code>${it.kind ? sopDocOf(it).sop_id : "–"}</code></td>
      <td class="l"><span class="row" style="gap:6px"><button data-xo="${it.no}">${it === cur ? "Shown below" : "Open"}</button><button data-xr="${it.no}" ${it.kind ? "" : "disabled"}>RDMLt</button><button data-xj="${it.no}" ${it.kind ? "" : "disabled"}>JSON</button><button data-xs="${it.no}" ${it.kind ? "" : "disabled"}>SOP</button><button data-xd="${it.no}">Remove</button></span></td></tr>`).join("")
      : `<tr><td class="l">Nothing imported yet. Load an example or import a file.</td></tr>`;
  }
  function settings() {
    const it = cur, o = it.opts = Object.assign(X().defaults(it.ds, it.kind), it.opts || {}), tg = X().targets(it.ds), gr = X().groups(it.ds, o.groupBy);
    $("x-kind").innerHTML = it.kinds.map(k => `<option value="${k}">${R2.esc(X().KIND_LABEL[k])}</option>`).join("") || `<option value="">no analysis possible</option>`; $("x-kind").value = it.kind || "";
    const show = (id, on) => { $(id).hidden = !on; };
    show("x-refs-w", it.kind === "ddcq"); show("x-ctl-w", it.kind === "ddcq"); show("x-grp-w", it.kind === "ddcq"); show("x-eff-w", it.kind === "ddcq"); show("x-genes-w", it.kind === "stability"); show("x-rise-w", it.kind === "curves");
    if (it.kind === "ddcq") { $("x-refs").innerHTML = tg.map(t => `<label class="c"><input type="checkbox" value="${R2.esc(t)}" ${o.refs.includes(t) ? "checked" : ""}> ${R2.esc(t)}</label>`).join("");
      $("x-ctl").innerHTML = gr.map(g => `<option>${R2.esc(g)}</option>`).join(""); if (!gr.includes(o.control)) o.control = gr.find(g => /control|ctrl|untreated|normal|d0|base/i.test(g)) || gr[0]; $("x-ctl").value = o.control;
      $("x-grp").innerHTML = (it.ds.rows.some(r => r.group) ? [["column", "group column of the file"]] : []).concat([["sample", "each sample is its own group"], ["suffix", "part of the sample name after the last - or _"], ["prefix", "part of the sample name before the first - or _"]]).map(([v, l]) => `<option value="${v}">${l}</option>`).join(""); $("x-grp").value = o.groupBy; $("x-eff").value = o.efficiency === "from data" ? "from data" : "2"; $("x-eff").options[1].disabled = !it.ds.rows.some(r => r.eff); }
    if (it.kind === "stability") $("x-genes").innerHTML = tg.map(t => `<label class="c"><input type="checkbox" value="${R2.esc(t)}" ${o.genes.includes(t) ? "checked" : ""}> ${R2.esc(t)}</label>`).join("");
    $("x-cut").value = o.cutoff; if (it.kind === "curves") $("x-rise").value = o.rise;
  }
  function analyse() {
    const it = cur; if (!it.kind) { res = null; it.res = null; $("x-res").innerHTML = `<p class="note">This file has no standards, no second target and no curves: nothing to analyse. Its values are listed below.</p>`; $("x-flags").innerHTML = ""; $("x-chart").innerHTML = ""; table(); return; }
    res = it.res = X().analyse(it.ds, it.kind, it.opts); const sop = sopDocOf(it);
    $("x-sop").textContent = sop.sop_id; R2.sop.note(sop.sop_id, sop.title, it.name);
    const lv = { fail: "bad", warn: "warn", info: "off", ok: "ok" };
    $("x-flags").innerHTML = res.findings.map(f => `<div class="flag"><span class="pill ${lv[f.level]}">${{ fail: "fail", warn: "check", info: "note", ok: "clear" }[f.level]}</span><span>${R2.esc(f.text)}</span></div>`).join("");
    const H = [];
    if (res.kind === "standard") {
      for (const t of res.targets) H.push(`<h4>${R2.esc(t.target)} <small>slope ${fmt(t.slope, 3)} · efficiency ${fmt(t.efficiency * 100, 1)} % · R² ${fmt(t.r2, 4)} · ${t.accepted ? '<span class="pill ok">within ENGL range</span>' : '<span class="pill warn">outside ENGL range</span>'}</small></h4>
        <div class="scroll"><table><tr><th class="l">Sample</th><th>n</th><th>Mean Cq</th><th>SD</th><th>Quantity</th><th class="l">Notes</th></tr>${t.samples.map(s => `<tr><td class="l">${R2.esc(s.sample)}</td><td>${s.n}</td><td>${fmt(s.cqMean)}</td><td>${fmt(s.cqSd)}</td><td>${s.quantity === null ? "–" : R2.sci(s.quantity)}</td><td class="l">${[s.removed.length ? "set aside " + s.removed.map(v => v.toFixed(2)).join(", ") : "", s.outside ? "outside standards" : ""].filter(Boolean).join("; ")}</td></tr>`).join("")}</table></div>`);
      const series = []; res.targets.forEach((t, i) => { const xs = [Math.log10(t.range[0]) - 0.3, Math.log10(t.range[1]) + 0.3]; series.push({ x: t.points.map(p => Math.log10(p.q)), y: t.points.map(p => p.cq), color: COLORS[i % 6], points: true, label: t.target + " standards" }, { x: xs, y: xs.map(x => t.intercept + t.slope * x), color: COLORS[i % 6], width: 1.2, dash: "4 3", noHover: true }, { x: t.samples.filter(s => s.quantity).map(s => Math.log10(s.quantity)), y: t.samples.filter(s => s.quantity).map(s => s.cqMean), color: COLORS[i % 6], points: true, r: 2.2, opacity: 0.5, label: t.target + " samples" }); });
      if (series.length) R2.chart($("x-chart"), { series, xlab: "log10 quantity", ylab: "Cq", height: 280 }); else $("x-chart").innerHTML = "";
    } else if (res.kind === "ddcq") {
      for (const g of res.genes || []) H.push(`<h4>${R2.esc(g.gene)} <small>against ${R2.esc(res.refs.join(" + "))}, control "${R2.esc(res.options.control)}"</small></h4><div class="scroll"><table><tr><th class="l">Group</th><th>n</th><th>ΔCq mean</th><th>SD</th><th>2^−ΔCq</th><th>ΔΔCq</th><th>Fold change</th><th>SD</th><th>Welch p</th></tr>${g.groups.map(x => `<tr><td class="l">${R2.esc(x.group)}</td><td>${x.n}</td><td>${fmt(x.dcqMean)}</td><td>${fmt(x.dcqSd)}</td><td>${fmt(x.relExpr, 4)}</td><td>${fmt(x.ddcqMean)}</td><td><b>${fmt(x.foldOfMean)}</b></td><td>${fmt(x.foldSd)}</td><td>${pv(x.p)}</td></tr>`).join("")}</table></div>`);
      const genes = res.genes || [], cats = [...new Set(genes.flatMap(g => g.groups.map(x => x.group)))];
      if (genes.length) bars($("x-chart"), cats, genes.map((g, i) => ({ name: g.gene, color: COLORS[i % 6], v: cats.map(c => { const x = g.groups.find(y => y.group === c); return x ? x.foldMean : NaN; }), e: cats.map(c => { const x = g.groups.find(y => y.group === c); return x ? x.foldSd : NaN; }) })), "fold change (2^−ΔΔCq), mean ± SD", 1); else $("x-chart").innerHTML = "";
    } else if (res.kind === "stability") {
      H.push(`<div class="scroll"><table><tr><th class="l">Gene, most stable first</th><th>geNorm M</th><th>Mean Cq</th><th>SD of Cq</th></tr>${res.genes.map(g => `<tr><td class="l">${R2.esc(g.gene)}</td><td><b>${fmt(g.M, 3)}</b></td><td>${fmt(g.cqMean)}</td><td>${fmt(g.cqSd)}</td></tr>`).join("")}</table></div><p class="note">${res.samples || 0} samples with every gene measured. M assumes 100 % efficiency.</p>`);
      if (res.genes.length) bars($("x-chart"), res.genes.map(g => g.gene), [{ name: "M", color: "var(--s1)", v: res.genes.map(g => g.M) }], "geNorm M (lower is more stable)", 1.5); else $("x-chart").innerHTML = "";
    } else if (res.kind === "curves") {
      H.push(`<p class="note">${res.wells.filter(w => w.cq !== null).length} of ${res.wells.length} curves amplified · duplicate SD ${fmt(res.replicateSd)} cycles over ${res.replicatePairs} pairs.</p><div class="scroll"><table><tr><th class="l">Tube</th><th class="l">Sample</th><th class="l">Target</th><th class="l">Role</th><th>Cq (${res.options.rise * 100} %)</th><th>Plateau / baseline</th><th class="l">Call</th></tr>${res.wells.map(w => `<tr><td class="l">${R2.esc(w.position)}</td><td class="l">${R2.esc(w.sample)}</td><td class="l">${R2.esc(w.target)}</td><td class="l">${w.role}</td><td>${fmt(w.cq)}</td><td>${fmt(w.plateauRatio)}</td><td class="l">${w.call}</td></tr>`).join("")}</table></div>`);
      const ds = it.ds; R2.chart($("x-chart"), { series: res.wells.map((w, i) => ({ key: i, x: ds.cycles, y: ds.curves[w.well], color: w.role === "ntc" || w.role === "blank" ? "var(--s3)" : w.role === "control" ? "#a855f7" : "var(--s2)", width: 1.3, card: () => `<b>${R2.esc(w.position + " · " + w.sample)}</b><span>${w.cq === null ? w.call : "Cq " + w.cq.toFixed(2)}</span>` })), xlab: "cycle", ylab: "fluorescence as exported", height: 300 });
    }
    $("x-res").innerHTML = H.join(""); table();
  }
  function table() {
    const it = cur, rows = it.ds.rows.slice(0, 400);
    $("x-table").innerHTML = `<tr><th class="l">Tube</th><th class="l">Sample</th><th class="l">Target</th><th class="l">Task</th><th>Quantity</th><th>Cq</th><th>Efficiency</th><th class="l">Group</th></tr>` + rows.map(r => `<tr${r.omit ? ' class="off"' : ""}><td class="l">${R2.esc(r.position || String(r.well + 1))}</td><td class="l">${R2.esc(r.label || r.sample)}</td><td class="l">${R2.esc(r.target)}</td><td class="l">${r.task}</td><td>${r.quantity === null ? "–" : R2.niceNum(r.quantity)}</td><td>${fmt(r.cq)}</td><td>${r.eff ? fmt(r.eff, 3) : "–"}</td><td class="l">${R2.esc(r.group || "")}</td></tr>`).join("") + (it.ds.rows.length > 400 ? `<tr><td class="l" colspan="8">… ${it.ds.rows.length - 400} more rows in the file</td></tr>` : "");
  }
  function open(it) {
    cur = it; $("x-body").hidden = false; $("x-title").textContent = it.name; const m = it.ds.meta;
    $("x-meta").innerHTML = `<dt>File</dt><dd>${R2.esc(it.file)}</dd><dt>Format</dt><dd>${R2.esc(it.ds.formatLabel)}</dd>${m.instrument ? `<dt>Instrument</dt><dd>${R2.esc(m.instrument)}</dd>` : ""}${m.experimentType ? `<dt>Experiment type</dt><dd>${R2.esc(m.experimentType)}</dd>` : ""}<dt>Rows</dt><dd>${it.ds.rows.length} (${X().targets(it.ds).length} targets)</dd><dt>SHA-256</dt><dd style="overflow-wrap:anywhere"><code>${it.sha256}</code></dd>${it.sourceNote ? `<dt>Source</dt><dd>${R2.esc(it.sourceNote)}</dd>` : ""}`;
    settings(); analyse(); list();
  }
  const byNo = n => items().find(it => it.no === +n);
  const dl = { rdmlt: (it, b) => R2.downloadAsync(b, slug(it.name) + ".rdmlt", () => R2.importRdmltCompressed(it, it.res || X().analyse(it.ds, it.kind, it.opts))),
    json: it => R2.download(slug(it.name) + "_analysis.json", X().json(it, it.res || X().analyse(it.ds, it.kind, it.opts)), "application/json"),
    sop: it => { const d = sopDocOf(it); R2.download(d.sop_id + ".json", JSON.stringify(d, null, 1), "application/json"); } };
  R2.ui = R2.ui || {};
  R2.ui.qualityImport = { show() {
    if (inited) return list(); inited = true;
    $("x-ex").innerHTML = (R2.EXAMPLES || []).map(e => `<option value="${e.id}">${R2.esc(e.title)}</option>`).join("");
    $("x-load").onclick = () => { const e = R2.EXAMPLES.find(x => x.id === $("x-ex").value); if (!e) return; try { const it = add(R2.utf8(e.text), e.file, { sourceNote: e.source, kind: e.kind }); it.opts = Object.assign(X().defaults(it.ds, it.kind), e.opts || {}); open(it); $("x-msg").textContent = ""; } catch (err) { $("x-msg").textContent = "Could not read the example: " + err.message; } };
    $("x-imp").onclick = () => $("x-file").click();
    $("x-file").onchange = async e => { const fs = [...e.target.files]; e.target.value = ""; const bad = [];
      for (const f of fs) { try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (/\.rdmlt$/i.test(f.name)) {
          const run = await R2.importWorkbenchRun(bytes);
          const runs = R2.session.runs ||= [];
          const prior = runs.find(r => r.runId === run.runId && r.sampleIdentity?.id === run.sampleIdentity?.id);
          if (!prior) {
            run.no = R2.session.runNo = (R2.session.runNo || 0) + 1;
            runs.push(run);
          }
          R2.session.run = prior || run;
          R2.ui.quality.show();
        } else add(bytes, f.name);
      } catch (err) { bad.push(f.name + ": " + err.message); } }
      $("x-msg").textContent = bad.length ? "Not imported: " + bad.join(" · ") : fs.length + " file(s) imported."; list(); };
    $("x-list").onclick = e => { const b = e.target.closest("button"); if (!b) return; const d = b.dataset, it = byNo(d.xo || d.xr || d.xj || d.xs || d.xd); if (!it) return;
      if (d.xo) open(it); else if (d.xr) dl.rdmlt(it, b); else if (d.xj) dl.json(it); else if (d.xs) dl.sop(it);
      else { R2.session.imports = items().filter(x => x !== it); if (cur === it) { cur = null; $("x-body").hidden = true; } list(); } };
    $("x-kind").onchange = () => { cur.kind = $("x-kind").value; cur.opts = null; settings(); analyse(); list(); };
    const upd = () => { const o = cur.opts; o.cutoff = Math.max(0.05, +$("x-cut").value || 0.3);
      if (cur.kind === "ddcq") { o.refs = [...$("x-refs").querySelectorAll("input:checked")].map(i => i.value); if (o.groupBy !== $("x-grp").value) { o.groupBy = $("x-grp").value; o.control = null; } else o.control = $("x-ctl").value; o.efficiency = $("x-eff").value === "from data" ? "from data" : "100 % (E = 2)"; }
      if (cur.kind === "stability") o.genes = [...$("x-genes").querySelectorAll("input:checked")].map(i => i.value);
      if (cur.kind === "curves") o.rise = R2.clamp(+$("x-rise").value || 0.1, 0.02, 0.5);
      if (cur.kind === "ddcq" && !o.control) settings(); analyse(); list(); };
    ["x-cut", "x-ctl", "x-eff", "x-rise", "x-grp"].forEach(id => $(id).addEventListener("change", upd)); $("x-refs").addEventListener("change", upd); $("x-genes").addEventListener("change", upd);
    $("x-rdmlt").onclick = () => dl.rdmlt(cur, $("x-rdmlt")); $("x-json").onclick = () => dl.json(cur); $("x-sopbtn").onclick = () => dl.sop(cur);
    $("x-bulk").onclick = () => R2.downloadAsync($("x-bulk"), "MISSY_R2_imported_" + new Date().toISOString().slice(0, 10) + ".zip", async () => {
      const files = []; for (const it of items().filter(x => x.kind)) { const r = it.res || X().analyse(it.ds, it.kind, it.opts); files.push({ name: slug(it.name) + "/" + slug(it.name) + ".rdmlt", data: R2.importRdmltBytes(it, r) }, { name: slug(it.name) + "/" + slug(it.name) + "_analysis.json", data: R2.utf8(X().json(it, r)) }); }
      for (const [id, e] of R2.sop.unique(R2.importSopItems())) files.push({ name: "SOPs/" + id + ".json", data: R2.utf8(JSON.stringify(e.doc, null, 1)) });
      return R2.zip(files); });
    list();
  } };
})(window.R2);
