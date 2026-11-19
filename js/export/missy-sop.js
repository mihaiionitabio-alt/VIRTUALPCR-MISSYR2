/* Generate the native profile for MISSY alongside the workbench's archival SOP. */
(function (R2) {
  "use strict";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rapidNames = {
    "MARA-17-35S": "P-35S",
    "MARA-17-NOS": "T-NOS",
    "MARA-17-PAT": "pat",
    "MARA-17-E9": "tE9",
  };
  const publicTarget = (value) =>
    R2.publicAssayTarget
      ? R2.publicAssayTarget(value)
      : {
          "SIMPLEX-35S": "P-35S",
          "SIMPLEX-TNOS": "T-nos",
          "SIMPLEX-LEC": "LE1",
          "SIMPLEX-HMG": "hmgA",
        }[value] || value;
  const targetRule = (method, cqMax) => ({
    match:
      "/^(?:" +
      escape(publicTarget(method.id)) +
      "|" +
      escape(method.target) +
      ")$/i",
    kind: method.role === "species reference gene" ? "reference" : "target",
    cqMax,
    cqLate: "",
    quantMin: "",
    lateOutcome: "Inconclusive",
  });
  R2.missySop = function (document) {
    const mara = document.definition.mara;
    const standards = R2.missyNativeTemplates.mara;
    const event =
      mara?.event ||
      document.methods.find((method) => method.role === "event")?.target;
    const standard = Number(/^MARA-(\d+)-EVENT$/.exec(mara?.method || "")?.[1]);
    const entry =
      mara &&
      (mara.mode === "screen"
        ? standards.find((x) => x.standard === 17)
        : mara.mode === "ddct"
          ? standards.find((x) => x.standard === 16)
          : standards.find(
              (x) =>
                x.event === event &&
                (!standard || x.standard === standard) &&
                x.role ===
                  (mara.mode === "quant" ? "quantification" : "identification"),
            ));
    const p = clone(entry ? entry.profile : R2.missyNativeTemplates.base);
    p.name = document.title;
    p.fileStem = document.sop_id + "_MISSY";
    p.assay = document.methods.map((method) => method.target).join(" / ");
    p.sourceWorkbenchSop = {
      id: document.sop_id,
      format: document.format,
    };
    p.notes = [
      entry && p.notes,
      "Simulated run. Source procedure " + document.sop_id + ".",
      ...document.acceptance,
      document.evaluation,
    ]
      .filter(Boolean)
      .join("\n");
    p.reviewOnly = true;
    if (entry) {
      const reference = document.methods.find(
        (method) => method.role === "species reference gene",
      );
      const refGenes = p.method.reference_genes || [];
      const templateRef =
        refGenes.find((gene) =>
          /lectin|le1/i.test(reference?.target || "")
            ? /lec|le1/i.test(gene.target)
            : gene.target.toLowerCase() === reference?.target.toLowerCase(),
        ) || refGenes[0];
      const refName = templateRef?.target || reference?.target;
      if (reference)
        p.method.reference_genes = [
          {
            ...templateRef,
            target: refName,
          },
        ];
      const targets = document.methods.filter((method) => method !== reference);
      if (mara.mode === "screen")
        p.method.selected_assays = targets.map(
          (method) => rapidNames[method.id] || method.target,
        );
      else {
        p.method.selected_event =
          event || targets[0]?.target || p.method.selected_event;
        p.sample_id = {
          pattern: "^(?<sample>.+?)-(?<subsample>E[1-9]\\d*)(?:\\s+\\[.*\\])?$",
          flags: "i",
        };
      }
      p.targets = document.methods.map((method) => {
        const label =
          method === reference
            ? refName
            : rapidNames[method.id] || method.target;
        const kind = method === reference ? "reference" : "target";
        const native = p.targets.find(
          (rule) =>
            rule.kind === kind &&
            (rule.match.split("|").includes(label) || entry.standard < 16),
        );
        const rule = targetRule(method, 36);
        rule.match =
          "/^(?:" +
          [...new Set([method.id, method.target, label])]
            .filter(Boolean)
            .map(escape)
            .join("|") +
          ")$/i";
        return {
          ...native,
          ...rule,
          lateOutcome: native?.lateOutcome || rule.lateOutcome,
        };
      });
      const workbenchControls = {
        "blank-qc": "NTC|Extraction blank",
        "neg-qc-ref": "Non-GM control",
        "neg-qc-event": "Non-GM control",
        "neg-qc-tgt": "Non-GM control",
        "cal-lowest": "Calibrant",
        "pos-qual-qc":
          mara.mode === "quant" || mara.mode === "ddct" ? "" : "PC",
        "pos-quant-qc":
          mara.mode === "quant" || mara.mode === "ddct" ? "PC" : "",
      };
      for (const control of p.controls) {
        const pattern = workbenchControls[control.id];
        if (pattern) {
          control.matchBy = "name";
          control.match =
            "/^\\d{6}\\s*\\/\\s*(?:" + pattern + ")(?=\\s|\\[|$)/i";
        }
      }
      if (
        mara.mode === "ddct" &&
        p.comparison &&
        Number.isFinite(mara.comparatorPct)
      )
        p.comparison.control_content_percent = mara.comparatorPct;
    } else {
      p.evaluationMode = "automatic-with-evidence";
      p.profileFamily = "R2-workbench";
      p.version = "1.2";
      const lab = !!R2.LAB[document.definition.procedure];
      p.workbenchRules = {
        family: lab ? "screening-lod" : "reference-method",
        sourceSop: document.sop_id,
        stage: document.definition.stage,
        expectedTargets: document.methods.map((method) =>
          publicTarget(method.id),
        ),
        negativeCq: lab ? R2.LAB.simplex.rules.negativeCq : null,
        referenceRange: lab ? R2.LAB.simplex.rules.taxon : null,
      };
      p.targets = document.methods.map((method) =>
        targetRule(method, lab ? R2.LAB.simplex.rules.negativeCq : ""),
      );
      p.controls = [];
      const controlNames = {
        LOD: "PC at LOD",
        POS: "Positive sample",
        NC: "Non-GM control",
        PC: "PC",
        NTC: "NTC",
        BLK: "Extraction blank",
      };
      for (const layout of document.definition.layout) {
        const targets =
          "/^(?:" +
          layout.mix.split("+").map(publicTarget).map(escape).join("|") +
          ")$/i";
        for (const control of layout.run_controls) {
          const name =
            controlNames[control.control] ||
            {
              positive: "PC",
              ntc: "NTC",
              standard: "Calibrant",
            }[control.role];
          if (!name) continue;
          const range =
            control.control === "LOD" ? R2.LAB.simplex.rules.lod : null;
          p.controls.push({
            id:
              layout.mix +
              ":" +
              (control.control || control.role) +
              ":" +
              (control.level || ""),
            name,
            matchBy: "name",
            match: "/^\\d{6}\\s*\\/\\s*" + escape(name) + "(?=\\s|\\[|$)/i",
            targets,
            expect:
              control.role === "standard"
                ? "standard"
                : control.role === "positive" ||
                    (control.control === "NC" &&
                      layout.mix
                        .split("+")
                        .every((id) => R2.GMO.methods[id].kind === "taxon"))
                  ? "positive"
                  : "negative",
            cqLo: range ? range[0] : "",
            cqHi: range ? range[1] : "",
            minReplicates:
              document.definition.stage === "quant" &&
              ["PC", "NTC", "CAL"].includes(control.control)
                ? Math.max(3, control.wells)
                : control.wells,
            minPerRun:
              document.definition.stage === "quant" &&
              ["PC", "NTC", "CAL"].includes(control.control)
                ? Math.max(3, control.wells)
                : control.wells,
            onFail: "reject",
          });
        }
      }
      // Simplex screening: the procedure's minimum per element mix applies whatever the plate design. A design with fewer
      // controls still needs them (reject), a design with more needs all planned wells; a removed control keeps its rule.
      {
        const MIN = !lab
          ? document.definition.stage === "quant"
            ? { PC: 3, NTC: 3 }
            : { PC: 1, NTC: 1 }
          : R2.LAB.simplex.rules.minControls || {
              LOD: 2,
              POS: 1,
              NTC: 1,
              BLK: 1,
            };
        for (const layout of document.definition.layout) {
          if (
            lab &&
            layout.mix
              .split("+")
              .some((id) => (R2.GMO.methods[id] || {}).kind === "taxon")
          )
            continue;
          const targets =
            "/^(?:" +
            layout.mix.split("+").map(publicTarget).map(escape).join("|") +
            ")$/i";
          for (const [code, min] of Object.entries(MIN)) {
            const id = layout.mix + ":" + code + ":",
              have = p.controls.filter((c) => c.id.startsWith(id)); // ids end with the control's level, if any
            if (have.length) {
              for (const c of have)
                c.minReplicates = c.minPerRun = Math.max(c.minReplicates, min);
              continue;
            }
            const name = controlNames[code],
              range = code === "LOD" ? R2.LAB.simplex.rules.lod : null;
            p.controls.push({
              id,
              name,
              matchBy: "name",
              match: "/^\\d{6}\\s*\\/\\s*" + escape(name) + "(?=\\s|\\[|$)/i",
              targets,
              expect:
                code === "LOD" || code === "POS" ? "positive" : "negative",
              cqLo: range ? range[0] : "",
              cqHi: range ? range[1] : "",
              minReplicates: min,
              minPerRun: min,
              onFail: "reject",
              absentFromPlate: true,
            });
          }
        }
      }
      // Standards are one rule per assay, covering all prescribed levels.
      const controls = [];
      for (const control of p.controls) {
        if (control.expect === "standard") {
          control.matchBy = "role";
          control.match = "Standard";
          const existing = controls.find(
            (item) =>
              item.expect === "standard" && item.targets === control.targets,
          );
          if (existing) {
            existing.minPerRun += control.minPerRun;
            continue;
          }
        }
        controls.push(control);
      }
      p.controls = controls;
      const planned = document.definition.layout
        .map((x) => x.per_sample)
        .filter(Boolean)
        // MISSY evaluates each extraction as its own sample group, so the cap is the PCR replicates per extraction.
        .map((x) => x.pcr_replicates);
      const minimum =
        document.experimentalDesign && planned.length
          ? Math.min(3, ...planned)
          : 3;
      p.replicates = {
        min: minimum,
        positiveMin: minimum,
        partialOutcome: "Repeat",
        maxSd: "",
        sdOutcome: "Repeat",
      };
      Object.assign(p.run, {
        colourCompensation: "off",
        stdCurve: document.definition.stage === "quant" ? "reject" : "off",
        minR2: 0.98,
        effMin: 100 * (Math.pow(10, 1 / 3.6) - 1),
        effMax: 100 * (Math.pow(10, 1 / 3.1) - 1),
        minLogs: 0,
        calibration: "off",
      });
      p.sample_id = {
        pattern: "",
        flags: "i",
      };
    }
    if (document.experimentalDesign) {
      p.experimentalDesign = clone(document.experimentalDesign);
      p.notes +=
        " Custom experimental design: extraction, replicate and control counts are recorded in the source SOP layout. Original method acceptance minima remain applicable.";
      const d = document.experimentalDesign;
      if (
        mara &&
        ((d.extractions ?? 3) !== 3 || (d.replicates ?? 3) !== 3)
      ) {
        p.evaluationMode = "unconfigured";
        p.notes +=
          " The altered design is outside the source method's 3 × 3 interpretation; configure and approve a custom SOP before issuing sample decisions.";
      }
    }
    const { locked, sha256, ...canonical } = p;
    p.sha256 = R2.sha256(R2.utf8(R2.sop.canonical(canonical)));
    return JSON.stringify(p, null, 2);
  };
  R2.missySopForRun = (run) => R2.missySop(R2.sop.docOfRun(run));
})(window.R2);
