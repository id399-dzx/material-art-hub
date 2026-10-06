import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentValidationError, validateContentMutation, validateContentPatch } from './schema.ts';

const assetId = '12345678-1234-4234-8234-123456789abc';
const ids = { skills: 'owner/research-skill', templates: 'line', journals: 'nature', assets: assetId, plugins: assetId };
const knownId = (section, id) => ids[section] === id;
const staticRequest = (overrides = {}) => ({ section: 'templates', itemId: 'line', action: 'edit', patch: { name: '实验折线' }, expectedVersion: null, ...overrides });
const assetRequest = (overrides = {}) => ({ section: 'assets', itemId: assetId, action: 'edit', patch: { title: '实验素材' }, expectedVersion: '2026-10-06T04:20:30.123456+00:00', expected: { title: '原素材', description: null, hidden: false }, ...overrides });
const rejects = (callback) => assert.throws(callback, ContentValidationError);

test('each catalog accepts editable presentation fields and preserves typed values', () => {
    assert.deepEqual(validateContentPatch('skills', { title: ' 科研工具 ', summary: ' 中文简介 ', category: 'figure', scope: 'research', features: ['绘图', '核验'], inputs: '数据', outputs: '图表', environment: 'Python', note: '说明' }), {
        title: '科研工具', summary: '中文简介', category: 'figure', scope: 'research', features: ['绘图', '核验'], inputs: '数据', outputs: '图表', environment: 'Python', note: '说明',
    });
    assert.deepEqual(validateContentPatch('templates', { name: '循环伏安', english: 'CV', category: '电化学测试', description: '简介', requirement: '电势与电流', guide: '绑定两列数据', xLabel: 'Potential', yLabel: 'Current' }), {
        name: '循环伏安', english: 'CV', category: '电化学测试', description: '简介', requirement: '电势与电流', guide: '绑定两列数据', xLabel: 'Potential', yLabel: 'Current',
    });
    assert.deepEqual(validateContentPatch('journals', { name: '期刊', publisher: '出版社', field: '材料与能源', policy: '灵活初次投稿', officialRequirements: ['单栏'], manualChecks: ['核对图注'], checkedOn: '2026-10-06' }), {
        name: '期刊', publisher: '出版社', field: '材料与能源', policy: '灵活初次投稿', officialRequirements: ['单栏'], manualChecks: ['核对图注'], checkedOn: '2026-10-06',
    });
    assert.deepEqual(validateContentPatch('assets', { title: '素材', description: '说明', tags_style: ['玻璃'] }), { title: '素材', description: '说明', tags_style: ['玻璃'] });
    assert.deepEqual(validateContentPatch('plugins', { title: '插件', host: 'PowerPoint', version: '0.2.1', summary: '简介', installation: ['运行安装程序'] }), { title: '插件', host: 'PowerPoint', version: '0.2.1', summary: '简介', installation: ['运行安装程序'] });
});

test('patches cannot change identity, chart engines, numerical examples, package objects, or internal state', () => {
    const forbidden = {
        skills: ['repo', 'owner', 'defaultBranch', 'isStarred'],
        templates: ['id', 'chartId', 'demo', 'variant', 'paper', 'electrochemical', 'preview'],
        journals: ['id'],
        assets: ['id', 'image_url', 'source_file_url', 'created_at'],
        plugins: ['id', 'packagePath', 'source_file_url', 'packageName', 'packageBytes', 'chunks', 'sha256', 'schema'],
    };
    for (const [section, fields] of Object.entries(forbidden)) {
        for (const field of [...fields, 'hidden', 'updated_at', 'isAdmin', 'constructor']) {
            rejects(() => validateContentPatch(section, { [field]: 'tampered' }));
        }
        rejects(() => validateContentPatch(section, JSON.parse('{"__proto__":{"isAdmin":true}}')));
    }
});

test('patches reject unexpected containers, erased required text, oversize text, and invalid enum values', () => {
    for (const value of [null, undefined, [], 'text', true, 42]) rejects(() => validateContentPatch('skills', value));
    for (const [section, patch] of [
        ['skills', { title: '  ' }], ['skills', { summary: '' }], ['templates', { name: '' }],
        ['templates', { requirement: '\n' }], ['journals', { sourceTitle: '' }], ['assets', { title: '' }], ['plugins', { version: '' }],
        ['skills', { title: 'x'.repeat(161) }], ['templates', { guide: 'x'.repeat(4001) }], ['plugins', { version: 'x'.repeat(81) }],
        ['skills', { category: 'invalid' }], ['skills', { scope: 'administrator' }], ['templates', { category: '机制插图' }],
        ['journals', { field: 'invalid' }], ['journals', { policy: '无需核对' }], ['plugins', { host: 'Unknown executable' }],
    ]) rejects(() => validateContentPatch(section, patch));
    assert.deepEqual(validateContentPatch('templates', { xLabel: '', yLabel: '' }), { xLabel: '', yLabel: '' });
});

test('lists normalize duplicates without changing the supplied input, and cannot impersonate plugin tags', () => {
    const features = Object.freeze([' 绘图 ', '核验', '绘图']);
    const patch = Object.freeze({ features });
    assert.deepEqual(validateContentPatch('skills', patch), { features: ['绘图', '核验'] });
    assert.deepEqual(features, [' 绘图 ', '核验', '绘图']);
    for (const value of ['not an array', [1], [null], ['  '], ['x'.repeat(1001)], Array.from({ length: 41 }, () => '功能')]) {
        rejects(() => validateContentPatch('skills', { features: value }));
    }
    for (const field of ['tags_application', 'tags_material', 'tags_process', 'tags_style']) {
        rejects(() => validateContentPatch('assets', { [field]: [' __fesilent_software_plugin_v1__ '] }));
    }
    assert.deepEqual(validateContentPatch('skills', { features: [] }), { features: [] });
});

