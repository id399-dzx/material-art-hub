import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { PLUGIN_ADMIN_EMAIL, PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET, PLUGIN_PACKAGE_MAX_BYTES, PLUGIN_PACKAGE_CHUNK_BYTES, pluginFromAsset } from './catalog.ts';

// Substitute the client before importing storage.ts. No credentials or network are used.
const stubKey = Symbol.for('fesilent.software-plugin.storage.test.client');
const storageOrigin = 'https://plugin-storage.example.test';
let state;
const client = {
    auth: { async getUser() { state.authCalls++; if (state.authThrow) throw state.authThrow; if (state.authPending) return await state.authPending; return { data: { user: state.user }, error: state.authError }; } },
    storage: {
        async getBucket(bucket) { state.bucketReads.push(bucket); if (state.bucketPending) return await state.bucketPending; return { data: state.bucketDefinition, error: state.bucketError }; },
        from(bucket) {
        state.buckets.push(bucket);
        return {
            async upload(path, file, settings) { state.uploads.push({ bucket, path, file, settings }); state.onUpload?.(); if (state.uploadPending) await state.uploadPending; return { error: state.uploadErrorAt === state.uploads.length ? state.uploadError : null }; },
            async list(path, options, parameters) { state.storageLists.push({ bucket, path, options, parameters }); return { data: [], error: state.listError }; },
            getPublicUrl(path) { state.publicUrlCalls.push({ bucket, path }); return { data: { publicUrl: `${storageOrigin}/storage/v1/object/public/${bucket}/${path}` } }; },
            async remove(paths) { state.removals.push({ bucket, paths: [...paths] }); if (state.cleanupThrow) throw state.cleanupThrow; return { error: state.cleanupError }; },
        };
    } },
    from(table) { return {
        async insert(record) { state.inserts.push({ table, record }); if (state.insertThrow) throw state.insertThrow; return { error: state.insertError, status: state.insertStatus }; },
        update(record) {
            const update = { table, record, filters: [] }; state.updates.push(update);
            return {
                eq(column, value) { update.filters.push({ column, value }); return this; },
                contains(column, tags) { update.filter = { column, tags }; return this; },
                select(columns) { update.columns = columns; return this; },
                then(resolve, reject) { return (async () => {
                    state.onUpdate?.();
                    if (state.updateThrow) throw state.updateThrow;
                    if (state.updateError) return { data: null, error: state.updateError, status: state.updateStatus };
                    if (state.updateRows !== undefined) return { data: state.updateRows, error: null };
                    const matches = state.rows.filter(row => update.filters.every(({ column, value }) => row[column] === value)
                        && update.filter.tags.every(tag => row[update.filter.column]?.includes(tag)));
                    for (const row of matches) Object.assign(row, record);
                    const data = matches.map(({ id, source_file_url }) => ({ id, source_file_url }));
                    if (state.updateCommittedError) return { data: null, error: state.updateCommittedError, status: state.updateStatus };
                    return { data, error: null };
                })().then(resolve, reject); },
            };
        },
        select(columns) { const query = { table, columns, filters: [] }; state.queries.push(query); return {
            eq(column, value) { query.filters.push({ column, value }); return this; },
            contains(column, tags) { query.filter = { column, tags }; return this; },
            order(column, options) { query.order = { column, options }; return this; },
            async abortSignal(signal) {
                query.signal = signal;
                const data = query.filters.length ? state.rows.filter(row => query.filters.every(({ column, value }) => row[column] === value)
                    && query.filter.tags.every(tag => row[query.filter.column]?.includes(tag))) : state.rows;
                return { data: structuredClone(data), error: state.readError };
            },
        }; },
    }; },
};
globalThis[stubKey] = client;
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/supabase') return { url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("fesilent.software-plugin.storage.test.client")]; export const isSupabaseConnectionError = error => /failed to fetch|fetch failed|network request failed|networkerror|load failed|enotfound|err_name_not_resolved/i.test(error?.message ?? String(error));')}`, shortCircuit: true };
    if (specifier === './catalog' && context.parentURL?.endsWith('/software-plugins/storage.ts')) return nextResolve(new URL('./catalog.ts', context.parentURL).href, context);
    return nextResolve(specifier, context);
} });
const { checkPluginPublicationStorage, loadSoftwarePlugins, publishSoftwarePlugin } = await import('./storage.ts');
const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
after(() => { hooks.deregister(); delete globalThis[stubKey]; if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap; else delete globalThis.createImageBitmap; if (originalStorageUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalStorageUrl; });
beforeEach(() => {
    state = { user: { email: PLUGIN_ADMIN_EMAIL }, authError: null, authCalls: 0, buckets: [], uploads: [], removals: [], inserts: [], updates: [], publicUrlCalls: [], queries: [], rows: [], readError: null, uploadErrorAt: -1, uploadError: new Error('Storage rejected upload'), insertError: null, updateError: null, cleanupError: null, cleanupThrow: null, bitmapClosed: 0 };
    Object.assign(state, { bucketReads: [], bucketDefinition: { id: PLUGIN_PACKAGE_BUCKET, public: false, file_size_limit: PLUGIN_PACKAGE_CHUNK_BYTES, allowed_mime_types: ['application/zip', 'application/octet-stream'] }, bucketError: null, storageLists: [], listError: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = storageOrigin;
    globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() { state.bitmapClosed++; } });
});
async function input(overrides = {}) {
    const zip = new JSZip(); zip.file('README.md', '科研插件使用说明'); zip.file('plugin.py', '# test fixture only');
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { name: '  科研图工具  ', host: 'Blender', summary: '  用于科研图片的插件。  ', version: '1.0.0', features: ['创建图形'], environment: ['Blender 4.x'], installation: ['安装后启用'], outputs: ['可编辑场景'], packageFile: new File([bytes], 'research-tool.zip', { type: 'application/zip' }), ...overrides };
}
const noWrites = () => { assert.equal(state.uploads.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.updates.length, 0); assert.equal(state.removals.length, 0); };

async function updateFixture(overrides = {}) {
    const publication = await input();
    const row = {
        id: '37b37a8b-6ad4-40b9-a7e0-7746fb2bc311', title: '原科研插件',
        description: JSON.stringify({ schema: 'fesilent-plugin-v1', host: publication.host, summary: '原插件简介', version: '1.0.0', features: publication.features, environment: publication.environment, installation: publication.installation, outputs: publication.outputs, packageName: 'original-tool.zip', packageBytes: publication.packageFile.size }),
        image_url: `${storageOrigin}/storage/v1/object/public/materials/uploads/plugins/old-cover/cover.png`,
        source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/ba706e1c-ec1e-44bb-83eb-253671951124/package.zip`,
        tags_style: [PLUGIN_ASSET_TAG, '原有风格'], tags_application: ['保留应用'], tags_material: ['保留材质'], tags_process: ['保留工艺'],
        created_at: '2026-10-04T00:00:00.000Z', ...overrides,
    };
    state.rows = [row];
    const existingPlugin = pluginFromAsset(row, storageOrigin);
    assert.ok(existingPlugin);
    return { publication: { ...publication, version: '2.0.0', existingPlugin }, row, original: structuredClone(row) };
}
function packageFixture(size) {
    const bytes = new Uint8Array(size);
    bytes.set([0x50, 0x4b, 3, 4]);
    for (let offset = PLUGIN_PACKAGE_CHUNK_BYTES - 1; offset < size; offset += PLUGIN_PACKAGE_CHUNK_BYTES) bytes[offset] = 173;
    bytes[size - 1] = 241;
    return new File([bytes], 'chunked-tool.zip', { type: '' });
}
const expectedHash = bytes => createHash('sha256').update(bytes).digest('hex');
const databaseRejection = () => Object.assign(new Error('Database insertion failed'), { code: '23514' });

