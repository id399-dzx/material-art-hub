/**
 * Vendor the exact public Apache ECharts gallery at a pinned Git commit.
 * Thumbnails and category SVGs retain their upstream bytes; Git blob hashes
 * are verified before files are written. The generated catalog follows
 * src/explore/Explore.vue, including category priority and hidden examples.
 *
 * Usage: node scripts/vendor-echarts-catalog.mjs
 * Optional offline metadata: --upstream-dir=/path/to/checkout --tree-file=/path/to/tree.json
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = "88ca004030e999073a15303e5fe32462b8fefae2";
const REPOSITORY = "https://github.com/apache/echarts-examples";
const RAW_ROOT = `https://raw.githubusercontent.com/apache/echarts-examples/${COMMIT}/`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/echarts-official");
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return [argument.slice(2, separator), argument.slice(separator + 1)];
}));

export function gitBlobHash(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

async function fetchBytes(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function main() {
  const treeBytes = args["tree-file"]
    ? await readFile(args["tree-file"])
    : await fetchBytes(`https://api.github.com/repos/apache/echarts-examples/git/trees/${COMMIT}?recursive=1`);
  const treeResponse = JSON.parse(treeBytes.toString());
  if (treeResponse.truncated) throw new Error("Upstream tree is truncated; refusing an incomplete catalog.");
  if (treeResponse.sha !== COMMIT) throw new Error("Upstream tree does not match the pinned commit.");
  const tree = new Map(treeResponse.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry]));
  const sources = [];

  async function upstreamBytes(sourcePath) {
    const entry = tree.get(sourcePath);
    if (!entry) throw new Error(`Missing upstream file: ${sourcePath}`);
    const bytes = args["upstream-dir"]
      ? await readFile(path.join(args["upstream-dir"], sourcePath))
      : await fetchBytes(`${RAW_ROOT}${sourcePath}`);
    if (gitBlobHash(bytes) !== entry.sha) throw new Error(`Upstream byte verification failed: ${sourcePath}`);
    sources.push({ path: sourcePath, gitBlob: entry.sha, bytes: bytes.length });
    return bytes;
  }

  const listSource = (await upstreamBytes("src/data/chart-list-data.js")).toString();
  const glSource = (await upstreamBytes("src/data/chart-list-data-gl.js")).toString();
  const configSource = (await upstreamBytes("src/common/config.js")).toString();
  const localeSource = (await upstreamBytes("src/common/i18n.js")).toString();
  await upstreamBytes("src/explore/Explore.vue");
  await upstreamBytes("src/explore/ExampleCard.vue");
  const parseData = (source) => JSON.parse(source.split("export default ")[1].trim().replace(/;$/, ""));
  const regular = parseData(listSource);
  const gl = parseData(glSource);
  // Parse literal data only. No upstream JavaScript is executed during vendoring.
  const parseArray = (source) => JSON.parse(source.replace(/\/\/[^\n]*/g, "").replace(/'/g, '"').replace(/,\s*]/g, "]"));
  const categories = parseArray(configSource.match(/EXAMPLE_CATEGORIES = (\[[\s\S]*?\]);/)[1]);
  const hidden = parseArray(configSource.match(/\}\)\((\[[\s\S]*?\])\);/)[1]);
  const chineseChartTypes = localeSource.split("  zh: {")[1].split("    chartTypes: {")[1].split("    }")[0];
  const labels = Object.fromEntries([...chineseChartTypes.matchAll(/\s+(\w+): '([^']+)'/g)].map((match) => [match[1], match[2]]));
  const hiddenSet = new Set(hidden);
  const categorySet = new Set(categories);
  const examples = [];
  for (const [list, isGL] of [[regular, false], [gl, true]]) {
    for (const example of list) {
      const membership = typeof example.category === "string" ? [example.category] : example.category || [];
      if (hiddenSet.has(example.id) || example.noExplore || !membership.some((category) => categorySet.has(category))) continue;
      const item = {
        id: example.id,
        title: example.title || "",
        titleCN: example.titleCN || example.title || "",
        category: membership,
        isGL,
      };
      for (const key of ["ts", "since", "theme"]) if (example[key] !== undefined) item[key] = example[key];
      examples.push(item);
    }
  }
  const categoryExamples = Object.fromEntries(categories.map((category) => [category, examples
    .filter((example) => example.category.includes(category))
    .sort((a, b) => Number(a.isGL) - Number(b.isGL) || a.category.indexOf(category) - b.category.indexOf(category))
    .map((example) => example.id)]));
  const catalogCategories = categories.map((id, index) => ({ id, label: labels[id], icon: `/echarts-official/icons/${index >= 28 ? "gl" : id}.svg` }));
  if (catalogCategories.some((category) => !category.label)) throw new Error("A category lacks its original Chinese label.");

  const assets = new Map();
  for (const example of examples) {
    for (const theme of example.theme ? [example.theme] : ["", "dark"]) {
      const prefix = `${example.isGL ? "data-gl" : "data"}/thumb${theme ? `-${theme}` : ""}/${example.id}`;
      const upstreamPath = [`public/${prefix}.webp`, `public/${prefix}.png`].find((candidate) => tree.has(candidate));
      if (!upstreamPath) throw new Error(`Original preview is missing for ${example.id}, theme ${theme || "light"}`);
      assets.set(upstreamPath, { source: upstreamPath, destination: upstreamPath.slice("public/".length), ...tree.get(upstreamPath) });
    }
  }
  for (const icon of new Set(catalogCategories.map((category) => category.icon.split("/").at(-1)))) {
    const sourcePath = `src/asset/icon/${icon}`;
    assets.set(sourcePath, { source: sourcePath, destination: `icons/${icon}`, ...tree.get(sourcePath) });
  }
  const license = await upstreamBytes("LICENSE");
  await mkdir(OUTPUT, { recursive: true });
  await writeFile(path.join(OUTPUT, "LICENSE"), license);
  const manifestAssets = [];
  let processed = 0;
  const assetQueue = [...assets.values()];
  console.log(`Vendoring ${examples.length} examples, ${categories.length} categories, ${assetQueue.length} assets (${(assetQueue.reduce((sum, asset) => sum + asset.size, 0) / 1e6).toFixed(1)} MB).`);
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (assetQueue.length) {
      const asset = assetQueue.shift();
      const outputPath = path.join(OUTPUT, asset.destination);
      let bytes;
      try { bytes = await readFile(outputPath); } catch { /* Not yet vendored. */ }
      if (!bytes || gitBlobHash(bytes) !== asset.sha) bytes = await fetchBytes(`${RAW_ROOT}${asset.source}`);
      if (gitBlobHash(bytes) !== asset.sha) throw new Error(`Downloaded bytes differ from upstream: ${asset.source}`);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, bytes);
      manifestAssets.push({ source: asset.source, destination: asset.destination, gitBlob: asset.sha, bytes: bytes.length });
      processed++;
      if (processed % 100 === 0) console.log(`Verified ${processed}/${assets.size} assets.`);
    }
  }));
  const upstream = { commit: COMMIT, repository: REPOSITORY, gallery: "https://echarts.apache.org/examples/zh/index.html", version: "6.1.0" };
  const catalog = `/** Generated by scripts/vendor-echarts-catalog.mjs from Apache ECharts. See /echarts-official/LICENSE. */\n` +
    `export type EChartsOfficialExample = {\n  id: string;\n  title: string;\n  titleCN: string;\n  category: string[];\n  isGL: boolean;\n  ts?: boolean;\n  since?: string;\n  theme?: string;\n};\n\n` +
    `export type EChartsOfficialCategory = { id: string; label: string; icon: string };\n\n` +
    `export const ECHARTS_UPSTREAM = ${JSON.stringify(upstream, null, 2)} as const;\n\n` +
    `export const ECHARTS_CATEGORIES: EChartsOfficialCategory[] = ${JSON.stringify(catalogCategories, null, 2)};\n\n` +
    `export const ECHARTS_EXAMPLES: EChartsOfficialExample[] = ${JSON.stringify(examples, null, 2)};\n\n` +
    `/** Match the category-priority ordering of the original Explore.vue. */\n` +
    `export function getExamplesForCategory(category: string): EChartsOfficialExample[] {\n  return ECHARTS_EXAMPLES.filter((example) => example.category.includes(category)).sort(\n    (a, b) => Number(a.isGL) - Number(b.isGL) || a.category.indexOf(category) - b.category.indexOf(category),\n  );\n}\n\n` +
    `/** Fixed example themes take precedence, just as in upstream ExampleCard.vue. */\n` +
    `export function getExampleThumbnail(example: EChartsOfficialExample, darkMode = false): string {\n  const theme = example.theme || (darkMode ? "dark" : "");\n  return \`/echarts-official/\${example.isGL ? "data-gl" : "data"}/thumb\${theme ? \`-\${theme}\` : ""}/\${example.id}.webp\`;\n}\n`;
  await mkdir(path.join(ROOT, "src/lib/chart-examples"), { recursive: true });
  await writeFile(path.join(ROOT, "src/lib/chart-examples/catalog.ts"), catalog);
  const manifest = {
    upstream,
    provenance: "Exact Apache ECharts public gallery metadata and unmodified previews. No chart recoloring, cropping, conversion or redraw.",
    selection: { hidden, uniqueExamples: examples.length, categoryCount: categories.length, categoryMemberships: Object.values(categoryExamples).reduce((sum, entries) => sum + entries.length, 0), exampleIds: examples.map((example) => example.id), categoryExamples },
    sources,
    assets: manifestAssets.sort((a, b) => a.destination.localeCompare(b.destination)),
  };
  await writeFile(path.join(OUTPUT, "provenance-catalog.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Catalog complete: ${examples.length} examples, ${manifest.selection.categoryMemberships} category memberships, all original preview bytes verified.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
