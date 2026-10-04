import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';

const origin = 'https://plugin-storage.example.test';
// This test worker uses a non-secret fixture URL rather than the project's configuration.
process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
const assetId = 'b575d2a2-313b-4e07-944f-325273c4254e';
const packageId = '2919c684-dca0-4edc-a85b-f769791cf90f';
const packagePath = `${packageId}/package.zip`;
const marker = '__fesilent_software_plugin_v1__';
const bucket = 'plugin-packages';
const packageName = 'Fesilent-Reverie-科研插件.zip';
const stubKey = Symbol.for('fesilent.software-plugin.download.test.client');
let state;
const client = {
    auth: { async getUser() { state.authCalls++; state.events.push('verify-user'); return { data: { user: state.user }, error: state.authError }; } },
    from(table) {
        state.reads.push({ table }); state.events.push('read-asset');
        return {
            select(fields) {
                state.fields.push(fields);
                const query = {
                    eq(column, value) { state.filters.push({ kind: 'eq', column, value }); return query; },
                    contains(column, value) { state.filters.push({ kind: 'contains', column, value }); return query; },
                    async maybeSingle() { return { data: state.row, error: state.databaseError }; },
                };
                return query;
            },
        };
    },
    storage: { from(storageBucket) {
        state.buckets.push(storageBucket);
        return { async createSignedUrl(path, seconds, options) {
            state.signs.push({ path, seconds, options }); state.events.push('sign-package');
            return { data: state.signData, error: state.signError };
        } };
    } },
};
globalThis[stubKey] = client;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    state.fetches.push({ url: String(url), options });
    if (state.fetchError) throw state.fetchError;
    return new Response(state.upstreamBody, { status: state.upstreamStatus, headers: { 'Content-Type': 'application/zip' } });
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@/utils/supabase/server') return { url: `data:text/javascript,${encodeURIComponent('export async function createClient() { return globalThis[Symbol.for("fesilent.software-plugin.download.test.client")]; }')}`, shortCircuit: true };
    if (specifier === 'next/server') return { url: `data:text/javascript,${encodeURIComponent('export const NextResponse = { json(body, options = {}) { const headers = new Headers(options.headers); headers.set("Content-Type", "application/json"); return new Response(JSON.stringify(body), { ...options, headers }); } };')}`, shortCircuit: true };
    if (specifier === '@/lib/software-plugins/catalog') return nextResolve(new URL('../../../../../lib/software-plugins/catalog.ts', import.meta.url).href, context);
    return nextResolve(specifier, context);
} });
const { GET } = await import('./route.ts');
after(() => { hooks.deregister(); delete globalThis[stubKey]; globalThis.fetch = originalFetch; });
function publishedRow(overrides = {}) {
    return { id: assetId, title: '科研插件', description: JSON.stringify({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '科研绘图工具。', version: '1.0.0', features: ['绘图'], environment: ['Blender 4.x'], installation: ['安装后启用'], outputs: ['科研图'], packageName, packageBytes: 1234 }), image_url: `${origin}/storage/v1/object/public/materials/uploads/plugins/${packageId}/cover.png`, source_file_url: `storage://${bucket}/${packagePath}`, tags_style: [marker], created_at: '2026-10-04T00:00:00.000Z', ...overrides };
}
beforeEach(() => {
    state = { user: { id: 'registered-viewer' }, authError: null, authCalls: 0, events: [], reads: [], fields: [], filters: [], paramsReads: 0, buckets: [], signs: [], row: publishedRow(), databaseError: null, signData: { signedUrl: `${origin}/storage/v1/object/sign/${bucket}/${packagePath}?token=fixture-only` }, signError: null, fetches: [], fetchError: null, upstreamBody: Uint8Array.of(80, 75, 3, 4, 1, 2, 3, 4), upstreamStatus: 200 };
});
async function request(id = assetId) {
    const context = { get params() { state.paramsReads++; return Promise.resolve({ id }); } };
    const req = new Request(`https://fesilent.com/api/software-plugins/${encodeURIComponent(String(id))}/download`); state.requestSignal = req.signal;
    const response = await GET(req, context);
    assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
    return response;
}
const notSigned = () => { assert.equal(state.signs.length, 0); assert.equal(state.buckets.length, 0); assert.equal(state.fetches.length, 0); };

test('anonymous downloads return 401 before reading an asset, parsing its id, or signing any object', async () => {
    state.user = null;
    const response = await request();
    assert.equal(response.status, 401); assert.match((await response.json()).error, /登录/);
    assert.equal(state.authCalls, 1); assert.equal(state.paramsReads, 0); assert.equal(state.reads.length, 0); notSigned();
    assert.deepEqual(state.events, ['verify-user']);
});

test('an invalid session never accesses the asset table or signs a package', async () => {
    state.authError = new Error('Session expired');
    const response = await request(); assert.equal(response.status, 401);
    assert.equal(state.reads.length, 0); notSigned();
});

test('signed-in users receive 404 for malformed identifiers without querying the database', async () => {
    for (const id of ['', 'not-a-uuid', '../package', `${assetId}/extra`, 'https://outside.example.test']) {
        assert.equal((await request(id)).status, 404);
        assert.equal(state.reads.length, 0); notSigned();
    }
});

