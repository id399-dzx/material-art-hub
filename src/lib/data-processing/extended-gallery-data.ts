import type { ColumnMapping, DataTable, TemplateData, TemplateId, TemplateResult } from './templates.ts';

export const EXTENDED_GALLERY_IDS = ['waterfall-2d', 'sankey', 'funnel', 'treemap', 'sunburst', 'correlation-matrix', 'confusion-matrix', 'calendar-heatmap'] as const;
export type ExtendedGalleryId = typeof EXTENDED_GALLERY_IDS[number];
export type HierarchyDatum = { name: string; value: number; children?: HierarchyDatum[] };
export const isExtendedGalleryId = (id: string): id is ExtendedGalleryId => (EXTENDED_GALLERY_IDS as readonly string[]).includes(id);
const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';
const numeric = (value: unknown): number | null => {
    if (!present(value) || typeof value !== 'number' && typeof value !== 'string') return null;
    const number = Number(value); return Number.isFinite(number) ? number : null;
};
const fail = (error: string): TemplateResult => ({ data: null, error });
const successful = (data: Omit<TemplateData, 'skipped' | 'warnings'>): TemplateResult => ({ data: { ...data, skipped: 0, warnings: [] }, error: null });
const rowsWithData = (table: DataTable) => table.rows.map((row, index) => ({ row, line: table.firstDataRow + index })).filter(({ row }) => row.some(present));

/** These templates consume measured values or explicitly supplied summaries, never fabricated observations. */
export function buildExtendedGalleryData(table: DataTable, mapping: ColumnMapping, id: TemplateId): TemplateResult | null {
    if (!isExtendedGalleryId(id)) return null;
    if (!table.rows.length) return fail('表格中没有数据，请导入文件或载入示例。');
    const validColumn = (column: number) => Number.isInteger(column) && column >= 0 && column < table.columns.length;
    if (!validColumn(mapping.x) || !mapping.ys.length || mapping.ys.some(column => !validColumn(column) || column === mapping.x) || new Set(mapping.ys).size !== mapping.ys.length) return fail('请选择独立有效的名称列与数值列。');
    if (id === 'correlation-matrix' || id === 'confusion-matrix') return buildSemanticMatrix(table, mapping, id);
    if (id === 'sankey') return buildSankey(table, mapping);
    if (mapping.ys.length !== 1) return fail('当前图式需要恰好一列数值，请取消额外的数据列。');
    if (id === 'treemap' || id === 'sunburst') return buildHierarchy(table, mapping);
    if (id === 'calendar-heatmap') return buildCalendar(table, mapping);
    const x: string[] = [], values: number[] = [];
    for (const { row, line } of rowsWithData(table)) {
        const value = numeric(row[mapping.ys[0]]), name = present(row[mapping.x]) ? String(row[mapping.x]).trim() : '';
        if (!name || value === null) return fail(`第 ${line} 行缺少类别名称或有限数值，请修正后绘图。`);
        if (id === 'funnel' && value < 0) return fail(`第 ${line} 行为负数；漏斗各阶段需要非负数值。`);
        x.push(name); values.push(value);
    }
    if (!x.length) return fail('所选列没有有效数据。');
    if (x.length > 100) return fail('当前图式最多支持 100 个阶段，请选择子集。');
    if (id === 'funnel' && values.every(value => value === 0)) return fail('漏斗需要至少一个大于零的阶段；不会把零值替换为其他数值。');
    if (id === 'waterfall-2d') {
        let total = 0;
        for (const value of values) { total += value; if (!Number.isFinite(total)) return fail('累积数值超出有限范围，请调整数据单位。'); }
    }
    return successful({ x, series: [{ name: table.columns[mapping.ys[0]], values }] });
}

