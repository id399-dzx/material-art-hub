import type { EChartsOption } from 'echarts';
import { L1502_SPATIAL_KINDS, type L1502Data, type L1502Spec, type L1502Style } from './l1502-spec.ts';
import { createL1502TwoDimensionalOption } from './l1502-render-2d.ts';
import { createL1502SpatialOption } from './l1502-render-spatial.ts';
import { findChartPalette } from './chart-palettes.ts';
import { applySeriesAppearances } from './series-appearance.ts';

type SeriesPart = Record<string, unknown>;
function finishClassificationStyle(option: EChartsOption, style: L1502Style): void {
    const theme = findChartPalette(style.colors), series = (Array.isArray(option.series) ? option.series : option.series ? [option.series] : []) as unknown as SeriesPart[];
    series.forEach((item, seriesIndex) => {
        const line = (item.lineStyle ?? {}) as SeriesPart, mark = (item.itemStyle ?? {}) as SeriesPart;
        const rawColor = typeof line.color === 'string' ? line.color : typeof mark.color === 'string' ? mark.color : style.colors[seriesIndex % style.colors.length];
        const colorIndex = style.colors.findIndex(color => color.toLowerCase() === rawColor?.toLowerCase()), index = colorIndex < 0 ? seriesIndex : colorIndex;
        if ((theme?.id === 'mono' || theme?.id === 'accessible') && (item.type === 'line' || item.type === 'scatter')) {
            item.symbol = ['circle', 'rect', 'triangle', 'diamond', 'emptyCircle', 'emptyRect', 'emptyTriangle', 'emptyDiamond'][index % 8];
            if (item.type === 'line') item.lineStyle = { ...line, type: ['solid', 'dashed', 'dotted'][index % 3] };
        }
        if (item.type === 'bar' && rawColor && /^#[\da-f]{6}$/i.test(rawColor)) {
            const edge = `rgb(${[1, 3, 5].map(offset => Math.round(parseInt(rawColor.slice(offset, offset + 2), 16) * .72)).join(',')})`;
            item.itemStyle = { ...mark, borderColor: edge, borderWidth: .7,
                ...(theme?.id === 'mono' ? { decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5 + index * 2], rotation: index % 2 ? -Math.PI / 4 : Math.PI / 4, color: 'rgba(255,255,255,.65)' } } : {}) };
        }
    });
}

export function createL1502Option(data: L1502Data, spec: L1502Spec, style: L1502Style): EChartsOption {
    const resolved = { ...spec, colorByValue: spec.colorByValue || data.mapping.color !== undefined };
    const option = L1502_SPATIAL_KINDS.includes(spec.kind)
        ? createL1502SpatialOption(data, resolved, style)
        : createL1502TwoDimensionalOption(data, resolved, style);
    finishClassificationStyle(option, style);
    applySeriesAppearances(option, style.seriesAppearances);
    return option;
}
