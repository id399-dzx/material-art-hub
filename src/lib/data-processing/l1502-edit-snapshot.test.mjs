import test from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts';
import { DOMParser } from '@xmldom/xmldom';
import { validateL1502EditSnapshot } from './l1502-edit-snapshot.ts';
import { DRAWING_TEMPLATES } from './drawing-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import { suggestL1502Mapping, buildL1502Data } from './l1502-data.ts';
import { createL1502Option } from './l1502-render.ts';
import { l1502DefaultStyle } from './l1502-spec.ts';
import { initialExportSettings } from './publication.ts';

function fixture() {
    return {
        kind: 'l1502', version: 1, presetId: 'l1502-069',
        source: { name: '真实测量.xlsx', kind: 'file', sheets: [
            { name: '说明', matrix: [['Key', 'Value'], ['Instrument', 'Device A']] },
            { name: '已选实验工作表', matrix: [
                ['采样位置', '响应电流', '已计算SD', '批次', '样本名称'],
                [4, 12, 0.5, 'Treatment', 'Sample γ'], [0, 8, 0.2, 'Treatment', 'Sample α'], [1.5, 10, 0.4, 'Treatment', 'Sample β'],
                [4, 9, 0.7, 'Control', 'Control γ'], [0, 0, 0.1, 'Control', 'Control α'], [1.5, 7, 0.3, 'Control', 'Control β'],
            ] },
        ] },
        sheetIndex: 1, hasHeader: true,
        mapping: { x: 0, ys: [1], errors: { 1: 2 }, bounds: {}, group: 3, label: 4 },
        style: { ...l1502DefaultStyle('自有观测与误差', 920, 620), fontFamily: 'Times New Roman', fontSize: 12,
            xLabel: '位置 (mm)', yLabel: '电流 (mA)', colors: ['#31516d', '#cf7339'], showGrid: true,
            annotationX: 1.5, annotationText: '测量位置', intervalLabel: '已输入范围', yaw: 47, pitch: 31 },
        logX: false, logY: false, caption: '独立测量，误差为已计算 SD。',
        exportSettings: { widthMm: 174, dpi: 600, grayscale: true, preset: 'custom' },
    };
}

function prepare(snapshot) {
    const template = DRAWING_TEMPLATES.find(item => item.id === snapshot.presetId);
    assert.ok(template?.l1502);
    const spec = { ...template.l1502, logX: snapshot.logX, logY: snapshot.logY };
    const table = parseTemplateTable(snapshot.source.sheets[snapshot.sheetIndex].matrix, snapshot.hasHeader);
    const result = buildL1502Data(table, snapshot.mapping, spec);
    assert.equal(result.error, null);
    assert.ok(result.data);
    return { spec, data: result.data, option: createL1502Option(result.data, spec, snapshot.style) };
}

function renderSignature(option, style) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.ok(!/NaN|Infinity/.test(svg));
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const geometry = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text']);
        const shapes = [...document.getElementsByTagName('*')].filter(element => geometry.has(element.tagName)).map(element => ({
            tag: element.tagName,
            attributes: [...element.attributes].filter(attribute => !['id', 'class'].includes(attribute.name) && !attribute.value.includes('url(#')).map(attribute => [attribute.name, attribute.value]).sort(([a], [b]) => a.localeCompare(b)),
            text: element.tagName === 'text' ? element.textContent : undefined,
        }));
        assert.ok(shapes.some(shape => shape.tag === 'path'));
        return { svg, shapes };
    } finally { chart.dispose(); }
}

