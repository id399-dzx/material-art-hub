import type { CustomSeriesOption, EChartsOption, LineSeriesOption, ScatterSeriesOption } from "echarts";
import type { TemplateData } from "./templates.ts";
import type { TemplateChartStyle } from "./template-chart.ts";
import { textWidth } from "./chart-layout.ts";

function shell(style: TemplateChartStyle, palette: string[]): EChartsOption {
    const text = { color: "#383842", fontSize: style.fontSize, fontFamily: style.fontFamily };
    return { animation: false, backgroundColor: "#ffffff", color: palette, textStyle: text,
        title: { text: style.title, top: 16, left: "center", textStyle: { ...text, fontSize: style.fontSize + 2 } },
        grid: { left: 80, right: 35, top: 90, bottom: 75 }, tooltip: { renderMode: "richText", confine: true },
        xAxis: { type: "value", name: style.xLabel, scale: true, axisLabel: text, splitLine: { show: false } },
        yAxis: { type: "value", name: style.yLabel, scale: true, axisLabel: text, splitLine: { show: style.showGrid } } };
}

/** Coordinate midpoints define cells; no interpolation or inferred density is applied. */
export function numericCellBounds(values: number[]): Map<number, [number, number]> {
    const ordered = [...new Set(values)].sort((a, b) => a - b);
    return new Map(ordered.map((value, index) => [value, ordered.length === 1 ? [value - .5, value + .5] : [
        index === 0 ? value - (ordered[1] - value) / 2 : (ordered[index - 1] + value) / 2,
        index === ordered.length - 1 ? value + (value - ordered[index - 1]) / 2 : (value + ordered[index + 1]) / 2,
    ]]));
}

export function createVariantHeatmapOption(data: TemplateData, style: TemplateChartStyle, palette: string[]): EChartsOption {
    const cells = data.matrixCells ?? data.series.flatMap((item, column) => item.values.map((value, row): [number, number, number] => [column, row, value]));
    const values = cells.map(cell => cell[2]);
    let min = Math.min(...values), max = Math.max(...values);
    const numeric = style.variant === "density-heatmap";
    const attention = style.variant === "attention-heatmap";
    const frequency = style.variant === "frequency-heatmap";
    const diverging = attention && min < 0;
    if (diverging) { const magnitude = Math.max(Math.abs(min), Math.abs(max)); min = -magnitude; max = magnitude; }
    else if (max === min) max = min + 1;
    const text = { color: "#383842", fontSize: style.fontSize, fontFamily: style.fontFamily };
    let sequential: string[];
    if (diverging) {
        if (style.palette === "mono") sequential = ["#888888", "#ffffff", "#222222"];
        else if (style.customColors?.length) {
            const positive = palette.at(-1)!, negative = palette.find(color => color.toLowerCase() !== "#ffffff" && color !== positive) ?? "#38679b";
            sequential = [negative, "#ffffff", positive];
        } else sequential = style.palette === "accessible" ? ["#0072B2", "#ffffff", "#D55E00"] : style.palette === "soft" ? ["#8da6cd", "#ffffff", "#d69baf"] : ["#2166ac", "#ffffff", "#b2182b"];
    } else sequential = style.palette === "mono" ? ["#ffffff", "#b0b0b0", "#313131"] : style.customColors?.length ? palette : style.palette === "accessible" ? ["#ffffff", "#56B4E9", "#0072B2"] : style.palette === "soft" ? ["#fcf9ff", "#c9c0df", "#788bcc"] : attention ? ["#ffffff", "#ff3333"] : frequency ? ["#ffffd4", "#41b6b6", "#192c7d"] : numeric ? ["#fff5f0", "#fc9272", "#99000d"] : ["#f4eff9", "#acb9d3", palette[0]];
    const base: EChartsOption = { ...shell(style, palette),
        visualMap: { min, max, dimension: 2, calculable: false, orient: "horizontal", left: "center", bottom: 22, text: [`${Number(max.toPrecision(5))}`, `${Number(min.toPrecision(5))}`], textStyle: text, inRange: { color: sequential } },
        ...(diverging ? { graphic: [{ type: "text" as const, left: "center", bottom: 2, style: { text: style.palette === "mono" ? "色阶以 0 为中心：浅灰为负，深灰为正" : "色阶以 0 为中心：左端为负，右端为正", fill: "#787580", font: `11px ${style.fontFamily}` } }] } : {}) };
    if (!numeric) return { ...base,
        xAxis: { type: "category", data: data.series.map(item => item.name), name: style.xLabel, axisLabel: text, splitArea: { show: false } },
        yAxis: { type: "category", data: data.x, name: style.yLabel, inverse: true, axisLabel: text, splitArea: { show: false } },
        series: [{ type: "heatmap", data: cells, label: { show: !attention && !frequency, fontSize: Math.max(10, style.fontSize - 1), formatter: p => Number((p.value as number[])[2]).toLocaleString(undefined, { maximumFractionDigits: 3 }) }, itemStyle: { borderColor: "#ffffff", borderWidth: attention ? 0 : 1 }, emphasis: { itemStyle: { borderColor: "#51446e", borderWidth: 1 } } }] };
    const xs = data.series.map(item => Number(item.name)), ys = data.x.map(Number);
    const boundsX = numericCellBounds(xs), boundsY = numericCellBounds(ys);
    const rectangles = cells.map(([column, row, value]) => {
        const [loX, hiX] = boundsX.get(xs[column])!, [loY, hiY] = boundsY.get(ys[row])!;
        return [xs[column], ys[row], value, loX, hiX, loY, hiY];
    });
    const heatmap: CustomSeriesOption = { type: "custom", name: "输入网格值", clip: true, data: rectangles,
        dimensions: ["X", "Y", "Value", "X lower", "X upper", "Y lower", "Y upper"], encode: { x: [3, 4], y: [5, 6], tooltip: [0, 1, 2] },
        renderItem: (_, api) => {
            const lower = api.coord([api.value(3), api.value(5)]), upper = api.coord([api.value(4), api.value(6)]);
            return { type: "rect", shape: { x: lower[0], y: upper[1], width: Math.max(0, upper[0] - lower[0]), height: Math.max(0, lower[1] - upper[1]) }, style: { fill: String(api.visual("color")), stroke: "none" } };
        } };
    return { ...base, xAxis: { type: "value", scale: true, name: style.xLabel, min: Math.min(...[...boundsX.values()].map(bounds => bounds[0])), max: Math.max(...[...boundsX.values()].map(bounds => bounds[1])), axisLabel: text },
        yAxis: { type: "value", scale: true, name: style.yLabel, min: Math.min(...[...boundsY.values()].map(bounds => bounds[0])), max: Math.max(...[...boundsY.values()].map(bounds => bounds[1])), axisLabel: text }, series: [heatmap] };
}

