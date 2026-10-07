import { color as echartsColor, type EChartsOption, type GraphicComponentOption } from 'echarts';
import { textWidth, wrapChartText } from './chart-layout.ts';
import { L1502_COLORS, L1502_SPATIAL_KINDS, type L1502Data, type L1502Point, type L1502Spec, type L1502Style } from './l1502-spec.ts';
import { getValueColors, interpolateChartColor } from './chart-palettes.ts';

export type L1502Vec3 = [number, number, number];
export type L1502Triangle = [L1502Vec3, L1502Vec3, L1502Vec3];
type Vec2 = [number, number];
type Axis = { min: number; max: number; values: number[]; labels?: string[]; measuredTicks?: boolean; name: string; encode: (v: number | string) => number };
type Entry = { point: L1502Point; position: L1502Vec3; group: string; index: number };
type Primitive = { vertices: L1502Vec3[]; type: 'polygon' | 'polyline' | 'circle'; fill: string; stroke?: string; width?: number; opacity?: number; radius?: number; gradient?: boolean; lighting?: boolean; info?: Record<string, unknown> };
const EPS = 1e-10;
const add = (a: L1502Vec3, b: L1502Vec3): L1502Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: L1502Vec3, b: L1502Vec3): L1502Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: L1502Vec3, b: L1502Vec3): L1502Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: L1502Vec3, b: L1502Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: L1502Vec3): number => Math.hypot(...a);
const key = (p: L1502Vec3): string => p.join(',');
const xyKey = (x: number, y: number): string => `${x},${y}`;
const unique = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
const extent = (values: number[]): [number, number] => values.reduce<[number, number]>((r, v) => [Math.min(r[0], v), Math.max(r[1], v)], [Infinity, -Infinity]);
const formatNumber = (value: number): string => Number(value.toPrecision(5)).toLocaleString('en-US', { maximumSignificantDigits: 5 });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const numeric = (value: number | string): number | null => typeof value === 'number' ? Number.isFinite(value) ? value : null : value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
function requireLimit(count: number, limit: number, label: string): void {
    if (count > limit) throw new Error(`${label}包含 ${count.toLocaleString()} 个元素；SVG 空间图上限为 ${limit.toLocaleString()}，请缩小输入网格或分组后绘制。数据未被截断。`);
}

/** Only measured corners of immediately adjacent grid coordinates form a cell. */
export function l1502GridFaces(points: L1502Vec3[]): L1502Vec3[][] {
    const xs = unique(points.map(p => p[0])), ys = unique(points.map(p => p[1]));
    requireLimit(Math.max(0, xs.length - 1) * Math.max(0, ys.length - 1), 60000, '曲面网格');
    const lookup = new Map<string, L1502Vec3>();
    for (const point of points) {
        const id = xyKey(point[0], point[1]);
        if (lookup.has(id)) throw new Error(`曲面网格存在重复坐标 (${point[0]}, ${point[1]})。`);
        lookup.set(id, point);
    }
    const faces: L1502Vec3[][] = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
        const corners = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => lookup.get(xyKey(x, y)));
        if (corners.every(p => p !== undefined)) faces.push(corners as L1502Vec3[]);
    }
    return faces;
}

type CircumTriangle = { ids: [number, number, number]; cx: number; cy: number; radius2: number };
function circumTriangle(points: Vec2[], a: number, b: number, c: number): CircumTriangle | null {
    const [ax, ay] = points[a], [bx, by] = points[b], [cx, cy] = points[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-14) return null;
    const aa = ax * ax + ay * ay, bb = bx * bx + by * by, cc = cx * cx + cy * cy;
    const x = (aa * (by - cy) + bb * (cy - ay) + cc * (ay - by)) / d;
    const y = (aa * (cx - bx) + bb * (ax - cx) + cc * (bx - ax)) / d;
    return { ids: d > 0 ? [a, b, c] : [b, a, c], cx: x, cy: y, radius2: (x - ax) ** 2 + (y - ay) ** 2 };
}

/** Bowyer–Watson Delaunay triangulation in the actual XY plane, returning original indices. */
export function l1502TriangulateXY(points: L1502Vec3[]): [number, number, number][] {
    requireLimit(points.length, 1800, '散点三角剖分');
    const original: number[] = [], seen = new Map<string, number>();
    points.forEach((p, i) => {
        const id = xyKey(p[0], p[1]), previous = seen.get(id);
        if (previous !== undefined) {
            if (points[previous][2] !== p[2]) throw new Error(`三角曲面在 XY=(${p[0]}, ${p[1]}) 上有不同 Z，无法构成单值曲面。`);
        } else { seen.set(id, i); original.push(i); }
    });
    if (original.length < 3) return [];
    const [xmin, xmax] = extent(original.map(i => points[i][0])), [ymin, ymax] = extent(original.map(i => points[i][1]));
    // A common scale preserves Euclidean distance and therefore the Delaunay criterion.
    const scale = Math.max(xmax - xmin, ymax - ymin) || 1;
    const xy: Vec2[] = original.map(i => [(points[i][0] - xmin) / scale, (points[i][1] - ymin) / scale]);
    const n = xy.length;
    xy.push([-20, -20], [20, -20], [0, 20]);
    let triangles = [circumTriangle(xy, n, n + 1, n + 2)!];
    for (let i = 0; i < n; i++) {
        const boundary = new Map<string, { a: number; b: number; count: number }>(), remaining: CircumTriangle[] = [];
        for (const triangle of triangles) {
            const distance = (xy[i][0] - triangle.cx) ** 2 + (xy[i][1] - triangle.cy) ** 2;
            if (distance <= triangle.radius2 + 1e-12) {
                for (let j = 0; j < 3; j++) {
                    const a = triangle.ids[j], b = triangle.ids[(j + 1) % 3], id = a < b ? `${a},${b}` : `${b},${a}`;
                    const previous = boundary.get(id);
                    if (previous) previous.count++; else boundary.set(id, { a, b, count: 1 });
                }
            } else remaining.push(triangle);
        }
        for (const edge of boundary.values()) if (edge.count === 1) {
            const triangle = circumTriangle(xy, edge.a, edge.b, i);
            if (triangle) remaining.push(triangle);
        }
        triangles = remaining;
    }
    let result = triangles.filter(t => t.ids.every(i => i < n)).map(t => t.ids.map(i => original[i]) as [number, number, number]);
    // Dense repeated XY coordinates indicate a measured grid. Delaunay must not seal its missing cells.
    const xs = unique(points.map(p => p[0])), ys = unique(points.map(p => p[1]));
    const structured = xs.length >= 3 && ys.length >= 3 && seen.size / (xs.length * ys.length) >= .55;
    if (structured && seen.size < xs.length * ys.length) {
        const xIndex = new Map(xs.map((v, i) => [v, i])), yIndex = new Map(ys.map((v, i) => [v, i]));
        result = result.filter(ids => {
            const xx = ids.map(i => xIndex.get(points[i][0])!), yy = ids.map(i => yIndex.get(points[i][1])!);
            const [a, b] = extent(xx), [c, d] = extent(yy);
            return b - a === 1 && d - c === 1 && [[xs[a], ys[c]], [xs[b], ys[c]], [xs[b], ys[d]], [xs[a], ys[d]]].every(([x, y]) => seen.has(xyKey(x, y)));
        });
    }
    return result;
}

