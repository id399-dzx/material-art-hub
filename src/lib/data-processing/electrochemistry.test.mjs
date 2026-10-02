import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { prepareElectrochemicalData } from './electrochemistry.ts';
import { createTemplateOption } from './template-chart.ts';

const dataSet = (x, series) => ({ x, series, skipped: 0, warnings: [] });
const style = (extra = {}) => ({ title: '电化学测试 · 示例数据', xLabel: 'Potential (V)', yLabel: 'Current (mA)',
    fontFamily: 'Arial', fontSize: 18, palette: 'journal', showGrid: false, showValues: false,
    errorMeasure: 'SD', width: 680, height: 420, ...extra });

test('CV retains acquisition order, reversed potentials, signed currents, and unmodified observations', () => {
    const original = dataSet([-0.5, 0, 0.5, 0, -0.5], [{ name: '10 mV/s', values: [-1, 2, 4, -2, -1] }]);
    const snapshot = structuredClone(original);
    const prepared = prepareElectrochemicalData(original, { kind: 'cv' });
    assert.equal(prepared.error, undefined);
    const option = createTemplateOption(prepared.data, 'line', style());
    assert.deepEqual(option.series[0].data, [[-0.5, -1], [0, 2], [0.5, 4], [0, -2], [-0.5, -1]]);
    assert.equal(option.series[0].smooth, false);
    assert.equal(option.series[0].connectNulls, false);
    assert.deepEqual(original, snapshot);
});

test('Nyquist changes imaginary convention only after an explicit selection and never takes absolute values', () => {
    const original = dataSet([2, 8, 15], [{ name: 'Sample A', values: [-1, -5, 2], errors: [0.2, 0.3, 0.4] }]);
    const snapshot = structuredClone(original);
    assert.deepEqual(prepareElectrochemicalData(original, { kind: 'nyquist' }).data, original);
    const converted = prepareElectrochemicalData(original, { kind: 'nyquist' }, 'raw-imaginary').data;
    assert.deepEqual(converted.series[0].values, [1, 5, -2]);
    assert.deepEqual(converted.series[0].errors, original.series[0].errors);
    assert.match(converted.warnings[0], /未取绝对值/);
    assert.deepEqual(original, snapshot);
    assert.deepEqual(prepareElectrochemicalData(original, { kind: 'cv' }, 'raw-imaginary').data, original);
});

test('Bode rejects zero or negative frequency or magnitude with actionable errors instead of dropping points', () => {
    for (const frequency of [0, -0.1, '10', Number.NaN]) {
        const result = prepareElectrochemicalData(dataSet([frequency, 100], [{ name: '|Z|', values: [20, 10] }]), { kind: 'bode', xLog: true });
        assert.equal(result.data, undefined);
        assert.match(result.error, /X 列全部为大于 0/);
    }
    for (const magnitude of [0, -1, Number.NaN]) {
        const result = prepareElectrochemicalData(dataSet([10, 100], [{ name: '|Z|', values: [magnitude, 10] }, { name: 'Phase', values: [-65, -30] }]), { kind: 'bode', xLog: true, yLog: true });
        assert.equal(result.data, undefined);
        assert.match(result.error, /左轴数值全部大于 0/);
    }
});

