Object.assign(window.R2_WORKBENCH_ZH, Object.fromEntries(`
This is the offline copy. Website downloads are available from the live site.|这是离线副本。如需下载网站，请访问在线版本。
← Choose role|← 选择角色
PREPARE → CHECK → ACQUIRE|准备 → 核查 → 采集
Prepare a batch on the virtual 384-well plate. Set the independent extraction and PCR replicate counts on the Sample step. Choose the analysis procedure on the Analysis step.|在虚拟 384 孔板上准备一批样品。在“样品”步骤设置独立提取次数和 PCR 重复数，在“分析步骤”选择分析规程。
P-35S, T-nos and Le1, simplex. Soybean meal A. PC at LOD, positive sample, NTC and extraction blank for the run.|P-35S、T-nos 和 Le1 单重检测；样品为大豆粉 A。设置检出限水平的阳性对照、阳性样品、NTC 和提取空白。
P-35S, T-nos and hmgA, simplex. Maize flour E (non-GM): expect no GM element.|P-35S、T-nos 和 hmgA 单重检测；样品为非转基因玉米粉 E，预期不含转基因元件。
P-35S and T-nos rapid screen on soybean meal A.|对大豆粉 A 进行 P-35S 和 T-nos 快速筛查。
Event 40-3-2 with lectin, calibrants on the plate; GM content per sample.|以凝集素基因为内参检测 40-3-2 转化事件；板上设置校准品，计算各样品的转基因含量。
four steps|四步操作
Species, step, assays, DNA per reaction, reagents, programme and reaction mixes come from the template.|物种、步骤、检测方法、每反应 DNA 量、试剂、程序和反应液均由模板提供。
Samples →|样品 →
Reaction mixes|反应液
Extraction and PCR replication design|DNA 提取与 PCR 重复设计
Independent DNA extractions per sample|每个样品的独立 DNA 提取次数
These are separate counts. Plate capacity is recalculated for every reaction mix. Configure run controls on the Plate step. Published-method acceptance rules still apply to altered designs.|这两个数量相互独立。系统按各反应液重新计算板容量。在“反应板”步骤配置运行对照。修改设计后仍适用原方法的接受规则。
Start from template|从模板开始
Start new analysis|开始新分析
Download template|下载模板
Delete template|删除模板
Import template (.json, OpticalCyclerA .ixo)|导入模板（.json、OpticalCyclerA .ixo）
A template sets species, step, assays, DNA per reaction, reagents, programme and reaction mixes. Save one after a run on the Run step.|模板设置物种、步骤、检测方法、每反应 DNA 量、试剂、程序及反应液。运行后可在“运行”步骤保存模板。
Which sample is on the bench|工作台上的样品
Simulated material of sample 1|样品 1 的模拟材料
Species|物种
Soybean (Glycine max)|大豆（Glycine max）
Maize (Zea mays)|玉米（Zea mays）
Genome copies|基因组拷贝数
about 885 per ng DNA (assumed)|约 885 拷贝/ng DNA（假设值）
GM content|转基因含量
set below, in % of genome copies|在下方设置，以基因组拷贝百分比表示
Seed|随机种子
decides the blind sample and the reagent model's draws|决定盲样和试剂模型的随机取值
Natural variation between tubes and between runs|反应管之间和运行之间的自然变异
(normalized extract SD 0.06 cycles, PCR well SD 0.07 cycles, run SD 0.41 cycles). Off: same seed, same tubes, every run.|（归一化提取物 SD 0.06 个循环、PCR 孔 SD 0.07 个循环、运行间 SD 0.41 个循环）。关闭时，相同种子在每次运行中产生相同反应管结果。
DNA extract|DNA 提取物
DNA extract, diluted to|DNA 提取物稀释至
Template per reaction|每反应模板量
DNA per reaction:|每反应 DNA 量：
ng. The real runs this bench was fitted to used 5 µL at 40 ng/µL = 200 ng; calibrants and controls follow the same amount.|ng。本工作台拟合所用的实际运行使用 5 µL、40 ng/µL 的 DNA，即 200 ng；校准品和对照使用相同量。
Mean DNA fragment|平均 DNA 片段长度
processed food: 150 to 300 bp|加工食品：150–300 bp
Inhibitor carry-over|抑制物残留
0 = clean extract|0 = 洁净提取物
GM events in the sample|样品中的转基因转化事件
Samples in this run|本次运行的样品
Import sample names…|导入样品名称…
Each sample uses the extraction and PCR replicate counts selected above; the method default is three extractions with three replicates each. Names are|每个样品采用上方选择的提取次数和 PCR 重复数；方法默认为三次提取、每次三个 PCR 重复。名称格式为
: a random six-digit prefix drawn at run start and unique to the run, the sample number and the DNA extraction date, so that samples of independent runs never share a name.|：运行开始时生成的本次运行唯一六位随机前缀、样品编号和 DNA 提取日期，避免不同运行的样品重名。
Name at run start|运行开始时的名称
Simulated material|模拟材料
Sample name (optional)|样品名称（可选）
Soybean meal A|大豆粉 A
Maize flour E|玉米粉 E
(set above)|（在上方设置）
What do you want to know|希望了解什么
Screen only the selected markers. Standard 17 gives a published target LOD of 1 %. A marker result can guide event-specific identification.|仅筛查所选标记。标准 17 的已公布靶标检出限为 1%。标记结果可指导转化事件特异性鉴定。
Normal order: screening, then identification of the events the screening leaves possible, then quantification of each event found.|通常先筛查，再鉴定筛查后仍可能存在的转化事件，最后对检出的事件逐一定量。
Assays for this run|本次运行的检测方法
Run-control configuration|运行对照配置
Blank keeps the method default; 0 omits that control. Counts apply only to mixes that have procedure controls, and per level for calibrants. Simplex reference-gene mixes remain unchanged. LOD and positive-sample overrides apply only where the template provides them. Missing required controls remain an acceptance failure.|留空保留方法默认值，0 表示不设置该对照。数量只适用于原规程设有对照的反应液；校准品按每个浓度水平计算。单重内参基因反应液保持不变。LOD 和阳性样品覆盖仅用于模板原有的相应对照。缺少必需对照仍会导致运行不通过。
Non-GM control|非转基因对照
Positive control at LOD|检出限水平阳性对照
Positive sample|阳性样品
Replicates per calibrant level|每个校准浓度水平的重复数
Restore method control counts|恢复方法默认对照数量
384 wells, 16 rows × 24 columns|384 孔，16 行 × 24 列
Sample (number = sample 1…n)|样品（数字 = 样品 1…n）
PC · positive controls|PC · 阳性对照
NTC · NTC and extraction blank|NTC · 无模板对照和提取空白
Cal · calibrant|Cal · 校准品
Standard 17 Annex A fluorescence subset on the virtual 384-well instrument. Published target LOD 1%. The run screens only the chosen targets.|在虚拟 384 孔仪器上使用标准 17 附录 A 的荧光检测子集。已公布靶标检出限为 1%。本次运行仅筛查所选靶标。
Wells used|已用反应孔
sample|样品
Lectin (soybean)|凝集素基因（大豆）
LE1 (soybean)|LE1（大豆）
Key|编号
FAM (channel 1)|FAM（通道 1）
Control and calibrant DNA extraction|对照及校准品的 DNA 提取
Optional local date and time for each material. Reused for matching material in later runs in this tab.|可为各材料填写本地提取日期和时间。本标签页后续运行中，相同材料将复用该信息。
Simulated rapid-screen target material|模拟快速筛查靶标材料
Non-GM soybean genomic DNA|非转基因大豆基因组 DNA
Method|方法
Oligo|寡核苷酸
Sequence 5′→3′|序列 5′→3′
Forward|正向
Reverse|反向
Probe|探针
Conditions and performance from the record|方法记录中的条件与性能
Concentrations|浓度
Cycling|温度循环
Amplicon|扩增子
Reported limits|已报告的限值
Computed on this bench|本工作台计算值
Record|记录
The record identifies the source for each assay.|方法记录列明各检测方法的来源。
Calculator settings|计算器设置
Reaction volume|反应体积
Excess|余量
Extra reactions|额外反应数
Round up to|向上取整至
Primer stocks|引物储备液
Probe stocks|探针储备液
Smallest pipetted volume|最小移液体积
Sample extract measured at|样品提取物实测浓度
Certified-material extract|有证标准物质提取液
Empty reaction volume: each mix uses the volume of its method record. Final concentrations follow the record, times the factors set on the Primers and probe step.|反应体积留空时，各反应液采用方法记录中的体积。终浓度等于方法记录值乘以“引物与探针”步骤中设置的倍数。
Copy recipe|复制配方
Download .txt|下载 .txt
Download .csv|下载 .csv
Checks|核查
fits|符合
Every mix fits its reaction volume and every total can be pipetted.|各反应液符合反应体积要求，总配制量均可移取。
DNA solutions for this plate|本板所需 DNA 溶液
Prepare µL|配制体积 µL
water (no-template control)|水（无模板对照）
Programme for these mixes|这些反应液的运行程序
Component|组分
Stock|储备液
Final|终浓度
Per reaction µL|每反应 µL
Mix total µL|总配制量 µL
2× master mix|2× 预混液
nuclease-free water|无核酸酶水
to volume|补足体积
Total|总计
multiples of the method's value, for every assay on the plate|本板各检测方法相对于方法默认值的倍数
Forward primer ×|正向引物 ×
Reverse primer ×|反向引物 ×
Probe ×|探针 ×
Forward primer|正向引物
Reverse primer|反向引物
Probe chemistry|探针化学体系
Back to the method's values|恢复方法默认值
What the settings do to P-35S|设置对 P-35S 的影响
The assay shown is the one chosen on the Method record tab. Change one thing, run, and compare the runs on the quality bench.|此处显示“方法记录”标签中选定的检测方法。每次改变一个因素、运行实验，再到质量审核工作台比较运行。
Probe stored at|探针储存温度
for|持续
months|月
Probe in room light|探针室内光暴露时间
Freeze–thaw cycles|冻融次数
Primers stored at|引物储存温度
Master mix stored at|预混液储存温度
On the bench and in the room|实验台及室内条件
hot-start polymerase|热启动聚合酶
Plate waits|反应板等待时间
min|分钟
Room|室温
Amplicon carry-over|扩增子携带污染
copies per tube|拷贝/管
UNG active in the mix|反应液中 UNG 有活性
Pipetting scatter|移液离散程度
Extra inhibitor in the sample|样品中额外的抑制物
Fresh reagents, method conditions|新鲜试剂与方法标准条件
Half-lives, bleaching times and the other magnitudes are teaching assumptions of this bench, not properties of any product.|半衰期、光漂白时间及其他数值均为本工作台的教学假设，不代表任何产品性能。
Cycling programme|温度循环程序
UNG step at 50 °C|50 °C UNG 步骤
Activation at 95 °C|95 °C 活化
Denature 95 °C|95 °C 变性
Anneal/extend|退火/延伸
Extra 72 °C step|额外 72 °C 步骤
Melt curve 65 → 95 °C (SYBR Green assays)|65 → 95 °C 熔解曲线（SYBR Green 检测）
Take the programme from the method record again|重新采用方法记录中的程序
All methods on this plate ask for the same programme.|本板所有方法要求相同的程序。
Planned temperature profile|计划温度曲线
instrument minutes|仪器时间（分钟）
block temperature (°C)|模块温度（°C）
Stages|阶段
Stage|阶段
Repeats|重复次数
Steps|步骤
Ready to run|准备运行
Step|步骤
Reagents and handling|试剂与操作
as the method records state|按方法记录设置
none (set up by hand)|无（手动设置）
Runs so far|已有运行
Run…|运行…
You are asked for an experiment name; the run gets the next number. The display then fills the screen and plays the run at one second per cycle.|输入实验名称后，系统按顺序分配运行编号。随后全屏显示运行过程，每个循环播放一秒。
No saved templates yet.|尚无保存的模板。
Download all saved templates (.json)|下载所有已保存模板（.json）
Built-in templates cannot be deleted. Import is on step 1 of the full bench.|内置模板不可删除。可在完整工作台的第 1 步导入模板。
Procedures and natural variation|规程与自然变异
Acceptance|接受条件
Simplex screening for P-35S and T-nos|P-35S 与 T-nos 单重筛查
Natural run-to-run variation (fitted to the real runs; off gives the model's mean values)|运行间自然变异（由实际运行拟合；关闭时使用模型均值）
51 catalogue entries · 48 armable|51 个目录条目 · 48 个可启用场景
Scenario|场景
No scenario armed: the next run is normal.|未启用场景：下一次运行正常进行。
Quality manager bench|质量管理员工作台
Review the run as recorded: controls first, then the sample. Every result names the settings that produced it; the raw record stays available beside it.|按原始记录审核运行：先检查对照，再检查样品。每个结果标明所用设置，并保留对应的原始记录。
Open your experiment files and use MISSY’s normal analysis tools. Check the virtual runs you want to open. MISSY loads them automatically and opens the Control Panel.|打开实验文件并使用 MISSY 的常规分析工具。勾选希望打开的虚拟运行，MISSY 将自动加载并打开控制面板。
Virtual runs|虚拟运行
No filed virtual runs.|尚无归档的虚拟运行。
SOP registry|SOP 登记表
Run names|运行名称
No run filed yet.|尚未归档运行。
One SOP per analysis: the identity is the SHA-256 of the analysis definition (layout rule, not well positions or sample count). Bulk downloads are in the run files panel below.|每种分析对应一个 SOP，其身份为分析定义（布局规则，而非具体孔位或样品数）的 SHA-256。可在下方运行文件面板批量下载。
Acceptance rules in use|当前接受规则
read only|只读
Simplex screening|单重筛查
Calibration curves|标准曲线
Natural variation of the training cases|训练案例的自然变异
Download training records (.json)|下载训练记录（.json）
Reset quality case scores|重置质量案例分数
Run files|运行文件
none yet|暂无
Order|顺序
Download all run files (.zip)|下载所有运行文件（.zip）
Download all RDMLt (.zip)|下载所有 RDMLt（.zip）
Download the SOPs, one per analysis (.zip)|下载所有 SOP（每种分析一份，.zip）
No run yet. Run one on the technician bench, or add an example run.|尚无运行。请在技术员工作台运行实验，或添加示例运行。
Every run started on the technician bench is filed here under its number and name. Runs of the same analysis share one SOP (same identity, same file). The list lives in this browser tab: download what you want to keep before you close it.|技术员工作台启动的每次运行均按编号和名称归档于此。同一种分析的运行共用一个 SOP（相同身份和文件）。列表保存在当前浏览器标签页内，关闭前请下载需要保留的内容。
Imported and example data|导入数据与示例数据
Import data (.csv, .json, .rdmlt)|导入数据（.csv、.json、.rdmlt）
Example|示例
Download all imported analyses (.zip)|下载所有导入分析（.zip）
Nothing imported yet. Load an example or import a file.|尚无导入内容。请加载示例或导入文件。
TECHNICIAN ADMINISTRATOR OPTIONS · JSON|技术员管理员选项 · JSON
Build a JSON run profile|创建 JSON 运行配置
After the runs|运行后
open the Quality manager|打开质量管理员
tick the new runs for MISSY|勾选新运行以供 MISSY 加载
download their RDMLt files (.zip)|下载对应的 RDMLt 文件（.zip）
1. Configuration 1|1. 配置 1
1 file|1 个文件
Baseline|基准配置
+ Add group|+ 添加运行组
Duplicate|复制
Remove|移除
Name of the run|运行名称
Placeholders: {i} repeat, {n} position in the batch, {group}, {seed}, {material}, {stage}|占位符：{i} 组内重复编号、{n} 批次内编号、{group}、{seed}、{material}、{stage}
Repeat this group|此组运行次数
runs|次运行
Seed step between repeats|各次重复的种子增量
0 = same seed; runs still differ by natural variation|0 = 使用相同种子；仍可因自然变异产生差异
Natural variation between tubes and runs|反应管和运行间的自然变异
as the template (default on)|按模板（默认开启）
off: same seed, same tubes, every run|关闭：相同种子在每次运行中产生相同反应管结果
No template: material, step and procedure below|不使用模板：在下方设置材料、步骤和规程
as the template|按模板
as the template / step default|按模板或步骤默认值
Rapid fluorescence screening|快速荧光筛查
Duplex marker screening|双重标记筛查
Simplex screening (P-35S, T-nos, reference gene)|单重筛查（P-35S、T-nos、内参基因）
Assays|检测方法
choose|选择
Simplex screening uses P-35S, T-nos and the reference gene.|单重筛查使用 P-35S、T-nos 和内参基因。
P-35S and T-nos as the validated duplex|将 P-35S 和 T-nos 作为已验证的双重检测
Name (optional)|名称（可选）
sample 1 (section 3)|样品 1（第 3 节）
Composition of sample 1|样品 1 的组成
unticked: the material preset|未勾选：采用材料预设值
GM events in % of genome copies|转化事件含量（基因组拷贝百分比）
Mean DNA fragment (bp)|平均 DNA 片段长度（bp）
Inhibitor carry-over in the extract|提取物中的抑制物残留
4a · Extractions, PCR replicates and controls|4a · 提取次数、PCR 重复数和对照
5 · DNA extract|5 · DNA 提取物
DNA extract diluted to (ng/µL)|DNA 提取物稀释至（ng/µL）
Template per reaction (µL)|每反应模板体积（µL）
DNA per reaction now:|当前每反应 DNA 量：
6 · Primers, probe, storage and handling|6 · 引物、探针、储存与操作
Primers stored at (°C)|引物储存温度（°C）
Primer storage (months)|引物储存时间（月）
Master mix stored at (°C)|预混液储存温度（°C）
Master mix storage (months)|预混液储存时间（月）
Bench and room|实验台与室内条件
Hot-start polymerase|热启动聚合酶
Plate waits on the bench (min)|反应板在实验台等待时间（分钟）
Room temperature (°C)|室温（°C）
Amplicon carry-over (copies per tube)|扩增子携带污染（拷贝/管）
Pipetting scatter (%)|移液离散程度（%）
from the template, or the method record when there is none|采用模板；无模板时采用方法记录
from the method record|采用方法记录
custom values below|采用下方自定义值
UNG step at 50 °C (s)|50 °C UNG 步骤（秒）
Activation at 95 °C (s)|95 °C 活化（秒）
Denature 95 °C (s)|95 °C 变性（秒）
Anneal/extend (°C)|退火/延伸（°C）
Anneal/extend (s)|退火/延伸（秒）
Extra 72 °C step (s)|额外 72 °C 步骤（秒）
Melt curve 65 → 95 °C|65 → 95 °C 熔解曲线
8 · Reaction-mix calculator|8 · 反应液计算器
Minimum prepared DNA solution (µL)|DNA 溶液最小配制体积（µL）
Reaction volume (µL; empty = method record)|反应体积（µL；留空采用方法记录）
Excess (%)|余量（%）
Round up to (µL)|向上取整至（µL）
Smallest pipetted volume (µL)|最小移液体积（µL）
Primer stocks (µmol/L)|引物储备液（µmol/L）
Probe stocks (µmol/L)|探针储备液（µmol/L）
Sample extract measured at (ng/µL)|样品提取物实测浓度（ng/µL）
Certified-material extract (ng/µL)|有证标准物质提取液（ng/µL）
9 · Reference-material extraction times|9 · 参考材料提取时间
positive sample (earlier routine sample, P-35S and T-nos detected)|阳性样品（此前常规样品，已检出 P-35S 和 T-nos）
10 · qPCR error scenario|10 · qPCR 故障场景
Training scenario for these runs|这些运行采用的训练场景
Group 1 on the bench|工作台中的第 1 组
ready|就绪
The bench accepts this group.|工作台接受此组设置。
Step / procedure|步骤 / 规程
DNA per well|每孔 DNA 量
1 run|1 次运行
Use edited JSON|应用编辑后的 JSON
Copy|复制
Generate these runs now|立即生成这些运行
JSON · VIRTUAL RUNS FOR THE QUALITY MANAGER|JSON · 供质量管理员使用的虚拟运行
Choose profile (.json)…|选择配置（.json）…
Use the example profile|使用示例配置
Build a profile instead|改为创建配置
Thermal block non-uniformity (edge effect)|反应模块温度不均匀（边缘效应）
native|模型输入
injected|读数注入
native+injected|模型输入及读数注入
analysis|分析设置
not reproducible|无法重现
Peltier element degradation (zone 1 pumps 70 % of nominal)|帕尔贴元件性能下降（温区 1 热泵能力为标称值的 70%）
Heated lid malfunction (lid at 60 °C, condensation)|热盖故障（热盖 60 °C，发生冷凝）
Optical misalignment (vignetting across the plate)|光学失准（板面渐晕）
Optical crosstalk (filter shifted: 30 % FAM into the YY channel)|光学串扰（滤光片偏移：30% FAM 信号进入 YY 通道）
Light source degradation (LED at 50 %)|光源衰减（LED 为 50%）
Light source drifting within the run (end of life)|运行中光源漂移（寿命末期）
Detector saturation (gain set too high)|检测器饱和（增益过高）
Detector noise (camera read scatter ×8)|检测器噪声（相机读取离散程度 ×8）
Dirty optical path (spill over a 4 × 4 patch)|光路污染（4 × 4 孔区域有溢洒）
Plate not seated flush (drawer jam; poor thermal contact in rows A–D)|反应板未平整就位（抽屉卡住；A–D 行热接触不良）
Block temperature sensor drifting low (added)|模块温度传感器读数偏低（新增）
Cooling fan stalled (added)|散热风扇停转（新增）
Lid opened during the run (added)|运行中打开热盖（新增）
2 · Software (firmware and operating software)|2 · 软件（固件与操作软件）
Baseline misassignment (very early amplification)|基线设置不当（扩增过早）
Inappropriate threshold placement|阈值设置不当
Missing colour compensation (crosstalk not corrected)|缺少颜色补偿（串扰未校正）
Passive-reference normalisation applied to a mix without ROX|对不含 ROX 的反应液使用被动参比归一化
Firmware–software communication dropout|固件与软件通信中断
Corrupted / outdated run template|运行模板损坏或过时
Melt-curve derivative errors|熔解曲线导数错误
Software crash before saving (long run)|保存前软件崩溃（长时间运行）
3 · Reagents and consumables|3 · 试剂与耗材
Polymerase inactivation (master mix 6 months at room temperature)|聚合酶失活（预混液在室温存放 6 个月）
Fluorophore photobleaching (probe 24 h in lab light)|荧光团光漂白（探针在实验室光照下暴露 24 小时）
Probe degradation (quencher separated: high baseline)|探针降解（淬灭基团分离，基线升高）
dNTP hydrolysis (nucleotides run out in the late cycles)|dNTP 水解（晚期循环核苷酸耗尽）
Inhibitors in the template (ethanol / humic acid carry-over)|模板中的抑制物（乙醇或腐殖酸残留）
Incompatible plastics (wrong plate profile)|不兼容的塑料耗材（板型不符）
Non-optical sealing film|非光学封板膜
Autofluorescent plastics|塑料耗材自发荧光
Lot-to-lot variability (new primer/probe lot at 60 % / 70 %)|批间差异（新批次引物/探针活性为 60% / 70%）
No hot start, plate left 4 h on a warm bench (added)|未使用热启动，板在温热实验台放置 4 小时（新增）
Probe mismatch to the target variant (added)|探针与靶标变体错配（新增）
4a · Human: configuration and set-up|4a · 人为因素：配置与设置
Wrong thermal profile: annealing too high (68 °C)|温度程序错误：退火温度过高（68 °C）
Wrong thermal profile: annealing too low (50 °C)|温度程序错误：退火温度过低（50 °C）
Incorrect fluorophore selection (P-35S read on the wrong channel)|荧光团选择错误（P-35S 使用错误通道采集）
Plate loaded rotated 180°|反应板旋转 180° 装载
Missing controls (NTC and extraction blank omitted)|缺少对照（未设置 NTC 和提取空白）
Inadequate sealing (edge-well evaporation)|密封不良（边缘孔蒸发）
Wrong DNA amount (template 16 × too low) (added)|DNA 用量错误（模板量低 16 倍，新增）
4b · Human: pipetting and handling|4b · 人为因素：移液与操作
Air bubbles in wells|反应孔内气泡
Pipetting volume inaccuracy (CV 30 %)|移液体积不准确（CV 30%）
Aerosol cross-contamination (amplicon carry-over, UNG off)|气溶胶交叉污染（扩增子残留，未启用 UNG）
Incomplete master-mix homogenisation (gradient across columns)|预混液混匀不充分（列间梯度）
Droplets on well walls (template enters 4 cycles late)|孔壁液滴（模板延迟 4 个循环进入反应）
Plate not centrifuged|反应板未离心
4c · Human: data interpretation|4c · 人为因素：数据解释
Accepting non-sigmoidal curves (baseline creep in negatives)|接受非 S 形曲线（阴性样品基线缓慢上升）
Ignoring amplification efficiency (event assay at 88 % of the reference efficiency)|忽略扩增效率（事件检测效率为内参的 88%）
Misinterpreting high Cq values (sample at 1/40 of the GM content)|误读高 Cq 值（样品转基因含量为原值的 1/40）
Overlooking extraction contamination (in place of gDNA in −RT controls)|忽略提取污染（替代无逆转录酶对照中的基因组 DNA 场景）
Unstable reference gene (reference varies ±1.6 cycles by extract)|内参基因不稳定（不同提取物间相差 ±1.6 个循环）
none (normal run)|无（正常运行）
Reference-method screening (default)|参考方法筛查（默认）
P-35S, T-nos and reference gene, simplex|P-35S、T-nos 和内参基因，单重
Blind sample|盲样
Blind sample (composition drawn from the seed, revealed after the analysis)|盲样（组成由随机种子生成，分析后揭晓）
Soybean meal B (two events, one near the detection limit)|大豆粉 B（两个转化体，其中一个接近检测限）
Processed soybean product F (degraded DNA, inhibitors carried over)|大豆加工产品 F（DNA 已降解，残留抑制剂）
Maize flour C|玉米粉 C
Maize flour D (three events)|玉米粉 D（三个转化体）
Maize flour E (non-GM)|玉米粉 E（非转基因）
Non-GM cotton (simulated)|非转基因棉花（模拟）
cotton|棉花
by time, newest first|按时间，最新在前
by time, oldest first|按时间，最早在前
as in the method|与方法一致
Fit this acquisition|适配本次采集
100 % for every gene (E = 2)|所有基因均按 100 %（E = 2）
from the data (efficiency-weighted, Pfaffl)|由数据计算（效率加权，Pfaffl）
Preparing download…|正在准备下载…
Retry download|重试下载
The run cannot start|无法开始运行
A run is in progress.|运行正在进行。
Problem|问题
Check the set-up on the full bench (Expert).|请在完整工作台（高级）中检查设置。
Reduce the number of samples or assays to fit the plate.|请减少样品或检测项目数量，使其能放入板中。
The selected MARA method requires its stated DNA mass per well.|所选 MARA 方法要求每孔使用其规定的 DNA 量。
Restore the cycling programme for the selected MARA method.|请恢复所选 MARA 方法的循环程序。
`.trim().split("\n").map(row => { const i = row.indexOf("|"); return [row.slice(0, i), row.slice(i + 1)]; })));