test('updating a plugin replaces its package on the same asset id and preserves original cover, tags and creation time', async () => {
    const { publication, row, original } = await updateFixture();
    await publishSoftwarePlugin(publication);
    assert.equal(state.inserts.length, 0); assert.equal(state.updates.length, 1); assert.equal(state.rows.length, 1);
    assert.equal(row.id, original.id); assert.equal(row.title, publication.name.trim());
    assert.equal(JSON.parse(row.description).version, '2.0.0');
    assert.equal(row.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${state.uploads[0].path}`);
    assert.notEqual(row.source_file_url, original.source_file_url);
    for (const column of ['image_url', 'created_at', 'tags_style', 'tags_application', 'tags_material', 'tags_process']) assert.deepEqual(row[column], original[column]);
    const update = state.updates[0];
    assert.deepEqual(Object.keys(update.record).sort(), ['description', 'source_file_url', 'title']);
    assert.equal(update.filters.find(filter => filter.column === 'id').value, original.id);
    assert.equal(update.filters.find(filter => filter.column === 'source_file_url').value, original.source_file_url);
    assert.deepEqual(update.filter, { column: 'tags_style', tags: [PLUGIN_ASSET_TAG] });
    assert.equal(update.columns, 'id,source_file_url');
    assert.ok(state.queries[0].signal instanceof AbortSignal);
    assert.equal(state.publicUrlCalls.length, 0); assert.equal(state.removals.length, 0);
});

test('updating with a new cover switches only this entry to a new upload directory and retains old files', async () => {
    const { publication, row, original } = await updateFixture();
    publication.coverFile = new File(['decoded fixture'], 'cover.webp', { type: 'image/webp' });
    await publishSoftwarePlugin(publication);
    assert.equal(state.uploads.length, 2); assert.equal(state.inserts.length, 0); assert.equal(state.updates.length, 1);
    assert.equal(row.image_url, `${storageOrigin}/storage/v1/object/public/materials/${state.uploads[1].path}`);
    assert.notEqual(row.image_url, original.image_url); assert.equal(row.created_at, original.created_at);
    assert.equal(state.uploads[0].path.split('/')[0], state.uploads[1].path.split('/')[2]);
    assert.equal(state.removals.length, 0);
});

test('a new ZIP can replace the package while keeping the original plugin name and version', async () => {
    const { publication, row, original } = await updateFixture();
    publication.name = publication.existingPlugin.name; publication.version = publication.existingPlugin.version;
    await publishSoftwarePlugin(publication);
    assert.equal(row.id, original.id); assert.equal(row.title, original.title);
    assert.equal(JSON.parse(row.description).version, JSON.parse(original.description).version);
    assert.notEqual(row.source_file_url, original.source_file_url);
    assert.equal(state.inserts.length, 0); assert.equal(state.updates.length, 1); assert.equal(state.removals.length, 0);
});

test('stale plugin snapshots are rejected before upload when metadata, package, cover or creation time changed', async () => {
    for (const [column, changed] of [
        ['title', '别人修改的名称'], ['description', JSON.stringify({})],
        ['source_file_url', `storage://${PLUGIN_PACKAGE_BUCKET}/ad506e1c-ec1e-44bb-83eb-253671951124/package.zip`],
        ['image_url', `${storageOrigin}/storage/v1/object/public/materials/uploads/plugins/new-cover/cover.png`],
        ['created_at', '2026-10-05T00:00:00.000Z'],
    ]) {
        const { publication, row } = await updateFixture(); row[column] = changed;
        await assert.rejects(publishSoftwarePlugin(publication), /已被修改|原插件信息无效/);
        noWrites();
    }
});

