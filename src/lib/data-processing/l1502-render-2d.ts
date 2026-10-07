import type { CustomSeriesOption, EChartsOption } from 'echarts';
import { sampleBox } from './distributions.ts';
import { numericCell } from './templates.ts';
import { wrapChartText } from './chart-layout.ts';
import type { L1502Data, L1502Point, L1502Series, L1502Spec, L1502Style } from './l1502-spec.ts';

type Part = Record<string, unknown>;
const unique = <T,>(a: T[]) => [...new Set(a)];
const extent = (a: number[]) => a.length ? [Math.min(...a), Math.max(...a)] as const : [0, 1] as const;
const fmt = (v: number) => Number(v.toPrecision(4)).toString();
const font = (s: L1502Style, delta = 0) => `${Math.max(9, s.fontSize + delta)}px ${s.fontFamily}`;
const colorAt = (s: L1502Style, i: number) => s.colors[i % s.colors.length] ?? '#147a8b';
function scalarColor(value: number, min: number, max: number): string {
    const stops = [[36, 77, 139], [100, 187, 197], [245, 230, 167], [204, 73, 67]], t = Math.max(0, Math.min(3, max === min ? 1.5 : (value - min) / (max - min) * 3)), i = Math.min(2, Math.floor(t)), p = t - i;
    return `rgb(${stops[i].map((v, c) => Math.round(v + (stops[i + 1][c] - v) * p)).join(',')})`;
}
const gradient = (c: string, horizontal = false) => ({ type: 'linear' as const, x: 0, y: 1, x2: horizontal ? 1 : 0, y2: horizontal ? 1 : 0, colorStops: [{ offset: 0, color: `${c}25` }, { offset: 1, color: c }] });
const note = (style: L1502Style, text: string): Part => ({ type: 'text', left: 'center', bottom: 6, style: { text: wrapChartText(text, style.width - 48, Math.max(9, style.fontSize - 3), style.fontFamily), fill: '#505763', font: font(style, -3), lineHeight: Math.max(9, style.fontSize - 3) * 1.22, align: 'center' } });
const title = (style: L1502Style, subtitle?: string): Part => ({ text: wrapChartText(style.title, style.width - 64, style.fontSize + 3, style.fontFamily), subtext: subtitle, top: 9, left: 'center', textStyle: { fontFamily: style.fontFamily, fontSize: style.fontSize + 3, color: '#202b35' }, subtextStyle: { fontFamily: style.fontFamily, fontSize: Math.max(10, style.fontSize - 2) } });
function axis(style: L1502Style, name: string, type = 'value', extra: Part = {}): Part {
    return { type, name, nameLocation: 'middle', nameGap: type === 'category' ? 40 : 46, nameTextStyle: { fontFamily: style.fontFamily, fontSize: style.fontSize }, axisLabel: { fontFamily: style.fontFamily, fontSize: style.fontSize - 1, hideOverlap: false }, axisLine: { show: true, lineStyle: { color: '#74808b' } }, axisTick: { show: true }, splitLine: { show: style.showGrid, lineStyle: { color: '#e6e9ed' } }, ...extra };
}
function shell(data: L1502Data, spec: L1502Spec, style: L1502Style, names = data.series.map(s => s.name)): Part {
    let used = 0, rows = 1;
    const legendWidth = Math.max(150, style.width - 80);
    names.forEach(name => { const width = name.length * style.fontSize * .65 + 40; if (used + width > legendWidth) { rows++; used = 0; } used += width; });
    const legendHeight = names.length > 1 ? rows * (style.fontSize + 9) : 0;
    const categorical = data.points.some(p => typeof p.x === 'string');
    return { animation: false, backgroundColor: '#fff', textStyle: { fontFamily: style.fontFamily, fontSize: style.fontSize }, color: style.colors,
        title: title(style), tooltip: { trigger: 'item', renderMode: 'richText', confine: true },
        ...(names.length > 1 ? { legend: { type: 'plain', data: names, selectedMode: false, left: 35, right: 35, top: 42, itemGap: 12, textStyle: { fontFamily: style.fontFamily, fontSize: style.fontSize - 1 } } } : {}),
        grid: { left: 76, right: spec.colorByValue ? 108 : 40, top: 64 + legendHeight, bottom: 69, containLabel: true },
        xAxis: axis(style, style.xLabel, spec.logX ? 'log' : spec.timeX ? 'time' : categorical ? 'category' : 'value', categorical ? { data: unique(data.points.map(p => String(p.x))), boundaryGap: true } : { scale: true }),
        yAxis: axis(style, style.yLabel, spec.logY ? 'log' : 'value', { scale: !['bar', 'stacked-bar', 'error-bar', 'stem', 'area', 'variable-bar'].includes(spec.kind), ...(!spec.logY && ['bar', 'stacked-bar', 'error-bar', 'stem', 'area', 'variable-bar'].includes(spec.kind) && data.points.every(p => Number(p.y) >= 0) ? { min: 0 } : {}) }),
    };
}
function valueMap(values: number[], indices: number[], style: L1502Style, dimension = 3, label = 'Color'): Part {
    const [min, max] = extent(values);
    const common = { dimension, seriesIndex: indices, calculable: false, orient: 'vertical', right: 5, top: '54%', itemHeight: Math.min(150, style.height * .3), itemWidth: 13, precision: 3, text: [label, ''], textStyle: { fontFamily: style.fontFamily, fontSize: Math.max(9, style.fontSize - 2) } };
    return min === max ? { ...common, type: 'piecewise', pieces: [{ value: min, label: fmt(min), color: '#64bbc5' }], selectedMode: false } : { ...common, type: 'continuous', min, max, inRange: { color: ['#244d8b', '#64bbc5', '#f5e6a7', '#cc4943'] } };
}
function sizeLegend(data: L1502Data, style: L1502Style, maxDiameter = 52): Part[] {
    const max = Math.max(...data.points.map(p => p.size ?? 0)), samples = unique([max * .25, max * .5, max]);
    if (!max) return [note(style, 'Size = 0：零面积；所有原始行均保留')];
    return [{ type: 'group', right: 8, top: 61, children: [{ type: 'text', style: { text: 'Size → 面积', x: 0, y: 0, font: font(style, -3), fill: '#4a535f' } }, ...samples.flatMap((v, i) => [{ type: 'circle', shape: { cx: 25, cy: 35 + i * 40, r: maxDiameter * Math.sqrt(v / max) / 2 }, style: { stroke: '#718493', fill: '#ffffff00', lineWidth: 1 } }, { type: 'text', style: { text: fmt(v), x: 57, y: 30 + i * 40, font: font(style, -3), fill: '#4a535f' } }])] }];
}
function scatterSeries(s: L1502Series, spec: L1502Spec, style: L1502Style, i: number, maxSize: number, extra: Part = {}): Part {
    return { type: 'scatter', name: s.name, data: s.points.map(p => ({ value: [p.x, p.y, p.size ?? 0, p.color ?? Number(p.y)], name: p.label ?? `${p.x}, ${p.y}` })), encode: { x: 0, y: 1, tooltip: [0, 1, 2, 3] }, symbolSize: ['bubble', 'polar-bubble'].includes(spec.kind) ? (v: number[]) => maxSize > 0 ? 52 * Math.sqrt(v[2] / maxSize) : 0 : 7,
        itemStyle: { color: colorAt(style, i), opacity: .78, borderColor: '#fff', borderWidth: .6 }, label: { show: spec.labels || style.showValues, formatter: (p: { name: string }) => wrapChartText(p.name, 100, style.fontSize - 2, style.fontFamily), position: 'top', fontFamily: style.fontFamily, fontSize: style.fontSize - 2 }, labelLayout: (p: { labelRect: { width: number; height: number; x: number; y: number } }) => ({ x: Math.max(100 + p.labelRect.width / 2, Math.min(style.width - (spec.colorByValue ? 145 : 65) - p.labelRect.width / 2, p.labelRect.x + p.labelRect.width / 2)), y: Math.max(100, Math.min(style.height - 120, p.labelRect.y)), hideOverlap: true }), ...extra };
}
function errors(s: L1502Series, i: number, style: L1502Style, horizontal: boolean, axisIndex = 0, categoryOffset = 0): CustomSeriesOption {
    return { type: 'custom', name: `${s.name} · error`, xAxisIndex: axisIndex, yAxisIndex: axisIndex, data: s.points.filter(p => p.error !== undefined).map(p => horizontal ? [p.y, p.x, Number(p.y) - p.error!, Number(p.y) + p.error!] : [p.x, p.y, Number(p.y) - p.error!, Number(p.y) + p.error!]), encode: horizontal ? { x: [0, 2, 3], y: 1 } : { x: 0, y: [1, 2, 3] },
        renderItem: (_, api) => { const a = api.coord(horizontal ? [api.value(2), api.value(1)] : [api.value(0), api.value(2)]), b = api.coord(horizontal ? [api.value(3), api.value(1)] : [api.value(0), api.value(3)]); const dim = horizontal ? 1 : 0, size = api.size!(horizontal ? [0, 1] : [1, 0]) as number[]; a[dim] += size[dim] * categoryOffset; b[dim] += size[dim] * categoryOffset; const stroke = colorAt(style, i); return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke, lineWidth: 1.4 } }, ...[a, b].map(q => ({ type: 'line' as const, shape: horizontal ? { x1: q[0], x2: q[0], y1: q[1] - 4, y2: q[1] + 4 } : { x1: q[0] - 4, x2: q[0] + 4, y1: q[1], y2: q[1] }, style: { stroke, lineWidth: 1.4 } }))] }; } };
}
function interval(s: L1502Series, i: number, style: L1502Style, axisIndex = 0): CustomSeriesOption {
    const points = s.points.filter(p => p.lower !== undefined && p.upper !== undefined);
    return { type: 'custom', name: `${s.name} · ${style.intervalLabel}`, xAxisIndex: axisIndex, yAxisIndex: axisIndex, data: points.map(p => [p.x, p.lower!, p.upper!]), encode: { x: 0, y: [1, 2] }, silent: true,
        // One polygon uses all supplied lower/upper pairs in their measured sequence.
        renderItem: (params, api) => params.dataIndex || !points.length ? null : ({ type: 'polygon', shape: { points: [...points.map(p => api.coord([p.x, p.lower!])), ...[...points].reverse().map(p => api.coord([p.x, p.upper!]))] }, style: { fill: colorAt(style, i), opacity: .22, stroke: colorAt(style, i), lineWidth: .5 } }) };
}
function annotate(spec: L1502Spec, style: L1502Style): Part[] {
    if (!spec.annotation) return [];
    const text = style.annotationText;
    if (spec.annotation === 'formula') return [{ type: 'text', right: 45, top: 98, style: { text, font: font(style, 2), fill: '#263b50', backgroundColor: '#ffffffdd', padding: 7 } }];
    if (spec.annotation === 'arrow') return [{ type: 'group', right: 45, top: 98, children: [{ type: 'text', style: { text, x: 0, y: 0, font: font(style), fill: '#374656' } }, { type: 'line', shape: { x1: 10, y1: 24, x2: -28, y2: 65 }, style: { stroke: '#374656', lineWidth: 1.5 } }, { type: 'polygon', shape: { points: [[-28, 65], [-25, 53], [-16, 61]] }, style: { fill: '#374656' } }] }];
    if (spec.annotation === 'shape') return [{ type: 'group', right: 45, top: 102, children: [{ type: 'rect', shape: { x: 0, y: 0, width: Math.max(105, text.length * style.fontSize * .6), height: 39, r: 5 }, style: { fill: '#fff6dc', stroke: '#b8944e', lineWidth: 1 } }, { type: 'text', style: { text, x: 10, y: 12, font: font(style), fill: '#684e24' } }] }];
    return [];
}

