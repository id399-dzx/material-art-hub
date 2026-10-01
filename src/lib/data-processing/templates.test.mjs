import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { buildTemplateData, CHART_TEMPLATES, matrixToCsv, parseTemplateTable, sampleStatistics, suggestMapping } from './templates.ts';
import { createTemplateOption } from './template-chart.ts';

test('SD uses the sample denominator and SEM uses the actual number of replicates', () => {
    assert.deepEqual(sampleStatistics([2, 4, 6], 'SD'), { mean: 4, error: 2, n: 3 });
    assert.deepEqual(sampleStatistics([2, 4, 6], 'SEM'), { mean: 4, error: 2 / Math.sqrt(3), n: 3 });
    assert.throws(() => sampleStatistics([4], 'SD'), /至少/);
});

test('incomplete numeric rows are skipped as whole rows, zeroes are retained and line order is preserved', () => {
    const table = parseTemplateTable([['x', 'a', 'b'], [2, 0, 10], [3, null, 12], [1, 5, 15], [0, 'bad', 20]]);
    const result = buildTemplateData(table, { x: 0, ys: [1, 2], errors: {} }, 'line');
    assert.deepEqual(result.data.x, [2, 1]);
    assert.deepEqual(result.data.series.map(series => series.values), [[0, 5], [10, 15]]);
    assert.equal(result.data.skipped, 2);
    assert.match(result.data.warnings[0], /第 3 行/);
});

test('summary data detects error columns, does not recompute them and excludes negative errors', () => {
    const table = parseTemplateTable([['样品', '均值', 'SD'], ['A', 10, 2], ['B', 12, -1], ['C', 0, 0]]);
    const mapping = suggestMapping(table, 'error-bar');
    assert.deepEqual(mapping, { x: 0, ys: [1], errors: { 1: 2 } });
    const result = buildTemplateData(table, mapping, 'error-bar', 'summary', 'SEM');
    assert.deepEqual(result.data.x, ['A', 'C']);
    assert.deepEqual(result.data.series[0].errors, [2, 0]);
    assert.equal(result.data.skipped, 1);
});

test('replicate data never fills missing values, and insufficient or duplicate categories are rejected', () => {
    const table = parseTemplateTable([['样品', '重复1', '重复2', '重复3'], ['A', 2, 4, 6], ['B', 1, null, 3]]);
    const mapping = suggestMapping(table, 'error-bar');
    const result = buildTemplateData(table, mapping, 'error-bar', 'replicates', 'SD');
    assert.deepEqual(result.data.x, ['A']);
    assert.deepEqual(result.data.series[0], { name: '实验均值', values: [4], errors: [2], sampleSizes: [3] });
    assert.equal(result.data.skipped, 1);
    assert.equal(buildTemplateData(table, { ...mapping, ys: [1] }, 'error-bar').data, null);
    assert.match(buildTemplateData(parseTemplateTable([['类别', '值'], ['A', 2], ['A', 3]]), { x: 0, ys: [1], errors: {} }, 'grouped-bar').error, /重复/);
});

test('headerless input and duplicate column names preserve all data and original row numbers', () => {
    const noHeader = parseTemplateTable([[0, 10], [1, 11]], false);
    assert.deepEqual(noHeader.columns, ['第 1 列', '第 2 列']);
    assert.deepEqual(noHeader.rows, [[0, 10], [1, 11]]);
    const table = parseTemplateTable([[null, null], ['x', '值', '值'], [0, 1, 2], [null, null, null], [1, 'bad', 3]]);
    assert.deepEqual(table.columns, ['x', '值', '值 (2)']);
    assert.equal(table.firstDataRow, 3);
    assert.match(buildTemplateData(table, { x: 0, ys: [1, 2], errors: {} }, 'line').data.warnings[0], /第 5 行/);
});

test('every template produces a real SVG with its own demonstration data', () => {
    for (const template of CHART_TEMPLATES) {
        const table = parseTemplateTable(template.demo);
        const { data, error } = buildTemplateData(table, suggestMapping(table, template.id), template.id);
        assert.equal(error, null);
        const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
        try {
            const option = createTemplateOption(data, template.id, { title: '示例数据', xLabel: '类别', yLabel: '数值', fontFamily: 'Arial', fontSize: 13, palette: 'journal', showGrid: false, showValues: false, errorMeasure: 'SD' });
            chart.setOption(option);
            const svg = chart.renderToSVGString();
            assert.match(svg, /<svg/);
            assert.match(svg, /<path/);
            assert.match(svg, /示例数据/);
            assert.doesNotMatch(svg, /NaN|Infinity/);
            if (template.id === 'error-bar') {
                assert.match(svg, /±SD/);
                assert.equal(option.series.filter(series => series.type === 'custom').length, 1);
                assert.equal(option.series[0].name, option.series[1].name);
            }
        } finally { chart.dispose(); }
    }
});

test('black and white styling retains visible error caps at the grouped bar center', () => {
    const data = { x: ['A'], series: [{ name: 'one', values: [10], errors: [2] }, { name: 'two', values: [20], errors: [3] }], skipped: 0, warnings: [] };
    const option = createTemplateOption(data, 'error-bar', { title: 'test', xLabel: 'x', yLabel: 'y', fontFamily: 'Arial', fontSize: 13, palette: 'mono', showGrid: false, showValues: false, errorMeasure: 'SD' });
    const errorSeries = option.series.filter(series => series.type === 'custom');
    assert.deepEqual(errorSeries[1].data, [[0, 17, 23]]);
    assert.equal(option.legend.selectedMode, false);
    const glyph = errorSeries[1].renderItem({}, { value: index => [0, 17, 23][index], coord: ([x, y]) => [100 + x, 400 - y], barLayout: () => [{ width: 20, offsetCenter: -15 }, { width: 20, offsetCenter: 15 }] });
    assert.equal(glyph.children[0].shape.x1, 115);
    assert.equal(glyph.children[0].shape.y1, 383);
    assert.equal(glyph.children[0].shape.y2, 377);
    assert.ok(option.series[0].itemStyle.decal);
});

