export type TemplateId = "line" | "grouped-bar" | "error-bar";
export type ErrorMeasure = "SD" | "SEM";
export type ErrorInput = "replicates" | "summary";
export type TableCell = string | number | null;
export type DataTable = { columns: string[]; rows: TableCell[][]; firstDataRow: number };
export type ColumnMapping = { x: number; ys: number[]; errors: Record<number, number> };
export type TemplateSeries = { name: string; values: number[]; errors?: number[]; sampleSizes?: number[] };
export type TemplateData = { x: (number | string)[]; series: TemplateSeries[]; skipped: number; warnings: string[] };
export type TemplateResult = { data: TemplateData | null; error: string | null };

export const CHART_TEMPLATES: {
    id: TemplateId; name: string; english: string; description: string; requirement: string;
    tag: string; xLabel: string; yLabel: string; demo: TableCell[][];
}[] = [
    {
        id: "line", name: "多组折线图", english: "MULTI-SERIES LINE", tag: "趋势与曲线",
        description: "让变化有迹可循，清晰比较不同样品的实验曲线。",
        requirement: "1 列数值 X ＋ 1 列或多列 Y", xLabel: "循环次数", yLabel: "容量保持率 (%)",
        demo: [["循环次数", "样品 A", "样品 B", "样品 C"], [0, 100, 100, 100], [20, 98, 96, 95], [40, 96, 91, 89], [60, 94, 86, 82], [80, 92, 81, 76], [100, 90, 76, 70]],
    },
    {
        id: "grouped-bar", name: "分组柱状图", english: "GROUPED COMPARISON", tag: "多组比较",
        description: "并排呈现多组结果，让实验条件之间的差异一目了然。",
        requirement: "1 列类别 ＋ 1 列或多列数值", xLabel: "测试条件", yLabel: "比容量 (mAh/g)",
        demo: [["测试条件", "样品 A", "样品 B", "样品 C"], ["0.2 C", 158, 143, 129], ["0.5 C", 146, 131, 117], ["1 C", 132, 115, 103], ["2 C", 115, 98, 84]],
    },
    {
        id: "error-bar", name: "均值与误差条", english: "MEAN & UNCERTAINTY", tag: "重复实验",
        description: "同时表达实验均值与波动，明确标注 SD 或 SEM。",
        requirement: "类别 ＋ 重复实验列，或均值 ＋ 误差列", xLabel: "样品", yLabel: "测试结果",
        demo: [["样品", "重复 1", "重复 2", "重复 3"], ["样品 A", 132, 140, 136], ["样品 B", 155, 147, 151], ["样品 C", 164, 172, 168], ["样品 D", 180, 170, 175]],
    },
];

export function numericCell(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
}

export function parseTemplateTable(matrix: unknown[][], hasHeader = true): DataTable {
    const nonempty = matrix.map((row, index) => ({ row, index })).filter(({ row }) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ""));
    if (!nonempty.length) return { columns: [], rows: [], firstDataRow: hasHeader ? 2 : 1 };
    const width = nonempty.reduce((maximum, { row }) => Math.max(maximum, row.length), 0);
    const names = new Map<string, number>();
    const columns = Array.from({ length: width }, (_, index) => {
        const name = hasHeader ? String(nonempty[0].row[index] ?? "").trim() || `第 ${index + 1} 列` : `第 ${index + 1} 列`;
        const count = (names.get(name) ?? 0) + 1;
        names.set(name, count);
        return count === 1 ? name : `${name} (${count})`;
    });
    // Preserve blank rows inside the table, so warnings retain original row numbers.
    const start = nonempty[0].index + (hasHeader ? 1 : 0);
    return {
        columns,
        firstDataRow: start + 1,
        rows: matrix.slice(start).map(row => Array.from({ length: width }, (_, index) => {
            const value = row[index];
            return value === null || value === undefined ? null : typeof value === "number" ? value : String(value).trim();
        })),
    };
}

