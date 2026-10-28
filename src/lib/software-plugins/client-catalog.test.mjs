import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPluginCatalog } from './client-catalog.ts';

const id = 'b575d2a2-313b-4e07-944f-325273c4254e';
const plugin = {
  schema: 'fesilent-plugin-v1', host: 'Blender', summary: '科研工具', version: '1.0.0',
  features: ['绘图'], environment: ['Blender 4.x'], installation: ['启用插件'], outputs: ['科研图'],
  packageName: 'plugin.zip', packageBytes: 1024, id, name: '科研插件',
  packagePath: '2919c684-dca0-4edc-a85b-f769791cf90f/package.zip',
  downloadUrl: `/api/software-plugins/${id}/download`, publishedAt: '2026-10-28T00:00:00.000Z',
};

test('catalog metadata loads only through the uncached website API without an external session request', async () => {
  const calls = [];
  const result = await loadPluginCatalog(async (target, options) => {
    calls.push({ target, options });
    return Response.json({ plugins: [plugin] });
  });
  assert.deepEqual(result, [plugin]);
  assert.equal(calls.length, 1); assert.equal(calls[0].target, '/api/software-plugins');
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.credentials, 'same-origin'); assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test('a successfully published empty catalog stays distinguishable from backend failure', async () => {
  assert.deepEqual(await loadPluginCatalog(async () => Response.json({ plugins: [] })), []);
  await assert.rejects(loadPluginCatalog(async () => Response.json({ error: 'internal database detail' }, { status: 503 })), error =>
    /插件目录服务暂时无法读取/.test(error.message) && !/internal|database/.test(error.message));
});

test('timeout and network errors give actionable catalog messages', async () => {
  await assert.rejects(loadPluginCatalog(async () => { throw new DOMException('deadline', 'TimeoutError'); }), /加载插件目录超时/);
  await assert.rejects(loadPluginCatalog(async () => { throw new DOMException('aborted', 'AbortError'); }), /加载插件目录超时/);
  await assert.rejects(loadPluginCatalog(async () => { throw new TypeError('Failed to fetch'); }), /检查网络后重试/);
});

test('non-JSON, missing arrays and malformed entries never masquerade as an empty successful library', async () => {
  for (const payload of [null, {}, { plugins: null }, { plugins: [null] }, { plugins: [{}] }]) {
    await assert.rejects(loadPluginCatalog(async () => Response.json(payload)), /响应格式有误/);
  }
  await assert.rejects(loadPluginCatalog(async () => new Response('<html>hosting error</html>')), /响应格式有误/);
});

test('catalog entries cannot supply an unrelated download target or malformed package metadata', async () => {
  for (const patch of [{ downloadUrl: 'https://unrelated.example/package.zip' }, { packagePath: '../package.zip' }, { id: '../asset' }, { packageBytes: -1 }, { schema: 'unsupported' }]) {
    await assert.rejects(loadPluginCatalog(async () => Response.json({ plugins: [{ ...plugin, ...patch }] })), /响应格式有误/);
  }
});
