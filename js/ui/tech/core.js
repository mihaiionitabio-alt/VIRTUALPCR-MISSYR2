/* Technician bench, shared part: state of the analysis, the tab strip, and what every tab needs (plate, settings, programme).
 * Each step of the work is its own tab in its own file: t01_sample.js ... t12_record.js. */
(/* @r2fn R2-C0063-F00001 */function (R2) {
  "use strict";
  const $ = R2.$,
    X = (R2.tech = {
      tabs: [],
      cur: null,
      sample: null,
      plan: null,
      plate: [],
      sel: 0,
      ins: null,
      runInfo: null,
      settings: null,
      simInfo: {},
      prof: null,
      chosen: {
        screen: null,
        ident: null,
        quant: null,
      },
      stage: "screen",
      duplex: true,
      ng: R2.gmoplan.DEFAULT_NG,
      dna: {
        ...R2.gmoplan.DNA,
      },
      natural: true,
      layout: "mara17",
      design: null,
      f: null,
      seed: 7,
      methodShown: null,
      nameMode: "auto",
      manualName: "",
      extractions: Object.create(null),
      extra: [],
      meta: [
        {
          extractionDate: new Date().toISOString().slice(0, 10),
          label: "",
        },
      ],
    });
  X.D = /* @r2fn R2-C0063-F00002 */() => R2.GMO;
  X.M = /* @r2fn R2-C0063-F00003 */(id) => R2.GMO.methods[id];
  X.GP = /* @r2fn R2-C0063-F00004 */() => R2.gmoplan;
  X.tab = /* @r2fn R2-C0063-F00005 */(t) => {
    t.n = X.tabs.length + 1;
    X.tabs.push(t);
  };
  X.tubeLabel = /* @r2fn R2-C0063-F00006 */(W) =>
    W.t.map(/* @r2fn R2-C0063-F00007 */(t) => X.GP().name(t.m).replace(/ \(.*/, "")).join("+");
  X.protocol = /* @r2fn R2-C0063-F00008 */() =>
    X.GP().protocol(
      X.f,
      (X.plan.mara
        ? "Virtual assay: "
        : X.plan.lab
          ? "Simplex screening: "
          : "EURL GMFF: ") + X.plan.tubes.flat().join(", "),
    );
  X.running = /* @r2fn R2-C0063-F00009 */() => !!(X.ins && X.ins.fw.running());
  // rebuild the plate from sample + step; newFields: take the programme from the method records again
  // the samples of the run: sample 1 is the one edited on the Sample step; samples 2..n are material presets of the same species
  X.sampleList = /* @r2fn R2-C0063-F00010 */function () {
    const out = [
      Object.assign(X.sample, {
        key: X.sampleKey,
      }),
    ];
    X.extra.forEach(/* @r2fn R2-C0063-F00011 */(key, i) => {
      const s0 =
        X.D().samples.find(/* @r2fn R2-C0063-F00012 */(s) => s.key === key) ||
        X.D().samples.find(/* @r2fn R2-C0063-F00013 */(s) => s.crop === X.sample.crop && !s.blind);
      out.push(
        Object.assign(
          s0.blind
            ? X.GP().blind(X.seed + 101 * (i + 1), X.sample.crop)
            : JSON.parse(JSON.stringify(s0)),
          {
            key: s0.key,
          },
        ),
      );
    });
    return out;
  };
  X.build = /* @r2fn R2-C0063-F00014 */function (newFields) {
    X.plan = X.GP().plate(X.sample, {
      stage: X.stage,
      assays: X.chosen[X.stage],
      duplex: X.duplex,
      ng: X.ng,
      layout: X.layout,
      samples: X.sampleList(),
      design: X.design,
    });
    X.plate = X.plan.wells;
    if (X.plate[X.sel].role === "empty") X.sel = 0;
    const fl = X.GP().fields(X.plan.tubes);
    X.fl = fl;
    if (newFields || !X.f) X.f = Object.assign({}, fl.f);
    const ids = X.plan.tubes.flat();
    if (!ids.includes(X.methodShown))
      X.methodShown = ids.find(/* @r2fn R2-C0063-F00015 */(id) => X.M(id).kind !== "taxon") || ids[0];
    X.prof = R2.planProfile(X.protocol());
    X.marks();
  };
  X.updateDesign = /* @r2fn R2-C0063-F00016 */function (next) {
    const old = structuredClone(X.design || null);
    try {
      X.design = structuredClone(next);
      X.build(false);
      if (X.sampleList().length > X.plan.capacity.maxSamples)
        throw new Error(
          "The current samples do not fit this design. Reduce the sample count first.",
        );
    } catch (e) {
      X.design = old;
      X.build(false);
      throw e;
    }
  };
  X.maraDNA = /* @r2fn R2-C0063-F00017 */function () {
    if (!R2.MARA.isLayout(X.layout) || X.stage === "screen") return;
    const method = R2.MARA.assays[X.chosen[X.stage][0]];
    X.ng = X.stage === "quant" ? method.quantNg : method.qualNg;
    X.dna = {
      concNgPerUl: X.ng / method.templateUl,
      volUl: method.templateUl,
    };
    X.mixSettings = {
      ...R2.mixcalc.DEFAULT,
      rxnUl: null,
    };
  };
  X.setStage = /* @r2fn R2-C0063-F00018 */function (st, preservedDNA = false) {
    if (X.sample.crop === "cotton" && st === "screen") st = "ident";
    if (X.sample.crop === "cotton")
      X.layout = X.layout === "mara16" && st === "ident" ? "mara16" : "mara";
    if (st === "screen" && R2.MARA.isLayout(X.layout)) {
      X.layout = X.screenLayout || "mara17";
      if (!preservedDNA) {
        const lab = X.layout === "simplex" ? R2.LAB.simplex : null;
        X.dna = {
          ...(lab ? lab.dna : R2.gmoplan.DNA),
        };
        X.ng = X.dna.concNgPerUl * X.dna.volUl;
        X.mixSettings = {
          ...R2.mixcalc.DEFAULT,
          ...(lab?.mix || {}),
        };
      }
    }
    if (st === "screen") X.screenLayout = X.layout;
    if (st !== "screen" && ["simplex", "mara17"].includes(X.layout))
      X.layout = "mara";
    if (st === "quant" && X.layout === "mara16") X.layout = "mara";
    X.stage = st;
    const mara = R2.MARA.isLayout(X.layout);
    const rapid = st === "screen" && X.layout === "mara17";
    const ids = rapid
      ? R2.MARA.rapid.assays
      : st === "screen"
        ? Object.values(X.D().methods)
            .filter(/* @r2fn R2-C0063-F00019 */(m) => m.kind === "screen" && !m.labOnly)
            .map(/* @r2fn R2-C0063-F00020 */(m) => m.id)
        : X.D()
            .events.filter(
              /* @r2fn R2-C0063-F00021 */(e) =>
                e.crop === X.sample.crop &&
                (mara
                  ? e.mara && !R2.MARA.assays[e.method].reviewOnly
                  : !e.mara),
            )
            .map(/* @r2fn R2-C0063-F00022 */(e) => e.method);
    if (
      !X.chosen[st]?.length ||
      !X.chosen[st].every(/* @r2fn R2-C0063-F00023 */(id) => ids.includes(id))
    ) {
      const present = ids.find(/* @r2fn R2-C0063-F00024 */(id) => X.sample.events[X.M(id).event] > 0);
      X.chosen[st] = rapid
        ? R2.MARA.rapid.defaultAssays.slice()
        : st === "screen"
          ? ["QL-ELE-00-012", "QL-ELE-00-013", "QT-ELE-00-002", "QL-CON-00-008"]
          : [present || ids[0]];
    }
    if (mara || st === "quant") X.chosen[st] = X.chosen[st].slice(0, 1);
    if (mara && !preservedDNA) X.maraDNA();
    X.stageIds = ids;
    X.build(true);
  };
  X.setSample = /* @r2fn R2-C0063-F00025 */function (key) {
    const s0 = X.D().samples.find(/* @r2fn R2-C0063-F00026 */(s) => s.key === key);
    X.sampleKey = key;
    X.sample = s0.blind ? X.GP().blind(X.seed) : JSON.parse(JSON.stringify(s0));
    X.extra = X.extra.map(/* @r2fn R2-C0063-F00027 */(k) => {
      const e = X.D().samples.find(/* @r2fn R2-C0063-F00028 */(s) => s.key === k);
      return e && (e.blind || e.crop === X.sample.crop) ? k : key;
    });
    X.chosen = {
      screen: null,
      ident: null,
      quant: null,
    };
    X.setStage(X.stage);
  };
  X.roleLabel = {
    unknown: "Sample",
    positive: "PC",
    negative: "NC",
    ntc: "NTC",
    standard: "Cal",
    empty: "",
  };
  X.ctlLabel = {
    LOD: "PC LOD",
    POS: "Pos.",
    NC: "NC",
    NTC: "NTC",
    BLK: "Blank",
  };
  const roleOf = /* @r2fn R2-C0063-F00029 */(W) => (W.ctl && X.ctlLabel[W.ctl]) || X.roleLabel[W.role];
  X.mixLabel = /* @r2fn R2-C0063-F00030 */(W) =>
    "M" +
    (1 +
      X.plan.tubes.findIndex(
        /* @r2fn R2-C0063-F00031 */(mix) => mix.join() === W.t.map(/* @r2fn R2-C0063-F00032 */(t) => t.m).join(),
      ));
  // 384-well plate, 16 rows × 24 columns: small cells coloured by role, labelled by reaction mix; details on selection
  X.plateHtml = /* @r2fn R2-C0063-F00033 */(sel, compact = false, plate = X.plate) => {
    const cols = R2.PLATE.cols,
      head =
        `<span class="ph"></span>` +
        Array.from(
          {
            length: cols,
          },
          /* @r2fn R2-C0063-F00034 */(_, c) =>
            plate === X.plate
              ? `<span class="ph">${c + 1}</span>`
              : R2.plateAxis("col", c, c + 1),
        ).join("");
    const cell = /* @r2fn R2-C0063-F00035 */(W, i) =>
      `<button type="button" class="w384 ${W.role}${W.ctl && W.ctl !== "S" ? " c-" + W.ctl : ""}" data-w="${i}" title="${R2.esc([R2.wellName(i), W.role === "empty" ? "empty" : X.tubeLabel(W), roleOf(W), W.ext ? (W.sampleName || "sample " + W.sampleNo) + " E" + W.ext + " R" + W.rep : W.material || W.sample].join(" · "))}" aria-label="${R2.wellName(i)}" aria-pressed="${i === sel}" ${W.role === "empty" ? "disabled" : ""}>${W.role === "empty" ? "" : W.ext ? W.sampleNo : (X.ctlLabel[W.ctl] || X.roleLabel[W.role]).slice(0, 3)}</button>`;
    let h = head;
    for (let r = 0; r < R2.PLATE.rows; r++) {
      h +=
        plate === X.plate
          ? `<span class="ph">${String.fromCharCode(65 + r)}</span>`
          : R2.plateAxis("row", r, String.fromCharCode(65 + r));
      for (let c = 0; c < cols; c++)
        h += cell(plate[r * cols + c], r * cols + c);
    }
    return h;
  };
  X.plateLegend = /* @r2fn R2-C0063-F00036 */() =>
    R2.legend([
      ["Sample (number = sample 1…n)", "var(--s2)"],
      ["PC · positive controls", "#a855f7"],
      ["NTC · NTC and extraction blank", "var(--s3)"],
      ["Cal · calibrant", "var(--s1)"],
    ]);
  X.marks = /* @r2fn R2-C0063-F00037 */() =>
    document.querySelectorAll("#tech-tabs button").forEach(/* @r2fn R2-C0063-F00038 */(b) => {
      const t = X.tabs[+b.dataset.i];
      b.classList.toggle("done", !!(t.done && t.done()));
      b.disabled = !!(t.needsRun && !X.runInfo);
    });
  X.go = /* @r2fn R2-C0063-F00039 */function (id) {
    const t = X.tabs.find(/* @r2fn R2-C0063-F00040 */(x) => x.id === id) || X.tabs[0];
    if (t.needsRun && !X.runInfo) return;
    X.cur = t;
    document
      .querySelectorAll("#tech-tabs button")
      .forEach(/* @r2fn R2-C0063-F00041 */(b) =>
        b.setAttribute("aria-selected", X.tabs[+b.dataset.i] === t),
      );
    document.querySelectorAll("#tech-body > section").forEach(/* @r2fn R2-C0063-F00042 */(s) => {
      s.hidden = s.dataset.tab !== t.id;
    });
    X.marks();
    if (t.show) t.show();
  };
  const nav = /* @r2fn R2-C0063-F00043 */(t) => {
    const i = X.tabs.indexOf(t),
      p = X.tabs[i - 1],
      n = X.tabs[i + 1];
    return `<div class="row stepnav">${p ? `<button type="button" data-go="${p.id}">← ${p.n} · ${p.title}</button>` : ""}${n ? `<button type="button" class="primary" data-go="${n.id}">${n.n} · ${n.title} →</button>` : ""}</div>`;
  };
  R2.ui = R2.ui || {};
  R2.ui.technician = {
    show/* @r2fn R2-C0063-F00044 */() {
      if ($("tech-tabs").childElementCount) {
        if (X.cur?.show && !X.running()) X.cur.show();
        return;
      }
      $("tech-tabs").innerHTML = X.tabs
        .map(
          /* @r2fn R2-C0063-F00045 */(t, i) =>
            `<button type="button" role="tab" data-i="${i}"><small>${t.n}</small> ${t.title}</button>`,
        )
        .join("");
      $("tech-body").innerHTML = X.tabs
        .map(
          /* @r2fn R2-C0063-F00046 */(t) =>
            `<section data-tab="${t.id}" class="stack" hidden>${t.html}${nav(t)}</section>`,
        )
        .join("");
      $("tech-tabs").onclick = /* @r2fn R2-C0063-F00047 */(e) => {
        const b = e.target.closest("[data-i]");
        if (b && !b.disabled) X.go(X.tabs[+b.dataset.i].id);
      };
      $("tech-body").addEventListener("click", /* @r2fn R2-C0063-F00048 */(e) => {
        const b = e.target.closest("[data-go]");
        if (b) X.go(b.dataset.go);
      });
      X.settings = Object.assign({}, R2.reagents.DEFAULT);
      X.setSample("soyA");
      for (const t of X.tabs) if (t.init) t.init();
      X.go("sample");
    },
  };
})(window.R2);
