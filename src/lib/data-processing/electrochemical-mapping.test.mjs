import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplateTable, buildTemplateData } from './templates.ts';
import { suggestElectrochemicalMapping } from './electrochemical-mapping.ts';
import { ELECTROCHEMICAL_TEMPLATES } from './electrochemical-templates.ts';

test('instrument export indices and frequencies are excluded when named electrochemical fields are present', () => {
    const eis = parseTemplateTable([['Point', 'freq/Hz', 'Re(Z)/Ohm', 'Im(Z)/Ohm'], [1, 1000, 10, -4], [2, 100, 20, 3]]);
    assert.deepEqual(suggestElectrochemicalMapping(eis, { kind: 'nyquist' }), { x: 2, ys: [3], errors: {} });
    const cv = parseTemplateTable([['Index', 'time/s', 'Ewe/V', '<I>/mA'], [1, 0, 0.2, -1], [2, 1, 0.1, 2]]);
    assert.deepEqual(suggestElectrochemicalMapping(cv, { kind: 'cv' }), { x: 2, ys: [3], errors: {} });
});

test('cycle and Bode left/right bindings follow quantity names regardless of instrument column order', () => {
    const cycle = parseTemplateTable([['CE (%)', 'Cycle', 'Capacity (mAh/g)'], [99, 1, 120], [98, 2, 115]]);
    assert.deepEqual(suggestElectrochemicalMapping(cycle, { kind: 'cycle' }), { x: 1, ys: [2, 0], errors: {} });
    const bode = parseTemplateTable([['Index', 'Phase(Z)/deg', '|Z|/Ohm', 'freq/Hz'], [1, -30, 100, 10], [2, -45, 20, 100]]);
    assert.deepEqual(suggestElectrochemicalMapping(bode, { kind: 'bode' }), { x: 3, ys: [2, 1], errors: {} });
});

test('cycle data without efficiency remains a single capacity curve and ignores unrelated numeric columns', () => {
    const table = parseTemplateTable([['Cycle', 'Time (s)', 'Capacity (mAh/g)'], [1, 100, 120], [2, 200, 115]]);
    const mapping = suggestElectrochemicalMapping(table, { kind: 'cycle' });
    assert.deepEqual(mapping.ys, [2]);
    const result = buildTemplateData(table, mapping, 'line');
    assert.equal(result.error, null);
    assert.deepEqual(result.data.series[0].values, [120, 115]);
});

test('sample and scan-rate column names retain every demonstration series, including both CV branches', () => {
    for (const preset of ELECTROCHEMICAL_TEMPLATES) {
        const table = parseTemplateTable(preset.demo);
        const mapping = suggestElectrochemicalMapping(table, preset.electrochemical);
        const result = buildTemplateData(table, mapping, preset.chartId);
        assert.equal(result.error, null, preset.id);
        assert.equal(result.data.series.length, table.columns.length - 1, preset.id);
        assert.equal(result.data.x.length, table.rows.length, preset.id);
    }
});
