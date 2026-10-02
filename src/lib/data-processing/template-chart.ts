import type { CustomSeriesOption, EChartsOption, GridComponentOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from "echarts";
import { createDistributionOption } from "./template-chart-distribution.ts";
import { createExtendedTemplateOption } from "./template-chart-extended.ts";
import { fitTemplateLayout } from "./chart-layout.ts";
import type { ErrorMeasure, TemplateData, TemplateId } from "./templates.ts";
import type { PaperChartVariant } from "./drawing-spec.ts";
import { createPairedCorrelationOption, observedCurveDifference } from "./template-chart-variants.ts";

export type PublicationStyle = "journal" | "soft" | "mono" | "accessible";
export type TemplateChartStyle = {
    title: string; xLabel: string; yLabel: string; fontFamily: string; fontSize: number;
    palette: PublicationStyle; showGrid: boolean; showValues: boolean; errorMeasure: ErrorMeasure;
    panelChart?: "bar" | "line"; cumulative?: boolean; secondaryYLabel?: string; annotationX?: number; annotationText?: string; yaw?: number; pitch?: number; width?: number; height?: number;
    customColors?: string[]; horizontal?: boolean; colorByCategory?: boolean; stackedArea?: boolean; hatching?: boolean; fillLines?: boolean; sphereGuide?: boolean;
    xLog?: boolean; yLog?: boolean; equalAxes?: boolean;
    variant?: PaperChartVariant;
};

const colors: Record<PublicationStyle, string[]> = {
    accessible: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#000000"],
    journal: ["#38679b", "#c77972", "#64958c", "#9783b6", "#c29b57", "#7c919f"],
    soft: ["#788bcc", "#d69baf", "#7dafb1", "#b4a0ce", "#ceaa78", "#89a3ba"],
    mono: ["#282828", "#696969", "#a0a0a0", "#c9c9c9", "#4b4b4b", "#888888"],
};

export function createTemplateOption(data: TemplateData, template: TemplateId, style: TemplateChartStyle): EChartsOption {
    const option = buildTemplateOption(data, template, style);
    applyCartesianScales(option, data, style);
    fitTemplateLayout(option, data, template, style);
    if (style.equalAxes) fitEqualUnitGrid(option, style);
    return option;
}

function components<T>(value: T | T[] | undefined): T[] {
    return value ? Array.isArray(value) ? value : [value] : [];
}

function formatLogTick(value: string | number): string {
    const number = Number(value), exponent = Math.log10(number), integer = Math.round(exponent);
    if (number > 0 && Number.isFinite(exponent) && Math.abs(exponent - integer) < 1e-8) {
        const superscript: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
        return "10" + String(integer).split("").map(character => superscript[character]).join("");
    }
    return Number.isFinite(number) ? String(Number(number.toPrecision(3))) : String(value);
}

function logarithmicAxis(axis: XAXisComponentOption | YAXisComponentOption): void {
    Object.assign(axis, { type: "log", logBase: 10, scale: true });
    // Compact decade labels fit the complete frequency range between the two Y axes.
    axis.axisLabel = { ...axis.axisLabel, formatter: formatLogTick, showMinLabel: true, showMaxLabel: true, hideOverlap: false };
}

function applyCartesianScales(option: EChartsOption, data: TemplateData, style: TemplateChartStyle): void {
    const xAxes = components(option.xAxis), yAxes = components(option.yAxis);
    if (style.xLog) xAxes.forEach(axis => {
        if (axis.type !== "value") return;
        logarithmicAxis(axis);
    });
    if (style.yLog && yAxes[0]?.type === "value") logarithmicAxis(yAxes[0]);
    if (!style.equalAxes || style.xLog || style.yLog || xAxes.length !== 1 || yAxes.length !== 1 || xAxes[0].type !== "value" || yAxes[0].type !== "value") return;
    const values = [...data.x.filter((value): value is number => typeof value === "number"), ...data.series.flatMap(series => series.values)].filter(Number.isFinite);
    if (!values.length) return;
    let minimum = 0, maximum = 0;
    for (const value of values) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
    const range = maximum - minimum || 1;
    const min = minimum < 0 ? minimum - range * .05 : 0;
    const max = maximum > 0 ? maximum + range * .05 : maximum === 0 && minimum === 0 ? 1 : 0;
    // Identical domains and a square *inner* plot ensure one ohm has the same pixel length on each axis.
    for (const axis of [...xAxes, ...yAxes]) Object.assign(axis, { min, max, scale: true, splitNumber: 5 });
}

function fitEqualUnitGrid(option: EChartsOption, style: TemplateChartStyle): void {
    const grids = components(option.grid), xAxes = components<XAXisComponentOption>(option.xAxis), yAxes = components<YAXisComponentOption>(option.yAxis);
    if (grids.length !== 1 || xAxes.length !== 1 || yAxes.length !== 1 || xAxes[0].type !== "value" || yAxes[0].type !== "value") return;
    const width = style.width ?? 680, height = style.height ?? 420;
    const grid = grids[0] as GridComponentOption;
    const left = Number(grid.left), right = Number(grid.right), top = Number(grid.top), bottom = Number(grid.bottom);
    if (![left, right, top, bottom].every(Number.isFinite)) return;
    const availableWidth = width - left - right, availableHeight = height - top - bottom;
    const side = Math.min(availableWidth, availableHeight);
    if (side <= 0) return;
    Object.assign(grid, {
        left: left + (availableWidth - side) / 2,
        top: top + (availableHeight - side) / 2,
        width: side, height: side, right: undefined, bottom: undefined,
        containLabel: false, outerBoundsMode: "none",
    });
}

function buildTemplateOption(data: TemplateData, template: TemplateId, style: TemplateChartStyle): EChartsOption {
    const custom = style.customColors?.filter(color => /^#[a-f\d]{6}$/i.test(color));
    const palette = custom?.length ? custom : colors[style.palette];
    if (style.variant === "paired-correlation") return createPairedCorrelationOption(data, style, palette);
    if (template === "box" || template === "violin" || template === "histogram") return createDistributionOption(data, template, style, palette);
    if (!["line", "grouped-bar", "error-bar"].includes(template)) return createExtendedTemplateOption(data, template, style, palette, id => buildTemplateOption(data, id, style));
    const isLine = template === "line";
    const horizontal = (!!style.horizontal || style.variant === "horizontal-error") && template === "error-bar";
    const series: SeriesOption[] = data.series.map((item, index) => {
        const color = palette[index % palette.length];
        if (isLine) {
            const baseline = style.variant === "baseline-line" && item.values.length > 0 && item.values.every(value => value === item.values[0]);
            const stacked = style.variant === "stacked-area";
            return {
            name: item.name, type: "line", data: data.x.map((x, row) => stacked ? [item.values[row], x] : [x, item.values[row]]),
            smooth: false, connectNulls: false, symbol: stacked ? "none" : ["circle", "rect", "triangle", "diamond"][index % 4],
            symbolSize: 5, showSymbol: !baseline && !stacked && data.x.length <= 50, lineStyle: { width: 2, type: baseline ? "dashed" : (style.palette === "mono" || style.palette === "accessible") ? ["solid", "dashed", "dotted"][index % 3] as "solid" | "dashed" | "dotted" : "solid" },
            itemStyle: { color }, emphasis: { focus: "series" },
            ...(stacked ? { dimensions: ["Value", "X"], encode: { x: 1, y: 0, tooltip: [1, 0] }, stack: "area-composition", areaStyle: { opacity: .7, ...(style.hatching ? { decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [2, 5 + index * 2], rotation: index % 2 ? -Math.PI / 4 : Math.PI / 4, color: "rgba(40,40,40,.35)" } } : {}) } } : style.fillLines || style.variant === "filled-distribution" ? { areaStyle: { opacity: 0.12 } } : {}),
            ...(style.variant === "filled-distribution" && index === 0 && Number.isFinite(style.annotationX) ? { markLine: { symbol: ["none", "none"], silent: true, lineStyle: { type: "dashed", color: "#6a6478" }, label: { formatter: style.annotationText || "参考位置", position: "insideEndTop", fontSize: Math.max(10, style.fontSize - 2) }, data: [{ xAxis: style.annotationX }] } } : {}),
        };
        }
        return {
            name: item.name, type: "bar", data: style.colorByCategory && data.series.length === 1 ? item.values.map((value,i) => ({value,itemStyle:{color:palette[i%palette.length]}})) : item.values, barMaxWidth: 40, barGap: "25%", barCategoryGap: "40%",
            itemStyle: {
                color, borderColor: style.palette === "mono" ? "#282828" : color, borderWidth: style.palette === "mono" ? 1 : 0,
                ...(style.palette === "mono" ? { decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [2, 5 + index * 2], rotation: index % 2 ? -Math.PI / 4 : Math.PI / 4, color: "rgba(255,255,255,.65)" } } : {}),
            },
            label: { show: style.showValues, position: horizontal ? "insideRight" : "insideTop", distance: 6, color: "#fff", fontSize: Math.max(10, style.fontSize - 2), formatter: ({ value }) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) },
            emphasis: { focus: "series" },
        };
    });

    if (style.variant === "filled-distribution") {
        const difference = observedCurveDifference(data, style);
        if (difference) series.push(difference);
    }

    if (template === "error-bar") data.series.forEach((item, seriesIndex) => {
        if (!item.errors) return;
        const errorSeries: CustomSeriesOption = {
            // Keep the legend name consistent with the corresponding mean series.
            name: item.name, type: "custom", silent: true, z: 5, clip: true,
            tooltip: { show: false }, encode: horizontal ? { y: 0, x: [1, 2] } : { x: 0, y: [1, 2] },
            data: item.values.map((mean, index) => [index, mean - item.errors![index], mean + item.errors![index]]),
            renderItem: (_, api) => {
                const category = Number(api.value(0));
                const lower = api.coord(horizontal ? [api.value(1),category] : [category, api.value(1)]);
                const upper = api.coord(horizontal ? [api.value(2),category] : [category, api.value(2)]);
                const layout = api.barLayout({ count: data.series.length, barGap: "25%", barCategoryGap: "40%", barMaxWidth: 40 })[seriesIndex];
                const x = lower[0] + (layout?.offsetCenter ?? 0);
                const halfCap = Math.min(7, (layout?.width ?? 20) * 0.32);
                if (horizontal) {
                    const y = lower[1] + (layout?.offsetCenter ?? 0);
                    return {type:"group",children:[
                        {type:"line",shape:{x1:lower[0],y1:y,x2:upper[0],y2:y},style:{stroke:"#34343d",lineWidth:1.4}},
                        {type:"line",shape:{x1:lower[0],y1:y-halfCap,x2:lower[0],y2:y+halfCap},style:{stroke:"#34343d",lineWidth:1.4}},
                        {type:"line",shape:{x1:upper[0],y1:y-halfCap,x2:upper[0],y2:y+halfCap},style:{stroke:"#34343d",lineWidth:1.4}},
                    ]};
                }
                return {
                    type: "group", children: [
                        { type: "line", shape: { x1: x, y1: lower[1], x2: x, y2: upper[1] }, style: { stroke: "#34343d", lineWidth: 1.4 } },
                        { type: "line", shape: { x1: x - halfCap, y1: lower[1], x2: x + halfCap, y2: lower[1] }, style: { stroke: "#34343d", lineWidth: 1.4 } },
                        { type: "line", shape: { x1: x - halfCap, y1: upper[1], x2: x + halfCap, y2: upper[1] }, style: { stroke: "#34343d", lineWidth: 1.4 } },
                    ],
                };
            },
        };
        series.push(errorSeries);
    });

    const axisText = { color: "#383842", fontSize: style.fontSize, fontFamily: style.fontFamily };
    const xAxisStyle = {
        name: style.xLabel, nameLocation: "middle" as const, nameGap: 42, nameTextStyle: axisText,
        axisLine: { show: true, onZero: false, lineStyle: { color: "#42424b", width: 1.2 } },
        axisTick: { show: true, inside: true }, axisLabel: { ...axisText, hideOverlap: true },
        splitLine: { show: false },
    };
    return {
        animation: false, backgroundColor: "#ffffff", color: palette,
        textStyle: { ...axisText },
        title: { text: style.title, left: "center", top: 16, textStyle: { ...axisText, fontSize: style.fontSize + 2, fontWeight: 600 } },
        // Error bar groups are changed through column binding so cap offsets stay aligned.
        legend: { selectedMode: template !== "error-bar", type: "scroll", data: data.series.map(item => item.name), top: 50, left: "center", textStyle: { ...axisText, fontSize: Math.max(10, style.fontSize - 1) }, itemWidth: 16, itemHeight: 8 },
        grid: { left: horizontal ? 140 : 74, right: 30, top: 92, bottom: 74 },
        tooltip: { trigger: "axis", renderMode: "richText", confine: true },
        ...(template === "error-bar" ? { graphic: [{ type: "text", left: "center", bottom: 8, style: {
            text: `误差条：±${style.errorMeasure}${data.series[0].sampleSizes ? `；独立重复实验 n = ${Array.from(new Set(data.series[0].sampleSizes)).join(", ")}` : "；使用提供的误差列"}`,
            fill: "#787580", font: `11px ${style.fontFamily}`,
        } }] } : {}),
        xAxis: horizontal ? { ...xAxisStyle, type: "value", name: style.yLabel, splitLine: {show:style.showGrid} } : isLine ? { ...xAxisStyle, type: "value", scale: true } : {
            ...xAxisStyle, type: "category", data: data.x,
            axisTick: { ...xAxisStyle.axisTick, alignWithLabel: true },
            axisLabel: { ...xAxisStyle.axisLabel, formatter: (value: string) => value.length > 14 ? value.slice(0, 13) + "…" : value },
        },
        yAxis: horizontal ? {type:"category",data:data.x,inverse:true,name:style.xLabel,nameLocation:"middle",nameGap:110,axisLabel:axisText,axisLine:{show:true},axisTick:{show:true,inside:true}} : {
            type: "value", scale: isLine && style.variant !== "stacked-area", name: style.yLabel, nameLocation: "middle", nameGap: 53, nameTextStyle: axisText,
            axisLine: { show: true, lineStyle: { color: "#42424b", width: 1.2 } }, axisTick: { show: true, inside: true },
            axisLabel: axisText, splitLine: { show: style.showGrid, lineStyle: { color: "#eeedf2", type: "dashed" } },
        },
        series,
    };
}
