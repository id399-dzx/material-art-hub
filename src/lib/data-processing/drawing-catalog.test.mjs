import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DRAWING_TEMPLATES, DRAWING_TYPES, drawingTemplateForChart, panelTemplateId } from './drawing-catalog.ts';
import { PAPER_FIGURES } from './paper-figures/catalog.ts';
import { CHART_TEMPLATES, parseTemplateTable, suggestMapping, buildTemplateData } from './templates.ts';
import { renderDrawingPreview } from '../../../scripts/drawing-preview-options.mjs';

const structure = template => template.chartId === 'error-bar'
    ? template.paper?.region.kind === 'horizontal' ? 'horizontal-bar' : 'error-bar'
    : template.chartId === 'trend' && template.paper?.region.kind === 'area' ? 'stacked-area' : template.chartId;

test('curated library keeps one representative per chart structure and removes image-only templates', () => {
    assert.equal(DRAWING_TEMPLATES.length, 31);
    assert.equal(new Set(DRAWING_TEMPLATES.map(t => t.id)).size, 31);
    assert.equal(DRAWING_TYPES.length, 10);
    assert.equal(DRAWING_TEMPLATES.filter(t => t.paper).length, 6);
    assert.equal(DRAWING_TEMPLATES.filter(t => t.electrochemical).length, 8);
    // The dedicated electrochemical workflows share curve engines, with distinct axes and conventions.
    const groups = Map.groupBy(DRAWING_TEMPLATES.filter(t => !t.electrochemical), structure);
    for (const [kind, templates] of groups) assert.equal(templates.length, kind === 'violin' ? 2 : 1, kind);
    for (const template of DRAWING_TEMPLATES) {
        assert.ok(template.chartId);
        assert.notEqual(template.paper?.region.kind, 'image');
        assert.ok(template.preview.startsWith('/drawing-previews/'));
    }
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
        if (template.chartId === 'heatmap') assert.ok(saved.includes('指标 A'), template.id);
        if (template.chartId === 'violin') assert.ok(saved.includes('n='), template.id);
    }
});

test('retained representatives accept new names, fewer groups, and new ranges', () => {
    const cases = [
        ['paper-immuno-comparison-auroc', [['新实验组', 'Mean', 'SD'], ['样品 α', 12, 1], ['样品 β', 25, 2]]],
        ['radar', [['指标', '自有模型'], ['指标甲', 300], ['指标乙', 200], ['指标丙', 900], ['指标丁', 100]]],
        ['heatmap', [['行', '自己列一', '自己列二'], ['自己行一', 20, 30], ['自己行二', 40, 50]]],
    ];
    for (const [id, matrix] of cases) {
        const template = DRAWING_TEMPLATES.find(t => t.id === id);
        const table = parseTemplateTable(matrix), mapping = suggestMapping(table, template.chartId);
        const result = buildTemplateData(table, mapping, template.chartId, Object.keys(mapping.errors).length ? 'summary' : 'replicates');
        assert.ok(result.data, `${id}: ${result.error}`);
        assert.equal(result.data.x.length, matrix.length - 1);
        assert.equal(result.data.skipped, 0);
    }
});
