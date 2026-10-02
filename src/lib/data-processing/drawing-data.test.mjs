import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplateTable } from './templates.ts';
import { suggestDrawingMapping, buildDrawingData } from './drawing-data.ts';

const resultFor = (matrix, chartId, variant, mapping) => {
    const table = parseTemplateTable(matrix);
    const result = buildDrawingData(table, mapping ?? suggestDrawingMapping(table, chartId, variant), chartId, variant);
    return { table, result };
};
const dataFor = (...args) => {
    const { result } = resultFor(...args); assert.equal(result.error, null); assert.ok(result.data); return result.data;
};

test('embedding long tables keep repeated X, every observation, signs and group-local order', () => {
    const matrix = [['Group', 'X', 'Y'], ['A', 2, 5], ['B', 2, -3], ['A', 1, 0], ['A', 2, 5], ['B', 'bad', 1]];
    const original = structuredClone(matrix);
    const data = dataFor(matrix, 'scatter', 'embedding-scatter');
    assert.deepEqual(data.x, [2, 2, 1, 2]);
    assert.deepEqual(data.pointGroups, [{ name: 'A', points: [[2, 5], [1, 0], [2, 5]] }, { name: 'B', points: [[2, -3]] }]);
    assert.equal(data.skipped, 1); assert.match(data.warnings[0], /第 6 行/);
    assert.deepEqual(matrix, original);
});

test('position long tables retain repeated nominal positions and work without a group column', () => {
    const data = dataFor([['Position', 'Value'], ['p2', 0], ['p1', -1], ['p2', 4]], 'scatter', 'position-scatter');
    assert.deepEqual(data.x, ['p2', 'p1', 'p2']);
    assert.deepEqual(data.pointGroups, [{ name: 'Value', points: [['p2', 0], ['p1', -1], ['p2', 4]] }]);
    const numericLabels = dataFor([['Position', 'Value', 'Group'], [20, 1, 'A'], [5, 2, 'B'], [20, 3, 'A']], 'scatter', 'position-scatter');
    assert.deepEqual(numericLabels.pointGroups[0].points, [['20', 1], ['20', 3]]);
});

test('grouped boxes preserve the exact samples, including zero and repeats, within category and series', () => {
    const data = dataFor([['Category', 'Value', 'Group'], ['B', 4, 'treated'], ['A', 1, 'control'], ['B', 0, 'treated'], ['B', 4, 'treated'], ['A', null, 'treated'], ['B', 3, 'control']], 'box', 'grouped-box');
    assert.deepEqual(data.x, ['B', 'A']);
    assert.deepEqual(data.samples.map(({ category, series, values }) => ({ category, series, values })), [
        { category: 'B', series: 'treated', values: [4, 0, 4] },
        { category: 'A', series: 'control', values: [1] },
        { category: 'B', series: 'control', values: [3] },
    ]);
    assert.deepEqual(data.series.map(item => item.name), ['treated', 'control']);
    assert.equal(data.samples.reduce((count, item) => count + item.values.length, 0), 5);
    assert.equal(data.skipped, 1); assert.match(data.warnings[0], /第 6 行/);
});

test('paired conditions preserve their own object order and values despite shuffled input columns and unmatched objects', () => {
    const matrix = [['Condition', 'Metric B', 'Model', 'Metric A'], ['before', 20, 'M2', 2], ['after', 40, 'M1', 4], ['before', 10, 'M1', 1], ['after', 30, 'M2', 3], ['before', 50, 'M3', 5]];
    const table = parseTemplateTable(matrix), mapping = suggestDrawingMapping(table, 'line', 'paired-correlation');
    assert.deepEqual(mapping, { x: 2, ys: [1, 3], errors: {}, group: 0 });
    const result = buildDrawingData(table, mapping, 'line', 'paired-correlation');
    assert.equal(result.error, null);
    assert.deepEqual(result.data.comparisonGroups, [
        { name: 'before', x: ['M2', 'M1', 'M3'], series: [{ name: 'Metric B', values: [20, 10, 50] }, { name: 'Metric A', values: [2, 1, 5] }] },
        { name: 'after', x: ['M1', 'M2'], series: [{ name: 'Metric B', values: [40, 30] }, { name: 'Metric A', values: [4, 3] }] },
    ]);
    assert.deepEqual(result.data.x, ['M2', 'M1', 'M3']);
    assert.match(result.data.warnings.join(' '), /after.*M3/);
    assert.equal(result.data.skipped, 0);
});

test('paired comparisons reject ambiguous duplicate objects and condition counts rather than inventing a pair', () => {
    for (const matrix of [
        [['Model', 'A', 'B', 'Condition'], ['M1', 1, 2, 'before'], ['M1', 2, 3, 'before'], ['M1', 3, 4, 'after']],
        [['Model', 'A', 'B', 'Condition'], ['M1', 1, 2, 'before']],
        [['Model', 'A', 'B', 'Condition'], ['M1', 1, 2, 'before'], ['M1', 2, 3, 'after'], ['M1', 3, 4, 'third']],
    ]) {
        const { result } = resultFor(matrix, 'line', 'paired-correlation'); assert.equal(result.data, null); assert.match(result.error, /重复|两种/);
    }
});

