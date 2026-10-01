import type { FigureRegion, PaperFigure } from './catalog.ts';

export type PaperPoint = { x: string | number; y: number; z?: number; error?: number; series: string };
export type PaperPanelData = { points: PaperPoint[]; filename: string; xRange?: [number, number]; yRange?: [number, number] };
export type PaperChanges = { panels: Record<string, PaperPanelData>; labels: Record<string, string>; images: Record<string, string> };
export const emptyPaperChanges = (): PaperChanges => ({ panels: {}, labels: {}, images: {} });
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const clean = (value: unknown) => value == null ? '' : String(value).trim();
const aliases: Record<string, string[]> = { panel: ['panel', '面板', '绘图区'], series: ['series', '系列', '组别'], x: ['x', '类别', '指标'], y: ['y', '数值', '均值'], z: ['z', 'value', '强度', '矩阵值'], error: ['error', '误差', 'sd', 'sem'] };

/** Parse a single panel or a long table with explicit panel IDs. Never infer a missing number as zero. */
export function parsePaperData(matrix: unknown[][], figure: PaperFigure, selected: FigureRegion, filename: string) {
    const fail = (error: string) => ({ panels: null, warnings: [] as string[], error });
    const first = matrix.findIndex(row => row.some(cell => clean(cell)));
    if (first < 0) return fail('表格中没有数据。');
    const headers = matrix[first].map(value => clean(value).toLowerCase());
    const col = (key: string) => headers.findIndex(header => aliases[key].includes(header));
    const ix = col('x'), iy = col('y'), iz = col('z'), ip = col('panel'), is = col('series'), ie = col('error');
    if (ix < 0 || iy < 0) return fail('请使用示例 CSV 的列名：panel、series、x、y；三维和热图还需要 z。');
    const panels: Record<string, PaperPanelData> = {}, warnings: string[] = [];
    for (let i = first + 1; i < matrix.length; i++) {
        const row = matrix[i]; if (!row.some(cell => clean(cell))) continue;
        const region = ip < 0 ? selected : figure.regions.find(item => item.id === clean(row[ip]) || item.name === clean(row[ip]));
        if (!region) return fail(`第 ${i + 1} 行的 panel 不属于当前图例，请下载该图例的示例表格。`);
        if (region.kind === 'image') return fail(`${region.name} 是插图模块，请使用“替换插图”，数据表不能替换蛋白结构或框架。`);
        const y = number(row[iy]), z = iz < 0 ? null : number(row[iz]), error = ie < 0 || !clean(row[ie]) ? undefined : number(row[ie]);
        const categorical = ['bars', 'horizontal', 'stacked', 'radar', 'box', 'violin', 'heatmap'].includes(region.kind);
        const x = region.kind === 'heatmap' && !region.categories ? number(row[ix]) : categorical ? clean(row[ix]) : number(row[ix]);
        const needsZ = ['sphere', 'vectors', 'surface', 'heatmap'].includes(region.kind);
        const series = is < 0 || !clean(row[is]) ? region.series?.[0] || 'value' : clean(row[is]);
        if (x === null || x === '' || y === null || (needsZ && z === null) || error === null || (error !== undefined && error < 0)) { warnings.push(`第 ${i + 1} 行缺少有效数值或含负误差，已整行跳过。`); continue; }
        if (region.series && !region.series.includes(series)) return fail(`第 ${i + 1} 行的 series 应为：${region.series.join(' / ')}。标注名称可在文字编辑中修改，数据键保持不变。`);
        if (region.categories && !region.categories.includes(String(x))) return fail(`第 ${i + 1} 行的 x 不在模板类别中，请沿用示例表格中的类别键。显示名称可在文字编辑中修改。`);
        if (['bars', 'stacked', 'radar'].includes(region.kind) && y < 0) return fail(`第 ${i + 1} 行：该图例的柱状组成或雷达数值须非负。`);
        if (!panels[region.id]) panels[region.id] = { points: [], filename };
        panels[region.id].points.push({ x, y, series, ...(z === null ? {} : { z }), ...(error === undefined ? {} : { error }) });
    }
    if (!Object.keys(panels).length) return fail('没有完整的可绘制数据行。');
    for (const [id, data] of Object.entries(panels)) {
        const region = figure.regions.find(item => item.id === id)!;
        if (data.points.length > 6000) return fail(`${region.name} 最多支持 6000 行，请精简数据。`);
        const unique = new Set<string>();
        for (const point of data.points) {
            if (['sphere', 'vectors', 'surface', 'violin', 'box'].includes(region.kind)) continue;
            const key = `${point.series}\u0000${point.x}${region.kind === 'heatmap' ? `\u0000${point.y}` : ''}`;
            if (['bars', 'horizontal', 'stacked', 'area', 'radar', 'heatmap'].includes(region.kind) && unique.has(key)) return fail(`${region.name} 包含重复的类别/系列或矩阵坐标，请先汇总。`);
            unique.add(key);
        }
        if (region.kind === 'radar') {
            const categories = region.categories || [...new Set(data.points.map(point => String(point.x)))];
            if (categories.length < 3) return fail('雷达图至少需要三个指标。');
            const series = region.series || [...new Set(data.points.map(point => point.series))];
            if (series.some(name => categories.some(x => !data.points.some(point => point.series === name && point.x === x)))) return fail('雷达图每个系列都需要完整的指标，不能补零或平均填补。');
            for (const point of data.points) {
                const range = region.radarRanges?.[categories.indexOf(String(point.x))] || [0, 100];
                if (point.y < range[0] || point.y > range[1]) return fail(`${point.x} 的数值需在原图刻度 ${range[0]}–${range[1]} 内，超出范围时不能沿用该雷达刻度。`);
            }
        }
        if (region.kind === 'stacked' || region.kind === 'area') {
            if (data.points.some(point => point.y < 0)) return fail('组成值须非负。');
            const series = region.series || [...new Set(data.points.map(point => point.series))];
            const xs = [...new Set(data.points.map(point => point.x))];
            if (xs.some(x => series.some(name => !data.points.some(point => point.x === x && point.series === name)))) return fail('每个 X 都需要完整的组成系列；缺失组成不能自动补零。');
            if (region.kind === 'stacked' && xs.some(x => Math.abs(data.points.filter(point => point.x === x).reduce((sum, point) => sum + point.y, 0) - 1) > .001)) return fail('此图例的组成比例采用 0–1，每个类别的组成之和须为 1。');
        }
        if (region.kind==='line') {
            const baseline=data.points.filter(point=>point.series==='SFT only');
            if(baseline.length&&baseline.some(point=>point.y!==baseline[0].y))return fail('SFT only 是固定基线，请为该系列提供相同的 Y 值。');
        }
        if(region.kind==='heatmap') {
            if(region.xRange&&data.points.some(point=>Number(point.x)<region.xRange![0]||Number(point.x)>region.xRange![1]))return fail('热图 X 坐标超出原图范围。');
            if(region.yRange&&data.points.some(point=>point.y<region.yRange![0]||point.y>region.yRange![1]))return fail('热图 Y 坐标超出原图范围。');
            if(region.categories&&data.points.some(point=>!Number.isInteger(point.y)))return fail('氨基酸热图的 y 是整数位置，请沿用示例的位置编号。');
        }
        if (region.kind === 'heatmap' && region.valueRange && data.points.some(point => point.z! < region.valueRange![0] || point.z! > region.valueRange![1])) return fail(`${region.name} 的 z 值须在原图色标 ${region.valueRange[0]}–${region.valueRange[1]} 内，不能沿用色标显示超出范围的数值。`);
        if (region.kind === 'box' || region.kind === 'violin') {
            const pairs = new Set(data.points.map(point => `${point.series}\u0000${point.x}`));
            for (const pair of pairs) if (data.points.filter(point => `${point.series}\u0000${point.x}` === pair).length < 2) return fail('箱线或样本分布的每个类别/系列至少需要两个真实样本。');
        }
        if (region.kind === 'surface') {
            const keys = data.points.map(point => `${point.x}\u0000${point.y}`);
            if (new Set(keys).size !== keys.length) return fail('曲面包含重复 X/Y 顶点。');
            const xs = [...new Set(data.points.map(point => Number(point.x)))], ys = [...new Set(data.points.map(point => point.y))];
            if (xs.length * ys.length > 10000) return fail('曲面网格过大，请使用规则网格。');
        }
        if (region.kind !== 'radar' && region.yRange && !['heatmap', 'sphere', 'vectors', 'surface'].includes(region.kind) && data.points.some(point => point.y < region.yRange![0] || point.y > region.yRange![1])) warnings.push(`${region.name} 有数值超出原图 Y 范围，请在坐标设置中修改范围；图中超出部分会裁切。`);
        if (region.xRange && ['line','scatter','area','horizontal'].includes(region.kind) && data.points.some(point => (region.kind==='horizontal'?point.y:Number(point.x)) < region.xRange![0] || (region.kind==='horizontal'?point.y:Number(point.x)) > region.xRange![1])) warnings.push(`${region.name} 有数值超出原图 X 范围，请核对坐标设置。`);
    }
    return { panels, warnings, error: null };
}

