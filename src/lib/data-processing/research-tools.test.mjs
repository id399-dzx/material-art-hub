import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplateTable, buildTemplateData, suggestMapping } from './templates.ts';
import { profileTable, recommendCharts } from './profile.ts';
import { histogram, kernelDensity, sampleBox } from './distributions.ts';
import { exportDimensions, physicalSvg, pngWithDpi } from './publication.ts';

test('profiling retains numeric integer measurements, zero and original blank row semantics', () => {
    const table = parseTemplateTable([['group', 'measurement'], ['A', 0], ['A', 2], [null, null], ['B', null], ['B', 4]]), original = structuredClone(table);
    const p = profileTable(table, {}, 0);
    assert.equal(p.rows, 4); assert.equal(p.blankRows, 1);
    assert.equal(p.columns[1].kind, 'numeric'); assert.equal(p.columns[1].mean, 2);
    assert.equal(p.columns[1].sd, 2); assert.equal(p.columns[1].missing, 1);
    assert.deepEqual(p.groups.map(group => group.valid[1]), [2, 1]); assert.deepEqual(table, original);
});
test('manual field kinds preserve numeric IDs as text and report invalid numeric cells', () => {
    const table = parseTemplateTable([['ID', 'y'], [101, 3], [102, 'bad'], [103, 9]]);
    const p = profileTable(table, { 0: 'text', 1: 'numeric' });
    assert.equal(p.columns[0].kind, 'text'); assert.equal(p.columns[1].invalid, 1);
    assert.equal(p.columns[1].count, 2); assert.equal(p.columns[1].mean, 6);
    const allInvalid = profileTable(parseTemplateTable([['y'], ['bad'], ['invalid']]), {0: 'numeric'});
    assert.equal(allInvalid.columns[0].count, 0); assert.equal(allInvalid.columns[0].invalid, 2);
});
test('correlation excludes missing observations pairwise and never labels constants as strongly related', () => {
    const p = profileTable(parseTemplateTable([['x','y','constant','other'], [0,0,1,1],[1,2,1,null],[2,4,1,3],[null,6,1,4]]));
    assert.equal(p.correlations.find(pair => pair.a === 0 && pair.b === 1).n, 3);
    assert.equal(p.correlations.find(pair => pair.a === 0 && pair.b === 1).r, 1);
    assert.equal(p.correlations.find(pair => pair.b === 2).r, null);
    assert.equal(p.correlations.find(pair => pair.a === 0 && pair.b === 3).r, null);
});
test('date detection rejects invalid calendar dates rather than silently rolling over', () => {
    const valid = profileTable(parseTemplateTable([['date'], ['2026-02-28'], ['2026/03/01']]));
    assert.equal(valid.columns[0].kind, 'date');
    const invalid = profileTable(parseTemplateTable([['date'], ['2026-02-30']]), {0:'date'});
    assert.equal(invalid.columns[0].invalid, 1); assert.equal(invalid.columns[0].count, 0);
});
test('recommendations apply compatible raw-sample and frequency data without aggregating it', () => {
    const table = parseTemplateTable([['group','y'], ['A',1], ['A',2], ['B',3]]), p = profileTable(table, {}, 0);
    const recs = recommendCharts(p, 'compare', 0, 1);
    assert.deepEqual(recs.map(item=>item.id), ['box','violin']);
    for (const item of recs) { const result = buildTemplateData(table, item.mapping, item.id); assert.equal(result.error, null); assert.equal(result.data.samples.reduce((n,g)=>n+g.values.length,0),3); }
    const hist = recommendCharts(p, 'distribution', 0, 1)[0];
    assert.equal(buildTemplateData(table, hist.mapping, hist.id).data.samples[0].values.length, 3);
});
test('composition recommendation declines repeated categories and negative measurements', () => {
    assert.deepEqual(recommendCharts(profileTable(parseTemplateTable([['g','a','b'],['A',1,2],['A',3,4]])), 'composition', 0), []);
    assert.deepEqual(recommendCharts(profileTable(parseTemplateTable([['g','a','b'],['A',-1,2],['B',3,4]])), 'composition', 0), []);
});
test('distribution imports skip invalid samples and preserve zero, duplicates, and actual per-group n', () => {
    const table = parseTemplateTable([['g','v'], ['A',0], ['A',0], ['A','bad'], ['B',9]]), result=buildTemplateData(table,suggestMapping(table,'box'),'box');
    assert.equal(result.data.skipped,1); assert.deepEqual(result.data.samples,[{name:'A',values:[0,0]},{name:'B',values:[9]}]);
    assert.deepEqual(sampleBox([0,1,2,3,100]), [0,1,2,3,3]);
    assert.deepEqual(kernelDensity([1,2,3,4]), []); assert.deepEqual(kernelDensity([2,2,2,2,2]), []);
    assert.ok(kernelDensity([1,2,3,4,5]).every(p=>Number.isFinite(p.density)));
});
test('histogram assigns every observation exactly once including the upper endpoint and constants', () => {
    for (const values of [[0,0,1,2,3,3], [7,7,7], [-2,-1,0,1,2]]) {
        const bins=histogram(values); assert.equal(bins.reduce((n,b)=>n+b.count,0),values.length);
        assert.ok(bins.every(b=>b.hi>b.lo));
    }
});
test('fixed physical SVG export preserves viewport, requested mm and grayscale content structure', () => {
    const settings={widthMm:85,dpi:300,preset:'single',grayscale:false};
    const svg=physicalSvg('<svg xmlns="http://www.w3.org/2000/svg" width="680" height="420" viewBox="0 0 680 420"><text>A</text></svg>',680,420,settings);
    assert.match(svg,/width="85mm"/); assert.match(svg,/viewBox="0 0 680 420"/); assert.match(svg,/<text>A<\/text>/);
    assert.equal(exportDimensions(680,420,settings).widthPx,1004);
    assert.match(physicalSvg(svg,680,420,{...settings,grayscale:true}),/feColorMatrix/);
    assert.throws(()=>exportDimensions(680,420,{...settings,widthMm:NaN}));
});
test('PNG exports add one physical-resolution chunk with both axes and valid CRC', () => {
    const source=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKFEAAAAASUVORK5CYII=','base64');
    const bytes=pngWithDpi(source,600), again=pngWithDpi(bytes,300), occurrences=[];
    for(let offset=8;offset+12<=again.length;) { const view=new DataView(again.buffer,again.byteOffset+offset,4),length=view.getUint32(0),type=String.fromCharCode(...again.subarray(offset+4,offset+8)); if(type==='pHYs')occurrences.push(offset); offset+=length+12; }
    assert.equal(occurrences.length,1);const offset=occurrences[0]; assert.equal(new DataView(again.buffer).getUint32(offset+8),Math.round(300/.0254));assert.equal(again[offset+16],1);
    let crc=0xffffffff;for(const byte of again.subarray(offset+4,offset+17)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}assert.equal(new DataView(again.buffer).getUint32(offset+17),(crc^0xffffffff)>>>0);
});