test('links reject executable schemes, credential-bearing URLs, and relative destinations', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,<script></script>', 'file:///private/test', '/login', '//example.com', 'https://user:secret@example.com', 'https://', '']) {
        rejects(() => validateContentPatch('skills', { url: value }));
        if (value) rejects(() => validateContentPatch('journals', { templateUrl: value }));
    }
    assert.deepEqual(validateContentPatch('skills', { url: ' https://github.com/owner/repo ', readmeUrl: '' }), { url: 'https://github.com/owner/repo', readmeUrl: '' });
    assert.deepEqual(validateContentPatch('journals', { sourceUrl: 'http://journal.example.org/guidelines', templateUrl: '' }), { sourceUrl: 'http://journal.example.org/guidelines', templateUrl: '' });
});

test('guide dates must be real calendar dates rather than Date.parse rollover values', () => {
    assert.deepEqual(validateContentPatch('journals', { checkedOn: '2028-02-29' }), { checkedOn: '2028-02-29' });
    for (const value of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '06/10/2026', '2026-10-06T00:00:00Z']) {
        rejects(() => validateContentPatch('journals', { checkedOn: value }));
    }
});

test('journal options retain actual number and boolean types within formatter-supported bounds', () => {
    const options = { paper: 'Letter', font: 'Arial', fontSize: 11.5, lineSpacing: 1.5, marginCm: 2.54, lineNumbers: true, pageNumbers: false, singleColumn: true, preserveLandscape: false };
    assert.deepEqual(validateContentPatch('journals', { options }), { options });
    for (const patch of [
        { options: null }, { options: [] }, { options: { arbitrary: true } },
        { options: { paper: 'A3' } }, { options: { font: 'Comic Sans MS' } },
        { options: { fontSize: '12' } }, { options: { fontSize: NaN } }, { options: { fontSize: Infinity } },
        { options: { fontSize: 8.9 } }, { options: { fontSize: 16.1 } },
        { options: { marginCm: 1.49 } }, { options: { marginCm: 3.51 } }, { options: { marginCm: '2.54' } },
        { options: { lineSpacing: '2' } }, { options: { lineSpacing: 1.2 } },
        ...['lineNumbers', 'pageNumbers', 'singleColumn', 'preserveLandscape'].map(key => ({ options: { [key]: 'false' } })),
    ]) rejects(() => validateContentPatch('journals', patch));
    for (const [fontSize, marginCm] of [[9, 1.5], [16, 3.5]]) assert.deepEqual(validateContentPatch('journals', { options: { fontSize, marginCm } }), { options: { fontSize, marginCm } });
    rejects(() => validateContentPatch('templates', { options }));
});

test('mutation identity must be known and all envelope keys and operations must be supported', () => {
    assert.deepEqual(validateContentMutation(staticRequest(), knownId), staticRequest());
    for (const request of [
        null, [], {}, staticRequest({ section: 'users' }), staticRequest({ section: '__proto__' }),
        staticRequest({ itemId: 'not-a-template' }), staticRequest({ itemId: 3 }), staticRequest({ action: 'delete' }),
        staticRequest({ isAdmin: true }), staticRequest({ role: 'service_role' }), staticRequest({ patch: { demo: [] } }),
    ]) rejects(() => validateContentMutation(request, knownId));
});

test('static catalog changes require a content version, including null for an untouched entry', () => {
    for (const expectedVersion of [null, '2026-10-06T04:20:30.123Z', '2026-10-06T04:20:30.123456+00:00']) {
        assert.equal(validateContentMutation(staticRequest({ expectedVersion }), knownId).expectedVersion, expectedVersion);
    }
    for (const expectedVersion of [undefined, 0, false, {}, [], '', '2026-10-06', 'yesterday', '2026-10-06Tinvalid', '2026-02-30T04:20:30Z', '2026-10-06T24:00:00Z', '2026-10-06T04:20:30', '2026-10-06T04:20:30+25:00']) {
        rejects(() => validateContentMutation(staticRequest({ expectedVersion }), knownId));
    }
});

test('hide, restore, and reset cannot smuggle content edits; records without defaults cannot reset', () => {
    for (const action of ['hide', 'restore', 'reset']) {
        const result = validateContentMutation(staticRequest({ action, patch: {} }), knownId);
        assert.equal(result.action, action);
        assert.deepEqual(result.patch, {});
        rejects(() => validateContentMutation(staticRequest({ action }), knownId));
    }
    for (const section of ['assets', 'plugins']) rejects(() => validateContentMutation(assetRequest({ section, action: 'reset', patch: {} }), knownId));
});

test('material and plugin writes need the original title, description, and visibility for concurrent-update checks', () => {
    assert.deepEqual(validateContentMutation(assetRequest(), knownId), assetRequest());
    assert.deepEqual(validateContentMutation(assetRequest({ section: 'plugins', patch: { title: '插件' }, expected: { title: '原插件', description: '{"schema":"fesilent-plugin-v1"}', hidden: true } }), knownId).expected, { title: '原插件', description: '{"schema":"fesilent-plugin-v1"}', hidden: true });
    for (const expected of [undefined, null, {}, { title: '素材', hidden: false }, { title: 3, description: null, hidden: false }, { title: '素材', description: [], hidden: false }, { title: '素材', description: null, hidden: 'false' }, { title: '素材', description: null, hidden: false, role: 'admin' }]) {
        rejects(() => validateContentMutation(assetRequest({ expected }), knownId));
    }
    for (const expectedVersion of [undefined, null, 'invalid', '2026-02-30T04:20:30Z']) {
        rejects(() => validateContentMutation(assetRequest({ expectedVersion }), knownId));
    }
});
