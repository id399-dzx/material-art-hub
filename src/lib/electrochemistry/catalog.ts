export type ElectrochemistryArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: readonly string[];
  readingMinutes: number;
  sections: readonly { heading: string; paragraphs: readonly string[]; equation?: string }[];
  sources: readonly { title: string; url: string }[];
};

export const ELECTROCHEMISTRY_CATEGORIES = [
  { id: "basics", label: "基础概念" },
  { id: "methods", label: "测试方法" },
  { id: "interpretation", label: "数据判读" },
] as const;

export const ELECTROCHEMISTRY_ARTICLES: readonly ElectrochemistryArticle[] = [
  {
    id: "electrode-and-potential",
    title: "三电极体系与电位：先明确测量对象",
    category: "basics",
    summary: "认识工作、参比和对电极的分工，区分单电极电位与整电池电压，读懂曲线上的电位标注。",
    tags: ["三电极", "参比电极", "电位", "WE", "RE", "CE"],
    readingMinutes: 2,
    sections: [
      { heading: "三种电极各做什么", paragraphs: ["工作电极是研究反应发生的位置；参比电极提供相对稳定的电位基准；对电极承担电流回路。三电极测试通常控制工作电极相对参比电极的电位，同时测量工作电极与对电极之间的电流。"] },
      { heading: "电位必须写明基准", paragraphs: ["“0.5 V”本身不能完整说明单电极状态，应同时注明参比体系，例如相对 Ag/AgCl 或 Li/Li⁺。比较不同文献时，需要核对参比电极、电解液组成和测试条件；不能直接把不同基准的横坐标叠加。"] },
      { heading: "与整电池电压区分", paragraphs: ["整电池电压是正、负电极之间的电位差，不能等同于某个工作电极相对参比电极的电位。二电极与三电极结果承担不同的测量任务，报告时应明确电池结构。", "参比电极也可能漂移或受到实验条件影响。出现异常峰位移动时，应先检查参比状态、接线与溶液电阻，再讨论材料变化。"] },
    ],
    sources: [
      { title: "IUPAC Gold Book：three-electrode cell", url: "https://goldbook.iupac.org/terms/view/09081" },
      { title: "IUPAC Gold Book：reference electrode", url: "https://goldbook.iupac.org/terms/view/R05229" },
    ],
  },
  {
    id: "capacity-and-c-rate",
    title: "容量与倍率：Ah、mAh 和 C-rate 怎么读",
    category: "basics",
    summary: "容量表示转移的电荷量，倍率表示相对于参考容量的电流条件；比较数据前要先统一定义和单位。",
    tags: ["容量", "Ah", "mAh", "倍率", "C-rate", "电流"],
    readingMinutes: 2,
    sections: [
      { heading: "容量来自电流积分", paragraphs: ["容量由电流随时间的积分得到。电流使用 A、时间使用 h 时，结果为 Ah；使用 A 和 s 时，积分先得到库仑，再除以 3.6 才得到 mAh。恒流段可以简化为电流乘持续时间。"], equation: "Q(Ah) = ∫ I(A) dt(h)；Q(mAh) = ∫ I(A) dt(s) / 3.6" },
      { heading: "倍率需要声明参考容量", paragraphs: ["1 C 对应按所选参考容量在 1 小时尺度下换算的电流。例如参考容量为 4 Ah 时，0.5 C 对应 2 A。参考容量可能取额定、理论或规定条件下的实测值，报告时必须说明采用哪一种。"], equation: "I(A) = 倍率数值 × Q参考(Ah) / 1 h" },
      { heading: "容量不等于能量", paragraphs: ["相同 Ah 的电池不一定具有相同能量，因为工作电压和放电曲线可能不同。能量还需要对电压与电荷量积分，不能仅凭容量大小比较储能水平。", "实际充放电时间还会受到截止电压、恒压阶段和可利用容量影响，标注 1 C 并不保证每次完整实验恰好持续 1 小时。"] },
    ],
    sources: [{ title: "BioLogic：An introduction to Batteries", url: "https://www.biologic.net/wp-content/uploads/2019/08/introduction-to-batteries_battery.pdf" }],
  },
  {
    id: "cyclic-voltammetry",
    title: "循环伏安 CV：从扫描条件读到曲线变化",
    category: "methods",
    summary: "理解电位往返扫描与电流响应，掌握峰位、峰间距和扫速比较的基本边界。",
    tags: ["CV", "循环伏安", "扫速", "峰电流", "峰间距"],
    readingMinutes: 3,
    sections: [
      { heading: "CV 实际记录什么", paragraphs: ["循环伏安在设定电位范围内进行往返扫描，同时记录电流响应。曲线应注明电位基准、扫描方向、扫速和循环编号。改变扫描范围或扫速，都可能改变曲线外观，比较前应先统一这些条件。"], equation: "v = |dE/dt|，常用单位为 V/s 或 mV/s" },
      { heading: "峰变化是线索", paragraphs: ["峰电位、峰电流及正反向峰间距可以提供反应过程的信息，但也受到传质、反应动力学、溶液电阻和背景电流影响。峰间距增大并不自动证明材料结构发生变化，应结合对照实验分析。"] },
      { heading: "使用多个扫速进行核验", paragraphs: ["研究扫速依赖时，应保持其他条件一致，并说明背景扣除和电流归一化方法。简单模型中的比例关系只在对应假设成立时适用，不能仅凭一次拟合就唯一判断储能机理。", "保留原始采样顺序和扫描方向，不要把正、反向扫描按电位全局排序后连线，否则可能改变回线与峰的对应关系。"] },
    ],
    sources: [
      { title: "BioLogic Application Note 41-I：CV 与扫速、动力学", url: "https://www.biologic.net/wp-content/uploads/2019/08/cv-simulation_electrochemistry-an41-1.pdf" },
      { title: "A Practical Beginner’s Guide to Cyclic Voltammetry", url: "https://doi.org/10.1021/acs.jchemed.7b00361" },
    ],
  },
  {
    id: "gcd-and-efficiency",
    title: "恒流充放电 GCD 与库仑效率",
    category: "methods",
    summary: "用电流、时间和电压轨迹理解充放电过程，正确区分容量、库仑效率与能量效率。",
    tags: ["GCD", "恒流充放电", "库仑效率", "CE", "CCCV"],
    readingMinutes: 3,
    sections: [
      { heading: "先确认完整工步", paragraphs: ["恒流充放电记录指定电流下的电压变化。比较曲线时，应核对电流、截止电压、温度和循环编号。恒流恒压充电还包括恒压阶段，计算完整充电容量时需要计入这一阶段的电荷量。"] },
      { heading: "库仑效率怎样计算", paragraphs: ["电池循环中的库仑效率通常用同一完整循环释放的电荷量与充入电荷量之比表示。若仪器把放电容量记为负值，应先区分符号约定，再用对应电荷量的大小计算效率，避免得到负效率。"], equation: "ηC = |Q放电| / |Q充电| × 100%" },
      { heading: "效率需要结合条件解释", paragraphs: ["只有在充、放电电流大小相同且各段恒流时，容量之比才能简化为时间之比。初始状态不匹配、工步缺失或积分边界不同，都可能造成异常效率。", "库仑效率描述电荷量的回收比例；能量效率还受到充放电电压差影响。接近 100% 的库仑效率不能单独证明没有极化、没有能量损失或寿命一定优良。"] },
    ],
    sources: [
      { title: "BioLogic Application Note 51：恒流法表征超级电容器", url: "https://www.biologic.net/wp-content/uploads/2019/08/dc-characterizations_supercapacitor-an51.pdf" },
      { title: "BioLogic：AC/DC characterization of a vanadium redox flow cell", url: "https://www.biologic.net/wp-content/uploads/2021/11/ac-dc-characterization-of-vrfc-using-pinflow-test-cell.pdf" },
    ],
  },
  {
    id: "electrochemical-impedance",
    title: "阻抗谱 EIS：Nyquist 与 Bode 图怎么看",
    category: "methods",
    summary: "认识小扰动阻抗测试、两种常见图形及等效电路拟合的适用条件。",
    tags: ["EIS", "阻抗谱", "Nyquist", "Bode", "等效电路"],
    readingMinutes: 3,
    sections: [
      { heading: "小信号与稳定状态", paragraphs: ["EIS 在给定工作状态附近施加小幅交流扰动，测量不同频率下的电压和电流响应。常规分析要求系统在测量期间近似稳定，并在所选扰动幅度下满足近似线性；明显漂移会影响谱图可靠性。"], equation: "Z(ω) = ΔE(ω) / ΔI(ω)，单位为 Ω；分子和分母为复数响应" },
      { heading: "两种图形互相补充", paragraphs: ["Nyquist 图通常以 Z′ 为横轴、−Z″ 为纵轴，每个点对应一个频率，但图上未必直接显示频率。Bode 图用频率展示阻抗幅值和相位，有助于核对不同频段的变化，绘图时应保留频率信息。"] },
      { heading: "拟合要有物理依据", paragraphs: ["等效电路中的电阻、电容与扩散元件应对应合理的物理过程。不能仅凭半圆外观就给每一段指定唯一机制，也不能把任意半圆直径直接当作电荷转移电阻。", "报告扰动幅值、频率范围、直流工作点及拟合残差；评价参数时，同时检查模型是否适合当前电极和电池结构。"] },
    ],
    sources: [
      { title: "Gamry：Basics of Electrochemical Impedance Spectroscopy", url: "https://www.gamry.com/application-notes/EIS/basics-of-electrochemical-impedance-spectroscopy/.html" },
      { title: "Gamry：Equivalent Circuit Modeling", url: "https://www.gamry.com/application-notes/EIS/equivalent-circuit-modeling-using-the-gamry-eis300-electrochemical-impedance-spectroscopy-software/" },
    ],
  },
  {
    id: "differential-capacity",
    title: "微分容量 dQ/dV：计算前先处理分支与噪声",
    category: "methods",
    summary: "理解增量容量曲线的含义，以及采样、容量符号和数据处理对峰形的影响。",
    tags: ["dQ/dV", "ICA", "微分容量", "电压步长", "电池循环"],
    readingMinutes: 3,
    sections: [
      { heading: "从容量—电压曲线求导", paragraphs: ["dQ/dV 表示单位电压变化对应的容量增量。数值计算常用相邻电压区间的容量差与电压差之比；容量用 Ah 时，结果单位为 Ah/V。求导会放大噪声，输入数据质量会直接影响曲线。"], equation: "dQ/dV ≈ (Q₂ − Q₁) / (V₂ − V₁)" },
      { heading: "保留循环和工步边界", paragraphs: ["计算前应区分循环、充电与放电，并识别恒流、恒压和静置工步。重复电压不能直接作为分母；不要跨容量重置或独立循环连线，也不要用全局排序掩盖原始采样中的分支边界。"] },
      { heading: "比较峰时记录处理参数", paragraphs: ["电压步长、插值和平滑都会影响峰位、峰高与峰宽。应报告处理方法，并核对处理前后峰形；更细的插值网格不等于新增实验信息。", "导数符号取决于容量记录约定，不能在未说明的情况下随意取绝对值。峰的移动或衰减还受倍率、温度及电极体系影响，单一峰变化不足以唯一确定退化机理。"] },
    ],
    sources: [{ title: "Dubarry & Anseán：Best practices for incremental capacity analysis", url: "https://doi.org/10.3389/fenrg.2022.1023555" }],
  },
  {
    id: "normalization-and-comparison",
    title: "比容量、面容量与体积容量：分母决定比较对象",
    category: "interpretation",
    summary: "理解质量、面积和体积归一化，避免把活性材料指标直接当作完整器件性能。",
    tags: ["比容量", "面容量", "体积容量", "归一化", "载量"],
    readingMinutes: 3,
    sections: [
      { heading: "先检查单位和分母", paragraphs: ["同一容量可以按质量、面积或体积归一化，常见单位分别为 mAh/g、mAh/cm² 和 mAh/cm³。三者回答不同问题，必须说明质量、面积或体积属于活性材料、电极还是完整电池。"], equation: "比容量 = |Q|/质量；面容量 = |Q|/面积；体积容量 = |Q|/体积" },
      { heading: "载量和厚度同样重要", paragraphs: ["较高的质量比容量不一定意味着较高的面容量或器件能量。活性物质载量、厚度、非活性组分与电解液用量都会影响结果，评价实际应用潜力时应同时报告这些条件。"] },
      { heading: "建立可比条件", paragraphs: ["比较数据时，应核对电压范围、倍率或电流密度、温度、循环阶段及电池结构。半电池与全电池、单电极与器件级结果不能不加说明地混排。", "论文或图注应给出归一化公式和分母来源，保留原始容量及称量信息。容量指标也不能直接替代能量指标，后者还需考虑工作电压和整个放电过程。"] },
    ],
    sources: [
      { title: "Aligning academia and industry for unified battery performance metrics", url: "https://www.nature.com/articles/s41467-018-07599-8" },
      { title: "Energy Storage Data Reporting in Perspective", url: "https://doi.org/10.1002/aenm.201902007" },
    ],
  },
  {
    id: "reproducibility-and-reporting",
    title: "实验可重复性：让曲线之外的条件也被看见",
    category: "interpretation",
    summary: "区分重复测量、独立样品和测量不确定度，让性能比较有明确的实验依据。",
    tags: ["可重复性", "误差条", "独立样品", "实验记录", "数据报告"],
    readingMinutes: 2,
    sections: [
      { heading: "记录足够的实验条件", paragraphs: ["电化学结果对电极制备、电解液、参比体系、温度、接线与测试程序敏感。展示性能曲线时，应记录能影响结论的关键条件，让其他人知道如何重复该实验，也便于定位异常来源。"] },
      { heading: "说明重复和误差的含义", paragraphs: ["应区分同一样品的重复测量与不同样品的独立实验，并说明样品数、重复次数和误差条的定义。标准差、标准误与置信区间含义不同，图注中不能只写“误差”而不交代计算方式。"] },
      { heading: "保留从原始数据到图形的路径", paragraphs: ["保存原始文件、工步与循环定义、剔除规则及数据处理参数。对于校准、背景扣除、平滑和电阻补偿等操作，应说明采用的方法，便于检查处理是否影响比较结论。", "单条曲线可以展示一次观察，但不足以自行说明结果的离散程度。解释材料差异时，应将变化大小与测量不确定度、样品差异及适当对照一起考虑。"] },
    ],
    sources: [{ title: "Error, reproducibility and uncertainty in experiments for electrochemical energy technologies", url: "https://www.nature.com/articles/s41467-022-34594-x" }],
  },
];
