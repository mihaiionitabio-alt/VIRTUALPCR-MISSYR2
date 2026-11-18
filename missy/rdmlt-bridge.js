/* RDMLt adapter for the bundled MISSY. The native reader still owns RDML analysis. */
(() => {
  "use strict";
  const token = new URLSearchParams(location.hash.slice(1)).get("workbench");
  const parentWindow = window.opener;
  const allowed = !!parentWindow && /^[0-9a-f-]{36}$/i.test(token || "");
  const tell = (type, fields = {}) => parentWindow.postMessage({ type, token, ...fields }, "*");
  if (!allowed) {
    document.addEventListener("missy-initialized", () => {
      document.documentElement.classList.remove("missy-starting", "missy-configuring");
      const message = document.createElement("main");
      message.textContent = "Open MISSY from the workbench’s Quality manager workspace.";
      document.body.replaceChildren(message);
    }, { once: true });
    return;
  }

  window.R2TransferLoading.open("Starting MISSY’s analysis tools…");
  const text = bytes => new TextDecoder().decode(bytes);
  // Native history charts can consume verified virtual telemetry and evaluated controls.
  const originalStatic = ccStatic;
  ccStatic = function(run) { return { ...originalStatic(run), ...run.r2Metrics }; };
  const originalDynamic = ccDynamic;
  ccDynamic = function(run, ...args) { return { ...originalDynamic(run, ...args), ...run.r2ControlMetrics }; };
  for (const chart of CC_CHARTS.filter(chart => ["bg_median", "plateau_median", "efficiency"].includes(chart.id))) {
    if (!chart.inst.includes("BR")) chart.inst.push("BR");
  }
  for (const [id, title, unit, group] of [
    ["baseline_noise", "Early-cycle fluorescence variation", "fluorescence SD", "hardware"],
    ["baseline_drift", "Early-cycle baseline drift", "fluorescence per cycle", "hardware"],
    ["endpoint_cv", "Endpoint spread across wells", "% CV", "method"],
    ["acq_temperature_sd", "Recorded acquisition temperature variation", "°C SD", "hardware"]
  ]) {
    const def = { id, code: "V-" + id, title, unit, group, inst: ["baseline_noise", "baseline_drift"].includes(id) ? ["BR", "LC", "QS"] : ["BR"], type: "i", better: "target",
      source: "Derived from recorded fluorescence acquisition points", idea: "Compare matching instrument, assay and acquisition conditions.",
      reading: "Compare matching assay and plate conditions." };
    CC_CHARTS.push(def); CC_BY_ID[id] = def;
  }
  for (const [id, title, unit] of [
    ["virtual_fan_rpm", "Cooling fan speed", "rpm"],
    ["virtual_tec_current", "Peak thermoelectric current", "mA"],
    ["virtual_tec_duty", "Mean thermoelectric drive", "share"],
    ["virtual_lid_duty", "Mean heated-lid drive", "share"],
    ["virtual_hold_rms", "Block hold error RMS", "°C"],
    ["virtual_zone_spread", "Maximum block-zone difference", "°C"],
    ["virtual_lid_temp", "Median lid temperature", "°C"],
    ["virtual_sink_peak", "Peak heat-sink temperature", "°C"],
    ["virtual_reference_gap", "Independent sensor versus controller gap", "°C"]
  ]) {
    const def = { id, code: "V-" + id, title, unit, group: "hardware", inst: ["LC", "QS"], type: "i", better: "target",
      source: "Verified RDMLt simulator telemetry",
      idea: "Calculated from the measurements recorded in each virtual run.",
      reading: "Compare the same virtual instrument and programme across runs." };
    CC_CHARTS.push(def); CC_BY_ID[id] = def;
  }
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
  function telemetryGap(rows) {
    const intervals = rows.slice(1).map((row,i)=>(row.t_ms-rows[i].t_ms)/1000).filter(value=>Number.isFinite(value)&&value>0);
    const cadence = ccMedian(intervals);
    return intervals.filter(value=>value>3*cadence).reduce((sum,value)=>sum+value-cadence,0);
  }
  async function connectTelemetry() {
    for (const bundle of bundles) {
      const target = RUNS.find(run => run.file === bundle.file.name);
      if (!target) continue;
      let sourceRecord = null;
      if (bundle.files.has("source/simulator-record.json")) {
        const record = sourceRecord = bundle.record || JSON.parse(text(await extract(bundle, "source/simulator-record.json")));
        const rows = record.telemetry || [], optical = record.optical || [];
        if (rows.length > 1) {
          const time = rows.map(row => row.t_ms / 1000), temperature = rows.map(row => row.zone1_c);
          target.cc ||= {};
          target.cc.log = { seconds: time, temp: temperature };
          const metrics = ccThermalSummary(ccThermalSteps(time, temperature, ccSetpoints(target)), ccPeakRates(time, temperature, 2));
          metrics.run_minutes = (time.at(-1) - time[0]) / 60;
          const missing = telemetryGap(rows);
          metrics.temperature_log_minutes = (time.at(-1)-time[0]-missing)/60;
          metrics.run_log_gap_seconds = missing;
          metrics.zone_spread = Math.max(...rows.map(row => Math.abs(row.zone1_c - row.zone2_c)));
          metrics.cover_temp = ccMedian(rows.map(row => row.lid_c));
          metrics.heatsink_max = Math.max(...rows.map(row => row.heatsink_c));
          metrics.invalid_acq = { bad: optical.filter(row => row.sat_samples > 0).length, n: optical.length };
          const byChannel = byKey(optical.filter(row => row.kind === "A"), row => String(row.channel + 1));
          metrics.lamp_ref = {}; metrics.lamp_drift = {}; metrics.exposure = {};
          for (const [channel, readings] of byChannel) {
            const ref = readings.map(row => (row.ref_sum_on - row.ref_sum_off) / (row.periods * 8));
            metrics.lamp_ref[channel] = ccMedian(ref);
            metrics.lamp_drift[channel] = ref[0] ? 100 * (ref.at(-1) / ref[0] - 1) : 0;
            metrics.exposure[channel] = ccMedian(readings.map(row => row.periods));
          }
          metrics.virtual_fan_rpm = ccMedian(rows.map(row => row.fan_rpm));
          metrics.virtual_tec_current = rows.reduce((largest, row) => Math.max(largest, row.i_tec1_mA, row.i_tec2_mA), 0);
          metrics.virtual_tec_duty = average(rows.map(row => (Math.abs(row.duty1) + Math.abs(row.duty2)) / 2));
          metrics.virtual_lid_duty = average(rows.map(row => row.lid_duty));
          const holds = rows.filter(row => row.state === "HOLD");
          if (holds.length) metrics.virtual_hold_rms = Math.sqrt(average(holds.map(row => ((row.zone1_c - row.setpoint_c) ** 2 + (row.zone2_c - row.setpoint_c) ** 2) / 2)));
          metrics.virtual_zone_spread = metrics.zone_spread;
          metrics.virtual_lid_temp = metrics.cover_temp;
          metrics.virtual_sink_peak = metrics.heatsink_max;
          const referenceGaps = rows.filter(row=>[row.ref_c,row.zone1_c,row.zone2_c].every(Number.isFinite)).map(row=>Math.abs(row.ref_c-(row.zone1_c+row.zone2_c)/2));
          if (referenceGaps.length) metrics.virtual_reference_gap = referenceGaps.reduce((largest,value)=>Math.max(largest,value),0);
          const traces=byKey(optical.filter(row=>row.kind==='A'&&row.cycle>=2&&row.cycle<=10),row=>row.well+'/'+row.channel);
          const noiseByChannel=new Map(),driftByChannel=new Map();
          for(const trace of traces.values()){
            if(trace.length<3)continue;
            const xs=trace.map(row=>row.cycle),ys=trace.map(row=>(row.sum_on-row.sum_off)/(row.periods*8));
            const mx=average(xs),my=average(ys),sxx=xs.reduce((sum,value)=>sum+(value-mx)**2,0);
            const slope=sxx?xs.reduce((sum,value,i)=>sum+(value-mx)*(ys[i]-my),0)/sxx:0;
            const residual=Math.sqrt(ys.reduce((sum,value,i)=>sum+(value-(my+slope*(xs[i]-mx)))**2,0)/(ys.length-2));
            const channel=String(trace[0].channel+1);
            if(!noiseByChannel.has(channel)){noiseByChannel.set(channel,[]);driftByChannel.set(channel,[]);}
            noiseByChannel.get(channel).push(residual);driftByChannel.get(channel).push(slope);
          }
          metrics.baseline_noise=ccMedian([...noiseByChannel.values()].flat());
          metrics.baseline_drift=ccMedian([...driftByChannel.values()].flat());
          target.r2Metrics = metrics;
          target.ccStatic = null;
        }
      }
      if (bundle.files.has("analysis/evaluation.json")) {
        const evaluation = JSON.parse(text(await extract(bundle, "analysis/evaluation.json")));
        const metrics = { pc_cq: {}, pc_amplitude: {}, ntc_rate: {}, efficiency: {} };
        for (const assay of evaluation.assays || []) {
          const name = assay.target;
          const positive = (assay.positive_cq || []).filter(Number.isFinite);
          if (positive.length) metrics.pc_cq[name] = average(positive);
          if (sourceRecord) {
            const controls = new Set((assay.wells || []).filter(well => well.role === "positive").map(well => well.well));
            const readings = (sourceRecord.optical || []).filter(row => row.kind === "A" && row.channel === assay.channel - 1 && controls.has(row.well));
            const amplitudes = [...byKey(readings, row => row.well).values()].map(rows => {
              const signal = rows.map(row => (row.sum_on - row.sum_off) / (row.periods * 8));
              return ccMedian(signal.slice(-4)) - ccMedian(signal.slice(2, 7));
            });
            if (amplitudes.length) metrics.pc_amplitude[name] = ccMedian(amplitudes);
          }
          const negatives = (assay.wells || []).filter(well => well.role === "ntc");
          if (negatives.length) metrics.ntc_rate[name] = { bad: negatives.filter(well => Number.isFinite(well.cq)).length, n: negatives.length };
          if (assay.calibration) metrics.efficiency[name] = assay.calibration.efficiency * 100;
        }
        target.r2ControlMetrics = metrics;
      }
    }
    CC_STATE.cache = null;
    markDirty("panel");
  }

  const nativeProcessing = runProcessingState;
  runProcessingState = function(run) {
    if (run?.r2Virtual) return { state: "instrument", reason: "Verified virtual instrument record in RDMLt; simulated measurements and producer calculations" };
    return nativeProcessing(run);
  };
  const nativeApplicability = sopRunApplicability;
  sopRunApplicability = function(run) {
    if (run.r2Virtual && SOP.sourceWorkbenchSop?.id && SOP.sourceWorkbenchSop.id !== run.r2Virtual.sourceSop)
      return { applicable: false, reason: "The selected SOP belongs to a different virtual procedure." };
    return nativeApplicability(run);
  };
  const nativeTimeline = runTimeline;
  runTimeline = function(run) {
    return [...nativeTimeline(run), ...(run.r2Timeline || [])].sort((a, b) => a.time - b.time);
  };
  const nativeEvaluate = sopEvaluateRun;
  sopEvaluateRun = function(run, ri) {
    const result = nativeEvaluate(run, ri), rules = SOP.workbenchRules;
    if (run.r2Virtual && (run.r2Virtual.outcome !== "completed" || run.r2Virtual.legacyMissingControls)) {
      const reason = run.r2Virtual.legacyMissingControls ? "The legacy missing-controls scenario omitted NTC/extraction blanks; its generated SOP did not retain the intended control requirements." : "Virtual programme did not complete: " + (run.r2Virtual.outcome || "unknown");
      result.criteria.push({criterion:run.r2Virtual.legacyMissingControls?"Required run controls (NTC and extraction blank)":"Virtual programme completed",action:"reject",status:"fail",evidence:reason});
      result.rejected=result.criteria.filter(item=>item.status==="fail");result.status="Rejected";
      for(const row of result.rows) if(!row.ctrl && row.role!=="Standard") {
        row.outcome="Invalid run";row.label="Invalid run";row.reason=reason;row.report=reason;row.conc=NaN;
        if(row.methodValues){row.methodValues={...row.methodValues};delete row.methodValues.content_percent;delete row.methodValues.U;}
      }
      return result;
    }
    if (run.r2Virtual?.telemetryGapSeconds > 0) {
      result.criteria.push({criterion:"Recorded data continuity",action:"review",status:"review",
        evidence:run.r2Virtual.telemetryGapSeconds.toFixed(2)+" s of missing telemetry relative to the observed recording cadence"});
      result.reviewed=result.criteria.filter(item=>item.status==="review");
      if(!result.rejected.length) result.status="Accepted with review";
    }
    if (!run.r2Virtual || !rules || SOP.sourceWorkbenchSop?.id !== run.r2Virtual.sourceSop || !result.rows.length) return result;
    const add = (criterion, pass, evidence) => result.criteria.push({ criterion, action: "reject", status: pass ? "pass" : "fail", evidence });
    add("Virtual programme completed", run.r2Virtual.outcome === "completed", run.r2Virtual.outcome || "unknown");
    for (const control of SOP.controls) {
      const matchingTargets = (rules.expectedTargets || [...new Set(run.wells.map(well => well.target || well.analysis))]).filter(target => sopMatcher(control.targets || "*")(target));
      for (const target of matchingTargets) {
        const count = result.rows.filter(row => row.ctrl === control && row.target === target).reduce((n, row) => n + row.n, 0);
        add("Control present — " + control.name + " / " + target, count >= Number(control.minPerRun || 0), count + " wells");
      }
    }
    if (rules.family === "screening-lod") {
      const samples = [...byKey(result.rows.filter(row => !row.ctrl && row.role !== "Standard"), row => row.sample).values()];
      for (const rows of samples) {
        const reference = rows.find(row => row.spec.kind === "reference");
        const validReference = reference && reference.det === reference.n && Number.isFinite(reference.cqMean) && reference.cqMean >= rules.referenceRange[0] && reference.cqMean <= rules.referenceRange[1];
        for (const row of rows) {
          if (!validReference) { row.outcome = "Invalid"; row.reason = "Reference-gene Cq must be within " + rules.referenceRange.join("–") + "; dilute or re-extract and repeat."; continue; }
          if (row.spec.kind === "reference" || ["Repeat", "Invalid run"].includes(row.outcome)) continue;
          const lod = result.rows.find(item => item.target === row.target && item.ctrl?.name === "PC at LOD");
          if (!lod || lod.outcome !== "Control pass") { row.outcome = "Invalid run"; row.reason = "Valid control at the detection limit is required."; }
          else if (!Number.isFinite(row.cqMean) || row.cqMean >= rules.negativeCq) { row.outcome = "Negative"; row.reason = "No amplification before Cq " + rules.negativeCq; }
          else if (row.cqMean >= lod.cqMean) { row.outcome = "Inconclusive"; row.reason = "Amplification below the detection limit: mean Cq " + num(row.cqMean, 2) + ", LOD control " + num(lod.cqMean, 2); }
          else { row.outcome = "Positive"; row.reason = "Mean Cq below the detection-limit control (" + num(lod.cqMean, 2) + ")"; }
        }
        const elements = rows.filter(row => row.spec.kind === "target");
        if (elements.length === 2 && elements.filter(row => row.outcome === "Positive").length === 1) {
          for (const row of elements) if (!["Invalid", "Invalid run"].includes(row.outcome)) { row.outcome = "Repeat"; row.reason = "Only one screening element detected above the detection limit; repeat DNA extraction."; }
        }
      }
    }
    if (run.r2Virtual.stage === "quant" && rules.family === "reference-method") {
      const calibration=sopStdCurves(run),curveOf=row=>calibration.find(curve=>curve.target===row.target);
      const valid=curve=>{
        if(!curve||curve.levels<4||curve.points.length<12||curve.slope< -3.6||curve.slope> -3.1||curve.r2<0.98)return false;
        const levels=new Map();for(const point of curve.points)levels.set(point.conc,(levels.get(point.conc)||0)+1);
        return [...levels.values()].every(count=>count>=3);
      };
      const quantity=(row,curve)=>valid(curve)?average(row.used.map(well=>Math.pow(10,(sopCq(well)-curve.intercept)/curve.slope)).filter(Number.isFinite)):NaN;
      for(const curve of calibration)add('Quantification calibration — '+curve.target,valid(curve),'slope '+num(curve.slope,3)+', R² '+num(curve.r2,4)+', '+curve.levels+' levels');
      const targets=result.rows.filter(row=>!row.ctrl&&row.role!=='Standard'&&row.spec.kind==='target');
      const pcEvent=result.rows.find(row=>row.ctrl?.expect==='positive'&&row.spec.kind==='target'),pcRef=result.rows.find(row=>row.ctrl?.expect==='positive'&&row.spec.kind==='reference');
      const controlPct=pcEvent&&pcRef?100*quantity(pcEvent,curveOf(pcEvent))/quantity(pcRef,curveOf(pcRef)):NaN;
      add('1% control recovery',Number.isFinite(controlPct)&&controlPct>=0.5&&controlPct<=1.5,Number.isFinite(controlPct)?num(controlPct,3)+' %':'Not quantifiable');
      for(const row of targets){
        const ref=result.rows.find(item=>!item.ctrl&&item.sample===row.sample&&item.spec.kind==='reference'),eventCurve=curveOf(row),refCurve=ref&&curveOf(ref);
        const reason=!valid(eventCurve)||!valid(refCurve)?'Calibration outside the prescribed slope/R²/level requirements':!ref||ref.det!==ref.n?'Reference triplicates not accepted':row.det!==row.n||row.n<3?'Target triplicates not accepted':!Number.isFinite(controlPct)||controlPct<0.5||controlPct>1.5?'1% control recovery failed':null;
        let rangeOK=true;
        for(const [group,curve] of [[row,eventCurve],[ref,refCurve]])if(group&&valid(curve)){
          const lo=Math.min(...curve.points.map(point=>point.conc)),hi=Math.max(...curve.points.map(point=>point.conc));
          if(group.used.some(well=>{const q=Math.pow(10,(sopCq(well)-curve.intercept)/curve.slope);return!Number.isFinite(q)||q<lo||q>hi}))rangeOK=false;
        }
        const pct=reason?NaN:100*quantity(row,eventCurve)/quantity(ref,refCurve);
        row.conc=NaN;
        if(reason||!rangeOK||!Number.isFinite(pct)){row.quantWithheldReason=reason||(!rangeOK?'Sample outside calibration range':'Not quantifiable');if(!['Negative','Invalid','Invalid run','Repeat'].includes(row.outcome))row.outcome='Inconclusive';}
        else{row.conc=pct;row.quantification=true;row.methodValues={content_percent:pct};}
      }
      const groups=[...byKey(targets,row=>String(row.wells[0]?.r2Well?.sampleNo||row.sample.replace(/-E[1-9].*$/,''))).values()];
      for(const rows of groups){
        const values=rows.map(row=>row.conc).filter(Number.isFinite),mu=average(values),rsd=values.length>1&&mu>0?100*Math.sqrt(values.reduce((sum,value)=>sum+(value-mu)**2,0)/(values.length-1))/mu:NaN;
        if(values.length!==3||!Number.isFinite(rsd)||rsd>25){for(const row of rows){row.conc=NaN;row.quantification=false;row.quantWithheldReason=row.quantWithheldReason||'Three eligible extractions and RSD ≤25% are required';if(!['Negative','Invalid','Invalid run','Repeat'].includes(row.outcome))row.outcome='Inconclusive';}}
      }
    }
    result.rejected = result.criteria.filter(item => item.status === "fail");
    if (result.rejected.length) {
      result.status = "Rejected";
      for (const row of result.rows) if (!row.ctrl && row.role !== "Standard") { row.outcome = "Invalid run"; row.reason = result.rejected.map(item => item.criterion).join("; "); row.conc=NaN; if(row.quantification)row.quantWithheldReason=row.reason;row.quantification=false;if(row.methodValues){delete row.methodValues.content_percent;delete row.methodValues.U;} }
    }
    for (const row of result.rows) {
      const outcome = SOP.outcomes[row.outcome] || SOP_OUTCOME_DEFAULTS[row.outcome] || {};
      row.label = outcome.label || row.outcome; row.colour = outcome.colour;
      row.report = row.quantWithheldReason ? "GM content withheld: " + row.quantWithheldReason : row.quantification && Number.isFinite(row.conc) ? "GM content " + num(row.conc,3) + " % (event/reference copy-number ratio), extraction " + (row.wells[0]?.r2Well?.extraction || "") : sopFmt(outcome.text, { sample: row.sample, target: sopTargetLabel(row), cq: num(row.cqMean, 2), det: row.det, n: row.n, cutoff: row.cqMax, reason: row.reason, run: runName(run) });
    }
    return result;
  };

  const nativeSopHeader = renderSopHeader;
  renderSopHeader = function(...args) {
    const result = nativeSopHeader(...args);
    const id = SOP.sourceWorkbenchSop?.id;
    if (id) {
      const heading = document.createElement("h3");
      heading.textContent = id;
      document.getElementById("sop-head").prepend(heading);
    }
    return result;
  };
  const nativeRead = readStaged;
  readStaged = async function(...args) {
    const result = await nativeRead(...args);
    await connectTelemetry();
    return result;
  };
  const nativeDecode = decodeReaderSource;
  decodeReaderSource = async function(source) {
    const bundle = source.r2Bundle;
    if (!bundle) return nativeDecode(source);
    const runs = await nativeDecode({ ...source, name: bundle.core.name, path: "rdml_data.xml",
      bytes: new Uint8Array(await bundle.core.arrayBuffer()), r2Bundle: undefined });
    const digest = await sourceSha256(source.bytes);
    for (const run of runs) {
      run.file = bundle.file.name;
      run.meta ||= {};
      run.meta.sourceSHA256 = digest;
      run.rdmltSource = { name: bundle.file.name, bytes: source.bytes.length, sha256: digest };
      if (bundle.input?.injectedFault) {
        run.injectedFault = structuredClone(bundle.input.injectedFault);
        run.meta.TrainingScenario = run.injectedFault.title;
        run.meta.TrainingScenarioKind = run.injectedFault.kind;
        run.meta.TrainingScenarioProvenance = run.injectedFault.note;
      }
      const input = bundle.input, record = bundle.record;
      if (input?.plate) {
        const aliases={"SIMPLEX-35S":"P-35S","SIMPLEX-TNOS":"T-nos","SIMPLEX-LEC":"LE1","SIMPLEX-HMG":"hmgA"};
        for(const well of run.wells){
          const source=input.plate[well.pos],target=source?.t?.find(target=>(aliases[target.m]||target.m)===well.target);
          if(!source||!target)continue;
          well.r2Well={sampleNo:source.sampleNo,extraction:source.ext,replicate:source.rep,method:target.m};
          if(source.role==='standard' && Number.isFinite(target.q) && target.q>0){well.givenConc=target.q;well.StandardConc=target.q;}
        }
      }
      if (input && record && /MISSY R2 simulated instrument/.test(run.meta.InstrumentName || run.rdmlDoc?.instrument || "")) {
        const events = record.events || [], startEvent = events.find(event => event.code === "RUN_START");
        const endEvent = events.findLast(event => ["RUN_COMPLETE", "RUN_ABORTED"].includes(event.code));
        const start = Date.parse(input.startedAt), origin = startEvent?.t_ms || 0;
        run.r2Virtual = { outcome: input.outcome, stage: input.gmo?.stage, sourceSop: bundle.sopId,
          legacyMissingControls: !input.sopPlate && input.injectedFault?.id === "hu-no-controls" && Array.isArray(input.plate) && !input.plate.some(well=>well.role === "ntc" && well.t?.length),
          browserStartedAt: input.startedAt, browserFinishedAt: input.finishedAt, telemetryGapSeconds: telemetryGap(record.telemetry || []),
          clock: "Simulated instrument elapsed time anchored to browser run start" };
        run.meta.RunClock = run.r2Virtual.clock;
        run.meta.BrowserStartTime = input.startedAt || "";
        run.meta.BrowserEndTime = input.finishedAt || "";
        if (Number.isFinite(start)) {
          const iso = value => new Date(value).toISOString();
          run.meta.Created = run.meta.RunCreated = run.meta.StartTime = iso(start);
          if (endEvent && Number.isFinite(endEvent.t_ms)) {
            run.meta.EndTime = iso(start + endEvent.t_ms - origin);
            run.meta.LastModified = run.meta.EndTime;
            for (const analysis of run.analyses || []) analysis.created = run.meta.EndTime;
          }
          const labels = { SELFTEST_OK: "Simulated self-test passed", LID_READY: "Simulated heated lid ready",
            STAGE_START: "Simulated stage", HOST_LINK_TIMEOUT: "Recorded host data-link gap", HOST_CRASH: "Recorded host crash", MELT_START: "Simulated melt started", MELT_END: "Simulated melt ended" };
          run.r2Timeline = events.filter(event => labels[event.code] && Number.isFinite(event.t_ms)).map(event => ({
            what: labels[event.code] + (event.code === "STAGE_START" ? " " + (event.a + 1) : ""),
            time: start + event.t_ms - origin, source: "Verified RDMLt firmware event; simulated elapsed clock", kind: "run" }));
        }
      }
    }
    return runs;
  };
  const nativeIntake = intake;
  const bundles = [];
  let notice, pending = false, selection = 0, attachedProfile = null;
  const own = (node, name) => [...node.children].find(el => el.localName === name)?.textContent || "";
  const exact = path => ({ test: name => name === path });
  async function extract(bundle, path) {
    const info = bundle.files.get(path);
    if (!info) throw new Error("RDMLt manifest does not list " + path);
    const members = await readZipFiltered(await bundle.file.arrayBuffer(), { name: bundle.file.name }, exact(path));
    if (members.length !== 1) throw new Error("Missing or duplicate RDMLt payload " + path);
    const bytes = members[0].bytes;
    if (bytes.length !== info.bytes || sha256Hex(bytes).toLowerCase() !== info.sha.toLowerCase())
      throw new Error("RDMLt checksum or byte count mismatch for " + path);
    return bytes;
  }
  function repairProfile(procedure) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const finish = event => {
        if (event.source !== parentWindow || event.data?.token !== token || event.data?.requestId !== requestId || event.data?.type !== "r2-missy-profile") return;
        clearTimeout(timer); window.removeEventListener("message", finish);
        if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.profile);
      };
      const timer = setTimeout(() => { window.removeEventListener("message", finish); reject(new Error("SOP compatibility mapping timed out; keep the workbench open.")); }, 20000);
      window.addEventListener("message", finish);
      tell("r2-missy-profile-request", { requestId, procedure });
    });
  }
  async function openBundle(file) {
    const manifests = await readZipFiltered(await file.arrayBuffer(), { name: file.name }, exact("rdmlt_data.xml"));
    if (manifests.length !== 1) throw new Error("Expected one RDMLt companion XML document");
    const doc = new DOMParser().parseFromString(text(manifests[0].bytes), "application/xml");
    const root = doc.documentElement;
    if (root.localName !== "rdmlt" || root.namespaceURI !== "urn:rdmlt:1")
      throw new Error("Unrecognized RDMLt companion");
    const entries = [...root.children].filter(el => el.localName === "file");
    const files = new Map(entries.map(el => [own(el, "filename"), {
      id: el.getAttribute("id"), sha: own(el, "sha256"), bytes: Number(own(el, "byteCount"))
    }]));
    if (files.size !== entries.length) throw new Error("Duplicate RDMLt manifest entry");
    const coreRef = [...root.children].find(el => el.localName === "core")?.firstElementChild?.getAttribute("id");
    const corePath = [...files].find(([, info]) => info.id === coreRef)?.[0];
    if (!corePath) throw new Error("RDMLt companion does not identify a core");
    const bundle = { file, files };
    const core = await extract(bundle, corePath);
    const base = file.name.replace(/\.rdmlt$/i, "");
    bundle.core = new File([core], base + ".rdml", { type: "application/xml" });
    if (files.has("analysis/missy.sop.json")) {
      const raw = JSON.parse(text(await extract(bundle, "analysis/missy.sop.json")));
      if (raw.schema !== "qpcr-sop-profile/1" || raw.sha256 !== sopHash(sopNormalise(raw)))
        throw new Error("MISSY SOP profile checksum or schema mismatch");
      bundle.profile = raw;
    }
    bundle.sopId = bundle.profile?.sourceWorkbenchSop?.id;
    if (files.has("analysis/sop.json")) {
      bundle.procedure = JSON.parse(text(await extract(bundle, "analysis/sop.json")));
      bundle.sopId ||= bundle.procedure.sop_id;
    }
    if (bundle.procedure && (!bundle.profile || bundle.profile.evaluationMode === "unconfigured" || bundle.profile.profileFamily === "R2-workbench" && bundle.profile.version !== "1.2")) {
      // Repair the adapter in memory; preserve the original signed package unchanged.
      bundle.profile = await repairProfile(bundle.procedure);
      bundle.profileRepaired = true;
    }
    if (files.has("source/run-input.json") && files.has("source/simulator-record.json")) {
      bundle.input = JSON.parse(text(await extract(bundle, "source/run-input.json")));
      bundle.record = JSON.parse(text(await extract(bundle, "source/simulator-record.json")));
    }
    return bundle;
  }
  function setProfile(profile) {
    SOP = profile;
    SOP_AUTO_DEFAULT = false;
    SOP_CACHE = null;
    invalidateAnalysisCaches();
    markDirty("review", "graphs", "sop", "results", "panel");
    renderSopHeader();
  }
  function applyProfile(bundle) {
    if (!bundle.profile) return false;
    attachedProfile = sopNormalise(bundle.profile);
    setProfile(attachedProfile);
    return true;
  }

  function save(name, data) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(data); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function paint() {
    notice = document.getElementById("loadmsg");
    const list = document.getElementById("r2-raw-files");
    list.replaceChildren(...bundles.map(bundle => {
      const row = document.createElement("li"), download = document.createElement("button");
      const name = document.createElement("span");
      name.textContent = bundle.file.name + " · " + (bundle.file.size / 1048576).toFixed(1) + " MB";
      download.type = "button"; download.className = "ghost"; download.textContent = "Download raw RDMLt";
      download.onclick = () => save(bundle.file.name, bundle.file);
      row.append(name, " ", download);
      if (bundle.input?.injectedFault) {
        const scenario = document.createElement("p"), fault = bundle.input.injectedFault;
        scenario.className = "r2-training-scenario";
        scenario.textContent = "Deliberate training scenario: " + fault.title + " · " + fault.kind + ". " + fault.note;
        row.append(scenario);
      }
      const start = bundle.record?.events?.find(event => event.code === "RUN_START");
      const end = bundle.record?.events?.findLast(event => ["RUN_COMPLETE", "RUN_ABORTED"].includes(event.code));
      if (end && Number.isFinite(end.t_ms)) {
        const timing = document.createElement("p");
        timing.textContent = "Simulated instrument duration: " + ((end.t_ms - (start?.t_ms || 0)) / 60000).toFixed(2) + " min. Browser playback: " +
          (bundle.input?.startedAt || "unknown") + " to " + (bundle.input?.finishedAt || "unknown") + ". The timeline uses the simulated instrument clock.";
        row.append(timing);
      }
      return row;
    }));
    const uniqueSops = [...new Map(bundles.map(bundle => [
      (bundle.sopId || "unknown") + ":" + (bundle.profile?.sha256 || ""), bundle])).values()];
    document.getElementById("r2-sop-files").replaceChildren(...uniqueSops.map(bundle => {
      const row = document.createElement("div"), title = document.createElement("b"), label = document.createElement("p");
      title.textContent = bundle.sopId || "SOP identity unavailable";
      label.textContent = bundle.profile?.name || "Procedure attached to " + bundle.file.name;
      const uses = document.createElement("p");
      uses.textContent = "Used by: " + bundles.filter(item => item.sopId === bundle.sopId && item.profile?.sha256 === bundle.profile?.sha256).map(item => item.file.name).join(", ");
      row.append(title, label, uses);
      if (bundle.profileRepaired) {
        const repaired = document.createElement("p");
        repaired.textContent = "Compatibility mapping repaired for this session; the original RDMLt is unchanged.";
        row.append(repaired);
      }
      if (bundle.profile) {
        const use = document.createElement("button");
        use.type = "button"; use.className = "ghost"; use.textContent = "Use " + (bundle.sopId || "this SOP");
        use.onclick = () => { applyProfile(bundle); refreshAll(); showTab("sop"); };
        const download = document.createElement("button");
        download.type = "button"; download.className = "ghost"; download.textContent = "Download SOP JSON";
        download.onclick = () => save((bundle.sopId || "procedure") + ".sop.json", new Blob([JSON.stringify(bundle.profile, null, 2)], {type:"application/json"}));
        row.append(use, " ", download);
      }
      if (bundle.procedure || bundle.profile) {
        const details = document.createElement("details"), summary = document.createElement("summary"), data = document.createElement("pre");
        summary.textContent = "SOP data"; data.textContent = JSON.stringify(bundle.procedure || bundle.profile, null, 2);
        data.style.cssText = "max-height:350px;overflow:auto;white-space:pre-wrap";
        details.append(summary, data); row.append(details);
      }
      return row;
    }));
  }
  function addPanel() {
    const files = document.createElement("ul");
    files.id = "r2-raw-files";
    document.getElementById("loadmsg").after(files);
    const sopFiles = document.createElement("div");
    sopFiles.id = "r2-sop-files"; sopFiles.className = "sop-sec";
    document.getElementById("sop-head").after(sopFiles);
    const historyTools = document.createElement("div");
    historyTools.className = "toolbar";
    historyTools.innerHTML = `<label>Virtual equipment history <select id="r2-history-family"><option>InstrumentA</option><option>InstrumentB</option><option>InstrumentC</option></select></label>
      <button class="ghost" type="button" id="r2-history-add">Load virtual history</button>
      <button class="ghost" type="button" id="r2-chart-catalogue">Show complete chart catalogue</button><span id="r2-history-status" role="status"></span>`;
    document.getElementById("cc-tiles").before(historyTools);
    document.getElementById("r2-chart-catalogue").onclick = () => {
      document.querySelectorAll("#cc-tiles .cc-missing").forEach(details => { details.open = true; });
    };
    document.getElementById("r2-history-add").onclick = () => {
      const history = window.R2_CONTROL_HISTORY[document.getElementById("r2-history-family").value];
      const count = ccImport(JSON.stringify(history));
      CC_STATE.instrument = history.rows[0].instrument; CC_STATE.protocol = ""; CC_STATE.cache = null;
      renderPanel();
      document.getElementById("r2-history-status").textContent = count + " virtual rows added from " + history.sourceCount + " source records.";
    };
    document.getElementById("drop").querySelector("b").textContent = "Drop .rdmlt, .rdml, .ixo, .eds, .edt, .zpcr, .pcrd or .zip here";
    paint();
  }

  function sopConflict(opened) {
    return new Set(opened.map(bundle => bundle.sopId || bundle.profile?.sha256).filter(Boolean)).size > 1 ||
      new Set(opened.map(bundle => bundle.profile?.sha256).filter(Boolean)).size > 1;
  }
  function showSopWarning(opened) {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-labelledby", "r2-mixed-sop-heading");
    dialog.setAttribute("role", "alertdialog");
    dialog.style.cssText = "position:fixed;inset:0;margin:0;width:100%;height:100%;max-width:none;max-height:none;padding:clamp(20px,8vw,120px);background:#100b19;color:#f1e4f5;border:0;overflow:auto";
    dialog.innerHTML = `<h1 id="r2-mixed-sop-heading">The selected runs use different SOPs</h1>
      <p>All selected runs were loaded. Choose the SOP for the run you are reviewing before interpreting results.</p>
      <ul></ul><button type="button" autofocus>Continue to Control Panel</button>`;
    const list = dialog.querySelector("ul");
    for (const bundle of opened) {
      const row = document.createElement("li");
      row.textContent = bundle.file.name + " · " + (bundle.sopId || bundle.profile?.name || "No SOP identity");
      list.append(row);
    }
    dialog.querySelector("button").onclick = () => dialog.close();
    dialog.addEventListener("close", () => { dialog.remove(); showTab("panel"); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  intake = async fileList => {
    const generation = ++selection;
    const files = [...fileList];
    if (files.reduce((total, file) => total + file.size, 0) > APP_STATE.limits.maxBytes) throw new Error("The selected raw files exceed MISSY’s staging limit.");
    const expanded = [], opened = [], errors = [];
    for (const file of files) {
      try {
        if (!/\.rdmlt$/i.test(file.name)) expanded.push(file);
        else {
          const bundle = await openBundle(file);
          opened.push(bundle);
          expanded.push(bundle.core);
        }
      } catch (error) { errors.push(file.name + ": " + error.message); }
    }
    if (generation !== selection) return;
    if (errors.length && !expanded.length) {

      notice.textContent = errors.join(" ");
      throw new Error(errors.join(" "));
    }
    await nativeIntake(expanded);
    if (generation !== selection) return;
    // Native intake enables Read before the original package bytes are restored.
    // Keep it disabled until raw identity, telemetry and SOP are ready together.
    const readButton = document.getElementById("read");
    readButton.disabled = true;
    const prepared = await Promise.all(STAGED.map(async source => {
      const bundle = opened.find(item => item.core.name === source.name);
      return bundle ? { ...source, name: bundle.file.name, path: bundle.file.name,
        bytes: new Uint8Array(await bundle.file.arrayBuffer()), r2Bundle: bundle } : source;
    }));
    if (generation !== selection) return;
    STAGED = prepared;
    bundles.splice(0, bundles.length, ...opened);
    paint();
    if (SOP === attachedProfile) setProfile(sopNoProfile());
    attachedProfile = null;
    const mixed = sopConflict(opened);
    if (mixed) setProfile(sopNoProfile());
    if (opened.length || errors.length) {

      const applied = !mixed && opened.length > 0 && opened.length === expanded.length &&
        opened.every(bundle => bundle.profile) && applyProfile(opened[0]);
      notice.textContent = [opened.map(bundle => bundle.file.name).join(", "),
        applied ? "MISSY SOP active: " + opened[0].profile.name : "",
        mixed ? "Different SOPs were found. No shared SOP was activated." : "", ...errors].filter(Boolean).join(" ");
    }
    readButton.disabled = !STAGED.length;
    return { mixed, opened, errors };
  };

  document.addEventListener("missy-initialized", () => {
    document.getElementById("missy-startup-enter").click();
    window.MISSY_SETUP.leave();
    document.querySelector("#missy-learning [data-workspace='analysis']")?.click();
    addPanel();
    const fileInput = document.getElementById("file");
    fileInput.accept = [fileInput.accept || readerAccept(), ".rdmlt"].join(",");
    const manualIntake = intake;
    intake = async files => { try { return await manualIntake(files); } catch (error) {
      document.getElementById("loadmsg").textContent = error.message;
    } };
    window.addEventListener("message", async event => {
      const message = event.data;
      if (event.source !== parentWindow || message?.token !== token) return;
      if (message.type === "r2-missy-progress") { window.R2TransferLoading.update(message.progress, message.status); return; }
      if (message.type !== "r2-missy-transfer" || pending) return;
      pending = true;
      try {
        let mixed = false;
        if (message.files?.length) {
          window.R2TransferLoading.update(60, "Verifying the selected RDMLt packages and SOPs…");
          tell("r2-missy-progress", { progress:60, status:"Verifying RDMLt packages and SOPs…" });
          await new Promise(resolve => setTimeout(resolve, 0));
          const staged = await manualIntake(message.files);
          if (staged.errors.length) throw new Error(staged.errors.join(" "));
          if (STAGED.length !== message.files.length) throw new Error("MISSY could not stage every selected experiment.");
          window.R2TransferLoading.update(75, "Reading raw curves and integrating telemetry…");
          tell("r2-missy-progress", { progress:75, status:"Reading raw curves and integrating telemetry…" });
          await new Promise(resolve => setTimeout(resolve, 0));
          await readStaged();
          if (RUNS.length !== message.files.length) throw new Error("MISSY could not read every selected experiment.");
          notice.textContent += " " + RUNS.length + " run(s) read.";
          mixed = staged.mixed;
          if (mixed) showSopWarning(staged.opened);
        }
        showTab("panel");
        window.scrollTo({ top: 0, behavior: "instant" });
        window.R2TransferLoading.close();
        tell("r2-missy-loaded", { mixed });
      } catch (error) { window.R2TransferLoading.fail(error.message); tell("r2-missy-error", { error: error.message }); }
      finally { pending = false; }
    });
    tell("r2-missy-ready");
  }, { once: true });
})();
