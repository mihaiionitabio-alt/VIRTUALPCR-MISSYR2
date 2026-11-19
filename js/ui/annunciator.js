/* MISSY R2 annunciator · alert panel · proposal 1 (2026-11-19)
 *
 * One alert model for the profile studio, the runner and the MISSY hand-off, following
 * NASA-STD-3001 Vol 2 Rev F §10.3 (alerts) and §10.2 (information design), ECSS-E-ST-10-11C
 * 4.3.3 / 4.7.3 / 4.9.4 (nomenclature, labels and cues, display standard) and the error-management
 * precedence of NPR 8705.2C §2.3.12. Fault handling mirrors Open MCT (acknowledge, shelve).
 *
 *   classify(text)            → { entry, params }   map an existing message to a catalogue entry
 *   sync(source, items, rev)  replace the alerts of one source (validation results)
 *   raise(id, params, source) add one alert; clear(key); ack(key); ackAll(cls)
 *   silence()                 [V2 10116]   suppress(id)  [V2 10177]   shelve(id, min) [V2 10155]
 *   inhibit(id) / enable(id)  [V2 10155/10154] with periodic audit [V2 10156]
 *   test()                    [V2 10117]   touch(source, rev) marks results stale [V2 10020]
 *   open(tab)                 the full panel: active alerts, log, catalogue
 *
 * Only the highest-priority unacknowledged alert sounds ([V2 10175]); the first iteration is
 * 10 dB lower ([V2 10176]). Tones: warning 400/1024 Hz square, caution 512 Hz triangle, advisory
 * 900 Hz sine, all inside 200 Hz – 4 kHz ([V2 10058]). The log holds identifiers and structured
 * values only, never speech or typed conversation.
 * Classic script; no dependency. Works without the workbench (standalone demo) when R2.ALERTS exists.
 */