Object.assign(window.R2_WORKBENCH_ZH, Object.fromEntries(`
Assisted|辅助式
Visual blocks|可视积木
Audio interview|语音访谈
Choose how to build your profile. All three options share your settings.|选择创建方式。三种方式共享同一配置。
Checklists, radio buttons and fields. The current profile builder.|使用清单、单选按钮和字段，保留现有配置编辑方式。
Arrange setting bricks, choose values and repeat each run group.|排列设置积木，选择参数并设置各组运行次数。
Answer by voice, typing or numbered buttons. Review and save your decisions.|通过语音、文字或编号按钮回答问题，并复核、保存决策。
Tap a block category to edit it. Drag blocks to arrange your workspace. Settings inside a run group are applied together, not as a programme.|点击积木类别编辑，拖动积木调整工作区布局。同一运行组内的设置会一起应用，并非执行顺序。
Move block earlier|前移积木
Move block later|后移积木
Move group earlier|前移运行组
Move group later|后移运行组
Offline voice commands|离线语音指令
Recognition language|识别语言
English (US)|英语（美国）
English (UK)|英语（英国）
Download / install English pack|下载 / 安装英语包
Check pack|检查语言包
Optional. Install once for local English recognition. No microphone opens during startup.|可选。安装一次即可在本机识别英语。启动时不会打开麦克风。
Local speech packs are unavailable in this browser. Use typed answers, or open the site in a browser with on-device speech recognition.|此浏览器不支持本机语音包。请使用文字回答，或在支持本机语音识别的浏览器中打开网站。
Checking the English offline recognition pack…|正在检查英语离线识别包…
Checking local recognition…|正在检查本机识别功能…
Downloading / installing the English pack. Keep this page open…|正在下载 / 安装英语包，请保持页面打开…
English offline recognition pack is ready. Microphone permission is still required.|英语离线识别包已就绪，仍需授予麦克风权限。
English offline pack is available. Click Download / install English pack.|可下载英语离线包。请点击“下载 / 安装英语包”。
English pack is downloading. Check again after it completes.|正在下载英语包，请完成后再次检查。
No local English pack is available for this browser. You can type or tap every answer.|此浏览器没有可用的英语本机包。所有问题都可通过文字或点击回答。
Check or download the selected English pack.|请检查或下载所选英语包。
Local recognition unavailable. Type or tap an answer.|无法使用本机语音识别，请输入或点击答案。
Install the English offline pack on the first page, or type an answer.|请在首页安装英语离线包，或输入答案。
Listening locally…|正在本机收听…
Uncertain recognition. Please repeat or use the buttons.|识别结果不确定，请重说或使用按钮。
No local speech voice. Captions remain available.|没有本机朗读声音，仍可查看字幕。
Speech output unavailable. Captions remain available.|语音输出不可用，仍可查看字幕。
Play prompt|播放提示
Enable voice / Play|启用语音 / 播放
Build a profile by voice|通过语音创建配置
Local English recognition. English / Chinese captions and local speech output. Every answer can also be typed or tapped.|在本机识别英语，提供中英文字幕和本机语音朗读。所有答案也可输入或点击。
Resume saved interview|恢复已保存的访谈
Answer or command|答案或指令
Send|发送
Microphone · speak English|麦克风 · 请说英语
Back|返回
Undo|撤销
Say again|再说一遍
Read back|复述
Review|复核
Use default / method|使用默认值 / 方法
Conversation and remembered decisions|对话与已记录的决策
Voice command guide|语音指令指南
Profile read-back|配置复述
Profile JSON · exact settings|配置 JSON · 精确设置
Download decisions|下载决策记录
Load interview|加载访谈
Confirm build|确认生成
Launch virtual runs|启动虚拟运行
Forget saved interview memory|清除已保存的访谈记忆
Forget saved interview memory? Your run files are kept.|清除已保存的访谈记忆？运行文件将保留。
ARTIFICIAL DATA — NOT A LABORATORY RESULT|模拟数据 — 非实验室结果
Interview|访谈
Read-back|复述
Ready to launch|准备启动
Complete|完成
Paused|已暂停
Review your profile before generating virtual runs.|生成虚拟运行前请先复核配置。
Read and acknowledge every caution before confirming the build.|请在确认生成前阅读并确认每条注意事项。
Acknowledge the cautions before launch.|启动前请确认注意事项。
Acknowledge|确认知悉
You|您
Launch window expired. Confirm the build again.|启动有效期已过，请重新确认。
Generating virtual runs…|正在生成虚拟运行…
Stopping after this run…|本次运行完成后停止…
Ready — click the MISSY logo to enter.|已就绪 — 点击 MISSY 标志进入。
BOOT LOG / EMBEDDED COMPONENTS|启动日志 / 内嵌组件
Say: back, undo, say again, where am I, change replicates in group one to two, same as group one, same as last time, rest as method, confirm build, launch, stop.|英语指令示例：back（返回）、undo（撤销）、say again（重说）、where am I（进度）、change replicates in group one to two（第一组重复数改为二）、same as group one（同第一组）、same as last time（同上次）、rest as method（其余按方法）、confirm build（确认）、launch（启动）、stop（停止）。
Recognition is push-to-talk. Click Microphone for each answer. Play reads the current prompt; Stop closes the microphone, cancels speech and disarms launch. During generation, Stop finishes and files the current run.|识别采用按键通话。每次回答前点击麦克风。播放按钮朗读当前提示；停止按钮关闭麦克风、停止朗读并取消启动就绪状态。生成过程中，停止按钮会在本次运行完成并归档后结束。
`.trim().split("\n").map(row => { const i = row.indexOf("|"); return [row.slice(0, i), row.slice(i + 1)]; })));

