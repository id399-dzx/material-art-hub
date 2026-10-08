import assert from 'node:assert/strict';
import test from 'node:test';
import * as echarts from 'echarts';
import { buildTemplateData, parseTemplateTable, suggestMapping } from './templates.ts';
import { createTemplateOption } from './template-chart.ts';
import { calendarDateTimestamp } from './extended-gallery-data.ts';

const fixtures = {
    'waterfall-2d': [['Stage', 'Change'], ['Initial', 10], ['Loss', -15], ['Recovery', 4], ['Unchanged', 0]],
    sankey: [['Source', 'Target', 'Flow'], ['Raw material', 'Process A', 60], ['Raw material', 'Process B', 40], ['Process A', 'Product', 48], ['Process A', 'Loss', 12], ['Process B', 'Product', 35], ['Process B', 'Loss', 5]],
    funnel: [['Stage', 'Count'], ['Screened', 120], ['Eligible', 85], ['Included', 97], ['Empty', 0]],
    treemap: [['Path', 'Count'], ['Material/Carbon/Graphite', 40], ['Material/Carbon/Graphene', 25], ['Material/Metal/Aluminum', 20], ['Material/Metal/Copper', 0]],
    sunburst: [['Path', 'Count'], ['Material/Carbon/Graphite', 40], ['Material/Carbon/Graphene', 25], ['Material/Metal/Aluminum', 20], ['Material/Metal/Copper', 0]],
    'correlation-matrix': [['Variable', 'A', 'B', 'C'], ['C', -.28, -.45, 1], ['A', 1, .72, -.28], ['B', .72, 1, -.45]],
    'confusion-matrix': [['Actual', 'A', 'B', 'C'], ['A', 30, 2, 0], ['B', 3, 29, 1], ['C', 0, 4, 28]],
    'calendar-heatmap': [['Date', 'Signal'], ['2026-01-05', 12], ['2026-01-02', 0], ['2026-01-10', -3], ['2026-01-25', 21]],
};
const build = (id, matrix = fixtures[id]) => {
    const table = parseTemplateTable(matrix); return buildTemplateData(table, suggestMapping(table, id), id);
};
const style = { title: 'Scientific data', xLabel: 'Input label', yLabel: 'Measured value', fontFamily: 'Arial', fontSize: 14, palette: 'journal', scalarPalette: 'viridis', showGrid: false, showValues: false, errorMeasure: 'SD', width: 680, height: 420 };

test('all eight distinct gallery engines bind examples without modifying source matrices', () => {
    for (const [id, fixture] of Object.entries(fixtures)) {
        const original = structuredClone(fixture), result = build(id);
        assert.equal(result.error, null, `${id}: ${result.error}`);
        assert.ok(result.data); assert.deepEqual(fixture, original);
    }
});

test('2D waterfall retains signed changes, crossing-zero cumulative intervals, order, and true zeros', () => {
    const data = build('waterfall-2d').data;
    assert.deepEqual(data.series[0].values, [10, -15, 4, 0]);
    const option = createTemplateOption(data, 'waterfall-2d', style);
    assert.deepEqual(option.series[0].data, [[0, 0, 10, 10], [1, 10, -5, -15], [2, -5, -1, 4], [3, -1, -1, 0]]);
    const twoValues = parseTemplateTable([['Stage', 'Change', 'Extra'], ['A', 1, 2]]);
    assert.match(buildTemplateData(twoValues, { x: 0, ys: [1, 2], errors: {} }, 'waterfall-2d').error, /恰好一列/);
});

test('Sankey validates directed acyclic positive measured flow and retains individual edges', () => {
    const result = build('sankey');
    assert.equal(result.data.edges.length, 6);
    assert.deepEqual(result.data.edges[0], { source: 'Raw material', target: 'Process A', weight: 60 });
    assert.match(build('sankey', [['From', 'To', 'Flow'], ['A', 'B', 1], ['B', 'A', 2]]).error, /循环/);
    assert.match(build('sankey', [['From', 'To', 'Flow'], ['A', 'A', 1]]).error, /自循环/);
    assert.match(build('sankey', [['From', 'To', 'Flow'], ['A', 'B', 0]]).error, /大于零/);
    assert.match(build('sankey', [['From', 'To'], ['A', 'B']]).error, /有效|流量/);
});

test('funnel preserves supplied stage order, increases, and zero values instead of sorting', () => {
    const data = build('funnel').data, option = createTemplateOption(data, 'funnel', style);
    assert.equal(option.series[0].sort, 'none');
    assert.deepEqual(option.series[0].data.map(item => item.value), [120, 85, 97, 0]);
    assert.match(build('funnel', [['Stage', 'Count'], ['A', -1]]).error, /非负/);
});