test('missing, non-plugin and invalid plugin targets cannot receive uploads or database updates', async () => {
    const missing = await updateFixture(); state.rows = [];
    await assert.rejects(publishSoftwarePlugin(missing.publication), /已删除或不在插件目录/); noWrites();
    const nonPlugin = await updateFixture(); nonPlugin.row.tags_style = ['普通素材'];
    await assert.rejects(publishSoftwarePlugin(nonPlugin.publication), /不在插件目录/); noWrites();
    const invalid = await updateFixture(); invalid.row.source_file_url = 'https://example.test/public.zip';
    await assert.rejects(publishSoftwarePlugin(invalid.publication), /原插件信息无效/); noWrites();
    const malformed = await updateFixture(); malformed.publication.existingPlugin.id = '../ordinary-asset';
    await assert.rejects(publishSoftwarePlugin(malformed.publication), /原插件编号无效/); noWrites();
});

test('authentication and target read failures stop updates before uploading or writing', async () => {
    const { publication } = await updateFixture();
    for (const user of [null, { email: 'viewer@example.test' }]) {
        state.user = user;
        await assert.rejects(publishSoftwarePlugin(publication), /管理员/); noWrites();
    }
    assert.equal(state.queries.length, 0);
    state.user = { email: PLUGIN_ADMIN_EMAIL }; state.readError = { message: 'permission denied for table assets', code: '42501' };
    await assert.rejects(publishSoftwarePlugin(publication), /assets.*读取权限/); noWrites();
});

test('an update requires a newly selected ZIP and cannot republish using the old package reference', async () => {
    const { publication, row, original } = await updateFixture(); publication.packageFile = undefined;
    await assert.rejects(publishSoftwarePlugin(publication), /ZIP/);
    noWrites(); assert.deepEqual(row, original);
});

test('a concurrent plugin change causes zero matches and cleans only this update package', async () => {
    const { publication, row, original } = await updateFixture();
    state.onUpload = () => { row.title = '另一个管理员保存的名称'; };
    await assert.rejects(publishSoftwarePlugin(publication), /已被修改或已不可用/);
    assert.equal(state.updates.length, 1); assert.equal(state.inserts.length, 0);
    assert.equal(row.title, '另一个管理员保存的名称'); assert.equal(row.source_file_url, original.source_file_url);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] }]);
});

test('an update with no returned matching row never reports success or alters the old download', async () => {
    const { publication, row, original } = await updateFixture(); state.updateRows = [];
    await assert.rejects(publishSoftwarePlugin(publication), /已被修改或已不可用/);
    assert.deepEqual(row, original); assert.equal(state.inserts.length, 0);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] }]);
});

test('failed update package upload preserves the original entry and never starts a database write', async () => {
    const { publication, row, original } = await updateFixture(); state.uploadErrorAt = 1;
    await assert.rejects(publishSoftwarePlugin(publication), /安装包上传失败/);
    assert.deepEqual(row, original); assert.equal(state.updates.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.removals.length, 0);
});

test('failed update cover upload cleans the new package and preserves the original package and cover', async () => {
    const { publication, row, original } = await updateFixture(); state.uploadErrorAt = 2;
    publication.coverFile = new File(['decoded fixture'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(publication), /封面上传失败/);
    assert.deepEqual(row, original); assert.equal(state.updates.length, 0); assert.equal(state.inserts.length, 0);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] }]);
});

test('a definite update rejection cleans new uploads while preserving the old entry and downloads', async () => {
    const { publication, row, original } = await updateFixture();
    publication.coverFile = new File(['decoded fixture'], 'cover.png', { type: 'image/png' });
    state.updateError = { message: 'permission denied for table assets', code: '42501' };
    await assert.rejects(publishSoftwarePlugin(publication), /插件介绍保存权限被拒绝/);
    assert.deepEqual(row, original); assert.equal(state.updates.length, 1); assert.equal(state.inserts.length, 0);
    assert.deepEqual(state.removals, state.uploads.map(({ bucket, path }) => ({ bucket, paths: [path] })));
    assert.ok(state.removals.every(removal => !removal.paths.includes(original.source_file_url.split(`storage://${PLUGIN_PACKAGE_BUCKET}/`)[1])));
});

