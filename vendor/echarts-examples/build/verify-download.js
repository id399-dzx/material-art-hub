const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const { transform } = require('sucrase');

const upstream = path.resolve(__dirname, '..');
const examples = path.resolve(upstream, '../../public/echarts-official/examples');
const origin = 'https://fesilent.com/echarts-official';
const store = {
  cdnRoot: origin,
  cdnPath: origin + '/vendors/',
  locale: 'zh',
  renderer: 'canvas',
  darkMode: false,
  theme: null,
  useDirtyRect: false
};
let downloaded;
const compiled = babel.transformFileSync(path.join(upstream, 'src/editor/downloadExample.js'), {
  cwd: upstream,
  plugins: ['@babel/plugin-transform-modules-commonjs']
}).code;
const exportedModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: exportedModule,
  exports: exportedModule.exports,
  Blob,
  require(name) {
    if (name === '../common/store') return { store };
    if (name === '../common/config') return {
      URL_PARAMS: { c: 'checked-example' },
      getScriptURLs: () => ({
        jQueryJS: origin + '/vendors/jquery@3.7.1/dist/jquery.min.js',
        latestEChartsDir: origin + '/vendors/echarts',
        echartsJS: '/dist/echarts.min.js'
      })
    };
    if (name === '../common/helper') return {
      downloadBlob: (blob, filename) => { downloaded = { blob, filename }; }
    };
    throw new Error(`Unexpected dependency: ${name}`);
  }
});

async function verify() {
  for (const [file, language, extension] of [
    ['line-simple', 'js', null],
    ['line-simple', 'ts', null],
    ['gl/simple-surface', 'js', 'echarts-gl/dist/echarts-gl.min.js'],
    ['scatter-linear-regression', 'ts', 'echarts-stat/dist/ecStat.min.js'],
    ['map-usa-projection', 'ts', null]
  ]) {
    // Match the upstream editor's metadata/module-marker parsing before compiling.
    const source = fs.readFileSync(path.join(examples, language, `${file}.${language}`), 'utf8')
      .trim().replace(/^\/\*[\s\S]*?\*\//, '').trim()
      .replace(/export\s+\{\s*\}\s*;?$/g, '');
    store.sourceCode = source;
    store.runCode = language === 'ts'
      ? transform(source, { transforms: ['typescript'] }).code.trim()
      : source;
    const scripts = [{ src: origin + '/vendors/echarts/dist/echarts.min.js' }];
    if (extension) scripts.push({ src: origin + '/vendors/' + extension });
    exportedModule.exports.download('Fesilent download verification', scripts, '');
    const html = await downloaded.blob.text();
    assert.equal(downloaded.filename, 'checked-example.html');
    assert.ok(html.includes('<html lang="zh-CN"'));
    if (extension) assert.ok(html.includes(`src="${origin}/vendors/${extension}"`));
    if (source.includes('CDN_PATH')) assert.ok(html.includes(`var CDN_PATH = "${store.cdnPath}"`));
    if (source.includes('ROOT_PATH')) assert.ok(html.includes(`var ROOT_PATH = "${store.cdnRoot}"`));
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      assert.ok(match[1].startsWith(origin + '/'), 'Dependencies must use absolute mirrored URLs');
    }
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]).filter((code) => code.trim());
    for (const code of inline) new vm.Script(code);
    if (file === 'line-simple') {
      let rendered;
      vm.runInNewContext(inline.join('\n'), {
        echarts: { init: () => ({ setOption: (option) => { rendered = option; }, resize() {} }) },
        document: { getElementById: () => ({}) },
        window: { addEventListener() {} }
      });
      assert.equal(rendered.series[0].type, 'line');
      assert.equal(rendered.series[0].data.length, 7);
      assert.equal(rendered.series[0].data[0], 150);
    }
    console.log(`${file} (${language}): generated HTML verified${file === 'line-simple' ? ' and chart code executed' : ''}`);
  }
}
verify().catch((error) => { console.error(error); process.exitCode = 1; });
