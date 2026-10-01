import { mkdir, writeFile } from 'node:fs/promises';
import * as echarts from 'echarts';
import { CHART_TEMPLATES, parseTemplateTable, suggestMapping, buildTemplateData } from '../src/lib/data-processing/templates.ts';
import { createTemplateOption } from '../src/lib/data-processing/template-chart.ts';
const output = new URL('../public/data-templates/', import.meta.url);
await mkdir(output, { recursive: true });
for (const template of CHART_TEMPLATES) {
    const table = parseTemplateTable(template.demo);
    const { data, error } = buildTemplateData(table, suggestMapping(table, template.id), template.id);
    if (!data) throw new Error(`${template.id}: ${error}`);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
    try {
        chart.setOption(createTemplateOption(data, template.id, { title: '', xLabel: template.xLabel, yLabel: template.yLabel, fontFamily: 'Arial', fontSize: 13, palette: 'soft', showGrid: false, showValues: false, errorMeasure: 'SD', width: 680, height: 420, annotationX: 0.6 }));
        await writeFile(new URL(`${template.id}.svg`, output), chart.renderToSVGString());
    } finally { chart.dispose(); }
}
console.log(`Generated ${CHART_TEMPLATES.length} independently authored template previews.`);
