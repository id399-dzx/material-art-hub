import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = join(root, 'vendor/echarts-examples');
const destination = join(root, 'public/echarts-official');

function run(args) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: upstream,
    stdio: 'inherit',
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!existsSync(join(upstream, 'node_modules/webpack/bin/webpack.js'))) {
  // Upstream uses Vue 2 with a visualizer declaring an optional Vue 3 peer.
  run(['ci', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund']);
}
// Upstream embeds setup as a function expression. Babel helpers outside that
// function would invalidate the srcdoc even when the outer bundle compiles.
const requireUpstream = createRequire(join(upstream, 'package.json'));
const babel = requireUpstream('@babel/core');
const { minify } = requireUpstream('terser');
async function rawFragment(relative) {
  const transformed = babel.transformFileSync(join(upstream, relative), {
    cwd: upstream,
    envName: 'production'
  });
  return (await minify(transformed.code, {
    compress: { pure_funcs: ['console.debug', 'console.log'] }
  })).code;
}
const loop = await rawFragment('src/editor/sandbox/handleLoop.js');
const dirtyRect = await rawFragment('src/dep/showDebugDirtyRect.js');
const setup = await rawFragment('src/editor/sandbox/setup.js');
new vm.Script(`(()=>{${loop}\n${dirtyRect}\n(${setup})(false)})()`);
console.log('Verified generated chart sandbox script syntax.');
mkdirSync(join(upstream, 'public'), { recursive: true });
const webpack = requireUpstream('webpack');
const configure = requireUpstream(join(upstream, 'build/webpack.config.js'));
const configurations = configure({}, { mode: 'production' }).map((configuration) => ({
  ...configuration,
  context: upstream,
  mode: 'production'
}));
const compiler = webpack(configurations);
const statistics = await new Promise((resolveStatistics, reject) => {
  compiler.run((error, statistics) => {
    compiler.close((closeError) => {
      if (error || closeError) return reject(error || closeError);
      if (statistics.hasErrors()) {
        return reject(new Error(statistics.toString({ all: false, errors: true, errorDetails: true })));
      }
      resolveStatistics(statistics);
    });
  });
});

// Preserve notices for the packages actually present in the two editor bundles.
const packages = new Set();
function collectPackages(statistics) {
  for (const bundleModule of statistics.modules || []) {
    const identifier = (bundleModule.nameForCondition || bundleModule.identifier || '').split('!').at(-1);
    const match = identifier.match(/[/\\]node_modules[/\\]((?:@[^/\\]+[/\\])?[^/\\]+)/);
    if (match) packages.add(match[1].replaceAll('\\', '/'));
    collectPackages(bundleModule);
  }
  for (const child of statistics.children || []) collectPackages(child);
}
collectPackages(statistics.toJson({
  all: false,
  modules: true,
  nestedModules: true,
  dependentModules: true,
  orphanModules: true,
  groupModulesByAttributes: false,
  groupModulesByCacheStatus: false,
  groupModulesByType: false,
  groupModulesByPath: false,
  groupModulesByExtension: false,
  groupModulesByLayer: false,
  modulesSpace: Infinity
}));
const notices = ['Apache ECharts Examples — Apache License 2.0',
  readFileSync(join(upstream, 'LICENSE'), 'utf8')];
for (const name of [...packages].sort()) {
  const directory = join(upstream, 'node_modules', name);
  const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  notices.push(`\n${'='.repeat(72)}\n${name}@${metadata.version} — ${metadata.license || 'See package notices'}\n`);
  for (const filename of readdirSync(directory).filter((name) => /^(?:LICEN[CS]E|COPYING|NOTICE)(?:\.|$)/i.test(name))) {
    const path = join(directory, filename);
    try { notices.push(readFileSync(path, 'utf8')); } catch (error) { if (error.code !== 'EISDIR') throw error; }
  }
}
mkdirSync(join(upstream, 'public/js'), { recursive: true });
writeFileSync(join(upstream, 'public/js/LICENSES.txt'), notices.join('\n'));

for (const folder of ['js', 'css', 'asset']) {
  const source = join(upstream, 'public', folder);
  if (!existsSync(source)) continue;
  mkdirSync(join(destination, folder), { recursive: true });
  for (const name of readdirSync(source)) {
    cpSync(join(source, name), join(destination, folder, name), { recursive: true });
  }
}
console.log('Built the Apache ECharts Examples editor into public/echarts-official.');
