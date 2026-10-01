export type TemplateId = "line" | "grouped-bar" | "error-bar" | "horizontal-bar" | "stacked-bar" | "percent-bar" | "radar" | "heatmap" | "scatter" | "trend" | "dual-axis" | "multi-panel" | "concept" | "sphere" | "surface" | "trajectory" | "network" | "schematic";
export type TemplateCategory = "比较" | "组成" | "曲线" | "矩阵" | "空间" | "示意";
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["比较", "组成", "曲线", "矩阵", "空间", "示意"];
export const isNumericX = (id: TemplateId) => ["line", "scatter", "dual-axis", "concept", "sphere", "surface", "trajectory"].includes(id);
export const isSpatial = (id: TemplateId) => id === "sphere" || id === "surface";
export const isGraph = (id: TemplateId) => id === "network" || id === "schematic";
export const isBar = (id: TemplateId) => ["grouped-bar", "error-bar", "horizontal-bar", "stacked-bar", "percent-bar", "multi-panel"].includes(id);
export type ErrorMeasure = "SD" | "SEM";
export type ErrorInput = "replicates" | "summary";
export type TableCell = string | number | null;
export type DataTable = { columns: string[]; rows: TableCell[][]; firstDataRow: number };
export type ColumnMapping = { x: number; ys: number[]; errors: Record<number, number> };
export type TemplateSeries = { name: string; values: number[]; errors?: number[]; sampleSizes?: number[] };
export type TemplateData = { x: (number | string)[]; series: TemplateSeries[]; skipped: number; warnings: string[]; edges?: { source: string; target: string; weight: number }[] };
export type TemplateResult = { data: TemplateData | null; error: string | null };

