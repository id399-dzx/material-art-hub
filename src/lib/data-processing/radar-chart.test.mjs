import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { createTemplateOption } from './template-chart.ts';
import { localRadarBounds } from './template-chart-variants.ts';
import { validateRadarSettings } from './chart-style-settings.ts';
import { radarAxisRanges } from './radar-chart.ts';
import { buildDrawingData } from './drawing-data.ts';
import { parseTemplateTable } from './templates.ts';

const measurements = () => ({ x: ['性能', '稳定性', '效率', '质量'], series: [
    { name: '方法甲', values: [78, 92, 1200, .65] },
    { name: '方法乙', values: [85, 95, 1300, .7] },
], skipped: 0, warnings: [] });
const style = (extra = {}) => ({ title: '多指标比较', xLabel: '指标', yLabel: '测量值', fontFamily: 'Arial',
    fontSize: 18, palette: 'journal', showGrid: true, showValues: false, errorMeasure: 'SD', width: 680, height: 420, ...extra });

function render(data, extra, inspect) {
    const before = structuredClone(data);
    const chartStyle = style(extra), option = createTemplateOption(data, 'radar', chartStyle);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: chartStyle.width, height: chartStyle.height });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.doesNotMatch(svg, /NaN|Infinity/);
        for (const element of chart.getZr().storage.getDisplayList()) {
            if (element.type !== 'tspan' || element.ignore || element.invisible || !element.style?.text?.trim()) continue;
            const rect = element.getBoundingRect().clone();
            if (element.transform) rect.applyTransform(element.transform);
            assert.ok(rect.x >= -2 && rect.y >= -2 && rect.x + rect.width <= chartStyle.width + 2 && rect.y + rect.height <= chartStyle.height + 2,
                `${element.style.text} outside canvas ${JSON.stringify(rect)}`);
        }
        inspect?.(option, svg);
    } finally { chart.dispose(); }
    assert.deepEqual(data, before, 'radar rendering preserves the source observations and row order');
}

test('legacy radar settings retain zero baselines, original bounds, series values and fill defaults', () => {
    render(measurements(), {}, option => {
        assert.deepEqual(option.radar.indicator.map(item => [item.min, item.max]), [[0, 100], [0, 100], [0, 1500], [0, 1]]);
        assert.deepEqual(option.series[0].data.map(item => item.value), measurements().series.map(item => item.values));
        assert.equal(option.series[0].symbolSize, 5);
        assert.equal(option.series[0].data[0].areaStyle.opacity, .08);
        assert.equal(option.radar.shape, 'polygon');
        assert.equal(option.radar.startAngle, 90);
        assert.equal(option.radar.splitNumber, 5);
        assert.match(option.radar.indicator[0].name, /上限 100/);
    });
});

test('standard and local-range radar reject negative observations before rendering', () => {
    for (const observations of [[-5, -3, -1], [-5, 0, 10]]) {
        const table = parseTemplateTable([['指标', '观测'], ['X', observations[0]], ['Y', observations[1]], ['Z', observations[2]]]);
        for (const variant of [undefined, 'local-range-radar']) {
            const result = buildDrawingData(table, { x: 0, ys: [1], errors: {} }, 'radar', variant);
            assert.equal(result.data, null);
            assert.match(result.error, /雷达图需要非负数值/);
        }
    }
    const table = parseTemplateTable([['指标', '观测'], ['X', 0], ['Y', 0], ['Z', 0]]);
    const result = buildDrawingData(table, { x: 0, ys: [1], errors: {} }, 'radar');
    assert.equal(result.error, null);
    render(result.data, {}, option => assert.deepEqual(option.radar.indicator.map(item => [item.min, item.max]), [[0, 1], [0, 1], [0, 1]]));
});

