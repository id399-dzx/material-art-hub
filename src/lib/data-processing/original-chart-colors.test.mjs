import assert from 'node:assert/strict';
import test from 'node:test';
import * as echarts from 'echarts';
import { DOMParser } from '@xmldom/xmldom';
import { DRAWING_TEMPLATES } from './drawing-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import { buildDrawingData, suggestDrawingMapping } from './drawing-data.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';
import { l1502DefaultLayout, l1502DefaultStyle } from './l1502-spec.ts';
import { createL1502Option } from './l1502-render.ts';
import { createTemplateOption } from './template-chart.ts';
import { getRecommendedPalette, getScalarPalette, interpolateChartColor } from './chart-palettes.ts';
import { isOriginalColorCategory, originalL1502Colors, originalTemplateColors } from './original-chart-colors.ts';

const originalL1502 = ['#147a8b', '#e3a438', '#9a5b90', '#4566ac', '#62a889', '#d86864', '#7a70b4', '#7f939d'];
const originalField = ['#244d8b', '#64bbc5', '#f5e6a7', '#cc4943'];
const targets = DRAWING_TEMPLATES.filter(template => !template.echarts && isOriginalColorCategory(template.category));

function prepare(template) {
    const table = parseTemplateTable(template.demo);
    if (template.l1502) {
        const mapping = suggestL1502Mapping(table, template.l1502);
        const result = buildL1502Data(table, mapping, template.l1502);
        assert.equal(result.error, null, template.id);
        const layout = l1502DefaultLayout(template.l1502);
        const style = { ...l1502DefaultStyle(template.name, layout.width, layout.height, template.l1502),
            fontSize: 8 * 25.4 / 72 * layout.width / layout.widthMm, xLabel: template.xLabel, yLabel: template.yLabel };
        return { data: result.data, style, render: style => createL1502Option(result.data, template.l1502, style), original: originalL1502Colors(template.category) };
    }
    const mapping = suggestDrawingMapping(table, template.chartId, template.variant, 'bar');
    const result = buildDrawingData(table, mapping, template.chartId, template.variant, 'replicates', 'SD', 'bar');
    assert.equal(result.error, null, template.id);
    const style = { title: template.name, xLabel: template.xLabel, yLabel: template.yLabel,
        fontFamily: 'Arial', fontSize: 8 * 25.4 / 72 * 680 / 85, width: 680, height: 420,
        ...getRecommendedPalette(template.variant ?? template.chartId), showGrid: false, showValues: false,
        errorMeasure: 'SD', yaw: 35, pitch: 25, sphereGuide: template.paper?.region.kind !== 'vectors', variant: template.variant };
    return { data: result.data, style, render: style => createTemplateOption(result.data, template.chartId, style), original: originalTemplateColors(template) };
}

function renderGeometry(option, style) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.doesNotMatch(svg, /NaN|Infinity|<image\b/);
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const tags = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text']);
        // ECharts chooses a contrasting text outline from the cell color; it does not move the label.
        const colorAttributes = new Set(['id', 'class', 'fill', 'stroke', 'stop-color', 'stroke-width', 'stroke-miterlimit', 'paint-order']);
        const geometry = [...document.getElementsByTagName('*')].filter(element => tags.has(element.tagName)).map(element => ({
            tag: element.tagName,
            attributes: [...element.attributes].filter(attribute => !colorAttributes.has(attribute.name) && !attribute.value.includes('url(#')).map(attribute => [attribute.name, attribute.value]).sort(([a], [b]) => a.localeCompare(b)),
            text: element.tagName === 'text' ? element.textContent : undefined,
        }));
        return { svg, geometry };
    } finally { chart.dispose(); }
}

test('restoring original colors is restricted to all 56 requested templates and leaves the other 126 unchanged', () => {
    assert.equal(targets.length, 56);
    assert.deepEqual(Object.fromEntries(['热图', '三维图', '等高线与场图'].map(category => [category, targets.filter(template => template.category === category).length])), { 热图: 9, 三维图: 36, 等高线与场图: 11 });
    const unaffected = DRAWING_TEMPLATES.filter(template => !template.echarts && !isOriginalColorCategory(template.category));
    assert.equal(unaffected.length, 126);
    for (const template of unaffected) {
        assert.equal(originalL1502Colors(template.category), null, template.id);
        assert.equal(originalTemplateColors(template), null, template.id);
        const defaults = getRecommendedPalette(template.variant ?? template.l1502?.kind ?? template.chartId);
        assert.deepEqual({ ...defaults, ...originalTemplateColors(template) }, defaults, template.id);
    }
});

