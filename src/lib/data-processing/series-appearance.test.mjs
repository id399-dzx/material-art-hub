import test from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts';
import { applySeriesAppearances, appearanceCapabilities, validateSeriesAppearances, withoutSeriesColors } from './series-appearance.ts';
import { createTemplateOption } from './template-chart.ts';
import { createL1502Option } from './l1502-render.ts';
import { l1502DefaultStyle } from './l1502-spec.ts';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data } from './l1502-data.ts';

const data = () => ({ x: [0, 1, 3], series: [{ name: 'Treatment', values: [2, 4, 6] }, { name: 'Control', values: [1, 3, 5] }], warnings: [], skipped: 0 });
const style = extra => ({ title: 'User observations', xLabel: 'X', yLabel: 'Y', fontFamily: 'Arial', fontSize: 14, palette: 'journal', showGrid: true, showValues: false, errorMeasure: 'SD', width: 680, height: 420, ...extra });
function render(option) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
    try { chart.setOption(option); const svg = chart.renderToSVGString(); assert.doesNotMatch(svg, /NaN|Infinity/); return svg; } finally { chart.dispose(); }
}

test('appearance validation clones named settings and rejects unknown, executable and out-of-range fields', () => {
    const source = { '自有样本': { color: '#123456', lineWidth: 3, lineType: 'dashed', symbol: 'diamond', symbolSize: 12, fillOpacity: .3 } };
    const restored = validateSeriesAppearances(source);
    assert.deepEqual(restored, source);
    restored['自有样本'].color = '#ffffff';
    assert.equal(source['自有样本'].color, '#123456');
    const invalid = [null, [], new Date(), { '': {} }, { A: [] }, { A: { color: 'red' } }, { A: { color: 'url(javascript:alert(1))' } },
        { A: { lineWidth: NaN } }, { A: { lineWidth: .1 } }, { A: { lineWidth: 13 } }, { A: { symbolSize: -1 } }, { A: { symbolSize: 31 } },
        { A: { fillOpacity: 1.1 } }, { A: { symbol: 'image://https://example.com/x' } }, { A: { lineType: 'dash' } }, { A: { unknown: 1 } },
        { A: { color: () => '#123456' } }, { [Symbol('unknown')]: {} }, { A: { [Symbol('unknown')]: 1 } }];
    for (const value of invalid) assert.throws(() => validateSeriesAppearances(value), /系列样式格式无效/);
    const names = validateSeriesAppearances(JSON.parse('{"__proto__":{"color":"#123456"},"constructor":{"lineWidth":2}}'));
    assert.ok(Object.hasOwn(names, '__proto__'));
    assert.equal(names.__proto__.color, '#123456');
    assert.equal({}.color, undefined);
});

test('legacy line engine applies real colors, line patterns, markers and filling without altering observations or domains', () => {
    const source = data(), original = structuredClone(source);
    const before = createTemplateOption(source, 'line', style());
    const after = createTemplateOption(source, 'line', style({ seriesAppearances: { Treatment: { color: '#ab2678', lineWidth: 4, lineType: 'dashed', symbol: 'diamond', symbolSize: 11, fillOpacity: .3 } } }));
    assert.deepEqual(source, original);
    assert.deepEqual(after.xAxis, before.xAxis);
    assert.deepEqual(after.yAxis, before.yAxis);
    assert.deepEqual(after.series.map(series => series.data), before.series.map(series => series.data));
    assert.deepEqual(after.series[1], before.series[1]);
    assert.equal(after.series[0].lineStyle.color, '#ab2678');
    assert.equal(after.series[0].lineStyle.width, 4);
    assert.equal(after.series[0].lineStyle.type, 'dashed');
    assert.equal(after.series[0].symbol, 'diamond');
    assert.equal(after.series[0].symbolSize, 11);
    assert.equal(after.series[0].showSymbol, true);
    assert.equal(after.series[0].areaStyle.opacity, .3);
    const svg = render(after);
    assert.ok(svg.includes('#ab2678'));
    assert.match(svg, /stroke-width="4"/);
    assert.match(svg, /stroke-dasharray=/);
    assert.match(svg, /fill-opacity="0.3"/);
});

