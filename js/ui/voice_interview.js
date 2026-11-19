/* MISSY R2 · JSON-only voice interview engine · adapted from supplied prototype 0.1.0
 *
 * Builds a missy-r2-batch/1 run profile from questions and answers, remembering every
 * question asked and every answer given while it constructs the JSON.
 *
 * Design rules
 *  - One canonical result: a missy-r2-batch/1 profile. The engine never validates science;
 *    the workbench's own parse()/preview() remain the authority (see adapter at the end).
 *  - Declarative agenda: each question states when it applies (like a PLEXIL SkipCondition)
 *    and how its answer is checked (PostCondition). The next question is always the first
 *    applicable, unanswered one, so changing any earlier answer re-plans the interview.
 *  - JSON-only memory (updated to the owner's privacy requirement):
 *      accepted profile revisions and field values, never raw operator wording.
 *      Generated prompts are a transient session buffer for the current question;
 *      save/load and decision exports omit all conversation text.
 *      dormant values and undo contain only structured settings.
 *  - Robustness: no exceptions escape handle(); clock injected (deterministic tests); state is
 *    plain JSON (save/load/resume); duplicate recognition results are ignored; all values are
 *    range-checked before they are remembered; bounded logs.
 *
 * Classic script (works from file://). Exposes window.MissyVoiceInterview.
 * Licence: same as the MISSY R2 workbench. No third-party code.
 */