export function suggestMapping(table: DataTable, template: TemplateId): ColumnMapping {
    const numeric = table.columns.map((_, index) => index).filter(index => table.rows.some(row => numericCell(row[index]) !== null));
    const x = template === "line" ? numeric[0] ?? 0 : 0;
    const errorIndices = table.columns.map((name, index) => /\b(?:sd|sem|std|error)\b|标准差|标准误|误差/i.test(name) ? index : -1).filter(index => index >= 0);
    const ys = numeric.filter(index => index !== x && !errorIndices.includes(index));
    const errors: Record<number, number> = {};
    ys.forEach((y, index) => { if (errorIndices[index] !== undefined) errors[y] = errorIndices[index]; });
    return { x, ys, errors };
}

export function sampleStatistics(values: number[], measure: ErrorMeasure) {
    if (values.length < 2 || values.some(value => !Number.isFinite(value))) throw new Error("每组至少需要 2 个有效重复实验值。");
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    return { mean, error: measure === "SD" ? sd : sd / Math.sqrt(values.length), n: values.length };
}

export function buildTemplateData(table: DataTable, mapping: ColumnMapping, template: TemplateId, input: ErrorInput = "replicates", measure: ErrorMeasure = "SD"): TemplateResult {
    const fail = (error: string): TemplateResult => ({ data: null, error });
    if (!table.rows.length) return fail("表格中没有数据，请导入文件或载入示例。");
    if (!Number.isInteger(mapping.x) || !table.columns[mapping.x]) return fail("请选择有效的 X 轴或类别列。");
    if (!mapping.ys.length) return fail("至少选择 1 列 Y 数据。");
    if (new Set(mapping.ys).size !== mapping.ys.length || mapping.ys.some(index => !Number.isInteger(index) || !table.columns[index] || index === mapping.x)) return fail("X 列和 Y 列需要分别选择，且 Y 列不能重复。");
    const repeats = template === "error-bar" && input === "replicates";
    if (repeats && mapping.ys.length < 2) return fail("计算 SD 或 SEM 至少需要选择 2 列重复实验数据。");
    if (template === "error-bar" && input === "summary" && mapping.ys.some(y => !Number.isInteger(mapping.errors[y]) || !table.columns[mapping.errors[y]] || mapping.errors[y] === mapping.x || mapping.ys.includes(mapping.errors[y]))) return fail("请为每组均值绑定独立的误差列。");

    const series: TemplateSeries[] = repeats ? [{ name: "实验均值", values: [], errors: [], sampleSizes: [] }] : mapping.ys.map(index => ({ name: table.columns[index], values: [], ...(template === "error-bar" ? { errors: [] } : {}) }));
    const xValues: (string | number)[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    const categories = new Set<string>();
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const row = table.rows[rowIndex];
        if (row.every(value => value === null || value === "")) continue;
        const rawX = row[mapping.x];
        const x = template === "line" ? numericCell(rawX) : rawX === null || rawX === "" ? null : String(rawX);
        const values = mapping.ys.map(index => numericCell(row[index]));
        const errors = template === "error-bar" && !repeats ? mapping.ys.map(y => numericCell(row[mapping.errors[y]])) : [];
        const invalid = x === null || values.some(value => value === null) || errors.some(value => value === null || value < 0);
        if (invalid) {
            skipped++;
            if (warnings.length < 5) warnings.push(`第 ${table.firstDataRow + rowIndex} 行含空值、非数值或负误差，已整行跳过。`);
            continue;
        }
        if (template !== "line" && categories.has(String(x))) return fail(`类别「${x}」重复。请先汇总为每个类别一行，再选择重复实验列或均值与误差列。`);
        categories.add(String(x));
        xValues.push(x!);
        if (repeats) {
            const stats = sampleStatistics(values as number[], measure);
            series[0].values.push(stats.mean);
            series[0].errors!.push(stats.error);
            series[0].sampleSizes!.push(stats.n);
        } else {
            series.forEach((item, index) => {
                item.values.push(values[index]!);
                if (item.errors) item.errors.push(errors[index]!);
            });
        }
    }
    if (!xValues.length) return fail("所选列没有可绘制的完整数据。请检查列绑定和数值格式；误差值应为非负数。");
    return { data: { x: xValues, series, skipped, warnings }, error: null };
}

export function matrixToCsv(matrix: TableCell[][]): string {
    return "\uFEFF" + matrix.map(row => row.map(cell => {
        const text = String(cell ?? "");
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(",")).join("\r\n");
}
