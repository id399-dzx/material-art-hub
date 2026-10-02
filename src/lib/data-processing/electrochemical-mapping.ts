import { numericCell, suggestMapping, type ColumnMapping, type DataTable } from './templates.ts';
import type { ElectrochemicalChartSpec } from './electrochemistry.ts';

/** Column names are suggestions only; users can rebind every field. Units are not converted. */
export function suggestElectrochemicalMapping(table: DataTable, spec: ElectrochemicalChartSpec): ColumnMapping {
    const fallback = suggestMapping(table, spec.kind === 'bode' || spec.kind === 'cycle' ? 'dual-axis' : 'line');
    const numeric = table.columns.map((name, index) => ({ name, index })).filter(({ index }) => table.rows.some(row => numericCell(row[index]) !== null));
    const potential = /potential|voltage|ewe|电位|电压/i;
    const current = /current|电流|^\s*<?i>?(?:\s*\(|\s*\/|\s*$)/i;
    const capacity = /capacity|capacitance|retention|容量|比电容|保持率/i;
    const cycle = /cycle|循环|圈数/i;
    const frequency = /freq|频率/i;
    const real = /(?:re|real)\s*\(?z|z[′'](?![′'])|实部/i;
    const imaginary = /(?:im|imag)\s*\(?z|z[″"]|z[′']{2}|虚部/i;
    const magnitude = /\|z\||abs|magnitude|mod(?:ulus)?|阻抗模|模值/i;
    const phase = /phase|相位|相角|角度/i;
    const efficiency = /efficiency|coulombic|库仑|效率|\bce\b/i;
    const xPattern = spec.kind === 'gcd' ? /time|时间/i : spec.kind === 'charge-discharge' ? capacity : spec.kind === 'rate' || spec.kind === 'cycle' ? cycle : spec.kind === 'nyquist' ? real : spec.kind === 'bode' ? frequency : potential;
    const x = numeric.find(column => xPattern.test(column.name))?.index ?? fallback.x;
    const available = numeric.filter(column => column.index !== x);
    const primary = spec.kind === 'gcd' || spec.kind === 'charge-discharge' ? potential : spec.kind === 'rate' || spec.kind === 'cycle' ? capacity : spec.kind === 'nyquist' ? imaginary : spec.kind === 'bode' ? magnitude : current;
    const matches = available.filter(column => primary.test(column.name)).map(column => column.index);
    const left = matches[0] ?? available[0]?.index;
    if (spec.kind === 'cycle' || spec.kind === 'bode') {
        const right = available.find(column => column.index !== left && (spec.kind === 'cycle' ? efficiency : phase).test(column.name))?.index;
        // Cycle efficiency is optional; an unrelated instrument column is never used as a right axis.
        return { x, ys: [left, right ?? (spec.kind === 'bode' ? available.find(column => column.index !== left)?.index : undefined)].filter((index): index is number => index !== undefined), errors: {} };
    }
    return { x, ys: matches.length ? matches : available.map(column => column.index), errors: {} };
}
