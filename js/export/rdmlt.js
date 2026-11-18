/* Offline RDMLt 1.0 draft revision 2 package with an RDML 1.3 core. */
(function (R2) {
  "use strict";
  const xml = R2.esc;
  const temperatures = [
    ["block-1", "Block zone 1", "zone1_c"],
    ["block-2", "Block zone 2", "zone2_c"],
    ["lid", "Heated lid", "lid_c"],
    ["heat-sink", "Heat sink", "heatsink_c"],
    ["reference", "Reference sensor", "ref_c"]
  ];
  const series = [
    ["setpoint", "Block temperature setpoint", "Cel", "setpoint_c", "programmed"],
    ["tec-current-1", "Zone 1 thermoelectric current", "A", "i_tec1_mA", "measured", 0.001],
    ["tec-current-2", "Zone 2 thermoelectric current", "A", "i_tec2_mA", "measured", 0.001],
    ["tec-duty-1", "Zone 1 signed drive fraction", "1", "duty1", "reported"],
    ["tec-duty-2", "Zone 2 signed drive fraction", "1", "duty2", "reported"],
    ["lid-duty", "Lid drive fraction", "1", "lid_duty", "reported"],
    ["fan-duty", "Fan drive fraction", "1", "fan_duty", "reported"],
    ["fan-speed", "Fan rotational speed", "1/min", "fan_rpm", "measured"]
  ];
  const eventTypes = {
    RUN_START: "run start", RUN_COMPLETE: "run completion", RUN_ABORTED: "run abort",
    SELFTEST_OK: "instrument self-test passed", LID_READY: "cover temperature reached",
    LID_OPENED: "cover opening", MELT_START: "melting ramp start", MELT_END: "melting ramp end",
    READ_START: "optical acquisition start", READ_END: "optical acquisition end",
    BOOT: "firmware start", STAGE_START: "thermal stage start", STEP_START: "thermal step start",
    STEP_END: "thermal step end", TARGET_REACHED: "thermal target reached", PAUSED: "programme pause",
    RESUMED: "programme resume", HOLDING: "indefinite hold start", FAULT_CLEARED: "fault cleared"
  };
  const ref = (tag, id) => `<${tag} id="${xml(id)}"/>`;
  const elapsed = seconds => `<elapsed unit="s" origin="reported" termId="elapsed-time">${seconds}</elapsed><clock>elapsed</clock>`;
  const origin = `<timeOrigin>${elapsed(0)}${ref("referenceEvent", "clock-origin")}</timeOrigin>`;
  const col = (id, quantity, unit, source) => `<column id="${id}"><quantity>${quantity}</quantity><unit>${unit}</unit><dataType>float64</dataType><missingValue>NA</missingValue><origin>${source}</origin></column>`;

  const q = (tag, value, unit, source = "reported") => Number.isFinite(value) ?
    `<${tag} unit="${unit}" origin="${source}">${value}</${tag}>` : "";
  const annotation = (property, value) =>
    `<annotation><rdml:property>${xml(property)}</rdml:property><rdml:value>${xml(value)}</rdml:value></annotation>`;
  const stepId = (stage, step) => "step-" + stage + "-" + step;
  const channelId = channel => "channel-" + (channel + 1);
  const acquisitionId = row => "read-" + row.acq + "-" + (row.channel + 1);
  const countUnit = "{instrument_unit}";
  const net = row => (row.sum_on - row.sum_off) / (8 * row.periods);
  const opticalCols = [
    ["reaction", "Reaction position (row-major, one-based)", "1", row => row.well + 1],
    ["sequence", "Firmware record sequence", "1", row => row.seq],
    ["start", "Integration start elapsed time", "s", row => row.t_start_ms / 1000],
    ["end", "Integration end elapsed time", "s", row => row.t_end_ms / 1000],
    ["integration", "Integration duration", "ms", row => row.t_end_ms - row.t_start_ms],
    ["periods", "Chopped illumination periods", "1", row => row.periods],
    ["led-on", "Sum of illuminated detector counts", countUnit, row => row.sum_on],
    ["led-off", "Sum of dark detector counts", countUnit, row => row.sum_off],
    ["mean-net", "Mean background-subtracted detector counts", countUnit, net, "derived"],
    ["squared-net", "Sum of squared net detector counts", "{instrument_unit}2", row => row.sumsq_net],
    ["min-net", "Minimum net detector count", countUnit, row => row.min_net],
    ["max-net", "Maximum net detector count", countUnit, row => row.max_net],
    ["saturation", "Saturated detector samples", "1", row => row.sat_samples],
    ["reference-on", "Illuminated instrument reference sum", countUnit, row => row.ref_sum_on],
    ["reference-off", "Dark instrument reference sum", countUnit, row => row.ref_sum_off],
    ["zone-start", "Block zone temperature at integration start", "Cel", row => row.tzone_start_mC / 1000],
    ["zone-end", "Block zone temperature at integration end", "Cel", row => row.tzone_end_mC / 1000]
  ];

  const metric = (label, value, unit, source) =>
    `<metric><property>${label}</property>${q("value", value, unit, source)}</metric>`;
  function eventDetails(event, acquisitionKinds) {
    const { code, a, b } = event;
    switch (code) {
      case "STEP_START":
      case "STEP_END":
        return { cycle: b, step: stepId(Math.floor(a / 100), a % 100) };
      case "STAGE_START":
        return { metrics: metric("Programmed stage index (zero-based)", a, "1") };
      case "LID_READY":
        return { duration: b / 1000, metrics: metric("Lid temperature at readiness", a / 1000, "Cel", "measured") };
      case "TARGET_REACHED":
        return { duration: b / 1000, metrics: metric("Programmed thermal target", a / 1000, "Cel", "programmed") };
      case "MELT_START":
        return { metrics: metric("Melt ramp start setpoint", a / 1000, "Cel", "programmed") +
          metric("Melt ramp end setpoint", b / 1000, "Cel", "programmed") };
      case "MELT_END":
        return { metrics: metric("Completed melt scans", a, "1") };
      case "RUN_COMPLETE":
        return { metrics: metric("Completed plate scans", a, "1") };
      case "READ_START":
      case "READ_END": {
        const mode = acquisitionKinds.get(a);
        let metrics = metric("Plate scan identifier", a, "1");
        if (mode === "M") metrics += metric("Melt scan index", b, "1");
        if (code === "READ_END" && mode === "A") metrics += metric("Maximum hold temperature error up to the read", b / 1000, "Cel", "derived");
        return { cycle: code === "READ_START" && mode === "A" ? b : undefined, metrics };
      }
      default:
        return {};
    }
  }

  function conditions(protocol) {
    const steps = protocol.stages.flatMap((stage, i) => {
      if (stage.type === "melt") return [`<step id="${stepId(i, 0)}"><description>Continuous melt ramp from ${stage.from_c} to ${stage.to_c} °C</description>${q("temperature", stage.to_c, "Cel", "programmed")}${q("rampRate", stage.rate_c_per_s, "Cel/s", "programmed")}<acquisition>true</acquisition><acquisitionMode>melting</acquisitionMode></step>`];
      return stage.steps.map((step, j) => `<step id="${stepId(i, j)}"><description>${stage.type} stage ${i + 1}, step ${j + 1}</description>${q("temperature", step.temp_c, "Cel", "programmed")}${q("temperatureChange", step.delta_temp_c, "Cel", "programmed")}${q("duration", step.hold_s, "s", "programmed")}${q("rampRate", step.ramp_c_per_s, "Cel/s", "programmed")}<acquisition>${!!step.read}</acquisition>${stage.repeats > 1 && j === stage.steps.length - 1 ? `<repeat>${stage.repeats}</repeat>` : ""}</step>`);
    });
    return `<conditions><description>Programmed stages in order. Repeat applies to all steps of the named stage.</description>${ref("thermalCyclingConditions", "protocol")}${q("coverTemperature", protocol.lid_c, "Cel", "programmed")}${steps.join("")}${ref("documentation", "inputs")}</conditions>`;
  }

  function reactionDetails(run, evaluation, byWell) {
    const analyses = evaluation.order.map(method => `<analysis id="analysis-${method}"><name>${xml(evaluation.assays[method].name)}</name>${ref("software", "workbench")}<origin>stored analysis</origin>${ref("documentation", "evaluation")}${ref("documentation", "assay-diagnostics")}</analysis>`);
    const bySample = new Map((evaluation.samples || []).map(s => [s.no, s.ev]));
    const reacts = run.plate.flatMap((well, w) => {
      if (!well.t.length) return [];
      const data = well.t.map(target => {
        const sampleEvaluation = bySample.get(well.sampleNo) || evaluation;
        const assay = sampleEvaluation.assays[target.m], amp = assay.one.res.amp, curve = amp?.wells[w];
        const reads = byWell[w][assay.channel], signals = [];
        function signal(type, suffix, points) {
          if (points.length) signals.push(`<signal id="signal-${w + 1}-${target.m}-${suffix}"><type>${type}</type>${ref("channel", channelId(assay.channel))}<unit>${countUnit}</unit><origin>derived</origin>${points.join("")}${ref("documentation", "mapping")}</signal>`);
        }
        const point = (tag, coordinate, value, row) => `<${tag}>${coordinate}${q("fluor", value, countUnit, "derived")}${q("elapsed", row.t_end_ms / 1000, "s")}${ref("acquisition", acquisitionId(row))}${row.sat_samples ? "<valid>false</valid>" : ""}</${tag}>`;
        const amplification = reads.filter(row => row.kind === "A"), melting = reads.filter(row => row.kind === "M");
        signal("background corrected", "amp", amplification.map(row => point("adp", `<cyc>${row.cycle}</cyc>`, net(row), row)));
        signal("melting", "melt", melting.map(row => point("mdp", q("tmp", (row.tzone_start_mC + row.tzone_end_mC) / 2000, "Cel", "derived"), net(row), row)));
        if (curve?.corrected) {
          const mainReads = new Map(amplification.map(row => [row.cycle, row]));
          signal("baseline corrected", "baseline", amp.cycles.flatMap((cycle, i) => {
            const row = mainReads.get(cycle), value = curve.corrected[i];
            return row && Number.isFinite(value) ? [point("adp", `<cyc>${cycle}</cyc>`, value, row)] : [];
          }));
        }
        const baseline = curve?.baseline?.window;
        const settings = amp ? `<analysisSettings><description>${xml(amp.cqMethod + " · " + amp.thresholdSource)}</description><cqDetectionMethod>other</cqDetectionMethod>${q("threshold", amp.threshold, countUnit)}${baseline ? `<baseline><automatic>true</automatic><startCycle>${baseline[0]}</startCycle><endCycle>${baseline[1]}</endCycle><method>Linear fit over the selected baseline window</method></baseline>` : ""}${ref("documentation", "evaluation")}</analysisSettings>` : "";
        const resultState = !assay.valid || (well.role === "unknown" && assay.reported === "not reported") ? "invalid" :
          Number.isFinite(curve?.cq) ? "determined" : "undetermined";
        const result = `<result><state>${resultState}</state>${q("cq", curve?.cq, "1", "stored analysis")}${q("conc", curve?.quantity, "{copies}", "stored analysis")}${q("tm", assay.tm[w], "Cel", "stored analysis")}${q("endPt", curve?.endSignal, countUnit, "stored analysis")}${well.role === "unknown" ? `<call>${xml(assay.reported)}</call>` : ""}${curve?.cqReason ? `<note>${xml(curve.cqReason)}</note>` : ""}</result>`;
        return `<data>${ref("tar", target.m)}${signals.join("")}${ref("analysis", "analysis-" + target.m)}${settings}${result}${target.q != null ? annotation("assigned target copies per reaction", target.q) : ""}</data>`;
      });
      const volumes = [...new Set(well.t.map(target => R2.GMO.methods[target.m].vol))];
      return [`<react id="${w + 1}"><description>${xml(well.sample)}</description><position>${R2.wellName(w)}</position>${ref("sample", R2.rdmlSampleKey(well, w))}${volumes.length === 1 ? q("volume", volumes[0], "uL", "programmed") : ""}${data.join("")}</react>`];
    });
    return [...analyses, ...reacts];
  }

  function payloadsFor(run, ev) {
    const payloads = [], manifest = [], rec = run.record;
    function file(id, name, content, mediaType) {
      const data = R2.utf8(content);
      payloads.push({ name, data });
      manifest.push(`<file id="${id}"><filename>${name}</filename><mediaType>${mediaType}</mediaType><sha256>${R2.sha256(data)}</sha256><byteCount>${data.length}</byteCount></file>`);
    }
    function writeTable(id, name, rows, columns) {
      const lines = [columns.map(column => column[0]).join("\t")];
      for (const row of rows) lines.push(columns.map(([, , , get]) => {
        const value = get(row);
        return Number.isFinite(value) ? value : "NA";
      }).join("\t"));
      file(id, name, lines.join("\n") + "\n", "text/tab-separated-values");
      return `<table>${ref("file", id)}<storage>TSV</storage><rowCount>${rows.length}</rowCount>${columns.map(([key, label, unit, , source]) => col(key, label, unit, source || "reported")).join("")}${ref("documentation", "mapping")}</table>`;
    }
    function table(id, quantity, unit, field, source, scale = 1) {
      return writeTable(id, "telemetry/" + id + ".tsv", rec.telemetry, [
        ["elapsed", "Elapsed instrument time", "s", row => row.t_ms / 1000],
        ["value", quantity, unit, row => row[field] * scale, source]
      ]);
    }

    file("core-file", "rdml_data.xml", R2.rdmlXml(run, ev, "1.3"), "application/xml");
    file("native-record", "source/simulator-record.json", JSON.stringify(rec), "application/json");
    file("run-input", "source/run-input.json", JSON.stringify({
      runId: run.runId, serial: run.serial, startedAt: run.startedAt, finishedAt: run.time,
      outcome: run.outcome, preRunTask: run.preRunTask || null, injectedFault: run.injectedFault || null, batch: run.batch || null, sampleIdentity: run.sampleIdentity, plate: run.plate, sopPlate: run.sopPlate || null, protocol: run.protocol,
      seed: run.seed, operator: run.operator, gmo: run.gmo, firmwareConfiguration: run.firmwareConfiguration,
      simulationSetup: run.simulationSetup
    }, null, 2), "application/json");
    file("analysis-file", "analysis/evaluation.json", R2.analysisJson(run, ev, null), "application/json");
    const diagnostics = Object.fromEntries(ev.order.map(method => [method, ev.assays[method].one.res]));
    file("assay-detail", "analysis/assay-detail.json", JSON.stringify(diagnostics), "application/json");
    file("sop-file", "analysis/sop.json", R2.sopJson(run), "application/json");
    if (R2.missySopForRun) file("missy-sop-profile", "analysis/missy.sop.json", R2.missySopForRun(run), "application/json");
    if (run.chemLog?.length) file("chemistry-file", "source/simulator-chemistry.json", JSON.stringify(run.chemLog), "application/json");
    if (R2.tempStats) file("thermal-statistics", "analysis/temperature-statistics.json",
      JSON.stringify(R2.tempStats(rec.telemetry, run.protocol)), "application/json");
    const descriptions = "All data are simulated. TSV rows retain each original telemetry timestamp. " +
      "Elapsed seconds use the instrument clock, with zero at simulator initialization. Browser timestamps mark run start and finish. " +
      "Temperature logs use virtual block, lid, heat sink and reference sensors. The setpoint is a programmed value. " +
      "The firmware table supplies an explicit state code map. Optical acquisitions represent one channel in one sequential plate scan. " +
      "Each acquisition table row describes one detector integration at one well. The reaction coordinate equals the RDML reaction ID when that well is occupied. " +
      "Acquisition time is the first integration start in that scan. The table provides start and end times per well. " +
      "A saturating read is retained with its saturation count and marked invalid in linked signal points. " +
      "The simulator record preserves the exact thermal, optical and event fields and record sequence. " +
      "The core fluorescence is mean LED-on minus LED-off per detector sample. Cq values in the core are per-well observations; use the evaluation file for report eligibility.";
    const logs = rec.telemetry.length ? temperatures.map(([id, quantity, field]) =>
      `<temperatureLog id="log-${id}">${ref("sensor", id)}${origin}${table(id, "Temperature", "Cel", field, "measured")}</temperatureLog>`) : [];
    const traces = rec.telemetry.length ? series.map(([id, quantity, unit, field, source, scale]) =>
      `<series id="series-${id}"><quantity>${quantity}</quantity><unit>${unit}</unit><origin>${source}</origin>${origin}${table(id, quantity, unit, field, source, scale)}</series>`) : [];
    if (rec.telemetry.length) {
      const stateNames = [...new Set(rec.telemetry.map(row => row.state))];
      const firmwareCols = [
        ["elapsed", "Elapsed instrument time", "s", row => row.t_ms / 1000],
        ["sequence", "Firmware record sequence", "1", row => row.seq],
        ["state", "Firmware state code", "1", row => stateNames.indexOf(row.state)],
        ["stage", "Programmed stage index (zero-based)", "1", row => row.stage],
        ["step", "Programmed step index (zero-based)", "1", row => row.step],
        ["cycle", "Firmware cycle index", "1", row => row.cycle],
        ["enable", "Drive enabled", "1", row => row.enable],
        ["lid-closed", "Lid closed", "1", row => row.lid_closed],
        ["hardware-trip", "Hardware trip asserted", "1", row => row.hw_trip],
        ["rails-ok", "Power rails within limits", "1", row => row.rails_ok],
        ["detector-busy", "Optical acquisition active", "1", row => row.optics_busy]
      ];
      const firmware = writeTable("firmware", "telemetry/firmware.tsv", rec.telemetry, firmwareCols);
      traces.push(`<series id="firmware-state"><quantity>Firmware state and interlocks</quantity><unit>1</unit><origin>reported</origin>${origin}${firmware}${annotation("firmware state code map", stateNames.map((state, i) => i + "=" + state).join(", "))}</series>`);
    }
    const groups = new Map(), acquisitionKinds = new Map(), byWell = run.plate.map(() => [[], []]);
    for (const row of rec.optical) {
      const id = acquisitionId(row);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(row);
      acquisitionKinds.set(row.acq, row.kind);
      byWell[row.well][row.channel].push(row);
    }
    const acquisitions = Array.from(groups, ([id, rows]) => {
      const first = rows[0], melting = first.kind === "M";
      const step = stepId(first.stage, melting ? 0 : first.step);
      const start = Math.min(...rows.map(row => row.t_start_ms));
      const payload = writeTable(id, "acquisitions/" + id + ".tsv", rows, opticalCols);
      return `<acquisition id="${id}">${melting ? "" : `<cyc>${first.cycle}</cyc>`}${ref("step", step)}${ref("channel", channelId(first.channel))}<time>${elapsed(start / 1000)}${ref("referenceEvent", "clock-origin")}</time>${payload}${annotation("acquisition mode", melting ? "melting" : "amplification")}${annotation("plate scan identifier", first.acq)}${melting ? annotation("melt scan index", first.cycle) : ""}</acquisition>`;
    });
    const reactions = reactionDetails(run, ev, byWell);
    if (run.chemLog?.some(row => row.plant)) {
      const modelColumns = [
        ["elapsed", "Elapsed instrument time", "s", row => row.t_ms / 1000],
        ["block-1", "Modeled block zone 1 temperature", "Cel", row => row.plant?.block_c[0]],
        ["block-2", "Modeled block zone 2 temperature", "Cel", row => row.plant?.block_c[1]],
        ["lid", "Modeled lid temperature", "Cel", row => row.plant?.lid_c],
        ["heat-sink", "Modeled heat sink temperature", "Cel", row => row.plant?.sink_c],
        ["ambient", "Modeled ambient temperature", "Cel", row => row.plant?.ambient_c],
        ["current-1", "Modeled zone 1 TEC current", "A", row => row.plant?.tec_mA[0] / 1000],
        ["current-2", "Modeled zone 2 TEC current", "A", row => row.plant?.tec_mA[1] / 1000],
        ["lid-current", "Modeled lid heater current", "A", row => row.plant?.lid_mA / 1000],
        ["watchdog-age", "Time since watchdog kick", "ms", row => row.plant?.watchdog_age_ms],
        ["watchdog-ok", "Watchdog permits operation", "1", row => row.plant ? Number(row.plant.watchdog_ok) : null],
        ["enable-request", "Firmware requests drive enable", "1", row => row.plant ? Number(row.plant.enable_request) : null],
        ["trip-test", "Overtemperature proof test asserted", "1", row => row.plant ? Number(row.plant.overtemperature_test) : null],
        ["led-drive", "Selected optical LED drive ratio", "1", row => row.plant?.led_drive],
        ["destination", "Controller target temperature", "Cel", row => row.control?.destination_c],
        ["setpoint", "Current controller setpoint", "Cel", row => row.control?.setpoint_c],
        ["ramp", "Controller ramp rate limit", "Cel/s", row => row.control?.maximum_ramp_c_per_s]
      ].map(column => [...column, "derived"]);
      const payload = writeTable("plant-model", "telemetry/plant-model.tsv", run.chemLog, modelColumns);
      traces.push(`<series id="plant-model-state"><description>Per-second internal simulation values before sensor conversion.</description><quantity>Virtual plant and controller state</quantity><unit>1</unit><origin>derived</origin>${origin}${payload}${ref("documentation", "chemistry")}</series>`);
    }
    const sensors = temperatures.map(([id, location]) =>
      `<sensor id="${id}" termId="temperature"><description>Simulated ${location} sensor</description><location>${location}</location><quantity>temperature</quantity><unit>Cel</unit></sensor>`);
    if (run.chemLog?.length) {
      for (let zone = 0; zone < 2; zone++) {
        const id = "liquid-estimate-" + (zone + 1);
        const location = "Virtual reaction liquid zone " + (zone + 1);
        sensors.push(`<sensor id="${id}" termId="temperature"><description>Simulation estimate of reaction liquid temperature</description><location>${location}</location><quantity>temperature</quantity><unit>Cel</unit></sensor>`);
        const payload = writeTable(id, "telemetry/" + id + ".tsv", run.chemLog, [
          ["elapsed", "Elapsed instrument time", "s", row => row.t_ms / 1000],
          ["value", "Estimated reaction liquid temperature", "Cel", row => row.liquid_c[zone], "derived"]
        ]);
        logs.push(`<temperatureLog id="log-${id}">${ref("sensor", id)}${origin}${payload}${ref("documentation", "chemistry")}</temperatureLog>`);
      }
    }
    const events = [`<event id="clock-origin"><time>${elapsed(0)}</time><severity>information</severity><type>Instrument clock origin</type></event>`];
    for (const event of rec.events) {
      const type = eventTypes[event.code] || (event.severity >= 2 ? "instrument fault" : "instrument state transition");
      const severity = event.severity >= 2 ? "error" : event.severity === 1 ? "warning" : "information";
      const details = eventDetails(event, acquisitionKinds);
      events.push(`<event id="event-${event.seq}"><time>${elapsed(event.t_ms / 1000)}</time><severity>${severity}</severity><type>${type}</type><description>${xml(event.code)}</description>${Number.isFinite(details.cycle) ? `<cyc>${details.cycle}</cyc>` : ""}${details.step ? ref("step", details.step) : ""}${q("duration", details.duration, "s")}${details.metrics || ""}</event>`);
    }
    const channels = [0, 1].map(i => `<channel id="${channelId(i)}"><description>${i === 0 ? "FAM / SYBR Green" : "VIC / HEX / Yakima Yellow"}</description><active>true</active></channel>`);
    const runId = String(run.runId).replace(/\s+/g, "_");
    const companion = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rdmlt xmlns="urn:rdmlt:1" xmlns:rdml="http://www.rdml.org" version="1.0-draft" baseVersion="1.3" revision="2">',
      "<description>MISSY R2 Workbench simulated instrument record with telemetry</description>",
      ...manifest,
      `<core>${ref("file", "core-file")}</core>`,
      `<documentation id="mapping"><description>${xml(descriptions)}</description></documentation>`,
      `<documentation id="evaluation"><description>Workbench result eligibility, settings and diagnostic observations.</description>${ref("file", "analysis-file")}</documentation>`,
      `<documentation id="assay-diagnostics"><description>Full per-assay amplification, calibration, sigmoid, melt and flag output.</description>${ref("file", "assay-detail")}</documentation>`,
      `<documentation id="inputs"><description>Sample and control identity, extraction and run metadata.</description>${ref("file", "run-input")}</documentation>`,
      `<documentation id="sop"><description>Teaching procedure and method records, ${xml(R2.sop.idOfRun(run))} (one SOP per analysis definition).</description>${ref("file", "sop-file")}</documentation>`,
      run.chemLog?.length ? `<documentation id="chemistry"><description>Virtual reaction-state snapshots (every second on the 16-tube block, every 10 s for the occupied wells of the 384-well plate) and estimated liquid temperatures. These values come from model state.</description>${ref("file", "chemistry-file")}</documentation>` : "",
      R2.tempStats ? `<documentation id="temperature-statistics"><description>Derived whole-run, step and per-cycle temperature statistics.</description>${ref("file", "thermal-statistics")}</documentation>` : "",
      `<software id="workbench"><name>MISSY R2 Workbench</name><version>${R2.VERSION}</version></software>`,
      `<provenance>${ref("source", "native-record")}${ref("software", "workbench")}<created>${new Date().toISOString()}</created>${ref("documentation", "mapping")}</provenance>`,
      '<dictionary id="scientific-quantities" version="1.0-r2"><authority>RDMLt proposal</authority>',
      '<term id="elapsed-time" kind="coordinate"><name>Elapsed time</name><definition>Time relative to an explicitly declared origin.</definition><dimension>time</dimension><canonicalUnit>s</canonicalUnit></term>',
      '<term id="temperature" kind="quantity"><name>Temperature</name><definition>Observed temperature at an identified sensor.</definition><dimension>temperature</dimension><canonicalUnit>Cel</canonicalUnit></term>',
      "</dictionary>",
      `<instrument id="simulated-r2"><description>Simulated PCR instrument</description><model>MISSY R2</model><serialNumber>${xml(run.serial)}</serialNumber>${sensors.join("")}${channels.join("")}</instrument>`,
      `<experiment id="${xml(runId)}"><run id="${xml(runId)}"><description>${xml(run.outcome)}</description>${ref("documentation", "inputs")}${ref("documentation", "sop")}${run.chemLog?.length ? ref("documentation", "chemistry") : ""}${R2.tempStats ? ref("documentation", "temperature-statistics") : ""}${ref("instrument", "simulated-r2")}${ref("dataCollectionSoftware", "workbench")}`,
      run.startedAt ? `<runDate>${run.startedAt}</runDate>` : "",
      run.time ? `<endDate>${run.time}</endDate>` : "",
      `<state>${run.outcome.startsWith("fault") ? "failed" : ["completed", "aborted"].includes(run.outcome) ? run.outcome : "unknown"}</state>`,
      origin, conditions(run.protocol),
      `<availability section="acquisition" status="${acquisitions.length ? "present" : "not recorded"}"/>`,
      `<availability section="react" status="${reactions.length ? "present" : "not recorded"}"/>`,
      `<availability section="temperatureLog" status="${logs.length ? "present" : "not recorded"}"/>`,
      `<availability section="series" status="${traces.length ? "present" : "not recorded"}"/>`,
      ...logs, ...traces, ...acquisitions, ...events, ...reactions,
      "</run></experiment></rdmlt>"
    ];
    payloads.push({ name: "rdmlt_data.xml", data: R2.utf8(companion.join("\n")) });
    return payloads;
  }
  R2.rdmltBytes = (run, ev) => R2.zipBytes(payloadsFor(run, ev));
  R2.rdmltCompressed = (run, ev) => R2.zipDeflated(payloadsFor(run, ev));
})(window.R2);
