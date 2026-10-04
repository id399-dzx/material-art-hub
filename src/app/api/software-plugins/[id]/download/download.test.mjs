import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';

const origin = 'https://plugin-storage.example.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
const assetId = 'b575d2a2-313b-4e07-944f-325273c4254e';
const packageId = '2919c684-dca0-4edc-a85b-f769791cf90f';
const packagePath = `${packageId}/package.zip`;
const marker = '__fesilent_software_plugin_v1__';
const bucket = 'plugin-packages';
const packageName = 'Fesilent-Reverie-科研插件.zip';
const partBytes = 32 * 1024 * 1024;
const stubKey = Symbol.for('fesilent.software-plugin.download.test.client');
let state;
const signedUrl = path => `${origin}/storage/v1/object/sign/${bucket}/${path}?token=fixture-only`;
const client = {
    auth: { async getUser() { state.authCalls++; state.events.push('verify-user'); if (state.authThrow) throw state.authThrow; return { data: { user: state.user }, error: state.authError }; } },
    from(table) {
        state.reads.push({ table }); state.events.push('read-asset');
        return {
            select(fields) {
                state.fields.push(fields);
                const query = {
                    eq(column, value) { state.filters.push({ kind: 'eq', column, value }); return query; },
                    contains(column, value) { state.filters.push({ kind: 'contains', column, value }); return query; },
                    async maybeSingle() { if (state.databaseThrow) throw state.databaseThrow; return { data: state.row, error: state.databaseError }; },
                };
                return query;
            },
        };
    },
    storage: { from(storageBucket) {
        state.buckets.push(storageBucket);
        return { async createSignedUrl(path, seconds, options) {
            state.signs.push({ path, seconds, options }); state.events.push('sign-package');
            if (state.signThrow) throw state.signThrow;
            if (state.signResults) return state.signResults[state.signs.length - 1];
            return { data: state.signData === undefined ? { signedUrl: signedUrl(path) } : state.signData, error: state.signError };
        } };
    } },
};
globalThis[stubKey] = client;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { state.fetches++; throw new Error('The API must never fetch package bytes'); };
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@/utils/supabase/server') return { url: `data:text/javascript,${encodeURIComponent('export async function createClient() { return globalThis[Symbol.for("fesilent.software-plugin.download.test.client")]; }')}`, shortCircuit: true };
    if (specifier === 'next/server') return { url: `data:text/javascript,${encodeURIComponent('export const NextResponse = { json(body, options = {}) { const headers = new Headers(options.headers); headers.set("Content-Type", "application/json"); return new Response(JSON.stringify(body), { ...options, headers }); } };')}`, shortCircuit: true };
    if (specifier === '@/lib/software-plugins/catalog') return nextResolve(new URL('../../../../../lib/software-plugins/catalog.ts', import.meta.url).href, context);
    if (specifier === '@/lib/software-plugins/download') return nextResolve(new URL('../../../../../lib/software-plugins/download.ts', import.meta.url).href, context);
    return nextResolve(specifier, context);
} });
const { GET } = await import('./route.ts');
after(() => { hooks.deregister(); delete globalThis[stubKey]; globalThis.fetch = originalFetch; });
function details(overrides = {}) {
    return { schema: 'fesilent-plugin-v1', host: 'Blender', summary: '科研绘图工具。', version: '1.0.0', features: ['绘图'], environment: ['Blender 4.x'], installation: ['安装后启用'], outputs: ['科研图'], packageName, packageBytes: 1234, ...overrides };
}
function publishedRow(overrides = {}) {
    return { id: assetId, title: '科研插件', description: JSON.stringify(details()), image_url: `${origin}/storage/v1/object/public/materials/uploads/plugins/${packageId}/cover.png`, source_file_url: `storage://${bucket}/${packagePath}`, tags_style: [marker], created_at: '2026-10-04T00:00:00.000Z', ...overrides };
}
function chunkedRow(bytes = 200 * 1024 * 1024) {
    const chunks = Array.from({ length: Math.ceil(bytes / partBytes) }, (_, index) => ({ bytes: Math.min(partBytes, bytes - index * partBytes), sha256: String(index + 1).repeat(64) }));
    return publishedRow({ source_file_url: `storage://${bucket}/${packageId}/package.parts`, description: JSON.stringify(details({ schema: 'fesilent-plugin-v2', packageBytes: bytes, packageSha256: 'a'.repeat(64), packageChunks: chunks })) });
}
beforeEach(() => {
    state = { user: { id: 'registered-viewer' }, authError: null, authThrow: null, authCalls: 0, events: [], reads: [], fields: [], filters: [], paramsReads: 0, buckets: [], signs: [], row: publishedRow(), databaseError: null, databaseThrow: null, signData: undefined, signError: null, signThrow: null, signResults: null, fetches: 0 };
});
async function request(id = assetId) {
    const context = { get params() { state.paramsReads++; return Promise.resolve({ id }); } };
    const response = await GET(new Request(`https://fesilent.com/api/software-plugins/${encodeURIComponent(String(id))}/download`), context);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(state.fetches, 0, 'ZIP payloads must bypass the application server');
    return response;
}
const notSigned = () => { assert.equal(state.signs.length, 0); assert.equal(state.buckets.length, 0); };