test('circular grid, split count and starting angle render while grid toggle controls rings and spokes', () => {
    const settings = { shape: 'circle', splitNumber: 7, startAngle: 30 };
    render(measurements(), { radarSettings: settings }, (option, svg) => {
        assert.equal(option.radar.shape, 'circle');
        assert.equal(option.radar.splitNumber, 7);
        assert.equal(option.radar.startAngle, 30);
        assert.equal(option.radar.splitLine.show, true);
        assert.equal(option.radar.axisLine.show, true);
        assert.ok(svg.includes('#e0dfe8'));
        assert.ok(svg.includes('#d4d2de'));
    });
    render(measurements(), { radarSettings: settings, showGrid: false }, (option, svg) => {
        assert.equal(option.radar.splitLine.show, false);
        assert.equal(option.radar.axisLine.show, false);
        assert.ok(!svg.includes('#e0dfe8'));
        assert.ok(!svg.includes('#d4d2de'));
        assert.ok(svg.includes('方法甲'), 'grid switch keeps series legend and chart labels');
    });
});

test('named indicator order reorders every series identically and keeps new or omitted indicators', () => {
    const data = measurements();
    render(data, { radarSettings: { order: ['效率', '旧数据指标', '性能'] } }, option => {
        assert.deepEqual(option.radar.indicator.map(item => item.name.split('\n')[0]), ['效率', '性能', '稳定性', '质量']);
        assert.deepEqual(option.series[0].data.map(item => item.value), [[1200, 78, 92, .65], [1300, 85, 95, .7]]);
        assert.equal(option.tooltip.formatter({ name: '方法甲' }), '方法甲\n效率: 1200\n性能: 78\n稳定性: 92\n质量: 0.65');
    });
});

test('manual ranges preserve raw values, permit negative lower bounds and stay attached to names after reordering', () => {
    const radarSettings = validateRadarSettings({ axes: { 性能: { min: -10, max: 100 }, 效率: { min: 1000, max: 1500 } }, order: ['效率', '性能', '质量', '稳定性'] });
    render(measurements(), { radarSettings }, option => {
        assert.deepEqual(option.radar.indicator.map(item => [item.min, item.max]), [[1000, 1500], [-10, 100], [0, 1], [0, 100]]);
        assert.match(option.radar.indicator[0].name, /范围 1000–1500/);
        assert.deepEqual(option.series[0].data[0].value, [1200, 78, .65, 92]);
        assert.ok(option.tooltip.formatter({ name: '方法乙' }).includes('效率: 1300'));
    });
});

test('replacement data outside saved manual bounds receives safe UI ranges and a clear rendering error', () => {
    const data = measurements();
    const chartStyle = style({ radarSettings: { axes: { 效率: { min: 0, max: 100 } }, order: ['效率'] } });
    const ranges = radarAxisRanges(data, chartStyle);
    assert.deepEqual(ranges[0], { name: '效率', values: [1200, 1300], min: 0, max: 1500 });
    assert.throws(() => createTemplateOption(data, 'radar', chartStyle), /效率.*固定量程.*全部当前数据/);
    const invalidStyle = style({ radarSettings: { axes: { 效率: { min: 100, max: 100 } } } });
    assert.deepEqual(radarAxisRanges(data, invalidStyle).find(item => item.name === '效率'), ranges[0]);
});

