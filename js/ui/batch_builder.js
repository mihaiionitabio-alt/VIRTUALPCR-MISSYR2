/* Home page: "Run a JSON profile" and "Build a JSON profile" (js/ui/batch_runs.js does the work).
 * Builder: every Technician Administrator option as check boxes, radio buttons, lists and fields; several run groups,
 * each repeated n times; a live check of each group against the bench (capacity, assays, programme, SOP identity);
 * the profile as JSON beside it, downloadable and reloadable. A ticked box means "set this value"; an unticked box
 * keeps what the template or the method record gives, so a profile states only what it changes.
 * Runner: load or paste a profile, check it, generate the runs with progress, then open them on the Quality bench. */
(function (R2) {
  "use strict";
  const B = R2.batchRuns,
    esc = R2.esc,
    today = () => new Date().toISOString().slice(0, 10);
  const clone = (v) =>
    v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  let dlg = null;
  function dialog() {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "batch-dialog";
      dlg.setAttribute("aria-labelledby", "batch-title");
      document.body.append(dlg);
      dlg.addEventListener("close",()=>{for(const key of ["builder","builder-reset","runner"])R2.annunciator?.clearSource(key);});
      dlg.addEventListener("cancel", (e) => {
        if (B.busy()) e.preventDefault();
      });
    }
    return dlg;
  }
  const shell = (title, kicker, body) =>
    `<div class="batch-shell"><div class="batch-top"><button type="button" class="picker-back batch-close">← Go back</button><span class="task-kicker">${esc(kicker)}</span></div><h1 id="batch-title">${esc(title)}</h1>${body}</div>`;
  const close = () => {
    if (!B.busy() && dlg && dlg.open) dlg.close();
    // alerts belong to the editor that raised them
    R2.annunciator?.clearSource("builder");
    R2.annunciator?.clearSource("builder-reset");
    R2.annunciator?.clearSource("runner");
    R2.annunciator?.clearSource("voice-import");
  };
  function readFile(input) {
    return new Promise((res, rej) => {
      const f = input.files[0];
      input.value = "";
      if (!f) return rej(new Error("No file chosen."));
      f.text().then(res, rej);
    });
  }

  /* ============================== Builder ============================== */
  let builderMode = "assisted";
  let prof = null,
    gi = 0;
  const openSecs = new Map(); // sections the user opened or closed stay so across redraws
  const blank = () => ({
    name: "",
    repeat: 1,
    template: "TPL-BUILTIN-SIMPLEX-SC-SOY",
    // sample 1 follows the template; a seeded material would override another species' template
    samples: [{ extractionDate: today() }],
  });
  function fromProfile(p) {
    // defaults are folded into each group for editing; the saved profile states each group in full
    p = B.normalize(p);
    const d = p.defaults || {};
    const merged = (a, b) => {
      const o = clone(a) || {};
      for (const [k, v] of Object.entries(b || {}))
        o[k] =
          isObj(v) && isObj(o[k]) && k !== "template"
            ? merged(o[k], v)
            : clone(v);
      return o;
    };
    return {
      format: B.FORMAT,
      name: p.name || "My run profile",
      description: p.description || "",
      created: p.created || new Date().toISOString(),
      createdWith: p.createdWith || "VIRTUALPCR/MISSYR2 " + R2.VERSION,
      output: Object.assign(
        { openQuality: true, selectForMissy: true, downloadRdmltZip: false },
        p.output || {},
      ),
      runs: (p.runs || [blank()]).map((g) => {
        return merged(d, g);
      }),
    };
  }
  const out = () => ({
    format: B.FORMAT,
    name: prof.name,
    description: prof.description || undefined,
    created: prof.created,
    createdWith: prof.createdWith,
    runs: prof.runs.map(compact),
    output: prof.output,
  });
  function compact(g) {
    const o = {};
    for (const [k, v] of Object.entries(g)) {
      if (v === undefined || v === "" || (isObj(v) && !Object.keys(v).length))
        continue;
      o[k] = v;
    }
    return o;
  }
  const sel = (name, value, opts, attrs = "") =>
    `<select name="${name}" ${attrs}>${opts.map(([v, t, dis]) => `<option value="${esc(String(v))}" ${String(v) === String(value) ? "selected" : ""} ${dis ? "disabled" : ""}>${esc(t)}</option>`).join("")}</select>`;
  function field(row, value, prefix, effective) {
    const on = value !== undefined,
      name = prefix + "." + row.k,
      v = on ? value : effective;
    const ctl =
      row.type === "bool"
        ? `<input type="checkbox" name="${name}" ${v ? "checked" : ""} ${on ? "" : "disabled"}>`
        : row.type === "select"
          ? sel(
              name,
              v,
              row.options.map((o) => [o, String(o)]),
              on ? "" : "disabled",
            )
          : `<input type="number" name="${name}" min="${row.min}" max="${row.max}" step="${row.step}" value="${v === null || v === undefined ? (prefix === "controls" ? 1 : "") : v}" ${on ? "" : "disabled"} ${row.nullable ? 'placeholder="record"' : ""}>`;
    return `<label class="bf-row"><input type="checkbox" data-set="${name}" ${on ? "checked" : ""} aria-label="Set ${esc(row.label)}"><span>${esc(row.label)}</span>${ctl}</label>`;
  }
  function groupsHtml() {
    const baseline = prof.runs[0];
    return prof.runs
      .map((g, i) => {
        const changes = [];
        for (const area of ["reagents", "programme", "dna", "mix"])
          for (const [k, v] of Object.entries(isObj(g[area]) ? g[area] : {}))
            if (JSON.stringify(v) !== JSON.stringify(baseline[area]?.[k]))
              changes.push(k + " = " + v);
        if (g.errorScenario) changes.push(g.errorScenario);
        return `<button type="button" role="tab" class="bf-tab" data-g="${i}" aria-selected="${i === gi}"><strong>${i + 1}. ${esc(g.name || "Configuration " + (i + 1))}</strong><span>${g.repeat || 1} ${(g.repeat || 1) === 1 ? "file" : "files"}</span><small>${esc(changes.join("; ") || (i ? "Same settings as baseline" : "Baseline"))}</small></button>`;
      })
      .join("");
  }
  function formHtml(g, pv) {
    const D = R2.GMO,
      T = R2.templates,
      info = pv.info || {},
      crop = info.crop || "soybean";
    const tpl = typeof g.template === "string" ? g.template : "";
    const mats = D.samples.filter(
      (s) => s.blind || !info.crop || s.crop === crop,
    );
    const allMats = D.samples.map((s) => [
      s.key,
      s.blind ? "Blind sample" : s.crop + " · " + s.label,
    ]);
    const s = g.samples || [{}],
      s1 = s[0] || {};
    const stage = g.stage,
      stageIds = info.stageIds || [],
      chosen = g.assays || info.assays || [];
    const single =
      info.procedure &&
      (R2.MARA.isLayout(info.procedure) || info.stage === "quant");
    const events = D.events.filter((e) => e.crop === crop);
    const FXL = R2.qpcrFaults ? R2.qpcrFaults.LIST : [],
      cats = R2.qpcrFaults ? R2.qpcrFaults.CATEGORIES : {};
    const sec = (title, body, open = false) => {
      const key = title.split(" ")[0],
        on = openSecs.has(key) ? openSecs.get(key) : open;
      return `<details class="bf-sec" data-sec="${key}" ${(openSecs.has(key) ? on : key === "1") ? "open" : ""}><summary>${esc(title)}</summary><div class="bf-body">${body}</div></details>`;
    };
    return [
      sec(
        "1 · Run",
        `<div class="bf-grid"><label>Name of the run <input name="name" value="${esc(g.name || "")}" placeholder="${esc(info.defaultName || "screening soybean")}" maxlength="60"><small>Placeholders: {i} repeat, {n} position in the batch, {group}, {seed}, {material}, {stage}</small></label>
        <label>Repeat this group <input type="number" name="repeat" min="1" max="${B.MAX_RUNS}" value="${g.repeat || 1}"> runs</label>
        <label class="bf-row"><input type="checkbox" data-set="seed" ${g.seed !== undefined ? "checked" : ""}><span>Seed</span><input type="number" name="seed" min="1" max="99999" value="${g.seed ?? info.seed ?? 7}" ${g.seed !== undefined ? "" : "disabled"}></label>
        <label>Seed step between repeats <input type="number" name="seedStep" min="0" max="9999" value="${g.seedStep || 0}"><small>0 = same seed; runs still differ by natural variation</small></label>
        <fieldset class="bf-radio"><legend>Natural variation between tubes and runs</legend>${[
          ["", "as the template (default on)"],
          ["true", "on"],
          ["false", "off: same seed, same tubes, every run"],
        ]
          .map(
            ([v, t]) =>
              `<label><input type="radio" name="naturalVariation" value="${v}" ${String(g.naturalVariation ?? "") === v ? "checked" : ""}> ${t}</label>`,
          )
          .join("")}</fieldset></div>`,
      ),
      sec(
        "2 · Template",
        `<fieldset class="bf-radio bf-list"><legend>Start from</legend><label><input type="radio" name="template" value="" ${!tpl ? "checked" : ""}> No template: material, step and procedure below</label>${T.list()
          .filter((t) => !t.programmeOnly)
          .map(
            (t) =>
              `<label><input type="radio" name="template" value="${esc(t.id)}" ${tpl === t.id ? "checked" : ""}> ${t.builtIn ? "Built-in" : "Saved"} · ${esc(t.name)}</label>`,
          )
          .join("")}</fieldset>
        ${isObj(g.template) ? `<p class="note">This group carries an embedded template (${esc(g.template.name || "unnamed")}). Choose another option to replace it.</p>` : ""}`,
      ),
      sec(
        "3 · Analysis",
        `<div class="bf-grid"><label>Simulated material of sample 1 ${sel("material", g.material || s1.material || "", [["", "as the template"], ...allMats])}</label>
        <fieldset class="bf-radio"><legend>Analysis step</legend><label><input type="radio" name="stage" value="" ${!stage ? "checked" : ""}> as the template</label>${Object.entries(
          B.STAGES,
        )
          .map(
            ([v, t]) =>
              `<label><input type="radio" name="stage" value="${v}" ${stage === v ? "checked" : ""}> ${esc(t)}</label>`,
          )
          .join("")}</fieldset>
        <fieldset class="bf-radio"><legend>Procedure</legend><label><input type="radio" name="procedure" value="" ${!g.procedure ? "checked" : ""}> as the template / step default</label>${B.proceduresFor(
          info.stage || "screen",
          crop,
        )
          .map(
            (v) =>
              `<label><input type="radio" name="procedure" value="${v}" ${g.procedure === v ? "checked" : ""}> ${esc(B.procedureName(v, info.stage || "screen"))}</label>`,
          )
          .join("")}</fieldset>
        <fieldset class="bf-radio bf-list"><legend>Assays ${single ? "(one per run)" : ""} <label class="bf-inline"><input type="checkbox" data-set="assays" ${g.assays ? "checked" : ""}> choose</label></legend>${
          info.procedure === "simplex"
            ? `<p class="note">Simplex screening uses P-35S, T-nos and the reference gene.</p>`
            : stageIds
                .map(
                  (id) =>
                    `<label><input type="${single ? "radio" : "checkbox"}" name="assays" value="${id}" ${chosen.includes(id) ? "checked" : ""} ${g.assays ? "" : "disabled"}> ${esc(R2.gmoplan.name(id))} <small>${id}</small></label>`,
                )
                .join("")
        }</fieldset>
        <label class="bf-row"><input type="checkbox" data-set="duplex" ${g.duplex !== undefined ? "checked" : ""}><span>P-35S and T-nos as the validated duplex</span><input type="checkbox" name="duplex" ${(g.duplex ?? info.duplex) ? "checked" : ""} ${g.duplex !== undefined ? "" : "disabled"}></label></div>`,
      ),
      sec(
        "4 · Samples",
        `<div class="bf-grid"><label>Number of samples <input type="number" name="sampleCount" min="1" max="${info.maxSamples || 19}" value="${s.length}"><small>at most ${info.maxSamples || "…"} with these mixes · each sample: ${g.design?.extractions ?? 3} extracts × ${g.design?.replicates ?? 3} PCR replicates</small></label></div>
        <div class="scroll"><table class="bf-table"><tr><th>No.</th><th class="l">Material</th><th class="l">DNA extraction date</th><th class="l">Name (optional)</th></tr>${s
          .map(
            (
              x,
              i,
            ) => `<tr><td>${i + 1}</td><td class="l">${i === 0 ? "sample 1 (section 3)" : sel("s." + i + ".material", x.material || "", [["", "same as sample 1"], ...mats.map((m) => [m.key, m.blind ? "Blind sample" : m.label])])}</td>
          <td class="l"><input type="date" name="s.${i}.extractionDate" value="${esc(x.extractionDate || "")}"></td><td class="l"><input name="s.${i}.label" maxlength="100" value="${esc(x.label || "")}"></td></tr>`,
          )
          .join("")}</table></div>
        <h4>Composition of sample 1 <small>unticked: the material preset</small></h4>
        <label class="bf-row"><input type="checkbox" data-set="gm" ${s1.gm ? "checked" : ""}><span>GM events in % of genome copies</span><span></span></label>
        <div class="bf-grid bf-events">${events.map((e) => `<label>${esc(e.name)} <input type="number" name="gm.${esc(e.name)}" min="0" max="100" step="0.01" value="${s1.gm ? s1.gm[e.name] || 0 : 0}" ${s1.gm ? "" : "disabled"}> %</label>`).join("")}</div>
        ${B.FIELDS.sample1.map((r) => field(r, s1[r.k], "s1", r.k === "fragmentBp" ? 2000 : 0)).join("")}`,
      ),
      sec(
        "4a · Extractions, PCR replicates and controls",
        `<div class="bf-grid"><label>Independent DNA extractions per sample<input type="number" name="design.extractions" min="1" max="12" value="${g.design?.extractions ?? 3}"></label><label>PCR replicates per extraction<input type="number" name="design.replicates" min="1" max="12" value="${g.design?.replicates ?? 3}"></label></div><p class="note">Each sample uses ${(g.design?.extractions ?? 3) * (g.design?.replicates ?? 3)} wells per reaction mix. Control overrides are counts per applicable mix (simplex reference-gene mixes have no run controls); calibrants use this count at every existing level. Unticked controls retain the template. Zero deliberately omits that control; original method acceptance rules are not relaxed.</p><div class="bf-grid">${Object.entries(
          {
            PC: "Positive control",
            NC: "Non-GM control",
            NTC: "No-template control",
            BLK: "Extraction blank",
            LOD: "Positive control at LOD",
            POS: "Positive sample",
            CAL: "Replicates per calibrant level",
          },
        )
          .map(([code, label]) =>
            field(
              { k: code, label, type: "number", min: 0, max: 12, step: 1 },
              g.design?.controlCounts?.[code],
              "controls",
              undefined,
            ),
          )
          .join("")}</div>`,
      ),
      sec(
        "5 · DNA extract",
        B.FIELDS.dna
          .map((r) =>
            field(r, (g.dna || {})[r.k], "dna", r.k === "volUl" ? 5 : 40),
          )
          .join("") +
          `<p class="note">DNA per reaction now: <b>${info.ng ?? "…"} ng</b>.</p>`,
      ),
      sec(
        "6 · Primers, probe, storage and handling",
        ["Primers and probe", "Storage", "Bench and room"]
          .map(
            (grp) =>
              `<h4>${grp}</h4>` +
              B.FIELDS.reagents
                .filter((r) => r.group === grp)
                .map((r) =>
                  field(
                    r,
                    (g.reagents || {})[r.k],
                    "reagents",
                    R2.reagents.DEFAULT[r.k],
                  ),
                )
                .join(""),
          )
          .join(""),
        false,
      ),
      sec(
        "7 · Programme",
        `<fieldset class="bf-radio"><legend>Cycling programme</legend>${[
          [
            "template",
            "from the template, or the method record when there is none",
          ],
          ["method", "from the method record"],
          ["custom", "custom values below"],
        ]
          .map(
            ([v, t]) =>
              `<label><input type="radio" name="programmeMode" value="${v}" ${(isObj(g.programme) ? "custom" : g.programme || "template") === v ? "checked" : ""}> ${t}</label>`,
          )
          .join("")}</fieldset>
        ${B.FIELDS.programme.map((r) => field(r, isObj(g.programme) ? g.programme[r.k] : undefined, "programme", (info.programme || {})[r.k])).join("")}<p class="note">${info.minutes ? info.minutes + " instrument minutes" : ""}</p>`,
        false,
      ),
      sec(
        "8 · Reaction-mix calculator",
        B.FIELDS.mix
          .map((r) =>
            field(r, (g.mix || {})[r.k], "mix", R2.mixcalc.DEFAULT[r.k]),
          )
          .join(""),
        false,
      ),
      sec(
        "9 · Reference-material extraction times",
        (info.stocks || []).length
          ? info.stocks
              .map((n) => {
                const v = (g.referenceExtractions || {})[n];
                return `<label class="bf-row"><input type="checkbox" data-set="rx.${esc(n)}" ${v ? "checked" : ""}><span>${esc(n)}</span><input type="datetime-local" name="rx.${esc(n)}" value="${v ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}" ${v ? "" : "disabled"}></label>`;
              })
              .join("")
          : `<p class="note">No reference material on this plate.</p>`,
        false,
      ),
      sec(
        "10 · qPCR error scenario",
        `<fieldset class="bf-radio bf-list"><legend>Training scenario for these runs</legend><label><input type="radio" name="errorScenario" value="" ${!g.errorScenario ? "checked" : ""}> none: normal runs</label>
        ${Object.keys(cats)
          .map(
            (c) =>
              `<p class="bf-cat">${esc(c + " · " + cats[c])}</p>` +
              FXL.filter((x) => x.cat === c)
                .map(
                  (x) =>
                    `<label title="${esc(x.mechanism)}"><input type="radio" name="errorScenario" value="${x.id}" ${g.errorScenario === x.id ? "checked" : ""} ${R2.qpcrFaults.runnable(x) ? "" : "disabled"}> ${esc(x.title)} <small>${esc(x.kind)}</small></label>`,
                )
                .join(""),
          )
          .join("")}</fieldset>`,
        false,
      ),
    ].join("");
  }
  function checksHtml(pv) {
    const i = pv.info,
      total = prof.runs.reduce((n, g) => n + (g.repeat || 1), 0);
    return `<div class="bf-check"><h3>Group ${gi + 1} on the bench</h3>
      ${pv.errors.length ? pv.errors.map((e) => `<div class="flag"><span class="pill bad">fix</span><span>${esc(e)}</span></div>`).join("") : `<div class="flag"><span class="pill ok">ready</span><span>The bench accepts this group.</span></div>`}
      ${pv.warnings.map((e) => `<div class="flag"><span class="pill warn">note</span><span>${esc(e)}</span></div>`).join("")}
      ${
        i
          ? `<dl class="kv"><dt>Template</dt><dd>${esc(i.template || "none")}</dd><dt>Species</dt><dd>${esc(i.crop)}</dd><dt>Step / procedure</dt><dd>${esc(i.stage)} · ${esc(B.procedureName(i.procedure, i.stage))}</dd><dt>Assays</dt><dd>${esc(i.assays.join(", "))}</dd>
        <dt>Samples</dt><dd>${i.samples} of at most ${i.maxSamples} · ${i.wells} of 384 wells</dd><dt>DNA per well</dt><dd>${i.ng} ng</dd><dt>Programme</dt><dd>${i.programme.cycles} cycles, ${i.programme.annT} °C ${i.programme.annS} s · ${i.minutes} min</dd><dt>SOP</dt><dd><code>${esc(i.sop)}</code></dd></dl>`
          : ""
      }
      <p class="note">Profile: ${prof.runs.length} group${prof.runs.length > 1 ? "s" : ""}, <b>${total} run${total > 1 ? "s" : ""}</b>${total > B.WARN_RUNS ? " — many runs: each keeps its raw record in this tab" : ""}.</p></div>`;
  }
  function drawBuilder() {
    // commit a field still being edited before its node is replaced (its change event redraws first)
    const act = document.activeElement;
    if (dlg && act && act !== document.body && dlg.contains(act) && act.blur)
      act.blur();
    const g = prof.runs[gi],
      pv = B.preview(g, 0);
    const d = dialog();
    d.classList.toggle("visual-builder", builderMode === "visual");
    d.innerHTML = shell(
      "Build a JSON run profile",
      "TECHNICIAN ADMINISTRATOR OPTIONS · JSON",
      `
      <div class="bf-head"><label>Profile name <input id="bf-name" value="${esc(prof.name)}" maxlength="80"></label><label>Description <input id="bf-desc" value="${esc(prof.description || "")}" maxlength="300"></label>
        <fieldset class="bf-radio bf-inline-set"><legend>After the runs</legend><label><input type="checkbox" id="bf-o-q" ${prof.output.openQuality ? "checked" : ""}> open the Quality manager</label><label><input type="checkbox" id="bf-o-m" ${prof.output.selectForMissy ? "checked" : ""}> tick the new runs for MISSY</label><label><input type="checkbox" id="bf-o-z" ${prof.output.downloadRdmltZip ? "checked" : ""}> download their RDMLt files (.zip)</label></fieldset></div>
      <div class="bf-groups" role="tablist" aria-label="Run groups">${groupsHtml()}<button type="button" id="bf-add">+ Add group</button><button type="button" id="bf-dup">Duplicate</button><button type="button" id="bf-del" ${prof.runs.length < 2 ? "disabled" : ""}>Remove</button></div>
      <div class="bf-cols"><form id="bf-form" class="bf-form" autocomplete="off">${formHtml(g, pv)}</form>
        <aside class="bf-side">${checksHtml(pv)}
          <details class="bf-code"><summary>Profile JSON · view or edit</summary><textarea id="bf-json" spellcheck="false" aria-label="Profile JSON">${esc(JSON.stringify(out(), null, 2))}</textarea>
          <div class="row"><button type="button" id="bf-dl" class="primary">Download profile (.json)</button><button type="button" id="bf-load">Load profile…</button><button type="button" id="bf-text">Use edited JSON</button><button type="button" id="bf-copy">Copy</button><input type="file" id="bf-file" accept=".json,application/json" hidden></div>
          </details><div class="row"><button type="button" id="bf-run" class="primary" ${prof.runs.every((x) => !B.preview(x).errors.length) ? "" : "disabled"}>Generate these runs now</button><button type="button" id="bf-new">New profile</button></div>
          <p class="note" id="bf-msg" role="status"></p></aside></div>`,
    );
    if (!d.open) d.showModal();
    wireBuilder();
    R2.profileStudio?.decorate(d, builderMode);
    // the same checks as the audio interview feed the alert panel (SOP correlation included)
    const vr = R2.profileStudio?.validate(out());
    if (vr) R2.annunciator?.sync("builder", vr.alerts);
  }
  function setPath(g, path, value) {
    const [head, ...rest] = path.split(".");
    if (head === "controls") {
      g.design = g.design || {};
      g.design.controlCounts = g.design.controlCounts || {};
      if (value === undefined) delete g.design.controlCounts[rest[0]];
      else g.design.controlCounts[rest[0]] = value;
      return;
    }
    if (head === "s1") {
      g.samples = g.samples || [{}];
      if (value === undefined) delete g.samples[0][rest[0]];
      else g.samples[0][rest[0]] = value;
      return;
    }
    if (head === "rx") {
      g.referenceExtractions = g.referenceExtractions || {};
      const k = rest.join(".");
      if (value === undefined) delete g.referenceExtractions[k];
      else g.referenceExtractions[k] = value;
      if (!Object.keys(g.referenceExtractions).length)
        delete g.referenceExtractions;
      return;
    }
    if (!rest.length) {
      if (value === undefined) delete g[head];
      else g[head] = value;
      return;
    }
    if (head === "programme" && !isObj(g.programme)) g.programme = {};
    g[head] = g[head] || {};
    if (value === undefined) delete g[head][rest[0]];
    else g[head][rest[0]] = value;
    if (!Object.keys(g[head]).length) delete g[head];
  }
  const rowOf = (path) => {
    if (path.startsWith("design.")) return { type: "number", min: 1, max: 12 };
    if (path.startsWith("controls."))
      return { type: "number", min: 0, max: 12 };
    const [h, k] = path.split(".");
    const t = h === "s1" ? B.FIELDS.sample1 : B.FIELDS[h];
    return t ? t.find((r) => r.k === k) : null;
  };
  function valueOf(el, row) {
    if (el.type === "checkbox") return el.checked;
    if (row && row.type === "select") {
      const o = row.options.find((x) => String(x) === el.value);
      return o;
    }
    if (el.type === "number")
      return el.value === ""
        ? row && row.nullable
          ? null
          : undefined
        : +el.value;
    return el.value;
  }
  function wireBuilder() {
    const d = dlg,
      $q = (s) => d.querySelector(s),
      g = () => prof.runs[gi],
      redraw = () => {
        const y = $q(".bf-form") ? $q(".bf-form").scrollTop : 0;
        drawBuilder();
        const f = $q(".bf-form");
        if (f) f.scrollTop = y;
      };
    $q(".batch-close").onclick = close;
    $q("#bf-name").onchange = (e) => {
      prof.name = e.target.value.trim() || "My run profile";
      redraw();
    };
    $q("#bf-desc").onchange = (e) => {
      prof.description = e.target.value.trim();
      redraw();
    };
    [
      ["#bf-o-q", "openQuality"],
      ["#bf-o-m", "selectForMissy"],
      ["#bf-o-z", "downloadRdmltZip"],
    ].forEach(([id, k]) => {
      $q(id).onchange = (e) => {
        prof.output[k] = e.target.checked;
        redraw();
      };
    });
    $q(".bf-groups").onclick = (e) => {
      const b = e.target.closest("[data-g]");
      if (b) {
        gi = +b.dataset.g;
        redraw();
      }
    };
    $q("#bf-add").onclick = () => {
      prof.runs.push(blank());
      gi = prof.runs.length - 1;
      redraw();
    };
    $q("#bf-dup").onclick = () => {
      const c = clone(g());
      c.name = (c.name || "group") + " copy";
      prof.runs.splice(gi + 1, 0, c);
      gi++;
      redraw();
    };
    $q("#bf-del").onclick = () => {
      if (prof.runs.length > 1) {
        prof.runs.splice(gi, 1);
        gi = Math.max(0, gi - 1);
        redraw();
      }
    };
    const form = $q("#bf-form");
    form
      .querySelectorAll("details[data-sec]")
      .forEach((dt) =>
        dt.addEventListener("toggle", () =>
          openSecs.set(dt.dataset.sec, dt.open),
        ),
      );
    form.onsubmit = (e) => e.preventDefault();
    form.addEventListener("change", (e) => {
      const el = e.target,
        G = g();
      if (el.dataset.set !== undefined) {
        // tick = set the value shown; untick = back to template / record
        const path = el.dataset.set;
        if (path === "assays") {
          if (el.checked)
            G.assays = [...form.querySelectorAll('[name="assays"]')]
              .filter((x) => x.checked)
              .map((x) => x.value);
          else delete G.assays;
          if (G.assays && !G.assays.length)
            G.assays = [form.querySelector('[name="assays"]')?.value].filter(
              Boolean,
            );
        } else if (path === "gm") {
          G.samples = G.samples || [{}];
          if (el.checked)
            G.samples[0].gm = Object.fromEntries(
              [...form.querySelectorAll('[name^="gm."]')]
                .map((x) => [x.name.slice(3), +x.value || 0])
                .filter(([, v]) => v > 0),
            );
          else delete G.samples[0].gm;
        } else if (path.startsWith("rx.")) {
          const inp = form.querySelector(`[name="${CSS.escape(path)}"]`);
          setPath(
            G,
            path,
            el.checked
              ? inp.value
                ? new Date(inp.value).toISOString()
                : new Date().toISOString()
              : undefined,
          );
        } else {
          const row = rowOf(path),
            inp = form.querySelector(`[name="${CSS.escape(path)}"]`);
          setPath(G, path, el.checked ? valueOf(inp, row) : undefined);
          if (
            path.startsWith("programme.") &&
            el.checked &&
            !isObj(G.programme)
          )
            G.programme = {};
        }
        return redraw();
      }
      const n = el.name;
      if (!n) return;
      if (n === "name") {
        G.name = el.value.trim() || undefined;
        if (!G.name) delete G.name;
      } else if (n === "repeat")
        G.repeat = R2.clamp(Math.round(+el.value || 1), 1, B.MAX_RUNS);
      else if (n === "seedStep") {
        const v = Math.round(+el.value || 0);
        if (v) G.seedStep = v;
        else delete G.seedStep;
      } else if (n === "naturalVariation") {
        if (el.value === "") delete G.naturalVariation;
        else G.naturalVariation = el.value === "true";
      } else if (n === "template") {
        const before = G.template;
        if (el.value) G.template = el.value;
        else delete G.template;
        if (G.template !== before) {
          const removed = R2.batchRuns.resetForTemplate(G, before);
          if (removed.length) R2.annunciator?.raise("R2-SOP-057", { group: gi + 1, list: removed.join(", ") }, "builder-reset");
        }
        if (
          !G.template &&
          !G.material &&
          !(G.samples && G.samples[0] && G.samples[0].material)
        )
          G.material = "soyA";
      } else if (n === "material") {
        if (el.value) G.material = el.value;
        else delete G.material;
        if (G.samples && G.samples[0]) delete G.samples[0].material;
        delete G.assays;
      } else if (n === "stage") {
        if (el.value) G.stage = el.value;
        else delete G.stage;
        delete G.procedure;
        delete G.assays;
      } else if (n === "procedure") {
        if (el.value) G.procedure = el.value;
        else delete G.procedure;
        delete G.assays;
      } else if (n === "assays")
        G.assays = [...form.querySelectorAll('[name="assays"]')]
          .filter((x) => x.checked)
          .map((x) => x.value);
      else if (n === "sampleCount") {
        const c = R2.clamp(Math.round(+el.value || 1), 1, 384);
        G.samples = G.samples || [{}];
        while (G.samples.length < c)
          G.samples.push({
            extractionDate: G.samples[0].extractionDate || today(),
          });
        G.samples.length = c;
      } else if (n.startsWith("s.")) {
        const [, i, k] = n.split(".");
        G.samples = G.samples || [{}];
        const x = G.samples[+i];
        const v = el.value.trim();
        if (v) x[k] = v;
        else delete x[k];
      } else if (n.startsWith("gm.")) {
        G.samples[0].gm = G.samples[0].gm || {};
        const v = +el.value || 0;
        if (v > 0) G.samples[0].gm[n.slice(3)] = v;
        else delete G.samples[0].gm[n.slice(3)];
      } else if (n === "programmeMode") {
        if (el.value === "custom")
          G.programme = isObj(G.programme) ? G.programme : {};
        else if (el.value === "method") G.programme = "method";
        else delete G.programme;
      } else if (n === "errorScenario") {
        if (el.value) G.errorScenario = el.value;
        else delete G.errorScenario;
      } else if (n.startsWith("rx."))
        setPath(G, n, el.value ? new Date(el.value).toISOString() : undefined);
      else if (rowOf(n)) setPath(G, n, valueOf(el, rowOf(n)));
      else if (n === "seed")
        G.seed = R2.clamp(Math.round(+el.value || 7), 1, 99999);
      else if (n === "duplex") G.duplex = el.checked;
      redraw();
    });
    $q("#bf-dl").onclick = () =>
      R2.download(
        (prof.name || "run_profile")
          .replace(/[^A-Za-z0-9_-]+/g, "_")
          .slice(0, 60) + ".missy-runs.json",
        JSON.stringify(out(), null, 2),
        "application/json",
      );
    $q("#bf-load").onclick = () => $q("#bf-file").click();
    $q("#bf-file").onchange = async (e) => {
      try {
        const t = await readFile(e.target),
          p = JSON.parse(t),
          chk = B.parse(p);
        prof = fromProfile(p);
        gi = 0;
        redraw();
        dlg.querySelector("#bf-msg").textContent = chk.errors.length
          ? "Loaded with problems: " + chk.errors.slice(0, 3).join(" · ")
          : "Profile loaded.";
      } catch (err) {
        $q("#bf-msg").textContent = err.message;
      }
    };
    $q("#bf-text").onclick = () => {
      try {
        const p = JSON.parse($q("#bf-json").value);
        prof = fromProfile(p);
        gi = 0;
        redraw();
        dlg.querySelector("#bf-msg").textContent =
          "Edited JSON taken into the builder.";
      } catch (err) {
        $q("#bf-msg").textContent = "Not valid JSON: " + err.message;
      }
    };
    $q("#bf-copy").onclick = () => {
      const t = JSON.stringify(out(), null, 2);
      (navigator.clipboard
        ? navigator.clipboard.writeText(t)
        : Promise.reject()
      ).then(
        () => {
          $q("#bf-msg").textContent = "Copied.";
        },
        () => {
          $q("#bf-json").select();
          $q("#bf-msg").textContent =
            "Copy is not allowed here; the JSON is selected.";
        },
      );
    };
    $q("#bf-new").onclick = () => {
      prof = fromProfile({ name: "My run profile", runs: [blank()] });
      gi = 0;
      redraw();
    };
    $q("#bf-run").onclick = () => openRunner(out());
  }
  function openBuilder(p, mode = "assisted") {
    if (B.busy() || R2.tech.running()) return;
    builderMode = mode;
    prof = fromProfile(
      p || (prof ? out() : { name: "My run profile", runs: [blank()] }),
    );
    gi = 0;
    drawBuilder();
  }

  /* ============================== Runner ============================== */
  let pending = null;
  function openRunner(p) {
    if (B.busy() || R2.tech.running()) return;
    const d = dialog();
    d.classList.remove("visual-builder");
    R2.annunciator?.clearSource("builder");
    d.innerHTML = shell(
      "Run a JSON profile",
      "JSON · VIRTUAL RUNS FOR THE QUALITY MANAGER",
      `
      <div class="br-load row"><button type="button" id="br-file-btn" class="primary">Choose profile (.json)…</button><input type="file" id="br-file" accept=".json,application/json" hidden><button type="button" id="br-example">Use the example profile</button><button type="button" id="br-build">Build a profile instead</button></div>
      <textarea id="br-text" spellcheck="false" aria-label="Profile JSON" placeholder='{ "format": "${B.FORMAT}", "runs": [ … ] }'>${p ? esc(JSON.stringify(p, null, 2)) : ""}</textarea>
      <div class="row"><button type="button" id="br-check">Check</button><button type="button" id="br-go" class="primary" disabled>Generate runs</button><button type="button" id="br-cancel" hidden>Stop after this run</button></div>
      <div id="br-report" class="stack"></div>`,
    );
    if (!d.open) d.showModal();
    const $q = (s) => d.querySelector(s);
    $q(".batch-close").onclick = close;
    $q("#br-file-btn").onclick = () => $q("#br-file").click();
    $q("#br-file").onchange = async (e) => {
      try {
        $q("#br-text").value = await readFile(e.target);
        checkNow();
      } catch (err) {
        $q("#br-report").innerHTML = `<p class="note">${esc(err.message)}</p>`;
      }
    };
    $q("#br-example").onclick = () => {
      $q("#br-text").value = JSON.stringify(B.example(), null, 2);
      checkNow();
    };
    $q("#br-build").onclick = () => {
      let p0 = null;
      try {
        p0 = JSON.parse($q("#br-text").value);
      } catch {}
      openBuilder(p0 ? B.normalize(p0) : null);
    };
    $q("#br-check").onclick = checkNow;
    $q("#br-text").oninput = () => {
      $q("#br-go").disabled = true;
    };
    $q("#br-go").onclick = go;
    $q("#br-cancel").onclick = () => {
      B.cancel();
      $q("#br-cancel").disabled = true;
      $q("#br-cancel").textContent = "Stopping…";
    };
    if (p) checkNow();
  }
  function checkNow() {
    const d = dlg,
      $q = (s) => d.querySelector(s),
      parsed = B.parse($q("#br-text").value);
    const groups = new Map();
    parsed.runs.forEach((r) => {
      if (!groups.has(r.group))
        groups.set(r.group, { spec: r.spec, n: 0, label: r.label });
      groups.get(r.group).n++;
    });
    const rows = [...groups].map(([i, g]) => ({
      i,
      g,
      pv: B.preview(g.spec, 0),
    }));
    const benchErrors = rows.filter((r) => r.pv.errors.length);
    // SOP correlation for imported files too: a run whose species differs from its template is blocked.
    const corr = !parsed.errors.length && R2.profileStudio ? R2.profileStudio.validate(parsed.profile) : null;
    const sopAlerts = corr ? corr.alerts.filter((a) => /^R2-SOP-/.test(a.id || "")) : [];
    R2.annunciator?.sync("runner", corr ? corr.alerts : parsed.errors.map((text) => ({ kind: "error", text })));
    pending = !parsed.errors.length && !benchErrors.length && !sopAlerts.some((a) => a.kind === "error") ? parsed : null;
    $q("#br-go").disabled = !pending || B.busy();
    $q("#br-report").innerHTML =
      (parsed.errors.length
        ? `<div class="panel"><h3>Profile problems</h3>${parsed.errors.map((e) => `<div class="flag"><span class="pill bad">fix</span><span>${esc(e)}</span></div>`).join("")}</div>`
        : "") +
      (sopAlerts.length
        ? `<div class="panel"><h3>SOP correlation</h3>${sopAlerts.map((a) => { const e = R2.annunciator?.entry(a.id); return `<div class="flag"><span class="r2-cls r2-${(e?.cls || "CAUTION").toLowerCase()}">${esc(e?.cls || "")}</span> <code>${esc(a.id)}</code> <span>${esc(a.text)}</span></div>`; }).join("")}</div>`
        : "") +
      (parsed.warnings.length
        ? parsed.warnings
            .map(
              (e) =>
                `<div class="flag"><span class="pill warn">note</span><span>${esc(e)}</span></div>`,
            )
            .join("")
        : "") +
      (rows.length
        ? `<div class="panel"><h3>${esc(parsed.name)} <small>${parsed.runs.length} run${parsed.runs.length === 1 ? "" : "s"} in ${rows.length} group${rows.length === 1 ? "" : "s"}</small></h3><div class="scroll"><table><tr><th>Group</th><th class="l">Name</th><th>Runs</th><th class="l">Analysis</th><th class="l">Samples</th><th class="l">Scenario</th><th class="l">SOP</th><th class="l">Check</th></tr>
        ${rows
          .map(({ i, g, pv }) => {
            const x = pv.info || {};
            return `<tr><td>${i + 1}</td><td class="l">${esc(g.label)}</td><td>${g.n}</td><td class="l">${x.stage ? esc(x.crop + " · " + x.stage + " · " + B.procedureName(x.procedure, x.stage)) : "–"}</td><td class="l">${x.samples ?? "–"}${x.maxSamples ? " / " + x.maxSamples : ""}</td><td class="l">${esc(g.spec.errorScenario || "none")}</td><td class="l"><code>${esc(x.sop || "–")}</code></td>
          <td class="l">${pv.errors.length ? pv.errors.map((e) => `<span class="pill bad">fix</span> ${esc(e)}`).join("<br>") : `<span class="pill ok">ready</span>`}${pv.warnings.map((e) => `<br><span class="pill warn">note</span> ${esc(e)}`).join("")}</td></tr>`;
          })
          .join("")}</table></div>
        <p class="note">Runs are played as fast as this computer allows (about 5–10 s each) with the instrument model, then filed for the Quality manager. Your Technician set-up is restored afterwards.</p></div>`
        : "");
  }
  async function go() {
    if (!pending) return;
    const d = dlg,
      $q = (s) => d.querySelector(s),
      parsed = pending;
    $q("#br-go").disabled =
      $q("#br-check").disabled =
      $q("#br-file-btn").disabled =
      $q("#br-example").disabled =
      $q("#br-build").disabled =
        true;
    $q(".batch-close").disabled = true;
    $q("#br-cancel").hidden = false;
    $q("#br-cancel").disabled = false;
    $q("#br-cancel").textContent = "Stop after this run";
    $q("#br-report").innerHTML =
      `<div class="panel"><h3 id="br-now">Starting…</h3><label>This run <progress id="br-p1" max="1" value="0"></progress></label><label>Profile <progress id="br-p2" max="${parsed.runs.length}" value="0"></progress></label><ol id="br-list" class="br-list"></ol></div>`;
    let res;
    try {
      res = await B.run(parsed, (ev) => {
        $q("#br-now").textContent =
          `Run ${ev.index + 1} of ${ev.total}: ${ev.name}`;
        $q("#br-p1").value = ev.fraction;
        $q("#br-p2").value = ev.index + ev.fraction;
        $q("#br-list").innerHTML =
          ev.done
            .map(
              (r) =>
                `<li><b>${esc(r.name)}</b> · ${esc(r.outcome)}${r.injectedFault ? " · scenario: " + esc(r.injectedFault.title) : ""} · <code>${esc(R2.sop.idOfRun(r))}</code></li>`,
            )
            .join("") +
          ev.failures
            .map(
              (f) =>
                `<li class="br-fail"><b>${esc(f.name)}</b> · not made: ${esc(f.errors.join("; "))}</li>`,
            )
            .join("");
      });
    } catch (err) {
      $q("#br-now").textContent = err.message;
    }
    $q("#br-cancel").hidden = true;
    $q(".batch-close").disabled = false;
    $q("#br-check").disabled =
      $q("#br-file-btn").disabled =
      $q("#br-example").disabled =
      $q("#br-build").disabled =
        false;
    if (!res) return;
    $q("#br-now").textContent =
      `${res.runs.length} run${res.runs.length === 1 ? "" : "s"} filed for the Quality manager${res.failures.length ? ", " + res.failures.length + " not made" : ""}${res.cancelled ? " (stopped)" : ""}.`;
    $q("#br-p2").value = res.runs.length;
    $q("#br-p1").value = res.runs.length ? 1 : 0;
    $q("#br-report").insertAdjacentHTML(
      "beforeend",
      `<div class="row"><button type="button" id="br-quality" class="primary" ${res.runs.length ? "" : "disabled"}>Open the Quality manager</button><button type="button" id="br-zip" ${res.runs.length ? "" : "disabled"}>Download these RDMLt files (.zip)</button><button type="button" id="br-again">Run another profile</button></div>`,
    );
    const zipName =
      "MISSY_R2_RDMLt_" +
      (parsed.name || "profile").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40) +
      "_" +
      today() +
      ".zip";
    $q("#br-zip").onclick = () =>
      R2.downloadAsync($q("#br-zip"), zipName, () => R2.bulkRdmlt(res.runs));
    $q("#br-quality").onclick = () => {
      dlg.close();
      if (!R2Boot.entered) document.getElementById("welcome-enter").click();
      location.hash = "#quality";
    };
    $q("#br-again").onclick = () => openRunner(null);
    if (res.output.downloadRdmltZip && res.runs.length) $q("#br-zip").click();
    if (
      res.output.openQuality &&
      res.runs.length &&
      !res.failures.length &&
      !res.cancelled
    ) {
      dlg.close();
      if (!R2Boot.entered) document.getElementById("welcome-enter").click();
      if (location.hash === "#quality")
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      else location.hash = "#quality";
    }
  }

  /* ============================== Home page buttons ============================== */
  function install() {
    // The JSON shortcuts belong only to the initial welcome screen.
    document.querySelectorAll("[data-batch-create]").forEach((b) => (b.onclick = () => R2.profileStudio ? R2.profileStudio.open() : openBuilder(null)));
    document.querySelectorAll("[data-batch-run]").forEach((b) => (b.onclick = () => openRunner(null)));
    const corner = document.getElementById("json-corner");
    if (corner) {
      const sync = () => {
        const welcome = document.getElementById("welcome-screen");
        const hide = !welcome || welcome.hidden;
        if (corner.hidden !== hide) corner.hidden = hide; // write only on change, so the observer does not re-trigger itself
      };
      window.addEventListener("hashchange", () => setTimeout(sync, 0));
      new MutationObserver((records) => {
        if (records.some((r) => r.target !== corner)) sync();
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
      sync();
    }
  }
  R2.batchUi = { openRunner, openBuilder, install,
    getProfile: () => prof ? clone(out()) : null,
    setProfile: p => { prof = fromProfile(p); gi = 0; },
    close,
    moveGroup(from, to) {
      if (!prof || to < 0 || to >= prof.runs.length || from === to) return;
      const [group] = prof.runs.splice(from, 1); prof.runs.splice(to, 0, group); gi = to; drawBuilder();
    }
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", install);
  else install();
})(window.R2);