test('hierarchies aggregate supplied leaf values, retain zero leaves, and reject duplicate or overlapping paths', () => {
    const data = build('treemap').data;
    assert.equal(data.hierarchy[0].value, 85);
    assert.equal(data.hierarchy[0].children[0].value, 65);
    assert.equal(data.hierarchy[0].children[1].children[1].value, 0);
    assert.equal(createTemplateOption(build('sunburst').data, 'sunburst', style).series[0].sort, null);
    assert.match(build('treemap', [['Path', 'Count'], ['A/B', 2], ['A/B', 3]]).error, /重复/);
    assert.match(build('sunburst', [['Path', 'Count'], ['A', 3], ['A/B', 2]]).error, /重复计数/);
    assert.match(build('treemap', [['Path', 'Count'], ['A//B', 2]]).error, /空层级/);
    assert.match(build('sunburst', [['Path', 'Count'], ['A/B', -2]]).error, /非负/);
});

test('correlation matrix aligns row labels without changing supplied coefficients', () => {
    const data = build('correlation-matrix').data;
    assert.deepEqual(data.x, ['A', 'B', 'C']);
    assert.deepEqual(data.matrixCells, [[0, 0, 1], [1, 0, .72], [2, 0, -.28], [0, 1, .72], [1, 1, 1], [2, 1, -.45], [0, 2, -.28], [1, 2, -.45], [2, 2, 1]]);
    assert.match(build('correlation-matrix', [['Row', 'A', 'B'], ['A', 1, .2], ['B', .3, 1]]).error, /不对称/);
    assert.match(build('correlation-matrix', [['Row', 'A', 'B'], ['A', .9, .2], ['B', .2, 1]]).error, /对角线/);
    assert.match(build('correlation-matrix', [['Row', 'A', 'B'], ['A', 1, 2], ['B', 2, 1]]).error, /超出/);
});

test('confusion matrix uses unnormalized integer counts and matching class labels', () => {
    const data = build('confusion-matrix').data;
    assert.equal(data.matrixCells.find(([column, row]) => row === 0 && column === 2)[2], 0);
    assert.equal(data.matrixCells.find(([column, row]) => row === 0 && column === 0)[2], 30);
    assert.match(build('confusion-matrix', [['Actual', 'A', 'B'], ['A', 1.2, 0], ['B', 0, 3]]).error, /非整数/);
    assert.match(build('confusion-matrix', [['Actual', 'A', 'B'], ['A', 1, null], ['B', 0, 3]]).error, /不补零/);
    assert.match(build('confusion-matrix', [['Actual', 'A', 'B'], ['A', 1, 0], ['C', 0, 3]]).error, /完全对应/);
});

test('calendar validates dates, preserves original order and absent days, accepts true zero and negative signals', () => {
    const data = build('calendar-heatmap').data;
    assert.deepEqual(data.x, ['2026-01-05', '2026-01-02', '2026-01-10', '2026-01-25']);
    assert.deepEqual(data.series[0].values, [12, 0, -3, 21]);
    assert.equal(calendarDateTimestamp('2026-02-29'), null);
    assert.notEqual(calendarDateTimestamp('2024-02-29'), null);
    assert.match(build('calendar-heatmap', [['Date', 'Value'], ['2026-02-30', 3]]).error, /有效 YYYY-MM-DD/);
    assert.match(build('calendar-heatmap', [['Date', 'Value'], ['2026-01-01', 1], ['2026-01-01', 2]]).error, /重复/);
    assert.match(build('calendar-heatmap', [['Date', 'Value'], ['2025-01-01', 1], ['2026-02-01', 2]]).error, /366 天/);
    const constant = build('calendar-heatmap', [['Date', 'Value'], ['2026-01-01', 4], ['2026-01-03', 4]]).data;
    const option = createTemplateOption(constant, 'calendar-heatmap', style);
    assert.equal(option.visualMap.type, 'piecewise');
    assert.equal(option.visualMap.pieces[0].value, 4);
});

test('all new engines render finite vector SVG with complete visible text and preserve parsed values', () => {
    for (const id of Object.keys(fixtures)) for (const showValues of [false, true]) {
        const data = build(id).data, original = structuredClone(data);
        const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
        try {
            chart.setOption(createTemplateOption(data, id, { ...style, showValues }));
            const svg = chart.renderToSVGString();
            assert.doesNotMatch(svg, /NaN|Infinity|<image\b/, id);
            for (const element of chart.getZr().storage.getDisplayList().filter(element => element.type === 'tspan' && !element.ignore && !element.invisible && element.style?.text?.trim())) {
                const rect = element.getBoundingRect().clone();
                if (element.transform) rect.applyTransform(element.transform);
                assert.ok(rect.x >= -2 && rect.y >= -2 && rect.x + rect.width <= style.width + 2 && rect.y + rect.height <= style.height + 2, `${id}: clipped ${element.style.text}: ${JSON.stringify(rect)}`);
            }
            assert.deepEqual(data, original, `${id}: chart rendering changed measured data`);
        } finally { chart.dispose(); }
    }
});
