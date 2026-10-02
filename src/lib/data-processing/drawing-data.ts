import {
    buildTemplateData, suggestMapping, numericCell,
    type ColumnMapping, type DataTable, type ErrorInput, type ErrorMeasure,
    type TemplateId, type TemplateResult, type TemplateSeries,
} from './templates.ts';
import type { SampleGroup } from './distributions.ts';
import type { PaperChartVariant } from './drawing-spec.ts';

const isLongGrouped = (variant?: PaperChartVariant) => ['grouped-box', 'embedding-scatter', 'position-scatter', 'paired-correlation'].includes(variant ?? '');
const validColumn = (table: DataTable, index: unknown): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < table.columns.length;
const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';
const label = (value: unknown) => present(value) ? String(value).trim() : null;
const emptyRow = (row: unknown[]) => row.every(value => !present(value));
const fail = (error: string): TemplateResult => ({ data: null, error });

/** Suggestions are editable and never sort observations or infer statistical groups. */
export function suggestDrawingMapping(table: DataTable, chartId: TemplateId, variant?: PaperChartVariant, panelChart: 'bar' | 'line' = 'bar'): ColumnMapping {
    const fallback = suggestMapping(table, chartId, panelChart);
    if (!isLongGrouped(variant)) return fallback;
    const columns = table.columns.map((name, index) => ({ name, index }));
    const numeric = columns.filter(column => table.rows.some(row => numericCell(row[column.index]) !== null));
    const group = columns.find(column => /^(?:group|series|condition|cohort)(?:\b|\s|$)|组别|分组|条件|队列|实验组|样本组/i.test(column.name))?.index;
    let x: number;
    if (variant === 'embedding-scatter') x = numeric.find(column => /^(?:x|dim(?:ension)?\s*1|pc\s*1|umap\s*1|tsne\s*1|嵌入\s*x)(?:\b|\s|$)/i.test(column.name))?.index ?? numeric.find(column => column.index !== group)?.index ?? fallback.x;
    else x = columns.find(column => column.index !== group && /category|model|object|position|类别|模型|对象|位置|名称/i.test(column.name))?.index ?? columns.find(column => column.index !== group && !numeric.some(number => number.index === column.index))?.index ?? fallback.x;
    const ys = numeric.filter(column => column.index !== x && column.index !== group).map(column => column.index).slice(0, variant === 'paired-correlation' ? 2 : 1);
    const inferredGroup = group ?? columns.find(column => column.index !== x && !ys.includes(column.index) && !numeric.some(number => number.index === column.index))?.index;
    return { x, ys, errors: {}, ...(inferredGroup === undefined ? {} : { group: inferredGroup }) };
}

export function buildDrawingData(table: DataTable, mapping: ColumnMapping, chartId: TemplateId, variant?: PaperChartVariant, input: ErrorInput = 'replicates', measure: ErrorMeasure = 'SD', panelChart: 'bar' | 'line' = 'bar'): TemplateResult {
    if (chartId === 'heatmap') return buildMatrixData(table, mapping, variant);
    if (!isLongGrouped(variant)) {
        const result = buildTemplateData(table, mapping, chartId, input, measure, panelChart);
        if (!result.data) return result;
        if (variant === 'stacked-area' && result.data.series.some(series => series.values.some(value => value < 0))) return fail('堆叠面积图用于可相加的非负组成；所选数据包含负数，请改用普通折线或其他适合差值的图式。');
        if (variant === 'filled-distribution' && result.data.series.length < 2) return fail('填充分布对比至少需要两列不同的 Y 数据。');
        return result;
    }
    if (!table.rows.length) return fail('表格中没有数据，请导入文件或载入示例。');
    if (!validColumn(table, mapping.x)) return fail('请选择有效的 X 轴或类别列。');
    const requiredY = variant === 'paired-correlation' ? 2 : 1;
    if (mapping.ys.length !== requiredY || new Set(mapping.ys).size !== requiredY || mapping.ys.some(index => !validColumn(table, index) || index === mapping.x)) return fail(requiredY === 2 ? '成对比较需要类别列与恰好两列不同的数值指标。' : '请选择一列 X / 类别与一列不同的样本数值。');
    const needsGroup = variant === 'grouped-box' || variant === 'paired-correlation';
    if (needsGroup && mapping.group === undefined) return fail('请选择分组 / 条件列。');
    if (mapping.group !== undefined && (!validColumn(table, mapping.group) || mapping.group === mapping.x || mapping.ys.includes(mapping.group))) return fail('分组 / 条件列应独立于 X 与数值列。');
    if (variant === 'grouped-box') return buildGroupedBox(table, mapping);
    if (variant === 'paired-correlation') return buildPairedComparison(table, mapping);
    return buildPointGroups(table, mapping, variant === 'embedding-scatter');
}

