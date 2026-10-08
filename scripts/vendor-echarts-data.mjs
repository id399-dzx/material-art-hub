/** Mirror assets that require their original MIME types; large binary chunks stream via pinned rewrites. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'public/echarts-official');
const sources = JSON.parse(await readFile(join(output, 'provenance-sources.json'), 'utf8'));
const assets = sources.assets.filter(asset => !asset.path.endsWith('.bin'));
const records = [];
let cursor = 0;
async function mirror() {
  while (cursor < assets.length) {
    const asset = assets[cursor++];
    const url = `https://raw.githubusercontent.com/apache/echarts-examples/${sources.upstream.commit}/public/${asset.path}`;
    let bytes;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        bytes = Buffer.from(await response.arrayBuffer());
        const hash = createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
        if (hash !== asset.gitBlob) throw new Error(`Dataset bytes changed: ${asset.path}`);
        break;
      } catch (error) { if (attempt === 3) throw error; }
    }
    const destination = join(output, asset.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    records.push({ ...asset, url });
    if (records.length % 20 === 0) console.log(`Mirrored ${records.length}/${assets.length} datasets and textures`);
  }
}
await Promise.all(Array.from({ length: 8 }, mirror));
await writeFile(join(output, 'provenance-data.json'), JSON.stringify({ upstream: sources.upstream, files: records.sort((a,b)=>a.path.localeCompare(b.path)), streamed: sources.assets.filter(asset => asset.path.endsWith('.bin')) }, null, 2) + '\n');
console.log(`Preserved ${records.length} original datasets / textures; binary chunks use the pinned streaming origin.`);