Object.assign(window.R2_WORKBENCH_ZH, {
"Internet is needed only to install the recognition pack. Downloads are managed by the browser; no separate pack file or percentage is provided.": "仅安装识别包时需要网络。下载由浏览器管理，不提供独立安装包文件或百分比进度。",
"Stop": "停止",
"MISSY / SYSTEM INITIALIZATION": "MISSY / 系统初始化",
"Toggle interface sound": "切换界面声音"
});

Object.assign(window.R2_WORKBENCH_ZH, {"MISSY / PROFILE BUILDER":"MISSY / 配置编辑器","Choose an editor to continue.":"请选择编辑器以继续。","MISSY / ROLE ACCESS":"MISSY / 角色入口"});

Object.assign(window.R2_WORKBENCH_ZH, {
"Rapid soybean screening (P-35S and T-nos)":"大豆快速筛查（P-35S 和 T-nos）",
"ND207 identification":"ND207 鉴定",
"ND207 quantification":"ND207 定量",
"ND207 relative comparison (ΔΔCt)":"ND207 相对比较（ΔΔCt）",
"Soybean screening: P-35S + T-nos duplex, pat, CTP2–CP4 EPSPS":"大豆筛查：P-35S + T-nos 双重、pat、CTP2–CP4 EPSPS",
"Maize screening: P-35S + T-nos duplex, pat, CTP2–CP4 EPSPS":"玉米筛查：P-35S + T-nos 双重、pat、CTP2–CP4 EPSPS",
"Soybean 40-3-2 quantification (QT-EVE-GM-005 with lectin)":"大豆 40-3-2 定量（QT-EVE-GM-005，Lectin 内参）",
"Maize MON810 quantification (QT-EVE-ZM-020 with HMG)":"玉米 MON810 定量（QT-EVE-ZM-020，HMG 内参）",
"Soybean screening: P-35S, T-nos and Le1, simplex":"大豆筛查：P-35S、T-nos 和 Le1 单重",
"Maize screening: P-35S, T-nos and hmgA, simplex":"玉米筛查：P-35S、T-nos 和 hmgA 单重"
});