/** A blank matrix entry is a missing cell, not an absent row and never a zero. */
function buildMatrixData(table: DataTable, mapping: ColumnMapping, variant?: PaperChartVariant): TemplateResult {
    if (!table.rows.length) return fail('表格中没有数据，请导入文件或载入示例。');
    if (!validColumn(table, mapping.x)) return fail('请选择有效的矩阵行标签列。');
    if (!mapping.ys.length || new Set(mapping.ys).size !== mapping.ys.length || mapping.ys.some(index => !validColumn(table, index) || index === mapping.x)) return fail('请选择独立于行标签的矩阵数值列，数值列不能重复。');
    const density = variant === 'density-heatmap';
    const nonnegative = density || variant === 'frequency-heatmap';
    const columnCoordinates = density ? mapping.ys.map(index => numericCell(table.columns[index])) : null;
    if (columnCoordinates && (columnCoordinates.some(value => value === null) || new Set(columnCoordinates).size !== columnCoordinates.length)) return fail('密度热图的列名称必须为不重复的有限数值坐标。');
    const rowLabels: (number | string)[] = [], rowKeys = new Set<number | string>(), cells: [number, number, number][] = [];
    const warnings: string[] = []; let skipped = 0, missingCells = 0, invalidCells = 0;
    for (let index = 0; index < table.rows.length; index++) {
        const row = table.rows[index]; if (emptyRow(row)) continue;
        const raw = row[mapping.x], rowLabel = density ? numericCell(raw) : label(raw);
        if (rowLabel === null) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行缺少有效${density ? '数值坐标' : '行标签'}，已跳过。`); continue; }
        if (rowKeys.has(rowLabel)) return fail(`矩阵行${density ? '坐标' : '标签'}「${rowLabel}」重复，请确保每行唯一。`);
        rowKeys.add(rowLabel); const rowIndex = rowLabels.length; rowLabels.push(rowLabel);
        for (let column = 0; column < mapping.ys.length; column++) {
            const cell = row[mapping.ys[column]], value = numericCell(cell);
            if (value === null) {
                if (!present(cell)) missingCells++; else invalidCells++;
                if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行「${table.columns[mapping.ys[column]]}」为${present(cell) ? '非有效数值' : '空白'}，仅略过该单元格，不填零。`);
                continue;
            }
            if (nonnegative && value < 0) return fail(`第 ${table.firstDataRow + index} 行「${table.columns[mapping.ys[column]]}」为负数；当前热图需要非负数值。`);
            cells.push([column, rowIndex, value]);
        }
    }
    if (!cells.length) return fail('所选矩阵没有有效数值单元格。');
    if (rowLabels.length * mapping.ys.length > 40000) return fail('矩阵最多支持 40000 个可能单元格，请选择子集。');
    if (missingCells || invalidCells) warnings.push(`已略过 ${missingCells + invalidCells} 个单元格（空白 ${missingCells} 个，非数值 ${invalidCells} 个）；其余有效单元格与真实零值保留。`);
    return { data: { x: rowLabels, series: mapping.ys.map((column, index) => ({ name: density ? String(columnCoordinates![index]) : table.columns[column], values: [] })), matrixCells: cells, skipped, skippedCells: missingCells + invalidCells, warnings }, error: null };
}

