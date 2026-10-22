import assert from 'node:assert/strict';
import test from 'node:test';
import { batteryAppLocation } from './battery-app.ts';

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
