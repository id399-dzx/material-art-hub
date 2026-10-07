import { DRAWING_TEMPLATES } from './drawing-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import type { L1502Mapping, L1502Style } from './l1502-spec.ts';
import type { ExportSettings } from './publication.ts';
import { SCALAR_PALETTES } from './chart-palettes.ts';

export type L1502Source = { name: string; kind: 'demo' | 'file'; sheets: { name: string; matrix: unknown[][] }[] };
export type L1502EditSnapshot = {
    kind: 'l1502'; version: 1; presetId: string; source: L1502Source;
    sheetIndex: number; hasHeader: boolean; mapping: L1502Mapping;
    style: L1502Style; logX: boolean; logY: boolean; caption: string; exportSettings: ExportSettings;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const within = (value: unknown, min: number, max: number) => finite(value) && value >= min && value <= max;
const text = (value: unknown, max = 10000): value is string => typeof value === 'string' && value.length <= max;
const fail = (message: string): never => { throw new Error(`无法恢复图例：${message}`); };

export function validateL1502EditSnapshot(value: unknown): L1502EditSnapshot {
    if (!record(value) || value.kind !== 'l1502' || value.version !== 1) return fail('不支持的编辑记录。');
    if (!DRAWING_TEMPLATES.some(template => template.id === value.presetId && template.l1502)) return fail('模板不存在。');
    if (!record(value.source)) return fail('原始数据缺失。');
    const source = value.source;
    if (!text(source.name, 1000) || !['demo', 'file'].includes(source.kind as string) || !Array.isArray(source.sheets) || source.sheets.length < 1 || source.sheets.length > 100) return fail('工作表格式无效。');
    let cells = 0;
    for (const sheet of source.sheets) {
        if (!record(sheet) || !text(sheet.name, 1000) || !Array.isArray(sheet.matrix) || sheet.matrix.length > 100000) return fail('工作表大小或名称无效。');
        for (const row of sheet.matrix) {
            if (!Array.isArray(row) || row.length > 2048) return fail('工作表列数无效。');
            cells += row.length;
            if (cells > 2000000 || !row.every(cell => cell === null || cell === undefined || typeof cell === 'boolean' || finite(cell) || text(cell, 32767))) return fail('单元格内容或数量无效。');
        }
    }
    if (!Number.isInteger(value.sheetIndex) || !within(value.sheetIndex, 0, source.sheets.length - 1) || typeof value.hasHeader !== 'boolean') return fail('工作表选择无效。');
    const table = parseTemplateTable((source.sheets[value.sheetIndex as number] as L1502Source['sheets'][number]).matrix, value.hasHeader);
    const index = (item: unknown) => Number.isInteger(item) && within(item, 0, table.columns.length - 1);
    if (!record(value.mapping) || !index(value.mapping.x) || !Array.isArray(value.mapping.ys) || value.mapping.ys.length > 100 || !value.mapping.ys.every(index) || new Set(value.mapping.ys).size !== value.mapping.ys.length || !record(value.mapping.errors) || !record(value.mapping.bounds)) return fail('字段绑定无效。');
    for (const key of ['z', 'group', 'size', 'color', 'label', 'u', 'v', 'w', 'weight']) if (value.mapping[key] !== undefined && !index(value.mapping[key])) return fail('辅助字段绑定无效。');
    for (const [y, error] of Object.entries(value.mapping.errors)) if (!/^\d+$/.test(y) || !index(Number(y)) || !index(error)) return fail('误差字段绑定无效。');
    for (const [y, bounds] of Object.entries(value.mapping.bounds)) if (!/^\d+$/.test(y) || !index(Number(y)) || !record(bounds) || !index(bounds.lower) || !index(bounds.upper)) return fail('上下界字段绑定无效。');
    if (!record(value.style)) return fail('样式缺失。');
    const style = value.style;
    for (const key of ['title', 'xLabel', 'yLabel', 'zLabel', 'secondaryYLabel', 'annotationText', 'intervalLabel']) if (!text(style[key])) return fail('文字参数无效。');
    if (!['Arial', 'Times New Roman', 'sans-serif'].includes(style.fontFamily as string) || !within(style.fontSize, 5, 16) || !within(style.width, 420, 1600) || !within(style.height, 320, 1000) || !within(style.yaw, -180, 180) || !within(style.pitch, -80, 80) || !Number.isInteger(style.bins) || !within(style.bins, 2, 60) || !finite(style.isoLevel) || !finite(style.annotationX)) return fail('字号、画布或数值参数超出范围。');
    if (!Array.isArray(style.colors) || style.colors.length < 1 || style.colors.length > 32 || !style.colors.every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) return fail('配色格式无效。');
    if (style.scalarPalette !== undefined && !SCALAR_PALETTES.some(palette => palette.id === style.scalarPalette)) return fail('数值色阶无效。');
    if (style.scalarColors !== undefined && (!Array.isArray(style.scalarColors) || style.scalarColors.length < 1 || style.scalarColors.length > 32 || !style.scalarColors.every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)))) return fail('自定义数值色阶格式无效。');
    for (const field of ['showGrid', 'showValues']) if (typeof style[field] !== 'boolean') return fail('样式开关无效。');
    if (typeof value.logX !== 'boolean' || typeof value.logY !== 'boolean' || !text(value.caption)) return fail('坐标或图注格式无效。');
    if (!record(value.exportSettings) || !within(value.exportSettings.widthMm, 40, 300) || ![150, 300, 600].includes(value.exportSettings.dpi as number) || typeof value.exportSettings.grayscale !== 'boolean' || !['single', 'double', 'custom'].includes(value.exportSettings.preset as string)) return fail('导出规格无效。');
    return structuredClone(value) as unknown as L1502EditSnapshot;
}
