import test from 'node:test';
import assert from 'node:assert/strict';
import * as echarts from 'echarts';
import { createL1502SpatialOption, l1502GridFaces, l1502TriangulateXY, l1502ContourSegments, l1502MarchingTetrahedra, l1502VectorEndpoint } from './l1502-render-spatial.ts';
import { L1502_SPATIAL_KINDS, l1502DefaultStyle } from './l1502-spec.ts';
import { L1502_TEMPLATES } from './l1502-catalog.ts';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';

const spec = (kind, extra = {}) => ({ issue: 1, folder: 'test', kind, ...extra });
const data = (points, extra = {}) => ({ table: { columns: ['X', 'Y', 'Z', 'Color'], rows: [], firstDataRow: 2 },
    mapping: { x: 0, ys: [1], z: 2, errors: {}, bounds: {} }, points,
    series: [{ name: 'Measured', points }], warnings: [], skipped: 0, ...extra });
const grid = (xs = [0, 2, 9], ys = [-3, 4, 10]) => xs.flatMap(x => ys.map(y => ({ x, y, z: x * .4 + y * .3 + 1 })));
const scalars = (n = 7) => Array.from({ length: n }, (_, i) => -1.5 + 3 * i / (n - 1)).flatMap(x =>
    Array.from({ length: n }, (_, i) => -1.5 + 3 * i / (n - 1)).flatMap(y =>
        Array.from({ length: n }, (_, i) => -1.5 + 3 * i / (n - 1)).map(z => ({ x, y, z, color: x * x + y * y + z * z - 1 }))));
const cloud = [{ x: 0, y: 0, z: 2 }, { x: 4, y: 0, z: 1 }, { x: 0, y: 3, z: 3 }, { x: 1, y: 1, z: 9 }, { x: 3, y: 2, z: 7 }];
const graphics = option => option.graphic;
const kind = (option, name) => graphics(option).filter(g => g.info?.kind === name);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

function render(dataset, kindSpec, style = l1502DefaultStyle('Measured geometry')) {
    const option = createL1502SpatialOption(dataset, kindSpec, style);
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: style.width, height: style.height });
    try {
        chart.setOption(option);
        const svg = chart.renderToSVGString();
        assert.doesNotMatch(svg, /NaN|Infinity|<image|<foreignObject/);
        const texts = chart.getZr().storage.getDisplayList().filter(element => element.type === 'tspan' && element.style?.text?.trim() && !element.ignore);
        for (const element of texts) {
            const box = element.getBoundingRect().clone(); if (element.transform) box.applyTransform(element.transform);
            assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= style.width + 1 && box.y + box.height <= style.height + 1,
                `${kindSpec.kind}: ${element.style.text} falls outside canvas: ${JSON.stringify(box)}`);
        }
        return { option, svg };
    } finally { chart.dispose(); }
}

test('all twelve spatial kinds render measured SVG geometry with complete axes and no bitmap', () => {
    for (const name of L1502_SPATIAL_KINDS) {
        const points = name === 'pie3' ? [{ x: 'Part A', y: 2 }, { x: 'Part B', y: 5 }, { x: 'Part C', y: 3 }]
            : name === 'implicit-surface' ? scalars()
            : name === 'vector3' ? cloud.map((p, i) => ({ ...p, u: i - 2, v: 2 - i / 2, w: -1 }))
            : name.startsWith('tri-') ? cloud : grid();
        const dataset = data(points, name === 'implicit-surface' ? { mapping: { x: 0, ys: [1], z: 2, color: 3, errors: {}, bounds: {} } } : {});
        const { option, svg } = render(dataset, spec(name));
        assert.ok(graphics(option).some(g => g.info?.coordinates), `${name} lacks true geometry`);
        assert.ok(svg.length > 3000);
        if (name !== 'pie3') assert.equal(kind(option, 'axis').length, 3);
    }
});

test('surface cells use unequal measured coordinates and leave every cell touching a hole absent', () => {
    const positions = grid().map(p => [p.x, p.y, p.z]);
    const faces = l1502GridFaces(positions);
    assert.equal(faces.length, 4);
    assert.deepEqual(faces[0].map(p => p.slice(0, 2)), [[0, -3], [2, -3], [2, 4], [0, 4]]);
    assert.equal(l1502GridFaces(positions.filter(p => !(p[0] === 2 && p[1] === 4))).length, 0);
    assert.equal(l1502GridFaces(positions.filter(p => !(p[0] === 0 && p[1] === -3))).length, 3);
    assert.throws(() => l1502GridFaces([...positions, positions[0]]), /重复/);
});