test('validated round trips preserve the selected sheet, custom bindings, styles, caption and publication settings', () => {
    const source = fixture(), restored = validateL1502EditSnapshot(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(restored, source);
    restored.source.sheets[1].matrix[1][1] = 900;
    restored.mapping.ys[0] = 2;
    restored.style.colors[0] = '#000000';
    assert.equal(source.source.sheets[1].matrix[1][1], 12);
    assert.deepEqual(source.mapping.ys, [1]);
    assert.equal(source.style.colors[0], '#31516d');
});

test('restored user observations keep row order, zeros, groups, errors and identical rendered geometry', () => {
    const source = fixture(), restored = validateL1502EditSnapshot(JSON.parse(JSON.stringify(source)));
    const before = prepare(source), after = prepare(restored);
    assert.deepEqual(after.data, before.data);
    assert.equal(after.data.skipped, 0);
    assert.deepEqual(after.data.series.map(series => series.name), ['Treatment', 'Control']);
    assert.deepEqual(after.data.series[0].points.map(point => point.x), [4, 0, 1.5]);
    assert.deepEqual(after.data.series[1].points.map(point => point.y), [9, 0, 7]);
    assert.deepEqual(after.data.series[0].points.map(point => point.error), [0.5, 0.2, 0.4]);
    assert.deepEqual(renderSignature(after.option, restored.style).shapes, renderSignature(before.option, source.style).shapes);
});

test('all 139 editable presets can validate their initial demo snapshot without losing the original table', () => {
    for (const template of DRAWING_TEMPLATES.filter(item => item.l1502)) {
        const table = parseTemplateTable(template.demo), mapping = suggestL1502Mapping(table, template.l1502);
        const snapshot = { kind: 'l1502', version: 1, presetId: template.id,
            source: { name: `${template.name} · 示例`, kind: 'demo', sheets: [{ name: 'Data', matrix: template.demo }] },
            sheetIndex: 0, hasHeader: true, mapping, style: l1502DefaultStyle(template.name),
            logX: !!template.l1502.logX, logY: !!template.l1502.logY, caption: '演示数据', exportSettings: initialExportSettings() };
        const serialized = JSON.parse(JSON.stringify(snapshot));
        const restored = validateL1502EditSnapshot(serialized);
        assert.deepEqual(restored, serialized, template.id);
    }
});

test('unsupported records, missing sheets and damaged source values are rejected before replacing editor state', () => {
    const changes = [
        state => { state.kind = 'processing'; }, state => { state.version = 2; },
        state => { state.presetId = 'line'; }, state => { state.source.kind = 'remote'; },
        state => { state.source.sheets = []; }, state => { state.source.sheets[1].matrix = 'not a table'; },
        state => { state.source.sheets[1].matrix[1] = {}; }, state => { state.source.sheets[1].matrix[1][1] = NaN; },
        state => { state.sheetIndex = 2; }, state => { state.sheetIndex = 0.5; }, state => { state.hasHeader = 'true'; },
        state => { state.mapping.x = -1; }, state => { state.mapping.ys = [1, 1]; },
        state => { state.mapping.z = 999; }, state => { state.mapping.errors[1] = 999; },
        state => { state.mapping.bounds[1] = { lower: 0, upper: 999 }; },
        state => { state.style.width = 0; }, state => { state.style.fontSize = Infinity; },
        state => { state.style.bins = 0; }, state => { state.style.pitch = 81; },
        state => { state.style.showGrid = 'false'; }, state => { state.logY = 'false'; },
        state => { state.exportSettings.dpi = 1200; }, state => { state.exportSettings.widthMm = 301; },
    ];
    for (const mutate of changes) {
        const state = fixture(); mutate(state);
        assert.throws(() => validateL1502EditSnapshot(state), /无法恢复图例/);
    }
});

test('injected objects, styles, executable values and malformed mapping dictionaries are rejected', () => {
    const changes = [
        state => { state.source.sheets[1].matrix[1][1] = { html: '<script>alert(1)</script>' }; },
        state => { state.source.sheets[1].matrix[1][1] = () => 12; },
        state => { state.style.title = { toString: 'javascript:alert(1)' }; },
        state => { state.style.colors = ['url(javascript:alert(1))']; },
        state => { state.style.colors = ['#fff; background-image: url(https://example.com/p)']; },
        state => { state.style.fontFamily = 'Arial; src:url(javascript:alert(1))'; },
        state => { state.mapping.ys = ["__proto__"]; },
        state => { state.mapping.errors = JSON.parse('{"__proto__":{"polluted":true}}'); },
        state => { state.mapping.bounds = JSON.parse('{"constructor":{"lower":0,"upper":1}}'); },
        state => { state.caption = { svg: '<svg onload="run()"/>' }; },
    ];
    for (const mutate of changes) {
        const state = fixture(); mutate(state);
        assert.throws(() => validateL1502EditSnapshot(state), /无法恢复图例/);
    }
    assert.equal({}.polluted, undefined);
});

test('HTML-looking user text stays inert text when the validated snapshot is rendered', () => {
    const state = fixture();
    state.style.title = '<script>alert("x")</script>';
    const restored = validateL1502EditSnapshot(JSON.parse(JSON.stringify(state)));
    const { svg } = renderSignature(prepare(restored).option, restored.style);
    assert.ok(!/<script\b|<foreignObject\b|onload=/.test(svg));
    assert.ok(svg.includes('&lt;script&gt;'));
});
