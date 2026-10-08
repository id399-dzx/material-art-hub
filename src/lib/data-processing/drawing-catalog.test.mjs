import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DRAWING_TEMPLATES, DRAWING_TYPES, drawingTemplateForChart, panelTemplateId, paperStructureKey, PAPER_STRUCTURE_REPRESENTATIVES, PAPER_TEMPLATE_COVERAGE } from './drawing-catalog.ts';
import { PAPER_FIGURES } from './paper-figures/catalog.ts';
import { CHART_TEMPLATES, parseTemplateTable } from './templates.ts';
import { suggestDrawingMapping, buildDrawingData } from './drawing-data.ts';
import { suggestL1502Mapping, buildL1502Data } from './l1502-data.ts';
import { renderDrawingPreview } from '../../../scripts/drawing-preview-options.mjs';

const structure = template => template.chartId === 'error-bar'
    ? template.paper?.region.kind === 'horizontal' ? 'horizontal-bar' : 'error-bar'
    : template.chartId === 'trend' && template.paper?.region.kind === 'area' ? 'stacked-area' : template.chartId;

test('library keeps distinct paper data structures even when they share an engine', () => {
    assert.equal(DRAWING_TEMPLATES.length, 190);
    assert.equal(new Set(DRAWING_TEMPLATES.map(t => t.id)).size, 190);
    assert.equal(DRAWING_TYPES.length, 14);
    const paper = DRAWING_TEMPLATES.filter(t => t.paper);
    assert.equal(paper.length, 18);
    assert.equal(new Set(paper.map(t => t.variant)).size, 18);
    assert.equal(DRAWING_TEMPLATES.filter(t => !t.paper && !t.electrochemical && !t.l1502 && !t.echarts).length, 17);
    assert.equal(DRAWING_TEMPLATES.filter(t => t.echarts).length, 8);
    assert.equal(DRAWING_TEMPLATES.filter(t => t.electrochemical).length, 8);
    assert.equal(DRAWING_TEMPLATES.filter(t => t.l1502).length, 139);
    // A density heatmap, a sparse attention matrix and a frequency matrix are not interchangeable.
    assert.equal(paper.filter(t => t.chartId === 'heatmap').length, 3);
    assert.ok(paper.some(t => t.variant === 'stacked-area' && t.chartId === 'line'));
    for (const template of DRAWING_TEMPLATES) {
        assert.ok(template.chartId);
        assert.notEqual(template.paper?.region.kind, 'image');
        assert.ok(template.preview.startsWith('/drawing-previews/'));
    }
});

test('all 69 numerical source panels map to retained representatives while all 28 images stay excluded', () => {
    assert.equal(PAPER_TEMPLATE_COVERAGE.length, 69);
    assert.equal(new Set(PAPER_TEMPLATE_COVERAGE.map(item => `${item.figureId}/${item.regionId}`)).size, 69);
    const counts = {};
    let images = 0;
    for (const figure of PAPER_FIGURES) for (const region of figure.regions) {
        const key = paperStructureKey(figure.id, region);
        const coverage = PAPER_TEMPLATE_COVERAGE.find(item => item.figureId === figure.id && item.regionId === region.id);
        if (region.kind === 'image') {
            images++;
            assert.equal(key, null);
            assert.equal(coverage, undefined);
            assert.ok(!DRAWING_TEMPLATES.some(item => item.id === panelTemplateId(figure.id, region.id)));
            continue;
        }
        assert.ok(coverage, `${figure.id}/${region.id}`);
        assert.equal(coverage.variant, key);
        const retained = DRAWING_TEMPLATES.find(item => item.id === coverage.representativeId);
        assert.ok(retained, `${figure.id}/${region.id}`);
        assert.equal(retained.variant, key);
        counts[key] = (counts[key] || 0) + 1;
    }
    assert.equal(images, 28);
    assert.equal(Object.keys(PAPER_STRUCTURE_REPRESENTATIVES).length, 18);
    assert.deepEqual(counts, {
        'mean-error': 12, 'hatched-percent': 8, 'sphere-points': 3, 'spatial-vectors': 1,
        'local-range-radar': 2, 'baseline-line': 2, 'filled-distribution': 1, 'stacked-area': 2,
        'embedding-scatter': 8, 'horizontal-error': 3, violin: 1, 'attention-heatmap': 1,
        'position-scatter': 1, 'frequency-heatmap': 2, 'grouped-box': 1, 'density-heatmap': 16,
        'dual-correlation': 4, 'paired-correlation': 1,
    });
});

test('all original violin types remain available', () => {
    assert.ok(DRAWING_TEMPLATES.some(t => t.id === 'violin'));
    for (const figure of PAPER_FIGURES) for (const region of figure.regions.filter(r => r.kind === 'violin')) {
        assert.ok(DRAWING_TEMPLATES.some(t => t.id === panelTemplateId(figure.id, region.id)));
    }
    assert.equal(DRAWING_TEMPLATES.filter(t => t.chartId === 'violin').length, 2);
});

test('advisor and main-data imports resolve every original engine to a retained template', () => {
    for (const engine of CHART_TEMPLATES) {
        const representative = drawingTemplateForChart(engine.id);
        assert.ok(DRAWING_TEMPLATES.includes(representative));
        assert.equal(structure(representative), engine.id);
    }
});