/** Every series is SVG-compatible: native ECharts or custom vector primitives. */
export function createL1502TwoDimensionalOption(data: L1502Data, spec: L1502Spec, style: L1502Style): EChartsOption {
    const base = shell(data, spec, style), kind = spec.kind;
    let result: Part;
    if (kind === 'heatmap' || kind === 'bubble-matrix') result = matrixOption(data, spec, style, base);
    else if (kind === 'box' || kind === 'jitter') result = boxOption(data, spec, style, base);
    else if (kind === 'histogram' || kind === 'histogram2' || kind === 'polar-histogram') result = histogramOption(data, spec, style, base);
    else if (kind === 'scatter-matrix') result = scatterMatrix(data, spec, style, base);
    else if (kind === 'scatter-marginal') result = marginalOption(data, spec, style, base);
    else if (kind === 'multi-panel' || kind === 'inset') result = panelOption(data, spec, style, base);
    else if (kind === 'parallel') result = parallelOption(data, spec, style, base);
    else if (kind === 'network') result = networkOption(data, spec, style, base);
    else if (kind === 'word-cloud' || kind === 'bubble-cloud') result = cloudOption(data, spec, style, base);
    else if (kind === 'contour') result = contourOption(data, spec, style, base);
    else if (kind === 'vector2' || kind === 'compass') result = vectorOption(data, spec, style, base);
    else if (kind.startsWith('polar-')) result = polarOption(data, spec, style, base);
    else if (kind === 'pie') result = pieOption(data, spec, style, base);
    else if (kind === 'pareto') result = paretoOption(data, spec, style, base);
    else if (kind === 'pyramid') result = pyramidOption(data, spec, style, base);
    else if (kind === 'variable-bar') result = variableBar(data, spec, style, base);
    else result = ordinaryOption(data, spec, style, base);
    const graphics = [...(Array.isArray(result.graphic) ? result.graphic as Part[] : []), ...annotate(spec, style)];
    if (graphics.length) result.graphic = graphics;
    const footerHeight = Math.max(0, ...graphics.filter(g => g.type === 'text' && g.bottom !== undefined).map(g => String((g.style as Part)?.text ?? '').split('\n').length * Math.max(9, style.fontSize - 3) * 1.22));
    if (footerHeight && result.grid) {
        const grids = Array.isArray(result.grid) ? result.grid as Part[] : [result.grid as Part];
        if (grids.length === 1) grids[0].bottom = Math.max(Number(grids[0].bottom) || 69, 65 + footerHeight);
        else if (spec.kind === 'scatter-marginal') for (const grid of [grids[0], grids[2]]) grid.bottom = 65 + footerHeight;
    }
    return result as EChartsOption;
}

function ordinaryOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const kind = spec.kind, bars = ['bar', 'stacked-bar', 'error-bar'].includes(kind), horizontal = !!spec.horizontal;
    const maxSize = Math.max(0, ...data.points.map(p => p.size ?? 0));
    const series: (Part | CustomSeriesOption)[] = [];
    const stacked = !!(spec.stacked || kind === 'stacked-bar'), totals = new Map<string, number>();
    data.series.forEach((s, i) => {
        if (kind === 'confidence' || kind === 'error-line') if (s.points.some(p => p.lower !== undefined)) series.push(interval(s, i, style));
        if (kind === 'scatter' || kind === 'bubble') series.push(scatterSeries(s, spec, style, i, maxSize));
        else if (kind === 'bar' && spec.overlaid) {
            series.push({ type: 'custom', name: s.name, data: s.points.map(p => [p.x, p.y]), encode: { x: 0, y: 1 }, renderItem: (_, api) => { const a = api.coord([api.value(0), 0]), b = api.coord([api.value(0), api.value(1)]), band = (api.size!([1, 0]) as number[])[0], width = band * Math.max(.2, .75 - i * .22); return { type: 'rect', shape: { x: a[0] - width / 2, y: Math.min(a[1], b[1]), width, height: Math.abs(a[1] - b[1]) }, style: { fill: colorAt(style, i), opacity: .78, stroke: '#fff', lineWidth: .5 } }; } } as CustomSeriesOption);
        } else if (kind === 'stem') {
            series.push({ type: 'custom', name: s.name, data: s.points.map(p => [p.x, p.y]), encode: { x: 0, y: 1 }, renderItem: (_, api) => { const a = api.coord([api.value(0), 0]), b = api.coord([api.value(0), api.value(1)]); return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: colorAt(style, i), lineWidth: 1.5 } }, { type: 'circle', shape: { cx: b[0], cy: b[1], r: 4 }, style: { fill: colorAt(style, i) } }] }; } } as CustomSeriesOption);
        } else {
            const dual = kind === 'dual-axis', type = dual ? spec.dualMode === 'bar' ? 'bar' : spec.dualMode === 'mixed' && i === 0 ? 'bar' : 'line' : bars ? 'bar' : 'line';
            // Put the value dimension first when stacking: ECharts otherwise stacks numeric X.
            const valueFirst = horizontal || stacked;
            series.push({ type, name: s.name, data: s.points.map(p => ({ value: valueFirst ? [p.y, p.x] : [p.x, p.y], name: p.label ?? String(p.y) })), encode: horizontal ? { x: 0, y: 1 } : stacked ? { x: 1, y: 0 } : { x: 0, y: 1 }, ...(dual ? { yAxisIndex: i === 0 ? 0 : 1 } : {}), stack: stacked ? spec.grouped ? s.points[0]?.group ?? 'total' : 'total' : undefined, barCategoryGap: '30%', barGap: '0%', step: kind === 'step' ? 'end' : undefined, symbol: 'circle', symbolSize: 5, showSymbol: s.points.length < 70,
                lineStyle: { color: colorAt(style, i), width: 2 }, itemStyle: { color: spec.gradient ? gradient(colorAt(style, i), horizontal) : colorAt(style, i), borderColor: '#fff', borderWidth: type === 'bar' ? .5 : 0 }, ...(kind === 'area' || spec.filled && !['confidence', 'error-line'].includes(kind) ? { areaStyle: { color: spec.gradient ? gradient(colorAt(style, i)) : colorAt(style, i), opacity: .3 } } : {}), label: { show: spec.labels || style.showValues, position: horizontal ? 'right' : 'top', formatter: (p: { value: number[] }) => fmt(Number(p.value[valueFirst ? 0 : 1])), fontFamily: style.fontFamily, fontSize: style.fontSize - 2 } });
        }
        let errorSeries = s;
        if (stacked) errorSeries = { ...s, points: s.points.map(p => { const key = JSON.stringify([spec.grouped ? p.group : 'total', p.x]), end = (totals.get(key) ?? 0) + Number(p.y); totals.set(key, end); return { ...p, y: end }; }) };
        if (s.points.some(p => p.error !== undefined)) series.push(errors(errorSeries, i, style, horizontal, 0, !stacked && bars && data.series.length > 1 ? (i - (data.series.length - 1) / 2) * .7 / data.series.length : 0));
    });
    const result: Part = { ...base, series };
    if (horizontal) { result.xAxis = axis(style, style.yLabel, spec.logX || spec.logY ? 'log' : 'value'); result.yAxis = axis(style, style.xLabel, 'category', { data: unique(data.points.map(p => String(p.x))) }); }
    if (kind === 'dual-axis') {
        result.yAxis = [axis(style, style.yLabel, spec.logY ? 'log' : 'value', { ...(spec.dualMode !== 'line' && !spec.logY ? { min: 0 } : {}) }), axis(style, style.secondaryYLabel, 'value', { position: 'right', splitLine: { show: false }, ...(spec.dualMode === 'bar' ? { min: 0 } : {}) })];
        result.grid = { ...(base.grid as Part), right: 85 };
        if (spec.dualMode !== 'line' && data.points.every(p => typeof p.x === 'number')) {
            const coordinates = unique(data.points.map(p => Number(p.x))).sort((a, b) => a - b), spacing = coordinates.length > 1 ? Math.min(...coordinates.slice(1).map((x, i) => x - coordinates[i])) : 1;
            result.xAxis = axis(style, style.xLabel, 'value', { min: coordinates[0] - spacing * .65, max: coordinates.at(-1)! + spacing * .65, splitNumber: Math.min(8, coordinates.length) });
        }
    }
    if (spec.colorByValue && ['scatter', 'bubble'].includes(kind)) { result.visualMap = valueMap(data.points.map(p => p.color!), series.map((_, i) => i), style); result.grid = { ...(base.grid as Part), right: 128 }; }
    if (kind === 'bubble') { result.graphic = sizeLegend(data, style); result.grid = { ...(result.grid as Part), right: spec.colorByValue ? 150 : 118 }; }
    if (spec.annotation === 'line' || spec.annotation === 'band') {
        const first = series.find(s => s.type === 'line' || s.type === 'bar' || s.type === 'scatter') as Part | undefined;
        if (first) {
            if (spec.annotation === 'line') first.markLine = { silent: true, symbol: 'none', label: { formatter: style.annotationText, position: 'insideMiddleBottom', fontFamily: style.fontFamily, fontSize: Math.max(10, style.fontSize - 2), padding: 4, backgroundColor: '#ffffffcc' }, lineStyle: { color: '#596d80', type: 'dashed' }, data: [{ xAxis: style.annotationX }] };
            else first.markArea = { silent: true, itemStyle: { color: '#b3c6d833' }, label: { formatter: style.annotationText, position: 'insideBottom', fontFamily: style.fontFamily, fontSize: Math.max(10, style.fontSize - 2), padding: 4, backgroundColor: '#ffffffcc' }, data: [[{ xAxis: style.annotationX }, { xAxis: style.annotationX + (extent(data.points.map(p => Number(p.x)))[1] - extent(data.points.map(p => Number(p.x)))[0]) * .15 }]] };
        }
    }
    return result;
}

function matrixOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const m = data.matrix!, bubbles = spec.kind === 'bubble-matrix';
    const max = Math.max(0, ...m.cells.map(c => c.size ?? 0));
    const values = m.cells.map(c => [c.xi, c.yi, c.size ?? 0, c.value]);
    const result: Part = { ...base, legend: undefined, grid: { left: 77, right: bubbles ? 158 : 96, top: 66, bottom: 70, containLabel: true },
        xAxis: axis(style, style.xLabel, 'category', { data: m.xs, splitArea: { show: bubbles, areaStyle: { color: ['#fff', '#f8fafb'] } } }),
        yAxis: axis(style, style.yLabel, 'category', { data: m.ys, splitArea: { show: bubbles } }),
        visualMap: valueMap(m.cells.map(c => c.value), [0], style, bubbles ? 3 : 2, data.mapping.color === undefined ? '数值' : data.table.columns[data.mapping.color]),
        series: [bubbles ? { type: 'scatter', name: 'Size / Color', data: values, encode: { x: 0, y: 1, tooltip: [2, 3] }, symbolSize: (v: number[]) => max > 0 ? Math.min(52, (style.width - 220) / m.xs.length * .85, (style.height - 150) / m.ys.length * .85) * Math.sqrt(v[2] / max) : 0, itemStyle: { opacity: .8 }, label: { show: spec.labels || style.showValues, formatter: (p: { value: number[] }) => fmt(p.value[2]), fontSize: style.fontSize - 2 } } : { type: 'heatmap', name: '矩阵数值', data: m.cells.map(c => [c.xi, c.yi, c.value]), itemStyle: { borderColor: '#fff', borderWidth: .5 }, label: { show: spec.labels || style.showValues, fontSize: style.fontSize - 2 } }], ...(bubbles ? { graphic: sizeLegend(data, style) } : {}) };
    if (!bubbles && [58, 59].includes(spec.issue) && [...m.xs, ...m.ys].every(v => typeof v === 'number')) {
        const bounds = (v: number[], i: number) => [i ? (v[i - 1] + v[i]) / 2 : v[i] - ((v[1] ?? v[i] + 1) - v[i]) / 2, i < v.length - 1 ? (v[i] + v[i + 1]) / 2 : v[i] + (v[i] - (v[i - 1] ?? v[i] - 1)) / 2];
        const xs = m.xs as number[], ys = m.ys as number[];
        const cells = m.cells.map(c => [...bounds(xs, c.xi), ...bounds(ys, c.yi), c.value]);
        const lookup = new Map(m.cells.map(c => [`${c.xi}:${c.yi}`, c.value])), range = extent(m.cells.map(c => c.value));
        const shade = (value: number, xi: number, yi: number) => {
            const left = lookup.get(`${xi - 1}:${yi}`) ?? value, right = lookup.get(`${xi + 1}:${yi}`) ?? value, low = lookup.get(`${xi}:${yi - 1}`) ?? value, high = lookup.get(`${xi}:${yi + 1}`) ?? value;
            const dx = (right - left) / ((xs[Math.min(xs.length - 1, xi + 1)] - xs[Math.max(0, xi - 1)]) || 1), dy = (high - low) / ((ys[Math.min(ys.length - 1, yi + 1)] - ys[Math.max(0, yi - 1)]) || 1), magnitude = Math.hypot(dx, dy, 1), intensity = .56 + .44 * Math.max(0, (-dx * .35 - dy * .45 + .82) / magnitude);
            const raw = scalarColor(value, range[0], range[1]).match(/\d+/g)!.map(Number);
            const tone = (factor: number) => `rgb(${raw.map(c => Math.min(255, Math.round(c * factor))).join(',')})`;
            return { type: 'linear' as const, x: 0, y: 1, x2: 1, y2: 0, colorStops: [{ offset: 0, color: tone(intensity * .91) }, { offset: 1, color: tone(Math.min(1.05, intensity * 1.09)) }] };
        };
        const custom: CustomSeriesOption = { type: 'custom', name: '数值坐标矩阵', data: cells, encode: { x: [0, 1], y: [2, 3], tooltip: 4 }, renderItem: (params, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(3)]), cell = m.cells[params.dataIndex]; return { type: 'rect', shape: { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }, style: { fill: spec.lighting ? shade(cell.value, cell.xi, cell.yi) : String(api.visual('color')), stroke: spec.lighting ? 'none' : '#fff', lineWidth: spec.lighting ? 0 : .5 } }; } };
        result.xAxis = axis(style, style.xLabel); result.yAxis = axis(style, style.yLabel); result.series = [custom]; result.visualMap = valueMap(cells.map(c => c[4]), [0], style, 4);
        if (spec.lighting) result.graphic = [note(style, '颜色表示真实标量；亮度来自相邻网格梯度的确定性光照；不修改输入值')];
    }
    return result;
}

function boxOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const samples = data.samples!, categories = unique(samples.map(s => s.category)), groups = unique(samples.map(s => s.group));
    const custom: CustomSeriesOption[] = groups.map((group, gi) => ({ type: 'custom', name: group, data: samples.filter(s => s.group === group).map(s => [categories.indexOf(s.category), Math.min(...s.values), Math.max(...s.values)]), encode: { x: 0, y: [1, 2] },
        renderItem: (params, api) => {
            const sample = samples.filter(s => s.group === group)[params.dataIndex], values = sample.values, box = sampleBox(values), band = (api.size!([1, 0]) as number[])[0], step = band * .72 / groups.length;
            const cx = api.coord([categories.indexOf(sample.category), 0])[0] + (gi - (groups.length - 1) / 2) * step, half = Math.min(26, step * .35), y = (v: number) => api.coord([categories.indexOf(sample.category), v])[1], color = colorAt(style, gi);
            const children: Part[] = [];
            if (spec.kind === 'box') {
                children.push({ type: 'line', shape: { x1: cx, x2: cx, y1: y(box[0]), y2: y(box[4]) }, style: { stroke: color, lineWidth: 1.2 } });
                if (spec.notched) {
                    const width = 1.57 * (box[3] - box[1]) / Math.sqrt(values.length), lo = box[2] - width, hi = box[2] + width;
                    children.push({ type: 'polygon', shape: { points: [[cx - half, y(box[3])], [cx + half, y(box[3])], [cx + half, y(hi)], [cx + half * .5, y(box[2])], [cx + half, y(lo)], [cx + half, y(box[1])], [cx - half, y(box[1])], [cx - half, y(lo)], [cx - half * .5, y(box[2])], [cx - half, y(hi)]] }, style: { fill: `${color}35`, stroke: color, lineWidth: 1.5 } });
                } else children.push({ type: 'rect', shape: { x: cx - half, y: y(box[3]), width: half * 2, height: Math.max(.5, y(box[1]) - y(box[3])) }, style: { fill: spec.filled ? `${color}65` : '#fff', stroke: color, lineWidth: 1.5 } });
                [box[0], box[2], box[4]].forEach(v => children.push({ type: 'line', shape: { x1: cx - half, x2: cx + half, y1: y(v), y2: y(v) }, style: { stroke: color, lineWidth: 1.5 } }));
            }
            values.forEach((v, i) => children.push({ type: 'circle', shape: { cx: cx + (((i * 37 + gi * 13) % 101) / 100 - .5) * half * 1.4, cy: y(v), r: spec.kind === 'jitter' ? 3.5 : 2.4 }, style: { fill: color, opacity: .65 } }));
            return { type: 'group', children: children as never };
        } }));
    const result: Part = { ...base, title: title(style), legend: groups.length > 1 ? { data: groups, top: 43, left: 'center', selectedMode: false } : undefined,
        xAxis: axis(style, style.xLabel, 'category', { data: categories }), series: custom,
        graphic: [note(style, spec.kind === 'jitter' ? '横坐标为分类展示；确定性偏移仅防重叠；每个点对应一个真实观测' : spec.notched ? '缺口近似：median ± 1.57 IQR / √n；原始样本全保留；须线 = 1.5 IQR 内观测' : '原始样本全保留；Q1 / 中位数 / Q3；须线 = 1.5 IQR 内观测')] };
    return result;
}

function binValues(values: number[], lo: number, hi: number, count: number) {
    const width = (hi - lo) / count;
    const bins = Array.from({ length: count }, (_, i) => ({ lo: lo + i * width, hi: lo + (i + 1) * width, count: 0 }));
    values.forEach(v => bins[Math.min(count - 1, Math.max(0, Math.floor((v - lo) / width)))].count++);
    return bins;
}
function histogramOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const groups = data.samples!, raw = groups.flatMap(s => s.values), count = Math.max(1, Math.min(100, Math.round(style.bins))), range = extent(raw), lo = range[0] === range[1] ? range[0] - .5 : range[0], hi = range[0] === range[1] ? range[1] + .5 : range[1];
    if (spec.kind === 'histogram2') {
        const xr = extent(data.points.map(p => Number(p.x))), yr = extent(data.points.map(p => Number(p.y))), xlo = xr[0] === xr[1] ? xr[0] - .5 : xr[0], xhi = xr[0] === xr[1] ? xr[1] + .5 : xr[1], ylo = yr[0] === yr[1] ? yr[0] - .5 : yr[0], yhi = yr[0] === yr[1] ? yr[1] + .5 : yr[1], dx = (xhi - xlo) / count, dy = (yhi - ylo) / count;
        const bins = Array.from({ length: count * count }, (_, i) => [xlo + (i % count) * dx, xlo + (i % count + 1) * dx, ylo + Math.floor(i / count) * dy, ylo + (Math.floor(i / count) + 1) * dy, 0]);
        data.points.forEach(p => { const xi = Math.max(0, Math.min(count - 1, Math.floor((Number(p.x) - xlo) / dx))), yi = Math.max(0, Math.min(count - 1, Math.floor((Number(p.y) - ylo) / dy))); bins[yi * count + xi][4]++; });
        const custom: CustomSeriesOption = { type: 'custom', name: 'XY 样本频数', data: bins, encode: { x: [0, 1], y: [2, 3], tooltip: 4 }, renderItem: (_, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(3)]); return { type: 'rect', shape: { x: a[0], y: b[1], width: Math.max(.1, b[0] - a[0]), height: Math.max(.1, a[1] - b[1]) }, style: { fill: String(api.visual('color')), stroke: '#fff', lineWidth: .3 } }; } };
        return { ...base, legend: undefined, xAxis: axis(style, style.xLabel, 'value', { min: xlo, max: xhi }), yAxis: axis(style, style.yLabel, 'value', { min: ylo, max: yhi }), grid: { ...(base.grid as Part), right: 100 }, series: [custom], visualMap: valueMap(bins.map(b => b[4]), [0], style, 4, '样本频数'), graphic: [note(style, `XY 真实观测 n=${data.points.length}；两个轴各 ${count} 个等宽区间；频数总和=${bins.reduce((n, b) => n + b[4], 0)}；边界末区间含右端点`)] };
    }
    if (spec.kind === 'polar-histogram') {
        const cycle = Math.PI * 2;
        const series = groups.map((s, i) => { const bins = binValues(s.values.map(v => ((v % cycle) + cycle) % cycle), 0, cycle, count); return { type: 'bar', coordinateSystem: 'polar', name: s.name, data: bins.map((b, bi) => ({ value: b.count, name: `[${fmt(b.lo)}, ${fmt(b.hi)}${bi === count - 1 ? ']' : ')'} rad` })), stack: spec.stacked ? 'total' : undefined, itemStyle: { color: colorAt(style, i), opacity: .65 }, label: { show: style.showValues } }; });
        return { ...base, xAxis: undefined, yAxis: undefined, grid: undefined, polar: { center: ['50%', '55%'], radius: '66%' }, angleAxis: { type: 'category', data: Array.from({ length: count }, (_, i) => fmt((i + .5) * cycle / count)), startAngle: 90, axisLabel: { fontSize: style.fontSize - 2, interval: 'auto', hideOverlap: true } }, radiusAxis: { type: 'value', name: '', splitNumber: 4, axisLabel: { fontSize: style.fontSize - 2 } }, series, graphic: [note(style, `角标为区间中点（rad），径向为样本频数；2π 周期；${count} 个等宽区间；n=${raw.length}`)] };
    }
    const series: CustomSeriesOption[] = groups.map((s, si) => ({ type: 'custom', name: s.name, data: binValues(s.values, lo, hi, count).map(b => [b.lo, b.hi, b.count]), encode: { x: [0, 1], y: 2 },
        renderItem: (_, api) => { const a = api.coord([api.value(0), 0]), b = api.coord([api.value(1), api.value(2)]), grouped = spec.kind === 'histogram2' && !spec.filled, width = b[0] - a[0], groupWidth = grouped ? width / groups.length : width; return { type: 'rect', shape: { x: a[0] + (grouped ? si * groupWidth : 0), y: b[1], width: Math.max(.3, groupWidth), height: Math.max(0, a[1] - b[1]) }, style: { fill: spec.gradient ? gradient(colorAt(style, si)) : colorAt(style, si), stroke: '#fff', lineWidth: .5, opacity: groups.length > 1 && !grouped ? .5 : .85 } }; } }));
    return { ...base, xAxis: axis(style, style.xLabel, spec.logX ? 'log' : 'value', { min: lo, max: hi, axisLabel: { formatter: (v: number) => fmt(v), fontSize: style.fontSize - 1, hideOverlap: true }, axisPointer: { label: { formatter: (p: { value: number }) => fmt(p.value) } } }), yAxis: axis(style, '样本数'), series, graphic: [note(style, `${groups.map(s => `${s.name}: n=${s.values.length}`).join('；')}；${count} 个等宽区间；末区间含右端点`)] };
}

function pieOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const points = data.points;
    return { ...base, grid: undefined, xAxis: undefined, yAxis: undefined, legend: { top: 46, left: 'center', data: unique(points.map(p => String(p.x))), selectedMode: false, textStyle: { fontSize: style.fontSize - 1 } },
        series: [{ type: 'pie', name: style.yLabel, radius: spec.filled ? ['30%', '61%'] : '60%', center: ['50%', '57%'], avoidLabelOverlap: true, selectedOffset: 14, data: points.map((p, i) => ({ name: String(p.x), value: Number(p.y), selected: spec.exploded && i === 0 })), label: { show: true, formatter: '{b}: {c}\n({d}%)', fontFamily: style.fontFamily, fontSize: style.fontSize - 2 }, labelLine: { length: 12, length2: 9 }, itemStyle: { borderColor: '#fff', borderWidth: 1 } }] };
}
function paretoOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const points = [...data.points].sort((a, b) => Number(b.y) - Number(a.y)), total = points.reduce((n, p) => n + Number(p.y), 0); let accumulated = 0;
    return { ...base, legend: { data: ['数值', '累计百分比'], top: 43, left: 'center', selectedMode: false }, xAxis: axis(style, style.xLabel, 'category', { data: points.map(p => p.x) }), yAxis: [axis(style, style.yLabel), axis(style, '累计 (%)', 'value', { min: 0, max: 100, position: 'right' })], series: [{ type: 'bar', name: '数值', data: points.map(p => Number(p.y)), itemStyle: { color: colorAt(style, 0) }, label: { show: spec.labels || style.showValues, position: 'top' } }, { type: 'line', name: '累计百分比', yAxisIndex: 1, data: points.map(p => { accumulated += Number(p.y); return accumulated / total * 100; }), itemStyle: { color: colorAt(style, 1) }, symbolSize: 6 }], graphic: [note(style, '按实际数值降序排列；累计比例 = 累计数值 / 总值 × 100%')] };
}
function pyramidOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const categories = unique(data.points.map(p => String(p.x)));
    return { ...base, xAxis: axis(style, style.yLabel, 'value', { axisLabel: { formatter: (v: number) => fmt(Math.abs(v)), fontSize: style.fontSize - 1 } }), yAxis: axis(style, style.xLabel, 'category', { data: categories }), series: data.series.map((s, i) => ({ type: 'bar', name: s.name, stack: i % 2 ? 'right' : 'left', data: s.points.map(p => [Number(p.y) * (i % 2 ? 1 : -1), p.x]), itemStyle: { color: colorAt(style, i) }, label: { show: spec.labels || style.showValues, position: i % 2 ? 'right' : 'left', formatter: (p: { value: [number, string] }) => fmt(Math.abs(p.value[0])) } })), graphic: [note(style, '左侧系列按镜像方向显示；轴标签和数值保留原始非负量')] };
}
function variableBar(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const series: CustomSeriesOption[] = data.series.map((s, i) => ({ type: 'custom', name: s.name, data: s.points.map(p => [p.x, p.y, Number(p.x) + p.size!, p.size!]), encode: { x: [0, 2], y: 1, tooltip: [0, 1, 3] }, renderItem: (_, api) => { const a = api.coord([api.value(0), 0]), b = api.coord([api.value(2), api.value(1)]); return { type: 'rect', shape: { x: a[0], y: Math.min(a[1], b[1]), width: Math.max(0, b[0] - a[0]), height: Math.abs(a[1] - b[1]) }, style: { fill: spec.gradient ? gradient(colorAt(style, i)) : colorAt(style, i), stroke: '#fff', lineWidth: .7, opacity: .82 } }; } }));
    return { ...base, xAxis: axis(style, style.xLabel, 'value'), series, graphic: [note(style, '每个矩形：左边界 X，宽度 Size，高度 Y；未按类别平均宽度')] };
}

function panelOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const inset = spec.kind === 'inset', rowsOnly = spec.issue === 31, charts = spec.panelCharts, count = inset ? 2 : charts?.length ?? data.series.length;
    const cols = inset || rowsOnly ? 1 : charts ? 2 : Math.min(3, Math.ceil(Math.sqrt(count))), rows = Math.ceil(count / cols), compact = spec.panelLayout === 'compact';
    const grids: Part[] = [], xs: Part[] = [], ys: Part[] = [], series: (Part | CustomSeriesOption)[] = [], titles: Part[] = [];
    for (let i = 0; i < count; i++) {
        const s = data.series[inset ? 0 : Math.min(i, data.series.length - 1)], row = Math.floor(i / cols), col = i % cols, panelChart = charts?.[i] ?? 'line', spanning = spec.panelLayout === 'bottom-span' && i === 2;
        const left = inset ? i ? '63%' : 78 : `${8 + col * 88 / cols}%`, top = inset ? i ? '19%' : 88 : `${17 + row * 68 / rows}%`, width = inset ? i ? '28%' : '81%' : spanning ? '80%' : `${(compact ? 82 : 78) / cols}%`, height = inset ? i ? '28%' : '65%' : `${(compact ? 58 : 55) / rows}%`;
        grids.push({ left, top, width, height, containLabel: true, show: !!(inset && i), backgroundColor: '#fff', borderColor: '#71808c', borderWidth: inset && i ? 1 : 0, z: inset && i ? 15 : 0 });
        const categorical = ['error-bar', 'stacked-bar'].includes(panelChart) || s.points.some(p => typeof p.x === 'string');
        let bounds: Part = {};
        if (inset && i) {
            const range = extent(s.points.map(p => Number(p.x))), lo = Number.isFinite(style.annotationX) && style.annotationX > range[0] && style.annotationX < range[1] ? style.annotationX : range[0] + (range[1] - range[0]) * .35, hi = lo + (range[1] - range[0]) * .2;
            const values = s.points.filter(p => Number(p.x) >= lo && Number(p.x) <= hi).map(p => Number(p.y));
            bounds = { min: lo, max: hi };
            const yr = extent(values.length ? values : s.points.map(p => Number(p.y))), pad = (yr[1] - yr[0] || 1) * .1;
            ys.push(axis(style, '', 'value', { gridIndex: i, min: yr[0] - pad, max: yr[1] + pad, scale: true, splitNumber: 2, axisLabel: { formatter: (v: number) => fmt(v), fontSize: Math.max(8, style.fontSize - 4), hideOverlap: true }, z: 16 }));
        } else ys.push(axis(style, rowsOnly ? '' : inset ? style.yLabel : s.name, spec.logY ? 'log' : 'value', { gridIndex: i, scale: !['error-bar', 'stacked-bar', 'area'].includes(panelChart), ...(['error-bar', 'stacked-bar', 'area'].includes(panelChart) ? { min: 0 } : {}), show: panelChart !== 'pie', splitNumber: rowsOnly ? 2 : 3, nameGap: 30, axisLabel: { fontSize: Math.max(9, style.fontSize - (rowsOnly ? 4 : 2)), hideOverlap: true } }));
        xs.push(axis(style, inset && i || rowsOnly && i < count - 1 ? '' : style.xLabel, categorical ? 'category' : spec.timeX ? 'time' : spec.logX ? 'log' : 'value', { gridIndex: i, ...(categorical ? { data: unique(s.points.map(p => String(p.x))) } : {}), ...bounds, show: panelChart !== 'pie', splitNumber: inset && i ? 2 : rowsOnly ? 3 : 4, z: inset && i ? 16 : 0, nameGap: inset && i ? 15 : 25, axisTick: { show: !rowsOnly || i === count - 1 }, axisLabel: { show: !rowsOnly || i === count - 1, ...(inset && i ? { formatter: (v: number) => fmt(v) } : {}), fontSize: Math.max(8, style.fontSize - (inset && i || rowsOnly ? 4 : 2)), hideOverlap: true, interval: rowsOnly ? 'auto' : undefined } }));
        if (panelChart === 'pie') {
            const w = style.width * Number(String(width).replace('%', '')) / 100, h = style.height * Number(String(height).replace('%', '')) / 100, lx = style.width * Number(String(left).replace('%', '')) / 100, ty = style.height * Number(String(top).replace('%', '')) / 100;
            series.push({ type: 'pie', name: s.name, center: [lx + w / 2, ty + h / 2], radius: Math.min(w, h) * .33, selectedOffset: 5, avoidLabelOverlap: true, data: s.points.map((p, pi) => ({ name: String(p.x), value: Number(p.y), selected: spec.issue === 97 && pi === 0 })), label: { show: true, formatter: '{b}', fontSize: Math.max(8, style.fontSize - 4), fontFamily: style.fontFamily }, labelLine: { length: 5, length2: 4 }, itemStyle: { borderColor: '#fff', borderWidth: .5 } });
            titles.push({ text: `(${String.fromCharCode(97 + i)}) ${s.name} · pie`, left, top: `${12 + row * 68 / rows}%`, textStyle: { fontSize: style.fontSize - 1, fontFamily: style.fontFamily, fontWeight: 'normal' } });
            continue;
        }
        const visible = inset && i || panelChart === 'stacked-bar' ? data.series : panelChart === 'area' ? data.series.slice(Math.min(2, data.series.length - 1)) : [s];
        visible.forEach((item, j) => {
            const ci = inset || ['stacked-bar', 'area'].includes(panelChart) ? j : i, bar = ['error-bar', 'stacked-bar'].includes(panelChart), stack = panelChart === 'stacked-bar';
            if (item.points.some(p => p.lower !== undefined)) series.push(interval(item, ci, style, i));
            series.push({ type: bar ? 'bar' : 'line', name: item.name, xAxisIndex: i, yAxisIndex: i, data: item.points.map(p => stack ? [p.y, String(p.x)] : [categorical ? String(p.x) : p.x, p.y]), encode: stack ? { x: 1, y: 0 } : { x: 0, y: 1 }, stack: stack ? `panel-${i}` : undefined, ...(panelChart === 'area' ? { areaStyle: { color: colorAt(style, ci), opacity: .3 } } : {}), symbolSize: inset && i ? 3 : 5, clip: true, z: inset && i ? 20 : 2, itemStyle: { color: colorAt(style, ci) }, lineStyle: { color: colorAt(style, ci), width: 1.8 } });
            if (panelChart === 'error-bar' && item.points.some(p => p.error !== undefined)) series.push(errors({ ...item, points: item.points.map(p => ({ ...p, x: String(p.x) })) }, ci, style, false, i));
            else if (!charts && !stack && item.points.some(p => p.error !== undefined)) series.push(errors(item, ci, style, false, i));
        });
        if (!inset) titles.push({ text: `(${String.fromCharCode(97 + i)}) ${s.name}`, left, top: `${12 + row * 68 / rows}%`, textStyle: { fontSize: style.fontSize - 1, fontFamily: style.fontFamily, fontWeight: 'normal' } });
    }
    if (inset && data.series.length > 1) {
        data.series.slice(1).forEach((s, i) => series.push({ type: 'line', name: s.name, data: s.points.map(p => [p.x, p.y]), symbolSize: 5, itemStyle: { color: colorAt(style, i + 1) } }));
    }
    return { ...base, title: [title(style), ...titles], grid: grids, xAxis: xs, yAxis: ys, series, graphic: inset ? [note(style, '插图放大原始坐标区间；主图和插图复用同一观测')] : undefined };
}

