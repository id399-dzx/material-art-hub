import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { createTemplateOption } from './template-chart.ts';
import { localRadarBounds, numericCellBounds } from './template-chart-variants.ts';

const base = (x, series, extra = {}) => ({ x, series, skipped: 0, warnings: [], ...extra });
const style = (variant, extra = {}) => ({ title: '独立论文图式 · 示例数据', xLabel: '自己的 X / 类别', yLabel: '自己的测量值',
    fontFamily: 'Arial', fontSize: 18, palette: 'journal', showGrid: false, showValues: false, errorMeasure: 'SD', width: 680, height: 420, variant, ...extra });

function render(data, id, chartStyle, check) {
    const snapshot = structuredClone(data);
    const option = createTemplateOption(data, id, chartStyle);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: chartStyle.width, height: chartStyle.height });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.doesNotMatch(svg, /NaN|Infinity/);
        for (const element of chart.getZr().storage.getDisplayList()) {
            if (element.type !== 'tspan' || element.ignore || element.invisible || !element.style?.text?.trim()) continue;
            const rect = element.getBoundingRect().clone();
            if (element.transform) rect.applyTransform(element.transform);
            assert.ok(rect.x >= -2 && rect.y >= -2 && rect.x + rect.width <= chartStyle.width + 2 && rect.y + rect.height <= chartStyle.height + 2, `${chartStyle.variant}: ${element.style.text} outside canvas ${JSON.stringify(rect)}`);
        }
        check?.({ option, chart, svg });
    } finally { chart.dispose(); }
    assert.deepEqual(data, snapshot, 'rendering does not change observations');
}

test('density heatmap retains nonuniform numeric coordinates and renders only supplied cells', () => {
    assert.deepEqual([...numericCellBounds([0, 1, 10]).values()], [[-.5, .5], [.5, 5.5], [5.5, 14.5]]);
    const data = base([0, 2], [{ name: '0', values: [] }, { name: '1', values: [] }, { name: '10', values: [] }], { matrixCells: [[0, 0, 1], [1, 0, 2], [2, 0, 3], [2, 1, 4]] });
    render(data, 'heatmap', style('density-heatmap'), ({ option, chart }) => {
        assert.equal(option.xAxis.type, 'value');
        assert.equal(option.yAxis.type, 'value');
        assert.equal(option.series[0].type, 'custom');
        assert.equal(option.series[0].data.length, 4);
        assert.equal(option.xAxis.min, -.5);
        assert.equal(option.xAxis.max, 14.5);
        const first = chart.convertToPixel({ xAxisIndex: 0 }, .5) - chart.convertToPixel({ xAxisIndex: 0 }, -.5);
        const last = chart.convertToPixel({ xAxisIndex: 0 }, 14.5) - chart.convertToPixel({ xAxisIndex: 0 }, 5.5);
        assert.ok(Math.abs(last / first - 9) < 1e-9, 'cell width follows input coordinate spacing');
    });
});

test('sparse signed attention heatmap preserves missing cells and uses zero as the diverging color midpoint', () => {
    const data = base(['位置一', '位置二'], [{ name: '对象甲', values: [] }, { name: '对象乙', values: [] }], { matrixCells: [[0, 0, -2], [1, 0, 0], [1, 1, 4]] });
    render(data, 'heatmap', style('attention-heatmap'), ({ option, svg }) => {
        assert.deepEqual(option.series[0].data, data.matrixCells);
        assert.equal(option.series[0].label.show, false);
        assert.equal(option.visualMap.min, -4);
        assert.equal(option.visualMap.max, 4);
        assert.deepEqual(option.visualMap.text, ['4', '-4']);
        assert.equal(option.visualMap.inRange.color[1], '#ffffff');
        assert.ok(svg.includes('色阶以 0 为中心'));
    });
    render(data, 'heatmap', style('attention-heatmap', { palette: 'mono', customColors: ['#ffffff', '#ff0000'] }), ({ option, svg }) => {
        assert.deepEqual(option.visualMap.inRange.color, ['#888888', '#ffffff', '#222222']);
        assert.ok(svg.includes('浅灰为负'));
        assert.ok(!svg.includes('#ff0000'));
    });
});

