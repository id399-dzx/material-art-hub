import type { BarSeriesOption, DefaultLabelFormatterCallbackParams, CustomSeriesOption, EChartsOption, LineSeriesOption, YAXisComponentOption } from "echarts";
import type { TemplateChartStyle } from "./template-chart";
import type { TemplateData, TemplateId } from "./templates.ts";
import { createSpatialOption } from "./template-chart-spatial.ts";

type BaseFactory = (id: "line" | "grouped-bar") => EChartsOption;

export function createExtendedTemplateOption(data: TemplateData, template: TemplateId, style: TemplateChartStyle, palette: string[], base: BaseFactory): EChartsOption {
    const axisText = { color: "#383842", fontSize: style.fontSize, fontFamily: style.fontFamily };
    const shell: EChartsOption = { animation: false, backgroundColor: "#fff", color: palette, textStyle: axisText,
        title: { text: style.title, top: 16, left: "center", textStyle: { ...axisText, fontSize: style.fontSize + 2 } },
        tooltip: { renderMode: "richText", confine: true },
    };
    if (template === "sphere" || template === "surface") return createSpatialOption(data, template, style, palette, shell);
    if (template === "network" || template === "schematic") {
        const edges = data.edges!;
        const positions = layoutGraph(data.x.map(String), edges, template === "schematic");
        return { ...shell, series: [{ type: "graph", layout: "none", roam: false, left: 60, right: 60, top: 110, bottom: 85,
            symbol: template === "schematic" ? "roundRect" : "circle", symbolSize: template === "schematic" ? [112, 40] : 42,
            data: data.x.map((name, i) => ({ id: String(name), name: String(name), ...positions[i], itemStyle: { color: palette[i % palette.length] }, label: { show: true, color: template === "schematic" ? "#fff" : "#333", position: template === "schematic" ? "inside" : "bottom", width: 100, overflow: "break", fontSize: Math.max(10, style.fontSize - 1) } })),
            edges: edges.map(edge => ({ source: edge.source, target: edge.target, value: edge.weight, lineStyle: { width: Math.min(5, 1 + Math.sqrt(edge.weight)), color: "#9893ad", curveness: edge.source === edge.target ? 0.5 : 0.08 } })),
            edgeSymbol: template === "schematic" ? ["none", "arrow"] : ["none", "none"], edgeSymbolSize: 9,
            edgeLabel: { show: style.showValues && template === "network", fontSize: 11, formatter: "{c}" },
        }], graphic: [{ type: "text", bottom: 16, left: "center", style: { text: template === "schematic" ? "箭头对应输入的步骤连接" : "圆形布局不代表节点距离", fill: "#787580", font: `11px ${style.fontFamily}` } }] };
    }
    if (template === "radar") {
        const maxima = data.x.map((_, row) => {
            const maximum = Math.max(...data.series.map(item => item.values[row])) || 1;
            const target = maximum / 5;
            const magnitude = 10 ** Math.floor(Math.log10(target));
            const interval = [1, 2, 3, 5, 10].find(value => value * magnitude >= target)! * magnitude;
            return Number((interval * 5).toPrecision(8));
        });
        return { ...shell, legend: { type: "scroll", top: 49, left: "center", textStyle: axisText },
            radar: { center: ["50%", "57%"], radius: "57%", splitNumber: 5,
                indicator: data.x.map((name, i) => ({ name: `${name}\n上限 ${Number(maxima[i].toPrecision(3))}`, min: 0, max: maxima[i] })),
                axisName: { ...axisText, fontSize: Math.max(10, style.fontSize - 1) }, splitArea: { show: false },
                splitLine: { lineStyle: { color: "#e0dfe8" } }, axisLine: { lineStyle: { color: "#d4d2de" } },
            }, series: [{ type: "radar", symbolSize: 5, data: data.series.map((item, i) => ({ name: item.name, value: item.values,
                lineStyle: { color: palette[i % palette.length], width: 2, type: style.palette === "mono" && i % 2 ? "dashed" : "solid" },
                areaStyle: { color: palette[i % palette.length], opacity: 0.08 },
            })) }] };
    }
    if (template === "heatmap") {
        const values = data.series.flatMap(item => item.values), min = values.reduce((a, b) => Math.min(a, b), Infinity), max = values.reduce((a, b) => Math.max(a, b), -Infinity);
        return { ...shell, grid: { left: 100, right: 48, top: 80, bottom: 104 },
            xAxis: { type: "category", data: data.series.map(item => item.name), axisLabel: { ...axisText, hideOverlap: true }, splitArea: { show: false } },
            yAxis: { type: "category", data: data.x, inverse: true, axisLabel: axisText, splitArea: { show: false } },
            visualMap: { min, max: max === min ? min + 1 : max, calculable: false, orient: "horizontal", left: "center", bottom: 22, textStyle: axisText,
                inRange: { color: style.customColors?.length ? palette : style.palette === "mono" ? ["#f4f4f4", "#313131"] : ["#f4eff9", "#acb9d3", palette[0]] } },
            series: [{ type: "heatmap", data: data.series.flatMap((item, col) => item.values.map((value, row) => [col, row, value])),
                label: { show: true, fontSize: Math.max(10, style.fontSize - 1), formatter: p => Number((p.value as number[])[2]).toLocaleString(undefined, { maximumFractionDigits: 3 }) },
                itemStyle: { borderColor: "#fff", borderWidth: 2 }, emphasis: { itemStyle: { borderColor: "#51446e", borderWidth: 2 } },
            }] };
    }
    if (template === "multi-panel") {
        const linePanels = style.panelChart === "line";
        const cols = data.series.length === 1 ? 1 : 2, rows = Math.ceil(data.series.length / cols);
        const grids = data.series.map((_, i) => ({ left: `${8 + (i % cols) * 49}%`, top: `${18 + Math.floor(i / cols) * (73 / rows)}%`, width: cols === 1 ? "84%" : "38%", height: `${73 / rows - 11}%` }));
        return { ...shell, grid: grids,
            xAxis: data.series.map((_, i) => ({ type: linePanels ? "value" as const : "category" as const, gridIndex: i, ...(linePanels ? { scale: true } : { data: data.x }), axisLabel: { ...axisText, fontSize: Math.max(9, style.fontSize - 2), hideOverlap: true }, axisTick: { show: false } })),
            yAxis: data.series.map((item, i) => ({ type: "value", gridIndex: i, name: item.name, nameTextStyle: axisText, axisLabel: { ...axisText, fontSize: Math.max(9, style.fontSize - 2) }, splitLine: { show: style.showGrid } })),
            series: data.series.map((item, i) => ({ type: linePanels ? "line" : "bar", name: item.name, xAxisIndex: i, yAxisIndex: i, data: linePanels ? data.x.map((x, row) => [x, item.values[row]]) : item.values, barMaxWidth: 36, itemStyle: { color: palette[i % palette.length] }, label: { show: style.showValues, position: "insideTop", color: "#fff", fontSize: 10 } })),
        };
    }
    if (["horizontal-bar", "stacked-bar", "percent-bar"].includes(template)) {
        const option = base("grouped-bar"), bars = option.series as BarSeriesOption[];
        if (template === "horizontal-bar") return { ...option,
            grid: { left: 120, right: 45, top: 92, bottom: 70 },
            xAxis: { type: "value", name: style.yLabel, nameLocation: "middle", nameGap: 42, axisLabel: axisText, splitLine: { show: style.showGrid } },
            yAxis: { type: "category", data: data.x, name: style.xLabel, nameLocation: "middle", nameGap: 88, inverse: true, axisLabel: { ...axisText, hideOverlap: true } },
            series: bars.map(item => ({ ...item, label: { ...item.label, position: "insideRight" } })),
        };
        const normalized = template === "percent-bar";
        const totals = data.x.map((_, row) => data.series.reduce((sum, item) => sum + item.values[row], 0));
        return { ...option, legend: { ...(option.legend as object), selectedMode: false },
            yAxis: { ...(option.yAxis as YAXisComponentOption), ...(normalized ? { max: 100, name: "占比 (%)" } : {}) },
            series: bars.map((item, i) => ({ ...item, stack: "composition", barGap: "0%", data: normalized ? data.series[i].values.map((value, row) => value / totals[row] * 100) : data.series[i].values,
                ...(style.hatching ? {itemStyle:{...item.itemStyle,decal:{symbol:"rect",dashArrayX:[1,0],dashArrayY:[2,4+i*2],rotation:i%2?Math.PI/4:-Math.PI/4,color:"rgba(30,30,30,.45)"}}} : {}),
                label: { ...item.label, position: "inside", formatter: (p: DefaultLabelFormatterCallbackParams) => `${Number(p.value).toFixed(1)}${normalized ? "%" : ""}` },
            })),
        };
    }
    const option = base("line"), lines = option.series as LineSeriesOption[];
    if (template === "scatter") return { ...option, tooltip: { trigger: "item", renderMode: "richText" },
        series: data.series.map((item, i) => ({ type: "scatter", name: item.name, data: data.x.map((x, row) => [x, item.values[row]]), symbolSize: 8, symbol: ["circle", "rect", "triangle", "diamond"][i % 4], itemStyle: { color: palette[i % palette.length], opacity: 0.8 } })),
    };
    if (template === "trend") return { ...option,
        title: { ...(option.title as object), text: style.title + (style.cumulative ? " · 累计" : "") },
        xAxis: { type: "category", data: data.x, boundaryGap: false, name: style.xLabel, nameLocation: "middle", nameGap: 42, axisLabel: { ...axisText, hideOverlap: true } },
        series: lines.map((item, i) => { let sum = 0; return { ...item, ...(style.stackedArea ? {stack:"area-composition",symbol:"none"} : {}), data: data.series[i].values.map(value => style.cumulative ? sum += value : value), areaStyle: { opacity: style.stackedArea ? 0.65 : 0.09 } }; }),
    };
    if (template === "dual-axis") return { ...option, grid: { left: 78, right: 86, top: 92, bottom: 74 },
        yAxis: [{ ...(option.yAxis as YAXisComponentOption), name: style.yLabel }, { ...(option.yAxis as YAXisComponentOption), name: style.secondaryYLabel || data.series[1].name, position: "right", splitLine: { show: false } }],
        series: lines.map((item, i) => ({ ...item, yAxisIndex: i })),
    };
    if (template === "concept") {
        const shade: CustomSeriesOption = { type: "custom", silent: true, z: 1, encode: { x: 0, y: [1, 2] }, data: data.x.slice(1).map((_, i) => [data.x[i], data.series[0].values[i], data.series[1].values[i]]),
            renderItem: (params, api) => { const i = params.dataIndex; return { type: "polygon", shape: { points: [api.coord([data.x[i], data.series[0].values[i]]), api.coord([data.x[i + 1], data.series[0].values[i + 1]]), api.coord([data.x[i + 1], data.series[1].values[i + 1]]), api.coord([data.x[i], data.series[1].values[i]])] }, style: { fill: palette[0], opacity: 0.1 } }; },
        };
        const x = style.annotationX;
        return { ...option, legend: { ...(option.legend as object), selectedMode: false }, series: [...lines.map((item, i): LineSeriesOption => ({ ...item, z: 4,
            ...(i === 0 && x !== undefined && Number.isFinite(x) ? { markLine: { symbol: ["none", "none"], silent: true, lineStyle: { color: "#887498", type: "dashed" }, label: { formatter: style.annotationText || "参考位置", position: "insideEndTop" }, data: [{ xAxis: x }] } } : {}),
        })), shade] };
    }
    // Trajectories retain the original row order, including reversals in X.
    return { ...option, tooltip: { trigger: "item", renderMode: "richText" }, series: lines.map(item => ({ ...item, symbolSize: 7, showSymbol: true })) };
}