function buildSankey(table: DataTable, mapping: ColumnMapping): TemplateResult {
    if (mapping.ys.length !== 2) return fail('桑基图需要分别绑定终点列与流量列，流量为必填正数。');
    const nodes = new Set<string>(), edges: { source: string; target: string; weight: number }[] = [];
    for (const { row, line } of rowsWithData(table)) {
        const source = present(row[mapping.x]) ? String(row[mapping.x]).trim() : '';
        const target = present(row[mapping.ys[0]]) ? String(row[mapping.ys[0]]).trim() : '';
        const weight = numeric(row[mapping.ys[1]]);
        if (!source || !target || weight === null || weight <= 0) return fail(`第 ${line} 行需要起点、终点与大于零的有限流量。`);
        if (source === target) return fail(`第 ${line} 行形成自循环；桑基图需要无环的流向。`);
        nodes.add(source); nodes.add(target); edges.push({ source, target, weight });
    }
    if (!edges.length) return fail('没有有效流向数据。');
    if (nodes.size > 100 || edges.length > 500) return fail('桑基图最多支持 100 个节点与 500 条连接。');
    const incoming = new Map([...nodes].map(name => [name, 0]));
    for (const edge of edges) incoming.set(edge.target, incoming.get(edge.target)! + 1);
    const queue = [...nodes].filter(name => incoming.get(name) === 0); let visited = 0;
    while (queue.length) {
        const source = queue.shift()!; visited++;
        for (const edge of edges.filter(edge => edge.source === source)) {
            incoming.set(edge.target, incoming.get(edge.target)! - 1);
            if (incoming.get(edge.target) === 0) queue.push(edge.target);
        }
    }
    if (visited !== nodes.size) return fail('流向中存在循环，请检查起点与终点；桑基图仅支持无环网络。');
    for (const name of nodes) {
        const outgoing = edges.filter(edge => edge.source === name).reduce((sum, edge) => sum + edge.weight, 0);
        const arriving = edges.filter(edge => edge.target === name).reduce((sum, edge) => sum + edge.weight, 0);
        if (!Number.isFinite(outgoing) || !Number.isFinite(arriving)) return fail('节点流量合计超出有限范围，请调整单位。');
    }
    return successful({ x: [...nodes], series: [], edges });
}

function buildHierarchy(table: DataTable, mapping: ColumnMapping): TemplateResult {
    const leaves: { path: string[]; value: number; key: string }[] = [], keys = new Set<string>();
    for (const { row, line } of rowsWithData(table)) {
        const raw = present(row[mapping.x]) ? String(row[mapping.x]).trim() : '', value = numeric(row[mapping.ys[0]]);
        const path = raw.split('/').map(part => part.trim());
        if (!raw || path.some(part => !part) || value === null || value < 0) return fail(`第 ${line} 行需要有效分类路径与非负数值；路径用 / 分隔，不能有空层级。`);
        if (path.length > 8) return fail(`第 ${line} 行的分类路径超过 8 层，请精简层级。`);
        const key = path.join('/');
        if (keys.has(key)) return fail(`分类路径「${key}」重复，请先汇总为每个叶节点一行。`);
        keys.add(key); leaves.push({ path, value, key });
    }
    if (!leaves.length) return fail('没有有效的分类路径。');
    if (leaves.length > 2000) return fail('层级图最多支持 2000 个叶节点，请选择子集。');
    for (const leaf of leaves) for (let length = 1; length < leaf.path.length; length++) {
        if (keys.has(leaf.path.slice(0, length).join('/'))) return fail(`「${leaf.path.slice(0, length).join('/')}」同时作为父节点与叶节点输入，会重复计数；请仅输入最末级分类。`);
    }
    const roots: HierarchyDatum[] = [];
    for (const leaf of leaves) {
        let siblings = roots;
        leaf.path.forEach((name, index) => {
            let node = siblings.find(item => item.name === name);
            if (!node) { node = { name, value: 0 }; siblings.push(node); }
            node.value += leaf.value;
            if (index < leaf.path.length - 1) { node.children ??= []; siblings = node.children; }
        });
    }
    if (roots.some(root => !Number.isFinite(root.value)) || !Number.isFinite(roots.reduce((sum, root) => sum + root.value, 0))) return fail('分类合计超出有限范围，请调整数值单位。');
    if (roots.every(root => root.value === 0)) return fail('层级图需要至少一个大于零的叶节点；零值仍保留在数据中。');
    return successful({ x: leaves.map(leaf => leaf.key), series: [{ name: table.columns[mapping.ys[0]], values: leaves.map(leaf => leaf.value) }], hierarchy: roots });
}