test('missing rows and ordinary artwork cannot be used as plugin download records', async () => {
    for (const row of [null, publishedRow({ tags_style: [] }), publishedRow({ tags_style: ['Blender'] }), publishedRow({ description: '{broken JSON' })]) {
        state.row = row;
        const response = await request(); assert.equal(response.status, 404); notSigned();
    }
    assert.ok(state.reads.every(read => read.table === 'assets'));
    assert.ok(state.filters.some(filter => filter.kind === 'eq' && filter.column === 'id' && filter.value === assetId));
    assert.ok(state.filters.some(filter => filter.kind === 'contains' && filter.column === 'tags_style' && filter.value.length === 1 && filter.value[0] === marker));
});

test('a marked row with a public URL, external URL, or disallowed private path is never signed', async () => {
    const references = [
        `${origin}/storage/v1/object/public/materials/uploads/plugins/${packagePath}`,
        'https://outside.example.test/package.zip',
        'javascript:alert(1)',
        `storage://materials/${packagePath}`,
        `storage://plugin-packages/../${packagePath}`,
        `storage://plugin-packages/${packageId}/../package.zip`,
        `storage://plugin-packages/${packageId}/package.exe`,
        `storage://plugin-packages/${packageId}/subdir/package.zip`,
        `storage://plugin-packages/${packageId}%2Fpackage.zip`,
        `storage://user@plugin-packages/${packagePath}`,
        `storage://plugin-packages/${packagePath}?redirect=https://outside.example.test`,
        null,
    ];
    for (const source_file_url of references) {
        state.row = publishedRow({ source_file_url });
        assert.equal((await request()).status, 404, String(source_file_url)); notSigned();
    }
});

test('a verified viewer receives ZIP bytes while the 60-second private signature stays on the server', async () => {
    const response = await request();
    assert.equal(response.status, 200); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), state.upstreamBody);
    assert.deepEqual(state.buckets, [bucket]); assert.deepEqual(state.signs, [{ path: packagePath, seconds: 60, options: { download: packageName } }]);
    assert.deepEqual(state.events, ['verify-user', 'read-asset', 'sign-package']);
    assert.deepEqual(state.filters, [{ kind: 'eq', column: 'id', value: assetId }, { kind: 'contains', column: 'tags_style', value: [marker] }]);
    assert.match(response.headers.get('cache-control'), /private/);
    assert.equal(response.headers.get('content-type'), 'application/zip'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('location'), null);
    assert.match(response.headers.get('content-disposition'), /^attachment;/);
    assert.ok(response.headers.get('content-disposition').includes(`filename*=UTF-8''${encodeURIComponent(packageName)}`));
    assert.ok(![...response.headers.values()].some(value => value.includes('fixture-only') || value.includes('/object/sign/')));
    assert.equal(state.fetches.length, 1); assert.equal(state.fetches[0].url, state.signData.signedUrl);
    assert.equal(state.fetches[0].options.cache, 'no-store'); assert.equal(state.fetches[0].options.redirect, 'error'); assert.equal(state.fetches[0].options.signal, state.requestSignal);
});

test('database errors return 503 without creating a download signature', async () => {
    state.databaseError = new Error('Database unavailable');
    const response = await request(); assert.equal(response.status, 503); assert.match((await response.json()).error, /读取/); notSigned();
});

test('signing errors and incomplete signing responses return 503 instead of exposing a fallback URL', async () => {
    for (const result of [{ data: null, error: new Error('Signing unavailable') }, { data: null, error: null }, { data: {}, error: null }]) {
        state.signData = result.data; state.signError = result.error;
        const response = await request(); assert.equal(response.status, 503);
        const body = await response.json(); assert.match(body.error, /无法下载/); assert.equal(Object.hasOwn(body, 'url'), false);
    }
    assert.ok(state.buckets.every(value => value === bucket));
    assert.ok(state.signs.every(sign => sign.path === packagePath && sign.seconds === 60));
    assert.equal(state.fetches.length, 0);
});

test('a signing result pointing outside this Supabase origin is never fetched or redirected', async () => {
    state.signData = { signedUrl: 'https://outside.example.test/package.zip?token=fixture-only' };
    const response = await request(); assert.equal(response.status, 503); assert.equal(state.fetches.length, 0); assert.equal(response.headers.get('location'), null);
    const body = await response.json(); assert.equal(Object.hasOwn(body, 'url'), false); assert.match(body.error, /无法下载/);
});

test('upstream errors and empty response bodies return 503 without exposing the signed URL', async () => {
    for (const { status, body } of [{ status: 503, body: 'Unavailable' }, { status: 200, body: null }]) {
        state.upstreamStatus = status; state.upstreamBody = body;
        const response = await request(); assert.equal(response.status, 503);
        const payload = await response.json(); assert.equal(Object.hasOwn(payload, 'url'), false); assert.match(payload.error, /无法下载/);
    }
    assert.equal(state.fetches.length, 2);
});

test('network failures during private object streaming return a non-cacheable 503 response', async () => {
    state.fetchError = new Error('Network unavailable');
    const response = await request(); assert.equal(response.status, 503); assert.equal(state.fetches.length, 1);
    assert.equal(response.headers.get('location'), null); assert.match((await response.json()).error, /无法下载/);
});