test('generic heatmaps omit only bad cells, keeping valid neighbors, negative values and measured zero', () => {
    const data = dataFor([['Row', 'C1', 'C2'], ['R1', 0, null], ['R2', 'bad', -2], ['R3', 3, 5], ['R4', null, null]], 'heatmap', undefined, { x: 0, ys: [1, 2], errors: {} });
    assert.deepEqual(data.x, ['R1', 'R2', 'R3', 'R4']);
    assert.deepEqual(data.matrixCells, [[0, 0, 0], [1, 1, -2], [0, 2, 3], [1, 2, 5]]);
    assert.deepEqual(data.series, [{ name: 'C1', values: [] }, { name: 'C2', values: [] }]);
    assert.equal(data.skipped, 0); assert.equal(data.skippedCells, 4);
    assert.match(data.warnings.join(' '), /空白 3 个，非数值 1 个/);
});

test('density grids retain actual unequal numeric coordinates and leave holes without interpolation', () => {
    const data = dataFor([['Y', '10', '1', '4'], [2, 0, 2, null], [-3, 6, 1, 8]], 'heatmap', 'density-heatmap', { x: 0, ys: [1, 2, 3], errors: {} });
    assert.deepEqual(data.x, [2, -3]);
    assert.deepEqual(data.series.map(item => item.name), ['10', '1', '4']);
    assert.deepEqual(data.matrixCells, [[0, 0, 0], [1, 0, 2], [0, 1, 6], [1, 1, 1], [2, 1, 8]]);
    assert.equal(data.skippedCells, 1);
});

test('numeric density coordinates reject duplicate values even when their text spellings differ', () => {
    for (const matrix of [
        [['Y', '1', '1.0'], [0, 1, 2]],
        [['Y', '1', '4'], [0, 1, 2], ['0.0', 2, 3]],
        [['Y', 'left', '4'], [0, 1, 2]],
    ]) {
        const { result } = resultFor(matrix, 'heatmap', 'density-heatmap', { x: 0, ys: [1, 2], errors: {} });
        assert.equal(result.data, null); assert.match(result.error, /重复|数值坐标/);
    }
});

test('attention differences keep signed values while frequencies and supplied densities reject negatives', () => {
    const matrix = [['Y', '1', '4'], [0, -1, 0], [2, 3, 4]];
    assert.deepEqual(dataFor(matrix, 'heatmap', 'attention-heatmap').matrixCells, [[0, 0, -1], [1, 0, 0], [0, 1, 3], [1, 1, 4]]);
    for (const variant of ['frequency-heatmap', 'density-heatmap']) {
        const { result } = resultFor(matrix, 'heatmap', variant); assert.equal(result.data, null); assert.match(result.error, /负数/);
    }
});

test('group and metric bindings must refer to independent existing fields; numeric group codes are nominal labels', () => {
    const table = parseTemplateTable([['Group', 'X', 'Y'], [0, 1, 2], [1, 2, 3]]);
    assert.deepEqual(suggestDrawingMapping(table, 'scatter', 'embedding-scatter'), { x: 1, ys: [2], errors: {}, group: 0 });
    assert.deepEqual(buildDrawingData(table, { x: 1, ys: [2], errors: {}, group: 0 }, 'scatter', 'embedding-scatter').data.pointGroups.map(item => item.name), ['0', '1']);
    for (const mapping of [
        { x: 1, ys: [2], group: 2, errors: {} },
        { x: 1, ys: [2], group: 8, errors: {} },
        { x: 1, ys: [2, 2], group: 0, errors: {} },
        { x: 1, ys: [8], group: 0, errors: {} },
    ]) assert.equal(buildDrawingData(table, mapping, 'scatter', 'embedding-scatter').data, null);
    assert.equal(buildDrawingData(table, { x: 0, ys: [2], errors: {} }, 'box', 'grouped-box').data, null);
});

test('stacked compositions retain measured components without accumulating or sorting, and reject negative components', () => {
    const matrix = [['X', 'Part A', 'Part B'], [1, 2, 3], [3, 0, 4], [2, 5, 0]];
    const data = dataFor(matrix, 'line', 'stacked-area');
    assert.deepEqual(data.x, [1, 3, 2]);
    assert.deepEqual(data.series, [{ name: 'Part A', values: [2, 0, 5] }, { name: 'Part B', values: [3, 4, 0] }]);
    const negative = [['X', 'Part A', 'Part B'], [1, 2, -3], [2, 4, 0]];
    const { result } = resultFor(negative, 'line', 'stacked-area');
    assert.equal(result.data, null); assert.match(result.error, /负数/);
    assert.deepEqual(dataFor(negative, 'line').series[1].values, [-3, 0]);
});

test('filled distribution comparisons require two real curves and leave their original values unchanged', () => {
    const { result } = resultFor([['X', 'Only'], [0, 2], [1, 4]], 'line', 'filled-distribution');
    assert.equal(result.data, null); assert.match(result.error, /至少需要两列/);
    const data = dataFor([['X', 'A', 'B'], [0, 2, 1], [1, 4, 3]], 'line', 'filled-distribution');
    assert.deepEqual(data.series, [{ name: 'A', values: [2, 4] }, { name: 'B', values: [1, 3] }]);
});
