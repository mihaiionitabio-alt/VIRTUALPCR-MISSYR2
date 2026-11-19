/* Display-only English / Simplified Chinese localization. IDs, inputs, JSON,
 * samples, raw data and calculations stay in their original representation. */
(() => {
  "use strict";
  const R2 = window.R2 = window.R2 || {};
  let language = "en", busy = false, queued = false;
  try { language = new URLSearchParams(location.search).get("lang") || localStorage.getItem("missy-r2-language") || "en"; } catch {}
  language = language === "zh" ? "zh" : "en";
  const originalText = new WeakMap(), originalAttrs = new WeakMap();
  const skip = "script,style,textarea,pre,code,[data-i18n-skip],.sequence";
  const dictionary = Object.assign(Object.create(null), window.R2_MISSY_ZH, window.R2_WORKBENCH_ZH);
  for (const row of window.R2_ASSESSMENT_ZH_ROWS || []) {
    if (!Array.isArray(row) || row.length !== 11 || row.some(value => typeof value !== "string")) {
      console.warn("Invalid Chinese quiz row skipped"); continue;
    }
    const q = Object.values(R2.assessmentQuestions || {}).flat().find(q => q?.id === row[0]);
    if (!q || !Array.isArray(q.options) || q.options.length !== 8) { console.warn("Chinese quiz row skipped: " + row[0]); continue; }
    [q.prompt, ...q.options, q.why].forEach((text, i) => dictionary[text] = row[i + 1]);
  }
  function byPattern(text) {
    for (const [pattern, replace] of window.R2_ZH_PATTERNS || []) if (pattern.test(text)) return text.replace(pattern, replace);
    return "";
  }
  // English source text of an element, even after it was painted in Chinese.
  // Code that saves and restores a label, or parses displayed text, must use this.
  function source(el) {
    if (!el) return "";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, out = "";
    while ((node = walker.nextNode())) {
      const saved = originalText.get(node);
      out += saved && saved.last === node.nodeValue ? saved.source : node.nodeValue;
    }
    return out;
  }
  let everChinese = false;
  function phrase(value) {
    const raw = String(value), core = raw.trim();
    if (!core || language !== "zh") return raw;
    const dict = dictionary;
    let translated = dict[core] || dict[core.replace(/\s+/g, " ")];
    if (!translated) {
      const feedback = /^(Correct\.|Incorrect\.) (.*)$/.exec(core);
      if (feedback && dict[feedback[2]]) translated = dict[feedback[1]] + " " + dict[feedback[2]];
      const step = /^(← )?(\d+) · (.+?)( →)?$/.exec(core);
      if (step && dict[step[3]]) translated = (step[1] || "") + step[2] + " · " + dict[step[3]] + (step[4] || "");
    }
    if (!translated) {
      for (const [pattern, replace] of window.R2_ZH_PATTERNS || []) {
        if (pattern.test(core)) { translated = core.replace(pattern, replace); break; }
      }
    }
    // A finite dictionary of interface fragments; never translate arbitrary
    // sample names or parameter values by replacing individual English words.
    if (!translated) {
      const fragments = core.split(/( · | → |: | — | \| )/);
      if (fragments.length > 1) translated = fragments.map(s => dict[s] || byPattern(s) || s).join("");
    }
    return translated ? raw.replace(core, translated) : raw;
  }
  function paint(root = document.body) {
    if (!root || busy) return;
    busy = true;
    try {
      // HTML options without a value inherit their display text as their value.
      // Pin the original value before translating the display label.
      for (const option of root.querySelectorAll("option:not([value])")) option.setAttribute("value", option.textContent);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest(skip)) continue;
        const saved = originalText.get(node);
        const source = saved && saved.last === node.nodeValue ? saved.source : node.nodeValue;
        const next = language === "zh" ? phrase(source) : source;
        originalText.set(node, { source, last: next });
        if (node.nodeValue !== next) node.nodeValue = next;
      }
      for (const el of root.querySelectorAll("[title],[aria-label],[placeholder],img[alt]")) {
        if (el.closest(skip)) continue;
        const saved = originalAttrs.get(el) || {};
        for (const name of ["title", "aria-label", "placeholder", "alt"]) {
          if (!el.hasAttribute(name)) continue;
          const value = el.getAttribute(name), old = saved[name];
          const source = old && value === old.last ? old.source : value;
          const next = language === "zh" ? phrase(source) : source;
          saved[name] = { source, last: next };
          if (next !== value) el.setAttribute(name, next);
        }
        originalAttrs.set(el, saved);
      }
    } finally { busy = false; }
  }
  function switcher() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "r2-language";
    button.dataset.i18nSkip = "";
    button.textContent = "English / 简体中文";
    button.setAttribute("aria-label", "Switch language / 切换语言");
    button.onclick = () => set(language === "zh" ? "en" : "zh");
    return button;
  }
  function refresh() {
    for (const dialog of document.querySelectorAll("dialog[open]")) {
      if (dialog.id === "r2-transfer-loading") continue;
      if (!dialog.querySelector(".r2-language")) dialog.prepend(switcher());
    }
    for (const img of document.querySelectorAll("#json-corner img")) {
      const source = img.getAttribute("src");
      const next = source.replace(/json-(create|run)(?:-zh)?\.svg/, (_, type) => "json-" + type + (language === "zh" ? "-zh" : "") + ".svg");
      if (source !== next) img.setAttribute("src", next);
    }
    // Nothing was ever translated: English needs no page walk on every DOM change.
    if (language === "zh" || everChinese) paint();
    for (const button of document.querySelectorAll(".r2-language")) button.setAttribute("aria-pressed", String(language === "zh"));
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  }
  function set(value) {
    language = value === "zh" ? "zh" : "en";
    if (language === "zh") everChinese = true;
    try { localStorage.setItem("missy-r2-language", language); } catch {}
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.body.classList.toggle("lang-zh", language === "zh");
    refresh();
    document.dispatchEvent(new CustomEvent("r2-language", { detail: language }));
  }
  R2.i18n = { get language() { return language; }, set, text: phrase, refresh, source };
  function init() {
    document.body.append(switcher());
    set(language);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder", "alt", "open"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
