import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLUGIN_ASSET_TAG, formatPackageSize, isPluginAsset, pluginFromAsset, validatePluginDetails } from './catalog.ts';

const origin = 'https://plugin-storage.example.test';
const packageUrl = `${origin}/storage/v1/object/public/materials/uploads/plugins/published-1/package.zip`;
const coverUrl = `${origin}/storage/v1/object/public/materials/uploads/plugins/published-1/cover.png`;
const details = () => ({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '用于科研示意图的实际插件说明。', version: '1.2.0', features: ['创建可编辑对象', '导出科研图'], environment: ['Blender 4.x'], installation: ['安装 ZIP 后启用插件'], outputs: ['可编辑场景'], packageName: 'research-plugin.zip', packageBytes: 8192 });
const row = () => ({ id: 'published-1', title: '科研工具', description: JSON.stringify(details()), image_url: coverUrl, source_file_url: packageUrl, tags_style: [PLUGIN_ASSET_TAG], created_at: '2026-10-04T00:00:00.000Z' });

test('only explicitly marked records enter the plugin catalog', () => {
    assert.equal(isPluginAsset({ tags_style: [PLUGIN_ASSET_TAG, 'Blender'] }), true);
    for (const tags_style of [undefined, null, [], ['Blender'], [`${PLUGIN_ASSET_TAG}-other`], [PLUGIN_ASSET_TAG.toUpperCase()]]) {
        assert.equal(isPluginAsset({ tags_style }), false);
        assert.equal(pluginFromAsset({ ...row(), tags_style }, origin), null);
    }
});

test('published metadata round trip preserves Chinese instructions and package information', () => {
    const parsed = pluginFromAsset(row(), origin);
    assert.deepEqual(parsed, { ...details(), id: 'published-1', name: '科研工具', coverUrl, downloadUrl: packageUrl, publishedAt: '2026-10-04T00:00:00.000Z' });
    const cleaned = validatePluginDetails({ ...details(), summary: '  中文简介  ', version: '  1.2.0 ', features: ['  功能  '], extraPrivateField: 'must not be published' });
    assert.equal(cleaned.summary, '中文简介'); assert.equal(cleaned.version, '1.2.0'); assert.deepEqual(cleaned.features, ['功能']);
    assert.equal(Object.hasOwn(cleaned, 'extraPrivateField'), false);
});

test('corrupt or incomplete plugin metadata never renders as a downloadable plugin', () => {
    for (const description of ['{broken JSON', 'null', '{}', JSON.stringify({ ...details(), schema: 'different-v2' }), JSON.stringify({ ...details(), host: 'unknown-app' }), JSON.stringify({ ...details(), summary: '' }), JSON.stringify({ ...details(), features: [null] }), JSON.stringify({ ...details(), environment: 'Windows' })]) assert.equal(pluginFromAsset({ ...row(), description }, origin), null);
    assert.equal(pluginFromAsset({ ...row(), id: '' }, origin), null);
    assert.equal(pluginFromAsset({ ...row(), title: '' }, origin), null);
    assert.equal(pluginFromAsset({ ...row(), source_file_url: null }, origin), null);
});

test('downloads accept only this storage origin and the public materials/uploads/plugins namespace', () => {
    assert.equal(pluginFromAsset(row(), origin)?.downloadUrl, packageUrl);
    const invalid = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        `https://outside.example.test${new URL(packageUrl).pathname}`,
        `https://account:password@plugin-storage.example.test${new URL(packageUrl).pathname}`,
        packageUrl.replace('/materials/', '/other-bucket/'),
        packageUrl.replace('/uploads/plugins/', '/uploads/artwork/'),
        packageUrl.replace('/object/public/', '/object/authenticated/'),
        `${origin}/storage/v1/object/public/materials/uploads/plugins/../artwork/package.zip`,
        `${origin}/storage/v1/object/public/materials/uploads/plugins/%2e%2e/artwork/package.zip`,
        '/storage/v1/object/public/materials/uploads/plugins/project/package.zip',
        `//plugin-storage.example.test${new URL(packageUrl).pathname}`,
    ];
    for (const source_file_url of invalid) assert.equal(pluginFromAsset({ ...row(), source_file_url }, origin), null, source_file_url);
    const noRemoteCover = pluginFromAsset({ ...row(), image_url: 'https://outside.example.test/track.png' }, origin);
    assert.ok(noRemoteCover); assert.equal(noRemoteCover.coverUrl, undefined);
});

test('package metadata enforces a positive integer and the 50 MB maximum', () => {
    assert.equal(validatePluginDetails({ ...details(), packageBytes: 50 * 1024 * 1024 }).packageBytes, 50 * 1024 * 1024);
    for (const packageBytes of [0, -1, 1.5, NaN, Infinity, '8192', 50 * 1024 * 1024 + 1]) assert.throws(() => validatePluginDetails({ ...details(), packageBytes }), /大小/);
    assert.equal(formatPackageSize(8192), '8 KB'); assert.equal(formatPackageSize(5 * 1024 * 1024), '5.0 MB');
});