test('Bode uses logarithmic frequency and magnitude while keeping signed phase on the linear right axis', () => {
    const original = dataSet([100000, 10000, 1000, 100, 10, 1, 0.1], [{ name: '|Z|', values: [5, 6, 8, 20, 90, 800, 5000] }, { name: 'Phase', values: [-1, -5, -15, -30, -60, -78, -85] }]);
    const prepared = prepareElectrochemicalData(original, { kind: 'bode', xLog: true, yLog: true });
    assert.equal(prepared.error, undefined);
    const option = createTemplateOption(prepared.data, 'dual-axis', style({ xLabel: 'Frequency (Hz)', yLabel: '|Z| (Ω)', secondaryYLabel: 'Phase (°)', xLog: true, yLog: true }));
    assert.equal(option.xAxis.type, 'log');
    assert.equal(option.yAxis[0].type, 'log');
    assert.equal(option.yAxis[1].type, 'value');
    assert.deepEqual(option.series[1].data, [[100000, -1], [10000, -5], [1000, -15], [100, -30], [10, -60], [1, -78], [0.1, -85]]);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.doesNotMatch(svg, /NaN|Infinity/);
        for (const decade of ['10⁻¹', '10⁰', '10¹', '10²', '10³', '10⁴', '10⁵']) assert.ok(svg.includes(decade), `complete frequency label ${decade}`);
        for (const element of chart.getZr().storage.getDisplayList()) {
            if (element.type !== 'tspan' || element.ignore || element.invisible || !element.style?.text?.trim()) continue;
            const bounds = element.getBoundingRect().clone();
            if (element.transform) bounds.applyTransform(element.transform);
            assert.ok(bounds.x >= -2 && bounds.y >= -2 && bounds.x + bounds.width <= 680 + 2 && bounds.y + bounds.height <= 420 + 2, `complete Bode label ${element.style.text}`);
        }
        const x1 = chart.convertToPixel({ xAxisIndex: 0 }, 1), x10 = chart.convertToPixel({ xAxisIndex: 0 }, 10), x100 = chart.convertToPixel({ xAxisIndex: 0 }, 100);
        assert.ok(Math.abs((x10 - x1) - (x100 - x10)) < 0.001, 'frequency decades have equal pixel width');
    } finally { chart.dispose(); }
});

test('Nyquist preserves equal pixel distance per ohm, even when the real and imaginary spans differ', () => {
    const observations = dataSet([3, 50, 160, 400], [{ name: 'Sample A', values: [0, 65, 40, -15] }]);
    const snapshot = structuredClone(observations);
    for (const [width, height] of [[680, 420], [900, 500], [520, 600]]) {
        const option = createTemplateOption(observations, 'line', style({ width, height, xLabel: 'Re(Z) (Ω)', yLabel: '−Im(Z) (Ω)', equalAxes: true }));
        const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
        try {
            chart.setOption(option);
            const rect = chart.getModel().getComponent('grid').coordinateSystem.getRect();
            assert.ok(Math.abs(rect.width - rect.height) < 0.001, 'inner grid is square');
            const origin = chart.convertToPixel({ gridIndex: 0 }, [0, 0]);
            const xUnit = chart.convertToPixel({ gridIndex: 0 }, [10, 0]);
            const yUnit = chart.convertToPixel({ gridIndex: 0 }, [0, 10]);
            assert.ok(Math.abs(Math.abs(xUnit[0] - origin[0]) - Math.abs(yUnit[1] - origin[1])) < 0.001);
            assert.equal(option.xAxis.min, option.yAxis.min);
            assert.equal(option.xAxis.max, option.yAxis.max);
            assert.ok(option.yAxis.min < -15, 'inductive negative imaginary values stay visible');
            assert.doesNotMatch(chart.renderToSVGString(), /NaN|Infinity/);
            for (const element of chart.getZr().storage.getDisplayList()) {
                if (element.type !== 'tspan' || element.ignore || element.invisible || !element.style?.text?.trim()) continue;
                const bounds = element.getBoundingRect().clone();
                if (element.transform) bounds.applyTransform(element.transform);
                assert.ok(bounds.x >= -2 && bounds.y >= -2 && bounds.x + bounds.width <= width + 2 && bounds.y + bounds.height <= height + 2, `complete label ${element.style.text}`);
            }
        } finally { chart.dispose(); }
    }
    assert.deepEqual(observations, snapshot);
});

test('ordinary Cartesian templates retain their independent axis domains unless electrochemical flags are requested', () => {
    const option = createTemplateOption(dataSet([1, 2], [{ name: 'Measurement', values: [-500, 1000] }]), 'line', style());
    assert.equal(option.xAxis.type, 'value');
    assert.equal(option.yAxis.type, 'value');
    assert.equal(option.xAxis.min, undefined);
    assert.equal(option.yAxis.max, undefined);
    assert.equal(option.grid.outerBoundsMode, 'auto');
});
