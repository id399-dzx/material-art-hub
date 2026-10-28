import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { registerHooks } from 'node:module';

const stubKey = Symbol.for('fesilent.public-plugin-catalog.route.test');
const message = '插件目录暂时无法读取，请稍后重试。';
let state;
globalThis[stubKey] = { async load() { state.calls++; if (state.error) throw state.error; return state.plugins; } };
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/software-plugins/public-catalog') return { url: `data:text/javascript,${encodeURIComponent(`export const PUBLIC_PLUGIN_CATALOG_ERROR = ${JSON.stringify(message)}; export async function loadPublicSoftwarePlugins() { return globalThis[Symbol.for("fesilent.public-plugin-catalog.route.test")].load(); }`)}`, shortCircuit: true };
  if (specifier === 'next/server') return { url: `data:text/javascript,${encodeURIComponent('export const NextResponse = { json(body, options = {}) { const headers = new Headers(options.headers); headers.set("Content-Type", "application/json"); return new Response(JSON.stringify(body), { ...options, headers }); } };')}`, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { GET, dynamic } = await import('./route.ts');
beforeEach(() => { state = { calls: 0, plugins: [{ id: 'fixture', name: '科研插件' }], error: null }; });
after(() => { hooks.deregister(); delete globalThis[stubKey]; });

test('public GET returns validated metadata without relying on an incoming session or cached results', async () => {
  const response = await GET();
  assert.equal(dynamic, 'force-dynamic'); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { plugins: state.plugins });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(state.calls, 1);
});

test('upstream failures return a sanitized 503 rather than an empty successful catalog', async () => {
  state.error = new Error('private key and upstream diagnostic');
  const response = await GET();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: message });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