test('explicit marker edits enable line markers for dense data and none reliably disables them', () => {
    const dense = { ...data(), x: Array.from({ length: 100 }, (_, i) => i), series: [{ name: 'Treatment', values: Array.from({ length: 100 }, (_, i) => i % 7) }] };
    assert.equal(createTemplateOption(dense, 'line', style()).series[0].showSymbol, false);
    const symbols = createTemplateOption(dense, 'line', style({ seriesAppearances: { Treatment: { symbol: 'triangle', symbolSize: 8 } } }));
    assert.equal(symbols.series[0].showSymbol, true);
    const none = createTemplateOption(dense, 'line', style({ seriesAppearances: { Treatment: { symbol: 'none', symbolSize: 8 } } }));
    assert.equal(none.series[0].showSymbol, false);
    assert.equal(none.series[0].symbol, 'none');
    assert.ok(render(symbols).includes('stroke='));
});

test('native scatter and bars apply only supported controls and radar edits address data item names', () => {
    const option = { animation: false, xAxis: {}, yAxis: {}, series: [
        { type: 'scatter', name: 'Points', data: [[1, 2], [2, 3]], itemStyle: { color: '#000000' } },
        { type: 'bar', name: 'Bars', data: [[1, 2], [2, 3]], itemStyle: { color: '#111111' } },
    ] };
    const values = structuredClone(option.series.map(series => series.data));
    applySeriesAppearances(option, { Points: { color: '#ff6600', symbol: 'triangle', symbolSize: 13, lineWidth: 4, fillOpacity: .4 }, Bars: { color: '#6633cc', fillOpacity: .4, symbol: 'diamond' } });
    assert.deepEqual(option.series.map(series => series.data), values);
    assert.equal(option.series[0].symbol, 'triangle');
    assert.equal(option.series[0].symbolSize, 13);
    assert.equal(option.series[0].lineStyle, undefined);
    assert.equal(option.series[0].areaStyle, undefined);
    assert.equal(option.series[1].symbol, undefined);
    assert.equal(option.series[1].itemStyle.opacity, .4);
    const svg = render(option);
    assert.ok(svg.includes('#ff6600') && svg.includes('#6633cc'));
    const radar = { animation: false, radar: { indicator: ['A', 'B', 'C'].map(name => ({ name, min: 0, max: 10 })) }, series: [{ type: 'radar', name: 'Radar container', data: [
        { name: 'Treatment', value: [2, 5, 8], itemStyle: { color: '#123456' }, lineStyle: { color: '#123456' }, areaStyle: { opacity: .1 } },
        { name: 'Control', value: [1, 3, 4], itemStyle: { color: '#999999' }, lineStyle: { color: '#999999' } },
    ] }] };
    const untouched = structuredClone(radar.series[0].data[1]);
    assert.deepEqual(appearanceCapabilities(radar).map(series => series.name), ['Treatment', 'Control']);
    applySeriesAppearances(radar, { Treatment: { color: '#cc2288', lineWidth: 3, lineType: 'dotted', symbol: 'rect', symbolSize: 9, fillOpacity: .25 }, 'Radar container': { color: '#ffffff' } });
    assert.deepEqual(radar.series[0].data[0].value, [2, 5, 8]);
    assert.deepEqual(radar.series[0].data[1], untouched);
    assert.equal(radar.series[0].data[0].lineStyle.color, '#cc2288');
    assert.equal(radar.series[0].data[0].areaStyle.opacity, .25);
    assert.ok(render(radar).includes('#cc2288'));
});

