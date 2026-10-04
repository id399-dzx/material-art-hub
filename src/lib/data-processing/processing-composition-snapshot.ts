export type ProcessingChunk = { id: string; name: string; x: number[]; y: number[] };
export type ProcessingFigureState = {
    fileName: string | null; fileName2: string | null;
    fileChunks1: ProcessingChunk[]; fileChunks2: ProcessingChunk[];
    dataType: string; dataOrientation: 'auto' | 'row-pairs' | 'two-rows';
    fontFamily: string; lineWidth: number; titleSize: number; labelSize: number;
    chartWidth: number; chartHeight: number; lineColor: string; lineColor2: string;
    seriesName: string; seriesName2: string; legendPosition: string;
    xAxisName: string; yAxisName: string; xMin: string; xMax: string; xInterval: string;
    yMin: string; yMax: string; yInterval: string; xOnZero: boolean;
    showInset: boolean; useMainDataForInset: boolean; insetTotalX: number[]; insetTotalY: number[];
    insetXMin: string; insetXMax: string; insetYMin: string; insetYMax: string;
    insetLeft: string; insetTop: string; insetWidth: string; insetHeight: string;
    insetFontSize: string; showInsetAxisName: boolean; insetXAxisName: string; insetYAxisName: string;
    insetXSplit: string; insetYSplit: string;
};
export type ProcessingFigureSnapshot = {
    kind: 'processing'; version: 1; state: ProcessingFigureState;
    zoom?: { start?: number; end?: number; startValue?: number; endValue?: number }[];
    legendSelection?: Record<string, boolean>;
};
const stringKeys = ['dataType', 'fontFamily', 'lineColor', 'lineColor2', 'seriesName', 'seriesName2', 'legendPosition', 'xAxisName', 'yAxisName', 'xMin', 'xMax', 'xInterval', 'yMin', 'yMax', 'yInterval', 'insetXMin', 'insetXMax', 'insetYMin', 'insetYMax', 'insetLeft', 'insetTop', 'insetWidth', 'insetHeight', 'insetFontSize', 'insetXAxisName', 'insetYAxisName', 'insetXSplit', 'insetYSplit'] as const;
const booleanKeys = ['xOnZero', 'showInset', 'useMainDataForInset', 'showInsetAxisName'] as const;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function numbers(value: unknown): value is number[] { return Array.isArray(value) && value.length <= 500000 && value.every(item => typeof item === 'number' && Number.isFinite(item)); }
function chunks(value: unknown): value is ProcessingChunk[] {
    return Array.isArray(value) && value.length <= 200 && value.every(item => object(item) && typeof item.id === 'string' && typeof item.name === 'string' && item.name.length <= 500 && numbers(item.x) && numbers(item.y) && item.x.length === item.y.length);
}
export function validateProcessingSnapshot(value: unknown): ProcessingFigureSnapshot {
    const fail = () => { throw new Error('这张曲线的原始编辑记录不完整，请重新导入原始数据。'); };
    if (!object(value) || value.kind !== 'processing' || value.version !== 1 || !object(value.state)) return fail();
    const s = value.state;
    if (!chunks(s.fileChunks1) || !s.fileChunks1.length || !chunks(s.fileChunks2) || !numbers(s.insetTotalX) || !numbers(s.insetTotalY) || s.insetTotalX.length !== s.insetTotalY.length) return fail();
    if (![s.fileName, s.fileName2].every(item => item === null || (typeof item === 'string' && item.length <= 500))) return fail();
    if (!['auto', 'row-pairs', 'two-rows'].includes(String(s.dataOrientation))) return fail();
    for (const key of stringKeys) if (typeof s[key] !== 'string' || s[key].length > 500) return fail();
    for (const key of booleanKeys) if (typeof s[key] !== 'boolean') return fail();
    const optionalNumber = (item: unknown, positive = false) => typeof item === 'string' && (item === '' || (item.trim() !== '' && Number.isFinite(Number(item)) && (!positive || Number(item) > 0)));
    for (const key of ['xMin', 'xMax', 'yMin', 'yMax', 'insetXMin', 'insetXMax', 'insetYMin', 'insetYMax']) if (!optionalNumber(s[key])) return fail();
    for (const key of ['xInterval', 'yInterval', 'insetXSplit', 'insetYSplit']) if (!optionalNumber(s[key], true)) return fail();
    const gridValue = (item: unknown, size: boolean) => {
        if (typeof item !== 'string' || !/^\d+(?:\.\d+)?%?$/.test(item)) return false;
        const n = Number(item.replace('%', ''));
        return n >= (size ? 0.1 : 0) && n <= (item.endsWith('%') ? 100 : 3000);
    };
    if (!gridValue(s.insetLeft, false) || !gridValue(s.insetTop, false) || !gridValue(s.insetWidth, true) || !gridValue(s.insetHeight, true) || !optionalNumber(s.insetFontSize, true) || Number(s.insetFontSize) > 100 || s.insetFontSize === '') return fail();
    if (!['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(String(s.legendPosition))) return fail();
    if (![s.lineColor, s.lineColor2].every(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))) return fail();
    const bounds = { lineWidth: [0.1, 30], titleSize: [1, 100], labelSize: [1, 100], chartWidth: [200, 3000], chartHeight: [200, 3000] };
    for (const [key, [min, max]] of Object.entries(bounds)) if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < min || s[key] > max) return fail();
    if (value.zoom !== undefined && (!Array.isArray(value.zoom) || value.zoom.length > 8 || !value.zoom.every(item => object(item) && Object.entries(item).every(([key, n]) => ['start', 'end', 'startValue', 'endValue'].includes(key) && typeof n === 'number' && Number.isFinite(n))))) return fail();
    if (Array.isArray(value.zoom) && value.zoom.some(item => ['start', 'end'].some(key => item[key] !== undefined && (item[key] < 0 || item[key] > 100)))) return fail();
    if (value.legendSelection !== undefined && (!object(value.legendSelection) || Object.keys(value.legendSelection).length > 400 || !Object.entries(value.legendSelection).every(([key, selected]) => key.length <= 500 && typeof selected === 'boolean'))) return fail();
    return JSON.parse(JSON.stringify(value)) as ProcessingFigureSnapshot;
}