(function (R2) {
  "use strict";
  const C = () => R2.ALERTS;
  const zh = () => R2.i18n?.language === "zh";
  const loc = (pair) => (pair ? (zh() ? pair.zh || pair.en : pair.en) : "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fill = (s, p) => String(s || "").replace(/\{(\w+)\}/g, (m, k) => (p && p[k] !== undefined && p[k] !== null ? String(p[k]) : m));
  const now = () => Date.now();
  const MAX_LOG = 2000;

  const alerts = new Map();          // key → alert
  const shelveTimers = new Map();
  const shelved = new Map();         // id → until (ms)
  const inhibited = new Set();       // id
  const suppressed = new Set();      // id
  const revs = new Map();            // source → { touched, synced }
  const log = [];
  let silencedKey = null, panel = null, lamp = null, tab = "active", auditTimer = null;
  let tonesEnabled=false; const oscillators=new Set(), scheduled=new Set();

  /* ---------------------------------------------------------------- classification */
  let compiled = null;
  function compile() {
    compiled = C().LIST.filter((e) => e.match).map((e) => ({ e, re: new RegExp(e.match) }));
    return compiled;
  }
  function entry(id) { return C().LIST.find((e) => e.id === id) || Object.values(C().GENERIC).find((e) => e.id === id) || null; }
  function classify(text, kind = "error") {
    let t = String(text || ""), group = null;
    const g = /^Group (\d+)(?:, repeat \d+)?: /.exec(t);
    if (g && !/^Group \d+, repeat \d+: /.test(t)) { group = +g[1]; t = t.slice(g[0].length); }
    for (const { e, re } of compiled || compile()) {
      const m = re.exec(t);
      if (m) return { entry: e, params: Object.assign({ detail: t, group }, m.groups || {}) };
    }
    return { entry: C().GENERIC[kind] || C().GENERIC.error, params: { detail: t, group } };
  }

  /* ---------------------------------------------------------------- alert life cycle */
  function record(event, a, extra) {
    log.push(Object.assign({ at: new Date().toISOString(), event, id: a ? a.id : null, source: a ? a.source : null, group: a?.params?.group ?? null }, extra || {}));
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  }
  function make(key, e, params, source, kind) {
    return { key, id: e.id, entry: e, cls: e.cls, params: params || {}, source, kind: kind || null, raisedAt: now(), state: "active" };
  }
  function add(a) {
    const old = alerts.get(a.key);
    if (old) { old.params = a.params; old.lastSeen = now(); return old; }
    if (inhibited.has(a.id)) { record("inhibited-not-raised", a); return null; }
    alerts.set(a.key, a); record("raised", a); schedule(); return a;
  }
  function raise(id, params, source = "app") {
    const e = entry(id); if (!e) return null;
    const key = source + "|" + id + "|" + JSON.stringify(params || {});
    return add(make(key, e, params, source, null));
  }
  function sync(source, items, rev) {
    const keep = new Set();
    for (const it of items || []) {
      const c = it.id ? { entry: entry(it.id), params: it.params || {} } : classify(it.text, it.kind);
      if (!c.entry) continue;
      const key = source + "|" + (it.text || c.entry.id + JSON.stringify(c.params));
      keep.add(key);
      add(Object.assign(make(key, c.entry, Object.assign({}, c.params, it.params || {}), source, it.kind), { text: it.text || null }));
    }
    for (const [key, a] of alerts) if (a.source === source && !keep.has(key)) { alerts.delete(key); record("cleared", a); }
    const r = revs.get(source) || {}; r.synced = rev ?? r.touched ?? null; r.at = now(); revs.set(source, r);
    schedule();
  }
  function touch(source, rev) { const r = revs.get(source) || {}; r.touched = rev; revs.set(source, r); schedule(); }
  const stale = (a) => { const r = revs.get(a.source); return !!r && r.touched !== undefined && r.touched !== null && r.synced !== r.touched; };
  function clear(key) { const a = alerts.get(key); if (a) { alerts.delete(key); record("cleared", a); schedule(); } }
  function clearSource(source) { for (const [k, a] of alerts) if (a.source === source) { alerts.delete(k); record("cleared", a); } schedule(); }
  function ack(key) {
    const a = alerts.get(key); if (!a || a.state === "acked") return;
    a.state = "acked"; a.ackedAt = now(); record("acknowledged", a);
    document.dispatchEvent(new CustomEvent("r2-alert-ack", { detail: { key, id: a.id, source: a.source, text: a.text } }));
    schedule();
  }
  // acknowledgements of one source are withdrawn when its owner requires a new acknowledgement
  function reactivate(source) { for (const a of alerts.values()) if (a.source === source && a.state === "acked") { a.state = "active"; record("re-activated", a); } schedule(); }
  function unack(key) { const a=alerts.get(key);if(!a)return;a.state="active";record("acknowledgement-withdrawn",a);schedule(); }
  function ackAll(cls) { for (const a of alerts.values()) if (a.state === "active" && (!cls || a.cls === cls)) ack(a.key); }
  function isAcked(source, text) { for (const a of alerts.values()) if (a.source === source && a.text === text && a.state === "acked") return true; return false; }
  function silence() { const top = highest(); silencedKey = top ? top.key : null; stopAudio(); record("silenced", top); schedule(); }
  function suppress(id, on = true) { on ? suppressed.add(id) : suppressed.delete(id); record(on ? "suppressed" : "unsuppressed", { id, source: null }); schedule(); }
  function shelve(id, minutes = 15) {
    const e = entry(id); if (!e || e.cls === "WARNING") return false; // warnings are never shelved
    if(!Number.isFinite(minutes)||minutes<=0)return false;
    clearTimeout(shelveTimers.get(id));
    shelveTimers.set(id,setTimeout(()=>{shelved.delete(id);shelveTimers.delete(id);record("shelf-expired",{id,source:null});schedule();},minutes*60000));
    shelved.set(id, now() + minutes * 60000); startAudit(); record("shelved", { id, source: null }, { minutes }); schedule(); return true;
  }
  function inhibit(id) {
    const e = entry(id); if (!e || !["ADVISORY", "STATUS"].includes(e.cls)) return false; // only below caution
    inhibited.add(id); for (const [k, a] of alerts) if (a.id === id) alerts.delete(k);
    record("inhibited", { id, source: null }); startAudit(); schedule(); return true;
  }
  function enable(id) { clearTimeout(shelveTimers.get(id));shelveTimers.delete(id);inhibited.delete(id); shelved.delete(id); record("enabled", { id, source: null }); schedule(); }
  function startAudit() {
    if (auditTimer) return;
    auditTimer = setInterval(() => {
      const list = [...inhibited, ...[...shelved.keys()]];
      if (!list.length) { clearInterval(auditTimer); auditTimer = null; return; }
      raise("R2-SYS-002", { n: list.length, list: list.join(", ") }, "audit");
    }, 10 * 60000);
  }
  const visible = (a) => { const until = shelved.get(a.id); if (until && until > now()) return false; if (until) shelved.delete(a.id); return true; };
  function active() {
    return [...alerts.values()].filter(visible).sort((x, y) => C().CLASSES[x.cls].priority - C().CLASSES[y.cls].priority || y.raisedAt - x.raisedAt);
  }
  function highest() { return active().find((a) => a.state === "active" && !suppressed.has(a.id) && a.cls !== "STATUS") || null; }
  function counts() {
    const c = { WARNING: 0, CAUTION: 0, ADVISORY: 0, STATUS: 0, unacked: 0 };
    for (const a of active()) { c[a.cls]++; if (a.state === "active" && a.cls !== "STATUS") c.unacked++; }
    return c;
  }
  // gates for owners: a WARNING with gate launch blocks; an unacknowledged "ack" caution blocks confirm
  function blocking(source, step) {
    return active().filter((a) => (!source || a.source === source) && ((a.entry.gate === step) || (step === "confirm" && a.entry.gate === "ack" && a.state !== "acked") || (step === "launch" && a.cls === "WARNING")));
  }

  /* ---------------------------------------------------------------- audio (Table 10.3-1) */
  let ac = null, audioTimer = null, playingKey = null, firstPlayed = new Set();
  const soundOn = () => { const b = document.getElementById("workbench-sound"); return !b || b.getAttribute("aria-pressed") !== "false"; };
  function ctx() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); return ac; } catch (e) { return null; } }
  function tone(a, f, t0, dur, type, gain) {
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.setValueAtTime(gain, t0 + dur - 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination); oscillators.add(o);o.onended=()=>oscillators.delete(o);o.start(t0);o.stop(t0 + dur + 0.02);
  }
  // returns the length of one sequence in seconds
  function pattern(cls, gain) {
    const a = ctx(); if (!a) return 0; const t = a.currentTime + 0.02;
    if (cls === "WARNING") { // 400 Hz 0.4 s / 1024 Hz 0.4 s, two pairs (1.6 s), 1 s silence, repeated 2 times
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { const b = t + r * 2.6 + k * 0.8; tone(a, 400, b, 0.4, "square", gain * 0.5); tone(a, 1024, b + 0.4, 0.4, "square", gain * 0.5); }
      return 5.2;
    }
    if (cls === "CAUTION") { tone(a, 512, t, 1.0, "triangle", gain); return 2.0; }      // 1 s tone, 1 s silence
    if (cls === "ADVISORY") { tone(a, 900, t, 0.106, "sine", gain); tone(a, 900, t + 0.212, 0.106, "sine", gain); return 0; } // 318 ms, once
    return 0;
  }
  function stopAudio() {
    clearTimeout(audioTimer);audioTimer=null;playingKey=null;
    for(const id of scheduled)clearTimeout(id);scheduled.clear();
    for(const oscillator of oscillators)try{oscillator.stop();}catch{}oscillators.clear();
  }
  function later(fn,ms){const id=setTimeout(()=>{scheduled.delete(id);fn();},ms);scheduled.add(id);return id;}
  function setTones(on){tonesEnabled=!!on;if(!tonesEnabled)stopAudio();schedule();}
  function annunciate() {
    const top = highest();
    if (!top || !tonesEnabled || !soundOn() || top.key === silencedKey) { stopAudio(); return; }
    if (top.key === playingKey) return;
    stopAudio(); playingKey = top.key;
    const loop = () => {
      const a = alerts.get(top.key);
      if (!a || a.state !== "active" || silencedKey === top.key || highest()?.key !== top.key || !soundOn()) { stopAudio(); return; }
      const pre = !firstPlayed.has(top.key); firstPlayed.add(top.key);
      const len = pattern(top.cls, pre ? 0.18 * 0.316 : 0.18); // first iteration −10 dB
      if (top.cls === "WARNING" && top.entry.speech && R2.voiceConsole) later(() => R2.voiceConsole.speak(loc(top.entry.speech)), len * 1000 + 200);
      if (len > 0) audioTimer = setTimeout(loop, (len + (top.cls === "WARNING" ? 2 : 0)) * 1000 + (top.cls === "WARNING" && top.entry.speech ? 2500 : 0));
      else playingKey = top.key; // advisory: self-terminating
    };
    loop();
  }
  function test() {
    const a = ctx(); record("test", null);
    const flash = document.createElement("div"); flash.className = "r2-annun-test"; flash.setAttribute("role", "status");
    flash.innerHTML = ["WARNING", "CAUTION", "ADVISORY"].map((c) => `<span class="r2-cls r2-${c.toLowerCase()}">${C().CLASSES[c].symbol} ${esc(loc(C().CLASSES[c].label))}</span>`).join("");
    (document.querySelector("dialog[open]") || document.body).append(flash);
    if (a && soundOn()) { pattern("ADVISORY", 0.12); later(() => pattern("CAUTION", 0.12), 600); later(() => { const t = a.currentTime + 0.02; tone(a, 400, t, 0.4, "square", 0.06); tone(a, 1024, t + 0.4, 0.4, "square", 0.06); }, 1900); }
    setTimeout(() => flash.remove(), 3200);
    raise("R2-SYS-001", {}, "test");
  }

  /* ---------------------------------------------------------------- rendering */
  let pending = false;
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(() => { pending = false; paintLamp(); if (panel?.open) paintPanel(); annunciate(); }); }
  function message(a) { return fill(loc(a.entry.text), a.params) || a.text || ""; }
  function badge(cls) { const k = C().CLASSES[cls]; return `<span class="r2-cls r2-${cls.toLowerCase()}">${k.symbol} ${esc(loc(k.label))}</span>`; }
  function paintLamp() {
    const bar = document.getElementById("r2-console-bar"); if (!bar) return;
    if (!lamp || !bar.contains(lamp)) { lamp = document.createElement("button"); lamp.type = "button"; lamp.id = "r2-master-alarm"; lamp.onclick = () => open("active"); bar.insertBefore(lamp, bar.querySelector(".r2-machine")); }
    const c = counts(), top = highest() || active()[0];
    const cls = c.WARNING ? "WARNING" : c.CAUTION ? "CAUTION" : c.ADVISORY ? "ADVISORY" : null;
    lamp.className = "r2-master " + (cls ? "r2-" + cls.toLowerCase() : "r2-nominal") + (c.unacked ? " r2-unacked" : "");
    lamp.textContent = cls ? `${C().CLASSES[cls].symbol} ${zh() ? "主" : "MASTER "}${loc(C().CLASSES[cls].label)} · ${c[cls]}${c.unacked ? "" : (zh() ? " · 已确认" : " · ACK")}` : (zh() ? "○ 正常" : "○ NOMINAL");
    lamp.setAttribute("aria-label", (zh() ? "警报面板：" : "Alert panel: ") + lamp.textContent);
    lamp.title = top ? message(top) : "";
  }
  function row(a) {
    const e = a.entry, area = loc(C().AREAS[e.area]), t = new Date(a.raisedAt).toLocaleTimeString();
    const where = a.params.group ? (zh() ? `第 ${a.params.group} 组` : `Group ${a.params.group}`) : area;
    const canShelve = e.cls !== "WARNING", canInhibit = ["ADVISORY", "STATUS"].includes(e.cls);
    return `<tr class="r2-row r2-${a.cls.toLowerCase()} ${a.state === "acked" ? "r2-acked" : ""}" data-key="${esc(a.key)}">
      <td>${badge(a.cls)}${stale(a) ? `<span class="r2-stale">${zh() ? "过期" : "STALE"}</span>` : ""}</td>
      <td><code>${esc(e.id)}</code><br><small>${esc(t)}</small></td>
      <td><strong>${esc(loc(e.title))}</strong><br>${esc(message(a))}
        <details><summary>${zh() ? "后果与操作" : "Effect and action"}</summary>
          <p><b>${zh() ? "后果" : "Effect"}:</b> ${esc(fill(loc(e.effect), a.params))}</p>
          <p><b>${zh() ? "操作" : "Action"}:</b> ${esc(fill(loc(e.action), a.params))}</p>
          <p class="r2-meta">${esc(where)} · ${esc(e.gate ? (zh() ? "阻止：" : "blocks: ") + e.gate : (zh() ? "不阻止" : "no gate"))} ${suppressed.has(e.id) ? " · " + (zh() ? "已抑制" : "suppressed") : ""}</p>
        </details></td>
      <td class="r2-actions">${a.state === "acked" ? `<span class="r2-ackd">${zh() ? "已确认" : "Acknowledged"}</span>` : a.cls === "STATUS" ? "" : `<button type="button" data-act="ack">${zh() ? "确认" : "Acknowledge"}</button>`}
        ${canShelve ? `<button type="button" data-act="shelve">${zh() ? "搁置 15 分钟" : "Shelve 15 min"}</button>` : ""}
        <button type="button" data-act="suppress">${suppressed.has(e.id) ? (zh() ? "取消抑制" : "Unsuppress") : (zh() ? "抑制声音" : "Suppress")}</button>
        ${canInhibit ? `<button type="button" data-act="inhibit">${zh() ? "禁用此类" : "Inhibit type"}</button>` : ""}</td></tr>`;
  }
  function paintPanel() {
    const c = counts(), list = active();
    const tabs = [["active", zh() ? "当前警报" : "Active alerts"], ["log", zh() ? "事件记录" : "Event log"], ["inhibit", zh() ? "搁置与禁用" : "Shelved / inhibited"], ["catalogue", zh() ? "全部消息目录" : "Message catalogue"]];
    let body = "";
    if (tab === "active") body = list.length ? `<table class="r2-alerts"><thead><tr><th>${zh() ? "类别" : "Class"}</th><th>ID</th><th>${zh() ? "消息" : "Message"}</th><th>${zh() ? "操作" : "Actions"}</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table>` : `<p class="r2-nominal-text">${zh() ? "无当前警报。" : "No active alerts."}</p>`;
    if (tab === "log") body = `<p class="note">${zh() ? "仅记录标识符和结构化值，不记录语音或输入的对话。" : "Identifiers and structured values only. Speech and typed conversation are never logged."}</p><pre class="r2-log">${esc(JSON.stringify(log.slice(-300), null, 1))}</pre><button type="button" data-act="download-log">${zh() ? "下载事件记录 (.json)" : "Download event log (.json)"}</button>`;
    if (tab === "inhibit") {
      const sh = [...shelved].filter(([, u]) => u > now());
      body = `<ul class="r2-inhibit">${sh.map(([id, u]) => `<li><code>${esc(id)}</code> ${zh() ? "搁置至" : "shelved until"} ${esc(new Date(u).toLocaleTimeString())} <button type="button" data-enable="${esc(id)}">${zh() ? "启用" : "Enable"}</button></li>`).join("")}${[...inhibited].map((id) => `<li><code>${esc(id)}</code> ${zh() ? "已禁用（需手动启用）" : "inhibited (manual enable)"} <button type="button" data-enable="${esc(id)}">${zh() ? "启用" : "Enable"}</button></li>`).join("")}${[...suppressed].map((id) => `<li><code>${esc(id)}</code> ${zh() ? "声音已抑制，文字仍显示" : "audio suppressed, text still shown"} <button type="button" data-unsuppress="${esc(id)}">${zh() ? "取消抑制" : "Unsuppress"}</button></li>`).join("") || ""}</ul>${!sh.length && !inhibited.size && !suppressed.size ? `<p>${zh() ? "无搁置、禁用或抑制的警报。" : "Nothing shelved, inhibited or suppressed."}</p>` : ""}`;
    }
    if (tab === "catalogue") {
      const byArea = {}; for (const e of C().LIST) (byArea[e.area] = byArea[e.area] || []).push(e);
      body = Object.entries(byArea).map(([area, es]) => `<h3>${esc(loc(C().AREAS[area]))}</h3><table class="r2-alerts r2-cat"><tbody>${es.map((e) => `<tr class="r2-row r2-${e.cls.toLowerCase()}"><td>${badge(e.cls)}</td><td><code>${esc(e.id)}</code></td><td><strong>${esc(loc(e.title))}</strong><br>${esc(loc(e.text))}<br><small><b>${zh() ? "后果" : "Effect"}:</b> ${esc(loc(e.effect))} <b>${zh() ? "操作" : "Action"}:</b> ${esc(loc(e.action))}</small>${e.speech ? `<br><small>🔈 “${esc(loc(e.speech))}”</small>` : ""}</td><td><small>${esc(e.gate || "—")} · ${esc(e.npr || "—")}</small><br><button type="button" data-preview="${esc(e.id)}">${zh() ? "预览" : "Preview"}</button></td></tr>`).join("")}</tbody></table>`).join("")
        + `<p class="note r2-refs">${Object.values(C().REFS).map(esc).join(" · ")}</p>`;
    }
    panel.innerHTML = `<div class="r2-annun-shell" data-i18n-skip>
      <div class="r2-annun-head"><div><div class="entry-eyebrow">MISSY / ${zh() ? "警报与报警" : "ALERTS AND ANNUNCIATION"}</div><h2 id="r2-annun-title">${zh() ? "警报面板" : "Alert panel"}</h2></div>
        <span class="r2-mode">${zh() ? "模拟 · 人工数据" : "SIMULATION · ARTIFICIAL DATA"}</span>
        <div class="r2-counts">${["WARNING", "CAUTION", "ADVISORY", "STATUS"].map((k) => `${badge(k)} ${c[k]}`).join(" ")}</div></div>
      <div class="r2-annun-tools"><button type="button" data-act="tones">${zh() ? (tonesEnabled?"提示音：开":"提示音：关") : (tonesEnabled?"Alert tones on":"Alert tones off")}</button><button type="button" data-act="silence">🔇 ${zh() ? "静音" : "Silence"}</button><button type="button" data-act="ack-adv">${zh() ? "确认全部提示" : "Acknowledge all advisories"}</button><button type="button" data-act="test">${zh() ? "测试报警器" : "Test annunciators"}</button><button type="button" data-act="close">${zh() ? "关闭" : "Close"}</button></div>
      <nav class="r2-annun-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${esc(l)}</button>`).join("")}</nav>
      <div class="r2-annun-body">${body}</div></div>`;
  }
  function onPanelClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const key = b.closest("[data-key]")?.dataset.key, a = key && alerts.get(key);
    if (b.dataset.tab) { tab = b.dataset.tab; return paintPanel(); }
    if (b.dataset.enable) return enable(b.dataset.enable);
    if (b.dataset.unsuppress) return suppress(b.dataset.unsuppress, false);
    if (b.dataset.preview) { raise(b.dataset.preview, { group: 1, detail: "(preview)" }, "preview"); tab = "active"; return paintPanel(); }
    switch (b.dataset.act) {
      case "ack": return ack(key);
      case "shelve": return a && shelve(a.id);
      case "suppress": return a && suppress(a.id, !suppressed.has(a.id));
      case "inhibit": return a && inhibit(a.id);
      case "tones": return setTones(!tonesEnabled);
      case "silence": return silence();
      case "ack-adv": return ackAll("ADVISORY");
      case "test": return test();
      case "close": return panel.close();
      case "download-log": {
        const text = JSON.stringify({ format: "missy-r2-alert-log/1", log }, null, 2);
        if (R2.download) R2.download("missy-r2-alert-log.json", text, "application/json");
        return;
      }
    }
  }
  function open(which) {
    if (!panel) { panel = document.createElement("dialog"); panel.id = "r2-alert-panel"; panel.className = "batch-dialog r2-annun"; panel.setAttribute("aria-labelledby", "r2-annun-title"); panel.addEventListener("click", onPanelClick);panel.addEventListener("close",()=>{clearSource("preview");clearSource("test");});document.body.append(panel); }
    tab = which || tab; paintPanel(); if (!panel.open) panel.showModal();
  }
  function install() { paintLamp(); document.addEventListener("r2-language", schedule);document.getElementById("workbench-sound")?.addEventListener("click",schedule); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();

  R2.annunciator = { classify, sync, raise, clear, clearSource, ack, ackAll, reactivate, isAcked, silence, suppress, shelve, inhibit, enable, test, touch,
    unack, setTones, get tonesEnabled(){return tonesEnabled;}, blocking, active, counts, highest, open, message, entry, get log() { return log.slice(); } };
})(window.R2 = window.R2 || {});