function scatterMatrix(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const columns = unique([data.mapping.x, ...data.mapping.ys]), n = columns.length, groups = data.mapping.group === undefined ? [data.table.columns[data.mapping.ys[0]]] : unique(data.points.map(p => p.group!));
    const grids: Part[] = [], xs: Part[] = [], ys: Part[] = [], series: Part[] = [];
    const low = 9, top = 18, width = 84 / n, height = 70 / n;
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
        const index = row * n + col, xc = columns[col], yc = columns[row];
        grids.push({ left: `${low + col * width}%`, top: `${top + row * height}%`, width: `${width - 2}%`, height: `${height - 2}%`, containLabel: false });
        xs.push(axis(style, row === n - 1 ? data.table.columns[xc] : '', spec.logX ? 'log' : 'value', { gridIndex: index, scale: true, splitNumber: 2, nameGap: 25, nameTextStyle: { fontSize: Math.max(10, style.fontSize - 2), fontFamily: style.fontFamily }, axisLabel: { show: row === n - 1, fontSize: Math.max(8, style.fontSize - 4), formatter: (v: number) => fmt(v), hideOverlap: true }, splitLine: { show: false }, axisTick: { show: row === n - 1 } }));
        ys.push(axis(style, col === 0 ? data.table.columns[yc] : '', spec.logY ? 'log' : 'value', { gridIndex: index, scale: true, splitNumber: 2, nameGap: 30, nameTextStyle: { fontSize: Math.max(10, style.fontSize - 2), fontFamily: style.fontFamily }, axisLabel: { show: col === 0, fontSize: Math.max(8, style.fontSize - 4), formatter: (v: number) => fmt(v), hideOverlap: true }, splitLine: { show: false }, axisTick: { show: col === 0 } }));
        if (row === col) {
            const values = data.table.rows.map(r => numericCell(r[xc])).filter((v): v is number => v !== null), range = extent(values), bins = binValues(values, range[0] === range[1] ? range[0] - .5 : range[0], range[0] === range[1] ? range[1] + .5 : range[1], Math.min(12, style.bins));
            ys[index] = { ...ys[index], name: col === 0 ? '频数' : '', min: 0, max: Math.max(1, ...bins.map(b => b.count)) };
            series.push({ type: 'bar', name: '样本频数', xAxisIndex: index, yAxisIndex: index, data: bins.map(b => [(b.lo + b.hi) / 2, b.count]), barWidth: '70%', itemStyle: { color: '#739baa' }, silent: true });
        } else {
            groups.forEach((group, gi) => {
                const points = data.table.rows.filter(r => data.mapping.group === undefined || String(r[data.mapping.group]).trim() === group).map(r => [numericCell(r[xc]), numericCell(r[yc])]).filter((v): v is [number, number] => v[0] !== null && v[1] !== null);
                series.push({ type: 'scatter', name: group, xAxisIndex: index, yAxisIndex: index, data: points, symbolSize: Math.max(2, 6 - n * .4), itemStyle: { color: colorAt(style, gi), opacity: .6 } });
            });
        }
    }
    return { ...base, legend: groups.length > 1 ? { data: groups, top: 42, left: 'center', selectedMode: false } : undefined, grid: grids, xAxis: xs, yAxis: ys, series, graphic: [note(style, '对角线：原始样本频数；每个非对角单元：两列实际观测的成对坐标')] };
}

function marginalOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const xr = extent(data.points.map(p => Number(p.x))), yr = extent(data.points.map(p => Number(p.y))), n = Math.max(1, Math.min(60, Math.round(style.bins)));
    const grids = [{ left: '11%', right: '25%', top: '36%', bottom: '14%', containLabel: true }, { left: '11%', right: '25%', top: '18%', height: '14%' }, { left: '78%', right: '6%', top: '36%', bottom: '14%' }];
    const xs = [axis(style, style.xLabel, 'value', { min: xr[0], max: xr[1] }), axis(style, '', 'value', { gridIndex: 1, min: xr[0], max: xr[1], axisLabel: { show: false } }), axis(style, '频数', 'value', { gridIndex: 2, nameGap: 25, axisLabel: { fontSize: style.fontSize - 3 } })];
    const ys = [axis(style, style.yLabel, 'value', { min: yr[0], max: yr[1] }), axis(style, '频数', 'value', { gridIndex: 1, nameGap: 32, axisLabel: { fontSize: style.fontSize - 3 } }), axis(style, '', 'value', { gridIndex: 2, min: yr[0], max: yr[1], axisLabel: { show: false } })];
    const series: (Part | CustomSeriesOption)[] = [];
    data.series.forEach((s, i) => {
        series.push(scatterSeries(s, spec, style, i, 0));
        [true, false].forEach(isX => {
            const range = isX ? xr : yr, bins = binValues(s.points.map(p => Number(isX ? p.x : p.y)), range[0] === range[1] ? range[0] - .5 : range[0], range[0] === range[1] ? range[1] + .5 : range[1], n), index = isX ? 1 : 2;
            series.push({ type: 'custom', name: s.name, xAxisIndex: index, yAxisIndex: index, data: bins.map(b => [b.lo, b.hi, b.count]), encode: isX ? { x: [0, 1], y: 2 } : { x: 2, y: [0, 1] }, renderItem: (_, api) => { const a = api.coord(isX ? [api.value(0), 0] : [0, api.value(0)]), b = api.coord(isX ? [api.value(1), api.value(2)] : [api.value(2), api.value(1)]); return { type: 'rect', shape: { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.max(.1, Math.abs(a[0] - b[0])), height: Math.max(.1, Math.abs(a[1] - b[1])) }, style: { fill: colorAt(style, i), opacity: .5, stroke: '#fff', lineWidth: .4 } }; } } as CustomSeriesOption);
        });
    });
    return { ...base, grid: grids, xAxis: xs, yAxis: ys, series, graphic: [note(style, '上方 / 右侧为 X / Y 原始观测的边际频数；所有组使用相同区间')] };
}

function parallelOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const columns = unique([data.mapping.x, ...data.mapping.ys]), names = unique(data.points.map(p => p.group ?? data.table.columns[data.mapping.ys[0]]));
    return { ...base, grid: undefined, xAxis: undefined, yAxis: undefined, legend: names.length > 1 ? { data: names, top: 44, left: 'center', selectedMode: false } : undefined,
        parallel: { left: 65, right: 55, top: 106, bottom: 66, parallelAxisDefault: { type: 'value', nameLocation: 'start', nameGap: 22, nameTextStyle: { fontFamily: style.fontFamily, fontSize: style.fontSize - 1 }, axisLabel: { fontSize: style.fontSize - 2 } } },
        parallelAxis: columns.map((c, dim) => ({ dim, name: data.table.columns[c], type: spec.logY ? 'log' : 'value' })),
        series: names.map((name, i) => ({ type: 'parallel', name, data: data.table.rows.filter(r => data.mapping.group === undefined || String(r[data.mapping.group]).trim() === name).map(r => columns.map(c => numericCell(r[c]))), lineStyle: { color: colorAt(style, i), width: 1.4, opacity: .5 } })), graphic: [note(style, '每条折线对应原表一行；各轴保持实际数值尺度；缺值保持 null，不填零')] };
}

function networkOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const edges = data.edges!, nodes = unique(edges.flatMap(e => [e.source, e.target])), maxWeight = Math.max(1, ...edges.map(e => e.weight));
    const range = extent(edges.map(e => e.weight));
    const degree = (name: string) => edges.reduce((n, e) => n + (e.source === name || e.target === name ? e.weight : 0), 0);
    return { ...base, legend: undefined, grid: undefined, xAxis: undefined, yAxis: undefined,
        series: [{ type: 'graph', name: '网络', layout: 'none', roam: false, coordinateSystem: undefined, left: '14%', right: '14%', top: '22%', bottom: '17%', symbolSize: 22, edgeSymbol: spec.directed ? ['none', 'arrow'] : ['none', 'none'], edgeSymbolSize: 8,
            data: nodes.map((name, i) => ({ name, x: Math.cos(i / nodes.length * Math.PI * 2) * 150, y: Math.sin(i / nodes.length * Math.PI * 2) * 150, value: degree(name), itemStyle: { color: colorAt(style, i) }, label: { position: 'right', fontSize: Math.max(9, style.fontSize - 2) } })),
            links: edges.map(e => ({ source: e.source, target: e.target, value: e.weight, lineStyle: { color: spec.colorByValue ? scalarColor(e.weight, range[0], range[1]) : '#8a9baa', width: .5 + e.weight / maxWeight * 4, opacity: .55, curveness: e.source === e.target ? .5 : .12 } })), label: { show: true, fontFamily: style.fontFamily }, edgeLabel: { show: spec.labels || style.showValues, formatter: '{c}', fontSize: style.fontSize - 3 }, emphasis: { focus: 'adjacency' } }], ...(spec.colorByValue ? { visualMap: valueMap(edges.map(e => e.weight), [], style, 0, 'Weight') } : {}), graphic: [note(style, `${nodes.length} 个节点；${edges.length} 条真实边；线宽 = 0.5 + 4 × Weight / 最大权重${spec.directed ? '；箭头为 Source → Target' : ''}`)] };
}

function polarOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const maxSize = Math.max(0, ...data.points.map(p => p.size ?? 0)), bubble = spec.kind === 'polar-bubble';
    const series = data.series.map((s, i) => ({ type: spec.kind === 'polar-line' ? 'line' : 'scatter', coordinateSystem: 'polar', name: s.name,
        data: s.points.map(p => ({ value: [p.y, ((Number(p.x) * 180 / Math.PI % 360) + 360) % 360, p.size ?? 0, p.color ?? Number(p.y)], name: p.label ?? `${p.x} rad; ${p.y}` })), encode: { radius: 0, angle: 1, tooltip: [1, 0, 2, 3] },
        symbolSize: bubble ? (v: number[]) => maxSize ? 42 * Math.sqrt(v[2] / maxSize) : 0 : 6,
        lineStyle: { color: colorAt(style, i), width: 2 }, itemStyle: { color: colorAt(style, i), opacity: .76 }, ...(spec.filled ? { areaStyle: { color: colorAt(style, i), opacity: .23 } } : {}), label: { show: spec.labels || style.showValues, formatter: (p: { name: string }) => p.name, fontSize: style.fontSize - 2 } }));
    return { ...base, grid: undefined, xAxis: undefined, yAxis: undefined, polar: { center: [bubble || spec.colorByValue ? '43%' : '50%', '56%'], radius: '64%' },
        angleAxis: { type: 'value', min: 0, max: 360, interval: 45, startAngle: 90, axisLabel: { formatter: (v: number) => fmt(v * Math.PI / 180), fontSize: style.fontSize - 1 }, splitLine: { show: true, lineStyle: { color: '#e4e9ed' } } }, radiusAxis: { type: spec.logY ? 'log' : 'value', name: style.yLabel, axisLabel: { fontSize: style.fontSize - 2 }, splitLine: { show: true, lineStyle: { color: '#e4e9ed' } } },
        series, ...(spec.colorByValue ? { visualMap: valueMap(data.points.map(p => p.color!), series.map((_, i) => i), style) } : {}), graphic: [...(bubble ? sizeLegend(data, style, 42) : []), note(style, 'X 为角度（rad，2π 周期）；Y 为非负半径；按输入顺序连接真实观测')] };
}

function vectorOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const compass = spec.kind === 'compass';
    if (compass) {
        const max = Math.max(1, ...data.points.map(p => Math.hypot(p.u!, p.v!))) * 1.08;
        const series: CustomSeriesOption[] = data.series.map((s, i) => ({ type: 'custom', name: s.name, coordinateSystem: 'polar', data: s.points.map(p => [Math.hypot(p.u!, p.v!), ((Math.atan2(p.v!, p.u!) * 180 / Math.PI) + 360) % 360, p.color ?? Math.hypot(p.u!, p.v!), p.u!, p.v!]), encode: { radius: 0, angle: 1, tooltip: [3, 4, 0, 1] },
            renderItem: (_, api) => { const a = api.coord([0, 0]), b = api.coord([api.value(0), api.value(1)]), angle = Math.atan2(b[1] - a[1], b[0] - a[0]), head = Math.min(8, Math.hypot(b[0] - a[0], b[1] - a[1]) * .3), color = spec.colorByValue ? String(api.visual('color')) : colorAt(style, i); return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: color, lineWidth: 1.8 } }, { type: 'polygon', shape: { points: [b, [b[0] - head * Math.cos(angle - .45), b[1] - head * Math.sin(angle - .45)], [b[0] - head * Math.cos(angle + .45), b[1] - head * Math.sin(angle + .45)]] }, style: { fill: color } }] }; } }));
        return { ...base, grid: undefined, xAxis: undefined, yAxis: undefined, polar: { center: ['50%', '55%'], radius: '64%' }, angleAxis: { type: 'value', min: 0, max: 360, interval: 45, startAngle: 0, clockwise: false, axisLabel: { formatter: '{value}°', fontSize: style.fontSize - 1 }, splitLine: { show: true, lineStyle: { color: '#dce3e9' } } }, radiusAxis: { type: 'value', min: 0, max, splitNumber: 4, splitLine: { show: true, lineStyle: { color: '#dce3e9' } }, axisLabel: { fontSize: style.fontSize - 2 } }, series, ...(spec.colorByValue ? { visualMap: valueMap(data.points.map(p => p.color!), series.map((_, i) => i), style, 2) } : {}), graphic: [note(style, '方向 = atan2(V, U)；半径 = √(U² + V²)；每支箭头以原点为起点')] };
    }
    const series: CustomSeriesOption[] = data.series.map((s, i) => ({ type: 'custom', name: s.name,
        data: s.points.map(p => { const x = compass ? 0 : Number(p.x), y = compass ? 0 : Number(p.y); return [x, y, x + p.u!, y + p.v!, p.color ?? Math.hypot(p.u!, p.v!), p.u!, p.v!]; }),
        encode: { x: [0, 2], y: [1, 3], tooltip: [0, 1, 5, 6, 4] },
        renderItem: (_, api) => {
            const a = api.coord([api.value(0), api.value(1)]), b = api.coord([api.value(2), api.value(3)]), angle = Math.atan2(b[1] - a[1], b[0] - a[0]), length = Math.hypot(b[0] - a[0], b[1] - a[1]), head = Math.min(9, length * .35), color = spec.colorByValue ? String(api.visual('color')) : colorAt(style, i);
            return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: color, lineWidth: 1.7, opacity: .85 } }, { type: 'polygon', shape: { points: [b, [b[0] - head * Math.cos(angle - .48), b[1] - head * Math.sin(angle - .48)], [b[0] - head * Math.cos(angle + .48), b[1] - head * Math.sin(angle + .48)]] }, style: { fill: color } }] };
        } }));
    let axes: Part = {};
    if (compass) {
        const max = Math.max(1, ...data.points.map(p => Math.hypot(p.u!, p.v!))) * 1.12;
        const side = Math.min(style.width - 170, style.height - 190);
        axes = { xAxis: axis(style, 'U', 'value', { min: -max, max }), yAxis: axis(style, 'V', 'value', { min: -max, max }), grid: { left: (style.width - side) / 2, top: 89, width: side, height: side, containLabel: false } };
    }
    return { ...base, ...axes, series, ...(spec.colorByValue ? { visualMap: valueMap(data.points.map(p => p.color!), series.map((_, i) => i), style, 4) } : {}), graphic: [note(style, compass ? '向量以原点为起点；箭头端点 (U, V)；零向量保持零长度' : '起点 (X, Y)；端点 (X + U, Y + V)；向量分量保持真实坐标单位')] };
}

