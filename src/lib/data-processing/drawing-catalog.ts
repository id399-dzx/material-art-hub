import { CHART_TEMPLATES, type TemplateId, type TableCell } from './templates.ts';
import { PAPER_FIGURES, type FigureRegion } from './paper-figures/catalog.ts';
import type { PaperChartVariant } from './drawing-spec.ts';
import { ELECTROCHEMICAL_TEMPLATES } from './electrochemical-templates.ts';
import type { ElectrochemicalChartSpec } from './electrochemistry.ts';

export const DRAWING_TYPES = ['电化学测试', '柱状图', '组成图', '折线图', '散点图', '热图', '分布图', '雷达图', '三维图', '网络与流程'] as const;
export type DrawingType = typeof DRAWING_TYPES[number];
export type DrawingTemplate = {
    id: string; chartId: TemplateId; name: string; english: string; category: DrawingType;
    description: string; requirement: string; tag: string; guide: string; xLabel: string; yLabel: string;
    demo: TableCell[][]; preview: string;
    electrochemical?: ElectrochemicalChartSpec;
    variant?: PaperChartVariant;
    paper?: { figureId: string; regionId: string; project: string; figureName: string; source: string; region: FigureRegion };
};
const TYPES: Record<TemplateId, DrawingType> = {
    'grouped-bar': '柱状图', 'error-bar': '柱状图', 'horizontal-bar': '柱状图', 'multi-panel': '柱状图',
    'stacked-bar': '组成图', 'percent-bar': '组成图', line: '折线图', trend: '折线图', 'dual-axis': '折线图', concept: '折线图',
    scatter: '散点图', trajectory: '散点图', heatmap: '热图', box: '分布图', violin: '分布图', histogram: '分布图',
    radar: '雷达图', sphere: '三维图', surface: '三维图', network: '网络与流程', schematic: '网络与流程',
};
export function panelTemplateId(figureId: string, regionId: string) { return `paper-${figureId}-${regionId}`; }

/** Group only matching data semantics and structure, never merely a shared chart engine. */
export function paperStructureKey(figureId: string, region: FigureRegion): PaperChartVariant | null {
    switch (region.kind) {
        case 'image': return null;
        case 'bars': return 'mean-error';
        case 'horizontal': return 'horizontal-error';
        case 'stacked': return 'hatched-percent';
        case 'area': return 'stacked-area';
        case 'violin': return 'violin';
        case 'sphere': return 'sphere-points';
        case 'vectors': return 'spatial-vectors';
        case 'radar': return 'local-range-radar';
        case 'box': return 'grouped-box';
        case 'scatter': return region.id === 'peptide-scatter' ? 'position-scatter' : 'embedding-scatter';
        case 'heatmap':
            if (region.id.startsWith('density-')) return 'density-heatmap';
            if (region.id.endsWith('-frequency')) return 'frequency-heatmap';
            return 'attention-heatmap';
        case 'line':
            if (region.fillSeries) return 'filled-distribution';
            if (region.breakAfterX !== undefined || region.comparisonOffset !== undefined) return 'paired-correlation';
            if (region.series?.includes('SFT only')) return 'baseline-line';
            if (figureId === 'dispersion-observation') return 'dual-correlation';
            break;
    }
    // New source structures require an explicit decision instead of disappearing from the library.
    throw new Error(`Unmapped numerical paper region: ${figureId}/${region.id} (${region.kind})`);
}

export const PAPER_STRUCTURE_REPRESENTATIVES: Readonly<Record<PaperChartVariant, string>> = {
    'mean-error': 'paper-immuno-comparison-auroc',
    'horizontal-error': 'paper-immuno-iedb-results-ablation-1',
    'hatched-percent': 'paper-brainteaser-composition-composition-1',
    'baseline-line': 'paper-vigil-training-training',
    'stacked-area': 'paper-ophthal-trend-text-trend',
    violin: 'paper-immuno-iedb-results-distribution',
    'sphere-points': 'paper-dispersion-spheres-dispersion',
    'spatial-vectors': 'paper-dispersion-spheres-regularization',
    'local-range-radar': 'paper-vigil-radar-radar',
    'filled-distribution': 'paper-vigil-concept-distribution',
    'embedding-scatter': 'paper-immuno-iedb-results-embedding-4',
    'position-scatter': 'paper-immuno-iedb-results-peptide-scatter',
    'attention-heatmap': 'paper-immuno-iedb-results-attention',
    'frequency-heatmap': 'paper-immuno-iedb-results-high-frequency',
    'density-heatmap': 'paper-dispersion-observation-density-1',
    'grouped-box': 'paper-immuno-cedar-results-vaccine-box',
    'dual-correlation': 'paper-dispersion-observation-correlation-1',
    'paired-correlation': 'paper-dispersion-distillation-correlation',
};