(function (root) {
  "use strict";

  const ENGINE_VERSION = "0.2.0";
  const SCRIPT_ID = "missy-r2-voice-interview/1";
  const MEMORY_SCHEMA = "missy-r2-voice-memory/1";
  const MAX_TURNS = 5000;
  const DEDUP_MS = 1500;
  const CONFIRM_MS = 30000;
  const ARM_MS = 60000;
  const MAX_GROUPS = 20;
  const CONTROL_CODES = ["PC", "NC", "NTC", "BLK", "LOD", "POS", "CAL"];
  const CONTROL_NAMES = {
    PC: ["positive control", "pc"], NC: ["negative control", "non gm control", "nc"],
    NTC: ["no template control", "ntc", "n t c"], BLK: ["extraction blank", "blank", "blk"],
    LOD: ["detection limit control", "limit of detection", "lod", "l o d"],
    POS: ["positive sample", "pos"], CAL: ["calibrant", "calibrants", "cal", "standard"],
  };

  /* ------------------------------------------------------------------ small helpers */
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const pair = (en, zh) => ({ en, zh: zh || en });
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function normalize(text) {
    let s = String(text || "").toLowerCase();
    s = s.replace(/[“”"’'`]/g, "").replace(/[^a-z0-9.\-+%°\s]/g, " ");
    s = s.replace(/\b(uh+|um+|erm|please|okay|ok|well)\b/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/^(computer|missy)\b[\s,]*/, ""); // wake word
    return s;
  }

  /* ------------------------------------------------------------------ number parsing */
  const UNITS = {
    zero: 0, oh: 0, nought: 0, one: 1, a: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  // homophones accepted only when the whole answer is that single word
  const LONE_HOMOPHONES = { to: 2, too: 2, for: 4, fore: 4, ate: 8, won: 1, tree: 3 };

  function parseNumber(text) {
    const s = normalize(text).replace(/,/g, "");
    if (s === "") return null;
    const m = s.match(/^(minus |negative )?(-?\d+(?:\.\d+)?)\s*(%|percent|degrees|°c|c|ul|microlitres?|ng|minutes?|months?|hours?|seconds?|s|cycles?)?$/);
    if (m) return (m[1] ? -1 : 1) * parseFloat(m[2]);
    if (LONE_HOMOPHONES[s] !== undefined) return LONE_HOMOPHONES[s];
    const words = s.replace(/-/g, " ").split(" ").filter((w) => w && w !== "and");
    let neg = false;
    if (words[0] === "minus" || words[0] === "negative") { neg = true; words.shift(); }
    let total = 0, current = 0, seen = false, i = 0, decimals = null;
    for (; i < words.length; i++) {
      const w = words[i];
      if (w === "point") { decimals = ""; i++; break; }
      if (UNITS[w] !== undefined) { current += UNITS[w]; seen = true; }
      else if (TENS[w] !== undefined) { current += TENS[w]; seen = true; }
      else if (w === "hundred") { current = (current || 1) * 100; seen = true; }
      else if (w === "thousand") { total += (current || 1) * 1000; current = 0; seen = true; }
      else if (/^\d+$/.test(w)) { current += parseInt(w, 10); seen = true; }
      else if (/^(percent|degrees|celsius|microlitres?|minutes?|months?|hours?|seconds?|cycles?|copies|times)$/.test(w)) { continue; }
      else return null;
    }
    if (decimals !== null) {
      for (; i < words.length; i++) {
        const w = words[i];
        if (UNITS[w] !== undefined && UNITS[w] < 10) decimals += String(UNITS[w]);
        else if (/^\d$/.test(w)) decimals += w;
        else if (/^(percent|degrees|celsius|microlitres?|minutes?|months?|hours?|seconds?|cycles?|copies|times)$/.test(w)) continue;
        else return null;
      }
      if (!decimals) return null;
    }
    if (!seen) return null;
    let v = total + current;
    if (decimals) v = parseFloat(v + "." + decimals);
    return neg ? -v : v;
  }

  const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  function parseIndex(text) {
    const s = normalize(text);
    if (ORDINALS[s]) return ORDINALS[s];
    const n = parseNumber(s);
    return isNum(n) && n >= 1 && Number.isInteger(n) ? n : null;
  }

  /* ------------------------------------------------------------------ dates */
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  function parseDate(text, now) {
    const s = normalize(text);
    const d0 = new Date(now);
    const iso = (d) => d.toISOString().slice(0, 10);
    if (s === "today") return iso(d0);
    if (s === "yesterday") return iso(new Date(d0.getTime() - 864e5));
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return isValidDate(+m[1], +m[2], +m[3]) ? s : null;
    // "16 november 2026", "sixteen november", "november sixteen twenty twenty six"
    const words = s.split(" ");
    const mi = words.findIndex((w) => MONTHS.includes(w));
    if (mi < 0) return null;
    const month = MONTHS.indexOf(words[mi]) + 1;
    const before = words.slice(0, mi).join(" ").replace(/^the /, "").replace(/ of$/, "").replace(/(st|nd|rd|th)$/, "");
    const afterWords = words.slice(mi + 1);
    let day = parseNumber(before) || parseOrdinalDay(before);
    let rest = afterWords;
    if (!day && afterWords.length) { day = parseNumber(afterWords[0]) || parseOrdinalDay(afterWords[0]); rest = afterWords.slice(1); }
    let year = d0.getUTCFullYear();
    if (rest.length) {
      const yText = rest.join(" ");
      const y = /^\d{4}$/.test(yText) ? +yText : parseYearWords(yText);
      if (!y) return null;
      year = y;
    }
    if (!day || !isValidDate(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function parseOrdinalDay(w) {
    const o = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
    if (o[w]) return o[w];
    const m = String(w).match(/^(twenty|thirty)[ -](\w+)$/);
    if (m && o[m[2]]) return TENS[m[1]] + o[m[2]];
    return null;
  }
  function parseYearWords(t) { // "twenty twenty six", "two thousand twenty six"
    const n = parseNumber(t);
    if (isNum(n) && n >= 1990 && n <= 2100) return n;
    const w = t.split(" ");
    if (w.length >= 2) { const a = parseNumber(w[0]), b = parseNumber(w.slice(1).join(" ")); if (a === 20 && isNum(b) && b < 100) return 2000 + b; }
    return null;
  }
  function isValidDate(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }

  /* ------------------------------------------------------------------ schema → questions */
  // Spoken aliases for the built-in templates (extendable from the nomenclature register).
  const TEMPLATE_ALIASES = {
    "TPL-BUILTIN-SIMPLEX-SC-SOY": ["simplex soy", "simplex soybean", "simplex screening soybean", "soy simplex"],
    "TPL-BUILTIN-SIMPLEX-SC-MAIZE": ["simplex maize", "simplex corn", "simplex screening maize", "maize simplex"],
    "TPL-BUILTIN-SOY-SCREEN": ["soy screen", "soybean screening", "duplex soy", "soy duplex"],
    "TPL-BUILTIN-MAIZE-SCREEN": ["maize screen", "maize screening", "duplex maize", "corn screening"],
    "TPL-BUILTIN-SOY-40-3-2": ["40 3 2", "forty three two", "soy quantification", "40-3-2", "roundup ready"],
    "TPL-BUILTIN-MAIZE-MON810": ["mon810", "mon 810", "mon eight ten", "maize quantification", "mon eight one zero"],
    "TPL-MARA-ND207-IDENT": ["mara identification", "nd207 identification", "mara ident"],
    "TPL-MARA-ND207-QUANT": ["mara quantification", "nd207 quantification", "mara quant"],
    "TPL-MARA-ND207-DDCT": ["mara delta", "delta delta", "relative comparison", "mara relative"],
    "TPL-MARA-17-SOY": ["rapid soy", "mara seventeen", "rapid screening", "rapid soybean"],
  };
  const FIELD_ALIASES = { // spoken names for recall/change commands → question key suffix
    template: "template", method: "template", analysis: "template",
    repeat: "repeat", repeats: "repeat", runs: "repeat", "number of runs": "repeat",
    extractions: "design.extractions", extraction: "design.extractions", extracts: "design.extractions",
    replicates: "design.replicates", replicate: "design.replicates", "pcr replicates": "design.replicates",
    controls: "keepControls", "method controls": "keepControls",
    scenario: "scenario.id", "error scenario": "scenario.id", fault: "scenario.id",
    name: "@name", "profile name": "@name", groups: "@groups", "number of groups": "@groups",
    seed: "seed", "natural variation": "naturalVariation", samples: "samples.count", "number of samples": "samples.count",
    "annealing temperature": "programme.annT", "annealing time": "programme.annS", cycles: "programme.cycles",
    "room temperature": "reagents.ambientC", "pipetting scatter": "reagents.pipetCV",
    "dna concentration": "dna.concNgPerUl", "dna volume": "dna.volUl",
  };

  function buildSchema(snapshot) {
    const S = snapshot || {};
    const templates = (S.templates || []).map((t) => ({
      id: t.id, name: t.name || t.id, stage: t.stage,
      controls: Object.keys(t.controls || {}).filter((c) => CONTROL_CODES.includes(c)),
      maxSamples: t.samplesMax || 1,
      crop: t.crop || (/MAIZE|MON810/.test(t.id) ? "maize" : "soybean"),
      aliases: (TEMPLATE_ALIASES[t.id] || []).concat([String(t.name || "").toLowerCase()]),
    }));
    const scenarios = (S.scenarios || []).map((s) => ({ id: s.id, title: s.title, category: String(s.category) }));
    const categories = S.categories || {};
    const applicability = S.scenarioApplicability || {};
    const materials = (S.materials || []).map((m) => ({ key: m.key, label: m.label, crop: m.crop }));
    const fields = S.fields || {};
    // field labels become spoken names too
    const fieldAlias = Object.assign({}, FIELD_ALIASES);
    for (const block of ["reagents", "programme", "mix", "dna"]) {
      for (const row of fields[block] || []) {
        const spoken = String(row.label || row.k).toLowerCase().replace(/\(.*?\)/g, "").replace(/[×–]/g, " ").replace(/\s+/g, " ").trim();
        if (spoken && !fieldAlias[spoken]) fieldAlias[spoken] = `${block}.${row.k}`;
      }
    }
    return { templates, scenarios, categories, applicability, materials, fields, fieldAlias, templateInfo:S.templateInfo, scenarioFor:S.scenarioFor };
  }

  /* Question definitions. Group questions use "g{n}." prefixes. Each question:
     key, kind (number|choice|bool|text|date), text(ctx), applies(ctx), options(ctx), min/max,
     def(ctx) default value (undefined = no default), readback(value, ctx), out(profile, value, ctx) */
  function questionFor(id, schema) {
    const g = (id.match(/^g(\d+)\./) || [])[1];
    const gi = g ? +g : null;
    const rest = g ? id.slice(id.indexOf(".") + 1) : id;
    const tplOf = (ctx) => schema.templates.find((t) => t.id === ctx.fact(`g${gi}.template`));
    const label = (en, zh) => pair(en + (gi ? ` (group ${gi})` : ""), (zh || en) + (gi ? `（第 ${gi} 组）` : ""));

    switch (rest) {
      case "@name": return { id, kind: "text", section: "profile",
        text: () => pair("Name of the run profile? Dictate a name, or say default.", "运行配置文件名称？请口述名称，或说“默认”。"),
        def: (ctx) => "Voice profile " + ctx.today(), readback: (v) => pair(`Profile name: ${v}.`, `配置文件名称：${v}。`) };
      case "@groups": return { id, kind: "number", min: 1, max: MAX_GROUPS, integer: true, section: "profile",
        text: () => pair("How many run groups? Each group has its own template, design and repeat count.", "共有几组运行？每组有自己的模板、设计和重复次数。"),
        def: () => 1, readback: (v) => pair(`${v} group${v === 1 ? "" : "s"}.`, `${v} 组。`) };
      case "template": return { id, kind: "choice", section: "group",
        text: () => label("Which template?", "使用哪个模板？"),
        options: () => schema.templates.map((t) => ({ value: t.id, label: t.name, aliases: t.aliases })),
        readback: (v) => { const t = schema.templates.find((x) => x.id === v); return label(`Template: ${t ? t.name : v}.`, `模板：${t ? t.name : v}。`); } };
      case "repeat": return { id, kind: "number", min: 1, max: 200, integer: true, section: "group",
        text: () => label("How many runs in this group?", "本组运行几次？"), def: () => 1,
        readback: (v) => label(`Repeat ${v}.`, `重复 ${v} 次。`) };
      case "design.extractions": return { id, kind: "number", min: 1, max: 12, integer: true, section: "design",
        text: () => label("How many DNA extractions per sample?", "每个样品几次 DNA 提取？"), def: () => 3,
        readback: (v) => label(`${v} extraction${v === 1 ? "" : "s"}.`, `${v} 次提取。`) };
      case "design.replicates": return { id, kind: "number", min: 1, max: 12, integer: true, section: "design",
        text: () => label("How many PCR replicates per extraction?", "每次提取几个 PCR 重复？"), def: () => 3,
        readback: (v) => label(`${v} PCR replicate${v === 1 ? "" : "s"}.`, `${v} 个 PCR 重复。`) };
      case "keepControls": return { id, kind: "bool", section: "design",
        text: (ctx) => { const t = tplOf(ctx); return label(`Keep the method controls (${t ? t.controls.join(", ") : "per template"})? Yes or no.`, `保留方法对照（${t ? t.controls.join("、") : "按模板"}）？请回答是或否。`); },
        def: () => true, readback: (v) => label(v ? "Method controls." : "Custom control counts.", v ? "方法对照。" : "自定义对照数量。") };
      case "scenario.arm": return { id, kind: "bool", section: "scenario",
        text: () => label("Arm a qPCR error scenario in this group? Yes or no.", "本组是否启用 qPCR 错误场景？请回答是或否。"),
        def: () => false, readback: (v) => label(v ? "Error scenario armed." : "No error scenario.", v ? "已启用错误场景。" : "无错误场景。") };
      case "scenario.category": return { id, kind: "choice", section: "scenario",
        applies: (ctx) => ctx.fact(`g${gi}.scenario.arm`) === true,
        text: () => label("Which scenario category?", "哪一类场景？"),
        options: () => Object.entries(schema.categories).map(([k, v]) => ({ value: k, label: v, aliases: [String(v).toLowerCase().split(/[ :(]/)[0]] })),
        readback: (v) => label(`Category: ${schema.categories[v] || v}.`, `类别：${schema.categories[v] || v}。`) };
      case "scenario.id": return { id, kind: "choice", section: "scenario",
        applies: (ctx) => ctx.fact(`g${gi}.scenario.arm`) === true && ctx.fact(`g${gi}.scenario.category`) !== undefined,
        text: () => label("Which scenario? Say option and its number.", "哪个场景？请说“选项”加编号。"),
        options: (ctx) => { const t = ctx.fact(`g${gi}.template`), cat = ctx.fact(`g${gi}.scenario.category`), ok = schema.applicability[t];
          return schema.scenarios.filter((s) => s.category === cat && (!ok || ok.includes(s.id))).map((s) => ({ value: s.id, label: s.title, aliases: [] })); },
        readback: (v) => { const s = schema.scenarios.find((x) => x.id === v); return label(`Scenario: ${s ? s.title : v}.`, `场景：${s ? s.title : v}。`); } };
      case "advanced": return { id, kind: "bool", section: "advanced",
        text: () => label("Change advanced settings for this group, such as reagents, programme, mix, DNA or samples? Yes or no.", "是否更改本组高级设置（试剂、程序、反应液、DNA 或样品）？请回答是或否。"),
        def: () => false, readback: (v) => label(v ? "Advanced settings follow." : "No advanced changes.", v ? "以下为高级设置。" : "无高级更改。") };
      case "advanced.sections": return { id, kind: "multi", section: "advanced",
        applies: (ctx) => ctx.fact(`g${gi}.advanced`) === true,
        text: () => label("Which sections? Say one or more: reagents, programme, mix, DNA, samples, seed.", "哪些部分？可说一项或多项：试剂、程序、反应液、DNA、样品、随机种子。"),
        options: () => ["reagents", "programme", "mix", "dna", "samples", "seed"].map((v) => ({ value: v, label: v, aliases: v === "programme" ? ["program", "cycling"] : v === "dna" ? ["d n a"] : [] })),
        readback: (v) => label(`Sections: ${v.join(", ")}.`, `部分：${v.join("、")}。`) };
      case "seed": return { id, kind: "number", min: 1, max: 99999, integer: true, section: "advanced",
        applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("seed"),
        text: () => label("Seed number, 1 to 99999? Or say default.", "随机种子（1 至 99999）？或说“默认”。"), def: () => undefined,
        readback: (v) => label(v === undefined ? "Seed from the template." : `Seed ${spellDigits(v)}.`, v === undefined ? "使用模板种子。" : `随机种子 ${v}。`) };
      case "naturalVariation": return { id, kind: "bool", section: "advanced",
        applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("seed"),
        text: () => label("Natural variation between runs? Yes or no.", "运行之间是否有自然变异？请回答是或否。"), def: () => true,
        readback: (v) => label(v ? "Natural variation on." : "Natural variation off.", v ? "自然变异：开。" : "自然变异：关。") };
      case "samples.count": return { id, kind: "number", min: 1, integer: true, section: "samples",
        max: 28, limit: ctx => tplOf(ctx)?.maxSamples || 28, applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("samples"),
        text: (ctx) => { const t = tplOf(ctx); return label(`How many samples? Up to ${t ? t.maxSamples : "the plate limit"}.`, `几个样品？最多 ${t ? t.maxSamples : "板容量"} 个。`); },
        def: () => 1, readback: (v) => label(`${v} sample${v === 1 ? "" : "s"}.`, `${v} 个样品。`) };
      case "out.openQuality": return { id, kind: "bool", section: "output",
        text: () => pair("Open the Quality manager when the runs are made? Yes or no.", "运行完成后是否打开质量管理？请回答是或否。"), def: () => true,
        readback: (v) => pair(v ? "Open Quality manager." : "Do not open Quality manager.", v ? "打开质量管理。" : "不打开质量管理。") };
      case "out.selectForMissy": return { id, kind: "bool", section: "output",
        text: () => pair("Select the new runs for MISSY at the end? Yes or no.", "最后是否为 MISSY 勾选新运行？请回答是或否。"), def: () => true,
        readback: (v) => pair(v ? "Select the new runs for MISSY." : "Do not select for MISSY.", v ? "为 MISSY 勾选新运行。" : "不为 MISSY 勾选。") };
      case "out.downloadRdmltZip": return { id, kind: "bool", section: "output",
        text: () => pair("Download one ZIP with all RDMLt files? Yes or no.", "是否下载包含全部 RDMLt 文件的 ZIP？请回答是或否。"), def: () => false,
        readback: (v) => pair(v ? "Download the RDMLt ZIP." : "No RDMLt ZIP.", v ? "下载 RDMLt ZIP。" : "不下载 RDMLt ZIP。") };
    }
    // custom control counts: g1.ctl.NTC
    let m = rest.match(/^ctl\.([A-Z]+)$/);
    if (m) {
      const code = m[1];
      return { id, kind: "number", min: 0, max: 12, integer: true, section: "design", allowMethod: true,
        applies: (ctx) => ctx.fact(`g${gi}.keepControls`) === false && (tplOf(ctx) || { controls: [] }).controls.includes(code),
        text: () => label(`${code} wells per reaction mix? 0 to 12, or say method.`, `每个反应液的 ${code} 孔数？0 至 12，或说“方法”。`),
        def: () => "method",
        readback: (v) => label(v === "method" ? `${code} as the method.` : `${code} ${v}${v === 0 ? " (deliberately omitted)" : ""}.`, v === "method" ? `${code} 按方法。` : `${code} ${v}。`) };
    }
    // sample materials and dates: g1.sample.2.material / g1.sample.2.date
    m = rest.match(/^sample\.(\d+)\.(material|date)$/);
    if (m) {
      const n = +m[1], what = m[2];
      if (what === "material") return { id, kind: "choice", section: "samples",
        applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("samples") && n <= (ctx.fact(`g${gi}.samples.count`) || 1),
        text: () => label(`Material of sample ${n}?`, `样品 ${n} 的材料？`),
        options: (ctx) => { const t = tplOf(ctx); return schema.materials.filter((x) => !t || x.crop === t.crop || x.key === "blind").map((x) => ({ value: x.key, label: x.label, aliases: [String(x.label).toLowerCase()] })); },
        readback: (v) => { const x = schema.materials.find((y) => y.key === v); return label(`Sample ${n}: ${x ? x.label : v}.`, `样品 ${n}：${x ? x.label : v}。`); } };
      return { id, kind: "date", section: "samples",
        applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("samples") && n <= (ctx.fact(`g${gi}.samples.count`) || 1),
        text: () => label(`DNA extraction date of sample ${n}? For example today, or sixteen November.`, `样品 ${n} 的 DNA 提取日期？例如“今天”或“11 月 16 日”。`),
        def: (ctx) => ctx.today(),
        readback: (v) => label(`Sample ${n} extracted ${v}.`, `样品 ${n} 提取日期 ${v}。`) };
    }
    if (rest === "programme.mode") return { id, kind: "choice", section: "programme",
      applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes("programme"),
      text: () => label("Programme: template, method record, or custom?", "程序：模板、方法记录，还是自定义？"),
      options: () => [{ value: "template", label: "template", aliases: ["default"] }, { value: "method", label: "method record", aliases: ["method"] }, { value: "custom", label: "custom", aliases: ["own", "change it"] }],
      def: () => "template", readback: (v) => label(`Programme: ${v}.`, `程序：${v}。`) };
    // generic FIELDS rows: g1.reagents.probeStoreC, g1.programme.annT, g1.mix.rxnUl, g1.dna.volUl
    m = rest.match(/^(reagents|programme|mix|dna)\.(\w+)$/);
    if (m) {
      const block = m[1], key = m[2];
      const row = (schema.fields[block] || []).find((r) => r.k === key);
      if (!row) return null;
      const base = { id, section: block, allowMethod: true,
        applies: (ctx) => (ctx.fact(`g${gi}.advanced.sections`) || []).includes(block) &&
          (block !== "programme" || ctx.fact(`g${gi}.programme.mode`) === "custom"),
        def: () => "method",
        text: () => label(`${row.label}?${row.type === "number" ? ` ${row.min} to ${row.max},` : ""} or say method.`, `${row.label}？${row.type === "number" ? `${row.min} 至 ${row.max}，` : ""}或说“方法”。`),
        readback: (v) => label(v === "method" ? `${row.label}: as the method.` : `${row.label}: ${v}.`, v === "method" ? `${row.label}：按方法。` : `${row.label}：${v}。`) };
      if (row.type === "number") return Object.assign(base, { kind: "number", min: row.min, max: row.max, step: row.step });
      if (row.type === "bool") return Object.assign(base, { kind: "bool", def: () => "method" });
      if (row.type === "select") return Object.assign(base, { kind: "choice",
        options: () => row.options.map((o) => ({ value: o, label: String(o), aliases: [String(o).toLowerCase(), typeof o === "number" ? String(o) : ""] })) });
    }
    return null;
  }

  function spellDigits(n) {
    const names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    return String(n).split("").map((c) => names[+c] || c).join("-");
  }

  /* ------------------------------------------------------------------ the engine */
  function create(options) {
    const opt = Object.assign({ snapshot: null, lang: "en", now: () => Date.now(), longTerm: null, validate: null,
      resetForTemplate: root.R2?.batchRuns?.resetForTemplate }, options || {});
    const schema = buildSchema(opt.snapshot);
    let st = freshState();

    function freshState() {
      return { schema: MEMORY_SCHEMA, scriptId: SCRIPT_ID, engine: ENGINE_VERSION, startedAt: iso(opt.now()), lang: opt.lang,
        phase: "interview", facts: {}, turns: [], jsonChanges: [], cursor: null, lastAsked: null, pending: null, undo: [], lastInput: null, armedUntil: 0 };
    }
    function iso(t) { return new Date(t).toISOString(); }
    const ctx = {
      fact: (id) => { const f = st.facts[id]; return f && !f.dormant ? f.value : undefined; },
      today: () => iso(opt.now()).slice(0, 10),
    };

    /* ---- agenda: ordered list of applicable question ids (re-computed every time) */
    function agenda() {
      const ids = ["@name", "@groups"];
      const groups = Math.min(MAX_GROUPS, ctx.fact("@groups") || 1);
      for (let g = 1; g <= groups; g++) {
        const p = `g${g}.`;
        ids.push(p + "template", p + "repeat", p + "design.extractions", p + "design.replicates", p + "keepControls");
        for (const c of CONTROL_CODES) ids.push(p + "ctl." + c);
        ids.push(p + "scenario.arm", p + "scenario.category", p + "scenario.id", p + "advanced", p + "advanced.sections");
        ids.push(p + "samples.count");
        const nS = Math.min(28, ctx.fact(p + "samples.count") || 1);
        for (let n = 2; n <= nS; n++) ids.push(`${p}sample.${n}.material`, `${p}sample.${n}.date`);
        ids.push(p + "seed", p + "naturalVariation");
        for (const row of schema.fields.dna || []) ids.push(p + "dna." + row.k);
        for (const row of schema.fields.reagents || []) ids.push(p + "reagents." + row.k);
        ids.push(p + "programme.mode");
        for (const row of schema.fields.programme || []) ids.push(p + "programme." + row.k);
        for (const row of schema.fields.mix || []) ids.push(p + "mix." + row.k);
      }
      ids.push("out.openQuality", "out.selectForMissy", "out.downloadRdmltZip");
      return ids.filter((id) => { const q = Q(id); if (!q) return false; try { return q.applies ? q.applies(ctx) : true; } catch (e) { return false; } });
    }
    const qCache = {};
    function Q(id) { if (!(id in qCache)) qCache[id] = questionFor(id, schema); return qCache[id]; }
    function nextQuestion() { return agenda().find((id) => ctx.fact(id) === undefined) || null; }

    /* ---- dormancy: facts that no longer apply are kept but marked dormant */
    function refreshDormancy(reasonTurn) {
      const live = new Set(agenda());
      const dropped = [], revived = [];
      for (const [id, f] of Object.entries(st.facts)) {
        if (!live.has(id) && !f.dormant) { f.dormant = true; f.dormantSince = reasonTurn; dropped.push(id); }
        else if (live.has(id) && f.dormant) { revived.push(id); }
      }
      return { dropped, revived };
    }

    /* ---- memory writes */
    function say(m, extra) { return logTurn("missy", m.en, Object.assign({ zh: m.zh }, extra)); }
    function logTurn(role, text, extra) {
      const t = Object.assign({ n: st.turns.length ? st.turns[st.turns.length - 1].n + 1 : 1, at: iso(opt.now()), role, text }, extra || {});
      st.turns.push(t);
      if (st.turns.length > MAX_TURNS) st.turns.splice(0, st.turns.length - MAX_TURNS);
      return t;
    }
    function remember(id, value, turn, via, heard, reason) {
      const prev = st.facts[id];
      const history = prev ? (prev.history || []).concat([{ value: prev.value, dormant: !!prev.dormant }]) : [];
      st.facts[id] = { value: clone(value), turn: turn.n, at: turn.at, via, reason: reason || "answer", history };
      st.undo.push({ id, prev: prev ? clone(prev) : null });
      if (st.undo.length > 200) st.undo.shift();
    }

    /* ---- answer interpretation for one question */
    function interpret(q, text, raw) {
      const s = normalize(text);
      if (/^(default|skip|use (the )?default|keep (the )?default)$/.test(s)) {
        const d = q.def ? q.def(ctx) : undefined;
        if (d === undefined && q.kind !== "number") return { error: pair("This question has no default. Please answer it.", "此问题没有默认值，请回答。") };
        return { value: d === undefined ? null : d, how: "default" };
      }
      if (q.allowMethod && /^(method|as the method|same as (the )?method|unchanged)$/.test(s)) return { value: "method", how: "method" };
      const optIdx = s.match(/^(option|number) (.+)$/);
      if (q.kind === "number") {
        const n = parseNumber(s), max = q.limit ? q.limit(ctx) : q.max;
        if (!isNum(n)) return { error: pair(`Not understood. Say a number from ${q.min} to ${max}.`, `未听懂。请说 ${q.min} 至 ${max} 之间的数字。`) };
        if (q.integer && !Number.isInteger(n)) return { error: pair("Whole numbers only.", "只能是整数。") };
        if ((q.min !== undefined && n < q.min) || (max !== undefined && n > max)) return { error: pair(`${n} is out of range. The range is ${q.min} to ${max}.`, `${n} 超出范围，范围为 ${q.min} 至 ${max}。`) };
        return { value: n };
      }
      if (q.kind === "bool") {
        if (/^(yes|yeah|yep|affirmative|correct|true|on|keep|keep them)$/.test(s)) return { value: true };
        if (/^(no|nope|negative|false|off|none)$/.test(s)) return { value: false };
        return { error: pair("Answer yes or no.", "请回答是或否。") };
      }
      if (q.kind === "text") {
        const t = String(raw || "").replace(/^\s*(computer|missy)[,\s]*/i, "").trim().slice(0, 100);
        if (!t) return { error: pair("Please dictate the text.", "请口述文字。") };
        return { value: t.charAt(0).toUpperCase() + t.slice(1) };
      }
      if (q.kind === "date") {
        const d = parseDate(s, opt.now());
        return d ? { value: d } : { error: pair("Date not understood. Say today, yesterday, or a day and month, for example sixteen November.", "未听懂日期。请说“今天”、“昨天”或日期，例如“11 月 16 日”。") };
      }
      if (q.kind === "choice" || q.kind === "multi") {
        const opts = q.options(ctx);
        if (!opts.length) return { error: pair("No options are available here.", "此处没有可用选项。") };
        const pick = (phrase) => {
          const p = normalize(phrase);
          const idx = p.match(/^(option |number )?(.+)$/);
          const n = parseIndex(idx[2]);
          if (idx[1] && n && n <= opts.length) return opts[n - 1];
          if (!idx[1] && opts.some((o) => typeof o.value === "number")) { // numeric option lists: match the value, never the position
            const v = parseNumber(p); const hitN = opts.find((o) => o.value === v); return hitN || null;
          }
          let hit = opts.filter((o) => normalize(o.value) === p || normalize(o.label) === p || (o.aliases || []).some((a) => a && normalize(a) === p));
          if (hit.length === 1) return hit[0];
          hit = opts.filter((o) => (o.aliases || []).concat([o.label]).some((a) => a && normalize(a).length > 3 && (p.includes(normalize(a)) || normalize(a).includes(p) && p.length > 4)));
          if (hit.length === 1) return hit[0];
          if (!idx[1] && n && n <= opts.length && opts.every((o) => typeof o.value !== "number")) return opts[n - 1];
          return null;
        };
        if (q.kind === "multi") {
          const parts = String(raw || text).toLowerCase().split(/,|;|\band\b|\bplus\b|&/).map((x) => normalize(x)).filter(Boolean);
          const vals = [];
          for (const p of parts) { const o = pick(p); if (!o) return { error: pair(`Not one of: ${opts.map((o) => o.label).join(", ")}.`, `不在选项中：${opts.map((o) => o.label).join("、")}。`) }; if (!vals.includes(o.value)) vals.push(o.value); }
          return vals.length ? { value: vals } : { error: pair("Say one or more sections.", "请说一项或多项。") };
        }
        const o = pick(s);
        if (o) return { value: o.value };
        return { error: pair(`Not one of the options. Say "option" and a number from 1 to ${opts.length}, or say list options.`, `不在选项中。请说“选项”加 1 至 ${opts.length} 的编号，或说“列出选项”。`) };
      }
      return { error: pair("Not understood.", "未听懂。") };
    }

    /* ---- reading answers back from memory */
    function describe(id) {
      const q = Q(id), f = st.facts[id];
      if (!q || !f) return null;
      const rb = q.readback(f.value, ctx);
      return { id, text: rb, turn: f.turn, heard: f.heard, via: f.via, dormant: !!f.dormant, history: f.history || [] };
    }
    function resolveField(phrase, group) {
      const p = normalize(phrase).replace(/^(the|my) /, "");
      let key = schema.fieldAlias[p];
      if (!key) for (const c of CONTROL_CODES) if (CONTROL_NAMES[c].includes(p)) key = "ctl." + c;
      if (!key) { const hit = Object.keys(schema.fieldAlias).filter((a) => a.length > 3 && (a.includes(p) || p.includes(a))); if (hit.length === 1) key = schema.fieldAlias[hit[0]]; }
      if (!key) return null;
      if (key.startsWith("@") || key.startsWith("out.")) return key;
      const g = group || groupOf(st.cursor) || 1;
      return `g${g}.${key}`;
    }
    const groupOf = (id) => { const m = String(id || "").match(/^g(\d+)\./); return m ? +m[1] : null; };

    /* ---- the next prompt */
    function askNext(turnRef) {
      if (st.phase !== "interview") return null;
      const id = nextQuestion();
      if (!id) {
        st.phase = "review"; st.cursor = null;
        const t = say(pair("All questions answered. Opening the read-back. Say confirm build, correction and a field, or say again.", "所有问题已回答。正在打开复述。请说“确认生成”、“更正”加字段，或“再说一遍”。"), { kind: "review" });
        return t;
      }
      st.cursor = id;
      const q = Q(id);
      // memory: a dormant earlier answer for this question is offered back
      const dormant = st.facts[id] && st.facts[id].dormant ? st.facts[id] : null;
      // long-term memory: last interview's answer for the same question shape
      const shape = id.replace(/^g\d+\./, "g*.");
      const last = opt.longTerm && opt.longTerm.last && opt.longTerm.last[shape];
      let m = q.text(ctx);
      const opts = q.options ? q.options(ctx) : null;
      const extra = [];
      if (dormant) extra.push(pair(` Earlier you chose: ${plain(q.readback(dormant.value, ctx).en)} Say keep to use it again.`, ` 之前您选择了：${q.readback(dormant.value, ctx).zh} 说“保留”可再次使用。`));
      else if (last !== undefined && last !== null) extra.push(pair(` Last time: ${plain(q.readback(last.value, ctx).en)} Say same as last time to reuse it.`, ` 上次：${q.readback(last.value, ctx).zh} 说“和上次一样”可沿用。`));
      const d = q.def ? q.def(ctx) : undefined;
      if (d !== undefined && !dormant) extra.push(pair(` Default: ${d === "method" ? "method" : typeof d === "boolean" ? (d ? "yes" : "no") : d}.`, ` 默认：${d === "method" ? "方法" : typeof d === "boolean" ? (d ? "是" : "否") : d}。`));
      m = pair(m.en + extra.map((x) => x.en).join(""), m.zh + extra.map((x) => x.zh).join(""));
      st.lastAsked = id;
      return say(m, { kind: "question", qid: id, options: opts ? opts.map((o, i) => ({ n: i + 1, value: o.value, label: o.label })) : null, progress: progress(), offer: dormant ? "dormant" : last ? "last" : null, ref: turnRef || null });
    }
    const plain = (s) => String(s).replace(/\s+$/, "");

    function progress() {
      const ag = agenda();
      const answered = ag.filter((id) => ctx.fact(id) !== undefined).length;
      return { answered, total: ag.length, group: groupOf(st.cursor), groups: ctx.fact("@groups") || 1 };
    }

    /* ---- command patterns available at every step */
    const COMMANDS = [
      [/^(go )?back$|^previous( question)?$/, "back"],
      [/^(say (that )?again|repeat( that| the question)?|pardon|come again)$/, "repeat"],
      [/^(where am i|status|progress|how many (questions )?(are )?left)$/, "status"],
      [/^(read ?back|summary|summari[sz]e|what (have|did) (we|i) (got|said|decide[d]?)( so far)?)$/, "summary"],
      [/^undo( that| last)?$/, "undo"],
      [/^(list( the)? options|options|what are (the|my) options|what can i say)$/, "list"],
      [/^(keep( it| that)?|use it again)$/, "keep"],
      [/^same as (last time|before)$/, "lastTime"],
      [/^same as group (.+)$/, "copyGroup"],
      [/^what did you (just )?ask( me)?( before)?$|^what was the (last )?question$/, "lastQuestion"],
      [/^what (did i (say|answer|choose)|is|was|are) (for |to )?(question (.+)|(the )?(.+?))( (in|for|of) group (.+))?$/, "recall"],
      [/^(change|set|make|correction) (the )?(.+?)( (in|for|of) group (\w+))? to (.+)$/, "change"],
      [/^correction( (the )?(.+?))?( (in|for|of) group (\w+))?$/, "correct"],
      [/^(skip (the )?(rest of )?(the |this )?section|(the )?rest (as|by) (the )?(method|default)|defaults? for the rest( of (the |this )?section)?)$/, "skipSection"],
      [/^add (a |another )?group$/, "addGroup"],
      [/^(start over|restart|new interview)$/, "restart"],
      [/^(stop|pause|hold)$/, "stop"],
      [/^(save|save it|save profile)$/, "save"],
      [/^(finish|done|that's all|thats all|review|read back everything)$/, "finish"],
      [/^confirm build$/, "confirmBuild"],
      [/^launch$/, "launch"],
      [/^(approve|release|validate|override|sign off)\b.*/, "refuse"],
    ];
    function parseCommand(s) {
      for (const [re, name] of COMMANDS) { const m = s.match(re); if (m) return { name, m }; }
      return null;
    }

    /* ---- main entry: one operator utterance → MISSY turns */
    function handle(rawText, meta) {
      const out = [], before = JSON.stringify(profile());
      try {
        meta = Object.assign({ via: "typed", engine: "none", confidence: null }, meta || {});
        const s = normalize(rawText);
        const now = opt.now();
        if (!s) return out;
        // duplicate recognition results (interim/final revisions) are ignored
        if (st.lastInput && st.lastInput.s === String(s.length)+":"+[...s].reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619),2166136261) && now - st.lastInput.t < DEDUP_MS && st.lastInput.cursor === st.cursor) return out;
        st.lastInput = { s: String(s.length)+":"+[...s].reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619),2166136261), t: now, cursor: st.cursor };
        const opTurn = { n: st.turns.length+1, at: iso(now) }; // raw input is transient, never a history turn
        const cmd = parseCommand(s);
        if (cmd) { runCommand(cmd, rawText, opTurn, out); return out; }
        if (st.phase === "review" || st.phase === "armed") {
          out.push(say(pair("In review. Say confirm build, correction and a field, change a field to a value, or say again.", "复述阶段。请说“确认生成”、“更正”加字段、“将某字段改为某值”或“再说一遍”。")));
          return out;
        }
        if (!st.cursor) { const t = askNext(opTurn.n); if (t) out.push(t); return out; }
        answerCurrent(rawText, opTurn, out, meta);
      } catch (e) {
        out.push(say(pair("Internal problem while handling that. Nothing was changed. Please say it again or use the buttons.", "处理时出现内部问题，未作任何更改。请再说一遍或使用按钮。"), { kind: "error", detail: String(e && e.message || e) }));
      }
      finally {
        const after = profile();
        if (JSON.stringify(after) !== before) {
          st.jsonChanges ||= []; st.jsonChanges.push({at:iso(opt.now()),profile:clone(after)});
          if (st.jsonChanges.length > 200) st.jsonChanges.shift();
        }
      }
      return out;
    }

    function answerCurrent(rawText, opTurn, out, meta) {
      const id = st.cursor, q = Q(id);
      const r = interpret(q, rawText, rawText);
      if (r.error) { out.push(say(r.error, { kind: "clarify", qid: id })); return; }
      commit(id, r.value === null ? undefined : r.value, opTurn, meta.via, rawText, r.how || "answer", out);
    }

    function commit(id, value, opTurn, via, heard, reason, out) {
      const q = Q(id);
      if (value === undefined) { // e.g. "default" on a question whose default is "from template"
        remember(id, null, opTurn, via, heard, reason);
      } else remember(id, value, opTurn, via, heard, reason);
      const shown = st.facts[id].value;
      const echo = q.readback(shown === null ? undefined : shown, ctx);
      const ch = refreshDormancy(opTurn.n);
      out.push(say(echo, { kind: "echo", qid: id, value: shown }));
      if (ch.dropped.length) out.push(say(pair(`${ch.dropped.length} earlier answer${ch.dropped.length === 1 ? "" : "s"} no longer appl${ch.dropped.length === 1 ? "ies" : "y"} and ${ch.dropped.length === 1 ? "is" : "are"} kept aside: ${ch.dropped.map(shortName).join(", ")}.`, `${ch.dropped.length} 个先前答案不再适用，已暂存：${ch.dropped.map(shortName).join("、")}。`), { kind: "dormant", ids: ch.dropped }));
      const t = askNext(opTurn.n); if (t) out.push(t);
    }
    const shortName = (id) => id.replace(/^g(\d+)\./, "group $1 ").replace(/^@/, "").replace(/\./g, " ");

    function runCommand(cmd, rawText, opTurn, out) {
      const m = cmd.m;
      switch (cmd.name) {
        case "back": {
          const answered = agenda().filter((id) => ctx.fact(id) !== undefined);
          const target = st.cursor ? answered.filter((id) => agenda().indexOf(id) < agenda().indexOf(st.cursor)).pop() : answered.pop();
          if (!target) { out.push(say(pair("This is the first question.", "这是第一个问题。"))); return; }
          const f = st.facts[target];
          st.undo.push({ id: target, prev: clone(f) });
          f.history = (f.history || []).concat([{ value: f.value, turn: f.turn, at: f.at, via: f.via, heard: f.heard, reopened: opTurn.n }]);
          f.dormant = true; f.dormantSince = opTurn.n; f.reopened = true;
          st.phase = "interview";
          out.push(say(pair("Going back one question. Your previous answer is kept as a suggestion.", "返回上一个问题。您之前的答案作为建议保留。")));
          const t = askNext(opTurn.n); if (t) out.push(t); return;
        }
        case "repeat": {
          const last = [...st.turns].reverse().find((t) => t.role === "missy" && (t.kind === "question" || t.kind === "review"));
          out.push(last ? say(pair(last.text, last.zh), { kind: last.kind, qid: last.qid, options: last.options, progress: progress(), repeat: true }) : say(pair("Nothing to repeat yet.", "尚无可重复内容。")));
          return;
        }
        case "status": {
          const p = progress();
          out.push(say(pair(`${p.answered} of ${p.total} questions answered${p.group ? `, now in group ${p.group} of ${p.groups}` : ""}. ${st.turns.length} turns remembered.`, `已回答 ${p.answered}/${p.total} 个问题${p.group ? `，当前第 ${p.group}/${p.groups} 组` : ""}。已记录 ${st.turns.length} 条对话。`), { kind: "status", progress: p }));
          return;
        }
        case "summary": {
          const cl = readback();
          out.push(say(pair("So far: " + cl.map((c) => c.en).join(" "), "目前：" + cl.map((c) => c.zh).join("")), { kind: "summary", clauses: cl }));
          return;
        }
        case "undo": {
          const u = st.undo.pop();
          if (!u) { out.push(say(pair("Nothing to undo.", "没有可撤销的操作。"))); return; }
          if (u.prev) st.facts[u.id] = u.prev; else delete st.facts[u.id];
          refreshDormancy(opTurn.n);
          if (st.phase !== "interview" && nextQuestion()) st.phase = "interview";
          out.push(say(pair(`Undone: ${shortName(u.id)}${u.prev ? " restored to " + plain(Q(u.id).readback(u.prev.value, ctx).en) : " cleared."}`, `已撤销：${shortName(u.id)}`), { kind: "undo", qid: u.id }));
          const t = askNext(opTurn.n); if (t && st.cursor !== u.id) out.push(t); else if (t) out.push(t);
          return;
        }
        case "list": {
          const q = st.cursor && Q(st.cursor);
          if (!q || !q.options) { out.push(say(pair(q ? `Say a ${q.kind === "number" ? `number from ${q.min} to ${q.max}` : q.kind === "bool" ? "yes or no" : q.kind}.` : "No question is open.", q ? "请按提示作答。" : "当前没有问题。"))); return; }
          const opts = q.options(ctx);
          out.push(say(pair("Options: " + opts.map((o, i) => `${i + 1}, ${o.label}`).join("; ") + ".", "选项：" + opts.map((o, i) => `${i + 1}、${o.label}`).join("；") + "。"), { kind: "options", qid: st.cursor, options: opts.map((o, i) => ({ n: i + 1, value: o.value, label: o.label })) }));
          return;
        }
        case "keep": {
          const f = st.cursor && st.facts[st.cursor];
          if (!f || !f.dormant) { out.push(say(pair("There is no earlier answer to keep here.", "此处没有可保留的先前答案。"))); return; }
          f.dormant = false; delete f.reopened;
          f.history = (f.history || []).concat([{ value: f.value, turn: f.turn, at: f.at, revivedAt: opTurn.n }]);
          f.turn = opTurn.n; f.reason = "kept earlier answer";
          refreshDormancy(opTurn.n);
          out.push(say(Q(st.cursor).readback(f.value, ctx), { kind: "echo", qid: st.cursor, value: f.value, kept: true }));
          const t = askNext(opTurn.n); if (t) out.push(t); return;
        }
        case "lastTime": {
          const shape = String(st.cursor || "").replace(/^g\d+\./, "g*.");
          const last = opt.longTerm && opt.longTerm.last && opt.longTerm.last[shape];
          if (!st.cursor || !last) { out.push(say(pair("I have no answer from a previous interview for this question.", "我没有此问题在上次访谈中的答案。"))); return; }
          commit(st.cursor, last.value, opTurn, "memory", rawText, "same as last time", out); return;
        }
        case "copyGroup": {
          const src = parseIndex(m[1]), dst = groupOf(st.cursor);
          if (!src || !dst || src === dst || src > (ctx.fact("@groups") || 1)) { out.push(say(pair("Say same as group and the number of an earlier group, while answering a later group.", "请在回答后面的组时说“和第几组一样”。"))); return; }
          let n = 0;
          for (const [id, f] of Object.entries(st.facts)) {
            if (f.dormant || !id.startsWith(`g${src}.`)) continue;
            const target = id.replace(`g${src}.`, `g${dst}.`);
            if (ctx.fact(target) === undefined) { remember(target, f.value, opTurn, "memory", rawText, `copied from group ${src}`); n++; }
          }
          refreshDormancy(opTurn.n);
          out.push(say(pair(`Copied ${n} answer${n === 1 ? "" : "s"} from group ${src} to group ${dst}. Change any of them by saying change, the field, and the new value.`, `已从第 ${src} 组复制 ${n} 个答案到第 ${dst} 组。可说“将某字段改为某值”进行更改。`), { kind: "copy", from: src, to: dst, count: n }));
          const t = askNext(opTurn.n); if (t) out.push(t); return;
        }
        case "lastQuestion": {
          const qs = st.turns.filter((t) => t.role === "missy" && t.kind === "question");
          const prev = qs.length > 1 ? qs[qs.length - 2] : qs[qs.length - 1];
          out.push(prev ? say(pair(`I asked: ${prev.text}`, `我问的是：${prev.zh}`), { kind: "recall" }) : say(pair("I have not asked anything yet.", "我还没有提问。"))); return;
        }
        case "recall": {
          const qNum = m[5] ? parseIndex(m[5]) : null;
          let id = null;
          if (qNum) { const qs = st.turns.filter((t) => t.role === "missy" && t.kind === "question" && !t.repeat); const qt = qs[qNum - 1]; id = qt && qt.qid; }
          else id = resolveField(m[7] || "", m[10] ? parseIndex(m[10]) : null);
          const d = id && describe(id);
          if (!d) { out.push(say(pair(id ? `No answer is remembered yet for ${shortName(id)}.` : "I do not know that field. Say for example: what did I say for replicates in group one.", id ? `尚未记录 ${shortName(id)} 的答案。` : "我不认识该字段。例如可说：第一组的重复数是多少。"), { kind: "recall" })); return; }
          const hist = d.history.length ? ` Earlier value${d.history.length > 1 ? "s" : ""}: ${d.history.map((h) => plain(Q(id).readback(h.value, ctx).en)).join("; ")}` : "";
          out.push(say(pair(`${plain(d.text.en)}${d.dormant ? " This setting is currently set aside." : ""}${hist}`, `${d.text.zh}${d.dormant ? " 该设置目前暂存。" : ""}`), {kind:"recall",qid:id}));
          return;
        }
        case "change": {
          const id = resolveField(m[3], m[6] ? parseIndex(m[6]) : null);
          const q = id && Q(id);
          if (!q) { out.push(say(pair("I do not know that field. Say for example: change replicates in group one to two.", "我不认识该字段。例如：将第一组的重复数改为 2。"))); return; }
          if (q.applies && !q.applies(ctx)) { out.push(say(pair(`${shortName(id)} does not apply with the current answers.`, `按当前答案，${shortName(id)} 不适用。`))); return; }
          const r = interpret(q, m[7], m[7]);
          if (r.error) { out.push(say(r.error, { kind: "clarify", qid: id })); return; }
          const wasPhase = st.phase;
          if (wasPhase !== "interview") st.phase = "interview";
          const before = ctx.fact(id);
          const saveCursor = st.cursor;
          remember(id, r.value, opTurn, "voice-change", rawText, `changed from ${JSON.stringify(before)}`);
          const ch = refreshDormancy(opTurn.n);
          out.push(say(pair(`Changed. ${plain(q.readback(r.value, ctx).en)}`, `已更改。${q.readback(r.value, ctx).zh}`), { kind: "echo", qid: id, value: r.value, changed: true }));
          if (ch.dropped.length) out.push(say(pair(`${ch.dropped.length} dependent answer${ch.dropped.length === 1 ? "" : "s"} set aside: ${ch.dropped.map(shortName).join(", ")}.`, `${ch.dropped.length} 个相关答案已暂存。`), { kind: "dormant", ids: ch.dropped }));
          st.armedUntil = 0;
          const nq = nextQuestion();
          if (nq) { const t = askNext(opTurn.n); if (t) { if (nq === saveCursor && wasPhase === "interview") { t.text = "Back to the open question. " + t.text; t.zh = "回到当前问题。" + t.zh; } out.push(t); } }
          else { st.phase = wasPhase === "armed" ? "review" : wasPhase; if (st.phase === "interview") { const t = askNext(opTurn.n); if (t) out.push(t); } else out.push(say(pair("Back in review. The check must run again before launch.", "返回复述阶段。启动前需要重新检查。"), { kind: "review" })); }
          return;
        }
        case "correct": {
          if (!m[3]) { const t = askNext(opTurn.n); out.push(say(pair("Say correction and the field, for example correction replicates group one; or say change, the field, and the new value.", "请说“更正”加字段，或“将某字段改为某值”。"))); if (t && st.phase === "interview") out.push(t); return; }
          const id = resolveField(m[3], m[6] ? parseIndex(m[6]) : null);
          if (!id || !st.facts[id]) { out.push(say(pair("Nothing remembered for that field yet.", "该字段尚无记录。"))); return; }
          const f = st.facts[id];
          st.undo.push({ id, prev: clone(f) });
          f.dormant = true; f.dormantSince = opTurn.n; f.reopened = true;
          st.phase = "interview"; st.armedUntil = 0;
          out.push(say(pair(`Reopening ${shortName(id)}.`, `重新打开 ${shortName(id)}。`)));
          // ask exactly this question next, even if earlier ones follow in the agenda
          st.cursor = id; const q = Q(id);
          out.push(say(q.text(ctx), { kind: "question", qid: id, options: q.options ? q.options(ctx).map((o, i) => ({ n: i + 1, value: o.value, label: o.label })) : null, progress: progress(), offer: "dormant" }));
          return;
        }
        case "skipSection": {
          if (!st.cursor || st.phase !== "interview") { out.push(say(pair("No section is open.", "当前没有打开的部分。"))); return; }
          const q0 = Q(st.cursor), g = groupOf(st.cursor), sec = q0.section;
          if (["profile", "group", "output"].includes(sec)) { out.push(say(pair("These questions have to be answered one by one.", "这些问题需要逐一回答。"))); return; }
          let n = 0, guard = 0;
          while (st.cursor && guard++ < 200) {
            const q = Q(st.cursor);
            if (q.section !== sec || groupOf(st.cursor) !== g) break;
            const d = q.def ? q.def(ctx) : undefined;
            if (d === undefined && q.kind !== "number") break; // no default: must be asked
            remember(st.cursor, d === undefined ? null : d, opTurn, "voice", rawText, "rest of section by default");
            n++; refreshDormancy(opTurn.n);
            st.cursor = nextQuestion();
          }
          out.push(say(pair(`${n} remaining ${sec} answer${n === 1 ? "" : "s"} set to ${sec === "samples" ? "the defaults" : "the method"}.`, `${sec} 其余 ${n} 项已设为默认/方法。`), { kind: "echo", bulk: n }));
          const t = askNext(opTurn.n); if (t) out.push(t); return;
        }
        case "addGroup": {
          const g = (ctx.fact("@groups") || 1) + 1;
          if (g > MAX_GROUPS) { out.push(say(pair(`At most ${MAX_GROUPS} groups.`, `最多 ${MAX_GROUPS} 组。`))); return; }
          remember("@groups", g, opTurn, "voice", rawText, "add group");
          refreshDormancy(opTurn.n); st.phase = "interview";
          out.push(say(pair(`Group ${g} added.`, `已添加第 ${g} 组。`)));
          const t = askNext(opTurn.n); if (t) out.push(t); return;
        }
        case "restart": {
          if (!st.pending || st.pending.kind !== "restart" || opt.now() > st.pending.expires) {
            st.pending = { kind: "restart", expires: opt.now() + CONFIRM_MS };
            out.push(say(pair("Start over and forget this interview's answers? Say start over again within 30 seconds to confirm.", "重新开始并清除本次答案？请在 30 秒内再说一次“重新开始”确认。"), { kind: "confirm" }));
            return;
          }
          const keepLong = opt.longTerm; st = freshState(); opt.longTerm = keepLong;
          out.push(say(pair("Started over.", "已重新开始。")));
          const t = askNext(); if (t) out.push(t); return;
        }
        case "stop":
          if (st.phase === "armed") { st.phase = "review"; st.armedUntil = 0; }
          st.pending = null;
          out.push(say(pair("Paused. Your answers are remembered. Say resume or answer the open question to continue.", "已暂停。答案已记录。说“继续”或回答当前问题即可继续。"), { kind: "pause" })); return;
        case "save": out.push(say(pair("Saved: profile draft and decision log.", "已保存：配置草稿和决策记录。"), { kind: "save", event: "save" })); return;
        case "finish": {
          const nq = nextQuestion();
          if (nq) { out.push(say(pair(`${agenda().filter((id) => ctx.fact(id) === undefined).length} questions are still open. Say default to accept defaults one by one, or answer them.`, `仍有 ${agenda().filter((id) => ctx.fact(id) === undefined).length} 个问题未答。`), { kind: "status" })); const t = askNext(opTurn.n); if (t) out.push(t); return; }
          st.phase = "review";
          out.push(say(pair("Read-back: " + readback().map((c) => c.en).join(" "), "复述：" + readback().map((c) => c.zh).join("")), { kind: "review", clauses: readback() }));
          return;
        }
        case "confirmBuild": {
          if (st.phase !== "review") { out.push(say(pair("Not ready. Finish the questions and the read-back first.", "尚未就绪。请先完成问题和复述。"))); return; }
          const v = typeof opt.validate === "function" ? safeValidate() : { errors: [], warnings: [] };
          if (v.errors.length) { out.push(say(pair(`NO-GO. ${v.errors[0]} Say correction and the field.`, `不可执行。${v.errors[0]}`), { kind: "nogo", errors: v.errors })); return; }
          st.phase = "armed"; st.armedUntil = opt.now() + ARM_MS;
          out.push(say(pair(`All groups GO${v.warnings.length ? `, with ${v.warnings.length} caution${v.warnings.length === 1 ? "" : "s"} to acknowledge in the panel` : ""}. ${totalRuns()} run${totalRuns() === 1 ? "" : "s"}. Say launch within 60 seconds, or hold.`, `全部可执行。共 ${totalRuns()} 次运行。请在 60 秒内说“启动”，或说“暂停”。`), { kind: "armed", warnings: v.warnings }));
          return;
        }
        case "launch": {
          if (st.phase !== "armed" || opt.now() > st.armedUntil) { if (st.phase === "armed") st.phase = "review"; out.push(say(pair("Launch refused: not armed. Say confirm build first.", "拒绝启动：未就绪。请先说“确认生成”。"), { kind: "refused" })); return; }
          st.phase = "done";
          out.push(say(pair(`Launching ${totalRuns()} run${totalRuns() === 1 ? "" : "s"}.`, `正在启动 ${totalRuns()} 次运行。`), { kind: "launch", event: "launch", profile: profile() }));
          return;
        }
        case "refuse":
          out.push(say(pair("Unable to comply. Approval and release are laboratory decisions under your SOP. I can build, check and launch a simulated run profile.", "无法执行。批准和放行属于实验室在 SOP 下的决定。我可以生成、检查和启动模拟运行配置。"), { kind: "refuse" }));
          return;
      }
    }
    function safeValidate() { try { const r = opt.validate(profile()) || {}; return { errors: r.errors || [], warnings: r.warnings || [] }; } catch (e) { return { errors: ["validation unavailable: " + e.message], warnings: [] }; } }
    function totalRuns() { let n = 0; for (let g = 1; g <= (ctx.fact("@groups") || 1); g++) n += ctx.fact(`g${g}.repeat`) || 1; return n; }

    /* ---- memory → profile (only live facts; "method"/null mean: leave to template) */
    function generatedProfile() {
      const p = Object.assign(clone(st.baseProfile || {}), { format: "missy-r2-batch/1", name: ctx.fact("@name") || ("Voice profile " + ctx.today()), runs: [], output: {} });
      const groups = ctx.fact("@groups") || 1;
      for (let g = 1; g <= groups; g++) {
        const f = (k) => ctx.fact(`g${g}.${k}`);
        const r = Object.assign(clone(st.baseProfile?.runs?.[g - 1] || {}), { repeat: f("repeat") || 1 });
        const baseTemplate = st.baseProfile?.runs?.[g - 1]?.template;
        if (f("template")) { const selected=schema.templates.find(t=>t.id===f("template"));r.template=selected?.inlineTemplate?clone(selected.inlineTemplate):f("template"); }
        // same rule as the Assisted and Visual editors: a new template drops the previous analysis
        if (st.baseProfile?.runs?.[g - 1] && JSON.stringify(r.template) !== JSON.stringify(baseTemplate) && typeof opt.resetForTemplate === "function") opt.resetForTemplate(r, baseTemplate);
        const ex = f("design.extractions"), rp = f("design.replicates");
        const design = clone(r.design || {});
        if (ex !== undefined) delete design.extractions;
        if (rp !== undefined) delete design.replicates;
        if (isNum(ex) && ex !== 3) design.extractions = ex;
        if (isNum(rp) && rp !== 3) design.replicates = rp;
        if (f("keepControls") === false) {
          const cc = clone(design.controlCounts || {});
          for (const c of CONTROL_CODES) { const v = f("ctl." + c); if (isNum(v)) cc[c] = v; else if (v !== undefined) delete cc[c]; }
          if (Object.keys(cc).length) design.controlCounts = cc; else delete design.controlCounts;
        } else if (f("keepControls") === true) delete design.controlCounts;
        if (Object.keys(design).length) r.design = design; else delete r.design;
        if (f("scenario.arm") === true && f("scenario.id")) r.errorScenario = f("scenario.id"); else if (f("scenario.arm") === false) delete r.errorScenario;
        const secs = f("advanced.sections") || [];
        if (f("advanced") === true) {
          if (secs.includes("seed")) { if (isNum(f("seed"))) r.seed = f("seed"); else if (f("seed") !== undefined) delete r.seed; if (typeof f("naturalVariation") === "boolean") r.naturalVariation = f("naturalVariation"); }
          for (const block of ["dna", "reagents", "mix"]) if (secs.includes(block)) {
            const o = clone(r[block] || {}); for (const row of schema.fields[block] || []) { const v = f(`${block}.${row.k}`); if (v === undefined) continue; if (v !== null && v !== "method") o[row.k] = v; else delete o[row.k]; }
            if (Object.keys(o).length) r[block] = o; else delete r[block];
          }
          if (secs.includes("programme")) {
            const mode = f("programme.mode");
            if (mode === "method") r.programme = "method";
            else if (mode === "custom") { const o = typeof r.programme === "object" ? clone(r.programme) : {}; for (const row of schema.fields.programme || []) { const v = f(`programme.${row.k}`); if (v === undefined) continue; if (v !== null && v !== "method") o[row.k] = v; else delete o[row.k]; } if (Object.keys(o).length) r.programme = o; else delete r.programme; }
            else if (mode === "template") delete r.programme;
          }
          if (secs.includes("samples")) {
            const n = f("samples.count");
            if (Number.isInteger(n) && n >= 1) { const tpl = schema.templates.find((t) => t.id === r.template); r.sampleCount = n; const previous = clone(r.samples || []); r.samples = [previous[0] || {}];
              for (let k = 2; k <= n; k++) { const s = previous[k - 1] || {}; if (f(`sample.${k}.material`)) s.material = f(`sample.${k}.material`); if (f(`sample.${k}.date`)) s.extractionDate = f(`sample.${k}.date`); r.samples.push(s); }
              if (tpl && !r.samples[0].material) delete r.samples[0].material; }
          }
        }
        p.runs.push(r);
      }
      p.output = { openQuality: ctx.fact("out.openQuality") !== false, selectForMissy: ctx.fact("out.selectForMissy") !== false, downloadRdmltZip: ctx.fact("out.downloadRdmltZip") === true };
      return p;
    }

    // Preserve explicit defaults, names and unspoken Administrator options. Only
    // differences made by this interview are overlaid on the shared input draft.
    function applyChanges(base, before, after) {
      if (JSON.stringify(before) === JSON.stringify(after)) return clone(base);
      if (after === undefined) return undefined;
      if (!after || typeof after !== "object" || !before || typeof before !== "object") return clone(after);
      if (Array.isArray(after)) {
        if (!Array.isArray(before) || !Array.isArray(base)) return clone(after);
        return after.map((item, i) => applyChanges(base[i], before[i], item));
      }
      const result = base && typeof base === "object" && !Array.isArray(base) ? clone(base) : {};
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (["__proto__", "constructor", "prototype"].includes(key)) continue;
        const value = applyChanges(base?.[key], before[key], after[key]);
        if (value === undefined) delete result[key]; else result[key] = value;
      }
      return result;
    }
    function profile() {
      const current = generatedProfile();
      const p = st.baseProfile && st.importBaseline ? applyChanges(st.baseProfile, st.importBaseline, current) : current;
      // Reset after reconstruction too: stale sample facts must not reintroduce a
      // material of the previous species after a voice template change.
      if (typeof opt.resetForTemplate === "function") p.runs.forEach((group,i)=>{
        const old=st.baseProfile?.runs?.[i];
        if(old&&JSON.stringify(group.template)!==JSON.stringify(old.template))opt.resetForTemplate(group,old.template);
      });
      p.format = "missy-r2-batch/1"; // never inherited from an imported draft that lacked it
      return p;
    }

    /* ---- deterministic read-back clauses with JSON paths */
    function readback() {
      const cl = [];
      const nm = ctx.fact("@name");
      cl.push({ path: "name", en: `Build profile ${nm || "(name not set)"}.`, zh: `生成配置文件 ${nm || "（未命名）"}。` });
      const groups = ctx.fact("@groups") || 1;
      for (let g = 1; g <= groups; g++) {
        const ids = agenda().filter((id) => id.startsWith(`g${g}.`) && ctx.fact(id) !== undefined && !/^g\d+\.(advanced|advanced\.sections|scenario\.arm|scenario\.category)$/.test(id));
        const parts = ids.map((id) => { const v = ctx.fact(id); return Q(id).readback(v === null ? undefined : v, ctx); });
        cl.push({ path: `runs[${g - 1}]`, en: `Group ${g}: ` + parts.map((p) => plain(p.en).replace(/ \(group \d+\)/, "").replace(/\.$/, "")).join("; ") + ".", zh: `第 ${g} 组：` + parts.map((p) => p.zh.replace(/（第 \d+ 组）/, "")).join("") });
      }
      const o = profile().output;
      cl.push({ path: "output", en: `Output: ${o.openQuality ? "open Quality manager" : "do not open Quality"}; ${o.selectForMissy ? "select for MISSY" : "do not select for MISSY"}${o.downloadRdmltZip ? "; RDMLt ZIP" : ""}.`, zh: `输出：${o.openQuality ? "打开质量管理" : "不打开质量管理"}；${o.selectForMissy ? "为 MISSY 勾选" : "不为 MISSY 勾选"}${o.downloadRdmltZip ? "；RDMLt ZIP" : ""}。` });
      cl.push({ path: "", en: `Total ${totalRuns()} run${totalRuns() === 1 ? "" : "s"}. Artificial data, not a laboratory result.`, zh: `共 ${totalRuns()} 次运行。模拟数据，非实验室结果。` });
      return cl;
    }

    /* ---- decision log (sidecar) and long-term memory */
    function decisionLog() {
      return { format:"missy-r2-json-decisions/1", profile:profile(), changes:clone(st.jsonChanges || []) };
    }
    function longTermUpdate(prev) {
      const lt = prev && prev.format === "missy-r2-voice-longterm/1" ? clone(prev) : { format: "missy-r2-voice-longterm/1", interviews: 0, last: {} };
      lt.interviews++;
      for (const [id, f] of Object.entries(st.facts)) if (!f.dormant && f.value !== undefined && id !== "@name") lt.last[id.replace(/^g\d+\./, "g*.")] = { value: f.value, at: f.at };
      lt.updatedAt = iso(opt.now());
      return lt;
    }


    // Import the shared builder draft. Facts drive supported interview fields;
    // the base retains all other Administrator settings without inventing answers.
    function registerInlineTemplates(profile) {
      (profile?.runs||[]).forEach((run,i)=>{
        if(!run.template||typeof run.template!=="object")return;
        const info=typeof schema.templateInfo==="function"?schema.templateInfo(run.template):{};
        const entry={id:"INLINE-GROUP-"+(i+1),name:run.template.name||"Embedded template "+(i+1),
          crop:info?.crop||run.template.crop,stage:info?.stage||run.template.stage,
          controls:info?.controls||Object.keys(run.design?.controlCounts||{}),maxSamples:info?.maxSamples||28,
          aliases:["embedded group "+(i+1)],inlineTemplate:clone(run.template)};
        const index=schema.templates.findIndex(t=>t.id===entry.id);if(index>=0)schema.templates[index]=entry;else schema.templates.push(entry);
        if(schema.scenarioFor){let cache;Object.defineProperty(schema.applicability,entry.id,{enumerable:true,configurable:true,get:()=>cache||=(schema.scenarioFor(entry.inlineTemplate))});}
      });
    }
    function importProfile(p) {
      if (!p || !Array.isArray(p.runs) || p.runs.length < 1 || p.runs.length > MAX_GROUPS) return false;
      registerInlineTemplates(p);
      const previous = st;
      const previousProfile = JSON.stringify(profile());
      st = freshState(); st.baseProfile = clone(p);
      st.turns = clone(previous.turns); st.facts = clone(previous.facts); st.jsonChanges = clone(previous.jsonChanges || []);
      st.startedAt = previous.startedAt;
      st.importSkipped = [];
      const put = (id, value) => { if (value !== undefined) {
        const q = questionFor(id, schema);
        if (q && !validValue(q, value, ctx)) { delete st.facts[id]; st.importSkipped.push(id); return; } // kept in the shared draft, asked again if needed
        const old = previous.facts[id];
        if (old && JSON.stringify(old.value) === JSON.stringify(value)) { st.facts[id] = clone(old); return; }
        st.facts[id] = {
        value: clone(value), turn: 0, at: iso(opt.now()), via: "memory",
        history: old ?
          [...(old.history || []), { value: old.value }].slice(-200) : [] };
      }
      };
      put("@name", p.name); put("@groups", p.runs.length);
      p.runs.forEach((r, i) => {
        const key = "g" + (i + 1) + ".", set = (id, v) => put(key + id, v);
        set("template", typeof r.template === "string" ? r.template : r.template?"INLINE-GROUP-"+(i+1):undefined);
        set("repeat", r.repeat ?? 1); set("design.extractions", r.design?.extractions ?? 3);
        set("design.replicates", r.design?.replicates ?? 3);
        set("keepControls", !Object.keys(r.design?.controlCounts || {}).length);
        for (const c of CONTROL_CODES) set("ctl." + c, r.design?.controlCounts?.[c] ?? "method");
        const scenario = schema.scenarios.find(x => x.id === r.errorScenario);
        if(r.errorScenario&&!scenario){for(const k of ["scenario.arm","scenario.category","scenario.id"])delete st.facts[key+k];st.importSkipped.push(key+"scenario.id");}
        else{set("scenario.arm", !!scenario); set("scenario.category", scenario?.category); set("scenario.id", scenario?.id);}
        const secs = ["dna", "reagents", "mix", "programme"].filter(k => r[k] !== undefined);
        if (r.seed !== undefined || r.naturalVariation !== undefined) secs.push("seed");
        if (r.samples || r.sampleCount) secs.push("samples");
        set("advanced", secs.length > 0); set("advanced.sections", secs);
        set("seed", r.seed ?? null); set("naturalVariation", r.naturalVariation ?? true);
        for (const area of ["dna", "reagents", "mix", "programme"])
          for (const row of schema.fields[area] || []) set(area + "." + row.k, r[area]?.[row.k] ?? "method");
        set("programme.mode", typeof r.programme === "object" ? "custom" : r.programme === "method" ? "method" : "template");
        set("samples.count", r.samples?.length || r.sampleCount || 1);
        (r.samples || []).forEach((s, n) => { set("sample." + (n + 1) + ".material", s.material);
          set("sample." + (n + 1) + ".date", s.extractionDate); });
      });
      for (const k of ["openQuality", "selectForMissy", "downloadRdmltZip"]) put("out." + k, p.output?.[k] ?? (k !== "downloadRdmltZip"));
      refreshDormancy(); st.importBaseline = generatedProfile(); st.phase = nextQuestion() ? "interview" : "review";
      if (JSON.stringify(profile()) !== previousProfile) {
        st.jsonChanges.push({at:iso(opt.now()),profile:profile()});
        if (st.jsonChanges.length > 200) st.jsonChanges.shift();
      }
      if (previous.turns.length) say(pair("Shared builder settings imported. Earlier conversation and changed decisions are retained.", "已导入共享编辑器设置。先前对话及已更改的决策均已保留。"), {kind:"import"});
      if (st.importSkipped.length) say(pair(`${st.importSkipped.length} imported setting${st.importSkipped.length === 1 ? " is" : "s are"} outside the voice question range and stay as set in the shared draft: ${st.importSkipped.map(shortName).join(", ")}.`, `${st.importSkipped.length} 项导入设置超出语音问题范围，保持共享草稿中的设置：${st.importSkipped.map(shortName).join("、")}。`), {kind:"dormant", ids: st.importSkipped.slice()});
      st.cursor = nextQuestion(); return true;
    }

    /* ---- persistence */
    function validValue(q, v, candidate) {
      try {
        if (v === null || (v === "method" && q.allowMethod)) return true;
        if (q.kind === "number") return isNum(v) && v >= q.min && v <= (q.limit ? q.limit(candidate) : q.max) && (!q.integer || Number.isInteger(v));
        if (q.kind === "bool") return typeof v === "boolean";
        if (q.kind === "text") return typeof v === "string" && v.length <= 100;
        if (q.kind === "date") return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !!parseDate(v, opt.now());
        if (q.kind === "choice") return q.options(candidate).some(o => o.value === v);
        if (q.kind === "multi") return Array.isArray(v) && v.length <= 10 && v.every(value => q.options(candidate).some(o => o.value === value));
        return false;
      } catch (e) { return false; }
    }
    function cleanState(state) {
      const s = clone(state); s.turns=[];s.lastInput=null;s.pending=null;s.undo=[];
      s.jsonChanges=(s.jsonChanges||[]).filter(x=>x?.profile?.format==="missy-r2-batch/1"&&Array.isArray(x.profile.runs))
        .slice(-200).map(x=>({at:x.at,profile:x.profile}));
      for (const f of Object.values(s.facts || {})) {
        delete f.heard;delete f.reason;delete f.via;
        f.history=(f.history||[]).map(h=>({value:h.value}));
      }
      return s;
    }
    function save() { return JSON.stringify(cleanState(st)); }
    function load(json) {
      try {
        const s = typeof json === "string" ? JSON.parse(json) : clone(json);
        if (!s || s.schema !== MEMORY_SCHEMA || typeof s.facts !== "object" || !Array.isArray(s.turns)) return false;
        if (!s.facts || Array.isArray(s.facts) || Object.keys(s.facts).length > 5000 || s.turns.length > MAX_TURNS) return false;
        registerInlineTemplates(s.baseProfile);
        const candidate = { fact: id => s.facts[id] && !s.facts[id].dormant ? s.facts[id].value : undefined,
          today: ctx.today };
        // An out-of-range value drops only that answer (it is asked again); the rest of the
        // saved interview is kept instead of losing the whole draft.
        if (s.facts["@groups"] && !validValue(questionFor("@groups",schema),s.facts["@groups"].value,candidate)) return false;
        s.droppedOnLoad = [];
        for (const [id, fact] of Object.entries(s.facts)) {
          const q = questionFor(id, schema); if (!q || !fact || !("value" in fact)) continue;
          if (!validValue(q, fact.value, candidate)) { delete s.facts[id]; s.droppedOnLoad.push(id); }
        }
        if (!s.turns.every(t => t && typeof t.text === "string" && t.text.length < 100000 && ["missy", "operator"].includes(t.role))) return false;
        if (s.baseProfile && (!Array.isArray(s.baseProfile.runs) || s.baseProfile.runs.length > MAX_GROUPS)) return false;
        for (const [id, f] of Object.entries(s.facts)) { const q = questionFor(id, schema); if (!q || !f || !("value" in f)) delete s.facts[id]; }
        st = Object.assign(freshState(), cleanState(s));
        if (!["interview", "review"].includes(st.phase)) st.phase = "review"; // an arm never survives a reload
        st.armedUntil = 0; st.pending = null; st.lastInput = null;
        if (s.droppedOnLoad.length && nextQuestion()) st.phase = "interview";
        return true;
      } catch (e) { return false; }
    }
    function resume() {
      const out = [];
      if (st.phase === "interview") { const id = nextQuestion(); out.push(say(pair(`Resuming. ${progress().answered} answers remembered.`, `继续访谈。已记录 ${progress().answered} 个答案。`), { kind: "resume" })); const t = askNext(); if (t) out.push(t); }
      else out.push(say(pair("Resuming in review. Say read back or confirm build.", "在复述阶段继续。请说“复述”或“确认生成”。"), { kind: "review" }));
      return out;
    }

    function start() { const t = say(pair("Acknowledged. New run profile. I will ask questions and keep accepted JSON settings only. Say back, say again, where am I, what did I say for a field, change a field to a value, same as group one, undo, or stop at any time.", "收到。新运行配置文件。我会提问，仅保留已接受的 JSON 设置。随时可说：返回、再说一遍、进度、某字段我说了什么、将某字段改为某值、和第一组一样、撤销、停止。"), { kind: "brief" }); const q = askNext(t.n); return q ? [t, q] : [t]; }

    return {
      start, handle, resume, save, load, importProfile, profile, readback, decisionLog, longTermUpdate, agenda, progress,
      get state() { return st; }, get schema() { return schema; },
      questionSpec: () => { if(!st.cursor)return null;const q = Q(st.cursor); if (!q) return null; const value = q.def ? q.def(ctx) : undefined;
        return { kind:q.kind, min:q.min, max:q.limit ? q.limit(ctx) : q.max, step:q.step, integer:!!q.integer,
          hasDefault:!!q.def, defaultValue:value, allowMethod:!!q.allowMethod,
          options:q.options ? q.options(ctx).map((o,i)=>({n:i+1,value:o.value,label:o.label})) : [] }; },
      grammarFor: (id) => { const q = Q(id || st.cursor); if (!q) return []; const w = ["default", "back", "say again", "list options", "undo", "where am i", "[unk]"];
        if (q.kind === "number") for (let n = q.min; n <= Math.min(q.max, 200); n += 1) w.push(String(n));
        if (q.kind === "bool") w.push("yes", "no", "affirmative", "negative");
        if (q.options) q.options(ctx).forEach((o, i) => { w.push("option " + (i + 1)); (o.aliases || []).forEach((a) => a && w.push(a)); });
        if (q.allowMethod) w.push("method"); return w; },
    };
  }

  root.MissyVoiceInterview = { create, parseNumber, parseDate, normalize, ENGINE_VERSION, SCRIPT_ID };
})(typeof window !== "undefined" ? window : globalThis);
