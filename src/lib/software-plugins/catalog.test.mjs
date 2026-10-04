import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, formatPackageSize, getPluginPackagePath, isPluginAsset, pluginFromAsset, validatePluginDetails } from './catalog.ts';

const origin = 'https://plugin-storage.example.test';
const packageId = '8924a3a9-6eea-4db2-a2f9-e89f45b26daf';
const recordId = '1b83323d-1893-4400-bdb7-7cdb20b52f75';
const packagePath = `${packageId}/package.zip`;
const packageRef = `storage://${PLUGIN_PACKAGE_BUCKET}/${packagePath}`;
const coverUrl = `${origin}/storage/v1/object/public/materials/uploads/plugins/${packageId}/cover.png`;
const details = () => ({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '用于科研示意图的实际插件说明。', version: '1.2.0', features: ['创建可编辑对象', '导出科研图'], environment: ['Blender 4.x'], installation: ['安装 ZIP 后启用插件'], outputs: ['可编辑场景'], packageName: 'research-plugin.zip', packageBytes: 8192 });
const row = () => ({ id: recordId, title: '科研工具', description: JSON.stringify(details()), image_url: coverUrl, source_file_url: packageRef, tags_style: [PLUGIN_ASSET_TAG], created_at: '2026-10-04T00:00:00.000Z' });

test('only explicitly marked records enter the plugin catalog', () => {
    assert.equal(isPluginAsset({ tags_style: [PLUGIN_ASSET_TAG, 'Blender'] }), true);
    for (const tags_style of [undefined, null, [], ['Blender'], [`${PLUGIN_ASSET_TAG}-other`], [PLUGIN_ASSET_TAG.toUpperCase()]]) {
        assert.equal(isPluginAsset({ tags_style }), false);
        assert.equal(pluginFromAsset({ ...row(), tags_style }, origin), null);
    }
});

test('published metadata round trip preserves Chinese instructions and package information', () => {
    const parsed = pluginFromAsset(row(), origin);
    assert.deepEqual(parsed, { ...details(), id: recordId, name: '科研工具', coverUrl, packagePath, downloadUrl: `/api/software-plugins/${recordId}/download`, publishedAt: '2026-10-04T00:00:00.000Z' });
    assert.equal(parsed.downloadUrl.includes('storage'), false);
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

test('downloads expose only the authenticated site route and reject public or arbitrary storage links', () => {
    assert.equal(pluginFromAsset(row(), origin)?.downloadUrl, `/api/software-plugins/${recordId}/download`);
    const invalid = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        `${origin}/storage/v1/object/public/materials/uploads/plugins/${packagePath}`,
        `${origin}/storage/v1/object/authenticated/${PLUGIN_PACKAGE_BUCKET}/${packagePath}`,
        `${origin}/storage/v1/object/sign/${PLUGIN_PACKAGE_BUCKET}/${packagePath}?token=old-token`,
        `https://outside.example.test/${packagePath}`,
        packageRef.replace(PLUGIN_PACKAGE_BUCKET, 'materials'),
        `/${packagePath}`,
    ];
    for (const source_file_url of invalid) assert.equal(pluginFromAsset({ ...row(), source_file_url }, origin), null, source_file_url);
    const noRemoteCover = pluginFromAsset({ ...row(), image_url: 'https://outside.example.test/track.png' }, origin);
    assert.ok(noRemoteCover); assert.equal(noRemoteCover.coverUrl, undefined);
});

test('private package references accept exactly a UUID and package.zip without URL normalisation', () => {
    assert.equal(getPluginPackagePath(packageRef), packagePath);
    const invalid = [null, undefined, {}, '', packagePath, packageRef.replace('storage://', 'https://'),
        packageRef.replace(PLUGIN_PACKAGE_BUCKET, 'PLUGIN-PACKAGES'), packageRef.replace(packageId, 'not-a-uuid'),
        packageRef.replace(packageId, `${packageId}\n`), packageRef.replace(packageId, packageId.replaceAll('-', '')),
        packageRef.replace('/package.zip', '/../package.zip'), packageRef.replace('/package.zip', '/%2e%2e/package.zip'),
        packageRef.replace('/package.zip', '\\package.zip'), packageRef.replace('/package.zip', '/folder/package.zip'),
        packageRef.replace('package.zip', 'other.zip'), packageRef.replace('package.zip', 'PACKAGE.ZIP'),
        `${packageRef}?download=1`, `${packageRef}#token`, `${packageRef}/`, `${packageRef}\n`,
        `storage://${PLUGIN_PACKAGE_BUCKET}/uploads/plugins/${packagePath}`,
        `storage://${PLUGIN_PACKAGE_BUCKET}/${encodeURIComponent(packageId)}/package%2ezip`];
    for (const value of invalid) {
        assert.equal(getPluginPackagePath(value), null, String(value));
        assert.equal(pluginFromAsset({ ...row(), source_file_url: value }, origin), null);
    }
    for (const id of ['published-1', '../other', `${recordId}\n`, `${recordId}?x=1`]) assert.equal(pluginFromAsset({ ...row(), id }, origin), null);
});

test('package metadata enforces a positive integer and the 50 MB maximum', () => {
    assert.equal(validatePluginDetails({ ...details(), packageBytes: 50 * 1024 * 1024 }).packageBytes, 50 * 1024 * 1024);
    for (const packageBytes of [0, -1, 1.5, NaN, Infinity, '8192', 50 * 1024 * 1024 + 1]) assert.throws(() => validatePluginDetails({ ...details(), packageBytes }), /大小/);
    assert.equal(formatPackageSize(8192), '8 KB'); assert.equal(formatPackageSize(5 * 1024 * 1024), '5.0 MB');
});
