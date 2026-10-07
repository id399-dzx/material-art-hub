import test from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';
import { createL1502TwoDimensionalOption } from './l1502-render-2d.ts';
import { L1502_TEMPLATES } from './l1502-catalog.ts';
import { L1502_SPATIAL_KINDS, l1502DefaultStyle } from './l1502-spec.ts';
const prepare = (t) => { const table = parseTemplateTable(t.demo), data = buildL1502Data(table, suggestL1502Mapping(table, t.l1502), t.l1502).data, style = l1502DefaultStyle(t.name); return { data, style, option: createL1502TwoDimensionalOption(data, t.l1502, style) }; };
const item = (issue) => L1502_TEMPLATES.find(t => t.l1502.issue === issue);
const svg = (option, style) => { const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height }); try { chart.setOption(option); return chart.renderToSVGString(); } finally { chart.dispose(); } };
test('every two dimensional template renders finite native SVG geometry from its own data', () => {
    for (const t of L1502_TEMPLATES.filter(t => !L1502_SPATIAL_KINDS.includes(t.l1502.kind))) { const { option, style } = prepare(t), result = svg(option, style); assert.match(result, /<svg/); assert.match(result, /<(?:path|rect|circle|text|polygon)\b/, t.id); assert.doesNotMatch(result, /(?:NaN|Infinity|<image\b|data:image\/)/, t.id); }
});
test('bubble symbol diameter uses square root of Size so encoded area is proportional', () => {
    const { option } = prepare(item(109)), radius = option.series[0].symbolSize; assert.equal(radius([0, 0, 0, 0]), 0); const a = radius([0, 0, 4, 0]), b = radius([0, 0, 16, 0]); assert.equal(b / a, 2);
    assert.ok(option.visualMap); assert.equal(option.visualMap.dimension, 3); assert.equal(option.visualMap.top, '54%');
});
test('mixed error line contains both true supplied interval polygon and measured error marks', () => {
    const { option } = prepare(item(29)); assert.equal(option.series.filter(s => s.type === 'custom').length, 2); assert.equal(option.series.filter(s => s.type === 'line').length, 2);
});
test('grouped stacked bars use independent stacks and conventional bars include zero baseline', () => {
    const { option } = prepare(item(24)); assert.deepEqual([...new Set(option.series.map(s => s.stack))], ['Group A', 'Group B']); assert.equal(prepare(item(11)).option.yAxis.min, 0); assert.equal(prepare(item(28)).option.yAxis.min, 0);
    assert.equal(prepare(item(10)).option.series.every(s => s.type === 'custom'), true);
});
test('bivariate histogram conserves exact original sample count across XY bins', () => {
    const t = L1502_TEMPLATES.find(t => t.l1502.kind === 'histogram2'), { data, option } = prepare(t); assert.equal(option.series[0].data.reduce((n, p) => n + p[4], 0), data.points.length); assert.equal(option.visualMap.dimension, 4);
});
test('polar coordinates convert radians internally without altering radius or Size', () => {
    const t = L1502_TEMPLATES.find(t => t.l1502.kind === 'polar-bubble'), { data, option } = prepare(t); assert.equal(option.series[0].data[1].value[0], data.series[0].points[1].y); const degrees = ((Number(data.series[0].points[1].x) * 180 / Math.PI % 360) + 360) % 360; assert.equal(option.series[0].data[1].value[1], degrees);
});
test('vectors preserve endpoints and all packed bubble rows are encoded exactly once', () => {
    const t = L1502_TEMPLATES.find(t => t.l1502.kind === 'vector2'), { data, option } = prepare(t); const p = data.series[0].points[0], v = option.series[0].data[0]; assert.deepEqual(v.slice(0, 4), [p.x, p.y, p.x + p.u, p.y + p.v]);
    for (const issue of [117, 120]) { const { data: cloud, option: packed } = prepare(item(issue)); assert.equal(packed.series.reduce((n, s) => n + s.data.length, 0), cloud.points.length); }
});
test('multiplot and inset use actual independent coordinate systems; issue31 has four vertical panels', () => {
    const { option } = prepare(item(31)); assert.equal(option.grid.length, 4); assert.equal(new Set(option.grid.map(g => g.left)).size, 1); assert.equal(new Set(option.grid.map(g => g.top)).size, 4);
    const t = L1502_TEMPLATES.find(t => t.l1502.kind === 'inset'); assert.equal(prepare(t).option.grid.length, 2);
});
test('contours contain custom vector segments and implicit level comes only from the scalar grid', () => {
    const t = L1502_TEMPLATES.find(t => t.l1502.kind === 'contour' && t.l1502.implicit), { data, style } = prepare(t), option = createL1502TwoDimensionalOption(data, t.l1502, { ...style, isoLevel: 0 }); assert.ok(option.series[0].data.length); assert.ok(option.series[0].data.every(v => v[2] === 0)); assert.match(svg(option, style), /<path/);
});
test('stacked area keeps original numeric X and accumulates measured Y in the rendered chart model', () => {
    const { data, option, style } = prepare(item(30)), chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
    try { chart.setOption(option); const models = chart.getModel().getSeries(); for (let i = 0; i < models.length; i++) { const d = models[i].getData(), dimension = d.getCalculationInfo('stackResultDimension'); assert.equal(d.getCalculationInfo('stackedDimension'), d.mapDimension('y')); for (const at of [0, 12, 24]) { assert.equal(d.get(d.mapDimension('x'), at), data.series[i].points[at].x); const expected = data.series.slice(0, i + 1).reduce((n, s) => n + s.points[at].y, 0); assert.ok(Math.abs(d.get(dimension, at) - expected) < 1e-9); } } } finally { chart.dispose(); }
});
test('stacked error marks are centered at measured cumulative component height', () => {
    const { data, option } = prepare(item(106)), errorSeries = option.series.filter(s => s.type === 'custom'); assert.equal(errorSeries.length, data.series.length);
    for (let i = 0; i < errorSeries.length; i++) for (let p = 0; p < data.series[i].points.length; p++) { const expected = data.series.slice(0, i + 1).reduce((n, s) => n + s.points[p].y, 0), error = data.series[i].points[p].error; assert.deepEqual(errorSeries[i].data[p], [data.series[i].points[p].x, expected, expected - error, expected + error]); }
});
test('97/100 use real error-bar,line,pie,stacked-bar panels and98 has a spanning area panel', () => {
    for (const issue of [97, 100]) { const { option } = prepare(item(issue)); assert.equal(option.grid.length, 4); assert.ok(option.series.some(s => s.type === 'custom' && s.xAxisIndex === 0)); assert.ok(option.series.some(s => s.type === 'line' && s.xAxisIndex === 1)); assert.equal(option.series.filter(s => s.type === 'pie').length, 1); assert.ok(option.series.some(s => s.type === 'bar' && s.stack)); assert.equal(new Set(option.grid.map(g => g.left)).size, 2); }
    const { option } = prepare(item(98)); assert.equal(option.grid.length, 3); assert.equal(option.grid[2].width, '80%'); assert.ok(option.series.some(s => s.xAxisIndex === 2 && s.areaStyle)); assert.equal(option.series.some(s => s.stack), false);
});
test('confidence fills only supplied bounds and horizontal log bar uses the actual horizontal value axis', () => {
    for (const issue of [86, 94]) assert.equal(prepare(item(issue)).option.series.some(s => s.type === 'line' && s.areaStyle), false);
    assert.equal(prepare(item(77)).option.xAxis.type, 'log');
});
test('compass accepts U/V-only tables and encodes direction and magnitude in a polar coordinate system', () => {
    const t = item(139), table = parseTemplateTable([['U', 'V'], [3, 4], [-1, 0], [0, 0]]), mapping = suggestL1502Mapping(table, t.l1502), result = buildL1502Data(table, mapping, t.l1502); assert.equal(result.error, null);
    const option = createL1502TwoDimensionalOption(result.data, t.l1502, l1502DefaultStyle('Compass')); assert.equal(option.series[0].coordinateSystem, 'polar'); assert.ok(option.angleAxis); assert.ok(option.radiusAxis); assert.equal(option.series[0].data[0][0], 5); assert.equal(option.series[0].data[1][1], 180); assert.equal(option.series[0].data[2][0], 0); assert.doesNotMatch(svg(option, l1502DefaultStyle('Compass')), /NaN|Infinity/);
});
test('79 is filled by seamless compound isoband paths without contour strokes', () => {
    const { option } = prepare(item(79)); assert.ok(option.series[0].data.length <= 9);
    const renderer = option.series[0].renderItem, primitive = renderer({ dataIndex: 0 }, { coord: p => p, visual: () => '#f00' }); assert.equal(primitive.type, 'path'); assert.match(primitive.shape.pathData, /M.*L.*Z/); assert.equal(primitive.style.stroke, undefined);
});