export type PaperTemplateCoverage = {
    figureId: string;
    regionId: string;
    variant: PaperChartVariant;
    representativeId: string;
};

/** All numerical source panels have a traceable retained representative; image-only panels are excluded. */
export const PAPER_TEMPLATE_COVERAGE: PaperTemplateCoverage[] = PAPER_FIGURES.flatMap(figure => figure.regions.flatMap(region => {
    const variant = paperStructureKey(figure.id, region);
    if (!variant) return [];
    return [{ figureId: figure.id, regionId: region.id, variant,
        // Never collapse distinct violin source panels, including future additions.
        representativeId: variant === 'violin' ? panelTemplateId(figure.id, region.id) : PAPER_STRUCTURE_REPRESENTATIVES[variant] }];
}));

// These four existing cards also serve advisor requests for their original engine IDs.
const REPRESENTATIVES = [
    { engine: 'error-bar', id: PAPER_STRUCTURE_REPRESENTATIVES['mean-error'] },
    { engine: 'horizontal-bar', id: PAPER_STRUCTURE_REPRESENTATIVES['horizontal-error'] },
    { engine: 'percent-bar', id: PAPER_STRUCTURE_REPRESENTATIVES['hatched-percent'] },
    { engine: 'line', id: PAPER_STRUCTURE_REPRESENTATIVES['baseline-line'] },
] as const;

type PaperPreset = {
    chartId: TemplateId;
    name: string;
    english: string;
    description: string;
    requirement: string;
    guide: string;
    xLabel: string;
    yLabel: string;
    demo: TableCell[][];
};

