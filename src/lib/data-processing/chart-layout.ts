import { format, type EChartsOption, type GraphSeriesOption, type GridComponentOption, type LegendComponentOption, type XAXisComponentOption, type YAXisComponentOption } from "echarts";
import type { TemplateChartStyle } from "./template-chart.ts";
import type { TemplateData, TemplateId } from "./templates.ts";

type Axis = XAXisComponentOption | YAXisComponentOption;

export function textWidth(text: string, size: number, family: string): number {
    return Math.max(0, ...text.split("\n").map(line => format.getTextRect(line, `${size}px ${family}`).width));
}

/** Preserve the complete label, wrapping at word boundaries when possible. */
export function wrapChartText(text: string, maxWidth: number, size: number, family: string): string {
    return String(text).split("\n").map(paragraph => {
        const lines: string[] = [];
        let line = "";
        for (const character of paragraph) {
            if (line && textWidth(line + character, size, family) > maxWidth) {
                const boundary = line.lastIndexOf(" ");
                if (boundary > line.length / 3) {
                    lines.push(line.slice(0, boundary));
                    line = line.slice(boundary + 1) + character;
                } else {
                    lines.push(line);
                    line = character;
                }
            } else line += character;
        }
        lines.push(line);
        return lines.join("\n");
    }).join("\n");
}

function linesHeight(text: string, size: number): number { return text.split("\n").length * size * 1.16; }
function array<T>(value: T | T[] | undefined): T[] { return value ? Array.isArray(value) ? value : [value] : []; }

