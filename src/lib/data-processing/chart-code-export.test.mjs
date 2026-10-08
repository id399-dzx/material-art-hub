import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as echarts from 'echarts';
import { canExportChartCode, createChartCodeSource, chartCodeFilename } from './chart-code-export.ts';
import { DRAWING_TEMPLATES } from './drawing-catalog.ts';
import { drawingPreviewOption } from '../../../scripts/drawing-preview-options.mjs';

const original = () => ({
    animation: false,
    title: { text: 'Current observations' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', name: 'Samples', data: [0, -2, 7], lineStyle: { color: '#b588a5', width: 3 } }],
});

const sandboxSource = readFileSync(new URL('../../../public/chart-code-sandbox.js', import.meta.url), 'utf8');
const workerSource = sandboxSource.match(/const workerSource = String\.raw`([\s\S]*?)\n    `;/)?.[1];
assert.ok(workerSource, 'The tested worker must be the actual browser implementation.');

function execute(code) {
    let result;
    const context = vm.createContext({ capture: value => { result = value; } });
    vm.runInContext('self = globalThis; self.postMessage = value => capture(value);', context);
    vm.runInContext(workerSource, context);
    context.input = { id: 7, code };
    vm.runInContext('self.onmessage({ data: input })', context, { timeout: 1000 });
    return result;
}

function ssr(option) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
    try {
        chart.setOption(option);
        const references = new Map();
        return chart.renderToSVGString().replace(/zr\d+-(?:cls-\d+|c\d+)/g, value => {
            if (!references.has(value)) references.set(value, `chart-ref-${references.size}`);
            return references.get(value);
        });
    } finally { chart.dispose(); }
}

test('starter code contains the current observations and preserves the native SVG exactly', () => {
    const option = original(), untouched = structuredClone(option);
    const { code, warnings } = createChartCodeSource(option);
    assert.deepEqual(warnings, []);
    const result = execute(code);
    assert.equal(result.ok, true);
    const recovered = JSON.parse(result.json);
    assert.deepEqual(recovered, option);
    assert.deepEqual(option, untouched);
    assert.equal(ssr(recovered), ssr(option));
    assert.match(code, /const option =/);
});

test('formatter fallbacks are disclosed while all raw observations are preserved', () => {
    const option = { ...original(), tooltip: { formatter: params => String(params.value) } };
    const { code, warnings } = createChartCodeSource(option);
    assert.equal(warnings.length, 1);
    assert.match(code, /option\.tooltip\.formatter/);
    assert.match(code, /数据不变/);
    const result = execute(code);
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.json).series, option.series);
    assert.equal(JSON.parse(result.json).tooltip.formatter, undefined);
});

test('real native line, grouped bar and radar options retain the code entry despite legend formatters', () => {
    for (const chartId of ['line', 'grouped-bar', 'radar']) {
        const template = DRAWING_TEMPLATES.find(item => item.chartId === chartId && !item.l1502 && !item.electrochemical);
        assert.ok(template, chartId);
        const { option } = drawingPreviewOption(template);
        assert.equal(canExportChartCode(option), true, chartId);
        const code = createChartCodeSource(option);
        const result = execute(code.code);
        assert.equal(result.ok, true, result.error);
        const json = JSON.parse(result.json);
        assert.deepEqual(json.series.map(series => series.data), option.series.map(series => series.data), chartId);
    }
});

test('unsupported geometry and calculated encodings never yield a partial chart', () => {
    const options = [
        { ...original(), series: [{ type: 'custom', renderItem: () => ({}), data: [[1, 2]] }] },
        { ...original(), series: [{ type: 'scatter', symbolSize: value => value[2] * 2, data: [[1, 2, 3]] }] },
        { ...original(), graphic: { type: 'group', onclick: () => true } },
    ];
    for (const option of options) {
        assert.equal(canExportChartCode(option), false);
        assert.throws(() => createChartCodeSource(option), /暂不支持|自定义/);
    }
    assert.equal(canExportChartCode(null), false);
    assert.equal(canExportChartCode(original()), true);
});