test('embedding and positional scatter preserve repeated observations and independent group coordinates', () => {
    const numeric = base([.2, .2, 9], [{ name: '测量', values: [1, 2, 3] }], { pointGroups: [{ name: '组甲', points: [[.2, 1], [.2, 2]] }, { name: '组乙', points: [[9, 3]] }] });
    render(numeric, 'scatter', style('embedding-scatter'), ({ option }) => {
        assert.deepEqual(option.series[0].data, [[.2, 1], [.2, 2]]);
        assert.deepEqual(option.series[1].data, [[9, 3]]);
        assert.equal(option.xAxis.type, 'value');
    });
    const categorical = base(['位点乙', '位点甲', '位点乙'], [{ name: '测量', values: [1, 2, 3] }], { pointGroups: [{ name: '组甲', points: [['位点乙', 1], ['位点甲', 2]] }, { name: '组乙', points: [['位点乙', 3]] }] });
    render(categorical, 'scatter', style('position-scatter'), ({ option }) => {
        assert.deepEqual(option.xAxis.data, ['位点乙', '位点甲']);
        assert.deepEqual(option.series[0].data, categorical.pointGroups[0].points);
        assert.equal(option.xAxis.type, 'category');
    });
});

test('paired comparison breaks condition segments and connects only unique exact object matches', () => {
    const data = base(['对象甲', '对象乙', '对象乙', '对象丙'], [{ name: '相关系数', values: [.2, .4, .8, .7] }], { comparisonGroups: [
        { name: '条件前', x: ['对象甲', '对象乙'], series: [{ name: 'Spearman', values: [.2, .4] }, { name: 'Kendall', values: [.1, .3] }] },
        { name: '条件后', x: ['对象乙', '对象丙'], series: [{ name: 'Spearman', values: [.8, .7] }, { name: 'Kendall', values: [.6, .5] }] },
    ] });
    render(data, 'line', style('paired-correlation'), ({ option }) => {
        assert.deepEqual(option.xAxis.data, ['对象甲', '对象乙', '', '对象乙', '对象丙']);
        assert.deepEqual(option.series[0].data, [.2, .4, null, null, null]);
        assert.deepEqual(option.series[2].data, [null, null, null, .8, .7]);
        const pairs = option.series.filter(series => series.type === 'custom');
        assert.deepEqual(pairs.map(pair => pair.data), [[[1, .4, 3, .8]], [[1, .3, 3, .6]]]);
        assert.equal(option.yAxis.length, 2);
        assert.deepEqual(option.series.map(series => series.yAxisIndex), [0, 1, 0, 1, 0, 1]);
        assert.ok(option.series.every(series => series.type !== 'line' || series.connectNulls === false));
    });
});

test('grouped boxes share category positions and group colors while retaining all real sample points', () => {
    const samples = [
        { name: '甲 · 前', category: '甲', series: '前', values: [1, 2, 3] }, { name: '甲 · 后', category: '甲', series: '后', values: [3, 4, 5] },
        { name: '乙 · 前', category: '乙', series: '前', values: [4, 5, 6] }, { name: '乙 · 后', category: '乙', series: '后', values: [6, 7, 8] },
    ];
    render(base(['甲', '乙'], [{ name: '测量值', values: [2, 4, 5, 7] }], { samples }), 'box', style('grouped-box'), ({ option, chart, svg }) => {
        assert.deepEqual(option.xAxis.data, ['甲', '乙']);
        assert.deepEqual(option.legend.data, ['前', '后']);
        assert.deepEqual(option.series.map(series => series.data[0][0]), [0, 0, 1, 1]);
        assert.ok(svg.includes('甲 · 前 n=3'));
        const circles = chart.getZr().storage.getDisplayList().filter(element => element.type === 'circle' && !element.ignore);
        assert.equal(circles.length, 12);
    });
});

test('local radar shows empirical per-indicator bounds while retaining the provided values', () => {
    const data = base(['得分', '准确率', '效率', '质量'], [{ name: '方法甲', values: [78, 92, 1200, .65] }, { name: '方法乙', values: [85, 95, 1300, .7] }]);
    render(data, 'radar', style('local-range-radar'), ({ option, svg }) => {
        const ranges = data.x.map((_, row) => localRadarBounds(data.series.map(series => series.values[row])));
        assert.ok(ranges[0][0] > 0);
        option.radar.indicator.forEach((indicator, row) => {
            for (const series of data.series) assert.ok(ranges[row][0] <= series.values[row] && ranges[row][1] >= series.values[row]);
            assert.match(indicator.name, /范围/);
            assert.equal(indicator.min, 0);
            assert.equal(indicator.max, 1);
            assert.ok(indicator.name.includes(`${ranges[row][0]}–${ranges[row][1]}`));
        });
        assert.deepEqual(option.series[0].data[0].value, data.series[0].values.map((value, row) => (value - ranges[row][0]) / (ranges[row][1] - ranges[row][0])));
        assert.ok(option.tooltip.formatter({ name: '方法甲' }).includes('效率: 1200'));
        assert.ok(svg.includes('范围'));
    });
});