test('Delaunay triangles cover the scattered XY hull and use every actual observation', () => {
    const positions = cloud.map(p => [p.x, p.y, p.z]), triangles = l1502TriangulateXY(positions);
    assert.deepEqual([...new Set(triangles.flat())].sort(), [0, 1, 2, 3, 4]);
    const area = triangles.reduce((sum, ids) => {
        const [a, b, c] = ids.map(i => positions[i]);
        return sum + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    }, 0);
    near(area, 8.5);
    const { option: mesh } = render(data(cloud), spec('tri-mesh'));
    const { option: surface } = render(data(cloud), spec('tri-surface'));
    assert.equal(kind(mesh, 'triangle-wire').length, triangles.length);
    assert.equal(kind(surface, 'surface-face').length, triangles.length);
    for (const triangle of kind(surface, 'surface-face')) assert.ok(triangle.info.vertices.every(v => positions.some(p => p.every((x, i) => x === v[i]))));
    assert.throws(() => l1502TriangulateXY([...positions, [0, 0, 99]]), /不同 Z/);
    assert.deepEqual(l1502TriangulateXY([[0, 0, 0], [1, 1, 2], [2, 2, 9]]), []);
});

test('Delaunay does not seal missing cells of a measured regular grid', () => {
    const positions = grid([0, 1, 2, 3], [0, 1, 2, 3]).filter(p => !(p.x === 1 && p.y === 1)).map(p => [p.x, p.y, p.z]);
    const triangles = l1502TriangulateXY(positions);
    assert.ok(triangles.length > 0);
    for (const ids of triangles) {
        const pts = ids.map(i => positions[i]), xmin = Math.min(...pts.map(p => p[0])), xmax = Math.max(...pts.map(p => p[0]));
        const ymin = Math.min(...pts.map(p => p[1])), ymax = Math.max(...pts.map(p => p[1]));
        assert.ok(!(xmin <= 1 && xmax >= 1 && ymin <= 1 && ymax >= 1), 'triangle crosses the unmeasured central coordinate');
    }
});

test('contours intersect the actual numeric Z level and cannot pass across grid holes', () => {
    const positions = grid([0, 2, 5], [0, 3, 7]).map(p => [p.x, p.y, p.x + p.y]);
    const faces = l1502GridFaces(positions), segments = l1502ContourSegments(faces, [1, 4, 9]);
    assert.ok(segments.length > 0);
    for (const segment of segments) for (const p of segment.points) { near(p[2], segment.level); near(p[0] + p[1], segment.level); }
    assert.equal(l1502ContourSegments(l1502GridFaces(positions.filter(p => !(p[0] === 2 && p[1] === 3))), [1, 4, 9]).length, 0);
    const { option } = render(data(grid()), spec('surface', { lighting: true, withContours: true, curtain: true }));
    assert.ok(kind(option, 'contour').length > 0);
    assert.equal(kind(option, 'curtain').length, 8);
    assert.ok(kind(option, 'curtain').every(face => face.info.coordinates.some(p => p[2] === 0)));
});

test('marching tetrahedra extracts the supplied scalar level with consistently oriented measured interpolation', () => {
    const samples = [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => ({ position: [x, y, z], value: x + y + z - 1 }))));
    const mesh = l1502MarchingTetrahedra(samples, 0);
    assert.equal(mesh.completeCells, 1); assert.equal(mesh.missingCells, 0); assert.ok(mesh.triangles.length > 0);
    for (const [a, b, c] of mesh.triangles) {
        for (const p of [a, b, c]) near(p[0] + p[1] + p[2], 1);
        const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
        const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        assert.ok(normal.reduce((sum, n) => sum + n, 0) > 0);
    }
    const missing = l1502MarchingTetrahedra(samples.slice(1), 0);
    assert.deepEqual(missing, { triangles: [], completeCells: 0, missingCells: 1 });
    assert.throws(() => l1502MarchingTetrahedra([...samples, samples[0]], 0), /重复/);
    assert.throws(() => l1502MarchingTetrahedra(samples, NaN), /有限/);
});