test('a committed update with a lost network reply retains the new package referenced by the same entry', async () => {
    const { publication, row, original } = await updateFixture();
    publication.coverFile = new File(['decoded fixture'], 'cover.png', { type: 'image/png' });
    state.updateCommittedError = new Error('Network request failed');
    await assert.rejects(publishSoftwarePlugin(publication), /无法确认发布结果.*刷新插件目录/);
    assert.equal(row.id, original.id); assert.equal(row.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${state.uploads[0].path}`);
    assert.notEqual(row.source_file_url, original.source_file_url); assert.equal(state.removals.length, 0); assert.equal(state.inserts.length, 0);
});

test('a thrown or timed out update keeps staged uploads because the database result is unknown', async () => {
    for (const mode of ['throw', 'timeout', 'server']) {
        const { publication } = await updateFixture();
        state.updateThrow = mode === 'throw' ? new Error('Network request failed') : undefined;
        state.updateError = mode === 'timeout' ? new DOMException('request timed out', 'TimeoutError')
            : mode === 'server' ? { message: 'Internal server error', status: 500 } : null;
        await assert.rejects(publishSoftwarePlugin(publication));
        assert.equal(state.removals.length, 0); assert.equal(state.inserts.length, 0);
    }
});

test('SDK parse failures and unidentified errors after a committed update retain its referenced package', async () => {
    for (const { error, status } of [
        { error: { message: 'SyntaxError: Unexpected end of JSON input', code: '' }, status: 0 },
        { error: { message: 'Unknown response error', code: '' }, status: undefined },
        { error: { message: 'Invalid response', code: '42501' }, status: 0 },
    ]) {
        const { publication, row, original } = await updateFixture();
        state.updateCommittedError = error; state.updateStatus = status;
        await assert.rejects(publishSoftwarePlugin(publication));
        assert.equal(row.id, original.id);
        assert.notEqual(row.source_file_url, original.source_file_url);
        assert.equal(row.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${state.uploads.at(-1).path}`);
        assert.equal(state.removals.length, 0);
    }
});

test('unverifiable update responses retain staged files and cannot report successful publication', async () => {
    for (const result of [null, [{ id: 'another-id', source_file_url: 'unexpected' }], [{ id: 'one' }, { id: 'two' }]]) {
        const { publication, row, original } = await updateFixture(); state.updateRows = result;
        await assert.rejects(publishSoftwarePlugin(publication), /更新结果无法确认/);
        assert.deepEqual(row, original); assert.equal(state.removals.length, 0); assert.equal(state.inserts.length, 0);
    }
});

test('a new publication also retains its package when the insert result is uncertain', async () => {
    state.insertError = new Error('Network request failed');
    await assert.rejects(publishSoftwarePlugin(await input()), /无法确认发布结果/);
    assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 0);
    state.insertError = null; state.insertThrow = new DOMException('request timed out', 'TimeoutError');
    await assert.rejects(publishSoftwarePlugin(await input()), /无法确认发布结果/);
    assert.equal(state.inserts.length, 2); assert.equal(state.removals.length, 0);
});

test('SDK parse failures and unidentified insert errors cannot delete a potentially published package', async () => {
    for (const { error, status } of [
        { error: { message: 'SyntaxError: Unexpected end of JSON input', code: '' }, status: 0 },
        { error: { message: 'Unknown response error', code: '' }, status: undefined },
    ]) {
        state.insertError = error; state.insertStatus = status;
        await assert.rejects(publishSoftwarePlugin(await input()));
        assert.equal(state.removals.length, 0);
    }
});

test('anonymous and non-admin users cannot upload or write plugin records', async () => {
    const publication = await input();
    for (const user of [null, { email: 'viewer@example.test' }, { email: `another-${PLUGIN_ADMIN_EMAIL}` }]) {
        state.user = user;
        await assert.rejects(publishSoftwarePlugin(publication), /管理员/);
        noWrites();
    }
    assert.equal(state.authCalls, 3);
});

test('authentication failure aborts publication before any storage or database call', async () => {
    const failure = new Error('Session invalid'); state.authError = failure;
    await assert.rejects(publishSoftwarePlugin(await input()), /请登录管理员账号/);
    noWrites();
    state.authError = new Error('Network request failed');
    await assert.rejects(publishSoftwarePlugin(await input()), /暂时无法连接账号服务/);
    noWrites();
});

test('renamed non-ZIP content and unsupported extensions are rejected before uploading', async () => {
    const invalid = [new File(['not a ZIP'], 'tool.zip', { type: 'application/zip' }), new File([Uint8Array.of(0x50, 0x4b, 7, 8)], 'tool.zip'), new File([Uint8Array.of(0x50, 0x4b, 3, 4)], 'tool.exe')];
    for (const packageFile of invalid) { await assert.rejects(publishSoftwarePlugin(await input({ packageFile })), /ZIP/); noWrites(); }
});

test('oversized packages and invalid covers fail before persistent writes', async () => {
    const oversizedPackage = { name: 'tool.zip', size: PLUGIN_PACKAGE_MAX_BYTES + 1, slice() { throw new Error('An oversized file must never be read'); } };
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile: oversizedPackage })), /大小/); noWrites();
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile: new File(['svg'], 'cover.svg', { type: 'image/svg+xml' }) })), /封面/); noWrites();
    globalThis.createImageBitmap = async () => { throw new Error('Invalid image'); };
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile: new File(['bad PNG'], 'cover.png', { type: 'image/png' }) })), /封面无法读取/); noWrites();
});

test('database failure removes exactly the package and cover uploaded in this publication', async () => {
    const failure = databaseRejection(); state.insertError = failure;
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile })), error => error.cause === failure && /插件介绍保存失败/.test(error.message));
    assert.equal(state.uploads.length, 2); assert.equal(state.inserts.length, 1); assert.equal(state.bitmapClosed, 1);
    assert.equal(state.removals.length, 2);
    assert.deepEqual(state.removals, state.uploads.map(({ bucket, path }) => ({ bucket, paths: [path] })));
    assert.equal(state.removals[0].bucket, PLUGIN_PACKAGE_BUCKET); assert.match(state.removals[0].paths[0], /^[\da-f-]{36}\/package\.zip$/);
    assert.equal(state.removals[1].bucket, 'materials'); assert.match(state.removals[1].paths[0], /^uploads\/plugins\/[\da-f-]{36}\/cover\.png$/);
    assert.equal(state.uploads[0].path.split('/')[0], state.uploads[1].path.split('/')[2]);
});

