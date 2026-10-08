/** Mirror pinned, licensed editor dependencies; never execute downloaded packages. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'public/echarts-official/vendors');
const temporary = join(root, 'node_modules/.cache/echarts-official-vendor');
const packages = [
  ['echarts', '6.1.0', 'echarts', ['dist/echarts.min.js', 'dist/extension/bmap.min.js', 'types/dist/echarts.d.ts', 'theme', 'LICENSE', 'NOTICE', 'licenses']],
  ['echarts-gl', '2.0.9', 'echarts-gl', ['dist/echarts-gl.min.js', 'LICENSE', 'NOTICE']],
  ['echarts-stat', '1.2.0', 'echarts-stat', ['dist/ecStat.min.js', 'LICENSE']],
  ['echarts-graph-modularity', '2.1.0', 'echarts-graph-modularity', ['dist/echarts-graph-modularity.min.js', 'LICENSE']],
  ['dat.gui', '0.6.5', 'dat.gui@0.6.5', ['build/dat.gui.min.js', 'LICENSE']],
  ['jquery', '3.7.1', 'jquery@3.7.1', ['dist/jquery.min.js', 'LICENSE.txt']],
  ['seedrandom', '3.0.5', 'seedrandom@3.0.5', ['seedrandom.min.js', 'LICENSE']],
  ['acorn', '8.7.1', 'acorn@8.7.1', ['dist/acorn.js', 'LICENSE']],
  ['ace-builds', '1.4.12', 'ace-builds@1.4.12', ['src-min-noconflict', 'LICENSE']],
  ['monaco-editor', '0.27.0', 'monaco-editor@0.27.0', ['min/vs', 'LICENSE', 'ThirdPartyNotices.txt']],
  ['prettier', '2.3.2', 'prettier@2.3.2', ['standalone.js', 'parser-babel.js', 'parser-typescript.js', 'LICENSE', 'THIRD-PARTY-NOTICES.md']],
  ['vue', '2.6.14', 'vue@2.6.14', ['dist/vue.min.js', 'LICENSE']],
  ['element-ui', '2.15.14', 'element-ui@2.15.14', ['lib/index.js', 'lib/theme-chalk', 'LICENSE']],
  ['bootstrap', '3.3.7', 'bootstrap@3.3.7', ['dist', 'LICENSE']],
];
const provenance = [];
const licensesOnly = process.argv.includes('--licenses-only');
const licenseFallbackPackages = new Set(['seedrandom', 'echarts-stat', 'echarts-graph-modularity']);
async function obtain(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { if (attempt === 3) throw error; }
  }
}
await mkdir(temporary, { recursive: true });
await mkdir(output, { recursive: true });
async function mirror([name, version, directory, paths]) {
  const metadata = JSON.parse((await obtain(`https://registry.npmjs.org/${name}/${version}`)).toString());
  const tarball = await obtain(metadata.dist.tarball);
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  if (metadata.dist.integrity !== integrity) throw new Error(`Integrity mismatch: ${name}`);
  const scratch = join(temporary, directory);
  await mkdir(scratch, { recursive: true });
  await writeFile(join(scratch, 'package.tgz'), tarball);
  execFileSync('tar', ['-xzf', join(scratch, 'package.tgz'), '-C', scratch]);
  for (const path of paths) {
    const destination = join(output, directory, path);
    await mkdir(dirname(destination), { recursive: true });
    try { await cp(join(scratch, 'package', path), destination, { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const record = { name, version, directory, url: metadata.dist.tarball, integrity };
  // These exact published packages do not include a standalone LICENSE file.
  // Preserve the publisher's own license declaration and original attribution,
  // without guessing a different BSD/ISC text or assigning a copyright holder.
  if (licenseFallbackPackages.has(name)) {
    const originalPackage = await readFile(join(scratch, 'package/package.json'));
    const originalReadme = await readFile(join(scratch, 'package/README.md'));
    await writeFile(join(output, directory, 'package.json'), originalPackage);
    await writeFile(join(output, directory, 'README.md'), originalReadme);
    const declaredLicense = metadata.license;
    let licenseNote;
    const evidenceFiles = ['package.json', 'README.md', 'UPSTREAM-LICENSE-NOTICE.txt'];
    if (name === 'seedrandom') {
      const licenseStart = originalReadme.indexOf(Buffer.from('LICENSE (MIT)'));
      if (licenseStart < 0 || !originalReadme.subarray(licenseStart).toString().includes('Copyright 2019 David Bau.')) {
        throw new Error('seedrandom MIT license section changed; review upstream attribution.');
      }
      // Preserve the full license section verbatim from the verified package.
      await writeFile(join(output, directory, 'LICENSE'), originalReadme.subarray(licenseStart));
      evidenceFiles.push('LICENSE');
      licenseNote = 'The complete MIT license in LICENSE is extracted verbatim from the original package README.md.';
    } else {
      licenseNote = 'The official published package and its source revision provide the declaration in package.json, but no standalone LICENSE or full license text. Original package.json and README.md are retained; no license terms or copyright holder have been invented.';
    }
    const upstreamNote = `${name}@${version}\n\n` +
      `Official package: ${metadata.dist.tarball}\n` +
      `Verified package integrity: ${integrity}\n` +
      `Official repository: ${typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url || ''}\n` +
      `Published source revision: ${metadata.gitHead || ''}\n` +
      `Publisher-declared license: ${JSON.stringify(declaredLicense)}\n\n` +
      `${licenseNote}\n`;
    await writeFile(join(output, directory, 'UPSTREAM-LICENSE-NOTICE.txt'), upstreamNote);
    record.licensing = {
      declared: declaredLicense,
      sourceRevision: metadata.gitHead || null,
      evidenceFiles,
      note: licenseNote,
      packageJsonSha256: createHash('sha256').update(originalPackage).digest('hex'),
      readmeSha256: createHash('sha256').update(originalReadme).digest('hex'),
    };
  }
  provenance.push(record);
  console.log(`Mirrored ${name}@${version}`);
}
// Limit concurrent extraction / downloads.
const selectedPackages = licensesOnly ? packages.filter(([name]) => licenseFallbackPackages.has(name)) : packages;
for (let offset = 0; offset < selectedPackages.length; offset += 4) {
  await Promise.all(selectedPackages.slice(offset, offset + 4).map(mirror));
}
if (!licensesOnly) {
await cp(join(output, 'vue@2.6.14/dist/vue.min.js'), join(output, 'vue@2.6.14/vue.min.js'));
await cp(join(output, 'element-ui@2.15.14/lib/index.js'), join(output, 'element-ui@2.15.14/index.js'));
for (const path of ['css', 'js', 'fonts']) {
  await cp(join(output, 'bootstrap@3.3.7/dist', path), join(output, 'bootstrap@3.3.7', path), { recursive: true });
}
await cp(join(output, 'acorn@8.7.1/dist/acorn.js'), join(output, 'acorn@8.7.1/dist/acorn.min.js'));
// Use the exact runtime served by the official gallery, with a checked version.
const officialURL = 'https://echarts.apache.org/zh/js/vendors/echarts/dist/echarts.min.js';
const officialRuntime = await obtain(officialURL);
if (!officialRuntime.toString().includes('version="6.1.0"')) throw new Error('Official ECharts version changed; review before updating.');
await writeFile(join(output, 'echarts/dist/echarts.min.js'), officialRuntime);
provenance.push({ name: 'official-echarts-runtime', version: '6.1.0', url: officialURL, sha256: createHash('sha256').update(officialRuntime).digest('hex') });
const worldURL = 'https://echarts.apache.org/en/asset/map/js/world.js';
await mkdir(join(output, 'echarts/map/js'), { recursive: true });
const world = await obtain(worldURL);
await writeFile(join(output, 'echarts/map/js/world.js'), world);
provenance.push({ name: 'official-world-map', url: worldURL, sha256: createHash('sha256').update(world).digest('hex') });
} else {
  const previous = JSON.parse(await readFile(join(root, 'public/echarts-official/provenance-runtime.json'), 'utf8'));
  provenance.push(...previous.packages.filter(item => !licenseFallbackPackages.has(item.name)));
}
// Hash every shipped file so the checked-in dependency mirror can be audited offline.
const files = [];
async function hashFiles(directory, prefix = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${item.name}`;
    if (item.isDirectory()) await hashFiles(join(directory, item.name), `${relative}/`);
    else {
      const bytes = await readFile(join(directory, item.name));
      files.push({ path: relative, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await hashFiles(output);
await writeFile(join(root, 'public/echarts-official/provenance-runtime.json'), JSON.stringify({ packages: provenance.sort((a,b)=>a.name.localeCompare(b.name)), files }, null, 2) + '\n');
await rm(temporary, { recursive: true, force: true });
console.log(`Verified ${files.length} runtime files.`);
