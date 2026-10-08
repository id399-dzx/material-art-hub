import type { EChartsOption } from "echarts";
import type { TemplateChartStyle } from "./template-chart.ts";
import type { TemplateData } from "./templates.ts";
import { localRadarBounds } from "./template-chart-variants.ts";

function radarMaximum(values: number[]): number {
    const maximum = Math.max(...values) || 1;
    const target = maximum / 5;
    const magnitude = 10 ** Math.floor(Math.log10(target));
    const interval = [1, 2, 3, 5, 10].find(value => value * magnitude >= target)! * magnitude;
    return Number((interval * 5).toPrecision(8));
}

function orderedIndicatorRows(data: TemplateData, style: TemplateChartStyle): number[] {
    const sourceNames = data.x.map(String);
    const order = (style.radarSettings?.order ?? []).map(name => sourceNames.indexOf(name)).filter(index => index >= 0);
    return [...new Set([...order, ...sourceNames.map((_, row) => row)])];
}

function manualIndicatorRange(style: TemplateChartStyle, name: string) {
    return style.radarSettings?.axes && Object.hasOwn(style.radarSettings.axes, name) ? style.radarSettings.axes[name] : undefined;
}

function includesValues(bounds: { min: number; max: number }, values: number[]): boolean {
    return Number.isFinite(bounds.min) && Number.isFinite(bounds.max) && bounds.max > bounds.min
        && values.every(value => value >= bounds.min && value <= bounds.max);
}

/** UI ranges use the actual observation units, including independently normalized radar plots. */
export function radarAxisRanges(data: TemplateData, style: TemplateChartStyle): Array<{ name: string; values: number[]; min: number; max: number }> {
    return orderedIndicatorRows(data, style).map(row => {
        const name = String(data.x[row]);
        const manual = manualIndicatorRange(style, name);
        const values = data.series.map(item => item.values[row]);
        const [min, max] = manual && includesValues(manual, values) ? [manual.min, manual.max] : style.variant === "local-range-radar" ? localRadarBounds(values) : [0, radarMaximum(values)];
        return { name, values, min, max };
    });
}

/** Reorder the displayed indicators and their coordinates together, keeping every observation. */
export function createRadarOption(data: TemplateData, style: TemplateChartStyle, palette: string[], shell: EChartsOption): EChartsOption {
    const settings = style.radarSettings;
    const local = style.variant === "local-range-radar";
    const sourceNames = data.x.map(String);
    const rows = orderedIndicatorRows(data, style);
    const ranges = radarAxisRanges(data, style);
    for (const { name, values } of ranges) {
        const manual = manualIndicatorRange(style, name);
        if (manual && !includesValues(manual, values)) throw new Error(`「${name}」的固定量程没有包含全部当前数据，请调整上下限或恢复自动量程。`);
    }
    const axisText = { color: "#383842", fontSize: style.fontSize, fontFamily: style.fontFamily };
    return {
        ...shell,
        legend: { type: "scroll", top: 49, left: "center", textStyle: axisText },
        radar: {
            center: ["50%", "57%"], radius: "57%", splitNumber: settings?.splitNumber ?? 5,
            shape: settings?.shape ?? "polygon", startAngle: settings?.startAngle ?? 90,
            indicator: ranges.map(({ name, min, max }) => {
                const manual = !!(settings?.axes && Object.hasOwn(settings.axes, name));
                return {
                    name: local || manual ? `${name}\n范围 ${min}–${max}` : `${name}\n上限 ${Number(max.toPrecision(3))}`,
                    min: local ? 0 : min, max: local ? 1 : max,
                };
            }),
            axisName: { ...axisText, fontSize: Math.max(10, style.fontSize - 1) },
            splitArea: { show: false },
            splitLine: { show: style.showGrid, lineStyle: { color: "#e0dfe8" } },
            axisLine: { show: style.showGrid, lineStyle: { color: "#d4d2de" } },
        },
        tooltip: {
            renderMode: "richText", confine: true,
            formatter: (params: unknown) => {
                const name = (params as { name?: string }).name;
                const series = data.series.find(item => item.name === name);
                return series ? `${series.name}\n${rows.map(row => `${sourceNames[row]}: ${series.values[row]}`).join("\n")}` : "";
            },
        },
        series: [{
            type: "radar", symbolSize: 5,
            data: data.series.map((item, i) => ({
                name: item.name,
                value: rows.map((row, index) => local ? (item.values[row] - ranges[index].min) / (ranges[index].max - ranges[index].min) : item.values[row]),
                lineStyle: { color: palette[i % palette.length], width: 2, type: style.palette === "mono" && i % 2 ? "dashed" : "solid" },
                areaStyle: { color: palette[i % palette.length], opacity: 0.08 },
            })),
        }],
    };
}
