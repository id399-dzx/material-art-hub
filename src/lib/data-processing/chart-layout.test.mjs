import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { CHART_TEMPLATES, buildTemplateData, parseTemplateTable, suggestMapping } from './templates.ts';
import { createTemplateOption } from './template-chart.ts';

const defaultStyle = (width = 680, height = 420) => ({ title: '独立数据图 · 示例数据', xLabel: '实验条件', yLabel: '测量值',
    fontFamily: 'Arial', fontSize: 8 * 25.4 / 72 * width / 85, palette: 'journal', showGrid: false,
    showValues: false, errorMeasure: 'SD', width, height });

function withChart(data, id, style, check) {
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
    try {
        const option = createTemplateOption(data, id, style);
        chart.setOption(option);
        const elements = chart.getZr().storage.getDisplayList().filter(element => !element.ignore && !element.invisible);
        const boxes = elements.map(element => {
            const rect = element.getBoundingRect().clone();
            if (element.transform) rect.applyTransform(element.transform);
            return { type: element.type, text: element.style?.text, rect, shape: element.shape };
        });
        const texts = boxes.filter(item => item.type === 'tspan' && item.text?.trim());
        assert.doesNotMatch(chart.renderToSVGString(), /NaN|Infinity/);
        for (const { text, rect } of texts) {
            assert.ok(rect.x >= -2 && rect.y >= -2 && rect.x + rect.width <= style.width + 2 && rect.y + rect.height <= style.height + 2,
                `${id}: ${text} outside ${style.width} × ${style.height}: ${JSON.stringify(rect)}`);
        }
        check?.({ chart, option, texts, boxes });
    } finally { chart.dispose(); }
}

test('all 21 drawing engines contain their complete default text at the editor publication font size', () => {
    for (const template of CHART_TEMPLATES) {
        const width = ['multi-panel', 'schematic'].includes(template.id) ? 900 : 680;
        const height = template.id === 'multi-panel' ? 620 : 420;
        const table = parseTemplateTable(template.demo);
        const { data } = buildTemplateData(table, suggestMapping(table, template.id), template.id);
        withChart(data, template.id, { ...defaultStyle(width, height), title: `${template.name} · 示例数据`, xLabel: template.xLabel, yLabel: template.yLabel });
    }
});

test('long category, axis, and legend names wrap without truncating or changing error data', () => {
    const data = { x: ['低浓度实验组的完整名称', '高浓度实验组的完整名称'], series: [
        { name: '处理前基线与独立重复实验', values: [23, 45], errors: [2, 3] },
        { name: '处理后观测与独立重复实验', values: [30, 50], errors: [3, 4] },
    ], skipped: 0, warnings: [] };
    const original = structuredClone(data);
    for (const horizontal of [false, true]) withChart(data, 'error-bar', { ...defaultStyle(), horizontal,
        title: '不同处理条件下的定量研究结果与独立实验观测对比',
        xLabel: '处理时间与实验条件的完整说明（小时）', yLabel: '归一化测量信号与观测强度（任意单位）',
    }, ({ option, texts, chart }) => {
        assert.equal(option.legend.type, 'plain');
        assert.ok(texts.every(item => !item.text.includes('…')));
        const labelAxis = horizontal ? option.yAxis : option.xAxis;
        assert.equal(labelAxis.axisLabel.formatter(data.x[0]).replaceAll('\n', ''), data.x[0]);
        const xName = option.xAxis.name.split('\n')[0];
        const axisTitle = texts.find(item => item.text === xName);
        const footnote = texts.find(item => item.text.startsWith('误差条：'));
        assert.ok(axisTitle.rect.y + axisTitle.rect.height < footnote.rect.y);
        assert.ok(chart.getModel().getComponent('grid').coordinateSystem.getRect().height > 100);
    });
    assert.deepEqual(data, original);
});

test('radar indicator names stay below its complete series legend', () => {
    const template = CHART_TEMPLATES.find(item => item.id === 'radar'), table = parseTemplateTable(template.demo);
    const { data } = buildTemplateData(table, suggestMapping(table, template.id), template.id);
    withChart(data, 'radar', defaultStyle(), ({ texts }) => {
        const legend = texts.filter(item => data.series.some(series => item.text === series.name));
        const indicators = texts.filter(item => data.x.some(name => item.text === name));
        assert.equal(legend.length, data.series.length);
        assert.equal(indicators.length, data.x.length);
        assert.ok(Math.max(...legend.map(item => item.rect.y + item.rect.height)) < Math.min(...indicators.map(item => item.rect.y)));
    });
});

test('network and workflow nodes keep their shape and do not enter title or footnote space', () => {
    for (const id of ['network', 'schematic']) {
        const template = CHART_TEMPLATES.find(item => item.id === id), table = parseTemplateTable(template.demo);
        const { data } = buildTemplateData(table, suggestMapping(table, id), id);
        const style = defaultStyle(id === 'schematic' ? 900 : 680);
        withChart(data, id, style, ({ option, boxes, texts }) => {
            const title = texts.find(item => item.text === style.title);
            const footnote = texts.find(item => item.text.includes(id === 'network' ? '圆形布局' : '箭头对应'));
            const nodes = boxes.filter(item => item.shape?.symbolType === (id === 'network' ? 'circle' : 'roundRect'));
            assert.equal(option.series[0].preserveAspect, true);
            assert.equal(nodes.length, data.x.length);
            for (const node of nodes) {
                assert.ok(node.rect.y > title.rect.y + title.rect.height);
                assert.ok(node.rect.y + node.rect.height < footnote.rect.y);
                if (id === 'network') assert.ok(Math.abs(node.rect.width - node.rect.height) < .01);
            }
        });
    }
});