Object.assign(window.R2_WORKBENCH_ZH, {
"Profile history · JSON only":"配置历史 · 仅 JSON",
"Only accepted profile settings are kept. Speech and conversation text are not saved.":"仅保留已接受的配置参数，不保存语音或对话文字。"
});

Object.assign(window.R2_WORKBENCH_ZH, {"Recognising locally…":"正在本机识别…"});

Object.assign(window.R2_WORKBENCH_ZH, {
"SOP correlation":"SOP 一致性检查",
"Invalid interview memory. Your current profile is unchanged.":"访谈记忆无效，当前配置保持不变。"
});

Object.assign(window.R2_WORKBENCH_ZH,{
  "Back to loading screen":"返回加载画面","Start microphone":"启动麦克风","Stop microphone":"停止麦克风","▶ Start microphone":"▶ 启动麦克风","■ Stop microphone":"■ 停止麦克风",
  "▶ Start microphone · speak English":"▶ 启动麦克风 · 请说英语","Microphone settings":"麦克风设置","Microphone level":"麦克风电平","Opening microphone…":"正在打开麦克风…","Read prompt":"朗读提示","Level unavailable":"电平不可用",
  "Finish or stop the current batch before leaving.":"请先完成或停止当前批次，再离开。","Command not recognised. Use the buttons.":"未识别命令，请使用按钮。"
});

