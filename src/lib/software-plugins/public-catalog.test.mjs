import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';

const origin = 'https://public-plugin-catalog.example.test';
const publicKey = 'public-anon-fixture';
const assetId = 'b575d2a2-313b-4e07-944f-325273c4254e';
const packageId = '2919c684-dca0-4edc-a85b-f769791cf90f';
const marker = '__fesilent_software_plugin_v1__';
const stubKey = Symbol.for('fesilent.public-plugin-catalog.test');
const originalEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
const originalFetch = globalThis.fetch;
let state;

const fixture = (changes = {}) => ({
  id: assetId, title: '科研插件', tags_style: [marker], created_at: '2026-10-01T00:00:00.000Z',
  image_url: `${origin}/storage/v1/object/public/materials/uploads/plugins/${packageId}/cover.png`,
  source_file_url: `storage://plugin-packages/${packageId}/package.zip`,
  description: JSON.stringify({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '科研绘图工具', version: '1.0',
    features: ['建模'], environment: ['Blender'], installation: ['安装后启用'], outputs: ['模型'], packageName: 'plugin.zip', packageBytes: 1234 }),
  ...changes,
});
const client = {
  from(table) {
    state.tables.push(table);
    const query = {
      select(fields) { state.fields.push(fields); return query; },
      eq(column, value) { state.filters.push({ kind: 'eq', column, value }); return query; },
      contains(column, value) { state.filters.push({ kind: 'contains', column, value }); return query; },
      order(column, options) { state.orders.push({ column, options }); return query; },
      async abortSignal(signal) {
        state.signals.push(signal);
        if (state.throwError) throw state.throwError;
        return { data: state.rows, error: state.error };
      },
    };
    return query;
  },
};
globalThis[stubKey] = {
  createClient(...args) { state.clients.push(args); return client; },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@supabase/supabase-js') return { url: `data:text/javascript,${encodeURIComponent('export function createClient(...args) { return globalThis[Symbol.for("fesilent.public-plugin-catalog.test")].createClient(...args); }')}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { loadPublicSoftwarePlugins, PUBLIC_PLUGIN_CATALOG_ERROR } = await import('./public-catalog.ts');

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = publicKey;
  state = { clients: [], tables: [], fields: [], filters: [], orders: [], signals: [], rows: [fixture()], error: null, throwError: null };
});
after(() => {
  hooks.deregister(); delete globalThis[stubKey]; globalThis.fetch = originalFetch;
  for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_URL', originalEnv.url], ['NEXT_PUBLIC_SUPABASE_ANON_KEY', originalEnv.key]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test('catalog creates a fresh anonymous client without session persistence and queries only visible tagged assets', async () => {
  const plugins = await loadPublicSoftwarePlugins();
  assert.equal(plugins.length, 1); assert.equal(plugins[0].id, assetId);
  assert.equal(plugins[0].downloadUrl, `/api/software-plugins/${assetId}/download`);
  assert.ok(!JSON.stringify(plugins).includes('signedUrl'));
  assert.deepEqual(state.clients[0].slice(0, 2), [origin, publicKey]);
  assert.deepEqual(state.clients[0][2].auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  assert.deepEqual(state.tables, ['assets']);
  assert.deepEqual(state.fields, ['id,title,description,image_url,source_file_url,tags_style,created_at']);
  assert.deepEqual(state.filters, [{ kind: 'eq', column: 'hidden', value: false }, { kind: 'contains', column: 'tags_style', value: [marker] }]);
  assert.deepEqual(state.orders, [{ column: 'created_at', options: { ascending: false } }]);
  assert.ok(state.signals[0] instanceof AbortSignal); assert.equal(state.signals[0].aborted, false);
  await loadPublicSoftwarePlugins();
  assert.equal(state.clients.length, 2, 'requests never reuse a personalized client');
});

test('the SDK fetch preserves request parameters while disabling upstream caching', async () => {
  await loadPublicSoftwarePlugins();
  const seen = [];
  globalThis.fetch = async (...args) => { seen.push(args); return new Response('[]'); };
  const controller = new AbortController();
  await state.clients[0][2].global.fetch(`${origin}/rest/v1/assets`, { headers: { apikey: publicKey }, signal: controller.signal, cache: 'force-cache' });
  assert.equal(seen[0][1].cache, 'no-store');
  assert.deepEqual(seen[0][1].headers, { apikey: publicKey });
  assert.equal(seen[0][1].signal, controller.signal);
});

test('empty published catalog is valid, but malformed or missing upstream data never masquerades as an empty list', async () => {
  state.rows = []; assert.deepEqual(await loadPublicSoftwarePlugins(), []);
  for (const rows of [null, undefined, {}, 'invalid']) {
    state.rows = rows;
    await assert.rejects(loadPublicSoftwarePlugins(), error => error.message === PUBLIC_PLUGIN_CATALOG_ERROR);
  }
});

test('public package URLs and corrupt metadata fail the entire catalog without exposing a partial list', async () => {
  for (const invalid of [
    fixture({ source_file_url: 'https://public.example.test/plugin.zip' }),
    fixture({ source_file_url: null }), fixture({ description: '{bad JSON' }),
    fixture({ tags_style: [] }), fixture({ id: 'invalid-id' }),
  ]) {
    state.rows = [fixture(), invalid];
    await assert.rejects(loadPublicSoftwarePlugins(), error => error.message === PUBLIC_PLUGIN_CATALOG_ERROR);
  }
});

test('database, denied access, network and timeout errors expose only a generic catalog failure', async () => {
  for (const error of [new Error('private database diagnostic'), { code: '42501', message: 'private RLS diagnostic' }]) {
    state.error = error;
    await assert.rejects(loadPublicSoftwarePlugins(), error => error.message === PUBLIC_PLUGIN_CATALOG_ERROR && error.cause === undefined);
  }
  state.error = null;
  for (const error of [new TypeError('Failed to fetch secret host'), new DOMException('Request aborted', 'TimeoutError')]) {
    state.throwError = error;
    await assert.rejects(loadPublicSoftwarePlugins(), error => error.message === PUBLIC_PLUGIN_CATALOG_ERROR);
  }
});

test('missing public configuration fails before opening a client', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  await assert.rejects(loadPublicSoftwarePlugins(), error => error.message === PUBLIC_PLUGIN_CATALOG_ERROR);
  assert.equal(state.clients.length, 0);
});