test('anonymous downloads return 401 before parsing the id, reading an asset, or signing an object', async () => {
    state.user = null;
    const response = await request();
    assert.equal(response.status, 401); assert.match((await response.json()).error, /登录/);
    assert.equal(state.authCalls, 1); assert.equal(state.paramsReads, 0); assert.equal(state.reads.length, 0); notSigned();
    assert.deepEqual(state.events, ['verify-user']);
});

test('invalid sessions return 401 and an unavailable auth service returns 503 without storage access', async () => {
    state.authError = new Error('Session expired');
    assert.equal((await request()).status, 401);
    state.authError = null; state.authThrow = new Error('Network unavailable');
    assert.equal((await request()).status, 503);
    assert.equal(state.paramsReads, 0); assert.equal(state.reads.length, 0); notSigned();
});

test('malformed identifiers are rejected before querying the database', async () => {
    for (const id of ['', 'not-a-uuid', '../package', `${assetId}/extra`, `${assetId}\n`, 'https://outside.example.test', null]) {
        assert.equal((await request(id)).status, 404);
        assert.equal(state.reads.length, 0); notSigned();
    }
});

test('missing rows and unmarked or corrupt assets are never signed', async () => {
    for (const row of [null, publishedRow({ tags_style: [] }), publishedRow({ tags_style: ['Blender'] }), publishedRow({ description: '{broken JSON' })]) {
        state.row = row; assert.equal((await request()).status, 404); notSigned();
    }
    assert.ok(state.reads.every(read => read.table === 'assets'));
    assert.ok(state.filters.some(filter => filter.kind === 'eq' && filter.column === 'id' && filter.value === assetId));
    assert.ok(state.filters.some(filter => filter.kind === 'contains' && filter.column === 'tags_style' && filter.value.length === 1 && filter.value[0] === marker));
});

test('public, external, traversing, encoded, and wrong-schema package references cannot be signed', async () => {
    for (const source_file_url of [
        `${origin}/storage/v1/object/public/materials/uploads/plugins/${packagePath}`,
        'https://outside.example.test/package.zip', 'javascript:alert(1)', `storage://materials/${packagePath}`,
        `storage://${bucket}/../${packagePath}`, `storage://${bucket}/${packageId}/../package.zip`,
        `storage://${bucket}/${packageId}/package.exe`, `storage://${bucket}/${packageId}/subdir/package.zip`,
        `storage://${bucket}/${packageId}%2Fpackage.zip`, `storage://user@${bucket}/${packagePath}`,
        `storage://${bucket}/${packagePath}?redirect=https://outside.example.test`, `storage://${bucket}/${packageId}/package.parts`, null,
    ]) {
        state.row = publishedRow({ source_file_url }); assert.equal((await request()).status, 404, String(source_file_url)); notSigned();
    }
    const row = chunkedRow(); row.source_file_url = `storage://${bucket}/${packagePath}`;
    state.row = row; assert.equal((await request()).status, 404); notSigned();
});

test('a verified viewer receives a 600-second private manifest for an existing v1 ZIP', async () => {
    const response = await request();
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal(response.headers.get('location'), null); assert.equal(response.headers.get('content-disposition'), null);
    assert.deepEqual(await response.json(), { schema: 'fesilent-plugin-download-v1', packageSchema: 'fesilent-plugin-v1', packageName, packageBytes: 1234, expiresIn: 600, parts: [{ signedUrl: signedUrl(packagePath), bytes: 1234 }] });
    assert.deepEqual(state.signs, [{ path: packagePath, seconds: 600, options: undefined }]);
    assert.deepEqual(state.buckets, [bucket]);
    assert.deepEqual(state.events, ['verify-user', 'read-asset', 'sign-package']);
    assert.deepEqual(state.filters, [{ kind: 'eq', column: 'id', value: assetId }, { kind: 'contains', column: 'tags_style', value: [marker] }]);
});