Object.assign(window.R2_WORKBENCH_ZH,{"Component loading only — not diagnostic tests. Times: elapsed startup (+ since previous component).":"此处仅显示组件加载情况，并非诊断测试。时间为启动已用时（+ 距上一个组件的间隔）。"});

Object.assign(window.R2_WORKBENCH_ZH,{
"▶ Start spoken interview":"▶ 开始语音访谈","■ Pause spoken interview":"■ 暂停语音访谈","Read current question":"朗读当前问题",
"Start spoken interview reads the questions aloud. After playback finishes, click Start microphone to answer. The microphone stays off while any sound is playing.":"“开始语音访谈”会朗读问题。播放结束后，点击“启动麦克风”回答。任何声音播放期间，麦克风都保持关闭。",
"Preparing spoken question…":"正在准备朗读问题…","Speaking question — microphone is off.":"正在朗读问题，麦克风已关闭。","Question finished. Click Start microphone to answer.":"问题朗读完毕，请点击“启动麦克风”回答。","Spoken interview paused.":"语音访谈已暂停。",
"Wait for playback to finish before starting the microphone.":"请等待播放结束后再启动麦克风。","No local speech voice for this language. Recognition packs do not install speaking voices. Use captions or select another interface language.":"没有此语言的本机朗读声音。识别语音包不会安装朗读声音。请使用文字提示或选择另一界面语言。"
});

