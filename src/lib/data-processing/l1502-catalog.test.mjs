import test from 'node:test';
import assert from 'node:assert/strict';
import { L1502_SPECS, L1502_TEMPLATES } from './l1502-catalog.ts';
import { createL1502Demo } from './l1502-demo.ts';
import { DRAWING_TEMPLATES, DRAWING_TYPES } from './drawing-catalog.ts';
import { CHART_TEMPLATES } from './templates.ts';
import { CONTENT_FIELDS } from '../admin/schema.ts';

const template = issue => L1502_TEMPLATES.find(item => item.l1502.issue === issue);
const column = (item, name) => {
    const index = item.demo[0].indexOf(name);
    assert.ok(index >= 0, `${item.id} requires ${name}`);
    return item.demo.slice(1).map(row => row[index]);
};

test('every L1502 issue from 1 through 139 is registered once with its original folder identity', () => {
    assert.equal(L1502_TEMPLATES.length, 139);
    assert.equal(new Set(L1502_TEMPLATES.map(item => item.id)).size, 139);
    assert.deepEqual(L1502_SPECS.map(spec => spec.issue), Array.from({ length: 139 }, (_, i) => i + 1));
    for (const item of L1502_TEMPLATES) {
        const issue = item.l1502.issue;
        assert.equal(item.id, `l1502-${String(issue).padStart(3, '0')}`);
        assert.equal(item.l1502.folder, `Matlab论文插图绘制模板第${issue}期-${item.name}`);
        assert.ok(DRAWING_TEMPLATES.includes(item));
        assert.ok(DRAWING_TYPES.includes(item.category));
        assert.ok(CHART_TEMPLATES.some(engine => engine.id === item.chartId));
        assert.ok(item.guide.includes(item.l1502.folder));
        assert.ok(item.guide.includes('独立生成的演示数据'));
        assert.ok(item.guide.includes('不是原文件的测量结果'));
        assert.equal(item.preview, `/drawing-previews/${item.id}.svg`);
        assert.ok(!/\.m(?:at)?\b|\.png\b|\/Users\//.test(item.guide));
    }
    assert.equal(template(31).name, '堆叠折线图');
    assert.equal(template(58).name, '伪彩图');
    assert.equal(template(117).name, '气泡云图');
    assert.equal(template(139).name, '罗盘图');
});

test('new drawing types and administrative choices use the same central list', () => {
    assert.equal(DRAWING_TYPES.length, 14);
    for (const category of ['极坐标图', '等高线与场图', '文本图', '多图布局']) {
        assert.ok(DRAWING_TYPES.includes(category));
        assert.ok(L1502_TEMPLATES.some(item => item.category === category));
    }
    assert.equal(CONTENT_FIELDS.templates.find(field => field.key === 'category').choices, DRAWING_TYPES);
});

test('similar titles retain their distinct numerical and layout structures', () => {
    assert.deepEqual([3, 4, 5].map(i => template(i).l1502.dualMode), ['line', 'bar', 'mixed']);
    assert.deepEqual([2, 6].map(i => template(i).l1502.kind), ['bar', 'stacked-bar']);
    assert.equal(template(10).l1502.overlaid, true);
    assert.equal(template(10).l1502.stacked, undefined);
    assert.deepEqual(template(10).demo[0], ['X', 'SeriesA', 'SeriesB']);
    assert.equal(template(18).l1502.kind, 'bubble-matrix');
    assert.equal(template(49).l1502.kind, 'scatter-matrix');
    assert.equal(template(24).l1502.grouped, true);
    assert.equal(template(24).l1502.stacked, true);
    assert.equal(template(31).l1502.kind, 'multi-panel');
    assert.deepEqual([97, 98, 100].map(i => template(i).l1502.panelLayout), ['grid', 'bottom-span', 'compact']);
    assert.deepEqual(template(97).l1502.panelCharts, ['error-bar', 'line', 'pie', 'stacked-bar']);
    assert.deepEqual(template(98).l1502.panelCharts, ['error-bar', 'line', 'area']);
    assert.deepEqual(template(100).l1502.panelCharts, ['error-bar', 'line', 'stacked-bar', 'pie']);
    for (const issue of [97, 98, 100]) for (const series of ['SeriesA', 'SeriesB', 'SeriesC', 'SeriesD']) {
        column(template(issue), series);
        assert.ok(column(template(issue), `${series}_error`).every(error => error >= 0));
    }
    assert.equal(template(53).l1502.filled, false);
    assert.equal(template(56).l1502.filled, true);
    assert.equal(template(57).l1502.lighting, true);
    assert.equal(template(54).l1502.curtain, true);
    assert.equal(template(55).l1502.withContours, true);
    assert.equal(template(67).l1502.kind, 'tri-mesh');
    assert.equal(template(68).l1502.kind, 'tri-surface');
    assert.equal(template(106).l1502.stacked, true);
    assert.equal(template(114).l1502.kind, 'stem');
    assert.equal(template(114).l1502.annotation, 'shape');
    assert.equal(template(134).l1502.implicit, true);
    assert.equal(template(135).l1502.kind, 'implicit-surface');
    assert.equal(template(117).l1502.kind, 'bubble-cloud');
    assert.equal(template(120).l1502.grouped, true);
});

test('all examples are deterministic, rectangular tables of finite values', () => {
    for (const item of L1502_TEMPLATES) {
        assert.deepEqual(createL1502Demo(item.l1502), item.demo, item.id);
        const [header, ...rows] = item.demo;
        assert.ok(header.length && rows.length, item.id);
        assert.equal(new Set(header).size, header.length, item.id);
        for (const row of rows) {
            assert.equal(row.length, header.length, item.id);
            for (const value of row) assert.ok(typeof value === 'string' || typeof value === 'number' && Number.isFinite(value), item.id);
        }
    }
});

test('uncertainty examples bind actual input bounds and nonnegative error columns', () => {
    for (const issue of [29, 86, 94]) {
        const item = template(issue);
        for (const name of item.demo[0].filter(name => name.endsWith('_lower'))) {
            const series = name.slice(0, -6), low = column(item, name), values = column(item, series), high = column(item, `${series}_upper`);
            assert.ok(values.every((value, i) => low[i] <= value && value <= high[i]), item.id);
        }
        assert.ok(!/95\s*%/.test(item.guide), item.id);
    }
    for (const issue of [28, 29, 69, 70, 106]) {
        const item = template(issue), errors = item.demo[0].filter(name => name.endsWith('_error'));
        assert.ok(errors.length, item.id);
        for (const name of errors) assert.ok(column(item, name).every(value => value >= 0), item.id);
    }
    for (const issue of [104, 105]) {
        assert.ok(template(issue).guide.includes('1.57×IQR/√n'));
        assert.equal(template(issue).l1502.notched, true);
    }
});

test('distribution, matrix, bubbles and variable widths use their own data roles', () => {
    for (const issue of [34, 35, 96, 102, 104, 105]) {
        const item = template(issue);
        assert.deepEqual(item.demo[0], ['Category', 'Value', 'Group']);
        const groups = new Set(item.demo.slice(1).map(row => `${row[0]}/${row[2]}`));
        assert.equal(groups.size, item.l1502.grouped ? 6 : 3);
        for (const group of groups) assert.equal(item.demo.slice(1).filter(row => `${row[0]}/${row[2]}` === group).length, 12);
    }
    for (const issue of [18, 42, 127]) {
        const item = template(issue);
        assert.deepEqual(item.demo[0], ['X', 'Y', 'Size', 'Color']);
        assert.equal(new Set(item.demo.slice(1).map(row => `${row[0]}/${row[1]}`)).size, item.demo.length - 1);
        assert.ok(column(item, 'Size').every(value => value > 0));
        assert.equal(new Set(column(item, 'X')).size * new Set(column(item, 'Y')).size, item.demo.length - 1);
    }
    assert.deepEqual(template(91).demo[0], ['Start', 'Value', 'Size']);
    assert.ok(column(template(91), 'Size').every(value => value > 0));
    assert.ok(new Set(column(template(91), 'Size')).size > 1);
    assert.deepEqual(template(117).demo[0], ['Word', 'Size', 'Color', 'Group']);
    assert.equal(new Set(column(template(117), 'Group')).size, 1);
    assert.equal(new Set(column(template(120), 'Group')).size, 3);
    for (const issue of [124, 125, 126]) for (const role of ['X', 'Y', 'Z', 'Size']) column(template(issue), role);
    assert.deepEqual(template(47).demo[0], ['Word', 'Weight']);
    assert.deepEqual(template(90).demo[0], ['Source', 'Target', 'Weight']);
    for (const issue of [88, 89]) assert.ok(column(template(issue), 'Weight').every(value => value === 1));
    assert.ok(new Set(column(template(90), 'Weight')).size > 1);
});

test('regular field examples have complete coordinate grids and implicit 3D has a scalar field', () => {
    for (const issue of [32, 33, 53, 54, 55, 56, 57, 60, 65, 73, 79, 129, 130, 131, 132, 134]) {
        const item = template(issue);
        assert.deepEqual(item.demo[0], ['X', 'Y', 'Z']);
        const xs = new Set(column(item, 'X')), ys = new Set(column(item, 'Y'));
        assert.equal(xs.size * ys.size, item.demo.length - 1, item.id);
        assert.equal(new Set(item.demo.slice(1).map(row => `${row[0]},${row[1]}`)).size, item.demo.length - 1);
    }
    const sphere = template(135);
    assert.deepEqual(sphere.demo[0], ['X', 'Y', 'Z', 'Color']);
    assert.equal(sphere.demo.length - 1, 1331);
    assert.equal(new Set(column(sphere, 'X')).size, 11);
    assert.equal(new Set(column(sphere, 'Y')).size, 11);
    assert.equal(new Set(column(sphere, 'Z')).size, 11);
    assert.ok(column(sphere, 'Color').some(value => value < 0));
    assert.ok(column(sphere, 'Color').some(value => value > 0));
    for (const [x, y, z, f] of sphere.demo.slice(1)) assert.ok(Math.abs(f - (x * x + y * y + z * z - 1)) < 0.00001);
    for (const issue of [82, 83, 85, 87, 139]) {
        const item = template(issue), u = column(item, 'U'), v = column(item, 'V'), c = column(item, 'Color');
        const w = item.demo[0].includes('W') ? column(item, 'W') : Array(u.length).fill(0);
        assert.ok(c.every((value, i) => Math.abs(value - Math.hypot(u[i], v[i], w[i])) < 0.00002));
    }
});
