import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProcessingSnapshot } from './processing-composition-snapshot.ts';

function fixture() {
    return { kind: 'processing', version: 1, state: {
        fileName: 'CV.csv', fileName2: 'control.csv',
        fileChunks1: [{ id: 'main', name: 'CV.csv', x: [0, 1, 0], y: [0, 2, -1] }],
        fileChunks2: [{ id: 'control', name: 'control.csv', x: [0, 1], y: [0, 1] }],
        dataType: 'CV', dataOrientation: 'two-rows', fontFamily: 'Arial', lineWidth: 2,
        titleSize: 16, labelSize: 14, chartWidth: 600, chartHeight: 400, lineColor: '#000000', lineColor2: '#d45522',
        seriesName: 'Main', seriesName2: 'Control', legendPosition: 'top-right',
        xAxisName: 'Potential (V)', yAxisName: 'Current (mA)', xMin: '', xMax: '', xInterval: '', yMin: '', yMax: '', yInterval: '', xOnZero: false,
        showInset: true, useMainDataForInset: false, insetTotalX: [0, 1], insetTotalY: [0, 0.2],
        insetXMin: '', insetXMax: '', insetYMin: '', insetYMax: '', insetLeft: '60%', insetTop: '15%', insetWidth: '35%', insetHeight: '35%',
        insetFontSize: '10', showInsetAxisName: false, insetXAxisName: 'X', insetYAxisName: 'Y', insetXSplit: '', insetYSplit: '',
    }, zoom: [{ start: 10, end: 90 }, { startValue: -1, endValue: 2 }], legendSelection: { Main: true, Control: false } };
}

test('restoring a curve keeps cyclic point order, zeros, control data, inset and current visibility', () => {
    const source = fixture(), restored = validateProcessingSnapshot(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(restored, source);
    restored.state.fileChunks1[0].x[0] = 99;
    assert.equal(source.state.fileChunks1[0].x[0], 0);
});
test('broken X/Y pairs and nonfinite source values cannot replace a working editor', () => {
    const source = fixture(); source.state.fileChunks1[0].y.pop();
    assert.throws(() => validateProcessingSnapshot(source), /编辑记录不完整/);
    const bad = fixture(); bad.state.insetTotalX[0] = Infinity;
    assert.throws(() => validateProcessingSnapshot(bad), /编辑记录不完整/);
});
test('unsupported versions, invalid canvas dimensions and malformed interaction state are rejected', () => {
    for (const mutate of [s => { s.version = 2; }, s => { s.state.chartWidth = 0; }, s => { s.legendSelection.Control = 'false'; }, s => { s.zoom[0].start = '20'; }, s => { s.state.xMin = 'not-a-number'; }, s => { s.state.xInterval = '0'; }, s => { s.state.insetWidth = '-10%'; }, s => { s.state.insetFontSize = 'NaN'; }, s => { s.zoom[0].start = -1; }]) {
        const source = fixture(); mutate(source);
        assert.throws(() => validateProcessingSnapshot(source));
    }
});