Object.assign(window.R2_WORKBENCH_ZH,{
"Session minutes":"会话分钟数",
"Microphone session expired. Start a new session to continue.":"麦克风会话已到期，请重新启动会话继续。",
"Microphone session paused during playback or another panel.":"播放声音或打开其他面板时，麦克风会话会暂停。",
"Start spoken interview reads the questions aloud. Click Start microphone once to answer across stages. The microphone pauses while any sound is playing and resumes automatically during a timed session.":"“开始语音访谈”会朗读问题。只需点击一次“启动麦克风”，即可连续回答各阶段问题。任何声音播放时麦克风暂停，会话有效期间会自动恢复。",
"Recognition continues across stages for the selected session duration and pauses during playback. Play reads the current prompt; Stop closes the microphone, cancels speech and disarms launch. During generation, Stop finishes and files the current run.":"在所选会话时长内，识别可跨阶段连续进行，播放声音时暂停。播放会朗读当前提示；停止会关闭麦克风、取消朗读并解除启动确认。生成期间，停止会完成并保存当前运行。"
});

Object.assign(window.R2_WORKBENCH_ZH,{"Microphone session duration in minutes":"麦克风会话时长（分钟）","Apply session duration":"应用会话时长","Use 1 to 120 minutes.":"请输入 1 至 120 分钟。"});

