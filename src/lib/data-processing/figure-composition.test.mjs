import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as echarts from 'echarts';
import { DOMParser } from '@xmldom/xmldom';
import { addAssetToComposition, arrangeComposition, compositionIssues, createComposition, getPanelImageRect, panelLabel, prepareChartSvg, removePanel, renderCompositionSvg, sanitizeFigureSvg, validateBitmapDataUrl, validateComposition } from './figure-composition.ts';
import { openCompositionFile } from './figure-composition-browser.ts';

const rawSvg = (width = 600, height = 400) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="10 20 ${width} ${height}"><defs><clipPath id="clip"><rect x="10" y="20" width="${width}" height="${height}"/></clipPath><linearGradient id="grad"><stop offset="0" stop-color="#a4b"/><stop offset="1" stop-color="#cef"/></linearGradient></defs><g clip-path="url(#clip)"><path id="stroke" d="M10 20L200 200" fill="none" stroke="url(#grad)"/><text x="30" y="50" style="font-size:16px;font-family:Arial;fill:#000">Data &amp; text</text></g></svg>`;
const asset = (id = 'one', width = 600, height = 400) => ({ id, name: `Figure ${id}`, kind: 'template', width, height, svg: rawSvg(width, height), editSnapshot: { source: 'x,y\n1,2', mapping: { x: 0, y: [1] }, width } });
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

test('all layouts preserve image ratios, reserve labels/captions, and contain the full panels', () => {
    let initial = createComposition();
    for (let i = 0; i < 7; i++) initial = addAssetToComposition(initial, { ...asset(`a-${i}`, i % 2 ? 300 : 1000, i % 2 ? 900 : 300), caption: i % 3 ? '' : '图注应在图下方完整显示，并为图片保留空间。' });
    for (const layout of ['grid', 'row', 'column', 'hero-top', 'hero-left']) {
        const doc = arrangeComposition({ ...initial, layout });
        for (const panel of doc.panels) {
            const source = doc.assets.find(item => item.id === panel.assetId), rect = getPanelImageRect(doc, panel);
            assert.ok(panel.x >= doc.margin - .01 && panel.y >= doc.margin - .01);
            assert.ok(panel.x + panel.width <= doc.width - doc.margin + .01);
            assert.ok(panel.y + panel.height <= doc.height - doc.margin + .01);
            assert.ok(rect.y >= panel.y + doc.labelSize * 1.45 - .01);
            assert.ok(rect.y + rect.height <= panel.y + panel.height + .01);
            assert.ok(Math.abs(rect.width / rect.height - source.width / source.height) < .000001);
        }
        assert.ok(!compositionIssues(doc, 180, 300).some(issue => /重叠|超出/.test(issue.message)));
    }
});

test('updating the same source preserves manual placement, panel dimensions, and edited caption', () => {
    const added = addAssetToComposition(createComposition(), asset());
    added.panels[0] = { ...added.panels[0], x: 110, y: 85, width: 480, height: 410, caption: '用户图注' };
    const updated = addAssetToComposition(added, { ...asset(), name: 'New source', editSnapshot: { source: '3,4' } });
    assert.deepEqual(updated.panels, added.panels);
    assert.equal(updated.assets.length, 1);
    assert.deepEqual(updated.assets[0].editSnapshot, { source: '3,4' });
});

test('removing a panel retains its source and adding it back creates a new panel', () => {
    const added = addAssetToComposition(createComposition(), asset()), removed = removePanel(added, added.panels[0].id);
    assert.equal(removed.assets.length, 1); assert.equal(removed.panels.length, 0);
    const restored = addAssetToComposition(removed, removed.assets[0]);
    assert.equal(restored.assets.length, 1); assert.equal(restored.panels.length, 1);
    assert.notEqual(restored.panels[0].id, added.panels[0].id);
});

test('source viewBox offsets and vector clip/gradient references survive composition without ID collisions', () => {
    const doc = addAssetToComposition(addAssetToComposition(createComposition(), asset('one')), asset('two'));
    const output = renderCompositionSvg(doc), parsed = new DOMParser().parseFromString(output, 'image/svg+xml');
    assert.equal(parsed.getElementsByTagName('image').length, 0);
    assert.equal(parsed.getElementsByTagName('path').length, 2);
    const ids = [...parsed.getElementsByTagName('*')].map(node => node.getAttribute('id')).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
    assert.match(output, /url\(#panel-0-clip\)/); assert.match(output, /url\(#panel-1-grad\)/);
    const nested = [...parsed.getElementsByTagName('svg')].slice(1);
    assert.equal(nested.length, 2); nested.forEach(node => assert.equal(node.getAttribute('viewBox'), '10 20 600 400'));
    assert.match(output, /Data &amp; text/);
});

test('SVG source dimensions may come from physical size or offset viewBox', () => {
    const offset = sanitizeFigureSvg(rawSvg()); assert.equal(offset.width, 600); assert.equal(offset.height, 400);
    const physical = sanitizeFigureSvg('<svg xmlns="http://www.w3.org/2000/svg" width="25.4mm" height="1in"><rect width="96" height="96"/></svg>');
    assert.equal(physical.width, 96); assert.equal(physical.height, 96); assert.match(physical.svg, /viewBox="0 0 96 96"/);
    assert.throws(() => sanitizeFigureSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 20"/>'), /尺寸/);
    const qualified = sanitizeFigureSvg('<s:svg xmlns:s="http://www.w3.org/2000/svg" viewBox="5 10 200 100"><s:path d="M5 10L30 40"/></s:svg>');
    const reparsed = new DOMParser({ onError: () => { throw new Error('invalid namespace'); } }).parseFromString(qualified.svg, 'image/svg+xml');
    assert.equal(reparsed.documentElement.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(reparsed.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'path').length, 1);
});

test('SVG rejects active content, disguised external URLs, invalid references, and unsupported CSS', () => {
    const wrapper = child => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${child}</svg>`;
    for (const content of ['<script>alert(1)</script>', '<foreignObject><div/></foreignObject>', '<rect onload="run()"/>', '<image href="https://example.com/p.png"/>', '<image href="&#106;avascript:alert(1)"/>', '<path fill="url(https://example.com/p.svg#paint)"/>', '<style>.x:hover{fill:red}</style>', '<style>@import url(https://example.com/styles.css);</style>', '<style>.x{fill:url(https://example.com/paint)}</style><path class="x"/>', '<path style="fill:url(https://example.com/paint)"/>', '<use href="#missing"/>', '<g id="duplicate"/><g id="duplicate"/>', '<use id="a" href="#b"/><use id="b" href="#a"/>', '<g id="loop"><use href="#loop"/></g>']) assert.throws(() => sanitizeFigureSvg(wrapper(content)), Error, content);
    assert.throws(() => sanitizeFigureSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + wrapper('<text>&x;</text>')), /声明/);
    const embedded = sanitizeFigureSvg(wrapper(`<image href="${tinyPng}" width="100" height="100"/>`)); assert.match(embedded.svg, /data:image\/png;base64/);
});