test('every gallery preview is a complete chart from the same engine with no raster crops or clipped text', () => {
    const files = readdirSync(new URL('../../../public/drawing-previews/', import.meta.url));
    assert.equal(files.filter(name => name.endsWith('.svg')).length, DRAWING_TEMPLATES.length);
    for (const template of DRAWING_TEMPLATES) {
        const result = renderDrawingPreview(template);
        assert.deepEqual(result.texts.filter(t => t.clipped), [], template.id);
        assert.ok(result.svg.startsWith('<svg'));
        assert.ok(!/NaN|Infinity|<image\b|\/paper-panels\//.test(result.svg), template.id);
        const path = new URL(`../../../public${template.preview}`, import.meta.url);
        assert.ok(existsSync(path), template.id);
        const saved = readFileSync(path, 'utf8');
        assert.ok(saved.includes('示例数据'), template.id);
        assert.ok(!/<image\b|\/paper-panels\//.test(saved), template.id);
        if (template.chartId === 'heatmap' && !template.variant && !template.l1502) assert.ok(saved.includes('指标 A'), template.id);
        if (template.chartId === 'violin') assert.ok(saved.includes('n='), template.id);
    }
});

test('every L1502 preset binds and preserves demo data through its dedicated data engine', () => {
    const failures = [];
    for (const template of DRAWING_TEMPLATES.filter(item => item.l1502)) {
        const table = parseTemplateTable(template.demo);
        const mapping = suggestL1502Mapping(table, template.l1502);
        const result = buildL1502Data(table, mapping, template.l1502);
        if (result.error) { failures.push(`${template.id}: ${result.error}`); continue; }
        assert.ok(result.data, template.id);
        assert.equal(result.data.skipped, 0, template.id);
        assert.deepEqual(result.data.table.rows, table.rows, template.id);
        if (template.l1502.kind === 'heatmap') assert.equal(result.data.matrix.cells.length, table.rows.length * mapping.ys.length, template.id);
        else if (template.l1502.kind === 'network') assert.equal(result.data.edges.length, table.rows.length, template.id);
        else assert.equal(result.data.points.length, table.rows.length * mapping.ys.length, template.id);
    }
    assert.deepEqual(failures, []);
});

test('retained representatives accept new names, fewer groups, and new ranges', () => {
    const cases = [
        ['paper-immuno-comparison-auroc', [['新实验组', 'Mean', 'SD'], ['样品 α', 12, 1], ['样品 β', 25, 2]]],
        ['radar', [['指标', '自有模型'], ['指标甲', 300], ['指标乙', 200], ['指标丙', 900], ['指标丁', 100]]],
        ['heatmap', [['行', '自己列一', '自己列二'], ['自己行一', 20, 30], ['自己行二', 40, 50]]],
    ];
    for (const [id, matrix] of cases) {
        const template = DRAWING_TEMPLATES.find(t => t.id === id);
        const table = parseTemplateTable(matrix), mapping = suggestDrawingMapping(table, template.chartId, template.variant);
        const result = buildDrawingData(table, mapping, template.chartId, template.variant, Object.keys(mapping.errors).length ? 'summary' : 'replicates');
        assert.ok(result.data, `${id}: ${result.error}`);
        assert.equal(result.data.x.length, matrix.length - 1);
        assert.equal(result.data.skipped, 0);
    }
});

function demoData(variant) {
    const template = DRAWING_TEMPLATES.find(item => item.variant === variant);
    assert.ok(template, variant);
    const table = parseTemplateTable(template.demo);
    const mapping = suggestDrawingMapping(table, template.chartId, variant);
    const result = buildDrawingData(table, mapping, template.chartId, variant, Object.keys(mapping.errors).length ? 'summary' : 'replicates');
    assert.equal(result.error, null, variant);
    assert.ok(result.data, variant);
    return { template, mapping, data: result.data };
}

test('restored presets carry real grouped, sparse, paired and numeric-time data structures', () => {
    for (const variant of Object.keys(PAPER_STRUCTURE_REPRESENTATIVES)) demoData(variant);
    const embedding = demoData('embedding-scatter');
    assert.equal(embedding.data.pointGroups.length, 2);
    assert.equal(embedding.data.pointGroups.reduce((n, group) => n + group.points.length, 0), embedding.template.demo.length - 1);
    const positions = demoData('position-scatter').data;
    assert.equal(positions.pointGroups.length, 2);
    assert.ok(new Set(positions.x).size < positions.x.length);
    const boxes = demoData('grouped-box').data;
    assert.equal(boxes.x.length, 3);
    assert.equal(boxes.series.length, 2);
    assert.equal(boxes.samples.length, 6);
    assert.ok(boxes.samples.every(group => group.category && group.series));
    const paired = demoData('paired-correlation').data;
    assert.equal(paired.comparisonGroups.length, 2);
    assert.deepEqual(paired.comparisonGroups.map(group => group.x), [['Model A', 'Model B', 'Model C'], ['Model A', 'Model B', 'Model C']]);
    const density = demoData('density-heatmap');
    const filled = density.template.demo.slice(1).flatMap(row => row.slice(1)).filter(value => value !== null).length;
    assert.equal(density.data.matrixCells.length, filled);
    assert.ok(density.data.skippedCells > 0);
    assert.deepEqual(density.data.x, [-0.2, 0, 0.2, 0.45, 0.7, 1]);
    assert.deepEqual(density.data.series.map(series => series.name), ['0', '0.12', '0.35', '0.6', '0.8', '1']);
    assert.ok(demoData('attention-heatmap').data.matrixCells.some(cell => cell[2] < 0));
    const area = demoData('stacked-area');
    assert.equal(area.template.chartId, 'line');
    assert.deepEqual(area.data.x, [0, 3, 7, 12, 20, 28]);
    const baseline = demoData('baseline-line').data;
    assert.deepEqual(baseline.series[0].values, Array(baseline.x.length).fill(20));
});