/** One layout policy is used by editor, SVG export, and gallery SSR previews. */
export function fitTemplateLayout(option: EChartsOption, data: TemplateData, template: TemplateId, style: TemplateChartStyle): EChartsOption {
    const width = style.width ?? 680, height = style.height ?? 420;
    const size = style.fontSize, family = style.fontFamily, padding = 16;
    const title = array(option.title)[0];
    const titleSize = size + 2;
    const titleText = wrapChartText(String(title?.text ?? style.title), width - padding * 4, titleSize, family);
    const titleHeight = linesHeight(titleText, titleSize);
    option.title = { ...title, text: titleText, top: 12, left: "center", padding: 0, textStyle: { ...title?.textStyle, fontFamily: family, fontSize: titleSize, lineHeight: titleSize * 1.16 } };
    let top = 12 + titleHeight + 18;
    if (option.legend) {
        const legend = array(option.legend)[0] as LegendComponentOption;
        const legendSize = Math.max(10, size - 1), available = width - padding * 4;
        const names = legend.data?.map(item => typeof item === "string" ? item : item.name ?? "") ?? data.series.map(item => item.name);
        const maxItemWidth = Math.min(260, available * .43);
        const wrapLegend = (name: string) => wrapChartText(name, maxItemWidth, legendSize, family);
        let rowWidth = 0, rowHeight = 0, legendHeight = 0;
        for (const name of names) {
            const wrapped = wrapLegend(name), itemWidth = textWidth(wrapped, legendSize, family) + 34;
            const itemHeight = linesHeight(wrapped, legendSize);
            if (rowWidth && rowWidth + itemWidth > available) { legendHeight += rowHeight + 8; rowWidth = 0; rowHeight = 0; }
            rowWidth += itemWidth + 14;
            rowHeight = Math.max(rowHeight, itemHeight);
        }
        legendHeight += rowHeight;
        // A plain, bounded legend displays every series; scrolling otherwise crops SVG exports.
        option.legend = { ...legend, type: "plain", left: "center", right: undefined, top, width: available, padding: 0,
            data: names, itemWidth: 16, itemHeight: 8, itemGap: 14, formatter: wrapLegend,
            textStyle: { ...legend.textStyle, fontSize: legendSize, fontFamily: family, lineHeight: legendSize * 1.16 } };
        top += legendHeight + 20;
    }
    let footer = 12;
    for (const graphic of array(option.graphic)) {
        if (graphic.type !== "text" || !("bottom" in graphic) || !("style" in graphic) || graphic.bottom === undefined || !graphic.style) continue;
        const graphicStyle = graphic.style as { text?: string; font?: string; lineHeight?: number };
        const fontSize = Number(graphicStyle.font?.match(/([\d.]+)px/)?.[1] ?? Math.max(10, size - 2));
        graphicStyle.text = wrapChartText(graphicStyle.text ?? "", width - padding * 4, fontSize, family);
        graphicStyle.lineHeight = fontSize * 1.16;
        footer = Math.max(footer, Number(graphic.bottom) + linesHeight(graphicStyle.text, fontSize) + 12);
    }
    // Heatmap color scales occupy the lower band in addition to category labels.
    if (option.visualMap) footer = Math.max(footer, 22 + 20 + size + 12);
    if (['sankey', 'funnel', 'treemap', 'sunburst'].includes(template)) {
        const series = array(option.series)[0];
        if (series?.type === 'sankey') {
            const nameWidth = Math.min(110, Math.max(30, ...data.x.map(name => textWidth(wrapChartText(String(name), 100, size, family), size, family))));
            Object.assign(series, { left: padding + nameWidth, right: padding + nameWidth, top: top + size, bottom: footer + size });
        } else if (series?.type === 'funnel') {
            Object.assign(series, { left: width * .18, right: width * .18, top, bottom: footer + 8 });
        } else if (series?.type === 'treemap') {
            Object.assign(series, { left: padding, right: padding, top, bottom: footer });
        } else if (series?.type === 'sunburst') {
            const usableHeight = height - top - footer;
            Object.assign(series, { center: [width / 2, top + usableHeight / 2], radius: [0, Math.max(25, Math.min(width / 2 - padding, usableHeight / 2 - size))] });
        }
        return option;
    }
    if (template === 'calendar-heatmap') {
        const calendar = array(option.calendar)[0];
        if (calendar) Object.assign(calendar, { left: padding + size * 2.8, right: padding + size * 1.5, top: top + size * 2.5, bottom: footer + size * 2, orient: 'horizontal' });
        return option;
    }
    if (template === "network" || template === "schematic") {
        const graph = array(option.series)[0] as GraphSeriesOption;
        const labelSize = Math.max(10, size - 1);
        let maxWidth = 42, maxHeight = 42, maxLabelHeight = 0;
        graph.data = graph.data?.map(node => {
            if (typeof node !== "object" || !node || !("name" in node)) return node;
            const name = wrapChartText(String(node.name ?? ""), template === "schematic" ? 160 : 140, labelSize, family);
            const labelWidth = textWidth(name, labelSize, family), labelHeight = linesHeight(name, labelSize);
            const nodeSize = template === "schematic" ? [labelWidth + 24, labelHeight + 18] : [42, 42];
            maxWidth = Math.max(maxWidth, nodeSize[0], labelWidth);
            maxHeight = Math.max(maxHeight, nodeSize[1]);
            maxLabelHeight = Math.max(maxLabelHeight, labelHeight);
            return { ...node, ...(template === "schematic" ? { symbolSize: nodeSize } : {}), label: { ...node.label, formatter: name, fontFamily: family, fontSize: labelSize, lineHeight: labelSize * 1.16, width: undefined, overflow: undefined } };
        });
        graph.left = padding + maxWidth / 2;
        graph.right = padding + maxWidth / 2;
        graph.top = top + maxHeight / 2 + 8;
        graph.bottom = footer + maxHeight / 2 + (template === "network" ? maxLabelHeight + 10 : 8);
        // Graph view scales symbols by its X transform. Preserve the view aspect so
        // node heights and circles cannot stretch into the title or footer bands.
        graph.preserveAspect = true;
        return option;
    }
    if (template === "radar") {
        const radar = array(option.radar)[0];
        if (radar?.indicator) {
            const labelSize = Math.max(10, size - 1), labelLimit = Math.min(180, width * .25);
            radar.indicator = radar.indicator.map(indicator => ({ ...indicator, name: wrapChartText(indicator.name ?? "", labelLimit, labelSize, family) }));
            const nameWidth = Math.max(...radar.indicator.map(indicator => textWidth(indicator.name ?? "", labelSize, family)));
            const nameHeight = Math.max(...radar.indicator.map(indicator => linesHeight(indicator.name ?? "", labelSize)));
            const usableHeight = height - top - footer;
            radar.center = [width / 2, top + usableHeight / 2];
            radar.radius = Math.max(30, Math.min(width / 2 - nameWidth - 22, usableHeight / 2 - nameHeight - 12));
            radar.axisNameGap = 10;
            radar.axisName = { ...radar.axisName, fontSize: labelSize, fontFamily: family, lineHeight: labelSize * 1.16 };
        }
        return option;
    }
    const grids = array(option.grid), xAxes = array(option.xAxis), yAxes = array(option.yAxis);
    if (!grids.length) return option;
    const multi = grids.length > 1, cols = multi ? 2 : 1, rows = Math.ceil(grids.length / cols);
    const panelWidth = (width - padding * 2) / cols;
    const panelHeight = (height - top - footer) / rows;
    grids.forEach((grid, index) => {
        const x = padding + index % cols * panelWidth, y = top + Math.floor(index / cols) * panelHeight;
        const axesX = xAxes.filter(axis => (axis.gridIndex ?? 0) === index), axesY = yAxes.filter(axis => (axis.gridIndex ?? 0) === index);
        const axisSize = multi ? Math.max(10, size - 2) : size;
        const plotWidth = panelWidth - 100, plotHeight = panelHeight - 90;
        const setup = (axis: Axis, vertical: boolean) => {
            const values = axis.type === "category" ? (axis.data ?? []).map(item => typeof item === "object" ? String(item.value) : String(item)) : [];
            const limit = vertical ? Math.min(170, panelWidth * .27) : Math.max(40, Math.min(160, plotWidth / Math.max(1, values.length) - 8));
            const wrapped = values.map(value => wrapChartText(value, limit, axisSize, family));
            axis.axisLabel = { ...axis.axisLabel, fontSize: axisSize, fontFamily: family, lineHeight: axisSize * 1.16, margin: 10,
                ...(values.length ? { formatter: (value: string) => wrapChartText(value, limit, axisSize, family), interval: 0, hideOverlap: false } : {}) } as Axis["axisLabel"];
            const name = wrapChartText(String(axis.name ?? ""), Math.max(80, vertical ? plotHeight : plotWidth), size, family);
            axis.name = name;
            axis.nameLocation = "middle";
            axis.nameTextStyle = { ...axis.nameTextStyle, fontSize: size, fontFamily: family, lineHeight: size * 1.16 };
            const numericValues = vertical ? data.series.flatMap(item => item.values) : data.x.filter((value): value is number => typeof value === "number");
            const numberStrings = numericValues.map(value => Number(value.toPrecision(5)).toLocaleString("en-US", { maximumSignificantDigits: 5 }));
            const labelExtent = vertical ? Math.max(axisSize * 2.5, ...[...wrapped, ...numberStrings].map(value => textWidth(value, axisSize, family))) : Math.max(axisSize * 1.16, ...wrapped.map(value => linesHeight(value, axisSize)));
            axis.nameGap = labelExtent + 18 + (name ? linesHeight(name, size) / 2 : 0);
            return { labelExtent, nameExtent: name ? linesHeight(name, size) : 0 };
        };
        const xSizes = axesX.map(axis => setup(axis, false)), ySizes = axesY.map(axis => setup(axis, true));
        const xExtent = Math.max(0, ...xSizes.map(extent => extent.labelExtent + extent.nameExtent + 28));
        const leftExtent = Math.max(30, ...ySizes.filter((_, i) => axesY[i].position !== "right").map(extent => extent.labelExtent + extent.nameExtent + 28));
        const rightExtent = Math.max(24, ...ySizes.filter((_, i) => axesY[i].position === "right").map(extent => extent.labelExtent + extent.nameExtent + 28));
        const updated: GridComponentOption = { ...grid, containLabel: false, left: x + leftExtent, right: width - x - panelWidth + rightExtent,
            top: y + axisSize / 2, bottom: height - y - panelHeight + xExtent,
            width: undefined, height: undefined, outerBoundsMode: "auto", outerBoundsContain: "all",
            outerBounds: { left: x, right: width - x - panelWidth, top: y, bottom: height - y - panelHeight },
            outerBoundsClampWidth: 30, outerBoundsClampHeight: 30 };
        Object.assign(grid, updated);
    });
    return option;
}