test('local-range radar keeps empirical scaling and reports raw measurements for automatic and manual ranges', () => {
    const data = measurements();
    const displayRanges = radarAxisRanges(data, style({ variant: 'local-range-radar', radarSettings: { order: ['效率'] } }));
    assert.equal(displayRanges[0].name, '效率');
    assert.deepEqual(displayRanges[0].values, [1200, 1300]);
    assert.ok(displayRanges[0].min <= 1200 && displayRanges[0].max >= 1300);
    render(data, { variant: 'local-range-radar' }, option => {
        const ranges = data.x.map((_, row) => localRadarBounds(data.series.map(item => item.values[row])));
        assert.deepEqual(option.series[0].data[0].value, data.series[0].values.map((value, row) => (value - ranges[row][0]) / (ranges[row][1] - ranges[row][0])));
        assert.ok(option.tooltip.formatter({ name: '方法甲' }).includes('效率: 1200'));
        assert.ok(option.radar.indicator.every(item => item.min === 0 && item.max === 1));
    });
    render(data, { variant: 'local-range-radar', radarSettings: { axes: { 效率: { min: 1000, max: 1500 } }, order: ['效率'] } }, option => {
        assert.equal(option.series[0].data[0].value[0], .4);
        assert.equal(option.series[0].data[1].value[0], .6);
        assert.match(option.radar.indicator[0].name, /范围 1000–1500/);
        assert.ok(option.tooltip.formatter({ name: '方法甲' }).includes('效率: 1200'));
    });
});

test('radar settings clone nested ranges and order and safely retain indicator names resembling object properties', () => {
    const source = { shape: 'circle', splitNumber: 3, startAngle: 360,
        axes: Object.fromEntries([['constructor', { min: 0, max: 10 }], ['__proto__', { min: -1, max: 1 }]]),
        order: ['constructor', '__proto__'] };
    const validated = validateRadarSettings(source);
    assert.deepEqual(validated, source);
    assert.notEqual(validated, source);
    assert.notEqual(validated.axes, source.axes);
    assert.notEqual(validated.axes.constructor, source.axes.constructor);
    assert.notEqual(validated.order, source.order);
    source.axes.constructor.max = 20;
    source.order.reverse();
    assert.equal(validated.axes.constructor.max, 10);
    assert.deepEqual(validated.order, ['constructor', '__proto__']);
    render({ x: ['constructor', '__proto__', '质量'], series: [{ name: '观测', values: [2, 3, 4] }], skipped: 0, warnings: [] }, { radarSettings: { axes: {} } }, option => {
        assert.deepEqual(option.radar.indicator.map(item => item.min), [0, 0, 0]);
        assert.ok(option.series[0].data[0].value.every(Number.isFinite));
    });
});

test('malformed persisted radar fields are rejected rather than coerced, clipped or silently ignored', () => {
    const invalid = [undefined, null, [], new Date(), { unknown: true }, { shape: 'triangle' }, { shape: undefined },
        { splitNumber: 2 }, { splitNumber: 11 }, { splitNumber: 3.5 }, { splitNumber: '5' },
        { startAngle: -1 }, { startAngle: 361 }, { startAngle: NaN }, { startAngle: Infinity }, { startAngle: '90' },
        { axes: null }, { axes: [] }, { axes: { '': { min: 0, max: 1 } } }, { axes: { [' '.repeat(2)]: { min: 0, max: 1 } } },
        { axes: { ['x'.repeat(257)]: { min: 0, max: 1 } } }, { axes: { X: { min: 0 } } },
        { axes: { X: { min: 1, max: 1 } } }, { axes: { X: { min: 2, max: 1 } } },
        { axes: { X: { min: 0, max: Infinity } } }, { axes: { X: { min: '0', max: 1 } } },
        { axes: { X: { min: 0, max: 1, extra: 2 } } },
        { axes: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`X${i}`, { min: 0, max: 1 }])) },
        { order: null }, { order: 'X' }, { order: ['X', 'X'] }, { order: [''] }, { order: [undefined] }, { order: new Array(1) },
        { order: ['X'.repeat(257)] }, { order: Array.from({ length: 257 }, (_, i) => `X${i}`) },
        { [Symbol('extra')]: 1 }, { axes: { [Symbol('axis')]: { min: 0, max: 1 } } },
    ];
    for (const entry of invalid) assert.throws(() => validateRadarSettings(entry));
    assert.deepEqual(validateRadarSettings({}), {});
    assert.deepEqual(validateRadarSettings({ axes: {}, order: [] }), { axes: {}, order: [] });
});