export const CHART_TEMPLATES: {
    id: TemplateId; name: string; english: string; description: string; requirement: string;
    tag: string; category: TemplateCategory; guide: string; reference: string; xLabel: string; yLabel: string; demo: TableCell[][];
}[] = [
    {
        id: "line", name: "多组折线图", english: "MULTI-SERIES LINE", tag: "趋势与曲线", category: "曲线", guide: "一列数值 X 对应多列 Y，按原始点顺序连接，不平滑或插值。", reference: "figure_VIGIL/plot_posttraining.py",
        description: "让变化有迹可循，清晰比较不同样品的实验曲线。",
        requirement: "1 列数值 X ＋ 1 列或多列 Y", xLabel: "循环次数", yLabel: "容量保持率 (%)",
        demo: [["循环次数", "样品 A", "样品 B", "样品 C"], [0, 100, 100, 100], [20, 98, 96, 95], [40, 96, 91, 89], [60, 94, 86, 82], [80, 92, 81, 76], [100, 90, 76, 70]],
    },
    {
        id: "grouped-bar", name: "分组柱状图", english: "GROUPED COMPARISON", tag: "多组比较", category: "比较", guide: "每行一个类别，每列一种方法或样品；柱状图保留零基线。", reference: "figure_CellSpliceNet/plot_comparison.py",
        description: "并排呈现多组结果，让实验条件之间的差异一目了然。",
        requirement: "1 列类别 ＋ 1 列或多列数值", xLabel: "测试条件", yLabel: "比容量 (mAh/g)",
        demo: [["测试条件", "样品 A", "样品 B", "样品 C"], ["0.2 C", 158, 143, 129], ["0.5 C", 146, 131, 117], ["1 C", 132, 115, 103], ["2 C", 115, 98, 84]],
    },
    {
        id: "error-bar", name: "均值与误差条", english: "MEAN & UNCERTAINTY", tag: "重复实验", category: "比较", guide: "每行一个样品。可以选独立重复实验列计算 SD / SEM，或直接绑定已计算的均值和误差。", reference: "figure_ImmunoStruct/plot_bars.py",
        description: "同时表达实验均值与波动，明确标注 SD 或 SEM。",
        requirement: "类别 ＋ 重复实验列，或均值 ＋ 误差列", xLabel: "样品", yLabel: "测试结果",
        demo: [["样品", "重复 1", "重复 2", "重复 3"], ["样品 A", 132, 140, 136], ["样品 B", 155, 147, 151], ["样品 C", 164, 172, 168], ["样品 D", 180, 170, 175]],
    },

    {
        id: "horizontal-bar", name: "横向比较图", english: "HORIZONTAL COMPARISON", tag: "长标签", category: "比较",
        description: "横向排列方法或样品，适合较长的类别名称。", requirement: "类别 ＋ 多列数值",
        guide: "每行一个类别，每列一个数值系列，横向柱保留零基线。", reference: "figure_ImmunoStruct/plot_bars.py",
        xLabel: "方法", yLabel: "得分", demo: [["方法", "任务 A", "任务 B"], ["对照方法", 65, 72], ["改进方法", 78, 81], ["完整方法", 86, 89]],
    },
    {
        id: "stacked-bar", name: "堆叠组成图", english: "STACKED COMPOSITION", tag: "组成分解", category: "组成",
        description: "同时呈现总量与各部分的组成。", requirement: "类别 ＋ 非负组成数值",
        guide: "每行一个类别，各列是可相加的组成部分。值需非负且采用相同单位。", reference: "figure_Brainteaser/plot_brute_force.py",
        xLabel: "条件", yLabel: "数量", demo: [["条件", "正确", "部分正确", "未通过"], ["对照", 42, 21, 37], ["方案 A", 61, 24, 15], ["方案 B", 75, 17, 8]],
    },
    {
        id: "percent-bar", name: "百分比组成图", english: "NORMALIZED COMPOSITION", tag: "占比比较", category: "组成",
        description: "将每组总量归一到 100%，比较组成比例。", requirement: "类别 ＋ 非负组成数值",
        guide: "每行的组成值会除以该行总量并乘以 100；总量须大于零。导出图中明确标注百分比。", reference: "figure_Brainteaser/plot_brute_force.py",
        xLabel: "条件", yLabel: "占比 (%)", demo: [["条件", "成分 A", "成分 B", "成分 C"], ["样品 1", 24, 16, 10], ["样品 2", 18, 30, 12], ["样品 3", 36, 12, 12]],
    },
    {
        id: "radar", name: "多指标雷达图", english: "RADAR COMPARISON", tag: "指标画像", category: "比较",
        description: "在一个轮廓中比较多种方法的各项指标。", requirement: "至少 3 行指标 ＋ 多列数值",
        guide: "每行一个指标，每列一个方法。数值须非负；每个指标的轴上限分别标示，原始值不归一化。不同单位的指标应谨慎比较。", reference: "figure_VIGIL/plot_comparison_radar.py",
        xLabel: "指标", yLabel: "得分", demo: [["指标", "方法 A", "方法 B", "方法 C"], ["准确率", 83, 75, 90], ["召回率", 76, 81, 87], ["稳定性", 89, 72, 91], ["效率", 68, 91, 77], ["鲁棒性", 82, 70, 88]],
    },
    {
        id: "heatmap", name: "矩阵热图", english: "MATRIX HEATMAP", tag: "二维数值", category: "矩阵",
        description: "用色阶与数值标签呈现矩阵差异。", requirement: "行标签 ＋ 多列数值",
        guide: "首列是行名称，其余列是矩阵列。色阶采用全部选中数值的统一范围，支持负数。", reference: "figure_RNAGenScape/plot_comparison.py; figure_ophthal_review/plot_composition.py",
        xLabel: "方法", yLabel: "指标", demo: [["方法", "指标 A", "指标 B", "指标 C", "指标 D"], ["对照", 0.52, 0.61, 0.48, 0.55], ["方案 A", 0.71, 0.68, 0.75, 0.69], ["方案 B", 0.84, 0.79, 0.88, 0.81]],
    },
    {
        id: "scatter", name: "多组散点图", english: "SCATTER COMPARISON", tag: "数据分布", category: "空间",
        description: "保留每个观测点，展示变量之间的关系。", requirement: "数值 X ＋ 多列 Y",
        guide: "一行一个观测点，共用数值 X。不同 Y 列为不同系列，不自动拟合回归线。", reference: "figure_VIGIL/plot_concept.py; figure_Dispersion/plot_idea.py",
        xLabel: "变量 X", yLabel: "变量 Y", demo: [["变量 X", "组 A", "组 B"], [1, 2.1, 3.2], [2, 3.7, 2.9], [3, 3.1, 4.4], [4, 5.3, 3.8], [5, 5.7, 5.1], [6, 6.2, 4.9]],
    },
    {
        id: "trend", name: "时间趋势与累计图", english: "TEMPORAL TRENDS", tag: "时间序列", category: "曲线",
        description: "呈现时间变化，并可切换累计量。", requirement: "时间标签 ＋ 多列数值",
        guide: "每行一个时间点，按表格原始顺序绘制。开启累计后逐行求和，需先按时间顺序整理数据。", reference: "figure_ophthal_review/plot_trend.py",
        xLabel: "月份", yLabel: "数量", demo: [["月份", "类别 A", "类别 B"], ["1 月", 5, 3], ["2 月", 8, 5], ["3 月", 6, 7], ["4 月", 12, 8], ["5 月", 15, 11], ["6 月", 18, 13]],
    },
    {
        id: "dual-axis", name: "双轴参数曲线", english: "DUAL AXIS SWEEP", tag: "不同单位", category: "曲线",
        description: "用左右坐标轴分别呈现两个不同量纲的指标。", requirement: "数值 X ＋ 恰好 2 列 Y",
        guide: "第一列 Y 对应左轴，第二列 Y 对应右轴。两轴独立刻度，不应通过曲线高度比较数值大小。", reference: "figure_VIGIL/plot_ablation.py",
        xLabel: "参数", yLabel: "准确率 (%)", demo: [["参数", "准确率 (%)", "耗时 (s)"], [0.1, 71, 2.2], [0.2, 78, 3.5], [0.3, 84, 5.1], [0.4, 87, 7.4], [0.5, 88, 10.2]],
    },
    {
        id: "multi-panel", name: "多指标分面比较", english: "MULTI METRIC PANELS", tag: "多面板", category: "比较",
        description: "每个指标独立一个面板，比较方法或消融结果。", requirement: "方法名称 ＋ 1–6 列指标",
        guide: "每行一个方法，每个选中指标生成独立面板。可切换数值 X 的参数扫描折线；各面板使用各自坐标范围，不跨面板直接比较柱高。", reference: "figure_CellSpliceNet/plot_ablation.py; figure_Cflows/plot_comparison_Ablation.py; figure_RNAGenScape/plot_sweep.py",
        xLabel: "方法", yLabel: "指标", demo: [["方法", "准确率 (%)", "召回率 (%)", "效率 (次/s)", "稳健得分"], ["对照", 72, 65, 40, 0.61], ["去除模块 A", 79, 73, 48, 0.74], ["完整方法", 87, 82, 55, 0.89]],
    },
    {
        id: "concept", name: "概念曲线与差异标注", english: "CONCEPTUAL CURVES", tag: "机制表达", category: "示意",
        description: "对比概念曲线，突出两条曲线间的区域与指定位置。", requirement: "数值 X ＋ 至少 2 列 Y",
        guide: "前两条曲线之间着色，可指定一条竖直标注线。数据来自输入表格；示例仅说明概念，不是概率拟合或真实实验。", reference: "figure_VIGIL/plot_concept.py",
        xLabel: "变量 X", yLabel: "响应", demo: [["变量 X", "模型 A", "模型 B"], [0, 0.08, 0.04], [0.2, 0.3, 0.12], [0.4, 0.75, 0.33], [0.6, 0.85, 0.58], [0.8, 0.4, 0.72], [1, 0.1, 0.23]],
    },
    {
        id: "sphere", name: "三维球面与向量", english: "SPHERE AND VECTORS", tag: "三维投影", category: "空间",
        description: "展示球面、三维点与从原点出发的向量。", requirement: "数值 X、Y、Z 三列",
        guide: "输入实际三维坐标，可调整方位角与仰角。背景为半径 1 的参考球；不会自动单位化向量。SVG / PNG 导出当前视角。", reference: "figure_Dispersion/plot_illustration.py; figure_Dispersion/plot_idea.py",
        xLabel: "X", yLabel: "Y", demo: [["X", "Y", "Z"], [0.8, 0.6, 0], [-0.6, 0.8, 0], [0, 0.6, 0.8], [0.4, -0.3, 0.86], [-0.7, -0.5, 0.5], [0.2, 0.3, -0.93]],
    },
    {
        id: "surface", name: "三维曲面与流形", english: "SURFACE AND MANIFOLD", tag: "网格曲面", category: "空间",
        description: "将规则网格上的三维数值呈现为可调视角的曲面。", requirement: "规则网格的 X、Y、Z 三列",
        guide: "每行一个网格顶点，仅连接相邻 X / Y 的完整四角，不补齐缺失顶点。X、Y 同坐标不能重复；可保留孔洞。", reference: "figure_RNAGenScape/plot_manifold.py; figure_RNAGenScape/plot_hole_manifold.py",
        xLabel: "X", yLabel: "Y", demo: [["X", "Y", "Z"], ...Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => { const x = (i - 4) / 2, y = (j - 4) / 2; return [x, y, Number((Math.sin(x) * Math.cos(y)).toFixed(4))]; })).flat()],
    },
    {
        id: "trajectory", name: "二维流形与轨迹", english: "EMBEDDING TRAJECTORIES", tag: "空间路径", category: "空间",
        description: "展示空间点及按输入顺序连接的轨迹。", requirement: "数值 X ＋ 多列 Y",
        guide: "点按表格原始顺序连接，不按 X 排序。适合嵌入坐标与轨迹；不进行降维、流形学习或模型推断。", reference: "figure_Cflows/diffusion_swiss_roll.py; figure_VIGIL/plot_concept.py",
        xLabel: "嵌入 X", yLabel: "嵌入 Y", demo: [["嵌入 X", "轨迹 A", "轨迹 B"], [0, 0, 0.3], [1, 0.5, 0.9], [2, 1.5, 1.9], [2.5, 2.8, 3.2], [1.5, 3.2, 3.6], [0.5, 2.6, 3], [-0.5, 1.2, 1.6]],
    },
    {
        id: "network", name: "关系网络图", english: "RELATIONSHIP NETWORK", tag: "点与连接", category: "空间",
        description: "根据真实边表展示节点及相互关系。", requirement: "起点、终点 ＋ 可选非负权重",
        guide: "一行一条连接，起点与终点可以是文本名称。圆形布局仅安排节点位置，不代表坐标或距离；不自动推断连接。", reference: "figure_Cflows/diffusion_swiss_roll.py",
        xLabel: "起点", yLabel: "终点", demo: [["起点", "终点", "权重"], ["A", "B", 1], ["A", "C", 2], ["B", "D", 1], ["C", "D", 3], ["D", "E", 2], ["C", "E", 1]],
    },
    {
        id: "schematic", name: "流程与框架示意", english: "METHOD SCHEMATIC", tag: "流程框架", category: "示意",
        description: "把步骤关系转为带箭头的可导出方法框架。", requirement: "起始步骤、后续步骤",
        guide: "每行一条有向连接，由表格中的步骤名称自动生成节点。无环流程从左到右分层，有环关系采用圆形布局。", reference: "assets/ImmunoStruct_schematic.png; assets/RNAGenScape_schematic.png",
        xLabel: "起始步骤", yLabel: "后续步骤", demo: [["起始步骤", "后续步骤"], ["实验数据", "质量检查"], ["质量检查", "特征提取"], ["特征提取", "分析 A"], ["特征提取", "分析 B"], ["分析 A", "结果核验"], ["分析 B", "结果核验"]],
    },
];

