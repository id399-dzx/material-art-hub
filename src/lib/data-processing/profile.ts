import { numericCell, type ColumnMapping, type DataTable, type TemplateId } from './templates.ts';

export type ColumnKind = 'numeric' | 'category' | 'date' | 'text';
export type PlotGoal = 'auto' | 'compare' | 'distribution' | 'relationship' | 'trend' | 'composition';
export type ColumnProfile = { index: number; name: string; kind: ColumnKind; count: number; missing: number; invalid: number; unique: number; min?: number; max?: number; mean?: number; median?: number; sd?: number; skew?: number; outliers?: number; constant?: boolean };
export type DataProfile = { rows: number; blankRows: number; columns: ColumnProfile[]; groups: { name: string; rows: number; valid: Record<number, number> }[]; correlations: { a: number; b: number; n: number; r: number | null }[] };
export type Recommendation = { id: TemplateId; reason: string; mapping: ColumnMapping };
export const COLUMN_KINDS: Record<ColumnKind, string> = { numeric: '数值', category: '分类', date: '日期', text: '文本 / ID' };
export const PLOT_GOALS: Record<PlotGoal, string> = { auto: '按数据推荐', compare: '比较组间差异', distribution: '查看样本分布', relationship: '查看变量关系', trend: '查看时间 / 参数趋势', composition: '比较组成占比' };
const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';
export function quantile(sorted: number[], p: number) {
    if (!sorted.length) return NaN;
    const position = (sorted.length - 1) * p, lo = Math.floor(position), fraction = position - lo;
    return sorted[lo] * (1 - fraction) + sorted[Math.min(lo + 1, sorted.length - 1)] * fraction;
}
function isDate(value: unknown) {
    const match = String(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
    if (!match) return false;
    const [, y, m, d] = match.map(Number), date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function profileTable(table: DataTable, overrides: Record<number, ColumnKind> = {}, groupColumn = -1): DataProfile {
    const rows = table.rows.filter(row => row.some(present));
    const columns = table.columns.map((name, index): ColumnProfile => {
        const values = rows.map(row => row[index]).filter(present), numbers = values.map(numericCell).filter((value): value is number => value !== null);
        const unique = new Set(values.map(String)).size;
        // Never classify integer measurements as categorical just because there are few values.
        const inferred: ColumnKind = values.length && numbers.length / values.length >= .8 ? 'numeric' : values.length && values.every(isDate) ? 'date' : unique <= 30 ? 'category' : 'text';
        const kind = overrides[index] || inferred;
        const info: ColumnProfile = { index, name, kind, count: values.length, missing: rows.length - values.length, invalid: kind === 'numeric' ? values.length - numbers.length : kind === 'date' ? values.filter(value => !isDate(value)).length : 0, unique };
        if (kind === 'date') info.count -= info.invalid;
        if (kind === 'numeric') info.count = numbers.length;
        if (kind !== 'numeric' || !numbers.length) return info;
        const sorted = [...numbers].sort((a, b) => a - b), n = numbers.length, mean = numbers.reduce((sum, value) => sum + value, 0) / n;
        const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0), sd = n > 1 ? Math.sqrt(variance / (n - 1)) : undefined;
        const q1 = quantile(sorted, .25), q3 = quantile(sorted, .75), iqr = q3 - q1;
        const skew = n > 2 && sd && sd > 0 ? n / ((n - 1) * (n - 2)) * numbers.reduce((sum, value) => sum + ((value - mean) / sd) ** 3, 0) : undefined;
        return { ...info, count: n, min: sorted[0], max: sorted[n - 1], mean, median: quantile(sorted, .5), sd, skew, constant: sorted[0] === sorted[n - 1], outliers: n >= 4 ? numbers.filter(value => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr).length : 0 };
    });
    const groups = new Map<string, { name: string; rows: number; valid: Record<number, number> }>();
    if (groupColumn >= 0 && table.columns[groupColumn]) rows.forEach(row => {
        const name = present(row[groupColumn]) ? String(row[groupColumn]) : '（分组缺失）';
        const group = groups.get(name) || { name, rows: 0, valid: {} };
        group.rows++;
        columns.filter(column => column.kind === 'numeric' && column.index !== groupColumn).forEach(column => { if (numericCell(row[column.index]) !== null) group.valid[column.index] = (group.valid[column.index] || 0) + 1; });
        groups.set(name, group);
    });
    const numeric = columns.filter(column => column.kind === 'numeric').slice(0, 12), correlations: DataProfile['correlations'] = [];
    numeric.forEach((a, i) => numeric.slice(i + 1).forEach(b => {
        const pairs = rows.map(row => [numericCell(row[a.index]), numericCell(row[b.index])]).filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
        const n = pairs.length;
        if (n < 3) { correlations.push({ a: a.index, b: b.index, n, r: null }); return; }
        const mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
        const vx = pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0), vy = pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0);
        const r = vx > 0 && vy > 0 ? pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / Math.sqrt(vx * vy) : null;
        correlations.push({ a: a.index, b: b.index, n, r: r === null || !Number.isFinite(r) ? null : Math.max(-1, Math.min(1, r)) });
    }));
    return { rows: rows.length, blankRows: table.rows.length - rows.length, columns, groups: [...groups.values()], correlations };
}
export function recommendCharts(profile: DataProfile, goal: PlotGoal, group = -1, value = -1): Recommendation[] {
    const numeric = profile.columns.filter(column => column.kind === 'numeric' && column.count > 0 && column.index !== group).map(column => column.index);
    const y = numeric.includes(value) ? value : numeric[0], date = profile.columns.find(column => column.kind === 'date' && !column.invalid)?.index;
    const category = group >= 0 ? group : profile.columns.find(column => column.kind === 'category' && column.index !== y)?.index;
    if (y === undefined) return [];
    const items: Recommendation[] = [];
    const add = (id: TemplateId, reason: string, x: number, ys: number[]) => items.push({ id, reason, mapping: { x, ys, errors: {} } });
    const repeated = category !== undefined && profile.columns[category].unique < profile.rows;
    const target = goal === 'auto' ? date !== undefined ? 'trend' : repeated ? 'compare' : numeric.length >= 2 ? 'relationship' : 'distribution' : goal;
    if (target === 'distribution') {
        add('histogram', '保留每个有效观测的计数，查看频率分布；不会拟合或修改原始数据。', y, [y]);
        if (category !== undefined) add('box', '按类别显示四分位、中位数与全部原始样本点。', category, [y]);
    } else if (target === 'compare' && category !== undefined) {
        if (repeated) {
            add('box', '同一类别有多条样本，箱线＋原始点可以同时呈现分布和样本量。', category, [y]);
            add('violin', '用核密度显示分布形状，同时保留原始点；小样本不绘制密度轮廓。', category, [y]);
        } else {
            add('grouped-bar', '当前为每类一行的汇总表，比较提供的数值；每行不等于一个独立实验样本。', category, numeric.slice(0, 6));
            add('horizontal-bar', '类别名称较长时，可用横向排列提高可读性。', category, numeric.slice(0, 6));
        }
    } else if (target === 'relationship' && numeric.length >= 2) {
        const x = numeric.find(index => index !== y)!;
        add('scatter', '两列数值一一配对，展示观测关系；不会自动推断因果或添加回归线。', x, [y]);
    } else if (target === 'trend' && (date !== undefined || numeric.length >= 2)) {
        const x = date ?? numeric.find(index => index !== y)!;
        add(date !== undefined ? 'trend' : 'line', '按原始行顺序展示变化，请核对时间 / 参数顺序；不会自动排序或插值。', x, numeric.filter(index => index !== x).slice(0, 6));
        if (date === undefined) add('scatter', '若 X 并非有序扫描变量，散点图更适合保留独立观测。', x, [y]);
    } else if (target === 'composition' && category !== undefined && !repeated && numeric.length >= 2 && numeric.every(index => (profile.columns[index].min ?? -1) >= 0)) {
        add('stacked-bar', '仅适用于同单位、可相加的组成部分；保留提供的总量。', category, numeric);
        add('percent-bar', '比较每行各部分占比，按行归一到 100%；请选择实际组成列。', category, numeric);
    }
    return items;
}