test('custom error auxiliaries and quantitative visual encodings are excluded from controls and overrides', () => {
    const options = [
        { series: [{ type: 'line', name: 'A', data: [1, 2] }, { type: 'custom', name: 'A', data: [1, 2] }] },
        { series: [{ type: 'line', name: 'A', data: [1, 2] }, { type: 'custom', name: 'A · error', data: [1, 2] }] },
        { visualMap: { min: 0, max: 10, seriesIndex: [0] }, series: [{ type: 'scatter', name: 'A', data: [[1, 2], [2, 4]] }] },
        { series: [{ type: 'bar', name: 'A', data: [{ value: 1, itemStyle: { color: '#123456' } }] }] },
        { series: [{ type: 'heatmap', name: 'A', data: [[0, 0, 1]] }] },
    ];
    for (const option of options) {
        const before = structuredClone(option);
        assert.deepEqual(appearanceCapabilities(option), []);
        applySeriesAppearances(option, { A: { color: '#ff0000', symbolSize: 20 } });
        assert.deepEqual(option, before);
    }
    const bubble = { series: [{ type: 'scatter', name: 'A', symbolSize: value => value[2] * 2, data: [[1, 2, 3]] }] };
    assert.deepEqual(appearanceCapabilities(bubble), []);
    applySeriesAppearances(bubble, { A: { symbolSize: 20 } });
    assert.equal(bubble.series[0].symbolSize([1, 2, 3]), 6);
});

test('undefined and unknown series settings preserve the old default option exactly', () => {
    const option = createTemplateOption(data(), 'line', style());
    const before = JSON.stringify(option), firstSeries = option.series[0];
    applySeriesAppearances(option, undefined);
    applySeriesAppearances(option, { 'Not present in uploaded data': { color: '#ff0000', lineWidth: 8 } });
    assert.equal(JSON.stringify(option), before);
    assert.equal(option.series[0], firstSeries);
});

test('changing a global palette releases individual colors and retains independently edited line, marker and fill settings', () => {
    const source = { Treatment: { color: '#123456', lineWidth: 4, symbol: 'triangle', fillOpacity: .3 }, Control: { color: '#abcdef' } };
    const retained = withoutSeriesColors(source);
    assert.deepEqual(retained, { Treatment: { lineWidth: 4, symbol: 'triangle', fillOpacity: .3 } });
    retained.Treatment.lineWidth = 2;
    assert.equal(source.Treatment.lineWidth, 4);
    assert.equal(withoutSeriesColors(undefined), undefined);
    assert.equal(withoutSeriesColors({ A: { color: '#123456' } }), undefined);
    assert.equal(withoutSeriesColors({}), undefined);
});

test('L1502 engine overrides supported native series after classification styling while preserving data and bounds', () => {
    const spec = { issue: 1, folder: 'test', kind: 'line' };
    const table = parseTemplateTable([['X', 'Treatment'], [0, 1], [3, 5], [7, 2]]);
    const mapping = { x: 0, ys: [1], errors: {}, bounds: {} };
    const result = buildL1502Data(table, mapping, spec);
    assert.equal(result.error, null);
    const chartStyle = l1502DefaultStyle('Treatment', 680, 420, spec);
    const initial = createL1502Option(result.data, spec, chartStyle);
    const beforeData = structuredClone(result.data);
    const updated = createL1502Option(result.data, spec, { ...chartStyle, seriesAppearances: { Treatment: { color: '#2266dd', lineWidth: 3, symbol: 'none', fillOpacity: .2 } } });
    assert.deepEqual(result.data, beforeData);
    assert.deepEqual(updated.series[0].data, initial.series[0].data);
    assert.deepEqual(updated.xAxis, initial.xAxis);
    assert.deepEqual(updated.yAxis, initial.yAxis);
    assert.equal(updated.series[0].lineStyle.color, '#2266dd');
    assert.equal(updated.series[0].symbol, 'none');
    assert.equal(updated.series[0].areaStyle.opacity, .2);
    assert.ok(render(updated).includes('#2266dd'));
});

