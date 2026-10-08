import type { EChartsOption } from 'echarts';
import type { SeriesAppearance, SeriesAppearances } from './chart-style-settings.ts';

export type AppearanceCapability = {
    name: string; kind: 'line' | 'scatter' | 'bar' | 'radar';
    line: boolean; symbol: boolean; fill: boolean;
    defaultColor?: string; lineWidth?: number; lineType?: 'solid' | 'dashed' | 'dotted';
    symbolType?: string; symbolSize?: number; fillOpacity?: number;
};

type Part = Record<string, unknown>;
const record = (value: unknown): value is Part => !!value && typeof value === 'object' && !Array.isArray(value);
const plain = (value: unknown): value is Part => record(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const symbols = ['none', 'circle', 'rect', 'triangle', 'diamond', 'roundRect'];
const lineTypes = ['solid', 'dashed', 'dotted'];
const fields = ['color', 'lineWidth', 'lineType', 'symbol', 'symbolSize', 'fillOpacity'];
const safeName = (name: string) => name.trim().length > 0 && name.length <= 256;
const fail = (): never => { throw new Error('系列样式格式无效。'); };

/** Strictly validate saved appearance settings, without accepting executable or unknown properties. */
export function validateSeriesAppearances(value: unknown): SeriesAppearances {
    if (!plain(value) || Reflect.ownKeys(value).some(key => typeof key !== 'string') || Object.keys(value).length > 256) return fail();
    const entries: [string, SeriesAppearance][] = [];
    for (const [name, settings] of Object.entries(value)) {
        if (!safeName(name) || !plain(settings) || Reflect.ownKeys(settings).some(key => typeof key !== 'string' || !fields.includes(key))) return fail();
        const appearance: SeriesAppearance = {};
        if (settings.color !== undefined) {
            if (typeof settings.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(settings.color)) return fail();
            appearance.color = settings.color;
        }
        if (settings.lineWidth !== undefined) {
            if (!finite(settings.lineWidth) || settings.lineWidth < .25 || settings.lineWidth > 12) return fail();
            appearance.lineWidth = settings.lineWidth;
        }
        if (settings.lineType !== undefined) {
            if (typeof settings.lineType !== 'string' || !lineTypes.includes(settings.lineType)) return fail();
            appearance.lineType = settings.lineType as SeriesAppearance['lineType'];
        }
        if (settings.symbol !== undefined) {
            if (typeof settings.symbol !== 'string' || !symbols.includes(settings.symbol)) return fail();
            appearance.symbol = settings.symbol as SeriesAppearance['symbol'];
        }
        if (settings.symbolSize !== undefined) {
            if (!finite(settings.symbolSize) || settings.symbolSize < 0 || settings.symbolSize > 30) return fail();
            appearance.symbolSize = settings.symbolSize;
        }
        if (settings.fillOpacity !== undefined) {
            if (!finite(settings.fillOpacity) || settings.fillOpacity < 0 || settings.fillOpacity > 1) return fail();
            appearance.fillOpacity = settings.fillOpacity;
        }
        entries.push([name, appearance]);
    }
    return Object.fromEntries(entries);
}

/** Global palette changes keep line, marker and fill edits while releasing per-series color overrides. */
export function withoutSeriesColors(appearances?: SeriesAppearances): SeriesAppearances | undefined {
    if (!appearances) return undefined;
    const entries = Object.entries(validateSeriesAppearances(appearances)).flatMap(([name, appearance]) => {
        const settings = { ...appearance };
        delete settings.color;
        return Object.keys(settings).length ? [[name, settings] as [string, SeriesAppearance]] : [];
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
}

function parts(value: unknown): Part[] {
    return (Array.isArray(value) ? value : value ? [value] : []).filter(record);
}
function stylePart(value: unknown): Part { return record(value) ? value : {}; }
function mappedSeries(option: EChartsOption, index: number): boolean {
    return parts(option.visualMap).some(map => map.seriesIndex === undefined || map.seriesIndex === index || Array.isArray(map.seriesIndex) && map.seriesIndex.includes(index));
}
function unsafePointStyles(part: Part): boolean {
    return parts(part.data).some(point => stylePart(point.itemStyle).color !== undefined);
}
function targets(option: EChartsOption): { part: Part; series: Part; capability: AppearanceCapability }[] {
    const series = parts(option.series), result: { part: Part; series: Part; capability: AppearanceCapability }[] = [];
    const unsupported = series.filter(item => !['line', 'scatter', 'bar', 'radar'].includes(String(item.type)));
    const candidates = series.flatMap((item, index) => {
        const kind = String(item.type);
        if (!['line', 'scatter', 'bar', 'radar'].includes(kind)) return [];
        const eligible = !mappedSeries(option, index) && typeof item.symbolSize !== 'function' && (kind === 'radar' || !unsafePointStyles(item));
        return (kind === 'radar' ? parts(item.data) : [item]).map((part, partIndex) => ({ item, index, kind, part, partIndex, eligible }));
    });
    candidates.forEach(({ item, index, kind, part, partIndex, eligible }) => {
            if (!eligible) return;
            const name = part.name;
            if (typeof name !== 'string' || !safeName(name) || unsupported.some(other => other.name === name || typeof other.name === 'string' && other.name.startsWith(`${name} · `))) return;
            // A name-only record cannot distinguish mixed chart kinds or a native series from its value-mapped sibling.
            if (candidates.some(other => other.part.name === name && (!other.eligible || other.kind !== kind))) return;
            const line = { ...stylePart(item.lineStyle), ...stylePart(part.lineStyle) };
            const mark = { ...stylePart(item.itemStyle), ...stylePart(part.itemStyle) };
            const fill = { ...stylePart(item.areaStyle), ...stylePart(part.areaStyle) };
            const palette = Array.isArray(option.color) ? option.color : [];
            const fallback = palette[(kind === 'radar' ? partIndex : index) % palette.length];
            const color = (kind === 'line' || kind === 'radar') && typeof line.color === 'string' ? line.color : typeof mark.color === 'string' ? mark.color : typeof fallback === 'string' ? fallback : undefined;
            const symbol = kind === 'line' && part.showSymbol === false ? 'none' : part.symbol ?? item.symbol, size = part.symbolSize ?? item.symbolSize;
            result.push({ part, series: item, capability: {
                name, kind: kind as AppearanceCapability['kind'], line: kind === 'line' || kind === 'radar', symbol: kind !== 'bar', fill: kind !== 'scatter',
                ...(color ? { defaultColor: color } : {}),
                ...(finite(line.width) ? { lineWidth: line.width } : {}),
                ...(typeof line.type === 'string' && lineTypes.includes(line.type) ? { lineType: line.type as AppearanceCapability['lineType'] } : {}),
                ...(typeof symbol === 'string' ? { symbolType: symbol } : {}),
                ...(finite(size) ? { symbolSize: size } : {}),
                fillOpacity: finite(kind === 'bar' ? mark.opacity : fill.opacity) ? (kind === 'bar' ? mark.opacity : fill.opacity) as number : kind === 'bar' ? 1 : Object.keys(fill).length ? .2 : 0,
            } });
    });
    return result;
}

/** Only expose controls whose native geometry can reflect the settings reliably. */
export function appearanceCapabilities(option: EChartsOption): AppearanceCapability[] {
    const byName = new Map<string, AppearanceCapability>();
    for (const { capability } of targets(option)) {
        const previous = byName.get(capability.name);
        if (!previous) byName.set(capability.name, capability);
        else byName.set(capability.name, { ...previous, line: previous.line && capability.line, symbol: previous.symbol && capability.symbol, fill: previous.fill && capability.fill });
    }
    return [...byName.values()];
}

/** Apply explicitly named series settings after chart construction; observations and domains are untouched. */
export function applySeriesAppearances(option: EChartsOption, appearances?: SeriesAppearances): void {
    if (!appearances) return;
    const validated = validateSeriesAppearances(appearances);
    for (const { part, series, capability } of targets(option)) {
        if (!Object.hasOwn(validated, capability.name)) continue;
        const appearance = validated[capability.name];
        const line = { ...stylePart(series.lineStyle), ...stylePart(part.lineStyle) };
        const mark = { ...stylePart(series.itemStyle), ...stylePart(part.itemStyle) };
        const fill = { ...stylePart(series.areaStyle), ...stylePart(part.areaStyle) };
        if (appearance.color !== undefined) {
            mark.color = appearance.color;
            if (capability.line) line.color = appearance.color;
            if (capability.fill && capability.kind !== 'bar' && (part.areaStyle !== undefined || series.areaStyle !== undefined || appearance.fillOpacity !== undefined)) fill.color = appearance.color;
            part.itemStyle = mark;
        }
        if (capability.line) {
            if (appearance.lineWidth !== undefined) line.width = appearance.lineWidth;
            if (appearance.lineType !== undefined) line.type = appearance.lineType;
            if (appearance.color !== undefined || appearance.lineWidth !== undefined || appearance.lineType !== undefined) part.lineStyle = line;
        }
        if (capability.symbol) {
            if (appearance.symbol !== undefined) {
                part.symbol = appearance.symbol;
                if (capability.kind === 'line') part.showSymbol = appearance.symbol !== 'none';
            }
            if (appearance.symbolSize !== undefined) {
                part.symbolSize = appearance.symbolSize;
                if (capability.kind === 'line' && (appearance.symbol ?? part.symbol) !== 'none') part.showSymbol = true;
            }
        }
        if (capability.fill && appearance.fillOpacity !== undefined) {
            if (capability.kind === 'bar') { mark.opacity = appearance.fillOpacity; part.itemStyle = mark; }
            else {
                if (fill.color === undefined && capability.defaultColor !== undefined) fill.color = appearance.color ?? capability.defaultColor;
                fill.opacity = appearance.fillOpacity; part.areaStyle = fill;
            }
        } else if (capability.fill && capability.kind !== 'bar' && appearance.color !== undefined && Object.keys(fill).length) part.areaStyle = fill;
    }
}
