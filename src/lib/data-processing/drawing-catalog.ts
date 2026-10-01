import { CHART_TEMPLATES, type TemplateId, type TableCell } from './templates.ts';
import { PAPER_FIGURES, type FigureRegion } from './paper-figures/catalog.ts';
import { paperDemoPoints } from './paper-figures/data.ts';

export const DRAWING_TYPES = ['柱状图', '组成图', '折线图', '散点图', '热图', '分布图', '雷达图', '三维图', '网络与流程', '机制插图'] as const;
export type DrawingType = typeof DRAWING_TYPES[number];
export type DrawingTemplate = {
    id: string; chartId: TemplateId | null; name: string; english: string; category: DrawingType;
    description: string; requirement: string; tag: string; guide: string; xLabel: string; yLabel: string;
    demo: TableCell[][]; preview: string;
    paper?: { figureId: string; regionId: string; project: string; figureName: string; source: string; region: FigureRegion };
};
const TYPES: Record<TemplateId, DrawingType> = {
    'grouped-bar': '柱状图', 'error-bar': '柱状图', 'horizontal-bar': '柱状图', 'multi-panel': '柱状图',
    'stacked-bar': '组成图', 'percent-bar': '组成图', line: '折线图', trend: '折线图', 'dual-axis': '折线图', concept: '折线图',
    scatter: '散点图', trajectory: '散点图', heatmap: '热图', box: '分布图', violin: '分布图', histogram: '分布图',
    radar: '雷达图', sphere: '三维图', surface: '三维图', network: '网络与流程', schematic: '网络与流程',
};
const CHART_KIND: Record<FigureRegion['kind'], TemplateId | null> = {
    bars: 'error-bar', horizontal: 'error-bar', stacked: 'percent-bar', line: 'line', area: 'trend', scatter: 'scatter',
    heatmap: 'heatmap', radar: 'radar', sphere: 'sphere', vectors: 'sphere', surface: 'surface', violin: 'violin', box: 'box', image: null,
};
const NAMES: Record<FigureRegion['kind'], string> = {
    bars: '柱状与误差', horizontal: '横向比较与误差', stacked: '纹理组成', line: '趋势曲线', area: '堆叠面积', scatter: '散点关系',
    heatmap: '矩阵热图', radar: '多指标雷达', sphere: '三维球面', vectors: '空间向量', surface: '三维曲面', violin: '小提琴分布', box: '样本箱线', image: '机制 / 结构插图',
};
export function panelTemplateId(figureId: string, regionId: string) { return `paper-${figureId}-${regionId}`; }

/** Demonstration data only. The editor binds user columns without original paper keys or limits. */
export function panelDemoMatrix(region: FigureRegion): TableCell[][] {
    const points = paperDemoPoints(region);
    if (region.kind === 'image') return [];
    if (['sphere', 'vectors', 'surface'].includes(region.kind)) return [['X', 'Y', 'Z'], ...points.map(p => [p.x, p.y, p.z ?? null])];
    if (region.kind === 'box' || region.kind === 'violin') {
        const multiple = new Set(points.map(p => p.series)).size > 1;
        return [['样品组', '测量值'], ...points.map(p => [multiple ? `${p.x} · ${p.series}` : p.x, p.y])];
    }
    if (region.kind === 'heatmap') {
        const xs = [...new Set(points.map(p => p.x))], ys = [...new Set(points.map(p => p.y))];
        return [['行 / Y', ...xs.map(String)], ...ys.map(y => [String(y), ...xs.map(x => points.find(p => p.x === x && p.y === y)?.z ?? null)])];
    }
    const xs = [...new Set(points.map(p => p.x))], series = [...new Set(points.map(p => p.series))];
    const error = region.kind === 'bars' || region.kind === 'horizontal';
    return [['X / 类别', ...series.flatMap(name => error ? [name === 'value' ? '均值' : name, `${name} SD`] : [name])], ...xs.map(x => [x,
        ...series.flatMap(name => { const p = points.find(p => p.x === x && p.series === name); return error ? [p?.y ?? null, p?.error ?? null] : [p?.y ?? null]; }),
    ])];
}

export const DRAWING_TEMPLATES: DrawingTemplate[] = [
    ...CHART_TEMPLATES.map(template => ({ ...template, chartId: template.id, category: TYPES[template.id], preview: `/data-templates/${template.id}.svg` })),
    ...PAPER_FIGURES.flatMap(figure => figure.regions.map(region => {
        const chartId = CHART_KIND[region.kind], base = CHART_TEMPLATES.find(t => t.id === chartId);
        const id = panelTemplateId(figure.id, region.id);
        return {
            id, chartId, name: `${NAMES[region.kind]} · ${region.name.replace(/^[a-z] · /, '')}`, english: figure.project.toUpperCase(),
            category: chartId ? TYPES[chartId] : '机制插图' as DrawingType, tag: chartId ? '论文单图' : '独立插图',
            description: chartId ? `取自「${figure.name}」中的单个绘图区，系列与类别由你的数据决定。` : `取自「${figure.name}」的独立插图，可单独替换图片与标注。`,
            requirement: ['bars','horizontal'].includes(region.kind) ? '类别 ＋ 数值列，误差可选' : base?.requirement ?? 'PNG / JPEG / WebP 图片',
            guide: chartId ? `${['bars','horizontal'].includes(region.kind) ? '每行一个类别，每列一个系列。可以只提供数值；需要误差条时，明确选择独立重复实验或已计算的均值与误差列。' : base!.guide} 不要求沿用原论文的组数、名称或数值范围。${region.kind === 'area' ? '输入各组已累计的数值，不自动累加；面积按组堆叠。' : ''}` : '此模板是机制或结构插图，使用图片和文字编辑。',
            xLabel: base?.xLabel ?? '', yLabel: base?.yLabel ?? '', demo: panelDemoMatrix(region), preview: `/paper-panels/${id}-preview.webp`,
            paper: { figureId: figure.id, regionId: region.id, project: figure.project, figureName: figure.name, source: figure.source, region },
        };
    })),
];