function interpolate(a: L1502Vec3, b: L1502Vec3, av: number, bv: number, level: number): L1502Vec3 {
    const t = av === bv ? .5 : Math.max(0, Math.min(1, (level - av) / (bv - av)));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Piecewise-linear level intersections of the measured surface, without interpolating holes. */
export function l1502ContourSegments(faces: L1502Vec3[][], levels: number[]): { level: number; points: [L1502Vec3, L1502Vec3] }[] {
    const result: { level: number; points: [L1502Vec3, L1502Vec3] }[] = [], seen = new Set<string>();
    for (const face of faces) for (let i = 1; i < face.length - 1; i++) {
        const triangle = [face[0], face[i], face[i + 1]];
        for (const level of levels) {
            const intersections: L1502Vec3[] = [];
            for (let j = 0; j < 3; j++) {
                const a = triangle[j], b = triangle[(j + 1) % 3];
                if ((a[2] < level && b[2] >= level) || (b[2] < level && a[2] >= level)) intersections.push(interpolate(a, b, a[2], b[2], level));
            }
            if (intersections.length === 2 && norm(sub(intersections[0], intersections[1])) > EPS) {
                const id = `${level}:${intersections.map(key).sort().join(';')}`;
                if (!seen.has(id)) { seen.add(id); result.push({ level, points: intersections as [L1502Vec3, L1502Vec3] }); }
            }
        }
    }
    return result;
}

export type L1502ScalarSample = { position: L1502Vec3; value: number };
export type L1502IsoMesh = { triangles: L1502Triangle[]; completeCells: number; missingCells: number };
/** Six consistent tetrahedra per measured cube; scalar values are supplied data, never expressions. */
export function l1502MarchingTetrahedra(samples: L1502ScalarSample[], isoLevel = 0): L1502IsoMesh {
    if (!Number.isFinite(isoLevel)) throw new Error('等值面阈值必须为有限数值。');
    requireLimit(samples.length, 50000, '三维标量场');
    const xs = unique(samples.map(s => s.position[0])), ys = unique(samples.map(s => s.position[1])), zs = unique(samples.map(s => s.position[2]));
    const cells = Math.max(0, xs.length - 1) * Math.max(0, ys.length - 1) * Math.max(0, zs.length - 1);
    requireLimit(cells, 120000, '三维标量网格');
    const lookup = new Map<string, L1502ScalarSample>();
    for (const sample of samples) {
        if (!sample.position.every(Number.isFinite) || !Number.isFinite(sample.value)) throw new Error('等值面要求有限 XYZ 坐标及 Color 标量值。');
        const id = key(sample.position);
        if (lookup.has(id)) throw new Error(`标量场存在重复 XYZ 坐标 (${sample.position.join(', ')})。`);
        lookup.set(id, sample);
    }
    const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
    const triangles: L1502Triangle[] = [], seen = new Set<string>();
    let completeCells = 0;
    const pushTriangle = (triangle: L1502Triangle, gradient: L1502Vec3): void => {
        const normal = cross(sub(triangle[1], triangle[0]), sub(triangle[2], triangle[0]));
        if (norm(normal) <= EPS) return;
        if (dot(normal, gradient) < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        const id = triangle.map(p => p.map(v => v.toPrecision(13)).join(',')).sort().join(';');
        if (!seen.has(id)) { seen.add(id); triangles.push(triangle); }
    };
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) for (let k = 0; k < zs.length - 1; k++) {
        const xyz: L1502Vec3[] = [[xs[i], ys[j], zs[k]], [xs[i + 1], ys[j], zs[k]], [xs[i + 1], ys[j + 1], zs[k]], [xs[i], ys[j + 1], zs[k]], [xs[i], ys[j], zs[k + 1]], [xs[i + 1], ys[j], zs[k + 1]], [xs[i + 1], ys[j + 1], zs[k + 1]], [xs[i], ys[j + 1], zs[k + 1]]];
        const cube = xyz.map(p => lookup.get(key(p)));
        if (!cube.every(Boolean)) continue;
        completeCells++;
        for (const ids of tetrahedra) {
            const tet = ids.map(id => cube[id]!);
            const inside = tet.filter(s => s.value < isoLevel), outside = tet.filter(s => s.value >= isoLevel);
            if (!inside.length || !outside.length) continue;
            const edge = (a: L1502ScalarSample, b: L1502ScalarSample) => interpolate(a.position, b.position, a.value, b.value, isoLevel);
            const a = sub(tet[1].position, tet[0].position), b = sub(tet[2].position, tet[0].position), c = sub(tet[3].position, tet[0].position);
            const determinant = dot(a, cross(b, c));
            const bc = cross(b, c), ca = cross(c, a), ab = cross(a, b);
            const dv = [tet[1].value - tet[0].value, tet[2].value - tet[0].value, tet[3].value - tet[0].value];
            const gradient: L1502Vec3 = [0, 1, 2].map(d => (bc[d] * dv[0] + ca[d] * dv[1] + ab[d] * dv[2]) / determinant) as L1502Vec3;
            if (inside.length === 1) pushTriangle(outside.map(o => edge(inside[0], o)) as L1502Triangle, gradient);
            else if (outside.length === 1) pushTriangle(inside.map(s => edge(s, outside[0])) as L1502Triangle, gradient);
            else {
                const aa = edge(inside[0], outside[0]), bb = edge(inside[0], outside[1]), cc = edge(inside[1], outside[0]), dd = edge(inside[1], outside[1]);
                pushTriangle([aa, bb, dd], gradient); pushTriangle([aa, dd, cc], gradient);
            }
        }
    }
    requireLimit(triangles.length, 30000, '等值面三角面');
    return { triangles, completeCells, missingCells: cells - completeCells };
}

/** Vector endpoints are data positions plus the independent U/V/W components. */
export function l1502VectorEndpoint(position: L1502Vec3, point: Pick<L1502Point, 'u' | 'v' | 'w'>): L1502Vec3 {
    if (!finite(point.u) || !finite(point.v) || !finite(point.w)) throw new Error('空间向量需要独立的 U、V、W 三列有限数值。');
    return [position[0] + point.u, position[1] + point.v, position[2] + point.w];
}

function makeAxis(values: (number | string)[], name: string): Axis {
    const converted = values.map(numeric);
    if (converted.every(v => v !== null)) {
        const coordinates = unique(converted as number[]), [min, max] = extent(coordinates);
        return { min, max, values: coordinates, name, encode: v => numeric(v)! };
    }
    const labels = [...new Set(values.map(String))];
    return { min: 0, max: Math.max(0, labels.length - 1), values: labels.map((_, i) => i), labels, name, encode: v => labels.indexOf(String(v)) };
}
function expandAxis(axis: Axis, values: number[], padding = 0): void {
    const [min, max] = extent([axis.min, axis.max, ...values]);
    const span = max - min || Math.max(1, Math.abs(min) * .1);
    axis.min = min === max ? min - span / 2 : min - span * padding;
    axis.max = min === max ? max + span / 2 : max + span * padding;
}
function localHalfWidth(value: number, values: number[], ratio: number): number {
    const i = values.indexOf(value), before = i > 0 ? value - values[i - 1] : Infinity, after = i < values.length - 1 ? values[i + 1] - value : Infinity;
    return (Number.isFinite(Math.min(before, after)) ? Math.min(before, after) : 1) * ratio;
}
function ticks(axis: Axis): { value: number; label: string }[] {
    if (axis.labels) return axis.labels.map((label, i) => ({ value: i, label }));
    if (axis.measuredTicks && axis.values.length <= 16) return axis.values.map(value => ({ value, label: formatNumber(value) }));
    return Array.from({ length: 3 }, (_, i) => {
        const value = axis.min + (axis.max - axis.min) * i / 2;
        return { value, label: Number(value.toPrecision(3)).toLocaleString('en-US', { maximumSignificantDigits: 3 }) };
    });
}
function mixColor(a: string, b: string, t: number): string {
    const aa = echartsColor.parse(a) ?? [20, 122, 139, 1], bb = echartsColor.parse(b) ?? [227, 164, 56, 1];
    return `rgb(${[0, 1, 2].map(i => Math.round(aa[i] + (bb[i] - aa[i]) * t)).join(',')})`;
}
function valueColor(value: number, bounds: [number, number], palette: string[]): string {
    const t = bounds[0] === bounds[1] ? .5 : Math.max(0, Math.min(1, (value - bounds[0]) / (bounds[1] - bounds[0])));
    return interpolateChartColor(palette, t);
}
function litColor(fill: string, vertices: L1502Vec3[]): string {
    if (vertices.length < 3) return fill;
    const normal = cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0])), length = norm(normal);
    const light: L1502Vec3 = [-.4, -.6, 1], intensity = length ? .5 + .5 * Math.abs(dot(normal, light) / (length * norm(light))) : .85;
    return mixColor('#172033', fill, intensity);
}

