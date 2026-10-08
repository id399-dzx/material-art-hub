/** Copy official code verbatim; JS is the gallery's published compilation, not a recreated chart. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECHARTS_EXAMPLES, ECHARTS_UPSTREAM } from '../src/lib/chart-examples/catalog.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'public/echarts-official');
const records = [];
const jobs = ECHARTS_EXAMPLES.flatMap(example => {
  const folder = example.isGL ? 'gl/' : '';
  const js = { example: example.id, path: `examples/js/${folder}${example.id}.js`, url: `${ECHARTS_UPSTREAM.gallery.replace('/zh/index.html', '')}/examples/js/${folder}${example.id}.js` };
  return example.ts ? [js, { example: example.id, path: `examples/ts/${folder}${example.id}.ts`, url: `https://raw.githubusercontent.com/apache/echarts-examples/${ECHARTS_UPSTREAM.commit}/public/examples/ts/${folder}${example.id}.ts` }] : [js];
});
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    let bytes;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(job.url, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`${response.status} ${job.url}`);
        bytes = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) { if (attempt === 3) throw error; }
    }
    const target = join(output, job.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    records.push({ ...job, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (records.length % 50 === 0) console.log(`Copied ${records.length}/${jobs.length} original sources`);
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
// Fixed public dataset manifest for documenting the pinned resource rewrites.
const tree = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : await (await fetch(`https://api.github.com/repos/apache/echarts-examples/git/trees/${ECHARTS_UPSTREAM.commit}?recursive=1`)).json();
const assets = tree.tree.filter(item => item.type === 'blob' && /^public\/data(?:-gl)?\/asset\//.test(item.path)).map(item => ({ path: item.path.replace(/^public\//, ''), size: item.size, gitBlob: item.sha }));
await writeFile(join(output, 'provenance-sources.json'), JSON.stringify({ upstream: ECHARTS_UPSTREAM, files: records.sort((a,b)=>a.path.localeCompare(b.path)), assets }, null, 2) + '\n');
console.log(`Preserved ${records.length} original sources and pinned ${assets.length} public dataset assets.`);
