import { numericCell, type DataTable } from './templates.ts';
import { L1502_SPATIAL_KINDS, type L1502Mapping, type L1502Spec, type L1502Data, type L1502Point, type L1502Result, type L1502Series } from './l1502-spec.ts';

type Role = Exclude<keyof L1502Mapping, 'x' | 'ys' | 'errors' | 'bounds'>;
const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
const label = (v: unknown) => present(v) ? String(v).trim() : null;
const valid = (t: DataTable, i: unknown): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < t.columns.length;
const fail = (error: string): L1502Result => ({ data: null, error });
const pointKinds = new Set(['scatter', 'bubble', 'scatter-marginal', 'scatter-matrix', 'parallel', 'histogram2', 'error-line', 'confidence', 'vector2', 'compass', 'contour', 'variable-bar', 'polar-line', 'polar-scatter', 'polar-bubble']);
const gridKinds = new Set(['contour', 'surface', 'waterfall', 'ribbon']);
const oneYKinds = new Set(['bubble', 'bubble-cloud', 'bubble-matrix', 'histogram2', 'box', 'jitter', 'word-cloud', 'network', 'vector2', 'compass', 'contour', ...L1502_SPATIAL_KINDS]);
const rolePattern: Record<Role, RegExp> = {
    z: /^(?:z|height|网格值|高度)$/i, group: /^(?:group|series|condition|组别|分组|组|条件)$/i,
    size: /^(?:size|area|大小|尺寸|面积|宽度)$/i, color: /^(?:color|colour|scalar|颜色|标量)$/i,
    label: /^(?:label|name|标签|名称)$/i, u: /^(?:u|dx|向量u)$/i, v: /^(?:v|dy|向量v)$/i,
    w: /^(?:w|dz|向量w)$/i, weight: /^(?:weight|frequency|count|权重|频数|次数)$/i,
};

/** UI roles remain editable; suggestions never interpret a numeric group as a measurement. */
export function l1502Roles(spec: L1502Spec): Role[] {
    // Wide matrices encode color with the selected value columns, not a separate role.
    if (spec.kind === 'heatmap') return [];
    const roles: Role[] = ['group', 'label'];
    if (['bubble', 'bubble-cloud', 'polar-bubble', 'bubble-matrix', 'variable-bar', 'scatter3'].includes(spec.kind)) roles.push('size');
    if (spec.kind === 'bubble-cloud') roles.push('color');
    if (spec.colorByValue || ['heatmap', 'bubble-matrix', 'scatter', 'scatter-marginal', 'scatter3', 'contour', 'vector2', 'vector3', 'compass', 'polar-line', 'polar-scatter', 'polar-bubble', ...L1502_SPATIAL_KINDS.filter(k => k !== 'pie3')].includes(spec.kind)) roles.push('color');
    if (['contour', 'bar3', 'scatter3', 'line3', 'stem3', 'surface', 'waterfall', 'ribbon', 'tri-mesh', 'tri-surface', 'vector3', 'implicit-surface'].includes(spec.kind)) roles.push('z');
    if (['vector2', 'vector3', 'compass'].includes(spec.kind)) roles.push('u', 'v');
    if (spec.kind === 'vector3') roles.push('w');
    if (['network', 'word-cloud'].includes(spec.kind)) roles.push('weight');
    return [...new Set(roles)];
}