function groupEntries(data: L1502Data, axes: [Axis, Axis, Axis]): Entry[] {
    const named = data.series.flatMap(s => s.points.map(point => ({ point, group: point.group ?? s.name })));
    const points = named.length === data.points.length ? named : data.points.map(point => ({ point, group: point.group ?? data.series[0]?.name ?? 'Data' }));
    return points.map(({ point, group }, index) => {
        if (!finite(point.z)) throw new Error('空间图需要每个观测点的有限 Z 坐标。');
        const position: L1502Vec3 = [axes[0].encode(point.x), axes[1].encode(point.y), point.z];
        if (!position.every(Number.isFinite)) throw new Error('空间图包含无效 XYZ 坐标。');
        return { point, position, group, index };
    });
}
function entriesByGroup(entries: Entry[]): Map<string, Entry[]> {
    const groups = new Map<string, Entry[]>();
    for (const entry of entries) { const existing = groups.get(entry.group) ?? []; existing.push(entry); groups.set(entry.group, existing); }
    return groups;
}
function entryInfo(entry: Entry): Record<string, unknown> {
    return { kind: 'observation', index: entry.index, group: entry.group, position: [...entry.position], raw: [entry.point.x, entry.point.y, entry.point.z], scalar: entry.point.color ?? entry.point.z };
}

function cubeFaces(min: L1502Vec3, max: L1502Vec3): L1502Vec3[][] {
    const [x, y, z] = min, [xx, yy, zz] = max;
    return [[[x, y, z], [xx, y, z], [xx, yy, z], [x, yy, z]], [[x, y, zz], [x, yy, zz], [xx, yy, zz], [xx, y, zz]], [[x, y, z], [x, y, zz], [xx, y, zz], [xx, y, z]], [[xx, yy, z], [xx, yy, zz], [x, yy, zz], [x, yy, z]], [[x, yy, z], [x, yy, zz], [x, y, zz], [x, y, z]], [[xx, y, z], [xx, y, zz], [xx, yy, zz], [xx, yy, z]]];
}