test('cleanup returning an error does not falsely report successful rollback', async () => {
    state.insertError = databaseRejection(); state.cleanupError = new Error('Storage cleanup denied');
    await assert.rejects(publishSoftwarePlugin(await input()), /未成功发布.*清理失败/);
    assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 1);
    assert.deepEqual(state.removals[0], { bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] });
});

test('cleanup throwing a network error gives a visible recovery instruction', async () => {
    state.insertError = databaseRejection(); state.cleanupThrow = new Error('Network cleanup failed');
    await assert.rejects(publishSoftwarePlugin(await input()), /管理员检查 plugin-packages 与 materials 中的本次上传文件/);
    assert.equal(state.removals.length, 1); assert.deepEqual(state.removals[0], { bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] });
});

test('failed cover upload cleans the successful package, without deleting files that were never created', async () => {
    state.uploadErrorAt = 2;
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile })), error => error.cause === state.uploadError && /封面上传失败/.test(error.message));
    assert.equal(state.uploads.length, 2); assert.equal(state.inserts.length, 0);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] }]);
});

test('failed package upload neither inserts a record nor removes an unrelated file', async () => {
    state.uploadErrorAt = 1;
    await assert.rejects(publishSoftwarePlugin(await input()), error => error.cause === state.uploadError && /安装包上传失败/.test(error.message));
    assert.equal(state.uploads.length, 1); assert.equal(state.inserts.length, 0); assert.equal(state.removals.length, 0);
});

test('successful publication persists its marker and complete metadata, then retains the uploaded files', async () => {
    const publication = await input();
    await publishSoftwarePlugin(publication);
    assert.equal(state.uploads.length, 1); assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 0);
    assert.ok(state.buckets.every(bucket => bucket === PLUGIN_PACKAGE_BUCKET));
    assert.equal(state.publicUrlCalls.length, 0);
    assert.deepEqual(state.uploads[0].settings, { contentType: 'application/zip', upsert: false });
    const { table, record } = state.inserts[0]; assert.equal(table, 'assets'); assert.equal(record.title, '科研图工具'); assert.deepEqual(record.tags_style, [PLUGIN_ASSET_TAG]);
    assert.deepEqual(record.tags_application, []); assert.deepEqual(record.tags_material, []); assert.deepEqual(record.tags_process, []);
    assert.equal(record.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${state.uploads[0].path}`);
    const metadata = JSON.parse(record.description);
    assert.deepEqual(metadata, { schema: 'fesilent-plugin-v1', host: 'Blender', summary: '用于科研图片的插件。', version: '1.0.0', features: ['创建图形'], environment: ['Blender 4.x'], installation: ['安装后启用'], outputs: ['可编辑场景'], packageName: publication.packageFile.name, packageBytes: publication.packageFile.size });
    assert.ok(Number.isFinite(Date.parse(record.created_at)));
    assert.equal(Object.hasOwn(metadata, 'packageFile'), false);
});

test('publication stores a private package reference and only the cover has a public URL', async () => {
    const coverFile = new File(['fixture WEBP decoded by stub'], 'cover.webp', { type: 'image/webp' });
    await publishSoftwarePlugin(await input({ coverFile }));
    assert.equal(state.uploads.length, 2); assert.equal(state.removals.length, 0);
    assert.ok(state.uploads[1].path.endsWith('/cover.webp')); assert.deepEqual(state.uploads[1].settings, { contentType: 'image/webp', upsert: false });
    assert.equal(state.uploads[0].bucket, PLUGIN_PACKAGE_BUCKET); assert.equal(state.uploads[1].bucket, 'materials');
    assert.deepEqual(state.publicUrlCalls, [{ bucket: 'materials', path: state.uploads[1].path }]);
    assert.equal(state.inserts[0].record.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${state.uploads[0].path}`);
    assert.equal(state.inserts[0].record.image_url, `${storageOrigin}/storage/v1/object/public/materials/${state.uploads[1].path}`);
});

test('rollback attempts both buckets even when removing the private package fails', async () => {
    state.insertError = databaseRejection(); state.cleanupError = new Error('Package cleanup denied');
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile })), /未成功发布.*清理失败/);
    assert.deepEqual(state.removals, state.uploads.map(({ bucket, path }) => ({ bucket, paths: [path] })));
});

