import { numericCell, type ColumnMapping, type DataTable, type TemplateResult } from './templates.ts';
import { quantile } from './profile.ts';

export type SampleGroup = { name: string; values: number[]; category?: string; series?: string };
export function sampleBox(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b), q1 = quantile(sorted, .25), median = quantile(sorted, .5), q3 = quantile(sorted, .75), iqr = q3 - q1;
    const inside = sorted.filter(value => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
    return [inside[0] ?? sorted[0], q1, median, q3, inside.at(-1) ?? sorted.at(-1)!];
}
export function histogram(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b), min = sorted[0], max = sorted.at(-1)!;
    if (min === max) return [{ lo: min - .5, hi: max + .5, count: values.length }];
    const iqr = quantile(sorted, .75) - quantile(sorted, .25), fdWidth = 2 * iqr / Math.cbrt(values.length);
    const count = Math.min(60, Math.max(1, fdWidth > 0 ? Math.ceil((max - min) / fdWidth) : Math.ceil(Math.log2(values.length) + 1))), width = (max - min) / count;
    const bins = Array.from({ length: count }, (_, i) => ({ lo: min + i * width, hi: i === count - 1 ? max : min + (i + 1) * width, count: 0 }));
    values.forEach(value => bins[Math.min(count - 1, Math.floor((value - min) / width))].count++);
    return bins;
}
export function kernelDensity(values: number[]) {
    if (values.length < 5 || new Set(values).size < 2) return [];
    const sorted = [...values].sort((a, b) => a - b), mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    const robust = (quantile(sorted, .75) - quantile(sorted, .25)) / 1.34;
    const bandwidth = .9 * (robust > 0 ? Math.min(sd, robust) : sd) * values.length ** -.2;
    if (!(bandwidth > 0)) return [];
    const lo = sorted[0], hi = sorted.at(-1)!;
    return Array.from({ length: 64 }, (_, i) => {
        const y = lo + (hi - lo) * i / 63;
        return { y, density: values.reduce((sum, value) => sum + Math.exp(-.5 * ((y - value) / bandwidth) ** 2), 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI)) };
    });
}
export function buildDistributionData(table: DataTable, mapping: ColumnMapping, id: 'box' | 'violin' | 'histogram'): TemplateResult {
    if (id === 'histogram' && (!Number.isInteger(mapping.x) || !table.columns[mapping.x])) return { data: null, error: '请选择一列有效的样本数值。' };
    if (id !== 'histogram' && (mapping.ys.length !== 1 || mapping.ys[0] === mapping.x || !table.columns[mapping.ys[0]])) return { data: null, error: '请选择一列类别和一列样本数值；每行代表一个真实样本。' };
    const valueColumn = id === 'histogram' ? mapping.x : mapping.ys[0], groups = new Map<string, number[]>(), warnings: string[] = [];
    let skipped = 0;
    table.rows.forEach((row, index) => {
        if (row.every(cell => cell === null || cell === '')) return;
        const value = numericCell(row[valueColumn]), name = id === 'histogram' ? table.columns[valueColumn] : String(row[mapping.x] ?? '').trim();
        if (value === null || !name) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行缺少有效类别或数值，已跳过，不填补。`); return; }
        const values = groups.get(name) || []; values.push(value); groups.set(name, values);
    });
    const samples = [...groups].map(([name, values]) => ({ name, values }));
    if (!samples.length) return { data: null, error: '所选列没有有效样本。' };
    if (samples.reduce((sum, item) => sum + item.values.length, 0) > 6000 || samples.length > 40) return { data: null, error: '分布图最多支持 6000 个样本、40 个类别，请选择子集。' };
    return { data: { x: samples.map(item => item.name), series: [{ name: table.columns[valueColumn], values: samples.map(item => quantile([...item.values].sort((a, b) => a - b), .5)) }], samples, skipped, warnings }, error: null };
}
