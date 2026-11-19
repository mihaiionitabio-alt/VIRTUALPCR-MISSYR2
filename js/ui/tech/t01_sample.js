/* Technician tab 1: the sample. */
(/* @r2fn R2-C0066-F00001 */function (R2) {
  "use strict";
  const $ = R2.$,
    X = R2.tech;

  /* @r2fn R2-C0066-F00002 */function draw() {
    $("g-design-extractions").value = X.design?.extractions ?? 3;
    $("g-design-replicates").value = X.design?.replicates ?? 3;
    const s = X.sample,
      c = X.D().crops[s.crop];
    $("g-sample-kv").innerHTML =
      `<dt>Species</dt><dd>${c.label}</dd><dt>Genome copies</dt><dd>about ${c.copiesPerNg} per ng DNA (assumed)</dd><dt>GM content</dt><dd>${s.blind ? "not disclosed; revealed on the quality bench after the analysis" : Object.keys(s.events).length ? "set below, in % of genome copies" : "none"}</dd><dt>In ${X.ng} ng</dt><dd>about ${Math.round(X.ng * c.copiesPerNg).toLocaleString("en")} genome copies (${Math.round(X.ng * c.copiesPerNg * (X.GP().AMPLIFIABLE[s.crop] || 1)).toLocaleString("en")} amplifiable in this model)</dd>`;
    $("g-comp").innerHTML = s.blind
      ? ""
      : `<h3>GM events in the sample</h3><div class="row">` +
        X.D()
          .events.filter(/* @r2fn R2-C0066-F00003 */(e) => e.crop === s.crop)
          .map(
            /* @r2fn R2-C0066-F00004 */(e) =>
              `<label>${e.name} <input type="number" data-ev="${e.name}" min="0" max="100" step="0.01" value="${s.events[e.name] || 0}" style="width:4.8em"> %</label>`,
          )
          .join("") +
        `</div>`;
    drawSamples();
    $("g-quality").hidden = !!s.blind;
    $("g-frag").value = s.frag;
    $("g-inh").value = s.inhibitor;
    $("g-conc").value = X.dna.concNgPerUl;
    $("g-vol").value = X.dna.volUl;
    $("g-ng").textContent = X.ng;
    $("t-seed").value = X.seed;
    $("t-natural").checked = X.natural;
  }

  /* @r2fn R2-C0066-F00005 */function drawSamples() {
    const n = 1 + X.extra.length,
      crop = X.sample.crop,
      opts = X.D().samples.filter(/* @r2fn R2-C0066-F00006 */(x) => x.blind || x.crop === crop),
      max = X.plan ? X.plan.capacity.maxSamples : 19;
    while (X.meta.length < n)
      X.meta.push({
        extractionDate: X.meta[0].extractionDate,
        label: "",
      });
    X.meta.length = n;
    $("g-n").value = n;
    $("g-n").max = max;
    $("g-n-max").textContent =
      `at most ${max} with the mixes of this analysis (384 wells)`;
    $("g-samples").innerHTML =
      `<tr><th>No.</th><th class="l">Name at run start</th><th class="l">Simulated material</th><th class="l">DNA extraction date</th><th class="l">Sample name (optional)</th></tr>` +
      X.meta
        .map(
          /* @r2fn R2-C0066-F00007 */(m, i) =>
            `<tr><td>${i + 1}</td><td class="l"><code>######-${i + 1}-${R2.materials.dateCode(m.extractionDate)}</code></td>
      <td class="l">${i === 0 ? R2.esc(X.sample.label) + " <small>(set above)</small>" : `<select data-mat="${i}">${opts.map(/* @r2fn R2-C0066-F00008 */(o) => `<option value="${o.key}" ${o.key === X.extra[i - 1] ? "selected" : ""}>${R2.esc(o.label)}</option>`).join("")}</select>`}</td>
      <td class="l"><input type="date" data-date="${i}" value="${R2.esc(m.extractionDate)}"></td><td class="l"><input data-lab="${i}" maxlength="100" value="${R2.esc(m.label)}" style="width:12em" autocomplete="off"></td></tr>`,
        )
        .join("");
  }
  X.tab({
    id: "sample",
    title: "Sample",
    done: /* @r2fn R2-C0066-F00009 */() => true,
    html: `<div class="panel"><h3>Extraction and PCR replication design</h3><div class="row"><label>Independent DNA extractions per sample <input id="g-design-extractions" type="number" min="1" max="12" value="3"></label><label>PCR replicates per extraction <input id="g-design-replicates" type="number" min="1" max="12" value="3"></label></div><p class="note">These are separate counts. Plate capacity is recalculated for every reaction mix. Configure run controls on the Plate step. Published-method acceptance rules still apply to altered designs.</p><p id="g-design-status" role="status"></p></div><div class="panel" id="tpl-panel"><h3>New analysis</h3>
        <div class="row"><label>Start from template <select id="tpl-sel" style="max-width:min(520px,80vw)"></select></label><button id="tpl-apply" class="primary">Start new analysis</button>
          <button id="tpl-dl">Download template</button><button id="tpl-del">Delete template</button><button id="tpl-imp">Import template (.json, OpticalCyclerA .ixo)</button><input type="file" id="tpl-file" accept=".json,.ixo,application/json" hidden></div>
        <p class="note" id="tpl-msg" role="status">A template sets species, step, assays, DNA per reaction, reagents, programme and reaction mixes. Save one after a run on the Run step.</p></div>
      <div class="grid two"><div class="panel"><h3>Which sample is on the bench</h3>
        <label>Simulated material of sample 1 <select id="g-sample"></select></label>
<dl class="kv" id="g-sample-kv"></dl>
        <label>Seed <input id="t-seed" type="number" min="1" max="99999" style="width:6em"> <small>decides the blind sample and the reagent model's draws</small></label>
        <label><input id="t-natural" type="checkbox" checked> Natural variation between tubes and between runs <small>(normalized extract SD 0.06 cycles, PCR well SD 0.07 cycles, run SD 0.41 cycles). Off: same seed, same tubes, every run.</small></label></div>
      <div class="panel"><h3>DNA extract</h3>
        <div class="row"><label>DNA extract, diluted to <input id="g-conc" type="number" min="0.1" max="200" step="0.1" style="width:5em"> ng/µL</label>
          <label>Template per reaction <input id="g-vol" type="number" min="1" max="20" step="0.5" style="width:4em"> µL</label></div>
        <p class="note" style="margin:0">DNA per reaction: <b id="g-ng"></b> ng. The real runs this bench was fitted to used 5 µL at 40 ng/µL = 200 ng; calibrants and controls follow the same amount.</p>
        <div class="stack" id="g-quality" style="gap:8px"><label>Mean DNA fragment <input id="g-frag" type="number" min="60" max="20000" step="10" style="width:6em"> bp <small>processed food: 150 to 300 bp</small></label>
          <label>Inhibitor carry-over <input id="g-inh" type="number" min="0" max="0.8" step="0.05" style="width:5em"> <small>0 = clean extract</small></label></div>
        <div id="g-comp"></div></div></div>
      <div class="panel"><h3>Samples in this run</h3>
        <div class="row"><label>Number of samples <input id="g-n" type="number" min="1" max="19" step="1" style="width:4.5em"></label><small id="g-n-max"></small><button id="g-names-import">Import sample names…</button><input type="file" id="g-names-file" accept=".csv,.tsv,.txt,.json,.rdml,.rdmlt,.xml" hidden></div><small id="g-names-status" role="status"></small>
        <p class="note">Each sample uses the extraction and PCR replicate counts selected above; the method default is three extractions with three replicates each. Names are <code>prefix-n-YYYYMMDD</code>: a random six-digit prefix drawn at run start and unique to the run, the sample number and the DNA extraction date, so that samples of independent runs never share a name.</p>
        <div class="scroll"><table class="sample-table" id="g-samples"></table></div></div>`,
    init/* @r2fn R2-C0066-F00010 */() {
      for (const id of ["g-design-extractions", "g-design-replicates"])
        $(id).onchange = /* @r2fn R2-C0066-F00011 */() => {
          try {
            X.updateDesign({
              ...X.design,
              extractions: +$("g-design-extractions").value,
              replicates: +$("g-design-replicates").value,
            });
            $("g-design-status").textContent = "Design updated.";
          } catch (e) {
            $("g-design-status").textContent = e.message;
          }
          draw();
        };
      const T = R2.templates;
      X.fillTemplates = /* @r2fn R2-C0066-F00012 */(sel) => {
        $("tpl-sel").innerHTML = T.list()
          .map(
            /* @r2fn R2-C0066-F00013 */(t) =>
              `<option value="${R2.esc(t.id)}">${t.builtIn ? "Built-in · " : "Saved · "}${R2.esc(t.name)}${t.sop_id ? " · " + t.sop_id : ""}</option>`,
          )
          .join("");
        if (sel) $("tpl-sel").value = sel;
        const t = T.get($("tpl-sel").value);
        $("tpl-del").disabled = !t || !!t.builtIn;
      };
      X.fillTemplates();
      $("tpl-sel").onchange = /* @r2fn R2-C0066-F00014 */() => X.fillTemplates($("tpl-sel").value);
      $("tpl-apply").onclick = /* @r2fn R2-C0066-F00015 */() => {
        const t = T.get($("tpl-sel").value);
        if (!t) return;
        if (X.running()) {
          $("tpl-msg").textContent =
            "A run is in progress; wait until it ends.";
          return;
        }
        T.apply(t, X);
        if (X.resetRunView) X.resetRunView();
        draw();
        X.marks();
        if (t.programmeOnly) {
          $("tpl-msg").textContent =
            `Programme from "${t.name}" applied to the current analysis (${R2.hms(X.prof.total)} instrument time). SOP ${T.sopId(X)}.`;
          return;
        }
        $("tpl-msg").textContent =
          `New analysis from "${t.name}": ${X.GP().name(X.plan.tubes.flat().find(/* @r2fn R2-C0066-F00016 */(id) => X.M(id).kind !== "taxon") || X.plan.tubes[0][0])}, ${X.ng} ng per reaction. Check each step, then run. SOP ${T.sopId(X)}.`;
      };
      $("tpl-dl").onclick = /* @r2fn R2-C0066-F00017 */() => {
        const t = T.get($("tpl-sel").value);
        if (t)
          R2.download(
            t.name.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) +
              ".template.json",
            JSON.stringify(t, null, 1),
            "application/json",
          );
      };
      $("tpl-del").onclick = /* @r2fn R2-C0066-F00018 */() => {
        const t = T.get($("tpl-sel").value);
        if (!t || t.builtIn) return;
        T.remove(t.id);
        X.fillTemplates();
        $("tpl-msg").textContent =
          `Template "${t.name}" deleted from this browser.`;
      };
      $("tpl-imp").onclick = /* @r2fn R2-C0066-F00019 */() => $("tpl-file").click();
      $("tpl-file").onchange = /* @r2fn R2-C0066-F00020 */async (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (!f) return;
        try {
          const t = T.parse(await f.text(), f.name);
          T.save(t);
          X.fillTemplates(t.id);
          $("tpl-msg").textContent = t.programmeOnly
            ? `Imported "${t.name}": ${t.fields.cycles} cycles, ${t.fields.annT} °C ${t.fields.annS} s${t.fields.extS ? ", " + t.fields.extT + " °C " + t.fields.extS + " s" : ""}, channels ${t.source.channels.map(/* @r2fn R2-C0066-F00021 */(c) => c.name).join(", ")}. It sets the programme and reaction volume of the current analysis.`
            : `Imported "${t.name}". Press Start new analysis to use it.`;
        } catch (err) {
          $("tpl-msg").textContent = "Not imported: " + err.message;
        }
      };
      $("g-sample").innerHTML = X.D()
        .samples.map(
          /* @r2fn R2-C0066-F00022 */(s) => `<option value="${s.key}">${R2.esc(s.label)}</option>`,
        )
        .join("");
      $("g-names-import").onclick = /* @r2fn R2-C0066-F00023 */() => $("g-names-file").click();
      $("g-names-file").onchange = /* @r2fn R2-C0066-F00024 */async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file) return;
        try {
          const rows = await R2.sampleNames(
            new Uint8Array(await file.arrayBuffer()),
          );
          const capacity = X.plan.capacity.maxSamples;
          if (rows.length > capacity)
            throw new Error(
              rows.length +
                " names found. This plate has capacity for " +
                capacity +
                " samples.",
            );
          const old = X.meta;
          X.extra = Array.from(
            {
              length: rows.length - 1,
            },
            /* @r2fn R2-C0066-F00025 */(_, i) => X.extra[i] || X.sampleKey,
          );
          X.meta = rows.map(/* @r2fn R2-C0066-F00026 */(row, i) => ({
            label: row.label,
            extractionDate:
              row.extractionDate ||
              old[i]?.extractionDate ||
              X.meta[0].extractionDate,
          }));
          X.build(false);
          draw();
          $("g-names-status").textContent =
            rows.length + " sample names imported.";
        } catch (err) {
          $("g-names-status").textContent = err.message;
        }
      };
      $("g-n").onchange = /* @r2fn R2-C0066-F00027 */(e) => {
        const max = X.plan.capacity.maxSamples,
          n = R2.clamp(Math.round(+e.target.value || 1), 1, max);
        while (X.extra.length < n - 1)
          X.extra.push(
            X.sampleKey === "blind"
              ? X.D().samples.find(/* @r2fn R2-C0066-F00028 */(x) => x.crop === X.sample.crop && !x.blind)
                  .key
              : X.sampleKey,
          );
        X.extra.length = n - 1;
        X.build(false);
        draw();
      };
      $("g-samples").addEventListener("change", /* @r2fn R2-C0066-F00029 */(e) => {
        const d = e.target.dataset;
        if (d.mat) {
          X.extra[+d.mat - 1] = e.target.value;
          X.build(false);
        }
        if (d.date) {
          X.meta[+d.date].extractionDate =
            e.target.value || new Date().toISOString().slice(0, 10);
          drawSamples();
        }
        if (d.lab !== undefined) X.meta[+d.lab].label = e.target.value.trim();
      });
      $("g-sample").onchange = /* @r2fn R2-C0066-F00030 */(e) => {
        X.setSample(e.target.value);
        draw();
      };
      $("t-seed").onchange = /* @r2fn R2-C0066-F00031 */(e) => {
        X.seed = +e.target.value || 7;
        if (X.sample.blind) X.setSample("blind");
        draw();
      };
      const dna = /* @r2fn R2-C0066-F00032 */() => {
        X.dna.concNgPerUl = R2.clamp(+$("g-conc").value || 40, 0.1, 200);
        X.dna.volUl = R2.clamp(+$("g-vol").value || 5, 1, 20);
        X.ng = +(X.dna.concNgPerUl * X.dna.volUl).toFixed(2);
        X.build(false);
        draw();
      };
      $("g-conc").onchange = dna;
      $("g-vol").onchange = dna;
      $("t-natural").onchange = /* @r2fn R2-C0066-F00033 */(e) => {
        X.natural = e.target.checked;
      };
      $("g-frag").onchange = /* @r2fn R2-C0066-F00034 */(e) => {
        X.sample.frag = +e.target.value || 2000;
        X.build(false);
      };
      $("g-inh").onchange = /* @r2fn R2-C0066-F00035 */(e) => {
        X.sample.inhibitor = R2.clamp(+e.target.value || 0, 0, 0.8);
        X.build(false);
      };
      $("g-comp").addEventListener("change", /* @r2fn R2-C0066-F00036 */(e) => {
        const k = e.target.dataset.ev;
        if (!k) return;
        const v = R2.clamp(+e.target.value || 0, 0, 100);
        if (v > 0) X.sample.events[k] = v;
        else delete X.sample.events[k];
        X.build(false);
        draw();
      });
    },
    show: draw,
  });
})(window.R2);
