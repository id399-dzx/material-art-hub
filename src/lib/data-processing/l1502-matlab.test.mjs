import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { L1502_SPECS } from './l1502-catalog.ts';
import { l1502MatlabMetadataPath, readL1502MatlabManifest } from './l1502-matlab.ts';

const publicRoot = new URL('../../../public/', import.meta.url);
const manifest = async issue => readL1502MatlabManifest(JSON.parse(await readFile(new URL(l1502MatlabMetadataPath(issue).slice(1), publicRoot), 'utf8')), issue);

test('every catalog issue has the correct original folder and all 143 nonempty UTF-8 MATLAB scripts', async () => {
    let count = 0;
    const multiples = [];
    for (const spec of L1502_SPECS) {
        const entry = await manifest(spec.issue);
        assert.equal(entry.folder, spec.folder);
        if (entry.scripts.length > 1) multiples.push(spec.issue);
        for (const script of entry.scripts) {
            const bytes = await readFile(new URL(script.path.slice(1), publicRoot));
            const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            assert.equal(bytes.byteLength, script.bytes);
            assert.equal(createHash('sha256').update(bytes).digest('hex'), script.sha256);
            assert.equal(source.split(/\r?\n/).filter((line, index, array) => index < array.length - 1 || line !== '').length, script.lines);
            assert.ok(source.trim());
            assert.ok(!source.includes('\uFFFD'));
            count++;
        }
        const contents = await readdir(fileURLToPath(new URL(`l1502-matlab/${String(spec.issue).padStart(3, '0')}/`, publicRoot)));
        assert.deepEqual(contents.sort(), ['metadata.json', ...entry.scripts.map(script => script.name)].sort());
    }
    assert.equal(count, 143);
    assert.deepEqual(multiples, [49, 76, 85, 87]);
});

test('the two arrow examples default to their plotting scripts and retain separate attributed helpers', async () => {
    for (const [issue, first] of [[85, 'QuiverwithColormapPlot.m'], [87, 'Quiver3Plot.m']]) {
        const entry = await manifest(issue);
        assert.equal(entry.scripts[0].name, first);
        assert.equal(entry.scripts[0].role, 'plot');
        assert.equal(entry.scripts[1].name, 'ColortheArrow.m');
        assert.equal(entry.scripts[1].role, 'helper');
        const helper = await readFile(new URL(entry.scripts[1].path.slice(1), publicRoot), 'utf8');
        assert.match(helper, /author Suever/);
        assert.match(helper, /function\b/);
    }
    assert.deepEqual((await manifest(49)).scripts.map(script => script.name), ['PlotMatrixChart1.m', 'PlotMatrixChart2.m']);
    assert.deepEqual((await manifest(76)).scripts.map(script => script.name), ['SemilogxPlot.m', 'SemilogyPlot.m']);
});

test('specific unloaded data and unavailable coloring functions are documented without publishing measurement files', async () => {
    assert.deepEqual((await manifest(16)).scripts[0].dataFiles, ['Vaihingen_Strip_05_part.txt']);
    assert.deepEqual((await manifest(16)).scripts[0].externalFunctions, ['addcolorplus']);
    assert.deepEqual((await manifest(31)).scripts[0].dataFiles, ['patients.xls']);
    assert.deepEqual((await manifest(51)).scripts[0].dataFiles, ['BicycleCounts.csv']);
    assert.deepEqual((await manifest(85)).scripts[0].dataFiles, ['data.mat']);
    assert.deepEqual((await manifest(85)).scripts[0].externalFunctions, ['TheColor']);
    assert.deepEqual((await manifest(4)).scripts[0].externalFunctions, ['addcolor']);
});

test('source metadata rejects wrong-issue references, external paths and missing scripts', async () => {
    const valid = await manifest(85);
    assert.throws(() => l1502MatlabMetadataPath(0));
    assert.throws(() => l1502MatlabMetadataPath(140));
    assert.throws(() => readL1502MatlabManifest(valid, 87));
    assert.throws(() => readL1502MatlabManifest({ ...valid, scripts: [] }, 85));
    for (const path of ['/l1502-matlab/087/QuiverwithColormapPlot.m', 'https://example.com/source.m', '/l1502-matlab/085/../source.m']) {
        assert.throws(() => readL1502MatlabManifest({ ...valid, scripts: [{ ...valid.scripts[0], path }] }, 85));
    }
});
