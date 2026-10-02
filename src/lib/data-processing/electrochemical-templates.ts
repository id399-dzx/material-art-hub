import type { TableCell, TemplateId } from './templates.ts';
import type { ElectrochemicalChartSpec } from './electrochemistry.ts';

export type ElectrochemicalTemplate = {
    id: string;
    chartId: TemplateId;
    name: string;
    english: string;
    category: '电化学测试';
    description: string;
    requirement: string;
    tag: string;
    guide: string;
    xLabel: string;
    yLabel: string;
    demo: TableCell[][];
    preview: string;
    electrochemical: ElectrochemicalChartSpec;
};

type ElectrochemicalPreset = Omit<ElectrochemicalTemplate, 'category' | 'tag' | 'preview'>;
const preset = (item: ElectrochemicalPreset): ElectrochemicalTemplate => ({
    ...item,
    category: '电化学测试',
    tag: '电化学测试',
    preview: `/drawing-previews/${item.id}.svg`,
    guide: `${item.guide} 示例数值仅用于展示图式，不代表真实实验。`,
});

/** Independently authored examples; no experimental measurements or calculated performance claims. */
export const ELECTROCHEMICAL_TEMPLATES: ElectrochemicalTemplate[] = [
    preset({
        id: 'electrochem-cv', chartId: 'line', name: '循环伏安曲线 · CV', english: 'Cyclic voltammetry',
        description: '展示往返电位扫描中的电流变化，比较不同扫描速率或样品。',
        requirement: '电位 ＋ 一列或多列电流',
        guide: '按仪器采集顺序排列每一行，保留正反向扫描的重复电位和负电流。每个扫描速率或样品用一列电流；在列名中注明扫描速率，在电位轴名称中注明参比电极。曲线不按电位排序，也不自动平滑。',
        xLabel: 'Potential (V)', yLabel: 'Current (mA)', electrochemical: { kind: 'cv' },
        demo: [
            ['Potential (V)', '10 mV s⁻¹', '50 mV s⁻¹'],
            [-0.2, -0.08, -0.18], [-0.1, -0.02, -0.06], [0, 0.03, 0.08], [0.1, 0.09, 0.21],
            [0.2, 0.16, 0.36], [0.3, 0.31, 0.71], [0.4, 0.58, 1.18], [0.5, 0.72, 1.49],
            [0.6, 0.51, 1.08], [0.7, 0.32, 0.74], [0.8, 0.24, 0.58],
            [0.7, 0.11, 0.27], [0.6, 0.03, 0.07], [0.5, -0.08, -0.2], [0.4, -0.26, -0.57],
            [0.3, -0.47, -1.02], [0.2, -0.55, -1.19], [0.1, -0.38, -0.83],
            [0, -0.22, -0.51], [-0.1, -0.13, -0.3], [-0.2, -0.08, -0.18],
        ],
    }),
    preset({
        id: 'electrochem-gcd', chartId: 'line', name: '恒流充放电曲线 · GCD', english: 'Galvanostatic charge discharge',
        description: '以时间为横轴，观察恒流充电与放电的电位变化。',
        requirement: '时间 ＋ 一列或多列电位',
        guide: '时间列保持连续采集顺序，每列电位对应一个样品或电流条件。轴单位可改为秒、分钟及实际电压单位，列名可注明电流密度。保留放电起点的电位突变；模板不从曲线自动计算比电容、能量或功率。',
        xLabel: 'Time (s)', yLabel: 'Potential (V)', electrochemical: { kind: 'gcd' },
        demo: [
            ['Time (s)', '1 A g⁻¹'],
            [0, 0], [10, 0.1], [20, 0.21], [30, 0.32], [40, 0.43], [50, 0.54],
            [60, 0.65], [70, 0.76], [80, 0.87], [90, 0.98], [100, 1.08],
            [101, 0.99], [110, 0.9], [120, 0.8], [130, 0.7], [140, 0.6],
            [150, 0.5], [160, 0.4], [170, 0.3], [180, 0.2], [190, 0.1], [200, 0],
        ],
    }),
    preset({
        id: 'electrochem-charge-discharge', chartId: 'line', name: '电压–比容量曲线', english: 'Voltage capacity profile',
        description: '对照电池充电与放电的电压平台，或比较不同循环的容量曲线。',
        requirement: '比容量 ＋ 一列或多列电压',
        guide: '横轴填写已换算的容量或比容量，纵轴为电压；可分别绑定充电、放电及不同循环的电压列。多列曲线使用相同容量采样点，采样点不同则分别作图；无需补造缺失值。模板不自动按活性物质质量归一化。',
        xLabel: 'Specific capacity (mAh g⁻¹)', yLabel: 'Voltage (V)', electrochemical: { kind: 'charge-discharge' },
        demo: [
            ['Specific capacity (mAh g⁻¹)', 'Charge', 'Discharge'],
            [0, 2.65, 4.15], [10, 3.03, 3.82], [20, 3.26, 3.65], [30, 3.38, 3.57],
            [40, 3.44, 3.53], [50, 3.48, 3.5], [60, 3.51, 3.47], [70, 3.55, 3.43],
            [80, 3.6, 3.39], [90, 3.68, 3.31], [100, 3.79, 3.16], [110, 3.94, 2.87], [120, 4.2, 2.5],
        ],
    }),
    preset({
        id: 'electrochem-rate', chartId: 'line', name: '倍率性能', english: 'Rate capability',
        description: '展示逐级改变倍率或电流密度后，容量的变化与恢复。',
        requirement: '循环序号 ＋ 一列或多列容量',
        guide: '每行一圈，将实际容量按实验先后顺序填写。不同样品可放在独立容量列；在图题或列名中说明倍率方案。示例每 5 圈依次使用 0.2、0.5、1、2、5、0.2 A g⁻¹；C 倍率与 A g⁻¹ 不可直接等同。容量单位和倍率条件均由用户确认。',
        xLabel: 'Cycle number', yLabel: 'Specific capacity (mAh g⁻¹)', electrochemical: { kind: 'rate' },
        demo: [
            ['Cycle number', 'Sample A', 'Sample B'],
            [1, 172, 160], [2, 171, 159], [3, 172, 159], [4, 170, 158], [5, 171, 159],
            [6, 158, 145], [7, 159, 144], [8, 157, 143], [9, 158, 144], [10, 157, 144],
            [11, 143, 128], [12, 142, 127], [13, 143, 128], [14, 141, 126], [15, 142, 127],
            [16, 127, 108], [17, 126, 107], [18, 127, 108], [19, 125, 106], [20, 126, 107],
            [21, 105, 84], [22, 104, 83], [23, 105, 83], [24, 103, 82], [25, 104, 83],
            [26, 169, 154], [27, 168, 153], [28, 169, 154], [29, 167, 152], [30, 168, 153],
        ],
    }),
    preset({
        id: 'electrochem-cycle', chartId: 'dual-axis', name: '循环性能与库仑效率', english: 'Cycling performance',
        description: '容量与库仑效率共用循环序号，分别使用左右坐标轴。',
        requirement: '循环序号 ＋ 容量，库仑效率可选',
        guide: '第一列数值绑定容量，第二列可选库仑效率（百分数）；关闭效率列可只显示容量。容量保持率需自行计算后替换容量列，并同步修改轴名和单位。效率为百分数时填写 99.5 而非 0.995；模板不自动计算效率或容量保持率。',
        xLabel: 'Cycle number', yLabel: 'Specific capacity (mAh g⁻¹)',
        electrochemical: { kind: 'cycle', secondaryYLabel: 'Coulombic efficiency (%)' },
        demo: [
            ['Cycle number', 'Capacity', 'Coulombic efficiency (%)'],
            [1, 174, 91.2], [5, 171, 97.1], [10, 169, 98.3], [20, 166, 99.0],
            [30, 164, 99.2], [40, 162, 99.3], [50, 160, 99.4], [60, 159, 99.4],
            [70, 157, 99.5], [80, 156, 99.4], [90, 154, 99.5], [100, 152, 99.5],
        ],
    }),
    preset({
        id: 'electrochem-nyquist', chartId: 'line', name: '阻抗谱 · Nyquist', english: 'EIS Nyquist plot',
        description: '以实部阻抗为横轴、负虚部阻抗为纵轴展示阻抗谱。',
        requirement: 'Z′ ＋ −Z″，单位一致',
        guide: '横轴为阻抗实部 Z′，纵轴为负虚部 −Z″，两轴保持相同数值比例。若仪器导出的是 Im(Z) / Z″，在导入后选择“虚部取负”再绘图；若已经是 −Im(Z)，保持原值，避免重复取负。按频率扫描的原始顺序排列，模板不拟合等效电路或计算电荷转移电阻。',
        xLabel: 'Z′ (Ω)', yLabel: '−Z″ (Ω)', electrochemical: { kind: 'nyquist', equalAxes: true },
        demo: [
            ['Z′ (Ω)', '−Z″ (Ω)'],
            [2, 0.5], [4, 6], [8, 11], [13, 14], [20, 16], [28, 14], [36, 10],
            [43, 5], [49, 1], [55, 5], [63, 12], [73, 21], [85, 34],
        ],
    }),
    preset({
        id: 'electrochem-bode', chartId: 'dual-axis', name: '阻抗谱 · Bode', english: 'EIS Bode plot',
        description: '对数频率轴上同时展示阻抗模值与相位角。',
        requirement: '正频率 ＋ 正阻抗模值 ＋ 相位角',
        guide: '频率（Hz）和阻抗模值 |Z| 必须大于零，分别使用对数坐标；相位角（°）使用右侧线性坐标并保留正负号。按列绑定实测值，勿将 Z′ 直接当作 |Z|。模板不自动从复数阻抗推算模值或相位，也不拟合时间常数。',
        xLabel: 'Frequency (Hz)', yLabel: '|Z| (Ω)',
        electrochemical: { kind: 'bode', xLog: true, yLog: true, secondaryYLabel: 'Phase (°)' },
        demo: [
            ['Frequency (Hz)', '|Z| (Ω)', 'Phase (°)'],
            [100000, 4.2, -8], [30000, 4.6, -15], [10000, 6.2, -35], [3000, 12.5, -65],
            [1000, 28, -78], [300, 66, -71], [100, 140, -65], [30, 300, -54],
            [10, 535, -41], [3, 845, -25], [1, 1160, -14], [0.1, 1710, -8],
        ],
    }),
    preset({
        id: 'electrochem-lsv', chartId: 'line', name: '线性扫描伏安 · LSV', english: 'Linear sweep voltammetry',
        description: '比较单向电位扫描下的电流密度与极化响应。',
        requirement: '电位 ＋ 一列或多列电流密度',
        guide: '保留单向扫描的采集顺序及电流正负号。电位轴应注明实际参比电极；若改用过电位，需先完成参比换算并修改轴名。电流密度由用户按电极面积换算，模板不自动进行 iR 校正、归一化或 Tafel 拟合。',
        xLabel: 'Potential (V)', yLabel: 'Current density (mA cm⁻²)', electrochemical: { kind: 'lsv' },
        demo: [
            ['Potential (V)', 'Sample A', 'Sample B'],
            [-0.2, -0.18, -0.15], [-0.1, -0.08, -0.06], [0, 0.03, 0.02], [0.1, 0.1, 0.07],
            [0.2, 0.24, 0.13], [0.3, 0.8, 0.32], [0.4, 2.5, 0.85], [0.5, 6.5, 2.4],
            [0.6, 13.5, 5.8], [0.7, 24, 11.7], [0.8, 37, 20.5],
        ],
    }),
];
