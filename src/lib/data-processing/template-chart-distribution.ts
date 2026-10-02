import type { CustomSeriesOption, EChartsOption } from 'echarts';
import { histogram, kernelDensity, sampleBox } from './distributions.ts';
import type { TemplateData } from './templates.ts';
import type { TemplateChartStyle } from './template-chart.ts';

export function createDistributionOption(data: TemplateData, id: 'box' | 'violin' | 'histogram', style: TemplateChartStyle, palette: string[]): EChartsOption {
    const groups = data.samples!, text = { fontSize: style.fontSize, fontFamily: style.fontFamily, color: '#33333d' };
    const shell: EChartsOption = { animation: false, backgroundColor: '#fff', textStyle: text, color: palette,
        title: { text: style.title, left: 'center', top: 12, textStyle: { ...text, fontSize: style.fontSize + 2 } },
        grid: { left: 75, right: 30, top: 76, bottom: 84, containLabel: true }, tooltip: { trigger: 'item', renderMode: 'richText', confine: true },
        yAxis: { type: 'value', scale: id !== 'histogram', name: id === 'histogram' ? '样本数' : style.yLabel, nameLocation: 'middle', nameGap: 54, nameTextStyle: text, axisLabel: text, splitLine: { show: style.showGrid } },
    };
    if (id === 'histogram') {
        const bins = histogram(groups[0].values);
        const bars: CustomSeriesOption = { type: 'custom', name: groups[0].name, data: bins.map(bin => [bin.lo, bin.hi, bin.count]), encode: { x: [0, 1], y: 2 },
            renderItem: (_, api) => { const lo = api.coord([api.value(0), 0]), hi = api.coord([api.value(1), api.value(2)]); return { type: 'rect', shape: { x: lo[0], y: hi[1], width: Math.max(0, hi[0] - lo[0]), height: Math.max(0, lo[1] - hi[1]) }, style: { fill: palette[0], stroke: '#fff', lineWidth: 1 } }; } };
        return { ...shell, xAxis: { type: 'value', min: bins[0].lo, max: bins.at(-1)!.hi, name: style.xLabel, nameLocation: 'middle', nameGap: 42, axisLabel: text }, series: [bars], graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: `n = ${groups[0].values.length}；${bins.length} 个等宽区间；末区间含右端点`, fill: '#555', font: `${Math.max(10, style.fontSize - 2)}px ${style.fontFamily}` } }] };
    }
    const grouped = style.variant === 'grouped-box';
    const categories = grouped ? [...new Set(groups.map(group => group.category ?? group.name))] : groups.map(group => group.name);
    const seriesNames = grouped ? [...new Set(groups.map(group => group.series ?? group.name))] : [];
    const series: CustomSeriesOption[] = groups.map((group, index) => {
        const category = grouped ? categories.indexOf(group.category ?? group.name) : index;
        const seriesIndex = grouped ? seriesNames.indexOf(group.series ?? group.name) : index;
        return { type: 'custom', name: grouped ? group.series ?? group.name : group.name, data: [[category, Math.min(...group.values), Math.max(...group.values)]], encode: { x: 0, y: [1, 2] }, silent: true,
        renderItem: (_, api) => {
            const band = Number((api.size!([1, 0]) as number[])[0]), step = band * .7 / Math.max(1, seriesNames.length);
            const color = palette[seriesIndex % palette.length], center = api.coord([category, 0])[0] + (grouped ? (seriesIndex - (seriesNames.length - 1) / 2) * step : 0), half = Math.min(35, grouped ? step * .36 : band * .25), box = sampleBox(group.values), y = (value: number) => api.coord([category, value])[1];
            const children: NonNullable<ReturnType<NonNullable<CustomSeriesOption['renderItem']>>>[] = [];
            if (id === 'violin') {
                const density = kernelDensity(group.values), max = Math.max(...density.map(point => point.density));
                if (density.length) children.push({ type: 'polygon', shape: { points: [...density.map(point => [center - point.density / max * half, y(point.y)]), ...[...density].reverse().map(point => [center + point.density / max * half, y(point.y)])] }, style: { fill: color, opacity: .3, stroke: color, lineWidth: 1 } });
            }
            if (group.values.length >= 3) {
                const bw = id === 'violin' ? half * .4 : half;
                children.push({ type: 'line', shape: { x1: center, x2: center, y1: y(box[0]), y2: y(box[4]) }, style: { stroke: color, lineWidth: 1.4 } });
                children.push({ type: 'rect', shape: { x: center - bw, y: y(box[3]), width: bw * 2, height: Math.max(.5, y(box[1]) - y(box[3])) }, style: { fill: '#ffffffaa', stroke: color, lineWidth: 1.4 } });
                [box[0], box[2], box[4]].forEach(value => children.push({ type: 'line', shape: { x1: center - bw, x2: center + bw, y1: y(value), y2: y(value) }, style: { stroke: color, lineWidth: 1.4 } }));
            }
            // Deterministic jitter: preserve every sample; no random layout or invented observations.
            group.values.forEach((value, i) => children.push({ type: 'circle', shape: { cx: center + (((i * 37) % 101) / 100 - .5) * half * 1.25, cy: y(value), r: 2.5 }, style: { fill: color, opacity: .65 } }));
            return { type: 'group', children: children as never };
        } };
    });
    const note = grouped ? `${groups.map(group => `${group.category ?? group.name} · ${group.series ?? group.name} n=${group.values.length}`).join('；')}\n原始点 + Q1 / 中位数 / Q3；须线为 1.5×IQR 内观测` : id === 'box' ? '原始点 + Q1 / 中位数 / Q3；须线为 1.5×IQR 内观测' : '原始点 + 核密度；n<5 或常量组仅显示原始点与摘要';
    return { ...shell, ...(grouped ? { legend: { selectedMode: false, data: seriesNames, top: 50, left: 'center', textStyle: text } } : {}),
        xAxis: { type: 'category', data: grouped ? categories : groups.map(group => `${group.name}\nn=${group.values.length}`), name: style.xLabel, nameLocation: 'middle', nameGap: 58, axisLabel: { ...text, hideOverlap: false } }, series, graphic: [{ type: 'text', left: 'center', bottom: 8, style: { text: note, fill: '#555', font: `${Math.max(10, style.fontSize - 2)}px ${style.fontFamily}` } }] };
}