test('CSV demonstrations quote commas and embedded double quotes correctly', () => {
    assert.equal(matrixToCsv([['a,b', 'a"b'], [0, null]]), '\uFEFF"a,b","a""b"\r\n0,');
});

test('the catalog covers all audited figure families with examples and data instructions', () => {
    assert.equal(CHART_TEMPLATES.length, 18);
    assert.equal(new Set(CHART_TEMPLATES.map(item => item.id)).size, 18);
    for (const item of CHART_TEMPLATES) { assert.ok(item.guide); assert.ok(item.reference); assert.ok(item.demo.length > 1); }
});

const chartStyle = { title: 'QA', xLabel: 'x', yLabel: 'y', fontFamily: 'Arial', fontSize: 13, palette: 'journal', showGrid: false, showValues: false, errorMeasure: 'SD' };
const demoData = id => {
    const template = CHART_TEMPLATES.find(item => item.id === id), table = parseTemplateTable(template.demo);
    return buildTemplateData(table, suggestMapping(table, id), id).data;
};
test('percent composition totals 100 per row while leaving source values unchanged', () => {
    const data = demoData('percent-bar'), original = structuredClone(data);
    const option = createTemplateOption(data, 'percent-bar', chartStyle);
    data.x.forEach((_, row) => assert.ok(Math.abs(option.series.reduce((sum, series) => sum + series.data[row], 0) - 100) < 1e-10));
    assert.deepEqual(data, original);
    const zero = parseTemplateTable([['condition', 'a', 'b'], ['A', 0, 0]]);
    assert.match(buildTemplateData(zero, suggestMapping(zero, 'percent-bar'), 'percent-bar').error, /大于零/);
});
test('cumulative trends, dual axes and radar preserve their stated data semantics', () => {
    const trend = demoData('trend');
    assert.deepEqual(createTemplateOption(trend, 'trend', { ...chartStyle, cumulative: true }).series[0].data, [5, 13, 19, 31, 46, 64]);
    assert.deepEqual(createTemplateOption(trend, 'trend', chartStyle).series[0].data, trend.series[0].values);
    const dual = createTemplateOption(demoData('dual-axis'), 'dual-axis', chartStyle);
    assert.deepEqual(dual.series.map(series => series.yAxisIndex), [0, 1]);
    const radar = demoData('radar'), option = createTemplateOption(radar, 'radar', chartStyle);
    assert.deepEqual(option.series[0].data[0].value, radar.series[0].values);
    assert.ok(option.radar.indicator.every(item => item.name.includes('上限')));
});
test('surface grids keep holes and reject duplicate coordinates instead of interpolating', async () => {
    const { surfaceFaces, rotatePoint } = await import('./template-chart-spatial.ts');
    const points = Array.from({ length: 3 }, (_, x) => Array.from({ length: 3 }, (_, y) => [x, y, x + y])).flat();
    assert.equal(surfaceFaces(points).length, 4);
    assert.equal(surfaceFaces(points.slice(1)).length, 3);
    assert.deepEqual(rotatePoint([2, 3, 4], 0, 0), [2, 4, 3]);
    const table = parseTemplateTable([['x', 'y', 'z'], [0, 0, 1], [0, 0, 2], [1, 1, 3]]);
    assert.match(buildTemplateData(table, suggestMapping(table, 'surface'), 'surface').error, /重复/);
});
test('graph input retains named nodes, zero weights and explicitly supplied edges', () => {
    const table = parseTemplateTable([['source', 'target', 'weight'], ['A', 'B', 0], ['B', 'C', 2], ['C', '', 1], ['C', 'D', -1]]);
    const result = buildTemplateData(table, suggestMapping(table, 'network'), 'network');
    assert.deepEqual(result.data.edges, [{ source: 'A', target: 'B', weight: 0 }, { source: 'B', target: 'C', weight: 2 }]);
    assert.deepEqual(result.data.x, ['A', 'B', 'C']);
    assert.equal(result.data.skipped, 2);
});

test('parameter panels use numeric X and retain paired row order in every independent axis', () => {
    const table = parseTemplateTable([['parameter', 'accuracy', 'cost'], [2, 90, 8], [1, 85, 4], [3, null, 10]]);
    const mapping = suggestMapping(table, 'multi-panel', 'line');
    const { data } = buildTemplateData(table, mapping, 'multi-panel', 'replicates', 'SD', 'line');
    assert.deepEqual(data.x, [2, 1]);
    assert.equal(data.skipped, 1);
    const option = createTemplateOption(data, 'multi-panel', { ...chartStyle, panelChart: 'line' });
    assert.deepEqual(option.xAxis.map(axis => axis.type), ['value', 'value']);
    assert.deepEqual(option.series.map(series => series.data), [[[2, 90], [1, 85]], [[2, 8], [1, 4]]]);
    assert.deepEqual(option.series.map(series => series.yAxisIndex), [0, 1]);
});