/** The SVG renderer projects every actual vertex; the same option is used for editor and exports. */
export function createL1502SpatialOption(data: L1502Data, spec: L1502Spec, style: L1502Style): EChartsOption {
    if (!L1502_SPATIAL_KINDS.includes(spec.kind)) throw new Error(`${spec.kind} 不是空间图类型。`);
    if (!data.points.length) throw new Error('空间图没有可绘制的观测数据。');
    const width = style.width || 760, height = style.height || 500, fontSize = Math.max(6, style.fontSize || 14), family = style.fontFamily || 'Arial';
    const palette = style.colors.length ? style.colors : [...L1502_COLORS];
    const valuePalette = getValueColors(palette, 'sequential');
    const yaw = Number.isFinite(style.yaw) ? style.yaw : 35, pitch = Number.isFinite(style.pitch) ? Math.max(-89, Math.min(89, style.pitch)) : 25;
    const graphic: GraphicComponentOption[] = [], primitives: Primitive[] = [], labels: { position: L1502Vec3; text: string; color: string }[] = [];
    const text = (value: string, x: number, y: number, size = fontSize, align: 'left' | 'center' | 'right' = 'center', fill = '#334155', maxWidth = Math.min(140, width * .22), z = 100000): void => {
        const numericLabel = /^[+−-]?[\d.,]+(?:e[+−-]?\d+)?%?$/i.test(value);
        const wrapped = numericLabel ? value : wrapChartText(value, Math.max(20, maxWidth), size, family), w = textWidth(wrapped, size, family), h = wrapped.split('\n').length * size * 1.2;
        const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        // Clamp the full live text box, including long scientific labels, to the export canvas.
        const xx = Math.max(4, Math.min(width - w - 4, left)), yy = Math.max(4, Math.min(height - h - 4, y));
        graphic.push({ type: 'text', x: xx, y: yy, z, silent: true, style: { text: wrapped, fill, font: `${size}px ${family}`, lineHeight: size * 1.2, align: 'left', verticalAlign: 'top' } });
    };
    const title = wrapChartText(style.title || '', width - 32, fontSize + 2, family);
    text(title, width / 2, 12, fontSize + 2, 'center', '#172033', width - 32);
    let top = 12 + title.split('\n').length * (fontSize + 2) * 1.2 + 8;
    const axis0 = makeAxis(data.points.map(p => p.x), style.xLabel || 'X'), axis1 = makeAxis(data.points.map(p => p.y), style.yLabel || 'Y');
    const axis2 = makeAxis(data.points.map(p => finite(p.z) ? p.z : 0), style.zLabel || 'Z');
    let axes: [Axis, Axis, Axis] = [axis0, axis1, axis2];
    let entries: Entry[] = [], names: string[] = [], colorBounds: [number, number] = [0, 1], colorLabel = style.zLabel || 'Z';
    let useScale = Boolean(spec.colorByValue || ['surface', 'tri-surface', 'implicit-surface'].includes(spec.kind));
    let notes = `透视投影 · 方位 ${formatNumber(yaw)}° / 仰角 ${formatNumber(pitch)}°`;
    const addFace = (vertices: L1502Vec3[], fill: string, info?: Record<string, unknown>, extra: Partial<Primitive> = {}): void => {
        primitives.push({ type: 'polygon', vertices, fill, stroke: style.showGrid ? '#475569' : fill, width: style.showGrid ? .65 : .35, lighting: spec.lighting, info, ...extra });
    };
    const addLine = (vertices: L1502Vec3[], stroke: string, info?: Record<string, unknown>, lineWidth = 1.5): void => {
        primitives.push({ type: 'polyline', vertices, fill: 'none', stroke, width: lineWidth, info });
    };
    const addPoint = (entry: Entry, fill: string, radius = 4): void => {
        primitives.push({ type: 'circle', vertices: [entry.position], fill, stroke: useScale && names.length > 1 ? palette[Math.max(0, names.indexOf(entry.group)) % palette.length] : '#ffffff', width: useScale && names.length > 1 ? 1.8 : .65, radius, info: entryInfo(entry) });
    };

    if (spec.kind === 'pie3') {
        requireLimit(data.points.length, 120, '立体饼图');
        const slices = data.points.map((p, i) => ({ name: p.label || String(p.x), value: numeric(p.y), index: i }));
        if (slices.some(s => s.value === null || s.value < 0)) throw new Error('立体饼图的 Y 值必须为非负数。');
        const total = slices.reduce((sum, s) => sum + s.value!, 0);
        if (!total) throw new Error('立体饼图各部分合计必须大于 0。');
        names = slices.map(s => `${s.name} (${formatNumber(s.value! / total * 100)}%)`);
        useScale = false;
        axes = [makeAxis([-1.3, 1.3], ''), makeAxis([-1.3, 1.3], ''), makeAxis([0, .32], '')];
        // Keep pie thickness geometric, rather than stretching its Z dimension to a full axis length.
        axes[2].min = -1.3; axes[2].max = 1.3;
        let angle = 0;
        slices.forEach((slice, i) => {
            const fraction = slice.value! / total, end = angle + fraction * Math.PI * 2, middle = (angle + end) / 2;
            const offset = spec.exploded ? .13 : 0, center: L1502Vec3 = [Math.cos(middle) * offset, Math.sin(middle) * offset, 0];
            const segments = Math.max(2, Math.ceil(fraction * 96)), fill = palette[i % palette.length];
            const arc: L1502Vec3[] = Array.from({ length: segments + 1 }, (_, j) => {
                const a = angle + (end - angle) * j / segments; return [center[0] + Math.cos(a), center[1] + Math.sin(a), .26];
            });
            const info = { kind: 'pie-slice', name: slice.name, value: slice.value, fraction, startAngle: angle, endAngle: end };
            if (fraction > 0) {
                for (let j = 0; j < segments; j++) {
                    addFace([[arc[j][0], arc[j][1], 0], arc[j], arc[j + 1], [arc[j + 1][0], arc[j + 1][1], 0]], fill, info, { lighting: true });
                }
                // The cap is one planar sector, avoiding internal raster seams between coplanar triangles.
                addFace([[center[0], center[1], .26], ...arc], fill, info, { stroke: fill, width: .35, lighting: false });
                addFace([center, [center[0], center[1], .26], arc[0], [arc[0][0], arc[0][1], 0]], fill, info, { lighting: true });
                addFace([center, [arc[segments][0], arc[segments][1], 0], arc[segments], [center[0], center[1], .26]], fill, info, { lighting: true });
                labels.push({ position: [center[0] + Math.cos(middle) * .64, center[1] + Math.sin(middle) * .64, .27], text: `${formatNumber(fraction * 100)}%`, color: '#172033' });
            }
            angle = end;
        });
        notes += ` · 合计 ${formatNumber(total)} · 厚度为显示几何，扇区角度严格按 Y 比例`;
    } else {
        requireLimit(data.points.length, spec.kind === 'implicit-surface' ? 50000 : 20000, '空间观测');
        entries = groupEntries(data, axes);
        names = [...entriesByGroup(entries).keys()];
        const scalars = entries.map(e => e.point.color ?? e.position[2]);
        colorBounds = extent(scalars);
        colorLabel = data.mapping.color !== undefined ? String(data.table.columns[data.mapping.color] || 'Color') : style.zLabel || 'Z';
        const groupColor = (name: string): string => palette[Math.max(0, names.indexOf(name)) % palette.length];
        const entryColor = (e: Entry): string => useScale ? valueColor(e.point.color ?? e.point.z!, colorBounds, valuePalette) : groupColor(e.group);
        const originalGroups = entriesByGroup(entries);
        if (spec.kind === 'bar3') {
            requireLimit(entries.length, 2200, '立体柱');
            if (spec.horizontal) {
                axes = [axis2, axis0, axis1];
                entries = entries.map(e => ({ ...e, position: [e.position[2], e.position[0], e.position[1]] }));
            }
            const valueAxis = spec.horizontal ? 0 : 2;
            axes[spec.horizontal ? 1 : 0].measuredTicks = true;
            axes[spec.horizontal ? 2 : 1].measuredTicks = true;
            expandAxis(axes[valueAxis], [0]);
            const locations = new Map<string, Entry[]>();
            for (const e of entries) {
                const id = spec.horizontal ? xyKey(e.position[1], e.position[2]) : xyKey(e.position[0], e.position[1]);
                const list = locations.get(id) ?? []; list.push(e); locations.set(id, list);
            }
            for (const list of locations.values()) for (let i = 0; i < list.length; i++) {
                const e = list[i], fill = entryColor(e), p = e.position;
                const categoryA = spec.horizontal ? 1 : 0, categoryB = spec.horizontal ? 2 : 1;
                const a = localHalfWidth(p[categoryA], axes[categoryA].values, .34), b = localHalfWidth(p[categoryB], axes[categoryB].values, .34);
                const lo = [...p] as L1502Vec3, hi = [...p] as L1502Vec3;
                lo[categoryA] = p[categoryA] - a + 2 * a * i / list.length; hi[categoryA] = p[categoryA] - a + 2 * a * (i + 1) / list.length;
                lo[categoryB] -= b; hi[categoryB] += b;
                lo[valueAxis] = Math.min(0, p[valueAxis]); hi[valueAxis] = Math.max(0, p[valueAxis]);
                const info = { ...entryInfo(e), kind: 'bar', baseline: 0, valueAxis, value: p[valueAxis] };
                for (const face of cubeFaces(lo, hi)) addFace(face, fill, info, { lighting: true, gradient: spec.gradient });
                expandAxis(axes[categoryA], [lo[categoryA], hi[categoryA]]); expandAxis(axes[categoryB], [lo[categoryB], hi[categoryB]]);
                if (style.showValues || spec.labels) labels.push({ position: p, text: e.point.label || formatNumber(p[valueAxis]), color: '#172033' });
            }
            notes += ' · 柱长对应原始 Z，基线为 0';
        } else if (spec.kind === 'scatter3' || spec.kind === 'stem3') {
            const maxSize = Math.max(1, ...entries.map(e => Math.max(0, e.point.size ?? 1)));
            if (spec.kind === 'stem3') { expandAxis(axis2, [0]); axis0.measuredTicks = true; axis1.measuredTicks = true; }
            for (const e of entries) {
                const fill = entryColor(e);
                if (spec.kind === 'stem3') addLine([[e.position[0], e.position[1], 0], e.position], fill, { ...entryInfo(e), kind: 'stem', baseline: 0 });
                addPoint(e, fill, e.point.size !== undefined ? 2 + 8 * Math.sqrt(Math.max(0, e.point.size) / maxSize) : Math.max(3, fontSize * .3));
            }
        } else if (spec.kind === 'line3') {
            for (const list of originalGroups.values()) {
                for (let i = 1; i < list.length; i++) addLine([list[i - 1].position, list[i].position], entryColor(list[i]), { kind: 'trajectory', group: list[i].group, indices: [list[i - 1].index, list[i].index] }, 2);
                for (const e of list) addPoint(e, entryColor(e), 2.8);
            }
            notes += ' · 每组按输入观测顺序连接';
        } else if (spec.kind === 'vector3') {
            requireLimit(entries.length, 3500, '空间向量');
            for (const e of entries) {
                const end = l1502VectorEndpoint(e.position, e.point), fill = entryColor(e), info = { ...entryInfo(e), kind: 'vector', end, components: [e.point.u, e.point.v, e.point.w] };
                addLine([e.position, end], fill, info, 1.7);
                // A 3D four-sided arrow head follows the original vector direction, including W.
                const vector = sub(end, e.position), length = norm(vector);
                if (length > EPS) {
                    const unit = vector.map(v => v / length) as L1502Vec3, reference: L1502Vec3 = Math.abs(unit[2]) < .85 ? [0, 0, 1] : [0, 1, 0];
                    const side0 = cross(unit, reference), side = side0.map(v => v / norm(side0)) as L1502Vec3, other = cross(unit, side);
                    const headLength = length * .2, headRadius = headLength * .38, base = sub(end, unit.map(v => v * headLength) as L1502Vec3);
                    const ring = [side, other, side.map(v => -v) as L1502Vec3, other.map(v => -v) as L1502Vec3].map(direction => add(base, direction.map(v => v * headRadius) as L1502Vec3));
                    for (let i = 0; i < 4; i++) addFace([end, ring[i], ring[(i + 1) % 4]], fill, info, { lighting: true });
                    for (const vertex of ring) axes.forEach((axis, d) => expandAxis(axis, [vertex[d]]));
                }
                axes.forEach((axis, d) => expandAxis(axis, [end[d]]));
                addPoint(e, fill, 2.1);
            }
            notes += ' · 终点 = (X+U, Y+V, Z+W)，向量未单位化';
        } else if (spec.kind === 'implicit-surface') {
            if (entries.some(e => !finite(e.point.color))) throw new Error('隐式等值面需要 XYZ 网格和独立 Color 标量场列。');
            if (axes.some(a => a.labels)) throw new Error('隐式等值面要求 XYZ 均为数值坐标。');
            const iso = finite(style.isoLevel) ? style.isoLevel : 0;
            const mesh = l1502MarchingTetrahedra(entries.map(e => ({ position: e.position, value: e.point.color! })), iso);
            if (!mesh.completeCells) throw new Error('标量场没有完整的八角 XYZ 网格单元，无法提取等值面。');
            if (!mesh.triangles.length) throw new Error(`完整网格内没有穿过等值 ${formatNumber(iso)} 的表面；请调整阈值。`);
            const fill = valueColor(iso, colorBounds, valuePalette);
            for (const triangle of mesh.triangles) addFace(triangle, fill, { kind: 'iso-face', scalar: iso, vertices: triangle }, { lighting: true });
            notes += ` · ${colorLabel} = ${formatNumber(iso)} · ${mesh.triangles.length} 个三角面 · 完整单元 ${mesh.completeCells}${mesh.missingCells ? `，缺失单元 ${mesh.missingCells} 保留为空` : ''}`;
        } else if (spec.kind === 'surface' || spec.kind === 'tri-mesh' || spec.kind === 'tri-surface') {
            if (axes[0].labels || axes[1].labels) throw new Error('空间曲面要求 X、Y 为真实数值坐标。');
            let totalFaces = 0;
            for (const [group, list] of originalGroups) {
                const positions = list.map(e => e.position);
                const faces = spec.kind === 'surface' ? l1502GridFaces(positions) : l1502TriangulateXY(positions).map(ids => ids.map(i => positions[i]));
                totalFaces += faces.length;
                const lookup = new Map(list.map(e => [key(e.position), e]));
                for (const face of faces) {
                    const scalar = face.reduce((sum, p) => sum + (lookup.get(key(p))!.point.color ?? p[2]), 0) / face.length;
                    const fill = useScale ? valueColor(scalar, colorBounds, valuePalette) : groupColor(group);
                    if (spec.kind === 'tri-mesh' || spec.kind === 'surface' && spec.filled === false) addLine([...face, face[0]], fill, { kind: spec.kind === 'tri-mesh' ? 'triangle-wire' : 'surface-wire', group, vertices: face }, .9);
                    else addFace(face, fill, { kind: 'surface-face', group, scalar, vertices: face });
                }
                if (spec.curtain && spec.kind === 'surface') {
                    expandAxis(axis2, [0]);
                    const boundary = new Map<string, { a: L1502Vec3; b: L1502Vec3; count: number }>();
                    for (const face of faces) for (let i = 0; i < face.length; i++) {
                        const a = face[i], b = face[(i + 1) % face.length], id = [key(a), key(b)].sort().join(';');
                        const edge = boundary.get(id);
                        if (edge) edge.count++; else boundary.set(id, { a, b, count: 1 });
                    }
                    for (const { a, b, count } of boundary.values()) if (count === 1) addFace([a, b, [b[0], b[1], 0], [a[0], a[1], 0]], valueColor((a[2] + b[2]) / 2, colorBounds, valuePalette), { kind: 'curtain', group, baseline: 0 }, { opacity: .65, lighting: true });
                }
                if (spec.withContours) {
                    const [zmin, zmax] = extent(positions.map(p => p[2]));
                    const levels = Array.from({ length: 7 }, (_, i) => zmin + (zmax - zmin) * (i + 1) / 8);
                    const segments = l1502ContourSegments(faces, zmin === zmax ? [] : levels), labeled = new Set<number>();
                    for (const segment of segments) {
                        addLine(segment.points, '#273449', { kind: 'contour', level: segment.level, group }, 1.05);
                        if ((style.showValues || spec.labels) && !labeled.has(segment.level)) { labels.push({ position: segment.points[0], text: formatNumber(segment.level), color: '#172033' }); labeled.add(segment.level); }
                    }
                }
            }
            if (!totalFaces) throw new Error(spec.kind === 'surface' ? '曲面需要至少一个完整相邻四角网格；缺失坐标保持为空。' : '三角剖分需要至少三个不同、非共线的 XY 观测。');
            notes += spec.kind === 'surface' ? ` · ${totalFaces} 个完整相邻网格，缺格不补值` : ` · XY Delaunay 剖分 · ${totalFaces} 个三角形`;
            if (spec.withContours) notes += ' · 等高线按原始 Z 数值切片';
        } else if (spec.kind === 'waterfall' || spec.kind === 'ribbon') {
            if (axes[0].labels || axes[1].labels) throw new Error('瀑布图和带状图要求数值 X、Y 坐标。');
            const xs = unique(entries.map(e => e.position[0])), ys = unique(entries.map(e => e.position[1]));
            if (spec.kind === 'waterfall') expandAxis(axis2, [0]);
            let segments = 0;
            for (const [group, list] of originalGroups) {
                const rows = new Map<number, Entry[]>();
                for (const e of list) { const row = rows.get(e.position[1]) ?? []; row.push(e); rows.set(e.position[1], row); }
                for (const [y, row] of rows) {
                    const ordered = row.toSorted((a, b) => a.position[0] - b.position[0]);
                    const half = localHalfWidth(y, ys, .24);
                    for (let i = 1; i < ordered.length; i++) {
                        const a = ordered[i - 1], b = ordered[i];
                        if (xs.indexOf(b.position[0]) !== xs.indexOf(a.position[0]) + 1) continue;
                        const scalar = ((a.point.color ?? a.position[2]) + (b.point.color ?? b.position[2])) / 2;
                        const fill = useScale ? valueColor(scalar, colorBounds, valuePalette) : groupColor(group);
                        const info = { kind: spec.kind, group, vertices: [a.position, b.position], scalar };
                        if (spec.kind === 'waterfall') {
                            addFace([[a.position[0], y, 0], a.position, b.position, [b.position[0], y, 0]], fill, info, { opacity: .22 });
                            addLine([a.position, b.position], fill, info, 2);
                        } else {
                            addFace([[a.position[0], y - half, a.position[2]], [b.position[0], y - half, b.position[2]], [b.position[0], y + half, b.position[2]], [a.position[0], y + half, a.position[2]]], fill, info, { lighting: spec.lighting });
                            expandAxis(axis1, [y - half, y + half]);
                        }
                        segments++;
                    }
                    for (const e of ordered) addPoint(e, entryColor(e), 2);
                }
            }
            if (!segments) throw new Error('瀑布图和带状图需要相同 Y 行上至少两个相邻 X 观测。');
            notes += ' · 每个原始 Y 独立成带，缺失 X 留孔';
        }
        if (style.showValues || spec.labels) for (const e of entries) {
            if (spec.kind !== 'bar3' && !['surface', 'tri-surface', 'implicit-surface'].includes(spec.kind)) labels.push({ position: e.position, text: e.point.label || formatNumber(e.point.z!), color: '#172033' });
        }
    }

    requireLimit(primitives.length, 40000, '空间几何');
    // Complete group legends are live SVG text. They wrap instead of disappearing into a scroll window.
    const legendSize = Math.max(7, fontSize * .82), legendMax = Math.min(210, width * .35);
    let legendX = 20, legendY = top, legendRowHeight = 0;
    const showLegend = names.length > 1 || names.length === 1 && data.mapping.group !== undefined;
    if (showLegend) for (let i = 0; i < names.length; i++) {
        const label = wrapChartText(names[i], legendMax, legendSize, family), labelWidth = textWidth(label, legendSize, family), labelHeight = label.split('\n').length * legendSize * 1.2;
        if (legendX + 25 + labelWidth > width - 20 && legendX > 20) { legendY += legendRowHeight + 7; legendX = 20; legendRowHeight = 0; }
        graphic.push({ type: 'rect', shape: { x: legendX, y: legendY + 3, width: 14, height: 7 }, z: 100000, silent: true, style: { fill: useScale ? 'none' : palette[i % palette.length], stroke: useScale ? palette[i % palette.length] : 'none', lineWidth: 1.8 } });
        text(label, legendX + 21, legendY, legendSize, 'left', '#334155', legendMax);
        legendX += labelWidth + 44; legendRowHeight = Math.max(legendRowHeight, labelHeight);
    }
    if (showLegend) top = legendY + legendRowHeight + 10;
    const footSize = Math.max(7, fontSize * .56), footnote = wrapChartText(notes, width - 32, footSize, family), footHeight = footnote.split('\n').length * footSize * 1.2;
    text(footnote, width / 2, height - footHeight - 9, footSize, 'center', '#64748b', width - 32);
    const colorWidth = useScale ? Math.max(85, fontSize * 4.4) : 0;
    const left = 18 + fontSize * 2.4, right = width - colorWidth - 18 - fontSize;
    const plotTop = top + fontSize * .4, plotBottom = height - footHeight - 16 - fontSize * 2.25;
    if (right - left < 100 || plotBottom - plotTop < 80) throw new Error('画布不足以完整显示标题、图例和三维坐标，请增大画布或减小字号。');
    axes.forEach(axis => expandAxis(axis, []));
    const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
    const camera = (p: L1502Vec3): L1502Vec3 => {
        const n = p.map((v, d) => (v - axes[d].min) / (axes[d].max - axes[d].min) * 2 - 1) as L1502Vec3;
        const horizontal = n[0] * Math.cos(a) - n[1] * Math.sin(a), ground = n[0] * Math.sin(a) + n[1] * Math.cos(a);
        return [horizontal, n[2] * Math.cos(b) - ground * Math.sin(b), n[2] * Math.sin(b) + ground * Math.cos(b)];
    };
    const perspective = (p: L1502Vec3): Vec2 => { const c = camera(p), f = 7 / (7 - c[2]); return [c[0] * f, -c[1] * f]; };
    const axisOrigin = (d: number): L1502Vec3 => {
        const p = axes.map(axis => axis.min) as L1502Vec3;
        if (d === 0) p[1] = Math.cos(a) >= 0 ? axes[1].max : axes[1].min;
        if (d === 1) p[0] = Math.sin(a) >= 0 ? axes[0].max : axes[0].min;
        if (d === 2) {
            const corners: L1502Vec3[] = [[axes[0].min, axes[1].min, p[2]], [axes[0].max, axes[1].min, p[2]], [axes[0].max, axes[1].max, p[2]], [axes[0].min, axes[1].max, p[2]]];
            return corners.reduce((previous, point) => perspective(point)[0] < perspective(previous)[0] ? point : previous);
        }
        return p;
    };
    // Fit visible data and rulers. Empty, undrawn corners of a full bounding cube must not shrink the chart.
    const boundsVertices = spec.kind === 'pie3' ? [] : style.showGrid
        ? cubeFaces(axes.map(axis => axis.min) as L1502Vec3, axes.map(axis => axis.max) as L1502Vec3).flat()
        : [0, 1, 2].flatMap(d => { const start = axisOrigin(d), end = [...start] as L1502Vec3; end[d] = axes[d].max; return [start, end]; });
    const projected = [...boundsVertices, ...primitives.flatMap(p => p.vertices)].map(perspective);
    const [xmin, xmax] = extent(projected.map(p => p[0])), [ymin, ymax] = extent(projected.map(p => p[1]));
    const scale = Math.min((right - left) / (xmax - xmin || 1), (plotBottom - plotTop) / (ymax - ymin || 1));
    const project = (p: L1502Vec3): Vec2 => { const s = perspective(p); return [(left + right) / 2 + (s[0] - (xmin + xmax) / 2) * scale, (plotTop + plotBottom) / 2 + (s[1] - (ymin + ymax) / 2) * scale]; };

    if (spec.kind !== 'pie3') {
        const base: L1502Vec3 = axes.map(axis => axis.min) as L1502Vec3;
        const tickBoxes: { x: number; y: number; width: number; height: number }[] = [];
        if (style.showGrid) {
            for (let d = 0; d < 3; d++) for (const tick of ticks(axes[d])) {
                const point = [...base] as L1502Vec3; point[d] = tick.value;
                for (let other = 0; other < 3; other++) if (other !== d) {
                    const end = [...point] as L1502Vec3; end[other] = axes[other].max;
                    const from = project(point), to = project(end);
                    graphic.push({ type: 'line', z: 0, silent: true, shape: { x1: from[0], y1: from[1], x2: to[0], y2: to[1] }, style: { stroke: '#d9e1e8', lineWidth: .65 } });
                }
            }
        }
        axes.forEach((axis, d) => {
            // Draw XY rulers on their front bounding edges; put the Z ruler on the left silhouette.
            // Their numerical direction stays min→max even when the camera reverses an edge on screen.
            const axisBase = axisOrigin(d);
            const endpoint = [...axisBase] as L1502Vec3; endpoint[d] = axis.max;
            const from = project(axisBase), to = project(endpoint), dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy) || 1;
            let normal: Vec2 = [-dy / length, dx / length];
            const middle: Vec2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], center: Vec2 = [(left + right) / 2, (plotTop + plotBottom) / 2];
            if (normal[0] * (middle[0] - center[0]) + normal[1] * (middle[1] - center[1]) < 0) normal = [-normal[0], -normal[1]];
            graphic.push({ type: 'line', z: 60000, silent: true, info: { kind: 'axis', dimension: d, min: axis.min, max: axis.max }, shape: { x1: from[0], y1: from[1], x2: to[0], y2: to[1] }, style: { stroke: '#64748b', lineWidth: 1.1 } });
            const axisTicks = ticks(axis), tickSize = Math.max(7, fontSize * .72), axisNameSize = Math.max(8, fontSize * .82);
            requireLimit(axisTicks.length, 100, `${axis.name} 类别刻度`);
            let maxTickExtent = tickSize, maxTickShift = 0;
            for (const tick of axisTicks) {
                const p = [...axisBase] as L1502Vec3; p[d] = tick.value;
                const q = project(p), label = axis.labels ? wrapChartText(tick.label, Math.max(28, Math.min(95, length / Math.max(2, axisTicks.length) * 1.6)), tickSize, family) : tick.label;
                maxTickExtent = Math.max(maxTickExtent, Math.abs(normal[0]) * textWidth(label, tickSize, family) + Math.abs(normal[1]) * label.split('\n').length * tickSize * 1.2);
                graphic.push({ type: 'line', z: 60000, silent: true, shape: { x1: q[0], y1: q[1], x2: q[0] + normal[0] * 5, y2: q[1] + normal[1] * 5 }, style: { stroke: '#64748b', lineWidth: 1 } });
                const align = normal[0] < -.5 ? 'right' : normal[0] > .5 ? 'left' : 'center';
                const labelWidth = textWidth(label, tickSize, family), labelHeight = label.split('\n').length * tickSize * 1.2;
                let distance = 11 + tickSize * .5, labelX = 0, labelY = 0;
                let box = { x: 0, y: 0, width: labelWidth, height: labelHeight };
                for (let attempt = 0; attempt < 7; attempt++) {
                    labelX = q[0] + normal[0] * distance; labelY = q[1] + normal[1] * distance - tickSize / 2;
                    const xx = align === 'right' ? labelX - labelWidth : align === 'center' ? labelX - labelWidth / 2 : labelX;
                    box = { x: Math.max(4, Math.min(width - labelWidth - 4, xx)), y: Math.max(4, Math.min(height - labelHeight - 4, labelY)), width: labelWidth, height: labelHeight };
                    const overlap = tickBoxes.some(previous => box.x < previous.x + previous.width + 9 && box.x + box.width + 9 > previous.x && box.y < previous.y + previous.height + 9 && box.y + box.height + 9 > previous.y);
                    if (!overlap) break;
                    distance += tickSize * .7;
                }
                maxTickShift = Math.max(maxTickShift, distance - 11 - tickSize * .5);
                tickBoxes.push(box);
                text(label, labelX, labelY, tickSize, align, '#475569', Math.max(95, labelWidth + 1));
                const tickGraphic = graphic[graphic.length - 1] as GraphicComponentOption & { info?: Record<string, unknown> };
                tickGraphic.info = { kind: 'axis-tick', dimension: d, value: tick.value };
            }
            const nameLimit = Math.min(140, width * .24), wrappedName = wrapChartText(axis.name, nameLimit, axisNameSize, family);
            const nameExtent = (Math.abs(normal[0]) * textWidth(wrappedName, axisNameSize, family) + Math.abs(normal[1]) * wrappedName.split('\n').length * axisNameSize * 1.2) / 2;
            const titleOffset = 22 + maxTickExtent + nameExtent + maxTickShift;
            text(wrappedName, middle[0] + normal[0] * titleOffset, middle[1] + normal[1] * titleOffset - axisNameSize / 2, axisNameSize, 'center', '#172033', nameLimit);
        });
    }

    primitives.map((primitive, index) => ({ primitive, index, depth: primitive.vertices.reduce((sum, p) => sum + camera(p)[2], 0) / primitive.vertices.length })).sort((a, b) => a.depth - b.depth || a.index - b.index).forEach(({ primitive }, index) => {
        const points = primitive.vertices.map(project), fill = primitive.lighting ? litColor(primitive.fill, primitive.vertices) : primitive.fill;
        const geometryInfo = { ...primitive.info, coordinates: primitive.vertices };
        const base = { z: index + 10, info: geometryInfo, tooltip: { formatter: `${primitive.info?.group ?? primitive.info?.name ?? ''}\n${primitive.vertices[0].map(formatNumber).join(', ')}${primitive.info?.scalar !== undefined ? `\n${colorLabel}: ${formatNumber(Number(primitive.info.scalar))}` : ''}` } };
        if (primitive.type === 'circle') graphic.push({ ...base, type: 'circle', shape: { cx: points[0][0], cy: points[0][1], r: primitive.radius || 4 }, style: { fill, stroke: primitive.stroke, lineWidth: primitive.width || 1, opacity: primitive.opacity ?? 1 } });
        else if (primitive.type === 'polyline') graphic.push({ ...base, type: 'polyline', shape: { points }, style: { fill: 'none', stroke: primitive.stroke || fill, lineWidth: primitive.width || 1, opacity: primitive.opacity ?? 1, lineJoin: 'round' } });
        else graphic.push({ ...base, type: 'polygon', shape: { points }, style: { fill: primitive.gradient ? { type: 'linear', x: 0, y: 1, x2: 0, y2: 0, colorStops: [{ offset: 0, color: mixColor('#ffffff', fill, .5) }, { offset: 1, color: fill }] } : fill, stroke: primitive.stroke === primitive.fill ? fill : primitive.stroke || fill, lineWidth: primitive.width ?? .4, opacity: primitive.opacity ?? 1, lineJoin: 'round' } });
    });
    for (const label of labels) { const [x, y] = project(label.position); text(label.text, x + 5, y - fontSize - 3, Math.max(7, fontSize - 1), 'left', label.color, 100); }
    if (useScale) {
        const x = width - colorWidth + 12, y = plotTop + 18, barHeight = Math.max(50, Math.min(200, plotBottom - plotTop - 46));
        const stops = Array.from({ length: 17 }, (_, i) => ({ offset: i / 16, color: valueColor(colorBounds[1] - (colorBounds[1] - colorBounds[0]) * i / 16, colorBounds, valuePalette) }));
        graphic.push({ type: 'rect', z: 100000, silent: true, info: { kind: 'color-scale', min: colorBounds[0], max: colorBounds[1], label: colorLabel }, shape: { x, y, width: 12, height: barHeight }, style: { fill: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: stops }, stroke: '#94a3b8', lineWidth: .6 } });
        const colorFont = Math.max(7, fontSize * .66);
        text(colorLabel, x - 4, y - colorFont - 7, colorFont, 'left', '#475569', colorWidth - 16);
        for (let i = 0; i <= 4; i++) text(formatNumber(colorBounds[1] - (colorBounds[1] - colorBounds[0]) * i / 4), x + 18, y + barHeight * i / 4 - colorFont / 2, colorFont, 'left', '#475569', colorWidth - 34);
        if (spec.kind === 'implicit-surface') {
            const iso = finite(style.isoLevel) ? style.isoLevel : 0, t = colorBounds[0] === colorBounds[1] ? .5 : (colorBounds[1] - iso) / (colorBounds[1] - colorBounds[0]);
            const yy = y + barHeight * Math.max(0, Math.min(1, t));
            graphic.push({ type: 'line', z: 100001, silent: true, shape: { x1: x - 4, y1: yy, x2: x + 16, y2: yy }, style: { stroke: '#172033', lineWidth: 2 } });
        }
    }
    return { animation: false, backgroundColor: '#ffffff', textStyle: { fontFamily: family, fontSize }, tooltip: { show: true, renderMode: 'richText', confine: true }, graphic, series: [], aria: { enabled: true, label: { description: `${style.title}；${notes}` } } };
}