export function numericCell(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
}

export function parseTemplateTable(matrix: unknown[][], hasHeader = true): DataTable {
    const nonempty = matrix.map((row, index) => ({ row, index })).filter(({ row }) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ""));
    if (!nonempty.length) return { columns: [], rows: [], firstDataRow: hasHeader ? 2 : 1 };
    const width = nonempty.reduce((maximum, { row }) => Math.max(maximum, row.length), 0);
    const names = new Map<string, number>();
    const columns = Array.from({ length: width }, (_, index) => {
        const name = hasHeader ? String(nonempty[0].row[index] ?? "").trim() || `第 ${index + 1} 列` : `第 ${index + 1} 列`;
        const count = (names.get(name) ?? 0) + 1;
        names.set(name, count);
        return count === 1 ? name : `${name} (${count})`;
    });
    // Preserve blank rows inside the table, so warnings retain original row numbers.
    const start = nonempty[0].index + (hasHeader ? 1 : 0);
    return {
        columns,
        firstDataRow: start + 1,
        rows: matrix.slice(start).map(row => Array.from({ length: width }, (_, index) => {
            const value = row[index];
            return value === null || value === undefined ? null : typeof value === "number" ? value : String(value).trim();
        })),
    };
}

export function suggestMapping(table: DataTable, template: TemplateId, panelChart: "bar" | "line" = "bar"): ColumnMapping {
    const numeric = table.columns.map((_, index) => index).filter(index => table.rows.some(row => numericCell(row[index]) !== null));
    const x = (isNumericX(template) || template === "multi-panel" && panelChart === "line") ? numeric[0] ?? 0 : 0;
    const errorIndices = table.columns.map((name, index) => /\b(?:sd|sem|std|error)\b|标准差|标准误|误差/i.test(name) ? index : -1).filter(index => index >= 0);
    const ys = numeric.filter(index => index !== x && !errorIndices.includes(index));
    if (isGraph(template)) return { x: 0, ys: [1, ...(template === "network" && numeric.includes(2) ? [2] : [])], errors: {} };
    if (isSpatial(template)) return { x, ys: numeric.filter(index => index !== x).slice(0, 2), errors: {} };
    if (template === "dual-axis") return { x, ys: ys.slice(0, 2), errors: {} };
    const errors: Record<number, number> = {};
    ys.forEach((y, index) => { if (errorIndices[index] !== undefined) errors[y] = errorIndices[index]; });
    return { x, ys, errors };
}

