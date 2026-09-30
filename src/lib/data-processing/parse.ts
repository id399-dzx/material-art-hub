/** The two supported layouts for a worksheet containing paired X/Y values. */
export type XYOrientation = 'row-pairs' | 'two-rows';
export type XYOrientationChoice = XYOrientation | 'auto';

export interface ParsedXYData {
    x: number[];
    y: number[];
    orientation: XYOrientation;
    /** Number of unusable X/Y pairs, including a skipped header pair. */
    skippedCount: number;
    warnings: string[];
}

type Matrix = ReadonlyArray<ReadonlyArray<unknown>>;

const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!NUMERIC_TEXT.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasContent(value: unknown): boolean {
    return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
}

function isLikelyHeader(x: unknown, y: unknown): boolean {
    return [x, y].every(value =>
        typeof value === 'string' &&
        hasContent(value) &&
        finiteNumber(value) === null &&
        /[A-Za-z\u3400-\u9fff]/.test(value)
    );
}

function chooseOrientation(rows: Matrix): XYOrientation {
    const populatedRows = rows.filter(row => row.some(hasContent));
    const firstTwoWidths = populatedRows.slice(0, 2).map(row => row.length);

    // Two populated, wide rows are the familiar horizontal X-row/Y-row layout.
    // For a two-column matrix, including a short CSV, keep X/Y together by row.
    if (populatedRows.length === 2 && Math.max(0, ...firstTwoWidths) > 2) {
        return 'two-rows';
    }
    return 'row-pairs';
}

/**
 * Parse the matrix produced by `xlsx.utils.sheet_to_json(sheet, { header: 1 })`.
 * Each X/Y pair is accepted or rejected as a unit, so a missing cell never shifts
 * later values onto a different point. The default layout detection favors two
 * columns; callers can explicitly choose either layout when the sheet is unusual.
 */
export function parseXYMatrix(rows: Matrix, orientation: XYOrientationChoice = 'auto'): ParsedXYData {
    if (!Array.isArray(rows) || rows.some(row => !Array.isArray(row))) {
        throw new Error('表格格式无效：需要按行排列的单元格数据。');
    }

    const detected: XYOrientation = orientation === 'auto' ? chooseOrientation(rows) : orientation;
    const x: number[] = [];
    const y: number[] = [];
    const invalidLocations: string[] = [];
    let headerCount = 0;
    let skippedCount = 0;
    let firstPopulatedPairSeen = false;

    const addPair = (rawX: unknown, rawY: unknown, location: string) => {
        if (!hasContent(rawX) && !hasContent(rawY)) return;

        const parsedX = finiteNumber(rawX);
        const parsedY = finiteNumber(rawY);
        if (parsedX !== null && parsedY !== null) {
            x.push(parsedX);
            y.push(parsedY);
        } else {
            skippedCount += 1;
            if (!firstPopulatedPairSeen && isLikelyHeader(rawX, rawY)) {
                headerCount += 1;
            } else {
                invalidLocations.push(location);
            }
        }
        firstPopulatedPairSeen = true;
    };

    if (detected === 'row-pairs') {
        rows.forEach((row, index) => addPair(row[0], row[1], `第 ${index + 1} 行`));
    } else {
        const populated = rows
            .map((row, index) => ({ row, index }))
            .filter(item => item.row.some(hasContent));
        const first = populated[0];
        const second = populated[1];
        const width = Math.max(first?.row.length ?? 0, second?.row.length ?? 0);

        for (let column = 0; column < width; column++) {
            addPair(first?.row[column], second?.row[column], `第 ${column + 1} 列`);
        }
    }

    if (x.length < 2) {
        const layout = detected === 'row-pairs' ? '逐行两列' : '前两行';
        throw new Error(`按“${layout}”读取后，少于 2 组有效的 X/Y 数值。请检查表格方向、表头和空值。`);
    }

    const warnings: string[] = [];
    const populatedRows = rows.filter(row => row.some(hasContent));
    if (orientation === 'auto' && populatedRows.length === 2 && populatedRows.every(row => row.length === 2)) {
        warnings.push('2×2 表格的方向无法自动确认，已按逐行两列读取。');
    }
    if (headerCount > 0) warnings.push('已跳过 1 组表头。');
    if (invalidLocations.length > 0) {
        const examples = invalidLocations.slice(0, 3).join('、');
        warnings.push(`已跳过 ${invalidLocations.length} 组缺失或非数值的 X/Y 数据（${examples}${invalidLocations.length > 3 ? '等' : ''}）。`);
    }
    if (detected === 'two-rows' && populatedRows.length > 2) {
        warnings.push('按前两行读取；其余非空行未用于绘图。');
    }

    return { x, y, orientation: detected, skippedCount, warnings };
}