test('implicit sphere geometry changes with isoLevel and is extracted from Color rather than Z', () => {
    const points = scalars(13), samples = points.map(p => ({ position: [p.x, p.y, p.z], value: p.color }));
    const zero = l1502MarchingTetrahedra(samples, 0), larger = l1502MarchingTetrahedra(samples, .5);
    for (const triangle of zero.triangles) for (const p of triangle) assert.ok(Math.abs(Math.hypot(...p) - 1) < .03);
    const averageRadius = mesh => mesh.triangles.flat().reduce((sum, p) => sum + Math.hypot(...p), 0) / (mesh.triangles.length * 3);
    assert.ok(averageRadius(larger) > averageRadius(zero) + .15);
    const dataset = data(points, { mapping: { x: 0, ys: [1], z: 2, color: 3, errors: {}, bounds: {} } });
    const style = { ...l1502DefaultStyle('Scalar field'), isoLevel: .5 };
    const { option } = render(dataset, spec('implicit-surface'), style);
    assert.ok(kind(option, 'iso-face').every(face => face.info.scalar === .5));
    assert.deepEqual(kind(option, 'color-scale').map(g => [g.info.min, g.info.max, g.info.label]), [[-1, 5.75, 'Color']]);
    assert.throws(() => createL1502SpatialOption(data(points.map(({ color, ...p }) => p)), spec('implicit-surface'), style), /Color/);
});

test('vector endpoints retain XYZ origins and independent U/V/W magnitudes including negative W', () => {
    assert.deepEqual(l1502VectorEndpoint([10, -3, 7], { u: 2, v: 5, w: -1 }), [12, 2, 6]);
    assert.throws(() => l1502VectorEndpoint([0, 0, 0], { u: 1, v: 2 }), /U、V、W/);
    const points = [{ x: 10, y: -3, z: 7, u: 2, v: 5, w: -1 }, { x: 0, y: 0, z: 4, u: 0, v: 0, w: 0 }];
    const { option } = render(data(points), spec('vector3'));
    const arrow = kind(option, 'vector').find(g => g.type === 'polyline' && g.info.index === 0);
    assert.deepEqual(arrow.info.coordinates, [[10, -3, 7], [12, 2, 6]]);
    assert.deepEqual(arrow.info.components, [2, 5, -1]);
    assert.ok(kind(option, 'axis').find(g => g.info.dimension === 0).info.max >= 12);
});

test('vertical and horizontal bars keep measured signed lengths, Color range and exported gradients', () => {
    const points = [{ x: 2, y: 4, z: -3, color: -8 }, { x: 9, y: 10, z: 7, color: 30 }];
    const dataset = data(points, { mapping: { x: 0, ys: [1], z: 2, color: 3, errors: {}, bounds: {} } });
    for (const horizontal of [false, true]) {
        const { option, svg } = render(dataset, spec('bar3', { horizontal, gradient: true, colorByValue: true, labels: true }));
        const bars = kind(option, 'bar'), valueAxis = horizontal ? 0 : 2;
        assert.equal(bars.length, 12); assert.ok(bars.every(g => g.info.valueAxis === valueAxis));
        for (const value of [-3, 7]) {
            const vertices = bars.filter(g => g.info.value === value).flatMap(g => g.info.coordinates);
            assert.deepEqual([Math.min(...vertices.map(p => p[valueAxis])), Math.max(...vertices.map(p => p[valueAxis]))], [Math.min(0, value), Math.max(0, value)]);
        }
        assert.deepEqual(kind(option, 'color-scale').map(g => [g.info.min, g.info.max]), [[-8, 30]]);
        assert.match(svg, /linearGradient/);
    }
});

test('line trajectories follow each group input order and local stems rise from their own XY baseline', () => {
    const a = [{ x: 4, y: 2, z: 3 }, { x: -1, y: 8, z: -2 }, { x: 3, y: 5, z: 4 }], b = [{ x: 6, y: 9, z: 1 }, { x: 7, y: 9, z: 2 }];
    const dataset = data([...a, ...b], { series: [{ name: 'A', points: a }, { name: 'B', points: b }] });
    const { option } = render(dataset, spec('line3'));
    const aLines = kind(option, 'trajectory').filter(g => g.info.group === 'A');
    assert.deepEqual(aLines.map(g => g.info.indices).sort((a, b) => a[0] - b[0]), [[0, 1], [1, 2]]);
    const { option: stems } = render(dataset, spec('stem3'));
    for (const stem of kind(stems, 'stem')) {
        const [base, end] = stem.info.coordinates; assert.deepEqual(base, [end[0], end[1], 0]);
    }
});