export function paperDemoPoints(region: FigureRegion): PaperPoint[] {
    if (region.kind === 'image') return [];
    if(region.id==='distribution'&&region.fillSeries)return (region.series||[]).flatMap((series,s)=>Array.from({length:61},(_,i)=>{const x=-1+i/60*2;return {x:Number(x.toFixed(5)),y:Number((s===0?Math.exp(-(((x+.38)/.21)**2)):s===1?.22+.3*Math.exp(-(((x+.38)/.4)**2)):Math.exp(-(((x-.44)/.20)**2))).toFixed(5)),series};}));
    if(region.kind==='line'&&region.series?.includes('SFT only'))return region.series.flatMap((series,s)=>Array.from({length:5},(_,i)=>({x:i*200,y:s===0?22:Number((22+(s*9)*(1-Math.exp(-i*1.1))).toFixed(5)),series})));
    if(region.comparisonOffset!==undefined)return (region.series||[]).flatMap((series,s)=>Array.from({length:8},(_,i)=>({x:i,y:Number((.84-(i%4)*.2-s*.1+(i>=4?.04:0)).toFixed(5)),series})));

    const names = region.series || ['value'];
    const categories = region.categories || ['A', 'B', 'C', 'D'];
    const range = (region.kind === 'horizontal' ? region.xRange : region.yRange) || [0, 1];
    if (region.kind === 'heatmap') return Array.from({length:region.categories?.length || 8},(_,x)=>Array.from({length:region.categories?9:6},(_,y)=>({x:region.categories?.[x] || Number(((region.xRange?.[0]||0) + x/7*((region.xRange?.[1]||7)-(region.xRange?.[0]||0))).toFixed(5)),y:Number(((region.yRange?.[0]||0)+y/(region.categories?8:5)*((region.yRange?.[1]||5)-(region.yRange?.[0]||0))).toFixed(5)),z:Number(((x+y+1)%9/9*(region.valueRange?.[1]||1)).toFixed(4)),series:'value'}))).flat();
    if (region.kind === 'sphere' || region.kind === 'vectors' || region.kind === 'surface') return Array.from({length:12},(_,i)=>({x:Number(Math.cos(i*.7).toFixed(4)),y:Number(Math.sin(i*.7).toFixed(4)),z:Number((i/12-.5).toFixed(4)),series:'value'}));
    return names.flatMap((series,s)=> Array.from({length:['box','violin'].includes(region.kind)?24:region.kind==='line'||region.kind==='area'||region.kind==='scatter'?8:categories.length},(_,i)=> {
        const numericX = ['line','area','scatter'].includes(region.kind);
        const x = numericX ? (region.xRange?.[0]||0) + i/7*((region.xRange?.[1]||7)-(region.xRange?.[0]||0)) : categories[i%categories.length];
        const localRange = region.kind==='radar' ? region.radarRanges?.[i] || [0,100] : range;
        const y = region.kind==='stacked' ? 1/names.length : region.kind==='area' ? (.08 + i*.06)*(range[1]-range[0])/names.length : localRange[0]+(localRange[1]-localRange[0])*(.2 + ((i*3+s*2)%8)/12);
        return {x,series,y:Number(y.toFixed(5)),...(['bars','horizontal'].includes(region.kind)?{error:Number(((range[1]-range[0])*.025).toFixed(5))}:{})};
    }));
}
export function paperExampleCsv(figure: PaperFigure, selected?: FigureRegion) {
    const escape = (cell: unknown) => `"${String(cell??'').replaceAll('"','""')}"`;
    const regions = selected ? [selected] : figure.regions;
    return '\uFEFFpanel,series,x,y,z,error\r\n'+regions.flatMap(region=>paperDemoPoints(region).map(point=>[region.id,point.series,point.x,point.y,point.z??'',point.error??''].map(escape).join(','))).join('\r\n');
}