test('actual ECharts line and pattern charts keep final paths, text, pattern and clip after dropping interaction CSS', () => {
    const options = [
        { xAxis: { type: 'category', data: ['a', 'b', 'c'] }, yAxis: {}, series: [{ type: 'line', data: [1, 3, 2] }] },
        { xAxis: { type: 'category', data: ['a', 'b'] }, yAxis: {}, series: [{ type: 'bar', data: [2, 4], itemStyle: { decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: .5 } } }] },
    ];
    for (const option of options) {
        const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 680, height: 420 });
        try {
            chart.setOption(option); const raw = chart.renderToSVGString(), clean = prepareChartSvg(raw);
            const a = new DOMParser().parseFromString(raw, 'image/svg+xml'), b = new DOMParser().parseFromString(clean, 'image/svg+xml');
            assert.equal(a.getElementsByTagName('path').length, b.getElementsByTagName('path').length);
            assert.equal(a.getElementsByTagName('text').length, b.getElementsByTagName('text').length);
            assert.equal(a.getElementsByTagName('clipPath').length, b.getElementsByTagName('clipPath').length);
            assert.equal(a.getElementsByTagName('pattern').length, b.getElementsByTagName('pattern').length);
            assert.equal(b.getElementsByTagName('style').length, 0);
            assert.deepEqual([...a.getElementsByTagName('path')].map(node => node.getAttribute('d')), [...b.getElementsByTagName('path')].map(node => node.getAttribute('d')));
            assert.equal(sanitizeFigureSvg(clean, 'composed').width, 680);
        } finally { chart.dispose(); }
    }
    assert.throws(() => prepareChartSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><style>.zr0-cls-0{fill:red}</style></svg>'), /静态外观/);
});

