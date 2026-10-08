import type { CustomSeriesOption, EChartsOption, HeatmapSeriesOption } from 'echarts';
import type { TemplateData, TemplateId } from './templates.ts';
import type { TemplateChartStyle } from './template-chart.ts';
import { getChartValueColors, interpolateChartColor } from './chart-palettes.ts';
import { isExtendedGalleryId } from './extended-gallery-data.ts';

/** Native ECharts series retain interactive exploration and produce vector exports. */
export function createExtendedGalleryOption(data: TemplateData, id: TemplateId, style: TemplateChartStyle, palette: string[], shell: EChartsOption): EChartsOption | null {
    if (!isExtendedGalleryId(id)) return null;
    const font = { fontFamily: style.fontFamily, fontSize: style.fontSize, color: '#383842' };
    if (id === 'waterfall-2d') return createWaterfall(data, style, palette, shell);
    if (id === 'sankey') return { ...shell, series: [{
        type: 'sankey', data: data.x.map((name, index) => ({ name: String(name), itemStyle: { color: palette[index % palette.length] } })),
        links: data.edges!.map(edge => ({ source: edge.source, target: edge.target, value: edge.weight })),
        orient: 'horizontal', nodeAlign: 'justify', nodeGap: 18, nodeWidth: 17,
        layoutIterations: 32, draggable: false,
        label: { ...font, width: 100, overflow: 'break', formatter: '{b}' },
        edgeLabel: { show: style.showValues, formatter: '{c}', color: '#383842', fontFamily: style.fontFamily, fontSize: Math.max(9, style.fontSize - 2) },
        lineStyle: { color: 'gradient', opacity: .35, curveness: .5 }, emphasis: { focus: 'adjacency', lineStyle: { opacity: .65 } },
    }] };
    if (id === 'funnel') return { ...shell, series: [{
        type: 'funnel', name: data.series[0].name, sort: 'none', min: 0,
        max: Math.max(...data.series[0].values), minSize: '0%', maxSize: '100%', gap: 4,
        data: data.x.map((name, index) => ({ name: String(name), value: data.series[0].values[index], itemStyle: { color: palette[index % palette.length] }, ...(data.series[0].values[index] === 0 ? { label: { color: '#383842' } } : {}) })),
        label: { ...font, show: true, position: 'inside', color: '#fff', width: 160, overflow: 'break', formatter: style.showValues ? '{b} · {c}' : '{b}' },
        itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { label: { fontWeight: 'bold' } },
    }] };
    if (id === 'treemap') return { ...shell, series: [{
        type: 'treemap', name: data.series[0].name, data: data.hierarchy!, color: palette,
        roam: false, nodeClick: false, breadcrumb: { show: false },
        sort: false, squareRatio: 1.2,
        label: { show: true, ...font, color: '#fff', overflow: 'truncate', formatter: style.showValues ? '{b}\n{c}' : '{b}' },
        upperLabel: { show: true, height: 24, ...font, color: '#fff', overflow: 'truncate' },
        itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
        levels: [{ itemStyle: { borderColor: '#fff', borderWidth: 3, gapWidth: 3 } }, { colorSaturation: [.4, .8], itemStyle: { borderColorSaturation: .7, gapWidth: 2, borderWidth: 2 } }],
    }] };
    if (id === 'sunburst') return { ...shell, series: [{
        // ECharts accepts null to retain input order; its bundled type declaration omits null.
        type: 'sunburst', name: data.series[0].name, data: data.hierarchy!, sort: null as unknown as undefined,
        nodeClick: false, color: palette,
        label: { ...font, show: true, rotate: 'radial', overflow: 'truncate', formatter: style.showValues ? '{b} {c}' : '{b}' },
        itemStyle: { borderWidth: 2, borderColor: '#fff' }, emphasis: { focus: 'ancestor' },
    }] };
    if (id === 'calendar-heatmap') {
        const dates = data.x.map(String).slice().sort(), values = data.series[0].values;
        const min = Math.min(...values), max = Math.max(...values);
        const valueColors = getChartValueColors(style, min < 0 ? 'diverging' : 'sequential');
        return { ...shell,
            visualMap: min === max
                ? { type: 'piecewise', pieces: [{ value: min, label: String(min), color: interpolateChartColor(valueColors, .5) }], orient: 'horizontal', left: 'center', bottom: 10, textStyle: font }
                : { min, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 10, itemWidth: 12, itemHeight: 160, inRange: { color: valueColors }, textStyle: font },
            calendar: { range: [dates[0], dates.at(-1)!], cellSize: ['auto', 'auto'], yearLabel: { show: false }, monthLabel: { nameMap: 'en', margin: 12, ...font }, dayLabel: { firstDay: 1, nameMap: 'en', margin: 10, ...font }, splitLine: { show: style.showGrid, lineStyle: { color: '#d5d5df', width: 1 } }, itemStyle: { color: '#fafafd', borderWidth: 1, borderColor: '#fff' } },
            series: [{ type: 'heatmap', name: data.series[0].name, coordinateSystem: 'calendar', data: data.x.map((date, index) => [date, values[index]]), label: { show: style.showValues, fontFamily: style.fontFamily, fontSize: Math.max(8, style.fontSize - 3), formatter: '{@[1]}' } }],
        };
    }
    const correlation = id === 'correlation-matrix';
    const cells = data.matrixCells!, values = cells.map(cell => cell[2]);
    const min = correlation ? -1 : 0, max = correlation ? 1 : Math.max(...values, 1);
    const series: HeatmapSeriesOption = { type: 'heatmap', name: correlation ? '输入相关系数' : '输入分类计数', data: cells,
        label: { show: style.showValues, fontFamily: style.fontFamily, fontSize: Math.max(9, style.fontSize - 1), formatter: '{@[2]}' },
        itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { itemStyle: { borderColor: '#383842', borderWidth: 2 } },
        tooltip: { formatter: params => { const [column, row, value] = (Array.isArray(params) ? params[0] : params).value as [number, number, number]; return `${data.x[row]} → ${data.series[column].name}\n${correlation ? '相关系数' : '计数'}: ${value}`; } },
    };
    return { ...shell,
        grid: { left: 85, right: 30, top: 85, bottom: 100 },
        xAxis: { type: 'category', data: data.series.map(item => item.name), name: style.xLabel, axisLabel: font, splitArea: { show: false } },
        yAxis: { type: 'category', data: data.x, inverse: true, name: style.yLabel, axisLabel: font, splitArea: { show: false } },
        visualMap: { min, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 8, itemWidth: 12, itemHeight: 160, inRange: { color: getChartValueColors(style, correlation ? 'diverging' : 'sequential') }, textStyle: font },
        series: [series],
    };
}