function buildPointGroups(table: DataTable, mapping: ColumnMapping, numericX: boolean): TemplateResult {
    const groups = new Map<string, [number | string, number][]>(), x: (number | string)[] = [], values: number[] = [], warnings: string[] = [];
    let skipped = 0;
    table.rows.forEach((row, index) => {
        if (emptyRow(row)) return;
        const coordinate = numericX ? numericCell(row[mapping.x]) : label(row[mapping.x]);
        const value = numericCell(row[mapping.ys[0]]), name = mapping.group === undefined ? table.columns[mapping.ys[0]] : label(row[mapping.group]);
        if (coordinate === null || value === null || !name) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行缺少有效坐标、数值或分组，已跳过，不填补。`); return; }
        const points = groups.get(name) ?? []; points.push([coordinate, value]); groups.set(name, points);
        x.push(coordinate); values.push(value);
    });
    if (!x.length) return fail('所选列没有有效观测点。');
    if (x.length > 20000 || groups.size > 100) return fail('分组散点最多支持 20000 个观测、100 组，请选择子集。');
    return { data: { x, series: [{ name: table.columns[mapping.ys[0]], values }], pointGroups: [...groups].map(([name, points]) => ({ name, points })), skipped, warnings }, error: null };
}

function buildGroupedBox(table: DataTable, mapping: ColumnMapping): TemplateResult {
    const groups = new Map<string, SampleGroup>(), categories = new Set<string>(), series = new Set<string>(), warnings: string[] = [];
    let skipped = 0, count = 0;
    table.rows.forEach((row, index) => {
        if (emptyRow(row)) return;
        const category = label(row[mapping.x]), name = label(row[mapping.group!]), value = numericCell(row[mapping.ys[0]]);
        if (category === null || name === null || value === null) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行缺少类别、分组或真实样本值，已跳过。`); return; }
        const key = JSON.stringify([category, name]);
        const group: SampleGroup = groups.get(key) ?? { name: `${category} · ${name}`, category, series: name, values: [] };
        group.values.push(value); groups.set(key, group); categories.add(category); series.add(name); count++;
    });
    if (!count) return fail('所选列没有有效分组样本。');
    if (count > 6000 || groups.size > 40) return fail('分组箱线最多支持 6000 个原始样本、40 个类别 / 系列组合，请选择子集。');
    return { data: { x: [...categories], series: [...series].map(name => ({ name, values: [] })), samples: [...groups.values()], skipped, warnings }, error: null };
}

function buildPairedComparison(table: DataTable, mapping: ColumnMapping): TemplateResult {
    type WorkingGroup = { name: string; x: (number | string)[]; series: TemplateSeries[]; keys: Set<string> };
    const groups = new Map<string, WorkingGroup>(), allObjects = new Set<string>(), warnings: string[] = [];
    let skipped = 0;
    for (let index = 0; index < table.rows.length; index++) {
        const row = table.rows[index]; if (emptyRow(row)) continue;
        const object = label(row[mapping.x]), condition = label(row[mapping.group!]), values = mapping.ys.map(column => numericCell(row[column]));
        if (object === null || condition === null || values.some(value => value === null)) { skipped++; if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + index} 行缺少对象、条件或有效指标，已跳过，不填补。`); continue; }
        const group: WorkingGroup = groups.get(condition) ?? { name: condition, x: [], series: mapping.ys.map(column => ({ name: table.columns[column], values: [] })), keys: new Set<string>() };
        if (group.keys.has(object)) return fail(`条件「${condition}」内对象「${object}」重复；成对比较要求每个条件每个对象一行。`);
        group.keys.add(object); group.x.push(object); group.series.forEach((item, position) => item.values.push(values[position]!)); groups.set(condition, group); allObjects.add(object);
    }
    if (groups.size !== 2) return fail('成对比较需要恰好两种有效条件，请绑定包含两种条件的分组列。');
    const conditions = [...groups.values()];
    for (const group of conditions) {
        const missing = [...allObjects].filter(object => !group.keys.has(object));
        if (missing.length) warnings.push(`条件「${group.name}」缺少 ${missing.length} 个对象的配对：${missing.slice(0, 8).join('、')}${missing.length > 8 ? '…' : ''}。保留各组已有数据，不补造或调整对象位置。`);
    }
    if (allObjects.size > 1000) return fail('成对比较最多支持 1000 个不同对象，请选择子集。');
    return { data: { x: [...allObjects], series: mapping.ys.map(column => ({ name: table.columns[column], values: [] })), comparisonGroups: conditions.map(({ name, x, series }) => ({ name, x, series })), skipped, warnings }, error: null };
}