test('project round trip preserves original data, captions, sources, and export settings', async () => {
    const doc = addAssetToComposition(createComposition(), { ...asset(), attribution: '原图来源', demo: true });
    doc.panels[0].caption = '自定义图注'; doc.exportSettings = { widthMm: 125, dpi: 600, grayscale: true, preset: 'custom' };
    const file = new File([JSON.stringify(doc)], 'figure.figure.json', { type: 'application/json' }), reopened = await openCompositionFile(file);
    assert.deepEqual(reopened.assets[0].editSnapshot, doc.assets[0].editSnapshot);
    assert.equal(reopened.panels[0].caption, '自定义图注'); assert.equal(reopened.assets[0].attribution, '原图来源'); assert.equal(reopened.assets[0].demo, true);
    assert.deepEqual(reopened.exportSettings, doc.exportSettings);
    assert.equal(renderCompositionSvg(reopened), renderCompositionSvg(doc));
});

test('project loading rejects corrupt JSON, unsafe snapshots, duplicate assets, dangling panels, and invalid geometry', async () => {
    const doc = addAssetToComposition(createComposition(), asset());
    assert.throws(() => validateComposition({ ...doc, version: 2 }), /版本/);
    assert.throws(() => validateComposition({ ...doc, width: Infinity }), /宽度/);
    assert.throws(() => validateComposition({ ...doc, assets: [doc.assets[0], doc.assets[0]] }), /重复/);
    assert.throws(() => validateComposition({ ...doc, panels: [{ ...doc.panels[0], assetId: 'missing' }] }), /不存在/);
    assert.throws(() => validateComposition({ ...doc, assets: [{ ...doc.assets[0], editSnapshot: JSON.parse('{"__proto__":{"x":1}}') }] }), /不支持/);
    await assert.rejects(openCompositionFile(new File(['{broken'], 'bad.json')), /无法读取/);
});

test('valid bitmap sources remain self-contained; mismatched signatures and external sources are rejected', () => {
    assert.equal(validateBitmapDataUrl(tinyPng), tinyPng);
    assert.throws(() => validateBitmapDataUrl(tinyPng.replace('image/png', 'image/jpeg')), /不一致/);
    assert.throws(() => validateBitmapDataUrl('https://example.com/image.png'), /自包含/);
    assert.throws(() => validateBitmapDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), /自包含/);
    const doc = addAssetToComposition(createComposition(), { id: 'photo', name: 'photo', kind: 'upload', width: 400, height: 400, dataUrl: tinyPng });
    assert.match(renderCompositionSvg(doc), /<image.*data:image\/png;base64/);
});

test('diagnostics detect effective bitmap resolution, overlap, off-canvas placement, demonstration data, and invalid DPI', () => {
    let doc = addAssetToComposition(createComposition(), { id: 'photo', name: 'photo', kind: 'upload', width: 200, height: 200, dataUrl: tinyPng, demo: true });
    doc = addAssetToComposition(doc, asset()); doc.panels[1] = { ...doc.panels[1], x: doc.panels[0].x, y: doc.panels[0].y }; doc.panels[0] = { ...doc.panels[0], x: -100 };
    const messages = compositionIssues(doc, 180, 300).map(issue => issue.message).join(' ');
    assert.match(messages, /不足 300 DPI/); assert.match(messages, /重叠/); assert.match(messages, /超出/); assert.match(messages, /示例数据/);
    assert.throws(() => compositionIssues(doc, 180, 72), /分辨率/);
    assert.throws(() => compositionIssues(doc, 0, 300), /导出宽度/);
});

test('alphabetic panel labels continue after z and excessive grid spacing gives a clear error', () => {
    assert.equal(panelLabel(25, 'a'), 'z'); assert.equal(panelLabel(26, '(a)'), '(aa)'); assert.equal(panelLabel(27, 'A'), 'AB'); assert.equal(panelLabel(0, 'none'), '');
    const doc = addAssetToComposition(addAssetToComposition(createComposition(), asset('a')), asset('b'));
    assert.throws(() => arrangeComposition({ ...doc, width: 300, margin: 100, gap: 200 }), /间距/);
});

