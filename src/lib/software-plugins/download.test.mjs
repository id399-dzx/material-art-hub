import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import JSZip from 'jszip';
import { downloadPluginPackage, getValidatedPluginSignedUrl, PluginDownloadLoginRequiredError } from './download.ts';

const origin = 'https://plugin-storage.example.test';
const id = 'b575d2a2-313b-4e07-944f-325273c4254e';
const packageId = '2919c684-dca0-4edc-a85b-f769791cf90f';
const partBytes = 32 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const url = path => `${origin}/storage/v1/object/sign/plugin-packages/${path}?token=fixture-only`;
const smallZip = await new JSZip().file('README.txt', '科研插件及中文说明。').generateAsync({ type: 'uint8array', compression: 'STORE' });
const basicPlugin = bytes => ({ schema: 'fesilent-plugin-v1', host: 'Blender', summary: '科研插件说明。', version: '1.0.0', features: ['绘图'], environment: ['Blender 4.x'], installation: ['启用插件'], outputs: ['科研图'], packageName: '科研插件.zip', packageBytes: bytes.length, id, name: '科研插件', packagePath: `${packageId}/package.zip`, downloadUrl: `/api/software-plugins/${id}/download`, publishedAt: '2026-10-04T00:00:00.000Z' });
function fixture(bytes, chunked = false) {
    const plugin = basicPlugin(bytes);
    let pieces = [bytes];
    if (chunked) {
        pieces = Array.from({ length: Math.ceil(bytes.length / partBytes) }, (_, index) => bytes.subarray(index * partBytes, Math.min(bytes.length, (index + 1) * partBytes)));
        Object.assign(plugin, { schema: 'fesilent-plugin-v2', packagePath: `${packageId}/package.parts`, packageSha256: hash(bytes), packageChunks: pieces.map(piece => ({ bytes: piece.length, sha256: hash(piece) })) });
    }
    const paths = pieces.map((_, index) => chunked ? `${packageId}/part-${String(index).padStart(3, '0')}.bin` : `${packageId}/package.zip`);
    const manifest = { schema: 'fesilent-plugin-download-v1', packageSchema: plugin.schema, packageName: plugin.packageName, packageBytes: plugin.packageBytes, expiresIn: 600, ...(chunked ? { packageSha256: plugin.packageSha256 } : {}), parts: pieces.map((piece, index) => ({ signedUrl: url(paths[index]), bytes: piece.length, ...(chunked ? { sha256: hash(piece) } : {}) })) };
    return { plugin, manifest, pieces, paths };
}
function streamed(bytes, onDone = () => undefined, onCancel = () => undefined) {
    let offset = 0;
    return new Response(new ReadableStream({
        pull(controller) {
            if (offset === bytes.length) { onDone(); controller.close(); return; }
            const end = Math.min(bytes.length, offset + 1024 * 1024);
            controller.enqueue(bytes.subarray(offset, end)); offset = end;
        },
        cancel: onCancel,
    }));
}
function downloader(data, overrides = {}) {
    const calls = [];
    const progress = [];
    const fetch = async (target, options) => {
        calls.push({ target: String(target), options });
        if (String(target) === data.plugin.downloadUrl) return Response.json(overrides.manifest ?? data.manifest, { status: overrides.status ?? 200 });
        const index = data.manifest.parts.findIndex(part => part.signedUrl === String(target));
        assert.ok(index >= 0, 'unexpected storage object');
        if (overrides.partResponse) return overrides.partResponse(index);
        return streamed(overrides.bytes ?? data.pieces[index]);
    };
    return { calls, progress, options: { fetch, storageOrigin: origin, onProgress: update => progress.push(update) } };
}

// Independent digest and ZIP parsing make the large-package test check the
// original artifact rather than only reproducing the helper's metadata logic.
const source = new Uint8Array(60 * 1024 * 1024).fill(0x17);
const sourceHash = hash(source);
const largeZip = await new JSZip().file('plugin-data.bin', source).file('README.txt', '完整安装包。').generateAsync({ type: 'uint8array', compression: 'STORE' });
const large = fixture(largeZip, true);

test('a legacy ZIP is fetched privately, checked, and returned as the original usable ZIP', async () => {
    const data = fixture(smallZip); const runner = downloader(data);
    const blob = await downloadPluginPackage(data.plugin, runner.options);
    assert.equal(blob.type, 'application/zip'); assert.equal(blob.size, smallZip.length);
    const bytes = new Uint8Array(await blob.arrayBuffer()); assert.deepEqual(bytes, smallZip);
    const parsed = await JSZip.loadAsync(bytes); assert.equal(await parsed.file('README.txt').async('string'), '科研插件及中文说明。');
    assert.deepEqual(runner.calls.map(call => call.target), [data.plugin.downloadUrl, url(`${packageId}/package.zip`)]);
    assert.equal(runner.calls[0].options.credentials, 'same-origin'); assert.equal(runner.calls[1].options.credentials, 'omit');
    assert.ok(runner.calls.every(call => call.options.cache === 'no-store' && call.options.redirect === 'error'));
    assert.equal(runner.progress.at(-1).stage, 'ready'); assert.equal(runner.progress.at(-1).downloadedBytes, smallZip.length);
});

