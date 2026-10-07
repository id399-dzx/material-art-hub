import type { TableCell } from './templates.ts';
import type { L1502Spec } from './l1502-spec.ts';

const round = (value: number) => Number(value.toFixed(5));
const sequence = (count: number, make: (index: number) => TableCell[]) => Array.from({ length: count }, (_, index) => make(index));

/** Independently authored deterministic examples. No source measurements or MATLAB assets are embedded. */
export function createL1502Demo(spec: L1502Spec): TableCell[][] {
    const phase = (spec.issue % 17) / 17;
    const curve = (x: number, offset = 0) => round(2.2 + offset + Math.sin(x + phase) + 0.12 * x);
    const field = (x: number, y: number) => round(1.6 * Math.exp(-0.35 * (x * x + y * y)) + 0.45 * Math.sin(1.3 * x + phase) * Math.cos(y) - 0.3);
    const grid = (size = 13): TableCell[][] => [
        ['X', 'Y', 'Z'],
        ...sequence(size * size, index => {
            const x = -3 + 6 * (index % size) / (size - 1);
            const y = -3 + 6 * Math.floor(index / size) / (size - 1);
            return [round(x), round(y), spec.implicit ? round(x * x + y * y - 2.25) : field(x, y)];
        }),
    ];
    const xy = (bubble = false, spatial = false): TableCell[][] => {
        const header = ['X', 'Y', ...(spatial ? ['Z'] : []), ...(bubble ? ['Size'] : []), 'Color', 'Group', 'Label'];
        return [header, ...sequence(36, index => {
            const group = spec.grouped ? Math.floor(index / 12) : 0;
            const t = spec.grouped ? index % 12 : index;
            const angle = 2 * Math.PI * t / (spec.grouped ? 12 : 36);
            const x = round(group * 1.8 - 1.8 + 0.65 * Math.cos(angle) + 0.04 * t);
            const y = round(0.75 * Math.sin(angle) + 0.3 * group + 0.06 * Math.cos(t * 1.7 + phase));
            return [x, y, ...(spatial ? [round(0.25 * t + 0.45 * Math.cos(angle + phase))] : []), ...(bubble ? [round(6 + (t + 2 * group) * 2.5)] : []), round(t / 11 + group / 4), `Group ${String.fromCharCode(65 + group)}`, `Point ${index + 1}`];
        })];
    };
    const bars = (): TableCell[][] => {
        const single = [11, 36, 70, 75, 77, 99, 123].includes(spec.issue);
        const signed = [95, 99, 110, 123].includes(spec.issue);
        const count = single ? 1 : [10, 95, 110].includes(spec.issue) ? 2 : 3;
        const header = ['X', ...Array.from({ length: count }, (_, i) => `Series${String.fromCharCode(65 + i)}`), ...(spec.grouped && spec.stacked ? ['Group'] : [])];
        return [header, ...sequence(spec.grouped && spec.stacked ? 12 : 6, i => {
            const category = spec.grouped && spec.stacked ? Math.floor(i / 2) : i;
            const values = Array.from({ length: count }, (_, series) => round((signed && (single ? i % 2 === 0 : series === 0) ? -1 : 1) * (9 + category * 2.1 + series * 3 + 1.5 * Math.sin(i + phase))));
            return [`Sample ${category + 1}`, ...values, ...(spec.grouped && spec.stacked ? [`Group ${i % 2 ? 'B' : 'A'}`] : [])];
        })];
    };
    const intervals = (includeError = false): TableCell[][] => [
        ['X', 'SeriesA', 'SeriesA_lower', 'SeriesA_upper', ...(includeError ? ['SeriesA_error', 'SeriesB'] : ['SeriesB', 'SeriesB_lower', 'SeriesB_upper'])],
        ...sequence(25, i => {
            const x = i / 4;
            const a = curve(x), b = curve(x, 0.8), delta = 0.16 + 0.07 * (1 + Math.sin(x));
            return [x, a, round(a - delta), round(a + delta), ...(includeError ? [round(delta / 2), b] : [b, round(b - delta * 1.2), round(b + delta * 1.2)])];
        }),
    ];
    switch (spec.kind) {
        case 'bar': case 'stacked-bar': return bars();
        case 'dual-axis': return [
            ['X', 'SeriesA', 'SeriesB'],
            ...sequence(8, i => [i + 1, round(12 + 2 * i + 2 * Math.sin(i + phase)), round(105 + 25 * Math.cos(i / 3 + phase) + 12 * i)]),
        ];
        case 'error-bar': {
            const seriesCount = spec.issue === 70 ? 1 : 3;
            return [['X', ...Array.from({ length: seriesCount }, (_, i) => [`Series${String.fromCharCode(65 + i)}`, `Series${String.fromCharCode(65 + i)}_error`]).flat()],
                ...sequence(6, i => [`Sample ${i + 1}`, ...Array.from({ length: seriesCount }, (_, series) => [round(12 + i * 2 + series * 3 + Math.sin(i + phase)), round(0.8 + 0.15 * i + series * 0.2)]).flat()])];
        }
        case 'error-line': return spec.issue === 29 ? intervals(true) : [
            ['X', 'SeriesA', 'SeriesA_error', 'SeriesB', 'SeriesB_error'],
            ...sequence(13, i => [i / 2, curve(i / 2), round(0.13 + i / 120), curve(i / 2, 0.8), round(0.17 + i / 100)]),
        ];
        case 'confidence': return intervals();
        case 'area': return [['X', 'SeriesA', 'SeriesB', 'SeriesC'], ...sequence(25, i => {
            const x = i / 4;
            return [x, round(0.3 + 2 * Math.exp(-((x - 1.5) ** 2))), round(0.3 + 1.5 * Math.exp(-((x - 3.3) ** 2))), round(0.3 + 1.8 * Math.exp(-((x - 4.7) ** 2)))];
        })];
        case 'scatter': case 'scatter-marginal': return xy();
        case 'bubble': return xy(true);
        case 'bubble-cloud': return [['Word', 'Size', 'Color', 'Group'], ...sequence(18, i => [
            `Item ${i + 1}`, round(8 + ((i * 7 + spec.issue) % 19) * 2.5), round(i / 17), `Group ${String.fromCharCode(65 + (spec.grouped ? Math.floor(i / 6) : 0))}`,
        ])];
        case 'jitter': return [['X', 'Y', 'Group'], ...sequence(48, i => {
            const category = Math.floor(i / 16), k = i % 16;
            return [`Category ${category + 1}`, round(2 + category * 0.6 + Math.sin(k * 1.3 + phase) * 0.45 + k * 0.025), `Group ${k % 2 ? 'B' : 'A'}`];
        })];
        case 'scatter-matrix': case 'parallel': return [['X', 'Y', 'Z', 'U', 'Group'], ...sequence(24, i => {
            const x = i / 6;
            return [round(x), curve(x), round(0.4 * x * x + Math.cos(x + phase)), round(5 - x + Math.sin(i * 0.8)), `Group ${i < 12 ? 'A' : 'B'}`];
        })];
        case 'heatmap': {
            const numeric = [58, 59].includes(spec.issue);
            return [[numeric ? 'Y' : 'Row', ...sequence(7, i => [numeric ? String(round(-3 + i)) : `Column ${i + 1}`]).flat()],
                ...sequence(6, row => [numeric ? -2.5 + row : `Row ${row + 1}`, ...sequence(7, col => [numeric ? field(-3 + col, -2.5 + row) : round(0.2 + ((row * 3 + col * 7 + spec.issue) % 17) / 5)]).flat()])];
        }
        case 'bubble-matrix': return [['X', 'Y', 'Size', 'Color'], ...sequence(42, i => {
            const col = i % 7, row = Math.floor(i / 7);
            return [`Column ${col + 1}`, `Row ${row + 1}`, round(5 + ((row * 5 + col * 3 + spec.issue) % 13) * 4), round(Math.sin(row + phase) + Math.cos(col / 2))];
        })];
        case 'box': return [['Category', 'Value', 'Group'], ...sequence(spec.grouped ? 72 : 36, i => {
            const perCategory = spec.grouped ? 24 : 12, category = Math.floor(i / perCategory), within = i % perCategory;
            const group = spec.grouped && within >= 12 ? 1 : 0, sample = within % 12;
            return [`Category ${category + 1}`, round(4 + 0.65 * category + 0.8 * group + 0.55 * Math.sin(sample * 1.9 + phase) + 0.025 * sample * sample), `Group ${group ? 'B' : 'A'}`];
        })];
        case 'histogram': return [['X', 'Y', 'Group'], ...sequence(90, i => {
            const group = Math.floor(i / 30), sample = i % 30;
            return [i, round(2 + group * 1.1 + Math.sin(sample * 1.7 + phase) * 0.6 + Math.cos(sample * 0.9) * 0.3), `Group ${String.fromCharCode(65 + group)}`];
        })];
        case 'histogram2': return [['X', 'Y'], ...sequence(96, i => {
            const x = (i % 12) / 3, y = Math.floor(i / 12) / 3 + 0.35 * Math.sin(i + phase);
            return [round(x + 0.11 * Math.cos(i)), round(y)];
        })];
        case 'pie': case 'pie3': return [['X', 'Y'], ['Component A', 29], ['Component B', 22], ['Component C', 18], ['Component D', 14], ['Component E', 11], ['Component F', 6]];
        case 'pareto': return [['X', 'Y'], ['Factor A', 42], ['Factor B', 31], ['Factor C', 24], ['Factor D', 17], ['Factor E', 11], ['Factor F', 5]];
        case 'pyramid': return [['X', 'SeriesA', 'SeriesB'], ...sequence(9, i => [`Band ${i + 1}`, round(32 - i * 2.5 + 2 * Math.sin(i)), round(30 - i * 2.6 + 2.5 * Math.cos(i + phase))])];
        case 'word-cloud': return [['Word', 'Weight'], ['Materials', 48], ['Energy', 42], ['Structure', 36], ['Design', 32], ['Surface', 28], ['Interface', 24], ['Transport', 20], ['Catalysis', 18], ['Storage', 16], ['Analysis', 14], ['Model', 12], ['Spectrum', 10], ['Cycle', 8], ['Charge', 7], ['Process', 6]];
        case 'network': return [['Source', 'Target', 'Weight'], ...([
            ['Node A', 'Node B', 2], ['Node A', 'Node C', 4], ['Node B', 'Node D', 1], ['Node C', 'Node D', 3],
            ['Node C', 'Node E', 2], ['Node D', 'Node F', 5], ['Node E', 'Node F', 2], ['Node F', 'Node A', 1],
        ] as TableCell[][]).map(([source, target, weight]) => [source, target, spec.issue === 90 ? weight : 1])];
        case 'variable-bar': return [['Start', 'Value', 'Size'], [0, 8, 0.6], [0.8, 12, 1.2], [2.3, 9, 0.8], [3.5, 17, 1.7], [5.6, 14, 1.1], [7.1, 20, 2]];
        case 'multi-panel': {
            const errors = spec.issue !== 31;
            return [['X', ...Array.from({ length: 4 }, (_, series) => [`Series${String.fromCharCode(65 + series)}`, ...(errors ? [`Series${String.fromCharCode(65 + series)}_error`] : [])]).flat()], ...sequence(12, i => {
                const values = [round(9 + i * 0.5 + Math.sin(i + phase)), curve(i / 2), round(2 + i / 4 + Math.sin(i / 3)), round(1.2 + i / 5 + Math.cos(i / 3))];
                return [i + 1, ...values.flatMap((value, series) => [value, ...(errors ? [round(0.25 + series * 0.08 + i / 100)] : [])])];
            })];
        }
        case 'inset': return [['X', 'SeriesA', 'SeriesB'], ...sequence(61, i => [i / 10, round(Math.exp(-i / 30) * Math.cos(i / 5)), round(Math.exp(-i / 35) * Math.sin(i / 5))])];
        case 'polar-line': case 'polar-scatter': case 'polar-bubble': return [
            ['X', 'Y', ...(spec.kind === 'polar-bubble' ? ['Size'] : []), 'Color', 'Group'],
            ...sequence(spec.grouped ? 72 : 36, i => {
                const group = Math.floor(i / 36), theta = (i % 36) * 2 * Math.PI / 35;
                return [round(theta), round(2.2 + 0.6 * Math.cos(3 * theta + phase) + 0.35 * group), ...(spec.kind === 'polar-bubble' ? [round(8 + 14 * (1 + Math.sin(theta)))] : []), round(theta + group), `Group ${group ? 'B' : 'A'}`];
            }),
        ];
        case 'polar-histogram': return [['X', 'Y'], ...sequence(100, i => [i, round(((i * 0.73 + 0.6 * Math.sin(i * 1.7)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI))])];
        case 'vector2': case 'compass': return [['X', 'Y', 'U', 'V', 'Color'], ...sequence(spec.issue === 80 || spec.kind === 'compass' ? 12 : 49, i => {
            const feather = spec.issue === 80, compass = spec.kind === 'compass';
            const x = feather ? i + 1 : compass ? 0 : -3 + i % 7;
            const y = feather || compass ? 0 : -3 + Math.floor(i / 7);
            const angle = (i / 12) * Math.PI * 2 + phase, u = feather || compass ? 0.5 + Math.cos(angle) : -y * 0.25;
            const v = feather || compass ? Math.sin(angle) : x * 0.25;
            return [x, y, round(u), round(v), round(Math.hypot(u, v))];
        })];
        case 'vector3': return [['X', 'Y', 'Z', 'U', 'V', 'W', 'Color'], ...sequence(27, i => {
            const x = -1 + i % 3, y = -1 + Math.floor(i / 3) % 3, z = -1 + Math.floor(i / 9);
            const u = -0.4 * y, v = 0.4 * x, w = 0.2 + 0.2 * z;
            return [x, y, z, round(u), round(v), round(w), round(Math.hypot(u, v, w))];
        })];
        case 'scatter3': return xy([124, 125, 126].includes(spec.issue), true);
        case 'line3': return [['X', 'Y', 'Z', 'Group'], ...sequence(73, i => {
            const t = i * Math.PI / 12;
            return [round(Math.cos(t)), round(Math.sin(t)), round(t / (2 * Math.PI)), `Group ${spec.grouped ? Math.floor(i / 19) + 1 : 1}`];
        })];
        case 'bar3': return [['X', 'Y', 'Z'], ...sequence(30, i => [i % 6 + 1, Math.floor(i / 6) + 1, round(5 + 2 * (i % 6) + 1.5 * Math.floor(i / 6) + Math.sin(i + phase))])];
        case 'stem3': return [['X', 'Y', 'Z'], ...sequence(36, i => [i % 6 + 1, Math.floor(i / 6) + 1, round(2.5 + Math.sin(i % 6 + phase) + 0.2 * Math.floor(i / 6))])];
        case 'surface': case 'waterfall': case 'ribbon': case 'contour': return grid();
        case 'tri-mesh': case 'tri-surface': return [['X', 'Y', 'Z'], ...sequence(64, i => {
            const row = Math.floor(i / 8), col = i % 8;
            const x = -2.8 + col * 0.8 + (row % 2) * 0.17, y = -2.8 + row * 0.8 + 0.06 * Math.sin(col);
            return [round(x), round(y), field(x, y)];
        })];
        case 'implicit-surface': return [['X', 'Y', 'Z', 'Color'], ...sequence(1331, i => {
            const x = round(-1.5 + (i % 11) * 0.3), y = round(-1.5 + (Math.floor(i / 11) % 11) * 0.3), z = round(-1.5 + Math.floor(i / 121) * 0.3);
            return [x, y, z, round(x * x + y * y + z * z - 1)];
        })];
        case 'line': case 'stem': case 'step': {
            const positiveX = spec.logX;
            const seriesCount = [19, 25, 111, 112, 114, 115, 116].includes(spec.issue) ? 1 : [39, 122].includes(spec.issue) ? 4 : 3;
            return [['X', ...Array.from({ length: seriesCount }, (_, series) => `Series${String.fromCharCode(65 + series)}`)], ...sequence(spec.timeX ? 14 : 25, i => {
                const x = positiveX ? round(10 ** (-1 + i / 8)) : i / 4;
                return [spec.timeX ? `2026-01-${String(i + 1).padStart(2, '0')}` : x, ...Array.from({ length: seriesCount }, (_, series) => curve(i / 4, series * 0.7))];
            })];
        }
    }
}