type PackedItem = { point: L1502Point; series: number; x: number; y: number; r: number; width: number; height: number; fontSize: number };
function cloudOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const bubble = spec.kind === 'bubble-cloud', items: PackedItem[] = [], max = Math.max(...data.points.map(p => bubble ? p.size! : Number(p.y))), aspect = (style.width - 145) / Math.max(160, style.height - 160);
    const pending = data.series.flatMap((s, series) => s.points.map(point => ({ point, series }))).sort((a, b) => (bubble ? b.point.size! - a.point.size! : Number(b.point.y) - Number(a.point.y)));
    for (const item of pending) {
        const ratio = max ? (bubble ? item.point.size! : Number(item.point.y)) / max : 0, r = bubble ? 50 * Math.sqrt(ratio) : 0, fontSize = bubble ? Math.max(6, Math.min(16, r * .45, r * 1.8 / Math.max(1, String(item.point.x).length * .65))) : 12 + 42 * Math.sqrt(ratio);
        const width = bubble ? r * 2 : [...String(item.point.x)].reduce((v, ch) => v + (/[^\u0000-\u007f]/.test(ch) ? 1 : .61) * fontSize, 0) + 8, height = bubble ? r * 2 : fontSize * 1.2;
        let x = 0, y = 0, attempt = 0;
        const overlaps = () => items.some(p => (!spec.grouped || p.series === item.series) && (bubble ? Math.hypot(x - p.x, y - p.y) < r + p.r + 2 : Math.abs(x - p.x) < (width + p.width) / 2 + 3 && Math.abs(y - p.y) < (height + p.height) / 2 + 2));
        while (overlaps()) { attempt++; const radius = 2.5 * Math.sqrt(attempt), angle = attempt * 2.399963229728653; x = radius * Math.cos(angle) * Math.sqrt(aspect); y = radius * Math.sin(angle) / Math.sqrt(aspect); }
        items.push({ ...item, x, y, r, width, height, fontSize });
    }
    if (spec.grouped && data.series.length > 1) {
        const boxes = data.series.map((_, i) => { const group = items.filter(p => p.series === i); return { xr: extent(group.flatMap(p => [p.x - p.width / 2, p.x + p.width / 2])), yr: extent(group.flatMap(p => [p.y - p.height / 2, p.y + p.height / 2])) }; });
        const cols = Math.min(3, Math.ceil(Math.sqrt(data.series.length))), cellW = Math.max(...boxes.map(b => b.xr[1] - b.xr[0])) + 24, cellH = Math.max(...boxes.map(b => b.yr[1] - b.yr[0])) + 32;
        items.forEach(item => { const box = boxes[item.series]; item.x += (item.series % cols) * cellW - (box.xr[0] + box.xr[1]) / 2; item.y += Math.floor(item.series / cols) * cellH - (box.yr[0] + box.yr[1]) / 2; });
    }
    const xr = extent(items.flatMap(p => [p.x - p.width / 2, p.x + p.width / 2])), yr = extent(items.flatMap(p => [p.y - p.height / 2, p.y + p.height / 2])), availableW = style.width - (spec.colorByValue ? 170 : 110), availableH = style.height - 140, scale = Math.min(availableW / Math.max(1, xr[1] - xr[0]), availableH / Math.max(1, yr[1] - yr[0]));
    const originX = 55 + availableW / 2 - (xr[0] + xr[1]) / 2 * scale, originY = 88 + availableH / 2 - (yr[0] + yr[1]) / 2 * scale;
    const custom: CustomSeriesOption[] = data.series.map((s, si) => ({ type: 'custom', coordinateSystem: 'none', name: s.name, data: items.filter(p => p.series === si).map(p => [p.x, p.y, bubble ? p.point.size! : Number(p.point.y), p.point.color ?? Number(p.point.y)]), encode: { tooltip: [2, 3] },
        renderItem: (params, api) => {
            const item = items.filter(p => p.series === si)[params.dataIndex], cx = originX + item.x * scale, cy = originY + item.y * scale, color = spec.colorByValue ? String(api.visual('color')) : colorAt(style, si);
            if (bubble) return { type: 'group', children: [{ type: 'circle', shape: { cx, cy, r: item.r * scale }, style: { fill: color, opacity: .78, stroke: '#fff', lineWidth: 1 } }, { type: 'text', style: { text: String(item.point.x), x: cx, y: cy, align: 'center', verticalAlign: 'middle', font: `${Math.max(5, item.fontSize * scale)}px ${style.fontFamily}`, fill: '#fff' } }] };
            return { type: 'text', style: { text: String(item.point.x), x: cx, y: cy, align: 'center', verticalAlign: 'middle', font: `${Math.max(5, item.fontSize * scale)}px ${style.fontFamily}`, fill: color } };
        } }));
    return { ...base, grid: undefined, xAxis: undefined, yAxis: undefined, series: custom, ...(spec.colorByValue ? { visualMap: valueMap(items.map(p => p.point.color!), custom.map((_, i) => i), style) } : {}), graphic: [note(style, bubble ? `每个气泡对应一行 Word；气泡面积 ∝ Size；确定性无重叠排布${spec.grouped ? '；Group 分区' : ''}；${spec.colorByValue ? '颜色按 Color 实值' : '颜色区分系列'}` : '每个词对应一行原始数据；字号 = 12 + 42 √(Weight / 最大 Weight)，再整体等比缩放')] };
}

type Vertex = [number, number, number];
function scalarClip(points: Vertex[], level: number, above: boolean): Vertex[] {
    const output: Vertex[] = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length], aIn = above ? a[2] >= level : a[2] <= level, bIn = above ? b[2] >= level : b[2] <= level;
        if (aIn) output.push(a);
        if (aIn !== bIn) { const t = (level - a[2]) / (b[2] - a[2]); output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, level]); }
    }
    return output;
}
/** Cancel shared triangle edges so each isoband becomes seamless vector boundary loops. */
function polygonBoundary(polygons: number[][][]): number[][][] {
    const key = (p: number[]) => `${p[0].toFixed(10)}:${p[1].toFixed(10)}`;
    const edges = new Map<string, { a: number[]; b: number[] }>();
    for (const polygon of polygons) for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], ka = key(a), kb = key(b);
        if (ka === kb) continue;
        const reverse = `${kb}>${ka}`;
        if (edges.has(reverse)) edges.delete(reverse); else edges.set(`${ka}>${kb}`, { a, b });
    }
    const outgoing = new Map<string, string[]>();
    for (const [edge, { a }] of edges) { const list = outgoing.get(key(a)) ?? []; list.push(edge); outgoing.set(key(a), list); }
    const loops: number[][][] = [];
    while (edges.size) {
        const first = edges.entries().next().value! as [string, { a: number[]; b: number[] }], start = key(first[1].a), loop = [first[1].a]; let edge = first[0];
        while (edges.has(edge)) { const segment = edges.get(edge)!; edges.delete(edge); loop.push(segment.b); const end = key(segment.b); if (end === start) break; const next = outgoing.get(end)?.find(candidate => edges.has(candidate)); if (!next) break; edge = next; }
        if (loop.length >= 3) loops.push(loop);
    }
    return loops;
}
function contourOption(data: L1502Data, spec: L1502Spec, style: L1502Style, base: Part): Part {
    const matrix = data.matrix!, xs = matrix.xs as number[], ys = matrix.ys as number[], values = new Map(matrix.cells.map(c => [`${c.xi}:${c.yi}`, c.value])), range = extent(matrix.cells.map(c => c.value));
    const levels = spec.implicit ? [style.isoLevel] : range[0] === range[1] ? [range[0]] : Array.from({ length: 8 }, (_, i) => range[0] + (range[1] - range[0]) * (i + 1) / 9);
    const triangles: Vertex[][] = [];
    for (let yi = 0; yi < ys.length - 1; yi++) for (let xi = 0; xi < xs.length - 1; xi++) {
        const a: Vertex = [xs[xi], ys[yi], values.get(`${xi}:${yi}`)!], b: Vertex = [xs[xi + 1], ys[yi], values.get(`${xi + 1}:${yi}`)!], c: Vertex = [xs[xi + 1], ys[yi + 1], values.get(`${xi + 1}:${yi + 1}`)!], d: Vertex = [xs[xi], ys[yi + 1], values.get(`${xi}:${yi + 1}`)!];
        triangles.push([a, b, c], [a, c, d]);
    }
    const bands = [range[0], ...levels.filter(l => l > range[0] && l < range[1]), range[1]], shapes: { points: number[][]; loops?: number[][][]; value: number; filled: boolean }[] = [];
    if (spec.filled) for (let i = 0; i < bands.length - 1; i++) {
        const polygons = triangles.map(tri => scalarClip(scalarClip(tri, bands[i], true), bands[i + 1], false)).filter(p => p.length >= 3).map(p => p.map(v => [v[0], v[1]])), loops = polygonBoundary(polygons);
        if (loops.length) shapes.push({ points: loops[0], loops, value: (bands[i] + bands[i + 1]) / 2, filled: true });
    }
    if (!spec.filled || spec.issue !== 79) for (const level of levels) for (const tri of triangles) {
        const cross: number[][] = [];
        for (let i = 0; i < 3; i++) { const a = tri[i], b = tri[(i + 1) % 3]; if ((a[2] < level && b[2] >= level) || (b[2] < level && a[2] >= level)) { const t = (level - a[2]) / (b[2] - a[2]); cross.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
        if (cross.length === 2) shapes.push({ points: cross, value: level, filled: false });
    }
    const custom: CustomSeriesOption = { type: 'custom', name: spec.implicit ? `Z = ${fmt(style.isoLevel)}` : 'Z 等值线', data: shapes.map(s => [s.points[0][0], s.points[0][1], s.value]), encode: { x: 0, y: 1, tooltip: 2 }, renderItem: (params, api) => {
        const s = shapes[params.dataIndex], points = s.points.map(p => api.coord(p)), color = String(api.visual('color'));
        return s.filled ? { type: 'path', shape: { pathData: s.loops!.map(loop => loop.map((p, i) => { const q = api.coord(p); return `${i ? 'L' : 'M'}${q[0]},${q[1]}`; }).join(' ') + ' Z').join(' ') }, style: { fill: color, opacity: .9 } } : { type: 'polyline', shape: { points }, style: { stroke: spec.filled ? '#ffffffa0' : color, lineWidth: spec.implicit ? 2.2 : 1.4, fill: 'none' } };
    } };
    return { ...base, legend: undefined, xAxis: axis(style, style.xLabel, 'value', { min: Math.min(...xs), max: Math.max(...xs) }), yAxis: axis(style, style.yLabel, 'value', { min: Math.min(...ys), max: Math.max(...ys) }), grid: { ...(base.grid as Part), right: 102 }, series: [custom], visualMap: valueMap(spec.implicit ? [style.isoLevel] : matrix.cells.map(c => c.value), [0], style, 2, style.zLabel), graphic: [note(style, spec.implicit ? `输入网格上线性三角插值的 Z = ${fmt(style.isoLevel)} 等值线；未求值函数表达式` : `完整输入网格；线性三角插值；等值线 ${levels.map(fmt).join('、')}`)] };
}