test('same-name mixed chart kinds and value-mapped siblings are not partially restyled while same-kind panel copies are supported', () => {
    const mixed = { series: [{ type: 'line', name: 'Same name', data: [1, 2] }, { type: 'bar', name: 'Same name', data: [3, 4] }] };
    const before = structuredClone(mixed);
    assert.deepEqual(appearanceCapabilities(mixed), []);
    applySeriesAppearances(mixed, { 'Same name': { color: '#ff0000', lineWidth: 4, fillOpacity: .5 } });
    assert.deepEqual(mixed, before);
    const mappedSibling = { visualMap: { seriesIndex: 1 }, series: [{ type: 'scatter', name: 'A', data: [[1, 2]] }, { type: 'scatter', name: 'A', data: [[1, 2, 3]] }] };
    assert.deepEqual(appearanceCapabilities(mappedSibling), []);
    const panels = { series: [{ type: 'line', name: 'Shared source', data: [1, 2], xAxisIndex: 0 }, { type: 'line', name: 'Shared source', data: [1, 2], xAxisIndex: 1 }] };
    assert.equal(appearanceCapabilities(panels).length, 1);
    applySeriesAppearances(panels, { 'Shared source': { color: '#224488', lineWidth: 3 } });
    assert.ok(panels.series.every(series => series.lineStyle.color === '#224488' && series.lineStyle.width === 3));
    assert.deepEqual(panels.series.map(series => series.xAxisIndex), [0, 1]);
});

test('first line filling uses the actual outline color, bars use their item color and do not inherit area controls', () => {
    const line = { animation: false, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'line', name: 'Outline', data: [[1, 2], [2, 3]], lineStyle: { color: '#2468ab' }, itemStyle: { color: '#222222' } }] };
    applySeriesAppearances(line, { Outline: { fillOpacity: .35 } });
    assert.equal(line.series[0].areaStyle.color, '#2468ab');
    assert.equal(line.series[0].areaStyle.opacity, .35);
    assert.ok(render(line).includes('fill="#2468ab"'));
    const bar = { animation: false, xAxis: { type: 'category', data: ['A', 'B'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', name: 'Bars', data: [1, 2], lineStyle: { color: '#001122' }, itemStyle: { color: '#c34455' } }] };
    const [capability] = appearanceCapabilities(bar);
    assert.equal(capability.defaultColor, '#c34455');
    assert.equal(capability.line, false);
    assert.equal(capability.symbol, false);
    applySeriesAppearances(bar, { Bars: { color: '#55aa33', fillOpacity: .6, lineWidth: 9, symbol: 'triangle' } });
    assert.equal(bar.series[0].areaStyle, undefined);
    assert.deepEqual(bar.series[0].lineStyle, { color: '#001122' });
    assert.equal(bar.series[0].symbol, undefined);
    assert.equal(bar.series[0].itemStyle.opacity, .6);
    assert.ok(render(bar).includes('fill="#55aa33"'));
});

test('capabilities truthfully describe hidden markers and preserve template-only hollow marker defaults', () => {
    const hidden = createTemplateOption({ ...data(), x: Array.from({ length: 100 }, (_, i) => i), series: [{ name: 'Dense', values: Array.from({ length: 100 }, (_, i) => i) }] }, 'line', style());
    assert.equal(appearanceCapabilities(hidden)[0].symbolType, 'none');
    const hollow = { animation: false, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'line', name: 'Hollow', data: [[1, 2], [2, 3]], symbol: 'emptyCircle', symbolSize: 9, showSymbol: true, itemStyle: { color: '#2468ab' } }] };
    assert.equal(appearanceCapabilities(hollow)[0].symbolType, 'emptyCircle');
    applySeriesAppearances(hollow, { Hollow: { lineWidth: 3 } });
    assert.equal(hollow.series[0].symbol, 'emptyCircle');
    assert.ok(render(hollow).includes('fill="#fff"'));
});
