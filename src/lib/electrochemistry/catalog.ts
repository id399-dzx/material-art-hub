export type ElectrochemistryArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  tags: readonly string[];
  readingMinutes: number;
  animation?: {
    src: string;
    poster: string;
    durationSeconds: number;
    interactiveUrl: string;
    caption: string;
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
    id: "faradaic-process",
    title: "法拉第过程：锂离子住进去了，电极也变了",
    category: "basics",
    summary: "从石墨负极的嵌锂动画，看电子怎样参与反应、主要容量从哪里来，以及为什么形成 SEI、析锂和赝电容也要放进同一张机制地图。",
    tags: ["法拉第过程", "嵌锂", "氧化还原", "石墨负极", "SEI", "赝电容"],
    readingMinutes: 4,
    animation: {
      src: "/animations/electrochemistry/faradaic-process.mp4",
      poster: "/animations/electrochemistry/faradaic-process.jpg",
      durationSeconds: 16,
      interactiveUrl: "/animations/battery-interface.html",
      caption: "石墨负极充电时的局部嵌锂示意：电子进入石墨电子态，Li⁺嵌入层间，形成 LiₓC₆。非按比例，省略溶剂与 SEI。",
    },
    sections: [
      {
        heading: "充进去的电，总得有个去处",
        paragraphs: [
          "给手机插上充电线，电量从 20% 往上爬。很容易把它想成往桶里灌电子，灌满了就拔线。可把石墨负极放大看，事情多了一层：电子沿外电路和导电电极过来，Li⁺沿电解液过来，两拨各走各的路，在电极界面附近共同完成嵌锂反应。正常工作时，电子不会在电解液里自由穿行。",
          "动画只截取了石墨负极充电时的局部界面。Li⁺进入石墨层间，电子进入石墨的电子态，材料的组成和电子状态一起改变。这里发生了带电子转移的氧化还原反应，这就是法拉第过程。完整电池还要有另一电极的配套反应，才能把回路接起来。",
        ],
      },
      {
        heading: "把嵌锂想成办理入住",
        paragraphs: [
          "先把一层层碳片想成楼层，层间有可以容纳锂的位置。Li⁺从电解液赶来，进屋、入住；与此同时，电子进入材料，电极的状态跟着变。放电时再反过来，锂从石墨中脱出，电子经外电路去做功，像住客退房。这比单纯记住一个名词好理解。",
          "但比喻讲到这就够了，别真给每个锂安排一个抱在怀里的电子。正常嵌锂形成的是 LiₓC₆，不能画成 Li⁺先变成金属锂，再塞进石墨。动画里的“Li”表示嵌入态锂；金属锂在表面沉积，是另外一件事。入住这个比喻也只对应这里的嵌锂，法拉第过程还包括沉积、溶解等许多反应。",
        ],
        equation: "C₆ + xLi⁺ + xe⁻ ⇌ LiₓC₆",
      },
      {
        heading: "电池的主要容量，从这些反应里来",
        paragraphs: [
          "对常规石墨锂离子电池来说，嵌锂、脱锂等可逆法拉第反应承担了主要可逆容量。材料能容纳多少锂、能转移多少电子、在规定条件下能反应到什么程度，都会影响实际能放出多少电。充电时，外部输入的电能使整个电池处于能释放更多能量的化学状态；放电时，反应把这部分能量交给外电路。",
          "所以看容量不能只盯着电子小球有没有跑过去，还得看材料能否持续、可逆地参与反应。反应位点、离子输运、结构变化、截止电压，都可能限制可用容量。看上去房间不少，住客能否顺利入住、退房，才是实际使用时的事。",
        ],
      },
      {
        heading: "发生反应，也可能是在添乱",
        paragraphs: [
          "一听“法拉第负责容量”，很容易顺手给它颁个好人证。先等等。电解液被还原分解、石墨表面析锂，也可能属于法拉第过程。分类看的是有没有相应的氧化还原电荷转移，不看这次反应有没有帮电池干正事。",
          "SEI 就很能说明问题：它的形成涉及电解液的法拉第还原分解，会消耗活性锂和电解液；形成合适的界面膜后，又能抑制进一步分解、帮助电池稳定工作。最初成膜与后续持续长膜，代价和结果不一样。不能把“保护膜”三个字一看到，就把成膜划给非法拉第。",
        ],
      },
      {
        heading: "别拿快慢，替机制分队",
        paragraphs: [
          "法拉第过程不一定慢。赝电容就是容易认错的例子：响应可以很快，也呈现电容特征，但储荷仍包含法拉第氧化还原过程。反过来，双电层充电也会受到孔道、离子输运和电阻影响。名字里有“电容”，或者曲线看着像电容，都不足以直接判定它是非法拉第。",
          "动画把嵌锂和双电层拆成两段，是为了让眼睛跟得上。真实电极可以一边发生法拉第反应，一边调整界面电荷分布；并没有规定先把队排完，才允许办理入住。读图时抓住这两个动作：材料通过反应改变状态，界面通过电荷重排改变状态。它们可以同时忙。",
        ],
      },
    ],
    sources: [
      { title: "IUPAC Gold Book：faradaic current", url: "https://goldbook.iupac.org/terms/view/F02321" },
      { title: "美国能源部：DOE Explains…Batteries", url: "https://www.energy.gov/science/doe-explainsbatteries" },
      { title: "Bang 等：双电层调控与石墨 SEI 形成（2024）", url: "https://doi.org/10.1039/D4TA03703K" },
      { title: "Augustyn 等：Li⁺嵌入赝电容的高倍率储能（2013）", url: "https://www.nature.com/articles/nmat3601" },
    ],
  },
  {
    id: "nonfaradaic-process",
    title: "非法拉第过程：隔着界面排队，也能存电",
    category: "basics",
    summary: "电子留在电极侧，离子在电解液侧重新排列。双电层怎样储能、怎样影响反应，为什么它不是白忙，也不能直接等同于保护电池。",
    tags: ["非法拉第过程", "双电层", "界面电场", "超级电容器", "储荷", "赝电容"],
    readingMinutes: 4,
    animation: {
      src: "/animations/electrochemistry/nonfaradaic-process.mp4",
      poster: "/animations/electrochemistry/nonfaradaic-process.jpg",
      durationSeconds: 16,
      interactiveUrl: "/animations/battery-interface.html",
      caption: "单独展示双电层充电分量：电子在电极侧积累，Li⁺在液相近界面富集，没有相应的氧化还原电荷转移。实际可与法拉第过程并存。",
    },
    sections: [
      {
        heading: "电子来了，离子隔着界面站好",
        paragraphs: [
          "还是动画中的石墨负极，但这次只看双电层这一分量。电极侧的负电荷增加，电解液侧的离子分布随之调整：Li⁺在近界面富集，同号的阴离子相对排开。两边电荷隔着界面相互影响，这就是双电层充电的直观画面。它没有发生对应的氧化还原电荷转移，是非法拉第过程的典型例子。",
          "可以想成玻璃两侧分别站着电子和离子，隔着界面排队。玻璃只是比喻，没有一块真玻璃堵在电池里，也不能把它直接当成 SEI。这里的关键是电子留在导电电极一侧，Li⁺仍在液相一侧；不需要随后一定进屋，双电层本身就可以完成储荷、放电。",
        ],
      },
      {
        heading: "只是排队，怎么也能储能",
        paragraphs: [
          "把正、负电荷分开，需要外部做功；建立起来的电荷分离和电场可以储存电能。条件反过来，电荷重新分布，就能向外电路释放这部分能量。和普通电容器有相通之处，只是在电极—电解液界面上，液相一侧有会移动的离子，也有会取向的溶剂。",
          "所以“没有氧化还原”不等于“没有电流”，更不等于“没有存电”。双电层充电时，外电路照样有电子移动，电解液中也有离子重排。电子有没有动，不能拿来区分这两个过程；要看这部分电流是否对应氧化还原反应。",
        ],
      },
      {
        heading: "在电池里是一个分量，在超级电容器里能挑大梁",
        paragraphs: [
          "常规石墨锂离子电池的主要可逆容量，通常来自嵌锂、脱锂等法拉第反应。双电层储荷当然存在，但不能把手机的主要续航都记到它账上。换成双电层超级电容器，事情就变了：利用较大的可接触表面积，界面电荷分离可以成为主要储能方式，用来提供功率脉冲、短时能量缓冲或能量回收。",
          "同一个机制，换个器件就换个分工。也别顺手把“超级电容器”都归成纯非法拉第，里面还可能有赝电容或混合储能机制。赝电容虽有电容响应，仍涉及法拉第过程；名称很像，干的事未必一样。",
        ],
      },
      {
        heading: "排在哪儿，还会影响后面的反应",
        paragraphs: [
          "界面不是空荡荡的门口。离子、溶剂排在哪里，局部电场和电位降怎样分布，都会影响反应物所处的环境，进而影响脱溶剂化、反应速率或分解路径。排队的人变了，门口的条件也跟着变；但这不能简单说成“排队越整齐，电池越好”。具体效果要看材料、电解液和工作条件。",
          "一项石墨负极研究通过 CoP 涂层改变双电层中的阴离子分布，进一步影响了 SEI 的形成，并改善快充表现。这正好把两件事连起来：双电层改变了反应环境，而形成 SEI 的电解液还原分解仍属于法拉第过程。保护效果是这些具体变化共同带来的，不能给非法拉第过程包办。",
        ],
      },
      {
        heading: "队排好了，不代表电场下班了",
        paragraphs: [
          "动画末尾粒子停下来，表示在固定电位、理想双电层这一简化条件下，充电逐渐趋于完成，相关电流衰减。已经形成的电荷分离和界面电场仍可存在。电位再次变化，双电层又会调整；不能把画面理解成电一接上，双电层忙几秒，以后永远没它的事。实际电池还可能同时有持续的法拉第电流。",
          "这两种过程可以同时发生，不必按顺序交班。动画分别播放，只是把不同的动作拆开看；真实界面还有溶剂化、SEI 和更复杂的离子分层。至于快慢，孔道、电阻、输运都能插一脚。先看电荷是通过反应储存，还是通过界面分离储存，再讨论它快不快、对这个器件有没有用。",
        ],
      },
    ],
    sources: [
      { title: "IUPAC Gold Book：double-layer current", url: "https://goldbook.iupac.org/terms/view/D01847" },
      { title: "IUPAC Gold Book：faradaic current", url: "https://goldbook.iupac.org/terms/view/F02321" },
      { title: "Merlet 等：纳米多孔碳中的双电层储能机制（2012）", url: "https://www.nature.com/articles/nmat3260" },
      { title: "Bang 等：Regulating electric double-layer dynamics…（2024）", url: "https://doi.org/10.1039/D4TA03703K" },
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