test('a 200 MiB package signs all seven fixed objects without signing its virtual package path', async () => {
    state.row = chunkedRow();
    const response = await request(); assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.packageSchema, 'fesilent-plugin-v2'); assert.equal(payload.packageBytes, 200 * 1024 * 1024); assert.equal(payload.packageSha256, 'a'.repeat(64));
    assert.equal(payload.parts.length, 7); assert.equal(payload.parts.at(-1).bytes, 8 * 1024 * 1024);
    const expectedPaths = Array.from({ length: 7 }, (_, index) => `${packageId}/part-${String(index).padStart(3, '0')}.bin`);
    assert.deepEqual(state.signs.map(sign => sign.path), expectedPaths);
    assert.ok(state.signs.every(sign => sign.seconds === 600));
    assert.deepEqual(payload.parts.map(part => part.signedUrl), expectedPaths.map(signedUrl));
    assert.deepEqual(payload.parts.map(part => part.sha256), Array.from({ length: 7 }, (_, index) => String(index + 1).repeat(64)));
    assert.ok(JSON.stringify(payload).length < 4096, 'API response size is independent of ZIP size');
});

test('corrupt chunk metadata returns 404 before creating any signatures', async () => {
    const row = chunkedRow(); const metadata = JSON.parse(row.description); metadata.packageChunks[0].bytes--;
    state.row = { ...row, description: JSON.stringify(metadata) };
    assert.equal((await request()).status, 404); notSigned();
});

test('database errors and thrown failures return 503 without signing', async () => {
    state.databaseError = new Error('Database unavailable');
    assert.equal((await request()).status, 503);
    state.databaseError = null; state.databaseThrow = new Error('Database unavailable');
    const response = await request(); assert.equal(response.status, 503); assert.match((await response.json()).error, /读取/); notSigned();
});

test('signing errors, incomplete responses, and thrown failures return 503 with no URL payload', async () => {
    for (const result of [{ data: null, error: new Error('Signing unavailable') }, { data: null, error: null }, { data: {}, error: null }]) {
        state.signData = result.data; state.signError = result.error;
        const response = await request(); assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: '安装包暂时无法下载，请稍后重试。' });
    }
    state.signThrow = new Error('Signing unavailable'); assert.equal((await request()).status, 503);
});

test('only the configured origin and exact signing route for the intended object are exposed', async () => {
    for (const url of [
        'https://outside.example.test/package.zip?token=fixture-only',
        `${origin}/storage/v1/object/public/${bucket}/${packagePath}?token=fixture-only`,
        `${origin}/storage/v1/object/authenticated/${bucket}/${packagePath}?token=fixture-only`,
        `${origin}/storage/v1/object/sign/materials/${packagePath}?token=fixture-only`,
        signedUrl(`${packageId}/part-000.bin`), signedUrl(packagePath).replace('https://', 'https://user@'),
        `${signedUrl(packagePath)}#fragment`, `${signedUrl(packagePath)}&redirect=https://outside.example.test`,
        `${signedUrl(packagePath)}&token=duplicate`, signedUrl(packagePath).replace('?token=fixture-only', ''),
        `${signedUrl(packagePath)}\n`,
    ]) {
        state.signData = { signedUrl: url }; const response = await request(); assert.equal(response.status, 503, url);
        assert.deepEqual(await response.json(), { error: '安装包暂时无法下载，请稍后重试。' });
    }
});

test('a failure in a later part returns no partial manifest or already created signature', async () => {
    state.row = chunkedRow(60 * 1024 * 1024);
    state.signResults = [{ data: { signedUrl: signedUrl(`${packageId}/part-000.bin`) }, error: null }, { data: null, error: new Error('Signing unavailable') }];
    const response = await request(); assert.equal(response.status, 503); assert.equal(state.signs.length, 2);
    assert.deepEqual(await response.json(), { error: '安装包暂时无法下载，请稍后重试。' });
});
