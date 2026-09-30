import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseXYMatrix } from './parse.ts';

test('short two-column CSV with a header keeps each row paired', () => {
    const result = parseXYMatrix([
        ['Capacity', 'Voltage'],
        ['0', '1.0'],
        ['1', '1.2'],
        ['2', '1.4'],
    ]);

    assert.equal(result.orientation, 'row-pairs');
    assert.deepEqual(result.x, [0, 1, 2]);
    assert.deepEqual(result.y, [1, 1.2, 1.4]);
    assert.equal(result.skippedCount, 1);
});

test('missing Y in a long table drops the whole pair without shifting points', () => {
    const result = parseXYMatrix([
        ['x', 'y'],
        [0, 10],
        [1, undefined],
        [2, 12],
        [3, 'invalid'],
        [4, 14],
    ]);

    assert.equal(result.orientation, 'row-pairs');
    assert.deepEqual(result.x, [0, 2, 4]);
    assert.deepEqual(result.y, [10, 12, 14]);
    assert.equal(result.skippedCount, 3);
    assert.match(result.warnings.join(' '), /第 3 行/);
});

test('two wide rows are parsed column by column, including a header column', () => {
    const result = parseXYMatrix([
        ['X', 0, 1, 2],
        ['Y', 3, 4, 5],
    ]);

    assert.equal(result.orientation, 'two-rows');
    assert.deepEqual(result.x, [0, 1, 2]);
    assert.deepEqual(result.y, [3, 4, 5]);
    assert.equal(result.skippedCount, 1);
});

test('ambiguous 2-by-2 input defaults to row pairs and permits an explicit choice', () => {
    const rows = [[0, 10], [1, 11]];
    const automatic = parseXYMatrix(rows);
    const horizontal = parseXYMatrix(rows, 'two-rows');

    assert.equal(automatic.orientation, 'row-pairs');
    assert.match(automatic.warnings.join(' '), /方向无法自动确认/);
    assert.deepEqual(horizontal.x, [0, 10]);
    assert.deepEqual(horizontal.y, [1, 11]);
});