function createWaterfall(data: TemplateData, style: TemplateChartStyle, palette: string[], shell: EChartsOption): EChartsOption {
    let total = 0;
    const intervals = data.series[0].values.map((value, index) => { const start = total; total += value; return [index, start, total, value]; });
    const all = intervals.flatMap(item => item.slice(1, 3)), min = Math.min(0, ...all), max = Math.max(0, ...all), span = max - min || 1;
    const series: CustomSeriesOption = { type: 'custom', name: data.series[0].name, dimensions: ['阶段', '起始累计', '结束累计', '增减值'], encode: { x: 0, y: [1, 2], tooltip: [3, 2] }, data: intervals,
        renderItem: (params, api) => {
            const index = Number(api.value(0)), start = Number(api.value(1)), end = Number(api.value(2)), change = Number(api.value(3));
            const from = api.coord([index, start]), to = api.coord([index, end]);
            const width = Math.max(2, Math.abs((api.size!([1, 0]) as number[])[0]) * .56);
            const color = change >= 0 ? palette[0] : palette[1 % palette.length];
            const children: NonNullable<ReturnType<NonNullable<CustomSeriesOption['renderItem']>>>[] = [];
            if (index > 0) {
                const previous = api.coord([index - 1, start]);
                children.push({ type: 'line', shape: { x1: previous[0] + width / 2, y1: from[1], x2: from[0] - width / 2, y2: from[1] }, style: { stroke: '#97949f', lineWidth: 1, lineDash: [3, 3] } });
            }
            children.push({ type: 'rect', shape: { x: from[0] - width / 2, y: Math.min(from[1], to[1]) - (change === 0 ? .5 : 0), width, height: Math.max(1, Math.abs(to[1] - from[1])) }, style: { fill: color, stroke: color, lineWidth: 1 } });
            if (style.showValues) children.push({ type: 'text', style: { x: to[0], y: Math.min(from[1], to[1]) - 7, text: String(change), fill: '#383842', font: `${Math.max(9, style.fontSize - 1)}px ${style.fontFamily}`, align: 'center', verticalAlign: 'bottom' } });
            return { type: 'group', children };
        },
        tooltip: { formatter: params => { const item = (Array.isArray(params) ? params[0] : params).value as number[]; return `${data.x[item[0]]}\n增减: ${item[3]}\n累计: ${item[2]}`; } },
    };
    return { ...shell, grid: { left: 80, right: 30, top: 85, bottom: 70 },
        xAxis: { type: 'category', data: data.x, name: style.xLabel, axisTick: { show: false } },
        yAxis: { type: 'value', name: style.yLabel, min: min < 0 ? min - span * .1 : 0, max: max + span * .16, splitLine: { show: style.showGrid }, axisLine: { show: true } },
        series: [series],
    };
}