/** Every example below is independently authored demonstration data, not measurements from the source papers. */
const PAPER_PRESETS: Record<PaperChartVariant, PaperPreset> = {
    'mean-error': {
        chartId: 'error-bar', name: '均值与误差条', english: 'Mean and uncertainty',
        description: '按类别比较数值或均值，误差条按需要开启。', requirement: '类别 ＋ 数值列，误差可选',
        guide: '每行一个类别，每列一个系列。误差条需绑定真实重复实验，或已计算的均值与 SD / SEM；可关闭误差条只显示数值。',
        xLabel: '样品', yLabel: '测量值',
        demo: [['样品', 'Mean', 'SD'], ['Sample A', 12.4, 1.2], ['Sample B', 18.6, 1.5], ['Sample C', 23.1, 1.8], ['Sample D', 16.3, 1.1]],
    },
    'horizontal-error': {
        chartId: 'error-bar', name: '横向柱状与误差条', english: 'Horizontal comparison',
        description: '横向排列条件，比较数值并显示可选误差范围。', requirement: '类别 ＋ 数值列，误差可选',
        guide: '每行一个实验条件。类别与数值分别绑定，误差列可选；真实重复实验与已计算的 SD / SEM 应明确区分。',
        xLabel: '实验条件', yLabel: '测量值',
        demo: [['实验条件', 'Mean', 'SD'], ['Condition A', 0.86, 0.014], ['Condition B', 0.8, 0.017], ['Condition C', 0.74, 0.013], ['Condition D', 0.67, 0.022]],
    },
    'hatched-percent': {
        chartId: 'percent-bar', name: '百分比组成图', english: 'Hatched percentage composition',
        description: '用颜色与纹理区分组成成分，比较各类别的相对比例。', requirement: '类别 ＋ 各组成成分数值',
        guide: '每行一个类别，组成列需完整且非负。按行总量转换为百分比；可切换纹理，颜色和组名均可修改。',
        xLabel: '类别', yLabel: '组成 (%)',
        demo: [['类别', 'Component A', 'Component B', 'Component C', 'Component D'], ['Sample A', 24, 31, 18, 27], ['Sample B', 36, 21, 28, 15], ['Sample C', 17, 36, 31, 16], ['Sample D', 29, 24, 13, 34]],
    },
    'baseline-line': {
        chartId: 'line', name: '基线与多组折线', english: 'Baseline and measured curves',
        description: '固定基线与多条实验曲线共用真实数值横轴。', requirement: '数值 X ＋ 基线与曲线 Y 列',
        guide: '常量输入系列作为虚线基线，其余为测量曲线；不自动计算基线。保持输入行的顺序与 X 间距，不自动排序或平滑。',
        xLabel: 'Step', yLabel: 'Response',
        demo: [['Step', 'Baseline', 'Method A', 'Method B', 'Method C'], [0, 20, 20, 20, 20], [100, 20, 26, 24, 28], [250, 20, 34, 30, 39], [400, 20, 39, 34, 48], [600, 20, 43, 37, 53]],
    },
    'stacked-area': {
        chartId: 'line', name: '堆叠面积图', english: 'Stacked area over numeric time',
        description: '保留真实时间间距，用面积对照各组变化与合计规模。', requirement: '数值时间 ＋ 各组非负数值',
        guide: '输入每个时间点已测量或已累计的各组数值。面积按组堆叠，不沿时间自动求和；数值横轴保留不等间距时间，可切换纹理。',
        xLabel: 'Time', yLabel: 'Count',
        demo: [['Time', 'Group A', 'Group B'], [0, 4, 2], [3, 8, 3], [7, 14, 7], [12, 23, 11], [20, 35, 18], [28, 46, 26]],
    },
    violin: {
        chartId: 'violin', name: '双组小提琴分布', english: 'Violin distribution',
        description: '保留独立样本分布与组间比较，展示实际样本数量。', requirement: '样品组 ＋ 单个样本测量值',
        guide: '每行填写一个真实样本观测；不要用均值、误差条或人工补点代替分布。图中的核密度仅用于描述分布，不自动生成显著性或 p 值。',
        xLabel: '样品组', yLabel: '测量值',
        demo: [['样品组', '测量值'], ...[0.11, 0.15, 0.19, 0.22, 0.25, 0.28, 0.31, 0.36, 0.4, 0.48, 0.54, 0.62].map(value => ['Group A', value]), ...[0.39, 0.45, 0.52, 0.58, 0.64, 0.69, 0.73, 0.78, 0.82, 0.85, 0.89, 0.94].map(value => ['Group B', value])],
    },
    'sphere-points': {
        chartId: 'sphere', name: '球面参考与 XYZ 点云', english: 'XYZ points with a spherical guide',
        description: '用 XYZ 实测坐标展示三维点云，可开关球面参考。', requirement: 'X ＋ Y ＋ Z 数值坐标',
        guide: '每行一个三维点，输入坐标按原值显示，不自动单位化到球面。球面仅作参考，不恢复原图的机制结论、策略箭头或装饰标注。',
        xLabel: 'X', yLabel: 'Y',
        demo: [['X', 'Y', 'Z'], [0.72, 0.34, 0.6], [0.45, 0.78, 0.41], [-0.22, 0.87, 0.44], [-0.74, 0.38, 0.54], [-0.88, -0.3, 0.28], [-0.31, -0.89, -0.26], [0.4, -0.74, -0.54], [0.86, -0.24, -0.36], [0.24, 0.32, -0.88], [-0.48, -0.24, -0.82]],
    },
    'spatial-vectors': {
        chartId: 'sphere', name: '三维坐标向量', english: 'Spatial vectors from the origin',
        description: '按真实 XYZ 坐标显示由原点出发的空间向量。', requirement: '向量 X ＋ Y ＋ Z 分量',
        guide: '每行一根向量，X、Y、Z 为同一坐标系中的分量。保留长度差异，不自动归一化；不恢复原机制示意的排斥策略或因果箭头。',
        xLabel: 'X', yLabel: 'Y',
        demo: [['X', 'Y', 'Z'], [1.4, 0.3, 0.6], [-0.8, 1.2, 0.9], [-1.1, -0.7, 0.3], [0.5, -1.4, -0.4], [0.2, 0.6, 1.7], [-0.3, 0.4, -1.2]],
    },
    'local-range-radar': {
        chartId: 'radar', name: '独立量程雷达', english: 'Radar with individual axis scales',
        description: '为各个指标采用独立刻度，保留不同数值量级。', requirement: '至少 3 个指标 ＋ 各模型非负数值列',
        guide: '每行一个指标，每列一个模型。各轴按自身数据范围确定刻度，不能把不同单位的原值解释为同一尺度的绝对优劣；指标名与原始数值保持对应，不限制原论文的指标数和范围。',
        xLabel: '指标', yLabel: '原始数值',
        demo: [['指标', 'Model A', 'Model B', 'Model C'], ['Metric A (%)', 82, 87, 91], ['Metric B (ms)', 220, 170, 135], ['Metric C', 0.62, 0.71, 0.83], ['Metric D', 18, 24, 31], ['Metric E', 1200, 1850, 2300], ['Metric F (%)', 64, 73, 81]],
    },
    'filled-distribution': {
        chartId: 'line', name: '填充分布曲线与差异标注', english: 'Filled distribution comparison',
        description: '以实测或已计算的曲线比较分布，并标注指定 X 处的差异。', requirement: '数值 X ＋ 两列或多列曲线 Y',
        guide: '输入已测量或自行计算的密度 / 响应值，每列一条曲线。可修改参考位置与标注文字；模板不把稀疏点自动变成概率密度，也不生成统计显著性。',
        xLabel: 'X', yLabel: 'Density',
        demo: [['X', 'Curve A', 'Curve B', 'Curve C'], ...Array.from({ length: 41 }, (_, i) => {
            const x = Number((-1 + i / 20).toFixed(3));
            return [x, Number(Math.exp(-(((x + 0.35) / 0.25) ** 2)).toFixed(4)), Number((0.18 + 0.32 * Math.exp(-(((x + 0.2) / 0.5) ** 2))).toFixed(4)), Number((0.9 * Math.exp(-(((x - 0.38) / 0.3) ** 2))).toFixed(4))];
        })],
    },
    'embedding-scatter': {
        chartId: 'scatter', name: '分组嵌入散点', english: 'Grouped embedding scatter',
        description: '各组样本使用独立 XY 坐标，比较嵌入分布。', requirement: 'X ＋ Y ＋ 组别（长表）',
        guide: '每行一个样本，X、Y 是同一个样本的坐标，组别列区分类别。各组可有不同样本数和坐标，不需拼成同一 X 网格，也不自动计算降维嵌入。',
        xLabel: 'X', yLabel: 'Y',
        demo: [['X', 'Y', 'Group'], [-0.82, -0.12, 'Group A'], [-0.65, 0.22, 'Group A'], [-0.57, -0.28, 'Group A'], [-0.45, 0.35, 'Group A'], [-0.38, 0.04, 'Group A'], [-0.31, -0.2, 'Group A'], [-0.17, 0.29, 'Group A'], [-0.1, 0.1, 'Group A'], [0.16, -0.18, 'Group B'], [0.27, 0.23, 'Group B'], [0.36, -0.35, 'Group B'], [0.43, 0.09, 'Group B'], [0.56, 0.32, 'Group B'], [0.62, -0.1, 'Group B'], [0.73, 0.16, 'Group B'], [0.88, -0.24, 'Group B']],
    },
    'position-scatter': {
        chartId: 'scatter', name: '位置分组散点', english: 'Measurements grouped by position',
        description: '在离散数值位置保留多次观测及其组别。', requirement: '位置类别 ＋ 测量值 ＋ 组别（长表）',
        guide: '每行一次测量，重复的位置编号需保留。不同组在同一位置可以有多条观测，不自动求平均、补零或添加抖动。',
        xLabel: 'Position', yLabel: 'Measurement',
        demo: [['Position', 'Measurement', 'Group'], ...[[0.04, 0.12, 0.23], [0.07, 0.34, 0.62], [0.03, 0.21, 0.45], [0.11, 0.46, 0.77], [0.02, 0.16, 0.31], [0.06, 0.28, 0.53]].flatMap((values, index) => values.flatMap(value => [[index + 1, value, 'Group A'], [index + 1, Number((value * 0.65 + 0.04).toFixed(3)), 'Group B']]))],
    },
    'attention-heatmap': {
        chartId: 'heatmap', name: '稀疏注意力矩阵', english: 'Sparse attention matrix',
        description: '用稀疏强度单元格比较行列位置之间的关联。', requirement: '行位置 ＋ 各列位置的强度矩阵',
        guide: '第一列为行标签，其他列名为列位置；单元格可填真实强度或带正负号的注意力差分，差分使用发散色标。零值与空缺分开处理，空缺不自动补零；不从输入文本自动推算注意力。',
        xLabel: 'Column position', yLabel: 'Row position',
        demo: [['行位置', '1', '2', '3', '4', '5', '6', '7', '8'], ['1', 0, 0, 0, 2.4, 0, 0, 0.2, 0], ['2', 0, -0.7, 0, 0, 0, 3.8, 0, 0], ['3', 0.3, 0, 0, 0, 1.2, 0, 0, 0], ['4', 0, 0, 4.7, 0, 0, 0, -1.6, 0], ['5', 0, 0.4, 0, 0, 0, 0, 0, 3.1]],
    },
    'frequency-heatmap': {
        chartId: 'heatmap', name: '分类频率热图', english: 'Category frequency heatmap',
        description: '按类别与位置排列频数，保留原始分类标签。', requirement: '位置 ＋ 各类别频数矩阵',
        guide: '第一列为位置或行标签，其余列名为类别。填入已统计的非负频数、频率或比例，并修改色标与单位说明；模板不自动从原始样本推算频率。',
        xLabel: 'Category', yLabel: 'Position',
        demo: [['位置', 'A', 'C', 'G', 'T', 'U', 'Other'], ['1', 18, 7, 11, 25, 9, 4], ['2', 8, 28, 16, 5, 13, 7], ['3', 12, 10, 34, 8, 6, 3], ['4', 21, 14, 9, 19, 7, 5], ['5', 6, 11, 23, 14, 28, 8]],
    },
    'density-heatmap': {
        chartId: 'heatmap', name: '数值坐标密度热图', english: 'Density on numeric coordinates',
        description: '保留非等间距数值 XY 坐标，展示已计算的二维密度或强度。', requirement: '数值 Y ＋ 数值 X 列名 ＋ 密度矩阵',
        guide: '第一列为数值 Y，其他列名为数值 X；单元格填已计算密度或强度。坐标间距按原值呈现，空单元格不补零。模板不从样本自动计算二维密度，不添加未经输入的拟合线。',
        xLabel: 'X coordinate', yLabel: 'Y coordinate',
        demo: [['Y / X', '0', '0.12', '0.35', '0.6', '0.8', '1'], [-0.2, 0.4, 0.2, null, null, null, null], [0, 4.6, 1.3, 0.5, 0.2, null, null], [0.2, 1.1, 5.8, 3.4, 0.6, 0.3, null], [0.45, 0.3, 0.7, 5.3, 6.7, 1.6, 0.4], [0.7, null, 0.2, 0.9, 3.2, 7.8, 3.1], [1, null, null, 0.3, 0.8, 2.7, 6.4]],
    },
    'grouped-box': {
        chartId: 'box', name: '分组箱线与原始样本', english: 'Grouped sample box plots',
        description: '每个类别内并排比较各组分布，保留原始样本点。', requirement: '类别 ＋ 测量值 ＋ 组别（长表）',
        guide: '每行一个真实观测，类别与组别分别绑定，保持组内并排布局。样本太少时仅显示真实观测，不绘制未经支持的分布；不将类别和组名合并为单一标签，不人工生成重复样本。',
        xLabel: '类别', yLabel: 'Measurement',
        demo: [['类别', '测量值', 'Group'], ...[['Sample A', [1.2, 1.4, 1.7, 1.8, 2, 2.3], [1.8, 2, 2.2, 2.5, 2.7, 3]], ['Sample B', [1.6, 1.9, 2.1, 2.3, 2.6, 2.8], [2.3, 2.5, 2.8, 3.1, 3.3, 3.6]], ['Sample C', [1.4, 1.7, 2, 2.2, 2.5, 2.7], [2, 2.2, 2.5, 2.7, 3, 3.2]]].flatMap(([category, control, treatment]) => [...(control as number[]).map(value => [category as string, value, 'Control']), ...(treatment as number[]).map(value => [category as string, value, 'Treatment'])])],
    },
    'dual-correlation': {
        chartId: 'dual-axis', name: '双轴相关性比较', english: 'Two correlation measures',
        description: '分别用左右坐标轴显示两种已计算的相关系数。', requirement: '数值 X ＋ 两列相关系数',
        guide: '两列 Y 分别绑定左右轴，使用自己已计算的相关系数。模板不从曲线自动计算 Spearman、Kendall 或统计显著性；两轴量程可不同，应核对轴名与单位。',
        xLabel: 'Model size', yLabel: 'Spearman ρ',
        demo: [['Model size', 'Spearman ρ', 'Kendall τ'], [1.5, 0.9, 0.81], [7, 0.81, 0.67], [14, 0.69, 0.48], [32, 0.43, 0.29]],
    },
    'paired-correlation': {
        chartId: 'dual-axis', name: '分条件配对相关性', english: 'Paired correlation conditions',
        description: '分开排列两个条件，以虚线连接同一模型的对应测量。', requirement: '模型 ＋ 指标 1 ＋ 指标 2 ＋ 条件（长表）',
        guide: '每个模型在两个条件下分别占一行；同名模型在条件之间配对，不依赖固定组数或位置偏移。两列指标应完整；缺失模型配对会提示并保留已有数据，不补造配对、不自动计算指标，也不把两个条件连接成连续趋势。',
        xLabel: 'Model', yLabel: 'Metric 1',
        demo: [['Model', 'Metric 1', 'Metric 2', 'Condition'], ['Model A', 0.86, 0.78, 'Condition A'], ['Model B', 0.61, 0.53, 'Condition A'], ['Model C', 0.33, 0.24, 'Condition A'], ['Model A', 0.88, 0.8, 'Condition B'], ['Model B', 0.7, 0.61, 'Condition B'], ['Model C', 0.4, 0.3, 'Condition B']],
    },
};

