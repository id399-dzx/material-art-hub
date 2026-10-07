import test from 'node:test';
import assert from 'node:assert/strict';
import { CHART_PALETTES, DEFAULT_CHART_PALETTE, SCALAR_PALETTES, findChartPalette, getChartPalette, getValueColors, getChartValueColors, getRecommendedPalette, getScalarPalette, interpolateChartColor } from './chart-palettes.ts';
import { createTemplateOption } from './template-chart.ts';
import { L1502_COLORS, l1502DefaultStyle } from './l1502-spec.ts';
import { L1502_TEMPLATES } from './l1502-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';
import { createL1502TwoDimensionalOption } from './l1502-render-2d.ts';
import { createL1502SpatialOption } from './l1502-render-spatial.ts';
import { createL1502Option } from './l1502-render.ts';

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
        const style = { ...l1502DefaultStyle(template.name), colors: [...theme.colors], scalarPalette: undefined };
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
        const option = createL1502SpatialOption(data, template.l1502, { ...l1502DefaultStyle(template.name), colors: [...theme.colors], scalarPalette: undefined });
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
                    assert.equal(point.itemStyle.color, interpolateChartColor(getScalarPalette('viridis').colors, position));
                }
            }
            assert.deepEqual(data, before);
        }
    }
});

test('independent scalar schemes use the published blue/pink and blue/red stops rather than categorical colors', () => {
    assert.deepEqual(SCALAR_PALETTES.map(palette => palette.id), ['viridis', 'blue', 'blue-pink', 'blue-red', 'warm', 'gray']);
    assert.deepEqual(getScalarPalette('blue-pink').colors, ['#1B6FAE', '#33B3E3', '#DFEAF2', '#F5B5BB', '#E5303D']);
    assert.deepEqual(getScalarPalette('blue-red').colors, ['#27348B', '#8F9BD6', '#F3F0F0', '#E08A85', '#B5121B']);
    for (const scalar of SCALAR_PALETTES) {
        for (const color of scalar.colors) assert.match(color, /^#[a-f\d]{6}$/i);
        for (const category of CHART_PALETTES) assert.deepEqual(getChartValueColors({ colors: category.colors, palette: category.id, scalarPalette: scalar.id }), scalar.colors);
        assert.deepEqual(getChartValueColors({ customColors: ['#ff0000'], palette: 'mono', scalarPalette: scalar.id }, 'diverging'), scalar.colors, 'explicit numeric scheme is independent of classification');
    }
    const viridisBrightness = getScalarPalette('viridis').colors.map(luminance);
    assert.ok(viridisBrightness.every((value, index) => index === 0 || value > viridisBrightness[index - 1]), 'viridis brightens steadily');
});

test('old saved colors without a scalar field retain custom and previously matched scalar maps', () => {
    const previousJournal = ['#3B6E9E', '#CF7868', '#4B9188', '#8C79AA', '#B99A56', '#687C94', '#B8849B', '#78A8BA'];
    assert.deepEqual(getChartValueColors({ colors: previousJournal }), ['#EEF4F7', '#C4DDE4', '#8DBDC9', '#568FA7', '#315D82']);
    assert.deepEqual(getChartValueColors({ colors: previousJournal }, 'diverging'), ['#3B6E9E', '#ffffff', '#CF7868']);
    assert.deepEqual(getChartValueColors({ colors: ['#123456', '#abcdef'] }), ['#123456', '#abcdef']);
    assert.deepEqual(getChartValueColors({ customColors: ['#123456', '#abcdef'], palette: 'journal' }), ['#123456', '#abcdef']);
});

test('freezing an old custom scalar map lets comparison change category colors without changing numeric colors or data', () => {
    const template = L1502_TEMPLATES.find(item => item.l1502.kind === 'bubble' && item.l1502.colorByValue), data = prepare(template), before = structuredClone(data);
    const old = { ...l1502DefaultStyle(template.name), colors: ['#123456', '#abcdef', '#ef4567'], scalarPalette: undefined };
    const original = createL1502Option(data, template.l1502, old);
    const frozen = { ...old, scalarColors: getChartValueColors(old) };
    for (const theme of CHART_PALETTES) {
        const style = { ...frozen, colors: [...theme.colors] };
        const option = createL1502Option(data, template.l1502, style);
        assert.deepEqual(option.visualMap.inRange.color, original.visualMap.inRange.color);
        assert.equal(option.visualMap.min, original.visualMap.min);
        assert.equal(option.visualMap.max, original.visualMap.max);
        assert.deepEqual(option.series.map(series => series.data), original.series.map(series => series.data));
        assert.deepEqual(data, before);
    }
    const selected = { ...frozen, scalarPalette: 'blue-red' };
    assert.deepEqual(getChartValueColors(selected), getScalarPalette('blue-red').colors, 'a newly selected explicit scheme takes priority over frozen custom stops');
    assert.deepEqual(frozen.scalarColors, old.colors);
    const detached = getChartValueColors(frozen); detached[0] = '#ffffff';
    assert.equal(frozen.scalarColors[0], '#123456');
});

test('new template defaults recommend palettes by actual chart kind', () => {
    assert.deepEqual(getRecommendedPalette('surface'), { palette: 'ocean', scalarPalette: 'viridis' });
    assert.deepEqual(getRecommendedPalette('bar'), { palette: 'earth', scalarPalette: 'warm' });
    assert.deepEqual(getRecommendedPalette('box'), { palette: 'berry', scalarPalette: 'blue-pink' });
    assert.equal(getRecommendedPalette('grouped-box').palette, 'berry');
    assert.equal(getRecommendedPalette('filled-distribution').palette, 'berry');
    assert.equal(getRecommendedPalette('embedding-scatter').palette, 'ocean');
    assert.equal(getRecommendedPalette('horizontal-error').palette, 'earth');
    assert.equal(getRecommendedPalette('hatched-percent').palette, 'earth');
    const spec = L1502_TEMPLATES.find(item => item.l1502.kind === 'bar').l1502;
    assert.deepEqual(l1502DefaultStyle('Bar', 760, 500, spec).colors, getChartPalette('earth').colors);
    assert.equal(l1502DefaultStyle('Bar', 760, 500, spec).scalarPalette, 'warm');
});

test('changing independent numeric colors leaves measured heatmap cells, axes, value ranges and surface vertices intact', () => {
    const heat = L1502_TEMPLATES.find(item => item.l1502.kind === 'heatmap'), surface = L1502_TEMPLATES.find(item => item.l1502.kind === 'surface');
    const heatData = prepare(heat), surfaceData = prepare(surface), style = l1502DefaultStyle('Measured');
    const firstHeat = createL1502Option(heatData, heat.l1502, style), firstSurface = createL1502Option(surfaceData, surface.l1502, style);
    const geometry = option => option.graphic.filter(item => item.info?.coordinates).map(item => item.info);
    for (const scalar of SCALAR_PALETTES) {
        const option = createL1502Option(heatData, heat.l1502, { ...style, scalarPalette: scalar.id });
        assert.deepEqual(option.series[0].data, firstHeat.series[0].data);
        assert.deepEqual(option.xAxis, firstHeat.xAxis);
        assert.deepEqual(option.yAxis, firstHeat.yAxis);
        assert.equal(option.visualMap.min, firstHeat.visualMap.min);
        assert.equal(option.visualMap.max, firstHeat.visualMap.max);
        assert.deepEqual(option.visualMap.inRange.color, scalar.colors);
        assert.deepEqual(geometry(createL1502Option(surfaceData, surface.l1502, { ...style, scalarPalette: scalar.id })), geometry(firstSurface));
    }
});

test('L1502 mono and accessible native lines use distinct line and point styles without changing error or grouping data', () => {
    const template = L1502_TEMPLATES.find(item => item.l1502.issue === 29), data = prepare(template), before = structuredClone(data);
    for (const id of ['mono', 'accessible']) {
        const style = { ...l1502DefaultStyle(template.name), colors: [...getChartPalette(id).colors] };
        const raw = createL1502TwoDimensionalOption(data, template.l1502, style), option = createL1502Option(data, template.l1502, style);
        assert.deepEqual(option.series.map(series => series.data), raw.series.map(series => series.data));
        const lines = option.series.filter(series => series.type === 'line');
        assert.equal(lines[0].lineStyle.type, 'solid');
        assert.equal(lines[1].lineStyle.type, 'dashed');
        assert.equal(lines[0].symbol, 'circle');
        assert.equal(lines[1].symbol, 'rect');
        assert.equal(option.series.filter(series => series.type === 'custom').length, raw.series.filter(series => series.type === 'custom').length);
        assert.deepEqual(data, before);
    }
});
