import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, PLUGIN_PACKAGE_MAX_BYTES, PLUGIN_PACKAGE_CHUNK_BYTES, formatPackageSize, getPluginPackageObjects, getPluginPackagePath, isPluginAsset, pluginFromAsset, validatePluginDetails } from './catalog.ts';

const origin = 'https://plugin-storage.example.test';
const packageId = '8924a3a9-6eea-4db2-a2f9-e89f45b26daf';
const recordId = '1b83323d-1893-4400-bdb7-7cdb20b52f75';
const packagePath = `${packageId}/package.zip`;
const packageRef = `storage://${PLUGIN_PACKAGE_BUCKET}/${packagePath}`;
const coverUrl = `${origin}/storage/v1/object/public/materials/uploads/plugins/${packageId}/cover.png`;
const details = () => ({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '用于科研示意图的实际插件说明。', version: '1.2.0', features: ['创建可编辑对象', '导出科研图'], environment: ['Blender 4.x'], installation: ['安装 ZIP 后启用插件'], outputs: ['可编辑场景'], packageName: 'research-plugin.zip', packageBytes: 8192 });
const row = () => ({ id: recordId, title: '科研工具', description: JSON.stringify(details()), image_url: coverUrl, source_file_url: packageRef, tags_style: [PLUGIN_ASSET_TAG], created_at: '2026-10-04T00:00:00.000Z' });
const chunkedDetails = (packageBytes = PLUGIN_PACKAGE_CHUNK_BYTES + 257) => ({ ...details(), schema: 'fesilent-plugin-v2', packageBytes, packageSha256: 'a'.repeat(64), packageChunks: Array.from({ length: Math.ceil(packageBytes / PLUGIN_PACKAGE_CHUNK_BYTES) }, (_, index) => ({ bytes: Math.min(PLUGIN_PACKAGE_CHUNK_BYTES, packageBytes - index * PLUGIN_PACKAGE_CHUNK_BYTES), sha256: String(index).repeat(64) })) });

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

test('chunked catalog records preserve bounded integrity metadata and derive private object paths', () => {
    const metadata = chunkedDetails();
    const partsPath = `${packageId}/package.parts`;
    assert.equal(getPluginPackagePath(`storage://${PLUGIN_PACKAGE_BUCKET}/${partsPath}`), partsPath);
    const plugin = pluginFromAsset({ ...row(), description: JSON.stringify(metadata), source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/${partsPath}` }, origin);
    assert.ok(plugin); assert.deepEqual(plugin.packageChunks, metadata.packageChunks); assert.equal(plugin.packageSha256, metadata.packageSha256);
    assert.deepEqual(getPluginPackageObjects(plugin), [
        { path: `${packageId}/part-000.bin`, bytes: PLUGIN_PACKAGE_CHUNK_BYTES, sha256: '0'.repeat(64) },
        { path: `${packageId}/part-001.bin`, bytes: 257, sha256: '1'.repeat(64) },
    ]);
    assert.deepEqual(getPluginPackageObjects(details(), packagePath), [{ path: packagePath, bytes: details().packageBytes }]);
    const cleaned = validatePluginDetails({ ...metadata, packageChunks: metadata.packageChunks.map(chunk => ({ ...chunk, path: '../../another-user/file', publicUrl: 'https://outside.example.test' })) });
    assert.deepEqual(cleaned.packageChunks, metadata.packageChunks);
});

test('metadata schemas must match their exact virtual or ZIP reference', () => {
    const partsPath = `${packageId}/package.parts`;
    assert.throws(() => getPluginPackageObjects(details(), partsPath), /package\.zip/);
    assert.throws(() => getPluginPackageObjects(chunkedDetails(), packagePath), /package\.parts/);
    assert.equal(pluginFromAsset({ ...row(), source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/${partsPath}` }, origin), null);
    assert.equal(pluginFromAsset({ ...row(), description: JSON.stringify(chunkedDetails()) }, origin), null);
    for (const unsafePath of [`${packageId}/part-000.bin`, `${packageId}/../package.parts`, `${packageId}/package.parts?token=1`, `${packageId}/package.parts\n`, `${packageId}/package%2eparts`, `../${packageId}/package.parts`]) {
        assert.throws(() => getPluginPackageObjects(chunkedDetails(), unsafePath), /路径/);
        assert.equal(getPluginPackagePath(`storage://${PLUGIN_PACKAGE_BUCKET}/${unsafePath}`), null);
    }
});

test('v2 boundaries include a full final chunk and at most seven chunks for a 200 MB package', () => {
    assert.equal(PLUGIN_PACKAGE_CHUNK_BYTES, 32 * 1024 * 1024); assert.equal(PLUGIN_PACKAGE_MAX_BYTES, 200 * 1024 * 1024);
    const exactChunks = validatePluginDetails(chunkedDetails(2 * PLUGIN_PACKAGE_CHUNK_BYTES));
    assert.deepEqual(exactChunks.packageChunks.map(chunk => chunk.bytes), [PLUGIN_PACKAGE_CHUNK_BYTES, PLUGIN_PACKAGE_CHUNK_BYTES]);
    const maximum = validatePluginDetails(chunkedDetails(PLUGIN_PACKAGE_MAX_BYTES));
    assert.equal(maximum.packageChunks.length, 7); assert.equal(maximum.packageChunks.at(-1).bytes, 8 * 1024 * 1024);
    assert.equal(getPluginPackageObjects(maximum, `${packageId}/package.parts`).at(-1).path, `${packageId}/part-006.bin`);
    for (const packageBytes of [0, -1, 1.5, NaN, Infinity, '98021678', PLUGIN_PACKAGE_CHUNK_BYTES, PLUGIN_PACKAGE_MAX_BYTES + 1]) assert.throws(() => validatePluginDetails({ ...chunkedDetails(), packageBytes }), /大小|大于 32/);
});

test('corrupt chunk counts, byte accounting and hashes cannot enter the catalog', () => {
    const metadata = chunkedDetails();
    const invalid = [
        { packageChunks: [] }, { packageChunks: metadata.packageChunks.slice(0, 1) }, { packageChunks: [...metadata.packageChunks, metadata.packageChunks[1]] },
        { packageChunks: [null, metadata.packageChunks[1]] }, { packageChunks: [metadata.packageChunks[0], { ...metadata.packageChunks[1], bytes: 0 }] },
        { packageChunks: [{ ...metadata.packageChunks[0], bytes: PLUGIN_PACKAGE_CHUNK_BYTES - 1 }, { ...metadata.packageChunks[1], bytes: 258 }] },
        { packageChunks: [metadata.packageChunks[0], { ...metadata.packageChunks[1], bytes: 258 }] },
        { packageChunks: [metadata.packageChunks[0], { ...metadata.packageChunks[1], bytes: '257' }] },
        ...['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(64)}\n`, null].map(packageSha256 => ({ packageSha256 })),
        ...['A'.repeat(64), 'g'.repeat(64), `${'0'.repeat(64)}\n`, null].map(sha256 => ({ packageChunks: [{ ...metadata.packageChunks[0], sha256 }, metadata.packageChunks[1]] })),
    ];
    for (const invalidFields of invalid) {
        const description = JSON.stringify({ ...metadata, ...invalidFields });
        assert.throws(() => validatePluginDetails(JSON.parse(description)), /分片|SHA-256/);
        assert.equal(pluginFromAsset({ ...row(), description, source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/${packageId}/package.parts` }, origin), null);
    }
    assert.throws(() => validatePluginDetails({ ...metadata, packageChunks: new Array(2) }), /分片信息/);
});
