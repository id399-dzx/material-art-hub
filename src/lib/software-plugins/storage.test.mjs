import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import JSZip from 'jszip';
import { PLUGIN_ADMIN_EMAIL, PLUGIN_ASSET_TAG, PLUGIN_PACKAGE_BUCKET } from './catalog.ts';

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
            async upload(path, file, settings) { state.uploads.push({ bucket, path, file, settings }); return { error: state.uploadErrorAt === state.uploads.length ? state.uploadError : null }; },
            async list(path, options, parameters) { state.storageLists.push({ bucket, path, options, parameters }); return { data: [], error: state.listError }; },
            getPublicUrl(path) { state.publicUrlCalls.push({ bucket, path }); return { data: { publicUrl: `${storageOrigin}/storage/v1/object/public/${bucket}/${path}` } }; },
            async remove(paths) { state.removals.push({ bucket, paths: [...paths] }); if (state.cleanupThrow) throw state.cleanupThrow; return { error: state.cleanupError }; },
        };
    } },
    from(table) { return {
        async insert(record) { state.inserts.push({ table, record }); return { error: state.insertError }; },
        select(columns) { state.queries.push({ table, columns }); return {
            contains(column, tags) { state.queries.at(-1).filter = { column, tags }; return this; },
            order(column, options) { state.queries.at(-1).order = { column, options }; return this; },
            async abortSignal(signal) { state.queries.at(-1).signal = signal; return { data: state.rows, error: state.readError }; },
        }; },
    }; },
};
globalThis[stubKey] = client;
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/supabase') return { url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("fesilent.software-plugin.storage.test.client")]; export const isSupabaseConnectionError = error => /fetch|network|connection/i.test(error?.message ?? String(error));')}`, shortCircuit: true };
    if (specifier === './catalog' && context.parentURL?.endsWith('/software-plugins/storage.ts')) return nextResolve(new URL('./catalog.ts', context.parentURL).href, context);
    return nextResolve(specifier, context);
} });
const { checkPluginPublicationStorage, loadSoftwarePlugins, publishSoftwarePlugin } = await import('./storage.ts');
const originalCreateImageBitmap = globalThis.createImageBitmap;
const originalStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
after(() => { hooks.deregister(); delete globalThis[stubKey]; if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap; else delete globalThis.createImageBitmap; if (originalStorageUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalStorageUrl; });
beforeEach(() => {
    state = { user: { email: PLUGIN_ADMIN_EMAIL }, authError: null, authCalls: 0, buckets: [], uploads: [], removals: [], inserts: [], publicUrlCalls: [], queries: [], rows: [], readError: null, uploadErrorAt: -1, uploadError: new Error('Storage rejected upload'), insertError: null, cleanupError: null, cleanupThrow: null, bitmapClosed: 0 };
    Object.assign(state, { bucketReads: [], bucketDefinition: { id: PLUGIN_PACKAGE_BUCKET, public: false, file_size_limit: 50 * 1024 * 1024, allowed_mime_types: ['application/zip'] }, bucketError: null, storageLists: [], listError: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = storageOrigin;
    globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() { state.bitmapClosed++; } });
});
async function input(overrides = {}) {
    const zip = new JSZip(); zip.file('README.md', '科研插件使用说明'); zip.file('plugin.py', '# test fixture only');
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { name: '  科研图工具  ', host: 'Blender', summary: '  用于科研图片的插件。  ', version: '1.0.0', features: ['创建图形'], environment: ['Blender 4.x'], installation: ['安装后启用'], outputs: ['可编辑场景'], packageFile: new File([bytes], 'research-tool.zip', { type: 'application/zip' }), ...overrides };
}
const noWrites = () => { assert.equal(state.uploads.length, 0); assert.equal(state.inserts.length, 0); assert.equal(state.removals.length, 0); };

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
    state.authError = new Error('Network connection failed');
    await assert.rejects(publishSoftwarePlugin(await input()), /暂时无法连接账号服务/);
    noWrites();
});

test('renamed non-ZIP content and unsupported extensions are rejected before uploading', async () => {
    const invalid = [new File(['not a ZIP'], 'tool.zip', { type: 'application/zip' }), new File([Uint8Array.of(0x50, 0x4b, 7, 8)], 'tool.zip'), new File([Uint8Array.of(0x50, 0x4b, 3, 4)], 'tool.exe')];
    for (const packageFile of invalid) { await assert.rejects(publishSoftwarePlugin(await input({ packageFile })), /ZIP/); noWrites(); }
});

test('oversized packages and invalid covers fail before persistent writes', async () => {
    const oversizedPackage = { name: 'tool.zip', size: 50 * 1024 * 1024 + 1, slice() { return new Blob([Uint8Array.of(0x50, 0x4b, 3, 4)]); } };
    await assert.rejects(publishSoftwarePlugin(await input({ packageFile: oversizedPackage })), /大小/); noWrites();
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile: new File(['svg'], 'cover.svg', { type: 'image/svg+xml' }) })), /封面/); noWrites();
    globalThis.createImageBitmap = async () => { throw new Error('Invalid image'); };
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile: new File(['bad PNG'], 'cover.png', { type: 'image/png' }) })), /封面无法读取/); noWrites();
});

test('database failure removes exactly the package and cover uploaded in this publication', async () => {
    const failure = new Error('Database insertion failed'); state.insertError = failure;
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
    state.insertError = new Error('Database insertion failed'); state.cleanupError = new Error('Storage cleanup denied');
    await assert.rejects(publishSoftwarePlugin(await input()), /未成功发布.*清理失败/);
    assert.equal(state.inserts.length, 1); assert.equal(state.removals.length, 1);
    assert.deepEqual(state.removals[0], { bucket: PLUGIN_PACKAGE_BUCKET, paths: [state.uploads[0].path] });
});

test('cleanup throwing a network error gives a visible recovery instruction', async () => {
    state.insertError = new Error('Database insertion failed'); state.cleanupThrow = new Error('Network cleanup failed');
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
    state.insertError = new Error('Database insertion failed'); state.cleanupError = new Error('Package cleanup denied');
    const coverFile = new File(['fixture PNG decoded by stub'], 'cover.png', { type: 'image/png' });
    await assert.rejects(publishSoftwarePlugin(await input({ coverFile })), /未成功发布.*清理失败/);
    assert.deepEqual(state.removals, state.uploads.map(({ bucket, path }) => ({ bucket, paths: [path] })));
});

test('anonymous visitors can read catalog metadata without receiving public URLs or storage signatures', async () => {
    state.user = null;
    const publication = await input();
    const id = '37b37a8b-6ad4-40b9-a7e0-7746fb2bc311', packageId = 'ba706e1c-ec1e-44bb-83eb-253671951124';
    state.rows = [{ id, title: publication.name.trim(), description: JSON.stringify({ schema: 'fesilent-plugin-v1', host: publication.host, summary: publication.summary.trim(), version: publication.version, features: publication.features, environment: publication.environment, installation: publication.installation, outputs: publication.outputs, packageName: publication.packageFile.name, packageBytes: publication.packageFile.size }), image_url: '/plugin-placeholder.svg', source_file_url: `storage://${PLUGIN_PACKAGE_BUCKET}/${packageId}/package.zip`, tags_style: [PLUGIN_ASSET_TAG], created_at: '2026-10-04T00:00:00.000Z' }];
    const plugins = await loadSoftwarePlugins();
    assert.equal(plugins[0].downloadUrl, `/api/software-plugins/${id}/download`);
    assert.equal(plugins[0].packagePath, `${packageId}/package.zip`);
    assert.equal(state.authCalls, 0); assert.equal(state.buckets.length, 0); assert.equal(state.publicUrlCalls.length, 0);
    assert.deepEqual(state.queries[0].filter, { column: 'tags_style', tags: [PLUGIN_ASSET_TAG] });
});

test('old public package records are refused with an explicit migration message', async () => {
    state.rows = [{ source_file_url: `${storageOrigin}/storage/v1/object/public/materials/uploads/plugins/old/package.zip` }];
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

test('storage size and ZIP MIME restrictions are explained in Chinese', async () => {
    state.uploadErrorAt = 1; state.uploadError = { message: 'The object exceeded the maximum allowed size', status: 413 };
    await assert.rejects(publishSoftwarePlugin(await input()), /安装包.*大小限制.*50 MB/);
    state.uploadErrorAt = 2; state.uploadError = { message: 'mime type application/zip is not supported', status: 400 };
    await assert.rejects(publishSoftwarePlugin(await input()), /未允许 ZIP.*MIME/);
    assert.equal(state.inserts.length, 0); assert.equal(state.publicUrlCalls.length, 0);
});

test('a thrown account network error is visible before any persistent write', async () => {
    state.authThrow = new Error('Network connection failed');
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
    await assert.rejects(checkPluginPublicationStorage(), /大小限额低于 50 MB/);
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