test('baseline, filled distribution, and numeric stacked area retain their distinct line structures', () => {
    const data = base([0, 1, 10], [{ name: '测得基线', values: [2, 2, 2] }, { name: '动态测量', values: [1, 4, 3] }]);
    render(data, 'line', style('baseline-line'), ({ option }) => { assert.equal(option.series[0].lineStyle.type, 'dashed'); assert.equal(option.series[1].lineStyle.type, 'solid'); });
    render(data, 'line', style('filled-distribution', { annotationX: 1, annotationText: '用户参考' }), ({ option, svg }) => {
        assert.ok(option.series[0].areaStyle);
        assert.equal(option.series[0].markLine.data[0].xAxis, 1);
        assert.ok(svg.includes('用户参考'));
        assert.deepEqual(option.series.at(-1).data, [[1, 2, 4, 2]]);
        assert.ok(svg.includes('Δ = 2'));
    });
    for (const annotationX of [.5, 0]) render(data, 'line', style('filled-distribution', { annotationX }), ({ option, svg }) => {
        if (annotationX === .5) { assert.equal(option.series.length, 2); assert.ok(!svg.includes('Δ =')); }
    });
    const equal = base([0, 1], [{ name: '测量甲', values: [2, 3] }, { name: '测量乙', values: [2, 3] }]);
    render(equal, 'line', style('filled-distribution', { annotationX: 1 }), ({ option }) => assert.equal(option.series.length, 2, 'equal observed values do not create a difference glyph'));
    render(data, 'line', style('stacked-area', { hatching: true }), ({ option, chart }) => {
        assert.equal(option.xAxis.type, 'value');
        assert.equal(option.series[0].stack, 'area-composition');
        assert.ok(option.series[0].areaStyle.decal);
        assert.deepEqual(option.series[1].data, [[1, 0], [4, 1], [3, 10]]);
        const rendered = chart.getModel().getSeriesByIndex(1).getData();
        assert.equal(rendered.getCalculationInfo('stackedDimension'), 'Value');
        assert.equal(rendered.get(rendered.getCalculationInfo('stackResultDimension'), 2), 5);
        const points = rendered.getLayout('points');
        assert.ok(Math.abs(points[4] - chart.convertToPixel({ xAxisIndex: 0 }, 10)) < .001, 'last rendered X remains original X, not X + X');
        assert.ok(Math.abs(points[5] - chart.convertToPixel({ yAxisIndex: 0 }, 5)) < .001, 'second area upper edge is Y1 + Y2');
        const first = chart.convertToPixel({ xAxisIndex: 0 }, 1) - chart.convertToPixel({ xAxisIndex: 0 }, 0), last = chart.convertToPixel({ xAxisIndex: 0 }, 10) - chart.convertToPixel({ xAxisIndex: 0 }, 1);
        assert.ok(Math.abs(last / first - 9) < 1e-9);
    });
    const originalRange = base([0, 28], [{ name: '组甲', values: [10, 46] }, { name: '组乙', values: [5, 26] }]);
    render(originalRange, 'line', style('stacked-area'), ({ chart }) => {
        const series = chart.getModel().getSeriesByIndex(1).getData(), points = series.getLayout('points');
        assert.equal(series.get(series.getCalculationInfo('stackResultDimension'), 1), 72);
        assert.ok(Math.abs(points[2] - chart.convertToPixel({ xAxisIndex: 0 }, 28)) < .001);
        assert.ok(Math.abs(points[3] - chart.convertToPixel({ yAxisIndex: 0 }, 72)) < .001);
    });
});

test('sphere points and spatial vectors have different geometry without normalizing input coordinates', () => {
    const data = base([2, 0, -3], [{ name: 'Y', values: [0, 4, 1] }, { name: 'Z', values: [1, 0, 2] }]);
    render(data, 'sphere', style('sphere-points'), ({ option }) => {
        assert.equal(option.graphic.filter(graphic => graphic.type === 'line').length, 3, 'only XYZ axes, no rays to points');
        assert.ok(option.graphic.some(graphic => graphic.type === 'polyline'), 'unit reference sphere remains explicit');
    });
    render(data, 'sphere', style('spatial-vectors'), ({ option, svg }) => {
        assert.equal(option.graphic.filter(graphic => graphic.type === 'line').length, 6, 'XYZ axes plus three input vectors');
        assert.equal(option.graphic.filter(graphic => graphic.type === 'polygon').length, 3, 'one arrowhead per nonzero projected vector');
        assert.ok(!option.graphic.some(graphic => graphic.type === 'polyline'), 'no sphere wire overlay');
        assert.ok(svg.includes('未单位化'));
    });
});
