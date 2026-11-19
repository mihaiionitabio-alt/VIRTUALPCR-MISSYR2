(/* @r2fn R2-C0083-F00001 */function (R2) {
  "use strict";
  const checklist = R2.$("missy-run"), launch = R2.$("missy-open"), status = R2.$("missy-handoff-status");
  const administrator = /* @r2fn R2-C0083-F00002 */() => /^#quality(?:\/|$)/.test(location.hash);
  let handoff, initialized = false;
  /* @r2fn R2-C0083-F00003 */function refresh() {
    const runs = (R2.session.runs || []).filter(/* @r2fn R2-C0083-F00004 */run => run.record && !!run.outcome);
    const marked = new Set([...checklist.querySelectorAll("input:checked")].map(/* @r2fn R2-C0083-F00005 */input => input.value));
    if (R2.session.missyPreselect) { for (const no of R2.session.missyPreselect) marked.add(String(no)); R2.session.missyPreselect = null; initialized = true; }   // runs made by a JSON profile
    if (runs.length && !initialized) {
      marked.add(String(runs.find(/* @r2fn R2-C0083-F00006 */run => run === R2.session.run)?.no ?? runs.at(-1).no));
      initialized = true;
    }
    checklist.replaceChildren(...runs.slice().reverse().map(/* @r2fn R2-C0083-F00007 */run => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = run.no;
      input.checked = marked.has(input.value);
      const name = document.createElement("span");
      name.textContent = run.name + " · " + run.outcome + (run.injectedFault ? " · Training scenario: " + run.injectedFault.title : "");
      const sop = document.createElement("code");
      sop.className = "checklist-sop";
      sop.textContent = R2.sop.idOfRun(run);
      label.append(input, name, sop);
      return label;
    }));
    if (!runs.length) checklist.textContent = "No filed virtual runs.";
    if (!handoff) status.textContent = "Experiment files stay on this computer.";
  }
  for (const [id, checked] of [["missy-select-all", true], ["missy-clear-all", false]]) {
    R2.$(id).addEventListener("click", /* @r2fn R2-C0083-F00008 */() => {
      checklist.querySelectorAll("input").forEach(/* @r2fn R2-C0083-F00009 */input => { input.checked = checked; });
    });
  }
  /* @r2fn R2-C0083-F00010 */function stopHandoffTimers(state) {
    clearInterval(state?.closedTimer);
    clearTimeout(state?.readyTimer);
  }
  /* @r2fn R2-C0083-F00011 */function failHandoff(state, message, notifyChild = true) {
    if (handoff !== state || state.failed) return;
    state.failed = true;
    state.fileAckReject?.(new Error(message)); state.fileAck = null; state.fileAckReject = null;
    stopHandoffTimers(state);
    status.textContent = message;
    window.R2TransferLoading.fail(message);
    if (notifyChild && !state.child.closed) state.child.postMessage({ type: "r2-missy-transfer-error", token: state.token, error: message }, "*");
  }
  /* @r2fn R2-C0083-F00012 */function closeHandoff() {
    if (administrator()) return;
    releaseHandoff();
    window.R2TransferLoading.close();
  }
  /* @r2fn R2-C0083-F00013 */function releaseHandoff() {
    const previous = handoff;
    handoff = null;
    stopHandoffTimers(previous);
    if (!previous) return;
    previous.failed = true;
    previous.fileAckReject?.(new Error("The previous transfer was closed."));
    previous.child.close();
  }
  R2.levels.on("quality", /* @r2fn R2-C0083-F00014 */level => { if (level === "admin") refresh(); else closeHandoff(); });
  window.addEventListener("hashchange", closeHandoff);
  document.addEventListener("r2-quality-run", /* @r2fn R2-C0083-F00015 */() => { if (administrator()) refresh(); });
  launch.addEventListener("click", /* @r2fn R2-C0083-F00016 */() => {
    if (!administrator()) return;
    const marked = new Set([...checklist.querySelectorAll("input:checked")].map(/* @r2fn R2-C0083-F00017 */input => Number(input.value)));
    const runs = (R2.session.runs || []).filter(/* @r2fn R2-C0083-F00018 */run => run.record && !!run.outcome && marked.has(run.no));
    const token = crypto.randomUUID();
    releaseHandoff();
    window.R2TransferLoading.close();
    window.R2TransferLoading.open("Starting MISSY and preparing the selected runs…");
    const child = window.open("missy/index.html?v=" + encodeURIComponent(R2.BUILD || R2.VERSION) + "&lang=" + (R2.i18n?.language || "en") + "#workbench=" + token, "_blank");
    if (!child) { status.textContent = "Allow pop-ups for this file to open MISSY."; window.R2TransferLoading.fail(status.textContent); return; }
    handoff = { child, token, runs, sent: false, failed: false };
    const current = handoff;
    current.readyTimer = setTimeout(/* @r2fn R2-C0083-F00019 */() => failHandoff(current, "MISSY did not finish starting. Check the connection and open MISSY again."), 180000);
    current.closedTimer = setInterval(/* @r2fn R2-C0083-F00020 */() => {
      if (handoff !== current || child.closed) {
        stopHandoffTimers(current);
        if (handoff === current && child.closed) {
          failHandoff(current, "MISSY was closed before loading completed.", false);
          handoff = null;
        }
      }
    }, 500);
    status.textContent = "Opening MISSY Real data analysis…";
  });
  window.addEventListener("message", /* @r2fn R2-C0083-F00021 */async event => {
    const state = handoff, message = event.data;
    if (!state || event.source !== state.child || message?.token !== state.token || !administrator() || state.failed) return;
    if (message.type === "r2-missy-profile-request") {
      try {
        if (!message.procedure?.format?.startsWith("missy-r2-workbench-sop/")) throw new Error("Unsupported source procedure");
        state.child.postMessage({ type: "r2-missy-profile", token: state.token, requestId: message.requestId,
          profile: JSON.parse(R2.missySop(message.procedure)) }, "*");
      } catch (error) {
        state.child.postMessage({ type: "r2-missy-profile", token: state.token, requestId: message.requestId, error: error.message }, "*");
      }
    } else if (message.type === "r2-missy-evidence-request") {
      try {
        const proof = R2.maraEvidenceFrom(message.input, message.diagnostics, message.procedure);
        state.child.postMessage({ type: "r2-missy-evidence", token: state.token, requestId: message.requestId, proof }, "*");
      } catch (error) {
        state.child.postMessage({ type: "r2-missy-evidence", token: state.token, requestId: message.requestId, error: error.message }, "*");
      }
    } else if (message.type === "r2-missy-file-ready") {
      state.fileAck?.(message);
    } else if (message.type === "r2-missy-progress") {
      window.R2TransferLoading.update(message.progress, message.status);
    } else if (message.type === "r2-missy-loaded") {
      stopHandoffTimers(state);
      window.R2TransferLoading.close();
      status.textContent = state.runs.length ? message.mixed
        ? state.runs.length + " runs loaded. Review the SOP warning in MISSY."
        : state.runs.length + " run(s) loaded in the MISSY Control Panel."
        : "MISSY Control Panel is open.";
    } else if (message.type === "r2-missy-error") {
      stopHandoffTimers(state);
      failHandoff(state, "MISSY could not load the run. " + message.error, false);
    } else if (message.type === "r2-missy-ready" && !state.sent) {
      state.sent = true;
      clearTimeout(state.readyTimer);
      try {
        state.child.postMessage({ type: "r2-missy-transfer-begin", token: state.token, total: state.runs.length }, "*");
        if (state.runs.length) status.textContent = "Preparing local RDMLt experiment files…";
        for (const [index, run] of state.runs.entries()) {
          if (handoff !== state || state.failed || state.child.closed) return;
          const progress = 10 + 60 * index / state.runs.length;
          const label = "Preparing RDMLt " + (index + 1) + " of " + state.runs.length + " · " + run.name;
          window.R2TransferLoading.update(progress, label);
          state.child.postMessage({ type: "r2-missy-progress", token: state.token, progress, status: label }, "*");
          await new Promise(/* @r2fn R2-C0083-F00022 */resolve => setTimeout(resolve, 0));
          if (handoff !== state || state.failed || state.child.closed) return;
          const evaluation = R2.gmoeval.run(run, { cqMethod: "auto", thresholds: {} });
          const bytes = await R2.rdmltCompressed(run, evaluation);
          if (handoff !== state || state.failed || state.child.closed) return;
          const file = new File([bytes], run.name.replace(/[^A-Za-z0-9_-]/g, "_") + ".rdmlt");
          await new Promise(/* @r2fn R2-C0083-F00023 */(resolve, reject) => {
            state.fileAckReject = reject;
            state.fileAck = /* @r2fn R2-C0083-F00024 */ack => { if (ack.index !== index) return; state.fileAck = null; state.fileAckReject = null; ack.error ? reject(new Error(ack.error)) : resolve(); };
            state.child.postMessage({ type: "r2-missy-transfer-file", token: state.token, index, file }, "*");
          });
        }
        if (handoff !== state || state.failed || state.child.closed) return;
        window.R2TransferLoading.update(70, "Sending the selected RDMLt files to MISSY…");
        if (handoff === state && !state.child.closed)
          state.child.postMessage({ type: "r2-missy-transfer-end", token: state.token }, "*");
      } catch (error) {
        failHandoff(state, "The RDMLt could not be prepared. " + error.message);
      }
    }
  });
})(window.R2);
