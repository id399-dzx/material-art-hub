import assert from 'node:assert/strict';
import test from 'node:test';
import { batteryAppIsAvailable, batteryAppLocation } from './battery-app.ts';

test('integration keeps original app routes and filters', () => {
  for (const route of ['all', 'hot', 'daily', 'weekly', 'monthly', 'topics', 'starred', 'more', 'agent', 'companies', 'admin/model-api', 'api/mcp', 'feed.xml']) {
    const location = batteryAppLocation('https://battery.example', 'https://fesilent.com/battery/' + route + '?q=BMS&channel=wechat', route.split('/'));
    assert.equal(location.pathname, '/' + route);
    assert.equal(location.search, '?q=BMS&channel=wechat');
  }
  assert.equal(batteryAppLocation('https://battery.example', 'https://fesilent.com/battery').href, 'https://battery.example/');
});
test('missing origin is explicit and invalid or looping targets are rejected', () => {
  assert.equal(batteryAppLocation('', 'https://fesilent.com/battery'), null);
  for (const target of ['javascript:alert(1)', 'https://user:pass@example.com', 'https://fesilent.com', 'https://example.com/battery', 'https://example.com?token=a']) {
    assert.throws(() => batteryAppLocation(target, 'https://fesilent.com/battery'));
  }
});

test('availability checks the validated app root with a bounded uncached HEAD request', async () => {
  const available = await batteryAppIsAvailable('https://battery.example', 'https://fesilent.com/battery/all?q=BMS', async (url, options) => {
    assert.equal(url.href, 'https://battery.example/');
    assert.equal(options.method, 'HEAD');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    return new Response(null, { status: 200 });
  });
  assert.equal(available, true);
});

test('availability accepts successful or redirecting origins and rejects error responses', async () => {
  for (const status of [200, 204, 301, 307, 399, 400, 404, 500, 503]) {
    assert.equal(await batteryAppIsAvailable('https://battery.example', 'https://fesilent.com/battery', async () => new Response(null, { status })), status < 400);
  }
});

test('unconfigured, invalid or circular origins are unavailable without making network requests', async () => {
  let requested = false;
  const fetcher = async () => { requested = true; return new Response(null, { status: 200 }); };
  for (const origin of ['', 'not a URL', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://fesilent.com', 'https://example.com/battery', 'https://example.com?token=a']) {
    assert.equal(await batteryAppIsAvailable(origin, 'https://fesilent.com/battery', fetcher), false);
  }
  assert.equal(requested, false);
});

test('network, TLS and timeout failures are unavailable without exposing or rethrowing errors', async () => {
  for (const error of [new TypeError('fetch failed'), new Error('certificate expired'), new DOMException('Timed out', 'TimeoutError')]) {
    assert.equal(await batteryAppIsAvailable('https://battery.example', 'https://fesilent.com/battery', async () => { throw error; }), false);
  }
});