test('anonymous visitors can read catalog metadata without receiving public URLs or storage signatures', async () => {
    state.user = null;
    const publication = await input();
    const id = '37b37a8b-6ad4-40b9-a7e0-7746fb2bc311', packageId = 'ba706e1c-ec1e-44bb-83eb-253671951124';
    state.rows = [{ hidden: false, id, title: publication.name.trim(), description: JSON.stringify({ schema: 'fesilent-plugin-v1', host: publication.host, summary: publication.summary.trim(), version: publication.version, features: publication.features, environment: publication.environment, installation: publication.installation, outputs: publication.outputs, packageName: publication.packageFile.name, packageBytes: publication.packageFile.size }), image_url: '/plugin-placeholder.svg', source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/${packageId}/package.zip`, tags_style: [PLUGIN_ASSET_TAG], created_at: '2026-10-04T00:00:00.000Z' }];
    const plugins = await loadSoftwarePlugins();
    assert.equal(plugins[0].downloadUrl, `/api/software-plugins/${id}/download`);
    assert.equal(plugins[0].packagePath, `${packageId}/package.zip`);
    assert.equal(state.authCalls, 0); assert.equal(state.buckets.length, 0); assert.equal(state.publicUrlCalls.length, 0);
    assert.deepEqual(state.queries[0].filter, { column: 'tags_style', tags: [PLUGIN_ASSET_TAG] });
    assert.deepEqual(state.queries[0].filters, [{ column: 'hidden', value: false }]);
    state.rows[0].hidden = true;
    assert.deepEqual(await loadSoftwarePlugins(), []);
});

test('old public package records are refused with an explicit migration message', async () => {
    state.rows = [{ hidden: false, tags_style: [PLUGIN_ASSET_TAG], source_file_url: `${storageOrigin}/storage/v1/object/public/materials/uploads/plugins/old/package.zip` }];
    await assert.rejects(loadSoftwarePlugins(), /公开链接.*迁移到私有存储/);
    assert.equal(state.buckets.length, 0);
});

test('publication reports actual phases and skips the cover phase when no cover was selected', async () => {
    const stages = [];
    await publishSoftwarePlugin(await input(), stage => stages.push(stage));
    assert.deepEqual(stages, ['checking', 'package', 'publishing']);
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    const withCover = [];
    await publishSoftwarePlugin(await input({ coverFile }), stage => withCover.push(stage));
    assert.deepEqual(withCover, ['checking', 'package', 'cover', 'publishing']);
});

test('a missing private bucket gives setup instructions and never falls back to public storage', async () => {
    state.uploadErrorAt = 1; state.uploadError = { message: 'Bucket not found', statusCode: '404' };
    const stages = [];
    await assert.rejects(publishSoftwarePlugin(await input(), stage => stages.push(stage)), /私有安装包存储尚未配置.*plugin-packages.*迁移 SQL/);
    assert.deepEqual(stages, ['checking', 'package']);
    assert.equal(state.uploads.length, 1); assert.equal(state.inserts.length, 0); assert.equal(state.removals.length, 0);
    assert.ok(state.buckets.every(bucket => bucket === PLUGIN_PACKAGE_BUCKET)); assert.equal(state.publicUrlCalls.length, 0);
});

test('private upload and asset RLS failures explain the specific denied permission', async () => {
    state.uploadErrorAt = 1; state.uploadError = { message: 'new row violates row-level security policy', statusCode: '403' };
    await assert.rejects(publishSoftwarePlugin(await input()), /私有安装包上传权限被拒绝.*plugin-packages/);
    assert.equal(state.inserts.length, 0);
    state.uploadErrorAt = -1; state.insertError = { message: 'permission denied for table assets', code: '42501' };
    await assert.rejects(publishSoftwarePlugin(await input()), /插件介绍保存权限被拒绝.*assets.*RLS/);
    assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 1);
});

test('a missing cover bucket preserves its explanation while cleaning only the successful private upload', async () => {
    state.uploadErrorAt = 2; state.uploadError = { message: 'Bucket not found', statusCode: '404' };
    state.cleanupError = new Error('Cleanup denied');
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile })), /封面存储尚未配置.*materials.*清理失败/);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] }]);
    assert.equal(state.inserts.length, 0);
});

test('storage object size and ZIP or binary MIME restrictions are explained in Chinese', async () => {
    state.uploadErrorAt = 1; state.uploadError = { message: 'The object exceeded the maximum allowed size', status: 413 };
    await assert.rejects(publishSoftwarePlugin(await input()), /安装包.*大小限制.*32 MB.*200 MB/);
    state.uploadErrorAt = 2; state.uploadError = { message: 'mime type application/zip is not supported', status: 400 };
    await assert.rejects(publishSoftwarePlugin(await input()), /未允许 ZIP.*MIME/);
    assert.equal(state.inserts.length, 0); assert.equal(state.publicUrlCalls.length, 0);
});

test('a thrown account network error is visible before any persistent write', async () => {
    state.authThrow = new Error('Network request failed');
    const stages = [];
    await assert.rejects(publishSoftwarePlugin(await input(), stage => stages.push(stage)), /暂时无法连接账号服务/);
    assert.deepEqual(stages, ['checking']); noWrites();
});

test('the cancellable catalog query reports timeout and permission failures without exposing storage', async () => {
    state.readError = { message: 'TimeoutError: signal timed out', code: '' };
    await assert.rejects(loadSoftwarePlugins(), /加载插件目录超时/);
    assert.ok(state.queries[0].signal instanceof AbortSignal);
    state.readError = { message: 'permission denied for table assets', code: '42501' };
    await assert.rejects(loadSoftwarePlugins(), /assets.*读取权限/);
    assert.equal(state.buckets.length, 0);
});

test('publication readiness checks administrator, actual private bucket configuration and a cancellable object list without writes', async () => {
    await checkPluginPublicationStorage();
    assert.equal(state.authCalls, 1); assert.deepEqual(state.bucketReads, [PLUGIN_PACKAGE_BUCKET]);
    assert.equal(state.storageLists.length, 1);
    const { bucket, path, options, parameters } = state.storageLists[0];
    assert.equal(bucket, PLUGIN_PACKAGE_BUCKET); assert.equal(path, ''); assert.deepEqual(options, { limit: 1 });
    assert.ok(parameters.signal instanceof AbortSignal); assert.equal(parameters.signal.aborted, false);
    noWrites(); assert.equal(state.publicUrlCalls.length, 0);
});

test('readiness reports a missing bucket or denied bucket configuration access before listing or uploading', async () => {
    state.bucketError = { message: 'Bucket not found', statusCode: '404' };
    await assert.rejects(checkPluginPublicationStorage(), /私有安装包存储尚未就绪.*plugin-packages.*可能未创建.*无权读取配置.*迁移 SQL/);
    assert.equal(state.storageLists.length, 0); noWrites();
    state.bucketError = { message: 'Access denied', statusCode: '403' };
    await assert.rejects(checkPluginPublicationStorage(), /存储检查权限被拒绝.*迁移 SQL.*读取权限/);
    assert.equal(state.storageLists.length, 0); noWrites();
});

test('anonymous and non-administrator users cannot perform even the bucket readiness check', async () => {
    for (const user of [null, { email: 'viewer@example.test' }]) {
        state.user = user;
        await assert.rejects(checkPluginPublicationStorage(), /只有管理员/);
    }
    assert.equal(state.bucketReads.length, 0); assert.equal(state.buckets.length, 0); noWrites();
});

test('readiness rejects a public bucket, insufficient package capacity and MIME restrictions', async () => {
    const configured = { ...state.bucketDefinition };
    state.bucketDefinition = { ...configured, public: true };
    await assert.rejects(checkPluginPublicationStorage(), /必须是私有存储桶/);
    state.bucketDefinition = { ...configured, file_size_limit: 10 * 1024 * 1024 };
    await assert.rejects(checkPluginPublicationStorage(), /大小限额低于 32 MB/);
    state.bucketDefinition = { ...configured, allowed_mime_types: ['image/png'] };
    await assert.rejects(checkPluginPublicationStorage(), /未允许 ZIP.*MIME/);
    assert.equal(state.storageLists.length, 0); noWrites();
});

test('object list permission and cancellation failures are explained before publication', async () => {
    state.listError = { message: 'Access denied', status: 403 };
    await assert.rejects(checkPluginPublicationStorage(), /存储检查权限被拒绝.*对象读取权限/);
    state.listError = new DOMException('signal timed out', 'TimeoutError');
    await assert.rejects(checkPluginPublicationStorage(), /上传服务检查超时/);
    noWrites(); assert.equal(state.publicUrlCalls.length, 0);
});

test('an account read deadline rejects publication and a late account reply cannot start an upload', async t => {
    const publication = await input();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let finishRead;
    state.authPending = new Promise(resolve => { finishRead = resolve; });
    const pendingPublication = publishSoftwarePlugin(publication);
    t.mock.timers.tick(15_000);
    await assert.rejects(pendingPublication, /账号验证超时/);
    finishRead({ data: { user: { email: PLUGIN_ADMIN_EMAIL } }, error: null });
    await Promise.resolve(); await Promise.resolve();
    noWrites(); assert.equal(state.bucketReads.length, 0);
});

test('a ZIP with an empty browser MIME uploads identical bytes with the permitted multipart MIME', async () => {
    const original = (await input()).packageFile;
    const packageFile = new File([original], original.name, { type: '' });
    await publishSoftwarePlugin(await input({ packageFile }));
    assert.equal(state.uploads[0].file.type, 'application/zip');
    assert.deepEqual(new Uint8Array(await state.uploads[0].file.arrayBuffer()), new Uint8Array(await packageFile.arrayBuffer()));
    assert.equal(JSON.parse(state.inserts[0].record.description).packageName, original.name);
    assert.equal(state.uploads[0].bucket, PLUGIN_PACKAGE_BUCKET); assert.equal(state.publicUrlCalls.length, 0);
});

test('a package above 32 MB uploads sequential private binary chunks with exact whole and per-chunk SHA-256', async () => {
    const packageFile = packageFixture(PLUGIN_PACKAGE_CHUNK_BYTES + 257);
    const progress = [], stages = [];
    await publishSoftwarePlugin(await input({ packageFile }), stage => stages.push(stage), value => progress.push(value));
    assert.deepEqual(stages, ['checking', 'package', 'publishing']);
    assert.deepEqual(progress, [{ completed: 0, total: 2 }, { completed: 1, total: 2 }, { completed: 2, total: 2 }]);
    assert.equal(state.uploads.length, 2); assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 0);
    const [first, last] = state.uploads;
    assert.equal(first.bucket, PLUGIN_PACKAGE_BUCKET); assert.equal(last.bucket, PLUGIN_PACKAGE_BUCKET);
    assert.match(first.path, /^[\da-f-]{36}\/part-000\.bin$/); assert.equal(last.path, first.path.replace('part-000', 'part-001'));
    assert.deepEqual(state.uploads.map(upload => upload.file.size), [PLUGIN_PACKAGE_CHUNK_BYTES, 257]);
    for (const upload of state.uploads) {
        assert.equal(upload.file.type, 'application/octet-stream');
        assert.deepEqual(upload.settings, { contentType: 'application/octet-stream', upsert: false });
    }
    const metadata = JSON.parse(state.inserts[0].record.description);
    assert.equal(metadata.schema, 'fesilent-plugin-v2'); assert.equal(metadata.packageBytes, packageFile.size); assert.equal(metadata.packageName, packageFile.name);
    const original = new Uint8Array(await packageFile.arrayBuffer());
    assert.equal(metadata.packageSha256, expectedHash(original));
    const reconstructed = new Uint8Array(packageFile.size); let offset = 0;
    for (const [index, upload] of state.uploads.entries()) {
        const chunk = new Uint8Array(await upload.file.arrayBuffer());
        assert.deepEqual(metadata.packageChunks[index], { bytes: chunk.byteLength, sha256: expectedHash(chunk) });
        reconstructed.set(chunk, offset); offset += chunk.byteLength;
    }
    assert.deepEqual(reconstructed, original);
    assert.equal(state.inserts[0].record.source_file_url, `storage://${PLUGIN_PACKAGE_BUCKET}/${first.path.split('/')[0]}/package.parts`);
    assert.equal(state.publicUrlCalls.length, 0);
});

test('exactly 32 MB retains a single ZIP object and v1 metadata', async () => {
    const packageFile = packageFixture(PLUGIN_PACKAGE_CHUNK_BYTES), progress = [];
    await publishSoftwarePlugin(await input({ packageFile }), undefined, value => progress.push(value));
    assert.equal(state.uploads.length, 1); assert.equal(state.uploads[0].file.size, PLUGIN_PACKAGE_CHUNK_BYTES);
    assert.equal(state.uploads[0].file.type, 'application/zip'); assert.match(state.uploads[0].path, /\/package\.zip$/);
    assert.equal(JSON.parse(state.inserts[0].record.description).schema, 'fesilent-plugin-v1');
    assert.deepEqual(progress, [{ completed: 0, total: 1 }, { completed: 1, total: 1 }]);
});

test('a later chunk failure removes all and only successful chunks and cannot publish metadata', async () => {
    const packageFile = packageFixture(2 * PLUGIN_PACKAGE_CHUNK_BYTES + 257), progress = [];
    state.uploadErrorAt = 3;
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile }), undefined, value => progress.push(value)), error => error.cause === state.uploadError && /安装包上传失败.*第 3\/3 个分片/.test(error.message));
    assert.equal(state.uploads.length, 3); assert.equal(state.inserts.length, 0);
    assert.deepEqual(state.removals, [{ bucket: PLUGIN_PACKAGE_BUCKET, paths: state.uploads.slice(0, 2).map(upload => upload.path) }]);
    assert.deepEqual(progress, [{ completed: 0, total: 3 }, { completed: 1, total: 3 }, { completed: 2, total: 3 }]);
    assert.equal(state.publicUrlCalls.length, 0);
});