const paperTemplates: DrawingTemplate[] = PAPER_FIGURES.flatMap(figure => figure.regions.flatMap(region => {
    const variant = paperStructureKey(figure.id, region);
    if (!variant) return [];
    const id = panelTemplateId(figure.id, region.id);
    if (variant !== 'violin' && PAPER_STRUCTURE_REPRESENTATIVES[variant] !== id) return [];
    const preset = PAPER_PRESETS[variant];
    return [{
        ...preset, id, variant, category: TYPES[preset.chartId], tag: '论文图式',
        guide: `${preset.guide} 组数、名称和数值范围由你的数据决定。示例为独立编写的演示数据，不代表原论文实验结果。`,
        preview: `/drawing-previews/${id}.svg`,
        paper: { figureId: figure.id, regionId: region.id, project: figure.project, figureName: figure.name, source: figure.source, region },
    }];
}));
const replacedEngines = new Set<string>(REPRESENTATIVES.map(item => item.engine));
export const DRAWING_TEMPLATES: DrawingTemplate[] = [
    ...ELECTROCHEMICAL_TEMPLATES,
    ...CHART_TEMPLATES.filter(template => !replacedEngines.has(template.id)).map(template => ({
        ...template, chartId: template.id, category: TYPES[template.id], preview: `/drawing-previews/${template.id}.svg`,
    })),
    ...paperTemplates,
];

/** Advisor and main-data import still use chart engine IDs, including replaced cards. */
export function drawingTemplateForChart(chartId: TemplateId): DrawingTemplate {
    const representative = REPRESENTATIVES.find(item => item.engine === chartId);
    const template = DRAWING_TEMPLATES.find(item => item.id === (representative?.id ?? chartId));
    if (!template) throw new Error(`Missing representative for ${chartId}`);
    return template;
}
