import assert from 'node:assert/strict';
import test from 'node:test';
import { applyContentMutation } from './mutations.ts';
import { PLUGIN_ASSET_TAG } from '../software-plugins/catalog.ts';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
const version = '2026-10-06T01:02:03.123456+00:00';
const details = { schema: 'fesilent-plugin-v1', host: 'PowerPoint', summary: '原介绍', version: '0.2.1', features: ['原功能'], environment: ['Windows'], installation: ['安装'], outputs: ['PPTX'], packageName: 'plugin.zip', packageBytes: 1024 };
const row = { id: 'cdd2356c-7d87-4959-8261-e4059e664ac4', title: '插件', description: JSON.stringify(details), hidden: false, updated_at: version, created_at: version, image_url: '/plugin-placeholder.svg', source_file_url: 'storage://plugin-packages/ba706e1c-ec1e-44bb-83eb-253671951124/package.zip', tags_style: [PLUGIN_ASSET_TAG] };
function fixture(current, write = { data: [{ ...row, updated_at: '2026-10-06T01:02:04Z' }], error: null }) {
    const calls = { updates: [], filters: [], rpcs: [] };
    const client = {
        from(table) { return {
            select() { return { eq() { return this; }, async maybeSingle() { return { data: current, error: null }; } }; },
            update(changes) { calls.updates.push({ table, changes }); return {
                eq(key, value) { calls.filters.push({ key, value }); return this; },
                is(key, value) { calls.filters.push({ key, value }); return this; },
                async select() { return write; },
            }; },
        }; },
        async rpc(name, args) { calls.rpcs.push({ name, args }); return write; },
    };
    return { client, calls };
}
const mutation = (action, patch = {}) => ({ section: 'plugins', itemId: row.id, action, patch, expectedVersion: version, expected: { title: row.title, description: row.description, hidden: row.hidden } });
test('plugin text editing preserves package metadata and references without uploads', async () => {
    const { client, calls } = fixture(row);
    await applyContentMutation(client, mutation('edit', { summary: '新介绍', features: ['新功能'] }));
    assert.equal(calls.updates.length, 1);
    assert.deepEqual(Object.keys(calls.updates[0].changes).sort(), ['description', 'hidden']);
    const saved = JSON.parse(calls.updates[0].changes.description);
    assert.deepEqual(saved, { ...details, summary: '新介绍', features: ['新功能'] });
    assert.ok(calls.filters.some(item => item.key === 'updated_at' && item.value === version));
});
test('removing a plugin only changes recoverable hidden state', async () => {
    const { client, calls } = fixture(row);
    await applyContentMutation(client, mutation('hide'));
    assert.deepEqual(calls.updates[0].changes, { hidden: true });
});
test('a stale asset snapshot cannot write', async () => {
    const { client, calls } = fixture({ ...row, updated_at: '2026-10-06T02:00:00Z' });
    await assert.rejects(applyContentMutation(client, mutation('edit', { title: '修改' })), error => error.status === 409);
    assert.equal(calls.updates.length, 0);
});
test('a conflict after the read still returns409 and does not delete files', async () => {
    const { client } = fixture(row, { data: [], error: null });
    await assert.rejects(applyContentMutation(client, mutation('hide')), error => error.status === 409);
});
test('an uncertain database result fails without cleanup or a second write', async () => {
    const { client, calls } = fixture(row, { data: null, error: { message: 'Network disconnected', status: 0 } });
    await assert.rejects(applyContentMutation(client, mutation('hide')), error => error.status === 503);
    assert.equal(calls.updates.length, 1);
});
test('a plugin cannot be edited as a material', async () => {
    const { client, calls } = fixture(row);
    await assert.rejects(applyContentMutation(client, { ...mutation('edit'), section: 'assets' }), error => error.status === 400);
    assert.equal(calls.updates.length, 0);
});
test('static journal edits merge settings and use the atomic version RPC', async () => {
    const current = { section: 'journals', item_id: 'nature', patch: { summary: '介绍', options: { font: 'Arial' } }, hidden: false, updated_at: version };
    const { client, calls } = fixture(current, { data: [{ ...current, updated_at: '2026-10-06T02:00:00Z' }], error: null });
    await applyContentMutation(client, { section: 'journals', itemId: 'nature', action: 'edit', patch: { options: { lineSpacing: 2 } }, expectedVersion: version });
    assert.deepEqual(calls.rpcs, [{ name: 'manage_site_content', args: { p_section: 'journals', p_item_id: 'nature', p_patch: { summary: '介绍', options: { font: 'Arial', lineSpacing: 2 } }, p_hidden: false, p_expected: version, p_reset: false } }]);
});
test('simultaneous initial overrides cannot overwrite each other', async () => {
    const { client } = fixture(null, { data: [], error: null });
    await assert.rejects(applyContentMutation(client, { section: 'templates', itemId: 'example', action: 'hide', patch: {}, expectedVersion: null }), error => error.status === 409);
});
