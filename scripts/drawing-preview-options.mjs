import * as echarts from 'echarts';
import { CHART_TEMPLATES, parseTemplateTable, numericCell, isSpatial } from '../src/lib/data-processing/templates.ts';
import { createTemplateOption } from '../src/lib/data-processing/template-chart.ts';
import { suggestElectrochemicalMapping } from '../src/lib/data-processing/electrochemical-mapping.ts';
import { prepareElectrochemicalData } from '../src/lib/data-processing/electrochemistry.ts';
import { buildDrawingData, suggestDrawingMapping } from '../src/lib/data-processing/drawing-data.ts';

/** Mirror the editor's initial demo binding. Never extract pixels from a paper figure. */
export function drawingPreviewOption(template) {
    if (!template.chartId) throw new Error(`${template.id}: no numerical chart engine`);
    const id = template.chartId;
    const table = parseTemplateTable(template.demo);
    const mapping = template.electrochemical ? suggestElectrochemicalMapping(table, template.electrochemical) : suggestDrawingMapping(table, id, template.variant, 'bar');
    const errors = Object.values(mapping.errors).map(index => table.columns[index]);
    const errorMeasure = errors.length && errors.every(name => /sem|标准误|standard.?error/i.test(name)) ? 'SEM' : 'SD';
    const errorInput = errors.length ? 'summary' : 'replicates';
    const result = buildDrawingData(table, mapping, id, template.variant, errorInput, errorMeasure, 'bar');
    if (!result.data) throw new Error(`${template.id}: ${result.error}`);
    if (template.electrochemical) {
        const prepared = prepareElectrochemicalData(result.data, template.electrochemical);
        if (!prepared.data) throw new Error(`${template.id}: ${prepared.error}`);
        result.data = prepared.data;
    }
    const width = id === 'multi-panel' || id === 'schematic' ? 900 : 680;
    const height = id === 'multi-panel' ? 620 : 420;
    const base = CHART_TEMPLATES.find(item => item.id === id);
    const region = template.paper?.region;
    const style = {
        title: `${template.name} · 示例数据`,
        xLabel: id === 'heatmap' ? template.xLabel : table.columns[mapping.x] || 'X',
        yLabel: isSpatial(id) ? table.columns[mapping.ys[0]] || 'Y' : template.yLabel || base.yLabel,
        fontFamily: 'Arial', fontSize: 8 * 25.4 / 72 * width / 85,
        palette: 'journal', showGrid: false, showValues: false,
        errorMeasure, panelChart: 'bar', cumulative: false,
        secondaryYLabel: template.electrochemical?.secondaryYLabel || table.columns[mapping.ys[1]] || '右轴指标',
        annotationX: numericCell(table.rows[Math.floor(table.rows.length / 2)]?.[mapping.x]) ?? 0.6,
        annotationText: '参考位置', yaw: 35, pitch: 25, width, height,
        customColors: region?.colors,
        horizontal: region?.kind === 'horizontal',
        colorByCategory: region?.kind === 'bars',
        stackedArea: region?.kind === 'area', hatching: !!region?.hatching,
        fillLines: region?.fillSeries, sphereGuide: region?.kind !== 'vectors',
        variant: template.variant,
        xLog: template.electrochemical?.xLog, yLog: template.electrochemical?.yLog, equalAxes: template.electrochemical?.equalAxes,
    };
    return { option: createTemplateOption(result.data, id, style), width, height, table, mapping, data: result.data, style };
}

export function previewTextBounds(chart, width, height, tolerance = 2) {
    const texts = chart.getZr().storage.getDisplayList().filter(element => element.type === 'tspan' && !element.ignore && !element.invisible && element.style?.text?.trim());
    return texts.map(element => {
        const rect = element.getBoundingRect().clone();
        if (element.transform) rect.applyTransform(element.transform);
        const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        return { text: element.style.text, box, clipped: rect.x < -tolerance || rect.y < -tolerance || rect.x + rect.width > width + tolerance || rect.y + rect.height > height + tolerance };
    });
}

export function renderDrawingPreview(template) {
    const setup = drawingPreviewOption(template);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: setup.width, height: setup.height });
    try {
        chart.setOption(setup.option);
        const svg = chart.renderToSVGString();
        if (/NaN|Infinity/.test(svg)) throw new Error(`${template.id}: non-finite SVG geometry`);
        if (/<image\b/.test(svg)) throw new Error(`${template.id}: numeric preview unexpectedly contains a raster image`);
        return { svg, width: setup.width, height: setup.height, texts: previewTextBounds(chart, setup.width, setup.height) };
    } finally {
        chart.dispose();
    }
}