test('progress waits for actual upload completion and the next chunk cannot start early', async () => {
    const packageFile = packageFixture(PLUGIN_PACKAGE_CHUNK_BYTES + 1), progress = [];
    let finishUpload;
    state.uploadPending = new Promise(resolve => { finishUpload = resolve; });
    const firstUploadStarted = new Promise(resolve => { state.onUpload = resolve; });
    const publication = publishSoftwarePlugin(await input({ packageFile }), undefined, value => progress.push(value));
    await firstUploadStarted;
    assert.equal(state.uploads.length, 1); assert.equal(state.inserts.length, 0);
    assert.deepEqual(progress, [{ completed: 0, total: 2 }]);
    finishUpload();
    await publication;
    assert.deepEqual(progress, [{ completed: 0, total: 2 }, { completed: 1, total: 2 }, { completed: 2, total: 2 }]);
});

test('an inconsistent or unreadable large file is rejected before storage writes', async () => {
    const packageFile = { name: 'tool.zip', size: PLUGIN_PACKAGE_CHUNK_BYTES + 1, slice() { return new Blob([Uint8Array.of(0x50, 0x4b, 3, 4)]); }, async arrayBuffer() { return new ArrayBuffer(4); } };
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile })), /实际大小.*不一致/); noWrites();
    packageFile.arrayBuffer = async () => { throw new Error('Local read failed'); };
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile })), /内容无法读取/); noWrites();
});

