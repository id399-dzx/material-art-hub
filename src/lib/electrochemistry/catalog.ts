export type ElectrochemistryAnimation = {
  id: string;
  label: string;
  keyPoint: string;
  src: string;
  poster: string;
  durationSeconds: number;
  interactiveUrl: string;
  caption: string;
};

export type ElectrochemistryArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: readonly string[];
  readingMinutes: number;
  animations?: readonly ElectrochemistryAnimation[];
  comparison?: {
    columns: readonly [string, string];
    rows: readonly { label: string; values: readonly [string, string] }[];
    note: string;
  };
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
    id: "faradaic-and-nonfaradaic",
    title: "法拉第与非法拉第过程",
    category: "basics",
    summary: "同样有电流，电荷却可以走不同的储存路径。切换两段石墨负极界面动画，比较嵌锂反应与双电层充电，再理解电池容量、SEI 和赝电容之间的联系。",
    tags: ["法拉第过程", "非法拉第过程", "嵌锂", "双电层", "石墨负极", "SEI", "赝电容"],
    readingMinutes: 7,
    animations: [
      {
        id: "faradaic-process",
        label: "法拉第过程",
        keyPoint: "电子参与氧化还原，Li⁺嵌入石墨并改变材料状态。",
        src: "/animations/electrochemistry/faradaic-process.mp4",
        poster: "/animations/electrochemistry/faradaic-process.jpg",
        durationSeconds: 16,
        interactiveUrl: "/animations/battery-interface.html",
        caption: "石墨负极充电时的局部嵌锂示意：电子进入石墨电子态，Li⁺嵌入层间，形成 LiₓC₆。非按比例，省略溶剂与 SEI。",
      },
      {
        id: "nonfaradaic-process",
        label: "非法拉第过程",
        keyPoint: "不发生相应氧化还原，界面电荷分离与离子重排仍可储能。",
        src: "/animations/electrochemistry/nonfaradaic-process.mp4",
        poster: "/animations/electrochemistry/nonfaradaic-process.jpg",
        durationSeconds: 16,
        interactiveUrl: "/animations/battery-interface.html",
        caption: "单独展示双电层充电分量：电子在电极侧积累，Li⁺在液相近界面富集，没有相应的氧化还原电荷转移。实际可与法拉第过程并存。",
      },
    ],
    comparison: {
      columns: ["法拉第过程", "非法拉第过程"],
      rows: [
        { label: "判断依据", values: ["这部分电流对应氧化还原反应中的电子转移。", "这部分界面充电电流不对应氧化还原电荷转移。"] },
        { label: "储荷与状态变化", values: ["反应可改变物质组成、氧化态或电子态；可逆性需另行判断。", "双电层通过界面电荷分离、离子与溶剂重排储荷。"] },
        { label: "动画中 Li⁺ 的去向", values: ["进入石墨层间，形成嵌锂化合物 LiₓC₆。", "仍在电解液侧，在近界面重新分布。"] },
        { label: "常见例子", values: ["嵌锂与脱锂、金属沉积与溶解，以及形成 SEI 的还原反应。", "电极—电解液界面的双电层充电。"] },
        { label: "器件中的分工", values: ["常规石墨锂离子电池主要可逆容量来自嵌锂与脱锂；也可能有副反应。", "双电层超级电容器可主要依靠它储能；电池中也存在这一分量。"] },
      ],
      note: "按电荷转移机制区分，不能直接等同于快慢、好坏或保护作用。两种分量可以同时存在；赝电容虽有电容响应，仍涉及法拉第过程。",
    },
    sections: [
      {
        heading: "充进去的电，去了哪里",
        paragraphs: [
          "给手机插上充电线，电量开始上升，但电池并不是一只装电子的桶。以常规石墨锂离子电池充电为例，电子沿外电路和导电电极到达负极，Li⁺沿电解液迁移。正常工作时，电子不会在电解液里自由穿行；完整电池还需要另一电极的配套反应，形成电流回路。",
          "同一个界面上，电流可以包含不同分量：一部分参与氧化还原反应，属于法拉第过程；另一部分用于双电层充电，不发生相应的氧化还原电荷转移，属于非法拉第过程。两段动画把它们分别放大，便于比较；实际工作时可以同时发生，不需要按顺序交班。",
        ],
      },
      {
        heading: "法拉第过程：Li⁺住进石墨，材料状态改变",
        paragraphs: [
          "石墨可以想成一栋有许多楼层的建筑。充电时，Li⁺进入层间，电子进入石墨的电子态，共同形成嵌锂化合物 LiₓC₆。材料组成与电子状态随之改变，这一嵌锂反应属于法拉第过程。放电时可以沿相反方向脱锂，电子经外电路向负载做功。",
          "“入住”只是帮助理解空间位置，并不表示每个 Li 都抱着一个局域电子，也不表示 Li⁺先变成一层金属锂再进入石墨。石墨嵌锂与表面的金属锂沉积是不同过程。法拉第过程也不限于嵌入反应，金属沉积、溶解等同样可以涉及氧化还原电子转移。",
        ],
        equation: "C₆ + xLi⁺ + xe⁻ ⇌ LiₓC₆（向右为石墨嵌锂，向左为脱锂）",
      },
      {
        heading: "非法拉第过程：隔着界面，也能储荷",
        paragraphs: [
          "切换到双电层动画：电极侧负电荷增加，电解液侧的离子分布随之调整，Li⁺在近界面富集，同号阴离子相对排开。电子留在导电电极侧，Li⁺仍在液相侧。这一分量没有对应的氧化还原电荷转移，却建立了界面电荷分离；分开电荷需要外部做功，放电时可释放这部分能量。",
          "没有氧化还原，不等于没有电流。外电路仍有电子移动，液相仍有离子重排和溶剂取向变化。双电层本身可以充放电，Li⁺不必随后一定嵌入石墨。固定电位下，理想双电层的充电电流会逐渐衰减，但已形成的电荷分离和电场仍可存在；电位再变化，双电层也会重新调整。",
        ],
      },
      {
        heading: "同样能够储能，在不同器件里分工不同",
        paragraphs: [
          "常规石墨锂离子电池的主要可逆容量通常来自嵌锂、脱锂等法拉第反应。实际能用多少容量，还取决于反应位点、离子与电子输运、反应可逆性、结构变化和截止条件。充电提高的是整电池的化学能，放电时再向外提供电能，不能只用负极局部的电子积累解释续航。",
          "在双电层超级电容器中，大量可接触的界面能够让双电层储荷成为主要储能方式，用于功率脉冲、短时缓冲或能量回收。不过“超级电容器”这一器件名称，并不保证内部只有非法拉第过程：赝电容及混合储能机制也可能参与，判断时仍需回到具体材料和反应。",
        ],
      },
      {
        heading: "双电层与 SEI：机制不同，也能相互影响",
        paragraphs: [
          "离子和溶剂如何排列、局部电场与电位降如何分布，会改变界面的反应环境，影响脱溶剂化、反应速率或电解液分解路径。Bang 等人的石墨负极研究中，CoP 涂层改变了双电层内的阴离子分布，影响 SEI 组成，并改善了所测条件下的快充表现。这是具体材料与电解液组合的结果，不能推出“离子排得越整齐，电池就越好”。",
          "形成 SEI 的电解液还原分解属于法拉第过程，会消耗活性锂和电解液。形成合适的 SEI 后，它又可能抑制进一步分解、支持稳定工作；初始成膜与后续持续生长的影响需要区分。金属锂沉积也属于可能不利的法拉第反应。可见法拉第不等于有益，非法拉第也不能直接等同于保护电池。",
        ],
      },
      {
        heading: "不按快慢分队：赝电容与动画的边界",
        paragraphs: [
          "法拉第过程不一定慢。某些快速、可逆的氧化还原或离子嵌入过程会表现出电容式响应，称为赝电容，仍属于法拉第储荷。反过来，双电层充电也会受到孔道、溶液电阻和离子输运限制。仅凭器件名称、曲线形状或充电快慢，都不足以唯一确定储能机制。",
          "两段动画只展示石墨负极局部的不同电流分量，没有按实际比例绘制，也省略了溶剂化、SEI 和复杂离子分层。画面中粒子停下表示一个简化阶段趋于完成，不代表界面电场消失，更不代表电池之后没有电流。先辨认电子是否参与相应氧化还原，再结合条件讨论速度、容量与作用，才能把两种过程放回真实器件中。",
        ],
      },
    ],
    sources: [
      { title: "IUPAC Gold Book：faradaic current", url: "https://goldbook.iupac.org/terms/view/F02321" },
      { title: "IUPAC Gold Book：double-layer current", url: "https://goldbook.iupac.org/terms/view/D01847" },
      { title: "美国能源部：DOE Explains…Batteries", url: "https://www.energy.gov/science/doe-explainsbatteries" },
      { title: "Merlet 等：纳米多孔碳中的双电层储能机制（2012）", url: "https://www.nature.com/articles/nmat3260" },
      { title: "Bang 等：双电层调控与石墨 SEI 形成（2024）", url: "https://doi.org/10.1039/D4TA03703K" },
      { title: "Augustyn 等：Li⁺嵌入赝电容的高倍率储能（2013）", url: "https://www.nature.com/articles/nmat3601" },
    ],
  },
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