test('original arrays are isolated per editor so user changes cannot alter other templates or source metadata', () => {
    const first = originalL1502Colors('三维图');
    first.colors[0] = '#000000'; first.scalarColors[0] = '#ffffff';
    assert.deepEqual(originalL1502Colors('三维图').colors, originalL1502);
    assert.deepEqual(originalL1502Colors('三维图').scalarColors, originalL1502);
    const paper = targets.find(template => template.variant === 'frequency-heatmap');
    const restored = originalTemplateColors(paper);
    restored.customColors[0] = '#000000';
    assert.equal(paper.paper.region.colors[0], '#ffffd4');
});

test('the original defaults render every requested template without changing data, geometry, domains, or numerical color ranges', () => {
    for (const template of targets) {
        const prepared = prepare(template), observations = structuredClone(prepared.data);
        const before = prepared.render(prepared.style), restoredStyle = { ...prepared.style, ...prepared.original }, after = prepared.render(restoredStyle);
        assert.deepEqual(prepared.data, observations, template.id);
        assert.equal(JSON.stringify(after.xAxis), JSON.stringify(before.xAxis), template.id);
        assert.equal(JSON.stringify(after.yAxis), JSON.stringify(before.yAxis), template.id);
        if (before.visualMap) for (const property of ['min', 'max', 'dimension', 'seriesIndex', 'type']) assert.deepEqual(after.visualMap[property], before.visualMap[property], `${template.id}: ${property}`);
        const oldGeometry = renderGeometry(before, prepared.style), restored = renderGeometry(after, restoredStyle);
        assert.deepEqual(restored.geometry, oldGeometry.geometry, `${template.id}: only colors change`);
        if (template.l1502) {
            assert.deepEqual(restoredStyle.colors, originalL1502, template.id);
            if (after.color) assert.deepEqual(after.color, originalL1502, template.id);
            if (after.visualMap?.type === 'continuous') assert.deepEqual(after.visualMap.inRange.color, template.category === '三维图' ? originalL1502 : originalField, template.id);
        } else if (template.chartId === 'heatmap') {
            const signedAttention = template.variant === 'attention-heatmap' && after.visualMap.min < 0;
            const expected = signedAttention ? ['#38679b', '#ffffff', '#ff0000'] : template.paper?.region.colors ?? ['#f4eff9', '#acb9d3', '#38679b'];
            assert.deepEqual(after.visualMap.inRange.color, expected, template.id);
        }
    }
});

test('constant field values retain the original cyan piece while a deliberate new scalar palette overrides it', () => {
    const template = targets.find(template => template.id === 'l1502-022');
    const prepared = prepare(template), data = structuredClone(prepared.data);
    data.matrix.cells.forEach(cell => { cell.value = 4; });
    const style = { ...prepared.style, ...originalL1502Colors('热图') };
    const original = createL1502Option(data, template.l1502, style);
    assert.equal(original.visualMap.type, 'piecewise');
    assert.deepEqual(original.visualMap.pieces, [{ value: 4, label: '4', color: '#64bbc5' }]);
    const changed = createL1502Option(data, template.l1502, { ...style, scalarPalette: 'blue-pink' });
    assert.equal(changed.visualMap.pieces[0].color, interpolateChartColor(getScalarPalette('blue-pink').colors, .5));
    assert.equal(changed.visualMap.pieces[0].value, 4);
});

test('an explicit numeric gradient remains independent of classification colors even for signed attention matrices', () => {
    const data = { x: ['甲', '乙'], series: [{ name: 'A', values: [-2, 3] }], skipped: 0, warnings: [] };
    const style = { title: '数值色阶', xLabel: 'X', yLabel: 'Y', fontFamily: 'Arial', fontSize: 12, width: 680, height: 420,
        palette: 'journal', showGrid: false, showValues: false, errorMeasure: 'SD', variant: 'attention-heatmap',
        customColors: ['#ffffff', '#ff0000'], scalarColors: ['#123456', '#abcdef', '#654321'] };
    const option = createTemplateOption(data, 'heatmap', style);
    assert.deepEqual(option.visualMap.inRange.color, style.scalarColors);
    assert.equal(option.visualMap.min, -3); assert.equal(option.visualMap.max, 3);
    const chosen = createTemplateOption(data, 'heatmap', { ...style, scalarPalette: 'gray' });
    assert.deepEqual(chosen.visualMap.inRange.color, [...getScalarPalette('gray').colors]);
    assert.equal(chosen.visualMap.min, -3); assert.equal(chosen.visualMap.max, 3);
});