export function layoutGraph(names: string[], edges: { source: string; target: string }[], layered: boolean) {
    const circular = () => names.map((_, i) => ({ x: 200 + 170 * Math.cos(i / names.length * 2 * Math.PI), y: 200 + 150 * Math.sin(i / names.length * 2 * Math.PI) }));
    if (!layered) return circular();
    const incoming = new Map(names.map(name => [name, 0])), level = new Map(names.map(name => [name, 0]));
    edges.forEach(edge => incoming.set(edge.target, incoming.get(edge.target)! + 1));
    const queue = names.filter(name => incoming.get(name) === 0); let visited = 0;
    while (queue.length) {
        const name = queue.shift()!; visited++;
        edges.filter(edge => edge.source === name).forEach(edge => { level.set(edge.target, Math.max(level.get(edge.target)!, level.get(name)! + 1)); incoming.set(edge.target, incoming.get(edge.target)! - 1); if (incoming.get(edge.target) === 0) queue.push(edge.target); });
    }
    if (visited !== names.length) return circular();
    const levels = Array.from(new Set(level.values())), counts = new Map(levels.map(l => [l, names.filter(n => level.get(n) === l).length])), used = new Map<number, number>();
    return names.map(name => { const l = level.get(name)!, i = used.get(l) ?? 0; used.set(l, i + 1); return { x: l * 180, y: (i - (counts.get(l)! - 1) / 2) * 100 }; });
}