test('a ZIP larger than 50 MiB downloads in order and reconstructs the unchanged original package', async () => {
    const calls = []; const progress = []; let consumed = 0;
    const fetch = async (target, options) => {
        calls.push({ target: String(target), options });
        if (String(target) === large.plugin.downloadUrl) return Response.json(large.manifest);
        const index = large.manifest.parts.findIndex(part => part.signedUrl === String(target));
        assert.equal(index, consumed, 'the previous response must finish before the next fetch');
        assert.equal(progress.at(-1).completedParts, index, 'the previous part must verify before the next fetch');
        return streamed(large.pieces[index], () => consumed++);
    };
    const blob = await downloadPluginPackage(large.plugin, { storageOrigin: origin, fetch, onProgress: value => progress.push(value) });
    assert.equal(blob.size, largeZip.length); assert.equal(hash(new Uint8Array(await blob.arrayBuffer())), hash(largeZip));
    assert.deepEqual(calls.slice(1).map(call => call.target), [url(`${packageId}/part-000.bin`), url(`${packageId}/part-001.bin`)]);
    assert.equal(consumed, 2); assert.equal(progress.at(-1).completedParts, 2); assert.equal(progress.at(-1).stage, 'ready');
    assert.ok(progress.some(value => value.stage === 'downloading' && value.downloadedBytes > 0 && value.downloadedBytes < partBytes));
    assert.ok(progress.some(value => value.stage === 'verifying'));
    assert.ok(progress.every((value, index) => index === 0 || value.downloadedBytes >= progress[index - 1].downloadedBytes));
    const parsed = await JSZip.loadAsync(blob.arrayBuffer());
    assert.equal(hash(await parsed.file('plugin-data.bin').async('uint8array')), sourceHash);
    assert.equal(await parsed.file('README.txt').async('string'), '完整安装包。');
});

test('authentication expires before download and no storage object is requested', async () => {
    const data = fixture(smallZip); const runner = downloader(data, { status: 401 });
    await assert.rejects(downloadPluginPackage(data.plugin, runner.options), PluginDownloadLoginRequiredError);
    assert.equal(runner.calls.length, 1); assert.equal(runner.progress.length, 0);
});

test('API errors remain readable and malformed responses never start a storage download', async () => {
    const data = fixture(smallZip);
    for (const result of [{ status: 503, manifest: { error: '安装包暂时无法下载，请稍后重试。' } }, { manifest: null }, { manifest: { ...data.manifest, packageBytes: data.plugin.packageBytes + 1 } }, { manifest: { ...data.manifest, packageName: 'other.zip' } }, { manifest: { ...data.manifest, packageSha256: 'a'.repeat(64) } }, { manifest: { ...data.manifest, parts: [] } }]) {
        const runner = downloader(data, result.manifest === null ? { manifest: false } : result);
        await assert.rejects(downloadPluginPackage(data.plugin, runner.options), /安装包|下载清单/);
        assert.equal(runner.calls.length, 1); assert.equal(runner.progress.length, 0);
    }
});

test('source checks reject other origins, objects, public URLs, credentials, redirects and absent signatures', async () => {
    const data = fixture(smallZip);
    for (const signedUrl of [
        'https://outside.example.test/package.zip?token=fixture-only',
        url(`${packageId}/part-000.bin`),
        url(`${packageId}/package.zip`).replace('/object/sign/', '/object/public/'),
        url(`${packageId}/package.zip`).replace('https://', 'https://user@'),
        `${url(`${packageId}/package.zip`)}&redirect=https://outside.example.test`,
        `${url(`${packageId}/package.zip`)}&token=another`,
        url(`${packageId}/package.zip`).replace('?token=fixture-only', ''),
        `${url(`${packageId}/package.zip`)}#fragment`,
    ]) {
        assert.equal(getValidatedPluginSignedUrl(signedUrl, origin, `${packageId}/package.zip`), null);
        const runner = downloader(data, { manifest: { ...data.manifest, parts: [{ ...data.manifest.parts[0], signedUrl }] } });
        await assert.rejects(downloadPluginPackage(data.plugin, runner.options), /下载地址/);
        assert.equal(runner.calls.length, 1);
    }
});

test('missing, reordered, or changed chunk hashes are rejected before fetching any part', async () => {
    for (const manifest of [
        { ...large.manifest, parts: large.manifest.parts.slice(1) },
        { ...large.manifest, parts: [...large.manifest.parts].reverse() },
        { ...large.manifest, parts: large.manifest.parts.map((part, index) => index ? part : { ...part, sha256: 'b'.repeat(64) }) },
        { ...large.manifest, parts: large.manifest.parts.map((part, index) => index ? part : { ...part, sha256: undefined }) },
        { ...large.manifest, packageSha256: 'b'.repeat(64) },
    ]) {
        const runner = downloader(large, { manifest });
        await assert.rejects(downloadPluginPackage(large.plugin, runner.options), /下载清单|分片信息/);
        assert.equal(runner.calls.length, 1);
    }
});

