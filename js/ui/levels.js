/* Levels of complexity on the two benches: Beginner, Intermediate, Expert and Administrator.
 * Beginner and Intermediate show short guided views (few input screens); Expert shows the full bench unchanged;
 * Administrator shows the full bench plus an administration panel. The level is a view setting only: it changes no
 * model, calculation or result. Each bench keeps its own level in this browser.
 * Markup: every view gets data-level; elements of the full bench carry .lv-full, guided views .lv-guided and
 * administration panels .lv-admin (see css/site.css). Classes are used, not the hidden attribute, so the benches keep
 * control of their own hidden panels. */
(/* @r2fn R2-C0055-F00001 */function (R2) {
  "use strict";
  const $ = R2.$, L = R2.levels = {};
  L.ORDER = ["beginner", "intermediate", "expert", "admin"];
  L.NAME = { beginner: "Beginner", intermediate: "Intermediate", expert: "Expert", admin: "Administrator" };
  L.BENCH = {
    technician: { view: "view-technician", full: ["#tech-tabs", "#tech-body"],
      help: { beginner: "One screen: choose a prepared analysis and start. Plate, mixes and programme come from the template.",
        intermediate: "Four steps: analysis, samples, check, run. Everything else comes from the template.",
        expert: "The full bench: all twelve steps of the analysis.",
        admin: "The full bench plus administration of templates, procedures and natural variation." } },
    quality: { view: "view-quality", full: ["#q-files", "#x-files", "#x-body", "#q-body"],
      help: { beginner: "Training cases with clear faults: read the controls, decide report, repeat, dilute or extract again. Hints shown.",
        intermediate: "Harder cases without hints, plus a short review of the runs filed on this browser.",
        expert: "The full review: controls, curves, thresholds, calibration, imported data and every output file.",
        admin: "Launch MISSY’s Real data analysis workspace, review SOPs and manage training records." } }
  };
  const KEY = /* @r2fn R2-C0055-F00002 */b => "missy-r2-level-" + b;
  L.get = /* @r2fn R2-C0055-F00003 */b => { try { const v = localStorage.getItem(KEY(b)); if (L.ORDER.includes(v)) return v; } catch {} return (L._mem && L._mem[b]) || "expert"; };
  L.hooks = { technician: [], quality: [] };
  L.on = /* @r2fn R2-C0055-F00004 */(bench, fn) => L.hooks[bench].push(fn);
  L.save = /* @r2fn R2-C0055-F00005 */function (bench, lv) {
    if (!L.ORDER.includes(lv) || bench === "technician" && R2.techAccess && !R2.techAccess.allowed(lv)) return;
    (L._mem = L._mem || {})[bench] = lv; try { localStorage.setItem(KEY(bench), lv); } catch {}
  };
  L.set = /* @r2fn R2-C0055-F00006 */(bench, lv) => { if (bench === "quality") location.hash = "quality"; else if (L.ORDER.includes(lv)) location.hash = bench + "/" + lv; };
  L.chooser = bar;
  // where a run handed over by the technician is reviewed: the full review (Administrator keeps its extra panel)
  L.reviewRoute = /* @r2fn R2-C0055-F00007 */() => "#quality";
  /* @r2fn R2-C0055-F00008 */function bar(bench) {
    const B = L.BENCH[bench], view = $(B.view), lead = view.querySelector(".lead");
    let el = view.querySelector(".levelbar");
    if (!el) {
      el = document.createElement("div"); el.className = "panel levelbar";
      el.innerHTML = `<h2 id="level-${bench}">Choose your level</h2>
        <div class="workspace-options level-options" role="group" aria-labelledby="level-${bench}">${L.ORDER.map(/* @r2fn R2-C0055-F00009 */lv =>
          `<button type="button" class="workspace-choice" data-lv="${lv}"><strong>${L.NAME[lv]}</strong><span>${B.help[lv]}</span></button>`).join("")}</div>`;
      lead.after(el);
      el.addEventListener("click", /* @r2fn R2-C0055-F00010 */e => { const b = e.target.closest("[data-lv]"); if (b) L.set(bench, b.dataset.lv); });
      for (const sel of B.full) view.querySelectorAll(sel).forEach(/* @r2fn R2-C0055-F00011 */n => n.classList.add("lv-full"));
    }
    return el;
  }
  L.apply = /* @r2fn R2-C0055-F00012 */function (bench) {
    const B = L.BENCH[bench], view = $(B.view);
    if (bench === "quality") {
      view.dataset.level = "admin";
      for (const fn of L.hooks[bench]) fn("admin");
      return;
    }
    const lv = L.get(bench), el = bar(bench);
    view.dataset.level = lv;
    el.querySelectorAll("[data-lv]").forEach(/* @r2fn R2-C0055-F00013 */b => b.setAttribute("aria-pressed", String(b.dataset.lv === lv)));
    for (const fn of L.hooks[bench]) { try { fn(lv); } catch (err) { console.error(err); } }
  };
  // wrap the bench entry points: the full bench is always built (so Expert is one click away), then the level applies
  L.install = /* @r2fn R2-C0055-F00014 */function () {
    const ui = R2.ui;
    for (const bench of Object.keys(L.BENCH)) {
      const orig = ui[bench].show.bind(ui[bench]);
      ui[bench].show = /* @r2fn R2-C0055-F00015 */function () { orig(); L.apply(bench); };
    }
  };
  // training records of the two benches: one object, exportable as JSON by an administrator
  L.records = /* @r2fn R2-C0055-F00016 */function () {
    const read = /* @r2fn R2-C0055-F00017 */k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
    return { format: "missy-r2-training-records/0.1", exported: new Date().toISOString(), levels: Object.fromEntries(Object.keys(L.BENCH).map(/* @r2fn R2-C0055-F00018 */b => [b, L.get(b)])),
      technicianAssessment: R2.techAccess?.records() || null, technicianPreRunTasks: read("missy-r2-pre-run-tasks"), technicianGuided: read("missy-r2-tech-guided"), qualityCases: read("missy-r2-qm-cases") };
  };
  // small shared helpers for the guided views
  L.store = /* @r2fn R2-C0055-F00019 */(key, fallback) => ({ get/* @r2fn R2-C0055-F00020 */() { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback(); } catch { return this._m || (this._m = fallback()); } },
    put/* @r2fn R2-C0055-F00021 */(v) { this._m = v; try { localStorage.setItem(key, JSON.stringify(v)); } catch {} } });
  L.rng = /* @r2fn R2-C0055-F00022 */function (seed) { let s = (seed >>> 0) || 1; return /* @r2fn R2-C0055-F00023 */() => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; };
  L.gauss = /* @r2fn R2-C0055-F00024 */r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  L.shuffle = /* @r2fn R2-C0055-F00025 */(a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
})(window.R2);