export function sampleStatistics(values: number[], measure: ErrorMeasure) {
    if (values.length < 2 || values.some(value => !Number.isFinite(value))) throw new Error("每组至少需要 2 个有效重复实验值。");
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    return { mean, error: measure === "SD" ? sd : sd / Math.sqrt(values.length), n: values.length };
}

export function buildTemplateData(table: DataTable, mapping: ColumnMapping, template: TemplateId, input: ErrorInput = "replicates", measure: ErrorMeasure = "SD", panelChart: "bar" | "line" = "bar"): TemplateResult {
    const fail = (error: string): TemplateResult => ({ data: null, error });
    const numericX = isNumericX(template) || template === "multi-panel" && panelChart === "line";
    if (!table.rows.length) return fail("表格中没有数据，请导入文件或载入示例。");
    if (!Number.isInteger(mapping.x) || !table.columns[mapping.x]) return fail("请选择有效的 X 轴或类别列。");
    if (!mapping.ys.length) return fail("至少选择 1 列 Y 数据。");
    if (new Set(mapping.ys).size !== mapping.ys.length || mapping.ys.some(index => !Number.isInteger(index) || !table.columns[index] || index === mapping.x)) return fail("X 列和 Y 列需要分别选择，且 Y 列不能重复。");
    if (isGraph(template)) return buildGraphData(table, mapping, template);
    if (isSpatial(template) && mapping.ys.length !== 2) return fail("三维图需要分别绑定 X、Y、Z 三列数值。");
    if (template === "dual-axis" && mapping.ys.length !== 2) return fail("双轴图需要恰好选择 2 列 Y 数据，分别对应左轴和右轴。");
    if (template === "concept" && mapping.ys.length < 2) return fail("概念曲线至少需要 2 列 Y 数据，用于显示曲线之间的差异区域。");
    if (template === "multi-panel" && mapping.ys.length > 6) return fail("多面板最多选择 6 列指标，请减少选择。");
    const repeats = template === "error-bar" && input === "replicates";
    if (repeats && mapping.ys.length < 2) return fail("计算 SD 或 SEM 至少需要选择 2 列重复实验数据。");
    if (template === "error-bar" && input === "summary" && mapping.ys.some(y => !Number.isInteger(mapping.errors[y]) || !table.columns[mapping.errors[y]] || mapping.errors[y] === mapping.x || mapping.ys.includes(mapping.errors[y]))) return fail("请为每组均值绑定独立的误差列。");

    const series: TemplateSeries[] = repeats ? [{ name: "实验均值", values: [], errors: [], sampleSizes: [] }] : mapping.ys.map(index => ({ name: table.columns[index], values: [], ...(template === "error-bar" ? { errors: [] } : {}) }));
    const xValues: (string | number)[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    const categories = new Set<string>();
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const row = table.rows[rowIndex];
        if (row.every(value => value === null || value === "")) continue;
        const rawX = row[mapping.x];
        const x = (isNumericX(template) || template === "multi-panel" && panelChart === "line") ? numericCell(rawX) : rawX === null || rawX === "" ? null : String(rawX);
        const values = mapping.ys.map(index => numericCell(row[index]));
        const errors = template === "error-bar" && !repeats ? mapping.ys.map(y => numericCell(row[mapping.errors[y]])) : [];
        const invalid = x === null || values.some(value => value === null) || errors.some(value => value === null || value < 0);
        if (invalid) {
            skipped++;
            if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + rowIndex} 行含空值、非数值或负误差，已整行跳过。`);
            continue;
        }
        if (!numericX && template !== "trend" && categories.has(String(x))) return fail(`类别「${x}」重复。请先汇总为每个类别一行，再选择重复实验列或均值与误差列。`);
        categories.add(String(x));
        xValues.push(x!);
        if (repeats) {
            const stats = sampleStatistics(values as number[], measure);
            series[0].values.push(stats.mean);
            series[0].errors!.push(stats.error);
            series[0].sampleSizes!.push(stats.n);
        } else {
            series.forEach((item, index) => {
                item.values.push(values[index]!);
                if (item.errors) item.errors.push(errors[index]!);
            });
        }
    }
    if (!xValues.length) return fail("所选列没有可绘制的完整数据。请检查列绑定和数值格式；误差值应为非负数。");
    if (["stacked-bar", "percent-bar", "radar"].includes(template) && series.some(item => item.values.some(value => value < 0))) return fail("组成图与雷达图需要非负数值，请检查输入。");
    if (template === "percent-bar" && xValues.some((_, row) => series.reduce((sum, item) => sum + item.values[row], 0) <= 0)) return fail("百分比组成图的每行总量必须大于零。");
    if (template === "radar" && xValues.length < 3) return fail("雷达图至少需要 3 个不同指标（3 行有效数据）。");
    if (isSpatial(template) && xValues.length > 2500) return fail("三维模板最多支持 2500 个顶点，请精简数据。");
    if (template === "surface") {
        const points = new Set<string>();
        xValues.forEach((x, i) => points.add(`${x},${series[0].values[i]}`));
        if (points.size !== xValues.length) return fail("曲面中存在重复 X / Y 坐标，请确保每个网格位置只有一个 Z 值。");
        const xs = [...new Set(xValues as number[])].sort((a, b) => a - b);
        const ys = [...new Set(series[0].values)].sort((a, b) => a - b);
        if (xs.length * ys.length > 10000) return fail("曲面网格范围过大，请使用最多 10000 个网格位置的规则网格数据。");
        if (!xs.slice(1).some((x, i) => ys.slice(1).some((y, j) => [[xs[i], ys[j]], [x, ys[j]], [x, y], [xs[i], y]].every(([px, py]) => points.has(`${px},${py}`))))) return fail("曲面至少需要一个完整的网格四角（2 个 X × 2 个 Y），不会对散点自动插值。");
    }
    return { data: { x: xValues, series, skipped, warnings }, error: null };
}

export function matrixToCsv(matrix: TableCell[][]): string {
    return "\uFEFF" + matrix.map(row => row.map(cell => {
        const text = String(cell ?? "");
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(",")).join("\r\n");
}

function buildGraphData(table: DataTable, mapping: ColumnMapping, template: TemplateId): TemplateResult {
    const target = mapping.ys[0], weight = mapping.ys[1];
    if (mapping.ys.length > (template === "network" ? 2 : 1)) return { data: null, error: "关系图需要一列终点，网络图可额外指定一列权重。" };
    const edges: { source: string; target: string; weight: number }[] = [], warnings: string[] = [];
    const nodes = new Set<string>(); let skipped = 0;
    table.rows.forEach((row, i) => {
        if (row.every(value => value === null || value === "")) return;
        const a = String(row[mapping.x] ?? "").trim(), b = String(row[target] ?? "").trim();
        const w = weight === undefined ? 1 : numericCell(row[weight]);
        if (!a || !b || w === null || w < 0) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + i} 行缺少节点名称或有效非负权重，已跳过。`); return; }
        nodes.add(a); nodes.add(b); edges.push({ source: a, target: b, weight: w });
    });
    if (!edges.length) return { data: null, error: "没有有效连接，请绑定起点、终点和可选权重列。" };
    if (nodes.size > 100 || edges.length > 500) return { data: null, error: "关系图最多支持 100 个节点和 500 条连接，请精简表格。" };
    return { data: { x: [...nodes], series: [], edges, skipped, warnings }, error: null };
}

export const PANEL_SWEEP_DEMO: TableCell[][] = [["参数", "指标 A", "指标 B", "指标 C"], [0.1, 62, 0.41, 12], [0.2, 71, 0.55, 15], [0.3, 78, 0.68, 18], [0.4, 82, 0.76, 21], [0.5, 84, 0.79, 24]];