function buildSemanticMatrix(table: DataTable, mapping: ColumnMapping, id: 'correlation-matrix' | 'confusion-matrix'): TemplateResult {
    const columns = mapping.ys.map(column => table.columns[column]);
    if (new Set(columns).size !== columns.length || columns.length > 100) return fail('矩阵列名称必须唯一，且最多 100 列。');
    const byName = new Map<string, number[]>();
    for (const { row, line } of rowsWithData(table)) {
        const name = present(row[mapping.x]) ? String(row[mapping.x]).trim() : '';
        if (!name || byName.has(name)) return fail(`第 ${line} 行的矩阵标签缺失或重复。`);
        const values = mapping.ys.map(column => numeric(row[column]));
        if (values.some(value => value === null)) return fail(`第 ${line} 行有缺失或非数值单元格；当前矩阵需完整输入，不补零。`);
        if (id === 'correlation-matrix' && values.some(value => value! < -1 || value! > 1)) return fail(`第 ${line} 行包含超出 −1 到 1 的相关系数。`);
        if (id === 'confusion-matrix' && values.some(value => value! < 0 || !Number.isSafeInteger(value))) return fail(`第 ${line} 行包含负数或非整数；混淆矩阵需输入真实计数。`);
        byName.set(name, values as number[]);
    }
    if (byName.size !== columns.length || columns.some(name => !byName.has(name))) return fail('矩阵需为方阵，行标签与所选数值列名称应完全对应。');
    if (id === 'correlation-matrix') {
        for (let row = 0; row < columns.length; row++) {
            const values = byName.get(columns[row])!;
            if (Math.abs(values[row] - 1) > 1e-6) return fail(`相关矩阵「${columns[row]}」的对角线系数应为 1。`);
            for (let column = 0; column < row; column++) {
                if (Math.abs(values[column] - byName.get(columns[column])![row]) > 1e-6) return fail('相关矩阵不对称，请核对已计算的系数；不会自动平均或修正。');
            }
        }
    }
    const matrixCells: [number, number, number][] = columns.flatMap((name, row) => byName.get(name)!.map((value, column) => [column, row, value] as [number, number, number]));
    return successful({ x: columns, series: columns.map(name => ({ name, values: [] })), matrixCells });
}

export function calendarDateTimestamp(value: unknown): number | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function buildCalendar(table: DataTable, mapping: ColumnMapping): TemplateResult {
    const x: string[] = [], values: number[] = [], days: number[] = [], seen = new Set<string>();
    for (const { row, line } of rowsWithData(table)) {
        const date = present(row[mapping.x]) ? String(row[mapping.x]).trim() : '', value = numeric(row[mapping.ys[0]]), day = calendarDateTimestamp(date);
        if (day === null || value === null) return fail(`第 ${line} 行需使用有效 YYYY-MM-DD 日期和有限数值，例如 2026-01-08。`);
        if (seen.has(date)) return fail(`日期「${date}」重复，请先汇总为每天一行。`);
        seen.add(date); x.push(date); values.push(value); days.push(day);
    }
    if (!x.length) return fail('没有有效日期与观测值。');
    if ((Math.max(...days) - Math.min(...days)) / 86400000 >= 366) return fail('单张日历最多覆盖 366 天，请选择一年以内的数据。');
    return successful({ x, series: [{ name: table.columns[mapping.ys[0]], values }] });
}
