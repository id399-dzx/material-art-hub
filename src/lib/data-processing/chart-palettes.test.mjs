import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_PALETTES, DEFAULT_CHART_PALETTE, findChartPalette, getChartPalette, getValueColors, interpolateChartColor } from './chart-palettes.ts';
import { createTemplateOption } from './template-chart.ts';
import { L1502_COLORS, l1502DefaultStyle } from './l1502-spec.ts';
import { L1502_TEMPLATES } from './l1502-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';
import { createL1502TwoDimensionalOption } from './l1502-render-2d.ts';
import { createL1502SpatialOption } from './l1502-render-spatial.ts';

const chartStyle = (palette, extra = {}) => ({ title: 'Palette', xLabel: 'X', yLabel: 'Y', fontFamily: 'Arial', fontSize: 14, palette, showGrid: false, showValues: false, errorMeasure: 'SD', ...extra });
const matrix = { x: ['A', 'B'], series: [{ name: 'Measured', values: [0, 10] }], skipped: 0, warnings: [] };
const prepare = (template) => {
    const table = parseTemplateTable(template.demo);
    return buildL1502Data(table, suggestL1502Mapping(table, template.l1502), template.l1502).data;
};
const luminance = (hex) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);

test('seven themes use valid distinct category colors and ordered light-to-dark numeric scales', () => {
    assert.deepEqual(CHART_PALETTES.map(palette => palette.id), ['journal', 'ocean', 'earth', 'berry', 'soft', 'accessible', 'mono']);
    for (const theme of CHART_PALETTES) {
        assert.equal(new Set(theme.colors.map(color => color.toLowerCase())).size, theme.colors.length, theme.id);
        for (const color of [...theme.colors, ...theme.sequential, ...theme.diverging]) assert.match(color, /^#[a-f\d]{6}$/i, theme.id);
        const brightness = theme.sequential.map(luminance);
        assert.ok(brightness.every((value, index) => index === 0 || value < brightness[index - 1]), `${theme.id} must darken steadily as values increase`);
        assert.notDeepEqual(theme.sequential, theme.colors, 'a category palette is not a scalar scale');
        assert.equal(theme.diverging[1].toLowerCase(), '#ffffff');
    }
    assert.equal(DEFAULT_CHART_PALETTE, 'journal');
    assert.deepEqual(L1502_COLORS, getChartPalette().colors);
});

test('palette matching ignores hex case, and unknown saved custom colors are preserved without mutation', () => {
    for (const theme of CHART_PALETTES) assert.equal(findChartPalette(theme.colors.map(color => color.toLowerCase()))?.id, theme.id);
    const saved = ['#147a8b', '#e3a438', '#9a5b90'];
    assert.equal(findChartPalette(saved), undefined);
    for (const mode of ['sequential', 'diverging']) {
        const mapped = getValueColors(saved, mode);
        assert.deepEqual(mapped, saved);
        mapped[0] = '#ffffff';
        assert.equal(saved[0], '#147a8b');
    }
    assert.deepEqual(getValueColors([], 'sequential', 'earth'), getChartPalette('earth').sequential);
});

test('legacy heatmaps and line series use each selected theme for separate numeric and categorical encoding', () => {
    for (const theme of CHART_PALETTES) {
        const before = structuredClone(matrix);
        const heatmap = createTemplateOption(matrix, 'heatmap', chartStyle(theme.id));
        assert.deepEqual(heatmap.visualMap.inRange.color, theme.sequential, theme.id);
        assert.equal(heatmap.visualMap.min, 0);
        assert.equal(heatmap.visualMap.max, 10);
        assert.deepEqual(matrix, before);
        const line = createTemplateOption(matrix, 'line', chartStyle(theme.id));
        assert.equal(line.series[0].itemStyle.color, theme.colors[0]);
        const signed = createTemplateOption({ ...matrix, series: [{ name: 'Measured', values: [-2, 10] }] }, 'heatmap', chartStyle(theme.id, { variant: 'attention-heatmap' }));
        assert.deepEqual(signed.visualMap.inRange.color, theme.diverging);
        assert.equal(signed.visualMap.min, -10);
        assert.equal(signed.visualMap.max, 10);
    }
});

test('L1502 scalar heatmaps honor theme changes while keeping all supplied cells and bounds', () => {
    const template = L1502_TEMPLATES.find(item => item.l1502.kind === 'heatmap'), data = prepare(template), before = structuredClone(data);
    for (const theme of CHART_PALETTES) {
        const style = { ...l1502DefaultStyle(template.name), colors: [...theme.colors] };
        const option = createL1502TwoDimensionalOption(data, template.l1502, style);
        assert.deepEqual(option.visualMap.inRange.color, theme.sequential);
        assert.equal(option.visualMap.min, Math.min(...data.matrix.cells.map(cell => cell.value)));
        assert.equal(option.visualMap.max, Math.max(...data.matrix.cells.map(cell => cell.value)));
        assert.deepEqual(data, before);
    }
});

test('L1502 spatial surface color legends use the same theme scale as projected geometry', () => {
    const template = L1502_TEMPLATES.find(item => item.l1502.kind === 'surface'), data = prepare(template), before = structuredClone(data);
    for (const theme of CHART_PALETTES) {
        const option = createL1502SpatialOption(data, template.l1502, { ...l1502DefaultStyle(template.name), colors: [...theme.colors] });
        const scale = option.graphic.find(element => element.info?.kind === 'color-scale');
        assert.ok(scale);
        assert.equal(scale.style.fill.colorStops[0].color, interpolateChartColor(theme.sequential, 1));
        assert.equal(scale.style.fill.colorStops.at(-1).color, interpolateChartColor(theme.sequential, 0));
        assert.deepEqual(data, before);
    }
});

test('numeric interpolation clamps endpoints and accepts a single saved custom color', () => {
    assert.equal(interpolateChartColor(['#123456'], .25), 'rgb(18,52,86)');
    assert.equal(interpolateChartColor(['#000000', '#ffffff'], -.5), 'rgb(0,0,0)');
    assert.equal(interpolateChartColor(['#000000', '#ffffff'], 2), 'rgb(255,255,255)');
});

test('polar lines color measured points with the scalar scale without assigning unsupported line gradients', () => {
    for (const issue of [81, 133]) {
        const template = L1502_TEMPLATES.find(item => item.l1502.issue === issue), data = prepare(template), before = structuredClone(data);
        for (const theme of [getChartPalette('journal'), getChartPalette('berry')]) {
            const option = createL1502TwoDimensionalOption(data, { ...template.l1502, colorByValue: true }, { ...l1502DefaultStyle(template.name), colors: [...theme.colors] });
            assert.deepEqual(option.visualMap.seriesIndex, [], 'the bar is retained without unsupported polar line visualMeta');
            for (let index = 0; index < option.series.length; index++) {
                const series = option.series[index];
                assert.equal(series.lineStyle.color, theme.colors[index % theme.colors.length]);
                for (const point of series.data) {
                    const position = option.visualMap.max === option.visualMap.min ? .5 : (point.value[3] - option.visualMap.min) / (option.visualMap.max - option.visualMap.min);
                    assert.equal(point.itemStyle.color, interpolateChartColor(theme.sequential, position));
                }
            }
            assert.deepEqual(data, before);
        }
    }
});