export function suggestL1502Mapping(table: DataTable, spec: L1502Spec): L1502Mapping {
    const cols = table.columns.map((name, index) => ({ name: name.trim(), index }));
    const numeric = cols.filter(c => table.rows.some(r => numericCell(r[c.index]) !== null));
    const mapping: L1502Mapping = { x: 0, ys: [], errors: {}, bounds: {} };
    for (const role of l1502Roles(spec)) {
        const col = cols.find(c => rolePattern[role].test(c.name));
        if (col) mapping[role] = col.index;
    }
    const auxiliaries = new Set(cols.filter(c => /(?:[_\s-](?:error|err|sd|sem|lower|upper|lo|hi))$/i.test(c.name)).map(c => c.index));
    const roleIndices = new Set(l1502Roles(spec).map(r => mapping[r]).filter((i): i is number => i !== undefined));
    const xPattern = spec.kind === 'network' ? /^(?:source|from|源|起点)$/i : spec.kind === 'word-cloud' ? /^(?:word|term|词语|词|文字)$/i : /^(?:x|time|angle|theta|category|row|categoryname|类别|分类|时间|角度|行)$/i;
    mapping.x = cols.find(c => xPattern.test(c.name))?.index ?? cols.find(c => !roleIndices.has(c.index) && !auxiliaries.has(c.index))?.index ?? 0;
    if (spec.kind === 'compass' && mapping.u !== undefined && mapping.v !== undefined) { mapping.x = mapping.u; mapping.ys = [mapping.v]; }
    else if (spec.kind === 'network') mapping.ys = [cols.find(c => /^(?:target|to|目标|终点)$/i.test(c.name))?.index ?? cols.find(c => c.index !== mapping.x && c.index !== mapping.weight)?.index ?? -1];
    else if (spec.kind === 'word-cloud') mapping.ys = [mapping.weight ?? numeric.find(c => c.index !== mapping.x)?.index ?? -1];
    else if (spec.kind === 'bubble-cloud') mapping.ys = [mapping.size ?? numeric.find(c => c.index !== mapping.x)?.index ?? -1];
    else if (spec.kind === 'bubble-matrix') mapping.ys = [cols.find(c => /^(?:y|categoryy|列|纵类别)$/i.test(c.name))?.index ?? cols.find(c => c.index !== mapping.x && !roleIndices.has(c.index))?.index ?? -1];
    else {
        const eligible = numeric.filter(c => c.index !== mapping.x && !roleIndices.has(c.index) && !auxiliaries.has(c.index));
        const preferred = eligible.find(c => /^(?:y|value|radius|r|值|数值|半径)$/i.test(c.name));
        mapping.ys = oneYKinds.has(spec.kind) ? [preferred?.index ?? eligible[0]?.index ?? -1] : eligible.map(c => c.index);
        if (['histogram', 'histogram2', 'polar-histogram'].includes(spec.kind) && !mapping.ys.length && numeric.length === 1) mapping.ys = [numeric[0].index];
    }
    if (['bubble', 'polar-bubble', 'bubble-matrix', 'variable-bar'].includes(spec.kind) && mapping.size === undefined) mapping.size = numeric.find(c => c.index !== mapping.x && !mapping.ys.includes(c.index) && c.index !== mapping.color && c.index !== mapping.group)?.index;
    if (['network', 'word-cloud'].includes(spec.kind) && mapping.weight === undefined) mapping.weight = numeric.find(c => c.index !== mapping.x && (spec.kind === 'word-cloud' || !mapping.ys.includes(c.index)))?.index;
    for (const y of mapping.ys) {
        const base = table.columns[y]?.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!base) continue;
        const lower = cols.find(c => new RegExp(`^${base}[_\\s-](?:lower|lo)$`, 'i').test(c.name));
        const upper = cols.find(c => new RegExp(`^${base}[_\\s-](?:upper|hi)$`, 'i').test(c.name));
        const error = cols.find(c => new RegExp(`^${base}[_\\s-](?:error|err|sd|sem)$`, 'i').test(c.name));
        if (lower && upper) mapping.bounds[y] = { lower: lower.index, upper: upper.index };
        if (error) mapping.errors[y] = error.index;
    }
    return mapping;
}