export function localRadarBounds(values: number[]): [number, number] {
    const minimum = Math.min(...values), maximum = Math.max(...values);
    const span = maximum - minimum || Math.abs(maximum) * .2 || 1;
    let target = span * 1.2 / 5;
    for (;;) {
        const magnitude = 10 ** Math.floor(Math.log10(target));
        const interval = [1, 2, 3, 5, 10].find(value => value * magnitude >= target)! * magnitude;
        const lower = Math.floor((minimum - span * .1) / interval) * interval;
        const min = minimum >= 0 ? Math.max(0, lower) : lower, max = min + interval * 5;
        if (max >= maximum) return [Number(min.toPrecision(8)), Number(max.toPrecision(8))];
        target = interval * 1.000001;
    }
}

/** Difference is drawn only for an unambiguous observed X, never estimated between observations. */
export function observedCurveDifference(data: TemplateData, style: TemplateChartStyle): CustomSeriesOption | null {
    if (data.series.length < 2 || !Number.isFinite(style.annotationX)) return null;
    const matches = data.x.map((x, index) => typeof x === "number" && x === style.annotationX ? index : -1).filter(index => index >= 0);
    if (matches.length !== 1) return null;
    const first = data.series[0].values[matches[0]], second = data.series[1].values[matches[0]], difference = second - first;
    if (!Number.isFinite(first) || !Number.isFinite(second) || difference === 0) return null;
    const fontSize = Math.max(10, style.fontSize - 2), label = `Δ = ${Number(difference.toPrecision(4))}`;
    const labelWidth = textWidth(label, fontSize, style.fontFamily);
    return { type: "custom", name: "实际输入差值", silent: true, clip: false, data: [[style.annotationX!, first, second, difference]], encode: { x: 0, y: [1, 2] },
        renderItem: (_, api) => {
            const a = api.coord([api.value(0), api.value(1)]), b = api.coord([api.value(0), api.value(2)]);
            const labelX = a[0] + 10 + labelWidth < (style.width ?? 680) - 16 ? a[0] + 10 : a[0] - 10 - labelWidth;
            return { type: "group", children: [
                { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: "#49434f", lineWidth: 1.5 } },
                { type: "circle", shape: { cx: a[0], cy: a[1], r: 3 }, style: { fill: "#49434f" } },
                { type: "circle", shape: { cx: b[0], cy: b[1], r: 3 }, style: { fill: "#49434f" } },
                { type: "text", x: labelX, y: (a[1] + b[1]) / 2 - fontSize / 2, style: { text: label, fill: "#49434f", font: `${fontSize}px ${style.fontFamily}` } },
            ] };
        } };
}