test('the real worker supports const, let, assignment, bare options and JavaScript data calculations', () => {
    for (const code of [
        'const values = [1, 3, 5].map(x => x * 2); const option = { series: [{ type: "bar", data: values }] };',
        'let option = { series: [{ type: "bar", data: [2, 6, 10] }] };',
        'option = { series: [{ type: "bar", data: [2, 6, 10] }] };',
        '{ series: [{ type: "bar", data: [2, 6, 10] }] }',
    ]) {
        const result = execute(code);
        assert.equal(result.ok, true, result.error);
        assert.deepEqual(JSON.parse(result.json).series[0].data, [2, 6, 10]);
    }
});

test('the real worker reports syntax, runtime, invalid numeric, cyclic and callback errors', () => {
    const invalid = [
        ['const option = {', /Unexpected|token|identifier/],
        ['throw new Error("用户错误")', /用户错误/],
        ['const option = { series: [{ type: "line", data: [NaN] }] };', /NaN/],
        ['const option = {}; option.self = option;', /循环引用/],
        ['const option = { tooltip: { formatter: value => value } };', /函数回调/],
        ['const option = { series: [{ type: "custom" }] };', /custom/],
        ['const option = { value: 1n };', /不支持/],
    ];
    for (const [code, pattern] of invalid) {
        const result = execute(code);
        assert.equal(result.ok, false);
        assert.match(result.error, pattern);
    }
});

test('the real worker cannot request network, create nested workers or send forged preview messages', () => {
    const result = execute('const option = { disabled: [typeof fetch, typeof XMLHttpRequest, typeof Worker, typeof importScripts, typeof postMessage] };');
    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(result.json).disabled, Array(5).fill('undefined'));
    assert.match(sandboxSource, /worker\.terminate\(\)/);
    assert.match(sandboxSource, /TIMEOUT = 2500/);
    assert.match(sandboxSource, /event\.source !== parent/);
    const html = readFileSync(new URL('../../../public/chart-code-sandbox.html', import.meta.url), 'utf8');
    assert.match(html, /connect-src 'none'/);
    assert.doesNotMatch(html, /https?:/);
});

test('invalid observations, loops and oversized source cannot silently become valid JSON data', () => {
    assert.equal(canExportChartCode({ ...original(), series: [{ type: 'line', data: [Infinity] }] }), false);
    const cycle = original(); cycle.cycle = cycle;
    assert.equal(canExportChartCode(cycle), false);
    assert.equal(canExportChartCode({ ...original(), title: { text: 'x'.repeat(2_000_000) } }), false);
    assert.throws(() => createChartCodeSource({ ...original(), title: { text: 'x'.repeat(2_000_000) } }), /过大/);
});

test('eligibility uses the actual formatted source length rather than compact JSON length', () => {
    const option = { ...original(), title: { text: 'x'.repeat(1_990_000) }, series: [{ type: 'line', data: Array(1500).fill(1) }] };
    assert.ok(JSON.stringify(option).length < 2_000_000);
    assert.equal(canExportChartCode(option), false);
    assert.throws(() => createChartCodeSource(option), /过大/);
});

test('the real worker bounds submitted ECharts data, series, nested graphics and depth before rendering', () => {
    for (const code of [
        'const option = { series: [{ type: "line", data: Array(20001).fill(1) }] };',
        'const option = { series: Array.from({length:129}, () => ({type:"line",data:[1]})) };',
        'const option = { dataset: {source: Array.from({length:20001}, () => [1, 2])}, series:[{type:"line"}] };',
        'const option = { graphic: {type:"group",children:Array.from({length:20001},()=>({type:"rect"}))} };',
        'const option = {}; let nested = option; for(let i=0;i<65;i++) {nested.children={};nested=nested.children;}',
    ]) {
        const result = execute(code);
        assert.equal(result.ok, false);
        assert.match(result.error, /20,000|128|64/);
    }
    const computedOnly = execute('const unused = Array(30000).fill(1); const option = {series:[{type:"line",data:unused.slice(0,3)}]};');
    assert.equal(computedOnly.ok, true);
    assert.deepEqual(JSON.parse(computedOnly.json).series[0].data, [1, 1, 1]);
});

test('download filenames retain Chinese titles and remove path controls', () => {
    assert.equal(chartCodeFilename('电化学/CV:测试', 'svg'), '电化学_CV_测试.svg');
    assert.equal(chartCodeFilename('', 'js'), '科研数据图.js');
});