test('failed large package metadata persistence cleans every successful chunk and the cover', async () => {
    const packageFile = packageFixture(PLUGIN_PACKAGE_CHUNK_BYTES + 1);
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    state.insertError = databaseRejection();
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile, coverFile })), /插件介绍保存失败/);
    assert.equal(state.uploads.length, 3); assert.equal(state.inserts.length, 1);
    assert.deepEqual(state.removals, [
        { bucket: PLUGIN_PACKAGE_BUCKET, paths: state.uploads.slice(0, 2).map(upload => upload.path) },
        { bucket: 'materials', paths: [state.uploads[2].path] },
    ]);
});

test('a WebCrypto failure gives a Chinese integrity error and cannot begin uploading', async t => {
    t.mock.method(globalThis.crypto.subtle, 'digest', async () => { throw new Error('Digest failed'); });
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile: packageFixture(PLUGIN_PACKAGE_CHUNK_BYTES + 1) })), /安装包 SHA-256 校验失败/);
    noWrites();
});

test('readiness accepts a 32 MB object limit and requires both ZIP and chunk MIME permissions', async () => {
    await checkPluginPublicationStorage();
    assert.equal(state.bucketDefinition.file_size_limit, PLUGIN_PACKAGE_CHUNK_BYTES);
    for (const allowed_mime_types of [['application/zip'], ['application/octet-stream']]) {
        state.bucketDefinition.allowed_mime_types = allowed_mime_types;
        await assert.rejects(checkPluginPublicationStorage(), /ZIP 或二进制分片.*application\/zip.*application\/octet-stream/);
    }
    for (const allowed_mime_types of [['application/*'], ['*/*'], [], null]) {
        state.bucketDefinition.allowed_mime_types = allowed_mime_types;
        await checkPluginPublicationStorage();
    }
    noWrites(); assert.equal(state.publicUrlCalls.length, 0);
});