export function createGroupedScatterOption(data: TemplateData, style: TemplateChartStyle, palette: string[]): EChartsOption {
    const groups = data.pointGroups ?? data.series.map(item => ({ name: item.name, points: data.x.map((x, index): [number | string, number] => [x, item.values[index]]) }));
    const position = style.variant === "position-scatter";
    const categories = [...new Set(groups.flatMap(group => group.points.map(point => String(point[0]))))];
    const series: ScatterSeriesOption[] = groups.map((group, index) => ({ type: "scatter", name: group.name,
        data: group.points.map(([x, y]) => [position ? String(x) : Number(x), y]), symbolSize: position ? 7 : 5,
        symbol: ["circle", "rect", "triangle", "diamond"][index % 4], itemStyle: { color: palette[index % palette.length], opacity: .75 }, emphasis: { focus: "series" } }));
    const option = shell(style, palette);
    return { ...option, legend: { data: groups.map(group => group.name), top: 50, left: "center" },
        ...(position ? { xAxis: { type: "category", data: categories, name: style.xLabel, boundaryGap: true, axisLabel: { fontSize: style.fontSize, fontFamily: style.fontFamily } } } : {}), series };
}

export function createPairedCorrelationOption(data: TemplateData, style: TemplateChartStyle, palette: string[]): EChartsOption {
    const groups = data.comparisonGroups ?? [{ name: "条件", x: data.x, series: data.series }];
    const names: string[] = [], positions: number[][] = [];
    groups.forEach((group, index) => {
        if (index) names.push("");
        positions.push(group.x.map(object => { const position = names.length; names.push(String(object)); return position; }));
    });
    const metrics = [...new Set(groups.flatMap(group => group.series.map(item => item.name)))];
    const series: (LineSeriesOption | CustomSeriesOption)[] = groups.flatMap((group, groupIndex) => group.series.map(item => {
        const values = Array<number | null>(names.length).fill(null);
        item.values.forEach((value, row) => { values[positions[groupIndex][row]] = value; });
        return { type: "line" as const, name: `${group.name} · ${item.name}`, yAxisIndex: metrics.indexOf(item.name), data: values, connectNulls: false, smooth: false, showSymbol: true, symbolSize: 6,
            itemStyle: { color: palette[metrics.indexOf(item.name) % palette.length] }, lineStyle: { width: 2, type: groupIndex % 2 ? "dashed" as const : "solid" as const } };
    }));
    if (groups.length === 2) metrics.forEach(metric => {
        const first = groups[0].series.find(item => item.name === metric), second = groups[1].series.find(item => item.name === metric);
        if (!first || !second) return;
        const pairs: number[][] = [];
        groups[0].x.forEach((object, row) => {
            const matches = groups[1].x.map((name, index) => String(name) === String(object) ? index : -1).filter(index => index >= 0);
            if (matches.length !== 1 || groups[0].x.filter(name => String(name) === String(object)).length !== 1) return;
            const other = matches[0];
            pairs.push([positions[0][row], first.values[row], positions[1][other], second.values[other]]);
        });
        series.push({ type: "custom", name: `${metric} · 配对`, yAxisIndex: metrics.indexOf(metric), silent: true, clip: true, data: pairs, encode: { x: [0, 2], y: [1, 3] },
            renderItem: (_, api) => { const a = api.coord([api.value(0), api.value(1)]), b = api.coord([api.value(2), api.value(3)]); return { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: palette[metrics.indexOf(metric) % palette.length], lineWidth: 1, lineDash: [3, 3], opacity: .5 } }; } });
    });
    return { ...shell(style, palette), legend: { selectedMode: false, data: groups.flatMap(group => group.series.map(item => `${group.name} · ${item.name}`)), top: 50, left: "center" },
        xAxis: { type: "category", data: names, name: style.xLabel, boundaryGap: true, axisLabel: { fontSize: style.fontSize, fontFamily: style.fontFamily } },
        yAxis: metrics.map((metric, index) => ({ type: "value" as const, scale: true, name: index === 0 ? style.yLabel : style.secondaryYLabel || metric, position: index === 0 ? "left" as const : "right" as const, splitLine: { show: index === 0 && style.showGrid } })), series,
        graphic: [{ type: "text", left: "center", bottom: 8, style: { text: "虚线配对两条件下的同名对象；缺失配对不连线", fill: "#787580", font: `11px ${style.fontFamily}` } }] };
}
