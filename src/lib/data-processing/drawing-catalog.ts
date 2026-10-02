import { CHART_TEMPLATES, type TemplateId, type TableCell } from './templates.ts';
import { PAPER_FIGURES, type FigureRegion } from './paper-figures/catalog.ts';
import { paperDemoPoints } from './paper-figures/data.ts';

export const DRAWING_TYPES = ['柱状图', '组成图', '折线图', '散点图', '热图', '分布图', '雷达图', '三维图', '网络与流程'] as const;
export type DrawingType = typeof DRAWING_TYPES[number];
export type DrawingTemplate = {
    id: string; chartId: TemplateId; name: string; english: string; category: DrawingType;
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

// One representative per usable chart structure; source metrics are not new types.
const REPRESENTATIVES = [
    { engine: 'error-bar', id: 'paper-immuno-comparison-auroc' },
    { engine: 'horizontal-bar', id: 'paper-immuno-iedb-results-ablation-1' },
    { engine: 'percent-bar', id: 'paper-brainteaser-composition-composition-1' },
    { engine: 'line', id: 'paper-vigil-training-training' },
] as const;
const RETAINED_PAPER_IDS = new Set<string>([
    ...REPRESENTATIVES.map(item => item.id),
    'paper-ophthal-trend-text-trend',
    'paper-immuno-iedb-results-distribution',
]);
const paperTemplates: DrawingTemplate[] = PAPER_FIGURES.flatMap(figure => figure.regions.flatMap(region => {
    const id = panelTemplateId(figure.id, region.id), chartId = CHART_KIND[region.kind];
    if (!chartId || !RETAINED_PAPER_IDS.has(id)) return [];
    const replacement = REPRESENTATIVES.find(item => item.id === id);
    const base = CHART_TEMPLATES.find(item => item.id === (replacement?.engine ?? chartId))!;
    const area = region.kind === 'area', horizontal = region.kind === 'horizontal', violin = region.kind === 'violin';
    return [{
        id, chartId, category: TYPES[chartId], english: base.english,
        name: area ? '堆叠面积图' : horizontal ? '横向柱状与误差条' : violin ? '双组小提琴分布' : base.name,
        tag: '论文图式', description: area ? '用堆叠面积同时呈现各组变化与合计规模。' : horizontal ? '横向比较类别，可按数据需要开启或关闭误差条。' : violin ? '保留论文小提琴配色，展示两组或多组真实样本分布。' : base.description,
        requirement: region.kind === 'bars' || horizontal ? '类别 ＋ 数值列，误差可选' : base.requirement,
        guide: `${region.kind === 'bars' || horizontal ? '每行一个类别，每列一个系列。可以只提供数值；需要误差条时，选择独立重复实验或已计算的均值与误差列。' : base.guide} 不要求沿用原论文的组数、名称或数值范围。${area ? '面积按组堆叠；默认不对输入值再做累计。' : ''}`,
        xLabel: base.xLabel, yLabel: base.yLabel,
        // Compact, independently authored demos show reusable structure instead of paper-specific labels.
        demo: replacement && !horizontal ? base.demo : area ? CHART_TEMPLATES.find(item => item.id === 'trend')!.demo : panelDemoMatrix(region),
        preview: `/drawing-previews/${id}.svg`,
        paper: { figureId: figure.id, regionId: region.id, project: figure.project, figureName: figure.name, source: figure.source, region },
    }];
}));
const replacedEngines = new Set<string>(REPRESENTATIVES.map(item => item.engine));
export const DRAWING_TEMPLATES: DrawingTemplate[] = [
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
