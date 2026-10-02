import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ELECTROCHEMICAL_TEMPLATES } from './electrochemical-templates.ts';
import { buildTemplateData, parseTemplateTable, suggestMapping } from './templates.ts';

function demonstration(id) {
    const preset = ELECTROCHEMICAL_TEMPLATES.find(item => item.id === id);
    assert.ok(preset, id);
    const table = parseTemplateTable(preset.demo);
    const result = buildTemplateData(table, suggestMapping(table, preset.chartId), preset.chartId);
    assert.equal(result.error, null, id);
    assert.ok(result.data, id);
    return { preset, data: result.data };
}

test('all eight electrochemical workflows have complete, directly bindable demonstration data', () => {
    assert.equal(new Set(ELECTROCHEMICAL_TEMPLATES.map(item => item.electrochemical.kind)).size, 8);
    for (const preset of ELECTROCHEMICAL_TEMPLATES) {
        const { data } = demonstration(preset.id);
        assert.equal(data.skipped, 0, preset.id);
        assert.equal(data.x.length, preset.demo.length - 1, preset.id);
        assert.ok(data.series.length > 0, preset.id);
        assert.match(preset.guide, /不代表真实实验/);
    }
});

test('CV reversal and GCD voltage step survive the same table binding used for uploaded data', () => {
    const cv = demonstration('electrochem-cv').data;
    assert.deepEqual(cv.x, ELECTROCHEMICAL_TEMPLATES.find(item => item.id === 'electrochem-cv').demo.slice(1).map(row => row[0]));
    assert.ok(cv.x.some((value, i) => i > 0 && value < cv.x[i - 1]));
    assert.ok(new Set(cv.x).size < cv.x.length, 'both scanning directions must be retained');
    assert.ok(cv.series.every(series => series.values.some(value => value < 0) && series.values.some(value => value > 0)));
    const gcd = demonstration('electrochem-gcd').data;
    const step = gcd.x.indexOf(101);
    assert.equal(gcd.x[step - 1], 100);
    assert.equal(gcd.series[0].values[step - 1], 1.08);
    assert.equal(gcd.series[0].values[step], 0.99);
});

test('Bode data keeps signed phase on its second axis and uses positive raw inputs for logarithmic axes', () => {
    const { preset, data } = demonstration('electrochem-bode');
    assert.equal(preset.electrochemical.xLog, true);
    assert.equal(preset.electrochemical.yLog, true);
    assert.equal(data.series.length, 2);
    assert.ok(data.x.every(value => typeof value === 'number' && value > 0));
    assert.ok(data.series[0].values.every(value => value > 0));
    assert.deepEqual(data.series[1].values, preset.demo.slice(1).map(row => row[2]));
    assert.ok(data.series[1].values.some(value => value < 0));
});