test('truncated and oversized responses never become a saved artifact and oversized bodies are cancelled', async () => {
    const data = fixture(smallZip);
    const truncated = downloader(data, { bytes: smallZip.subarray(0, smallZip.length - 1) });
    await assert.rejects(downloadPluginPackage(data.plugin, truncated.options), /不完整/);
    assert.ok(truncated.progress.every(value => value.stage !== 'ready'));
    let cancelled = false;
    const oversized = downloader(data, { partResponse: () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(smallZip.length + 1)); }, cancel() { cancelled = true; } })) });
    await assert.rejects(downloadPluginPackage(data.plugin, oversized.options), /大小不符/);
    assert.equal(cancelled, true); assert.ok(oversized.progress.every(value => value.stage !== 'ready'));
});

test('a corrupt first chunk stops the sequence immediately and never reports ready', async () => {
    const broken = new Uint8Array(large.pieces[0]); broken[100] ^= 1;
    const runner = downloader(large, { partResponse: index => streamed(index ? large.pieces[index] : broken) });
    await assert.rejects(downloadPluginPackage(large.plugin, runner.options), /分片校验失败/);
    assert.equal(runner.calls.length, 2, 'second storage object must not be fetched after failed verification');
    assert.ok(runner.progress.every(value => value.stage !== 'ready' && value.completedParts === 0));
});

test('matching chunks cannot hide an incorrect complete package hash', async () => {
    const plugin = { ...large.plugin, packageSha256: 'b'.repeat(64) };
    const data = { ...large, plugin, manifest: { ...large.manifest, packageSha256: plugin.packageSha256 } };
    const runner = downloader(data);
    await assert.rejects(downloadPluginPackage(plugin, runner.options), /完整安装包校验失败/);
    assert.equal(runner.calls.length, 3); assert.ok(runner.progress.every(value => value.stage !== 'ready'));
});

test('legacy downloads require a ZIP header even when their length matches', async () => {
    const data = fixture(smallZip); const bytes = new Uint8Array(smallZip); bytes[0] = 0;
    const runner = downloader(data, { bytes });
    await assert.rejects(downloadPluginPackage(data.plugin, runner.options), /不是有效的 ZIP/);
    assert.ok(runner.progress.every(value => value.stage !== 'ready'));
});

test('expired signatures, network interruptions and failed reads give retry guidance without ready progress', async () => {
    const data = fixture(smallZip);
    for (const partResponse of [() => new Response('Expired', { status: 403 }), () => { throw new Error('Network failed'); }, () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error('Network failed')); } }))]) {
        const runner = downloader(data, { partResponse });
        await assert.rejects(downloadPluginPackage(data.plugin, runner.options), /过期|中断/);
        assert.ok(runner.progress.every(value => value.stage !== 'ready'));
    }
});

test('an already cancelled download performs no requests or progress callbacks', async () => {
    const data = fixture(smallZip); const runner = downloader(data); const controller = new AbortController(); controller.abort();
    await assert.rejects(downloadPluginPackage(data.plugin, { ...runner.options, signal: controller.signal }), { name: 'AbortError' });
    assert.equal(runner.calls.length, 0); assert.equal(runner.progress.length, 0);
});

test('cancellation ignores a late manifest reply and never starts a storage request', async () => {
    const data = fixture(smallZip); const controller = new AbortController(); const progress = []; let requests = 0; let reply;
    const pending = downloadPluginPackage(data.plugin, { storageOrigin: origin, signal: controller.signal, onProgress: value => progress.push(value), fetch: (_target, options) => { requests++; assert.equal(options.signal, controller.signal); return new Promise(resolve => { reply = resolve; }); } });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    controller.abort(); reply(Response.json(data.manifest)); await rejected;
    assert.equal(requests, 1); assert.equal(progress.length, 0);
});

test('cancellation releases a stalled part reader without late progress or a returned package', async () => {
    const data = fixture(smallZip); const controller = new AbortController(); const progress = []; let readerStarted; let cancelled = false;
    const started = new Promise(resolve => { readerStarted = resolve; });
    const pending = downloadPluginPackage(data.plugin, {
        storageOrigin: origin, signal: controller.signal, onProgress: value => progress.push(value),
        fetch: async target => target === data.plugin.downloadUrl ? Response.json(data.manifest) : new Response(new ReadableStream({ pull() { readerStarted(); }, cancel() { cancelled = true; } })),
    });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await started; const progressAtCancel = progress.length; controller.abort(); await rejected;
    assert.equal(cancelled, true); assert.equal(progress.length, progressAtCancel); assert.ok(progress.every(value => value.stage !== 'ready'));
});

test('cancellation between verified parts prevents the next request', async () => {
    const controller = new AbortController(); const runner = downloader(large);
    await assert.rejects(downloadPluginPackage(large.plugin, { ...runner.options, signal: controller.signal, onProgress: value => { runner.progress.push(value); if (value.completedParts === 1) controller.abort(); } }), { name: 'AbortError' });
    assert.equal(runner.calls.length, 2); assert.ok(runner.progress.every(value => value.stage !== 'ready'));
});