test('waterfall and ribbon do not bridge missing X coordinates and retain actual Y row positions', () => {
    const points = grid([0, 2, 9], [4, 10]).filter(p => !(p.x === 2 && p.y === 4));
    for (const name of ['waterfall', 'ribbon']) {
        const { option } = render(data(points), spec(name));
        const segments = kind(option, name);
        assert.ok(segments.length > 0);
        assert.ok(segments.every(g => g.info.vertices[0][1] === 10 && g.info.vertices[1][1] === 10));
        assert.ok(segments.every(g => g.info.vertices[1][0] - g.info.vertices[0][0] !== 9));
    }
});

test('pie sectors use exact supplied proportions, real thickness and complete names in the export', () => {
    const points = [{ x: 'First component', y: 2 }, { x: 'Second component', y: 5 }, { x: 'Absent component', y: 0 }];
    const { option, svg } = render(data(points), spec('pie3', { exploded: true }));
    const slices = kind(option, 'pie-slice');
    near(slices.find(g => g.info.name === 'First component').info.fraction, 2 / 7);
    near(slices.find(g => g.info.name === 'Second component').info.endAngle, Math.PI * 2);
    assert.ok(slices.some(g => g.info.coordinates.some(p => p[2] === 0) && g.info.coordinates.some(p => p[2] === .26)));
    assert.match(svg, /First component/); assert.match(svg, /Absent component/);
    assert.throws(() => createL1502SpatialOption(data([{ x: 'Bad', y: -1 }]), spec('pie3'), l1502DefaultStyle('test')), /非负/);
});

test('yaw and pitch alter true vertex projection without mutating input, while layout contains live text', () => {
    const dataset = data(grid()), original = structuredClone(dataset);
    const base = l1502DefaultStyle('Measured XYZ with unequal coordinates');
    const first = render(dataset, spec('surface', { withContours: true }), base);
    const second = render(dataset, spec('surface', { withContours: true }), { ...base, yaw: 130, pitch: 55, width: 900, height: 650, fontSize: 20,
        xLabel: 'Actual horizontal scientific coordinate', yLabel: 'Actual second scientific coordinate', zLabel: 'Actual measured height (units)' });
    assert.notDeepEqual(kind(first.option, 'surface-face')[0].shape.points, kind(second.option, 'surface-face')[0].shape.points);
    assert.deepEqual(dataset, original);
});

test('spatial complexity bounds fail explicitly instead of silently truncating observations', () => {
    assert.throws(() => l1502TriangulateXY(Array.from({ length: 1801 }, (_, i) => [i, i % 17, 1])), /1801|1,801/);
    assert.throws(() => createL1502SpatialOption(data(Array.from({ length: 2201 }, (_, i) => ({ x: i, y: 0, z: 1 }))), spec('bar3'), l1502DefaultStyle('test')), /未被截断/);
});

test('every catalog spatial variant exports at the editor publication font size with readable single-line numeric ticks', () => {
    const templates = L1502_TEMPLATES.filter(t => L1502_SPATIAL_KINDS.includes(t.l1502.kind));
    assert.equal(new Set(templates.map(t => t.l1502.kind)).size, 12);
    for (const template of templates) {
        const table = parseTemplateTable(template.demo), mapping = suggestL1502Mapping(table, template.l1502);
        const result = buildL1502Data(table, mapping, template.l1502);
        assert.equal(result.error, null, `${template.id}: ${result.error}`);
        const style = { ...l1502DefaultStyle(`${template.name} · 示例数据`), fontSize: 8 * 25.4 / 72 * 760 / 85 };
        const { option } = render(result.data, template.l1502, style);
        const axisTicks = kind(option, 'axis-tick');
        assert.ok(axisTicks.every(t => !t.style.text.includes('\n')), `${template.id} has a broken numeric tick`);
        const boxes = axisTicks.map(t => {
            const rect = echarts.format.getTextRect(t.style.text, t.style.font);
            return { x: t.x, y: t.y, width: rect.width, height: Number(t.style.lineHeight) };
        });
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            assert.ok(!(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y),
                `${template.id}: axis ticks ${axisTicks[i].style.text} and ${axisTicks[j].style.text} overlap`);
        }
    }
});

test('wire surface and filled surface variants retain distinct measured geometry', () => {
    const dataset = data(grid()), style = l1502DefaultStyle('wire and surface');
    const wire = createL1502SpatialOption(dataset, spec('surface', { filled: false }), style);
    const filled = createL1502SpatialOption(dataset, spec('surface', { filled: true }), style);
    assert.equal(kind(wire, 'surface-face').length, 0); assert.equal(kind(wire, 'surface-wire').length, 4);
    assert.equal(kind(filled, 'surface-face').length, 4); assert.equal(kind(filled, 'surface-wire').length, 0);
});
