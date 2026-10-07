import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplateTable } from './templates.ts';
import { buildL1502Data, suggestL1502Mapping } from './l1502-data.ts';
import { L1502_TEMPLATES } from './l1502-catalog.ts';
const spec = (kind, flags = {}) => ({ kind, issue: 1, folder: 'test', ...flags });
const run = (rows, kind, mapping, flags = {}) => { const table = parseTemplateTable(rows); return buildL1502Data(table, mapping ?? suggestL1502Mapping(table, spec(kind, flags)), spec(kind, flags)); };
const data = (...args) => { const result = run(...args); assert.equal(result.error, null); assert.ok(result.data); return result.data; };

test('all 139 catalog examples support automatic editable bindings', () => {
    assert.equal(L1502_TEMPLATES.length, 139);
    for (const t of L1502_TEMPLATES) { const table = parseTemplateTable(t.demo), mapping = suggestL1502Mapping(table, t.l1502), result = buildL1502Data(table, mapping, t.l1502); assert.equal(result.error, null, `${t.id}: ${result.error}`); }
});
test('wide multiple Y retain each valid observation and do not fill missing cells', () => {
    const input = [['X', 'A', 'B'], [3, 0, -1], [1, null, 4], [3, 2, null]], original = structuredClone(input);
    const result = data(input, 'line');
    assert.deepEqual(result.series.map(s => s.points.map(p => [p.x, p.y])), [[[3, 0], [3, 2]], [[3, -1], [1, 4]]]);
    assert.equal(result.skipped, 2); assert.deepEqual(input, original);
});
test('lower/upper and errors map independently per series; mixed error lines remain valid', () => {
    const input = [['X', 'A', 'A_lower', 'A_upper', 'A_error', 'B'], [0, 2, 1, 3, .2, 4], [1, 3, 2, 5, 0, 5]], result = data(input, 'error-line');
    assert.deepEqual(result.mapping.ys, [1, 5]); assert.deepEqual(result.mapping.bounds, { 1: { lower: 2, upper: 3 } });
    assert.equal(result.series[0].points[0].error, .2); assert.equal(result.series[1].points[0].error, undefined);
    for (const bad of [[0, 2, 3, 1, .2, 4], [0, 2, 1, 1.5, .2, 4], [0, 2, 1, 3, -.2, 4]]) assert.match(run([input[0], bad], 'error-line').error, /上下界|误差/);
});
test('mandatory roles and bounds cannot be omitted or refer to unrelated indexes', () => {
    const rows = [['X', 'Y'], [1, 2]];
    for (const kind of ['bubble', 'vector2', 'contour', 'confidence', 'error-bar', 'implicit-surface']) assert.equal(run(rows, kind).data, null);
    assert.equal(run(rows, 'line', { x: 0, ys: [1, 1], errors: {}, bounds: {} }).data, null);
    assert.equal(run(rows, 'line', { x: 0, ys: [1], z: 9, errors: {}, bounds: {} }).data, null);
});
test('negative Size fails, zero Size and signed Color stay measured values', () => {
    const rows = [['X', 'Y', 'Size', 'Color'], [1, 2, 0, -3], [2, 3, 4, 0]], result = data(rows, 'bubble', undefined, { colorByValue: true });
    assert.deepEqual(result.points.map(p => [p.size, p.color]), [[0, -3], [4, 0]]);
    assert.match(run([rows[0], [1, 2, -1, 0]], 'bubble').error, /负数/);
});
test('heatmap preserves nonnumeric labels, actual numeric coordinates and missing holes', () => {
    const result = data([['Y', '1', '4'], [2, 0, null], [-3, -2, 7]], 'heatmap');
    assert.deepEqual(result.matrix, { xs: [1, 4], ys: [2, -3], cells: [{ xi: 0, yi: 0, value: 0 }, { xi: 0, yi: 1, value: -2 }, { xi: 1, yi: 1, value: 7 }] });
    assert.equal(result.skipped, 1);
});
test('contour strictly requires unique complete XY grid; spatial surfaces retain missing vertices as holes', () => {
    const rows = [['X', 'Y', 'Z'], [0, 0, -1], [1, 0, 0], [0, 1, 1], [1, 1, 2]];
    assert.equal(data(rows, 'contour').matrix.cells.length, 4);
    assert.match(run([...rows, rows[1]], 'contour').error, /重复/);
    assert.match(run(rows.slice(0, 4), 'contour').error, /完整/);
    const hole = data(rows.slice(0, 4), 'surface'); assert.equal(hole.matrix.cells.length, 3); assert.match(hole.warnings.join(' '), /孔洞/);
});
test('XYZ and vector UVW plus scalar Color bind without losing signed values', () => {
    const result = data([['X', 'Y', 'Z', 'U', 'V', 'W', 'Color'], [0, 1, 2, -3, 4, 0, -5]], 'vector3');
    assert.deepEqual(result.points[0], { x: 0, y: 1, z: 2, u: -3, v: 4, w: 0, color: -5 });
});
test('long box samples preserve every original category/group replicate and notch formula is explicit', () => {
    const rows = [['Category', 'Value', 'Group'], ['B', 0, 'A'], ['B', 3, 'A'], ['B', 3, 'A'], ['A', 5, 'B']], result = data(rows, 'box', undefined, { grouped: true, notched: true });
    assert.deepEqual(result.samples.map(s => s.values), [[0, 3, 3], [5]]); assert.match(result.warnings[0], /1\.57.*√n/);
    assert.match(data(rows, 'jitter').warnings.join(' '), /分类展示.*未增加/);
});
test('bubble matrix uses true long-table Size and Color; bubble clouds bind Word without numeric X', () => {
    const matrix = data([['X', 'Y', 'Size', 'Color'], ['A', 'C', 0, -3], ['B', 'D', 5, 2]], 'bubble-matrix');
    assert.deepEqual(matrix.matrix.xs, ['A', 'B']); assert.deepEqual(matrix.matrix.ys, ['C', 'D']); assert.deepEqual(matrix.matrix.cells.map(c => [c.size, c.value]), [[0, -3], [5, 2]]);
    const cloud = data([['Word', 'Size', 'Color', 'Group'], ['α', 5, -1, 'A'], ['β', 10, 0, 'B']], 'bubble-cloud'); assert.equal(cloud.points.length, 2); assert.equal(cloud.points[0].x, 'α');
});
test('network preserves every edge including repeated/self edges; optional weight is clearly a layout convention', () => {
    const result = data([['Source', 'Target', 'Weight'], ['A', 'B', 0], ['A', 'B', 2], ['B', 'B', 3]], 'network'); assert.equal(result.edges.length, 3);
    const unit = data([['Source', 'Target'], ['A', 'B']], 'network'); assert.equal(unit.edges[0].weight, 1); assert.match(unit.warnings[0], /未绑定权重.*1/);
    assert.match(run([['Word', 'Weight'], ['A', -2]], 'word-cloud').error, /负数/);
});
test('raw histogram observations retain repeated samples and signs; log axes reject nonpositive coordinates', () => {
    const result = data([['X', 'Y', 'Group'], [0, -2, 'A'], [1, -2, 'A'], [2, 0, 'A'], [3, 5, 'B']], 'histogram');
    assert.deepEqual(result.samples.map(s => s.values), [[-2, -2, 0], [5]]);
    assert.match(run([['X', 'Y'], [0, 1], [1, 2]], 'line', undefined, { logX: true }).error, /非正/);
});
test('hard scale limits return errors instead of silently truncating observations', () => {
    const rows = [['X', 'Y'], ...Array.from({ length: 20001 }, (_, i) => [i, i])]; assert.match(run(rows, 'line').error, /20000/);
    assert.match(run([['Word', 'Weight'], ...Array.from({ length: 301 }, (_, i) => [`w${i}`, i + 1])], 'word-cloud').error, /300/);
});