Object.assign(window.R2_WORKBENCH_ZH,{"Microphone paused while audio is playing.":"播放声音时麦克风暂停。"});

Object.assign(window.R2_WORKBENCH_ZH,{
  "Profile read-back": "配置复述",
  "JSON history": "JSON 历史",
  "Back to question": "返回当前问题",
  "Previous question": "上一个问题",
  "Begin spoken answers with Computer or Missy.": "请以 Computer 或 Missy 开头作答。",
  "Begin spoken commands with Computer or Missy.": "请以 Computer 或 Missy 开头说出命令。",
  "Return to the question to answer it.": "请返回当前问题后作答。",
  "Stop generation": "停止生成",
  "Begin every spoken answer or command with Computer or Missy. Typed answers and buttons do not need a wake word.": "每次语音回答或命令都应以 Computer 或 Missy 开头。输入文字和点击按钮时无需唤醒词。",
  "Answer the current question.": "回答当前问题。",
  "Return to the previous question, undo an accepted setting, or repeat the prompt.": "返回上一个问题、撤销已接受的设置，或重复提示。",
  "Hear progress or open the full-screen profile read-back.": "收听进度或打开全屏配置复述。",
  "Change a named setting; the applied value is read back.": "修改指定设置，并复述实际应用的值。",
  "Reuse settings or accept the remaining method defaults.": "复用设置，或接受剩余方法默认值。",
  "Review the complete profile and acknowledge cautions first. Confirm the build, then launch within the displayed time window.": "先审核完整配置并确认注意事项，然后确认生成，并在显示的时限内启动。",
  "Stop listening, pause the interview and disarm launch. While audio is playing, use the bottom-bar Stop button.": "停止聆听、暂停访谈并解除启动确认。播放声音时，请使用底部栏的停止按钮。",
  "Start spoken interview in the bottom bar, then start the microphone once. Set the session duration in Microphone settings using min and ✓. The default is 10 minutes. Listening pauses during playback and resumes automatically while the session remains valid.": "在底部栏开始语音访谈，再启动一次麦克风。在麦克风设置中使用 min 和 ✓ 设置会话时长，默认为 10 分钟。播放声音时聆听暂停，会话有效期间会自动恢复。",
  "Each accepted answer is acknowledged, followed by a summary of the applied setting and the next question. Unprefixed speech is ignored and is not added to JSON history.": "每个已接受的答案都会得到确认，然后概述实际应用的设置，并提出下一个问题。没有唤醒词的语音会被忽略，不会加入 JSON 历史。",
  "During generation the microphone is off. Use Stop generation to finish and file the current run before stopping the batch.": "生成期间麦克风关闭。使用“停止生成”可在停止批次前完成并保存当前运行。",
  "English offline recognition pack is ready.": "英语离线识别语音包已就绪。"
});

Object.assign(window.R2_WORKBENCH_ZH,{"Voice workspace shortcuts":"语音工作区快捷方式","Recognition uses English voice commands; the examples below are spoken in English.":"语音识别使用英语，以下示例应以英语说出。"});
