Object.assign(window.R2_WORKBENCH_ZH, Object.fromEntries(`
Project and formats|项目与文件格式
Methods and databases|方法与数据库
Scientific articles|科学文献
Code, examples and independent reimplementations|代码、示例及独立实现
Bundled libraries and fonts|内置程序库与字体
Metadata and provenance references|元数据与溯源参考
Assay validation publications|检测方法验证文献
Start from|从以下配置开始
Preparing local RDMLt experiment files…|正在准备本地 RDMLt 实验文件…
Sending the selected RDMLt files to MISSY…|正在向 MISSY 发送所选 RDMLt 文件…
A required workbench file could not be loaded. Reload the page or extract the complete download.|无法加载必需的工作台文件。请重新加载页面，或完整解压下载包。
Built-in|内置
Saved|已保存
on|开
Lot A|批次 A
Lot B|批次 B
Sources and credits · VIRTUALPCR/MISSYR2|来源与致谢 · VIRTUALPCR/MISSYR2
Sources, code and reading|来源、代码与参考资料
Project source|项目源代码
Model implementation|模型实现
Primary method records|原始方法记录
Articles and books|文章与书籍
Development data and local records|开发数据与本地记录
Virtual control-chart histories|虚拟控制图历史记录
Books and other supplied assets|书籍及其他提供的素材
Instrument-export summary statistics and fitted curve profiles|仪器导出数据的汇总统计及拟合曲线
View source|查看源代码
Back to workbench|返回工作台
← Back to workbench|← 返回工作台
Each assay is analysed on its own tubes and its own detection channel, with its own threshold. You can also drag the pink line in the amplification chart. Every change re-runs the analysis on the same raw record.|每种检测方法使用各自的反应管、检测通道和阈值分析。也可拖动扩增图中的粉色阈值线。修改设置后，使用同一原始记录重新分析。
Diamonds mark each Cq. Point at a curve or a tube to single it out; click a tube to hide or show it.|菱形标记各 Cq。将指针悬停在曲线或反应管上可突出显示，单击反应管可隐藏或显示曲线。
Native scenarios change only the inputs of one run (reagents, programme, plan, instrument instance). Injected scenarios transform the raw readings after acquisition, where the model has no physics for the error. Both are labelled in the run and in its RDMLt (|模型场景仅改变一次运行的输入（试剂、程序、方案或仪器实例）。当模型未包含相应故障机理时，注入场景在采集后修改原始读数。两者都会在运行及 RDMLt 中明确标记（
Calculator idea from PCR-Calculator (S. Gil): reactions, excess, 2× or 5× mix, rounded totals, copyable report. Here the volumes come from the EURL method records of the plate.|计算器设计参考 PCR-Calculator（S. Gil）：反应数量、余量、2× 或 5× 预混液、总量取整和可复制报告。本页的体积来自板上相应方法的 EURL 记录。
Reads OpticalCyclerB / CompactCycler results exports (Auto-qPCR examples), sample–group–gene–Cq tables (Click-qPCR), efficiency/Ct pairs (rtpcr), qPCR plate planner JSON, and curve tables with the cycle in the first column. Files stay in this browser.|可读取 OpticalCyclerB / CompactCycler 结果导出文件（Auto-qPCR 示例）、样品–组别–基因–Cq 表（Click-qPCR）、效率/Ct 配对（rtpcr）、qPCR 板布局 JSON，以及首列为循环数的曲线表。文件仅保留在本机浏览器中。
PC at LOD Cq 29–36; reference gene 20–27; negative ≥ 40|检出限水平阳性对照 Cq 29–36；内参 20–27；阴性 ≥40
PC at LOD mean Cq 29–36 (both tubes); reference gene 20–27; negative from Cq 40; Cq method sdm|检出限阳性对照平均 Cq 29–36（两管）；内参 20–27；自 Cq 40 起按阴性处理；Cq 算法 sdm
slope −3.1 to −3.6, R² ≥ 0.98 (ENGL minimum performance requirements)|斜率 −3.1 至 −3.6，R² ≥0.98（ENGL 最低性能要求）
run SD 0.41, extraction SD 0.2, tube SD 0.15 cycles|运行间 SD 0.41、提取间 SD 0.2、管间 SD 0.15 个循环
Select a run|选择运行
Show|显示
All|全部
SOP file|SOP 文件
Download SOP JSON|下载 SOP JSON
Download RDMLt|下载 RDMLt
Export|导出
Preview|预览
File|文件
Files|文件
Group|组
Settings|设置
Warnings|警告
Errors|错误
Check settings|检查设置
Ready to generate|可以生成
Generate|生成
No errors.|未发现错误。
Copies|拷贝数
GM content per extraction|各提取物的转基因含量
Assay controls|检测对照
Full screen|全屏
Leave full screen|退出全屏
Leave full-screen|退出全屏
Return to bench|返回工作台
Stop run|停止运行
Stop|停止
Acquisition|采集
Control channels|对照通道
Instrument time (s) · last 180 s · shading marks detector reads|仪器时间（秒）· 最近 180 秒 · 阴影标示检测器采集
channel 1: FAM, SYBR Green|通道 1：FAM、SYBR Green
channel 2: VIC, HEX, Yakima Yellow|通道 2：VIC、HEX、Yakima Yellow
`.trim().split("\n").map(row => { const i = row.indexOf("|"); return [row.slice(0, i), row.slice(i + 1)]; })));
window.R2_ZH_PATTERNS.push(
  [/^([^·]+?) at ([\d.]+) % \(simulated\)$/, "$1，含量 $2 %（模拟）"],
  [/^Preparing RDMLt (\d+) of (\d+) · (.+)$/, "正在准备 RDMLt $1 / $2 · $3"],
  [/^about ([\d,]+) genome copies \(([\d,]+) amplifiable in this model\)$/, "约 $1 个基因组拷贝（本模型中约 $2 个可扩增）"],
  [/^(MARA-[\w-]+) · (.+) · (\d+) cycles, (.+)$/, "$1 · $2 · $3 个循环，$4"],
  [/^Standard 17 published target LOD: (.+)$/, "标准 17 已公布的靶标检出限：$1"],
  [/^sample DNA extracts \(one per sub-sample\): (\d+) extracts, (\d+) wells each$/, "样品 DNA 提取液（每个子样一份）：$1 份提取液，每份用于 $2 孔"],
  [/^positive control: (.+)$/, "阳性对照：$1"],
  [/^negative control: (.+)$/, "阴性对照：$1"],
  [/^(\d+) tubes \((.+)\) · prepare for (.+) reactions · (.+) per reaction$/, "$1 管（$2）· 按 $3 个反应配制 · 每反应 $4"],
  [/^Dispense (.+) of mix into each tube, then (.+) of template\.$/, "向每管分装 $1 反应液，再加入 $2 模板。"],
  [/^(.+) \+ (.+) template$/, "$1 + $2 模板"],
  [/^(.+) \(method: (.+)\)(.*)$/, "$1（方法默认值：$2）$3"],
  [/^primers (.+), probe (.+); (.+)$/, "引物 $1，探针 $2；$3"],
  [/^(MARA-[\w-]+); primers (.+), probe (.+); (.+)$/, "$1；引物 $2，探针 $3；$4"],
  [/^primer Tm (.+); probe binds at about (.+); 3′ pairing between primers (\d+) bases$/, "引物 Tm $1；探针结合温度约 $2；引物间 3′ 端配对 $3 个碱基"],
  [/^• Primers (.+) \(Tm (.+)\)\.$/, "• 引物 $1（Tm $2）。"],
  [/^• Probe (.+), (.+), binds at about (.+): about (.+) of new strands pick up a probe at (.+)\.$/, "• 探针 $1，$2，结合温度约 $3：在 $5 时约 $4 的新生链可结合探针。"],
  [/^• Expected baseline (.+) counts \((.+) × the method's\), highest possible rise (.+) counts \((.+) ×\)\.$/, "• 预期基线 $1 计数（方法默认值的 $2 倍）；最大可能增幅 $3 计数（$4 倍）。"],
  [/^(.+) · (.+) instrument time$/, "$1 · 仪器时间 $2"],
  [/^(\d+) cycles, (.+) · (\d+) min$/, "$1 个循环，$2 · $3 分钟"],
  [/^(\d+) \((.+)\), each (\d+) extractions × (\d+) PCR replicates; (.+) per well$/, "$1 个样品（$2），每个 $3 次提取 × $4 个 PCR 重复；每孔 $5"],
  [/^Guided runs on this browser: (\d+)\. Variation applies to the next run and is stored in templates saved afterwards\.$/, "本浏览器的引导运行数：$1。变异设置应用于下一次运行，并保存在之后保存的模板中。"],
  [/^Sample names are assigned at start: a random six-digit prefix unique to this run, the sample number and the DNA extraction date \((.+)\)\.$/, "样品名称在开始时分配：本次运行唯一的六位随机前缀、样品编号和 DNA 提取日期（$1）。"],
  [/^(\d+) run\(s\) loaded in the MISSY Control Panel\.$/, "已在 MISSY 控制面板加载 $1 次运行。"],
  [/^Each sample uses (\d+) wells per reaction mix\. Control overrides are counts per applicable mix \(simplex reference-gene mixes have no run controls\); calibrants use this count at every existing level\. Unticked controls retain the template\. Zero deliberately omits that control; original method acceptance rules are not relaxed\.$/, "每个样品每种反应液使用 $1 个孔。对照数量覆盖仅作用于适用的反应液（单重内参基因反应液无运行对照）；校准品在每个既定浓度水平使用该数量。未勾选时保留模板值。0 表示故意省略对照，原方法接受规则仍然适用。"],
  [/^Each sample: (\d+) independent extractions × (\d+) PCR replicates per mix\. Controls are shared per run and mix\. Each mix starts on a new row\.$/, "每个样品每种反应液：$1 次独立提取 × $2 个 PCR 重复。对照按运行和反应液共享。每种反应液从新的一行开始。"],
  [/^at most (\d+) with the mixes of this analysis \(384 wells\)$/, "按本分析反应液配置，最多 $1 个样品（384 孔）"],
  [/^at most (\d+) with these mixes · each sample: (\d+) extracts × (\d+) PCR replicates$/, "按当前反应液最多 $1 个样品；每个样品：$2 次提取 × $3 个 PCR 重复"],
  [/^(\d+) of at most (\d+) with these mixes$/, "当前 $1 个样品；按此配置最多 $2 个"],
  [/^(\d+) of at most (\d+) · (\d+) of 384 wells$/, "$1 / $2 个样品 · 已用 $3 / 384 孔"],
  [/^(\d+) of 384 wells$/, "已用 $1 / 384 孔"],
  [/^(\d+) of 384, rows (.+)$/, "已用 $1 / 384 孔，行 $2"],
  [/^(\d+) saved in this browser$/, "本浏览器已保存 $1 个"],
  [/^(\d+) SOPs, (\d+) runs$/, "$1 个 SOP，$2 次运行"],
  [/^Group (\d+) on the bench$/, "工作台中的第 $1 组"],
  [/^(\d+) (?:file|files)$/, "$1 个文件"],
  [/^(\d+) (?:run|runs)$/, "$1 次运行"],
  [/^(\d+) instrument minutes$/, "$1 分钟仪器时间"],
  [/^Built-in · (.+)$/, (_, name) => "内置 · " + (window.R2_WORKBENCH_ZH[name] || name)],
  [/^forward primer (.+)$/, "正向引物 $1"],
  [/^reverse primer (.+)$/, "反向引物 $1"],
  [/^probe (.+)$/, "探针 $1"],
  [/^from (MARA-.+)$/, "来自 $1"],
  [/^sample (\d+) \((.+)\), extraction E(\d+), PCR replicate (\d+), (.+)$/, "样品 $1（$2），提取物 E$3，PCR 重复 $4，$5"],
  [/^Includes Lectin \(soybean\) and shared controls\. (\d+) samples fit\.$/, "包含大豆凝集素内参及共享对照。可容纳 $1 个样品。"],
  [/^Instrument time (.+)\. On screen: one second per cycle, about (\d+) s in all\.$/, "仪器时间 $1。屏幕播放速度为每循环一秒，总计约 $2 秒。"],
  [/^GM content withheld: quantification requires exactly three extractions, each with at least three PCR replicates; this design has (\d+) extractions? × (\d+) PCR replicates?\.$/, "暂不报告转基因含量：定量要求恰好三次提取，每次至少三个 PCR 重复；本设计为 $1 次提取 × $2 个 PCR 重复。"],
  [/^Custom design \((\d+) extractions? × (\d+) PCR replicates?\) differs from the published 3 × 3( rapid-screen)? (?:method|design)\. Review all raw wells; the fixed-method interpretation was not applied\.$/, "自定义设计（$1 次提取 × $2 个 PCR 重复）不同于原方法的 3 × 3 设计。请审核所有原始孔数据；未应用固定方法的解释规则。"],
);
