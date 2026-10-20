import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSoftwareProducts, findSoftwareProduct, matchesSoftwareProduct } from './products.ts';
const common = '一套键鼠，自如跨屏。在同一局域网共享键鼠、剪贴板和文件。';
function entry(id, platform, overrides = {}) {
  const mac = platform === 'mac';
  return { id, name: `Fesilent Mouse · ${mac ? 'Mac 版（Apple Silicon）' : 'Windows 版'}`, host: '其他', schema: 'fesilent-plugin-v1',
    summary: common + (mac ? '此下载适用于 M 系列芯片的 Mac。' : '此下载适用于 Windows x64。'), version: '0.2.2 预览版',
    features: ['跨屏键鼠', '剪贴板同步'], environment: [mac ? 'macOS Apple Silicon ARM64' : 'Windows x64'], installation: [mac ? '辅助功能授权' : '解压运行'], outputs: [mac ? 'Mac 应用程序' : 'Windows 程序'],
    packageName: mac ? 'Fesilent-Mouse-v0.2.2-macOS-Apple-Silicon.zip' : 'Fesilent-Mouse-v0.2.2-Windows-x64.zip', packageBytes: mac ? 7016974 : 6332584,
    packagePath: `${id}/package.zip`, downloadUrl: `/api/software-plugins/${id}/download`, publishedAt: '2026-10-20T00:00:00Z', ...overrides };
}

test('two operating systems render one product with shared copy and stable Windows-first identity', () => {
  const windows = entry('windows', 'windows'), mac = entry('mac', 'mac');
  for (const source of [[mac, windows], [windows, mac]]) {
    const products = groupSoftwareProducts(source);
    assert.equal(products.length, 1);
    assert.equal(products[0].name, 'Fesilent Mouse');
    assert.equal(products[0].id, 'windows');
    assert.equal(products[0].summary, common);
    assert.deepEqual(products[0].features, ['跨屏键鼠', '剪贴板同步']);
    assert.deepEqual(products[0].variants.map(v => v.label), ['Windows x64', 'Mac · Apple Silicon']);
    assert.deepEqual(products[0].variants.map(v => v.plugin), [windows, mac]);
    assert.equal(source[0].name.includes('版'), true);
  }
});

test('either old edition URL resolves the same detail without changing package routes or instructions', () => {
  const windows = entry('windows', 'windows'), mac = entry('mac', 'mac');
  const products = groupSoftwareProducts([mac, windows]);
  assert.equal(findSoftwareProduct(products, mac.id), findSoftwareProduct(products, windows.id));
  assert.equal(findSoftwareProduct(products, 'unknown'), undefined);
  for (const original of [windows, mac]) {
    const selected = products[0].variants.find(v => v.plugin.id === original.id).plugin;
    assert.equal(selected, original);
    assert.equal(selected.downloadUrl, `/api/software-plugins/${original.id}/download`);
    assert.deepEqual(selected.installation, original.installation);
    assert.equal(selected.packageName, original.packageName);
  }
});

test('unpublished or removed editions cannot be invented by grouping', () => {
  const [product] = groupSoftwareProducts([entry('windows', 'windows')]);
  assert.equal(product.name, 'Fesilent Mouse');
  assert.equal(product.variants.length, 1);
  assert.equal(findSoftwareProduct([product], 'mac'), undefined);
  assert.deepEqual(groupSoftwareProducts([]), []);
});

test('ordinary products, similar titles and different hosts remain separate', () => {
  const products = groupSoftwareProducts([
    entry('windows', 'windows'), entry('mac', 'mac'),
    entry('different-host', 'mac', { host: 'Blender' }),
    entry('similar', 'windows', { name: 'Fesilent Mouse Pro · Windows 版' }),
    entry('ordinary-1', 'windows', { name: '科研工具' }), entry('ordinary-2', 'mac', { name: '科研工具' }),
  ]);
  assert.equal(products.length, 5);
  assert.equal(products.find(p => p.name === '科研工具').variants[0].label, '科研工具');
});

test('searches for either platform, architecture or file capability find the unified card', () => {
  const [product] = groupSoftwareProducts([entry('mac', 'mac'), entry('windows', 'windows')]);
  for (const term of ['Windows', 'MAC', 'Apple Silicon', 'x64', '剪贴板', '应用程序', '  mouse  ']) assert.equal(matchesSoftwareProduct(product, '全部', term), true, term);
  assert.equal(matchesSoftwareProduct(product, 'Blender', ''), false);
  assert.equal(matchesSoftwareProduct(product, '其他', '不存在'), false);
});

test('edition-specific versions and unique features survive grouping', () => {
  const [product] = groupSoftwareProducts([entry('windows', 'windows'), entry('mac', 'mac', { version: '0.2.3', features: ['剪贴板同步', 'Mac 主控'] })]);
  assert.equal(product.version, '按系统查看版本');
  assert.equal(product.variants[1].plugin.version, '0.2.3');
  assert.deepEqual(product.features, ['跨屏键鼠', '剪贴板同步', 'Mac 主控']);
});