test('explicit canvas height is preserved, panels fit, and undersized layouts fail without losing the draft', () => {
    let doc = createComposition();
    for (let i = 0; i < 4; i++) doc = addAssetToComposition(doc, asset(`height-${i}`));
    const resized = arrangeComposition({ ...doc, height: 600 }, { preserveHeight: true });
    assert.equal(resized.height, 600);
    assert.ok(resized.panels.every(panel => panel.y + panel.height <= resized.height - resized.margin + .01));
    assert.throws(() => arrangeComposition({ ...doc, height: 120 }, { preserveHeight: true }), /画布高度不足/);
    assert.equal(doc.assets.length, 4);
    assert.equal(arrangeComposition({ ...createComposition(), height: 900 }).height, 900);
    const fixed = { ...resized, heightMode: 'fixed' };
    const added = addAssetToComposition(fixed, asset('extra'));
    assert.equal(added.height, 600); assert.equal(removePanel(added, added.panels[0].id).height, 600);
    assert.equal(validateComposition(added).heightMode, 'fixed');
});

test('invalid sources fail when added, while rendering skips large raw edit data', () => {
    assert.throws(() => addAssetToComposition(createComposition(), { ...asset(), svg: rawSvg().replace('</svg>', '<script/></svg>') }), /不支持/);
    const doc = addAssetToComposition(createComposition(), asset());
    // A getter proves rendering never visits the original table payload.
    const snapshot = {}; Object.defineProperty(snapshot, 'rawTable', { enumerable: true, get() { throw new Error('raw table copied during render'); } });
    doc.assets[0].editSnapshot = snapshot;
    assert.match(renderCompositionSvg(doc), /<path/);
});

test('common Matplotlib/Illustrator static styles become scoped presentation attributes with correct specificity', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><metadata xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:RDF/></metadata><style>*{stroke-linejoin:round;stroke-linecap:butt}path{fill:blue}.st0{fill:red;stroke:#222}#plot{fill:green}</style><path id="plot" class="st0" style="fill:#456" d="M0 0L200 100"/><path class="st0" d="M0 10L200 20"/></svg>';
    const clean = sanitizeFigureSvg(input, 'source'), parsed = new DOMParser().parseFromString(clean.svg, 'image/svg+xml'), paths = [...parsed.getElementsByTagName('path')];
    assert.equal(paths[0].getAttribute('fill'), '#456'); assert.equal(paths[1].getAttribute('fill'), 'red');
    assert.equal(paths[0].getAttribute('stroke-linejoin'), 'round'); assert.equal(paths[1].getAttribute('stroke'), '#222');
    assert.equal(parsed.getElementsByTagName('style').length, 0); assert.equal(parsed.getElementsByTagName('metadata').length, 0);
    assert.equal(paths[0].getAttribute('id'), 'source-plot');
});

test('Matplotlib editable text keeps standard font shorthand without accepting CSS resource loading', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><style>.label{font:italic bold 12pt DejaVu Sans;text-anchor:middle}</style><text class="label" x="50" y="30" style="font:10px &quot;DejaVu Sans&quot;; text-anchor:end">Scientific text</text><text class="label" x="50" y="70">Second</text></svg>';
    const clean = sanitizeFigureSvg(input), nodes = [...new DOMParser().parseFromString(clean.svg, 'image/svg+xml').getElementsByTagName('text')];
    assert.equal(nodes[0].getAttribute('font-size'), '10px'); assert.equal(nodes[0].getAttribute('font-family'), '"DejaVu Sans"'); assert.equal(nodes[0].getAttribute('text-anchor'), 'end');
    assert.equal(nodes[1].getAttribute('font-size'), '12pt'); assert.equal(nodes[1].getAttribute('font-style'), 'italic'); assert.equal(nodes[1].getAttribute('font-weight'), 'bold');
    assert.throws(() => sanitizeFigureSvg(input.replace('10px &quot;DejaVu Sans&quot;', '10px url(https://example.com/font.woff)')), /字体/);
});
