#!/usr/bin/env node
/**
 * Update public GitHub metadata, without running repository code or uploading credentials.
 * Chinese descriptions are reviewed in curation.json. Every unlisted public star
 * is reported for manual relevance / Skill review; new-star detection is not claimed.
 * Usage: node scripts/sync-starred-skills.mjs --sync
 *        node scripts/sync-starred-skills.mjs --check  (offline catalog integrity check)
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const catalogRoot = new URL("../src/lib/research-skills/", import.meta.url);
const curated = JSON.parse(await readFile(new URL("curation.json", catalogRoot), "utf8"));
const account = "id399-dzx";

function validate(data) {
  if (data.account !== account || !Array.isArray(data.repositories)) throw new Error("Unexpected GitHub account or catalog.");
  const names = new Set();
  for (const item of data.repositories) {
    if (names.has(item.repo)) throw new Error(`Duplicate repository: ${item.repo}`);
    names.add(item.repo);
    if (!curated.some((entry) => entry.repo === item.repo)) throw new Error(`Missing reviewed Chinese synopsis: ${item.repo}`);
    if (!/^[\w.-]+\/[\w.-]+$/.test(item.repo) || item.url !== `https://github.com/${item.repo}`) throw new Error(`Invalid public source: ${item.repo}`);
    if (!item.skillPaths?.length || !item.skillPaths.every((path) => /(^|\/)skill\.md$/i.test(path))) throw new Error(`No verified Skill: ${item.repo}`);
    if (item.isStarred !== true || !item.readmeSha || !item.treeSha) throw new Error(`Incomplete source evidence: ${item.repo}`);
  }
  if (data.starredRepositoryCount < data.repositories.length) throw new Error("Invalid star count.");
  return data;
}

if (process.argv.includes("--check")) {
  const snapshot = validate(JSON.parse(await readFile(new URL("snapshot.json", catalogRoot), "utf8")));
  console.log(`Verified ${snapshot.repositories.length} reviewed Skill repositories from ${snapshot.starredRepositoryCount} public stars.`);
} else if (process.argv.includes("--sync")) {
  const gh = async (endpoint, flags = []) => {
    const { stdout } = await run("gh", ["api", endpoint, ...flags], { maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(stdout);
  };
  const pages = await gh(`users/${account}/starred?per_page=100`, ["--paginate", "--slurp"]);
  const stars = pages.flat();
  const selected = [];
  const remaining = curated.filter((entry) => stars.some((repo) => repo.full_name === entry.repo));
  // Bounded workers keep sync fast while respecting GitHub API rate limits.
  let nextIndex = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (nextIndex < remaining.length) {
      const entry = remaining[nextIndex++];
      const metadata = stars.find((repo) => repo.full_name === entry.repo);
      const [tree, readme] = await Promise.all([
        gh(`repos/${entry.repo}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`),
        gh(`repos/${entry.repo}/readme`),
      ]);
      if (tree.truncated) throw new Error(`Incomplete tree for ${entry.repo}; review before publishing.`);
      const skillPaths = tree.tree.filter((item) => item.type === "blob" && /(^|\/)skill\.md$/i.test(item.path)).map((item) => item.path);
      if (!skillPaths.length) throw new Error(`Skill files removed from ${entry.repo}; review before publishing.`);
      selected.push({
        repo: entry.repo,
        owner: metadata.owner.login,
        url: metadata.html_url,
        defaultBranch: metadata.default_branch,
        topics: metadata.topics ?? [],
        license: metadata.license?.spdx_id ?? null,
        repositoryUpdatedAt: metadata.updated_at,
        isStarred: true,
        skillPaths,
        treeSha: tree.sha,
        readmePath: readme.path,
        readmeSha: readme.sha,
        readmeUrl: readme.html_url,
      });
    }
  }));
  selected.sort((a, b) => curated.findIndex((entry) => entry.repo === a.repo) - curated.findIndex((entry) => entry.repo === b.repo));
  const snapshot = validate({
    account,
    checkedAt: new Date().toISOString(),
    synopsisReviewedAt: "2026-10-03",
    source: `https://github.com/${account}?tab=stars`,
    starredRepositoryCount: stars.length,
    repositories: selected,
  });
  await writeFile(new URL("snapshot.json", catalogRoot), `${JSON.stringify(snapshot, null, 2)}\n`);
  const unmatched = stars.filter((repo) => !curated.some((entry) => entry.repo === repo.full_name));
  console.log(`Updated ${selected.length} reviewed repositories. ${unmatched.length} other stars remain outside this research catalog.`);
  if (unmatched.length) {
    console.log("Unlisted public stars — manually review research relevance and actual Skill files. This list is not an automatic scientific-Skill classification or a list of newly starred repositories:");
    for (const repo of unmatched) {
      const description = (repo.description ?? "No repository description").replace(/\s+/g, " ").trim();
      console.log(`- ${repo.full_name}: ${description}`);
    }
  }
  console.log("Add a reviewed Chinese synopsis to curation.json before including a relevant Skill repository. No upstream instructions or scripts were executed.");
} else {
  console.log(`Usage: node ${fileURLToPath(import.meta.url)} --sync | --check`);
  process.exitCode = 1;
}