export function buildL1502Data(table: DataTable, mapping: L1502Mapping, spec: L1502Spec): L1502Result {
    if (!table.rows.length) return fail('表格没有数据，请导入或载入示例。');
    if (table.rows.length > 20000) return fail('L1502 最多支持 20000 行真实观测，请明确选择数据子集。');
    if (!valid(table, mapping.x)) return fail('请选择有效的 X / 类别 / 来源列。');
    if (!mapping.ys.length || new Set(mapping.ys).size !== mapping.ys.length || mapping.ys.some(i => !valid(table, i))) return fail('请选择有效且不重复的 Y / 数值 / 目标列。');
    if (mapping.ys.length > 16) return fail('最多支持 16 个数值系列，请选择子集。');
    if (spec.kind === 'scatter-matrix' && mapping.ys.length > 5) return fail('散点矩阵最多支持 6 个变量（X 和 5 个 Y），请明确选择子集。');
    if (!['histogram', 'histogram2', 'polar-histogram'].includes(spec.kind) && mapping.ys.includes(mapping.x)) return fail('X 与 Y 必须绑定不同的列。');
    for (const role of Object.keys(rolePattern) as Role[]) if (mapping[role] !== undefined && !valid(table, mapping[role])) return fail(`「${role}」绑定不是有效列。`);
    const required: Role[] = [];
    if (['bubble', 'bubble-cloud', 'polar-bubble', 'bubble-matrix', 'variable-bar'].includes(spec.kind)) required.push('size');
    if (['contour', 'bar3', 'scatter3', 'line3', 'stem3', 'surface', 'waterfall', 'ribbon', 'tri-mesh', 'tri-surface', 'vector3', 'implicit-surface'].includes(spec.kind)) required.push('z');
    if (['vector2', 'vector3', 'compass'].includes(spec.kind)) required.push('u', 'v');
    if (spec.kind === 'vector3') required.push('w');
    if (spec.kind === 'word-cloud') required.push('weight');
    if (spec.kind === 'implicit-surface') required.push('color');
    for (const role of required) if (mapping[role] === undefined) return fail(`此图需要绑定「${role}」列。`);
    if (oneYKinds.has(spec.kind) && mapping.ys.length !== 1) return fail('此图使用长表结构，请绑定恰好一列 Y / 数值 / 目标。');
    if (['dual-axis', 'pyramid'].includes(spec.kind) && mapping.ys.length < 2) return fail('此图至少需要两列不同的数值系列。');
    for (const y of mapping.ys) {
        const error = mapping.errors?.[y], bounds = mapping.bounds?.[y];
        if (error !== undefined && (!valid(table, error) || error === y)) return fail(`「${table.columns[y]}」的误差列无效。`);
        if (bounds && (!valid(table, bounds.lower) || !valid(table, bounds.upper) || bounds.lower === bounds.upper || bounds.lower === y || bounds.upper === y)) return fail(`「${table.columns[y]}」的上下界列无效。`);
        if (spec.kind === 'error-bar' && error === undefined) return fail(`请为「${table.columns[y]}」绑定误差列（如 ${table.columns[y]}_error）。`);
        if (spec.kind === 'confidence' && !bounds) return fail(`请为「${table.columns[y]}」绑定 lower / upper 区间列。`);
    }
    if (spec.kind === 'error-line' && !mapping.ys.some(y => mapping.errors?.[y] !== undefined)) return fail('误差折线至少需要为一个系列绑定误差列。');
    const data: L1502Data = { table, mapping, series: [], points: [], warnings: [], skipped: 0 };
    const warn = (i: number, text: string) => { data.skipped++; if (data.warnings.length < 6) data.warnings.push(`第 ${table.firstDataRow + i} 行${text}；略过该观测，不填零。`); };
    if (spec.kind === 'heatmap') {
        const ys: (string | number)[] = [], keys = new Set<string>();
        const xs = mapping.ys.map(i => numericCell(table.columns[i]) ?? table.columns[i]);
        if (new Set(xs).size !== xs.length) return fail('矩阵列位置重复；每个列标签 / 数值坐标必须唯一。');
        const cells: NonNullable<L1502Data['matrix']>['cells'] = [];
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i]; if (!row.some(present)) continue;
            const name = numericCell(row[mapping.x]) ?? label(row[mapping.x]); if (name === null) { warn(i, '缺少矩阵行标签'); continue; }
            if (keys.has(String(name))) return fail(`矩阵行标签「${name}」重复，请确保一行对应唯一标签。`);
            keys.add(String(name)); const yi = ys.length; ys.push(name);
            mapping.ys.forEach((col, xi) => { const value = numericCell(row[col]); if (value === null) warn(i, `「${table.columns[col]}」缺少有效数值`); else cells.push({ xi, yi, value }); });
        }
        if (ys.length * mapping.ys.length > 40000) return fail('热图最多支持 40000 个网格单元，请选择子集。');
        if (!cells.length) return fail('矩阵没有有效数值。');
        data.matrix = { xs, ys, cells }; return { data, error: null };
    }
    if (spec.kind === 'network') {
        data.edges = [];
        if (mapping.weight === undefined) data.warnings.push('未绑定权重，每条边按单位权重 1 绘制。');
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i]; if (!row.some(present)) continue;
            const source = label(row[mapping.x]), target = label(row[mapping.ys[0]]), weight = mapping.weight === undefined ? 1 : numericCell(row[mapping.weight]);
            if (source === null || target === null || weight === null) { warn(i, '缺少来源、目标或权重'); continue; }
            if (weight < 0) return fail(`第 ${table.firstDataRow + i} 行权重为负数。`);
            data.edges.push({ source, target, weight });
        }
        if (!data.edges.length) return fail('没有有效网络边。');
        if (data.edges.length > 4000 || new Set(data.edges.flatMap(e => [e.source, e.target])).size > 300) return fail('网络最多支持 300 个节点、4000 条边，请选择子集。');
        return { data, error: null };
    }
    const series = new Map<string, L1502Series>();
    const categoricalX = ['bar', 'stacked-bar', 'box', 'jitter', 'pie', 'pie3', 'pyramid', 'pareto', 'word-cloud', 'bubble-cloud', 'bubble-matrix'].includes(spec.kind);
    const numericX = pointKinds.has(spec.kind) && spec.kind !== 'scatter-matrix' || L1502_SPATIAL_KINDS.includes(spec.kind) && spec.kind !== 'pie3';
    const histogram = ['histogram', 'histogram2', 'polar-histogram'].includes(spec.kind);
    let fatal: string | null = null;
    for (let i = 0; i < table.rows.length; i++) {
        const row = table.rows[i]; if (!row.some(present)) continue;
        const rawX = row[mapping.x];
        const x = spec.timeX ? typeof rawX === 'number' ? rawX : present(rawX) && Number.isFinite(Date.parse(String(rawX))) ? Date.parse(String(rawX)) : null : categoricalX ? label(rawX) : numericX ? numericCell(rawX) : numericCell(rawX) ?? label(rawX);
        const group = mapping.group === undefined ? undefined : label(row[mapping.group]);
        if ((!histogram && x === null) || mapping.group !== undefined && group === null) { warn(i, '缺少有效 X / 类别或分组'); continue; }
        const attributes: Partial<L1502Point> = { ...(group === undefined ? {} : { group: group! }), ...(mapping.label === undefined ? {} : { label: label(row[mapping.label]) ?? undefined }) };
        let invalidAttribute = false;
        for (const role of ['z', 'size', 'color', 'u', 'v', 'w'] as const) {
            if (mapping[role] === undefined) continue;
            const value = numericCell(row[mapping[role]!]);
            if (value === null) { invalidAttribute = true; break; }
            if (role === 'size' && value < 0) { fatal = `第 ${table.firstDataRow + i} 行 Size 为负数；大小 / 宽度必须非负。`; break; }
            attributes[role] = value;
        }
        if (fatal) break;
        if (invalidAttribute) { warn(i, '缺少已绑定的有限数值角色'); continue; }
        for (const yColumn of mapping.ys) {
            const y = spec.kind === 'bubble-matrix' ? label(row[yColumn]) : numericCell(row[yColumn]);
            if (y === null) { warn(i, `「${table.columns[yColumn]}」缺少有效数值 / 类别`); continue; }
            const p: L1502Point = { x: x ?? i, y, ...attributes };
            const logValue = spec.logY || spec.horizontal && spec.logX;
            if (spec.logX && !spec.horizontal && typeof p.x === 'number' && p.x <= 0 || logValue && typeof p.y === 'number' && p.y <= 0) { fatal = `第 ${table.firstDataRow + i} 行包含非正坐标；对数轴只能显示正数。`; break; }
            if (['pie', 'pie3', 'pareto', 'word-cloud', 'pyramid', 'polar-line', 'polar-scatter', 'polar-bubble'].includes(spec.kind) && typeof y === 'number' && y < 0) { fatal = `第 ${table.firstDataRow + i} 行「${table.columns[yColumn]}」为负数；此图需要非负数值。`; break; }
            if ((spec.stacked || spec.kind === 'stacked-bar') && typeof y === 'number' && y < 0) { fatal = `第 ${table.firstDataRow + i} 行组成值为负数；堆叠组成需要可相加的非负数值。`; break; }
            const errorColumn = mapping.errors?.[yColumn], bound = mapping.bounds?.[yColumn];
            if (errorColumn !== undefined) {
                const error = numericCell(row[errorColumn]); if (error === null) { warn(i, `「${table.columns[yColumn]}」缺少有效误差`); continue; }
                if (error < 0) { fatal = `第 ${table.firstDataRow + i} 行误差为负数。`; break; } p.error = error;
                if (logValue && Number(y) - error <= 0) { fatal = `第 ${table.firstDataRow + i} 行误差下端非正，无法用于对数轴。`; break; }
            }
            if (bound) {
                const lower = numericCell(row[bound.lower]), upper = numericCell(row[bound.upper]);
                if (lower === null || upper === null) { warn(i, `「${table.columns[yColumn]}」缺少区间上下界`); continue; }
                if (lower > upper || Number(y) < lower || Number(y) > upper) { fatal = `第 ${table.firstDataRow + i} 行上下界错误：必须 lower ≤ Y ≤ upper。`; break; }
                if (logValue && lower <= 0) { fatal = `第 ${table.firstDataRow + i} 行区间下界非正，无法用于对数轴。`; break; }
                p.lower = lower; p.upper = upper;
            }
            if (spec.kind === 'word-cloud') {
                const weight = numericCell(row[mapping.weight!]); if (weight === null) { warn(i, '缺少有效权重'); continue; }
                if (weight < 0) { fatal = `第 ${table.firstDataRow + i} 行词频权重为负数。`; break; } p.y = weight;
            }
            if (spec.colorByValue && p.color === undefined) p.color = ['vector2', 'vector3', 'compass'].includes(spec.kind) ? Math.hypot(p.u!, p.v!, p.w ?? 0) : p.z ?? Number(p.y);
            const name = group === undefined ? table.columns[yColumn] : mapping.ys.length > 1 ? `${table.columns[yColumn]} · ${group}` : group!;
            const s = series.get(name) ?? { name, points: [] }; s.points.push(p); series.set(name, s); data.points.push(p);
        }
        if (fatal) break;
    }
    if (fatal) return fail(fatal);
    data.series = [...series.values()];
    if (!data.points.length) return fail('所绑定列没有有效观测。请检查角色和数值。');
    if (data.points.length > 40000 || data.series.length > 100) return fail('最多支持 40000 个观测点、100 个系列，请明确选择子集。');
    if (['word-cloud', 'bubble-cloud'].includes(spec.kind) && data.points.length > 300) return fail('词云 / 气泡云最多支持 300 个真实词项，请明确选择子集。');
    if (['pie', 'pie3', 'word-cloud', 'pareto'].includes(spec.kind) && !data.points.some(p => Number(p.y) > 0)) return fail('此图需要至少一个正数值。');
    if (['box', 'jitter', 'histogram', 'histogram2', 'polar-histogram'].includes(spec.kind)) {
        const groups = new Map<string, NonNullable<L1502Data['samples']>[number]>();
        for (const s of data.series) for (const p of s.points) {
            const category = histogram ? s.name : String(p.x), group = p.group ?? (mapping.ys.length > 1 ? s.name : table.columns[mapping.ys[0]]), key = JSON.stringify([category, group]);
            const sample = groups.get(key) ?? { name: histogram ? s.name : `${category} · ${group}`, category, group, values: [] };
            sample.values.push(Number(p.y)); groups.set(key, sample);
        }
        data.samples = [...groups.values()];
        if (spec.kind === 'box' && (data.samples.length > 100 || data.points.length > 10000)) return fail('箱线图最多支持 100 个类别 / 分组和 10000 个原始样本。');
        if (spec.notched) data.warnings.push('箱线缺口采用近似区间 median ± 1.57 × IQR / √n；此区间不是 p 值，也不代表精确置信检验。');
        if (spec.kind === 'jitter') data.warnings.push('横坐标为分类展示；确定性横向偏移仅防止重叠，未增加或改变样本。');
    }
    if (gridKinds.has(spec.kind) || spec.kind === 'bubble-matrix') {
        const xs = [...new Set(data.points.map(p => p.x))], ys = [...new Set(data.points.map(p => p.y))];
        if (spec.kind !== 'bubble-matrix') { xs.sort((a, b) => Number(a) - Number(b)); ys.sort((a, b) => Number(a) - Number(b)); }
        const keys = new Set<string>(), cells: NonNullable<L1502Data['matrix']>['cells'] = [];
        for (const p of data.points) {
            const key = JSON.stringify([p.x, p.y]); if (keys.has(key)) return fail(`网格坐标 (${p.x}, ${p.y}) 重复；每个坐标必须对应一条观测。`); keys.add(key);
            cells.push({ xi: xs.indexOf(p.x), yi: ys.indexOf(p.y), value: spec.kind === 'bubble-matrix' ? p.color ?? p.size! : p.z!, ...(p.size === undefined ? {} : { size: p.size }) });
        }
        if (xs.length * ys.length > 40000) return fail('网格最多支持 40000 个单元，请选择子集。');
        if (spec.kind === 'contour' && cells.length > 10000) return fail('等值线最多支持 10000 个真实网格点，请明确选择子集。');
        if (spec.kind === 'contour' && (xs.length < 2 || ys.length < 2 || cells.length !== xs.length * ys.length || data.skipped)) return fail('等值线需要完整 X × Y 数值网格，至少 2 × 2；缺失和无效坐标不能补零。');
        if (spec.kind !== 'bubble-matrix' && (xs.length < 2 || ys.length < 2)) return fail('网格的 X 和 Y 至少各需要两个不同数值坐标。');
        if (spec.kind !== 'bubble-matrix' && cells.length !== xs.length * ys.length) data.warnings.push('空间网格含缺失点；仅连接顶点全部存在的单元，缺失处保留孔洞。');
        data.matrix = { xs, ys, cells };
    }
    if (spec.kind === 'implicit-surface') {
        const xs = new Set(data.points.map(p => p.x)), ys = new Set(data.points.map(p => p.y)), zs = new Set(data.points.map(p => p.z));
        const keys = new Set(data.points.map(p => JSON.stringify([p.x, p.y, p.z])));
        if (keys.size !== data.points.length) return fail('三维标量网格含重复 XYZ 坐标。');
        if (xs.size < 2 || ys.size < 2 || zs.size < 2) return fail('等值面 XYZ 每个轴至少需要两个不同坐标；Color 为真实标量值。');
        if (xs.size * ys.size * zs.size !== data.points.length) data.warnings.push('三维标量网格有缺失；仅从完整立方单元提取等值面，缺失处保留孔洞。');
    }
    if (data.skipped) data.warnings.push(`共略过 ${data.skipped} 个缺失或无效观测；保留其余全部真实观测。`);
    return { data, error: null };
}
